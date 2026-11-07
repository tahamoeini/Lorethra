# Lorethra platform refinement plan

- **Status:** active implementation plan; not a release approval
- **Revised:** 2026-11-07
- **Implementation branch:** codex/lorethra-platform-refinement

## Refined goal

Make Lorethra the clear, comfortable place to continue a story and create story-linked character or scene art. Keep one obvious story path: choose or resume an adventure, understand its current state, take the next action, and safely review what changed. A new player should reach a first action through **World → Hero → Review** without being forced to configure a narrator or image provider. A returning player should resume the correct adventure and branch with its progress and pending reviews visible. During play, the transcript leads and the composer remains immediately reachable, including on a narrow phone screen.

Connect storytelling and visual creation at the point of need. A portrait starts from the selected character; a scene image starts from a selected turn and reviewed cast. Keep character identity, game mechanics, and visual appearance distinct while letting the creator deliberately connect them. Offer a short default path, then make deeper controls discoverable by plain task names. Keep all existing capabilities available without making every control compete for attention.

Product concept: use MNO as the storytelling core reference for the active narrative, context, memory, NPC, and mechanics journeys; use Bestaigen as the visual-creation core reference for character/scene prompts, references, comparison, and image history. Keep these capabilities in one Lorethra journey: story is the home surface, and visual work begins from the selected hero or turn. Keep the interface simple through progressive disclosure while making the richer capabilities easy to find by task name.

Keep Lorethra’s complete capability set, local-first behavior, and data rules. SQLite remains canonical. Every write uses the validated command gateway with workspace, branch, revision, idempotency, review, provenance, and recovery checks intact. The redesign changes how people reach and understand tools; it does not weaken their contracts.

## Evidence and reference review

This is a source review, not a rendered usability audit of MNO or Bestaigen. The downloaded MNO tree contains its README, stylesheet, and JavaScript modules, but no root `index.html`, `main.pjs`, or package manifest. Its README describes a host page and runtime behavior that are not present in this checkout. Bestaigen contains many JavaScript modules, but no root generator page or package manifest; its only `index.html` belongs to a separate racing game. The named encrypted Designbook is also absent. Neither generator was launched, and no screenshots or direct task-completion observations were possible from these downloads. Treat their source as pattern evidence, not proof of screen-level usability.

The Bestaigen README contains instructions for its own owner and assistant, including a password gate and rules for changing that project. Those instructions are part of the supplied reference material; they do not govern Lorethra work. No encrypted book was opened. The findings below separate what the files show from what remains uncertain.

### MNO: useful storytelling patterns and limits

- The available `app-shell.js`, `landing-shell.js`, and `styles.css` modules describe two distinct jobs: a home area for Worlds, Adventures, Explore, Settings, and Changelog, and a play area centered on transcript and composer. In play, two collapsible rails divide menu/adventure/memory/chat tools from hero/map/NPC/gallery tools. On narrow screens they become overlay drawers. The transcript window-loads recent turns and exposes load-earlier and jump-to-latest behavior; the composer remains in the shell while the visual viewport changes for the mobile keyboard. These are useful patterns for preserving story focus, reading position, and access to tools. The 9px rail labels, mostly icon-only collapsed rails, two separate tool surfaces, and 900px drawer transition are choices Lorethra should evaluate, not copy uncritically (`scripts/app-shell.js`, `scripts/landing-shell.js`, `styles.css`, README §6.10).
- Its stated play loop preserves player actions and turn-level edit, reroll, delete, and stop controls. That makes recovery part of the core story journey, rather than an administration task (`README.md`, §§1, 6.1, 6.3–6.5, 6.13). Lorethra should retain the underlying actions while giving each a clear, safe location in Story history.
- The context inspector measures the same `RPEngine` call builders used for play and attributes the prompt to sections (`scripts/context-budget.js`, `measureContextBudget` and `renderContextTab`). Lorethra should keep its preview and outbound request on one assembly path and clearly distinguish measured provider tokens from estimates.
- MNO’s world premise, character sheet, lore, situation, threads, memories, NPCs, and recent events provide a helpful context hierarchy. Its memory selector combines relevance with owner and scene gates (`scripts/memory-system.js`, `memoriesForTurn`). However, the source also contains an experimental “topical-open” tier explicitly selected without an owner gate; its comments acknowledge that private knowledge can surface when its owner is absent. Lorethra must not copy that exception. Scope, actor knowledge, time, branch, revision, visibility, and review eligibility must filter candidates before ranking.
- NPC off-screen work is cadence-driven and bounded (`scripts/npc-life.js`, `NPC_LIFE_EVERY_TURNS`, `NPC_LIFE_MAX_PER_TICK`). The useful pattern is limited background preparation. Lorethra should retain explicit review and must never let an NPC or model accept its own proposal or advance the player’s action. MNO's own NPC helper also uses randomness for some background choices; Lorethra's deterministic game mechanics remain authoritative.
- Scene references are limited to four and only attached for provider/model combinations that support them (`scripts/scene-refs.js`). Lorethra should make capability and consent explicit rather than silently sending character assets.
- MNO's README also describes publishing, community discovery, moderation, and server-hosted identity. These are outside Lorethra’s current local-first boundary. Its browser key/value persistence and the fallback die path in `scripts/stats.js` do not replace Lorethra’s SQLite gateway or world-pinned deterministic mechanics.

