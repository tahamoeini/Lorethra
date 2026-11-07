# Lorethra platform refinement plan

- **Status:** active implementation plan; not a release approval
- **Revised:** 2026-11-07
- **Implementation branch:** codex/lorethra-platform-refinement

## Refined goal

Make Lorethra feel like a story-first, local-first studio. A new player should be able to start a short **World → Hero → Review** flow; a returning player should be able to resume the right adventure without searching through administration. During play, the transcript and next-action composer should lead, with essential state and pending reviews close by. Character, continuity, map, mechanics, history, and advanced tools should remain easy to find through a small set of plain-language destinations. Character and scene art should start from the story element the player selected, show supported options only, and leave generated work as a reviewable candidate until the player keeps it.

Keep Lorethra’s complete capability set, local-first behavior, and data rules. SQLite remains canonical. Every write uses the validated command gateway with workspace, branch, revision, idempotency, review, provenance, and recovery checks intact. The redesign changes how people reach and understand tools; it does not weaken their contracts.

## Evidence and reference review

The MNO and Bestaigen trees were reviewed at source level. Neither reference runtime was executed for this pass. The MNO README documents its shell and engine; Bestaigen’s downloaded tree has no `index.html` or `src/Designbook.enc`, so its complete navigation and visual system could not be audited. Its README is primarily a boot/handoff document that points to encrypted project books. The findings below distinguish source facts from design recommendations.

### MNO: useful storytelling patterns and limits

- Its stated principles place player agency and persistence ahead of authoring complexity. Its play loop separates a player action, narrator response, tracked state, checks, memory work, and location changes. Turn controls retain edit, reroll, deletion, and stop behavior (`other platforms/mnoengine-src/README.md`, §§1, 6.1, 6.3–6.5, 6.13).
- The conversation shell gives the transcript a central region, surrounds it with collapsible tool rails, and keeps a composer available. The README describes loading recent turns first, an explicit load-earlier control, a jump-to-latest affordance, and mobile keyboard/visual-viewport handling (§6.10). These are useful continuity and reading-position patterns; they are not evidence that the downloaded app is easy to use.
- The context inspector measures the same `RPEngine` call builders used for play and attributes the prompt to sections (`scripts/context-budget.js`, `measureContextBudget` and `renderContextTab`). Lorethra should keep its preview and outbound request on one assembly path and clearly distinguish measured provider tokens from estimates.
- MNO’s world premise, character sheet, lore, situation, threads, memories, NPCs, and recent events provide a helpful context hierarchy. Its memory selector combines relevance with owner and scene gates (`scripts/memory-system.js`, `memoriesForTurn`). However, the source also contains an experimental “topical-open” tier explicitly selected without an owner gate; its comments acknowledge that private knowledge can surface when its owner is absent. Lorethra must not copy that exception. Scope, actor knowledge, time, branch, revision, visibility, and review eligibility must filter candidates before ranking.
- NPC off-screen work is cadence-driven and bounded (`scripts/npc-life.js`, `NPC_LIFE_EVERY_TURNS`, `NPC_LIFE_MAX_PER_TICK`). The useful pattern is limited background preparation. Lorethra should retain explicit review and must never let an NPC or model accept its own proposal or advance the player’s action.
- Scene references are limited to four and only attached for provider/model combinations that support them (`scripts/scene-refs.js`). Lorethra should make capability and consent explicit rather than silently sending character assets.
- MNO also includes publishing, community discovery, moderation, and server-hosted identity. These are outside Lorethra’s current local-first boundary. Its browser key/value persistence and random check implementation (`scripts/stats.js`) do not replace Lorethra’s SQLite gateway or world-pinned deterministic mechanics.

### Bestaigen: useful visual-creation patterns and limits

