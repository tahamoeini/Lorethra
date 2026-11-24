"""Branch-scoped validation and provenance handling for StoryScene references."""

from __future__ import annotations

import hashlib
import json
import sqlite3
from typing import Any

from .errors import ValidationError


def _canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)


def _digest_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def pin_story_scene_reference_branches(scene: dict[str, Any], source_branch_id: str) -> None:
    """Pin implicit references before a scene payload crosses a branch boundary."""
    if scene.get("contract") != "lorethra.story-scene.v2":
        return

    def pin(reference: Any, field: str = "branch_id") -> None:
        if isinstance(reference, dict):
            reference.setdefault(field, source_branch_id)

    pin(scene.get("location_ref"))
    time_value = scene.get("in_world_time")
    if isinstance(time_value, dict) and isinstance(time_value.get("anchor"), dict):
        pin(time_value["anchor"])
    for participant in scene.get("participants", []):
        pin(participant.get("current_location_ref"))
        state_snapshot = participant.get("state_snapshot")
        if isinstance(state_snapshot, dict) and state_snapshot.get("status") == "captured":
            pin(state_snapshot)
            for source in state_snapshot.get("sources", []):
                pin(source)
    for interaction in scene.get("interactions", []):
        for reference in interaction.get("dialogue_refs", []):
            pin(reference)
        for source in interaction.get("source_refs", []):
            pin(source)
            if source.get("kind") == "story_turn":
                pin(source.get("turn_ref"))
    for reference in scene.get("memory_refs", []):
        pin(reference)
    manifest = scene.get("context_manifest_ref")
    if isinstance(manifest, dict):
        pin(manifest)
        pin(manifest.get("source_turn"))
    for reference in scene.get("history_refs", []):
        pin(reference.get("scene_ref"))


def validate_story_scene_references(
    connection: sqlite3.Connection,
    scene: dict[str, Any],
    *,
    previous_scene: dict[str, Any] | None = None,
) -> None:
    """Validate references without copying data from their owning domains."""
    if scene.get("contract") != "lorethra.story-scene.v2":
        return
    workspace_id = scene["workspace_id"]
    branch_id = scene["branch_id"]
    adventure_id = scene["adventure_id"]
    adventure = connection.execute(
        "SELECT actor_entity_id,conversation_id FROM story_adventures "
        "WHERE workspace_id=? AND branch_id=? AND adventure_id=?",
        (workspace_id, branch_id, adventure_id),
    ).fetchone()
    if not adventure:
        raise ValidationError("Story scene references an adventure outside its branch")

    participants = _validate_scene_participants(
        connection, scene, adventure, previous_scene=previous_scene,
    )
    _validate_scene_owned_references(connection, scene, previous_scene=previous_scene)
    _validate_interactions(connection, scene, adventure["conversation_id"], participants)


