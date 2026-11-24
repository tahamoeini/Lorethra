# Lorethra Main Story Studio — Domain Architecture

**Decision record:** MSA-001  
**Status:** Accepted as the target boundary for incremental implementation  
**Date:** 2026-11-24  
**Scope:** L-01 architecture boundaries and write ownership. This record does not authorize a broad refactor or define the detailed scene schema/API; those belong to later MUCs.

## Context

Lorethra is already a Windows-first, local-first modular monolith: React and TypeScript run in Tauri 2, a Python FastAPI sidecar adapts the application to HTTP, and SQLite is canonical. The current code has useful domain behavior, but its boundaries are uneven: `core/commands.py`, `api/app.py`, and `frontend/src/App.tsx` contain large areas of mixed orchestration and behavior. Existing services also include retrieval/context, providers, mechanics, rules, imports, backup, and image jobs.

The current implementation has no first-class scene record or scene lifecycle. Story turns, turn edits, sourced memory proposals, and assets targeted at a turn exist; they do not replace a canonical scene and immutable scene-snapshot domain. The local `/api/v1` API is not the external integration gateway described by the product vision. The current contract inventory and exact gaps are recorded in the [L-00 baseline](../audits/2026-11-24-main-story-studio-baseline.md).

## Decisions

### 1. Keep one modular monolith

Keep one desktop product, one sidecar process, one command gateway, and one canonical SQLite database. Enforce boundaries with application-service ownership, narrow ports, command contracts, and tests. Folder names alone do not establish ownership. Add no microservices, service-specific databases, broker, or distributed deployment machinery without concrete operating evidence that the local product cannot meet.

### 2. SQLite and the command gateway remain authoritative

SQLite remains the only canonical store. Every canonical mutation must pass through a named application command that checks workspace and branch scope, actor permissions, expected revision, input validity, and idempotency as applicable. The record change, revision, audit event, and existing transactional projection-outbox entry commit atomically. UI code, HTTP adapters, importers, AI providers, and external clients cannot write canonical tables directly.

Accepted records, rejected proposals, pending proposals, and user-authored history are all durable records, but they have different authority. A pending proposal is not accepted story state. A saved narrative turn records what was said; it does not automatically establish a world fact.

### 3. Separate identity from story-specific state

Use the existing `entities` identity, scoped to its workspace and branch snapshot, as the shared reference for protagonists, reusable characters, NPCs, locations, factions, and other authored subjects. Character-specific and NPC-specific services own their typed profiles and lifecycle while referencing that identity. Adventure RPG sheets, relationships, current location, scene participation, and other play state remain scoped to the adventure branch. A character's visual profile remains distinct from semantic identity and scene state.

Do not create a second character or NPC identity registry. If a future reusable-character requirement cannot fit the shared identity and typed profile contracts, document that gap with migration and reference evidence before proposing another identity store.

### 4. Add scenes as a first-class domain through the gateway

The Scene domain will own authored scene definitions, their ordered interactions and participants, progression decisions, and immutable scene snapshots. Scene records will reference existing world, adventure, branch, and entity identities; they will not duplicate those records. A completed snapshot must retain the exact scene revision and the relevant participant/location/interaction state needed to reconstruct what was presented.

Detailed scene lifecycle, ordering, revision semantics, and snapshot fields remain open for L-03. L-01 creates no tables or commands. When implemented, scene writes use the existing gateway and branch/revision rules. Existing turns and turn-targeted assets remain readable and retain their existing behavior during migration; they are not silently rewritten as scenes.

### 5. Keep narrative, memory, NPC, and context authority separate

- **Narrative** owns conversation turns, edits, and generation provenance. Providers return prose or structured proposals; they do not save facts or choose user-controlled protagonist actions.
- **Memory** owns durable, source-linked story memories and open threads, including review state, knowledge scope, actor awareness, time/order, and correction history. Semantic extraction and generated summaries remain proposals or projections until the relevant review command accepts a canonical record.
- **NPC Management** owns NPC-specific profile data and story-cast association while using shared entity identity. **NPC Simulation** may produce bounded, reviewable proposals; it cannot apply off-screen changes directly to canon. Scheduled work remains local and opt-in; no autonomous scheduler is implied by this architecture record.
- **Context** is a read-only policy and selection service. It applies workspace, branch, actor, review, visibility, and temporal rules before ranking or summarizing. A persisted per-turn context manifest is provenance for that turn; a fresh ranking, summary, or embedding is a rebuildable projection, not another memory store.

