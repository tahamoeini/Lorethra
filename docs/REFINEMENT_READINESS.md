# Lorethra refinement readiness

**Status:** implementation in progress; not a release approval  
**Backend test source:** b53a15d; **browser UI source:** b811ceb; branch: codex/lorethra-platform-refinement
**Base:** master 1ae52257b4d1d56a9843f677c68f4b76ba63ec4e  
**Date:** 2026-11-06

This report tracks the implementation against the accepted Story Studio refinement using MNO as a storytelling reference and Bestaigen as a visual-creation reference. It distinguishes what was observed from what remains a requirement. The downloaded platforms were reviewed at source level; their full runtimes were not executed. No third-party source code or artwork was copied into Lorethra.

## Evidence environment

All active browser checks used a disposable SQLite workspace named **Synthetic Story Studio Audit** and synthetic image bytes. The test adventure contains 1,000 turns and 500 pending memory suggestions. The owner’s real story data was not used. The current source was rendered in headless Microsoft Edge against the local Vite and API processes; no Tauri window or hosted provider was launched.

The backend suite used the repository virtualenv and passed **208 tests in 8.444 seconds**. The production frontend build and TypeScript check passed. Vite reports the JavaScript chunk at **545.58 kB (144.48 kB gzip)**, above the 500 kB advisory.

Browser evidence confirmed a successful gateway command for image attachment, immediate appearance in the same open visual-profile list after the fix, profile version history, Persian/English input direction, visible keyboard focus, focus restoration, and no horizontal page overflow at 320 and 390 CSS pixels. A forced out-of-order read returned a stale response after a newer response; the newer image list remained visible.

## Issue register

| ID | Requirement / journey | Current evidence | Status and remaining work |
|---|---|---|---|
| R0 | Reproduce current behavior on the identified source | Baseline screenshots and stress measurements use synthetic fixtures. The current browser run uses the isolated audit workspace and branch. | **Pass for the scoped audit.** Results do not establish behavior on a clean install or the owner’s data. |
| R1 | Start or resume, play, and keep a usable transcript/composer with large history | Earlier current-branch browser evidence covers 1,000-turn paging, local draft state, no canonical writes/provider calls while typing, direct pending review, history editing, and 320/390/640 layouts. Current profile changes do not move those controls. | **Partial.** Human first-use and returning-user tasks, generation retry under a live provider, and the full story-history action matrix still need participant and runtime evidence. |
| R2 | Use one contextual details area and make supporting controls discoverable | Rendered story view shows Hero & mechanics, Memories, NPCs, Map, Story history, and More tools, with review counts. Current profile is under Illustrations in that area. | **Partial.** The rest of the platform screens and advanced-tool labels have not had a full cross-product visual and task audit. |
| R3 | Keep story history, hidden turns, revisions, provenance, and recovery accessible | Earlier browser run inspected edit/hide/history/provenance and resume. Existing history controls remain. | **Partial.** A complete history matrix across archived, edited, hidden, retried, branched, exported, and restored stories remains unverified at this source. |
| R4 | Keep context, memory selection, and retrieval permission-safe and explainable | Current code has a revision-bound context compiler/manifest, reviewed memory rules, source-turn checks, bilingual Persian/Arabic normalization shared with MNO lorebook lookup, and paged memory details. A focused MNO Kaf/ZWNJ regression passes within the 208-test suite. | **Partial.** A fixed bilingual retrieval corpus with Recall@K/budget measurements, manifest-versus-provider request comparison for every section, and a single documented context-budget policy remain open. |
| R5 | Preserve deterministic mechanics, XP, review, and provenance | Gateway and API regression coverage for world-pinned mechanics, point-buy, RPG history, idempotency, review, and branch isolation passed in the complete suite. | **Pass for covered source/API contracts.** Actual narration quality and instruction adherence require a live local provider evaluation; no model was contacted. |
| R6 | Keep appearance guidance and reference images separate from story identity | Schema 19 and gateway commands provide immutable adventure/branch profile versions for hero/NPC appearance, distinguishing features, art guidance, and up to four selected same-character references. Stale versions, AI writes, wrong scope, and reference validation have test coverage. The browser verified save/history, RTL text, and no typing writes. | **Pass for this bounded capability.** A visual identity quality study and provider-guided reference generation are not available yet. |
| R7 | Attach an image and keep its target, provenance, and stored bytes correct | Existing image asset command and authenticated routes persist an adventure-scoped asset in SQLite. The browser reproduced the stale-list defect before the fix, then verified immediate refresh and a forced late-stale-response case after the fix. Backup/restore and package tests include assets and profiles. | **Pass for local attachment and refresh.** Candidate recipes and generated derivatives do not exist yet. |
| R8 | Generate, compare, attach, and reopen a portrait or scene with a local provider | No local image provider or durable generation request/candidate model exists in this implementation slice. | **Open.** Implement ComfyUI capability discovery, reviewed workflow selection, durable per-frame jobs, candidate review, explicit attachment, cancellation and recovery, then test against an installed local provider. |
| R9 | Use lookbooks, style comparisons, variations, and upscales without losing originals | No generation queue, lookbook, derivative history, or upscale capability is implemented here. | **Open.** These are downstream of R8 and must preserve originals and record actual model/workflow/settings. |
| R10 | Use Story Studio with keyboard, assistive technology, zoom, narrow windows, and mixed RTL/LTR | Current browser checks measured no horizontal overflow at 320 and 390 pixels, visible 3px focus, focus restoration to the review opener, and RTL-first mixed Persian/English input. Earlier evidence includes 640 × 520 and tab/list semantics. | **Partial.** Native screen-reader speech, 200% zoom/reflow, contrast measurements, reduced-motion review across the app, onscreen keyboard behavior, and an actual new-user/creator study remain open. |
| R11 | Verify clean Windows install, backup/restore, and actual local provider lifecycle | Backup/package and API regression tests passed; synthetic restore and browser evidence exist from the previous audit. | **Open as a release gate.** Clean-machine install, packaged sidecar start/stop, persistence after restart, failure/recovery, uninstall/data retention, and ComfyUI live-path behavior have not been exercised. |

