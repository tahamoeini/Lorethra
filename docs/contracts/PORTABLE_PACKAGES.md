# Portable package integrity and migration

This contract covers both reusable worlds and isolated adventures. Portable packages are duplicate-first imports, not full database backups. They never carry provider credentials or context manifests.

## World package v2

An `.lke-world` file is UTF-8 JSON using protocol `lke.world.v2`. It contains source workspace/world IDs, a contiguous ordered sequence of immutable versions, and a SHA-256 payload manifest. The manifest's adventure asset list is empty; an optional world cover is embedded in version content and is covered by the payload checksum.

Each version may contain point-buy rules, configurable game mechanics, exceptional-ability definitions, public/private author content, an optional public `opening_scene` (`situation` up to 4,000 characters and `hook` up to 2,000), and an optional local cover image. The opening scene is a first-response seed, not a decision for the protagonist. Covers accept JPEG, PNG, or WebP, are fully decoded before storage, and are limited to 64 KiB with alt text up to 300 characters. World content is limited to 100 KB per version, or 200 KB when it includes a cover; an MNO world including its preserved source and lorebook rules is limited to 1.95 MB. A complete world package is limited to 2 MB and 100 versions.

Public-world export preserves the opening scene along with the other explicitly public world fields. Imported MNO lorebook source and activation/keyword overrides are private: public-world and shareable-adventure exports omit them, while full-private export previews identify them for confirmation. The package is still untrusted input; providers receive the scene only during first-response generation and, for remote providers, only after provider-specific consent. Imported MNO lorebook references are filtered from remote-provider context.

World imports accept the exact supported v1 schema and v2. The importer validates each version's location names and starting-location reference, normalizes an optional public opening scene, validates MNO lorebook overrides against their preserved source indexes, rejects credential-like keys and unknown fields, then upcasts v1 in memory. Location names must be bounded and unique; when the map list is non-empty, its starting location must match a listed name. Legacy packages may omit map fields or retain an empty map. The importer creates a new world identity and preserves the version sequence through one audited, revision-checked, idempotent command. Replacing an existing world is not supported. Imported story text remains untrusted; inspect private notes and the preview before sharing. A world package does not restore conversations, protagonist records, adventure state, or the full database.

## Current formats

World exports use `lke.world.v2`. Adventure imports retain compatibility with `lke.adventure.v1` through `lke.adventure.v4`. Full-private adventure archives use v4 and add visual-profile history plus `image_history` (jobs, frames, candidates, and events). Adventure v3 adds visual profiles without image history. Shareable and selected-content exports are redacted and returned as v2; both omit visual profiles and image history.

- `version`: manifest schema version (`1`)
- `algorithm`: `sha256`
- `payload_sha256`: SHA-256 of the canonical JSON payload
- `assets`: sorted per-image records containing `asset_id`, `sha256`, and `size_bytes`

The payload checksum is computed from UTF-8 JSON with sorted object keys, compact separators, and non-finite numbers rejected. The root `manifest` is omitted from the hashed payload. An adventure checksum includes its nested world package and each asset's base64 data. Per-asset checksums are computed from decoded image bytes and are checked independently. A verifier must validate the package schema and each image before importing it.

World v2 content may include optional point-buy, configurable `game_mechanics`, exceptional-ability definitions, and a validated cover image. Adventure v2 and later retain optional ability activation state, skill ranks, experience, and configured-mechanics checks with pinned rules and optional `source_turn_id` provenance. Adventure v3 adds immutable branch-local visual profiles. Adventure v4 adds validated image-job and frame history, immutable candidate images with recipes/digests/parent links, and append-only job events. The v4 manifest records candidate image checksums and decoded sizes in addition to asset checksums. Import validates candidate/job/frame relationships and target scope. It does not infer absent ability costs or cooldowns.

The API caps ordinary request bodies at 11 MiB, including chunked requests without a `Content-Length` header. Adventure-package routes permit up to 66 MiB of JSON transfer for full-private v4 archives. Legacy v1–v3 adventure packages remain limited to 10,000,000 bytes after parsing; v4 packages are limited to 64 MiB. Exports preflight at most 100 image candidates and 64 MiB combined encoded image content before loading candidate BLOBs. Individual assets and candidates are validated with image-type, decode, and size limits. Backup restore has its own archive-size limit.

Adventure import validates the world-version reference, assets, visual profiles, and (for v4) image history before writing. The world, branch snapshot, adventure, profile versions, and image-history rows are imported in one database transaction. Import remaps conflicting character IDs and retains turns, reviewed state, memories, NPCs, map locations, local assets, and RPG mechanics; private context manifests are excluded. Image candidates retain their bytes and recipes but remain unattached until an explicit user action. Queued/running image work is recorded as interrupted and is not automatically resubmitted; provider job IDs are removed and imported frames cannot reconcile against the source provider.

Selected-content export of a configured mechanic check also includes the linked assistant turn and its immediately preceding player action. This preserves the check's story outcome and the action that caused it. Other turn selections remain unchanged.

These checksums detect accidental or deliberate content changes when a manifest is retained. They do not identify who created a package or prove that it came from a trusted signer.

## Migration rules

1. The importer accepts the exact `lke.world.v1` and `lke.adventure.v1` schemas as legacy inputs. It applies the current validators and upcasts in memory. Since v1 has no integrity metadata, a newly computed checksum only covers validated content at import time; it cannot prove the original archive was unchanged.
2. Current `lke.world.v2` and adventure v2–v4 inputs must contain supported manifests and matching payload checksums. Asset and v4 candidate checksums are verified against decoded bytes. Any mismatch fails preview and import before a canonical write.
3. Unknown protocol versions and unknown manifest versions are rejected. A future protocol must add an explicit, deterministic upcaster from the immediately preceding supported version, with fixtures for both successful migration and rejected malformed input. Never guess how an unknown field or version should be interpreted.
4. Migration is an in-memory validation step. It does not mutate source data, provider settings, or canonical records. Adventure world, branch snapshot, and adventure records continue to import through one database transaction.

## Compatibility acceptance

Package tests cover legacy package migration, v4 image-history round trips, candidate and asset tampering, private-data redaction, interrupted-job import safety, and rejection before destination writes. Browser file selection, hostile-file rejection, world covers, current-source restore, and cross-device recovery still require additional acceptance evidence.