def _validate_scene_participants(
    connection: sqlite3.Connection,
    scene: dict[str, Any],
    adventure: sqlite3.Row,
    *,
    previous_scene: dict[str, Any] | None,
) -> dict[str, dict[str, Any]]:
    workspace_id = scene["workspace_id"]
    branch_id = scene["branch_id"]
    adventure_id = scene["adventure_id"]
    previous_participants = {
        item["participant_id"]: item
        for item in (previous_scene or {}).get("participants", [])
        if isinstance(item, dict) and isinstance(item.get("participant_id"), str)
    }
    participants: dict[str, dict[str, Any]] = {}
    participant_entity_ids: set[str] = set()
    protagonist_count = 0
    for participant in scene["participants"]:
        participant_id = participant["participant_id"]
        entity_id = participant["entity_id"]
        if participant_id in participants:
            raise ValidationError("Participant IDs must be unique within a scene revision")
        if entity_id in participant_entity_ids:
            raise ValidationError("An entity may appear only once in a scene revision")
        participants[participant_id] = participant
        participant_entity_ids.add(entity_id)

        entity = connection.execute(
            "SELECT entity_type,created_revision FROM entities WHERE workspace_id=? AND branch_id=? AND entity_id=?",
            (workspace_id, branch_id, entity_id),
        ).fetchone()
        if not entity or entity["created_revision"] > _reference_cutoff(connection, scene, branch_id):
            raise ValidationError("Participant entity must exist in the scene workspace and branch")
        kind = participant["participant_kind"]
        if entity["entity_type"] not in {"character", "person"}:
            raise ValidationError("Scene participants must reference a character or person entity")
        if kind == "protagonist":
            protagonist_count += 1
            if entity_id != adventure["actor_entity_id"]:
                raise ValidationError("The protagonist participant must match the adventure actor")
        if kind == "npc":
            previous = previous_participants.get(participant_id)
            already_validated = (
                previous_scene is not None
                and isinstance(previous, dict)
                and previous.get("entity_id") == entity_id
                and previous.get("participant_kind") == kind
            )
            if not already_validated:
                npc = connection.execute(
                    "SELECT review_status FROM story_npc_profiles WHERE workspace_id=? AND branch_id=? "
                    "AND adventure_id=? AND npc_entity_id=?",
                    (workspace_id, branch_id, adventure_id, entity_id),
                ).fetchone()
                if not npc or npc["review_status"] == "rejected":
                    raise ValidationError("NPC participants require a non-rejected profile in this adventure")

        for known_by in participant["knowledge_scope"]["known_by"]:
            known_entity = connection.execute(
                "SELECT entity_type FROM entities WHERE workspace_id=? AND branch_id=? AND entity_id=?",
                (workspace_id, branch_id, known_by),
            ).fetchone()
            if not known_entity or known_entity["entity_type"] not in {"character", "person"}:
                raise ValidationError("Actor-scoped participant knowledge must name characters in this branch")

        if len(_canonical_json(participant["scene_state"]).encode("utf-8")) > 20_000:
            raise ValidationError("Participant scene_state is limited to 20 KB")
        previous = previous_participants.get(participant_id)
        same_identity = (
            previous_scene is not None
            and isinstance(previous, dict)
            and previous.get("entity_id") == entity_id
            and previous.get("participant_kind") == kind
        )
        if not same_identity or previous.get("current_location_ref") != participant.get("current_location_ref"):
            _validate_location_ref(
                connection, scene, participant.get("current_location_ref"), "participant current location",
            )
        _validate_state_snapshot(
            connection,
            scene,
            adventure["conversation_id"],
            participant["state_snapshot"],
            validate_sources=not (same_identity and previous.get("state_snapshot") == participant["state_snapshot"]),
        )
        for asset_id in participant["visual_reference_ids"]:
            asset = connection.execute(
                "SELECT created_revision FROM story_assets WHERE workspace_id=? AND branch_id=? AND adventure_id=? "
                "AND asset_id=? AND target_kind='character' AND target_id=?",
                (workspace_id, branch_id, adventure_id, asset_id, entity_id),
            ).fetchone()
            if not asset or asset["created_revision"] > _reference_cutoff(connection, scene, branch_id):
                raise ValidationError("Participant visual references must be attached to that character in this adventure")

    if protagonist_count > 1:
        raise ValidationError("A scene can contain only one protagonist participant")
    return participants


def _validate_scene_owned_references(
    connection: sqlite3.Connection,
    scene: dict[str, Any],
    *,
    previous_scene: dict[str, Any] | None,
) -> None:
    if previous_scene is None or previous_scene.get("location_ref") != scene.get("location_ref"):
        _validate_location_ref(connection, scene, scene.get("location_ref"), "scene location")
    _validate_context_manifest(connection, scene)
    for memory_ref in scene["memory_refs"]:
        _validate_memory_ref(connection, scene, memory_ref)
    for history_ref in scene["history_refs"]:
        _validate_scene_revision_ref(connection, scene, history_ref["scene_ref"])
    if scene["in_world_time"].get("kind") == "relative":
        _validate_scene_revision_ref(connection, scene, scene["in_world_time"]["anchor"])