- Character Lock reuses the typed description and a saved seed (`JS/dragon-character-lock.js`). That can make a prompt more consistent, but the code does not itself guarantee the same identity across models, poses, or workflows. Lorethra should call this best-effort consistency, store an explicit visual profile, and use actual image references only when a selected provider supports them.
- Studio lookbooks create a pose/outfit matrix with one seed (`JS/dragon-studio.js`, `buildPlan`). The implementation launches all frames in parallel and records per-frame progress; after reload it tries to match completed frames back from image history. This shows the value of a contact sheet and recoverable frame identity. Lorethra should use a bounded queue, expose each frame’s state, preserve successful outputs, and require an explicit retry for uncertain interrupted work.
- Image history retains prompt/seed information and full-image bytes with configurable limits and deletion cleanup (`JS/dragon-gen-history.js`, `persistHist`, `histPurgeBlobs`, `dragonHistApplyLimits`). The source notes and fixes a prior deletion path that could resurrect images. Lorethra should preserve immutable recipes, outputs, derivatives, and provenance in SQLite, with deletion and restore covered by gateway tests.
- Style comparison uses a shared prompt and offers the same seed for a fair comparison (`JS/dragon-art-styles.js`). Prompt queue entries are editable and bounded at ten, while queued work can fan out across image counts and parallel generation (`JS/dragon-prompt-queue.js`). Lorethra should retain side-by-side comparison, prompt reuse, and clear batch confirmation while keeping the default to one result and capping advanced work before submission.
- Bestaigen exposes a broad set of dynamic panels, prompt helpers, lookbooks, style tools, result cards, and history. This makes many capabilities available, but the absent application entrypoint prevents a complete hierarchy or runtime usability assessment. Lorethra should take the capability ideas, then group them around **Create → Compare → Keep → History** so advanced controls do not compete with the story or appear operational when unsupported.

### Source anchors and evidence limits

