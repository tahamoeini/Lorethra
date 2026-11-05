# Lorethra current-source stabilization audit

**Audit date:** 2026-11-05

**Product source exercised:** `105ea73c330707e1c7d14de62d47f6c10210ea36` (current product files remain unchanged at this SHA)

**Repository HEAD before this report update:** `656716dadba02e62591abdfb2e03282dec561821`

**Worktree:** local `master`; no product code, schema, PR, commit, merge, or push was created in this continuation.
**Release conclusion:** **Not release-ready.** This is scoped runtime evidence, not a release approval.

## Scope and method

I compared the current product source and UI with `GOALS.md`, `docs/PROJECT_STATUS.md`, `docs/ACCEPTANCE_MATRIX.md`, the current contracts, and the workflow guide. Backlog phases and P0 labels were treated as hypotheses and acceptance requirements. I only report behavior reproduced in source, tests, or the rendered app.

The browser run used terminal-driven Playwright with headless Microsoft Edge, Vite at `127.0.0.1:5173`, and the real local API at `127.0.0.1:48124`. The API used a fresh disposable SQLite directory at `output/playwright/story-studio-ux-2026-11-05/data-browser-main-04`, a synthetic workspace/world/hero/story, and an in-process provider that returned one expected failure followed by synthetic narrative. That database, all browser-created backup files, and the test-only temporary database were removed after capture. No owner database, external provider, or external network origin was used in this continuation. The user directed use of the embedded/rendered browser instead of launching Tauri; therefore no new Windows-native GUI evidence is claimed.

The first browser attempts exposed test-fixture and selector mistakes: one reused synthetic state instead of an empty database, one omitted development CORS configuration, and the flow test expected extra manual setup steps and selected a submit button by an absent `type` attribute. Those harness conditions were corrected. The final clean run completed; these earlier harness failures are not classified as product defects.

An earlier audit incident remains disclosed: a default-identifier native attempt displayed an existing local workspace before isolation, and a computer-use surface inventory also occurred before the explicit exclusion. No action or write was made during that display, and its capture was removed. No computer-use call or owner-data interaction occurred in this continuation. Because of the earlier display, the overall thread cannot claim that owner data was never shown.

## Audited journeys and results

| Journey | Result and evidence | Remaining acceptance |
|---|---|---|
| New user: empty space → world → hero → review → adventure | Passed on a fresh synthetic workspace. Saving the starter world advanced directly to Hero; creating the hero advanced to Review; starting the adventure opened the story composer. The step labels and confirmation messages were visible. | No novice participant study or measured completion-time baseline. |
| Provider failure and retry | First synthetic request returned HTTP 503. The prompt remained in the composer; transcript, adventure branch revision, and main revision were unchanged. Retry reused its idempotency key, saved exactly one player/narrator pair, advanced the adventure branch from revision 3 to 4, and left main at revision 2. | No live Ollama/hosted provider, cancel/disconnect timing, timeout, billing, or live consent/redaction test. |
| Creator: pending continuity review | The review cue opened the matching memory item in Adventure details & tools, selected Memories, moved focus to the item with a visible outline, and persisted explicit rejection. | Broader claim/NPC edit and acceptance cases were not repeated. |
| Story edit and history | Editing a player direction preserved its earlier version and superseded later active turns. Story history exposed earlier/hidden turns and turn provenance including provider, model, context revision, and manifest. | Not every branch/history/export action was exercised. Historical RPG reconstruction remains covered only by existing focused tests and broader release evidence. |
| Backup and recovery | UI downloaded a backup. Invalid input showed a recoverable error after explicit replacement confirmation and left the workspace list unchanged. Valid restore preserved the story turns; reload offered Resume. | No different-device install, migration-on-restore, or installed-desktop recovery drill. |
| Narrow and multilingual play | At 640×520, 390×844, and 320×568 the document width matched the viewport; the transcript and composer did not overlap and the composer remained visible in normal flow. A Persian-first mixed Persian/English player turn had `dir="auto"` and computed RTL direction. | No physical native-window resize, zoom/reflow, installed-font review, or participant observation. At 320px the provider/model summary is abbreviated while its setting label remains visible. |
| Keyboard and accessibility tree | Keyboard traversal reached Story history with a 3px solid focus outline. The composer had the accessible name “What do you do or say?”, was required, and used automatic direction. The transcript exposed a name and `aria-live="polite"`; the accessibility tree listed turns and their groups. | No Windows Narrator speech-output session, measured contrast, or WCAG audit. An accessibility tree inspection is not assistive-technology acceptance. |