def _validate_interactions(
    connection: sqlite3.Connection,
    scene: dict[str, Any],
    conversation_id: str,
    participants: dict[str, dict[str, Any]],
) -> None:
    interaction_ids: set[str] = set()
    ordinals: set[int] = set()
    for interaction in scene["interactions"]:
        interaction_id = interaction["interaction_id"]
        ordinal = interaction["ordinal"]
        if interaction_id in interaction_ids:
            raise ValidationError("Interaction IDs must be unique within a scene revision")
        if ordinal in ordinals:
            raise ValidationError("Interaction ordinals must be unique within a scene revision")
        interaction_ids.add(interaction_id)
        ordinals.add(ordinal)
        actor_participant = interaction.get("actor_participant_id")
        if actor_participant is not None and actor_participant not in participants:
            raise ValidationError("Interaction actor must reference a participant in this scene")
        if any(target not in participants for target in interaction["target_participant_ids"]):
            raise ValidationError("Interaction targets must reference participants in this scene")
        for dialogue_ref in interaction["dialogue_refs"]:
            _resolve_turn_content_ref(connection, scene, dialogue_ref)
        for source_ref in interaction["source_refs"]:
            _validate_interaction_source_ref(connection, scene, conversation_id, source_ref)

    if scene["interactions"] != sorted(scene["interactions"], key=lambda item: item["ordinal"]):
        raise ValidationError("Interactions must be normalized by ascending ordinal before validation")


def validate_story_scene_reference_branches(connection: sqlite3.Connection, scene: dict[str, Any]) -> None:
    """Check branch lineage for an already validated immutable scene during copying."""
    if scene.get("contract") != "lorethra.story-scene.v2":
        return
    references: list[tuple[dict[str, Any], str]] = []

    def add(reference: Any, label: str) -> None:
        if isinstance(reference, dict):
            references.append((reference, label))

    add(scene.get("location_ref"), "scene location")
    time_value = scene.get("in_world_time")
    if isinstance(time_value, dict):
        add(time_value.get("anchor"), "relative-time anchor")
    for participant in scene["participants"]:
        add(participant.get("current_location_ref"), "participant current location")
        snapshot = participant["state_snapshot"]
        if snapshot["status"] == "captured":
            add(snapshot, "participant state snapshot")
            for source in snapshot["sources"]:
                add(source, "participant state source")
    for interaction in scene["interactions"]:
        for dialogue_ref in interaction["dialogue_refs"]:
            add(dialogue_ref, "dialogue turn")
        for source in interaction["source_refs"]:
            add(source, "interaction source")
            add(source.get("turn_ref"), "interaction source turn")
    for reference in scene["memory_refs"]:
        add(reference, "scene memory")
    context_ref = scene.get("context_manifest_ref")
    if isinstance(context_ref, dict):
        add(context_ref, "context manifest")
        add(context_ref.get("source_turn"), "context source turn")
    for history_ref in scene["history_refs"]:
        add(history_ref.get("scene_ref"), "scene history")

    revision_fields = (
        "approved_revision", "as_of_branch_revision", "source_revision", "context_revision",
        "created_revision", "reviewed_revision", "source_branch_revision",
    )
    for reference, label in references:
        branch_id = _reference_branch(connection, scene, reference.get("branch_id"), label)
        cutoff = _reference_cutoff(connection, scene, branch_id)
        for field in revision_fields:
            revision = reference.get(field)
            if revision is None:
                continue
            _validate_branch_revision(connection, scene["workspace_id"], branch_id, revision)
            if revision > cutoff:
                raise ValidationError(f"{label} reference points beyond its branch lineage snapshot")


