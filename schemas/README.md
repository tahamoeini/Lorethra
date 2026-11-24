# Contract schemas

`contracts/registry.json` is the central registry for versioned Lorethra contracts. Contract JSON Schemas use JSON Schema Draft 2020-12, stable URN `$id` values, and filenames ending in `.v<major>.schema.json`; `registry.schema.json` validates the registry itself. The design-only external API example is under `openapi/` and is not an implemented route.

The registry separates internal service calls/results, external integration errors/API, committed events, scene revisions and snapshots, asset references, and context manifests. Each entry names its owner, consumer, contract status (`current-shape` or `design-only`), schema path, and example payloads. A schema file's presence does not mean its external endpoint or event publisher is implemented. The L-03 scene schemas are design-only: `lorethra.story-scene.v1` describes a complete branch-local revision and `lorethra.scene-snapshot.v1` freezes that exact payload. See [the Scene Domain Contract](../docs/contracts/SCENE_DOMAIN.md) for lifecycle, scope, provenance, and snapshot rules. Identifiers are opaque, case-sensitive strings of 1–200 characters, scoped by their workspace/branch fields; clients must not parse them or use them as filesystem paths. Timestamps are RFC 3339 UTC strings ending in `Z`. Revision values are non-negative integers. Provenance records an origin and carries applicable source, turn, provider, model, and recorded-time references. Error codes are stable uppercase machine identifiers; `request_id` is required, messages must not contain secrets, and `retryable` means the same operation may be retried under the documented idempotency rules.

## Compatibility policy

- A major version identifies a contract's wire shape. An incompatible change creates a new major version and preserves the previous contract for its supported consumers during migration.
- OpenAPI path versions use the major version (`/v1`); `info.version` records the full semantic version. Event type names remain stable while `event_version` versions each event payload.
- Within a major version, add optional fields with safe defaults only to response/event objects that are open to unknown fields; consumers must ignore those unknown fields. Closed ingress contracts such as the internal command envelope stay strict, so changing their accepted field set is breaking unless negotiated. Do not remove or rename fields, change units or meaning, tighten accepted values, or make an optional field required.
- A new required capability, changed authorization scope, changed privacy boundary, changed identifier meaning, or changed event semantics is breaking even if the JSON shape is unchanged.
- Every contract change updates the registry, schemas/OpenAPI, examples, compatibility notes, and automated validation in the same change.
- A version marked `design-only` is not implemented and must not be advertised as a live endpoint or event.

## Automatic validation

The standard `python -m unittest discover -s tests\unit -v` suite validates the registry, every JSON Schema, all registered example payloads, a negative context-manifest case, and the structural requirements on the OpenAPI design example. The `.[test]` extra includes the JSON Schema validator. No schema validation performs database writes or contacts an external service.

Generated projections are not canonical data. Contract consumers must use supported APIs and may not access SQLite directly.
