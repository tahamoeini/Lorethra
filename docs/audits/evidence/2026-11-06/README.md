# Verification artifacts — 2026-11-06

Browser source commit: `9941638eb685efbfbba0cab602c49f07ab4e8ece`.

Current backend restore source commit: `5d16ef6487c6ec5aba81f941588e45a469c8bf16`; explicit-retry regression commit: `97a91e41a002717d5df325fd7a71417659771dcc`.

All fixtures were disposable. The retained Playwright trace and network log have the synthetic authorization token redacted. The screenshots show synthetic world, character, and story content only.

- Browser: Microsoft Edge 155, headless, through Playwright automation. Setup/resume used Vite at 127.0.0.1:5175 and API at 127.0.0.1:48123; the large-history replay used Vite at 127.0.0.1:5176 and API at 127.0.0.1:48124.
- Network: 60 requests; 60 responses with status 200; 0 external origins; 0 failed requests; 0 console errors; 0 console warnings.
- Frontend build: TypeScript and Vite passed; JavaScript 560.17 kB (148.34 kB gzip), with the existing 500 kB advisory.
- Python: 223 tests passed in 11.846 seconds under Python 3.13.16 with the repository's installed dependencies and disposable temporary files.
- Backup recovery: candidate bytes/recipe, full job/frame event data, attached bytes, and trusted provenance survived `create_backup` and `restore_backup_into_database`; visual-profile and user-uploaded-asset history also survive separate-path restore. An authenticated synthetic API test reproduced queued work completing after restore before the fix; it now verifies restored work remains interrupted with no provider submission, then an explicit retry submits exactly one frame and completes. Gateway tests cover queued, running, and provider-reconcilable frames.
- Scope note: screenshots and browser/network traces predate the backend restore commit; the restore fix is covered by current-source API/gateway tests, not by a new rendered-browser run.
- Focus path: keyboard Enter opened the review; the pending target received focus; keyboard Enter on Close returned focus to the review opener with `:focus-visible` true.
- Layout: document width matched viewport at 320, 390, 640, and 1280 CSS pixels; no horizontal overflow observed.
- Composer diagnostic: 53 synthetic character inputs, 0 API writes, p95 0.8 ms and max 1.5 ms from the native input handler to the next animation-frame callback. This is a small-fixture diagnostic, not an INP or complete paint measurement.
- Large-history replay: a separate disposable database copy with 1,000 turns and 500 commands migrated from schema 19 to 20. The pinned current-source run rendered 80 turns initially, measured 37 typed characters, retained the draft through details open/close, and observed no transcript mutations or API writes after typing. Handler-to-second-animation-frame p95 was 15.4 ms. A separate retained timing record has no source SHA and measured 9.2 s initial load / 3.9 s resume; it is treated as an unresolved variance signal, not acceptance. The earlier desktop screenshot also lacks a recorded source SHA, so it is visual context rather than a controlled baseline build. See [stress summary](stress-summary.json), [earlier capture](baseline-stress-1440.png), [current desktop](current-stress-1440.png), and [current mobile](current-stress-390.png).
- Accessibility: semantic DOM roles, names, live-region attributes, composer label, and selected story-history tab recorded. Native screen-reader output, zoom, and contrast were not tested.

Files: `network-summary.json`, `network-log.redacted`, `playwright-trace.redacted`, and PNG screenshots. See [the full audit](../../2026-11-06-lorethra-refinement.md) for issue-by-issue findings and remaining gates.