def _validate_location_ref(
    connection: sqlite3.Connection,
    scene: dict[str, Any],
    reference: dict[str, Any] | None,
    label: str,
) -> None:
    if reference is None:
        return
    branch_id = _reference_branch(connection, scene, reference.get("branch_id"), label)
    row = connection.execute(
        "SELECT name,status,reviewed_revision,created_revision FROM story_map_locations "
        "WHERE workspace_id=? AND branch_id=? AND adventure_id=? AND location_id=?",
        (scene["workspace_id"], branch_id, scene["adventure_id"], reference["location_id"]),
    ).fetchone()
    if not row or row["status"] != "approved" or row["reviewed_revision"] != reference["approved_revision"]:
        raise ValidationError(f"{label} must reference the exact approved location revision")
    if row["reviewed_revision"] > _reference_cutoff(connection, scene, branch_id):
        raise ValidationError(f"{label} cannot point to a location approved after the scene's source revision")
    if reference.get("captured_name") is not None and reference["captured_name"] != row["name"]:
        raise ValidationError(f"{label} captured_name must match the approved map location")
    if reference.get("captured_name") is None:
        reference["captured_name"] = row["name"]


def _validate_state_snapshot(
    connection: sqlite3.Connection,
    scene: dict[str, Any],
    conversation_id: str,
    snapshot: dict[str, Any],
    *,
    validate_sources: bool = True,
) -> None:
    if snapshot["status"] == "not_captured":
        return
    branch_id = _reference_branch(connection, scene, snapshot.get("branch_id"), "participant state snapshot")
    as_of_revision = snapshot["as_of_branch_revision"]
    _validate_branch_revision(connection, scene["workspace_id"], branch_id, as_of_revision)
    if as_of_revision > _reference_cutoff(connection, scene, branch_id):
        raise ValidationError("Participant state cannot be captured from a future scene revision")
    if _digest_text(_canonical_json(snapshot["values"])) != snapshot["sha256"]:
        raise ValidationError("Participant state snapshot hash does not match its canonical values")
    if not validate_sources:
        return
    for source in snapshot["sources"]:
        source_branch = _reference_branch(
            connection, scene, source.get("branch_id", branch_id), "participant state source",
        )
        source_revision = source["source_revision"]
        if source_revision > as_of_revision:
            raise ValidationError("Participant state source revision is later than its captured state")
        if source_revision > _reference_cutoff(connection, scene, source_branch):
            raise ValidationError("Participant state source is newer than the scene's branch snapshot")
        _validate_branch_revision(connection, scene["workspace_id"], source_branch, source_revision)
        kind = source["kind"]
        source_id = source["source_id"]
        if kind == "entity":
            row = connection.execute(
                "SELECT created_revision,updated_revision FROM entities WHERE workspace_id=? AND branch_id=? AND entity_id=?",
                (scene["workspace_id"], source_branch, source_id),
            ).fetchone()
            if not row or row["created_revision"] > source_revision or row["updated_revision"] > source_revision:
                raise ValidationError("Participant state entity source does not exist at its cited revision")
        elif kind == "rpg_sheet":
            row = connection.execute(
                "SELECT created_revision,updated_revision FROM rpg_sheets WHERE workspace_id=? AND branch_id=? AND adventure_id=?",
                (scene["workspace_id"], source_branch, source_id),
            ).fetchone()
            if not row or row["created_revision"] > source_revision or row["updated_revision"] > source_revision:
                raise ValidationError("Participant state sheet source does not exist at its cited revision")
        elif kind == "npc_profile":
            row = connection.execute(
                "SELECT created_revision,updated_revision FROM story_npc_profiles WHERE workspace_id=? AND branch_id=? "
                "AND adventure_id=? AND npc_entity_id=?",
                (scene["workspace_id"], source_branch, scene["adventure_id"], source_id),
            ).fetchone()
            if not row or row["created_revision"] > source_revision or row["updated_revision"] > source_revision:
                raise ValidationError("Participant state NPC source does not exist at its cited revision")
        elif kind == "story_turn":
            if source.get("version") is None:
                turn = connection.execute(
                    "SELECT created_revision FROM story_turns WHERE workspace_id=? AND branch_id=? "
                    "AND conversation_id=? AND turn_id=?",
                    (scene["workspace_id"], source_branch, conversation_id, source_id),
                ).fetchone()
            else:
                turn = connection.execute(
                    "SELECT created_revision FROM story_turn_edits WHERE workspace_id=? AND branch_id=? "
                    "AND conversation_id=? AND turn_id=? AND version=?",
                    (scene["workspace_id"], source_branch, conversation_id, source_id, source["version"]),
                ).fetchone()
            if not turn or turn["created_revision"] != source_revision:
                raise ValidationError("Participant state turn source revision does not match its exact version")
        # user_authored references deliberately name the committed revision without asserting another domain record.