### 6. Keep references and assets under explicit asset ownership

The Asset and Reference domain owns uploaded reference bytes, metadata, digest, provenance, scope, visual-profile versions, image jobs, and immutable candidates. A generated candidate is not an active portrait or scene reference until a user applies the validated attachment command. Current SQLite asset and candidate storage remains authoritative. Thumbnails, embeddings, contact sheets, and search indexes are projections. Do not move bytes to another store solely for theoretical scale.

### 7. Separate the local desktop API from the external integration API

The existing FastAPI adapter remains a loopback-only desktop boundary using its per-run bearer token. Do not expose that token or the internal desktop API to other platforms.

The Integration Gateway will be a separate adapter over the same application services and validated commands. “Public API” means a documented, versioned, supported contract; it does not mean public internet exposure. External access remains disabled by default. Integration authentication, grants, revocation, and audit are separate from provider-consent settings and desktop process credentials. No integration receives SQLite paths, SQL access, internal table shapes, or unscoped assets. Private author notes are denied by default; any future sharing requires an explicit, field-level user grant. Read and write scopes are explicit, workspace-bound, and checked before the service returns or changes data. Exact authentication and resource contracts are deferred to L-22 through L-27.

### 8. Derive events from committed changes

Integration events describe already committed command/revision outcomes; they are not an alternate story log. Delivery must be recorded transactionally with the originating change and handled asynchronously by the local application. Failed delivery cannot roll back a committed story mutation. The existing `projection_outbox` is documented for projection work; do not silently reuse it for webhook delivery until L-26 establishes that its semantics are sufficient. No message broker is introduced.

## Domain responsibility and write-ownership matrix