The setup and story captures were visually reviewed. The transcript uses a bounded reading measure while the composer remains aligned with the play surface; the contextual details panel presents Hero & mechanics, Memories, NPCs, Map, Story history, and More tools as direct destinations. No margins, padding, alignment, or justification defect reproduced in these screenshots. No spacing-only product edit was made.

The screenshot pair below shows the same interaction before and after saving a world. It is a flow-state comparison, not a source-code redesign before/after, because this audit reproduced no product defect and changed no product code:

- [Before save: starter world review](../../output/playwright/story-studio-ux-2026-11-05/new-user-world-review.png)
- [After save: Hero step](../../output/playwright/story-studio-ux-2026-11-05/new-user-hero-step.png)
- [Adventure review](../../output/playwright/story-studio-ux-2026-11-05/new-user-adventure-review.png)
- [Story after synthetic retry](../../output/playwright/story-studio-ux-2026-11-05/story-after-retry-desktop.png)
- [Recoverable provider failure](../../output/playwright/story-studio-ux-2026-11-05/provider-failure-recoverable.png)
- [Pending memory item focused](../../output/playwright/story-studio-ux-2026-11-05/creator-pending-memory-focused.png)
- [Earlier turns and provenance](../../output/playwright/story-studio-ux-2026-11-05/creator-story-history-provenance.png)
- [Resume after restore and reload](../../output/playwright/story-studio-ux-2026-11-05/returning-user-resume-after-restore.png)
- [320×568 resumed story](../../output/playwright/story-studio-ux-2026-11-05/story-resume-320x568.png)

## Automated validation and artifacts

- `npm run build` passed TypeScript and the Vite production build. The JavaScript chunk is 531.15 kB (140.24 kB gzip), above Vite's 500 kB advisory. Log: [frontend-build-current.txt](../../output/playwright/story-studio-ux-2026-11-05/frontend-build-current.txt).
- Focused Python tests passed: 5 backup/restore tests and 15 continuity tests, 20 total in 1.009s. Log: [focused-backend-tests-current.txt](../../output/playwright/story-studio-ux-2026-11-05/focused-backend-tests-current.txt).
- The previously documented 198-test Python 3.13 run at the same product source remains existing evidence. A fresh full/API-suite rerun in this managed runtime stalled before completion; it is not reported as a product failure or a new pass. The partial logs are `backend-unit-tests.txt`, `api-boundary-unit-tests.txt`, and `story-api-negative-path-tests.txt` in the artifact directory.
- The end-to-end result contains eight completed stages, responsive measurements, accessibility observations, retry keys, and a sanitized path/status trace: [story-studio-browser-audit.json](../../output/playwright/story-studio-ux-2026-11-05/story-studio-browser-audit.json). There were 231 browser requests across the two loopback origins, no external origins, no failed/aborted browser requests, and two expected HTTP error responses: 503 for the synthetic provider failure and 422 for invalid backup input.
- A second read-only browser probe verified accessible names/roles, label binding, keyboard focus, console/page errors, and loopback-only networking: [story-studio-accessibility-browser-audit.json](../../output/playwright/story-studio-ux-2026-11-05/story-studio-accessibility-browser-audit.json).
- Reproduction harnesses and the synthetic API runner are [rendered-story-studio-audit.cjs](../../output/playwright/story-studio-ux-2026-11-05/rendered-story-studio-audit.cjs), [inspect-accessibility.cjs](../../output/playwright/story-studio-ux-2026-11-05/inspect-accessibility.cjs), and [synthetic_api_runner.py](../../output/playwright/story-studio-ux-2026-11-05/synthetic_api_runner.py). The browser/network traces omit request bodies and sanitize workspace/adventure/conversation IDs.

## Issue-by-issue evidence

The status labels remain Partial/Open where wider acceptance is still required. The phase/register alone did not establish a defect.