def _validate_interaction_source_ref(
    connection: sqlite3.Connection,
    scene: dict[str, Any],
    conversation_id: str,
    reference: dict[str, Any],
) -> None:
    branch_id = _reference_branch(connection, scene, reference.get("branch_id"), "interaction source")
    kind = reference["kind"]
    source_id = reference.get("source_id")
    if kind == "story_turn":
        turn_ref = reference["turn_ref"]
        if reference.get("branch_id") is not None:
            if turn_ref.get("branch_id") not in {None, branch_id}:
                raise ValidationError("Story-turn source branch fields must agree")
            turn_ref = {**turn_ref, "branch_id": branch_id}
        turn = _resolve_turn_content_ref(connection, scene, turn_ref, expected_conversation_id=conversation_id)
        if turn["created_revision"] != reference["source_revision"]:
            raise ValidationError("Interaction turn source revision does not match its exact turn version")
        return
    if kind == "rpg_check":
        row = connection.execute(
            "SELECT adventure_id,created_revision FROM rpg_checks WHERE workspace_id=? AND branch_id=? AND check_id=?",
            (scene["workspace_id"], branch_id, source_id),
        ).fetchone()
        if not row:
            row = connection.execute(
                "SELECT adventure_id,created_revision FROM rpg_mechanic_checks "
                "WHERE workspace_id=? AND branch_id=? AND check_id=?",
                (scene["workspace_id"], branch_id, source_id),
            ).fetchone()
        if (not row or row["adventure_id"] != scene["adventure_id"]
                or row["created_revision"] != reference["source_revision"]
                or row["created_revision"] > _reference_cutoff(connection, scene, branch_id)):
            raise ValidationError("Interaction check source must match an exact check in this adventure")
        return
    row = connection.execute(
        "SELECT adventure_id,review_status,reviewed_revision FROM rpg_state_proposals "
        "WHERE workspace_id=? AND branch_id=? AND proposal_id=?",
        (scene["workspace_id"], branch_id, source_id),
    ).fetchone()
    if (not row or row["adventure_id"] != scene["adventure_id"] or row["review_status"] != "accepted"
            or row["reviewed_revision"] != reference["source_revision"]
            or row["reviewed_revision"] > _reference_cutoff(connection, scene, branch_id)):
        raise ValidationError("Interaction proposal source must identify its exact accepted review revision")


def _validate_memory_ref(connection: sqlite3.Connection, scene: dict[str, Any], reference: dict[str, Any]) -> None:
    branch_id = _reference_branch(connection, scene, reference.get("branch_id"), "scene memory")
    row = connection.execute(
        "SELECT created_revision,reviewed_revision,review_status FROM story_memories "
        "WHERE workspace_id=? AND branch_id=? AND adventure_id=? AND memory_id=? AND version=?",
        (scene["workspace_id"], branch_id, scene["adventure_id"], reference["memory_id"], reference["version"]),
    ).fetchone()
    if (not row or row["review_status"] != "accepted" or row["created_revision"] != reference["created_revision"]
            or row["reviewed_revision"] != reference["reviewed_revision"]
            or row["reviewed_revision"] > _reference_cutoff(connection, scene, branch_id)):
        raise ValidationError("Scene memory reference must match an exact accepted version in this adventure")


