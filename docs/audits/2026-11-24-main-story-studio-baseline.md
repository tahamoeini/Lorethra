# Lorethra Main Story Studio Baseline — L-00

**Audit date:** 2026-11-24  
**Scope:** Repository and development-readiness baseline only. No product code changed.  
**Source of requested scope:** `LORETHRA — MAIN STORY STUDIO.md`, L-00.

## Repository and environment

| Check | Observation |
|---|---|
| Branch | `codex/lorethra-platform-refinement` |
| HEAD | `7a21689401be0fa81385384bb830444daa4c21a3` — `fix(story): surface history details on mobile` (2026-11-07) |
| Remote relationship | 8 commits ahead of `origin/codex/lorethra-platform-refinement` at audit time |
| Working tree | No tracked changes. One pre-existing untracked `.tmp/` tree contains prior audit artifacts; preserved. |
| Supported schema | v20 (`SCHEMA_VERSION` in `backend/lke/core/database.py`); migrations 1–20 are applied sequentially. The on-disk databases under `.tmp/` were not opened. |
| Runtime | Node v26.13.0 and npm 12.2.1. System Python is 3.13.16. The repository `.venv` launcher could not be started; its `pyvenv.cfg` points to a Microsoft Store Python 3.13.14 installation that is unavailable here. |

No user story data or database contents were read. The existing `.tmp/` names were inspected only to record the dirty state and avoid overwriting it. All new build and temporary-test output was placed in uniquely named `l00-*` subdirectories and then removed.

## Baseline checks

- **Frontend:** `npm run build -- --outDir F:/Projects/Lorethra/.tmp/l00-build-20261124` passed TypeScript checking and Vite production bundling. The generated JavaScript is 561.44 kB, above Vite's 500 kB advisory threshold. Output stayed outside the normal `dist` directory.
- **Backend:** The system Python could import the already-present local FastAPI, httpx, and Pillow packages when `.venv/Lib/site-packages` was added to `PYTHONPATH`; no package installation was performed. A verbose unit-suite run passed `test_adventure_bundle_import_rolls_back_every_stage_and_replays_after_commit`, then remained in `test_api_round_trip_preserves_adventure_and_excludes_private_manifests` for about 40 seconds without returning. The run was interrupted; no full-suite pass or test failure was established. This alternate Python/dependency path is not the repository venv.
- **Historical evidence only:** `docs/ACCEPTANCE_MATRIX.md` records 224 backend tests passing at source `3a39ca4` and an earlier frontend build at `6211008`. Those results predate this HEAD and do not close current baseline validation.

## Implemented source and test map

| Capability | Current source | Relevant test coverage |
|---|---|---|
| SQLite schema, workspaces, branches, revisions, audit and command gateway | `backend/lke/core/database.py`; `backend/lke/core/commands.py` | `test_database_migrations.py`; `test_command_gateway.py`; `test_branch_promotion.py` |
| World versions, adventure libraries, character sheets and packages | `backend/lke/core/commands.py`; `backend/lke/api/app.py`; `frontend/src/App.tsx`; `frontend/src/storyCreation.ts` | `test_story_libraries.py`; `test_story_character_creation.py`; `test_world_packages.py`; `test_adventure_packages.py`; `test_mno_import.py` |
| Story turns, edits, history and continuity | `backend/lke/core/commands.py`; `backend/lke/api/app.py`; `frontend/src/App.tsx` | `test_story_continuity.py`; `test_api_boundary.py` |
| Memories, actor/time-aware retrieval and context | `backend/lke/retrieval/story_memory.py`; `backend/lke/retrieval/context.py` | `test_story_memory_retrieval.py`; `test_story_continuity.py` |
| NPC profiles and bounded, review-gated simulation | `backend/lke/core/commands.py`; `backend/lke/api/app.py`; `frontend/src/App.tsx` | `test_story_continuity.py`; `test_adventure_packages.py` |
| Images, assets, visual profiles and local ComfyUI jobs | `backend/lke/story_images.py`; `frontend/src/storyImages.tsx`; `backend/lke/core/commands.py` | `test_story_images.py`; `test_story_continuity.py`; `test_adventure_packages.py`; `test_backup_restore.py` |
| Providers and deterministic mechanics | `backend/lke/ai/providers.py`; `backend/lke/ai/ollama.py`; `backend/lke/ai/story_mechanics.py` | `test_story_providers.py`; `test_ollama.py`; `test_story_mechanics.py`; `test_story_rpg.py` |
| Knowledge, extraction, journal, rules, scenarios and recovery | `backend/lke/core/commands.py`; `backend/lke/api/app.py`; `backend/lke/ops/backup.py` | `test_extraction_workflow.py`; `test_exchange_workflow.py`; `test_scenario_engine.py`; `test_rule_evaluator.py`; `test_backup_restore.py` |
| Desktop and frontend | `apps/desktop/src-tauri/`; `frontend/src/App.tsx` and adjacent feature modules | Frontend type/build checks; scripted browser evidence is dated and recorded in `docs/ACCEPTANCE_MATRIX.md` |

