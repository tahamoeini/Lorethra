"""Machine validation for registered Lorethra contract schemas and examples."""

from __future__ import annotations

import copy
import hashlib
import json
import unittest
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker
from jsonschema.exceptions import ValidationError
from referencing import Registry, Resource


ROOT = Path(__file__).resolve().parents[2]
CONTRACTS = ROOT / "schemas" / "contracts"
REGISTRY_PATH = CONTRACTS / "registry.json"
REGISTRY_SCHEMA_PATH = CONTRACTS / "registry.schema.json"


def _read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _canonical_json_sha256(value: dict) -> str:
    canonical_bytes = json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(canonical_bytes).hexdigest()


class ContractSchemaTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.registry_document = _read_json(REGISTRY_PATH)
        cls.schema_paths = sorted(CONTRACTS.rglob("*.schema.json"))
        cls.schemas = {path.resolve(): _read_json(path) for path in cls.schema_paths}
        cls.reference_registry = Registry()
        for schema in cls.schemas.values():
            schema_id = schema.get("$id")
            if schema_id:
                cls.reference_registry = cls.reference_registry.with_resource(
                    schema_id, Resource.from_contents(schema)
                )

    def test_registry_and_every_json_schema_are_valid(self) -> None:
        registry_schema = _read_json(REGISTRY_SCHEMA_PATH)
        Draft202012Validator.check_schema(registry_schema)
        Draft202012Validator(registry_schema).validate(self.registry_document)

        registered_paths = set()
        registered_names = set()
        for entry in self.registry_document["contracts"]:
            registered_names.add(entry["name"])
            if entry["kind"] != "json-schema":
                continue
            schema_path = (CONTRACTS / entry["path"]).resolve()
            self.assertTrue(schema_path.is_file(), entry["name"])
            registered_paths.add(schema_path)
            schema = self.schemas[schema_path]
            self.assertTrue(schema["$id"].endswith(":v" + entry["version"].split(".")[0]))
            Draft202012Validator.check_schema(schema)

        self.assertEqual(len(registered_names), len(self.registry_document["contracts"]))
        expected_paths = set(self.schemas) - {REGISTRY_SCHEMA_PATH.resolve()}
        self.assertEqual(registered_paths, expected_paths)

    def test_registered_examples_validate_and_malformed_context_is_rejected(self) -> None:
        for entry in self.registry_document["contracts"]:
            if entry["kind"] != "json-schema":
                continue
            schema_path = (CONTRACTS / entry["path"]).resolve()
            schema = self.schemas[schema_path]
            validator = Draft202012Validator(
                schema,
                registry=self.reference_registry,
                format_checker=FormatChecker(),
            )
            for example_name in entry.get("examples", []):
                example_path = (CONTRACTS / example_name).resolve()
                validator.validate(_read_json(example_path))

        context_entry = next(
            item for item in self.registry_document["contracts"] if item["name"] == "lke.context.v1"
        )
        context_schema = self.schemas[(CONTRACTS / context_entry["path"]).resolve()]
        invalid_context = _read_json(ROOT / "schemas" / "examples" / "context-manifest.v1.json")
        invalid_context["base_revision"] = "42"
        validator = Draft202012Validator(
            context_schema,
            registry=self.reference_registry,
            format_checker=FormatChecker(),
        )
        with self.assertRaises(ValidationError):
            validator.validate(invalid_context)

    def test_openapi_design_document_has_versioned_authorized_operation(self) -> None:
        registry_entry = next(
            item for item in self.registry_document["contracts"] if item["kind"] == "openapi"
        )
        openapi_path = (CONTRACTS / registry_entry["path"]).resolve()
        document = _read_json(openapi_path)
        self.assertEqual(document["openapi"], "3.1.0")
        self.assertEqual(document["info"]["version"], "1.0.0")
        operation = document["paths"]["/workspaces/{workspace_id}/worlds/{world_id}"]["get"]
        self.assertIn("integrationBearer", operation["security"][0])
        self.assertIn("world.read", operation["x-required-capabilities"])
        self.assertIn("200", operation["responses"])
        self.assertIn("default", operation["responses"])
        error_ref = operation["responses"]["default"]["content"]["application/json"]["schema"]["$ref"]
        error_schema_path = (openapi_path.parent / error_ref).resolve()
        self.assertTrue(error_schema_path.is_file())
        world_ref = operation["responses"]["200"]["content"]["application/json"]["schema"]["$ref"]
        world_schema_path = (openapi_path.parent / world_ref).resolve()
        self.assertTrue(world_schema_path.is_file())
        world_schema = _read_json(world_schema_path)
        Draft202012Validator.check_schema(world_schema)
        Draft202012Validator(
            world_schema,
            registry=self.reference_registry,
            format_checker=FormatChecker(),
        ).validate(
            _read_json(ROOT / "schemas" / "examples" / "world-summary.v1.json")
        )

    def test_scene_contract_rejects_ambiguous_or_untraceable_revisions(self) -> None:
        scene_entry = next(
            item for item in self.registry_document["contracts"] if item["name"] == "lorethra.story-scene"
        )
        scene_schema = self.schemas[(CONTRACTS / scene_entry["path"]).resolve()]
        scene_validator = Draft202012Validator(
            scene_schema,
            registry=self.reference_registry,
            format_checker=FormatChecker(),
        )
        scene_example = _read_json(ROOT / "schemas" / "examples" / "scene.v1.json")

        planned_dialogue = copy.deepcopy(scene_example)
        planned_dialogue["interactions"][0]["interaction_type"] = "dialogue"
        planned_dialogue["interactions"][0]["record_state"] = "planned"
        planned_dialogue["interactions"][0]["dialogue_refs"] = []
        scene_validator.validate(planned_dialogue)

        invalid_scenes = []
        missing_exact_time = copy.deepcopy(scene_example)
        missing_exact_time["in_world_time"] = {"kind": "exact"}
        invalid_scenes.append(missing_exact_time)

        unreviewed_memory = copy.deepcopy(scene_example)
        unreviewed_memory["memory_refs"][0]["review_status"] = "proposed"
        invalid_scenes.append(unreviewed_memory)

        archived_active_scene = copy.deepcopy(scene_example)
        archived_active_scene["is_archived"] = True
        archived_active_scene["archived_branch_revision"] = 43
        invalid_scenes.append(archived_active_scene)

        unversioned_dialogue = copy.deepcopy(scene_example)
        del unversioned_dialogue["interactions"][1]["dialogue_refs"][0]["edit_version"]
        invalid_scenes.append(unversioned_dialogue)

        for invalid_scene in invalid_scenes:
            with self.subTest(scene=invalid_scene):
                with self.assertRaises(ValidationError):
                    scene_validator.validate(invalid_scene)

        snapshot_entry = next(
            item for item in self.registry_document["contracts"] if item["name"] == "lorethra.scene-snapshot"
        )
        snapshot_schema = self.schemas[(CONTRACTS / snapshot_entry["path"]).resolve()]
        snapshot_validator = Draft202012Validator(
            snapshot_schema,
            registry=self.reference_registry,
            format_checker=FormatChecker(),
        )
        invalid_snapshot = _read_json(ROOT / "schemas" / "examples" / "scene-snapshot.v1.json")
        invalid_snapshot["payload_sha256"] = "not-a-sha256"
        with self.assertRaises(ValidationError):
            snapshot_validator.validate(invalid_snapshot)

    def test_scene_examples_have_matching_state_and_snapshot_digests(self) -> None:
        scene = _read_json(ROOT / "schemas" / "examples" / "scene.v1.json")
        state_snapshot = scene["participants"][0]["state_snapshot"]
        self.assertEqual(state_snapshot["sha256"], _canonical_json_sha256(state_snapshot["values"]))

        snapshot = _read_json(ROOT / "schemas" / "examples" / "scene-snapshot.v1.json")
        self.assertEqual(snapshot["payload_sha256"], _canonical_json_sha256(snapshot["scene_revision"]))


if __name__ == "__main__":
    unittest.main()
