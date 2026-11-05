# Lorethra current-source stabilization audit

**Audit date:** 2026-11-05
**Audited HEAD:** 105ea73c330707e1c7d14de62d47f6c10210ea36
**Worktree:** local master; two commits ahead of the locally recorded origin/master and not pushed
**Release conclusion:** Not release-ready. The result below is scoped evidence, not a release approval.

## Scope and method

The current source was compared with GOALS.md, docs/PROJECT_STATUS.md, and docs/ACCEPTANCE_MATRIX.md before edits. The frontend source at HEAD is unchanged from the latest Story Studio UI commit ff61b1c; HEAD adds backend site-packages path configuration. No product source or tests were changed in this audit. The issue statuses remain Partial unless the named acceptance is complete.

The Python 3.13 backend unit suite passed **198 tests in 7.859 seconds** at the audited source. The frontend production build passed; Vite emitted a 531.15 kB JavaScript chunk (140.24 kB gzip), above its 500 kB advisory. The passing suite includes negative cases for stale revisions, idempotency conflicts, rejected proposals, invalid/credential-bearing imports, branch promotion, provider consent, cancellation, package tampering, and invalid backup input. The audit did not add new test cases because no source defect was reproduced.

The rendered-browser run used terminal-driven Playwright with headless Microsoft Edge against the local Vite app and a separate ephemeral loopback API backed by a disposable SQLite database. It used synthetic workspace/world/hero/story content. The provider-status endpoint returned an empty stub; the API environment had no provider credentials, and no provider generation or external request was made. The test turn was appended through the validated command gateway. Network evidence records paths/statuses only: 2 loopback origins, 0 external origins, 0 HTTP failures, 0 aborted requests, 8 empty provider-status stubs, and 10 direct test-harness API requests.

The Windows-native evidence is from the isolated unique-ID debug run already captured in output/audit-018524b. Its default-size launch used a new app identifier whose app-data directories were absent before the run. Offline debug build and normal-window launch were recorded. Resizing the native WebView with Playwright viewport emulation did not change the WebView CSS viewport, so those native resize screenshots were removed and are not used as evidence. The 320/390/640 responsive measurements below come from the rendered web build.

## Audited journeys and measured results

| Journey or requirement | Result at HEAD | Acceptance boundary |
|---|---|---|
| New user: create a space, review a starter world, create/select a hero, review the setup, start and resume an adventure | Passed in the isolated browser. World starter preview left the main revision unchanged; the saved synthetic world and hero appeared in the review; reload resumed the adventure. | No novice participant study; this is scripted task completion, not proof that first-time users need no help. |
| Creator: inspect and reject a pending review | The prior browser run at frontend commit ff61b1c verified that Open review selected and focused the matching pending memory, visible focus was present, keyboard navigation reached Reject, and rejection required an explicit decision without accepting the proposal. The frontend is unchanged at the audited HEAD. | This audit did not repeat the full claim/memory editing journey or creator testing with participants; no story-turn edit/hide was performed. |
| Story persistence and branch isolation | Passed for the fixture: a bilingual synthetic turn was committed through the command gateway, branch revision advanced 3→4, main stayed 2, and reload showed the turn. | No live generation, sibling-adventure scenario, or retry/cancel UI path in this browser run. |
| Story history and provenance discovery | The Story history panel, export controls, branch revision history, and earlier-version/hidden-turn control were visible. The panel correctly reported 0 earlier items in this fixture. | No prior turn was edited or hidden. Earlier-version reconstruction, hidden-turn review, and provenance on a mutated history remain unverified by this run. |
| Responsive story/composer layout | At 640×520, 390×844, and 320×568: document/body width matched the viewport; no horizontal overflow or transcript/composer overlap; the composer stayed in normal document flow and could be scrolled into view. | Desktop-width page and mobile viewport emulation were checked; physical native-window resizing was not. At 320px the provider summary is ellipsized while its setting label remains visible. |
| Keyboard and accessibility structure | Setup focus and history focus displayed a 3px solid outline; arrow-key tab navigation worked. The transcript exposed a named region, aria-live="polite", and Persian-first mixed text used dir=auto with computed RTL direction. The accessibility snapshot exposed tablist/tab/tabpanel labels and selected state. | No Windows Narrator speech, independent assistive-technology session, zoom/reflow test, or contrast audit was run. |
| Missing-provider behavior | With zero configured providers and the provider endpoint stubbed empty, the composer remained disabled and no generation request was sent. | This validates the unavailable state only; local/hosted provider startup, consent revocation, cancellation timing, and live failure handling remain open. |
| Windows debug shell | Unique-ID debug build and default-size launch succeeded with synthetic fixture data; empty/setup/resume/history screenshots and launch metadata were captured. | No packaged installer, clean-machine install, version-mismatch recovery, restart/uninstall, or real native resize test. |

