# Lorethra refinement readiness

**Status:** implementation in progress; not a release approval
**Current application source:** 5d16ef6487c6ec5aba81f941588e45a469c8bf16; branch: codex/lorethra-platform-refinement
**Restore behavior:** 5d16ef6; explicit-retry regression: 97a91e4
**Base:** master 1ae52257b4d1d56a9843f677c68f4b76ba63ec4e
**Date:** 2026-11-06

This report tracks the implementation against the accepted Story Studio refinement using MNO as a storytelling reference and Bestaigen as a visual-creation reference. It distinguishes what was observed from what remains a requirement. The downloaded platforms were reviewed at source level; their full runtimes were not executed. No third-party source code or artwork was copied into Lorethra.

## Evidence environment

The current continuation used disposable `new-audit` and `creator-audit` SQLite workspaces, a synthetic image fixture, and a separate copy of the 1,000-turn/500-command SQLite stress fixture; it did not open the owner database. The stress copy migrated from schema 19 to 20. Current browser execution used headless Edge 155 against local Vite/API origins only. No Tauri app or external provider was launched.

At application source `9941638` plus backup-test revision `6e6efab`, the full Python 3.13.14 repository suite passed 221 tests in 11.805 seconds. TypeScript and the production Vite build passed with a 560.17 kB JavaScript chunk (148.34 kB gzip), above Vite’s 500 kB advisory.

Current browser evidence confirms first-use setup, creator resume, direct pending review, original/current turn versions, keyboard focus return, 320/390/640/1280 px layouts, and mixed Persian/English rendering. In the stress fixture, 80 turns load initially; typing preserved the draft with zero transcript mutations and API writes, and the input-handler-to-second-animation-frame p95 was 15.4 ms. One current-source timing sample measured 684 ms initial load and 941 ms to composer-ready; another retained run without a pinned source SHA measured 9.2 s / 3.9 s. Treat performance as partial until a controlled, phase-separated repeat. The small-flow network trace records 60 loopback requests, all 200; console errors and warnings are zero.

## Issue register