| Domain | Owns canonical records and allowed writes | Reads and boundaries | Existing foundation and evolution |
|---|---|---|---|
| Workspace and Canonical Core | Workspace, branch, revision, command/idempotency, audit, and transactional commit metadata. Owns transaction integrity and the shared entity identity service. | Enforces workspace/branch/actor scope for every domain; owns no story-specific interpretation. | `core/database.py`, `core/commands.py`, shared tables and gateway. Retain; extract internal handlers only behind the same gateway contracts. |
| World Management and World Architect | World identity, immutable world versions, authored setting content, world locations/rules, and accepted world revisions. Architect output is a draft until the user applies and saves it. | Characters, adventures, scenes, and NPC cast may reference a pinned world version; no module edits a prior version. | `story_worlds`, `story_world_versions`, world commands/routes, `storyCreation.ts`, and local Ollama drafting in `api/app.py`. Retain and clarify world-owned fields in L-02. |
| Character Management and Character Architect | Character profile/creation data that references a shared entity; accepted reusable character revisions. Architect output remains a proposal. Adventure sheet and scene-specific state are not character identity. | World creation rules are pinned by the selected world version; adventure state is scoped to a branch. Visual guidance is owned by Visual Identity. | Shared `entities`, world-pinned point-buy setup, adventure `rpg_sheets`, and UI in `App.tsx`/`storyCreation.ts`. Extend without a duplicate character identity table. |
| Adventure Management | Adventure identity, pinned world version, branch snapshot, protagonist association, library status, and archive lifecycle. | References world and character identities. Branch creation/promotion remains explicit, revision-checked, and isolated. | `story_adventures`, branch records, gateway/API routes, `story_libraries` tests, and Story Studio UI. Retain. |
| Scene Management and Scene Architect | New first-class scene definitions, participant/interaction references, progression revisions, and immutable scene snapshots. Draft output is non-canonical until reviewed and saved. | References existing adventure branches, world versions, entities, locations, and memories; cannot mutate those domains outside their commands. | No first-class runtime implementation found at baseline. L-03 now defines semantics in [the Scene Domain Contract](../contracts/SCENE_DOMAIN.md); persistence is L-04, commands L-05, participant/interaction workflow L-06, snapshots L-07, and UI/architect L-08/L-09. |
| Narrative Engine | Conversation turns, turn order, edit history, provider/model provenance, and source links for generated proposals. | Reads a revision-bound context manifest and pinned rules. Cannot turn prose into canon, roll mechanics, or control the protagonist. | `story_turns`, turn edit history, `api/app.py`, provider adapters, and story UI. Retain; keep providers behind a prose/proposal port. |
| Memory Engine | Reviewed story-memory versions, open threads, source-turn links, actor scope, awareness order, and corrections/supersession. | Uses shared entity IDs and branch scope. Access eligibility is decided before retrieval ranking. | `story_memories`, `story_threads`, `retrieval/story_memory.py`, and memory commands/tests. Extend lifecycle and historical correction in L-17/L-18. |
| NPC Management and Simulation | NPC cast association and typed profile revisions; accepted NPC changes and reviewed simulation outcomes. A simulator may submit proposals only. | Uses shared entity identities. NPC knowledge remains separate from protagonist knowledge unless explicitly shared and reviewed. | `story_npc_profiles`, profile/simulation commands and prompt logic in `api/app.py`; tests in continuity and package suites. Retain behavior; extract a bounded service incrementally. |
| Context Engine | No independent narrative facts. Stores the exact manifest as turn provenance when a turn commits; otherwise performs read-only selection. | Filters scope, permissions, review state, visibility, and time before ranking. Provides only authorized content to providers or integrations. | `retrieval/context.py`, `retrieval/story_memory.py`, `CONTEXT_PROTOCOL.md`, API generation path. Retain and extend rather than creating another memory database. |
| Visual Identity, Reference Studio, and Asset Management | Asset bytes/metadata/provenance, visual-profile versions, image-job/frame state, immutable candidates, and explicit attachment records. | Asset references must be scoped and authorized; candidate generation never implies attachment. | `story_assets`, `story_visual_profiles`, image tables, `story_images.py`, `storyImages.tsx`. Retain current SQLite storage and local ComfyUI adapter. |
| Integration Gateway | Future integration-client identity/grants/revocation, scoped operations, request audit, event subscriptions, and delivery state. External writes call the same domain commands. | Exposes DTOs from authorized application-service reads; never exposes SQL, SQLite, internal table shape, or desktop bearer tokens. | No dedicated integration service exists. Add only after L-22 architecture and L-23 authorization contracts; route-specific operations follow L-24/L-25. |
| Event and Webhook Delivery | Future durable delivery intent and attempt history tied to committed revisions; no duplicate canon. | Delivers only explicitly allowed event payloads and reports failure without changing source records. | Existing transactional `projection_outbox` is for projections. Define event vocabulary, ordering, retries, idempotency, and privacy in L-26 before implementation. |

## Canonical data and projections

| Data | Authority |
|---|---|
| SQLite records, immutable world versions, branch snapshots, turns and edits, reviewed memories/NPC updates, assets, proposals, audit/revisions | Canonical records. Mutations use the command gateway and applicable review rules. |
| Pending or rejected generated proposals | Durable workflow records, not accepted narrative state. |
| Turn context manifest | Immutable provenance of what a specific turn used; not a new source for current facts. |
| FTS, graph/search views, semantic vectors, ranked context, summaries, thumbnails, and API response DTOs | Derived projections. Rebuildable and never authoritative over their source rows. |
| Provider response, architect draft, imported package, webhook payload | Untrusted input or transport representation until validated and, where required, explicitly reviewed. |

No domain may maintain a parallel writable copy of another domain's canon. Cross-domain links use stable IDs and version/revision references. Rebuilds must not increment canonical revisions or erase provenance.

## Module map and incremental extraction