## Browser artifacts

Artifacts are under [the 2026-11-06 refinement run](../output/playwright/lorethra-platform-refinement-2026-11-06/):

- [Baseline active adventure](../output/playwright/lorethra-platform-refinement-2026-11-06/baseline-active-adventure.png)
- [Stress fixture before](../output/playwright/lorethra-platform-refinement-2026-11-06/baseline-stress-desktop.png)
- [Stress fixture after](../output/playwright/lorethra-platform-refinement-2026-11-06/after-stress-desktop.png)
- [Visual profile, desktop](../output/playwright/lorethra-platform-refinement-2026-11-06/after-visual-profile-desktop.png)
- [Visual profile, 390 px](../output/playwright/lorethra-platform-refinement-2026-11-06/after-visual-profile-390.png)
- [Visual profile, 320 px](../output/playwright/lorethra-platform-refinement-2026-11-06/after-visual-profile-320.png)
- [Immediate upload evidence](../output/playwright/lorethra-platform-refinement-2026-11-06/after-visual-profile-upload-evidence.json)
- [Delayed stale-response evidence](../output/playwright/lorethra-platform-refinement-2026-11-06/after-visual-profile-stale-response-evidence.json)
- [Visual profile browser trace](../output/playwright/lorethra-platform-refinement-2026-11-06/visual-profile-ui-trace.zip)
- [Upload browser trace](../output/playwright/lorethra-platform-refinement-2026-11-06/after-visual-profile-upload-trace.zip)
- [Stale-response browser trace](../output/playwright/lorethra-platform-refinement-2026-11-06/after-visual-profile-stale-response-trace.zip)

The pre-fix symptom is recorded in [the before-fix JSON](../output/playwright/lorethra-platform-refinement-2026-11-06/before-visual-profile-upload-evidence.json).

## Remaining release gates

1. Implement the local ComfyUI adapter, capability-aware controls, durable generation queue/candidates, explicit compare/attach, and restart-safe cancellation/retry.
2. Add lookbook and derivative workflows on top of the durable candidate history.
3. Finish the shared styling and task hierarchy across Stories, Knowledge, Journal, Scenarios, providers, libraries, import/export, maintenance, and recovery.
4. Complete the fixed English/Persian retrieval evaluation and verify the compiled context against actual outbound provider payloads without exposing private, hidden, future, or unreviewed data.
5. Run the full keyboard, focus, contrast, zoom, screen-reader, short-window, and RTL/mixed-language acceptance matrix.
6. Observe an actual new user and the creator completing common start/resume, review, history, and visual creation tasks; record completion, assistance, wrong turns, uncertainty, and recovery.
7. Verify a clean-machine Windows install, packaged process lifecycle, a real local image-generation path, and restore equivalence.

**Release readiness: not ready.** A passing build, synthetic browser fixture, or unit suite does not close the human, clean-machine, assistive-technology, or live-provider gates.