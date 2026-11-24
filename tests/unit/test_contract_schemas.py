"""Machine validation for registered Lorethra contract schemas and examples."""

from __future__ import annotations

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


if __name__ == "__main__":
    unittest.main()