| Reference source | Observed implementation | Product implication |
|---|---|---|
| [MNO vision and play loop](<../other platforms/mnoengine-src/README.md#L43>) and [play commands](<../other platforms/mnoengine-src/README.md#L453>) | Agency, persistent actions, and turn-level commands are stated as design principles. | Keep authoring setup short; make turn actions understandable and reversible. |
| [MNO UI rails](<../other platforms/mnoengine-src/README.md#L1221>) and [viewport handling](<../other platforms/mnoengine-src/README.md#L1282>) | Central conversation, tool rails, recent-turn loading, load-earlier/jump-latest, and visual viewport behavior are described. | Preserve reading position and provide explicit history navigation; do not assume its undocumented runtime is easy to use. |
| [MNO context budget](<../other platforms/mnoengine-src/scripts/context-budget.js#L387>) | Preview uses the same engine call construction path and renders section-level context output. | Lorethra preview and outbound payload should share assembly; label provider-measured token counts separately from estimates. |
| [MNO memory selection comments](<../other platforms/mnoengine-src/scripts/memory-system.js#L338>) | An experimental topical-open tier intentionally omits owner gating. | Do not copy it; filter by scope and knowledge permissions before ranking relevance. |
| [MNO NPC cadence](<../other platforms/mnoengine-src/scripts/npc-life.js#L43>) and [per-tick bound](<../other platforms/mnoengine-src/scripts/npc-life.js#L48>) | Off-screen NPC preparation is limited by turn cadence and maximum work per tick. | Keep background work bounded, player-independent, and review-only in Lorethra. |
| [MNO scene references](<../other platforms/mnoengine-src/scripts/scene-refs.js#L16>) and [random check path](<../other platforms/mnoengine-src/scripts/stats.js#L166>) | References are capped; the basic die helper can fall back to Math.random. | Check provider support and consent; retain Lorethra’s canonical deterministic mechanics. |
| [Bestaigen character lock](<../other platforms/bestaigen-src/JS/dragon-character-lock.js#L12>) | A description and seed persist in localStorage and are appended to prompts. | Store visual identity in versioned SQLite profiles; call consistency best effort, not guaranteed. |
| [Bestaigen studio fan-out](<../other platforms/bestaigen-src/JS/dragon-studio.js#L237>) and [history recovery](<../other platforms/bestaigen-src/JS/dragon-studio.js#L340>) | Lookbook frames launch in parallel and recovery attempts to match completed images from history. | Keep per-frame identity and recovery but use bounded concurrency, explicit retry, and immutable results. |
| [Bestaigen history cleanup](<../other platforms/bestaigen-src/JS/dragon-gen-history.js#L180>) and [limits](<../other platforms/bestaigen-src/JS/dragon-gen-history.js#L201>) | Metadata and image blobs have separate storage and limit/purge paths; comments document a deletion-resurrection bug. | Keep bytes, metadata, deletion, restore, and provenance under one validated canonical storage contract. |
| [Bestaigen prompt queue](<../other platforms/bestaigen-src/JS/dragon-prompt-queue.js#L5>) and [parallel submit path](<../other platforms/bestaigen-src/JS/dragon-prompt-queue.js#L142>) | Prompt lines are capped, but generation fan-out is parallel and a high output count requires confirmation. | Confirm frame counts; keep ordinary jobs small and advanced lookbooks bounded by the local queue. |
| [Bestaigen style comparison](<../other platforms/bestaigen-src/JS/dragon-art-styles.js#L119>) | A shared seed is offered to compare styles fairly. | Retain comparable prompts/settings and disclose when the adapter cannot honor a seed. |

These are source-level observations, not usability findings. MNO and Bestaigen were not launched in this review. Bestaigen’s tree lacks an application entrypoint and the encrypted Designbook named by its README, so claims about its complete navigation, onboarding, and overall layout are intentionally withheld. Neither source is treated as authority for Lorethra’s privacy, mechanics, persistence, or consent rules.

### Current Lorethra evidence

Lorethra already has a three-step setup, a resume action, an active-story transcript, a next-action field, a review cue, a story-history action, a collapsed Worlds & adventures area, and one adventure details area. Current active-play setup reports that no narrator model is selected and disables **Continue story**; the browser journey therefore verifies navigation and saved content, not live narration. The rendered browser also showed the previous composer/transcript overlap and excessive mobile navigation height. The 2026-11-07 CSS slice fixes the desktop overlap and compacts active-play navigation on narrow screens; full cross-product hierarchy and real-user acceptance remain open.

## Target journeys and information architecture

### 1. Start or resume

Make **Continue adventure**, **Start adventure**, and **Import** the first choices. Recent adventures show a recognizable world, hero, location/progress, and last activity. Resume returns to the same branch and conversation. Search, filters, lifecycle actions, world editing, and archive settings stay available behind clear labels without displacing those three choices.

For a new adventure, keep the guided path to:

1. **World:** pick an existing world, a starter, or an import; mark optional authoring as optional.
2. **Hero:** choose or create a reusable character; keep reusable identity separate from the adventure’s snapshot.
3. **Review:** confirm world version, hero, opening situation, mechanics, and consequential provider choice.

Back preserves the draft. Missing provider/model setup explains the next step. Starting and editing a world or hero do not require image generation.

### 2. Play and resume

Use three visual levels: a compact adventure/status line, a central reading transcript, and a composer close to the end of the story. Keep the local-save state, hero/location/resources, generation state, and pending-review count visible without turning them into a dashboard. Keep the composer draft independent from transcript rendering. Errors preserve the draft and offer a clear retry or recovery action. Do not move the reader away from earlier turns when a new turn arrives; provide an explicit return-to-latest control.

Keep a single contextual details destination with direct sections such as **Hero & mechanics**, **Memories**, **NPCs**, **Map**, **Story history**, and **More tools**. The pending-review action opens the exact item, places focus there, and returns focus to its opener when closed. History retains earlier versions, hidden turns, turn details, provenance, and existing edit/hide/reroll/delete/retry actions; review remains safe and read-only until the player chooses an action.

### 3. Understand and manage continuity

Use the same context builder for preview and generation. Show what will be included, why it qualifies, what was excluded, source identifiers/revisions, and whether the provider count is measured or estimated. Keep required world constraints and approved state protected under budget pressure. Filter by scope, actor, time, revision, branch, visibility, provider policy, and review state before retrieval ranking.

Use bilingual lexical retrieval first and evaluate it with a judged English/Persian/mixed corpus. Optional local semantic retrieval remains behind the same eligibility filters and a replaceable adapter. Memory consolidation and NPC activity run only after durable turns, in bounded work windows, and produce source-linked proposals. Corrections supersede prior projections while preserving accepted history and contradictory evidence. No significance score or semantic match may grant access.

Keep deterministic checks and XP calculations authoritative in Lorethra’s gateway. Models may propose a check intent or narrative outcome only within pinned world rules. Show the player a concise result and let them inspect calculation and provenance. Do not infer costs, cooldowns, or ability limits.

### 4. Create character and scene art

Start from the selected hero, NPC, or saved story scene. Keep appearance guidance separate from story identity. The short path is:

**Choose subject → Appearance and style → Generate or upload → Compare → Keep or attach**

Default to one image. Show only parameters supported by the selected workflow. A completed generation creates a candidate; the image does not become the current portrait or scene until the player explicitly keeps or attaches it. Scene prompts use the chosen turn, reviewed cast, relevant appearance profiles, and permitted location details—not private thoughts, hidden turns, or a full story context manifest.

Put lookbooks, style comparison, prompt mixing, variations, image description, enhancement, and upscaling in named advanced sections. Each action states what it does and whether the selected adapter supports it. Regeneration and upscaling create linked derivatives; they never erase the original.

### 5. Find advanced and maintenance actions

Use task names and separate areas for libraries, import/export, providers, backup/restore, and maintenance. Avoid long pages and nested accordions as the default way to discover controls. Preserve all existing tools and data; progressive disclosure should hide detail, not the existence of an action or its consequences.

The 2026-11-07 responsive browser replay is recorded in [the browser evidence report](audits/evidence/2026-11-07/story-layout-browser.md); it confirms the scoped overlap fix and keeps short-screen reachability and assistive-technology gaps open.

## Shared layout and accessibility direction

- Use the existing Lorethra theme with a consistent 4/8/12/16/24/32px spacing scale, 16px interface text, at least 14px for ordinary supporting text, readable story text near 18px, and approximately 44px primary targets.
- Use logical margins, padding, borders, and alignment for RTL. Align prose naturally; do not force full justification. Keep mixed Persian/English content direction-aware and verify caret movement and selection, not only screenshots.
- Give forms consistent labels, help, validation, and recovery. Keep focus visible, return focus after dialogs/details, support reduced motion, and test contrast and zoom instead of inferring compliance from styles.
- Verify 320, 390, 640, and desktop widths; short windows; long labels; 200% zoom; the on-screen keyboard; keyboard-only navigation; and a real screen reader. The 2026-11-07 narrow-header change is a focused improvement, not a complete mobile redesign.

## Data and capability invariants

1. SQLite is the sole canonical store. The UI, AI, local providers, importers, and projections cannot bypass the validated command gateway.
2. Workspace, branch, revision, actor, consent, review, provenance, and idempotency checks remain enforced on every read/write boundary. Late completions retain their original scope.
3. Turn edits invalidate dependent projections and require affected proposals to be reviewed again. History and prior versions stay inspectable.
4. Provider capability discovery controls visible options. No hosted fallback, arbitrary workflow execution, automatic model download, or asset fetch is added.
5. Image candidates and recipes are immutable; keeping/attaching is explicit. Backup/restore retains bytes, profile versions, job/frame events, derivatives, and provenance, and never restarts jobs automatically.
6. MNO and Bestaigen are reference material only. Do not copy their code or artwork without a separate rights review.

## Delivery order and acceptance

| Slice | Journey | Evidence required |
|---|---|---|
| 0. Baseline and source inventory | Reproduce behavior at the recorded SHA with disposable workspaces | Working tree/SHA, screenshots, browser/network/accessibility evidence, synthetic stress fixture, no owner data |
| 1. Responsive play surface | Start → resume → transcript → compose → failure/retry → review → history → resume | Same-view before/after captures, no overlap, no typing writes/provider calls, draft retention, history and branch tests, keyboard/focus/RTL checks |
| 2. Navigation and setup | First-use and returning-user paths across libraries, setup, and details | Task completion/assistance/wrong turns with an actual new user and creator; all controls remain discoverable; responsive and accessible checks |
| 3. Continuity and mechanics | Inspect context → retrieve → propose → review → correct a source turn | Bilingual judged retrieval, zero permission leakage, preview/outbound comparison, idempotent calculations, provenance and replay tests |
| 4. Visual creation | Hero portrait → scene image → compare → explicit attach → reopen/export | Live local-provider capability evidence, recipe accuracy, candidate/revision/backup checks, identity and scene correspondence review |
| 5. Advanced visual work | Lookbook/compare → partial failure → stop/retry → derivative history | Bounded concurrency and frame count, restart reconciliation, safe cancellation, originals retained |
| 6. Whole platform and release | Knowledge, Journal, Scenarios, packages, providers, maintenance, restore | Cross-view consistency, full negative paths, human study, clean-machine Windows install and lifecycle, live provider path |

Targets remain hypotheses until measured on a pinned build. Keep input-to-next-paint p95 below 200ms on the recorded reference setup, with no reproduced multi-second typing stalls. Typing must cause zero canonical writes and zero provider calls. Retrieval improvements must not weaken eligibility filters. Automated role-based checks and human task outcomes are separate evidence. No build, screenshot, synthetic provider run, or source inspection alone establishes usability or release readiness.

## Open assumptions

- ComfyUI remains the first local image adapter, following the accepted local-first direction; its real workflow, models, reference support, and cancellation semantics still require live verification.
- A fixed seed is not a cross-model identity guarantee. Reference images are useful only when supported by the chosen adapter and explicitly selected.
- “Simple but content-rich” means short primary journeys with deep, clearly named tools—not removing advanced functionality.
- The downloaded MNO/Bestaigen sources were not executed. The Bestaigen app entrypoint and encrypted design book are absent from the inspected tree, so its complete layout remains uncertain.
- Human new-user/creator studies, native assistive technology, packaged Windows lifecycle, and live-provider acceptance remain open release gates.