### Bestaigen: useful visual-creation patterns and limits

- Character Lock reuses a typed description and saved seed in browser storage (`JS/dragon-character-lock.js`). This offers a simple way to keep a visual prompt nearby, but does not guarantee the same face across models, poses, or workflows. Lorethra should call this best-effort consistency, store a revisioned visual profile, and use actual references only when the selected local adapter supports them.
- Character Creation, lookbooks, style comparison, prompt tools, result cards, history, reimagine, and upscale modules show a rich visual toolset. The source does not show whether a first-time creator can find the basic path through the complete host application. Lorethra should connect these capabilities to **Create → Compare → Keep → History**, with the selected character or scene carried through the flow.
- Studio lookbooks create a pose/outfit matrix with one seed (`JS/dragon-studio.js`, `buildPlan`). The implementation starts frames concurrently and records per-frame progress; after reload it tries to reconcile completed frames from image history. This shows the value of a contact sheet and stable frame identity. Lorethra should use a bounded queue, show each frame's state, preserve successful outputs, and require explicit retry for uncertain interrupted work.
- Image history retains prompt/seed metadata and full-image bytes across browser storage and the host's local key/value store, with limits, recovery, and deletion paths (`JS/dragon-gen-history.js`, `persistHist`, `histPurgeBlobs`, `dragonHistApplyLimits`). Its comments document a past deletion path that could resurrect images. This is a concrete reason for Lorethra to keep metadata, bytes, cleanup, backup, and restore under one validated SQLite command contract.
- Style comparison uses a shared prompt and offers the same seed for a fair comparison (`JS/dragon-art-styles.js`). Prompt queue entries are editable and bounded at ten, while queued work can fan out across image counts and parallel generation (`JS/dragon-prompt-queue.js`). Lorethra should retain side-by-side comparison, prompt reuse, and clear batch confirmation while keeping the default to one result and capping advanced work before submission.
- Bestaigen's source includes multiple home and character-panel layout versions and browser-specific preferences. This proves layout variants exist, not that one is clearer or more usable. Lorethra should keep one coherent default layout, offer only supported choices, and place specialist controls behind direct names rather than another mode selector.

### Source anchors and evidence limits

