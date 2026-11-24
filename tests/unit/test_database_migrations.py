"""Migration checks for upgrading existing workspace databases."""

import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

from lke.core import CommandGateway, Database
from lke.core.database import SCHEMA_VERSION, _SCHEMA_V7


class DatabaseMigrationTests(unittest.TestCase):
    def _drop_story_image_and_scene_schema(self, database):
        for table in ("story_scene_snapshots", "story_scene_revisions", "story_scenes"):
            database.connection.execute(f"DROP TABLE IF EXISTS {table}")
        for table in (
            "story_image_job_events", "story_image_candidates", "story_image_frames", "story_image_jobs",
        ):
            database.connection.execute(f"DROP TABLE IF EXISTS {table}")

    def _drop_extractions(self, database):
        for table in ("extraction_candidates", "extraction_batches", "entity_evidence"):
            database.connection.execute(f"DROP TABLE {table}")

    def _drop_story_extensions(self, database):
        database.connection.execute("DROP TRIGGER IF EXISTS story_adventure_source_archive_immutable")
        for table, column in (
            ("story_turns", "metadata_json"),
            ("story_adventures", "source_archive_json"),
            ("rpg_sheets", "map_region"),
            ("rpg_sheets", "map_x"),
            ("rpg_sheets", "map_y"),
            ("rpg_sheets", "map_scale"),
            ("rpg_sheets", "abilities_json"),
            ("rpg_sheets", "skills_json"),
            ("rpg_sheets", "experience_json"),
        ):
            columns = {row[1] for row in database.connection.execute(f"PRAGMA table_info({table})").fetchall()}
            if column in columns:
                database.connection.execute(f"ALTER TABLE {table} DROP COLUMN {column}")
        for table in ("rpg_mechanic_checks", "story_map_locations", "story_visual_profiles", "story_assets", "story_npc_profiles", "story_threads", "story_memories", "story_turn_edits"):
            database.connection.execute(f"DROP TABLE IF EXISTS {table}")
        database.connection.execute("ALTER TABLE story_adventures DROP COLUMN npc_simulation_enabled")
        database.connection.execute("ALTER TABLE story_adventures DROP COLUMN completed_turns")

    def _drop_story_library_extensions(self, database):
        database.connection.execute("DROP INDEX IF EXISTS story_worlds_library_idx")
        database.connection.execute("DROP INDEX IF EXISTS story_adventures_library_archive_idx")
        database.connection.execute("ALTER TABLE story_worlds DROP COLUMN archived_at")
        database.connection.execute("ALTER TABLE story_adventures DROP COLUMN archived_at")

    def _drop_scenarios(self, database):
        for table in (
            "scenario_assumptions", "scenario_source_evidence", "scenario_claim_evidence",
            "scenario_options", "scenarios",
        ):
            database.connection.execute(f"DROP TABLE {table}")

    def _drop_exchanges(self, database):
        database.connection.execute("DROP TABLE external_exchanges")
        self._drop_story_rpg(database)

    def test_v20_database_adds_scene_storage_without_changing_existing_records(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database_path = Path(temporary_directory) / "v20.sqlite3"
            database = Database(database_path)
            gateway = CommandGateway(database)
            gateway.create_workspace("Scene migration", "scene-migration")
            gateway.execute(
                workspace_id="scene-migration", idempotency_key="scene-migration-entity", expected_revision=0,
                command_type="create_entity",
                payload={"entity_id": "hero", "entity_type": "character", "label": "Mira", "properties": {}},
                reason="Preserve a pre-scene-schema record",
            )
            for table in ("story_scene_snapshots", "story_scene_revisions", "story_scenes"):
                database.connection.execute(f"DROP TABLE {table}")
            database.connection.execute("DELETE FROM schema_migrations WHERE version>=21")
            database.close()

            upgraded = Database(database_path)
            scene_tables = {
                row[0] for row in upgraded.connection.execute(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'story_scene%'")
            }
            preserved = upgraded.connection.execute(
                "SELECT label FROM entities WHERE workspace_id='scene-migration' AND entity_id='hero'"
            ).fetchone()
            version = upgraded.connection.execute("SELECT MAX(version) FROM schema_migrations").fetchone()[0]
            foreign_keys = upgraded.connection.execute("PRAGMA foreign_key_check").fetchall()
            upgraded.close()

        self.assertEqual(version, SCHEMA_VERSION)
        self.assertEqual(scene_tables, {"story_scenes", "story_scene_revisions", "story_scene_snapshots"})
        self.assertEqual(preserved["label"], "Mira")
        self.assertEqual(foreign_keys, [])

    def test_v21_scene_rows_are_preserved_while_v2_contract_storage_is_enabled(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database_path = Path(temporary_directory) / "v21-scenes.sqlite3"
            database = Database(database_path)
            gateway = CommandGateway(database)
            workspace_id = "scene-contract-migration"
            gateway.create_workspace("Scene contract migration", workspace_id)
            hero = gateway.execute(
                workspace_id=workspace_id, idempotency_key="hero", expected_revision=0,
                command_type="create_entity",
                payload={"entity_id": "hero", "entity_type": "character", "label": "Mira", "properties": {}},
                reason="Prepare migration fixture",
            )
            world = gateway.execute(
                workspace_id=workspace_id, idempotency_key="world", expected_revision=hero["revision"],
                command_type="create_story_world",
                payload={"world_id": "world", "name": "Harbor", "template_key": "fantasy", "content": {}},
                reason="Prepare migration fixture",
            )
            gateway.create_branch(workspace_id, "main", "adventure", world["revision"], "migration fixture")
            adventure = gateway.execute(
                workspace_id=workspace_id, branch_id="adventure", idempotency_key="adventure",
                expected_revision=world["revision"],
                command_type="create_story_adventure",
                payload={"adventure_id": "adventure", "world_id": "world", "world_version": 1,
                         "conversation_id": "story", "name": "Harbor Story", "actor_entity_id": "hero"},
                reason="Prepare migration fixture",
            )
            revision = adventure["revision"]
            scene = {
                "contract": "lorethra.story-scene.v1", "workspace_id": workspace_id, "branch_id": "adventure",
                "adventure_id": "adventure", "scene_id": "legacy-scene", "scene_revision": 1,
                "source_branch_revision": revision, "world_ref": {"world_id": "world", "version": 1},
            }
            database.connection.execute(
                "INSERT INTO story_scenes(workspace_id,branch_id,adventure_id,scene_id,created_revision,created_at) "
                "VALUES(?, 'adventure', 'adventure', 'legacy-scene', ?, '2026-11-24T00:00:00Z')",
                (workspace_id, revision),
            )
            database.connection.execute("DROP TABLE story_scene_snapshots")
            database.connection.execute("DROP TABLE story_scene_revisions")
            database.connection.execute("""
                CREATE TABLE story_scene_revisions_v21 (
                    workspace_id TEXT NOT NULL,
                    branch_id TEXT NOT NULL,
                    adventure_id TEXT NOT NULL,
                    scene_id TEXT NOT NULL,
                    scene_revision INTEGER NOT NULL CHECK(scene_revision >= 1),
                    source_branch_revision INTEGER NOT NULL CHECK(source_branch_revision >= 0),
                    scene_json TEXT NOT NULL CHECK(
                        json_valid(scene_json)
                        AND json_type(scene_json) = 'object'
                        AND json_extract(scene_json,'$.contract') IS 'lorethra.story-scene.v1'
                        AND json_extract(scene_json,'$.workspace_id') IS workspace_id
                        AND json_extract(scene_json,'$.branch_id') IS branch_id
                        AND json_extract(scene_json,'$.adventure_id') IS adventure_id
                        AND json_extract(scene_json,'$.scene_id') IS scene_id
                        AND json_type(scene_json,'$.scene_revision') IS 'integer'
                        AND json_extract(scene_json,'$.scene_revision') = scene_revision
                        AND json_type(scene_json,'$.source_branch_revision') IS 'integer'
                        AND json_extract(scene_json,'$.source_branch_revision') = source_branch_revision
                    ),
                    created_at TEXT NOT NULL,
                    PRIMARY KEY(workspace_id,branch_id,scene_id,scene_revision),
                    FOREIGN KEY(workspace_id,branch_id,adventure_id,scene_id)
                        REFERENCES story_scenes(workspace_id,branch_id,adventure_id,scene_id) ON DELETE CASCADE,
                    FOREIGN KEY(workspace_id,branch_id,source_branch_revision)
                        REFERENCES revisions(workspace_id,branch_id,revision) DEFERRABLE INITIALLY DEFERRED
                )
            """)
            database.connection.execute(
                "INSERT INTO story_scene_revisions_v21(workspace_id,branch_id,adventure_id,scene_id,scene_revision,"
                "source_branch_revision,scene_json,created_at) VALUES(?, 'adventure', 'adventure', 'legacy-scene', 1, ?, ?, ?)",
                (workspace_id, revision, json.dumps(scene), "2026-11-24T00:00:00Z"),
            )
            database.connection.execute("ALTER TABLE story_scene_revisions_v21 RENAME TO story_scene_revisions")
            database.connection.execute("DELETE FROM schema_migrations WHERE version>=22")
            database.close()

            upgraded = Database(database_path)
            stored = upgraded.connection.execute(
                "SELECT scene_json FROM story_scene_revisions WHERE workspace_id=? AND scene_id='legacy-scene'",
                (workspace_id,),
            ).fetchone()
            contract = upgraded.connection.execute(
                "SELECT sql FROM sqlite_master WHERE type='table' AND name='story_scene_revisions'"
            ).fetchone()["sql"]
            version = upgraded.connection.execute("SELECT MAX(version) FROM schema_migrations").fetchone()[0]
            foreign_keys = upgraded.connection.execute("PRAGMA foreign_key_check").fetchall()
            with self.assertRaisesRegex(sqlite3.IntegrityError, "immutable"):
                upgraded.connection.execute(
                    "UPDATE story_scene_revisions SET created_at='changed' WHERE workspace_id=? AND scene_id='legacy-scene'",
                    (workspace_id,),
                )
            upgraded.close()

        self.assertEqual(version, SCHEMA_VERSION)
        self.assertEqual(json.loads(stored["scene_json"]), scene)
        self.assertIn("lorethra.story-scene.v2", contract)
        self.assertEqual(foreign_keys, [])

    def test_v22_scene_history_is_preserved_when_snapshot_storage_is_added(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database_path = Path(temporary_directory) / "v22-scenes.sqlite3"
            database = Database(database_path)
            gateway = CommandGateway(database)
            workspace_id = "scene-snapshot-migration"
            gateway.create_workspace("Scene snapshot migration", workspace_id)
            hero = gateway.execute(
                workspace_id=workspace_id, idempotency_key="hero", expected_revision=0,
                command_type="create_entity",
                payload={"entity_id": "hero", "entity_type": "character", "label": "Mira", "properties": {}},
                reason="Prepare migration fixture",
            )
            world = gateway.execute(
                workspace_id=workspace_id, idempotency_key="world", expected_revision=hero["revision"],
                command_type="create_story_world",
                payload={"world_id": "world", "name": "Harbor", "template_key": "fantasy", "content": {}},
                reason="Prepare migration fixture",
            )
            gateway.create_branch(workspace_id, "main", "adventure", world["revision"], "migration branch")
            adventure = gateway.execute(
                workspace_id=workspace_id, branch_id="adventure", idempotency_key="adventure",
                expected_revision=world["revision"], command_type="create_story_adventure",
                payload={"adventure_id": "adventure", "world_id": "world", "world_version": 1,
                         "conversation_id": "story", "name": "Harbor Story", "actor_entity_id": "hero"},
                reason="Prepare migration fixture",
            )
            scene = gateway.execute(
                workspace_id=workspace_id, branch_id="adventure", idempotency_key="scene",
                expected_revision=adventure["revision"], command_type="create_story_scene",
                payload={"adventure_id": "adventure", "scene": {"scene_id": "scene", "title": "Harbor"}},
                reason="Prepare migration fixture",
            )
            stored_before = gateway.get_story_scene_history(workspace_id, "adventure", "adventure", "scene")
            database.connection.execute("DROP TABLE story_scene_snapshots")
            database.connection.execute("DROP INDEX story_scene_revisions_adventure_identity_idx")
            database.connection.execute("DELETE FROM schema_migrations WHERE version>=23")
            database.close()

            upgraded = Database(database_path)
            stored_after = CommandGateway(upgraded).get_story_scene_history(
                workspace_id, "adventure", "adventure", "scene",
            )
            snapshot_table = upgraded.connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='story_scene_snapshots'"
            ).fetchone()
            version = upgraded.connection.execute("SELECT MAX(version) FROM schema_migrations").fetchone()[0]
            foreign_keys = upgraded.connection.execute("PRAGMA foreign_key_check").fetchall()
            upgraded.close()

        self.assertEqual(version, SCHEMA_VERSION)
        self.assertIsNotNone(snapshot_table)
        self.assertEqual(stored_after, stored_before)
        self.assertEqual(scene["scene_revision"], 1)
        self.assertEqual(foreign_keys, [])

    def _drop_story_rpg(self, database):
        self._drop_story_extensions(database)
        for table in (
            "rpg_state_proposals", "rpg_checks", "rpg_sheets", "story_adventures",
            "story_world_versions", "story_worlds",
        ):
            database.connection.execute(f"DROP TABLE {table}")

    def test_v1_database_upgrades_through_all_current_schemas(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database_path = Path(temporary_directory) / "knowledge.sqlite3"
            database = Database(database_path)
            self._drop_extractions(database)
            self._drop_scenarios(database)
            self._drop_exchanges(database)
            database.connection.execute("DROP TABLE rules")
            database.connection.execute("DROP TABLE journal_events")
            database.connection.execute("DROP TABLE story_turns")
            database.connection.execute("DROP TABLE story_conversations")
            self._drop_story_image_and_scene_schema(database)
            database.connection.execute("DELETE FROM schema_migrations WHERE version>1")
            database.close()

            upgraded = Database(database_path)
            version = upgraded.connection.execute(
                "SELECT MAX(version) FROM schema_migrations"
            ).fetchone()[0]
            tables = {
                row[0]
                for row in upgraded.connection.execute(
                    "SELECT name FROM sqlite_master WHERE type='table'"
                ).fetchall()
            }
            v14_columns = {
                table: {row[1] for row in upgraded.connection.execute(f"PRAGMA table_info({table})").fetchall()}
                for table in ("story_turns", "story_adventures", "rpg_sheets", "story_map_locations")
            }
            v16_tables = {
                row[0] for row in upgraded.connection.execute(
                    "SELECT name FROM sqlite_master WHERE type='table'"
                ).fetchall()
            }
            v17_library_columns = {
                table: {row[1] for row in upgraded.connection.execute(f"PRAGMA table_info({table})").fetchall()}
                for table in ("story_worlds", "story_adventures")
            }
            archive_trigger = upgraded.connection.execute(
                "SELECT 1 FROM sqlite_master WHERE type='trigger' AND name='story_adventure_source_archive_immutable'"
            ).fetchone()
            upgraded.close()

        self.assertEqual(version, SCHEMA_VERSION)
        self.assertTrue({"story_conversations", "story_turns", "journal_events", "rules", "scenarios", "scenario_assumptions", "extraction_batches", "extraction_candidates", "entity_evidence", "external_exchanges", "story_worlds", "story_world_versions", "story_adventures", "rpg_sheets", "rpg_checks", "rpg_state_proposals", "story_turn_edits", "story_memories", "story_threads", "story_npc_profiles", "story_assets", "story_visual_profiles", "story_map_locations"} <= tables)
        self.assertTrue({"metadata_json"} <= v14_columns["story_turns"])
        self.assertTrue({"source_archive_json"} <= v14_columns["story_adventures"])
        self.assertTrue({"map_region", "map_x", "map_y", "map_scale"} <= v14_columns["rpg_sheets"])
        self.assertTrue({"skills_json", "experience_json"} <= v14_columns["rpg_sheets"])
        self.assertIn("rpg_mechanic_checks", v16_tables)
        self.assertTrue({"archived_at"} <= v17_library_columns["story_worlds"])
        self.assertTrue({"archived_at"} <= v17_library_columns["story_adventures"])
        self.assertTrue({"location_type", "description", "icon", "x", "y"} <= v14_columns["story_map_locations"])
        self.assertIsNotNone(archive_trigger)

    def test_v18_database_receives_immutable_visual_profile_schema(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database_path = Path(temporary_directory) / "knowledge.sqlite3"
            database = Database(database_path)
            database.connection.execute("DROP TABLE story_visual_profiles")
            self._drop_story_image_and_scene_schema(database)
            database.connection.execute("DELETE FROM schema_migrations WHERE version > 18")
            database.close()

            upgraded = Database(database_path)
            version = upgraded.connection.execute(
                "SELECT MAX(version) FROM schema_migrations"
            ).fetchone()[0]
            columns = {
                row[1] for row in upgraded.connection.execute(
                    "PRAGMA table_info(story_visual_profiles)"
                ).fetchall()
            }
            triggers = {
                row[0] for row in upgraded.connection.execute(
                    "SELECT name FROM sqlite_master WHERE type='trigger' AND tbl_name='story_visual_profiles'"
                ).fetchall()
            }
            upgraded.close()

        self.assertEqual(version, SCHEMA_VERSION)
        self.assertTrue({"workspace_id", "branch_id", "adventure_id", "entity_id", "version", "appearance", "reference_asset_ids_json", "created_revision"} <= columns)
        self.assertEqual(
            triggers,
            {"story_visual_profiles_no_update", "story_visual_profiles_no_delete"},
        )
        with tempfile.TemporaryDirectory() as temporary_directory:
            database_path = Path(temporary_directory) / "v19.sqlite3"
            database = Database(database_path)
            for table in (
                "story_image_job_events", "story_image_candidates", "story_image_frames", "story_image_jobs",
            ):
                database.connection.execute(f"DROP TABLE {table}")
            for table in ("story_scene_snapshots", "story_scene_revisions", "story_scenes"):
                database.connection.execute(f"DROP TABLE {table}")
            database.connection.execute("DELETE FROM schema_migrations WHERE version>19")
            database.close()
            upgraded = Database(database_path)
            tables = {
                row[0] for row in upgraded.connection.execute(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'story_image_%'"
                ).fetchall()
            }
            frame_columns = {
                row[1] for row in upgraded.connection.execute("PRAGMA table_info(story_image_frames)").fetchall()
            }
            upgraded.close()
        self.assertEqual(tables, {
            "story_image_jobs", "story_image_frames", "story_image_candidates", "story_image_job_events",
        })
        self.assertTrue({"recipe_json", "reconcile_allowed", "provider_job_id"} <= frame_columns)

    def test_v2_database_upgrades_to_journal_and_rule_schemas(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database_path = Path(temporary_directory) / "knowledge.sqlite3"
            database = Database(database_path)
            self._drop_extractions(database)
            self._drop_scenarios(database)
            self._drop_exchanges(database)
            database.connection.execute("DROP TABLE rules")
            database.connection.execute("DROP TABLE journal_events")
            self._drop_story_image_and_scene_schema(database)
            database.connection.execute("DELETE FROM schema_migrations WHERE version>2")
            database.close()

            upgraded = Database(database_path)
            version = upgraded.connection.execute(
                "SELECT MAX(version) FROM schema_migrations"
            ).fetchone()[0]
            table = upgraded.connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='journal_events'"
            ).fetchone()
            rules = upgraded.connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='rules'"
            ).fetchone()
            upgraded.close()

        self.assertEqual(version, SCHEMA_VERSION)
        self.assertIsNotNone(table)
        self.assertIsNotNone(rules)

    def test_v3_database_upgrades_to_rule_schema(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database_path = Path(temporary_directory) / "knowledge.sqlite3"
            database = Database(database_path)
            self._drop_extractions(database)
            self._drop_scenarios(database)
            self._drop_exchanges(database)
            database.connection.execute("DROP TABLE rules")
            self._drop_story_image_and_scene_schema(database)
            database.connection.execute("DELETE FROM schema_migrations WHERE version>3")
            database.close()

            upgraded = Database(database_path)
            version = upgraded.connection.execute(
                "SELECT MAX(version) FROM schema_migrations"
            ).fetchone()[0]
            table = upgraded.connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='rules'"
            ).fetchone()
            upgraded.close()

        self.assertEqual(version, SCHEMA_VERSION)
        self.assertIsNotNone(table)

    def test_v4_database_upgrades_to_scenario_schema(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database_path = Path(temporary_directory) / "knowledge.sqlite3"
            database = Database(database_path)
            self._drop_extractions(database)
            self._drop_scenarios(database)
            self._drop_exchanges(database)
            self._drop_story_image_and_scene_schema(database)
            database.connection.execute("DELETE FROM schema_migrations WHERE version>4")
            database.close()

            upgraded = Database(database_path)
            version = upgraded.connection.execute(
                "SELECT MAX(version) FROM schema_migrations"
            ).fetchone()[0]
            tables = {
                row[0]
                for row in upgraded.connection.execute(
                    "SELECT name FROM sqlite_master WHERE type='table'"
                ).fetchall()
            }
            upgraded.close()

        self.assertEqual(version, SCHEMA_VERSION)
        self.assertTrue({"scenarios", "scenario_options", "scenario_assumptions", "scenario_claim_evidence", "scenario_source_evidence"} <= tables)

    def test_v5_database_upgrades_to_source_extraction_schema(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database_path = Path(temporary_directory) / "knowledge.sqlite3"
            database = Database(database_path)
            self._drop_extractions(database)
            self._drop_exchanges(database)
            self._drop_story_image_and_scene_schema(database)
            database.connection.execute("DELETE FROM schema_migrations WHERE version>5")
            database.close()

            upgraded = Database(database_path)
            version = upgraded.connection.execute(
                "SELECT MAX(version) FROM schema_migrations"
            ).fetchone()[0]
            tables = {
                row[0]
                for row in upgraded.connection.execute(
                    "SELECT name FROM sqlite_master WHERE type='table'"
                ).fetchall()
            }
            upgraded.close()

        self.assertEqual(version, SCHEMA_VERSION)
        self.assertTrue({"extraction_batches", "extraction_candidates", "entity_evidence"} <= tables)

    def test_v6_database_upgrades_to_external_exchange_schema(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database_path = Path(temporary_directory) / "knowledge.sqlite3"
            database = Database(database_path)
            self._drop_exchanges(database)
            self._drop_story_image_and_scene_schema(database)
            database.connection.execute("DELETE FROM schema_migrations WHERE version>6")
            database.close()

            upgraded = Database(database_path)
            version = upgraded.connection.execute(
                "SELECT MAX(version) FROM schema_migrations"
            ).fetchone()[0]
            exchange_table = upgraded.connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='external_exchanges'"
            ).fetchone()
            upgraded.close()

        self.assertEqual(version, SCHEMA_VERSION)
        self.assertIsNotNone(exchange_table)

    def test_v7_database_backfills_known_transcript_end(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database_path = Path(temporary_directory) / "knowledge.sqlite3"
            database = Database(database_path)
            self._drop_story_rpg(database)
            gateway = CommandGateway(database)
            gateway.create_workspace("Migration", "migration-workspace")
            database.connection.execute("DROP TABLE external_exchanges")
            database.connection.executescript(_SCHEMA_V7)
            database.connection.execute(
                "INSERT INTO external_exchanges(workspace_id,branch_id,exchange_id,transcript_id,"
                "context_manifest_id,base_revision,from_turn,to_turn,transcript_hash,context_manifest_json,"
                "turns_json,proposed_change_ids_json,created_revision,created_at) "
                "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                ("migration-workspace", "main", "old-exchange", "old-transcript", "old-context", 0,
                 0, 1, "sha256:" + "0" * 64, "{}", "[]", "[]", 0, "2026-01-01T00:00:00.000Z"),
            )
            self._drop_story_image_and_scene_schema(database)
            database.connection.execute("DELETE FROM schema_migrations WHERE version>7")
            database.close()

            upgraded = Database(database_path)
            version = upgraded.connection.execute(
                "SELECT MAX(version) FROM schema_migrations"
            ).fetchone()[0]
            migrated = upgraded.connection.execute(
                "SELECT from_turn,to_turn,transcript_total_turns FROM external_exchanges WHERE exchange_id='old-exchange'"
            ).fetchone()
            upgraded.close()

        self.assertEqual(version, SCHEMA_VERSION)
        self.assertEqual(tuple(migrated), (0, 1, 1))

    def test_v9_world_versions_gain_a_pinned_name(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database_path = Path(temporary_directory) / "knowledge.sqlite3"
            database = Database(database_path)
            gateway = CommandGateway(database)
            gateway.create_workspace("Migration", "world-migration")
            gateway.execute(
                workspace_id="world-migration", idempotency_key="world-migration-create", expected_revision=0,
                command_type="create_story_world",
                payload={"world_id": "harbor", "name": "Old Harbor", "template_key": "blank", "content": {}},
                reason="Create migration fixture",
            )
            database.connection.execute("ALTER TABLE story_world_versions DROP COLUMN name")
            self._drop_story_extensions(database)
            self._drop_story_library_extensions(database)
            self._drop_story_image_and_scene_schema(database)
            database.connection.execute("DELETE FROM schema_migrations WHERE version>9")
            database.close()

            upgraded = Database(database_path)
            version_name = upgraded.connection.execute(
                "SELECT name FROM story_world_versions WHERE world_id='harbor' AND version=1"
            ).fetchone()["name"]
            with self.assertRaises(sqlite3.IntegrityError):
                upgraded.connection.execute(
                    "UPDATE story_world_versions SET name='Changed' WHERE world_id='harbor' AND version=1"
                )
            upgraded.close()

        self.assertEqual(version_name, "Old Harbor")


if __name__ == "__main__":
    unittest.main()
