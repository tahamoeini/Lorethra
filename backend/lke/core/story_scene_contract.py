"""Validation of stored StoryScene payloads against registered versioned contracts."""

from __future__ import annotations

import json
import sys
from functools import lru_cache
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator, FormatChecker
from jsonschema.exceptions import ValidationError as JsonSchemaValidationError
from referencing import Registry, Resource

from .errors import ValidationError


_SCENE_CONTRACT_SCHEMAS = {
    "lorethra.story-scene.v1": "scene.v1.schema.json",
    "lorethra.story-scene.v2": "scene.v2.schema.json",
}
_SNAPSHOT_CONTRACT_SCHEMAS = {
    "lorethra.scene-snapshot.v1": "snapshot.v1.schema.json",
    "lorethra.scene-snapshot.v2": "snapshot.v2.schema.json",
}


def _contract_directory() -> Path:
    bundled_root = getattr(sys, "_MEIPASS", None)
    candidates = []
    if bundled_root:
        candidates.append(Path(bundled_root) / "schemas" / "contracts")
    candidates.append(Path(__file__).resolve().parents[3] / "schemas" / "contracts")
    for candidate in candidates:
        if (candidate / "scenes" / "scene.v1.schema.json").is_file():
            return candidate
    raise RuntimeError("StoryScene contract schemas are missing from this Lorethra installation")


@lru_cache(maxsize=4)
def _contract_validator(directory_name: str, schema_name: str) -> Draft202012Validator:
    contracts = _contract_directory()
    scene_schema = json.loads((contracts / directory_name / schema_name).read_text(encoding="utf-8"))
    common_schema = json.loads((contracts / "common" / "common.v1.schema.json").read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(scene_schema)
    Draft202012Validator.check_schema(common_schema)
    registry = Registry().with_resource(
        common_schema["$id"], Resource.from_contents(common_schema),
    )
    for contract_directory in ("scenes",):
        for candidate in (contracts / contract_directory).glob("*.schema.json"):
            referenced = json.loads(candidate.read_text(encoding="utf-8"))
            if referenced.get("$id"):
                registry = registry.with_resource(
                    referenced["$id"], Resource.from_contents(referenced),
                )
    return Draft202012Validator(
        scene_schema,
        registry=registry,
        format_checker=FormatChecker(),
    )


def _validate_document(document: Any, contracts: dict[str, str], directory: str, label: str) -> dict[str, Any]:
    if not isinstance(document, dict):
        raise ValidationError(f"{label} must be a JSON object")
    contract = document.get("contract", "")
    schema_name = contracts.get(contract)
    if schema_name is None:
        raise ValidationError(f"Unsupported {label.lower()} contract: {contract or 'missing'}")
    try:
        _contract_validator(directory, schema_name).validate(document)
    except JsonSchemaValidationError as error:
        path = ".".join(str(part) for part in error.absolute_path)
        location = f" at {path}" if path else ""
        raise ValidationError(f"Invalid {label.lower()}{location}: {error.message}") from error
    return document


def validate_story_scene_document(document: Any) -> dict[str, Any]:
    """Return a valid JSON object or raise a gateway-friendly contract error."""
    return _validate_document(document, _SCENE_CONTRACT_SCHEMAS, "scenes", "Story scene")


def validate_story_scene_snapshot(document: Any) -> dict[str, Any]:
    """Validate an immutable scene snapshot envelope against its registered schema."""
    return _validate_document(document, _SNAPSHOT_CONTRACT_SCHEMAS, "scenes", "Story scene snapshot")