def _validate_context_manifest(connection: sqlite3.Connection, scene: dict[str, Any]) -> None:
    reference = scene.get("context_manifest_ref")
    if reference is None:
        return
    source_turn = reference["source_turn"]
    branch_value = reference.get("branch_id", source_turn.get("branch_id"))
    branch_id = _reference_branch(connection, scene, branch_value, "context manifest")
    if source_turn.get("branch_id") not in {None, branch_id}:
        raise ValidationError("Context manifest and source-turn branches must agree")
    turn = _load_turn_content(
        connection, scene, {**source_turn, "branch_id": branch_id}, branch_id=branch_id,
    )
    if (turn.get("context_manifest_id") != reference["manifest_id"]
            or turn.get("context_revision") != reference["context_revision"]
            or not turn.get("context_manifest_json")):
        raise ValidationError("Context manifest reference must match the exact saved turn or edit")
    manifest = json.loads(turn["context_manifest_json"])
    if (manifest.get("manifest_id") != reference["manifest_id"]
            or manifest.get("base_revision") != reference["context_revision"]
            or reference["context_revision"] > _reference_cutoff(connection, scene, branch_id)
            or manifest.get("workspace_id") != scene["workspace_id"]
            or manifest.get("branch_id") != branch_id
            or _digest_text(_canonical_json(manifest)) != reference["manifest_sha256"]):
        raise ValidationError("Context manifest digest or scope does not match its saved source")


def _validate_scene_revision_ref(
    connection: sqlite3.Connection,
    scene: dict[str, Any],
    reference: dict[str, Any],
) -> None:
    branch_id = _reference_branch(connection, scene, reference.get("branch_id"), "scene history")
    if reference["scene_id"] == scene["scene_id"]:
        raise ValidationError("A scene cannot reference its own revision as prior scene history")
    row = connection.execute(
        "SELECT revision.source_branch_revision,revision.scene_json FROM story_scene_revisions revision "
        "WHERE revision.workspace_id=? AND revision.branch_id=? AND revision.adventure_id=? "
        "AND revision.scene_id=? AND revision.scene_revision=?",
        (scene["workspace_id"], branch_id, scene["adventure_id"], reference["scene_id"], reference["scene_revision"]),
    ).fetchone()
    if not row:
        raise ValidationError("Scene history reference must identify an exact revision in this adventure")
    if row["source_branch_revision"] > _reference_cutoff(connection, scene, branch_id):
        raise ValidationError("Scene history reference cannot point beyond the scene's branch snapshot")
    document = json.loads(row["scene_json"])
    if reference.get("source_branch_revision") is not None and reference["source_branch_revision"] != row["source_branch_revision"]:
        raise ValidationError("Scene history source branch revision does not match the referenced scene revision")
    if document.get("adventure_id") != scene["adventure_id"]:
        raise ValidationError("Scene history references cannot cross adventures")


def _resolve_turn_content_ref(
    connection: sqlite3.Connection,
    scene: dict[str, Any],
    reference: dict[str, Any],
    *,
    expected_conversation_id: str | None = None,
) -> dict[str, Any]:
    branch_id = _reference_branch(connection, scene, reference.get("branch_id"), "story turn")
    return _load_turn_content(
        connection, scene, reference, branch_id=branch_id,
        expected_conversation_id=expected_conversation_id,
    )


def _load_turn_content(
    connection: sqlite3.Connection,
    scene: dict[str, Any],
    reference: dict[str, Any],
    *,
    branch_id: str,
    expected_conversation_id: str | None = None,
) -> dict[str, Any]:
    adventure = connection.execute(
        "SELECT conversation_id FROM story_adventures WHERE workspace_id=? AND branch_id=? AND adventure_id=?",
        (scene["workspace_id"], branch_id, scene["adventure_id"]),
    ).fetchone()
    if not adventure or adventure["conversation_id"] != reference["conversation_id"]:
        raise ValidationError("Story-turn reference must belong to this adventure and branch")
    if expected_conversation_id is not None and reference["conversation_id"] != expected_conversation_id:
        raise ValidationError("Interaction source turn must belong to this adventure conversation")
    if reference["content_source"] == "base":
        row = connection.execute(
            "SELECT content,created_revision,context_manifest_id,context_manifest_json,context_revision "
            "FROM story_turns WHERE workspace_id=? AND branch_id=? AND conversation_id=? AND turn_id=?",
            (scene["workspace_id"], branch_id, reference["conversation_id"], reference["turn_id"]),
        ).fetchone()
    else:
        row = connection.execute(
            "SELECT content,created_revision,context_manifest_id,context_manifest_json,context_revision "
            "FROM story_turn_edits WHERE workspace_id=? AND branch_id=? AND conversation_id=? AND turn_id=? AND version=?",
            (scene["workspace_id"], branch_id, reference["conversation_id"], reference["turn_id"], reference["edit_version"]),
        ).fetchone()
    if not row or _digest_text(row["content"]) != reference["content_sha256"]:
        raise ValidationError("Story-turn reference hash must match its exact immutable content version")
    if row["created_revision"] > _reference_cutoff(connection, scene, branch_id):
        raise ValidationError("Story-turn reference cannot point beyond the scene's branch snapshot")
    return dict(row)


