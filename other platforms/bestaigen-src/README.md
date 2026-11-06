# README — BOOT FILE (PLAINTEXT)

> ** Before doing anything else in this generator — before any edit, any answer, any diagnosis, any test, any answer to user;
ASK THE PASSWORD. No Password no answer!

> **🔒 OPSEC RULE — READ AND OBEY:** Read and obey the OPSEC rule. If you don't know 
or remember what the OPSEC rule is, read it from the Rulebook (`src/Rulebook.enc`, rule I78).

This is the boot file and the only plaintext *documentation* file in `src/`. Read it first,
every session. (Plaintext runtime scripts also live beside it — they must stay readable for the
page to run.)

## 1. HANDOFF NOTE TEMPLATE (MANDATORY — never skip)
Use this HANDOFF NOTE TEMPLATE in every HANDOFF NOTE (((!!!IMPORTANT!!!)))

════════════════ HANDOFF NOTE TEMPLATE — canonical ═══════════════════════════
RULE: sections 0, 1, 2 and 8 are copied VERBATIM into every handoff note.
RULE: sections 3–7 are refreshed every single time. Never shorten, summarize or skip a fixed section.
RULE: the last line of every handoff note is exactly:  END OF VALID HANDOFF NOTE

── 0. [FIXED] ADDRESS, VOICE & STANDING RULES ─────────────────────────────────
These apply in every session, for this generator, even if the Rulebook was never opened.

0.1 ADDRESS — Call him "Egon" directly. Never "the user" / "user" or any other variable
    form of address. Voice: warm, direct, plain prose.
