"""Validated StoryScene command lifecycle and retrieval checks."""

from __future__ import annotations

import json
import hashlib
import base64
import copy
import sqlite3
import unittest
from unittest.mock import patch

from lke.core import CommandGateway, Database
from lke.core.errors import ConflictError, NotFoundError, ValidationError


class StorySceneCommandTests(unittest.TestCase):
    def setUp(self) -> None:
        self.database = Database(":memory:")
        self.gateway = CommandGateway(self.database)
        self.workspace_id = "scene-command-workspace"
        self.gateway.create_workspace("Scene commands", self.workspace_id)
        self.main_revision = self.command("hero", 0, "create_entity", {
            "entity_id": "hero", "entity_type": "character", "label": "Mira", "properties": {},
        })["revision"]
        self.main_revision = self.command("world", self.main_revision, "create_story_world", {
            "world_id": "world", "name": "Glass Harbor", "template_key": "fantasy",
            "description": "A coastal archive.", "content": {"starting_location": "Old Harbor"},
        })["revision"]
        self.gateway.create_branch(
            self.workspace_id, "main", "adventure", self.main_revision, "adventure-branch",
        )
        self.adventure_revision = self.command("adventure", self.main_revision, "create_story_adventure", {
            "adventure_id": "adventure", "world_id": "world", "world_version": 1,
            "conversation_id": "story-chat", "name": "The Harbor Bell", "actor_entity_id": "hero",
        }, branch="adventure")["revision"]

    def tearDown(self) -> None:
        self.database.close()

    def command(
        self,
        key: str,
        revision: int,
        kind: str,
        payload: dict,
        *,
        branch: str = "main",
        actor: str = "user",
    ) -> dict:
        return self.gateway.execute(
            workspace_id=self.workspace_id,
            branch_id=branch,
            idempotency_key=key,
            expected_revision=revision,
            command_type=kind,
            payload=payload,
            actor=actor,
            reason="Story scene command test",
        )

    def create_scene(self, key: str = "scene-create", *, branch: str = "adventure", title: str = "At the gate"):
        return self.command(
            key,
            self.gateway.current_revision(self.workspace_id, branch),
            "create_story_scene",
            {"adventure_id": "adventure", "scene": {"title": title}},
            branch=branch,
        )

    def create_scene_with_participant_history(self, key_prefix: str = "provenance"):
        revision = self.gateway.current_revision(self.workspace_id, "adventure")
        npc = self.command(
            f"{key_prefix}-npc", revision, "create_story_npc",
            {"adventure_id": "adventure", "npc_entity_id": "ferryman", "label": "The Ferryman",
             "aliases": ["Boatman"], "public_profile": {"motivation": "Keep the harbor safe"},
             "private_profile": {"secret": "Unshared"}, "review_status": "accepted"},
            branch="adventure",
        )
        revision = npc["revision"]
        background = self.command(
            f"{key_prefix}-background", revision, "create_entity",
            {"entity_id": "dockhand", "entity_type": "person", "label": "A dockhand", "properties": {}},
            branch="adventure",
        )
        revision = background["revision"]
        manifest = {
            "manifest_id": f"manifest-{key_prefix}", "base_revision": revision,
            "workspace_id": self.workspace_id, "branch_id": "adventure",
            "actor": {"entity_id": "hero"}, "included": [], "excluded": [], "token_estimate": 1,
        }
        turn_text = "The ferryman lowers the lantern."
        turn = self.command(
            f"{key_prefix}-turn", revision, "append_story_turn",
            {"conversation_id": "story-chat", "user_content": "Ask about the bell.",
             "assistant_content": turn_text, "provider": "ollama", "model": "fixture",
             "narrative_order": 1, "context_revision": revision,
             "context_manifest_id": manifest["manifest_id"], "context_manifest": manifest},
            branch="adventure",
        )
        turn_ref = {
            "conversation_id": "story-chat", "turn_id": turn["assistant_turn_id"],
            "content_source": "base", "content_sha256": hashlib.sha256(turn_text.encode("utf-8")).hexdigest(),
        }
        state_values = {"position": "beside the water"}
        state_digest = hashlib.sha256(json.dumps(
            state_values, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False,
        ).encode("utf-8")).hexdigest()
        interactions = [
            {"interaction_id": "lantern-action", "ordinal": 2, "interaction_type": "action",
             "record_state": "recorded", "actor_participant_id": "ferryman-participant",
             "target_participant_ids": ["hero-participant"], "action": "Lowers the lantern",
             "intent": "Signal a warning", "emotional_beat": "Reluctant trust", "dialogue_refs": [],
             "source_refs": [{"kind": "story_turn", "source_revision": turn["revision"], "turn_ref": turn_ref}]},
            {"interaction_id": "bell-dialogue", "ordinal": 1, "interaction_type": "dialogue",
             "record_state": "recorded", "actor_participant_id": "hero-participant",
             "target_participant_ids": ["ferryman-participant"], "dialogue_refs": [turn_ref],
             "source_refs": []},
        ]
        created = self.command(
            f"{key_prefix}-scene", turn["revision"], "create_story_scene",
            {"adventure_id": "adventure", "scene": {"scene_id": f"{key_prefix}-scene", "title": "By the harbor",
             "participants": [
                 {"participant_id": "hero-participant", "entity_id": "hero", "participant_kind": "protagonist",
                  "role": "Protagonist", "participation_status": "present"},
                 {"participant_id": "ferryman-participant", "entity_id": "ferryman", "participant_kind": "npc",
                  "role": "Ferryman", "participation_status": "present",
                  "knowledge_scope": {"scope": "actors", "known_by": ["hero"]}},
                 {"participant_id": "dockhand-participant", "entity_id": "dockhand", "participant_kind": "background",
                  "role": "Dockhand", "participation_status": "mentioned",
                  "state_snapshot": {"status": "captured", "as_of_branch_revision": turn["revision"],
                      "values": state_values,
                      "sources": [{"kind": "user_authored", "source_id": "dockhand-note",
                          "source_revision": turn["revision"]}], "sha256": state_digest}},
             ], "interactions": interactions}},
            branch="adventure",
        )
        return created, turn_ref, turn_text, turn["revision"]

    def test_create_edit_retrieve_and_noop_preserve_scene_revision_history(self):
        created = self.create_scene()
        scene_id = created["scene_id"]
        first = self.gateway.get_story_scene(self.workspace_id, "adventure", "adventure", scene_id)
        self.assertEqual(first["status"], "draft")
        self.assertEqual(first["scene_revision"], 1)
        self.assertEqual(first["source_branch_revision"], created["revision"])
        self.assertEqual(first["world_ref"], {"world_id": "world", "version": 1})
        self.assertEqual(first["scene_sequence"], 1)
        self.assertEqual(self.gateway.list_story_scenes(self.workspace_id, "adventure", "adventure"), [first])

        edited = self.command(
            "scene-edit",
            created["revision"],
            "revise_story_scene",
            {
                "adventure_id": "adventure", "scene_id": scene_id, "expected_scene_revision": 1,
                "changes": {"title": "The bell under the fog", "in_world_time": {"kind": "unknown"}},
            },
            branch="adventure",
        )
        self.assertEqual(edited["scene_revision"], 2)
        self.assertEqual(edited["revision"], created["revision"] + 1)
        current = self.gateway.get_story_scene(self.workspace_id, "adventure", "adventure", scene_id)
        self.assertEqual(current["title"], "The bell under the fog")
        self.assertEqual(current["source_branch_revision"], edited["revision"])
        self.assertEqual([row["scene_revision"] for row in self.gateway.get_story_scene_history(
            self.workspace_id, "adventure", "adventure", scene_id,
        )], [1, 2])

        no_op = self.command(
            "scene-noop",
            edited["revision"],
            "revise_story_scene",
            {"adventure_id": "adventure", "scene_id": scene_id, "expected_scene_revision": 2,
             "changes": {"title": "The bell under the fog"}},
            branch="adventure",
        )
        self.assertEqual(no_op["revision"], edited["revision"])
        self.assertEqual(no_op["scene_revision"], 2)
        self.assertEqual(len(self.gateway.get_story_scene_history(
            self.workspace_id, "adventure", "adventure", scene_id,
        )), 2)

    def test_lifecycle_archive_and_explicit_reopen_are_revisioned(self):
        created = self.create_scene()
        scene_id = created["scene_id"]
        with self.assertRaises(ValidationError):
            self.command(
                "archive-draft", created["revision"], "set_story_scene_archived",
                {"adventure_id": "adventure", "scene_id": scene_id, "expected_scene_revision": 1,
                 "archived": True}, branch="adventure",
            )
        self.assertEqual(self.gateway.current_revision(self.workspace_id, "adventure"), created["revision"])

        activated = self.command(
            "activate", created["revision"], "set_story_scene_status",
            {"adventure_id": "adventure", "scene_id": scene_id, "expected_scene_revision": 1,
             "status": "active"}, branch="adventure",
        )
        completed = self.command(
            "complete", activated["revision"], "set_story_scene_status",
            {"adventure_id": "adventure", "scene_id": scene_id, "expected_scene_revision": 2,
             "status": "completed"}, branch="adventure",
        )
        with self.assertRaisesRegex(ValidationError, "reopen_story_scene"):
            self.command(
                "implicit-reopen", completed["revision"], "set_story_scene_status",
                {"adventure_id": "adventure", "scene_id": scene_id, "expected_scene_revision": 3,
                 "status": "active"}, branch="adventure",
            )
        reopened = self.command(
            "explicit-reopen", completed["revision"], "reopen_story_scene",
            {"adventure_id": "adventure", "scene_id": scene_id, "expected_scene_revision": 3},
            branch="adventure",
        )
        self.assertEqual(reopened["status"], "active")
        self.assertEqual(reopened["scene_revision"], 4)
        completed_again = self.command(
            "complete-again", reopened["revision"], "set_story_scene_status",
            {"adventure_id": "adventure", "scene_id": scene_id, "expected_scene_revision": 4,
             "status": "completed"}, branch="adventure",
        )
        archived = self.command(
            "archive", completed_again["revision"], "set_story_scene_archived",
            {"adventure_id": "adventure", "scene_id": scene_id, "expected_scene_revision": 5,
             "archived": True}, branch="adventure",
        )
        archived_scene = self.gateway.get_story_scene(self.workspace_id, "adventure", "adventure", scene_id)
        self.assertTrue(archived_scene["is_archived"])
        self.assertEqual(archived_scene["archived_branch_revision"], archived["revision"])
        with self.assertRaises(ValidationError):
            self.command(
                "reopen-archived", archived["revision"], "reopen_story_scene",
                {"adventure_id": "adventure", "scene_id": scene_id, "expected_scene_revision": 6},
                branch="adventure",
            )
        unarchived = self.command(
            "unarchive", archived["revision"], "set_story_scene_archived",
            {"adventure_id": "adventure", "scene_id": scene_id, "expected_scene_revision": 6,
             "archived": False}, branch="adventure",
        )
        self.assertNotIn("archived_branch_revision", self.gateway.get_story_scene(
            self.workspace_id, "adventure", "adventure", scene_id,
        ))
        final = self.command(
            "reopen-after-unarchive", unarchived["revision"], "reopen_story_scene",
            {"adventure_id": "adventure", "scene_id": scene_id, "expected_scene_revision": 7},
            branch="adventure",
        )
        self.assertEqual(final["status"], "active")
        self.assertEqual(final["scene_revision"], 8)

    def test_invalid_contract_stale_revision_ai_and_unsupported_refs_roll_back(self):
        start_revision = self.gateway.current_revision(self.workspace_id, "adventure")
        with self.assertRaisesRegex(ValidationError, "title"):
            self.command(
                "invalid-contract", start_revision, "create_story_scene",
                {"adventure_id": "adventure", "scene": {"title": "", "in_world_time": {"kind": "exact"}}},
                branch="adventure",
            )
        with self.assertRaisesRegex(ValidationError, "AI actors"):
            self.command(
                "ai-scene", start_revision, "create_story_scene",
                {"adventure_id": "adventure", "scene": {"title": "Model-authored"}},
                branch="adventure", actor="ai:local",
            )
        with self.assertRaisesRegex(ValidationError, "Participant entity"):
            self.command(
                "unresolved-refs", start_revision, "create_story_scene",
                {"adventure_id": "adventure", "scene": {"title": "Unresolved", "participants": [{
                    "participant_id": "p1", "entity_id": "missing", "participant_kind": "character",
                    "role": "traveler", "participation_status": "planned", "state_snapshot": {"status": "not_captured"},
                }]}},
                branch="adventure",
            )
        self.assertEqual(self.gateway.current_revision(self.workspace_id, "adventure"), start_revision)
        self.assertEqual(self.gateway.list_story_scenes(self.workspace_id, "adventure", "adventure"), [])
        self.assertEqual(self.database.connection.execute(
            "SELECT COUNT(*) FROM audit_events WHERE workspace_id=? AND branch_id='adventure' AND event_type LIKE 'story.scene%'",
            (self.workspace_id,),
        ).fetchone()[0], 0)

    def test_participants_default_unknown_state_and_interactions_keep_exact_ordered_provenance(self):
        created, turn_ref, turn_text, turn_revision = self.create_scene_with_participant_history()
        first = self.gateway.get_story_scene(self.workspace_id, "adventure", "adventure", created["scene_id"])
        participants = {participant["participant_id"]: participant for participant in first["participants"]}
        self.assertEqual(len(participants), 3)
        self.assertEqual(participants["hero-participant"]["state_snapshot"], {"status": "not_captured"})
        self.assertEqual(participants["hero-participant"]["current_location_ref"], None)
        self.assertEqual(participants["hero-participant"]["scene_state"], {})
        self.assertIsNone(participants["hero-participant"]["emotional_state"])
        self.assertEqual(participants["ferryman-participant"]["knowledge_scope"], {
            "scope": "actors", "known_by": ["hero"],
        })
        self.assertEqual(participants["dockhand-participant"]["state_snapshot"]["values"], {
            "position": "beside the water",
        })
        self.assertEqual([interaction["interaction_id"] for interaction in first["interactions"]], [
            "bell-dialogue", "lantern-action",
        ])
        action = first["interactions"][1]
        self.assertEqual(action["actor_participant_id"], "ferryman-participant")
        self.assertEqual(action["target_participant_ids"], ["hero-participant"])
        self.assertEqual(action["action"], "Lowers the lantern")
        self.assertEqual(action["intent"], "Signal a warning")
        self.assertEqual(action["emotional_beat"], "Reluctant trust")
        self.assertEqual(action["source_refs"], [{
            "kind": "story_turn", "source_revision": turn_revision, "turn_ref": turn_ref,
        }])
        self.assertEqual(first["interactions"][0]["dialogue_refs"], [turn_ref])

        npc_review = self.command(
            "reject-current-ferryman-profile", created["revision"], "update_story_npc",
            {"adventure_id": "adventure", "npc_entity_id": "ferryman", "aliases": ["Boatman"],
             "public_profile": {"motivation": "No longer accepted as canon"}, "private_profile": {},
             "review_status": "rejected"},
            branch="adventure",
        )
        edited = self.command(
            "revise-with-provenance", npc_review["revision"], "revise_story_scene",
            {"adventure_id": "adventure", "scene_id": created["scene_id"], "expected_scene_revision": 1,
             "changes": {"title": "The warning at the harbor"}},
            branch="adventure",
        )
        history = self.gateway.get_story_scene_history(
            self.workspace_id, "adventure", "adventure", created["scene_id"],
        )
        self.assertEqual(history[0]["interactions"][0]["dialogue_refs"], [turn_ref])
        self.assertEqual(history[0]["scene_revision"], 1)
        saved_turn = self.database.connection.execute(
            "SELECT content FROM story_turns WHERE workspace_id=? AND branch_id='adventure' AND turn_id=?",
            (self.workspace_id, turn_ref["turn_id"]),
        ).fetchone()
        self.assertEqual(saved_turn["content"], turn_text)
        self.assertEqual(edited["scene_revision"], 2)

    def test_invalid_participant_and_interaction_references_reject_without_revision(self):
        revision = self.gateway.current_revision(self.workspace_id, "adventure")
        self.command(
            "main-only-person", self.gateway.current_revision(self.workspace_id, "main"), "create_entity",
            {"entity_id": "main-only", "entity_type": "person", "label": "Main only", "properties": {}},
        )
        revision = self.gateway.current_revision(self.workspace_id, "adventure")
        invalid_scenes = [
            ("wrong-branch-entity", {"participants": [{
                "participant_id": "outsider", "entity_id": "main-only", "participant_kind": "character",
                "role": "Outsider", "participation_status": "present",
            }]}),
            ("unknown-interaction-actor", {"interactions": [{
                "interaction_id": "unlinked", "ordinal": 1, "interaction_type": "action", "record_state": "planned",
                "actor_participant_id": "missing", "target_participant_ids": [], "dialogue_refs": [], "source_refs": [],
            }]}),
            ("unknown-visual-ref", {"participants": [{
                "participant_id": "hero", "entity_id": "hero", "participant_kind": "protagonist",
                "role": "Protagonist", "participation_status": "present", "visual_reference_ids": ["missing-asset"],
            }]}),
            ("unknown-location-ref", {"location_ref": {"location_id": "missing-location", "approved_revision": 0}}),
        ]
        for key, changes in invalid_scenes:
            with self.subTest(key=key), self.assertRaises(ValidationError):
                self.command(
                    key, revision, "create_story_scene", {"adventure_id": "adventure", "scene": {"title": key, **changes}},
                    branch="adventure",
                )
        self.assertEqual(self.gateway.current_revision(self.workspace_id, "adventure"), revision)
        self.assertEqual(self.gateway.list_story_scenes(self.workspace_id, "adventure", "adventure"), [])

    def test_current_location_ref_requires_an_approved_adventure_location(self):
        created, turn_ref, _, _ = self.create_scene_with_participant_history("location-reference")
        proposal = self.command(
            "approve-harbor-location-proposal", self.gateway.current_revision(self.workspace_id, "adventure"),
            "propose_rpg_state",
            {"adventure_id": "adventure", "source_turn_id": turn_ref["turn_id"],
             "changes": [{"operation": "set_location", "location": "Old Harbor"}]},
            branch="adventure", actor="ai:local",
        )
        accepted = self.command(
            "approve-harbor-location", proposal["revision"], "review_rpg_state_proposal",
            {"proposal_id": proposal["proposal_id"], "review_status": "accepted"}, branch="adventure",
        )
        location = self.database.connection.execute(
            "SELECT location_id,name,reviewed_revision FROM story_map_locations "
            "WHERE workspace_id=? AND branch_id='adventure' AND adventure_id='adventure' AND status='approved'",
            (self.workspace_id,),
        ).fetchone()
        scene = self.gateway.get_story_scene(self.workspace_id, "adventure", "adventure", created["scene_id"])
        participants = copy.deepcopy(scene["participants"])
        hero = next(item for item in participants if item["entity_id"] == "hero")
        hero["current_location_ref"] = {
            "location_id": location["location_id"], "approved_revision": location["reviewed_revision"],
            "captured_name": location["name"],
        }
        revised = self.command(
            "set-scene-participant-location", accepted["revision"], "revise_story_scene",
            {"adventure_id": "adventure", "scene_id": created["scene_id"], "expected_scene_revision": 1,
             "changes": {"participants": participants}},
            branch="adventure",
        )
        stored = self.gateway.get_story_scene(self.workspace_id, "adventure", "adventure", created["scene_id"])
        self.assertEqual(stored["participants"][0]["current_location_ref"]["location_id"], location["location_id"])
        self.assertEqual(revised["scene_revision"], 2)

    def test_participant_and_turn_references_are_pinned_across_fork_and_promotion(self):
        created, original_turn_ref, _, _ = self.create_scene_with_participant_history("branch-provenance")
        npc_review = self.command(
            "reject-profile-before-fork", created["revision"], "update_story_npc",
            {"adventure_id": "adventure", "npc_entity_id": "ferryman", "aliases": ["Boatman"],
             "public_profile": {"motivation": "Rejected after the scene was authored"}, "private_profile": {},
             "review_status": "rejected"},
            branch="adventure",
        )
        self.gateway.create_branch(
            self.workspace_id, "adventure", "what-if", npc_review["revision"], "scene provenance fork",
        )
        inherited = self.gateway.get_story_scene(self.workspace_id, "what-if", "adventure", created["scene_id"])
        child_turn_ref = inherited["interactions"][0]["dialogue_refs"][0]
        self.assertEqual(child_turn_ref["branch_id"], "adventure")
        self.assertEqual(child_turn_ref["turn_id"], original_turn_ref["turn_id"])
        self.assertEqual(len(inherited["participants"]), 3)

        changed = self.command(
            "branch-scene-edit", self.gateway.current_revision(self.workspace_id, "what-if"), "revise_story_scene",
            {"adventure_id": "adventure", "scene_id": created["scene_id"], "expected_scene_revision": 1,
             "changes": {"title": "A different harbor choice"}},
            branch="what-if",
        )
        promoted = self.command(
            "promote-branch-provenance", npc_review["revision"], "promote_branch",
            {"source_branch_id": "what-if", "source_revision": changed["revision"]}, branch="adventure",
        )
        target = self.gateway.get_story_scene(self.workspace_id, "adventure", "adventure", created["scene_id"])
        self.assertEqual(target["title"], "A different harbor choice")
        self.assertEqual(target["interactions"][0]["dialogue_refs"][0]["turn_id"], original_turn_ref["turn_id"])
        self.assertEqual(target["lineage"]["origin_branch_id"], "what-if")
        self.assertEqual(self.gateway.current_revision(self.workspace_id, "adventure"), promoted["revision"])

        created = self.create_scene()
        edited = self.command(
            "edit-scene", created["revision"], "revise_story_scene",
            {"adventure_id": "adventure", "scene_id": created["scene_id"], "expected_scene_revision": 1,
             "changes": {"title": "Latest"}}, branch="adventure",
        )
        head = self.gateway.current_revision(self.workspace_id, "adventure")
        with self.assertRaises(ConflictError):
            self.command(
                "stale-scene-revision", head, "revise_story_scene",
                {"adventure_id": "adventure", "scene_id": created["scene_id"], "expected_scene_revision": 1,
                 "changes": {"title": "Stale"}}, branch="adventure",
            )
        self.assertEqual(self.gateway.current_revision(self.workspace_id, "adventure"), edited["revision"])
        self.assertEqual(len(self.gateway.get_story_scene_history(
            self.workspace_id, "adventure", "adventure", created["scene_id"],
        )), 2)

    def test_branch_fork_copy_and_child_revisions_remain_isolated(self):
        created = self.create_scene()
        self.gateway.create_branch(
            self.workspace_id, "adventure", "what-if", created["revision"], "what-if-branch",
        )
        inherited = self.gateway.get_story_scene(self.workspace_id, "what-if", "adventure", created["scene_id"])
        self.assertEqual(inherited["scene_revision"], 1)
        self.assertEqual(inherited["lineage"], {
            "origin_branch_id": "adventure",
            "origin_branch_revision": created["revision"],
            "origin_scene_revision": 1,
        })
        changed = self.command(
            "child-edit", created["revision"], "revise_story_scene",
            {"adventure_id": "adventure", "scene_id": created["scene_id"], "expected_scene_revision": 1,
             "changes": {"title": "The alternate harbor"}}, branch="what-if",
        )
        self.assertEqual(changed["scene_revision"], 2)
        self.assertEqual(self.gateway.get_story_scene(
            self.workspace_id, "adventure", "adventure", created["scene_id"],
        )["title"], "At the gate")
        self.assertEqual(self.gateway.get_story_scene(
            self.workspace_id, "what-if", "adventure", created["scene_id"],
        )["title"], "The alternate harbor")
        promoted = self.command(
            "promote-scene", created["revision"], "promote_branch",
            {"source_branch_id": "what-if", "source_revision": changed["revision"]},
            branch="adventure",
        )
        promoted_scene = self.gateway.get_story_scene(
            self.workspace_id, "adventure", "adventure", created["scene_id"],
        )
        self.assertEqual(promoted["copied_rows"]["story_scene_revisions"], 1)
        self.assertEqual(promoted_scene["title"], "The alternate harbor")
        self.assertEqual(promoted_scene["scene_revision"], 2)
        self.assertEqual(promoted_scene["lineage"]["origin_branch_id"], "what-if")
        self.assertEqual(self.gateway.current_revision(self.workspace_id, "adventure"), promoted["revision"])
        self.assertEqual(self.gateway.current_revision(self.workspace_id, "what-if"), changed["revision"])

    def test_retrieval_respects_adventure_branch_scope_and_sequence_order(self):
        first = self.create_scene("scene-one", title="First")
        second = self.command(
            "scene-two", first["revision"], "create_story_scene",
            {"adventure_id": "adventure", "scene": {"scene_id": "scene-two", "title": "Second"}},
            branch="adventure",
        )
        self.assertEqual([scene["title"] for scene in self.gateway.list_story_scenes(
            self.workspace_id, "adventure", "adventure",
        )], ["First", "Second"])
        with self.assertRaises(NotFoundError):
            self.gateway.get_story_scene(self.workspace_id, "main", "adventure", first["scene_id"])
        with self.assertRaises(NotFoundError):
            self.gateway.get_story_scene_history(self.workspace_id, "adventure", "missing-adventure", "scene-two")
        self.assertEqual(second["scene_sequence"], 2)
        self.assertEqual(self.database.connection.execute("PRAGMA foreign_key_check").fetchall(), [])


    def test_scene_snapshot_is_deterministic_immutable_and_historically_verifiable(self):
        created = self.create_scene("snapshot-scene")
        payload = {"adventure_id": "adventure", "scene_id": created["scene_id"], "scene_revision": 1}
        first = self.command(
            "snapshot-first", created["revision"], "create_story_scene_snapshot", payload, branch="adventure",
        )
        repeated = self.command(
            "snapshot-repeat", first["revision"], "create_story_scene_snapshot", payload, branch="adventure",
        )
        self.assertEqual(repeated["snapshot_id"], first["snapshot_id"])
        self.assertEqual(repeated["payload_sha256"], first["payload_sha256"])
        self.assertFalse(repeated["created"])
        self.assertEqual(repeated["revision"], first["revision"])
        self.assertEqual(len(self.gateway.list_story_scene_snapshots(
            self.workspace_id, "adventure", "adventure", created["scene_id"],
        )), 1)
        first_snapshot = self.gateway.get_story_scene_snapshot(
            self.workspace_id, "adventure", "adventure", first["snapshot_id"],
        )
        self.assertEqual(first_snapshot["payload"]["world_ref"], {"world_id": "world", "version": 1})
        self.assertEqual(first_snapshot["payload"]["workspace_id"], self.workspace_id)
        self.assertEqual(first_snapshot["captured_by"], "user")

        edited = self.command(
            "snapshot-later-edit", repeated["revision"], "revise_story_scene",
            {"adventure_id": "adventure", "scene_id": created["scene_id"],
             "expected_scene_revision": 1, "changes": {"title": "Later wording"}}, branch="adventure",
        )
        historical = self.gateway.get_story_scene_snapshot_for_revision(
            self.workspace_id, "adventure", "adventure", created["scene_id"], 1,
        )
        self.assertEqual(historical["payload"]["scene_revision"]["title"], "At the gate")
        self.assertEqual(historical["payload"]["source_scene_revision"], 1)
        self.assertTrue(self.gateway.verify_story_scene_snapshot(
            self.workspace_id, "adventure", "adventure", first["snapshot_id"],
        )["valid"])
        self.assertEqual(edited["scene_revision"], 2)
        with self.assertRaisesRegex(sqlite3.IntegrityError, "immutable"):
            self.database.connection.execute(
                "UPDATE story_scene_snapshots SET captured_by='changed' WHERE snapshot_id=?",
                (first["snapshot_id"],),
            )
        with self.assertRaisesRegex(sqlite3.IntegrityError, "immutable"):
            self.database.connection.execute(
                "DELETE FROM story_scene_snapshots WHERE snapshot_id=?", (first["snapshot_id"],),
            )
        stored = self.database.connection.execute(
            "SELECT snapshot_json FROM story_scene_snapshots WHERE snapshot_id=?", (first["snapshot_id"],),
        ).fetchone()
        corrupted = json.loads(stored["snapshot_json"])
        corrupted["payload"]["scene_revision"]["title"] = "Tampered snapshot"
        self.database.connection.execute("DROP TRIGGER story_scene_snapshots_no_update")
        self.database.connection.execute(
            "UPDATE story_scene_snapshots SET snapshot_json=? WHERE snapshot_id=?",
            (json.dumps(corrupted), first["snapshot_id"]),
        )
        verification = self.gateway.verify_story_scene_snapshot(
            self.workspace_id, "adventure", "adventure", first["snapshot_id"],
        )
        self.assertFalse(verification["valid"])
        self.assertFalse(verification["hash_matches"])

    def test_completed_scene_revision_and_snapshot_commit_together(self):
        created = self.create_scene("completed-snapshot")
        activated = self.command(
            "completed-activate", created["revision"], "set_story_scene_status",
            {"adventure_id": "adventure", "scene_id": created["scene_id"],
             "expected_scene_revision": 1, "status": "active"}, branch="adventure",
        )
        completed = self.command(
            "completed-finish", activated["revision"], "set_story_scene_status",
            {"adventure_id": "adventure", "scene_id": created["scene_id"],
             "expected_scene_revision": 2, "status": "completed"}, branch="adventure",
        )
        snapshot = self.gateway.get_story_scene_snapshot_for_revision(
            self.workspace_id, "adventure", "adventure", created["scene_id"], 3,
        )
        self.assertEqual(completed["snapshot_id"], snapshot["snapshot_id"])
        self.assertEqual(snapshot["payload"]["scene_revision"]["status"], "completed")
        self.assertEqual(snapshot["payload"]["source_branch_revision"], completed["revision"])
        self.assertTrue(self.gateway.verify_story_scene_snapshot(
            self.workspace_id, "adventure", "adventure", snapshot["snapshot_id"],
        )["valid"])

    def test_completed_scene_fork_and_promotion_get_separate_snapshots(self):
        created = self.create_scene("completed-branch-snapshot")
        activated = self.command(
            "completed-branch-activate", created["revision"], "set_story_scene_status",
            {"adventure_id": "adventure", "scene_id": created["scene_id"],
             "expected_scene_revision": 1, "status": "active"}, branch="adventure",
        )
        completed = self.command(
            "completed-branch-finish", activated["revision"], "set_story_scene_status",
            {"adventure_id": "adventure", "scene_id": created["scene_id"],
             "expected_scene_revision": 2, "status": "completed"}, branch="adventure",
        )
        parent_snapshot = self.gateway.get_story_scene_snapshot_for_revision(
            self.workspace_id, "adventure", "adventure", created["scene_id"], 3,
        )
        self.gateway.create_branch(
            self.workspace_id, "adventure", "completed-child", completed["revision"], "Completed child",
        )
        child_snapshots = self.gateway.list_story_scene_snapshots(
            self.workspace_id, "completed-child", "adventure", created["scene_id"],
        )
        self.assertEqual(len(child_snapshots), 1)
        self.assertEqual(child_snapshots[0]["payload"]["branch_id"], "completed-child")
        self.assertNotEqual(child_snapshots[0]["snapshot_id"], parent_snapshot["snapshot_id"])

        child_reopened = self.command(
            "completed-child-reopen", completed["revision"], "reopen_story_scene",
            {"adventure_id": "adventure", "scene_id": created["scene_id"],
             "expected_scene_revision": 1}, branch="completed-child",
        )
        child_completed = self.command(
            "completed-child-finish", child_reopened["revision"], "set_story_scene_status",
            {"adventure_id": "adventure", "scene_id": created["scene_id"],
             "expected_scene_revision": 2, "status": "completed"}, branch="completed-child",
        )
        promoted = self.command(
            "completed-child-promote", completed["revision"], "promote_branch",
            {"source_branch_id": "completed-child", "source_revision": child_completed["revision"]},
            branch="adventure",
        )
        self.assertEqual(promoted["copied_rows"]["story_scene_snapshots"], 1)
        promoted_scene = self.gateway.get_story_scene(
            self.workspace_id, "adventure", "adventure", created["scene_id"],
        )
        promoted_snapshot = self.gateway.get_story_scene_snapshot_for_revision(
            self.workspace_id, "adventure", "adventure", created["scene_id"], promoted_scene["scene_revision"],
        )
        self.assertEqual(promoted_snapshot["payload"]["scene_revision"]["status"], "completed")
        self.assertTrue(self.gateway.verify_story_scene_snapshot(
            self.workspace_id, "adventure", "adventure", promoted_snapshot["snapshot_id"],
        )["valid"])

    def test_snapshot_references_are_frozen_and_branch_local(self):
        created, _, _, _ = self.create_scene_with_participant_history("snapshot-refs")
        check = self.command(
            "snapshot-check", created["revision"], "record_d20_check",
            {"adventure_id": "adventure", "check_id": "snapshot-check", "stat_name": "might",
             "die_roll": 12, "target": 10}, branch="adventure",
        )
        proposal = self.command(
            "snapshot-proposal", check["revision"], "propose_rpg_state",
            {"adventure_id": "adventure", "proposal_id": "snapshot-proposal",
             "changes": [{"operation": "tracker_delta", "tracker_id": "health", "delta": -1}]},
            branch="adventure", actor="ai:local",
        )
        accepted = self.command(
            "snapshot-proposal-accepted", proposal["revision"], "review_rpg_state_proposal",
            {"proposal_id": "snapshot-proposal", "review_status": "accepted"}, branch="adventure",
        )
        scene = self.gateway.get_story_scene(self.workspace_id, "adventure", "adventure", created["scene_id"])
        referenced_interactions = copy.deepcopy(scene["interactions"])
        action = next(item for item in referenced_interactions if item["interaction_id"] == "lantern-action")
        action["source_refs"].extend([
            {"kind": "rpg_check", "source_id": "snapshot-check", "source_revision": check["revision"]},
            {"kind": "accepted_state_proposal", "source_id": "snapshot-proposal",
             "source_revision": accepted["revision"]},
        ])
        scene_edit = self.command(
            "snapshot-interaction-sources", accepted["revision"], "revise_story_scene",
            {"adventure_id": "adventure", "scene_id": created["scene_id"], "expected_scene_revision": 1,
             "changes": {"interactions": referenced_interactions}}, branch="adventure",
        )
        head = scene_edit["revision"]
        scene = self.gateway.get_story_scene(self.workspace_id, "adventure", "adventure", created["scene_id"])
        dialogue_ref = scene["interactions"][0]["dialogue_refs"][0]
        memory = self.command(
            "snapshot-memory", head, "create_story_memory",
            {"adventure_id": "adventure", "memory_id": "snapshot-memory", "kind": "event",
             "content": "The ferryman lowered the lantern.", "source_turn_id": dialogue_ref["turn_id"]},
            branch="adventure",
        )
        reviewed = self.command(
            "snapshot-memory-review", memory["revision"], "review_story_memory",
            {"adventure_id": "adventure", "memory_id": "snapshot-memory", "version": 1,
             "review_status": "accepted"}, branch="adventure",
        )
        memory_row = self.database.connection.execute(
            "SELECT created_revision,reviewed_revision FROM story_memories WHERE workspace_id=? AND branch_id='adventure' "
            "AND adventure_id='adventure' AND memory_id='snapshot-memory' AND version=1",
            (self.workspace_id,),
        ).fetchone()
        with patch("lke.core.commands._validate_image_content"):
            asset = self.command(
                "snapshot-visual-asset", reviewed["revision"], "add_story_asset",
                {"adventure_id": "adventure", "asset_id": "snapshot-visual", "target_kind": "character",
                 "target_id": "ferryman", "display_name": "Ferryman reference.png", "mime_type": "image/png",
                 "data_base64": base64.b64encode(b"frozen image bytes").decode("ascii"),
                 "provenance": {"origin": "user_upload"}}, branch="adventure",
            )
        manifest_row = self.database.connection.execute(
            "SELECT context_manifest_id,context_manifest_json,context_revision FROM story_turns "
            "WHERE workspace_id=? AND branch_id='adventure' AND conversation_id='story-chat' AND turn_id=?",
            (self.workspace_id, dialogue_ref["turn_id"]),
        ).fetchone()
        manifest = json.loads(manifest_row["context_manifest_json"])
        manifest_sha256 = hashlib.sha256(json.dumps(
            manifest, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False,
        ).encode("utf-8")).hexdigest()
        context_ref = {
            "protocol": "lke.context.v1",
            "manifest_id": manifest_row["context_manifest_id"],
            "source_turn": dialogue_ref,
            "context_revision": manifest_row["context_revision"],
            "manifest_sha256": manifest_sha256,
        }
        changed = self.command(
            "snapshot-context-edit", asset["revision"], "revise_story_scene",
            {"adventure_id": "adventure", "scene_id": created["scene_id"], "expected_scene_revision": 2,
             "changes": {
                 "context_manifest_ref": context_ref,
                 "participants": [
                     {**participant, "visual_reference_ids": ["snapshot-visual"]}
                     if participant["participant_id"] == "ferryman-participant" else participant
                     for participant in scene["participants"]
                 ],
                 "memory_refs": [{"memory_id": "snapshot-memory", "version": 1,
                                  "created_revision": memory_row["created_revision"],
                                  "reviewed_revision": memory_row["reviewed_revision"],
                                  "review_status": "accepted"}],
             }}, branch="adventure",
        )
        captured = self.command(
            "snapshot-context-capture", changed["revision"], "create_story_scene_snapshot",
            {"adventure_id": "adventure", "scene_id": created["scene_id"],
             "scene_revision": changed["scene_revision"]},
            branch="adventure",
        )
        snapshot = self.gateway.get_story_scene_snapshot(
            self.workspace_id, "adventure", "adventure", captured["snapshot_id"],
        )
        reference_kinds = {item["kind"] for item in snapshot["payload"]["resolved_reference_manifest"]}
        self.assertIn("story_turn", reference_kinds)
        self.assertIn("context_manifest", reference_kinds)
        self.assertIn("story_memory", reference_kinds)
        self.assertIn("story_entity", reference_kinds)
        self.assertIn("participant_state", reference_kinds)
        self.assertIn("participant_state_source", reference_kinds)
        self.assertIn("rpg_check", reference_kinds)
        self.assertIn("accepted_state_proposal", reference_kinds)
        self.assertEqual(snapshot["payload"]["selected_memory_refs"][0]["memory_id"], "snapshot-memory")
        self.assertEqual(snapshot["payload"]["approved_visual_reference_ids"], ["snapshot-visual"])
        self.assertEqual(snapshot["payload"]["approved_visual_references"][0]["content_sha256"],
                         hashlib.sha256(b"frozen image bytes").hexdigest())
        self.assertEqual(snapshot["payload"]["relevant_npc_state"]["ferryman"]["review_status"], "accepted")
        self.assertTrue(self.gateway.verify_story_scene_snapshot(
            self.workspace_id, "adventure", "adventure", captured["snapshot_id"],
        )["valid"])

        self.gateway.create_branch(
            self.workspace_id, "adventure", "snapshot-child", captured["revision"], "Snapshot branch",
        )
        self.assertEqual(self.gateway.list_story_scene_snapshots(
            self.workspace_id, "snapshot-child", "adventure", created["scene_id"],
        ), [])
        child_snapshot = self.command(
            "snapshot-child-create", captured["revision"], "create_story_scene_snapshot",
            {"adventure_id": "adventure", "scene_id": created["scene_id"], "scene_revision": 1},
            branch="snapshot-child",
        )
        self.assertNotEqual(child_snapshot["snapshot_id"], captured["snapshot_id"])
        self.assertEqual(self.gateway.get_story_scene_snapshot(
            self.workspace_id, "snapshot-child", "adventure", child_snapshot["snapshot_id"],
        )["payload"]["branch_id"], "snapshot-child")
        self.assertTrue(self.gateway.verify_story_scene_snapshot(
            self.workspace_id, "adventure", "adventure", captured["snapshot_id"],
        )["valid"])


if __name__ == "__main__":
    unittest.main()