| ID | Current evidence from this audit | Remaining acceptance |
|---|---|---|
| P0-01 · Historical state reconstruction | Fifteen continuity tests passed; browser turn edit preserved earlier text and downstream turns in history. | Focused cutoff cases and military, general-event, thread, derived-summary, and broader social-graph reconstruction remain incomplete. |
| P0-02 · Atomic adventure import/recovery | Existing transactional gateway/import coverage remains in the repository. | Adventure package import failure and restart recovery were not exercised in this browser run. |
| P0-03 · Package visibility and secrets | Existing validators and visibility controls remain; no package regression was reproduced. | Typed visibility for every package field and hostile-file UI tests remain open. |
| P0-04 · Historical context and retry cutoffs | The synthetic retry path committed only once and remained branch-local. | As-of retry after later proposal/review changes and cross-provider temporal cases were not exercised. |
| P0-05 · Package validation and tamper resistance | No package defect was reproduced; existing checksum/schema tests remain the available evidence. | Hostile package and asset acceptance through the rendered UI remains open. |
| P0-06 · Export preview and redaction | No story/world package export was performed here. | Current-browser export mode, private confirmation, and redaction review remain open. |
| P0-07 · Windows installation/lifecycle | No Tauri launch was made in this continuation. Historical CI/build evidence is not clean-machine acceptance. | Clean-machine package install, Unicode path, start/stop, restart, failure, uninstall, and data retention remain open. |
| P0-08 · UI/sidecar compatibility | Web health and workspace API calls succeeded on the local API. | Deliberate old-sidecar mismatch/recovery and packaged-sidecar smoke at current product source remain open. |
| P0-09 · Generation failure/recovery | Synthetic 503 preserved input and made no partial write; retry reused its idempotency key and committed one isolated turn. | Live-provider disconnect/cancel/timeout and remote post-acceptance behavior remain open. |
| P0-10 · Consent/redaction | Only a synthetic local provider was used; no outbound provider request occurred. | Browser consent/revocation and live hosted-provider redaction/retention remain open. |
| P0-11 · Backup/restore | Five focused tests passed; browser verified backup download, safe invalid restore, valid restore, preserved story turns, and Resume. | Different-device/installation recovery and migration-on-restore remain open. |
| P0-12 · Story-first flow and integration | Empty-state setup, adventure start, resume, contextual tools, pending review, editing, and history were completed in the rendered app. | Novice/creator participants, full library lifecycle, and live-provider behavior remain open. |
| P0-13 · Typography, keyboard, responsive, multilingual | 320/390/640 layouts, focus order/visibility, composer labeling, transcript live region, and RTL-first mixed text were inspected. | Screen-reader speech, zoom, contrast, installed fonts, physical native resizing, and participant-based accessibility remain open. |

## Release readiness

| Gate | Status | Evidence and limit |
|---|---|---|
| Backend | Pass, scoped | Previous 198-test run is recorded at the same product source; this continuation passed 20 focused tests. Its full/API rerun did not complete in this managed runtime. |
| Frontend build | Pass with advisory | Build passed; JavaScript chunk is 531.15 kB, above the 500 kB advisory. |
| New user and return | Pass, scripted browser scope | Synthetic World → Hero → Review, start, backup/restore, reload, and Resume passed. Participant usability remains unmeasured. |
| History and review | Pass, scripted scope | Pending-memory rejection, player-turn edit, earlier/hidden turn visibility, saved versions, and provenance were exercised. Not every history or export action was. |
| Network/privacy | Pass, synthetic local scope | Browser requests stayed on loopback; only expected synthetic 503 and invalid-restore 422 responses occurred. No remote provider or consent path was tested. |
| Responsive/keyboard/tree | Pass, browser scope | Three viewports, focus, names/roles, live region, and mixed RTL/LTR checked. Actual assistive technology, zoom, contrast, and physical native resize remain open. |
| Backup/restore | Pass, synthetic UI scope | Valid and invalid restore behaviors passed with a disposable fixture; separate destination/device remains open. |
| Windows package/clean machine | Open | No native UI was launched in this continuation; installed lifecycle and clean-machine evidence remains required. |
| Release decision | **Not ready** | Live-provider, representative usability, assistive technology, and clean-machine installed-Windows gates remain open. |

## Handoff

- **Status:** scoped audit complete; no current product defect was reproduced, so no product-source fix was justified.
- **Architecture/recovery:** canonical writes in the browser journey used the existing command gateway and disposable SQLite. The test verified workspace/branch isolation and backup restore. No schema, migration, backup format, or product source changed.
- **Next smallest work:** run the existing full/API suites in a stable supported Python environment; conduct a novice/creator task study; test actual screen-reader, zoom, contrast, and installed fonts; then verify a packaged Windows build on a clean machine and a real local-provider failure/consent/cancel path. Keep P0 rows Partial/Open until their own acceptance criteria pass.
