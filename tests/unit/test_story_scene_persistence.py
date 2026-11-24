"""Persistence, branch-copy and isolation checks for canonical story scenes."""

from __future__ import annotations

import json
import sqlite3
import unittest
from pathlib import Path

from lke.core import CommandGateway, Database, ValidationError


class StoryScenePersistenceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.database = Database(":memory:")
        self.gateway = CommandGateway(self.database)
        self.workspace_id = "scene-workspace"
        self.gateway.create_workspace("Scene persistence", self.workspace_id)
        self.revision = self.command("hero", 0, "create_entity", {
            "entity_id": "hero", "entity_type": "character", "label": "Mira", "properties": {},
        })["revision"]
        self.revision = self.command("world", self.revision, "create_story_world", {
            "world_id": "world", "name": "Glass Harbor", "template_key": "fantasy",
            "description": "A coastal archive.", "content": {"starting_location": "Old Harbor"},
        })["revision"]
        self.gateway.create_branch(self.workspace_id, "main", "adventure", self.revision, "adventure-branch")
        self.adventure_revision = self.command("adventure", self.revision, "create_story_adventure", {
            "adventure_id": "adventure", "world_id": "world", "world_version": 1,
            "conversation_id": "story-chat", "name": "The Harbor Bell", "actor_entity_id": "hero",
        }, branch="adventure")["revision"]

    def tearDown(self) -> None:
        self.database.close()

    def command(self, key, revision, kind, payload, *, branch="main", actor="user"):
        return self.gateway.execute(
            workspace_id=self.workspace_id,
            branch_id=branch,
            idempotency_key=key,
            expected_revision=revision,
            command_type=kind,
            payload=payload,
            actor=actor,
            reason="Story scene persistence test",
        )

    def scene_payload(self, *, branch_id="adventure", scene_revision=1, source_revision=None):
        fixture_path = Path(__file__).resolve().parents[2] / "schemas" / "examples" / "scene.v1.json"
        payload = json.loads(fixture_path.read_text(encoding="utf-8"))
        payload.update({
            "scene_id": "harbor-arrival",
            "workspace_id": self.workspace_id,
            "branch_id": branch_id,
            "adventure_id": "adventure",
            "world_ref": {"world_id": "world", "version": 1},
            "scene_revision": scene_revision,
            "source_branch_revision": self.adventure_revision if source_revision is None else source_revision,
        })
        return payload

    def insert_scene(self, payload, *, created_revision=None, created_at="2026-11-24T12:00:00Z"):
        revision = self.adventure_revision if created_revision is None else created_revision
        self.database.connection.execute(
            "INSERT INTO story_scenes(workspace_id,branch_id,adventure_id,scene_id,created_revision,created_at) "
            "VALUES(?,?,?,?,?,?)",
            (payload["workspace_id"], payload["branch_id"], payload["adventure_id"],
             payload["scene_id"], revision, created_at),
        )
        self.insert_scene_revision(payload, created_at=created_at)

    def insert_scene_revision(self, payload, *, created_at="2026-11-24T12:00:00Z"):
        self.database.connection.execute(
            "INSERT INTO story_scene_revisions(workspace_id,branch_id,adventure_id,scene_id,scene_revision,"
            "source_branch_revision,scene_json,created_at) VALUES(?,?,?,?,?,?,?,?)",
            (payload["workspace_id"], payload["branch_id"], payload["adventure_id"], payload["scene_id"],
             payload["scene_revision"], payload["source_branch_revision"],
             json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")), created_at),
        )

    def test_branch_snapshot_copies_latest_scene_with_stable_id_and_lineage(self):
        first = self.scene_payload()
        self.insert_scene(first)
        latest = self.scene_payload(scene_revision=2)
        latest["title"] = "The bell above the harbor"
        self.insert_scene_revision(latest)

        self.gateway.create_branch(
            self.workspace_id, "adventure", "what-if", self.adventure_revision, "what-if-branch",
        )

        parent_revisions = self.database.connection.execute(
            "SELECT scene_revision FROM story_scene_revisions WHERE workspace_id=? AND branch_id='adventure' "
            "AND scene_id='harbor-arrival' ORDER BY scene_revision",
            (self.workspace_id,),
        ).fetchall()
        child_scene = self.database.connection.execute(
            "SELECT adventure_id,created_revision FROM story_scenes WHERE workspace_id=? AND branch_id='what-if' "
            "AND scene_id='harbor-arrival'",
            (self.workspace_id,),
        ).fetchone()
        child_revision = self.database.connection.execute(
            "SELECT scene_revision,source_branch_revision,scene_json FROM story_scene_revisions "
            "WHERE workspace_id=? AND branch_id='what-if' AND scene_id='harbor-arrival'",
            (self.workspace_id,),
        ).fetchone()
        copied = json.loads(child_revision["scene_json"])

        self.assertEqual([row[0] for row in parent_revisions], [1, 2])
        self.assertEqual(child_scene["adventure_id"], "adventure")
        self.assertEqual(child_scene["created_revision"], self.adventure_revision)
        self.assertEqual(child_revision["scene_revision"], 1)
        self.assertEqual(child_revision["source_branch_revision"], self.adventure_revision)
        self.assertEqual(copied["scene_id"], "harbor-arrival")
        self.assertEqual(copied["branch_id"], "what-if")
        self.assertEqual(copied["title"], "The bell above the harbor")
        self.assertEqual(copied["lineage"], {
            "origin_branch_id": "adventure",
            "origin_branch_revision": self.adventure_revision,
            "origin_scene_revision": 2,
        })
        self.assertEqual(self.database.connection.execute("PRAGMA foreign_key_check").fetchall(), [])

    def test_gateway_reads_validate_legacy_v1_scene_revisions(self):
        payload = self.scene_payload()
        self.insert_scene(payload)

        self.assertEqual(self.gateway.get_story_scene(
            self.workspace_id, "adventure", "adventure", payload["scene_id"],
        )["contract"], "lorethra.story-scene.v1")
        self.assertEqual(self.gateway.get_story_scene_history(
            self.workspace_id, "adventure", "adventure", payload["scene_id"],
        )[0]["contract"], "lorethra.story-scene.v1")
        self.assertEqual(self.gateway.list_story_scenes(
            self.workspace_id, "adventure", "adventure",
        )[0]["contract"], "lorethra.story-scene.v1")

    def test_legacy_v1_scene_revision_can_be_frozen_in_v2_snapshot(self):
        payload = self.scene_payload()
        payload.update({"participants": [], "interactions": [], "memory_refs": [],
                        "context_manifest_ref": None, "history_refs": [], "location_ref": None})
        self.insert_scene(payload)
        captured = self.command("legacy-scene-snapshot", self.adventure_revision,
                                "create_story_scene_snapshot", {
                                    "adventure_id": "adventure", "scene_id": "harbor-arrival",
                                    "scene_revision": 1,
                                }, branch="adventure")
        snapshot = self.gateway.get_story_scene_snapshot(
            self.workspace_id, "adventure", "adventure", captured["snapshot_id"],
        )
        self.assertEqual(snapshot["contract"], "lorethra.scene-snapshot.v2")
        self.assertEqual(snapshot["payload"]["scene_revision"]["contract"], "lorethra.story-scene.v1")
        self.assertTrue(self.gateway.verify_story_scene_snapshot(
            self.workspace_id, "adventure", "adventure", captured["snapshot_id"],
        )["valid"])

    def test_scope_pinned_world_and_immutable_history_constraints(self):
        payload = self.scene_payload()
        self.insert_scene(payload)
        connection = self.database.connection

        with self.assertRaises(sqlite3.IntegrityError):
            connection.execute(
                "UPDATE story_scenes SET scene_id='renamed' WHERE workspace_id=? AND branch_id='adventure' "
                "AND scene_id='harbor-arrival'",
                (self.workspace_id,),
            )
        with self.assertRaises(sqlite3.IntegrityError):
            connection.execute(
                "UPDATE story_scene_revisions SET scene_json='{}' WHERE workspace_id=? AND branch_id='adventure' "
                "AND scene_id='harbor-arrival'",
                (self.workspace_id,),
            )
        with self.assertRaises(sqlite3.IntegrityError):
            connection.execute(
                "DELETE FROM story_scene_revisions WHERE workspace_id=? AND branch_id='adventure' "
                "AND scene_id='harbor-arrival'",
                (self.workspace_id,),
            )

        wrong_branch = {**payload, "branch_id": "main"}
        with self.assertRaises(sqlite3.IntegrityError):
            self.insert_scene_revision(wrong_branch)
        wrong_world = {**payload, "world_ref": {"world_id": "another-world", "version": 1},
                       "scene_revision": 2}
        with self.assertRaisesRegex(sqlite3.IntegrityError, "pinned world version"):
            self.insert_scene_revision(wrong_world)
        with self.assertRaises(sqlite3.IntegrityError):
            connection.execute(
                "INSERT INTO story_scenes(workspace_id,branch_id,adventure_id,scene_id,created_revision,created_at) "
                "VALUES(?,?,?,?,?,?)",
                (self.workspace_id, "missing-branch", "adventure", "orphan", 0, "2026-11-24T12:00:00Z"),
            )
        self.assertEqual(connection.execute("PRAGMA foreign_key_check").fetchall(), [])

    def test_scene_changes_promote_as_a_new_target_revision_with_lineage(self):
        self.insert_scene(self.scene_payload())
        self.gateway.create_branch(
            self.workspace_id, "adventure", "what-if", self.adventure_revision, "what-if-branch",
        )
        branch_revision = self.command("branch-change", self.adventure_revision, "create_entity", {
            "entity_id": "alternate", "entity_type": "concept", "label": "Alternate path", "properties": {},
        }, branch="what-if")["revision"]
        changed = self.scene_payload(branch_id="what-if", scene_revision=2, source_revision=branch_revision)
        changed["title"] = "A changed scene title"
        self.insert_scene_revision(changed)

        promoted = self.command("promote-scenes", self.adventure_revision, "promote_branch", {
            "source_branch_id": "what-if", "source_revision": branch_revision,
        }, branch="adventure")
        target_scene = self.gateway.get_story_scene(
            self.workspace_id, "adventure", "adventure", "harbor-arrival",
        )
        self.assertEqual(promoted["copied_rows"]["story_scene_revisions"], 1)
        self.assertEqual(target_scene["scene_revision"], 2)
        self.assertEqual(target_scene["title"], "A changed scene title")
        self.assertEqual(target_scene["source_branch_revision"], promoted["revision"])
        self.assertEqual(target_scene["lineage"], {
            "origin_branch_id": "what-if",
            "origin_branch_revision": branch_revision,
            "origin_scene_revision": 2,
        })
        self.assertEqual(self.gateway.current_revision(self.workspace_id, "adventure"), promoted["revision"])
        self.assertEqual(self.gateway.current_revision(self.workspace_id, "what-if"), branch_revision)


if __name__ == "__main__":
    unittest.main()