## Before/after and current artifacts

The composer screenshots are a visual comparison from the existing narrow-layout fix: [before](../../output/audit-ff61b1c/42-current-story-narrow-before-composer.png) and [after](../../output/audit-ff61b1c/43-current-story-narrow-composer.png). Current-source screenshots: [empty start](../../output/audit-018524b/web-empty.png), [world review](../../output/audit-018524b/web-world-review.png), [hero review](../../output/audit-018524b/web-hero-review.png), [adventure review](../../output/audit-018524b/web-adventure-review.png), [desktop story](../../output/audit-018524b/web-story-desktop.png), [story history](../../output/audit-018524b/web-story-history.png), and [320×568 full page](../../output/audit-018524b/web-story-320x568-fullpage.png).

The prior focused-review capture is [the pending memory item with visible focus](../../output/audit-ff61b1c/44-current-pending-review-focused.png). The current Playwright artifacts are [journey results](../../output/audit-018524b/web-browser-journey.json), [sanitized network trace](../../output/audit-018524b/web-browser-network-sanitized.json), [accessibility snapshots](../../output/audit-018524b/web-browser-accessibility.json), and the [reproduction script](../../output/audit-018524b/browser-only-journey.cjs). Native default-size evidence includes [empty shell](../../output/audit-018524b/windows-native-empty.png), [resumed story](../../output/audit-018524b/windows-native-story-desktop.png), [history](../../output/audit-018524b/windows-native-story-history.png), and [launch metadata](../../output/audit-018524b/windows-native-launch.json).

Validation logs: [198-test backend suite](../../output/audit-018524b/unit-tests.txt), [frontend production build](../../output/audit-018524b/frontend-build.txt), [isolated Windows debug build](../../output/audit-018524b/windows-isolated-debug-build.txt), and [normal-window native debug build](../../output/audit-018524b/windows-debug-build.txt).

The composer before/after pair predates this audit; the current-source desktop and narrow screenshots independently show the resulting non-overlapping layout. The earlier pending-review browser evidence is at ff61b1c, the latest commit touching the relevant frontend component, and is unchanged in the audited HEAD.

No separate margin, padding, alignment, or justification defect reproduced in the current story screenshots; no spacing-only source edit was made. The 320px provider-summary abbreviation is retained as a minor item for participant review.

## P0 issue-by-issue evidence

Statuses below remain as recorded in docs/PROJECT_STATUS.md; this audit adds evidence but does not close broader acceptance.