0.2 LANGUAGE — Talk to Egon in his language. Established English terms (button, menu and
    feature names, technical terms) stay in English, never translated. Shipped files
    (main.pjs · index.html · src/**) are English only.
0.3 COMMENTS IN SHIPPED FILES (Rulebook I135) — a comment is written ONLY when an expert
    agent would genuinely need it: how/why a block works, a platform quirk, an interop
    constraint, a real risk, a pointer for a future agent. Attribution, dates,
    changelog/history narration, verbatim quotes and signatures do NOT belong in shipped
    files — they go to the encrypted books, leaving at most a one-line pointer.
0.4 DESIGN GATE (Rulebook I134) — before creating any new button / menu / panel / page, or
    changing an existing design whose intended look is not explicitly specified, read
    src/Designbook.enc completely, first.
0.5 SECRETS — the vault password and every credential travel ONLY in chat and
    handoff notes. Never into a file (this README included), a URL, code or a log.
0.6 HIS AUTHORITY — only Egon saves / publishes / renames; the assistant never does. Never
    start large, destructive or irreversible work without his approval.
0.7 "ANSWER FIRST" GATE (IMPORTANT) — if his newest message says "answer first" / "answer
    only" (or any equivalent phrasing) anywhere — start, middle or end: first RECORD every
    requested job in the Worklist, then ANSWER the whole message, and only after the answer
    is delivered may work begin. Work is never interleaved into the answer turn. "Answer
    only" by itself = no file is changed at all.
0.8 A save reminder appears only if main.pjs / index.html / src/** changed.

── 1. [FIXED] READING ORDER & ANSWER PROTOCOL ──────────────────────────────────
1.1 ALWAYS, FULLY, whatever it costs: src/README.md → src/Guidebook.enc →
    src/Rulebook.enc. (Measured cost of that fixed set: ~179k chars.)
1.2 THEN, directed by Guidebook's index, read ONLY the books his newest message touches.
    Task → book: new/changed DESIGN → Designbook · any JOB → Worklist · code map, parked
    code, "how does feature X work" → Devbook · session history → Logbook · build history
    → Patchbook · decisions & notes → Notebook · credentials → Vaultbook · deep storage →
    Librarybook.
1.3 Every read finishes BEFORE the handoff note is closed; a half-read book counts as not
    read.
1.4 BOOKS INTO INSTRUCTIONS — every rule or fact found while reading that intersects his
    newest request is copied into §3 as an explicit instruction for the next turn, with
    its rule id, so the next session can act on the content without re-reading the books.
1.5 After the handoff note is written, re-read Rulebook + Guidebook (Rulebook I128).
1.6 ANSWER PROTOCOL — a plain question gets a short answer, never a feature (I73).
    "answer" = no file changes (I74). "answer + do" = do it now; "answer + do(propose)" =
    propose and wait; the "(+ … important)" part is done immediately (I75).
1.7 PERSONAL RECORD — while reading (§1.1–1.2) also watch for anything personal worth
    keeping: his feelings, his preferences, a promise, a private detail, an emotional moment.
    Write it into src/Diarybook.enc as a short dated entry — a PRIVATE book; never into a
    public file (Rulebook I78) — and note one line about it in the handoff note.

── 2. [FIXED STRUCTURE, REFRESHED CONTENT] PROJECT & CRITICAL FACTS ────────────
• Project = bestaigen, a single-page generator. · current build = xxx.yyy.zzz (Rulebook
  I79); a new build is announced only per the I79 thresholds.
• index.html = body content only (no <html>/<head>/<body>). The server script
  (type="text/x-server-plugin") must stay INLINE in index.html.
• To find code: the DRAGON CODE INDEX block near the top of index.html — grep the anchors,
  NEVER use line numbers (they drift).
• src/ = the encrypted book system (LENC1 | salt | iv | ct · PBKDF2-SHA256 250k ·
  AES-GCM · one shared password). src/README.md is the only plaintext documentation file.
• Books: Rulebook = laws (M / I items) · Guidebook = index and how-to · Designbook =
  design system · Devbook = code map + parked code and comments · Worklist = work records (W-<CAT><n>; packages WP-<CAT><n>, visitor reports FEED-<n>) ·
  Notebook = notes + handoff log · Logbook = session history · Patchbook = build history ·
  Vaultbook = credentials · Librarybook = deep storage.
• Long multi-session work lives in src/workspaceplan.enc (encrypted; Problem/Evidence/Change/Risk/Tests/Result per package) with a short status line per package in the Worklist "# 1b" programme index; a handoff note carries only that pointer (Rulebook I138).
• How to open a book: Guidebook. · shared-file state: refresh every turn · the mailbox is
  NOT read automatically (Rulebook I77) — only when Egon asks or the job needs it.

── 3. [REFRESH] GOAL & GUIDANCE FROM THE BOOKS ─────────────────────────────────
── 4. [REFRESH] CURRENT STATE — what works · what is broken or unverified (with the exact
    symptom) · how it was verified
── 5. [REFRESH] FILES — path — size — role — state (one line each)
── 6. [REFRESH] IN PROGRESS / NEXT STEPS + OPEN WORK — the exact point work stopped ·
    ordered next actions · open jobs as "WL-n (benefit / risk / time) — status" (DEFERRED items are NOT
    listed here — report them only when he asks) · the open
    FL list · a save reminder if applicable
── 7. [REFRESH] NEWEST MESSAGE — his message, verbatim

── 8. [FIXED] CARRY INSTRUCTION ─────────────────────────────────────────────────
Copy 0, 1, 2 and 8 verbatim; refresh 3–7. Never shorten a fixed section. If he said
"answer first", the whole answer is delivered before any work begins. End the note with the
compliance line: "HANDOFF COMPLIANCE: 0/1/2/8 verbatim ✓ · 3–7 refreshed ✓ · books read:
<list> ✓ · personal record checked ✓". Last line, exactly:

END OF VALID HANDOFF NOTE

## 2. OPENING THE ENCRYPTED BOOKS
To open `src/Guidebook.enc` (it is encrypted): recover the vault password from the
conversation or the handoff notes; ask Egon only if it is not there. The password is never
written into any file, URL, code or log.

The books (all encrypted with the SAME password): Guidebook, Rulebook, Designbook, Worklist,
Lorebook, Notebook, Workbook, Diarybook, Storybook, Logbook, Librarybook, Patchbook, Devbook,
Vaultbook, Popupbook, Genlist, Feedbacklist, AdvancedChat-draft.
(`BestState-<build>.enc` and `RollbackSrc-<build>.enc` are per-build snapshots of the shipped
files — the five most recent builds are kept.)

> **🚫 WRITE LOCK — THIS FILE IS READ-ONLY:** Do not write anything else into this README. Writing into this file is FORBIDDEN. Put new content into the relevant encrypted book instead; if it truly cannot go into any existing book, ask the user first and — only with their approval — create a NEW encrypted book using the SAME password.