The canonical write path remains command-gateway-owned. SQLite is canonical; FTS and retrieval/context outputs are derived. Provider output and generated narrative do not directly commit canon. These are source-level findings; the interrupted suite does not establish current runtime acceptance.

## API inventory

`backend/lke/api/app.py` declares **67 application routes**. The families below account for all declared routes; FastAPI's framework-generated documentation routes are not included.

| Route family | Count | Coverage |
|---|---:|---|
| Health | 1 | Contract/version health |
| Backup and projection rebuild | 3 | Backup download/restore and search rebuild |
| Provider discovery | 4 | Story/image provider status and model discovery |
| Workspace library | 2 | Workspace create/list |
| Story worlds | 9 | World library, draft, version writes and package/MNO preview |
| Story adventures, memories and media | 26 | Adventure lifecycle/setup, history, RPG, memories, visual assets, image jobs and candidates |
| Branches | 2 | Branch create/list |
| Knowledge and conversations | 6 | Entities, relations, claims, conversations and exchanges |
| Story generation | 2 | Generate/retry |
| Context and temporal query | 2 | Context compilation and character memory query |
| Sources and extraction | 3 | Source list/read and extraction |
| Journal, rules, scenarios, revisions and commands | 7 | Read models and the validated command endpoint |

The API binds to loopback, rejects non-loopback peers, and requires a bearer token on data routes except health (`backend/lke/api/app.py`). It is the current desktop/local API. The inspected routes and contracts do not define scoped third-party integration clients, integration-specific authorization/lifecycle, public event delivery, or webhook subscriptions. Existing contracts include `DATA_MODEL.md`, `COMMAND_CONTRACTS.md`, `CONTEXT_PROTOCOL.md`, `EXCHANGE_PROTOCOL.md`, `PORTABLE_PACKAGES.md`, `MNO_IMPORT.md`, `NARRATIVE_RULES.md`, and `AI_PROVIDER_SPEC.md`.

## Confirmed gaps against the Main Story Studio vision

- **First-class scenes:** source search found no scene table, scene ID/domain command, participant/interaction model, scene lifecycle, or immutable scene snapshot endpoint. Story turns and their revision history exist, and assets may target a turn as a scene; these do not provide the requested scene domain. The prompt book's L-03 through L-09 address this gap.
- **World and character depth:** immutable worlds, locations/travel, protagonists, adventure-specific sheets, NPC profiles, and authoring helpers exist. Map authoring and scale semantics, complete reusable-character/character-architect workflows, political/faction, military, settlement/economy, inventory and quest systems remain partial or open in `docs/PROJECT_STATUS.md`.
- **NPC and continuity depth:** bounded NPC proposals and reviewed memories exist. A general elapsed-time scheduler, complete actor-scoped NPC knowledge, semantic memory correction/supersession, and broad historical reconstruction remain open or partial.
- **Visual references:** local ComfyUI jobs, candidate history, visual profiles and explicit attachment exist. Reference-conditioned generation and broader reference/derivative workflows remain open; live provider behavior is unverified.
- **External integrations:** the local `/api/v1` API and exchange/package contracts are present, but the prompt's reusable integration gateway, scoped authorization, stable public read API for external clients, event delivery/webhooks and sample-client contract tests are not present as a complete subsystem.
- **Modularity:** current source sizes are 18,579 lines in `frontend/src/App.tsx`, 8,667 in `backend/lke/core/commands.py`, and 1,845 in `backend/lke/api/app.py`. The status backlog already identifies modularization as open; this is evidence for incremental domain boundaries, not justification for a rewrite.
- **Release evidence:** clean-machine Windows installation/launch, live providers, broad browser/accessibility acceptance, and separate-destination recovery remain open or partial in the current acceptance matrix. Do not infer release readiness from the frontend build or older CI results.

## Recommended continuation

Proceed with **L-01 — Product Architecture and Domain Boundaries**, the next MUC in the supplied order and the direct dependency of L-02. Define the domain responsibility/write-ownership matrix for scenes, characters, NPCs, context, references/assets and integrations using the current modular monolith. Keep this as an architecture/documentation slice; it does not justify replacing current working subsystems. Then continue L-02 and L-03 in the order and dependency boundaries specified in the prompt book.

## Audit status

**L-00: PARTIAL.** Source, schema, API, and frontend baseline are recorded; the current backend suite did not complete in the available Python environment. No product files or database contents were changed/read. Re-run the backend suite under the repository's supported Python 3.12+ environment before treating the test baseline as verified.