| ID | Scope | Evidence at this audit | Remaining acceptance |
|---|---|---|---|
| P0-01 | Historical state reconstruction | All 198 backend unit tests pass. | Focused as-of proposal/memory checks and incomplete military, general-event, thread, derived-summary, and broader social-graph reconstruction remain open; this browser run did not edit an earlier turn. |
| P0-02 | Atomic adventure import/recovery | All 198 tests pass, including existing package rollback/idempotency coverage. | Desktop restart and browser import/recovery acceptance remain open. |
| P0-03 | Package secrets and visibility | All 198 tests pass, including existing credential-field rejection and package validation cases. | A typed visibility contract for every package field and hostile-file UI acceptance remain open. |
| P0-04 | Historical context and retry cutoffs | All 198 tests pass, including existing stale-revision and continuity coverage. | Broader accepted-state reconstruction and all-provider temporal edge cases remain open. |
| P0-05 | Package validation and tamper resistance | All 198 tests pass, including existing invalid-package/checksum cases. | Hostile package and asset acceptance through the rendered UI remains open. |
| P0-06 | Export previews and redaction | Existing automated export/privacy cases are included in the passing suite. | Current-browser export-mode, confirmation, and redaction review remains open. |
| P0-07 | Windows install and lifecycle | Isolated Windows debug build and unique-ID default-window launch succeeded. | Clean-machine install, Unicode-path launch, process-failure handling, restart persistence, and uninstall/data-retention remain open. |
| P0-08 | UI/sidecar contract compatibility | Current web journey loaded local health/workspace data; isolated debug shell launched. | Deliberate old-sidecar mismatch/recovery, packaged-sidecar smoke at HEAD, and WSL debug/release checks remain open. |
| P0-09 | Generation cancellation/recovery | Existing cancellation and idempotent-recovery tests are included in the passing suite; this browser sent no generation request. | Real-browser disconnect/cancel timing and remote processing/billing behavior remain open. |
| P0-10 | Provider consent and redaction | Existing authenticated consent/redaction tests are included in the passing suite; current browser used no provider. | Browser revocation flow and live provider policy/retention remain open. |
| P0-11 | Backup and restore | Existing backup/restore unit cases are included in the passing suite. The isolated backup API attempt failed before producing a file in the managed runtime; no restore was attempted. | Re-run authenticated backup/restore in a supported disposable path and verify a separate destination/device. The environment failure is not classified as a product defect. |
| P0-12 | Story-first product flow and source integration | Current-source browser verified first use, World→Hero→Review, resume, focused transcript/composer, contextual details, and history entry points. | Novice/creator participants, full library lifecycle, live generation, and release/installed gates remain open. |
| P0-13 | Typography, keyboard, responsive and multilingual behavior | Browser measurements passed at 320/390/640 widths; keyboard focus, tab navigation, accessible names/roles, aria-live, and a mixed Persian/English turn were inspected. | Narrator speech, zoom, measured contrast, typography with the installed font, and actual native resize remain open. |

## Privacy and test-environment deviations

The first native launch attempt used the default app identifier and displayed a pre-existing local workspace. No controls were used and no writes were made; the associated capture was removed. This was an unintended read of owner data, so the audit cannot claim that no owner data was ever displayed. Later native/browser interactions used a new unique app identifier or a disposable SQLite fixture with synthetic content. The unique-ID application database was removed. The remaining native temporary directory contains only two Vite stdout/stderr log files that Windows reported as open; they were left untouched to avoid stopping a process that may serve the user's local browser.

One computer-use surface-inventory call occurred before the Playwright-only continuation, despite the user's exclusion. It returned surface inventory only and did not open or operate an application. No computer-use calls were made afterward.

## Release readiness snapshot

| Gate | Status | Evidence and remaining work |
|---|---|---|
| Backend unit suite | Pass, scoped | 198 tests in 7.859 seconds; this does not establish live services or package installability. |
| Frontend production build | Pass with advisory | 531.15 kB JavaScript chunk exceeds Vite's 500 kB advisory. |
| First-use and resume | Pass, scripted browser scope | Synthetic first adventure saved and resumed; participant usability is open. |
| Story history/version controls | Partial | History panel and branch revisions visible; no earlier/hidden mutation exercised. |
| Responsive/keyboard/RTL | Pass, browser scope | 320/390/640 widths, focus, tab navigation, accessibility snapshot, and mixed RTL/LTR turn checked. |
| Screen reader/zoom/contrast | Open | Not tested with speech output or measured contrast/zoom. |
| Provider/live path | Open | Provider status intentionally stubbed empty; no local or hosted generation. |
| Backup/restore API and separate destination | Open | Current unit tests pass; isolated API attempt produced no backup and restore was not run. |
| Windows installer/clean machine | Open | Debug shell only; no clean-machine packaged install or lifecycle test. |
| Release decision | **Not ready** | Clean-machine, live-path, participant, assistive-technology, and recovery evidence is still required. |

## Handoff

- **Status:** audited; no source fix was justified by the reproduced current-head browser issues.
- **Canonical data and recovery:** the synthetic browser write used the validated command gateway and disposable SQLite; branch revision changed independently from main. The database was deleted after the run. No schema or migration changed.
- **Next smallest actions:** repeat the isolated backup/restore API path in an environment where the disposable SQLite temp path is writable; run a participant-based first-use/resume/review check; then test the Windows package on a clean machine and with a real local provider. Keep the P0 rows Partial until their own gates pass.