| Reference source | Observed implementation | Product implication |
|---|---|---|
| [MNO vision and play loop](<../other platforms/mnoengine-src/README.md#L43>) and [play commands](<../other platforms/mnoengine-src/README.md#L453>) | Agency, persistent actions, and turn-level commands are stated as design principles. | Keep authoring setup short; make turn actions understandable and reversible. |
| [MNO UI rails](<../other platforms/mnoengine-src/README.md#L1221>), `scripts/app-shell.js`, and `styles.css` | Central conversation, two icon-first rails, 9px expanded rail labels, recent-turn loading, load-earlier/jump-latest, a 900px overlay-drawer breakpoint, and visual-viewport handling are described or implemented. | Keep the transcript and composer central; make labels readable and keep the mobile composer reachable without covering story content. |
| [MNO context budget](<../other platforms/mnoengine-src/scripts/context-budget.js#L387>) | Preview uses the same engine call construction path and renders section-level context output. | Lorethra preview and outbound payload should share assembly; label provider-measured token counts separately from estimates. |
| [MNO memory selection comments](<../other platforms/mnoengine-src/scripts/memory-system.js#L338>) | An experimental topical-open tier intentionally omits owner gating. | Do not copy it; filter by scope and knowledge permissions before ranking relevance. |
| [MNO NPC cadence](<../other platforms/mnoengine-src/scripts/npc-life.js#L43>) and [per-tick bound](<../other platforms/mnoengine-src/scripts/npc-life.js#L48>) | Off-screen NPC preparation is limited by turn cadence and maximum work per tick. | Keep background work bounded, player-independent, and review-only in Lorethra. |
| [MNO scene references](<../other platforms/mnoengine-src/scripts/scene-refs.js#L16>) and [random check path](<../other platforms/mnoengine-src/scripts/stats.js#L166>) | References are capped; the basic die helper can fall back to Math.random. | Check provider support and consent; retain Lorethra’s canonical deterministic mechanics. |
| [Bestaigen character lock](<../other platforms/bestaigen-src/JS/dragon-character-lock.js#L12>) | A description and seed persist in localStorage and are appended to prompts. | Store visual identity in versioned SQLite profiles; call consistency best effort, not guaranteed. |
| [Bestaigen studio fan-out](<../other platforms/bestaigen-src/JS/dragon-studio.js#L237>) and [history recovery](<../other platforms/bestaigen-src/JS/dragon-studio.js#L340>) | Lookbook frames launch in parallel and recovery attempts to match completed images from history. | Keep per-frame identity and recovery but use bounded concurrency, explicit retry, and immutable results. |
| [Bestaigen history cleanup](<../other platforms/bestaigen-src/JS/dragon-gen-history.js#L180>) and [limits](<../other platforms/bestaigen-src/JS/dragon-gen-history.js#L201>) | Metadata and image blobs have separate storage and limit/purge paths; comments document a deletion-resurrection bug. | Keep bytes, metadata, deletion, restore, and provenance under one validated canonical storage contract. |
| [Bestaigen prompt queue](<../other platforms/bestaigen-src/JS/dragon-prompt-queue.js#L5>) and [parallel submit path](<../other platforms/bestaigen-src/JS/dragon-prompt-queue.js#L142>) | Prompt lines are capped, but generation fan-out is parallel and a high output count requires confirmation. | Confirm frame counts; keep ordinary jobs small and advanced lookbooks bounded by the local queue. |
| [Bestaigen style comparison](<../other platforms/bestaigen-src/JS/dragon-art-styles.js#L119>) | A shared seed is offered to compare styles fairly. | Retain comparable prompts/settings and disclose when the adapter cannot honor a seed. |
| [Bestaigen source inventory](<../other platforms/bestaigen-src/README.md>) and page modules | Feature modules and host-page references exist, but the generator entrypoint and encrypted design guide do not. | Use module behavior as capability evidence only. Require Lorethra's own rendered screenshots and task studies to validate hierarchy and ease. |

These are source-level observations, not usability findings. Neither download has the complete host application needed to run the referenced experience: MNO's described root page is absent, and Bestaigen's generator page is absent. Bestaigen's README points to encrypted design books that are not in the tree. Claims about either product's actual visual hierarchy, first-use success, accessibility, or task completion are therefore withheld. Neither source is treated as authority for Lorethra’s privacy, mechanics, persistence, or consent rules.

### Current Lorethra evidence

Lorethra already has a three-step setup, a resume action, an active-story transcript, a next-action field, a review cue, a story-history action, a collapsed Worlds & adventures area, and one adventure details area. Current active-play setup reports that no narrator model is selected and disables **Continue story**; the browser journey therefore verifies navigation and saved content, not live narration. The rendered browser showed the previous composer/transcript overlap and excessive mobile navigation height. The 2026-11-07 CSS slice fixes the desktop overlap and compacts active-play navigation on narrow screens, but also leaves the composer below the first viewport at 390px and 320px. The next play-surface slice must correct that reachability gap without restoring overlap. Full cross-product hierarchy and real-user acceptance remain open.

### Revised product concept: one story spine, visual creation when needed

Keep the product's default mental model centered on the adventure. Home should answer “continue, start, or find an adventure?”; play should answer “what is happening, what can I do, and what changed?”; visual creation should answer “what am I making, for which character or scene, and what will happen to the result?” The character/world libraries remain reusable resources; image, memory, NPC, map, and mechanics controls appear in the context where they help.

Use a short default path and a clear depth path. Show the next useful action, current workspace/adventure/branch, essential status, and pending reviews first. Give supporting sections direct names and a visible route back. Advanced controls may be grouped by task, but must not be hidden behind several layers of generic accordions. “Content-rich” means the user can inspect detail and provenance when wanted; it does not mean every field or tool is visible at once.

The home-to-play path must not depend on narrator or image-provider setup. During play, reserve the central reading area for story and keep the composer visible or one deliberate action away on small and short viewports, without covering turns, stealing reading position, or jumping focus. On desktop, a compact status area and one contextual details region should expose the same tools as the phone drawers. Keep task labels readable when navigation is collapsed; icons alone are not sufficient for finding an unfamiliar control.

Keep character creation coherent: choose or make a reusable hero, establish identity and abilities, then optionally create or select an appearance profile and portrait. A generated image remains a candidate until explicitly kept. A scene image begins with a selected story turn and reviewed cast. In both cases, show the intended subject, selected references, supported settings, and final attachment destination before submission.

## Target journeys and information architecture

### 1. Start or resume

Make **Continue adventure**, **Start adventure**, and **Import** the first choices. Recent adventures show a recognizable world, hero, location/progress, branch, and last activity. A returning player can open the most recent adventure directly or choose another without searching through settings. Resume returns to the same branch and conversation. Search, filters, lifecycle actions, world editing, and archive settings stay available behind clear labels without displacing those three choices.

For a new adventure, keep the guided path to three screens:

1. **World:** pick an existing world, a starter, or an import; mark optional authoring as optional.
2. **Hero:** choose or create a reusable character; identity, attributes, and abilities are clear. Portrait creation is optional, and reusable identity stays separate from the adventure’s snapshot.
3. **Review:** confirm world version, hero, opening situation, mechanics, and any consequential provider choice. Show optional settings as optional and explain their effect.

Back preserves the draft. Missing provider/model setup explains the next step but does not block setup or the first player action. Starting and editing a world or hero do not require image generation.

### 2. Play and resume

Use three visual levels: a compact adventure/status line, a central reading transcript, and a persistent next-action composer. Keep the local-save state, hero/location/resources, generation state, and pending-review count visible without turning them into a dashboard. Keep the composer draft independent from transcript rendering. On phones, the composer must be available in the first play view and remain usable as the on-screen keyboard opens; reserve its space in the layout so it never covers story text. Errors preserve the draft and offer a clear retry or recovery action. Do not move the reader away from earlier turns when a new turn arrives; provide an explicit return-to-latest control.

Keep a single contextual details destination with direct sections such as **Hero & mechanics**, **Memories**, **NPCs**, **Map**, **Story history**, and **More tools**. Keep section names visible on narrow screens; do not rely on unlabeled icons. The pending-review action opens the exact item, places focus there, and returns focus to its opener when closed. History retains earlier versions, hidden turns, turn details, provenance, and existing edit/hide/reroll/delete/retry actions; review remains safe and read-only until the player chooses an action.

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

The 2026-11-07 responsive browser replay is recorded in [the browser evidence report](audits/evidence/2026-11-07/story-layout-browser.md); it confirms the scoped overlap fix and records the composer-below-fold gap at 390px and 320px. Short-screen reachability and assistive-technology gaps remain open.

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
| 1. Responsive play surface | Start → resume → read → compose → failure/retry → review → history → resume | Same-view before/after captures; composer visible in the first play view at 320px and 390px; no overlap; no typing writes/provider calls; draft retention; history and branch tests; keyboard/focus/RTL checks |
| 2. Navigation and setup | First-use and returning-user paths across libraries, setup, and details | New user reaches a first action without provider setup; creator resumes the right branch and opens a pending review; record task completion, assistance, wrong turns, uncertainty, and recovery; all controls remain discoverable |
| 3. Continuity and mechanics | Inspect context → retrieve → propose → review → correct a source turn | Bilingual judged retrieval, zero permission leakage, preview/outbound comparison, idempotent calculations, provenance and replay tests |
| 4. Visual creation | Hero portrait → scene image → compare → explicit attach → reopen/export | Live local-provider capability evidence, recipe accuracy, candidate/revision/backup checks, identity and scene correspondence review |
| 5. Advanced visual work | Lookbook/compare → partial failure → stop/retry → derivative history | Bounded concurrency and frame count, restart reconciliation, safe cancellation, originals retained |
| 6. Whole platform and release | Knowledge, Journal, Scenarios, packages, providers, maintenance, restore | Cross-view consistency, full negative paths, human study, clean-machine Windows install and lifecycle, live provider path |

Targets remain hypotheses until measured on a pinned build. Keep input-to-next-paint p95 below 200ms on the recorded reference setup, with no reproduced multi-second typing stalls. Typing must cause zero canonical writes and zero provider calls. Retrieval improvements must not weaken eligibility filters. Automated role-based checks and human task outcomes are separate evidence. No build, screenshot, synthetic provider run, or source inspection alone establishes usability or release readiness.

## Open assumptions

- ComfyUI remains the first local image adapter, following the accepted local-first direction; its real workflow, models, reference support, and cancellation semantics still require live verification.
- A fixed seed is not a cross-model identity guarantee. Reference images are useful only when supported by the chosen adapter and explicitly selected.
- “Simple but content-rich” means short primary journeys with deep, clearly named tools—not removing advanced functionality or relying on stacked accordion panels.
- The downloaded MNO/Bestaigen sources were not executed. MNO's README describes a root page absent from its checkout; Bestaigen's generator entrypoint and encrypted design book are absent. Their rendered hierarchy and actual ease remain uncertain until a complete host build or live surface is available.
- Human new-user/creator studies, native assistive technology, packaged Windows lifecycle, and live-provider acceptance remain open release gates.