| Current module | Decision |
|---|---|
| `backend/lke/core/database.py`, `core/commands.py`, `core/errors.py` | Retain as canonical persistence, transaction, validation, and command façade. The gateway remains the only canonical write boundary. Extract domain handlers gradually while preserving command contracts and atomic revision/audit/outbox behavior. |
| `backend/lke/api/app.py` | Retain as the local HTTP composition root during migration. Move route groups behind routers/application services only when one bounded workflow is ready; keep loopback/auth checks at the adapter. |
| `backend/lke/retrieval/context.py`, `retrieval/story_memory.py` | Retain as the read-only context and memory-selection foundation; preserve manifests and eligibility-before-ranking behavior. |
| `backend/lke/ai/providers.py`, `ai/ollama.py`, `ai/story_mechanics.py`, `reasoning/rules.py` | Retain as replaceable provider/mechanics adapters. Providers never own canon or command authorization. |
| `backend/lke/story_images.py`, `importers/mno.py`, `ops/backup.py`, `extraction.py` | Retain image-job, import, recovery, and extraction behavior; have each call validated services/commands rather than direct canonical writes. |
| `frontend/src/App.tsx`, feature modules, and Tauri shell | Keep current user paths intact. Continue extracting workflow components from the current UI without changing stored meaning or making setup requirements longer. Tauri remains a client, not a data owner. |
| New logical application modules | Establish `worlds`, `characters`, `adventures`, `scenes`, `narrative`, `memory`, `npc`, `assets`, `integrations`, and `events` as explicit ownership boundaries. Reuse existing modules where they already fulfill that role; create a physical module only with its first complete behavior, contract, and tests. No empty package shells are required by this ADR. |

The modular boundary is enforced by one writer per canonical record family, explicit service inputs/outputs, no cross-domain SQL writes, and contract tests for scope, stale revisions, idempotency, review, and failure recovery. This record does not prescribe splitting files solely by size.

## Rejected alternatives

| Alternative | Decision |
|---|---|
| Rewrite the product into microservices or introduce a broker/separate databases | Rejected: adds operational and recovery complexity without evidence that a single-user local application needs it. |
| Let the React UI, provider, importer, or external client write SQLite directly | Rejected: bypasses validation, scope checks, revisions, review, audit, and idempotency. |
| Create a second character/NPC/world store alongside current canonical records | Rejected: duplicates identity and creates competing truth. Add typed profiles that reference stable IDs. |
| Treat transcript turns, generated prose, summaries, or model-extracted facts as scenes or canon automatically | Rejected: loses scene lifecycle/snapshot semantics and violates review/authority boundaries. |
| Expose the desktop loopback API or its per-run token to third-party platforms | Rejected: crosses trust boundaries and couples integrations to internal routes. |
| Build Lorethra 3D-specific routes or schemas into the core | Rejected: locks canonical ownership to one client. Lorethra 3D must use the same versioned integration contracts as other clients. |
| Replace the existing command gateway or storage architecture during domain extraction | Rejected: would risk established isolation, history, backup, and package behavior without demonstrated need. |

## Deferred contracts and sequencing

1. **L-02:** establish versioned schema/data/command contract governance against the actual schema v20 source; completed in the contract registry.
2. **L-03:** define scene semantics, lifecycle, time/order, authorship, and immutable snapshot content before any migration; completed in the linked design-only contract.
3. **L-04–L-09:** persist, command, test, and expose the scene workflow incrementally through existing SQLite and gateway boundaries.
4. **L-22–L-27:** define integration trust, client scopes, supported read/context operations, event delivery, and contract tests/sample client. No third-party integration credentials are enabled by L-01.

The existing world/adventure APIs, provider consent, local packages, backup/restore, knowledge, journal, scenario, and current UI remain in service throughout these slices. Any proposed behavior change must include compatibility and recovery impact in its MUC handoff.

## Acceptance review

- Domain responsibilities and canonical write owners are explicit in the matrix above.
- Current modules and their retain/extend/extract decisions are mapped.
- New logical modules are identified without creating empty scaffolding.
- Canonical records, proposals, manifests, and rebuildable projections are distinguished.
- No duplicate identity, story, memory, or asset source of truth is proposed.
- Rejected alternatives and their reasons are recorded.
- Detailed scene semantics and the versioned scene contracts are defined in L-03; persistence and runtime behavior remain assigned to later MUCs. Integration authentication remains deferred to L-22 through L-27.