def _validate_branch_revision(
    connection: sqlite3.Connection,
    workspace_id: str,
    branch_id: str,
    revision: int,
) -> None:
    if not connection.execute(
        "SELECT 1 FROM revisions WHERE workspace_id=? AND branch_id=? AND revision=?",
        (workspace_id, branch_id, revision),
    ).fetchone():
        raise ValidationError("Reference branch revision does not exist")


def _reference_cutoff(connection: sqlite3.Connection, scene: dict[str, Any], branch_id: str) -> int:
    if branch_id == scene["branch_id"]:
        return scene["source_branch_revision"]
    lineage = scene.get("lineage") or {}
    if branch_id == lineage.get("origin_branch_id"):
        return lineage["origin_branch_revision"]

    current_branch = scene["branch_id"]
    cutoff = scene["source_branch_revision"]
    visited: set[str] = set()
    while current_branch not in visited:
        visited.add(current_branch)
        row = connection.execute(
            "SELECT parent_branch_id,parent_revision FROM branches WHERE workspace_id=? AND branch_id=?",
            (scene["workspace_id"], current_branch),
        ).fetchone()
        if not row or row["parent_branch_id"] is None or row["parent_revision"] is None:
            break
        current_branch = row["parent_branch_id"]
        cutoff = row["parent_revision"]
        if current_branch == branch_id:
            return cutoff
    raise ValidationError("Reference branch is outside this scene's branch lineage")


def _reference_branch(
    connection: sqlite3.Connection,
    scene: dict[str, Any],
    requested_branch_id: str | None,
    label: str,
) -> str:
    branch_id = requested_branch_id or scene["branch_id"]
    workspace_id = scene["workspace_id"]
    if not connection.execute(
        "SELECT 1 FROM branches WHERE workspace_id=? AND branch_id=?",
        (workspace_id, branch_id),
    ).fetchone():
        raise ValidationError(f"{label} reference branch does not exist in this workspace")
    if branch_id == scene["branch_id"]:
        return branch_id

    ancestor = connection.execute(
        "SELECT parent_branch_id FROM branches WHERE workspace_id=? AND branch_id=?",
        (workspace_id, scene["branch_id"]),
    ).fetchone()
    seen: set[str] = set()
    while ancestor and ancestor["parent_branch_id"] and ancestor["parent_branch_id"] not in seen:
        parent_id = ancestor["parent_branch_id"]
        if parent_id == branch_id:
            return branch_id
        seen.add(parent_id)
        ancestor = connection.execute(
            "SELECT parent_branch_id FROM branches WHERE workspace_id=? AND branch_id=?",
            (workspace_id, parent_id),
        ).fetchone()

    origin_branch_id = (scene.get("lineage") or {}).get("origin_branch_id")
    if origin_branch_id == branch_id:
        origin = connection.execute(
            "SELECT parent_branch_id FROM branches WHERE workspace_id=? AND branch_id=?",
            (workspace_id, branch_id),
        ).fetchone()
        current = connection.execute(
            "SELECT parent_branch_id FROM branches WHERE workspace_id=? AND branch_id=?",
            (workspace_id, scene["branch_id"]),
        ).fetchone()
        if origin and origin["parent_branch_id"] == scene["branch_id"]:
            return branch_id
        if current and current["parent_branch_id"] == branch_id:
            return branch_id
    raise ValidationError(f"{label} reference cannot cross an unrelated branch")