| ID | Requirement / journey | Current evidence | Status and remaining work |
|---|---|---|---|
| R0 | Reproduce current behavior on the identified source | Baseline screenshots and stress measurements use synthetic fixtures. The current browser run uses the isolated audit workspace and branch. | **Pass for the scoped audit.** Results do not establish behavior on a clean install or the owner’s data. |
| R1 | Start or resume, play, and keep a usable transcript/composer with large history | Current-source browser replay on a disposable 1,000-turn/500-command copy shows initial 80-turn paging, draft retention across details, zero transcript changes/API writes after typing, and a 15.4 ms second-animation-frame p95 diagnostic. A second unpinned timing record reports much slower load/resume and is not suitable as a source acceptance result. | **Partial.** Repeat performance with phase-separated instrumentation on a pinned build. Human first-use and returning-user tasks, live-provider retry, and the full story-history action matrix still need participant and runtime evidence. |
| R2 | Use one contextual details area and make supporting controls discoverable | Rendered story view shows Hero & mechanics, Memories, NPCs, Map, Story history, and More tools, with review counts. Current profile is under Illustrations in that area. | **Partial.** The rest of the platform screens and advanced-tool labels have not had a full cross-product visual and task audit. |
| R3 | Keep story history, hidden turns, revisions, provenance, and recovery accessible | Earlier browser run inspected edit/hide/history/provenance and resume. Existing history controls remain. | **Partial.** A complete history matrix across archived, edited, hidden, retried, branched, exported, and restored stories remains unverified at this source. |
| R4 | Keep context, memory selection, and retrieval permission-safe and explainable | Current code has a revision-bound context compiler/manifest, reviewed memory rules, source-turn checks, bilingual Persian/Arabic normalization shared with MNO lorebook lookup, and paged memory details. A focused MNO Kaf/ZWNJ regression passes within the current 221-test suite. | **Partial.** A fixed bilingual retrieval corpus with Recall@K/budget measurements, manifest-versus-provider request comparison for every section, and a single documented context-budget policy remain open. |
| R5 | Preserve deterministic mechanics, XP, review, and provenance | Gateway and API regression coverage for world-pinned mechanics, point-buy, RPG history, idempotency, review, and branch isolation passed in the complete suite. | **Pass for covered source/API contracts.** Actual narration quality and instruction adherence require a live local provider evaluation; no model was contacted. |
| R6 | Keep appearance guidance and reference images separate from story identity | Schema v19 and gateway commands provide immutable adventure/branch profile versions for hero/NPC appearance, distinguishing features, art guidance, and up to four selected same-character references. Stale versions, AI writes, wrong scope, and reference validation have test coverage. The browser verified save/history, RTL text, and no typing writes. | **Pass for this bounded capability.** A visual identity quality study and provider-guided reference generation are not available yet. |
| R7 | Attach an image and keep its target, provenance, and stored bytes correct | Validated asset attachment and ComfyUI-generated candidate keep/attach are scoped to an adventure branch; candidates retain recipe, digest, and immutable bytes. v4 package tests cover private round trip and export redaction. Backup tests round-trip candidate bytes/recipe, complete job/frame events, attached asset bytes, and trusted candidate provenance. The API restore test reproduced queued work completing after restore, then passed with restored frames interrupted through the gateway; an explicit retry submitted and completed exactly one frame. | **Partial.** No live generated image was attached in this run; provider-side completion/cancellation and restore on a clean second installation remain open. |
| R8 | Generate, compare, attach, and reopen a portrait or scene with a local provider | Source implements the local ComfyUI adapter, durable bounded jobs, per-frame state, candidates, explicit keep/attach, and history. Fake-provider and package tests pass in the current full suite. | **Partial.** Live local generation, candidate comparison usability, and installed-provider recovery remain unverified. |
| R9 | Use lookbooks, style comparisons, variations, and upscales without losing originals | Current provider capabilities report reference conditioning, description, variation, and upscale as unsupported; lookbooks, style comparison, and derivative history are absent. | **Open.** Add only behind explicit supported-capability paths and immutable derivative history. |
| R10 | Use Story Studio with keyboard, assistive technology, zoom, narrow windows, and mixed RTL/LTR | Current browser checks measured no horizontal overflow at 320 and 390 pixels, visible 3px focus, focus restoration to the review opener, and RTL-first mixed Persian/English input. Earlier evidence includes 640 × 520 and tab/list semantics. | **Partial.** Native screen-reader speech, 200% zoom/reflow, contrast measurements, reduced-motion review across the app, onscreen keyboard behavior, and an actual new-user/creator study remain open. |
| R11 | Verify clean Windows install, backup/restore, and actual local provider lifecycle | Current schema/package tests pass, including visual-profile backup and image-candidate/attachment/job-history round trips. The authenticated API restore regression confirms queued jobs do not resume automatically; the runner is paused during active database replacement. The current browser run used Edge only. | **Open as a release gate.** Clean-machine install, packaged lifecycle, current-source browser restore, live ComfyUI completion/cancellation, and restore on a clean second install remain untested. |

## Browser artifacts

Current retained screenshots, sanitized network trace, and summary are under [the committed 2026-11-06 evidence directory](audits/evidence/2026-11-06/). The [current issue-by-issue audit](audits/2026-11-06-lorethra-refinement.md) links each artifact to its finding.

## Remaining release gates

1. Run a real local ComfyUI generation journey and verify capabilities, candidate review, explicit attachment, and restart-safe recovery.
2. Add supported reference guidance, image description, variations, upscaling, lookbooks, and derivative history only after live provider capability checks.
3. Finish the shared styling and task hierarchy across Stories, Knowledge, Journal, Scenarios, providers, libraries, import/export, maintenance, and recovery.
4. Complete fixed English/Persian retrieval evaluation and compare compiled context against actual outbound provider payloads without leaking private, hidden, future, or unreviewed data.
5. Run the full keyboard, focus, contrast, zoom, screen-reader, short-window, and RTL/mixed-language acceptance matrix.
6. Observe an actual new user and the creator completing start/resume, review, history, and visual tasks; record completion, assistance, wrong turns, uncertainty, and recovery.
7. Verify a clean-machine Windows install, packaged process lifecycle, real local image generation, browser restore, and live provider behavior across restore on another install.

**Release readiness: not ready.** A passing build, synthetic browser fixture, or unit suite does not close the human, clean-machine, assistive-technology, or live-provider gates.
