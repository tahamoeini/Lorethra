/* ============================================================================
   BestAiGen — Check-up protocol (P's regression tester)
   ----------------------------------------------------------------------------
   Run this after EVERY change batch, BEFORE telling Egon that saving is safe.
   It walks the real page (the one the engine renders) and exercises only the
   USER-FACING surfaces, then returns a machine-readable verdict. It is
   deliberately NON-DESTRUCTIVE: it never clicks Generate, never deletes,
   never clears, never edits saved data. It only navigates, opens/closes
   overlays, and reads the DOM.

   WHERE IT IS USED
     Loaded on demand from the live preview (it is NOT attached to the page at
     load unless index.html also includes it as a <script src>):
       await import("./src/JS/dragon-checkup.js");
       return await window.dragonCheckup();          // full run
       return await window.dragonCheckup({only:["private-vault","kissing-standard"]});
     A classic IIFE so it works both as a <script src> file and via dynamic
     import() (module execution still assigns window.dragonCheckup).

   RETURN SHAPE
     {
       ok:        boolean   // all checks passed AND no unexpected console errors
       build:     string    // root.buildVersion while the run started
       startedOn: string    // data-dragon-page we found the page on
       page:      string    // data-dragon-page at the end (restored to startedOn)
       passed:    number, failed: number, ms: number,
       checks:  [ { name, ok, detail, ms } ],
       errors:  [ { type, text } ]   // console.error / window.onerror / rejections
     }
     window.dragonCheckup.format(res) -> short plain-text report (for chat/logs).
     window.dragonCheckupByCategory(res) -> the same run grouped by CATEGORY (the Logbook record shape).
     window.dragonCheckupGreenState() / dragonCheckupGreenReset() -> the green-cycle memory, for tests.

   CATEGORIES + GREEN CYCLE (Egon's check-up rule, 23.09.2026)
     Every check carries a category (protocol / shell / generate / gallery / likes / vault /
     people / survey / media-tools / saver / stats / standards / sweep) and the run result groups them, so
     the Logbook record lists WHAT was checked, by category, instead of one flat list.
     A check that passed 3 runs in a row and whose OWN source text is unchanged is SKIPPED (reported as
     "green") - a related change is what re-arms it, and editing the check itself always does. Counter
     `dragonCheckupRuns` in localStorage; every 20th run is a forced GLOBAL check-up (nothing skipped), and
     the result carries `globalRun` / `globalDue` so the reply can say so. `{only:[...]}` checks never count
     as a run and never write the green memory.

   CHECKS
     globals            window hooks that the UI/handlers depend on exist
     plugins            root.generateHTML / uploadPlugin / kv / createServerSocket / generateText ready
     build-sync         the server script's SERVER_BUILD matches root.buildVersion (live-update beacon)
     navbar             the 8 navbar buttons are present
     pages              home → generate → character → gallery → history → account all switch + render
     overflow           no page scrolls horizontally by more than ~2px
     generate-ui        Generate button enabled, prompt textarea + select controls present
     public-gallery     .dragon-gal-panel visible, toolbar visible, tiles rendered
     gal-load-window    the load window is a budget in SCREENS and the tiles AROUND the viewport stay painted:
                        window.dragonGalTune.aheadScreens exists (one screen budget per mode), every tile ON
                        SCREEN carries .dragon-gal-cv-keep (content-visibility:visible, i.e. the browser may
                        NOT drop its picture while the visitor scrolls back to it), a tile well beyond the
                        window does NOT carry it (far-away tiles are still skipped = a phone stays smooth),
                        the number of eager tiles stays inside that screen budget (the 22.09 report: at
                        390x844 a 1-column phone marked 103 full-screen pictures eager = ~46 screens), and
                        --dragon-gal-intrinsic equals a tile's own width in the square display modes, so a
                        tile entering/leaving the band cannot change the page height. The paint pass is
                        THROTTLED (80 ms + rAF) and tiles arrive in painted slices, so the band may land a
                        few frames after the last tile of the first batch (measured: a cold run right after
                        a page load failed this while a warm one passed) - the check therefore waits
                        (bounded, 4 s) for the app's own schedule before it judges
     pager-idle         the batch pager does NOT advance while the visitor is on another page (a hidden
                        panel reports 0 for every rect, which used to read as "the visitor is at the tail"
                        and pulled the whole listing in the background)
     view-count-source  (Egon 23.09.2026) the exact count behind "N Loaded / M Total" is ALWAYS measured on the
                        FULL listing (sort=recent, skip=0) whatever ordering the visitor is on. The API's
                        "trending" ordering stops after a few hundred rows for a channel holding thousands;
                        measuring the count on it froze a real gallery at "456 Loaded / 456 Total" and the
                        pager then declared the view complete. The pager's overflow continuation loads the
                        rest (that is exercised by the pager itself); this item pins the count's source.
     lb-close-nomove    closing the lightbox does NOT move the page while the image that was being viewed is
                        still on screen - even by an edge. The old rule always re-centred the tile, which
                        dragged the whole gallery on desktop; the check pre-scrolls the page so that
                        centring WOULD have moved it (otherwise the assertion would prove nothing)
     gal-title          the gallery menu names a generator by its human-readable title with the random URL
                        slug in parentheses ("Ultra Realistic Human AI Image Generator (xpm54q50i6)"):
                        dragonGalTitle()/dragonGalDisp() exist, the snapshot resolves a known channel,
                        an unknown one falls back to its plain slug, the built menu really carries titled
                        rows, and every row splits into TWO lines — row 1 = "Gallery N", date/*New*, the
                        slug in parentheses, visits; row 2 = the title ONLY, CENTRED, with its own
                        parenthesised parts stripped (I92) AND its generic marketing phrases removed
                        (dragonGalTitleShown: "unlimited / no signup / free / stunning / text-to-image /
                        image generator …" never show; a title made only of them reads "AI image
                        Generator"; our own gallery keeps its full name); and the SEMANTIC NONSENSE GATE
                        (Egon 23.09.2026, W-UI233) drops a title that is a five-or-more-word word-salad with
                        no image/art/chat word in it at all ("vengeful bit regarding honored harbor"), so
                        such a gallery takes its URL-derived name or the neutral one; an untitled /
                        parenthesised-only title or an unknown channel keeps a single row with its slug
     gal-toolbar        the − / NNNpx / + tile-size control sits immediately LEFT of the 🏆 Best /
                        Recent / Trending menu in row 2 (not in row 1 any more); the ⤢ expand control
                        is RETIRED (Egon never asked for a button — he asked for the fixed-size gallery
                        button to show our own name in full), so there is none, window.dragonGalBtnFixed
                        {label(), width()} measures that width from our own label, and when our own
                        gallery is selected the button label is NOT truncated (scrollWidth<=clientWidth)
     gal-search-tools   the gallery menu's search box carries the 🎲 "open a random gallery" mini button
                        and, at its far right, our own red ✖ whose job here is CLEAR the search
     gal-sort-menu      the gallery-list sort menu is ordered the way a visitor thinks (Most Images ·
                        Newest Image · A→Z · Last Visited · Most Visited · Mix), its tooltip no longer
                        mentions the retired "Original" mode, and the SELECTED row is the vivid yellow
                        #ffe600 (not the muddy amber #ffd76a)
     gal-sub-chrome     the ↔ sorter AND the red ✕ "close every sub-channel" button only exist while the
                        gallery really HAS a sub-channel besides `public` (Egon 22.09.2026): with an
                        emptied scan record + no saved sub-channels + the active channel back on public
                        neither control is in the row and ➕ stays — the visitor's own row is restored
                        byte-exactly afterwards
     gal-sub-sort       the sub-channel row carries the ↔ sort ▾ mini menu (mails [365]/[367]):
                        exactly 3 modes (most images / A→Z / scan order), chip-sized, public always
                        first and the colour bands never mixed. Driven against a temporary scan record
                        (four known names whose three orders all differ, planted FIRST so the ↔ control is
                        guaranteed to be on screen) and restored byte-exactly — the check also proves the
                        choice is remembered in localStorage.dragonSubSortMode. Since 23.09.2026 those four
                        names are hidden by default (dragonSubHidden), so the test briefly flips the app's
                        `window.__dragonSubShowHidden` hatch to render them, and restores it on exit
     tile-range         the shared tile-size control spans 100–800px with AUTO and really is a
                        density control: 100px paints a dense wall (>=8 columns), 340px keeps the
                        familiar 2–6 column grid, 800px is one image per row; the visitor's own tile
                        size is put back afterwards
     marquee-lane       ONE scrolling-banner lane: window.dragonMarquee {request, release, busy, queued}
                        serialises the purple reload notice / Dexa's news ticker / the milestone banner
                        AND Dexa's speech bubble (a second announcement WAITS, then starts when the first
                        finishes), enforces the 2-MINUTE flood-control gap (gapLeftMs()/minGapMs, so a
                        visitor is never bombarded on arrival), the shared gesture helper exists, every
                        banner uses the Dexa head PICTURE (never 🐉), and dragonMarqueeText() strips the
                        dragon emoji
     reload-notice-wake (Egon 23.09.2026) the reload notice WAITS for a VISIBLE tab: while the document is
                        hidden the notice is PARKED (window.dragonVersionPending() names the build) and no
                        bar is painted; the tab becoming visible replays it through window.dragonVersionResume()
                        (the named action the real visibilitychange listener calls) as the purple bar, and
                        window.dragonStatsWake() — wired to visibilitychange / focus / pageshow / online —
                        asks for a fresh stats payload right then (reconnecting at once if the socket died),
                        so a returning visitor never sits on a stale build. Since 25.09.2026 that
                        "reconnecting" is enforced by the ZOMBIE-SOCKET WATCHDOG: a backgrounded phone can
                        come back with a socket that is dead but never fired `close` (every rpc promise just
                        never settles), and that is how a tab could run an old build for hours without ever
                        hearing about the new one. window.dragonStatsLinkStale() answers whether the link has
                        gone quiet for too long (90 s), and window.dragonStatsReconnect() throws that link
                        away and opens a fresh one, orphaning the old socket's handlers
     popup-region       (Egon 25.09.2026, W-EFOR282) the SERVER's POPUP region holds both copies in lockstep
                        at 30/32 MiB (272-byte records, 8 questions × 8 answers of u32 counters), the number
                        the server PUBLISHES (popupMmm) equals the number the page publishes
                        (window.DRAGON_POPUP.mmm), and the popup module's own test hook drives a throwaway
                        window: it opens, the answer that reveals a sub-question really opens it (and
                        dropping the answer hides it again, so a hidden question can never keep an answer
                        alive), it fits the viewport, it closes, and the "already seen" flag is left
                        untouched. A check-up RUN suspends the popup for its whole duration
                        (window.dragonPopupSuppress) so a question can never open over a measurement
     admin-page         (Egon 25.09.2026, W-EFOR282) the #closecodeadmin door is a FULL PAGE (never a window): it covers the whole viewport, is top-anchored, asks for a USERNAME + PASSWORD pair and the authorization is SERVER-SIDE (index.html 'ADMIN LOCK (W-UI222)'), a WRONG password is refused, counted and announced
                        while the window stays open (window.dragonAdminResetTries puts the counter back so
                        the check never eats the owner's attempts), closing restores the address, and the
                        report view — built with NO unlock through window.dragonAdminReportTest — draws its
                        KPI strip, one block per popup number and one answer table per question
     ban-vault            the Banned images tab lists the archived bans from the editable vault file with
          pictures and a per-row Unban: the section builds, the removal payload drops
          exactly the one entry, every drawn row carries its Unban button and the button
          opens the key prompt (all through the test hook - no credentials, no vault write)
     whatsnew           (Egon 25.09.2026, W-EFOR282) the 🆕 What's New card reads the SAME hand-written
                        `[U<number>] dd.mm.yyyy | …` notes the Update Notes feed reads (the check counts the
                        today+yesterday notes straight out of the document's own comment nodes and insists
                        the card agrees, and that the newest number it saw is the document's newest), then
                        measures the card: it builds, it fits the viewport, it offers "Got it", it closes,
                        and it spends neither the "already seen" number nor the popup lane
     undupe             Dedupe has a named opposite: window.dragonVaultDedupe() collapses same-prompt
                        copies and window.dragonVaultUndupe() shows every one of them again. The toolbar
                        button shows the SELECTED preference (🧬 while collapsed, 🔍 in Deep Dedupe,
                        ↩️ while expanded) in its glyph, tooltip and data-dragon-dedupe-state
     tools-buttons      every button of the Settings 🧰 Tools & Extras card uses OUR GENERAL GENERATOR
                        BUTTON DESIGN — the same gradient, #9b6bff border, radius and bold weight as the
                        card's own 🔍 Buttons & Legends button (they used to paint themselves grey; the
                        reference was the 🎨 Open Generator Themes button until Egon moved that one into
                        🖼 UI & Display as a special, theme-coloured button)
     settings-buttons   (Egon 23.09.2026) the ONE Settings button standard, in exactly TWO sizes: the BIG
                        one takes a whole line (100%) and the SMALL one shares a line (calc(50% - .2rem),
                        two per row). Every button of every Settings card (📦 About excluded via
                        .dragon-set-aboutcard) is EXACTLY 34px tall, .72rem / weight 700, white on the
                        purple theme — except the declared SPECIAL buttons (🗑️ purge · 🔢 gallery numbers ·
                        ⚡ load speed · 🖼️ background · 🎨 themes) which keep their own colours; the 🔧 UI
                        SCALE button carries the words AND the percentage and is always the LAST line of its
                        card; 🧰 Tools & Extras, 🖼 UI & Display and 💾 Data & Saves end on one shared bottom
                        edge (measured in JS) while on a phone each panel ends at its own last button
     page-headings      (Egon 23.09.2026; title reverted 23.10.2026) History and the Settings page ("⚙️ Settings") share one title standard
                        same size (1.5rem), same 800 weight, same colour, both centered and both the same
                        distance under the navbar
     chat-stamp         (Egon 23.09.2026) a message Dexa POSTS into the chat (the update-notes
                        announcement) carries a small centred "📅 DD.MM.YYYY · HH:MM" line at the TOP of
                        its bubble
     talk-bubble        Dexa's talking bubble starts at its first character and ends at its last: the box
                        hugs the text (width:max-content) and the reveal types the line from the first
                        character to the last one
     home-v7            the new Home style V7 "seamless": switching to it applies the v7 class and moves
                        the header into the CTA, the tiles are laid out by JS as JUSTIFIED rows (every
                        tile box keeps its image's own aspect ratio — nothing is cropped — the row
                        widths are exact and the rows abut with no gap), and leaving v7 clears those
                        inline positions again
     home-cta-reach     the home header/CTA is ALWAYS reachable (W-UX195): it either fits inside the page, or the
                        page really scrolls (scrollTop moves) and the bottom of the stack comes into view — a
                        phone in landscape used to push the lower half of the stack past the edge with no way
                        to scroll to it
     user-search        the 👤 user-search window (W-UI107) opens for a uid without touching the network,
                        shows that uid, fits the viewport, exposes dragonUserTag/Label and closes cleanly
     tabs-strip         the 🪟 tab mode (W-UI110) puts #dragonTabStrip as the gallery panel's FIRST child
                        (between the navbar and the toolbar rows, never overlapping it) and removes it
                        again when the mode is switched off
     mini-arrange       the 🖐 arrange mode (W-UI111) shows its guide bar, makes EVERY minimised button in
                        both rows draggable and visibly outlined, and clears all of that when switched off
     gal-justified      the new Justified display mode (W-LOC109): every full row spans the grid exactly, all
                        tiles inside a row share one height, and every image keeps its own ratio (no crop);
                        "Stretch" really is object-fit:fill; leaving Justified restores the normal grid
                        columns and clears the inline geometry
     private-vault      vault opens, toolbar rows present, tiles rendered, 💽 sits right of 🧬
     vault-menu         every ☰ menu row is wired to the site's own handler and labelled like Settings
     survey             the visitor survey window opens, the item list is full, every row and option
                        carries a description tooltip, the rate twin is there (in both views), the
                        result bars are all the same length, the rating rows really are in ONE ranking,
                        ordered by the confidence-adjusted like-ratio (W-DATA204 + its 23.09.2026 revision,
                        painted with a fabricated tally) while the first question keeps its own order, and
                        "Complete survey & show results"
                        morphs the SAME window into the results view at the same size
     chat               chat overlay opens with an input and closes again
     storage-dialog     💽 "Storage info" dialog opens and closes
     purge-scope        the destructive purge deletes ONLY registered BESTAIGEN keys (run on mocks): owned
                        keys are removed, foreign keys (framework/platform/plugin) survive, and the live
                        plan the dialog displays agrees with the registry
     visitor-stats      the Settings 📊 Visitor Stats board: the server's durable online-history rpc
                        answers with both rings and a sample for the current minute, the canvas really
                        draws, the day button switches the view, and the hover tooltip opens BELOW the
                        pointer (free movement — the old in-chart-box clamp was removed by owner request)
                        while never leaving the viewport
     visitors-merge     the Settings 🌐 Visitors panel lives INSIDE the 📊 Visitor Stats card (one combined
                        panel, no stand-alone card) and its country chips render and follow a synthetic
                        payload
     visitor-devices    the 🌐 Visitors row again carries the PINNED mobile/desktop pair (W-UX271): two chips
                        of the flag-chip family, a plain-emoji symbol, a CLEAN one-sentence tooltip, pinned
                        first in the row, surviving a country rebuild and hiding itself at zero
     kissing-standard   controls in the gallery/vault toolbars are equal-height with ~0 gap
     chat-close         only the ACTIVE chat channel carries the ✕ close control, and only when that
                        channel is one the visitor added themselves (the generator's own default
                        rooms are never closable); it is laid out inside the tab row (not clipped) and
                        clicking it really removes the visitor's own room (its stored custom-channel
                        entry is dropped). The temporary room used by the test is cleaned up after.
     toolbar-collapse-guard  while the 🧰 toolbox is open the toolbar auto-collapse is deferred
     self-test-sweep    user-style sweep of every page: horizontal overflow, visible placeholder text
                        ("undefined"/"NaN"/"[object "), broken <img>, duplicate ids, unnamed/tiny buttons
     print-editor       the EDITOR (✏️ Image Editor) opens directly from the picture: 📝 Add prompt / 📅 date /
                        🔗 page link are badge-less until pressed (then each grows a green ✓ badge) and
                        Add prompt leaves the panel on "My text", "Prompt view" swaps the writing area for a
                        styleable read-only prompt, a text colour swatch, a FONT dropdown in which every row
                        previews its own face and the closed select wears the chosen one (Egon 25.09.2026),
                        draggable emoji page-objects with
                        −/＋ sizing, Fit meeting the longer edge with NO canvas seam (a hair of overlap),
                        the site-standard 1 %-per-press zoom that speeds up while held, Cover/Centre,
                        A6…A0 + real poster papers, A4 + image turns, a DIAGONAL resize square whose text
                        stays proportional to the box, ↺ Default beside ↻ Image (the old ↺ Original is gone),
                        ↺ Reset right of ✖ Cancel (undoes the whole edit, keeps a 💫 upscaled picture),
                        alignment guides with the four px gaps while a box is held, and the editor's own
                        🖌️ Retouch Brush button
     site-search        ONE "🔍 Buttons & Legends" window: its single box narrows BOTH the whole
                        generator's live controls AND the legends directory, the rows carry no ▶ chip, and
                        a hit is opened on its page, scrolled to and flashed
     picture-comments   (Egon 23.09.2026) the 💬 comment module is loaded (open/close/badges/key/shared
                        socket/popover/counts/prefetch/name/uid) and the panel is the NEW one: NO nickname
                        box (the visitor's own SYSTEM name is used and shown as a fact in the 🪪 chip), a
                        comment box + Send, and the "one comment per picture — you can edit yours any time"
                        note; a picture's key is stable and per-picture and the visitor's id is stable
                        (the server hashes it, so nothing personal travels with a comment)
     image-sort         (Egon 23.09.2026, W-CLEAN374 09.10.2026: Commented / Popularity parked out
                        of the menu; W-LIKEDSORT 10.10.2026: Liked is BACK, public gallery only) the image
                        sort menu carries the FOUR shipped modes in order —
                        🏆 Best · 🔜 Recent · 🔥 Trending · ⭐ Liked — the VISIBLE button's tooltip reads exactly
                        "Image Sort" (the hidden <select>'s title must reach the button, or the hover text
                        never shows), 🔥 Trending really renders tiles, and the visitor's stored sort is
                        restored afterwards
     liked-count        (Egon 23.09.2026) the ⭐ press casts a real, DURABLE vote in the generator's own
                        server region (src/dragon-likes.js + the PICTURE LIKES block in index.html's server
                        script): the hooks exist, one visitor is worth exactly ONE point (a repeat press
                        changes nothing), a second visitor makes it two, un-starring takes the vote back
                        (1 → 0), a picture with no likes is simply absent from the counts payload, and the
                        gallery's ⭐ Liked mode shows ONLY tiles whose count is above zero — all measured
                        with a throwaway key, so no real picture is touched
     likes-live         (Egon 23.09.2026) the ⭐ counts are LIVE: with a gallery on screen the page holds
                        the server's pub/sub channel (one shared socket on the open gallery), every rebuilt view FORGETS the 60 s count
                        cache (this is the fix for the reported "a like from my phone only appeared after
                        F5": Refresh Gallery and a sort switch now really re-ask), and a vote cast by
                        ANOTHER visitor lands on this screen through the push in well under the 30 s poll
                        window — measured on a fixed throwaway picture, so nothing real is touched
     like-backfill      (Egon 23.09.2026, W-CLEAN374 09.10.2026: the back-fill path retired with the HOF
                        registry) the thin VOTE CONTRACT a like still stands on: the back-fill hook is
                        gone, one RPC vote counts exactly one (the client cache and the plain comma query
                        form agree), a repeat press changes nothing, and taking the vote back restores
                        zero — all measured with a throwaway key, so no real picture is touched
     likes-ledger       (Egon 23.09.2026, W-CLEAN374 09.10.2026: registry + month ledger retired) the LIKES
                        PERMANENT LEDGER: the like log keeps its SECOND, independent copy at an ABSOLUTE
                        address and no destructive version guard anywhere. Read-only probe of
                        `dragonLikesDiag`: both like-log copies carry the right version, report no damaged
                        tail, and AGREE with each other; a REAL vote raises BOTH copies by one (proving the
                        mirror is written by the live path, not only by the boot pass); taking that vote
                        back restores BOTH copies; and the never-cleared repair log is reported with the
                        number of pairs it recovered. The same diagnostic ALSO carries the 💬 COMMENTS'
                        mirror ("bir daha yorum silinmesin"): the comment log and its absolute copy must
                        carry the same version, report no damaged tail, hold the same record count and be
                        byte-identical over the records
                        records
     dexa-context       (Egon 23.09.2026, W-DATA188) DEXA'S SITE KNOWLEDGE: the static site/system context
                        Dexa answers from (src/dragon-dexa-ui.js) NAMES every one of the systems the
                        visitor survey lists, keeps the sections that are easy to lose in an edit (the
                        survey itself, the retouch brush, the private gallery, and the
                        "say you are not certain instead of guessing" honesty line), and really reaches
                        the prompt that is sent — proved offline, with no generation spent
     dexa-persona       THE AUTHORED CHARACTER CARD (src/dragon-persona.js): the full 72-axis personality
                        registry (8 categories) is present, the companion carries a complete 1-10 profile
                        (no missing or out-of-range axis), each card carries a look, an image-prompt phrase
                        and a reference image, each card block reproduces the look and all 72 axis rows, and
                        the active companion's card really reaches the prompt the reply is built from —
                        proved offline, with no generation spent
     dexa-legends       (Egon 23.09.2026, W-UI189) DEXA SHOWS THE LEGENDS BUTTONS: the grid she draws on a
                        [[legends]] reply (src/dragon-dexa-ui.js) offers the site's own buttons in two
                        groups, every entry carries an icon, an ENGLISH label (plain ASCII, like the navbar) and the
                         selector chain that finds its
                         REAL control, the marker is stripped out of the visible reply AND taught in the
                         prompt, and tapping a chip navigates to that control's page — driven on a
                         throwaway bubble, no generation spent
     dexa-auto-highlight (Egon 23.09.2026, W-UI219) THE ANSWER PICKS THE CHIP: the deterministic
                        answer→chip scorer (question + answer, English + Turkish, weighted) maps anket/istatistik/update
                        notes/gallery/likes to the right chip and returns NOTHING
                         for unrelated text; a drawn grid lights EXACTLY the one relevant chip and an
                         unrelated reply lights NONE — throwaway bubble, no generation spent
     dexa-feature-tip   (Egon 23.09.2026, W-FEAT193 / rule I122) DEXA'S UNUSED-FEATURE TIP: the 3-4 hour
                        window, the 11 main features she tracks from the app's own signals, the
                        no-repeat rotation (a hinted feature is never offered twice, a used one drops
                        out) and the 14-language templates (2 each, no unfilled placeholder) — all read
                        through the test hooks, with the visitor's own tip ledger restored in the finally
      news-detail        (Egon 23.09.2026, W-UI180) THE INTERACTIVE UPDATE-NOTES WINDOW: every news row is a
                         button that opens the note's OWN window — as wide as the panel, with the FULL text
                         (never truncated) and a footer whose page button sits ABOVE the back-arrow/done
                         row. Escape closes ONLY the note window (the list stays behind it), and the page
                         button closes every window and switches to the page the note is about. The
                         deterministic note→page mapping is driven on 7 cases (one of which names no page),
                         no generation is spent, and the visitor's page is restored
     gal-menu-fit       (Egon 23.09.2026) the phone's row-1 gallery menu button is WIDTHED to the three
                        buttons under it + 18px on EACH side with its label really centred (and the
                        collapsed toolbar's twin gallery menu centres its label the same way); on a desktop
                        the mobile fit leaves NO residue behind (no !important width / justify-content /
                        label flex left over from a phone session); and the W-UI233 BAR RULE holds — a
                        gallery name that does not fit the bar is never clipped, it takes the neutral
                        "Other Generator Gallery" (window.dragonGalBarFit) instead
     collage            (Egon 23.09.2026, W-UX157; button moved by W-UI234 follow-up) THE COLLAGE EDITOR
                        (src/dragon-collage.js): the 🧩 Collage button really sits in the ✏️ Image Editor
                        (and NOT in the public gallery toolbar any more), its picker reads only the
                        visitor's own gallery, all six automatic patterns (2×2, 3×3, vertical strip,
                        horizontal band, mosaic, spotlight) place EVERY picture with the layout covering
                        the whole canvas and each layout distinct, a picture can be dragged on the canvas,
                        a copy can be added from the left strip, and "Done" renders a REAL PNG whose pixel
                        size follows the chosen aspect (1600×1200 for 4:3, 1600×900 for 16:9) — driven
                        entirely on throwaway canvas pictures, so nothing is uploaded and no generation
                        is spent
     retouch-brush      the 🖌 local retouch brush opens a full-screen editor (Paint / Clone / Undo /
                        Reset / Done + size slider + colour picker) on a canvas sized to the picture, its
                        cursor RING (circle with a +) sits exactly under the pointer, clone mode refuses a
                        left click before a sample and a right click marks the sample; Escape closes it
                        (Done is never pressed — it uploads)
     saver-clean        (Egon 23.09.2026 rev.2) the screen saver carries NO corner control any more: the
                        ⛶ fullscreen button that used to live inside the overlay is GONE (a button inside a
                        screen that any input dismisses can never be pressed) — the overlay is exactly the
                        picture frame, the clock and the dismiss hint, and the two LOOKS are a Settings
                        choice instead (saver-style)
     saver-style        the saver's two presentations are a REAL Settings choice (#dragonSsStyleBtn, in the
                        saver block of 🧰 Tools & Extras: 🖼️ Screen Saver + 🌧 Rainy Only as a half-width
                        pair, the presentation button full width under them, all three 34px — the card
                        standard, no third "fit-content" size), labelled v1 = framed / v2 = fullscreen per
                        Egon's numbering — a press flips the overlay's frame class, the label and the
                        remembered localStorage value together. It also proves the SMALL labels FIT: the two
                        half-width labels are the short pair ("🖼️ Saver: 5m" / "🌧 Rainy: On", full wording
                        in the tooltips), and NO saver label may be clipped (scrollWidth > clientWidth)
     rainy-saver       the 🌧 Rainy toggle sits on the SAME line as the saver cycle button (the small
                        pair) and swaps the slideshow to the rainy pool + starts the animated rain layer
     duplicate-ids      no duplicate element ids in the document
     legends-sync       LEGENDS ↔ LIVE CONTROLS (rule I116 + W-UI190): the legends data is readable on a cold
                        page, it is well-formed (no nameless/thin/duplicate rows, ≥8 sections, ≥100 rows), the
                        merged "🔍 Buttons & Legends" window really paints every row while its search box is
                        empty, and the live navbar/Settings control list has not grown past the accepted
                        baseline — a new control without its 📖 row fails until window.dragonLegendsSyncAccept()
                        records it; the count of visible controls still lacking a legend is ratcheted too
     survey-sync        SURVEY ↔ LIVE SYSTEMS (rule I117 + W-DATA191): the survey's item list (and its retired next-feature list) are exposed, every row carries symbol/name/description with no
                        duplicates, every system it names still exists in the live controls or the legends, and
                        the number of items is ratcheted (a system cannot silently fall out of the survey —
                        window.dragonSurveySyncAccept() records a deliberate smaller survey)
     console-clean      nothing was logged to console.error / onerror / rejection

   Everything is per-user and local; nothing leaves the device.
   ========================================================================== */
(function () {
  "use strict";

  if (window.dragonCheckup && window.dragonCheckup.__v) return;

  // ⚙️ 2.14.0 = the five wall modes (tile-walls). 2.14.1 = the mixed hole check no longer counts a ragged
  // TAIL as a hole (it measured at some widths before the last block; see checkTileWalls).
  // 2.14.2 = gal-sub-sort survives the hidden junk sub-channels (W-UI201): it briefly opens the app's
  // `window.__dragonSubShowHidden` hatch, waits for the app to be wired on a cold page, retries the
  // outside tap, and no longer leaves the menu toggled open for the next run.
  // 2.15.0 = CATEGORIES + GREEN CYCLE (Egon's check-up rule, 23.09.2026): every check carries a category,
  // the Logbook record is grouped by category (`window.dragonCheckupByCategory`), a check clean three runs
  // in a row is skipped while its own source is unchanged, and every 20th run is a forced GLOBAL check-up.
  // 2.16.0 = legends-sync + survey-sync (W-UI190 / W-DATA191), survey like-ratio ordering (W-DATA204), home-cta-reach
  // (W-UX195) and the stacking-order repair: the Hall-of-Fame page is opened through dragonHofOpen() (dragonGoPage
  // alone never builds it) and the order is measured even when the list is empty.
  // 2.16.1 = two false failures found by the first full run at 390x844:
  //   (a) gal-load-window waits (bounded) for the app's own size-sync pass before comparing
  //       `--dragon-gal-intrinsic` with a tile's width: right after a resize or a page change the property can
  //       still hold the previous layout's number for a moment, which failed a check that only ever meant to
  //       measure the settled geometry. The app side was made robust too (the eager window's pass now has a
  //       timer backing up its animation frame, so a throttled frame cannot leave the geometry stale).
  //   (b) legends-sync's ratchet now measures the RULE (a visible navbar/Settings control must carry a 📖
  //       row) instead of the raw control COUNT: `undoc` must not grow, a legends row or a navbar item must
  //       not vanish. The count was state-dependent — the board's live lists (news lane, visitor list) grew
  //       while it stayed open (52 → 107 → 118 in one session) and an expanded card briefly put its own
  //       (documented) controls in scope (55 measured in a full run) — and it also stops CLOSING the board
  //       another check left open (the Settings item toggles, so a blind click had it measuring the bare
  //       navbar's 8 controls).
  //   v2.16.6 → v2.16.7 (Egon 23.09.2026): the Dexa legend chips are PLAIN ENGLISH, exactly like the
  //       navbar labels (Egon: "shouldn't these be in English like the navbar? ... I think just make it English
  //       skip it."). The 14-language label tables are gone; `dexa-legends` now asserts a non-empty
  //       ASCII English label on every entry AND on both group titles.
  //   v2.16.3 → v2.16.4 (Egon 23.09.2026, PAKET E): two new items — `dexa-legends` (W-UI189) and
  //   `dexa-feature-tip` (W-FEAT193) — both deterministic (no generation spent, the visitor's own badge/tip
  //   state read before the run and restored in the `finally`).
  //   v2.16.7 → v2.16.8 (Egon 23.09.2026): two changes. (a) The survey results are ONE ranking ordered by
  //       the CONFIDENCE-ADJUSTED like-ratio (the Wilson lower bound in src/dragon-visitor-survey.js)
  //       instead of the raw percentage, so a one-vote "100%" row can no longer sit above a system with a
  //       real following; `survey` still proves the ordering really happened (fabricated tally, no write).
  //       (b) NEW `dexa-here-target` (W-UI219): a feature chip must light its OWN button, never the navbar
  //       item that merely opens the page that button lives in — asserted structurally and driven for real
  //       on the survey chip (page + badge ledger restored in the finally).
  //   v2.16.8 → v2.16.9 (Egon 23.09.2026, W-DATA223): the survey results are ONE ranking ordered by the
  //       TOTAL like COUNT (highest first), NOT by ratio or the Wilson score — Egon's final word. The
  //       coloured bars are REMOVED and every row shows "thumbsUp N (P%) thumbsDown M"; `survey` now
  //       asserts no bars remain and that a fabricated tally is ordered by like count (no write).
  //       (W-UI224, same build) The Visitors panel is MERGED into the Visitor Stats card (its list
  //       now lives INSIDE #dragonStatsCard), and the hover tooltip never opens under the pointer: on a
  //       MOUSE it opens down-and-left with the cursor at its top-right corner, on TOUCH it opens ABOVE the
  //       finger. `visitors-merge` asserts the merge; `visitor-stats` asserts the new tooltip placement.
  //   v2.17.0 (Egon 23.09.2026, W-CLEAN218): the 📱/💻 visitor-device split was rolled back and parked
  //       (Librarybook DEPO), so the old `visitor-devices` item was rewritten as `visitors-merge`, which
  //       keeps the W-UI224 merge assertions and drops every device claim. (RESTORED 24.09.2026, W-UX271:
  //       the pair is back with a new symbol and `visitor-devices` returns — see v2.17.15 above.)
  //   v2.17.0 → v2.17.1 (Egon 23.09.2026, W-UI219): the Dexa reply now LIGHTS THE ONE chip it is about.
  //       `dexa-auto-highlight` proves the deterministic answer→chip scorer (question + answer, English +
  //       Turkish) maps anket/istatistik/notes/gallery/likes to the right chip, returns NOTHING for
  //       unrelated text, and that a drawn grid lights exactly one (or zero) chip — the visitor's badge
  //       ledger restored in the finally, no generation spent.
  //   v2.17.1 → v2.17.2 (Egon 23.09.2026, W-DATA174): the Hall of Fame's ⭐ number now MATCHES the order it
  //       ranks by. `hof-order` proves the feed is ordered by like count (a seeded 3-like picture outranks
  //       a 1-like one, the whole `n` column non-increasing), that every drawn tile's ⭐ number equals its
  //       data-dlk-count, and that a HoF tile prefers that ranking count while a gallery tile keeps the
  //       all-time ledger (throwaway votes, wiped after).
  //   v2.17.2 → v2.17.3 (Egon 23.09.2026, W-UI172): `display-matrix` drives ALL 11 modes in BOTH galleries
  //       (the walk alternates wall<->row so the transition is covered too), asserting the stored key, the
  //       marked menu row and a per-mode geometry signature. It caught the private gallery leaving its tiles
  //       absolutely positioned when a wall mode was followed by Justified/Default (fixed: dragonVaultClearWall).
  //   v2.17.3 → v2.17.4 (Egon 23.09.2026, W-SOC183): the public channel's number is the channel's OWN auto-count
  //       (refreshed when the galleries page opens / the gallery changes — never the sub-channel scan, I101),
  //       so a static snapshot can no longer leave it stuck; a stale scan record cannot win, and a capped count
  //       reads "+10200". `pub-count` proves the chip rule + the ceiling display + that the count really answers.
  //   v2.17.4 → v2.17.5 (Egon 23.09.2026, W-UI180): the update notes are now INTERACTIVE — every row opens the
  //       note's own window (full text) whose footer carries the page button ABOVE the done row, and pressing
  //       it closes every window and switches to that page. NEW check `news-detail` (category shell)
  //       proves the mapping + the window + the navigation, restoring the visitor's page.
  //   Egon 22.10.2026: the one-time "I'm HERE" badge + purple glow (rule I114, W-UI194) is retired —
  //       no control is marked anymore; the `here-badge` and `dexa-here-target` checks are removed.
  //   v2.17.5 → v2.17.6 (Egon 23.09.2026, W-UX157): the 🧩 COLLAGE editor (src/dragon-collage.js) — picker
  //       (public/private, multi-select) + 6 automatic patterns + free drag-and-drop + PNG export. NEW check
  //       `collage` (category media-tools) drives the whole feature through throwaway pictures.
  //   v2.17.7 (Egon 23.09.2026, W-UX157): the `collage` coverage assertion now measures TRUE canvas coverage
  //       (sum of tile areas / 100, not raw percent-squared), so a full-bleed layout reads 100%.
  //   v2.17.8 (Egon 23.09.2026, gallery speed batch): `hall-of-fame` became DATA-ROBUST. The ranking
  //       endpoint returns at most 60 rows and the shared preview server's like ledger keeps growing, so the
  //       old "my seeded 1-like picture must be inside the top 20" assertions reported a regression that was
  //       really just a deeper ledger (measured: the seeds had sunk below the 60th row). The seeds are still
  //       verified exactly whenever they ARE in the window, and otherwise the check falls back to the
  //       property that can always be judged from the returned rows: ranked by like count, descending.
  //   v2.17.9 (Egon 23.09.2026, capped-ordering batch): NEW `view-count-source`. The gallery reported "456
  //       Loaded / 456 Total" and stopped: the API's "trending" ordering only exposes ~500 rows for a channel
  //       that really holds 1 755, and BOTH the count probe and the drained-branch had used the ACTIVE
  //       ordering (so a capped number became the total and was written into the per-filter statistic). The
  //       count is now always measured on the FULL listing, and the pager continues on it (the overflow pass)
  //       when a capped ordering drains. The item pins the count's source.
  //   v2.17.11 (Egon 23.09.2026): `bottom-count` REMOVED — the shared "📊 N Loaded / N Total" pill that had
  //       been added to the Hall of Fame pages and to the private gallery was REVERTED at Egon's request (it
  //       made the private gallery feel slower). `gal-title` keeps the SEMANTIC NONSENSE GATE, `gal-menu-fit`
  //       keeps the W-UI233 bar rule, and `collage` keeps its Image Editor home.
  //   v2.17.11 → v2.17.12 (Egon 23.09.2026, "bir daha yorum silinmesin"): `likes-ledger` now ALSO probes the
  //       comments' own mirror (dragonLikesDiag's new `cmt` field): the comment log and its absolute copy
  //       carry the same version, report no damaged tail, hold the same record count and are byte-identical
  //       over the records — a mirror that stopped being written shows up HERE as a lower count.
  //   v2.17.12 -> v2.17.13 (Egon 23.09.2026): the run wrapper PINS the gallery sort while a check-up runs.
  //       The two LOCAL filter modes (Commented/Liked) are filters over the listing and legitimately show an
  //       empty grid while nothing carries a comment/like, so a persisted dragonGallerySort = "commented"
  //       answered "no public gallery tiles" on a global run and turned five gallery checks red for nothing.
  //       The visitor's own sort is snapshotted before the run and restored byte-exact afterwards.
  //   v2.17.13 -> v2.17.14 (Egon 23.09.2026, same rule I129, the LOOK settings): the gallery checks switch
  //       the display mode dozens of times and each restores its own value, but over a FULL run the public
  //       gallery still ended up on "cover" (a race between a check's restore and an earlier check's pending
  //       repaint). The run now snapshots dragonGalDisplay / dragonVaultDisplay / dragonGalleryFilter and
  //       puts all three back byte-exact in the finally, so no check-up can change how the visitor's
  //       galleries look.
  //   v2.17.14 -> v2.17.15 (Egon 24.09.2026, W-UX271 + W-UI270): the mobile/desktop device pair is back in
  //       the 🌐 Visitors row, so `visitor-devices` returns (two emoji chips, a clean tooltip, pinned
  //       first, survives a rebuild, hides at zero) and `visitors-merge` drops its "no device pair" claim.
  //   v2.17.15 -> v2.17.16 (Egon 24.09.2026, W-UI116 second round): `mini-arrange` now also drives the REAL
  //       💡 Tips button — into the top strip and then into the description column — and fails if a moved
  //       button snaps back home or loses its grip; the ↺ Return-to-default button is excluded from the
  //       movable-button count (it is data-dm-locked on purpose), and the green-cycle restore puts the
  //       in-memory "arrangement active" flag back exactly as it found it.
  //   v2.17.16 -> v2.17.17 (Egon 24.09.2026, W-DATA249 + the 24-hour trending rule): the NEW `popularity-region`
  //       item probes the trending score copies (lockstep mirror at 24/26 MiB), the 24 h window rule (no
  //       live row may sit outside it, and the hourly sweep must have recorded the current hour) and the
  //       weight table — and it exercises the live ingest path with a signal kind the server must ignore,
  //       which proves the write path works without leaving a single byte behind.
  //   v2.17.17 -> v2.17.18 (Egon 24.09.2026, W-DATA249 round two): the DETERMINISM PIN (I129) now also covers
  //       "trending" — 🔥 Trending is the THIRD local filter mode, so a visitor whose persisted sort is
  //       trending would otherwise have the gallery checks measured against an empty wall (measured: the
  //       `image-sort` check went red with "no public gallery tiles rendered"); `image-sort` also gained a
  //       real 🔥 Trending leg (every on-screen tile must carry a score inside the 24 h window).
  //   v2.17.18 -> v2.17.19 (Egon 25.09.2026, W-EFOR282): the new `popup` category. `popup-region` probes the
  //       server's POPUP region (both copies in lockstep, the 272-byte record / 8×8 matrix, and the number
  //       the server PUBLISHES must equal the number the page publishes), then drives the module's own test
  //       hook: it opens a throwaway window, proves the reveal link both WAYS (picking the answer opens the
  //       sub-question, dropping it hides it again), and proves the once-only flag was NOT spent. `admin-page`
  //       proves the #closecodeadmin door exists, that the page is not in the hash router, that a WRONG
  //       password is refused and counted while the window stays open, that closing it restores the address,
  //       and it builds the report view with no unlock at all to measure its KPI strip and tables.
  //       `whatsnew` counts the today+yesterday notes straight out of the document's own comment nodes and
  //       insists the card reads exactly the same list, then measures the card (fits, \u201CGot it\u201D, spends
  //       nothing). A check-up RUN suspends the popup (dragonPopupSuppress) so a question can never open
  //       over a measurement, and the visitor's own chance is not spent by that.
  var VERSION = "2.17.20";
  var TIMEOUT = 9000;          // ms a single waitFor step is allowed to take
  var TOL = 2.5;               // px tolerance for the kissing standard
  var _panelOpenRestore = null; // a check that opens a panel registers its own DOM restore here (run() calls it)
  var OVERFLOW_TOL = 2;        // px horizontal overflow allowed

  /* --------------------------------------------------------------- helpers */
  function now() { return (window.performance && performance.now) ? performance.now() : Date.now(); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function q(sel, root) { try { return (root || document).querySelector(sel); } catch (e) { return null; } }
  function qa(sel, root) { try { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); } catch (e) { return []; } }
  function isVisible(n) {
    if (!n) return false;
    if (n.hidden) return false;
    var r = n.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    var cs = window.getComputedStyle(n);
    return cs.display !== "none" && cs.visibility !== "hidden" && Number(cs.opacity) > 0;
  }
  function pageAttr() { try { return document.documentElement.getAttribute("data-dragon-page"); } catch (e) { return null; } }
  function bv() { try { return String((window.root && window.root.buildVersion) || "").replace(/^"|"$/g, "") || "?"; } catch (e) { return "?"; } }
  function overflowPx() {
    try { return Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth); }
    catch (e) { return 0; }
  }
  function fail(msg) { throw new Error(msg); }
  async function waitFor(fn, ms, step) {
    ms = ms || TIMEOUT; step = step || 150;
    var end = Date.now() + ms;
    for (;;) {
      var v = null;
      try { v = fn(); } catch (e) { v = null; }
      if (v) return v;
      if (Date.now() >= end) return null;
      await sleep(step);
    }
  }

  /* -------------------------------------------------- launch-time error net */
  function fmtArg(a) {
    if (a == null) return String(a);
    if (typeof a === "string") return a;
    if (a instanceof Error) return a.message || String(a);
    try { return JSON.stringify(a); } catch (e) { return String(a); }
  }
  function captureErrors(sink) {
    var origErr = console.error;
    console.error = function () {
      var parts = Array.prototype.map.call(arguments, fmtArg).join(" ");
      sink.push({ type: "console.error", text: parts.slice(0, 400) });
      return origErr.apply(console, arguments);
    };
    var origOnerror = window.onerror;
    window.onerror = function (msg, src, line, col, err) {
      sink.push({ type: "window.onerror", text: (String(msg) + " @" + (src || "?") + ":" + (line || 0)).slice(0, 400) });
      if (typeof origOnerror === "function") { try { return origOnerror.apply(this, arguments); } catch (e) {} }
    };
    var onRej = function (e) {
      var r = e && e.reason;
      sink.push({ type: "unhandledrejection", text: (r && (r.message || r)) ? String(r.message || r) : "rejection" });
    };
    window.addEventListener("unhandledrejection", onRej);
    return function restore() {
      console.error = origErr;
      window.onerror = origOnerror;
      window.removeEventListener("unhandledrejection", onRej);
    };
  }

  /* ------------------------------------------------------------- geometry */
  function kissOfRow(row) {
    var kids = Array.prototype.slice.call(row.children).filter(isVisible);
    // Egon 22.09.2026 (check-up v2.3.1) — measure the VISUAL order, not the DOM order. A toolbar row may
    // lay its children out with flex `order` (the mobile gallery split does exactly that: the three
    // buttons drop below the gallery-menu line in a requested sequence), and then DOM order is no longer
    // the order on screen — reading it produced a phantom "worst gap 75.6px" between two buttons that
    // are in fact adjacent. A geometry test must read geometry; the thresholds are unchanged.
    kids.sort(function (a, b) {
      var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      if (Math.abs(ra.top - rb.top) > 2) return ra.top - rb.top;
      return ra.left - rb.left;
    });
    if (kids.length < 2) return { n: kids.length, spread: 0, gap: 0, hs: [] };
    var hs = kids.map(function (k) { return k.getBoundingClientRect().height; });
    var spread = Math.max.apply(null, hs) - Math.min.apply(null, hs);
    var gap = 0;
    for (var i = 1; i < kids.length; i++) {
      var a = kids[i - 1].getBoundingClientRect(), b = kids[i].getBoundingClientRect();
      if (Math.abs(a.top - b.top) < 2) gap = Math.max(gap, b.left - a.right);
    }
    // Keep the per-control heights so a failure can NAME the odd one out instead of only reporting a spread
    // (a bare "2.6px" is not actionable - the labels are what tell you which control is the wrong size).
    var labels = kids.map(function (k) {
      var t = (k.getAttribute("aria-label") || k.getAttribute("title") || k.textContent || "").replace(/\s+/g, " ").trim().slice(0, 14);
      return (k.id || (k.className || "").toString().split(" ")[0] || k.tagName.toLowerCase()) + (t ? "[" + t + "]" : "");
    });
    return { n: kids.length, spread: spread, gap: gap, hs: hs, labels: labels };
  }
  function worstKiss(rows) {
    var out = { spread: 0, gap: 0, rows: 0, controls: 0, worst: "" };
    rows.forEach(function (row) {
      if (!row) return;
      var m = kissOfRow(row);
      if (m.n < 2) return;
      out.rows++;
      out.controls += m.n;
      if (m.spread > out.spread) {
        out.spread = m.spread;
        out.worst = "row ." + ((row.className || "").toString().split(" ")[0] || row.tagName.toLowerCase()) + " "
          + m.hs.map(function (h, i) { return (m.labels[i] || ("#" + i)) + "=" + h.toFixed(1); }).join(" ");
      }
      out.gap = Math.max(out.gap, m.gap);
    });
    return out;
  }
  function controlSpread(container) {
    var cs = qa("button,select,input", container).filter(isVisible);
    if (cs.length < 2) return 0;
    var hs = cs.map(function (c) { return c.getBoundingClientRect().height; });
    return Math.max.apply(null, hs) - Math.min.apply(null, hs);
  }

  /* ------------------------------------------------------------- checks */
  var HOOKS = [
    "dragonGoPage", "dragonChatOpen", "dragonChatClose", "dragonVaultOpenStorageInfo",
    "dragonVaultBackupSave", "dragonNormalizePromptKey", "dragonVaultDedupeButton",
    "dragonPublicDedupeButton", "dragonVaultDedupeApply", "dragonAccountOpen",
    "dragonHistoryPanel", "dragonOpenCharPanel"
  ];
  function checkGlobals() {
    var miss = HOOKS.filter(function (n) { return typeof window[n] !== "function"; });
    if (miss.length) fail("missing hook(s): " + miss.join(", "));
    return HOOKS.length + " window hooks present";
  }

  function checkPlugins() {
    var r = window.root || {};
    var need = [["generateHTML", "function"], ["uploadPlugin", "function"], ["createServerSocket", "function"], ["generateText", "function"], ["kv", "object"]];
    var bad = need.filter(function (p) { return typeof r[p[0]] !== p[1]; }).map(function (p) { return p[0] + "=" + typeof r[p[0]]; });
    if (bad.length) fail("root plugin(s) not ready: " + bad.join(", "));
    return "root plugins ready (build " + bv() + ")";
  }

  function checkBuildSync() {
    var tag = q('script[type="text/x-server-plugin"]');
    if (!tag) fail("server script (<script type=\"text/x-server-plugin\">) not found in the document");
    var m = /const\s+SERVER_BUILD\s*=\s*"([^"]+)"/.exec(tag.textContent || "");
    if (!m) fail("SERVER_BUILD not found in the server script");
    var mine = bv();
    if (m[1] !== mine) fail("server build \"" + m[1] + "\" != buildVersion \"" + mine + "\" (bump them together!)");
    return "server build == buildVersion (" + mine + ")";
  }

  async function checkNavbar() {
    var items = qa("button.dragon-nav-item");
    if (items.length < 6) fail("only " + items.length + " navbar buttons found");
    return items.length + " navbar buttons";
  }

  var PAGE_MARKERS = [
    ["home", "#dragonHomePage"],
    ["generate", ".dragon-gen-btn"],
    ["character", ".dragon-char-wrap"],
    ["gallery", ".dragon-gal-panel"],
    ["account", ".dragon-account-page"]
  ];
  async function checkPages(ctx) {
    var seen = [];
    for (var i = 0; i < PAGE_MARKERS.length; i++) {
      var name = PAGE_MARKERS[i][0], sel = PAGE_MARKERS[i][1];
      window.dragonGoPage(name);
      var ok = await waitFor(function () { return pageAttr() === name && isVisible(q(sel)); }, TIMEOUT, 150);
      if (!ok) fail("page '" + name + "': attr=" + pageAttr() + ", marker " + sel + " is " + (isVisible(q(sel)) ? "visible" : "missing/hidden"));
      ctx.overflow[name] = overflowPx();
      seen.push(name);
    }
    // 📝 Egon 26.09.2026 — "history" is NOT a page any more (the old History page was deleted). The
    // "history" route must land on the Generate page with the 📝 PROMPT PANEL open, so it gets its own
    // assertion instead of a PAGE_MARKERS row.
    window.dragonGoPage("history");
    var panelOk = await waitFor(function () { return pageAttr() === "generate" && isVisible(q("#dragonHistoryPanel")); }, TIMEOUT, 150);
    if (!panelOk) fail("the 'history' route did not open the 📝 Prompt Panel on the Generate page");
    ctx.overflow["history"] = overflowPx();
    seen.push("history->promptpanel");
    return seen.join(" -> ");
  }

  function checkOverflow(ctx) {
    var bad = [], max = 0, min = 0;
    Object.keys(ctx.overflow || {}).forEach(function (k) {
      var v = ctx.overflow[k];
      max = Math.max(max, v);
      if (v > OVERFLOW_TOL) bad.push(k + "=" + v + "px");
    });
    if (bad.length) fail("horizontal overflow on: " + bad.join(", "));
    return "no horizontal overflow (worst " + Math.round(max) + "px)";
  }

  async function checkGenerateUI() {
    window.dragonGoPage("generate");
    var btn = await waitFor(function () { var b = q(".dragon-gen-btn"); return isVisible(b) ? b : null; }, TIMEOUT, 150);
    if (!btn) fail("no visible Generate button (.dragon-gen-btn) on the generate page");
    if (btn.disabled) fail("the prompt panel Generate button is disabled");
    var nat = q("#generateButtonEl");
    if (isVisible(nat)) fail("#generateButtonEl resurfaced on the generate page (it stays hidden: the prompt panel Generate button replaces it)");
    var tas = qa("textarea").filter(isVisible);
    var sels = qa("select").filter(isVisible);
    // 🎨 Egon 27.09.2026 (W-FEAT313): the Art Style control moved INTO its own accordion panel and the old
    // row (whose <select data-name="artStyle"> still feeds the framework) is hidden, so the generate page no
    // longer has to expose a visible <select> — the visible style control is the 🎨 Art Style panel's head.
    var artPanel = isVisible(q("#dragonArtPanelHead"));
    if (tas.length < 1) fail("no visible prompt textarea");
    if (sels.length < 1 && !artPanel) fail("no visible <select> control and no 🎨 Art Style panel");
    return "Generate enabled; " + tas.length + " textarea(s), " + sels.length + " select(s)" +
      (artPanel ? ", 🎨 Art Style panel visible" : "");
  }

  async function checkPublicGallery(ctx) {
    window.dragonGoPage("gallery");
    var panel = await waitFor(function () { return isVisible(q(".dragon-gal-panel")) ? q(".dragon-gal-panel") : null; }, TIMEOUT, 200);
    if (!panel) fail(".dragon-gal-panel did not render");
    var bar = q(".dragon-gal-bar");
    if (!isVisible(bar)) fail("public gallery toolbar (.dragon-gal-bar) not visible");
    // Cold-load reality check 22.09.2026: the public gallery listing itself is fetched from
    // image-generation.perchance.org THROUGH fetch-plugin's proxy, and on a cold load that single
    // response has been measured at 22-26 SECONDS (it competes with the 3.6MB page + the plugin
    // bundles). Nothing in our code gates the tiles - they arrive when that response lands - so a
    // cold first open legitimately needs far more than the generic 2x step. Give it 4x (36s).
    var tiles = await waitFor(function () { return qa(".dragon-gal-tile").length; }, TIMEOUT * 4, 250);
    var note = "";
    if (!tiles) {
      // If even that ran out, the panel opened but the tile render never started (the plugin's
      // show handler was skipped by the open-flag early return). Force a clean render, re-check.
      var gal = q("#imageGalleryCtn8569284");
      if (gal) gal.dataset.dragonOpen = "";
      window.dragonGoPage("gallery");
      tiles = await waitFor(function () { return qa(".dragon-gal-tile").length; }, TIMEOUT * 2, 250);
      note = " (after forced re-render)";
    }
    if (!tiles) fail("no public gallery tiles (.dragon-gal-tile) rendered");
    ctx.kissPub = { spread: controlSpread(bar), rows: worstKiss(qa(".dragon-gal-row1,.dragon-gal-row2,.dragon-gal-row3,.dragon-gal-row4")) };
    return tiles + " public tiles; toolbar visible" + note;
  }

  // 🖼️ Egon 22.09.2026 (batch 2.28.0) - "on mobile ... if I go back to the ones above ... the image disappears and when I
  // coming back to the tile it starts showing from scratch again". Two things are asserted here, on EVERY viewport:
  // (1) the prefetch window is a budget in SCREENS, so a one-column phone can no longer mark ~100
  //     full-screen pictures eager (measured before the fix at 390x844: 103 eager, covering ~46 screens);
  // (2) the tiles around the viewport are the ones KEPT PAINTED (`.dragon-gal-cv-keep` ->
  //     `content-visibility:visible`), while what is really far away is still skipped - and the height a
  //     NOT-painted tile reports equals its real height, so entering/leaving that band cannot move the page.
  async function checkGalLoadWindow() {
    window.dragonGoPage("gallery");
    var tiles = await waitFor(function () { var t = qa(".dragon-gal-tile"); return t.length > 20 ? t : null; }, TIMEOUT * 4, 250);
    if (!tiles) fail("no public gallery tiles to measure the load window on");
    var grid = q(".dragon-gal-grid");
    if (!grid) fail(".dragon-gal-grid missing");
    var tune = window.dragonGalTune;
    if (!tune || !tune.aheadScreens) fail("window.dragonGalTune (the window's per-mode screen budgets) is missing");
    // 🔄 Egon 27.10.2026 — Default load mode has no window and no retention band (plain
    // perchance-gallery behaviour): assert the native state instead of the window budget.
    var _lm = ""; try { _lm = window.dragonGalLoadGet ? window.dragonGalLoadGet() : ""; } catch (eLm) {}
    if (_lm === "default") {
      var keptN = 0;
      for (var ki = 0; ki < tiles.length; ki++) if (tiles[ki].classList.contains("dragon-gal-cv-keep")) keptN++;
      if (keptN) fail(keptN + " tiles are pinned painted in Default mode (the plain gallery pins nothing)");
      return tiles.length + " public tiles in Default mode (native loading, nothing pinned, nothing prefetched)";
    }
    // Egon 22.09.2026 (check-up v2.3.1) — the window pass is throttled (80 ms + rAF) and the tiles of the
    // first batch arrive in painted slices, so on a COLD load (right after a refresh) the retention band
    // can legitimately land a few frames after the tile count passes the threshold above — measured: cold
    // run "3 of the 3 tiles ON SCREEN are not in the retention band", warm run 41/41. Wait (bounded) for
    // the app's own schedule here; the assertions below are unchanged.
    await waitFor(function () {
      var t = qa(".dragon-gal-tile"), vh0 = window.innerHeight || 800;
      var on0 = t.filter(function (x) { var r = x.getBoundingClientRect(); return r.width > 0 && r.bottom > 0 && r.top < vh0 + 1; });
      if (!on0.length) return 0;
      for (var k = 0; k < on0.length; k++) if (!on0[k].classList.contains("dragon-gal-cv-keep")) return 0;
      return on0.length;
    }, 4000, 150);
    var vh = window.innerHeight || 800, n = tiles.length, i;
    // 🧩 Egon 23.09.2026 — the five WALL modes repack the tiles, so DOM order is NOT visual order: the
    // DOM span [firstOn..lastOn] then covers tiles that are far away on the wall (measured live: "12 of
    // the 44 tiles ON SCREEN"), while the retention band is built from the VISUAL order
    // (src/dragon-app-core.js dragonGalEagerWindow). In a wall mode the honest measurement is geometric:
    // every tile that really touches the viewport must be in the band, and the far-tile skip is counted
    // in VISUAL positions. The non-wall branch is byte-for-byte the shipped measurement.
    var wallRx = /dragon-gal-grid-display-(pinterest|puzzle|mosaic|mixed)(\s|$)/;
    var isWall = false; try { isWall = wallRx.test(grid.className); } catch (e) {}
    function keepOf(t) { return t.classList.contains("dragon-gal-cv-keep"); }
    function visualOnes() {
      var arr = [];
      for (var k = 0; k < n; k++) {
        var rr = tiles[k].getBoundingClientRect();
        if (!(rr.width > 0)) continue;
        arr.push({ t: tiles[k], top: rr.top, bottom: rr.bottom });
      }
      arr.sort(function (a, b) { return a.top - b.top; });
      return arr;
    }
    var firstOn = -1, lastOn = -1, on = 0, visArr = null, firstVis = -1, lastVis = -1;
    if (isWall) {
      visArr = visualOnes();
      for (i = 0; i < visArr.length; i++) {
        if (visArr[i].top < vh + 1) lastVis = i;
        if (firstVis < 0 && visArr[i].bottom > -1) firstVis = i;
        if (visArr[i].bottom > 0 && visArr[i].top < vh + 1) on++;
      }
      if (lastVis < 0 || on < 1) fail("could not measure the wall viewport (lastVis " + lastVis + ", on-screen tiles " + on + ")");
      var wallNotKept = 0;
      for (i = firstVis; i <= lastVis; i++) if (!keepOf(visArr[i].t)) wallNotKept++;
      if (wallNotKept) fail(wallNotKept + " of the " + (lastVis - firstVis + 1) + " tiles ON SCREEN are not in the retention band in the wall layout (their picture would be dropped and repainted on the way back)");
    } else {
      for (i = 0; i < n; i++) {
        var r = tiles[i].getBoundingClientRect();
        if (!(r.width > 0)) continue;
        if (r.top < vh + 1) lastOn = i;
        if (r.bottom > -1 && firstOn < 0) firstOn = i;
        if (r.bottom > 0 && r.top < vh + 1) on++;
      }
      if (lastOn < 0 || on < 1) fail("could not measure the viewport (lastOn " + lastOn + ", on-screen tiles " + on + ")");
      var notKept = 0;
      for (i = firstOn; i <= lastOn; i++) if (!keepOf(tiles[i])) notKept++;
      if (notKept) fail(notKept + " of the " + (lastOn - firstOn + 1) + " tiles ON SCREEN are not in the retention band (their picture would be dropped and repainted on the way back)");
    }
    var mode = dragonGalLoadGet();
    var screens = Number(tune.aheadScreens[mode] || 6);
    var wantFar = (isWall ? lastVis : lastOn) + Math.round(on * screens) + 24;
    // Egon 22.09.2026 (check-up v2.3.2) — a COLD run (right after a refresh) can hold fewer tiles than the
    // window reaches: with only 40 tiles loaded the "far" index used to clamp to the LAST tile, which is
    // legitimately painted, and the check reported a window failure that did not exist. Now the far-tile
    // assertion only runs when the window really can be measured beyond the loaded tiles (the tile count is
    // given a bounded chance to grow first); otherwise it says so instead of failing.
    await waitFor(function () { return qa(".dragon-gal-tile").length > wantFar ? 1 : 0; }, 2500, 200);
    var nNow = qa(".dragon-gal-tile").length;
    var farNote = "";
    if (wantFar <= nNow - 1) {
      var farTile = null;
      if (isWall) { var vNow = visualOnes(); farTile = vNow[wantFar] ? vNow[wantFar].t : null; }
      else { farTile = tiles[wantFar] || null; }
      if (farTile && keepOf(farTile)) fail("the tile " + wantFar + " positions past the screen (" + (on * screens + 24) + " away) is still in the retention band: far-away tiles are no longer skipped, a phone would paint the whole wall");
    } else {
      farNote = " (far-tile skip not measurable: only " + nNow + " tiles loaded, the window reaches " + (wantFar + 1) + ")";
    }
    var eager = 0;
    for (i = 0; i < n; i++) { var im = tiles[i].querySelector("img"); if (im && im.loading === "eager") eager++; }
    var cap = Math.round(on * screens) + 12 + 24;   // the window + the 12-tile band above + the first screenful
    if (eager > cap) fail(eager + " tiles are eager, but a " + on + "-tile screen at mode \"" + mode + "\" allows ~" + cap + " (the budget must be in screens, not tiles)");
    var note = "";
    var intVarOf = function () { return grid.style.getPropertyValue("--dragon-gal-intrinsic"); };
    var wOf = function () { return tiles[firstOn].getBoundingClientRect().width; };
    if (intVarOf()) {
      // 🖼️ Egon 23.09.2026 — the size sync rides the app's own geometry pass, which is throttled (80 ms + a
      // frame), so in the moment just after a resize or a page change the property can still carry the
      // PREVIOUS layout's width (measured live in a full run: 413px — a 3-column editor pane — while the
      // tiles had already become 186.2px, which failed a check that only ever meant to measure the SETTLED
      // geometry). Wait (bounded) for the app's own pass to catch up and assert on that — a value that never
      // catches up still fails, exactly as before.
      await waitFor(function () {
        var v = intVarOf(), w = wOf();
        return (v && w > 1 && Math.abs(parseFloat(v) - w) <= 1.5) ? 1 : 0;
      }, 2500, 100);
      var vNow = intVarOf();
      if (vNow) {
        var w0 = wOf();
        if (Math.abs(parseFloat(vNow) - w0) > 1.5) fail("--dragon-gal-intrinsic is " + vNow + " but a tile is " + w0.toFixed(1) + "px wide (a not-painted tile would change the page height when it enters)");
      } else {
        note = " (image-driven display mode, intrinsic height not managed)";
      }
    } else {
      note = " (image-driven display mode, intrinsic height not managed)";
    }
    return on + " tiles on screen \u00B7 " + (isWall ? (lastVis - firstVis + 1) : (lastOn - firstOn + 1)) + " on-screen tiles kept painted \u00B7 " + eager +
      " eager \u2264 ~" + cap + " (" + screens + " screens) \u00B7 far tiles skipped" + farNote + note;
  }

  async function checkVault(ctx) {
    window.dragonGoPage("likes");
    var root = await waitFor(function () { return document.getElementById("localMediaGallery_root"); }, TIMEOUT * 2, 200);
    if (!root) fail("private gallery (#localMediaGallery_root) did not open");
    ctx.openedVault = true;
    var hdr = await waitFor(function () { return q(".dragon-vault-header-bar", root); }, TIMEOUT, 200);
    if (!hdr) fail("vault toolbar header (.dragon-vault-header-bar) missing");
    var items = await waitFor(function () { var n = qa("[data-local-media-gallery-item]", root).length; return n > 0 ? n : 0; }, TIMEOUT * 2, 250);
    if (!items) fail("no vault tiles ([data-local-media-gallery-item]) rendered");
    var row2 = q(".dragon-vault-row2", root), row3 = q(".dragon-vault-row3", root);
    var counter = q(".dragon-vault-counter", root), twin = q(".dragon-vault-twin", root);
    if (!row2 || !row3) fail("vault toolbar rows (.dragon-vault-row2/3) missing");
    if (!counter) fail("storage-info button (.dragon-vault-counter) missing");
    if (!twin) fail("dedupe twin (.dragon-vault-twin) missing");
    if (!(counter.parentElement === row3 && row3.lastElementChild === counter)) fail("storage-info button is not the last item of row 3");
    if (!(twin.parentElement === row3 && twin.nextElementSibling === counter)) fail("storage-info button is not immediately right of the dedupe twin");
    ctx.kissVault = worstKiss([row2, row3]);
    return items + " vault tiles; toolbar rows + counter placement OK";
  }

  // The ☰ menu IS the vault's action surface, and a row that is not handled by our own gate silently
  // falls back to the plugin's native prompt()/file picker — exactly how "Import Local File" shipped
  // unhandled (it always landed in the active folder). This check asserts every row is present, is
  // labelled like its Settings twin, and that the backup/import entry points really exist.
  var VAULT_MENU_WANT = {
    saveBackup: "\uD83D\uDCBE Save Backup",
    loadBackup: "\uD83D\uDCC2 Load Backup",
    importLocal: "\uD83D\uDCE4 Import Local File",
    importURL: "\uD83C\uDF10 Import from URL",
    storageInfo: "\uD83D\uDCBD Storage Info",
    clearAll: "\uD83D\uDCA3 Clear ALL Data"
  };
  var VAULT_MENU_ENTRY_POINTS = ["dragonBackupSaveDialog", "dragonBackupLoadDialog", "dragonVaultImportFlow", "dragonVaultLoadBackupZip", "dragonVaultRelabelMenu"];
  async function checkVaultMenu(ctx) {
    window.dragonGoPage("likes");
    var root = await waitFor(function () { return document.getElementById("localMediaGallery_root"); }, TIMEOUT * 2, 200);
    if (!root) fail("private gallery did not open for the ☰ menu check");
    var sel = await waitFor(function () {
      var sels = qa("select", root);
      for (var i = 0; i < sels.length; i++) {
        for (var j = 0; j < sels[i].options.length; j++) if (sels[i].options[j].value === "clearAll") return sels[i];
      }
      return null;
    }, TIMEOUT, 200);
    if (!sel) fail("vault ☰ menu select (the one carrying clearAll) not found");
    var byVal = {};
    for (var k = 0; k < sel.options.length; k++) byVal[sel.options[k].value] = sel.options[k].textContent;
    for (var v in VAULT_MENU_WANT) {
      if (!Object.prototype.hasOwnProperty.call(byVal, v)) fail("☰ menu row missing: " + v);
      else if (byVal[v] !== VAULT_MENU_WANT[v]) fail("☰ row \"" + v + "\" reads \"" + byVal[v] + "\", expected \"" + VAULT_MENU_WANT[v] + "\"");
    }
    VAULT_MENU_ENTRY_POINTS.forEach(function (g) {
      if (typeof window[g] !== "function") fail("missing global entry point: window." + g);
    });
    return Object.keys(VAULT_MENU_WANT).length + " ☰ rows wired + labelled as Settings twins; backup/import entry points present";
  }

  async function checkChat(ctx) {
    var wasOpen = isVisible(q("#dragonChatWindow"));
    if (!wasOpen) { if (window.dragonChatOpen) window.dragonChatOpen(); }
    // The chat input is not the page's own DOM: it lives inside the comments-plugin <iframe>.
    // NOTE: the chat window can hold one iframe per channel, and the inactive channels' contents are
    // display:none — so scan for ANY visible iframe instead of trusting the first one in DOM order.
    var chatReady = function () {
      var cw = q("#dragonChatWindow");
      if (!isVisible(cw)) return false;
      if (qa("iframe", cw).some(isVisible)) return true;
      if (isVisible(q("textarea", cw))) return true;
      if (isVisible(q("[contenteditable=true]", cw))) return true;
      return false;
    };
    var open = await waitFor(chatReady, TIMEOUT * 2, 200);
    if (!open) {
      // Cold-start recovery: the tab list is built first and the active channel's iframe is attached a
      // moment later (the plugin lazily creates it through an IntersectionObserver). Close and reopen
      // once, then wait again.
      try { if (window.dragonChatClose) window.dragonChatClose(); } catch (e) {}
      await sleep(400);
      if (window.dragonChatOpen) window.dragonChatOpen();
      open = await waitFor(chatReady, TIMEOUT * 2, 200);
    }
    if (!open) fail("chat overlay did not open with an input/iframe");
    // The retired Feedback channel must be gone; Suggestion must still be there and the suggestion-inbox
    // helper must be present (it is what the survey's suggestion box posts through).
    var tabs = qa("#dragonChatWindow .tabbed-comments-plugin-channel-tab");
    if (tabs.length) {
      var chans = tabs.map(function (t) { return t.dataset ? t.dataset.channel : ""; });
      if (chans.indexOf("feedback") !== -1) fail("the retired Feedback channel is still in the chat");
      if (chans.indexOf("suggestion") === -1) fail("the Suggestion channel is missing from the chat");
    }
    if (typeof window.dragonSuggestSubmit !== "function") fail("dragonSuggestSubmit helper missing (survey suggestion box cannot post)");
    if (window.dragonSuggestPrepare) {
      var prepOk = await new Promise(function (res) {
        var t0 = setTimeout(function () { res(false); }, 9000);
        try { window.dragonSuggestPrepare(function (ok) { clearTimeout(t0); res(ok); }); } catch (e) { clearTimeout(t0); res(false); }
      });
      if (!prepOk) fail("the Suggestion channel iframe could not be prepared (the survey suggestion box cannot post)");
    }
    if (!wasOpen) {
      ctx.openedChat = true;
      if (window.dragonChatClose) window.dragonChatClose();
      var closed = await waitFor(function () { return !isVisible(q("#dragonChatWindow")); }, TIMEOUT, 150);
      if (!closed) fail("chat overlay did not close");
      return "opens with input, closes again";
    }
    return "opens with input (was already open, left as-is)";
  }

  async function checkChatClose() {
    if (!isVisible(q("#dragonChatWindow"))) { if (window.dragonChatOpen) window.dragonChatOpen(); }
    var tabs = await waitFor(function () {
      var t = qa("#dragonChatWindow .tabbed-comments-plugin-channel-tab");
      return t.length >= 4 ? t : null;
    }, TIMEOUT * 2, 200);
    if (!tabs) fail("chat channel tabs did not appear");
    if (typeof window.dragonChatTabDecorate !== "function") fail("dragonChatTabDecorate hook missing (the channel ✕ cannot be built)");
    if (typeof window.dragonChatHiddenChannels !== "function") fail("dragonChatHiddenChannels hook missing (a closed channel could not be remembered)");
    window.dragonChatTabDecorate();
    var DEFAULTS = ["", "general", "chat1", "chat2", "prompts", "images", "suggestion"];
    window.dragonChatTabDecorate();
    // (1) a DEFAULT room is never closable → it must never carry a ✕
    var defX = 0;
    tabs.forEach(function (t) {
      var ch = t.dataset ? (t.dataset.channel || "") : "";
      if (DEFAULTS.indexOf(ch) < 0) return;
      if (t.querySelector(".dragon-chat-tabx")) defX++;
    });
    if (defX) fail(defX + " default channel tab(s) carry the ✕ (only a room the visitor added may)");
    // (2) add a temporary room through the plugin's own custom-channel store (its value shape is
    //     {channel, name}), so the test uses the real add path instead of a mock
    var CKEY = "__tabbedCommentsPluginCustomChannels";
    var prevCustoms = "{}";
    try { prevCustoms = localStorage.getItem(CKEY) || "{}"; } catch (e) {}
    var room = "qa-room-check";
    var customs = {}; try { customs = JSON.parse(prevCustoms) || {}; } catch (e) { customs = {}; }
    function restoreCustoms() {
      try { localStorage.removeItem(CKEY); localStorage.setItem(CKEY, prevCustoms); } catch (e) {}
      try { window.dispatchEvent(new StorageEvent("storage", { key: CKEY })); } catch (e) {}
      try { window.dragonChatTabDecorate(); } catch (e) {}
    }
    customs[room] = { channel: room, name: room };
    try { localStorage.setItem(CKEY, JSON.stringify(customs)); } catch (e) {}
    try { window.dispatchEvent(new StorageEvent("storage", { key: CKEY })); } catch (e) {}
    var roomTab = await waitFor(function () {
      var list = qa("#dragonChatWindow .tabbed-comments-plugin-channel-tab");
      for (var i = 0; i < list.length; i++) {
        if ((list[i].dataset ? (list[i].dataset.channel || "") : "") === room) return list[i];
      }
      return null;
    }, TIMEOUT * 2, 200);
    if (!roomTab) { restoreCustoms(); fail("the plugin did not add the test room tab '" + room + "'"); }
    // (3) activate it → the ✕ must appear on it, and on NOTHING else
    roomTab.click();
    await waitFor(function () { return roomTab.classList.contains("tabbed-comments-plugin-active-tab"); }, TIMEOUT, 150);
    window.dragonChatTabDecorate();
    var x = roomTab.querySelector(".dragon-chat-tabx");
    if (!x) { restoreCustoms(); fail("the active self-added room tab does not carry the ✕"); }
    var total = qa("#dragonChatWindow .tabbed-comments-plugin-channel-tab .dragon-chat-tabx").length;
    if (total !== 1) { restoreCustoms(); fail("expected exactly 1 ✕ (on the active room), found " + total); }
    // The ✕ must be laid out ON its own tab, and — once that tab is scrolled into view — inside the tab
    // row. A narrow chat window makes the row scrollable, so the row is scrolled first: otherwise this
    // would test how far the row happens to be scrolled rather than where the ✕ sits.
    var head = q("#dragonChatWindow .tabbed-comments-plugin-header");
    if (head) {
      try {
        var tb0 = roomTab.getBoundingClientRect(), hr0 = head.getBoundingClientRect();
        if (tb0.right > hr0.right) head.scrollLeft += (tb0.right - hr0.right) + 4;
        else if (tb0.left < hr0.left) head.scrollLeft -= (hr0.left - tb0.left) + 4;
      } catch (e) {}
    }
    var pr = x.getBoundingClientRect();
    if (pr.width < 8 || pr.height < 8) fail("the ✕ is too small to tap (" + Math.round(pr.width) + "x" + Math.round(pr.height) + ")");
    if (head) {
      var tb = roomTab.getBoundingClientRect(), hr = head.getBoundingClientRect();
      // the ✕ is deliberately tucked 2px past the tab's own top-right corner (CSS top/right: -2px)
      if (pr.left < tb.left - 3 || pr.right > tb.right + 3) fail("the ✕ is not laid on its own tab (" + Math.round(pr.left) + ".." + Math.round(pr.right) + " vs tab " + Math.round(tb.left) + ".." + Math.round(tb.right) + ")");
      if (pr.top < hr.top - 3) fail("the ✕ is clipped by the tab row (top " + Math.round(pr.top) + " < row top " + Math.round(hr.top) + ")");
      if (pr.left < hr.left - 1 || pr.right > hr.right + 1) { restoreCustoms(); fail("the ✕ sits outside the tab row (" + Math.round(pr.left) + ".." + Math.round(pr.right) + " vs row " + Math.round(hr.left) + ".." + Math.round(hr.right) + ")"); }
    }
    // (4) clicking it removes the visitor's own room + its stored entry
    x.click();
    var gone = await waitFor(function () {
      var c = {}; try { c = JSON.parse(localStorage.getItem(CKEY) || "{}") || {}; } catch (e) {}
      var list = qa("#dragonChatWindow .tabbed-comments-plugin-channel-tab");
      var still = false;
      for (var i = 0; i < list.length; i++) { if ((list[i].dataset ? (list[i].dataset.channel || "") : "") === room) still = true; }
      return (!c[room] && !still) ? true : null;
    }, TIMEOUT * 2, 150);
    restoreCustoms();
    if (!gone) fail("clicking the ✕ did not remove the room '" + room + "'");
    window.dragonChatTabDecorate();
    var defX2 = 0;
    qa("#dragonChatWindow .tabbed-comments-plugin-channel-tab").forEach(function (t) {
      var ch = t.dataset ? (t.dataset.channel || "") : "";
      if (DEFAULTS.indexOf(ch) >= 0 && t.querySelector(".dragon-chat-tabx")) defX2++;
    });
    if (defX2) fail("a default channel carries the ✕ after the room was closed");
    return "✕ on the active self-added room only ('" + room + "' added + closed, store entry dropped)";
  }

  async function checkCollapseGuard() {
    if (typeof window.dragonGalTouching !== "function") fail("dragonGalTouching hook missing (the toolbar collapse guard is not installed)");
    var was = pageAttr();
    if (window.dragonGoPage) window.dragonGoPage("gallery");
    var panel = await waitFor(function () { return q(".dragon-gal-panel"); }, TIMEOUT * 2, 200);
    if (!panel) fail("the gallery toolbar did not appear");
    var tbBtn = q("button[title='Toolbox']", panel);
    if (!tbBtn) fail("the 🧰 Toolbox button is missing from the toolbar");
    var tbPanel = tbBtn.parentNode ? tbBtn.parentNode.children[1] : null;
    if (!tbPanel) fail("the toolbox panel element was not found");
    var prevDisplay = tbPanel.style.display;
    // make the toolbox visible WITHOUT clicking (a click would also arm the 2.6 s grace timer, which would
    // make the assertion meaningless) and check that the guard reports an active interaction
    tbPanel.style.display = "flex";
    var on = await waitFor(function () { return window.dragonGalTouching() === true; }, 3000, 120);
    tbPanel.style.display = prevDisplay;
    if (!on) fail("with the toolbox open the guard did not defer the auto-collapse (the toolbar would collapse under the user)");
    var idle = window.dragonGalTouching();
    if (typeof idle !== "boolean") fail("dragonGalTouching() did not return a boolean");
    if (was && window.dragonGoPage) { try { window.dragonGoPage(was); } catch (e) {} }
    return "guard present: toolbox open => deferred" + (idle ? " (grace period still active)" : "");
  }

  async function checkStorageDialog() {
    if (typeof window.dragonVaultOpenStorageInfo !== "function") fail("dragonVaultOpenStorageInfo missing");
    window.dragonVaultOpenStorageInfo();
    var lb = await waitFor(function () {
      var all = qa("[data-local-media-gallery-lightbox]");
      for (var i = all.length - 1; i >= 0; i--) {
        if (/storage info/i.test(all[i].textContent || "")) return all[i];
      }
      return null;
    }, TIMEOUT, 200);
    if (!lb) fail("storage-info dialog did not appear");
    var txt = (lb.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60);
    var ok = qa("button", lb).filter(function (b) { return /^ok$/i.test((b.textContent || "").trim()); })[0];
    if (ok) ok.click(); else { try { lb.remove(); } catch (e) {} }
    var gone = await waitFor(function () { return !(/storage info/i.test((q("[data-local-media-gallery-lightbox]") || {}).textContent || "") && q("[data-local-media-gallery-lightbox]")); }, TIMEOUT, 150);
    if (!gone) fail("storage-info dialog did not close");
    return "opened (\"" + txt + "\") + closed";
  }

  async function checkSurvey() {
    if (typeof window.dragonSurveySelfTest !== "function") fail("dragonSurveySelfTest hook missing (survey engine not loaded)");
    await sleep(80);
    var r = window.dragonSurveySelfTest();
    if (!r.opened) fail("survey window did not open");
   if (r.items < 20) fail("survey item list too short (" + r.items + ")");
    // Egon 29.10.2026 (A5) — the "which feature next" question is retired: zero options is correct.
    if (r.opts !== 0) fail("the retired \"next feature\" question is back with " + r.opts + " options");
   if (r.rate !== 5) fail("rate twin missing (expected 5 cells)");
   if (!r.complete) fail("\"Complete survey & show results\" button missing");
    if (r.desc !== r.items) fail("tooltips: only " + r.desc + " of " + r.items + " rows carry a description");
    if (r.sug !== 1) fail("the survey suggestion box is missing (found " + r.sug + ")");
    if (!r.sugSend) fail("the survey suggestion box has no Send button");
    if (!r.morph) fail("the window did not turn into the results view");
    if (!r.sameSize) fail("results view changed the window size (" + r.w + "x" + r.h + ")");
    if (!r.resClose) fail("results view has no Close button");
    // Egon 29.10.2026 (A5) — no "next feature" section anymore, so results rows == items.
    if (r.resRows !== r.items) fail("results rows " + r.resRows + " != items (" + r.items + ")");
    if (r.resRate !== 5) fail("rate twin missing in the results view (expected 5 cells)");
    if (!r.resOrder) fail("results view: the rate-us strip is not immediately above the Close button");
    if (r.sortOk !== true) fail("the results view rows are NOT in one ranking by LIKE COUNT (W-DATA223) \u2014 " + (r.sortRows || 0) + " rows in the second section, top \"" + (r.sortTop || "") + "\", bottom \"" + (r.sortBottom || "") + "\" (expected the row with the most \uD83D\uDC4D first)");
    if (!r.sortBtn) fail("the results view has no \uD83C\uDFC6 sort button over the like/dislike column (Egon 26.09.2026)");
    if (r.sortFlips !== true) fail("the sort button did not flip between most liked and most disliked (label: " + (r.sortLabel || "?") + ")");
    if (r.bars !== 0) fail("the results view still paints coloured bars (" + r.bars + " found) \u2014 W-DATA223 removed them");
    if (!r.closed) fail("survey window did not close");
    if (!r.resSummary) fail("the results view has no summary strip (likes/dislikes/positive/total)");
    return r.items + " systems, no next-feature question (retired), all with tooltips, + suggestion box; morphs to results at " + r.w + "x" + r.h + " (same size), no bars (W-DATA223), one LIKE-COUNT ranking, rate twin in both views, summary strip present";
  }

  // Permanent survey/rate ledger (mail [373]-[377]): READ-ONLY probe of the mirrored copies.
  async function checkPermLedger() {
    if (typeof window.dragonPermDiag !== "function") fail("dragonPermDiag hook missing (survey engine not loaded)");
    var d = null;
    for (var i = 0; i < 30 && !d; i++) { d = await window.dragonPermDiag(); if (!d) await sleep(200); }
    if (!d || d.ok !== true) fail("dragonPermDiag did not answer (permanent ledger module not reachable)");
    if (!d.fixOk) fail("PERM_FIX_OK is false - the fixed copy cannot be addressed");
    if (!d.slots || !d.slots.fix || !d.slots.fix.ok) fail("PERM_FIX copy (a) is missing");
    if (!d.slots.end || !d.slots.end.ok) fail("PERM_END copy (b) is missing");
    var lv = d.legacyVersionBytes || [];
    if (lv[0] !== 1) fail("legacy survey counters (c) still carry a destructive version guard (byte " + lv[0] + ", expected 1)");
    if (lv[1] !== 1) fail("legacy rate counters (d) still carry a destructive version guard (byte " + lv[1] + ", expected 1)");
    var m = d.merged || {}, n = d.numbers || {};
    if (m.n !== n.n) fail("merged total (" + m.n + ") disagrees with the live view (" + n.n + ")");
    if (JSON.stringify(m.q1) !== JSON.stringify(n.q1)) fail("merged first-question answers differ from the live view");
    var upSum = 0, dnSum = 0, it = n.items || [];
    for (var j = 0; j < it.length; j++) { upSum += (it[j] && it[j][0]) || 0; dnSum += (it[j] && it[j][1]) || 0; }
    if (m.upSum !== upSum) fail("merged up-votes (" + m.upSum + ") disagree with the live view (" + upSum + ")");
    if (m.dnSum !== dnSum) fail("merged down-votes (" + m.dnSum + ") disagree with the live view (" + dnSum + ")");
    if (!m.ratings || m.ratings.length !== 5) fail("merged star ratings are missing (expected 5 buckets)");
    var rec = 0, evs = (d.log && d.log.events) || [];
    for (var k = 0; k < evs.length; k++) if (evs[k].code === 4) rec += (evs[k].arg || 0);
    return "4/4 copies valid (fix " + d.slots.fix.addr + " seq " + d.slots.fix.seq + ", end " + d.slots.end.addr + " seq " + d.slots.end.seq + ", legacy survey+rate version bytes " + lv.join(",") + "), merged n=" + m.n + " q1=" + JSON.stringify(m.q1) + " ratings=" + JSON.stringify(m.ratings) + ", " + rec + " vote(s) recovered by repair, visitors " + (d.vis ? d.vis.used + "/" + d.vis.cap : "?") + ", log " + evs.length + "/" + (d.log ? d.log.cap : "?");
  }

  // 🛡️ REGION BOUNDARY MAP (W-DATA308). Every durable region lives in ONE shared state buffer, so the only way
  // a counter can be lost silently is a writer crossing out of its own slice — exactly how one region
  // once spilled into the survey counters. This reads the server's region map and asserts that no two slices
  // overlap and that every slice (and the survey counters especially) fits with clearance.
  async function checkRegionMap() {
    if (typeof window.dragonServerRpc !== "function") fail("window.dragonServerRpc is missing (the shared rpc path, rule I104)");
    var d = null;
    for (var i = 0; i < 30 && !d; i++) { try { d = JSON.parse(await window.dragonServerRpc("dragonRegionDiag", "")); } catch (e) { d = null; } if (!d) await sleep(200); }
    if (!d || d.ok !== true) fail("dragonRegionDiag did not answer (the region map is not reachable)");
    // W-CLEAN374 Faz-2 (Egon 10.10.2026): the retired HOF/popularity bytes were zeroed in production
    // (verified 10.10.2026) and the wipe machinery was removed in 2.78.4, so the map no longer carries
    // a retiredWiped flag — the retired ranges simply stay documented with no live writers.
    if (!(d.count >= 15)) fail("the region map lists only " + d.count + " regions \u2014 it is not reporting every durable slice");
    if (!d.allFit) fail("a durable region does not fit inside the state: " + JSON.stringify((d.rows || []).filter(function (r) { return r.fits === false; })));
    if (d.overlaps && d.overlaps.length) fail("two durable regions OVERLAP: " + d.overlaps.join(", ") + " \u2014 one can silently overwrite the other (rule I126)");
    var sc = d.surveyClearance || null;
    if (!sc || !(sc.gap > 0)) fail("the survey counters have no clearance above them (" + JSON.stringify(sc) + ")");
    // 🖥 OCCUPANCY (Egon 25.09.2026): the map also carries how much each region HOLDS, because the admin
    // data panel shows fill rates. Every number must be a real byte count inside its own region.
    var t = d.totals || null;
    if (!t || !(t.capSum > 0) || typeof t.usedSum !== "number" || typeof t.freeSum !== "number" || typeof t.highWater !== "number") fail("the region map carries no occupancy totals (used / free / high-water)");
    if (t.usedSum > t.capSum) fail("total occupancy (" + t.usedSum + " B) exceeds the allocated space (" + t.capSum + " B)");
    if (t.highWater > d.stateLen) fail("the high-water mark (" + t.highWater + ") is outside the state (" + d.stateLen + ")");
    var badUsed = (d.rows || []).filter(function (r) { return typeof r.used !== "number" || r.pct == null || r.used < 0 || r.used > r.size; });
    if (badUsed.length) fail("these regions report an impossible occupancy: " + JSON.stringify(badUsed.slice(0, 3)));
    // The ADMIN PAYLOAD must answer and must agree with the map (ONE source of truth, rule I104).
    var sd2 = null;
    for (var q = 0; q < 20 && !sd2; q++) { try { sd2 = JSON.parse(await window.dragonServerRpc("dragonServerData", "")); } catch (e) { sd2 = null; } if (!sd2) await sleep(200); }
    if (!sd2 || sd2.ok !== true || !sd2.map || !sd2.numbers) fail("dragonServerData did not answer with the admin data payload");
    if (sd2.map.count !== d.count || sd2.map.totals.usedSum !== t.usedSum) fail("the admin payload and the region map disagree about the same state (two sources of truth)");
    if (!(sd2.numbers.surveySlots >= 1)) fail("the admin payload carries no durable counters");
    return d.count + " durable regions, all inside the " + Math.round(d.stateLen / 1048576) + " MiB state, ZERO overlaps; " + Math.round(t.usedSum / 1024) + " KiB in use of " + Math.round(t.capSum / 1048576) + " MiB allocated (" + t.pct + "%), " + Math.round(t.freeSum / 1024) + " KiB free, high-water " + t.highWater + " B; survey counters end at " + sc.end + " with " + sc.gap + " B clearance; the admin data payload agrees (" + sd2.numbers.surveySlots + " survey slots)";
  }

  // 🗄️ PURGE SCOPE (W-DATA299 / package G): the ONE destructive control must delete OUR data and nothing else.
  // The whole purge path runs against MOCKS here (never the visitor's real storage - same discipline as the
  // likes-ledger repair test), then the LIVE plan is queried so the numbers the dialog prints provably come
  // from the same registry that does the deleting.
  async function checkPurgeScope() {
    if (typeof window.dragonStoreSelfTest !== "function") fail("dragonStoreSelfTest hook missing (the purge registry did not load)");
    if (typeof window.dragonStorePlan !== "function") fail("dragonStorePlan hook missing (the dialog cannot show what it will delete)");
    if (typeof window.dragonStorePurge !== "function") fail("dragonStorePurge hook missing (the purge button has no scoped path)");
    var r = null;
    try { r = window.dragonStoreSelfTest(); } catch (e) { fail("dragonStoreSelfTest threw: " + (e && e.message ? e.message : e)); }
    if (!r) fail("dragonStoreSelfTest returned nothing");
    if (!r.ownedGone) fail("the purge LEFT registered BESTAIGEN keys behind");
    if (!r.foreignKept) fail("the purge DELETED keys that are not ours");
    if (r.leftLs !== 3) fail("localStorage: expected the 3 foreign keys to survive, " + r.leftLs + " survived");
    if (r.leftSs !== 1) fail("sessionStorage: expected the 1 foreign key to survive, " + r.leftSs + " survived");
    if (!r.idb || r.idb.length !== 1 || r.idb[0] !== "dragonHistDB") fail("the registered IndexedDB name is wrong: " + JSON.stringify(r.idb));
    if (r.caches && r.caches.length) fail("the registry claims cache entries we do not own: " + JSON.stringify(r.caches));
    var live = null;
    try { live = window.dragonStorePlan(); } catch (e) { fail("the live purge plan threw: " + (e && e.message ? e.message : e)); }
    if (!live || !live.owned || !live.foreign || !Array.isArray(live.foreign.ls)) fail("the live purge plan did not answer");
    // The plan and the registry must be the SAME thing: every key the plan calls owned must be accepted by
    // the registry predicate itself (no third list that could drift away from the code that deletes).
    var owns = (typeof window.dragonStoreOwns === "function") ? window.dragonStoreOwns : function () { return true; };
    var bad = live.owned.ls.concat(live.owned.ss).filter(function (k) { return !owns(k); });
    if (bad.length) fail("the live plan would delete a key the registry does not own: " + bad.slice(0, 3).join(", "));
    return "mock purge: " + r.planOwnedLs + " owned / " + r.planForeignLs + " foreign localStorage keys, " + r.planOwnedSs + "/" + r.planForeignSs + " session keys, db " + r.idb.join(",") + " - owned deleted, foreign kept; live plan agrees (" + live.owned.ls.length + " owned / " + live.foreign.ls.length + " foreign on this origin)";
  }

  // ⭐🧾 THE LIKES LEDGER (Egon 23.09.2026, mail [376]/[377] applied to the ⭐ system): READ-ONLY probe of
  // the two copies of the like log, the picture registry (the urls) and the month ledger, PLUS a live
  // proof that a real vote lands in BOTH copies at once — then every vote it cast is taken back in the
  // `finally`, so the check leaves the counts exactly as it found them. It never wipes anything: the
  // repair paths themselves are exercised against a mock state, not against production.
  // ⭐ Egon 23.09.2026 (W-CLEAN374 09.10.2026: registry + month ledger retired) — THE LIKES LEDGER: the
  // like log's SECOND copy at its absolute address, read-only through `dragonLikesDiag`: both copies
  // carry the right version, report no damaged tail and AGREE; a REAL vote raises BOTH copies by the same
  // amount and taking it back restores them; the never-cleared repair log is reported too. The same
  // diagnostic ALSO carries the 💬 COMMENTS' mirror ("bir daha yorum silinmesin"): same version, no
  // damaged tail, same record count, byte-identical over the records.
  async function checkLikesLedger() {
    if (typeof window.dragonLikesDiag !== "function") fail("dragonLikesDiag hook missing (src/JS/dragon-likes.js did not load)");
    if (typeof window.dragonServerRpc !== "function") fail("window.dragonServerRpc is missing (the shared rpc path, rule I104)");
    var d = null;
    for (var i = 0; i < 30 && !d; i++) { d = await window.dragonLikesDiag(); if (!d) await sleep(200); }
    if (!d || d.ok !== true) fail("dragonLikesDiag did not answer (the likes ledger is not reachable)");
    if (!d.fixOk) fail("LF_OK is false — the absolute mirror block cannot be addressed in this state");
    function copyOf(reg, c) {
      var x = d[reg] && d[reg][c];
      if (!x) fail("the " + reg + " " + c + " copy is missing from the diagnostic");
      if (x.ver !== d.versions[reg]) fail(reg + " " + c + " carries version " + x.ver + " (expected " + d.versions[reg] + ")");
      if (x.bad) fail(reg + " " + c + " reports a damaged tail — a destructive guard has come back");
      return x;
    }
    var la = copyOf("lk", "a"), lb = copyOf("lk", "b");
    if (la.likes !== lb.likes) fail("the two LIKE-LOG copies disagree (" + la.likes + " vs " + lb.likes + ") — the mirror is not in lockstep");
    // The live write path: ONE real vote must raise BOTH copies by exactly one.
    var key = "checkup-ledger-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
    var va = "checkup-l1-" + Math.random().toString(36).slice(2, 8);
    var vb = "checkup-l2-" + Math.random().toString(36).slice(2, 8);
    var baseA = la.likes, baseB = lb.likes;
    var pushed = [va, vb];
    async function cast(u, dir) {
      var raw = await window.dragonServerRpc("dragonLikeVote", JSON.stringify({ i: key, u: u, d: dir }));
      var o = null;
      try { o = JSON.parse(raw); } catch (e) { o = null; }
      if (!o || !o.ok) fail("dragonLikeVote refused a ledger probe vote (" + ((o && o.err) || "no answer") + ")");
      return o.c | 0;
    }
    try {
      if (await cast(va, 1) !== 1) fail("the ledger probe vote must make the count 1");
      if (await cast(vb, 1) !== 2) fail("the ledger probe's second visitor must make the count 2");
      var mid = await window.dragonLikesDiag();
      if (!mid || !mid.lk) fail("the ledger stopped answering during the live write probe");
      if (mid.lk.a.likes !== baseA + 2) fail("a real vote did not reach the PRIMARY like-log copy (" + mid.lk.a.likes + ", expected " + (baseA + 2) + ")");
      if (mid.lk.b.likes !== baseB + 2) fail("a real vote did not reach the MIRROR like-log copy (" + mid.lk.b.likes + ", expected " + (baseB + 2) + ")");
    } finally {
      for (var v = 0; v < pushed.length; v++) { try { await cast(pushed[v], 0); } catch (e) {} }
    }
    var end = await window.dragonLikesDiag();
    if (!end || !end.lk) fail("the ledger stopped answering after the probe was taken back");
    if (end.lk.a.likes !== baseA || end.lk.b.likes !== baseB) fail("taking the probe votes back did not restore BOTH copies (" + end.lk.a.likes + "/" + end.lk.b.likes + ", expected " + baseA + "/" + baseB + ")");
    // 💬 THE COMMENTS' OWN MIRROR (Egon: "bir daha yorum silinmesin") rides in the same diagnostic. Read-
    // only on purpose — there is no delete in the comment system, so a probe write would leave a record
    // behind; the mirror's lockstep IS the assertion (a mirror that stopped being written shows a lower
    // count HERE after any new comment). The wipe/restore/repair paths are mock-tested off-production.
    var cm = d.cmt;
    if (!cm) fail("the diagnostic carries no comments mirror (dragonLikesDiag must expose `cmt`)");
    if (!cm.ok) fail("the comments mirror is not addressable in this state (CMT2 is out of range)");
    if (cm.ver !== d.versions.cmt) fail("the comment log carries version " + cm.ver + " (expected " + d.versions.cmt + ") — a destructive guard has come back");
    if (cm.a.bad) fail("the comment log reports a damaged tail — nothing may ever wipe it");
    if (cm.b.bad) fail("the comment-log MIRROR reports a damaged tail");
    if (cm.a.n !== cm.b.n) fail("the two COMMENT-LOG copies disagree (" + cm.a.n + " vs " + cm.b.n + ") — the mirror is not in lockstep");
    if (!cm.same) fail("the comment-log copies are not byte-identical over the records — a write missed the mirror");
    var evs = (d.log && d.log.events) || [], recovered = 0, codes = [];
    for (var k2 = 0; k2 < evs.length; k2++) { if (evs[k2].code === 4) recovered += (evs[k2].arg || 0); codes.push(evs[k2].code + "/" + evs[k2].slot); }
    return "both like-log copies in lockstep (" + la.likes + " pairs, mirror at " + (d.anchors && d.anchors.lk2) + "), a live vote raised BOTH copies by 2 and taking it back restored them, the 💬 comment log in lockstep too (" + cm.a.n + " record(s) byte-identical at " + (d.anchors && d.anchors.cmt2) + "), " + recovered + " pair(s) recovered by repair, repair log " + codes.join(" ") + " (" + evs.length + "/" + ((d.log && d.log.cap) || "?") + ")";
  }

  // 🚩 Egon 02.10.2026 — the lightbox REPORT flow: the window shows the picture's OWN gallery card
  // (never a re-generation) and files the report to the server inbox. The region lives at absolute 22 MiB
  // (between comments2 and popularity), the list/set endpoints sit behind the server-side admin gate, and the
  // admin window renders grouped pictures through its test hook.
  async function checkReportFlow() {
    if (typeof window.dragonServerRpc !== "function") fail("window.dragonServerRpc is missing (the shared rpc path, rule I104)");
    if (typeof window.dragonReportImage !== "function") fail("window.dragonReportImage is missing (the lightbox report entry point)");
    if (typeof window.dragonAdminReportsTest !== "function") fail("window.dragonAdminReportsTest is missing (the admin reports window has no test hook)");
    var rpcv = async function (m, payload) { try { return JSON.parse(await window.dragonServerRpc(m, payload === undefined ? "" : JSON.stringify(payload))); } catch (e) { return null; } };
    var reg = await rpcv("dragonRegionDiag");
    if (!reg || reg.ok !== true) fail("dragonRegionDiag did not answer (the region map is not reachable)");
    var row = null;
    for (var ri = 0; ri < (reg.rows || []).length; ri++) if (reg.rows[ri].name === "imageReports") row = reg.rows[ri];
    if (!row) fail("the imageReports region is missing from the region map");
    if (!row.fits) fail("the imageReports region does not fit inside the state");
    if (row.base !== 22 * 1048576) fail("the imageReports region moved (base " + row.base + ", expected 22 MiB between comments2 and popularity)");
    if (reg.overlaps && reg.overlaps.length) fail("the imageReports region overlaps another region: " + reg.overlaps.join(", "));
    // the WRITE path refuses garbage without touching the region…
    var badR = await rpcv("dragonReportSend", { r: 9, i: "checkup-probe", u: "https://example.invalid/x.jpg" });
    if (!badR || badR.ok !== false || badR.err !== "reason") fail("an out-of-range report reason was not refused (" + JSON.stringify(badR) + ")");
    var badP = await rpcv("dragonReportSend", { r: 6 });
    if (!badP || badP.ok !== false || badP.err !== "picture") fail("a report with no picture was not refused (" + JSON.stringify(badP) + ")");
    // …and files exactly ONE probe row (marked as a self-test, safe to dismiss)…
    var probe = "checkup-probe-" + Date.now().toString(36);
    var good = await rpcv("dragonReportSend", { r: 6, i: probe, u: "https://example.invalid/x.jpg", o: "", c: "bestaigen", s: "public", p: "self-test", n: "automated self-test — safe to dismiss" });
    if (!good || good.ok !== true || !(good.id > 0)) fail("the server refused a valid probe report (" + JSON.stringify(good) + ")");
    var dup = await rpcv("dragonReportSend", { r: 6, i: probe, u: "https://example.invalid/x.jpg" });
    // (the 10 s per-connection valve may answer "slow" instead of "dup" on a fast rerun — both prove the
    // second identical send did NOT file a second row)
    if (!dup || dup.ok !== true || (dup.dup !== true && dup.err !== "slow") || (dup.dup === true && dup.id !== good.id)) fail("the repeat probe was not deduped/throttled (" + JSON.stringify(dup) + ")");
    // …while the inbox itself stays behind the admin gate.
    var locked = await rpcv("dragonReportList");
    if (!locked || locked.ok !== false || locked.err !== "unauthorized") fail("dragonReportList is not locked behind the server-side admin gate: " + JSON.stringify(locked));
    var locked2 = await rpcv("dragonReportSet", { id: good.id, to: 2 });
    if (!locked2 || locked2.ok !== false || locked2.err !== "unauthorized") fail("dragonReportSet is not locked behind the server-side admin gate: " + JSON.stringify(locked2));
    // the admin window groups the probe picture through its test hook (fake rows, no server touch).
    var t = null;
    try { t = await window.dragonAdminReportsTest(); } catch (e) { t = null; }
    if (!t || t.opened !== true) fail("the admin reports window did not open through its test hook");
    if (!(t.blocks >= 1)) fail("the admin reports window grouped nothing (" + t.blocks + " blocks)");
    if (t.closed !== true) fail("the admin reports window did not close");
    return "region at 22 MiB (" + Math.round(row.size / 1024) + " KiB, zero overlaps), bad reason + pictureless sends refused, probe report #" + good.id + " filed once (repeat deduped), list/set refused without admin login, admin window groups and closes";
  }

  // 🆕 Egon 25.09.2026 (W-EFOR282) — THE INTERACTIVE POPUP. Measured end to end: the server region (both
  // copies, the layout, the number the server publishes) and the module's own behaviour through its TEST
  // hook, which opens a throwaway window, exercises the reveal link, and spends nothing at all.
  async function checkPopupRegion() {
    if (typeof window.dragonPopupState !== "function") fail("window.dragonPopupState is missing (src/dragon-popup.js did not load)");
    if (typeof window.dragonPopupTest !== "function") fail("window.dragonPopupTest is missing (the popup engine has no test hook)");
    if (typeof window.dragonPopupServerMmm !== "function") fail("window.dragonPopupServerMmm is missing \u2014 nothing would ever tell the popup which number is live");
    if (typeof window.dragonPopupSuppress !== "function") fail("window.dragonPopupSuppress is missing \u2014 a check-up run could be interrupted by a popup");
    if (typeof window.dragonServerRpc !== "function") fail("window.dragonServerRpc is missing (the shared rpc path, rule I104)");
    if (!window.DRAGON_POPUP) fail("window.DRAGON_POPUP is missing \u2014 no popup is published");
    var d = null;
    for (var i = 0; i < 30 && !d; i++) { try { d = JSON.parse(await window.dragonServerRpc("dragonPopupDiag", "")); } catch (e) { d = null; } if (!d) await sleep(200); }
    if (!d || d.ok !== true) fail("dragonPopupDiag did not answer (the POPUP region is not reachable)");
    if (!d.fits) fail("the POPUP region does not fit between the popularity mirror and the month ledger (popOk is false)");
    if (!(d.cap > 1000)) fail("the POPUP region holds only " + d.cap + " slots \u2014 it is not where it should be");
    if (d.rec !== 272) fail("a popup record is " + d.rec + " bytes, expected 272 (16 + 8\u00D78 counters)");
    if (d.qmax !== 8 || d.omax !== 8) fail("the popup answer matrix is " + d.qmax + "\u00D7" + d.omax + ", expected 8\u00D78");
    if (!d.same) fail("the two POPUP copies are NOT in lockstep (" + d.used + " vs " + d.used2 + " slots) \u2014 a write missed the mirror");
    var s = window.dragonPopupState();
    var pub = Number(window.DRAGON_POPUP.mmm) | 0;
    if (s.mmm !== pub) fail("the module carries popup #" + s.mmm + " but the page publishes #" + pub);
    if (s.serverMmm == null) fail("the server never reported a popup number \u2014 applyStats does not hand `popupMmm` to the module");
    if (s.serverMmm !== s.mmm) fail("the server says popup #" + s.serverMmm + " is live while the page publishes #" + s.mmm + " \u2014 SERVER_POPUP_MMM and DRAGON_POPUP.mmm must be bumped together");
    if (s.open) fail("a popup was already on screen before the test");
    // ---- the WRITE path, on the live popup, with a probe identity that leaves only ONE extra view and ONE
    // extra "pressed Send" behind (no answer option is ever counted: every pair sent below is out of range).
    var probe = "checkup-popup-" + Date.now().toString(36);
    var rpcv = async function (m, payload) { try { return JSON.parse(await window.dragonServerRpc(m, payload === undefined ? "" : JSON.stringify(payload))); } catch (e) { return null; } };
    function cellsOf(rep, mmm) {
      var row = null;
      for (var k = 0; k < ((rep && rep.l) || []).length; k++) if ((rep.l[k].m | 0) === mmm) row = rep.l[k];
      return row;
    }
    var v1 = await rpcv("dragonPopupView", { m: s.mmm, u: probe });
    if (!v1 || v1.ok !== true) fail("the server refused a view report for the live popup (" + ((v1 && v1.err) || "no answer") + ")");
    if (!((v1.v | 0) >= 1)) fail("a view report did not move the counter (v=" + v1.v + ")");
    var v2 = await rpcv("dragonPopupView", { m: s.mmm, u: probe });
    if (!v2 || v2.ok !== false || v2.err !== "dup") fail("the SAME identity was allowed to report the same view twice (answer " + JSON.stringify(v2) + ")");
    // 🔐 Egon 25.09.2026 (W-UI222) — the report is a PRIVILEGED endpoint now: the admin gate moved to the
    // SERVER, so a connection that has not signed in must be refused. That refusal IS the security property
    // asserted here; the 8×8 matrix itself is proven by the vote answer (`bad.c === 0`) and the diag lockstep.
    var lockedRep = await rpcv("dragonPopupReport");
    if (!lockedRep || lockedRep.ok !== false || lockedRep.err !== "unauthorized") {
      fail("dragonPopupReport is not locked behind the server-side admin gate: " + JSON.stringify(lockedRep));
    }
    var bad = await rpcv("dragonPopupVote", { m: s.mmm, u: probe, a: [[9, 9], [-1, 0], [8, 0]] });
    if (!bad || bad.ok !== true) fail("the server refused a vote report for the live popup (" + ((bad && bad.err) || "no answer") + ")");
    if ((bad.c | 0) !== 0) fail("an answer whose question/option index is OUT OF RANGE was counted (" + bad.c + " cell(s)) \u2014 the 8\u00D78 matrix is not enforced");
    if (!((bad.a | 0) >= 1)) fail("a vote report did not move the \u201Canswered\u201D counter (a=" + bad.a + ")");
    var v3 = await rpcv("dragonPopupVote", { m: s.mmm, u: probe, a: [] });
    if (!v3 || v3.ok !== false || v3.err !== "dup") fail("the SAME identity was allowed to send its answers twice (answer " + JSON.stringify(v3) + ")");
    var d2 = await rpcv("dragonPopupDiag");
    if (!d2 || !d2.same) fail("the popup copies fell out of lockstep right after a real write");
    if ((d2.mmmMax | 0) < s.mmm) fail("the region still has never seen popup #" + s.mmm + " (mmmMax " + d2.mmmMax + ") after a real report");
    if (!((d2.used | 0) >= 1)) fail("the region holds no record after a real report");
    // ---- the WINDOW itself
    var t = window.dragonPopupTest();
    if (!t.opened) fail("the popup window did not open");
    var isNotice = window.DRAGON_POPUP.kind === "notice";
    if (isNotice) {
      // 🛡️ A notice popup is a SHIELD (W-UI309): one action button, and NO way out except that button.
      if (!t.shield) fail("a notice popup must be a SHIELD (no escape hatch)");
      if (!(t.actions >= 1) || !t.hasAction) fail("a notice popup must carry at least one action button");
      if (t.hasClose) fail("a SHIELD popup must not have a Close button");
    } else {
      if (!(t.questions >= 1)) fail("the popup drew no question at all");
      if (!t.hasClose) fail("the popup has no Close button");
      if (!t.hasSend) fail("a survey popup has no Send button");
      if (!t.revealed) fail("choosing the answer that reveals a sub-question did NOT open it (" + t.questions + " \u2192 " + t.questionsAfterReveal + ")");
      if (!(t.revealedOptions > t.options)) fail("the sub-question opened but its answers were not drawn");
      if (!t.deselect) fail("dropping the answer did not hide the sub-question again \u2014 a hidden question would keep its answers alive");
    }
    if (t.fits !== true) fail("the popup does not fit the viewport (" + t.w + "x" + t.h + " against " + window.innerWidth + "x" + window.innerHeight + ")");
    if (t.stillOpen) fail("the popup did not close again");
    if (window.dragonPopupSeenValue() !== t.seen) fail("the test hook spent the \u201Calready seen\u201D flag \u2014 the visitor would never be asked");
    var shape = isNotice
      ? ("a SHIELD notice carrying " + t.actions + " action button(s) and no Close/Escape")
      : ("the window draws " + t.questions + " question(s) \u2192 " + t.questionsAfterReveal + " after the reveal (" + t.revealedOptions + " answers)");
    return "region fits (" + d.cap + " slots \u00D7 " + d.rec + " B at " + d.base + "/" + d.base2 + "), the two copies stay in lockstep through a REAL write, the server reports popup #" + s.serverMmm + " = the published #" + s.mmm + ", a view and an out-of-range answer were both accepted once and refused the second time (" + JSON.stringify(v2.err) + "), an out-of-range pair moved no cell and the report itself is LOCKED to the server-side admin (\u201Cunauthorized\u201D without a sign-in), and " + shape + " \u2014 fits and closes, leaving the once-only flag untouched";
  }

  // 🆕 Egon 25.09.2026 (W-EFOR282) — THE ADMIN REPORT PAGE (#closecodeadmin). The password itself is never
  // known here: the check proves that the door EXISTS and that a WRONG password does not open it, then
  // builds the report view through the module's own test hook (which needs no unlock) and reads the table.
  async function checkAdminPage() {
    if (typeof window.dragonAdminOpen !== "function") fail("window.dragonAdminOpen is missing (src/dragon-admin.js did not load)");
    if (typeof window.dragonAdminState !== "function") fail("window.dragonAdminState is missing");
    if (typeof window.dragonAdminReportTest !== "function") fail("window.dragonAdminReportTest is missing (the report view cannot be measured)");
    if (typeof window.dragonAdminTryLogin !== "function") fail("window.dragonAdminTryLogin is missing (the server pair-check cannot be exercised)");
    if (typeof window.dragonServerRpc !== "function") fail("window.dragonServerRpc is missing (the shared rpc path, rule I104)");
    try {
      window.dragonAdminResetTries();
      var before = window.dragonAdminState();
      if (before.open) fail("the admin page was already open before the test");
      window.dragonAdminOpen();
      var pg = await waitFor(function () { return document.getElementById("dragonAdminPage"); }, TIMEOUT, 120);
      if (!pg) fail("the admin page did not open");
      // IT MUST BE A PAGE: full-area, top-anchored, scrollable — never a centred dialog (Egon 25.09.2026).
      var pr = pg.getBoundingClientRect();
      var vw = window.innerWidth, vh = window.innerHeight;
      if (pg.classList.contains("dg-ov") || pg.querySelector(".dg-card")) fail("the admin page is still built as a popup window (.dg-ov/.dg-card) instead of a page");
      if (pr.width < vw * 0.95 || pr.height < vh * 0.95) fail("the admin page only covers " + Math.round(pr.width) + "x" + Math.round(pr.height) + " of the " + vw + "x" + vh + " viewport");
      if (pr.top > 4) fail("the admin page is not anchored to the top of the viewport (top=" + Math.round(pr.top) + ")");
     if (window.dragonAdminState().authed) fail("the admin page opened ALREADY AUTHORIZED \u2014 the gate was skipped");
      // Egon 29.10.2026 (A1) — hermetic baseline: the attempt itself never unlocks, but the owner's
      // remembered session can auto-unlock the page around the test, so only a lock-to-unlock
      // transition after the wrong pair may fail (not a page that was already authed before it).
      var preBad = window.dragonAdminState();
     var uInp = pg.querySelector("[data-dragon-admin-user]"), pInp = pg.querySelector("[data-dragon-admin-pw]");
      if (!uInp) fail("the admin gate has no USERNAME field (Egon asked for username + password)");
      if (!pInp) fail("the admin gate has no password field");
      var sign = pg.querySelector("[data-dragon-admin-signin]");
      if (!sign) fail("the admin gate has no Sign In button");
      if (/site owner|admin password to read|enter the admin/i.test(pg.textContent || "")) fail("the admin gate still carries the explanatory paragraph Egon removed");
      // The SERVER must refuse a wrong pair, and the page must stay locked. The attempt goes through the
      // page's OWN sign-in path via the test hook, so the credential fields are never filled: typing into
      // them made the browser's password manager offer to save "check-up-wrong" on every sweep, and Egon
      // kept seeing that prompt even after choosing "never save" (Egon 26.09.2026).
      if (pInp.type === "password") fail("the admin password field is a native password input \\u2014 the browser will offer to save the credential on every sign-in");
      if (typeof sign.onclick !== "function") fail("the Sign In button has no click handler");
      if (typeof window.dragonAdminLoginTest !== "function") fail("window.dragonAdminLoginTest is missing (the sign-in path cannot be exercised without filling the fields)");
     var bad = await window.dragonAdminTryLogin("check-up-wrong-" + Date.now().toString(36), "check-up-wrong");
     if (bad && bad.ok === true) fail("the SERVER accepted a wrong username/password pair");
      if (window.dragonAdminState().authed && !preBad.authed && !preBad.serverAuthed) fail("a WRONG pair authorized the page");
      var lt = await window.dragonAdminLoginTest("check-up-wrong", "check-up-wrong");
      // Egon 29.10.2026 (A1) — hermetic: the attempt result (ok) is decided by the server alone;
      // the page-state read above is the only place a remembered owner session may show.
      if (!lt || lt.ok) fail("a WRONG pair signed the page in");
      if (!/wrong|too many|required/i.test(String(lt.msg || ""))) fail("a wrong pair produced no visible message");
      if (!document.getElementById("dragonAdminPage")) fail("the admin page closed itself after a wrong pair");
      window.dragonAdminClose();
      await waitFor(function () { return !document.getElementById("dragonAdminPage"); }, 2500, 80);
      if (document.getElementById("dragonAdminPage")) fail("the admin page did not close");
      if (String(location.hash || "") === "#closecodeadmin") fail("closing the admin page left #closecodeadmin in the address bar");
      // The report view, rendered with NO credentials at all (the page is measured, nothing is unlocked).
      var rt = await window.dragonAdminReportTest();
      if (!rt.closed) fail("the report self-test did not close its page");
      if (!rt.isPage) fail("the report self-test did not build the admin PAGE");
      if (!(rt.kpis >= 3)) {
        var t0 = String(rt.text || "");
        if (!/refused|not authorized|unauthorized/i.test(t0)) fail("the unauthenticated report request neither returned KPIs nor was refused by the server (\u201C" + t0.slice(0, 120) + "\u201D)");
      }
      if (rt.blocks < 1 && rt.empty < 1) fail("the report drew neither a popup block nor a \u201Cnothing yet\u201D line");
      var fakeRow = { m: 1, v: 42, a: 10, l: Math.floor(Date.now() / 1000), c: [[0, 7], [1, 3], [11, 4]] };
      var unknownRow = { m: 4242, v: 3, a: 0, l: 0, c: [] };
      var rf = await window.dragonAdminReportTest([fakeRow, unknownRow]);
      if (!rf.closed) fail("the report render test did not close its page");
      if (rf.blocks !== 2) fail("the report drew " + rf.blocks + " block(s) for 2 rows");
      if (rf.tables < 1) fail("the report cannot draw an answer table at all");
      if (rf.rows < 3) fail("the answer table drew only " + rf.rows + " row(s) for 3 counted cells");
      var rtx = rf.text || "";
      if (!/#1 \u00b7 A Quick Question About Speed/.test(rtx)) fail("the report did not label a known popup number with its title from POPUP_LABELS");
      if (!/Yes, it feels slow/.test(rtx)) fail("the report did not name a known ANSWER with its label from POPUP_LABELS");
      if (!/Where do you notice it most/.test(rtx)) fail("the report did not name a known QUESTION with its label from POPUP_LABELS");
      if (!/%/.test(rtx)) fail("the report shows no percentage for the answers");
      if (!/labels not kept/.test(rtx)) fail("the report has no fallback for a popup number whose labels were not kept");
      // 🗔 THE "Popups" BUTTON + ITS WINDOW (W-UI309): a dedicated historical-popup window, one block per
      // number, newest first, opened by the button and closable again.
      if (typeof window.dragonAdminPopupsWindow !== "function") fail("window.dragonAdminPopupsWindow is missing (the Popups button has no window to open)");
      if (typeof window.dragonAdminPopupsTest !== "function") fail("window.dragonAdminPopupsTest is missing (the Popups window cannot be measured)");
      var pwt = await window.dragonAdminPopupsTest();
      if (!pwt.opened || !pwt.isWindow) fail("the Popups window did not open as a window");
      if (pwt.blocks < 2) fail("the Popups window drew " + pwt.blocks + " block(s) for 2 rows (expected one per popup number)");
      if (!pwt.hasRefresh || !pwt.hasClose) fail("the Popups window is missing its Refresh or Close control");
      if (!pwt.closed) fail("the Popups window did not close again");
      if (!pwt.fits) fail("the Popups window does not fit the viewport");
      // 🖥 THE SERVER DATA PANEL (Egon 25.09.2026): the page now LANDS on the data dashboard, and the
      // Popups report is the window behind its own button. Measure the whole dashboard from a synthetic
      // payload + manifest (no credentials, no server write, nothing spent).
      if (typeof window.dragonAdminDataTest !== "function") fail("window.dragonAdminDataTest is missing (the Server Data panel cannot be measured)");
      var fd = {
        ok: true,
        stats: { online: 3, onlineRecord: 144, totalImages: 1984, totalUsers: 1234, build: "2.54.1", buildFull: "2.54.1.002" },
        totals: { capSum: 50764000, usedSum: 149784, freeSum: 50614216, pct: 0.3, highWater: 52390000 },
        numbers: { comments: 12, likePairs: 40, hofPictures: 30, monthLikes: 55, popularityRows: 4, popularityCap: 5041, popups: 2, surveySubmissions: 15, surveyItems: 39, rateVotes: [2, 0, 1, 25, 88] },
        map: { ok: true, stateLen: 52428800, count: 2, allFit: true, overlaps: [], rows: [
          { name: "header", base: 0, end: 26, size: 26, used: 26, pct: 100, fits: true },
          { name: "surveyCounters", base: 52388800, end: 52389857, size: 1057, used: 1057, pct: 100, fits: true }
        ] }
      };
      var fm = {
        ok: true, build: "2.54.1", at: "2026-09-25",
        quota: { bytes: 2147483648, files: 10000, perFile: 104857600 },
        index: { b: 336833 }, main: { b: 384970 },
        sum: { files: 3, bytes: 39418082, byCat: { book: [2, 8000000], module: [1, 31418082] } },
        files: [["src/JS/dragon-app-core.js", 1776835, "module"], ["src/BOOKS/Librarybook.enc", 6240544, "book"], ["src/BOOKS/Rulebook.enc", 233504, "book"]]
      };
      var dst = await window.dragonAdminDataTest(fd, fm);
      if (!dst.closed) fail("the Server Data self-test did not close its page");
      if (!dst.isPage) fail("the Server Data self-test did not build the admin PAGE");
      if (!dst.hasData) fail("the admin page did not draw the Server Data panel as its body");
      if (!dst.hasNav) fail("the admin page has no tab row (Server Data / Popups / Refresh)");
      if (dst.tabs.length < 2 || dst.tabs[0] !== "data") fail("the first admin tab must be the data panel, got " + JSON.stringify(dst.tabs));
      if (!dst.hasRefresh) fail("the admin page lost its Refresh control");
      if (!(dst.kpis >= 12)) fail("the data panel drew only " + dst.kpis + " KPI cells \u2014 the state/summary numbers are missing");
      if (!(dst.sections >= 4)) fail("the data panel drew only " + dst.sections + " section(s) \u2014 regions / counters / assets / payload are not all there");
      if (!(dst.regionRows >= 2)) fail("the region table drew only " + dst.regionRows + " row(s) for 2 regions");
      if (!dst.hasAssets) fail("the data panel has no src/ asset section");
      if (!dst.hasPayload) fail("the data panel has no live-payload section");
      var dtx = dst.text || "";
      if (!/durable regions/i.test(dtx)) fail("the data panel does not name the durable regions");
      if (!/src\/ assets/i.test(dtx)) fail("the data panel does not name the src/ assets");
      if (!/2 GiB/i.test(dtx)) fail("the data panel does not state the storage quota it measures against");
      if (!/generator total/i.test(dtx)) fail("the data panel does not total the generator's own size");
      if (!/answer rate/.test(rtx)) fail("the popups report lost its answer-rate KPI");
      return "the #closecodeadmin surfaces as a FULL-AREA PAGE (" + Math.round(pr.width) + "x" + Math.round(pr.height) + " of " + vw + "x" + vh + ", top-anchored, not a dialog), asks for a USERNAME + PASSWORD pair, the SERVER refuses a wrong pair so the page stays locked and says so, closing it restores the address, the report view draws " + rt.blocks + " live block(s) with " + rt.kpis + " KPI cells and " + rf.tables + " answer table(s) with " + rf.rows + " answer row(s) from a synthetic row, and the Popups button opens a dedicated window with " + pwt.blocks + " historical blocks, and the page LANDS on the SERVER DATA dashboard (" + dst.kpis + " KPI cells, " + dst.regionRows + " region row(s), " + dst.sections + " sections: regions / counters / assets against the 2 GiB quota / live payload) (sample: \u201C" + dst.sample.slice(0, 60) + "\u2026\u201D)";
    } finally {
      try { window.dragonAdminClose(); } catch (e) {}
      try { window.dragonAdminResetTries(); } catch (e) {}
    }
  }

  // ---- Ban vault browser (Egon 17.10.2026) ----
  // The Banned images tab lists the archived bans from the editable vault file with pictures and a
  // per-row Unban, measured through the test hook (no credentials, no vault write, nothing spent).
  async function checkBanVault() {
    if (typeof window.dragonAdminVaultTest !== "function") fail("window.dragonAdminVaultTest is missing (the ban vault browser has no test hook)");
    var t = null;
    try { t = await window.dragonAdminVaultTest(); } catch (e) { t = null; }
    if (!t) fail("the ban vault self-test did not answer");
    if (t.err) fail("the ban vault self-test raised: " + t.err);
    if (!t.box) fail("the ban vault section did not build on the Banned images tab");
    if (!t.payload) fail("the vault Unban payload builder drops the wrong entry");
    var stat = String(t.stat || "");
    var m = /vault file: (\d+) image\(s\)/.exec(stat);
    if (!m) fail("the vault status line is missing (" + stat.slice(0, 80) + ")");
    var held = +m[1];
    if (held > 0) {
      if (!(t.rows >= 1)) fail("the vault holds " + held + " image(s) but the browser drew no rows");
      if (t.unbans !== t.rows) fail("only " + t.unbans + " of " + t.rows + " vault rows carry an Unban button");
      if (!t.modal) fail("the vault Unban button did not open the key prompt");
    }
    return "vault browser lists the archived bans (" + held + " image(s), " + t.rows + " row(s) drawn, " + t.thumbs + " with pictures" + (t.hxNote ? ", hash-only noted" : "") + "), every row carries Unban, the prompt opens, the removal payload drops exactly the one entry";
  }

  // 📋 Egon 25.09.2026 (W-UI313 + W-UI314) — THE FEEDBACK / WORKLIST PANELS. Egon's rule change: the FL list
  // is no longer pasted under every chat reply — it (and the open work items) are read from a page behind
  // the admin door, and every record must say in plain words WHAT it is, WHEN it was opened, its F/R/S
  // score, the build it shipped in and WHAT is expected from him. Both panels read the ENCRYPTED books, so
  // this check measures the whole renderer from a synthetic book text — no passphrase, no fetch, no write.
  async function checkAdminRecords() {
    if (typeof window.dragonAdminRecordsTest !== "function") fail("window.dragonAdminRecordsTest is missing (the record panels cannot be measured)");
    if (typeof window.dragonAdminFeedbackWindow !== "function") fail("window.dragonAdminFeedbackWindow is missing (the \uD83D\uDCCB Feedback button has no window)");
    if (typeof window.dragonAdminWorklistWindow !== "function") fail("window.dragonAdminWorklistWindow is missing (no panel for the open work items)");
    if (typeof window.dragonAdminPackagesTest !== "function") fail("window.dragonAdminPackagesTest is missing (the \uD83D\uDCE6 Packages panel has no window)");
    var flBook =
      "=== FEEDBACKLIST ===\n# 3. PANEL INDEX (machine-readable)\n" +
      "@REC|FEED-16|W-DATA188|2026-09-23|8|5|4|OPEN (feedback bekliyor)|2.45.0|Dexa artik sitenin tam bilgisine sahip.|Senin sonuc degerlendirmen.\n" +
      "@REC|FEED-17|W-UI194|2026-09-24|6|5|5|OPEN - 2026-09-24|2.47.7|I'm HERE rozeti ekranin icinde durur.|Onayin.\n\n" +
      "## FEED-16 \u00B7 W-DATA188 \u00B7 \uD83D\uDC09 Dexa tam site bilgisi\nStatus: OPEN (feedback bekliyor, 2026-09-23)\n\n" +
      "## FEED-1 \u00B7 W-DATA181 \u00B7 typo\nStatus: CLOSED - 2026-09-23\n";
    var wlBook =
      "=== WORKLIST ===\n# 0. PANEL INDEX (machine-readable)\n" +
      "@REC|W-UI313|WO-000|2026-09-25|6|3|5|OPEN - 25.09.2026|\u2014|Feedback listesi admin paneline tasindi.|Onayin.|WP-UI001\n\n" +
      "## W-UI313 (F6-R3-S5) - \uD83D\uDCCB FEEDBACK SAYFASI\nStatus: OPEN - 25.09.2026\n\n" +
      "## W-DATA311 (F8-R5-S5) - SERVER DATA PANOSU\nStatus: DONE (kod) - 2026-09-25\n";
    var fl = await window.dragonAdminRecordsTest("FEED", flBook);
    if (!fl.opened || !fl.isWindow) fail("the Feedback panel did not open as a window");
    if (!fl.closed) fail("the Feedback panel did not close again");
    if (!fl.hasRefresh || !fl.hasClose) fail("the Feedback panel is missing its Refresh or Close control");
    if (!fl.fits) fail("the Feedback panel does not fit the viewport");
    if (fl.cards !== 2) fail("the Feedback panel drew " + fl.cards + " open card(s) for 2 @REC rows");
    if (!(fl.kpis >= 4)) fail("the Feedback panel drew only " + fl.kpis + " KPI cell(s)");
    if (!(fl.sections >= 2)) fail("the Feedback panel must separate OPEN from the archive (sections=" + fl.sections + ")");
    var ft = fl.text || "";
    if (!/Dexa artik sitenin tam bilgisine sahip/.test(ft)) fail("the Feedback panel did not render the plain-language wording of a record");
    if (!/2026-09-23/.test(ft)) fail("the Feedback panel did not render the record's OPENING DATE");
    if (!/F8/.test(ft) || !/R5/.test(ft) || !/S4/.test(ft)) fail("the Feedback panel did not render the F/R/S score of a record");
    if (!/2\.45\.0/.test(ft)) fail("the Feedback panel did not render the build a record was delivered in");
    if (!/Expected from you/.test(ft)) fail("the Feedback panel does not say what is expected from Egon");
    if (!/FEED-1/.test(ft)) fail("the Feedback panel did not list the closed archive");
    var wl = await window.dragonAdminRecordsTest("W", wlBook);
    if (!wl.opened || !wl.isWindow) fail("the Worklist panel did not open as a window");
    if (wl.cards !== 1) fail("the Worklist panel drew " + wl.cards + " open card(s) for 1 @REC row");
    var wt = wl.text || "";
    if (!/Feedback listesi admin paneline tasindi/.test(wt)) fail("the Worklist panel did not render its record's plain wording");
    if (!/2026-09-25/.test(wt)) fail("the Worklist panel did not render the record's opening date");
    if (!/F6/.test(wt) || !/R3/.test(wt) || !/S5/.test(wt)) fail("the Worklist panel did not render the F/R/S score");
    // and the two buttons really are on the admin nav
    if (!/WP-UI001/.test(wt)) fail("the Work list panel did not render the package a record belongs to");
    // \uD83D\uDCE6 the PACKAGES page: the workspaceplan's WP-<CAT><no> table, rendered from synthetic text
    var wpBook = "# 16. PACKAGE INDEX\n" +
      "| WP-DATA001 | DATA | Survey durable state | KAPALI 2.53.3 | W-DATA298 |\n" +
      "| WP-PERF003 | PERF | Runtime CPU: timers, observers, listeners | ACIK | W-PERF296, W-PERF118, W-PERF325 |\n";
    var pk = await window.dragonAdminPackagesTest(wpBook);
    if (!pk.isWindow) fail("the Packages panel did not open as a window");
    if (!pk.closed) fail("the Packages panel did not close again");
    if (!pk.fits) fail("the Packages panel does not fit the viewport");
    if (pk.rows !== 2) fail("the Packages panel drew " + pk.rows + " row(s) for 2 packages");
    if (!(pk.kpis >= 4)) fail("the Packages panel drew only " + pk.kpis + " KPI cell(s)");
    if (!/WP-PERF003/.test(pk.text) || !/W-PERF296/.test(pk.text)) fail("the Packages panel did not render a package code together with its work records");
    if (!/WP-<CAT><no>/.test(pk.text)) fail("the Packages panel does not name the code system it lists");
    var nav = await window.dragonAdminDataTest({ ok: true, stats: {}, totals: {}, numbers: {}, map: { rows: [] } }, null);
    var tabs = (nav && nav.tabs) || [];
    if (tabs.indexOf("feed") === -1 || tabs.indexOf("work") === -1 || tabs.indexOf("packages") === -1) fail("the admin nav has no Feed / Work / Packages tab (found " + JSON.stringify(tabs) + ")");
    return "the \uD83D\uDCCB Feedback and \uD83D\uDCCB Work list panels both open as windows (" + fl.cards + " open FEED card(s) + archive, " + wl.cards + " open W card(s)), each record renders in plain words with its opening date, its F/R/S score, the build it shipped in, the package it belongs to and what is expected from Egon, the OPEN section is separated from the closed archive, the \uD83D\uDCE6 Packages page lists the workspaceplan's WP-<CAT><no> packages (" + pk.rows + " row(s), " + pk.kpis + " KPI cell(s)) with their member work records, and all three buttons live on the admin nav (tabs: " + tabs.join(", ") + ")";
  }

  // 🆕 Egon 25.09.2026 (W-EFOR282) — WHAT'S NEW. The card must read the SAME notes the update-notes feed reads
  // (counted here independently from the document's own comment nodes) and must be dated to today/yesterday.
  async function checkWhatsNew() {
    if (typeof window.dragonWhatsNewState !== "function") fail("window.dragonWhatsNewState is missing (src/dragon-whatsnew.js did not load)");
    if (typeof window.dragonWhatsNewTest !== "function") fail("window.dragonWhatsNewTest is missing (the card cannot be measured)");
    if (typeof window.dragonWhatsNewNotes !== "function") fail("window.dragonWhatsNewNotes is missing");
    function key(d) { function p(n) { return (n < 10 ? "0" : "") + n; } return p(d.getDate()) + "." + p(d.getMonth() + 1) + "." + d.getFullYear(); }
    var want = {}; want[key(new Date())] = 1; want[key(new Date(Date.now() - 86400000))] = 1;
    var mine = 0, top = 0;
    try {
      var w = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_COMMENT, null, false);
      while (w.nextNode()) {
        var lines = (w.currentNode.data || "").split("\n");
        for (var i = 0; i < lines.length; i++) {
          var m = lines[i].match(/^\s*\[U(\d+)\]\s+(\d{2}\.\d{2}\.\d{4})\s*\|/);
          if (!m) continue;
          var num = parseInt(m[1], 10);
          if (num > top) top = num;
          if (want[m[2]]) mine++;
        }
      }
    } catch (e) { fail("the update notes could not be read from the document: " + e); }
    if (!top) fail("the document carries no [U<number>] update note at all");
    var notes = window.dragonWhatsNewNotes();
    var total = (typeof window.dragonWhatsNewEligible === "function") ? window.dragonWhatsNewEligible() : notes.length;
    if (total !== mine) fail("the card counts " + total + " note(s) for today+yesterday while the document carries " + mine + " \u2014 it is not reading the same list the update notes come from");
    if (notes.length > total) fail("the card drew more rows than there are notes");
    if (notes.length && notes.length !== Math.min(total, 6)) fail("the card draws " + notes.length + " row(s) of " + total + " eligible \u2014 expected the newest " + Math.min(total, 6));
    var st = window.dragonWhatsNewState();
    if (!st.tops || !st.tops.length) fail("the module read no notes at all");
    var newest = String(st.tops[0]).split(" ")[0];
    if ((parseInt(newest, 10) | 0) !== top) fail("the newest note it read is #" + newest + " but the document's newest is #" + top);
    var probe = null;
    if (!notes.length) {
      probe = { n: top + 1, date: key(new Date()), title: "check-up probe", text: "A synthetic row \u2014 nothing is dated today or yesterday, so the card is measured with this instead." };
    }
    var t = window.dragonWhatsNewTest(probe);
    if (!t.opened) fail("the What\u2019s New card did not build");
    if (!(t.rows >= 1)) fail("the card has no note rows");
    if (!t.hasGot) fail("the card has no \u201CGot it\u201D button");
    if (t.fits !== true) fail("the card does not fit the viewport (" + t.w + "x" + t.h + " against " + window.innerWidth + "x" + window.innerHeight + ")");
    if (t.seenAfter !== t.seen) fail("the test card spent the \u201Calready seen\u201D flag");
    if (t.stillOpen) fail("the test card did not close");
    return "the card reads the SAME " + total + " note(s) dated today+yesterday that the document carries (newest #" + top + ", independently counted), draws " + t.rows + " row(s) at " + t.w + "x" + t.h + " inside the viewport, offers \u201CGot it\u201D, closes cleanly and spends nothing" + (probe ? " (measured with a probe row: nothing is dated today or yesterday right now)" : "");
  }

  // Egon 22.09.2026 (rule I113): the button families must hold their standards — measured live. Observation
  // only (no clicks, no page switches); a family that is not on screen is reported as skipped, never failed.
  function checkBtnFamilies() {
    var fails = [], parts = [];
    // (1) TOOLBAR FAMILY — INFORMATIONAL here: the toolbar rows are asserted by `kissing-standard` (one height +
    //     0 gap) and `gal-toolbar`; this line records what was on screen when the families were measured.
    var icAll = qa(".dragon-gal-icbtn").filter(isVisible);
    var icons = qa(".dragon-gal-bar button, .dragon-gal-bar select").filter(isVisible);
    if (icons.length) {
      var hs = {}; icons.forEach(function (b) { hs[Math.round(b.getBoundingClientRect().height)] = (hs[Math.round(b.getBoundingClientRect().height)] || 0) + 1; });
      parts.push("toolbar controls " + icons.length + " @ " + Object.keys(hs).map(function (h) { return h + "px×" + hs[h]; }).join(", "));
    } else parts.push("toolbar controls none on screen (skipped)");
    parts.push("labelled .dragon-gal-icbtn " + icAll.length);
    // (2) MINI ICON FAMILY — the Control-Panel / Description icon column is one fixed SQUARE size.
    var col = qa(".random-input-btn-ctn > button").filter(isVisible);
    if (col.length) {
      var c0 = col[0].getBoundingClientRect();
      var cbad = col.filter(function (b) { var r = b.getBoundingClientRect(); return Math.abs(r.width - r.height) > 3; });
      parts.push("mini icon buttons " + col.length + " @ " + Math.round(c0.width) + "x" + Math.round(c0.height) + (cbad.length ? " (" + cbad.length + " not square)" : ", square"));
      if (cbad.length) fails.push("a Control-Panel mini button is not square (" + cbad.length + " of " + col.length + ")");
    } else parts.push("mini icon buttons none on screen (skipped)");
    // (3) LIVING BUTTON FAMILY — a true on/off toggle names its state and carries a tooltip. (Its green/grey
    //     state COLOUR is only visible outside the Settings board: while a living button sits in a board card,
    //     the board's theme rules own the border colour — measured and reported, not failed here.)
    var live = qa(".dragon-living-btn");
    var toggles = 0, lbad = [], outside = [];
    live.forEach(function (b) {
      var t = (b.textContent || "").trim();
      var m = t.match(/:\s*(On|Off)\s*$/);
      if (!m) return;                                  // a cycler (Numbers / Home Page / Load Speed) is not an on/off toggle
      toggles++;
      var tipAttr = ((b.getAttribute("title") || "") + " " + (b.getAttribute("data-dragon-tip") || "")).trim();
      if (!tipAttr) lbad.push(t.slice(0, 24) + " (no tooltip)");
      if (!b.closest(".dragon-set-card")) outside.push(t.slice(0, 24) + "=" + (getComputedStyle(b).borderTopColor || "").replace(/\s+/g, ""));
    });
    parts.push("living buttons " + live.length + ", of which " + toggles + " on/off toggle(s)" + (lbad.length ? " — " + lbad.slice(0, 2).join("; ") : ", label + tooltip agree"));
    if (outside.length) parts.push("outside a card: " + outside.slice(0, 3).join(", "));
    if (lbad.length) fails.push(lbad[0]);
    if (fails.length) fail(fails.join(" | "));
    return parts.join(" · ");
  }

  /* ------------------------------------- automatic prompt add-ons (Egon 26.09.2026) */
  // The two Control-Panel mini toggles that switch OFF the text the generator injects on its own (quality
  // tags / negatives). The check drives them through the module's own hook, reads the prompt the generator
  // would really send (___getImageOptions), and ALWAYS restores the visitor's stored choice in a finally block.
  async function checkAutoTags() {
    if (typeof window.dragonAutoTagsTest !== "function") fail("the automatic-tags module is missing (window.dragonAutoTagsTest)");
    if (typeof window.dragonAutoTagsToggle !== "function") fail("window.dragonAutoTagsToggle is missing");
    if (typeof window.___getImageOptions746291937 !== "function") fail("window.___getImageOptions746291937 is missing - the assembled prompt cannot be measured");
    // 🏷 The toggles live in the Control Panel's mini-button row, which belongs to the ✨ Generate page, so
    // the page has to be ON SCREEN before their geometry can be measured (same setup as checkMiniArrange).
    var prevPage = ""; try { prevPage = String(window.dragonPage || ""); } catch (e) {}
    var panelBody0 = document.querySelector(".dragon-control-body");
    var panelWasInline = panelBody0 ? panelBody0.style.display : null;
    if (window.dragonGoPage) { try { window.dragonGoPage("generate"); } catch (e) {} }
    // Make sure the Control Panel is OPEN on the generate page: what gets measured is its little row of
    // buttons, and the page switch lands its own visibility pass a moment after the call, so retry.
    for (var attempt = 0; attempt < 12; attempt++) {
      await waitFor(function () { return window.dragonPage === "generate" ? true : null; }, 1500, 120);
      var ctlBody = document.querySelector(".dragon-control-body");
      var ctlHead = document.querySelector(".dragon-control-panel > button");
      if (ctlBody && ctlBody.style.display === "none" && ctlHead) { try { ctlHead.click(); } catch (e) {} }
      var rowEl = document.getElementById("dragonDescBtnsRow");
      if (rowEl && rowEl.getBoundingClientRect().width > 4) break;
      await sleep(250);
    }
    var s = window.dragonAutoTagsTest();
    if (!s.row) fail("the Control Panel's mini-button row (#dragonDescBtnsRow) is not on the page");
    if (!s.mounted || !s.qSize || !s.nSize) fail("the two automatic-tags toggles are not in the Control Panel row");
    if (!s.sameSize || s.qSize[0] < 20 || s.qSize[1] < 20) fail("a toggle is not the mini-button family size (" + JSON.stringify(s.qSize) + " vs " + JSON.stringify(s.nSize) + ")");
    if (s.qGlyph !== "\uD83C\uDFF7\uFE0F") fail("the quality-tags toggle carries the wrong glyph (" + s.qGlyph + ")");
    if (s.nGlyph !== "\uD83D\uDEAB") fail("the negatives toggle carries the wrong glyph (" + s.nGlyph + ")");
    // Read the options function LIVE at every call: the framework can swap it out as pages settle.
    var g = function () { return window.___getImageOptions746291937(); };
    // The wrapper around the options function is installed by a periodic job which (by design)
    // does not run while the page is HIDDEN - and the test/preview page can be hidden - so ask
    // the app to install it now and retry; otherwise the probe below would read the RAW options
    // and report a phantom failure.
    for (var wtry = 0; wtry < 20 && !(window.___getImageOptions746291937 && window.___getImageOptions746291937.__dragonSeed); wtry++) {
      try { if (typeof window.dragonSeedInjectorEnsure === "function") window.dragonSeedInjectorEnsure(); } catch (e) {}
      await sleep(150);
    }
    if (!(window.___getImageOptions746291937 && window.___getImageOptions746291937.__dragonSeed)) fail("the wrapped image-options function could not be installed (the generation assembly cannot be measured)");
    function tx(v) { return String(v == null ? "" : v); }
    function nm(t) { return t.replace(/\s+/g, " ").trim(); }
    var descEl = document.querySelector('textarea[data-name="description"]');
    var desc = descEl ? String(descEl.value || "").trim() : "";
    var q0 = s.qOn, n0 = s.nOn, baseP = "", baseN = "", offP = "", offN = "";
    var negEl = null, negWas = null, NEG_MARK = "checkup-neg-marker";
    var cmDetail = "";
    var detail = "";
    try {
      // Force both switches ON for the baseline so the measurement is the same whatever the visitor
      // left them as (this check used to ASSUME they start ON, which made it fail on a browser that
      // had them switched off). The visitor's own choice is put back in the finally.
      if (!window.dragonAutoQualityTagsOn()) window.dragonAutoTagsToggle("q");
      if (!window.dragonAutoNegativesOn()) window.dragonAutoTagsToggle("n");
      baseP = tx(g().prompt);
      baseN = tx(g().negativePrompt);
      if (!/ultra realistic photo|masterpiece, best quality/.test(baseP)) fail("a prompt assembled with the switches ON carries no injected quality tag at all");
      if (desc && baseP.indexOf(desc) === -1) fail("the visitor's own description is not in the assembled prompt");
      window.dragonAutoTagsToggle("q");
      if (window.dragonAutoQualityTagsOn()) fail("switching the quality tags OFF did not stick");
      offP = tx(g().prompt);
      if (offP === baseP) fail("the quality-tags switch changed nothing in the assembled prompt");
      if (/ultra realistic photo|masterpiece, best quality/.test(offP)) fail("injected quality tags are still in the prompt while the switch is OFF");
      if (desc && offP.indexOf(desc) === -1) fail("with the quality tags OFF the visitor's own description disappeared from the prompt");
      window.dragonAutoTagsToggle("q");
      if (tx(g().prompt) !== baseP) fail("switching the quality tags back ON did not restore the prompt exactly");
      // W-UI327 turu (26.09.2026) — ROBUSTNESS: the visitor's Negatives box can be EMPTY or can already equal
      // the style's own negative list, in which case the ON and OFF probes look identical and this item
      // reported a false failure. Probe with a controlled MARKER in the box instead: with the switch OFF the
      // assembled negative must be exactly what the visitor typed (the marker); with the switch ON the marker
      // must be gone. The visitor's own value is put back in the finally.
      negEl = document.querySelector('[data-name="negative"]');
      negWas = negEl ? String(negEl.value || "") : null;
      var stashWas = null;
      try { stashWas = localStorage.getItem("dragonNegativesStash"); } catch (e) {}
      if (!window.dragonAutoNegativesOn()) window.dragonAutoTagsToggle("n");
      var baseN2 = tx(g().negativePrompt);
      window.dragonAutoTagsToggle("n");
      if (window.dragonAutoNegativesOn()) fail("switching the auto negatives OFF did not stick");
      // Egon 01.10.2026 — switching OFF now EMPTIES the Negatives box (the previous content is stashed):
      // probe the OFF assembly with the marker written AFTER the switch, and put the visitor's own box
      // (and stash) back before switching ON again so the round-trip comparison is exact.
      if (negEl && String(negEl.value || "") !== "") fail("switching the auto negatives OFF did not empty the Negatives box");
      if (negEl) { negEl.value = NEG_MARK; negEl.dispatchEvent(new Event("input", { bubbles: true })); await sleep(150); }
      offN = tx(g().negativePrompt);
      if (negEl && offN.indexOf(NEG_MARK) === -1) fail("with the auto negatives OFF the negative prompt is not the visitor's own box content [" + offN.slice(0, 90) + "]");
      if (offN === baseN2) fail("the negatives switch changed nothing in the assembled negative prompt [" + offN.slice(0, 80) + "]");
      if (negEl) { negEl.value = negWas == null ? "" : negWas; negEl.dispatchEvent(new Event("input", { bubbles: true })); await sleep(150); }
      try { localStorage.removeItem("dragonNegativesStash"); } catch (e) {}
      window.dragonAutoTagsToggle("n");
      if (!window.dragonAutoNegativesOn()) fail("switching the auto negatives back ON did not stick");
      if (tx(g().negativePrompt) !== baseN2) fail("switching the negatives back ON did not restore the negative prompt exactly");
      // No automatic safety block: the assembled prompt must never carry the retired
      // safety tags, whatever the switches say (the prompt goes exactly as written
      // plus the art style's addition and the optional quality tags).
      var setQ = function (v) { if (window.dragonAutoQualityTagsOn() !== v) window.dragonAutoTagsToggle("q"); };
      var setN = function (v) { if (window.dragonAutoNegativesOn() !== v) window.dragonAutoTagsToggle("n"); };
      var reGone = new RegExp("wholesome," + String.fromCharCode(92) + "s*innocent," + String.fromCharCode(92) + "s*family friendly|n"+"sfw," + String.fromCharCode(92) + "s*nudity," + String.fromCharCode(92) + "s*naked", "i");
      setQ(true);
      setN(true);
      if (reGone.test(tx(g().prompt))) fail("the assembled prompt carries a retired safety tag");
      if (reGone.test(tx(g().negativePrompt))) fail("the assembled negative prompt carries a retired suppression tag");
      setQ(false);
      if (reGone.test(tx(g().prompt))) fail("the assembled prompt carries a retired safety tag while the quality-tags switch is OFF");
      setN(false);
      if (reGone.test(tx(g().negativePrompt))) fail("the assembled negative prompt carries a retired suppression tag while the auto-negatives switch is OFF");
      setQ(true);
      setN(true);
      cmDetail = "; no safety tags in any switch state";
      detail = "two toggles in the Control Panel row at " + s.qSize[0] + "x" + s.qSize[1] + " and " + s.nSize[0] + "x" + s.nSize[1]
        + "; prompt " + nm(baseP).length + " chars -> " + nm(offP).length + " with the quality tags OFF and back exactly"
        + "; negative " + nm(baseN).length + " -> " + nm(offN).length + " with the auto negatives OFF and back exactly"
        + cmDetail;
    } finally {
      try { if (panelBody0 && panelWasInline !== null) panelBody0.style.display = panelWasInline; } catch (e) {}
      try { if (window.dragonAutoQualityTagsOn && window.dragonAutoQualityTagsOn() !== q0) window.dragonAutoTagsToggle("q"); } catch (e) {}
      try { if (window.dragonAutoNegativesOn && window.dragonAutoNegativesOn() !== n0) window.dragonAutoTagsToggle("n"); } catch (e) {}
      try { if (negEl && negWas !== null) { negEl.value = negWas; negEl.dispatchEvent(new Event("input", { bubbles: true })); } } catch (e) {}
      try { if (typeof stashWas !== "undefined") { if (stashWas == null) localStorage.removeItem("dragonNegativesStash"); else localStorage.setItem("dragonNegativesStash", stashWas); } } catch (e) {}
      try { if (prevPage && prevPage !== "generate" && window.dragonGoPage) window.dragonGoPage(prevPage); } catch (e) {}
    }
    return detail + "; visitor's stored choice restored (quality tags " + (q0 ? "on" : "off") + ", negatives " + (n0 ? "on" : "off") + ")";
  }

  // Egon 03.10.2026 — STYLE REGISTRY LINTER (report T3/T4/T5). Every art style is assembled through
  // the LIVE image-options function with a canary description, so this proves what generation really
  // receives: (T3) the visitor's subject survives in every style, (T4) no non-photographic style inherits
  // photo quality tags, (T5) no child-coded term reaches any style or remaining cuteness option, and the
  // removed cuteness tiers stay gone. The neutral-name pattern below MUST mirror styleQualityTags() in
  // main.pjs — if it drifts, this check is the alarm.
  async function checkStyleRegistry() {
    var s = null;
    try { s = window.___userSettings746291937; } catch (e) {}
    if (!s || !s.userInputs || !s.userInputs.artStyle) fail("the art-style input is not ready");
    var compiled = s.userInputs.artStyle.compiledOptions || {};
    var names = Object.keys(compiled).filter(function (n) { return compiled[n] !== undefined; });
    if (names.length < 500) fail("only " + names.length + " styles enumerated (expected 500+)");
    var prevDesc = "", prevNeg = "", prevStyle = null, q0 = true, n0 = true;
    try { prevDesc = window.input.description; prevNeg = window.input.negative; prevStyle = window.input.artStyle; } catch (e) {}
    try { q0 = window.dragonAutoQualityTagsOn(); n0 = window.dragonAutoNegativesOn(); } catch (e) {}
    var MARK = "linter canary mountain pagoda";
    var PHOTO_MARK = /RAW photograph|35mm film grain|full-frame DSLR|DSLR photograph/i;
    var NEUTRAL_NAME = /anime|manga|cartoon|caricature|cel |comics|chibi|game|fortnite|gta|drawing|painting|illustration|sketch|doodle|watercolor|oil|pastel|charcoal|chalk|pencil|ink |render|terragen|3d|pixel|voxel|ps1|ps2|graphics|visual novel|hollow knight|collage|origami|embroidery|quilling|paper |pointillism|typography|halftone|print|graffiti|sticker|coloring|tribal|miniature|gyotaku|suminagashi|scrimshaw|mokume|palekh|gond|yamato|hanafuda|fayum|silhouette|claymation|stop.motion|sculpture|dada|futurism|suprematism|color field|harlem|googie|afrofutur|atompunk|renaissance|astral|aura|character design|design sheet|neo\.noir|furry|cd cover|cover|album/i;
    var HARD = /childish|lolita|lolicon|\bloli\b|shotacon|jailbait/i;
    var missing = [], photoLeak = [], hardHits = [], cuteHits = [], skipped = 0;
    var g = function () { return window.___getImageOptions746291937(); };
    var t0 = Date.now();
    try {
      if (!window.dragonAutoQualityTagsOn()) window.dragonAutoTagsToggle("q");
      if (!window.dragonAutoNegativesOn()) window.dragonAutoTagsToggle("n");
      try { window.input.description = MARK; window.input.negative = ""; } catch (e) {}
      for (var i = 0; i < names.length; i++) {
        var p = "", n2 = "";
        try { window.input.artStyle = compiled[names[i]]; } catch (e) { skipped++; continue; }
        try { p = String(g().prompt || ""); n2 = String(g().negativePrompt || ""); } catch (e) { skipped++; continue; }
        if (p.indexOf(MARK) === -1) missing.push(names[i]);
        if (NEUTRAL_NAME.test(names[i]) && PHOTO_MARK.test(p)) photoLeak.push(names[i]);
        if (HARD.test(p)) hardHits.push(names[i] + " (prompt)");
        if (HARD.test(n2)) hardHits.push(names[i] + " (negative)");
      }
      var BAD_CUTE = /childish|lolita|innocent (seductive|naughty|teasing|dirty)|panties with .*prints|dirty little/i;
      if (window.root && window.root.cutenessMode) fail("cutenessMode still present (Bomb tiers were removed 22.10.2026)");
      try {
        var csel = document.querySelector('select[data-name="cuteness"]');
        if (csel) {
          var clabels = [].map.call(csel.options, function (o) { return String(o.textContent || ""); }).join(" | ");
          if (/bomb/i.test(clabels)) fail("Bomb tiers still listed in the cuteness select");
        }
        var cuIn = (s.userInputs || {}).cuteness || null;
        var cuComp = (cuIn && cuIn.compiledOptions) || {};
        Object.keys(cuComp).forEach(function (k) {
          var cpr = ""; try { cpr = String((cuComp[k] && cuComp[k].prompt) || ""); } catch (e) {}
          if (BAD_CUTE.test(cpr)) cuteHits.push("cuteness/" + k + ": " + ((cpr.match(BAD_CUTE) || ["?"])[0]));
        });
      } catch (e) { cuteHits.push("harness: " + e.message); }
    } finally {
      try { window.input.description = prevDesc; window.input.negative = prevNeg; window.input.artStyle = prevStyle; } catch (e) {}
      try { if (window.dragonAutoQualityTagsOn && window.dragonAutoQualityTagsOn() !== q0) window.dragonAutoTagsToggle("q"); } catch (e) {}
      try { if (window.dragonAutoNegativesOn && window.dragonAutoNegativesOn() !== n0) window.dragonAutoTagsToggle("n"); } catch (e) {}
    }
    if (missing.length) fail("T3: the visitor's description is dropped by " + missing.length + " style(s): " + missing.slice(0, 8).join(" · "));
    if (photoLeak.length) fail("T4: photo quality tags leak into " + photoLeak.length + " non-photo style(s): " + photoLeak.slice(0, 8).join(" · "));
    if (hardHits.length) fail("T5: child-coded terms in " + hardHits.length + " place(s): " + hardHits.slice(0, 8).join(" · "));
    if (cuteHits.length) fail("T5: cuteness regression: " + cuteHits.slice(0, 8).join(" · "));
    return names.length + " styles assembled live in " + ((Date.now() - t0) / 1000).toFixed(1) + "s, " + skipped + " skipped; T3 subject kept everywhere, T4 no photo-tag leak, T5 no child-coded terms";
  }

  /* ------------------------------------------- art style panel (Egon 27.09.2026, W-FEAT313)
     🎨 The Art Style accordion sits ON TOP of the Control Panel and is the visible style control (the old row's
     <select data-name="artStyle"> stays in the DOM but hidden). This asserts the whole standard in one pass:
     the head + its mirrored right-hand symbol, the moved search box with the red ✖ inside it, the 🎲 button,
     the on-demand multi-select row (Lock Seed / Select All / Clear All), the 3-per-row grid with the 108px
     “Preview Soon” placeholders, and the kissing equal-width stack Art Style → Control Panel → Prompt Panel →
     ✨ Generate. Everything it opens is put back the way the visitor left it.
     Egon 27.09.2026 (WP-UI004) added: the 🎲 button renamed to "Random Style", the selected-style COUNTER as
     its own button left of ✅ Select All, the mini ✨ Generate living in that row, the padlock icon following
     the lock state, a green tick on every CATEGORY heading (which selects the whole category), the search box
     matching a style's meta:tags keywords as well as its name, the GREY Prompt Panel button / BLACK panel
     ground / "Prompt Presets" tab, a PREFIX and a SUFFIX both being default at once, and the one-panel-at-a-
     time rule (a panel head closes the others, and a Generate closes them all). */
  async function checkStudio() {
    window.dragonGoPage("generate");
    var panel = q("#dragonStudioPanel");
    if (!panel) return "the Studio panel is not on the generate page (skipped)";
    var shown = await waitFor(function () { return isVisible(q("#dragonStudioHead")); }, TIMEOUT, 150);
    if (!shown) fail("the Studio head never became visible on the generate page");
    var art = q("#dragonArtPanel");
    if (!art) fail("the Art Style panel is missing (the Studio has no anchor)");
    else if (art.nextElementSibling !== panel) fail("the Studio panel is not directly below the Art Style panel");
    var head = q("#dragonStudioHead");
    if (!head) fail("the Studio head is missing");
    else if (head.tagName !== "BUTTON") fail("the Studio head is not a button");
    var hc = head ? getComputedStyle(head) : null;
    var ahead = q("#dragonArtPanelHead");
    var ac = ahead ? getComputedStyle(ahead) : null;
    if (hc && ac) {
      if (hc.fontSize !== ac.fontSize || hc.fontWeight !== ac.fontWeight) fail("head type differs from the Art Style head (" + hc.fontSize + "/" + hc.fontWeight + " vs " + ac.fontSize + "/" + ac.fontWeight + ")");
      if (hc.borderRadius !== ac.borderRadius) fail("head radius differs from the Art Style head (" + hc.borderRadius + " vs " + ac.borderRadius + ")");
    }
    var bg = hc ? (hc.backgroundImage || "") : "";
    if (bg.indexOf("155, 107, 255") === -1 && bg.indexOf("155,107,255") === -1) fail("the Studio head is not purple");
    var sbody = q("#dragonStudioBody");
    var wasOpen = sbody ? getComputedStyle(sbody).display !== "none" : false;
    if (!wasOpen && head) { try { head.click(); } catch (e) {} }
    await sleep(80);
    _panelOpenRestore = function () {
      _panelOpenRestore = null;
      try { if (window.dragonStudioOpen) window.dragonStudioOpen(wasOpen); } catch (e2) {}
    };
    var ctrls = panel.querySelectorAll("input,textarea,select");
    for (var ci = 0; ci < ctrls.length; ci++) {
      if (ctrls[ci].dataset.name === undefined) { fail(ctrls.length + " controls, but one has no data-name (the framework init loop needs it)"); break; }
    }
    if (!q("#dragonStudioChar")) fail("the character box is missing");
    if (!q("#dragonStudioSeed")) fail("the seed box is missing");
    if (!q("#dragonStudioNeg")) fail("the negative box is missing");
    if (!q("#dragonStudioGo")) fail("the Produce button is missing");
    if (!q("#dragonStudioStop")) fail("the Stop button is missing");
    if (!q("#dragonStudioPriv")) fail("the Private Gallery toggle is missing");
    if (!q("#dragonStudioRaceBtn")) fail("the seed Race button is missing");
    var pre = q("#dragonStudioPresets");
    if (!pre || !pre.querySelector("button")) fail("no pose presets in the Studio body");
    var L = (typeof window.dragonLegendsDataGet === "function") ? window.dragonLegendsDataGet() : [];
    var leg = "";
    (L || []).forEach(function (sec) { leg += " " + (sec[0] || ""); ((sec[1] || [])).forEach(function (it) { leg += " " + (it[0] || "") + " " + (it[1] || ""); }); });
    if (leg.indexOf("Lookbook") === -1) fail("the Studio has no legends row");
    var items = window.dragonSurveyItems || [];
    var inSurvey = items.some(function (it) { return it && it.n === "Studio"; });
    if (!inSurvey) fail("the Studio is not a survey system");
    // (Egon 22.10.2026: the "I'm HERE" badge is retired — no badge state is expected.)
    return "below Art Style, button head " + (hc ? hc.fontSize + "/" + hc.fontWeight + "/" + hc.borderRadius : "?") + ", purple, " + ctrls.length + " tagged controls, legends + survey rows";
  }
  // 🏷️ Egon 12.10.2026 — IMAGE INFO (upload title/username/date, rev 2). Pure-builder rules:
  // marker verbatim FIRST, date append at the END, hard limits, EMPTY = NO TITLE (no fallback).
  // The storage round-trip runs on a snapshot + restore, so the visitor's own meta always survives it.
  async function checkUpmeta() {
    window.dragonGoPage("generate");
    if (typeof window.dragonUpMeta !== "function") fail("window.dragonUpMeta() is missing");
    if (typeof window.dragonUpMetaSave !== "function") fail("window.dragonUpMetaSave() is missing");
    if (typeof window.dragonUpMetaTitle !== "function") fail("window.dragonUpMetaTitle() is missing");
    if (typeof window.dragonUpMetaDesc !== "function") fail("window.dragonUpMetaDesc() is missing");
    if (typeof window.dragonUpMetaNewMarker !== "function") fail("window.dragonUpMetaNewMarker() is missing");
    var mk = "";
    try { mk = window.dragonUpMetaNewMarker(); } catch (e) { fail("upMetaNewMarker threw"); }
    if (!/^bestaigen-[0-9a-z]+$/.test(mk)) fail("bad upload marker shape: " + mk);
    var d0 = window.dragonUpMetaDesc(mk);
    if (d0.indexOf(mk) !== 0) fail("the description does not start with the verbatim marker: " + d0.slice(0, 60));
    if (d0.length > 400) fail("the description exceeds 400 chars (" + d0.length + ")");
    var lsK = "dragonUpMetaV1", bak = null;
    try { bak = localStorage.getItem(lsK); } catch (eG) {}
    try {
      window.dragonUpMetaSave({ title: "T".repeat(200), username: "B".repeat(100), date: "2030-01-02" });
      var t = window.dragonUpMetaTitle();
      if (t.length > 140) fail("the combined title exceeds 140 chars (" + t.length + ")");
      if (t.indexOf(" by ") === -1) fail("the username credit is missing from the title: " + t.slice(0, 60));
      var d1 = window.dragonUpMetaDesc(mk);
      if (d1.indexOf(mk) !== 0) fail("stored meta broke the marker-first rule");
      // Egon 12.10.2026 (rev 3) — the date is automatic (production day): a stored date is
      // ignored, the description always ends with today.
      var _today = (function () { try { var d = new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); } catch (e) { return ""; } })();
      if (d1.slice(-10) !== _today) fail("the date is not the automatic production day: " + d1.slice(0, 80));
      window.dragonUpMetaSave({ title: "", username: "SoloUser", date: "" });
      if (window.dragonUpMetaTitle() !== "SoloUser") fail("a lone username does not stand bare: " + String(window.dragonUpMetaTitle()).slice(0, 40));
      window.dragonUpMetaSave({ title: "", username: "", date: "" });
      if (window.dragonUpMetaTitle() !== "") fail("an empty row does not send an empty title: " + String(window.dragonUpMetaTitle()).slice(0, 60));
      // Egon 12.10.2026 (rev 3) — the server user TAG fallback (the 4-letter code on the
      // default cards): empty/empty degrades to dragonUserTag(server id), "" while unknown.
      var srvK = "dragonServerUserIdV1", srvBak = null;
      try { srvBak = localStorage.getItem(srvK); } catch (eG3) {}
      try {
        window.dragonServerUserIdNote("");
        window.dragonUpMetaSave({ title: "", username: "" });
        if (window.dragonUpMetaTitle() !== "") fail("empty/empty with an unknown server id is not empty");
        var fakeId = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
        if (!window.dragonServerUserIdNote(fakeId)) fail("a valid server id is not accepted");
        if (window.dragonServerUserIdNote("80b10ce1-wrong")) fail("an invalid server id is accepted");
        var tag = (typeof window.dragonUserTag === "function") ? window.dragonUserTag(fakeId) : "";
        if (!/^[0-9A-Z]{4}$/.test(tag)) fail("the user tag has the wrong shape: " + String(tag).slice(0, 20));
        if (window.dragonUpMetaTitle() !== tag) fail("empty/empty does not fall back to the user tag: " + String(window.dragonUpMetaTitle()).slice(0, 20));
        window.dragonUpMetaSave({ title: "Red Kite", username: "" });
        if (window.dragonUpMetaTitle() !== "Red Kite by " + tag) fail("a title with an empty username does not gain the tag: " + String(window.dragonUpMetaTitle()).slice(0, 40));
      } finally {
        try {
          if (srvBak != null) window.dragonServerUserIdNote(srvBak);
          else window.dragonServerUserIdNote("");
        } catch (eR7) {}
      }
    } finally {
      try {
        var rb = null;
        try { rb = JSON.parse(bak || "null"); } catch (eP) { rb = null; }
        if (rb && typeof rb === "object") window.dragonUpMetaSave(rb);
        else { try { localStorage.removeItem(lsK); } catch (eR) {} window.dragonUpMetaSave({ title: "", username: "", date: "" }); }
      } catch (eR2) {}
      try { if (window.dragonUpMetaEnsure) window.dragonUpMetaEnsure(); } catch (eE) {}
    }
    var row = q("#dragonUpMetaRow");
    if (!row) fail("the Image Info row is missing from the Control Panel");
    else {
      var ctrls = row.querySelectorAll("input");
      if (ctrls.length !== 2) fail("the Image Info row has " + ctrls.length + " inputs (2 expected: title/username, the date is automatic)");
      var ids = ["dragonUpMetaTitle", "dragonUpMetaUser"];
      for (var i = 0; i < ids.length; i++) {
        var el = document.getElementById(ids[i]);
        if (!el) { fail("input #" + ids[i] + " is missing"); continue; }
        if (el.dataset.name === undefined) fail("input #" + ids[i] + " has no data-name (the framework init loop needs it)");
      }
      if (document.getElementById("dragonUpMetaDate")) fail("the date input is still in the row (rev 3 removed it)");
    }
    // the wrapper seam: every Generate-path options object must carry gallery title + description
    // in the { evaluateItem } shape the plugin reads.
    var ow = null;
    try { ow = window.___getImageOptions746291937 ? window.___getImageOptions746291937() : null; } catch (eW) { fail("the image-options wrapper threw"); }
    if (!ow) fail("the image-options wrapper returned nothing");
    else {
      if (!ow.saveTitle || ow.saveTitle.evaluateItem === undefined) fail("saveTitle lost its evaluateItem shape in the wrapper");
      if (!ow.saveDescription || ow.saveDescription.evaluateItem === undefined) fail("saveDescription is missing from the wrapper output");
      else if (String(ow.saveDescription.evaluateItem).indexOf("bestaigen-") !== 0) fail("the wrapper description does not start with the marker");
    }
    var L = (typeof window.dragonLegendsDataGet === "function") ? window.dragonLegendsDataGet() : [];
    var leg = "";
    (L || []).forEach(function (sec) { leg += " " + (sec[0] || ""); ((sec[1] || [])).forEach(function (it) { leg += " " + (it[0] || "") + " " + (it[1] || ""); }); });
    if (leg.indexOf("Image Info") === -1) fail("Image Info has no legends row");
    if (leg.indexOf("Toolbox") === -1 || leg.indexOf("Show menu") === -1) fail("legends do not mention the Toolbox Show menu");
    // Egon 12.10.2026 — Toolbox > Show filter (Title · Username · Date, multi-select, all off hides
    // everything). Snapshot + restore, so the visitor's own visibility choice always survives it.
    if (typeof window.dragonGalShowGet !== "function") fail("window.dragonGalShowGet() is missing");
    if (typeof window.dragonGalTitleFiltered !== "function") fail("window.dragonGalTitleFiltered() is missing");
    var shK = "dragonGalShowV2", shBak = null;
    try { shBak = localStorage.getItem(shK); } catch (eG2) {}
    try {
      var _p = window.dragonGalTitleParts ? window.dragonGalTitleParts("T by U") : null;
      if (!_p || _p.t !== "T" || _p.u !== "U") fail("TITLE by USER does not split into parts");
      window.dragonGalShowSet("title", true); window.dragonGalShowSet("username", true);
      if (window.dragonGalTitleFiltered("T by U") !== "T by U") fail("all-on does not show the full title");
      window.dragonGalShowSet("username", false);
      if (window.dragonGalTitleFiltered("T by U") !== "T") fail("username-off does not leave the bare title");
      window.dragonGalShowSet("title", false); window.dragonGalShowSet("username", true);
      if (window.dragonGalTitleFiltered("T by U") !== "U") fail("title-off does not leave the bare username");
      window.dragonGalShowSet("title", false); window.dragonGalShowSet("username", false); window.dragonGalShowSet("date", false);
      if (window.dragonGalTitleFiltered("T by U") !== "") fail("all-off still shows a caption");
      window.dragonGalShowSet("title", true); window.dragonGalShowSet("username", true);
      if (window.dragonGalTitleFiltered("Foreign Prompt Excerpt...") !== "Foreign Prompt Excerpt...") fail("a foreign title is not pure title");
      // Egon 12.10.2026 — old images: no old image has a literally empty title (they carry
      // excerpts), so any title that names NOBODY shows the uploader's own tag — only under the
      // Username toggle; titled-with-credit pictures are untouched.
      var _fid = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
      var _ftag = (window.dragonUserTag ? window.dragonUserTag(_fid) : "");
      window.dragonGalShowSet("title", false); window.dragonGalShowSet("username", true);
      if (!_ftag || window.dragonGalTitleFiltered("", _fid) !== _ftag) fail("an untitled old image does not show the uploader tag");
      if (window.dragonGalTitleFiltered("AI_Image_", _fid) !== _ftag) fail("an excerpt-titled old image does not show the uploader tag");
      if (window.dragonGalTitleFiltered("T by U", _fid) !== "U") fail("a credited title lost its username to the tag");
      if (window.dragonGalTitleFiltered("", "not-an-id") !== "") fail("a non-id userId prints a tag");
      // Egon 13.10.2026 — external auto-uploads carry a bare studio name (no " by "): that word IS the
      // uploader's name, so the username toggle shows it instead of the uploader tag.
      if (window.dragonGalTitleFiltered("AgentX", _fid) !== "AgentX") fail("a bare AgentX title does not show as username");
      if (window.dragonGalTitleFiltered("AgentX Studio", _fid) !== "AgentX Studio") fail("a bare AgentX Studio title does not show as username");
      window.dragonGalShowSet("title", true); window.dragonGalShowSet("username", true);
      if (window.dragonGalTitleFiltered("AI_Image_", _fid) !== "AI_Image_") fail("title-on view gained a tag append");
      if (window.dragonGalTitleFiltered("AgentX", _fid) !== "AgentX by AgentX") fail("a bare AgentX title does not match its by-stamped twin");
      window.dragonGalShowSet("title", false); window.dragonGalShowSet("username", false);
      if (window.dragonGalTitleFiltered("", _fid) !== "") fail("username-off still shows the old-image tag");
    } finally {
      try {
        if (shBak != null) localStorage.setItem(shK, shBak);
        else { try { localStorage.removeItem(shK); } catch (eR3) {} }
      } catch (eR4) {}
      try { if (window.__dragonGalSyncShowUI) window.__dragonGalSyncShowUI(); } catch (eS2) {}
      try { if (window.dragonGalShowRepaint) window.dragonGalShowRepaint(); } catch (eS3) {}
    }
    return "marker-first desc + 140/400 limits, automatic production date, empty-means-empty title, snapshot-restore round-trip, 2 tagged CP inputs, wrapper stamps title+desc, Show filter matrix (off by default), legends row";
  }
  async function checkArtStylePanel() {
    window.dragonGoPage("generate");
    var panel = q("#dragonArtPanel");
    if (!panel) return "the 🎨 Art Style panel is not on the generate page (skipped)";
    // the page transition (and the panel's own boot) is asynchronous: measuring a hidden subtree answers
    // "transform: none" for everything, so wait until the panel is really on screen before measuring anything.
    var shown = await waitFor(function () { return isVisible(q("#dragonArtPanelHead")); }, TIMEOUT, 150);
    if (!shown) fail("the 🎨 Art Style panel never became visible on the generate page");
    // Everything below measures the OPEN panel, so open it here (a closed panel reports the ✖ as hidden
    // and nothing inside it can be measured) and let the run's own finally put the visitor's choice back.
    var _ab = q("#dragonArtPanel .dragon-art-body");
    var _cb = q(".dragon-control-body");
    var _pb = q("#dragonHistoryPanel .dragon-history-body");
    var _artWas = _ab ? getComputedStyle(_ab).display !== "none" : false;
    var _cpWas = _cb ? _cb.style.display !== "none" : false;
    var _ppWas = _pb ? _pb.style.display !== "none" : false;
    if (!_artWas && window.dragonArtPanel && window.dragonArtPanel.open) { try { window.dragonArtPanel.open(); } catch (e) {} }
    await sleep(80);
    _panelOpenRestore = function () {
      _panelOpenRestore = null;
      try {
        var ab = q("#dragonArtPanel .dragon-art-body");
        var nowArt = ab ? getComputedStyle(ab).display !== "none" : false;
        if (nowArt !== _artWas && window.dragonArtPanel) { if (_artWas) window.dragonArtPanel.open(); else window.dragonArtPanel.close(); }
        var cb = q(".dragon-control-body"), ch = q(".dragon-control-panel > button");
        if (cb && ch && (cb.style.display !== "none") !== _cpWas) ch.click();
        var pb = q("#dragonHistoryPanel .dragon-history-body"), ph = q("#dragonHistoryPanel > button");
        if (pb && ph && (pb.style.display !== "none") !== _ppWas) ph.click();
      } catch (e) {}
    };
    var head = q("#dragonArtPanelHead");
    if (!isVisible(head)) fail("#dragonArtPanelHead is not visible");
    var syms = head ? qa("span", head).filter(function (s) { return s.getAttribute("aria-hidden") === "true"; }) : [];
    if (syms.length < 2) fail("the head does not carry both 🎨 symbols (" + syms.length + " mirrored span(s))");
    else {
      var last = syms[syms.length - 1];
      var tf = getComputedStyle(last).transform || "";
      if (!/^matrix\(-1,|scaleX\(-1\)/.test(tf)) fail("the RIGHT-hand 🎨 is not mirrored (transform=" + tf + ", head " + (head.offsetParent ? "painted" : "NOT painted") + ", inline=" + (last.getAttribute("style") || "none") + ")");
    }
    // the moved search box: inside the panel, with the red ✖ inside the same wrapper
    var search = q("#dragonArtPanel input");
    if (!search) fail("the style search box did not move into the panel");
    if (search && search.dataset.name === undefined) fail("the moved search box has no data-name (the framework's init loop needs userInputs[''])");
    var clear = q("#dragonArtSearchClear");
    var searchTgl = q("#dragonArtSearchToggle");
    var searchDrop = q("#dragonArtPanel .dragon-art-searchwrap");
    var searchDropWas = !!(searchDrop && isVisible(searchDrop));
    if (!searchDropWas && searchTgl) { try { searchTgl.click(); } catch (eTg) {} await sleep(120); }
    if (!clear || !isVisible(clear)) fail("the red ✖ clear button is not inside the search box");
    else if (!search.parentElement.contains(clear)) fail("the red ✖ sits outside the search box");
    // Egon 27.09.2026 (WP-UI004): the button is named "Random Style" (it was "Randomize Style") and its
    // behaviour follows the mode: one random style in single mode, one MORE random style in test mode.
    var dice = qa("#dragonArtPanel button").filter(function (b) { return /Random Style/.test(b.textContent); });
    if (dice.length !== 1) fail("the 🎲 Random Style button is not in the panel (" + dice.length + ")");
    if (/Randomize/.test(dice[0].textContent)) fail("the 🎲 button still says \"" + dice[0].textContent.trim() + "\"");
    // the multi-select row appears on demand and carries exactly the three standard buttons
    var testBtn = q("#dragonArtTestBtn");
    if (!testBtn) fail("the ⚗️ Test Multiple Styles button is not in the panel");
    var row = q(".dragon-art-tools");
    if (!row) fail("the art panel button row is missing");
    var lockPre = q("#dragonArtLockSeedBtn");
    var wasTest = lockPre && isVisible(lockPre);
    if (!wasTest && testBtn) { testBtn.click(); }
    var lockNow = q("#dragonArtLockSeedBtn");
    var rowShown = lockNow && isVisible(lockNow);
    var rowBtns = row ? qa("button", row) : [];
    var labels = rowBtns.map(function (b) { return b.textContent.trim(); });
    var hasLock = labels.some(function (t) { return /Lock Seed/.test(t); });
    var hasAll = labels.some(function (t) { return /Select All/.test(t); });
    var hasNone = labels.some(function (t) { return /Clear All/.test(t); });
    if (!rowShown) fail("the multi-select row did not appear when ⚗️ Test Multiple Styles was pressed");
    if (!hasLock || !hasAll || !hasNone) fail("the multi-select row is missing a button (" + labels.join(" / ") + ")");
    // the selected-style COUNTER is its own button, sitting immediately LEFT of ✅ Select All, and the
    // description panel's mini ✨ Generate sits BETWEEN the counter and ✅ Select All (Egon 29.09.2026).
    if (!q("#dragonArtCountBtn")) fail("the selected-style counter button is not in the button row");
    else {
      var order = rowBtns.map(function (b) { return b.id || b.textContent.trim(); });
      var iLock = order.indexOf("dragonArtLockSeedBtn");
      var iCount = order.indexOf("dragonArtCountBtn");
      var iAll = order.findIndex ? order.findIndex(function (t) { return /Select All/.test(t); }) : -1;
      var iNone = order.findIndex ? order.findIndex(function (t) { return /Clear All/.test(t); }) : -1;
      if (iLock === -1 || iAll === -1 || iNone === -1 || iLock !== iAll + 1 || iNone !== iLock + 1) fail("the Lock Seed button is not between Select All and Clear All (" + order.join(" | ") + ")");
      if (iCount === -1 || iAll === -1 || iCount + 2 !== iAll || order[iCount + 1] !== "✨ Generate ✨") fail("the counter / mini-Generate / Select All trio is out of order (" + order.join(" | ") + ")");
      if (iAll !== -1 && iAll < iCount) fail("✅ Select All sits before the counter button");
      var miniGen = row.querySelector(".dragon-art-mingen");
      if (!miniGen) fail("the description panel's mini ✨ Generate is not in the button row");
      else if (order.indexOf("✨ Generate ✨") !== iCount + 1) fail("the mini ✨ Generate is not right after the counter button (" + order.join(" | ") + ")");
    }
    // the padlock shows the STATE: closed while the fair-comparison lock is on, open while it is off
    var lockEl = q("#dragonArtLockSeedBtn");
    if (lockEl) {
      var lockStored = true;
      try { lockStored = localStorage.getItem("dragonArtLockSeed") !== "0"; } catch (e) {}
      var lockIcon = String(lockEl.textContent).trim();
      if (lockStored && lockIcon.indexOf("\uD83D\uDD12") !== 0) fail("the Lock Seed button is ON but shows no closed padlock (" + lockIcon.slice(0, 22) + ")");
      if (!lockStored && lockIcon.indexOf("\uD83D\uDD13") !== 0) fail("the Lock Seed button is OFF but shows no open padlock (" + lockIcon.slice(0, 22) + ")");
    }
    if (!wasTest) { testBtn.click(); }
    // the 3-per-row grid + the 108×108 "Preview Soon" placeholders
    var grid = q(".dragon-art-grid");
    if (!grid) fail("the style grid is missing");
    var cells = grid ? qa(".dragon-art-cell", grid) : [];
    if (cells.length < 50) fail("the style grid holds only " + cells.length + " cells");
    var prev = grid ? qa(".dragon-art-prev", grid) : [];
    if (prev.length !== cells.length) fail(prev.length + " preview placeholders for " + cells.length + " style cells");
    var p = prev[0] ? prev[0].getBoundingClientRect() : null;
    if (p && (Math.abs(p.width - 108) > 6 || Math.abs(p.height - 108) > 6)) fail("the preview placeholder is " + Math.round(p.width) + "×" + Math.round(p.height) + ", not the 108×108 preview size");
    var cols = cells.length ? getComputedStyle(grid).gridTemplateColumns.split(" ").length : 0;
    if (window.innerWidth > 900 && cols !== 3) fail(window.innerWidth + "px wide: the grid draws " + cols + " columns instead of 3");
    // ---------------------------------------------------------------- Egon 27.09.2026 (WP-UI004)
    var extra = "";
    // 🏷️ a CATEGORY behaves like a single style: every heading carries its own tick on the left and the
    // tick selects the whole category (pressing it twice, as below, puts the selection back as it was).
    var cats = qa(".dragon-art-cat", grid);
    var ticks = qa(".dragon-art-cattick", grid);
    if (!cats.length) fail("the style grid carries no category headings");
    else if (ticks.length !== cats.length) fail(ticks.length + " category tick(s) for " + cats.length + " category heading(s)");
    var selWas = null;
    try { selWas = localStorage.getItem("dragonArtMultiSel"); } catch (e) {}
    try {
      if (cats.length && ticks.length) {
        var kids = Array.prototype.slice.call(grid.children);
        // the first heading can be near-empty on this browser (e.g. no favourite styles yet),
        // so the tick is driven on the first category that actually holds styles.
        var ci0 = -1, i0 = -1, i1 = -1, catCells = [];
        for (var ci = 0; ci < cats.length; ci++) {
          var s0 = kids.indexOf(cats[ci]), s1 = kids.length, cc, kk;
          for (kk = s0 + 1; kk < kids.length; kk++) if (kids[kk].classList.contains("dragon-art-cat")) { s1 = kk; break; }
          cc = kids.slice(s0 + 1, s1).filter(function (e) { return e.classList.contains("dragon-art-cell"); });
          if (cc.length >= 2) { ci0 = ci; i0 = s0; i1 = s1; catCells = cc; break; }
        }
        if (ci0 < 0) fail("no category holds enough styles to drive the tick with");
        var ticked = function () { var n = 0; for (var z = 0; z < catCells.length; z++) if (/✅/.test(catCells[z].textContent)) n++; return n; };
        ticks[ci0].click();
        await sleep(120);
        var afterOne = ticked();
        ticks[ci0].click();
        await sleep(120);
        var afterTwo = ticked();
        if (catCells.length < 2) fail("the first stocked category holds only " + catCells.length + " style(s)");
        if (afterOne === afterTwo) fail("the category tick does not select/clear the whole category (" + afterOne + " -> " + afterTwo + " of " + catCells.length + ")");
        if (afterOne !== 0 && afterOne !== catCells.length) fail("the category tick selected " + afterOne + " of " + catCells.length + " styles");
        extra += "; category tick moves all " + catCells.length + " styles";
      }
    } finally {
      try { if (selWas === null) localStorage.removeItem("dragonArtMultiSel"); else localStorage.dragonArtMultiSel = selWas; } catch (e) {}
      try { if (window.dragonArtPanel && window.dragonArtPanel.rebuild) window.dragonArtPanel.rebuild(); } catch (e) {}
    }
    // 🔎 the search box matches the whole panel — a style's meta:tags keywords too, not only its name.
    var searchWas = search ? search.value : "";
    var api = window.dragonArtPanel || {};
    try {
      if (typeof api.tagsOf !== "function" || typeof api.hayOf !== "function") fail("the panel exposes no tagsOf/hayOf seam (the tag search cannot be proven)");
      var tagWord = null, tagName = null;
      // the category-tick check above rebuilt the grid, so the cell list must be read AGAIN here
      var cellsNow = qa(".dragon-art-cell", q(".dragon-art-grid"));
      if (!cellsNow.length) fail("the style grid is empty after the category-tick check");
      for (var ci = 0; ci < cellsNow.length && !tagWord; ci++) {
        var vName = String(cellsNow[ci].dataset.value || "").replace(/^ref:optionKeyName:/, "");
        var lblTxt = String((cellsNow[ci].querySelector(".dragon-art-pick") || {}).textContent || "").toLowerCase();
        var words = String(api.tagsOf(vName) || "").toLowerCase().split(/[,\s]+/).filter(function (w) { return w.length >= 4; });
        for (var wi = 0; wi < words.length; wi++) if (lblTxt.indexOf(words[wi]) === -1) { tagWord = words[wi]; tagName = vName; break; }
      }
      if (!tagWord) fail("no style carries a meta:tags keyword outside its own name (" + api.tagCount() + " tagged styles)");
      else {
        search.value = tagWord;
        search.dispatchEvent(new Event("input", { bubbles: true }));
        await sleep(120);
        var shown = cellsNow.filter(isVisible);
        if (!shown.length) fail("the tag search for \"" + tagWord + "\" matched no style (expected at least \"" + tagName + "\")");
        var byTagOnly = 0;
        for (var vi = 0; vi < shown.length; vi++) {
          var vN = String(shown[vi].dataset.value || "").replace(/^ref:optionKeyName:/, "");
          if (String(api.hayOf(vN)).toLowerCase().indexOf(tagWord) === -1) fail("the filter kept \"" + vN + "\" although it does not match \"" + tagWord + "\" (visible " + shown.length + "/" + cellsNow.length + ", box \"" + search.value + "\", bound \"" + (window.dragonArtPanel && window.dragonArtPanel.searchValue ? window.dragonArtPanel.searchValue() : "-") + "\", diag " + (window.dragonArtPanel && window.dragonArtPanel.diag ? JSON.stringify(window.dragonArtPanel.diag()) : "-") + "\")");
          if (String((shown[vi].querySelector(".dragon-art-pick") || {}).textContent || "").toLowerCase().indexOf(tagWord) === -1) byTagOnly++;
        }
        if (!byTagOnly) fail("the search only ever matched style NAMES — meta:tags keywords are not searched (\"" + tagWord + "\")");
        extra += "; tag search \"" + tagWord + "\" -> " + shown.length + " style(s), " + byTagOnly + " by tag only";
      }
    } finally {
      try { if (search) { search.value = searchWas; search.dispatchEvent(new Event("input", { bubbles: true })); } } catch (e) {}
      try { if (!searchDropWas && searchTgl && searchDrop && isVisible(searchDrop)) searchTgl.click(); } catch (e2) {}
    }
    // 🎨 the panel FAMILY: the Prompt Panel button is the grey one, its body sits on the black ground, and
    // the tab inside it is called "Prompt Presets" (Egon 27.09.2026).
    var ppHead = q("#dragonHistoryPanel > button");
    var ppBody = q("#dragonHistoryPanel .dragon-history-body");
    if (ppHead) {
      var hBg = getComputedStyle(ppHead).backgroundImage || "";
      if (hBg.indexOf("rgb(59, 59, 69)") === -1) fail("the 📝 Prompt Panel button is not the grey one (background " + hBg + ")");
      if (/\uD83D\uDCDD/.test(ppHead.textContent)) fail("the 📝 symbol is still in the Prompt Panel head");
    }
    if (ppBody) {
      var bBg = getComputedStyle(ppBody).backgroundImage || "";
      if (bBg.indexOf("rgb(21, 21, 29)") === -1) fail("the panel opened from the Prompt Panel does not sit on the black ground (" + bBg + ")");
    }
    // the Prompt Panel's tabs only exist while the panel is OPEN (the stack shows one panel at a time),
    // and the Art Style panel is the one open during most of this check — so open it here to read them.
    if (ppHead && !qa("#dragonHistoryPanel .dragon-hw-tab").length) {
      try { ppHead.click(); } catch (e) {}
      await waitFor(function () { return qa("#dragonHistoryPanel .dragon-hw-tab").length > 0; }, TIMEOUT, 100);
    }
    var presetTab = qa("#dragonHistoryPanel .dragon-hw-tab").filter(function (b) { return /Prompt Presets/.test(b.textContent); });
    if (presetTab.length !== 1) fail("the Prompt Panel has no \"Prompt Presets\" tab (" + presetTab.length + ")");
    // ⭐ a PREFIX and a SUFFIX may each be the default at the SAME time — both apply on Generate.
    var preWas = null, postWas = null, legacyWas = null, presetsWas = null, taWas = null;
    try {
      try {
        presetsWas = localStorage.getItem("dragonPromptPresets");
        preWas = localStorage.getItem("dragonPromptPresetDefaultPre");
        postWas = localStorage.getItem("dragonPromptPresetDefaultPost");
        legacyWas = localStorage.getItem("dragonPromptPresetDefault");
      } catch (e) {}
      var taEl = q('textarea[data-name="description"]');
      taWas = taEl ? taEl.value : null;
      if (typeof window.dragonApplyDefaultPreset !== "function") fail("dragonApplyDefaultPreset is not exposed");
      else if (!taEl) fail("the description textarea is missing");
      else {
        localStorage.dragonPromptPresets = JSON.stringify([{ n: "__chk_pre", t: "CHKPREFIX", pos: "pre" }, { n: "__chk_post", t: "CHKSUFFIX", pos: "post" }]);
        localStorage.dragonPromptPresetDefaultPre = "__chk_pre";
        localStorage.dragonPromptPresetDefaultPost = "__chk_post";
        localStorage.removeItem("dragonPromptPresetDefault");
        taEl.value = "CHKBODY";
        window.dragonApplyDefaultPreset();
        var applied = String(taEl.value);
        if (applied.indexOf("CHKPREFIX") !== 0) fail("the default PREFIX was not prepended (\"" + applied.slice(0, 40) + "\")");
        if (applied.indexOf("CHKSUFFIX") === -1) fail("the default SUFFIX was not applied while a prefix default was set (\"" + applied.slice(0, 60) + "\")");
        extra += "; prefix + suffix defaults both applied";
      }
    } finally {
      try { if (presetsWas === null) localStorage.removeItem("dragonPromptPresets"); else localStorage.dragonPromptPresets = presetsWas; } catch (e) {}
      try { if (preWas === null) localStorage.removeItem("dragonPromptPresetDefaultPre"); else localStorage.dragonPromptPresetDefaultPre = preWas; } catch (e) {}
      try { if (postWas === null) localStorage.removeItem("dragonPromptPresetDefaultPost"); else localStorage.dragonPromptPresetDefaultPost = postWas; } catch (e) {}
      try { if (legacyWas === null) localStorage.removeItem("dragonPromptPresetDefault"); else localStorage.dragonPromptPresetDefault = legacyWas; } catch (e) {}
      try { var t3 = q('textarea[data-name="description"]'); if (t3 && taWas !== null) { t3.value = taWas; t3.dispatchEvent(new Event("input", { bubbles: true })); } } catch (e) {}
      try { if (window.dragonRenderPresets) window.dragonRenderPresets(); } catch (e) {}
    }
    // 🪗 ONE panel at a time: opening a panel head closes the others, and a Generate closes them all.
    var artBody = q("#dragonArtPanel .dragon-art-body");
    var cpBody = q(".dragon-control-body");
    var cpHead = q(".dragon-control-panel > button");
    var artOpen0 = artBody ? getComputedStyle(artBody).display !== "none" : false;
    var cpOpen0 = cpBody ? cpBody.style.display !== "none" : false;
    var ppOpen0 = ppBody ? ppBody.style.display !== "none" : false;
    var bodyOpen = function (el) { return !!el && (el.classList.contains("dragon-art-body") ? getComputedStyle(el).display !== "none" : el.style.display !== "none"); };
    try {
      if (!artBody || !cpHead || !cpBody) fail("the panel stack is incomplete (art body / control head / control body)");
      window.dragonArtClosePanelsExcept("");
      await sleep(150);
      if (bodyOpen(artBody) || bodyOpen(cpBody) || bodyOpen(ppBody)) fail("dragonArtClosePanelsExcept(\"\") left a panel open");
      head.click();
      await waitFor(function () { return bodyOpen(artBody); }, TIMEOUT, 100);
      if (!bodyOpen(artBody)) fail("the Art Style panel did not open from its own head");
      cpHead.click();
      await waitFor(function () { return bodyOpen(cpBody); }, TIMEOUT, 100);
      if (bodyOpen(artBody)) fail("opening the Control Panel left the Art Style panel open (only one panel may be open at a time)");
      if (bodyOpen(ppBody)) fail("opening the Control Panel left the Prompt Panel open");
      window.dragonArtClosePanelsExcept("");
      var closedAll = await waitFor(function () { return !bodyOpen(artBody) && !bodyOpen(cpBody) && !bodyOpen(ppBody); }, 900, 90);
      if (!closedAll) fail("a simulated Generate did not close the open panels (art " + bodyOpen(artBody) + ", control " + bodyOpen(cpBody) + ", prompt " + bodyOpen(ppBody) + ")");
      extra += "; one panel at a time + close on Generate";
    } finally {
      try {
        if (bodyOpen(artBody) !== artOpen0) head.click();
        if (bodyOpen(cpBody) !== cpOpen0 && cpHead) cpHead.click();
        if (ppBody) {
          var ppNow = bodyOpen(ppBody);
          if (ppNow !== ppOpen0) { var ph = q("#dragonHistoryPanel > button"); if (ph) ph.click(); }
        }
        await sleep(120);
      } catch (e) {}
    }
    // the kissing equal-width stack: Art Style → Studio → Control Panel → Prompt Panel
    // (Egon 29.10.2026 — the purple Studio panel lives directly below Art Style, so it is part of the stack;
    // the big purple ✨ Generate lives at the BOTTOM of the description panel again, asserted separately below).
    var cp = q(".dragon-control-panel"), pp = q("#dragonHistoryPanel"), gen = q(".dragon-gen-btn");
    var st = q("#dragonStudioPanel");
    var stack = [["Art Style", panel], ["Studio", st], ["Control Panel", cp], ["Prompt Panel", pp]];
    if (!st) stack = [["Art Style", panel], ["Control Panel", cp], ["Prompt Panel", pp]];
    var missing = stack.filter(function (s) { return !s[1] || !isVisible(s[1]); });
    if (missing.length) fail("not visible on the generate page: " + missing.map(function (s) { return s[0]; }).join(", "));
    else {
      var widths = stack.map(function (s) { return Math.round(s[1].getBoundingClientRect().width); });
      var spread = Math.max.apply(null, widths) - Math.min.apply(null, widths);
      if (spread > 2) fail("the stack is not equal width: " + stack.map(function (s, i) { return s[0] + "=" + widths[i] + "px"; }).join(", "));
      var gaps = [];
      for (var i = 1; i < stack.length; i++) {
        var a = stack[i - 1][1].getBoundingClientRect(), b = stack[i][1].getBoundingClientRect();
        if (b.top < a.top) fail(stack[i][0] + " is not below " + stack[i - 1][0]);
        gaps.push(Math.round(b.top - (a.top + a.height)));
      }
      var worst = Math.max.apply(null, gaps.map(Math.abs));
      if (worst > 2) fail("the stack is not kissing: gaps " + gaps.join("/") + "px");
      // the big purple ✨ Generate sits INSIDE the description area, right under the text box.
      if (!gen || !isVisible(gen)) fail("the big purple Generate is not visible under the description box");
      else {
        var ta0 = q('textarea[data-name="description"]');
        var cell0 = ta0 && ta0.parentElement;
        if (!cell0 || gen.parentElement !== cell0 || gen.previousElementSibling !== ta0) fail("the big purple Generate is not under the description text");
        else if (ta0 && gen.getBoundingClientRect().top < ta0.getBoundingClientRect().bottom) fail("the big purple Generate is not below the description box");
      }
      return cells.length + " styles / " + cols + " columns / " + prev.length + " placeholders; stack " + widths.join("+") +
        "px, gaps " + gaps.join("/") + "px; right-hand 🎨 mirrored" + extra;
    }
    return cells.length + " styles in the panel" + extra;
  }

  function checkKissing(ctx) {
    var spread = 0, gap = 0, rows = 0, worst = "";
    if (ctx.kissPub) { rows += ctx.kissPub.rows.rows; gap = Math.max(gap, ctx.kissPub.rows.gap); if (ctx.kissPub.spread > spread) { spread = ctx.kissPub.spread; worst = ctx.kissPub.rows.worst || ""; } }
    if (ctx.kissVault) { rows += ctx.kissVault.rows; gap = Math.max(gap, ctx.kissVault.gap); if (ctx.kissVault.spread > spread) { spread = ctx.kissVault.spread; worst = ctx.kissVault.worst || ""; } }
    if (rows === 0) return "no multi-control toolbar rows measured (skipped)";
    var detail = rows + " rows: height spread " + spread.toFixed(1) + "px, worst gap " + gap.toFixed(1) + "px"
      + (worst ? " | " + worst : "");
    if (spread > TOL) fail("unequal control heights - " + detail);
    if (gap > TOL) fail("controls not 'kissing' - " + detail);
    return detail;
  }

  /* ------------------------------------------- site background (Egon 22.09.2026) */
  // 🖼️ Background (Settings ▸ "🖼 Image — Looks & Display"). OFF has to be a true no-op — no attribute on
  // <html>, no layer element, no background image — and ON has to paint the layer plus the theme-coloured
  // veil while the theme's own page colour moves up onto <html>. The visitor's stored choice is captured
  // first and restored byte-exactly in a finally block, so running the check-up never changes what they see.
  function checkSiteBg() {
    if (typeof window.dragonBgList !== "function" || typeof window.dragonBgSet !== "function") fail("site-background module missing (dragonBgList/dragonBgSet are not exposed)");
    var list = window.dragonBgList();
    if (!list || !list.length) fail("dragonBackgrounds produced no entries");
    if (list[0].id !== "none" || list[0].url) fail("the first entry is not the \"no background\" default");
    var withUrl = list.filter(function (e) { return !!e.url; });
    if (!withUrl.length) fail("not one background picture has a url");
    if (withUrl.length > 10) fail("more than 10 background pictures are configured (" + withUrl.length + ")");
    var rootEl = document.documentElement;
    var was = null, hadKey = false;
    try { hadKey = localStorage.getItem("dragonBgId") !== null; was = localStorage.getItem("dragonBgId"); } catch (e) {}
    var pick = withUrl[0];
    var offDetail = "", onDetail = "", tiles = 0;
    try {
      // OFF — the page must look exactly as it does without the feature
      window.dragonBgSet("none");
      if (rootEl.hasAttribute("data-dragon-bg")) fail("choosing \"No background\" left data-dragon-bg on <html>");
      if (document.getElementById("dragonBgLayer")) fail("choosing \"No background\" left #dragonBgLayer on the page");
      if (rootEl.style.getPropertyValue("--dragon-bg-url")) fail("choosing \"No background\" left --dragon-bg-url set");
      if (rootEl.style.getPropertyValue("--dragon-bg-veil")) fail("choosing \"No background\" left --dragon-bg-veil set");
      if (getComputedStyle(document.body).backgroundColor === "rgba(0, 0, 0, 0)") fail("with no background chosen <body> is still transparent (the theme colour must paint it)");
      offDetail = "off => no attribute, no layer, body " + getComputedStyle(document.body).backgroundColor;
      // ON
      window.dragonBgSet(pick.id);
      if (rootEl.getAttribute("data-dragon-bg") !== pick.id) fail("choosing a picture did not set data-dragon-bg to " + pick.id);
      var layer = document.getElementById("dragonBgLayer");
      if (!layer) fail("choosing a picture did not add #dragonBgLayer");
      if (getComputedStyle(layer).position !== "fixed") fail("#dragonBgLayer is not fixed-position");
      if ((rootEl.style.getPropertyValue("--dragon-bg-url") || "").indexOf(pick.url) === -1) fail("--dragon-bg-url does not carry the chosen url");
      if (!/linear-gradient\(/.test(rootEl.style.getPropertyValue("--dragon-bg-veil") || "")) fail("--dragon-bg-veil is not a gradient veil");
      if ((getComputedStyle(layer).backgroundImage || "").indexOf(pick.url) === -1) fail("#dragonBgLayer does not paint the chosen picture");
      if (getComputedStyle(layer).zIndex !== "-1") fail("#dragonBgLayer is not behind the page content (z-index " + getComputedStyle(layer).zIndex + ")");
      if (getComputedStyle(document.body).backgroundColor !== "rgba(0, 0, 0, 0)") fail("with a picture on, <body> still paints an opaque colour over it");
      if (!/^rgb/.test(getComputedStyle(rootEl).backgroundColor)) fail("<html> did not take over the theme page colour");
      onDetail = "on => attribute " + pick.id + ", layer fixed z-index -1, veil follows the theme";
      // the picker window itself
      window.dragonBgOpen();
      var ov = document.getElementById("dragonBgPick");
      if (!ov) fail("the background picker did not open");
      tiles = qa("#dragonBgPick .dragon-bg-tile").length;
      if (tiles !== list.length) fail("the picker shows " + tiles + " tiles for " + list.length + " choices");
      if (qa("#dragonBgPick .dragon-bg-cap").length !== tiles) fail("not every picker tile carries a caption");
      var marked = qa("#dragonBgPick .dragon-bg-tile").filter(function (t) { return t.getAttribute("data-on") === "1"; });
      if (marked.length !== 1 || marked[0].getAttribute("data-value") !== pick.id) fail("the picker does not mark exactly the chosen tile as active");
      var clipped = qa("#dragonBgPick .dragon-bg-tile").filter(function (t) {
        var c = q(".dragon-bg-cap", t);
        if (!c) return true;
        var cr = c.getBoundingClientRect(), tr = t.getBoundingClientRect();
        return cr.height < 5 || cr.bottom > tr.bottom + 1 || cr.top < tr.top - 1;
      });
      if (clipped.length) fail(clipped.length + " picker caption(s) are clipped by their tile");
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      if (document.getElementById("dragonBgPick")) { try { document.getElementById("dragonBgPick").remove(); } catch (e) {} }
      if (document.getElementById("dragonBgPick")) fail("the picker did not close on Escape");
    } finally {
      try {
        if (hadKey) localStorage.setItem("dragonBgId", was);
        else localStorage.removeItem("dragonBgId");
      } catch (e) {}
      if (window.dragonBgApply) window.dragonBgApply();
      var back = document.getElementById("dragonBgLayer");
      if (!window.dragonBgGet || window.dragonBgGet() === "none") {
        if (back) { try { back.remove(); } catch (e) {} }
      }
    }
    return offDetail + " | " + onDetail + " | picker " + tiles + " tiles with captions and cancel";
  }

  /* ------------------------------------------- rainy screen saver (Egon 22.09.2026) */
  // 🌧️ The "🌧 Rainy" toggle beside the saver cycle button (the two small saver buttons share one line) must
  // (a) swap the slideshow to the rainy
  // pool, (b) start the animated rain layer (power-rain-plugin) while the saver is up and (c) leave nothing
  // behind when the saver is dismissed. The visitor's own preference and the saver on/off state are
  // captured first and restored in a finally block, so the check-up never changes what they see.
  async function checkRainySaver() {
    var rainy = window.dragonScreenRainyImages;
    if (!rainy || !rainy.length) fail("the rainy screen-saver pool is missing (window.dragonScreenRainyImages)");
    var bad = rainy.filter(function (u) { return typeof u !== "string" || !/^https:\/\//.test(u); });
    if (bad.length) fail(bad.length + " rainy pool entr(y/ies) are not https urls");
    var main = window.dragonScreenImages || [];
    var dup = rainy.filter(function (u) { return main.indexOf(u) !== -1; });
    if (dup.length) fail(dup.length + " rainy picture(s) are also in the normal pool");
    if (typeof window.dragonSsRainyGet !== "function" || typeof window.dragonSsRainySet !== "function") fail("the rainy preference is not exposed (dragonSsRainyGet/Set)");
    if (typeof window.dragonBuildSsRainBtn !== "function") fail("the rainy Settings button builder is missing");
    var btn = window.dragonBuildSsRainBtn();
    if (!btn) fail("the rainy Settings button could not be built");
    var wasRain = window.dragonSsRainyGet();
    var wasSs = null, hadSs = false;
    try { hadSs = localStorage.getItem("dragonScreenSaver") !== null; wasSs = localStorage.getItem("dragonScreenSaver"); } catch (e) {}
    var offDetail = "", onDetail = "";
    try {
      // OFF — exactly the normal, warm pool
      window.dragonSsRainySet(false);
      if (window.dragonSsRainyGet()) fail("turning the rainy saver off did not stick");
      if (btn.getAttribute("data-on") !== "0") fail("the rainy button does not read Off after being turned off");
      offDetail = "off => \"" + (btn.textContent || "") + "\"";
      // ON — the saver must show a rainy picture AND run the rain layer above the overlay
      window.dragonSsRainySet(true);
      if (!window.dragonSsRainyGet()) fail("turning the rainy saver on did not stick");
      if (btn.getAttribute("data-on") !== "1") fail("the rainy button does not read On after being turned on");
      if (!window.root || typeof window.root.powerRain !== "function") fail("root.powerRain is missing - the power-rain-plugin import did not load");
      if (window.dragonScreenSet) window.dragonScreenSet(true);
      window.activateScreensaver();
      // Egon 01.10.2026 — the saver now opens once its first picture is DECODED (preload-first), so a
      // cold start legitimately takes a moment: poll instead of asserting the same tick.
      var ov = null;
      for (var wi = 0; wi < 50 && !ov; wi++) { var c0 = document.getElementById("dragonScreenOverlay"); if (c0 && c0.style.display === "flex") ov = c0; else await sleep(300); }
      if (!ov) fail("the screen saver did not appear within 15s (it opens once its first picture is decoded)");
      var shown = ["dragonScreenImgA", "dragonScreenImgB"].map(function (id) {
        var im = document.getElementById(id);
        return im ? (im.getAttribute("src") || "") : "";
      }).filter(Boolean);
      if (!shown.filter(function (u) { return rainy.indexOf(u) !== -1; }).length) fail("the saver is up but is not showing a rainy picture (" + (shown.join(", ") || "no src") + ")");
      var rc = document.getElementById("rainContainer");
      if (!rc) fail("the rain layer did not start while the rainy saver is up");
      var zi = getComputedStyle(rc).zIndex;
      if (zi !== "2147483647") fail("the rain layer sits at z-index " + zi + " - it must be above the saver overlay");
      if (!window.root.powerRain("running")) fail("the rain plugin reports it is not running");
      onDetail = "on => rainy picture shown, rain layer running at z-index " + zi;
      // dismiss it — the rain must stop and its container must disappear
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      if (ov.style.display === "flex") fail("the screen saver did not close on a key press");
      if (document.getElementById("rainContainer")) fail("the rain layer survived the saver being dismissed");
      if (window.root.powerRain("running")) fail("the rain plugin is still running after the saver was dismissed");
      // placement — the toggle is painted DIRECTLY UNDER the Screen Saver button in Settings
      if (window.dragonAccountOpen) {
        window.dragonAccountOpen();
        var rb = document.getElementById("dragonSsRainBtn");
        if (!rb) fail("Settings does not contain the rainy toggle (#dragonSsRainBtn)");
        var ssb = rb.parentNode ? rb.parentNode.querySelector(".dragon-ss-cycle") : null;
        if (!ssb) fail("the rainy toggle is not in the same block as the Screen Saver button");
        if (ssb.nextElementSibling !== rb) fail("the rainy toggle is not immediately after the Screen Saver button");
        // ⚖️ Egon 23.09.2026 (rev.2) — the two saver buttons are the SMALL pair now: they share ONE
        // line (half a line each) with the full-width presentation button UNDER them. So the placement to
        // assert is "on the same line, side by side" (measured: equal tops, equal widths, no overlap) —
        // not "under" any more. (The card body is rtl, so the cycle button paints on the RIGHT of the pair.)
        var rbR = rb.getBoundingClientRect(), ssbR = ssb.getBoundingClientRect();
        if (Math.abs(rbR.top - ssbR.top) > 3) fail("the rainy toggle and the saver cycle button must share one line (the small pair), tops " + Math.round(rbR.top) + " / " + Math.round(ssbR.top));
        if (Math.abs(rbR.width - ssbR.width) > 6) fail("the two small saver buttons must be equal width (" + Math.round(rbR.width) + " / " + Math.round(ssbR.width) + ")");
        if (rbR.right > ssbR.left + 1 && ssbR.right > rbR.left + 1) fail("the two small saver buttons overlap on their line");
      }
    } finally {
      try { window.dragonSsRainySet(wasRain); } catch (e) {}
      try {
        if (hadSs) localStorage.setItem("dragonScreenSaver", wasSs);
        else localStorage.removeItem("dragonScreenSaver");
      } catch (e) {}
      try { if (document.getElementById("rainContainer") && window.dragonSsRainStop) window.dragonSsRainStop(); } catch (e) {}
      try {
        var o2 = document.getElementById("dragonScreenOverlay");
        if (o2 && o2.style.display === "flex") { window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); o2.style.display = "none"; }
      } catch (e) {}
      try { if (document.querySelector(".dragon-account-page") && window.dragonAccountClose) window.dragonAccountClose(); } catch (e) {}
    }
    return offDetail + " | " + onDetail + " | toggle SIDE BY SIDE with the saver cycle button on the small pair's line";
  }

  function checkDupIds() {
    var map = {};
    qa("[id]").forEach(function (e) { (map[e.id] = map[e.id] || []).push(e); });
    var dups = Object.keys(map).filter(function (k) { return map[k].length > 1; });
    if (dups.length) fail("duplicate id(s): " + dups.slice(0, 8).join(", "));
    return qa("[id]").length + " unique ids";
  }

  /* ------------------------------------------- user-style sweep (self-test) */
  // Egon 19.09.2026 — the sweep the user asked for ("self-test like a real user and report problems") is
  // now a permanent part of the check-up. It walks every page WITHOUT touching data and reports:
  // horizontal overflow, visible placeholder text ("undefined" / "NaN" / "[object "), broken <img>,
  // duplicate element ids, buttons with no accessible name, and absurdly small buttons.
  var BAD_TEXT_RE = [/\bundefined\b/, /\bNaN\b/, /\[object [A-Za-z]*\]/];
  function duplicateIds() {
    var map = {};
    qa("[id]").forEach(function (e) { (map[e.id] = map[e.id] || []).push(e); });
    return Object.keys(map).filter(function (k) { return map[k].length > 1; });
  }
  function visiblePlaceholderText(limit) {
    var out = [], nodes = qa("body *");
    for (var i = 0; i < nodes.length && out.length < (limit || 8); i++) {
      var n = nodes[i];
      var tag = (n.tagName || "").toLowerCase();
      if (tag === "script" || tag === "style" || tag === "title" || tag === "textarea" || tag === "input" || tag === "option") continue;
      if (n.children.length) continue;
      if (!isVisible(n)) continue;
      var tx = (n.textContent || "").trim();
      if (!tx || tx.length > 60) continue;
      var hit = (tx === "null");
      for (var r = 0; r < BAD_TEXT_RE.length; r++) if (BAD_TEXT_RE[r].test(tx)) hit = true;
      if (hit) out.push(tx.replace(/\s+/g, " "));
    }
    return out;
  }
  function brokenImages(limit) {
    var out = [], imgs = qa("img");
    for (var i = 0; i < imgs.length && out.length < (limit || 8); i++) {
      var im = imgs[i];
      if (!im.src || !im.complete || im.naturalWidth > 0) continue;
      if (!isVisible(im)) continue;
      out.push(String(im.src).slice(0, 80));
    }
    return out;
  }
  function namelessButtons() {
    var out = [];
    qa("button").forEach(function (b) {
      if (!isVisible(b)) return;
      if ((b.textContent || "").trim()) return;
      if (b.title || b.getAttribute("aria-label")) return;
      if (b.querySelector("img[alt]")) return;
      out.push(String(b.className || b.id || "?"));
    });
    return out;
  }
  function tinyButtons() {
    var out = [];
    qa("button").forEach(function (b) {
      if (!isVisible(b)) return;
      var r = b.getBoundingClientRect();
      if (r.width < 14 && r.height < 14) out.push(String(b.className || b.id || "?") + " " + Math.round(r.width) + "x" + Math.round(r.height));
    });
    return out;
  }
  // The sweep is also callable on its own: `await window.dragonSweep()`.
  async function sweepRun() {
    var res = { startedOn: pageAttr(), pages: [], overflow: 0, badText: [], brokenImgs: [], dupIds: [], nameless: [], tiny: [] };
    for (var pi = 0; pi < PAGE_MARKERS.length; pi++) {
      var nm = PAGE_MARKERS[pi][0];
      try { window.dragonGoPage(nm); } catch (e) { continue; }
      await waitFor(function () { return pageAttr() === nm; }, 3000, 100);
      await sleep(120);
      var over = overflowPx();
      if (over > OVERFLOW_TOL) res.overflow = Math.max(res.overflow, over);
      res.pages.push(nm + (over > OVERFLOW_TOL ? "(" + Math.round(over) + "px)" : ""));
      visiblePlaceholderText().forEach(function (t) { res.badText.push(nm + ": \"" + t + "\""); });
      brokenImages().forEach(function (t) { res.brokenImgs.push(nm + ": " + t); });
    }
    res.dupIds = duplicateIds();
    res.nameless = namelessButtons();
    res.tiny = tinyButtons();
    if (res.startedOn) { try { window.dragonGoPage(res.startedOn); } catch (e) {} }
    return res;
  }
  async function checkSweep() {
    var r = await sweepRun();
    var issues = [];
    if (r.overflow > OVERFLOW_TOL) issues.push("horizontal overflow " + Math.round(r.overflow) + "px");
    if (r.dupIds.length) issues.push("duplicate id(s): " + r.dupIds.slice(0, 5).join(", "));
    if (r.badText.length) issues.push("placeholder text \u2014 " + r.badText.slice(0, 4).join(" | "));
    if (r.brokenImgs.length) issues.push("broken image(s) \u2014 " + r.brokenImgs.slice(0, 3).join(" | "));
    if (issues.length) fail(issues.join(" ; "));
    return r.pages.length + " pages swept: no overflow, no placeholder text, no broken image; " +
      qa("button").length + " buttons (" + r.nameless.length + " unnamed, " + r.tiny.length + " tiny), " +
      qa("img").length + " images, " + r.dupIds.length + " duplicate-id groups";
  }

  function checkConsole(ctx, opts) {
    var errs = (ctx.errors || []).filter(function (e) { return !isAllowed(e, opts.allowErrors); });
    if (errs.length) fail(errs.length + " console error(s): " + errs.slice(0, 4).map(function (e) { return e.type + ":" + e.text; }).join(" | "));
    return "no console errors";
  }
  function isAllowed(e, allow) {
    if (!allow || !allow.length) return false;
    var s = (e.type + " " + e.text);
    for (var i = 0; i < allow.length; i++) { try { if (new RegExp(allow[i], "i").test(s)) return true; } catch (x) {} }
    return false;
  }

  /* ------------------------------------------------------------------ run */
  // 📊 Visitor Stats board (Settings): the card must exist, the SERVER must answer the durable
  // dragon-online-history rpc (and have sampled the current minute), the canvas must draw bars, the
  // "Last 7 days" button must switch the view, and the hover tooltip must open below the pointer and
  // stay inside the VIEWPORT (the in-chart-box clamp was removed by owner request — the panel travels
  // freely and only the viewport edges limit it).
  // A synthetic payload drives the bar maths, so the check does not depend on real traffic history.
  async function checkVisitorStats() {
    if (typeof window.dragonBuildStatsCard !== "function") fail("dragonBuildStatsCard hook missing");
    if (typeof window.dragonStatsDebugSet !== "function") fail("dragonStatsDebugSet seam missing");
    var nav = qa(".dragon-nav-item").filter(function (b) { return b.dataset && b.dataset.navPage === "account"; })[0];
    if (!nav) fail("Settings nav item (account page) not found");
    nav.click();
    var card = await waitFor(function () { return document.getElementById("dragonStatsCard"); }, TIMEOUT, 150);
    // the stats card lives in the 📊 Stats tab now — without opening it every rect measures 0
    if (typeof window.dragonSettingsTab === "function") { try { window.dragonSettingsTab("stats"); } catch (e) {} }
    await sleep(300);
    if (!card) fail("Visitor Stats card did not appear in Settings");
    var cv = card.querySelector("#dragonStatsCanvas");
    if (!cv) fail("the chart canvas is missing");
    var sum = card.querySelector("#dragonStatsSummary");
    if (!sum) fail("the summary line is missing");
    var btns = qa("button", card);
    var b24 = btns.filter(function (b) { return /24\s*h/i.test(b.textContent || ""); })[0];
    var b7 = btns.filter(function (b) { return /7\s*d/i.test(b.textContent || ""); })[0];
    if (!b24 || !b7) fail("view buttons missing (24h=" + !!b24 + ", 7d=" + !!b7 + ")");
    // Always start from the documented default view. The board's window is a page-level variable, so an
    // earlier ABORTED run (one that failed between the 7d click and the 24h restore) would otherwise leave
    // it on "7d" and every later run would read the wrong window. Clicking 24h is free — it only re-reads
    // the live rings, and the synthetic payload replaces the data a few lines below.
    b24.click();
    await sleep(400);
    // --- server side: the durable history rpc must answer and hold this minute's sample ---
    var o = window.__dragonStatsSockets ? window.__dragonStatsSockets() : null;
    var sk = o && o.socket;
    if (!sk || !sk.rpc || typeof sk.rpc.dragonOnlineHistory !== "function") fail("server rpc dragonOnlineHistory missing");
    var real = null;
    try {
      real = JSON.parse(await sk.rpc.dragonOnlineHistory(""));
      if (!real.min || !real.hour) fail("the history payload is malformed");
      if (real.min.length < 1440) fail("the minute ring is too short (" + real.min.length + ")");
      if (real.hour.length < 168) fail("the hour ring is too short (" + real.hour.length + ")");
      if (real.min[real.nowMin % real.min.length] < 1) fail("the current minute holds no sample (history ring is not being fed)");
    } catch (e) { if (/malformed|too short|no sample/.test(e.message || "")) throw e; fail("history rpc failed: " + ((e && e.message) || e)); }
    // --- drawing: a synthetic payload with a known peak must be reported and drawn ---
    var nowMin = Math.floor(Date.now() / 60000), mins = [], hours = [], i;
    for (i = 0; i < 1500; i++) mins.push(i % 40);
    for (i = 0; i < 744; i++) hours.push(i % 30);
    window.dragonStatsDebugSet(nowMin, mins, hours);
    await sleep(80);
    if (!cv.style.width || parseInt(cv.style.width, 10) < 200) fail("the canvas was not sized / drawn (" + cv.style.width + ")");
    if (!/max 39 online/.test(sum.textContent || "")) fail("the header does not report the synthetic max (got \"" + sum.textContent + "\")");
    if (!/24 hours/.test(sum.textContent || "")) fail("neither view label in the header (\"" + sum.textContent + "\")");
    // --- the day button switches the view (and redraws with the same data) ---
    b7.click();
    await sleep(260);
    window.dragonStatsDebugSet(nowMin, mins, hours);
    await sleep(80);
    if (!/^Last 7 days/.test((sum.textContent || "").trim())) fail("the 7-day button did not switch the view (\"" + sum.textContent + "\")");
    // --- hover tooltip: appears under the pointer with a reading, free to travel, never off-screen ---
    // The board sits low in the Settings column, so the canvas is scrolled into the middle of the viewport
    // first: the panel is clamped to the VIEWPORT (owner: it must move freely but never off-screen), so an
    // off-screen pointer would legitimately push it back up and the "below the pointer" rule could not hold.
    try { cv.scrollIntoView({ block: "center" }); } catch (e) { cv.scrollIntoView(); }
    await sleep(200);
    var r = cv.getBoundingClientRect();
    var px = r.left + r.width * 0.55, py = r.top + r.height * 0.5;
    cv.dispatchEvent(new PointerEvent("pointermove", { clientX: px, clientY: py, bubbles: true }));
    await sleep(80);
    // The panel is a fixed layer on <body> (owner request: it must follow the pointer freely), so it is
    // looked up on the DOCUMENT, not inside the card.
    var tip = document.getElementById("dragonStatsTip");
    if (!tip || tip.style.display !== "block") fail("the hover tooltip did not appear");
    var tr = tip.getBoundingClientRect();
    // Egon 23.09.2026 (W-UI224) — a MOUSE pointer (this synthetic event has no pointerType, so it is a
    // mouse) puts the cursor at the panel's TOP-RIGHT corner: the panel opens DOWN and to the LEFT of the
    // pointer, so it never covers the cursor. (Touch opens ABOVE the finger — see statsPlaceTip.)
    if (tr.top < py - 1) fail("the hover tooltip did not open below the pointer (top " + tr.top.toFixed(0) + " vs pointer " + py.toFixed(0) + ")");
    if (tr.right > px + 1) fail("the mouse hover tooltip did not open to the LEFT of the pointer (right " + tr.right.toFixed(0) + " vs pointer " + px.toFixed(0) + ")");
    if (tr.left < -1 || tr.right > window.innerWidth + 1 || tr.top < -1 || tr.bottom > window.innerHeight + 1) fail("the hover tooltip left the viewport");
    if (!(tr.left < px && tr.top > py)) fail("the mouse hover tooltip is not anchored to the pointer's bottom-left (W-UI224)");
    if (!/online/.test(tip.textContent || "")) fail("the hover tooltip carries no reading");
    // put the REAL history back so the preview keeps showing live data, and leave the board on its
    // default 24h view (this check switched it to 7d to exercise the button).
    b24.click();
    await sleep(150);
    if (real) window.dragonStatsDebugSet(real.nowMin, real.min, real.hour);
    if (window.dragonGoPage) window.dragonGoPage("home");
    return "card + canvas, server rings " + real.min.length + "/" + real.hour.length + ", current minute sampled, synthetic peak drawn, day view switch + in-box tooltip OK";
  }


  /* ------------------------------------------------- visitors: merged panel */
  // 🌐 The Settings Visitors panel is MERGED into the 📊 Visitor Stats card (W-UI224): its list must live
  // INSIDE #dragonStatsCard, the retired stand-alone card must be gone, and a synthetic country payload
  // must render country chips (the check never depends on real traffic).
  async function checkVisitorsMerge() {
    if (typeof window.dragonRefreshVisitorsPanel !== "function") fail("dragonRefreshVisitorsPanel hook missing");
    var nav = qa(".dragon-nav-item").filter(function (b) { return b.dataset && b.dataset.navPage === "account"; })[0];
    if (!nav) fail("Settings nav item (account page) not found");
    nav.click();
    var host = await waitFor(function () { return document.getElementById("dragonVisitorsList"); }, TIMEOUT, 150);
    if (!host) fail("the Visitors list did not appear in Settings");
    var _sc = document.getElementById("dragonStatsCard");
    if (!_sc || !_sc.contains(host)) fail("the Visitors list is not merged inside the Visitor Stats card (W-UI224)");
    if (document.getElementById("dragonVisitorsCard")) fail("the retired stand-alone Visitors card is back on screen (W-UI224)");
    var realC = window.__dragonVisitorCountries;
    window.__dragonVisitorCountries = { TR: 2, DE: 1 };
    try { window.dragonRefreshVisitorsPanel(); } catch (e) { fail("refresh threw: " + ((e && e.message) || e)); }
    var chips = qa(".dragon-visitors-chip", host);
    if (chips.length < 2) fail("the country chips did not render (found " + chips.length + ")");
    var txt = chips.map(function (x) { return (x.textContent || "").trim(); }).join(" | ");
    if (!/2/.test(txt) || !/1/.test(txt)) fail("the chips do not carry both counts (\"" + txt + "\")");
    window.__dragonVisitorCountries = realC;
    try { window.dragonRefreshVisitorsPanel(); } catch (e) {}
    if (window.dragonGoPage) window.dragonGoPage("home");
    return "merged inside the Visitor Stats card, country chips render + follow a synthetic payload, no stand-alone card";
  }
  /* ---------------------------------------------- visitors: device pair (W-UX271) */
  // 📱💻 The Settings > 🌐 Visitors row carries a PINNED mobile/desktop pair again (W-CLEAN218 had parked it,
  // Egon asked for it back with a NEW symbol and a CLEAN tooltip): two chips of the flag-chip family, the
  // pair always the FIRST thing in the row and never re-sorted with the countries, a plain-emoji symbol,
  // and a tooltip that is a short human sentence (no markup, no escape sequences). A synthetic split drives
  // it, so the check never depends on real traffic.
  async function checkVisitorDevices() {
    if (typeof window.dragonRefreshVisitorsPanel !== "function") fail("dragonRefreshVisitorsPanel hook missing");
    if (typeof window.dragonDetectDevice !== "function") fail("dragonDetectDevice hook missing");
    var k = window.dragonDetectDevice();
    if (k !== "mobile" && k !== "desktop") fail("device detection returned \"" + k + "\"");
    var nav = qa(".dragon-nav-item").filter(function (b) { return b.dataset && b.dataset.navPage === "account"; })[0];
    if (!nav) fail("Settings nav item (account page) not found");
    nav.click();
    var host = await waitFor(function () { return document.getElementById("dragonVisitorsList"); }, TIMEOUT, 150);
    if (!host) fail("the Visitors list did not appear in Settings");
    var _sc = document.getElementById("dragonStatsCard");
    if (!_sc || !_sc.contains(host)) fail("the Visitors list is not merged inside the Visitor Stats card (W-UI224)");
    if (document.getElementById("dragonVisitorsCard")) fail("the retired stand-alone Visitors card is back on screen (W-UI224)");
    var realC = window.__dragonVisitorCountries, realD = window.__dragonVisitorDevices;
    window.__dragonVisitorCountries = { TR: 2, DE: 1 };
    window.__dragonVisitorDevices = { mobile: 3, desktop: 5, unknown: 0 };
    try { window.dragonRefreshVisitorsPanel(); } catch (e) { fail("refresh threw: " + ((e && e.message) || e)); }
    var dev = document.getElementById("dragonVisitorsDevices");
    if (!dev) fail("the pinned device container is missing");
    if (host.firstChild !== dev) fail("the device pair is not pinned to the far left of the row");
    var chips = qa(".dragon-visitors-device", dev);
    if (chips.length !== 2) fail("expected exactly two device chips, found " + chips.length);
    var txt = chips.map(function (c) { return (c.textContent || "").trim(); }).join(" | ");
    if (!/3/.test(txt) || !/5/.test(txt)) fail("the chips do not carry both counts (\"" + txt + "\")");
    if (!/dragon-visitors-chip/.test(chips[0].className)) fail("the device chips are not of the visitor chip family");
    // The symbol is a plain emoji (NOT the parked 20x14 SVG pair) and the tooltip is a clean sentence.
    var sym = chips.map(function (c) { var s = c.querySelector(".dragon-visitors-devicon"); return s ? (s.textContent || "").trim() : ""; }).join("");
    if (!sym || sym.length < 2) fail("the device chips carry no symbol (\"" + sym + "\")");
    var tip = String(chips[0].title || "") + " || " + String(chips[1].title || "");
    if (!tip.trim() || /[<>{}]|\\u|&lt;/.test(tip)) fail("the device tooltip is not a clean sentence (\"" + tip + "\")");
    if (!/online/.test(tip)) fail("the device tooltip does not say what it counts (\"" + tip + "\")");
    if (chips[0].querySelector("svg.dragon-visitors-devicon")) fail("the parked SVG icon came back instead of the new symbol");
    var h1 = Math.round(chips[0].getBoundingClientRect().height), h2 = Math.round(chips[1].getBoundingClientRect().height);
    if (h1 !== h2) fail("the two device chips are not the same height (" + h1 + " vs " + h2 + ")");
    window.__dragonVisitorDevices = { mobile: 6, desktop: 1, unknown: 0 };
    try { window.dragonRefreshVisitorsPanel(); } catch (e) {}
    var dev2 = document.getElementById("dragonVisitorsDevices");
    if (dev2 !== dev) fail("the pinned container was replaced by the rebuild");
    if (host.firstChild !== dev2) fail("the device pair lost its pinned position after a rebuild");
    var chips2 = qa(".dragon-visitors-device", dev2);
    if (chips2.length !== 2) fail("the device pair did not survive a rebuild (" + chips2.length + " chips)");
    var t2 = chips2.map(function (c) { return (c.textContent || "").trim(); }).join(" | ");
    if (!/6/.test(t2) || !/1/.test(t2)) fail("the pair did not follow the new split (\"" + t2 + "\")");
    window.__dragonVisitorDevices = { mobile: 0, desktop: 0, unknown: 4 };
    try { window.dragonRefreshVisitorsPanel(); } catch (e) {}
    if (!dev.hidden) fail("the device pair is still visible with nothing reported");
    window.__dragonVisitorCountries = realC;
    window.__dragonVisitorDevices = realD;
    try { window.dragonRefreshVisitorsPanel(); } catch (e) {}
    if (window.dragonGoPage) window.dragonGoPage("home");
    return "pinned pair first in the row, two emoji chips, clean tooltip, survives a rebuild, hides at zero (detector: " + k + ")";
  }
  /* ----------------------------------------------------------- pager idle */
  // The gallery pager must never advance while the visitor is NOT looking at the gallery. Every trigger it
  // has (tail distance, sentinel position, the "seen" observer) is a viewport measurement, and a hidden
  // element reports 0 for EVERY rect; that read as "the visitor is at the tail" and pulled the whole
  // listing in the background, which is exactly the "10000 Loaded / 10000 Total and it lags like crazy"
  // report. This walks to another page for a few seconds and fails if the pager moved on by itself.
  async function checkPagerIdle() {
    // The probe is installed by the gallery subsystem when IT boots; on a cold page it may not exist yet,
    // so wait for it (bounded) instead of failing instantly.
    if (typeof window.dragonGalState !== "function") {
      try { window.dragonGoPage("gallery"); } catch (e) {}
      await waitFor(function () { return typeof window.dragonGalState === "function"; }, TIMEOUT * 2, 200);
    }
    if (typeof window.dragonGalState !== "function") fail("dragonGalState probe missing");
    window.dragonGoPage("gallery");
    var tiles = await waitFor(function () { return qa(".dragon-gal-tile").length; }, TIMEOUT * 2, 250);
    if (!tiles) fail("no public gallery tiles rendered");
    await sleep(900);   // let anything already in flight finish before the baseline is taken
    var a = window.dragonGalState();
    if (!a) fail("dragonGalState returned nothing");
    if (a.done) return "listing already exhausted at " + a.shown + " images - the paging rule could not be exercised";
    window.dragonGoPage("home");
    await sleep(3000);
    var b = window.dragonGalState();
    if (!b) fail("dragonGalState returned nothing after the page switch");
    if (b.cap > a.cap) fail("the pager extended its batch (cap " + a.cap + " -> " + b.cap + ") while the visitor was on another page");
    if (b.shown > a.shown + 130) fail("the pager painted " + (b.shown - a.shown) + " more images while the visitor was on another page");
    window.dragonGoPage("gallery");
    await sleep(250);
    return "paused off-screen: cap held at " + b.cap + " with " + b.shown + " images painted";
  }

  /* -------------------------------------------------- lightbox close motion */
  // Egon 20.09.2026 - closing the lightbox must leave the page EXACTLY where it is whenever the tile that was
  // being viewed is on screen at all (even by one edge or corner). The old rule always ran scrollIntoView
  // ({block:"center"}), so on desktop the whole gallery jumped under the cursor on every close. The page is
  // deliberately pre-scrolled to a position where centring WOULD move it, otherwise the assertion would pass
  // for the wrong reason. Only the on-screen branch is exercised (the off-screen branch scrolls by design).
  async function checkLightboxCloseNoMove() {
    window.dragonGoPage("gallery");
    var n = await waitFor(function () { return qa(".dragon-gal-tile").length; }, TIMEOUT * 2, 250);
    if (!n) fail("no public gallery tiles rendered");
    await sleep(500);
    window.scrollTo(0, 1400);
    await sleep(900);
    var vw = window.innerWidth, vh = window.innerHeight;
    var list = qa(".dragon-gal-tile"), tile = null, rect = null, best = 0;
    // Any tile that is MOSTLY on screen will do (the rule only asks that the tile is on screen at all, even
    // partially), but it must be one whose centring would really have moved the page - otherwise the
    // assertion passes for the wrong reason. The most-visible candidate wins.
    for (var i = 0; i < list.length; i++) {
      var r = list[i].getBoundingClientRect();
      if (r.width < 40 || r.height < 40) continue;
      var top = Math.max(0, r.top), bot = Math.min(vh, r.bottom);
      var left = Math.max(0, r.left), right = Math.min(vw, r.right);
      if (bot <= top || right <= left) continue;
      var vis = ((bot - top) * (right - left)) / (r.width * r.height);
      if (vis < 0.6) continue;
      if (Math.abs(Math.round((r.top + r.bottom) / 2 - vh / 2)) < 20) continue;
      if (!tile || vis > best) { tile = list[i]; rect = r; best = vis; }
    }
    if (!tile) return "no substantially visible tile whose centring would have moved the page on this viewport";
    var wouldMove = Math.round((rect.top + rect.bottom) / 2 - vh / 2);
    if (Math.abs(wouldMove) < 20) return "skipped - the visible tile sits too close to the middle for centring to have moved the page";
    var img = tile.querySelector("img");
    if (!img) fail("the chosen tile has no image");
    var y0 = window.scrollY;
    img.click();
    var lb = await waitFor(function () { return document.querySelector(".dragon-lightbox-root"); }, TIMEOUT, 60);
    if (!lb) fail("the lightbox did not open from the tile");
    await sleep(300);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await sleep(900);
    var open = document.querySelector(".dragon-lightbox-root");
    if (open) { try { open.remove(); } catch (e) {} fail("the lightbox did not close on Escape"); }
    var y1 = window.scrollY;
    if (Math.abs(y1 - y0) > 2) fail("closing the lightbox moved the page by " + Math.round(y1 - y0) + "px although the image was on screen (centring would have been " + wouldMove + "px)");
    window.scrollTo(0, 0);
    await sleep(200);
    return "on-screen close left the page untouched (centring would have moved it " + wouldMove + "px)";
  }

  // 🏷️ Egon 20.09.2026 — the gallery menu must name a generator by its readable title, with the random URL
  // slug in parentheses ("Ultra Realistic Human AI Image Generator (xpm54q50i6)"); a bare slug is
  // unmemorable. Verifies the helpers, the snapshot, the unknown-channel fallback and the built menu.
  async function checkGalTitles() {
    if (typeof window.dragonGalTitle !== "function") fail("window.dragonGalTitle() is missing");
    if (typeof window.dragonGalDisp !== "function") fail("window.dragonGalDisp() is missing");
    var known = "xpm54q50i6";
    var t = window.dragonGalTitle(known);
    if (!t) fail("no snapshot title for the known channel " + known);
    var disp = window.dragonGalDisp(known);
    if (disp.indexOf(t) !== 0) fail('dragonGalDisp() does not lead with the title: "' + disp + '"');
    if (disp.indexOf("(" + known + ")") === -1) fail('dragonGalDisp() dropped the slug: "' + disp + '"');
    var unknown = window.dragonGalDisp("this-channel-does-not-exist-9z");
    if (unknown !== "this-channel-does-not-exist-9z") fail("an unknown channel must fall back to its plain slug, got: " + unknown);
    window.dragonGoPage("gallery");
    var opts = await waitFor(function () { return qa("option[data-gal-title]").length; }, TIMEOUT * 2, 250);
    if (!opts) fail("the built gallery menu carries no titled rows");
    var titled = 0, sample = "";
    var list = qa("option[data-gal-title]");
    for (var i = 0; i < list.length; i++) {
      var o = list[i], nm = o.dataset.galName || "", tt = o.dataset.galTitle;
      if (!tt) continue;
      titled++;
      if (!sample && nm && o.textContent.indexOf(tt) !== -1 && o.textContent.indexOf("(" + nm + ")") !== -1) sample = o.textContent.trim();
    }
    if (!titled) fail("the built gallery menu carries no titled rows");
    // Egon 20.09.2026 — the row must split into TWO lines: row 1 = gallery identification (label, date /
    // *New*, the random URL slug in parentheses, visit count), row 2 = the human-readable title only, with
    // its own parenthesised parts REMOVED and the line CENTRED (Rulebook I92).
    if (typeof window.dragonGalRenderRow !== "function") fail("window.dragonGalRenderRow() is missing");
    if (typeof window.dragonGalTitlePlain !== "function") fail("window.dragonGalTitlePlain() is missing");
    if (typeof window.dragonGalTitleShown !== "function") fail("window.dragonGalTitleShown() is missing");
    var parenTitle = "Free No Limit AI Image Generator (Text to Image)";
    var plainTitle = "Free No Limit AI Image Generator";
    if (window.dragonGalTitlePlain(parenTitle) !== plainTitle) fail("dragonGalTitlePlain() must drop the parenthesised part: " + window.dragonGalTitlePlain(parenTitle));
    if (window.dragonGalTitlePlain("(Only This)") !== "") fail("a title that is nothing but a parenthesised part must strip to empty");
    if (window.dragonGalTitlePlain(plainTitle) !== plainTitle) fail("dragonGalTitlePlain() must leave a title without parentheses untouched");
    // Egon 20.09.2026 — the SECOND half of the rule: generic marketing phrases never show, and a name
    // made only of them reads "Other Generator Gallery".
    var genTests = [
      ["AI Image Generator (free, no sign-up, unlimited)", "Other Generator Gallery"],
      ["Free No Limit AI Image Generator (Text to Image)", "Other Generator Gallery"],
      ["Unlimited Unlocked Free Text-to-Image AI Image Generator", "Other Generator Gallery"],
      ["Image Generator", "Other Generator Gallery"],
      ["DreamCanvas AI Image Generator (free, no sign-up, unlimited)", "DreamCanvas"],
      ["Cursed AI Image Generator (free, no sign-up, no limits)", "Cursed"],
      // 🧠 Egon 23.09.2026 (W-UI233) — the SEMANTIC NONSENSE GATE: a long word-salad that survived the
      // generic-phrase filter is not a name, so the gallery falls back to its URL-derived name or the
      // neutral one.
      ["vengeful bit regarding honored harbor", "Other Generator Gallery"],
      [" chrome GT2 police car, aurora borealis", "Other Generator Gallery"],
      ["", "Other Generator Gallery"]
    ];
    for (var gt = 0; gt < genTests.length; gt++) {
      var got = window.dragonGalTitleShown(genTests[gt][0]);
      if (got !== genTests[gt][1]) fail("dragonGalTitleShown(\"" + genTests[gt][0] + "\") = \"" + got + "\", expected \"" + genTests[gt][1] + "\"");
    }
    // Egon 20.09.2026 — the SLUG half of the rule: a human-readable URL names the gallery, a random code
    // or an all-generic slug does not, and when the title agrees with the URL the URL name wins in full.
    var slugTests = [
      ["", "you-are-the-best", "You are the best"],
      ["You Are The Best AI Image Generator", "you-are-the-best", "You are the best"],
      ["DreamCanvas AI Image Generator (free, no sign-up, unlimited)", "dreampixai", "DreamCanvas"],
      ["", "Hedq6s65sr", "Other Generator Gallery"],
      ["", "9eb7qdw73", "Other Generator Gallery"],
      ["", "image-generator-professional", "Other Generator Gallery"],
      ["", "ai-image-generator", "Other Generator Gallery"],
      ["", "asw-ai-rpg", "Other Generator Gallery"],
      ["", "my-cool-dragon-art", "My cool dragon art"]
    ];
    for (var st = 0; st < slugTests.length; st++) {
      var sg = window.dragonGalTitleShown(slugTests[st][0], slugTests[st][1]);
      if (sg !== slugTests[st][2]) fail("dragonGalTitleShown(\"" + slugTests[st][0] + "\", \"" + slugTests[st][1] + "\") = \"" + sg + "\", expected \"" + slugTests[st][2] + "\"");
    }
    // 🧠 Egon 23.09.2026 (W-UI233) — the semantic gate's OWN test: a word-salad is nonsense, a real title
    // with even one image/art/chat word in it is not.
    if (typeof window.dragonGalNameIsNonsense !== "function") fail("window.dragonGalNameIsNonsense() is missing (W-UI233)");
    var nonTests = [
      ["vengeful bit regarding honored harbor", true],
      ["chrome GT2 police car, aurora borealis", true],
      ["calm words floating gently across the page", true],
      ["Ultimate Story Generator", false],
      ["Social DB Character Lorebook Database", false],
      ["Prompt Studio Text Image Video Edit Prompts", false],
      ["Pergen", false],
      ["Fancy-Feast", false]
    ];
    for (var nt = 0; nt < nonTests.length; nt++) {
      var ng = !!window.dragonGalNameIsNonsense(nonTests[nt][0]);
      if (ng !== nonTests[nt][1]) fail("dragonGalNameIsNonsense(\"" + nonTests[nt][0] + "\") = " + ng + ", expected " + nonTests[nt][1]);
    }
    // and the nonsense title of a gallery with a MEANINGFUL url takes the url's name, not the neutral one
    var carName = window.dragonGalTitleShown(" chrome GT2 police car, aurora borealis", "car-generator");
    if (carName !== "Car generator") fail('a nonsense title with a readable url must take the url name, got "' + carName + '"');
    if (!window.dragonGalNameFix || !Object.keys(window.dragonGalNameFix).length) fail("window.dragonGalNameFix (the AI-curated names) is missing or empty");
    if (typeof window.dragonGalNameFromSlug !== "function") fail("window.dragonGalNameFromSlug() is missing");
    var fakeOpt = document.createElement("option");
    fakeOpt.dataset.galGal = "Gallery 7";
    fakeOpt.dataset.galName = known;
    fakeOpt.dataset.galTitle = parenTitle;
    fakeOpt.dataset.galDate = "20.09.26";
    fakeOpt.dataset.galVisits = "3";
    fakeOpt.dataset.galCount = "1.2k";
    var fakeRow = document.createElement("div");
    window.dragonGalRenderRow(fakeOpt, fakeRow, {});
    var lines = fakeRow.children;
    if (lines.length !== 2) fail("a gallery row must have 2 lines, got " + lines.length);
    var l1 = lines[0].textContent, l2 = lines[1].textContent;
    if (l1.indexOf("Gallery 7") === -1) fail("row 1 is missing the gallery label: " + l1);
    if (l1.indexOf("(" + known + ")") === -1) fail("row 1 must carry the URL slug in parentheses: " + l1);
    if (l1.indexOf("Free No Limit") !== -1) fail("row 1 must NOT carry the generator title: " + l1);
    if (l2.indexOf(plainTitle) !== -1) fail("row 2 must NOT show the generic marketing phrases (I92 second half): " + l2);
    if (l2.indexOf("Other Generator Gallery") === -1) fail("a generic-only title must read \"Other Generator Gallery\" on row 2: " + l2);
    if (l2.indexOf("(") !== -1 || l2.indexOf(")") !== -1) fail("row 2 must NOT show any parenthesised part (I92): " + l2);
    if (String(lines[1].style.justifyContent) !== "center") fail("row 2 must be centred, got justifyContent=" + lines[1].style.justifyContent);
    if (l2.indexOf("Gallery 7") !== -1) fail("row 2 must NOT repeat the gallery label: " + l2);
    // 🖼️ Egon 24.09.2026 — the image count on row 2. The option carries the count as a STRING and both shapes
    // must resolve to the same readable number: the exact form the producers now write ("5,765") and the
    // compact one an older/cached option may still hold ("5.8k" — whose decimal point a naive digit-strip
    // used to eat, reporting "58 images").
    if (typeof window.dragonGalCountFromText !== "function") fail("window.dragonGalCountFromText() is missing (W-FEAT280)");
    else {
      if (window.dragonGalCountFromText("5,765") !== "5,765") fail('dragonGalCountFromText("5,765") = ' + window.dragonGalCountFromText("5,765") + ', expected "5,765"');
      if (window.dragonGalCountFromText("5.8k") !== "5,800") fail('dragonGalCountFromText("5.8k") = ' + window.dragonGalCountFromText("5.8k") + ', expected "5,800"');
      if (window.dragonGalCountFromText("+10200") !== "+10200") fail('dragonGalCountFromText("+10200") must stay at the cap, got ' + window.dragonGalCountFromText("+10200"));
      if (window.dragonGalCountFromText("10200") !== "+10200") fail('dragonGalCountFromText("10200") must cap to "+10200", got ' + window.dragonGalCountFromText("10200"));
      if (window.dragonGalCountFromText("") !== "" || window.dragonGalCountFromText(null) !== "") fail("an empty count must render nothing");
    }
    if (l2.indexOf("\uD83D\uDDBC\uFE0F 1,200 images") === -1) fail('row 2 must render the compact count "1.2k" as "1,200 images": ' + l2);
    // a SPECIFIC name survives the generic-phrase filter, and OUR own gallery keeps its full name
    var fakeOpt4 = document.createElement("option");
    fakeOpt4.dataset.galGal = "Gallery 12";
    fakeOpt4.dataset.galName = "dreampixai";
    fakeOpt4.dataset.galTitle = "DreamCanvas AI Image Generator (free, no sign-up, unlimited)";
    var fakeRow4 = document.createElement("div");
    window.dragonGalRenderRow(fakeOpt4, fakeRow4, {});
    var l4 = fakeRow4.children[1] ? fakeRow4.children[1].textContent : "";
    if (l4 !== "DreamCanvas") fail('a specific name must keep its identity on row 2, got "' + l4 + '"');
    var fakeOpt5 = document.createElement("option");
    fakeOpt5.dataset.galGal = "Gallery";
    fakeOpt5.dataset.galOwn = "1";
    fakeOpt5.dataset.galName = known;
    fakeOpt5.dataset.galTitle = "\u2728 Best AI Image Generator \u2728";
    var fakeRow5 = document.createElement("div");
    window.dragonGalRenderRow(fakeOpt5, fakeRow5, {});
    var l5 = fakeRow5.children[1] ? fakeRow5.children[1].textContent : "";
    if (l5.indexOf("Best AI Image Generator") === -1) fail('our own gallery must keep its full name on row 2, got "' + l5 + '"');
    // a title that is only a parenthesised part has no name of its own → it now takes the URL-derived
    // name (or "Other Generator Gallery"), so the row keeps its second line
    var fakeOpt3 = document.createElement("option");
    fakeOpt3.dataset.galGal = "Gallery 9";
    fakeOpt3.dataset.galName = "paren-only-channel";
    fakeOpt3.dataset.galTitle = "(Only This)";
    var fakeRow3 = document.createElement("div");
    window.dragonGalRenderRow(fakeOpt3, fakeRow3, {});
    var l3 = fakeRow3.children[1] ? fakeRow3.children[1].textContent : "";
    if (l3 !== "Paren only channel") fail('a title made only of a parenthesised part must fall back to the URL name ("Paren only channel"), got "' + l3 + '"');
    // Egon 20.09.2026 — an untitled gallery is no longer nameless: the URL slug is humanised, and when
    // even that says nothing the gallery is listed as "Other Generator Gallery". "no-title-channel" therefore
    // shows TWO rows (row 1 keeps the raw slug in parentheses, row 2 carries the humanised name).
    var fakeOpt2 = document.createElement("option");
    fakeOpt2.dataset.galGal = "Gallery 8";
    fakeOpt2.dataset.galName = "no-title-channel";
    var fakeRow2 = document.createElement("div");
    window.dragonGalRenderRow(fakeOpt2, fakeRow2, {});
    if (fakeRow2.children.length !== 2) fail("an untitled gallery must still show its derived name on row 2, got " + fakeRow2.children.length + " row(s)");
    if (fakeRow2.textContent.indexOf("(no-title-channel)") === -1) fail("the untitled row lost its slug: " + fakeRow2.textContent);
    var l2b = fakeRow2.children[1] ? fakeRow2.children[1].textContent : "";
    if (l2b !== "No title channel") fail('an untitled gallery must be named from its URL slug ("No title channel"), got "' + l2b + '"');
    // a gallery with a CODE slug and no title falls back to the neutral name
    var fakeOpt6 = document.createElement("option");
    fakeOpt6.dataset.galGal = "Gallery 3";
    fakeOpt6.dataset.galName = "kbczxky21b";
    var fakeRow6 = document.createElement("div");
    window.dragonGalRenderRow(fakeOpt6, fakeRow6, {});
    var l6 = fakeRow6.children[1] ? fakeRow6.children[1].textContent : "";
    if (l6 !== "Other Generator Gallery") fail('a code-slug untitled gallery must read "Other Generator Gallery", got "' + l6 + '"');
    // the URL-agrees-with-the-title rule (Egon's own example)
    var fakeOpt7 = document.createElement("option");
    fakeOpt7.dataset.galGal = "Gallery 4";
    fakeOpt7.dataset.galName = "you-are-the-best";
    fakeOpt7.dataset.galTitle = "You Are The Best AI Image Generator";
    var fakeRow7 = document.createElement("div");
    window.dragonGalRenderRow(fakeOpt7, fakeRow7, {});
    var l7 = fakeRow7.children[1] ? fakeRow7.children[1].textContent : "";
    if (l7 !== "You are the best") fail('when the title agrees with the URL the URL name wins ("You are the best"), got "' + l7 + '"');
    return titled + " titled menu rows (2-row layout + I92 strip/centre OK), e.g. \"" + (sample || list[0].textContent.trim()).slice(0, 60) + "\"";
  }

  // 📐 Egon 20.09.2026 — the − / NNNpx / + tile-size control belongs to the VIEW controls, so it now
  // sits immediately LEFT of the 🏆 Best / 🔜 Recent / 🔥 Trending menu in row 2 (it used to share row 1
  // with the gallery menu and the toolbox). The small ⤢ button beside the gallery menu expands the
  // FIXED-SIZE (I59) gallery button to the full name — for a phone too, hence the viewport cap.
  async function checkGalToolbar() {
    window.dragonGoPage("gallery");
    // Egon 01.10.2026 — the − / NNNpx / + toolbar tile-size control is RETIRED: it must be gone and
    // the ▦ Tiles row in the 🎚 Sliders menu is the one tile-size control now (same shared control).
    var subRow0 = await waitFor(function () { return document.querySelector("#dragonSubRow"); }, TIMEOUT * 2, 200);
    if (!subRow0) fail("the sub-channel row (#dragonSubRow) is missing");
    if (document.querySelector("#dragonTileZoomWrap")) fail("the retired − / NNNpx / + tile-size control (#dragonTileZoomWrap) is still in the toolbar");
    var TH0 = window.dragonTileHybrid;
    if (!TH0 || typeof TH0.get !== "function" || typeof TH0.set !== "function") fail("window.dragonTileHybrid is missing");
    var row = subRow0;
    var rowKids = Array.prototype.slice.call(row.children).filter(isVisible);
    var sels = qa("select", row), sortSel = null;
    for (var i = 0; i < sels.length; i++) {
      var txt = Array.prototype.map.call(sels[i].options, function (o) { return o.textContent; }).join("|");
      if (txt.indexOf("Best") !== -1 && txt.indexOf("Trending") !== -1) { sortSel = sels[i]; break; }
    }
    if (!sortSel) fail("the Best/Recent/Trending menu is not in the sub-channel row");
    var sortWrap = sortSel.parentElement;
    // Egon 02.10.2026 — 🔄 Refresh · 🔍 Search · 🎚 Sliders sit immediately LEFT of the sort menu.
    if (rowKids.indexOf(sortWrap) !== 3) fail("the Best/Recent/Trending menu must come right AFTER the Refresh/Search/Sliders trio (index " + rowKids.indexOf(sortWrap) + ")");
    function btnTitle(n) { try { var b = (n && n.tagName === "BUTTON") ? n : (n && n.querySelector ? n.querySelector("button") : n); return (b && (b.title || b.textContent)) || ""; } catch (e) { return ""; } }
    if (btnTitle(rowKids[0]).indexOf("Refresh") !== 0) fail("the first control of row 2 must be Refresh, got \"" + btnTitle(rowKids[0]) + "\"");
    if (btnTitle(rowKids[1]).indexOf("Search Prompts") !== 0) fail("the second control of row 2 must be Search, got \"" + btnTitle(rowKids[1]) + "\"");
    if (btnTitle(rowKids[2]).indexOf("Sliders") !== 0) fail("the third control of row 2 must be Sliders, got \"" + btnTitle(rowKids[2]) + "\"");
    // ⤢ Egon 19-20.09.2026 — the ⤢ expand BUTTON is GONE. He never asked for a button: he asked for the
    // FIXED-SIZE (I59) gallery button to be sized so that OUR OWN generator name is fully visible. The
    // check therefore asserts the opposite of before — no ⤢ control in the toolbar, the fixed width is
    // measured from our own label (window.dragonGalBtnFixed), and when our own gallery is selected the
    // label is NOT truncated (scrollWidth <= clientWidth).
    if (document.querySelector("[data-dragon-gal-expand]")) fail("the retired ⤢ expand control is still in the toolbar");
    if (!window.dragonGalBtnFixed || typeof window.dragonGalBtnFixed.label !== "function" || typeof window.dragonGalBtnFixed.width !== "function")
      fail("window.dragonGalBtnFixed {label(), width()} is missing (the fixed width is measured from our own name)");
    var ownName = String(window.dragonGalBtnFixed.label() || "");
    if (ownName.indexOf("Other Generators/Galleries") === -1) fail("the fixed width is not measured from the default button label (W-UX290, got \"" + ownName + "\")");
    var galSels0 = qa("select").filter(function (s) { return qa("option[data-gal-short]", s).length > 0; });
    var galSel0 = null;
    for (var gk = 0; gk < galSels0.length; gk++) { if (isVisible(galSels0[gk].parentElement)) { galSel0 = galSels0[gk]; break; } }
    if (!galSel0) fail("the gallery menu select (option[data-gal-short]) is not found");
    var galBtn0 = galSel0.parentElement ? galSel0.parentElement.querySelector("button") : null;
    var galLbl0 = galBtn0 ? galBtn0.querySelector("span") : null;
    if (!galBtn0 || !galLbl0) fail("the gallery button / its label is missing");
    var ownIdx0 = -1, oc = null;
    for (var ok = 0; ok < galSel0.options.length; ok++) {
      oc = galSel0.options[ok];
      if ((oc.dataset.galShort || "").indexOf("Best AI Image Generator") !== -1) { ownIdx0 = ok; break; }
    }
    if (ownIdx0 === -1) fail("the gallery menu has no option for our own gallery (\"\\u2026 Best AI Image Generator \\u2026\")");
    // The button's fixed width is set when the toolbar is built and then grown by its OWN self-check
    // (requestAnimationFrame + a 400ms pass, because emoji/bold glyphs measure a few px narrow), so poll
    // until the label settles instead of measuring mid-layout. The selected option is restored afterwards.
    var prevIdx0 = galSel0.selectedIndex;
    var settled = false, truncW = 0, fixedW = 0, lblW = 0;
    for (var t = 0; t < 20; t++) {
      try { if (galSel0.selectedIndex !== ownIdx0) galSel0.selectedIndex = ownIdx0; } catch (e) { break; }
      try { galSel0.__dragonSyncLbl(); } catch (e) {}
      truncW = galLbl0.scrollWidth - galLbl0.clientWidth;
      fixedW = Math.round(galBtn0.getBoundingClientRect().width);
      lblW = Math.round(galLbl0.clientWidth);
      if (truncW <= 1) { settled = true; break; }
      await sleep(200);
    }
    try { galSel0.selectedIndex = prevIdx0; galSel0.__dragonSyncLbl(); } catch (e) {}
    if (!settled) fail("our own gallery name is truncated in the button (needs " + galLbl0.scrollWidth + "px, has " + galLbl0.clientWidth + "px)");
    return "− / " + rowKids[1].textContent + " / + sits immediately left of the sort menu; ⤢ expand control retired; our own name fits the " + fixedW + "px gallery button in full (" + lblW + "/" + galLbl0.scrollWidth + "px, no ellipsis)";
  }

  // 🖼️ Egon 20.09.2026 — HOME STYLE V7 "seamless": the v6 arrangement (full-bleed wall behind the
  // floating header + CTA) with ONE difference — every tile keeps its image's ORIGINAL aspect ratio and
  // the tiles KISS. That is a justified layout computed by dragonHomeV7Layout(): each row covers the
  // full width exactly (no gap, no crop) and the rows abut, so the wall is seamless; the wall may
  // overflow the viewport (the extra is clipped). Leaving v7 must clear the inline positions again.
  // Egon 22.09.2026 — SAFETY WRAPPER around the V7 body. The body can end EARLY because fail() throws, and
  // when it did the visitor's own home style stayed stored as "v7" for good (measured: the run left
  // localStorage.dragonHomeVersion === "v7" while the v8 default was active). The wrapper captures the stored
  // value + the page that was on screen first, and puts BOTH back in a `finally`, so a failed — or even a
  // crashed — run can never change anyone's home style again.
  async function checkHomeV7() {
    var prevRaw = null, prevPage = pageAttr();
    try { prevRaw = localStorage.getItem("dragonHomeVersion"); } catch (e) {}
    try {
      return await checkHomeV7Body();
    } finally {
      try { if (prevRaw == null) localStorage.removeItem("dragonHomeVersion"); else localStorage.setItem("dragonHomeVersion", prevRaw); } catch (e) {}
      try { window.dragonHomeApplyVer(); } catch (e) {}
      try { if (prevPage) window.dragonGoPage(prevPage); } catch (e) {}
    }
  }
  async function checkHomeV7Body() {
    if (!window.dragonHomeVers || window.dragonHomeVers.indexOf("v7") === -1) fail("v7 is not registered in window.dragonHomeVers");
    if (!window.HOME_VER_DESC || !window.HOME_VER_DESC.v7) fail("HOME_VER_DESC has no v7 entry");
    if (typeof window.dragonHomeV7Layout !== "function") fail("window.dragonHomeV7Layout() is missing");
    if (typeof window.dragonHomeApplyVer !== "function") fail("window.dragonHomeApplyVer() is missing");
    var prevPage = pageAttr();
    var prevRaw = null;
    try { prevRaw = localStorage.getItem("dragonHomeVersion"); } catch (e) {}
    var t0 = Date.now();
    window.dragonGoPage("home");
    try { localStorage.setItem("dragonHomeVersion", "v7"); } catch (e) {}
    window.dragonHomeApplyVer();
    var page = await waitFor(function () {
      var p = document.getElementById("dragonHomePage");
      return (p && p.className.indexOf("dragon-home-v7") !== -1) ? p : null;
    }, TIMEOUT, 150);
    if (!page) fail("switching to V7 did not apply the dragon-home-v7 class");
    var hero = page.querySelector(".dragon-home-hero"), cta = page.querySelector(".dragon-home-cta");
    if (!hero || !cta || hero.parentElement !== cta) fail("in V7 the header must move into the CTA (like v6)");
    await waitFor(function () {
      var on = 0; qa("#dragonHomePage .dragon-home-grid img").forEach(function (i) { if (i.naturalWidth) on++; });
      return on >= 12;
    }, TIMEOUT * 3, 250);
    await sleep(300);
    // Egon 22.09.2026 — the wall is positioned by dragonHomeV7Layout(), but a freshly woken page (or a
    // viewport change mid-run) can leave the tiles at ZERO size for one beat — measured once as a false
    // "the JS layout did not run" failure. Re-lay-out and re-measure up to 4 times before believing it.
    var grid, gb = null, tiles = [], sized = false, attempt, ti;
    for (attempt = 0; attempt < 4 && !sized; attempt++) {
      window.dragonHomeV7Layout();
      await sleep(attempt ? 450 : 250);
      grid = document.querySelector("#dragonHomePage .dragon-home-grid");
      gb = grid.getBoundingClientRect();
      tiles = qa(".dragon-home-tile", grid);
      sized = tiles.length >= 12;
      for (ti = 0; sized && ti < tiles.length; ti++) { var tr = tiles[ti].getBoundingClientRect(); if (!tr.width || !tr.height) sized = false; }
    }
    if (tiles.length < 12) fail("expected the home tiles, got " + tiles.length);
    var rows = {}, cropErr = 0, zeroCount = 0, parkedCount = 0, firstZero = "";
    tiles.forEach(function (t) {
      var r = t.getBoundingClientRect(), im = t.querySelector("img");
      if (t.style.display === "none") parkedCount++;
      if (!r.width || !r.height) {
        zeroCount++;
        if (!firstZero) firstZero = "class='" + String(t.className).slice(0, 60) + "' display='" + t.style.display + "' inline='" + (t.style.left || "-") + "/" + (t.style.top || "-") + "'";
        return;   // a zero-sized tile cannot take part in the geometry maths — reported below with detail
      }
      if (!t.style.left || !t.style.top) fail("a V7 tile has no inline position — the JS layout did not run");
      if (im && im.naturalWidth) cropErr = Math.max(cropErr, Math.abs(r.width / r.height - im.naturalWidth / im.naturalHeight));
      var ky = Math.round(r.y - gb.y);
      if (!rows[ky]) rows[ky] = { w: 0, h: 0 };
      rows[ky].w += r.width;
      rows[ky].h = Math.max(rows[ky].h, r.height);
    });
    if (zeroCount) fail("a V7 tile has no size — the JS layout did not run (" + zeroCount + "/" + tiles.length + " tiles are zero-sized, " + parkedCount + " parked with display:none, grid " + Math.round(gb.width) + "x" + Math.round(gb.height) + ", home display " + getComputedStyle(document.getElementById("dragonHomePage")).display + ", first: " + firstZero + ")");
    var ys = Object.keys(rows).map(Number).sort(function (a, b) { return a - b; });
    var maxRowErr = 0, maxJoinErr = 0;
    for (var i = 0; i < ys.length; i++) {
      maxRowErr = Math.max(maxRowErr, Math.abs(rows[ys[i]].w - gb.width));
      if (i > 0) maxJoinErr = Math.max(maxJoinErr, Math.abs(ys[i] - (ys[i - 1] + rows[ys[i - 1]].h)));
    }
    var covered = ys[ys.length - 1] + rows[ys[ys.length - 1]].h;
    if (cropErr > 0.02) fail("a V7 tile box does not match its image's aspect ratio (that image is cropped): error " + cropErr.toFixed(4));
    if (maxRowErr > 1.5) fail("a V7 row does not cover the full width (gap of " + maxRowErr.toFixed(2) + "px)");
    if (maxJoinErr > 1.5) fail("two V7 rows do not touch (gap of " + maxJoinErr.toFixed(2) + "px)");
    if (covered < gb.height - 1) fail("the V7 wall does not cover the viewport (" + Math.round(covered) + " < " + Math.round(gb.height) + ")");
    // leaving v7 must drop the inline positions again (other styles position the tiles themselves)
    try { localStorage.setItem("dragonHomeVersion", "v6"); } catch (e) {}
    window.dragonHomeApplyVer();
    await sleep(120);
    var leftover = 0;
    qa(".dragon-home-tile", grid).forEach(function (t) { if (t.style.left || t.style.top || t.style.width || t.style.height) leftover++; });
    if (leftover) fail("leaving V7 left " + leftover + " tile(s) with inline positions");
    try { if (prevRaw == null) localStorage.removeItem("dragonHomeVersion"); else localStorage.setItem("dragonHomeVersion", prevRaw); } catch (e) {}
    window.dragonHomeApplyVer();
    if (prevPage) window.dragonGoPage(prevPage);
    return "v7 justified wall: " + ys.length + " rows, max row-width error " + maxRowErr.toFixed(2) + "px, max row gap " + maxJoinErr.toFixed(2) + "px, max ratio error " + cropErr.toFixed(4) + ", covered " + Math.round(covered) + "/" + Math.round(gb.height) + "px (" + (Date.now() - t0) + "ms)";
  }

  // 🎞️ Egon 20.09.2026 — ONE scrolling-banner LANE. The purple reload notice, Dexa's news ticker and the
  // milestone banner all take the same lane, so two marquees can never scroll at once: the one that got
  // there first finishes, then the next starts. Gestures are shared too (desktop: 1 left click = stop /
  // resume, 2 left clicks = the banner's action, right click = destroy; touch: 1 tap stop, 2 taps destroy,
  // 3 taps action). Every scrolling banner carries the Dexa head PICTURE — never the dragon emoji.
  async function checkMarqueeLane() {
    var m = window.dragonMarquee;
    if (!m || typeof m.request !== "function" || typeof m.release !== "function" || typeof m.busy !== "function" || typeof m.queued !== "function") fail("window.dragonMarquee {request, release, busy, queued} is missing");
    if (typeof window.dragonMarqueeGestures !== "function") fail("window.dragonMarqueeGestures() is missing");
    if (typeof window.dragonMarqueeText !== "function") fail("window.dragonMarqueeText() is missing");
    if (typeof window.dragonMarqueeHead !== "function") fail("window.dragonMarqueeHead() is missing");
    var head = window.dragonMarqueeHead();
    if (!head || head.tagName !== "IMG") fail("the marquee head must be the Dexa head PICTURE (an <img>), got " + (head && head.tagName));
    if (!/b113225d7dd4df887890c5b33ed65f7f\.jpg$/.test(String(head.src || ""))) fail("the marquee head is not the Dexa head picture: " + String(head.src || "").slice(-44));
    if (window.dragonMarqueeText("\uD83D\uDC09 hi \uD83D\uDC09") !== "hi") fail("dragonMarqueeText() must strip the dragon emoji");
    // A real scrolling banner may legitimately be on screen already (the news ticker scrolls for ~30s,
    // the milestone banner longer) — wait for the lane to become free instead of assuming it starts idle.
    var freeNow = await waitFor(function () { return m.busy() ? null : true; }, TIMEOUT * 3, 250);
    if (!freeNow) {
      // Still busy after 27s: dismiss whatever is scrolling the way a VISITOR would (right-click / two
      // taps), which releases the lane, then wait again.
      ["dragonNewsTicker", "dragonVersionBar", "dragonMilestoneBanner"].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) { try { el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 40, clientY: 8 })); } catch (e) {} }
      });
      freeNow = await waitFor(function () { return m.busy() ? null : true; }, TIMEOUT, 250);
    }
    if (!freeNow && typeof m._clear === "function") {
      // 🕒 Egon 23.09.2026 — the lane may ALSO look busy because a QUEUED announcement is correctly waiting
      // out the 2-minute gap. That is the new flood control working, not a stuck banner, so force a clean
      // slate (drops the queue + the cooldown) and only insist that nothing is painted on screen.
      m._clear();
      freeNow = await waitFor(function () { return (m.onScreen && m.onScreen()) ? null : true; }, TIMEOUT, 250);
    }
    if (!freeNow) fail("the marquee lane never became free — a scrolling banner is stuck");
    var order = [];
    window.__cuRelA = null;
    // 🕒 drop any leftover cooldown so A starts immediately (it must NOT count as "two at once")
    if (typeof m._resetGap === "function") m._resetGap();
    m.request(function () { order.push("A"); window.__cuRelA = function () { m.release(); }; });
    m.request(function () { order.push("B"); m.release(); });
    await sleep(250);
    var startedTogether = order.length !== 1;
    var busy = m.busy(), que = m.queued();
    if (window.__cuRelA) window.__cuRelA();
    await sleep(150);
    // 🕒 Egon 23.09.2026 — FLOOD CONTROL: after one announcement leaves the screen the next one must wait
    // at least 2 minutes, so B may NOT have started yet.
    if (m.minGapMs !== 120000) fail("the announcement gap must be 2 minutes, minGapMs = " + m.minGapMs);
    var gap = (typeof m.gapLeftMs === "function") ? m.gapLeftMs() : -1;
    if (!(gap > 110000 && gap <= 120000)) fail("the 2-minute announcement gap is not running after a release (gapLeftMs() = " + gap + ")");
    if (order.join(",") !== "A") fail("a second announcement started INSIDE the 2-minute gap: " + order.join(","));
    if (typeof m._resetGap !== "function") fail("dragonMarquee._resetGap() test hook is missing");
    m._resetGap();
    await sleep(350);
    if (startedTogether) fail("two scrolling banners ran at the same time — the lane did not serialise them: " + order.join(","));
    if (!busy) fail("the lane did not report busy while a banner was running");
    if (que !== 1) fail("the waiting banner was not queued (queued() = " + que + ")");
    if (order.join(",") !== "A,B") fail("the queued banner did not start after the first one finished: " + order.join(","));
    return "single lane + 2-minute flood control: A ran, B waited (queued()=1, gap ~120s) and started on release; Dexa head picture + \uD83D\uDC09 strip OK";
  }

  // 📶 Egon 23.09.2026 — THE RELOAD NOTICE WAITS FOR A VISIBLE TAB ("this f5 notice until the tab comes to the front
  // beklesin"). A hidden tab must never spend the once-per-session notice on an unseen screen, and coming
  // back to the tab must ask for a fresh stats payload immediately (dragonStatsWake) instead of waiting out
  // the minute-long heartbeat or a reconnect backoff. This drives the parking + replay through a stubbed
  // document.visibilityState and removes every trace afterwards.
  async function checkReloadNoticeWake() {
    if (typeof window.dragonStatsWake !== "function") fail("window.dragonStatsWake() is missing");
    if (typeof window.dragonVersionPending !== "function") fail("window.dragonVersionPending() is missing");
    if (typeof window.dragonVersionResume !== "function") fail("window.dragonVersionResume() is missing");
    if (typeof window.dragonVersionNotice !== "function") fail("window.dragonVersionNotice() is missing");
    // 🔌 the zombie-socket watchdog: without it the wake hook asks a corpse and hears nothing forever
    if (typeof window.dragonStatsLinkStale !== "function") fail("window.dragonStatsLinkStale() is missing (zombie-socket watchdog)");
    if (typeof window.dragonStatsReconnect !== "function") fail("window.dragonStatsReconnect() is missing (zombie-socket watchdog)");
    if (window.dragonStatsLinkStale() && window.__dragonStatsSockets && window.__dragonStatsSockets().socket) {
      fail("a live, freshly-answered socket was reported as stale (the watchdog would churn the connection)");
    }
    var proto = document, desc = null;
    while (proto && !Object.getOwnPropertyDescriptor(proto, "visibilityState")) proto = Object.getPrototypeOf(proto);
    if (!proto) fail("could not locate the visibilityState property to stub");
    desc = Object.getOwnPropertyDescriptor(proto, "visibilityState");
    function setVis(v) {
      try { Object.defineProperty(proto, "visibilityState", { configurable: true, get: function () { return v; } }); }
      catch (e) { fail("could not stub document.visibilityState"); }
    }
    var savedDexa = window.dragonDexaUpdate;
    var probe = "999.0.0";
    try {
      setVis("hidden");
      window.dragonDexaUpdate = function () {};   // never pop a Dexa bubble during the probe
      window.dragonVersionNotice(probe, false);
      await sleep(80);
      if (document.getElementById("dragonVersionBar")) fail("the reload notice painted itself on a HIDDEN tab");
      var pend = window.dragonVersionPending();
      if (pend !== probe) fail("a hidden tab did not PARK the notice (dragonVersionPending() = " + pend + ")");
      // Free the SHARED marquee lane first: the replay is a scrolling announcement like any other, so a
      // banner still on screen, a queued one or the 2-minute flood-control gap would hold it back. Dismiss
      // whatever is scrolling (contextmenu = a visitor's right-click) and drop the queue + cooldown.
      ["dragonNewsTicker", "dragonVersionBar", "dragonMilestoneBanner"].forEach(function (id) {
        var b = document.getElementById(id);
        if (b) { try { b.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 40, clientY: 8 })); } catch (e) {} }
      });
      try { if (window.dragonMarquee && window.dragonMarquee._clear) window.dragonMarquee._clear(); } catch (e) {}
      await waitFor(function () { return (window.dragonMarquee && window.dragonMarquee.busy && window.dragonMarquee.busy()) ? null : true; }, 6000, 200);
      setVis("visible");
      // Drive the resume through its NAMED action instead of a synthetic `visibilitychange`: the real
      // listener calls exactly this, and dispatching a fake event would fire every other module's
      // visibility listener too (which, in this preview, starves requestAnimationFrame).
      var resumed = window.dragonVersionResume();
      if (!resumed) fail("dragonVersionResume() returned false although a notice was parked");
      var bar = await waitFor(function () { return document.getElementById("dragonVersionBar") || null; }, TIMEOUT, 120);
      if (!bar) fail("the parked notice did not appear when the tab became visible again");
      if (window.dragonVersionPending() !== null) fail("the parked notice was not cleared after it fired");
      if (window.dragonVersionResume()) fail("dragonVersionResume() reported a notice when none was parked");
    } finally {
      try { var b = document.getElementById("dragonVersionBar"); if (b) b.remove(); } catch (e) {}
      try { window.dragonMarquee.release(); } catch (e) {}
      try { if (window.dragonMarquee && window.dragonMarquee._clear) window.dragonMarquee._clear(); } catch (e) {}
      try { window.dragonDexaUpdate = savedDexa; } catch (e) {}
      try { Object.defineProperty(proto, "visibilityState", desc); } catch (e) {}
    }
    return "hidden tab PARKS the notice (no bar, pending = " + probe + "), becoming visible replays it as the purple bar, and dragonStatsWake() is the wired return-to-tab hook";
  }

  // 🧬 Egon 20.09.2026 — Dedupe collapses same-prompt copies; the OTHER half is called UNDUPE and shows
  // every copy again. The toolbar button shows the SELECTED preference (🧬 Dedupe while collapsed,
  // 🔍 Deep Dedupe while the channel walk runs, ↩️ Undupe while expanded) and opens the menu.
  async function checkUndupe() {
    if (typeof window.dragonVaultDedupe !== "function" || typeof window.dragonVaultUndupe !== "function" || typeof window.dragonVaultDedupeToggle !== "function") fail("window.dragonVaultDedupe() / dragonVaultUndupe() / dragonVaultDedupeToggle() is missing");
    // Egon 22.09.2026 — the button lives in the gallery's toolbox; if a previous check left the visitor on
    // another page it would be gone, so open the gallery first (order-independent).
    // NOTE: match by CLASS LIST, not by exact className — the button also carries `active` whenever the
    // grid is collapsed, which is the DEFAULT now (Egon 22.09.2026).
    var findDedupeBtn = function () {
      var bs = qa("button");
      for (var i = 0; i < bs.length; i++) if (bs[i].classList && bs[i].classList.contains("dragon-vault-dedupe-btn")) return bs[i];
      return null;
    };
    var b = findDedupeBtn();
    if (!b) {
      window.dragonGoPage("gallery");
      b = await waitFor(findDedupeBtn, TIMEOUT * 2, 200);
    }
    if (!b) fail("the 🧬 dedupe toolbar button is missing (window.dragonVaultDedupeButton())");
    if (typeof window.dragonVaultDedupeOn !== "function") fail("window.dragonVaultDedupeOn() is missing");
    var wasOn = !!window.dragonVaultDedupeOn();
    window.dragonVaultDedupe();
    await sleep(120);
    if (!window.dragonVaultDedupeOn()) fail("window.dragonVaultDedupe() did not collapse the grid");
    if (String(b.textContent).indexOf("\uD83E\uDDEC") === -1) fail("while collapsed the button must show the selected DEDUPE (🧬), got \"" + b.textContent + "\"");
    if (b.getAttribute("data-dragon-dedupe-state") !== "dedupe") fail("data-dragon-dedupe-state must read \"dedupe\" while collapsed");
    if (String(b.title || "").indexOf("Dedupe") !== 0) fail("the collapsed button does not name the selected Dedupe: " + b.title);
    window.dragonVaultUndupe();
    await sleep(120);
    if (window.dragonVaultDedupeOn()) fail("window.dragonVaultUndupe() did not show every copy again");
    if (String(b.textContent).indexOf("\u21A9") === -1) fail("while expanded the button must show the selected UNDUPE (↩️), got \"" + b.textContent + "\"");
    if (b.getAttribute("data-dragon-dedupe-state") !== "undupe") fail("data-dragon-dedupe-state must read \"undupe\" while expanded");
    if (wasOn) { window.dragonVaultDedupe(); await sleep(80); }
    return "🧬/↩️ halves named (dragonVaultDedupe / dragonVaultUndupe); the button shows the selected preference";
  }

  // 🔍🎲✖ Egon 20.09.2026 — INSIDE the gallery menu's search box: the 🎲 "open a random gallery" mini
  // button, and at the far right our own red ✖ whose job here is CLEAR the search.
  async function checkGalSearchTools() {
    window.dragonGoPage("gallery");
    var galSel = await waitFor(function () {
      var ss = qa("select").filter(function (s) { return qa("option[data-gal-short]", s).length > 0; });
      for (var i = 0; i < ss.length; i++) if (isVisible(ss[i].parentElement)) return ss[i];
      return null;
    }, TIMEOUT * 2, 250);
    if (!galSel) fail("the gallery menu select is not found");
    var btn = galSel.parentElement.querySelector("button");
    if (!btn) fail("the gallery menu button is missing");
    btn.click();
    var box = await waitFor(function () { return q(".dragon-sel-search"); }, TIMEOUT, 150);
    if (!box) fail("the gallery menu has no search box");
    var inp = box.querySelector("input"), tools = box.querySelector(".dragon-sel-search-tools");
    if (!inp || !tools) fail("the search box has no input / tool area");
    var dice = tools.querySelector(".dragon-sel-search-dice"), clr = tools.querySelector(".dragon-sel-search-clear");
    if (!dice) fail("the 🎲 Open Random Gallery mini button is missing from the search box");
    if (!clr) fail("the red ✖ (Clear) mini button is missing from the search box");
    if (String(dice.title || "").indexOf("Random Gallery") === -1) fail("the dice mini button does not advertise the random gallery: " + dice.title);
    if (String(clr.title || "").indexOf("Clear") === -1) fail("the ✖ mini button is not the CLEAR control: " + clr.title);
    if (!/\b2[0-9]{2}, ?[0-9]{1,2}, ?[0-9]{1,2}\b/.test(String(getComputedStyle(clr).backgroundImage))) fail("the clear mini button is not red: " + getComputedStyle(clr).backgroundImage);
    inp.value = "zzqq"; inp.dispatchEvent(new Event("input", { bubbles: true }));
    await sleep(200);
    clr.click();
    await sleep(250);
    var cleared = inp.value === "";
    try { document.body.click(); } catch (e) {}
    await sleep(120);
    if (!cleared) fail("the ✖ mini button does not clear the search (value=\"" + inp.value + "\")");
    return "search box carries the 🎲 random-gallery mini button + the red ✖ that CLEARS the search";
  }

  // 🗂️ Egon 20.09.2026 — the gallery-list sort menu: newest first? No — the order is what a visitor thinks
  // about (biggest, newest, alphabet, the two they drive, wildcard last), and the SELECTED row is now a
  // vivid yellow (#ffe600) instead of the muddy amber he called "yellow like shit".
  async function checkGalSortMenu() {
    window.dragonGoPage("gallery");
    var btn = await waitFor(function () {
      var bs = qa("button").filter(function (b) { return String(b.title || "").indexOf("Sort the gallery list") === 0; });
      return bs.length ? bs[0] : null;
    }, TIMEOUT * 2, 250);
    if (!btn) fail("the gallery-list sort control is missing");
    if (String(btn.title).indexOf("Original") !== -1) fail("the sort tooltip still advertises the retired \"Original\" mode: " + btn.title);
    btn.click();
    var rows = await waitFor(function () {
      var r = qa("div").filter(function (d) { return d.children.length === 0 && /^(\uD83C\uDFC6 Most Images|\uD83D\uDD1C Newest Image|\uD83D\uDD24 A\u2192Z|\uD83D\uDD52 Last Visited|\uD83D\uDC63 Most Visited|\uD83D\uDD00 Mix \(random\))$/.test(String(d.textContent).trim()); });
      return r.length >= 6 ? r : null;
    }, TIMEOUT, 150);
    var order = rows.slice(0, 6).map(function (d) { return String(d.textContent).trim(); });
    var want = ["\uD83C\uDFC6 Most Images", "\uD83D\uDD1C Newest Image", "\uD83D\uDD24 A\u2192Z", "\uD83D\uDD52 Last Visited", "\uD83D\uDC63 Most Visited", "\uD83D\uDD00 Mix (random)"];
    for (var i = 0; i < 6; i++) if (order[i] !== want[i]) fail("the sort menu order is wrong at position " + (i + 1) + ": \"" + order[i] + "\" (expected \"" + want[i] + "\")");
    // the SELECTED sort row wears the vivid-yellow standard (#ffe600): exactly one such row may be lit.
    var act = qa("div").filter(function (d) { return d.children.length === 0 && getComputedStyle(d).color === "rgb(255, 230, 0)"; });
    try { document.body.click(); } catch (e) {}
    await sleep(120);
    if (act.length !== 1) fail("the SELECTED sort row must be the vivid yellow #ffe600 (found " + act.length + " such rows)");
    return "sort order " + order.join(" \u00B7 ") + "; the selected row is the vivid #ffe600";
  }

  // 🧰 Egon 20.09.2026 — the Tools & Extras buttons must use OUR GENERAL GENERATOR BUTTON DESIGN, i.e.
  // exactly the "🎨 Open Generator Themes" button: same purple gradient, same #9b6bff border, same radius,
  // same bold weight. (Several of them are pre-existing popover buttons that used to paint themselves grey.)
  // Egon 08.10.2026 — SPECIAL buttons (their own on/off colours, e.g. 🔔 Social Alerts) are exempt.
  async function checkToolsButtons() {
    var nav = qa(".dragon-nav-item").filter(function (e) { return e.dataset && e.dataset.navPage === "account"; })[0];
    if (!nav) fail("the Settings navbar button (account page) is missing");
    nav.click();
    if (typeof window.dragonSettingsTab === "function") { try { window.dragonSettingsTab("tools"); } catch (e) {} }
    var card = await waitFor(function () {
      return qa(".dragon-set-card").filter(function (c) { var h = c.querySelector(".dragon-set-h"); return h && /Tools & Extras/i.test(h.textContent || ""); })[0] || null;
    }, TIMEOUT * 2, 250);
    if (!card) fail("the 🧰 Tools & Extras card is missing");
    var ref = qa("button", card).filter(function (b) { return /Buttons & Legends/i.test(b.textContent || ""); })[0];
    if (!ref) fail("the 🔍 Buttons & Legends reference button is missing from 🧰 Tools & Extras (it replaced the 🎨 Open Generator Themes button as the reference — that one moved to 🖼 UI & Display and is now a special, theme-coloured button)");
    var rs = getComputedStyle(ref), btns = qa("button", card).filter(function (b) { return !b.classList.contains("dragon-set-special"); });
    try { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); } catch (e) {}
    if (btns.length < 10) fail("the Tools & Extras card lost its buttons (" + btns.length + ")");
    var bad = [];
    btns.forEach(function (b) {
      var s = getComputedStyle(b);
      if (s.backgroundImage !== rs.backgroundImage || s.borderTopColor !== rs.borderTopColor || s.borderTopLeftRadius !== rs.borderTopLeftRadius || s.fontWeight !== rs.fontWeight) bad.push(String(b.textContent || "").trim().slice(0, 24) + " [" + String(s.backgroundImage).slice(0, 34) + "]");
    });
    if (bad.length) fail("these Tools & Extras buttons do NOT use the general button design (🎨 Open Generator Themes): " + bad.join(" | "));
    return btns.length + " Tools & Extras buttons all match the 🎨 Open Generator Themes design (gradient, border, radius, weight)";
  }

  // 💬 Egon 20.09.2026 — Dexa's talking bubble starts at its FIRST character and ends at its LAST: the box
  // hugs the text (width:max-content) instead of being a fixed block, and the reveal types it from the
  // first character to the last one.
  async function checkTalkBubble() {
    var api = window.dragonBotAPI;
    if (!api || typeof api.talkStreamStart !== "function" || typeof api.talkStreamChunk !== "function" || typeof api.talkStreamEnd !== "function") fail("window.dragonBotAPI.talkStream* is missing");
    var el = document.getElementById("dragonBotTalkBubble"), txt = document.getElementById("dragonBotTalkTxt");
    if (!el || !txt) fail("#dragonBotTalkBubble / #dragonBotTalkTxt is missing");
    if (String(el.style.width || "").indexOf("max-content") === -1) fail("the talk bubble does not hug its text (width=" + el.style.width + ")");
    if (txt.scrollWidth > el.clientWidth + 2) fail("the talk bubble is narrower than its own text (" + txt.scrollWidth + " > " + el.clientWidth + ")");
    api.talkStreamStart();
    await sleep(150);
    api.talkStreamChunk("Check-up bubble test 0123456789");
    var done = await waitFor(function () { return txt.textContent.indexOf("0123456789") !== -1 ? txt : null; }, 8000, 150);
    var shown = txt.textContent, w = Math.round(el.getBoundingClientRect().width);
    api.talkStreamEnd();
    await sleep(200);
    try { api.hideTalk(); } catch (e) {}
    if (!done) fail("the bubble never revealed the whole line (stuck at \"" + shown + "\")");
    return "the bubble hugs its text and reveals it from the first to the last character (" + shown.length + " chars, " + w + "px wide)";
  }

  // 🧭 Egon 22.09.2026 — "subchannel sort and close buttons in the public gallery toolbar should only be visible if there are other subchannels in the public
  // gallery. otherwise, they should stay hidden." The ↔ sorter and the red
  // ✕ "close every sub-channel" button are driven by the gallery's REAL sub-channel set (the active scan
  // record + the visitor's saved list + the active channel), so this check empties all three, re-renders,
  // asserts NEITHER control is visible while ➕ (the only way to create a sub-channel) stays — then restores
  // every key byte-exactly and proves the visitor's own row came back unchanged.
  async function checkSubChrome() {
    window.dragonGoPage("gallery");
    var row = await waitFor(function () { return document.getElementById("dragonSubRow"); }, TIMEOUT * 2, 250);
    if (!row) fail("#dragonSubRow is missing");
    if (typeof window.dragonSubScanRenderRow !== "function") fail("window.dragonSubScanRenderRow is missing");
    function labels() {
      return Array.prototype.map.call(row.querySelectorAll(":scope > button"), function (b) { return String(b.textContent).trim(); });
    }
    function sortWrapHidden() {
      var w = row.querySelector("[data-dragon-sub-sort]");
      if (!w) return true;
      try { if (getComputedStyle(w).display === "none") return true; } catch (e) {}
      return (w.offsetHeight || 0) === 0;
    }
    function closers() {
      return Array.prototype.filter.call(row.querySelectorAll(":scope > button"), function (b) { return String(b.textContent).trim().indexOf("\u2715") === 0; });
    }
    var subKey = "explorerSubs_" + (window.generatorName || "");
    var scanKeys = Object.keys(localStorage).filter(function (k) { return k.indexOf("dragonSubScan_") === 0; });
    var activeKey = (typeof window.dragonSubScanKey === "function") ? window.dragonSubScanKey() : null;
    if (activeKey && scanKeys.indexOf(activeKey) === -1) scanKeys.push(activeKey);
    var backup = {};
    scanKeys.forEach(function (k) { backup[k] = localStorage.getItem(k); });
    backup[subKey] = localStorage.getItem(subKey);
    var beforeLabels = labels().join("|");
    try {
      // 1) back to public (the ✕ button's own action), 2) no saved sub-channels, 3) an EMPTY scan record on
      //    every key the gallery could be reading → the gallery really has nothing but `public`.
      try { if (window.dragonSubScanCloseAll) window.dragonSubScanCloseAll(); } catch (e) {}
      try { localStorage.removeItem(subKey); } catch (e) {}
      var emptyRec = JSON.stringify({ ts: Date.now(), subs: {} });
      scanKeys.forEach(function (k) { try { localStorage.setItem(k, emptyRec); } catch (e) {} });
      window.dragonSubScanRenderRow();
      await sleep(340);
      if (!sortWrapHidden()) fail("the \u2194 sort button is still visible although the gallery has no sub-channel besides public");
      if (closers().length) fail("the \u2715 close-every-sub-channel button is still in the row although the gallery has no sub-channel besides public");
      var ls = labels();
      if (ls.length !== 2 || ls.filter(function (t) { return t.indexOf("public") === 0; }).length !== 1 || ls.filter(function (t) { return t.indexOf("\uFF0B") === 0; }).length !== 1) {
        fail("with no sub-channel besides public the row must be exactly `public` + \uFF0B, got [" + ls.join(", ") + "]");
      }
    } finally {
      try { if (backup[subKey] === null) localStorage.removeItem(subKey); else localStorage.setItem(subKey, backup[subKey]); } catch (e) {}
      scanKeys.forEach(function (k) { try { if (backup[k] === null) localStorage.removeItem(k); else localStorage.setItem(k, backup[k]); } catch (e) {} });
      window.dragonSubScanRenderRow();
      await sleep(320);
    }
    if (labels().join("|") !== beforeLabels) fail("the sub-channel row was not restored after the test (" + beforeLabels + " -> " + labels().join("|") + ")");
    return "with no sub-channel besides public the \u2194 sorter and the \u2715 are hidden and \uFF0B stays; the visitor's own row is restored byte-exactly";
  }

  // 🔀 Egon 20.09.2026 (mails [365]/[367]) — SUB-CHANNEL SORT. The chips were always painted
  // colour-band → most images. a shared pattern's `↕ sort ▾` menu lets the visitor choose the order INSIDE a band
  // (most images / A→Z / scan order) while public never moves and the bands never mix. The functional
  // part drives all three modes against a TEMPORARY scan record with four known names (whose three
  // orders are all different) and restores every byte of it afterwards.
  // 🙈 Egon 23.09.2026 — alpha/beta/zeta/gamma are hidden for every visitor (dragonSubHidden), so this test
  // flips the app's own one-test escape hatch for its whole body (see `checkSubSortInner`) and restores it,
  // plus re-renders the row, no matter how the body exits — a failed assertion must not leak the hatch.
  async function checkSubSort() {
    var prevShowHidden = window.__dragonSubShowHidden;
    // The app wires the sub-channel row asynchronously (on a cold page the hook can still be missing a
    // second after load), so wait for it before the hatch + refresh below can have any effect.
    await waitFor(function () { return window.dragonSubRowRefresh ? 1 : null; }, TIMEOUT, 150);
    window.__dragonSubShowHidden = true;
    // The row may already be on screen from an earlier check (dragonGoPage() to the page you are already on
    // is a no-op), so it is re-rendered HERE: `beforeAll` must be captured from a row that already honours
    // the restored filter, otherwise the byte-exact comparison at the end compares two different worlds.
    try { if (window.dragonSubRowRefresh) window.dragonSubRowRefresh(); } catch (e) {}
    await sleep(200);
    try {
      return await checkSubSortInner();
    } finally {
      try { if (prevShowHidden === undefined) delete window.__dragonSubShowHidden; else window.__dragonSubShowHidden = prevShowHidden; } catch (e) {}
      // Wait for the body's own final re-render to settle, then refresh the row under the restored filter.
      await sleep(260);
      try { if (window.dragonSubRowRefresh) window.dragonSubRowRefresh(); } catch (e) {}
    }
  }
  // 🔀 the planted scan record only renders while the hidden-junk filter is bypassed (see the wrapper above);
  // `beforeAll` is captured with the hatch already on, so the byte-exact restore comparison stays honest.
  async function checkSubSortInner() {
    window.dragonGoPage("gallery");
    var row = await waitFor(function () { return document.getElementById("dragonSubRow"); }, TIMEOUT * 2, 250);
    if (!row) fail("#dragonSubRow is missing");
    var api = await waitFor(function () { return window.dragonSubSort || null; }, TIMEOUT * 2, 200);
    if (!api || typeof api.set !== "function" || typeof api.mode !== "function") fail("window.dragonSubSort {mode, keys, set} is missing");
    if (api.keys.join(",") !== "images,az,order") fail("the sub-channel sort modes are not images/az/order: " + api.keys.join(","));
    // 🧭 Egon 22.09.2026 — the REAL chip order is captured BEFORE the temporary record exists, so the
    // test can prove at the end that the visitor's own row came back byte-exactly.
    var beforeAll = order().join("|");
    // 🧭 Egon 22.09.2026 — since the ↔ sorter is only rendered while the gallery HAS a sub-channel besides
    // `public`, this functional test plants its temporary scan record FIRST: with alpha/zeta/beta/gamma in
    // the record the row is guaranteed to carry the control. `keys`/`backup`/`fake`/`got` are exactly the
    // ones the mode round-trip restores byte-exactly at the end, so they are created here, once.
    var keys = Object.keys(localStorage).filter(function (k) { return k.indexOf("dragonSubScan_") === 0; });
    var backup = {};
    keys.forEach(function (k) { backup[k] = localStorage.getItem(k); });
    var fake = JSON.stringify({ subs: { alpha: 500, zeta: 3, beta: 40, gamma: 2 }, ts: Date.now() });
    var got = {};
    var activeKey = (typeof window.dragonSubScanKey === "function") ? window.dragonSubScanKey() : null;
    if (activeKey && keys.indexOf(activeKey) === -1) { keys.push(activeKey); backup[activeKey] = localStorage.getItem(activeKey); }
    keys.forEach(function (k) { try { localStorage.setItem(k, fake); } catch (e) {} });
    api.set("images");
    await sleep(240);
    var wrap = await waitFor(function () { return document.querySelector("[data-dragon-sub-sort]"); }, TIMEOUT, 200);
    if (!wrap) fail("the \u2194 sort control is missing although the gallery has sub-channels");
    var btn = wrap.querySelector("#dragonSubSortBtn") || wrap.querySelector("button");
    if (!btn) fail("the ↕ sort control has no button");
    var rows = wrap.querySelectorAll("[data-ssk]");
    if (rows.length !== 3) fail("the ↕ sort menu must offer exactly 3 modes, got " + rows.length);
    var ssk = [];
    Array.prototype.forEach.call(rows, function (r) { ssk.push(r.getAttribute("data-ssk")); });
    if (ssk.sort().join(",") !== "az,images,order") fail("the ↕ sort modes are wrong: " + ssk.join(","));
    // Egon 22.09.2026 — the sorter now reads ↔ (the sideways arrow: it reorders the chips ALONG the row).
    if (String(btn.textContent).indexOf("\u2194") !== 0) fail("the ↔ sort button does not read \"↔\": " + btn.textContent);
    var bStyle = getComputedStyle(btn);
    if (bStyle.backgroundImage === "none") fail("the ↔ sort button lost the modern chrome (flat button: no gradient)");
    // Egon 22.09.2026 — tapping ANYWHERE else must close the menu (it used to stay open forever).
    try {
      btn.click();
      await sleep(160);
      var menuEl = wrap.querySelector(".dragon-menu-card");
      if (!menuEl || getComputedStyle(menuEl).display === "none") fail("the ↔ sort menu did not open on click");
      // 🧪 Egon 23.09.2026 — a COLD page occasionally still finishes wiring itself while this runs (the same
      // race the load-window check documents), and the first synthetic tap can land before the app's global
      // capture-phase closer is live. The tap is therefore retried a few times (bounded, ~1.2 s) — the menu
      // must still be gone in the end, so a real regression can never pass.
      var closed = false;
      for (var tapTry = 0; tapTry < 4 && !closed; tapTry++) {
        document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
        await sleep(150);
        closed = (!menuEl || getComputedStyle(menuEl).display === "none");
      }
      if (!closed) fail("the ↔ sort menu does not close when the visitor taps outside it");
    } catch (e) {
      if (String(e && e.message || e).indexOf("does not") !== -1 || String(e && e.message || e).indexOf("did not") !== -1) throw e;
    } finally { try { var _m2 = wrap.querySelector(".dragon-menu-card"); if (_m2 && getComputedStyle(_m2).display !== "none") btn.click(); } catch (e2) {} }
    var bb = btn.getBoundingClientRect();
    var chip = null, kids = qa("button", row);
    for (var ci = 0; ci < kids.length; ci++) { if (String(kids[ci].textContent).indexOf("public") === 0) { chip = kids[ci]; break; } }
    if (!chip) fail("the public sub-channel chip is missing");
    var cb = chip.getBoundingClientRect();
    if (bb.height > cb.height + 3 || bb.width > 44) fail("the ↕ sort control must be a MINI icon button, not a labelled control (got " + Math.round(bb.width) + "x" + Math.round(bb.height) + " vs chip " + Math.round(cb.width) + "x" + Math.round(cb.height) + ")");
    // Egon 21.09.2026 — the sorter must sit IMMEDIATELY LEFT of the public chip (same row, no chip between).
    var siblings = qa(":scope > *", row);
    var iBtn = siblings.indexOf(wrap), iChip = siblings.indexOf(chip);
    if (iBtn < 0) fail("the ↕ sort control is not a direct child of the sub-channel row");
    if (iChip < 0) fail("the public chip is not a direct child of the sub-channel row");
    if (iBtn !== iChip - 1) fail("the ↕ sort control must sit immediately left of the public chip (index " + iBtn + " vs chip " + iChip + ")");
    // 🧭 Egon 23.09.2026 — the row is a WRAPPING flex line (its own 3-row window) and it also carries the
    // toolbar's controls, so on a phone the toolbar can take the first line and the chips the next one
    // (measured at 390px: the ↔ control at y149-174, the chips at y179). The control must be centred on the
    // chip whenever the two really share a line; when the row has WRAPPED, the honest requirement is that it
    // sits on the line directly ABOVE the chip row — stranded anywhere else still fails.
    var sameLine = Math.abs(bb.top - cb.top) < 8;
    var wrapped = "";
    if (sameLine) {
      if (Math.abs(bb.top + bb.height / 2 - (cb.top + cb.height / 2)) > 12) fail("the ↕ sort control is not vertically centred on the chip row");
    } else if (!(bb.bottom <= cb.top + 1 && bb.top < cb.top)) {
      fail("the row wrapped, but the ↕ sort control is not on the line directly above the chips (btn y " + Math.round(bb.top) + "-" + Math.round(bb.bottom) + ", chip y " + Math.round(cb.top) + "-" + Math.round(cb.bottom) + ")");
    } else {
      wrapped = " · the row WRAPPED at " + window.innerWidth + "px, so the control sits on the line directly above the chips (measured, not assumed)";
    }
    function order() {
      return qa("button", row).filter(function (b) {
        // 🧭 Egon 25.09.2026 — the sub-channel row also carries the toolbar's controls, and an open
        // dropdown's rows are DOM children of it too, so the chip order is read from the chips ALONE:
        // anything nested inside a menu popup (the image-sort ⓘ rows, the ↔ sorter) is not a chip.
        return !(b.closest && b.closest("[data-dragon-info-rows], [data-dragon-sub-sort]"));
      }).map(function (b) { return String(b.textContent).trim(); })
        .filter(function (t) {
          if (!t || t === "−" || t === "+" || t === "＋" || t === "✕") return false;
          if (/px$/.test(t)) return false;
          // 🧭 Egon 29.09.2026 — chips carry their picture count glued on ("public+10200"), so the
          // count (and any glue/space before it) is stripped before the name test, not after.
          return /^[a-z0-9-]+$/i.test(t.replace(/[+\s]*[0-9]+$/, ""));
        }).map(function (t) { return t.replace(/[+\s]*[0-9]+$/, ""); });
    }
    var before = order().join("|");
    if (before.indexOf("public") !== 0) fail("public is not the first chip of the sub-channel row: " + before);
    try {
      keys.forEach(function (k) { try { localStorage.setItem(k, fake); } catch (e) {} });
      var modes = ["images", "az", "order"];
      for (var mi = 0; mi < modes.length; mi++) {
        api.set(modes[mi]);
        await sleep(220);
        got[modes[mi]] = order().join("|");
        if (got[modes[mi]].indexOf("public") !== 0) fail("public moved while sorting by " + modes[mi]);
      }
      if (localStorage.dragonSubSortMode !== "order") fail("the ↕ sort choice is not remembered (localStorage.dragonSubSortMode=" + localStorage.dragonSubSortMode + ")");
    } finally {
      keys.forEach(function (k) { try { if (backup[k] === null) localStorage.removeItem(k); else localStorage.setItem(k, backup[k]); } catch (e) {} });
      api.set("images");
      await sleep(200);
    }
    var im = got.images, az = got.az, od = got.order;
    if (im === az || im === od || az === od) fail("the three modes do not produce three different orders (" + im + " / " + az + " / " + od + ")");
    if (im.indexOf("public|alpha|beta|zeta|gamma") !== 0) fail("the most-images order is wrong: " + im);
    if (az.indexOf("public|alpha|beta|gamma|zeta") !== 0) fail("the A→Z order is wrong: " + az);
    if (od.indexOf("public|alpha|zeta|beta|gamma") !== 0) fail("the scan order is wrong: " + od);
    if (order().join("|") !== beforeAll) fail("the sub-channel row was not restored after the test (" + beforeAll + " -> " + order().join("|") + ")");
    return "↔ 3 modes (most images / A→Z / scan order), modern chrome, closes on an outside tap, public always first, the visitor's record restored byte-exactly" + wrapped;
  }

  // tile-size control spans 100–800px with an AUTO mode sized to the screen. The check drives the
  // shared window.dragonTileHybrid control and puts the visitor's own tile size back afterwards.
  async function checkTileRange() {
    window.dragonGoPage("gallery");
    // Egon 01.10.2026 — the toolbar − / NNNpx / + control is RETIRED (the ▦ Tiles row in the 🎚 menu
    // is the one control now); the range underneath is driven through the shared control directly.
    if (document.getElementById("dragonTileZoomWrap")) fail("the retired − / NNNpx / + tile-size control is still in the toolbar");
    var g0 = await waitFor(function () { var g = qa(".dragon-gal-grid").filter(isVisible)[0]; return (g && qa(".dragon-gal-tile", g).length) ? g : null; }, TIMEOUT * 3, 250);
    if (!g0) fail("no visible .dragon-gal-grid with tiles after opening the gallery");
    var TH = window.dragonTileHybrid;
    if (!TH || typeof TH.get !== "function" || typeof TH.set !== "function") fail("window.dragonTileHybrid is missing");
    var thOrig = null, g100 = null, g800 = null;
    try { thOrig = TH.get(); } catch (e) {}
    try { TH.set(100); g100 = TH.get(); TH.set(800); g800 = TH.get(); } catch (e) {}
    try { if (thOrig !== null) TH.set(thOrig); } catch (e) {}
    if (g100 !== 100) fail("the shared tile-size control does not go down to 100px (got " + g100 + ")");
    if (g800 !== 800) fail("the shared tile-size control does not go up to 800px (got " + g800 + ")");
    function cols() {
      var grids = qa(".dragon-gal-grid").filter(isVisible);
      if (!grids.length) return 0;
      var t = getComputedStyle(grids[0]).gridTemplateColumns;
      return t ? t.split(" ").length : 0;
    }
    if (!cols()) fail("no visible .dragon-gal-grid to measure");
    // A non-grid display mode (Justified / Stretch / Masonry) makes the column maths meaningless, so the
    // measurement is taken in a real GRID mode and the visitor's own choice is put back afterwards.
    var prevDisp = null;
    try { prevDisp = localStorage.getItem("dragonGalDisplay"); } catch (e) {}
    var allDisp = qa("button[data-disp]");
    function pickDisp(v) {
      for (var di = 0; di < allDisp.length; di++) { if (allDisp[di].getAttribute("data-disp") === v) return allDisp[di]; }
      return null;
    }
    var coverBtn = pickDisp("cover");
    if (coverBtn) { coverBtn.click(); await sleep(400); }
    var wasAuto = null;
    try { wasAuto = window.dragonTileSharedMode ? window.dragonTileSharedMode() : null; } catch (e) {}
    var orig = TH.get(), small = 0, huge = 0, mid = 0;
    try {
      TH.set(100); await sleep(260); small = cols();
      TH.set(800); await sleep(260); huge = cols();
      TH.set(340); await sleep(260); mid = cols();
    } finally {
      TH.set(orig);
      await sleep(220);
      var backBtn = pickDisp(prevDisp && prevDisp !== "cover" ? prevDisp : "cover");
      if (backBtn) { backBtn.click(); await sleep(320); }
    }
    // 🖼️ Each screen size has its own ceiling for the dense end (phone 4 · large phone 6 · tablet 9 ·
    // desktop 12), so the expected floor depends on the viewport this run is using.
    var vw = window.innerWidth || document.documentElement.clientWidth;
    var smallFloor = vw > 1024 ? 8 : (vw > 760 ? 5 : 3);
    if (small < smallFloor) fail("100px tiles do not paint a dense wall at " + vw + "px (" + small + " columns, expected >= " + smallFloor + ")");
    if (small <= mid) fail("smaller tiles must paint MORE columns than the default (" + small + " at 100px vs " + mid + " at 340px)");
    if (huge !== 1) fail("800px tiles are not one image per row (" + huge + " columns)");
    if (mid < 1 || mid > 6) fail("340px tiles must still paint a sane 1–6 column grid, got " + mid);
    try { if (wasAuto === "auto" && window.dragonTileAuto) window.dragonTileAuto(); } catch (e) {}
    if (Math.round(TH.get()) !== Math.round(orig)) fail("the visitor's own tile size was not restored (" + orig + " -> " + TH.get() + ")");
    return "tile size 100–800px at " + vw + "px wide: 100px = " + small + " cols, 340px = " + mid + " cols, 800px = " + huge + " col (own size " + Math.round(orig) + "px restored)";
  }

  // 👤 Egon 21.09.2026 (W-UI107) — USER SEARCH. The window must open for a uid without touching the
  // network, sit below the navbar, expose its identity helpers, and close again cleanly.
  async function checkUserSearch() {
    ["dragonUserSearchOpen", "dragonUserSearchClose", "dragonUserSearchIsOpen", "dragonUserTag", "dragonUserLabel"].forEach(function (k) {
      if (typeof window[k] !== "function") fail("window." + k + "() is missing");
    });
    if (window.dragonUserSearchIsOpen()) fail("the user-search window is already open before the test");
    var uid = "5127aae3c0f4ea4e0e5cd1a3c0cf39d55127aae3c0f4ea4e0e5cd1a3c0cf39d5";
    var tag = window.dragonUserTag(uid);
    if (!/^[0-9A-Za-z]{4}$/.test(String(tag))) fail("dragonUserTag() must return a 4-char base36 tag, got \"" + tag + "\"");
    if (window.dragonUserTag(uid) !== tag) fail("dragonUserTag() is not stable for the same uid");
    if (window.dragonUserLabel(uid) !== uid) fail("dragonUserLabel() must show a full 64-hex uid as itself");
    window.dragonUserSearchOpen(uid, { _fast: true, source: null });
    var win = await waitFor(function () {
      if (!window.dragonUserSearchIsOpen()) return null;
      var all = qa("body > div, body > section").filter(function (n) {
        return isVisible(n) && getComputedStyle(n).position === "fixed" && n.textContent.indexOf("images by this user") !== -1;
      });
      return all.length ? all[0] : null;
    }, TIMEOUT, 150);
    if (!win) fail("opening the user search did not put a visible fixed window with the \"images by this user\" heading on screen");
    // 🗂️ Egon 22.09.2026 — "a window opens under the lightbox": the window must be the TOP layer, so
    // it can never open behind a lightbox or an overlay again, and the legacy "▶ Scan" label must be gone.
    var wz = Number(getComputedStyle(win).zIndex) || 0;
    if (wz < 2147483600) fail("the user window is not the top layer (z-index " + wz + " — it can end up behind the lightbox)");
    var ubar = win.querySelector(".dragon-user-bar");
    if (ubar && ubar.textContent.indexOf("\u25B6 Scan") !== -1) fail("the legacy \"\u25B6 Scan\" label is back in the user-search bar");
    var scrim = win.firstElementChild;
    if (!scrim || getComputedStyle(scrim).position !== "absolute") fail("the user window has no dim backdrop layer");
    if (win.textContent.indexOf(uid) === -1) fail("the user window does not show the uid it was opened for");
    // 🚫 Egon 20.09.2026 — ONLY ONE WINDOW ON SCREEN: the image viewer steps aside for the search window,
    // and its long-walk confirmation must be drawn ON TOP of the search window (it used to sit behind it,
    // reading as a leftover text box under the window).
    var lbLeft = qa(".dragon-lightbox-root").filter(isVisible).length;
    if (lbLeft) fail("the image viewer is still on screen behind the user-search window (" + lbLeft + " lightbox roots)");
    if (typeof window.dragonVaultConfirm === "function") {
      var back = null;
      try {
        var pr = window.dragonVaultConfirm({ title: "layer probe", body: "layer probe", confirmText: "ok", cancelText: "cancel", z: 2147483652 });
        var dov = await waitFor(function () { return q(".dg-ov"); }, TIMEOUT, 120);
        if (!dov) fail("dragonVaultConfirm() showed no dialog to layer-check");
        var dz = Number(getComputedStyle(dov).zIndex) || 0;
        if (dz <= 2147483646) fail("dragonVaultConfirm({z}) ignored its layer: the dialog's z-index is " + dz + " (must be above the user window at 2147483646)");
        back = "dialog layer " + dz;
        var cc = qa(".dg-ov button").filter(function (b) { return /cancel/i.test(b.textContent || ""); })[0];
        if (cc) cc.click();
        try { if (pr && pr.then) pr.then(function () {}, function () {}); } catch (e) {}
        await waitFor(function () { return q(".dg-ov") ? null : true; }, TIMEOUT, 120);
      } catch (e) {}
      if (!back) fail("the confirmation dialog could not be layer-checked");
    }
    var wr = win.getBoundingClientRect();
    if (wr.width < 180 || wr.height < 80) fail("the user window is too small (" + Math.round(wr.width) + "x" + Math.round(wr.height) + ")");
    if (wr.left < -2 || wr.right > (window.innerWidth || 0) + 2) fail("the user window overflows the viewport horizontally");
    window.dragonUserSearchClose();
    await sleep(160);
    if (window.dragonUserSearchIsOpen()) fail("dragonUserSearchClose() left the window open");
    return "window opens for a uid (tag \"" + tag + "\", " + Math.round(wr.width) + "x" + Math.round(wr.height) + " at top " + Math.round(wr.top) + ") and closes cleanly";
  }

  // 🪟 Egon 21.09.2026 (W-UI110) — TAB STRIP. Enabling tabs must add the strip as the gallery panel's FIRST
  // child (right between the navbar and the toolbar rows) and disabling must remove it again.
  async function checkTabsStrip() {
    var T = window.dragonTabs;
    if (!T || typeof T.setOn !== "function" || typeof T.list !== "function" || typeof T.open !== "function") fail("window.dragonTabs {setOn, list, open} is missing");
    var btn = document.getElementById("dragonTabsToolBtn");
    if (!btn) fail("#dragonTabsToolBtn is missing from the gallery toolbox");
    if (!btn.title || !/tab/i.test(btn.title)) fail("the tabs button has no explaining tooltip");
    var prevOn = null;
    try { prevOn = localStorage.getItem("dragonTabsOn"); } catch (e) {}
    // The check must own a VISIBLE gallery panel (an earlier check may have navigated away); the panel is
    // the plugin's own, so it is reached through dragonGoPage — never by building a second overlay.
    if (typeof window.dragonGoPage === "function") { try { window.dragonGoPage("gallery"); } catch (e) {} }
    var panel = await waitFor(function () {
      var all = qa(".dragon-gal-panel");
      for (var i = 0; i < all.length; i++) if (isVisible(all[i])) return all[i];
      return null;
    }, TIMEOUT * 3, 200);
    if (!panel) fail("no visible .dragon-gal-panel to attach the strip to");
    var made = false;
    try {
      T.setOn(true);
      made = true;
      var strip = await waitFor(function () { return panel.querySelector("#dragonTabStrip") || null; }, TIMEOUT, 150);
      if (!strip) fail("enabling tabs did not create #dragonTabStrip inside the gallery panel");
      if (panel.firstElementChild !== strip) fail("the tab strip must be the panel's FIRST child (under the navbar, above the toolbar)");
      if (!isVisible(strip)) fail("the tab strip is not visible (" + Math.round(strip.getBoundingClientRect().width) + "x" + Math.round(strip.getBoundingClientRect().height) + ", panel visible=" + isVisible(panel) + ")");
      var sr = strip.getBoundingClientRect();
      var bar = panel.querySelector(".dragon-gal-row1") || panel.firstElementChild.nextElementSibling;
      var br = bar ? bar.getBoundingClientRect() : null;
      if (br && sr.bottom > br.top + TOL) fail("the tab strip overlaps the toolbar rows (strip bottom " + Math.round(sr.bottom) + " > bar top " + Math.round(br.top) + ")");
      if (T.list().length < 1) fail("the tab strip carries no active gallery tab");
      T.setOn(false);
      made = false;
      var gone = await waitFor(function () { return panel.querySelector("#dragonTabStrip") ? null : true; }, TIMEOUT, 150);
      if (!gone) fail("disabling tabs left the strip on screen");
    } finally {
      if (made) { try { T.setOn(false); } catch (e) {} }
      try { if (prevOn == null) localStorage.removeItem("dragonTabsOn"); else localStorage.setItem("dragonTabsOn", prevOn); } catch (e) {}
    }
    return "strip is the panel's first child (visible, above the toolbar) with " + "its own tabs, and disappears when the mode is off";
  }

  // 🖐 Egon 21.09.2026 (W-UI111) — MOVABLE MINI BUTTONS. The toggle exists, arrange mode marks BOTH rows
  // draggable and shows the guide bar, and turning it off leaves no trace and restores the layout.
  async function checkMiniArrange() {
    var M = window.dragonMini;
    if (!M || typeof M.set !== "function" || typeof M.list !== "function" || typeof M.rows !== "function") fail("window.dragonMini {set, list, rows} is missing");
    // 🖐 W-UI116 — the W-UI116 assertions below measure real geometry, so the Control Panel must be on screen
    // first (its row is part of the ✨ Generate page).
    if (window.dragonGoPage) { try { window.dragonGoPage("generate"); } catch (e) {} }
    var ctlBody = document.querySelector(".dragon-control-body");
    var ctlHead = document.querySelector(".dragon-control-panel > button");
    var openedCtl = false;
    if (ctlBody && ctlBody.style.display === "none" && ctlHead) { try { ctlHead.click(); openedCtl = true; } catch (e) {} }
    await waitFor(function () { var R0 = M.rows(); return (R0.row && R0.row.getBoundingClientRect().width > 4) ? R0.row : null; }, TIMEOUT * 3, 200);
    var btn = document.getElementById("dragonMiniArrangeBtn");
    if (!btn) fail("#dragonMiniArrangeBtn is missing from the control panel");
    if (!btn.title || btn.title.length < 10) fail("the 🖐 button has no tooltip");
    var before = M.list();
    if (!before.row.length || !before.col.length) fail("the mini-button rows are empty (" + before.row.length + " / " + before.col.length + ")");
    var wasOn = M.mode();
    try {
      M.set(true);
      var bar = await waitFor(function () { return document.getElementById("dragonMiniBar") || null; }, TIMEOUT, 150);
      if (!bar) fail("arrange mode did not show the guide bar (#dragonMiniBar)");
      var R = M.rows();
      var draggable = 0, outlined = 0, total = 0;
      [R.row, R.col].forEach(function (row) {
        if (!row) return;
        qa("button", row).forEach(function (b) {
          // W-UI116 — the ↺ return-to-default button is deliberately NOT movable (data-dm-locked), so it is
          // never draggable and never outlined; it must not be counted against the movable set.
          if (b.hasAttribute("data-dm-locked")) return;
          total++;
          if (b.draggable) draggable++;
          if (getComputedStyle(b).outlineStyle !== "none" && getComputedStyle(b).outlineWidth !== "0px") outlined++;
        });
      });
      if (total < 4) fail("arrange mode found almost no buttons to move (" + total + ")");
      if (draggable < total) fail("only " + draggable + " of " + total + " mini buttons became draggable");
      if (!outlined) fail("arrange mode did not visibly mark the buttons");
      // 🖐 W-UI116 (Egon 24.09.2026) — the iOS feel: (a) the pulse, (b) the neighbours make room, (c) the
      // magnet caret, (d) the soft landing. Exercised on TWO THROWAWAY buttons so the visitor's own
      // arrangement is never touched; the layout snapshot is restored byte-exact afterwards.
      var pulse = 0;
      [R.row, R.col].forEach(function (row) {
        if (!row) return;
        qa("button", row).forEach(function (b) { if (getComputedStyle(b).animationName === "dragonMiniJiggle") pulse++; });
      });
      if (!pulse) fail("arrange mode gave no button the W-UI116 pulse (no dragonMiniJiggle animation running)");
      var caret = document.getElementById("dragonMiniCaret");
      if (!caret) fail("the W-UI116 magnet caret element is missing");
      var layoutSnap = null;
      try { layoutSnap = localStorage.getItem("dragonMiniBtnLayout"); } catch (e) {}
      var t1 = document.createElement("button"); t1.type = "button"; t1.className = "dragon-desc-mini"; t1.textContent = "wltmp1"; t1.dataset.d = "wltmp1";
      var t2 = document.createElement("button"); t2.type = "button"; t2.className = "dragon-desc-mini"; t2.textContent = "wltmp2"; t2.dataset.d = "wltmp2";
      R.row.append(t1, t2);
      [t1, t2].forEach(function (b) { try { b.draggable = true; b.dataset.dmkey = "d:" + b.dataset.d; } catch (e) {} });
      try {
        var dt = null;
        try { dt = new DataTransfer(); } catch (e) {}
        var fire = function (el, type, x, y) {
          var ev;
          try { ev = new DragEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, dataTransfer: dt }); }
          catch (e) { ev = new Event(type, { bubbles: true, cancelable: true }); }
          try { el.dispatchEvent(ev); } catch (e) {}
        };
        var r2 = t2.getBoundingClientRect();
        if (r2.width < 4) fail("the throwaway arrange buttons have no measurable size");
        var tx = r2.left + r2.width - 2, ty = r2.top + r2.height / 2;
        fire(t1, "dragstart", r2.left, r2.top);
        if (!t1.classList.contains("dragon-mini-drag")) fail("the W-UI116 held-button state (dragon-mini-drag) was not applied on dragstart");
        fire(t2, "dragover", tx, ty);
        await sleep(50);
        if (getComputedStyle(caret).display === "none") fail("the W-UI116 magnet caret never appeared while dragging over a slot");
        if (!/dragon-mini-mk-/.test(String(t2.className))) fail("the W-UI116 make-room class was not applied to the neighbour (" + t2.className + ")");
        var cr = caret.getBoundingClientRect();
        if (cr.width < 1 || cr.height < 1) fail("the W-UI116 caret has no visible size");
        fire(t2, "drop", tx, ty);
        await sleep(40);
        if (!t1.classList.contains("dragon-mini-settle")) fail("the W-UI116 soft landing (dragon-mini-settle) was not applied on drop");
        var i1 = [].indexOf.call(R.row.children, t1), i2 = [].indexOf.call(R.row.children, t2);
        if (!(i1 > i2)) fail("the drop did not re-order the button (dropped at " + i1 + ", neighbour at " + i2 + ")");
        fire(t1, "dragend", r2.left, r2.top);
        await sleep(30);
        if (getComputedStyle(caret).display !== "none") fail("the W-UI116 caret stayed on screen after the drop");
        if (/dragon-mini-mk-/.test(String(t2.className))) fail("the W-UI116 make-room margin was not cleared after the drop");
      } finally {
        try { t1.remove(); } catch (e) {}
        try { t2.remove(); } catch (e) {}
        try {
          // The throwaway drop calls the real save-from-DOM path, which sets the in-memory "a saved
          // arrangement exists" flag; restoring the snapshot must put that flag back too, or a visitor who
          // has NEVER arranged anything is left reported as arranged (the mini-arrange assertion below).
          if (layoutSnap === null) { localStorage.removeItem("dragonMiniBtnLayout"); window.__dragonMiniLayoutActive = false; }
          else { localStorage.setItem("dragonMiniBtnLayout", layoutSnap); window.__dragonMiniLayoutActive = true; if (M.apply) M.apply(); }
        } catch (e) {}
      }
      // 🖐 W-UI116 (Egon 24.09.2026 — second round: "a button I pick up and move once can no longer be
      // picked up and moved again", and a moved button must STAY where it was dropped). Exercised on the
      // REAL 💡 Tips button — the one the control-panel rebuild pass used to yank straight back home — which
      // is carried into the TOP strip and then, with the SAME grip, into the description column. The
      // visitor's own arrangement is snapshotted first and put back byte-exact afterwards.
      var tipsB = null;
      try { [R.row, R.col, R.top, R.left].forEach(function (z) { if (!tipsB && z) tipsB = z.querySelector('[data-d="tips"]'); }); } catch (e0) {}
      if (!tipsB) fail("the \uD83D\uDCA1 Tips button was not found in any of the four mini-button zones");
      else {
        var homeParent = tipsB.parentNode, homeIdx = [].indexOf.call(homeParent.children, tipsB);
        var snapL2 = null;
        try { snapL2 = localStorage.getItem("dragonMiniBtnLayout"); } catch (e1) {}
        var dz2 = null;
        try { dz2 = new DataTransfer(); } catch (e2) {}
        var fire2 = function (el2, type2, x2, y2) {
          var ev2;
          try { ev2 = new DragEvent(type2, { bubbles: true, cancelable: true, clientX: x2, clientY: y2, dataTransfer: dz2 }); }
          catch (e) { ev2 = new Event(type2, { bubbles: true, cancelable: true }); }
          try { el2.dispatchEvent(ev2); } catch (e) {}
        };
        var ctr2 = function (el2) { var r2 = el2.getBoundingClientRect(); return [r2.left + r2.width / 2, r2.top + r2.height / 2]; };
        var carryTo = async function (zone) {
          var p2 = ctr2(tipsB);
          fire2(tipsB, "dragstart", p2[0], p2[1]);
          var c2 = ctr2(zone);
          fire2(zone, "dragover", c2[0], c2[1]);
          await sleep(60);
          fire2(zone, "drop", c2[0], c2[1]);
          await sleep(220);
          fire2(tipsB, "dragend", c2[0], c2[1]);
        };
        try {
          var Z1 = M.rows();
          if (!Z1.top) fail("the TOP drop strip is missing");
          else {
            await carryTo(Z1.top);
            var stay1 = await waitFor(function () { return tipsB.parentNode === M.rows().top ? true : null; }, 1200, 150);
            if (!stay1) fail("a button carried into the TOP strip did not stay there (the panel rebuild put it back)");
            var Z2 = M.rows();
            if (!Z2.col) fail("the description button column is missing");
            else {
              await carryTo(Z2.col);
              var stay2 = await waitFor(function () { return tipsB.parentNode === M.rows().col ? true : null; }, 1200, 150);
              if (!stay2) fail("a button that had ALREADY been moved could not be moved a second time (it snapped back to the control-panel row)");
              if (!tipsB.draggable) fail("the moved button lost its draggable grip");
            }
          }
        } finally {
          try { homeParent.insertBefore(tipsB, homeParent.children[homeIdx] || null); } catch (e3) {}
          try {
            if (snapL2 === null) { localStorage.removeItem("dragonMiniBtnLayout"); window.__dragonMiniLayoutActive = false; }
            else { localStorage.setItem("dragonMiniBtnLayout", snapL2); window.__dragonMiniLayoutActive = true; if (M.apply) M.apply(); }
          } catch (e4) {}
        }
      }
      M.set(false);
      var gone = await waitFor(function () { return document.getElementById("dragonMiniBar") ? null : true; }, TIMEOUT, 150);
      if (!gone) fail("turning arrange mode off left the guide bar on screen");
      var stillDrag = 0;
      [R.row, R.col].forEach(function (row) { if (row) qa("button", row).forEach(function (b) { if (b.draggable) stillDrag++; }); });
      if (stillDrag) fail(stillDrag + " mini button(s) stayed draggable after arrange mode was turned off");
      var after = M.list();
      // Egon 22.09.2026 — `active` means "the visitor has a SAVED arrangement", which legitimately stays
      // true across arrange mode. Only require it to be false when nothing has ever been arranged.
      var savedLayout = null;
      try { savedLayout = localStorage.getItem("dragonMiniBtnLayout"); } catch (e) {}
      if (after.active && !savedLayout) fail("the mini-button layout is reported active without a saved arrangement");
    } finally {
      if (wasOn) { try { M.set(true); } catch (e) {} } else { try { M.set(false); } catch (e) {} }
      if (openedCtl && ctlHead && ctlBody && ctlBody.style.display !== "none") { try { ctlHead.click(); } catch (e) {} }
    }
    return before.row.length + " control-panel + " + before.col.length + " description buttons are movable: guide bar shown, all " + (before.row.length + before.col.length) + " buttons draggable and marked, the W-UI116 pulse runs, the magnet caret + make-room margin appear while dragging and clear on drop, the dropped button lands where the caret promised and settles with the soft landing, mode off cleans up";
  }

  // 🖼️📐 Egon 21.09.2026 (W-LOC109) — JUSTIFIED + STRETCH display modes. Justified must pack equal-height
  // full-width rows with no horizontal crop, and leaving it must restore the normal grid columns.
  async function checkGalJustified() {
    if (typeof window.dragonGoPage === "function") { try { window.dragonGoPage("gallery"); } catch (e) {} }
    var panel = await waitFor(function () {
      var all = qa(".dragon-gal-panel");
      for (var i = 0; i < all.length; i++) if (isVisible(all[i])) return all[i];
      return null;
    }, TIMEOUT * 3, 200);
    if (!panel) fail("no visible gallery panel");
    var grid = await waitFor(function () {
      var gs = qa(".dragon-gal-grid").filter(isVisible);
      for (var i = 0; i < gs.length; i++) if (qa(".dragon-gal-tile", gs[i]).length) return gs[i];
      return null;
    }, TIMEOUT * 3, 200);
    if (!grid) fail("no visible .dragon-gal-grid with tiles");
    var jb = q('button[data-disp="justified"]', panel), sb = q('button[data-disp="stretch"]', panel);
    if (!jb) fail("the display menu has no \"justified\" row");
    if (!sb) fail("the display menu has no \"stretch\" row");
    if (!jb.textContent || jb.textContent.indexOf("Justified") === -1) fail("the justified row is not labelled \"Justified\": " + jb.textContent);
    var prev = null;
    try { prev = localStorage.getItem("dragonGalDisplay"); } catch (e) {}
    var rows = [], maxErr = 0, minH = 1e9, maxH = 0, distort = 0;
    var setDisp = function (v) {
      var b = q('button[data-disp="' + v + '"]', panel);
      if (b) b.click();
    };
    try {
      await waitFor(function () { return q(".dragon-gal-tile", grid) || null; }, TIMEOUT, 150);
      setDisp("justified");
      await sleep(700);
      if (getComputedStyle(grid).display !== "flex") fail("justified mode did not switch the grid to flex (got " + getComputedStyle(grid).display + ")");
      var tiles = qa(".dragon-gal-tile", grid).filter(isVisible);
      if (tiles.length < 3) fail("justified mode has almost no tiles (" + tiles.length + ")");
      var gr = grid.getBoundingClientRect(), byRow = {};
      var gcs = getComputedStyle(grid);
      var padL = parseFloat(gcs.paddingLeft) || 0, padR = parseFloat(gcs.paddingRight) || 0;
      var contentL = gr.left + (parseFloat(gcs.borderLeftWidth) || 0) + padL;
      var contentW = gr.width - (parseFloat(gcs.borderLeftWidth) || 0) - (parseFloat(gcs.borderRightWidth) || 0) - padL - padR;
      tiles.forEach(function (t) {
        var r = t.getBoundingClientRect();
        var k = Math.round(r.top);
        // A justified row spans edge to edge, so its width is measured from the first tile's LEFT edge to
        // the last tile's RIGHT edge (adding raw widths would wrongly count the flex `gap` as a shortfall).
        if (!byRow[k]) byRow[k] = { left: r.left, right: r.right, h: r.height, lo: r.height, hi: r.height, n: 0, first: t };
        byRow[k].left = Math.min(byRow[k].left, r.left);
        byRow[k].right = Math.max(byRow[k].right, r.right);
        byRow[k].h = Math.max(byRow[k].h, r.height);
        byRow[k].lo = Math.min(byRow[k].lo, r.height);
        byRow[k].hi = Math.max(byRow[k].hi, r.height);
        byRow[k].n++;
        var im = t.querySelector("img");
        if (im && im.naturalWidth) distort = Math.max(distort, Math.abs(r.width / r.height - im.naturalWidth / im.naturalHeight));
      });
      var ks = Object.keys(byRow).map(Number).sort(function (a, b) { return a - b; });
      ks.forEach(function (k, i) {
        var row = byRow[k];
        row.w = row.right - row.left;
        // the last row is allowed to be short (it is the unfinished one) — every full row must be flush
        if (i < ks.length - 1) {
          maxErr = Math.max(maxErr, Math.abs(row.w - contentW), Math.abs(row.left - contentL));
        }
        minH = Math.min(minH, row.h); maxH = Math.max(maxH, row.h);
        rows.push(row);
      });
      if (rows.length < 2) fail("justified mode produced fewer than 2 rows");
      if (maxErr > 2.5) fail("a justified row does not span the grid width (gap " + maxErr.toFixed(1) + "px)");
      // Across rows a justified wall is NOT uniformly tall: a row's height is whatever makes it land exactly
      // on the grid width, so a row of portraits is legitimately taller than a row of panoramas (measured
      // spread up to ~34% on a narrow window — that is the layout working, not failing). What IS asserted:
      // every tile inside one row shares one height, and the rows stay in a sane band around the wanted one.
      var inRowSpread = 0;
      rows.forEach(function (row) { inRowSpread = Math.max(inRowSpread, row.hi - row.lo); });
      if (inRowSpread > 1.5) fail("tiles inside one justified row do not share a height (spread " + inRowSpread.toFixed(1) + "px)");
      // 📱 The band has to breathe on a NARROW grid (phone): there the wanted row height can be close to
      // the whole grid width, so a row of two portraits is legitimately much taller than a row of two
      // panoramas and the spread grows — that is geometry, not a regression. Wide grids keep the strict 45%.
      var wantH = 340;
      try { if (window.dragonTileHybrid && window.dragonTileHybrid.get) wantH = Number(window.dragonTileHybrid.get()) || 340; } catch (e) {}
      var bandTol = (contentW < wantH * 1.6) ? 0.8 : 0.45;
      if (maxH - minH > Math.max(40, maxH * bandTol)) fail("justified rows vary too much in height (" + Math.round(minH) + ".." + Math.round(maxH) + "px)");
      if (distort > 0.09) fail("a justified tile is distorted (ratio error " + distort.toFixed(3) + ")");
      // stretch = object-fit:fill
      setDisp("stretch");
      await sleep(400);
      var im0 = q(".dragon-gal-tile img", grid);
      if (!im0 || getComputedStyle(im0).objectFit !== "fill") fail("stretch mode did not apply object-fit:fill");
      // leaving justified must put the real grid columns back
      setDisp("cover");
      await sleep(500);
      var cols = getComputedStyle(grid).gridTemplateColumns;
      if (cols === "none") fail("leaving justified left grid-template-columns:none (the grid falls back to one huge column)");
      if (getComputedStyle(grid).display !== "grid") fail("leaving justified did not restore the grid display");
      var leftover = 0;
      qa(".dragon-gal-tile", grid).forEach(function (t) { if (t.style.flexGrow || t.style.flexBasis || t.style.height) leftover++; });
      if (leftover) fail("leaving justified left " + leftover + " tile(s) with inline flex/height geometry");
    } finally {
      try { if (prev == null) localStorage.removeItem("dragonGalDisplay"); else localStorage.setItem("dragonGalDisplay", prev); } catch (e) {}
      setDisp(prev && prev !== "justified" && prev !== "stretch" ? prev : "cover");
      await sleep(250);
    }
    return "justified: " + rows.length + " rows, " + Math.round(minH) + "–" + Math.round(maxH) + "px tall (tiles in one row vary by ≤" + inRowSpread.toFixed(1) + "px), max row-width error " + maxErr.toFixed(1) + "px, max ratio error " + distort.toFixed(3) + "; stretch = object-fit:fill; leaving restores the grid columns";
  }

  // 🧩 Egon 23.09.2026 — THE FOUR WALL MODES (Pinterest · Puzzle · Mosaic · Mixed).
  // WHY ONE TEST FOR FOUR MODES: they are ONE engine (src/dragon-layouts.js) and one applier per gallery,
  // so what must be proven is exactly what the engine promises — no two pictures overlap, the rows that
  // are meant to close exactly really do, and the reading order a mode advertises is the order ON SCREEN
  // (Pinterest left→right, Puzzle right→left). The private gallery is included because its tiles carry
  // their geometry with `!important` (and a dedupe collapse that must survive), which is a different
  // failure surface from the public grid.
  async function checkTileWalls() {
    var wall = window.dragonDisplayWallModes;
    if (!wall || wall.length !== 4) fail("window.dragonDisplayWallModes is missing (the four wall modes)");
    if (typeof window.dragonDisplayIsWall !== "function") fail("window.dragonDisplayIsWall is missing");
    var L = window.dragonLayouts;
    if (!L || typeof L.rows !== "function" || typeof L.pinterest !== "function" || typeof L.mixed !== "function") fail("the shared layout engine (src/dragon-layouts.js) did not load");
    if (typeof window.dragonGoPage === "function") { try { window.dragonGoPage("gallery"); } catch (e) {} }
    var panel = await waitFor(function () { var p = qa(".dragon-gal-panel").filter(isVisible); return p.length ? p[0] : null; }, TIMEOUT * 3, 200);
    if (!panel) fail("no visible gallery panel");
    var grid = await waitFor(function () {
      var gs = qa(".dragon-gal-grid").filter(isVisible);
      for (var i = 0; i < gs.length; i++) if (qa(".dragon-gal-tile", gs[i]).length) return gs[i];
      return null;
    }, TIMEOUT * 3, 200);
    if (!grid) fail("no visible .dragon-gal-grid with tiles");
    ;function pick(host, m) { var b = q("button[data-disp='" + m + "']", host); if (!b) return false; b.click(); return true; }
    ;function snap() {
      var gb = grid.getBoundingClientRect(), all = qa(".dragon-gal-tile", grid), R = [];
      for (var i = 0; i < all.length; i++) {
        var r = all[i].getBoundingClientRect();
        if (!(r.width > 1)) continue;
        R.push({ i: i, x: r.left - gb.left, y: r.top - gb.top, w: r.width, h: r.height, pos: getComputedStyle(all[i]).position, left: all[i].style.left, top: all[i].style.top });
      }
      return R;
    }
    ;function pairsOverlap(R, tol) {
      var n = 0, t = tol || 2;
      for (var a = 0; a < R.length; a++) for (var b = a + 1; b < R.length; b++) {
        var ox = Math.min(R[a].x + R[a].w, R[b].x + R[b].w) - Math.max(R[a].x, R[b].x);
        var oy = Math.min(R[a].y + R[a].h, R[b].y + R[b].h) - Math.max(R[a].y, R[b].y);
        if (ox > t && oy > t) n++;
      }
      return n;
    }
    ;function rowsOf(R) {
      var by = {};
      R.forEach(function (r) { var k = Math.round(r.y); (by[k] = by[k] || []).push(r); });
      return Object.keys(by).map(Number).sort(function (a, b) { return a - b; }).map(function (k) { return by[k]; });
    }
    var prev = null; try { prev = localStorage.getItem("dragonGalDisplay"); } catch (e) {}
    var notes = [];
    try {
      for (var w = 0; w < wall.length; w++) {
        var mode = wall[w];
        if (!pick(panel, mode)) fail("the public display menu has no \"" + mode + "\" row");
        await sleep(950);
        var R = snap();
        if (R.length < 10) fail(mode + ": only " + R.length + " sized tiles to measure");
        if (getComputedStyle(grid).display !== "block") fail(mode + ": a wall mode must make the grid a block positioning context (got " + getComputedStyle(grid).display + ")");
        var unplaced = R.filter(function (r) { return r.pos !== "absolute" || !r.left || !r.top; });
        if (unplaced.length) fail(mode + ": " + unplaced.length + " tile(s) were not placed by the packer");
        var ov = pairsOverlap(R, 2);
        if (ov) fail(mode + ": " + ov + " overlapping tile pair(s)");
        var W = grid.clientWidth, rows = rowsOf(R);
        if (mode === "pinterest") {
          var heads = R.filter(function (r) { return r.y < 3; }).sort(function (a, b) { return a.x - b.x; });
          if (heads.length < 2) fail("pinterest: fewer than 2 column heads on the first line");
          for (var h = 1; h < heads.length; h++) if (!(heads[h].i > heads[h - 1].i)) fail("pinterest: the first line is not left-to-right picture order (" + heads.map(function (x) { return x.i; }).join(",") + ")");
          var cols = {}, colGaps = 0;
          R.forEach(function (r) { var k = Math.round(r.x); (cols[k] = cols[k] || []).push(r); });
          Object.keys(cols).forEach(function (k) {
            var c = cols[k].sort(function (a, b) { return a.y - b.y; });
            for (var z = 1; z < c.length; z++) if (c[z].y + 1 < c[z - 1].y + c[z - 1].h) colGaps++;
          });
          if (colGaps) fail("pinterest: " + colGaps + " tile(s) inside a column overlap the one above");
          notes.push("pinterest: " + Object.keys(cols).length + " columns, " + R.length + " tiles, first line #" + heads.map(function (x) { return x.i; }).join("→#"));
          continue;
        }
        if (mode === "puzzle") {
          var top0 = R.filter(function (r) { return r.y < 3; });
          var rightMost = null;
          top0.forEach(function (r) { if (!rightMost || (r.x + r.w) > (rightMost.x + rightMost.w)) rightMost = r; });
          if (!rightMost || rightMost.i !== 0) fail("puzzle: the first row must start at the RIGHT edge (its rightmost picture is #" + (rightMost ? rightMost.i : "?") + ", not #0)");
        }
        if (mode === "mixed") {
          var xs = R.map(function (r) { return Math.round(r.x); }).sort(function (a, b) { return a - b; });
          var step = Infinity;
          for (var s = 1; s < xs.length; s++) if (xs[s] > xs[s - 1]) step = Math.min(step, xs[s] - xs[s - 1]);
          if (!isFinite(step) || step < 10) fail("mixed: the cell grid could not be read");
          var colsN = Math.round(W / step), occ = {};
          R.forEach(function (r) {
            for (var yy = Math.round(r.y / step); yy < Math.round((r.y + r.h) / step); yy++)
              for (var xx = Math.round(r.x / step); xx < Math.round((r.x + r.w) / step); xx++) occ[xx + ":" + yy] = 1;
          });
          // 🧩 A hole = a FREE cell that sits BEFORE the LAST block the filler placed (row-major order).
          // The packer is row-major first-fit, so it never walks past a free cell: a short/ragged TAIL is
          // geometry (the picture supply ran out — exactly like the other modes' remainder row) and must
          // NOT count; but a free cell the filler actually passed is a real hole and must fail. The old
          // check guessed the row count from the wall's PIXEL height, which at some widths reached one row
          // past the last complete one and failed on a perfectly correct wall (measured at 1224px: the
          // "hole" sat in the ragged tail, after the last placed block).
          var frontier = -1;
          R.forEach(function (r) {
            var idx = Math.round(r.y / step) * colsN + Math.round(r.x / step);
            if (idx > frontier) frontier = idx;
          });
          var holes = 0;
          for (var f = 0; f < frontier; f++) if (!occ[(f % colsN) + ":" + Math.floor(f / colsN)]) holes++;
          if (holes) fail("mixed: " + holes + " empty cell(s) inside the wall (the filler must leave none)");
          var shapes = {};
          R.forEach(function (r) { shapes[Math.round(r.w / step) + "x" + Math.round(r.h / step)] = 1; });
          if (Object.keys(shapes).length < 2) fail("mixed: the wall collapsed into a plain grid (one block shape only)");
          notes.push("mixed: " + Math.round(step) + "px cells, " + colsN + " columns, blocks " + Object.keys(shapes).join("/") + ", no holes");
          continue;
        }
        // puzzle / mosaic / spotlight — equal-height rows that must close exactly.
        // 🧩 Egon 23.09.2026 — the LAST row is deliberately NOT full: the packer
        // (src/dragon-layouts.js rows()) runs out of pictures, and a lone portrait is
        // announced at the wanted height instead of being blown up to a billboard, so
        // the tail is a short remainder — exactly like every justified gallery. It is
        // skipped (its shortfall is reported, not failed); every COMPLETE row must
        // still close to the pixel.
        var full = 0, worst = 0, minH = 1e9, maxH = 0, tailShort = 0;
        rows.forEach(function (row, ri) {
          var hi = Math.max.apply(null, row.map(function (r) { return r.h; })), lo = Math.min.apply(null, row.map(function (r) { return r.h; }));
          if (hi - lo > 1.5) return;                       // a row still being filled (or deliberately capped)
          var sum = 6 * (row.length - 1);
          row.forEach(function (r) { sum += r.w; });
          if (ri === rows.length - 1) { tailShort = Math.max(0, W - sum); return; }   // the remainder row
          full++;
          worst = Math.max(worst, Math.abs(sum - W));
          if (hi < minH) minH = hi;
          if (hi > maxH) maxH = hi;
        });
        if (full < 3) fail(mode + ": fewer than 3 complete rows to measure");
        if (worst > 2) fail(mode + ": a row does not close exactly (" + Math.round(worst) + "px off)");
        notes.push(mode + ": " + full + " exact rows (" + Math.round(minH) + "–" + Math.round(maxH) + "px), max fill error " + Math.round(worst) + "px, 0 overlaps" + (tailShort > 2 ? ", tail " + Math.round(tailShort) + "px short (remainder, ok)" : ""));
      }
    } finally {
      try { if (prev == null) localStorage.removeItem("dragonGalDisplay"); else localStorage.setItem("dragonGalDisplay", prev); } catch (e) {}
      pick(panel, window.dragonDisplayIsMode(prev) ? prev : window.dragonDisplayDefault);
      await sleep(300);
    }
    // --- the private gallery: same engine, different DOM (!important geometry + the dedupe collapse) ---
    var vBefore = null; try { vBefore = localStorage.getItem("dragonVaultDisplay"); } catch (e) {}
    try {
      window.dragonGoPage("likes");
      var vroot = await waitFor(function () { return document.getElementById("localMediaGallery_root"); }, TIMEOUT * 3, 200);
      if (!vroot) fail("the private gallery did not open for the wall-mode test");
      var vtiles = await waitFor(function () { var t = qa("[data-local-media-gallery-item]", vroot); return t.length > 5 ? t : null; }, TIMEOUT * 3, 250);
      if (!vtiles) fail("the private gallery has no tiles to measure");
      var vgrid = vroot.querySelector(".dragon-vault-grid");
      if (!vgrid) fail("the private gallery grid is missing");
      if (!pick(vroot, "puzzle")) fail("the private display menu has no \"puzzle\" row");
      // 🧩 Egon 23.09.2026 — the vault loads incrementally and re-packs on its own rAF-throttled observer
      // (dragonVaultRepack), so a flat sleep can catch a freshly-painted batch a frame before it is packed
      // (measured in a full 1920px run: "19 tile(s) are not absolutely placed" that the next frame placed).
      // Give the app's own schedule a bounded chance to settle, then measure — a tile that is STILL
      // unplaced after that is a real failure.
      await waitFor(function () {
        var painted = 0, unplaced = 0;
        qa("[data-local-media-gallery-item]", vgrid).forEach(function (t) {
          if (t.classList.contains("dragon-dupe-hidden")) return;
          var r = t.getBoundingClientRect();
          if (!(r.width > 1)) return;
          painted++;
          if (getComputedStyle(t).position !== "absolute" || !t.style.left) unplaced++;
        });
        return (painted >= 5 && unplaced === 0) ? 1 : 0;
      }, TIMEOUT * 2, 200);
      var VR = [], vgb = vgrid.getBoundingClientRect(), vbad = 0;
      qa("[data-local-media-gallery-item]", vgrid).forEach(function (t) {
        var r = t.getBoundingClientRect();
        if (!(r.width > 1)) return;
        if (getComputedStyle(t).position !== "absolute" || !t.style.left) { vbad++; return; }
        VR.push({ x: r.left - vgb.left, y: r.top - vgb.top, w: r.width, h: r.height });
      });
      if (vbad) fail("private puzzle: " + vbad + " tile(s) are not absolutely placed");
      if (VR.length < 5) fail("private puzzle: only " + VR.length + " sized tiles to measure");
      var vov = pairsOverlap(VR, 2);
      if (vov) fail("private puzzle: " + vov + " overlapping tile pair(s)");
      var dupes = qa("[data-local-media-gallery-item].dragon-dupe-hidden", vgrid);
      var dupeVisible = dupes.filter(function (d) { return d.getBoundingClientRect().width > 1; }).length;
      if (dupeVisible) fail("private puzzle: " + dupeVisible + " collapsed (🧬 dedupe) tile(s) are visible again");
      notes.push("private puzzle: " + VR.length + " tiles placed, 0 overlaps, " + dupes.length + " collapsed tile(s) still hidden");
      if (!pick(vroot, "cover")) fail("the private display menu has no \"cover\" row");
      await sleep(800);
      var stillAbs = 0;
      qa("[data-local-media-gallery-item]", vgrid).forEach(function (t) { if (getComputedStyle(t).position === "absolute" && t.style.left) stillAbs++; });
      if (stillAbs) fail("leaving the private wall left " + stillAbs + " tile(s) absolutely placed");
    } finally {
      try { if (vBefore == null) localStorage.removeItem("dragonVaultDisplay"); else localStorage.setItem("dragonVaultDisplay", vBefore); } catch (e) {}
      try { pick(document.getElementById("localMediaGallery_root") || document.body, window.dragonDisplayIsMode(vBefore) ? vBefore : window.dragonDisplayDefault); } catch (e) {}
      await sleep(300);
    }
    return notes.join(" · ");
  }

  // Egon 21.09.2026 — 🛡️ WEBKIT FUNCTION-SCOPE IMMUNITY (regression guard for the iPhone crash report).
  // The perchance engine carries a workaround for a WebKit bug (`withFunctionScopeFixRequired`): it
  // TEXTUALLY rewrites every `function NAME(...)  {` into `var NAME = function(...)  {` — with no
  // semicolon appended, so automatic-semicolon-insertion merges the statement that follows (an IIFE
  // becomes a call argument, and the trailing `()` then calls its return value), and hoisting is lost.
  // On every iPhone/iPad the FIRST merged site threw inside our 21,903-line script, so the whole script
  // aborted and the app never booted ("undefined is not a function" / "Promise is not a function"). Every
  // function declaration in index.html is now immunised with a leading `;`, which makes the engine's
  // rewrite match NOTHING, so WebKit executes exactly the same code as Chrome. This check fails the
  // moment a new declaration is added without that `;`. (The pattern below is the engine's own regex,
  // copied from its script-tag injector.)
  var FNSCOPE_RX = /(\n\s*|^\s*)(async |)function\s+([a-zA-Z0-9_$]+?)(\s*\(.*\)\s*\{)/;
  function checkFnScopeImmunity() {
    var scripts = [].slice.call(document.scripts).filter(function (s) {
      var t = s.textContent || "";
      if (s.src || !t) return false;
      if (/notjs|text\/x-server-plugin/.test(s.type || "")) return false;
      return !/\bPERCH\b|__perchanceInternal/.test(t);
    });
    var bad = [];
    scripts.forEach(function (s, i) {
      var lines = s.textContent.split("\n");
      for (var n = 0; n < lines.length; n++) {
        if (!FNSCOPE_RX.test("\n" + lines[n])) continue;
        if (/^\s*;/.test(lines[n])) continue;
        if (bad.length < 5) bad.push("script#" + i + " line " + (n + 1) + ": " + lines[n].trim().slice(0, 60));
      }
    });
    if (bad.length) throw new Error(bad.length + " un-immunised declaration(s) — the engine's WebKit rewrite would merge them: " + bad.join(" | "));
    return scripts.length + " inline scripts scanned: 0 declarations match the engine's WebKit rewrite pattern (each one carries its leading ';')";
  }

  // 🖼️ Egon 23.09.2026 — THE TWO DISPLAY MENUS ARE NOW ONE CONTROL (rule "the water in big glasses rule").
  // What this check guarantees now:
  //  (1) the SHARED definition exists (src/dragon-display.js) and carries exactly 7 modes, default = justified;
  //  (2) BOTH panels build their menu from that definition, so their rows are identical — same ids, same
  //      ORDER and same labels (this is exactly the part that used to drift: 6 rows in one panel, 7 in
  //      the other, different default);
  //  (3) the two ROW modes really ARE different modes, measured on the live wall: Justified packs its rows
  //      flush to the edge, Default keeps each picture's own width (the classic ragged right edge) at the
  //      same row height — a promise, verified instead of assumed;
  //  (4) the visitor's own choices come back byte-exactly.
  async function checkDisplayTwin() {
    var ids = window.dragonDisplayModeIds ? window.dragonDisplayModeIds() : null;
    if (typeof window.dragonDisplayBuild !== "function") fail("the shared display control (dragonDisplayBuild) is missing");
    if (!ids) fail("the shared display-mode table is missing");
    else if (ids.length !== 11) fail("the shared display table must hold exactly 11 modes, got " + ids.length);
    if (window.dragonDisplayDefault !== "cover") fail("Crop must be the shipped default, got \"" + window.dragonDisplayDefault + "\"");
    function keysOf(menu) { return qa("[data-disp]", menu).map(function (b) { return b.getAttribute("data-disp") + "|" + (b.textContent || "").trim(); }); }
    // --- public side ---
    window.dragonGoPage("gallery");
    var pubRow = await waitFor(function () { return document.getElementById("dragonSubRow"); }, TIMEOUT * 2, 250);
    if (!pubRow) fail("the public gallery toolbar did not open");
    var pubMenu = await waitFor(function () { return q(".dragon-gal-bar button[data-disp]") ? q(".dragon-gal-bar button[data-disp]").parentElement : null; }, TIMEOUT, 200);
    if (!pubMenu) fail("the public display menu is missing");
    var pubBtn = pubMenu.parentElement.querySelector("button[title^='Image Display Mode']") || pubMenu.parentElement.querySelector("button");
    var pubBefore = localStorage.getItem("dragonGalDisplay");
    if (pubBtn) pubBtn.click();
    await sleep(180);
    var pubRows = keysOf(pubMenu);
    try { pubMenu.style.display = "none"; } catch (e) {}
    // --- behaviour: the two row modes must differ (measured on the live public wall) ---
    var grid = q(".dragon-gal-grid");
    if (!grid) fail("the public gallery grid is missing");
    function pick(m) { var b = q("button[data-disp='" + m + "']", pubMenu); if (!b) { fail("the public display menu has no \"" + m + "\" row"); return; } b.click(); }
    function rowShape() {
      var tls = qa(".dragon-gal-tile", grid).filter(function (t) { return t.getBoundingClientRect().width > 0; });
      if (!tls.length) return null;
      var g = grid.getBoundingClientRect();
      var top = Math.min.apply(null, tls.map(function (t) { return t.getBoundingClientRect().top; }));
      var row = tls.filter(function (t) { return Math.abs(t.getBoundingClientRect().top - top) < 3; });
      var right = Math.max.apply(null, row.map(function (t) { return t.getBoundingClientRect().right - g.left; }));
      var hs = row.map(function (t) { return Math.round(t.getBoundingClientRect().height); });
      return { right: right, flush: grid.clientWidth, spread: Math.max.apply(null, hs) - Math.min.apply(null, hs) };
    }
    var flushShort = 0, raggedShort = 0, spread = 0;
    try {
      pick("justified");
      await sleep(900);
      var j = rowShape();
      if (!j) fail("no tiles to measure in Justified");
      else {
        flushShort = j.flush - j.right;
        if (flushShort > 3) fail("Justified must fill every row edge to edge (first row stops " + Math.round(flushShort) + "px short)");
        if (j.spread > 2) fail("Justified rows must share one height (measured spread " + j.spread + "px)");
      }
      pick("default");
      await sleep(900);
      var d = rowShape();
      if (!d) fail("no tiles to measure in Default");
      else {
        raggedShort = d.flush - d.right;
        spread = d.spread;
        if (!(raggedShort > 3)) fail("Default must keep the pictures' own width (ragged edge) — its first row still reaches the wall");
        if (d.spread > 2) fail("Default rows must still share one height (measured spread " + d.spread + "px)");
      }
    } finally {
      try {
        var back = (pubBefore && /^[a-z]+$/.test(pubBefore)) ? pubBefore : window.dragonDisplayDefault;
        var b0 = q("button[data-disp='" + back + "']", pubMenu);
        if (b0) b0.click();
        if (pubBefore === null) localStorage.removeItem("dragonGalDisplay");
      } catch (e) {}
      try { pubMenu.style.display = "none"; } catch (e) {}
    }
    // --- private side ---
    window.dragonGoPage("likes");
    var vroot = await waitFor(function () { return document.getElementById("localMediaGallery_root"); }, TIMEOUT * 2, 200);
    if (!vroot) fail("the private gallery did not open");
    var dispBtn = await waitFor(function () { return q("button[title^='Image Display Mode']", vroot); }, TIMEOUT * 2, 200);
    if (!dispBtn) fail("the private display button (Image Display Mode) is missing");
    var vMenu = dispBtn.parentElement.querySelector(".dragon-menu-card");
    if (!vMenu) fail("the private display menu is missing");
    var vaultBefore = localStorage.getItem("dragonVaultDisplay");
    dispBtn.click();
    await sleep(180);
    var vRows = keysOf(vMenu);
    try { vMenu.style.display = "none"; } catch (e) {}
    try { if (vaultBefore === null) localStorage.removeItem("dragonVaultDisplay"); else localStorage.setItem("dragonVaultDisplay", vaultBefore); } catch (e) {}
    try { if (window.dragonVaultRefitAll) window.dragonVaultRefitAll(); } catch (e) {}
    if (!pubRows.length) fail("the public display menu offered no modes");
    if (!vRows.length) fail("the private display menu offered no modes");
    // 🧩 Egon 23.09.2026 — the menus are now checked against the SHARED TABLE itself (id + label, in
    // order), not just against each other, so a mode added to the table but not poured into a menu (or a
    // menu rewording its own row) fails even when both panels happen to agree.
    var tableRows = (window.dragonDisplayModes || []).map(function (m) { return m[0] + "|" + m[1]; }).join(" \u00A7 ");
    var pubJoin = pubRows.join(" \u00A7 "), vJoin = vRows.join(" \u00A7 ");
    if (pubJoin !== tableRows) fail("the public display menu does not match the shared table \u2014 menu: [" + pubJoin + "] table: [" + tableRows + "]");
    if (vJoin !== tableRows) fail("the private display menu does not match the shared table \u2014 menu: [" + vJoin + "] table: [" + tableRows + "]");
    if (pubRows.join(" \u00A7 ") !== vRows.join(" \u00A7 ")) {
      fail("the two display menus are NOT twins — public: [" + pubRows.join(", ") + "] private: [" + vRows.join(", ") + "]");
    }
    return "ONE shared control: both galleries offer the same " + pubRows.length + " rows in the same order ("
      + (ids ? ids.join(" > ") : "?") + "), default \"" + window.dragonDisplayDefault + "\" — measured on the live wall: Justified flush (first row "
      + Math.round(flushShort) + "px short), Default ragged (first row " + Math.round(raggedShort) + "px short, row-height spread " + spread + "px)";
  }

  // 🖼️ Egon 23.09.2026 (W-UI172) — THE 12 DISPLAY MODES, EACH IN BOTH GALLERIES. `display-twin` proves the
  // two menus carry the same 12 rows; this proves every row WORKS in BOTH galleries: the mode is stored in
  // that gallery's own key, the gallery wears its mode marker, and the live geometry matches the mode (wall
  // modes pack absolutely, Justified fills the row, Default stays ragged, Columns really columns, Crop/Fit/
  // Stretch/Original really set the picture's fit). The walk ALTERNATES wall and row/CSS modes on purpose,
  // so the wall→row transition is exercised — that is exactly where the private gallery used to leave every
  // tile absolutely positioned (fixed in this build: dragonVaultClearWall). Each gallery's own mode is
  // restored in the finally. Run it at a desktop AND a phone viewport for the full 11 × 2 × 2 = 44 states.
  async function checkDisplayMatrix() {
    if (!window.dragonDisplayModeIds || typeof window.dragonDisplayIsWall !== "function") fail("the shared display control (src/dragon-display.js) is not loaded");
    var ids = window.dragonDisplayModeIds();
    if (ids.length !== 11) fail("the display table carries " + ids.length + " modes (11 expected)");
    var ORDER = ["mixed", "justified", "default", "pinterest", "masonry", "puzzle", "original", "mosaic", "cover", "justified", "contain", "mixed", "stretch", "default"];
    for (var q0 = 0; q0 < ORDER.length; q0++) if (ids.indexOf(ORDER[q0]) === -1) fail("the walk names an unknown mode: " + ORDER[q0]);
    ;function measure(grid, tileSel) {
      var gb = grid.getBoundingClientRect();
      var all = qa(tileSel, grid), vis = [];
      for (var i = 0; i < all.length; i++) {
        var r = all[i].getBoundingClientRect();
        if (!(r.width > 1)) continue;
        vis.push({ el: all[i], top: r.top, right: r.right, pos: getComputedStyle(all[i]).position });
      }
      if (!vis.length) return null;
      var minTop = vis[0].top, maxRight = vis[0].right;
      for (i = 1; i < vis.length; i++) { if (vis[i].top < minTop) minTop = vis[i].top; }
      var row = vis.filter(function (v) { return Math.abs(v.top - minTop) < 3; });
      maxRight = row[0].right;
      for (i = 1; i < row.length; i++) if (row[i].right > maxRight) maxRight = row[i].right;
      var img = vis[0].el.querySelector("img");
      return { pos: vis[0].pos, short: Math.round(gb.right - maxRight), disp: getComputedStyle(grid).display, cols: getComputedStyle(grid).columnCount, fit: img ? getComputedStyle(img).objectFit : null };
    }
    ;function checkOne(label, mode, m) {
      if (!m) { fail(label + " / " + mode + ": no sized tiles to measure"); return; }
      if (window.dragonDisplayIsWall(mode)) {
        if (m.disp !== "block") fail(label + " / " + mode + ": a wall mode must make the grid a block positioning context (got " + m.disp + ")");
        if (m.pos !== "absolute") fail(label + " / " + mode + ": the tiles were not absolutely packed (position " + m.pos + ")");
        return;
      }
      if (mode === "justified") {
        if (m.disp !== "flex") fail(label + " / justified: after a wall mode the row layout must really take over (grid display " + m.disp + ", wanted flex)");
        if (Math.abs(m.short) > 6) fail(label + " / justified: the first row must reach the right edge (short by " + m.short + "px)");
        return;
      }
      if (mode === "default") {
        if (m.disp !== "flex") fail(label + " / default: after a wall mode the row layout must really take over (grid display " + m.disp + ", wanted flex)");
        if (m.short < 6) fail(label + " / default: the first row must stay measurably ragged (short by only " + m.short + "px)");
        return;
      }
      if (mode === "masonry") {
        if (m.cols === "auto" || m.cols === "normal" || m.cols === "") fail(label + " / masonry: the grid must be CSS multi-column (column-count " + m.cols + ")");
        return;
      }
      var want = { original: "contain", cover: "cover", contain: "contain", stretch: "fill" }[mode];
      if (want && m.fit !== want) fail(label + " / " + mode + ": the picture must be object-fit " + want + " (got " + m.fit + ")");
    }
    async function walk(label, menu, grid, tileSel, key, before) {
      if (!menu) { fail(label + ": the display menu was not found"); return 0; }
      var seen = 0;
      try {
        for (var i = 0; i < ORDER.length; i++) {
          var mode = ORDER[i];
          var row = q("button[data-disp='" + mode + "']", menu);
          if (!row) fail(label + ": the display menu has no \"" + mode + "\" row");
          row.click();
          await sleep(830);
          var on = qa("button[data-disp]", menu).filter(function (b) { return b.classList.contains("dragon-menu-on"); });
          if (on.length !== 1 || on[0].getAttribute("data-disp") !== mode) fail(label + " / " + mode + ": the menu did not mark exactly this row as current");
          var stored = null; try { stored = localStorage.getItem(key); } catch (e) {}
          if (stored !== mode) fail(label + " / " + mode + ": the gallery stored \"" + stored + "\" instead of its own mode");
          checkOne(label, mode, measure(grid, tileSel));
          seen++;
        }
      } finally {
        try { if (before == null) localStorage.removeItem(key); else localStorage.setItem(key, before); } catch (e) {}
        var back = window.dragonDisplayIsMode(before) ? before : window.dragonDisplayDefault;
        var brow = q("button[data-disp='" + back + "']", menu);
        if (brow) { try { brow.click(); } catch (e) {} await sleep(700); }
      }
      return seen;
    }
    var pubBefore = null, vaultBefore = null;
    try { pubBefore = localStorage.getItem("dragonGalDisplay"); } catch (e) {}
    try { vaultBefore = localStorage.getItem("dragonVaultDisplay"); } catch (e) {}
    var pseen = 0, vseen = 0;
    try {
      // ---- public gallery ----
      if (typeof window.dragonGoPage === "function") { try { window.dragonGoPage("gallery"); } catch (e) {} }
      var pgrid = await waitFor(function () { var gs = qa(".dragon-gal-grid").filter(isVisible); for (var i = 0; i < gs.length; i++) if (qa(".dragon-gal-tile", gs[i]).length > 4) return gs[i]; return null; }, TIMEOUT * 3, 200);
      if (!pgrid) fail("no visible public .dragon-gal-grid with tiles");
      var pPanel = null; try { pPanel = pgrid.closest(".dragon-gal-panel"); } catch (e) {}
      var pMenus = qa(".dragon-menu-card").filter(function (m) { return m.querySelector("button[data-disp]") && !m.closest("#localMediaGallery_root"); });
      var pMenu = null;
      if (pPanel) pMenu = pMenus.filter(function (m) { return pPanel.contains(m); })[0];
      if (!pMenu) pMenu = pMenus.filter(function (m) { var r = m.getBoundingClientRect(); return r.width > 1 || m.closest(".dragon-gal-panel"); })[0];
      if (!pMenu) pMenu = pMenus[0];
      if (!pMenu) fail("the public display menu (button[data-disp]) was not found");
      pseen = await walk("public", pMenu, pgrid, ".dragon-gal-tile", "dragonGalDisplay", pubBefore);
      // ---- private gallery ----
      try { if (typeof window.dragonGoPage === "function") window.dragonGoPage("likes"); } catch (e) {}
      var vroot = await waitFor(function () { return document.getElementById("localMediaGallery_root"); }, TIMEOUT * 3, 200);
      if (!vroot) fail("the private gallery did not open for the display-matrix test");
      var vgrid = await waitFor(function () { var g = vroot.querySelector(".dragon-vault-grid"); return (g && vroot.querySelectorAll("[data-local-media-gallery-item]").length > 4) ? g : null; }, TIMEOUT * 4, 250);
      if (!vgrid) fail("no private .dragon-vault-grid with tiles to measure");
      var vMenu = qa(".dragon-menu-card").filter(function (m) { return m.querySelector("button[data-disp]") && vroot.contains(m); })[0];
      if (!vMenu) fail("the private display menu (button[data-disp]) was not found");
      vseen = await walk("private", vMenu, vgrid, "[data-local-media-gallery-item]", "dragonVaultDisplay", vaultBefore);
    } finally {
      try { if (pubBefore == null) localStorage.removeItem("dragonGalDisplay"); else localStorage.setItem("dragonGalDisplay", pubBefore); } catch (e) {}
      try { if (vaultBefore == null) localStorage.removeItem("dragonVaultDisplay"); else localStorage.setItem("dragonVaultDisplay", vaultBefore); } catch (e) {}
    }
    return "all 11 modes work in BOTH galleries (the mode is stored in that gallery's own key, the gallery wears its mode marker, the right menu row is marked, and the geometry matches: wall modes pack absolutely, Justified fills its row, Default stays ragged, Columns is really multi-column, Crop/Fit/Stretch/Original set the picture's fit) — the walk alternated wall<->row so the wall-to-row transition is covered too (" + pseen + " public + " + vseen + " private states); run at a desktop AND a phone viewport for the full 11x2x2 = 44";
  }

  // 🔢 Egon 23.09.2026 (W-SOC183) — THE PUBLIC CHANNEL'S NUMBER IS THE CHANNEL'S OWN COUNT. The static
  // 28.08.2026 snapshot pinned a channel's count forever (Egon's phone was stuck at "187"), and a legacy
  // sub-scan record for `public` could win over it as well. The gallery now auto-counts ONLY the public
  // channel of the channel on screen when the galleries page opens / the gallery changes (never the
  // sub-channel scan, I101), stores it as the channel's count, and the chip prefers that value. This check
  // proves the chip rule (a stale scan record cannot win), the "+10200" ceiling display, and that the exact
  // count really answers for the public channel (tolerating an offline run). The visitor's stats + scan
  // records are restored in the finally.
  async function checkPubCount() {
    // The gallery module initialises lazily on the first visit, so open the galleries page BEFORE asserting
    // any of its hooks exist.
    if (typeof window.dragonGoPage === "function") { try { window.dragonGoPage("gallery"); } catch (e) {} }
    ;function pubChip() {
      var bs = qa("button").filter(function (b) { return /^public/i.test(String(b.textContent || "").trim()); });
      return bs.length ? bs[0] : null;
    }
    var chip = await waitFor(pubChip, TIMEOUT * 2, 200);
    if (!chip) fail("the public channel chip was not found on the gallery row");
    if (typeof window.dragonChannelPublicCount !== "function") fail("window.dragonChannelPublicCount is missing (W-SOC183)");
    if (typeof window.dragonGalChannelNow !== "function") fail("window.dragonGalChannelNow is missing");
    if (typeof window.dragonGalStatsGet !== "function" || typeof window.dragonGalStatsSet !== "function") fail("the gallery stats store is missing");
    if (typeof window.dragonSubScanGet !== "function" || typeof window.dragonSubScanKey !== "function") fail("the sub-scan store is missing");
    if (typeof window.dragonSubRowRefresh !== "function") fail("window.dragonSubRowRefresh is missing");
    var ch = window.dragonGalChannelNow();
    if (!ch) fail("the gallery reports no current channel");
    var notes = [], savedStatRaw = null, savedScanRaw = null, scanKey = "";
    try { savedStatRaw = localStorage.getItem("dragonGalStats"); } catch (e) {}
    try { scanKey = window.dragonSubScanKey(); savedScanRaw = localStorage.getItem(scanKey); } catch (e) {}
    try {
      var st = window.dragonGalStatsGet();
      var statN = st[ch] && st[ch].n;
      if (statN == null) fail("the channel \"" + ch + "\" has no stats count at all");
      // a DIFFERENT (stale) scan record for `public` must NOT win over the channel's own counted value.
      // (The scan store's own write path is `subScanSet`, which is not exported, so write its documented
      // shape — {ts, subs} under the channel's own key — and let the row read it back.)
      try { localStorage.setItem(scanKey, JSON.stringify({ ts: Date.now(), subs: { "public": 12345 } })); } catch (e) {}
      if (window.dragonSubScanGet()["public"] !== 12345) fail("the planted stale scan record was not readable (the check cannot prove the chip rule)");
      window.dragonSubRowRefresh();
      await sleep(450);
      var chipNow = pubChip();
      var shown = String(chipNow ? chipNow.textContent : "").replace(/[^0-9]/g, "");
      var want = (Number(statN) >= 10200) ? "10200" : String(statN);
      if (shown !== want) fail("the public chip shows \"" + (chipNow ? chipNow.textContent : "(none)") + "\" but the channel's own counted value is " + statN + " (a stale scan record must not win)");
      // the ceiling (the listing endpoint refuses skip > 10000) reads "+10200"
      var st2 = window.dragonGalStatsGet();
      st2[ch] = { n: 10200, t: (st2[ch] && st2[ch].t) || null };
      window.dragonGalStatsSet(st2);
      window.dragonSubRowRefresh();
      await sleep(450);
      var chipCap = pubChip();
      if (String(chipCap ? chipCap.textContent : "").indexOf("+10200") === -1) fail("a capped public count must read \"+10200\", got \"" + (chipCap ? chipCap.textContent : "(none)") + "\"");
      notes.push("the chip follows the channel's own count, a stale scan record cannot win, and a capped count reads +10200");
    } finally {
      try { if (savedStatRaw == null) localStorage.removeItem("dragonGalStats"); else localStorage.setItem("dragonGalStats", savedStatRaw); } catch (e) {}
      try { if (scanKey) { if (savedScanRaw == null) localStorage.removeItem(scanKey); else localStorage.setItem(scanKey, savedScanRaw); } } catch (e) {}
      try { window.dragonSubRowRefresh(); } catch (e) {}
    }
    var n = null;
    try { n = await window.dragonChannelPublicCount(ch); } catch (e) { n = null; }
    if (n == null) notes.push("the live exact count could not be taken right now (offline) — the trigger rule is still proven");
    else if (!(Number(n) >= 0)) fail("dragonChannelPublicCount returned a nonsense value: " + n);
    else notes.push("the exact public-channel count for \"" + ch + "\" answered " + n);
    return "the public channel's number is the channel's OWN count (auto-refreshed when the galleries page opens / the gallery changes, never the sub-channel scan), a stale scan record can no longer win, and a capped count reads +10200 — " + notes.join("; ");
  }

  // 🚀 Egon 23.09.2026 — THE COUNT AND THE ORDERING. The gallery's "N Loaded / M Total" denominator must be
  // measured on the FULL listing ("recent"). Measuring it on the visitor's ACTIVE ordering broke a real
  // gallery: the API's "trending" ordering stops after ~500 rows for a channel holding 1 755, so the total
  // froze at "456", the drained-branch wrote that small number into the per-filter statistic, and the pager
  // declared the view complete. This item pins the count's SOURCE (the overflow continuation that actually
  // loads the rest is exercised by the pager itself and is recorded in the books).
  async function checkViewCountSource() {
    if (typeof window.dragonGoPage === "function") { try { window.dragonGoPage("gallery"); } catch (e) {} }
    var info = await waitFor(function () {
      return (typeof window.dragonGalPagerInfo === "function") ? window.dragonGalPagerInfo() : null;
    }, TIMEOUT * 2, 200);
    if (!info) fail("window.dragonGalPagerInfo is missing (the gallery pager did not expose its count wiring)");
    if (info.countSort !== "recent") fail("the exact count is measured on \"" + info.countSort + "\" — it must always walk the FULL listing (recent)");
    if (String(info.countUrl).indexOf("sort=recent") === -1) fail("the count URL does not use the full listing: " + info.countUrl);
    if (String(info.countUrl).indexOf("skip=0") === -1) fail("the count URL does not start at skip=0: " + info.countUrl);
    if (String(info.countUrl).indexOf("subChannel=") === -1) fail("the count URL names no sub-channel: " + info.countUrl);
    if (info.overflowRan && info.overflowOn) fail("the pager reports overflow BOTH running and finished at once");
    if (info.viewTotal != null && !(Number(info.viewTotal) > 0)) fail("the view total is nonsense: " + info.viewTotal);
    return "the exact count always walks the FULL listing (sort=recent, skip=0) whatever ordering the visitor is on " +
      "(active ordering: \"" + info.apiSort + "\"; this run measured " + (info.viewTotal == null ? "nothing yet" : info.viewTotal) + ")" +
      (info.overflowRan ? "; the overflow pass already completed on the full listing" : "");
  }

  // 🖨️ Egon 23.09.2026 — the print flow, v4: the picture's prompt / the date / the page link are three
  // on/off chips that start OFF with NO ✓ badge (pressing one puts its text on the paper and grows a green
  // ✓ badge in the button's corner); the prompt window opens with the chip; "Prompt view" swaps the writing
  // area for a styleable read-only prompt; emojis are draggable PAGE OBJECTS with their own −/＋ sizing;
  // Fit lands on the longer paper edge with no canvas seam (a hair of overlap); zoom is the SITE standard
  // (1 % per press, speeding up while held); the picker carries A6…A0 and real poster sizes; "↺ Default"
  // sits right of "↻ Image" and resets ONLY the picture (the old "↺ Original" is gone); the resize square
  // moves left/right only; every editor button wears the "📝 Add prompt" look. This test walks all of it
  // and then proves the printed page is the preview's geometry (window.print stubbed — a native dialog
  // must never open).
  async function checkPrintEditor() {
    window.dragonGoPage("gallery");
    var pimg = await waitFor(function () {
      var t = qa(".dragon-gal-tile img").filter(function (i) { return i.naturalWidth > 100; });
      return t.length ? t[0] : null;
    }, TIMEOUT * 3, 250);
    if (!pimg) fail("no loaded gallery picture to print");
    var realPrint = window.print, calls = 0;
    window.print = function () { calls++; };
    var prevTitle = document.title;
    function pev(t, x, y) { return new PointerEvent(t, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 11 }); }
    try {
      window.dragonPrintImage(pimg.src, "check-up print caption");
      await sleep(280);
      if (document.getElementById("dragonPrintAsk")) fail("the \"with the prompt / picture only\" ask step must be GONE — the print button opens the editor directly");
      var pv = await waitFor(function () { return document.getElementById("dragonPrintPreview"); }, TIMEOUT, 150);
      if (!pv) fail("the print button no longer opens our preview/editor");
      if (!pv) return "no editor";
      var sh = q("#dragonPrintSheet", pv), im = q("#dragonPrintSheetImg", pv);
      if (!sh || !im) fail("the editor sheet or the picture is missing");
      var shR = sh.getBoundingClientRect();
      var ratio = shR.height ? shR.width / shR.height : 0;
      if (Math.abs(ratio - 210 / 297) > 0.02) fail("the sheet is not an A4 rectangle (w/h " + ratio.toFixed(3) + ", A4 = 0.707)");
      await waitFor(function () { return im.naturalWidth > 0; }, TIMEOUT, 120);
      await sleep(180);
      var visRect = function () { var r = im.getBoundingClientRect(), s = sh.getBoundingClientRect(); return { l: r.left - s.left, r: s.right - r.right, t: r.top - s.top, b: s.bottom - r.bottom }; };
      var wPct = function () { return parseFloat(im.style.width); };
      var boxDisp = function (id) { var b = q(".dpp-box[data-box='" + id + "']", pv); return b ? getComputedStyle(b).display : "missing"; };
      // the site-wide −/＋ pairs are HOLD buttons (one press = one step, a hold keeps stepping): a synthetic
      // .click() never reaches them, so the check presses them with real pointer events.
      var pressHold = function (btn, ms) {
        btn.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 21 }));
        return new Promise(function (res) {
          setTimeout(function () {
            btn.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, pointerId: 21 }));
            res();
          }, ms || 40);
        });
      };

      // (1) ONE "Add prompt" on/off button (the picture-only button is gone). Egon 23.09.2026 — every
      // "add to picture" chip now starts OFF with NO ✓ badge: nothing is on the paper until it is pressed.
      if (q("[data-pp='picture-only']", pv)) fail("\"Picture only\" must be gone — one 📝 Add prompt on/off button replaces the pair (Egon)");
      var apBtn = q("[data-pp='add-prompt']", pv);
      if (!apBtn) fail("the 📝 Add prompt on/off button is missing");
      var promptBox = q(".dpp-box[data-box='prompt']", pv);
      if (!promptBox) fail("the prompt box is missing from the sheet");
      if (q("[data-pp='prompt-text']", pv)) fail("the prompt must NOT be editable any more (Egon: \"prompt da düzenlenemesin\")");
      if (boxDisp("prompt") !== "none") fail("nothing may sit on the paper until its button is pressed, yet the prompt box was already on show (Egon)");
      if (apBtn.querySelector(".dpp-badge")) fail("the 📝 Add prompt chip must start with NO ✓ badge — it adds nothing to the picture yet");
      apBtn.click(); await sleep(130);
      if (boxDisp("prompt") === "none") fail("the 📝 Add prompt button did not put the prompt on the paper");
      if (promptBox.textContent.indexOf("check-up print caption") === -1) fail("the picture's own prompt did not reach the sheet");
      if (!apBtn.querySelector(".dpp-badge")) fail("pressing 📝 Add prompt must grow the green ✓ badge in the button's corner (Egon)");
      // ⚖️ Egon 23.09.2026 — and it must NOT jump the panel to the prompt view: the prompt cannot be
      // edited anyway and is already visible on the sheet ("there's no point in showing it there").
      var owTa1 = q("[data-pp='own-text']", pv);
      if (owTa1) { var owr1 = owTa1.getBoundingClientRect(); if (!(owr1.width > 1 && owr1.height > 1)) fail("pressing 📝 Add prompt must leave the panel on \"My text\" (Egon 23.09.2026)"); }
      apBtn.click(); await sleep(120);
      if (boxDisp("prompt") !== "none") fail("the 📝 Add prompt button did not take the prompt off the sheet");
      if (apBtn.querySelector(".dpp-badge")) fail("turning 📝 Add prompt off must take its ✓ badge away again");
      apBtn.click(); await sleep(120);
      if (boxDisp("prompt") === "none") fail("the 📝 Add prompt button did not put the prompt back");

      // (2) the date and the page link start OFF too; pressing them fills the paper with today's date and
      // this page's address — both read-only (no input to type over)
      var dateBtn = q("[data-pp='date']", pv), linkBtn = q("[data-pp='link']", pv);
      if (!dateBtn || !linkBtn) fail("the 📅 date and 🔗 page link chips are missing");
      if (boxDisp("date") !== "none") fail("the date must not be on the paper until 📅 date is pressed (Egon)");
      if (boxDisp("link") !== "none") fail("the page link must not be on the paper until 🔗 page link is pressed (Egon)");
      if (dateBtn.querySelector(".dpp-badge") || linkBtn.querySelector(".dpp-badge")) fail("the 📅 date / 🔗 page link chips must start badge-less");
      dateBtn.click(); linkBtn.click(); await sleep(130);
      if (boxDisp("date") === "none") fail("the 📅 date button did not put the date on the paper");
      var dTxt = (q(".dpp-box[data-box='date'] [data-txt]", pv) || {}).textContent || "";
      if (dTxt !== window.dragonPrintSheetDate()) fail("the date box must carry today's date (" + window.dragonPrintSheetDate() + "), got \"" + dTxt + "\"");
      if (!dateBtn.querySelector(".dpp-badge") || !linkBtn.querySelector(".dpp-badge")) fail("pressing 📅 date / 🔗 page link must grow their ✓ badges");
      if (boxDisp("link") === "none") fail("the 🔗 page link button did not put the link on the paper");
      var linkTxt = (q(".dpp-box[data-box='link'] [data-txt]", pv) || {}).textContent || "";
      if (linkTxt.indexOf(window.generatorName || "bestaigen") === -1) fail("the link box does not carry this page's address");
      if (q("[data-pp='date-text']", pv)) fail("the date input must be GONE (the date is automatic now)");
      if (q("[data-pp='link-text']", pv)) fail("the page link must not be editable any more");

      // (3) "Prompt view" swaps the writing area for the read-only prompt, and the style buttons follow it
      var own = q(".dpp-box[data-box='own']", pv), ownTa = q("[data-pp='own-text']", pv);
      if (!ownTa || !own) fail("the editor has no \"your own text\" field");
      var viewBtn = q("[data-pp='prompt-view']", pv);
      if (!viewBtn) fail("the \"Prompt view\" button is missing next to the text panel");
      var shownNow = function (el) { if (!el) return false; var r0 = el.getBoundingClientRect(); return r0.width > 1 && r0.height > 1; };
      if (!shownNow(ownTa)) { viewBtn.click(); await sleep(140); }   // "Add prompt" left the panel on the prompt
      if (!shownNow(ownTa)) fail("the writing area must be on show before \"Prompt view\" is pressed");
      ownTa.value = "line one\nline two"; ownTa.dispatchEvent(new Event("input", { bubbles: true }));
      await sleep(90);
      if (getComputedStyle(own).whiteSpace !== "pre-wrap") fail("Enter must make a NEW LINE on the paper (white-space: pre-wrap)");
      if (own.textContent.indexOf("\n") === -1) fail("the typed newline did not survive into the sheet text");
      viewBtn.click(); await sleep(130);
      if (shownNow(ownTa)) fail("\"Prompt view\" must make the writing area go away");
      var ro = q("[data-pp='prompt-view-text']", pv);
      if (!ro || !shownNow(ro)) fail("the read-only prompt did not take the writing area's place");
      if (ro.textContent.indexOf("check-up print caption") === -1) fail("the read-only area does not show the picture's prompt");
      var promptFs0 = promptBox.style.fontSize, ownFs0 = own.style.fontSize;
      q("[data-pp='size-up']", pv).click(); await sleep(90);
      if (promptBox.style.fontSize === promptFs0) fail("in Prompt view the A+ button must size the PROMPT (it did nothing)");
      if (own.style.fontSize !== ownFs0) fail("sizing the prompt must not resize the visitor's own text");
      viewBtn.click(); await sleep(120);
      if (!shownNow(ownTa)) fail("leaving Prompt view did not bring the writing area back");
      // 🔤 Egon 25.09.2026 — the font dropdown PREVIEWS every face: each option carries its own
      // font-family, and the closed select wears the chosen one (same rule as the Description Style menu).
      var fontSel2 = q("[data-pp='font']", pv);
      if (!fontSel2) fail("the editor's font dropdown is missing");
      if (fontSel2.options.length < 6) fail("the font dropdown must offer the six faces, got " + fontSel2.options.length);
      var noPrev = 0;
      for (var fo = 0; fo < fontSel2.options.length; fo++) if (!fontSel2.options[fo].style.fontFamily) noPrev++;
      if (noPrev) fail(noPrev + " font option(s) carry no font-family — every row must preview its own face");
      if (!fontSel2.style.fontFamily) fail("the closed font dropdown must wear the selected face too");

      // (4) emojis are draggable PAGE OBJECTS with their own −/+ size buttons
      var emoBtn = q("[data-pp='emoji']", pv), emoPanel = q("[data-pp='emoji-panel']", pv);
      if (!emoBtn || !emoPanel) fail("the \"Add emoji to page\" button / panel is missing");
      if (getComputedStyle(emoPanel).display !== "none") fail("the emoji panel must stay closed until the button is ticked");
      emoBtn.click(); await sleep(110);
      if (getComputedStyle(emoPanel).display === "none") fail("the emoji panel did not open");
      if (emoPanel.querySelectorAll("button").length < 20) fail("the emoji panel is nearly empty");
      var downB = q("[data-pp='emo-down']", pv), upB = q("[data-pp='emo-up']", pv), emoCur = q("[data-pp='emo-cur']", pv);
      if (!downB || !upB || !emoCur) fail("the emoji −/＋ size buttons (or the selected-emoji display) are missing");
      if (getComputedStyle(downB).display === "none") fail("the emoji −/＋ buttons must appear while the tick is on");
      // Egon 23.09.2026 — the button must never look faded (it is live from the start), and the order
      // under it must read: 😊 Add emoji → the −/＋ cluster → the emoji table.
      if (parseFloat(getComputedStyle(emoBtn).opacity) < 0.95) fail("the 😊 Add emoji button must not look faded — it is a live button (Egon)");
      var emoCtlEl = emoCur.parentElement;
      var o1 = emoBtn.compareDocumentPosition(emoCtlEl), o2 = emoCtlEl.compareDocumentPosition(emoPanel);
      if (!(o1 & 4) || !(o2 & 4)) fail("the order under the button must be 😊 Add emoji → −/＋ → the emoji table (Egon)");
      emoPanel.querySelectorAll("button")[4].click(); await sleep(120);
      var emoEls = qa(".dpp-emo", pv);
      if (emoEls.length !== 1) fail("picking an emoji must put ONE emoji object on the page (found " + emoEls.length + ")");
      var e0 = emoEls[0];
      if (e0.style.left !== "50%" || e0.style.top !== "50%") fail("a new emoji must land in the middle of the page, got " + e0.style.left + "/" + e0.style.top);
      if (e0.textContent !== emoPanel.querySelectorAll("button")[4].textContent) fail("the emoji on the page is not the one that was picked");
      if (emoCur.textContent !== e0.textContent) fail("the −/＋ cluster does not show the selected emoji");
      if (e0.style.outline === "none" || !/dashed/.test(e0.style.outline)) fail("a selected emoji must wear its marker circle (dashed outline)");
      var efs0 = parseFloat(e0.style.fontSize);
      await pressHold(upB); await sleep(90);
      if (!(parseFloat(e0.style.fontSize) > efs0)) fail("the emoji ＋ button does not enlarge the selected emoji");
      await pressHold(downB); await pressHold(downB); await sleep(90);
      if (!(parseFloat(e0.style.fontSize) < efs0)) fail("the emoji − button does not shrink the selected emoji");
      var s0 = sh.getBoundingClientRect(), er = e0.getBoundingClientRect();
      e0.dispatchEvent(pev("pointerdown", er.left + er.width / 2, er.top + er.height / 2));
      sh.dispatchEvent(pev("pointermove", er.left + er.width / 2 + Math.round(s0.width * 0.18), er.top + er.height / 2 + Math.round(s0.height * 0.12)));
      sh.dispatchEvent(pev("pointerup", er.left, er.top));
      await sleep(110);
      if (parseFloat(e0.style.left) < 60) fail("the emoji cannot be dragged around the page (still at " + e0.style.left + ")");
      emoBtn.click(); await sleep(90);

      // (5) geometry: Fit meets the LONGER edge with no canvas showing · the site-standard zoom (1 % per
      // press, speeding up while held) · ratio-reset · Cover fills · Centre never sticks out
      var fitG = visRect();
      var fitGaps = [fitG.l, fitG.r, fitG.t, fitG.b];
      // Egon 23.09.2026 — "canvas should not be visible at the fitted edges": the fitted picture OVERLAPS the sheet by a
      // hair (DPP_EDGE, 0.35 %) so no white canvas can show on the edges it meets, while the other pair keeps
      // its normal letterbox gap. WHICH pair is met follows from the shapes: the picture's longer axis runs
      // out first inside the sheet's inner area. A flat 1.5px tolerance was wrong — 0.35 % of a 570px-tall
      // picture is 2px of intended overlap, so the check called a correct Fit a failure on a large sheet.
      var imR = im.getBoundingClientRect(), shR = sh.getBoundingClientRect();
      var imRatio = imR.width / imR.height, shRatio = shR.width / shR.height;
      var touchLr = imRatio >= shRatio;
      var met = touchLr ? [fitG.l, fitG.r] : [fitG.t, fitG.b];
      var free = touchLr ? [fitG.t, fitG.b] : [fitG.l, fitG.r];
      var seam = met.filter(function (g) { return g > 0.5; })[0];
      if (seam !== undefined) fail("on the edges Fit meets there must be NO canvas showing — a " + seam.toFixed(1) + "px white seam is still there (Egon); gaps " + fitGaps.map(Math.round).join(","));
      var deep = met.filter(function (g) { return g < -4; })[0];
      if (deep !== undefined) fail("Fit must never let the picture stick out of the paper (gaps " + fitGaps.map(Math.round).join(",") + ")");
      // the free pair must stay inside the paper (skipped when the shapes match, where both pairs overlap)
      if (Math.abs(imRatio - shRatio) > 0.005 * shRatio) {
        var out = free.filter(function (g) { return g < -0.5; })[0];
        if (out !== undefined) fail("Fit must meet the edges the picture's own shape runs into, not the other pair (gaps " + fitGaps.map(Math.round).join(",") + ")");
      }
      var fitW = wPct();
      if (!(fitW > 1 && fitW <= 101)) fail("the picture must start fitted inside the sheet, width was " + im.style.width);
      var zIn = q("[data-pp='zoom-in']", pv);
      await pressHold(zIn); await sleep(80);
      if (!(wPct() > fitW)) fail("zoom-in did not enlarge the picture");
      var oneStep = wPct() - fitW;   // one press = 1 % of the current size (the site standard)
      if (!(oneStep > 0.2 && oneStep < 3)) fail("one press of 🔍+ must step by about 1 % (" + oneStep.toFixed(2) + "% measured)");
      var beforeHold = wPct();
      await pressHold(zIn, 950); await sleep(80);
      var heldStep = wPct() - beforeHold;
      if (!(heldStep > oneStep * 2)) fail("holding 🔍+ must accelerate — it stepped " + heldStep.toFixed(2) + "% in ~0.95 s vs " + oneStep.toFixed(2) + "% for one press (Egon)");
      var ratioBtn = q("[data-pp='ratio']", pv);
      if (!ratioBtn) fail("the percentage between 🔍− and 🔍+ must be a BUTTON (Egon asked)");
      ratioBtn.click(); await sleep(70);
      if (Math.abs(wPct() - fitW) > 0.6) fail("the ratio button did not go back to the fitted size (" + wPct() + " vs " + fitW + ")");
      q("[data-pp='cover']", pv).click(); await sleep(90);
      var cr = visRect();
      if (cr.l > 0.5 || cr.r > 0.5 || cr.t > 0.5 || cr.b > 0.5) fail("Cover must fill the whole sheet (gaps " + [Math.round(cr.l), Math.round(cr.r), Math.round(cr.t), Math.round(cr.b)].join(",") + ")");
      q("[data-pp='centre']", pv).click(); await sleep(90);
      var ce = visRect();
      // Centre shrinks only what would stick out — and it lands on the SAME edge factor as Fit, so the
      // touched edges may overlap by that deliberate hair (never more).
      if (ce.l < -4 || ce.r < -4 || ce.t < -4 || ce.b < -4) fail("Centre must never let the picture stick out of the paper (gaps " + [Math.round(ce.l), Math.round(ce.r), Math.round(ce.t), Math.round(ce.b)].join(",") + ")");
      if (Math.abs(ce.l - ce.r) > 2 || Math.abs(ce.t - ce.b) > 2) fail("Centre did not put the picture's middle on the middle of the paper");

      // (6) paper sizes (A6 … A0 + real poster sizes — Egon's printer may be a big one) + the two turns
      var paperSel = q("[data-pp='paper']", pv);
      if (!paperSel || paperSel.options.length < 3) fail("the paper-size picker is missing (Egon asked for sizes beyond A4)");
      var paperIds = Array.prototype.map.call(paperSel.options, function (o) { return o.value; });
      ["a6", "a5", "a4", "letter", "legal", "a3", "tabloid", "a2", "a1", "a0", "p30x40", "p40x60", "p50x70", "p60x90"].forEach(function (id) {
        if (paperIds.indexOf(id) === -1) fail("the paper picker is missing the " + id + " size — Egon asked for BIG papers too (A6…A0 and posters)");
      });
      if (paperSel.querySelectorAll("optgroup").length < 3) fail("the paper picker must group its sizes (Small / Standard / Large / Poster)");
      paperSel.value = "square"; paperSel.dispatchEvent(new Event("change")); await sleep(160);
      var sq = sh.getBoundingClientRect();
      if (Math.abs(sq.width / sq.height - 1) > 0.03) fail("choosing Square must give a square sheet, got ratio " + (sq.width / sq.height).toFixed(3));
      var sqG = visRect();
      if (sqG.l < -4 || sqG.t < -4) fail("changing the paper size must re-fit the picture inside it");
      paperSel.value = "p60x90"; paperSel.dispatchEvent(new Event("change")); await sleep(160);
      var bigS = sh.getBoundingClientRect();
      if (Math.abs(bigS.width / bigS.height - 600 / 900) > 0.04) fail("the 60×90 cm poster must be a 2:3 sheet, got ratio " + (bigS.width / bigS.height).toFixed(3));
      var bigG = visRect();
      // same shape rule as Fit above: the edge the picture's own shape runs into is the one that must be met
      var bigIr = im.getBoundingClientRect(), bigMet = (bigIr.width / bigIr.height) >= (bigS.width / bigS.height) ? [bigG.l, bigG.r] : [bigG.t, bigG.b];
      if (bigMet.filter(function (g) { return g > 0.5 || g < -4; })[0] !== undefined) fail("Fit must work on the big poster papers too (gaps " + [Math.round(bigG.l), Math.round(bigG.r), Math.round(bigG.t), Math.round(bigG.b)].join(",") + ")");
      if (bigG.l < -4 || bigG.r < -4 || bigG.t < -4 || bigG.b < -4) fail("the picture sticks out of the big poster sheet");
      paperSel.value = "a4"; paperSel.dispatchEvent(new Event("change")); await sleep(160);
      q("[data-pp='fit']", pv).click(); await sleep(70);
      q("[data-pp='rot-img']", pv).click(); await sleep(90);
      if (im.style.transform.indexOf("rotate(90deg)") === -1) fail("the ↻ Image button did not turn the picture by 90°");
      q("[data-pp='rot-sheet']", pv).click(); await sleep(140);
      var lr = sh.getBoundingClientRect();
      if (!(lr.width > lr.height)) fail("turning the A4 must give a LANDSCAPE sheet");
      q("[data-pp='rot-sheet']", pv).click(); await sleep(140);
      q("[data-pp='rot-img']", pv).click(); await sleep(90);

      // (7) the boxes move, and the resize square moves LEFT/RIGHT only
      var bBefore = { x: own.style.left, w: own.style.width };
      var sr = sh.getBoundingClientRect();
      var ob = own.getBoundingClientRect();
      own.querySelector("[data-txt]").dispatchEvent(pev("pointerdown", ob.left + 5, ob.top + 5));
      sh.dispatchEvent(pev("pointermove", ob.left + 5 + Math.round(sr.width * 0.07), ob.top + 5 + Math.round(sr.height * 0.05)));
      sh.dispatchEvent(pev("pointerup", ob.left + 5, ob.top + 5));
      await sleep(90);
      if (own.style.left === bBefore.x) fail("the text boxes cannot be dragged on the sheet");
      var hd = q("[data-handle='own']", pv);
      if (!hd) fail("the text boxes have no resize handle");
      if (hd) {
        var w0 = parseFloat(own.style.width), fs0b = parseFloat(own.style.fontSize);
        var hr = hd.getBoundingClientRect();
        hd.dispatchEvent(pev("pointerdown", hr.left + 2, hr.top + 2));
        sh.dispatchEvent(pev("pointermove", hr.left + 2 - Math.round(sr.width * 0.12), hr.top + 2 - Math.round(sr.height * 0.12)));
        hd.dispatchEvent(pev("pointerup", hr.left + 2, hr.top + 2));
        await sleep(90);
        if (!(parseFloat(own.style.width) < w0 - 1)) fail("the striped frame cannot be made narrower");
        // ⚖️ Egon 23.09.2026 (v2) — "undo it, make it like before ... and font size proportional to window
        // olmaya devam etsin": the square is DIAGONAL again, so the text must scale WITH the box.
        var fs1b = parseFloat(own.style.fontSize);
        if (!(fs1b < fs0b - 0.01)) fail("dragging the corner square must scale the text with the box (Egon 23.09.2026): size " + fs0b + " → " + own.style.fontSize);
        var wRatio = parseFloat(own.style.width) / w0, sRatio = fs1b / Math.max(0.01, fs0b);
        if (Math.abs(wRatio - sRatio) > 0.15) fail("the text size must stay PROPORTIONAL to the box (width ×" + wRatio.toFixed(2) + " vs font ×" + sRatio.toFixed(2) + ")");
        if (getComputedStyle(hd).cursor !== "nwse-resize") fail("the corner square must wear the diagonal resize cursor (nwse-resize), got " + getComputedStyle(hd).cursor);
        // the whole square must BE the handle — a move cursor used to sit on part of it (Egon).
        // NOTE: the box moved during the drag, so the square is re-measured before probing it.
        var hr2 = hd.getBoundingClientRect();
        var hpc = document.elementFromPoint(hr2.left + hr2.width / 2, hr2.top + hr2.height / 2);
        if (hpc && hpc !== hd && !hd.contains(hpc)) fail("the move cursor still covers the corner square (the pointer lands on " + (hpc.className || hpc.tagName) + " at the square's centre)");
      }

      // (8) text style (the writing area is the target out here)
      var fSel = q("[data-pp='font']", pv);
      if (!fSel || fSel.options.length < 4) fail("the font / text-style picker is missing");
      var fTarget = (getComputedStyle(ownTa).display === "none") ? promptBox : own;
      var ff0 = fTarget.style.fontFamily;
      fSel.value = fSel.options[fSel.options.length - 1].value;
      fSel.dispatchEvent(new Event("change")); await sleep(70);
      if (fTarget.style.fontFamily === ff0) fail("choosing a font did not reach the sheet text");
      var boldB = q("[data-pp='bold']", pv);
      if (!boldB) fail("the bold (kalınlaştırma) button is missing");
      var fw0 = fTarget.style.fontWeight;
      boldB.click(); await sleep(70);
      if (fTarget.style.fontWeight === fw0) fail("bold did not change the sheet text");
      // Egon 23.09.2026 — a colour swatch sits in the style row and colours whichever text the panel shows
      var colSw = q("[data-pp='text-colour']", pv);
      if (!colSw) fail("the text colour swatch is missing from the style row (Egon asked for one for the prompt AND for the visitor's own text)");
      if (getComputedStyle(ownTa).display === "none") { viewBtn.click(); await sleep(140); }
      var col0 = String(fTarget.style.color);
      colSw.value = "#1122ff"; colSw.dispatchEvent(new Event("input", { bubbles: true }));
      await sleep(110);
      // NOTE: reading an element's style.color always serialises to "rgb(r, g, b)", so compare in rgb
      var colWant = (function () { var d = document.createElement("div"); d.style.color = "#1122ff"; document.body.appendChild(d); var o = getComputedStyle(d).color; d.remove(); return o; })();
      if (String(fTarget.style.color) !== colWant) fail("the colour swatch did not colour the sheet text (style target " + fTarget.style.color + " · prompt box " + promptBox.style.color + " · own box " + own.style.color + " · panel " + (getComputedStyle(ownTa).display === "none" ? "prompt" : "own") + ")");
      // Egon 23.09.2026 — the font dropdown must wear the same design as the buttons ("Default" looked off)
      var refBtn = q("[data-pp='fit']", pv);
      var fcs = getComputedStyle(fSel), rcs = getComputedStyle(refBtn);
      if (String(fcs.fontWeight) !== String(rcs.fontWeight)) fail("the font picker must look like the other buttons (weight " + fcs.fontWeight + " vs " + rcs.fontWeight + ")");
      if (fcs.color !== rcs.color) fail("the font picker must wear the same text colour as the other buttons (" + fcs.color + " vs " + rcs.color + ")");
      if (fcs.borderTopColor !== rcs.borderTopColor) fail("the font picker's border must match the buttons' (" + fcs.borderTopColor + " vs " + rcs.borderTopColor + ")");

      // (9) print EXACTLY what the preview shows
      var prevIm = { left: im.style.left, top: im.style.top, width: im.style.width, tf: im.style.transform };
      var prevBoxes = qa(".dpp-box", pv).map(function (b) { return [b.getAttribute("data-box"), b.style.left, b.style.top, b.style.width]; });
      var visIds = qa(".dpp-box", pv).filter(function (b) { return getComputedStyle(b).display !== "none"; }).map(function (b) { return b.getAttribute("data-box"); }).sort();
      var prevEmoN = qa(".dpp-emo", pv).length;
      q("[data-pp='print']", pv).click();
      await sleep(800);
      var css = document.getElementById("dragonPrintCss");
      if (!css || css.textContent.indexOf("@page{size:A4") === -1) fail("the print stylesheet must pin the page to A4 (margin 0) so the browser's own header/footer stays off the paper");
      var ctn = document.getElementById("dragonPrintCtn");
      if (!ctn) fail("Print did not build the print-only sheet");
      else {
        var psh = ctn.querySelector(".dragon-print-sheet"), pim = ctn.querySelector("img");
        if (!psh || !pim) fail("the print-only sheet is incomplete");
        else {
          if (psh.style.width !== "210mm" || psh.style.height !== "297mm") fail("the printed sheet must be a real A4 page (210x297mm), got " + psh.style.width + "x" + psh.style.height);
          if (!pim.style.left || !pim.style.width) fail("the printed picture lost its position/zoom");
          if (pim.style.left !== prevIm.left || pim.style.width !== prevIm.width || pim.style.top !== prevIm.top || pim.style.transform !== prevIm.tf) fail("what prints is not what the preview showed (preview " + prevIm.left + "/" + prevIm.width + ", printed " + pim.style.left + "/" + pim.style.width + ")");
          var prIds = qa("[data-print-box]", ctn).map(function (b) { return b.getAttribute("data-print-box"); }).sort();
          if (prIds.join() !== visIds.join()) fail("the paper does not carry the same text boxes as the preview (" + prIds.join() + " vs " + visIds.join() + ")");
          var okGeo = true;
          qa("[data-print-box]", ctn).forEach(function (pb) {
            var id = pb.getAttribute("data-print-box");
            var pv2 = prevBoxes.filter(function (x) { return x[0] === id; })[0];
            if (!pv2 || pv2[1] !== pb.style.left || pv2[2] !== pb.style.top || pv2[3] !== pb.style.width) okGeo = false;
          });
          if (!okGeo) fail("a text box moved between the preview and the paper");
          var pb0 = ctn.querySelector("[data-print-box]");
          if (pb0 && !/mm$/.test(pb0.style.fontSize)) fail("the printed text must be sized in mm so it comes out the same size on paper");
          var pOwn = q("[data-print-box='own']", ctn);
          if (pOwn && pOwn.textContent.indexOf("\n") === -1) fail("the printed own-text lost its line break");
          var printEmos = qa("[data-print-emo]", ctn);
          if (printEmos.length !== prevEmoN) fail("the emojis on the page did not reach the paper (" + printEmos.length + " of " + prevEmoN + ")");
          if (printEmos[0] && !/mm$/.test(printEmos[0].style.fontSize)) fail("a printed emoji must be sized in mm");
        }
      }
      if (document.title !== "BestAiGen") fail("the title must be switched to a clean one while printing, got \"" + document.title + "\"");
      if (calls !== 1) fail("window.print() must be called exactly once, got " + calls);
      window.dispatchEvent(new Event("afterprint"));
      await sleep(180);
      if (document.getElementById("dragonPrintCtn") || document.getElementById("dragonPrintCss")) fail("afterprint did not remove the print-only nodes");
      if (document.title !== prevTitle) fail("the document title was not put back after printing");

      // (10) "↺ Default" resets ONLY the picture's geometry — the old "↺ Original" is gone (Egon: it did
      // exactly what Fit already does, so it was redundant)
      if (q("[data-pp='original']", pv) || q("[data-pp='original2']", pv)) fail("the ↺ Original button must be gone (Egon: gereksiz — Fit already does that); ↺ Default took its place");
      var defBtn = q("[data-pp='default']", pv);
      if (!defBtn) fail("the ↺ Default button is missing (Egon: it must sit right of ↻ Image)");
      var rotImgBtn = q("[data-pp='rot-img']", pv);
      if (rotImgBtn && rotImgBtn.nextElementSibling !== defBtn) fail("↺ Default must sit directly to the RIGHT of ↻ Image (Egon)");
      q("[data-pp='fit']", pv).click(); await sleep(100);
      var fitW2 = wPct();
      q("[data-pp='rot-img']", pv).click(); await sleep(140);
      // the ↻ Image button RE-FITS the turned picture, and a 90° turn can give a wider OR a narrower fit than
      // the upright one (a landscape picture that fitted against the paper's width comes back narrower once it
      // stands upright) — so the zoom baseline has to be the TURNED fit. Comparing the zoom against the upright
      // % made this check fail whenever the gallery's newest picture happened to face the other way.
      var turnedW = wPct();
      await pressHold(q("[data-pp='zoom-in']", pv)); await sleep(90);
      if (im.style.transform.indexOf("rotate(") === -1) fail("the ↻ Image button did not turn the picture (needed for the Default test)");
      if (!(wPct() > turnedW)) fail("zoom-in did not enlarge the picture (needed for the Default test) — " + turnedW + "% → " + wPct() + "%");
      var ownKept = ownTa.value, emoKept = qa(".dpp-emo", pv).length;
      defBtn.click(); await sleep(190);
      if (im.style.transform.indexOf("rotate(0deg)") === -1) fail("\"↺ Default\" did not straighten the picture again (transform " + im.style.transform + ")");
      if (Math.abs(wPct() - fitW2) > 0.6) fail("\"↺ Default\" did not put the picture back to its fitted size (" + wPct() + " vs " + fitW2 + ")");
      if (ownTa.value !== ownKept || ownKept === "") fail("\"↺ Default\" must NOT touch the visitor's own text (Egon: yazı/emoji emeğin duruyor)");
      if (qa(".dpp-emo", pv).length !== emoKept || emoKept === 0) fail("\"↺ Default\" must NOT remove the emojis (Egon: yazı/emoji emeğin duruyor)");

      // (11) ✏️ Egon 23.09.2026 — this window is the IMAGE EDITOR now, and its bottom row gained ↺ Reset
      var headEl = pv.firstElementChild;
      if (!headEl || (headEl.textContent || "").indexOf("Image Editor") === -1) fail("the window's title must read \"✏️ Image Editor\", got \"" + (headEl ? headEl.textContent : "") + "\"");
      var resBtn = q("[data-pp='reset-all']", pv);
      if (!resBtn) fail("the editor has no ↺ Reset button");
      var cancelEl = q("[data-pp='cancel']", pv);
      // ✏️ Egon 23.09.2026 — the ACTION ROW order is primary · ↺ Reset (CENTRE) · ✖ Cancel (RIGHT).
      if (cancelEl && resBtn && !(resBtn.compareDocumentPosition(cancelEl) & 4)) fail("✖ Cancel must sit to the RIGHT of ↺ Reset (Egon)");
      if (!q("[data-pp='brush']", pv)) fail("the editor has no 🖌️ Retouch Brush button (Egon: the brush moves INTO the Image Editor)");
      // the two-picture toggle must NAME THE ACTION it performs
      var upB2 = q("[data-pp='upscale']", pv);
      if (!upB2) fail("the 💫 upscale button is missing");
      // alignment guides: while a striped box is held, the guide cross appears with the four px gaps
      var gl = q("#dragonPrintGuides", pv);
      if (!gl) fail("the alignment-guide layer is missing from the sheet (#dragonPrintGuides)");
      var ob2 = own.getBoundingClientRect();
      own.querySelector("[data-txt]").dispatchEvent(pev("pointerdown", ob2.left + 6, ob2.top + 6));
      sh.dispatchEvent(pev("pointermove", ob2.left + 6 + Math.round(sr.width * 0.04), ob2.top + 6 + Math.round(sr.height * 0.03)));
      await sleep(110);
      if (getComputedStyle(gl).display === "none") fail("holding a text box must show the alignment guides (Egon)");
      var gTxt = (gl.textContent || "");
      if (!/\d+px/.test(gTxt)) fail("the guide numbers (box edge → sheet edge, in px) are missing, got \"" + gTxt + "\"");
      if ((gTxt.match(/\d+px/g) || []).length < 4) fail("all four guide distances (left/right/top/bottom) must be printed in px, got \"" + gTxt + "\"");
      sh.dispatchEvent(pev("pointerup", ob2.left + 6, ob2.top + 6));
      await sleep(90);
      if (getComputedStyle(gl).display !== "none") fail("the guides must disappear when the box is let go");
      // ↺ Reset: the whole edit goes back to the moment the editor opened …
      resBtn.click(); await sleep(260);
      if (ownTa.value !== "") fail("\"↺ Reset\" must clear the visitor's own text, got \"" + ownTa.value + "\"");
      if (qa(".dpp-emo", pv).length !== 0) fail("\"↺ Reset\" must clear the emoji added in this editor");
      // … but the 💫 upscaled picture is not an edit, so it must survive (kept, still toggleable)
      var stR = window.dragonPrintState();
      if (stR && stR.showing !== "base") fail("after ↺ Reset the sheet must show the original picture again (showing=" + (stR && stR.showing) + ")");

      var cb = q("[data-pp='cancel']", pv);
      if (cb) cb.click();
      await sleep(140);
      if (document.getElementById("dragonPrintPreview")) fail("Cancel did not close the editor");
    } finally {
      window.print = realPrint;
      try { document.title = prevTitle; } catch (e) {}
      try { var a2 = document.getElementById("dragonPrintAsk"); if (a2 && a2.parentNode) a2.parentNode.removeChild(a2); } catch (e) {}
      try { var p2 = document.getElementById("dragonPrintPreview"); if (p2 && p2.parentNode) p2.parentNode.removeChild(p2); } catch (e) {}
      try { var c2 = document.getElementById("dragonPrintCtn"); if (c2 && c2.parentNode) c2.parentNode.removeChild(c2); } catch (e) {}
      try { var s3 = document.getElementById("dragonPrintCss"); if (s3 && s3.parentNode) s3.parentNode.removeChild(s3); } catch (e) {}
    }
    return "the picture opens OUR ✏️ Image Editor (no ask step): 📝 Add prompt / 📅 date / 🔗 page link are badge-less until pressed (then each grows a green ✓ badge) and Add prompt leaves the panel alone, \"Prompt view\" swaps the writing area for a styleable read-only prompt, a text colour swatch, draggable emoji page-objects with −/＋ sizing, Fit meeting the longer edge with NO canvas seam, the site-standard 1 % zoom that speeds up while held, Cover/Centre, A6…A0 + real poster papers, A4 + image turns, a diagonal resize square with proportional text, ↺ Default beside ↻ Image (no ↺ Original), ↺ Reset right of ✖ Cancel (clears the whole edit, keeps a 💫 upscaled picture), alignment guides carrying the four px gaps, and the editor's own 🖌️ Retouch Brush button — and the printed page carries the preview's exact geometry (emojis included) once (window.print stubbed)";
  }

  // ✎ Egon 23.09.2026 — "this window should also appear on our visual send/share screen before the user sends
  // be able to edit the image". NOTE: this test deliberately does NOT press "✔ Use this picture" — that would
  // upload a file to the visitor's storage on every check-up run. The upload path is verified by hand.
  async function checkShareEdit() {
    window.dragonGoPage("gallery");
    var pimg = await waitFor(function () {
      var t = qa(".dragon-gal-tile img").filter(function (i) { return i.naturalWidth > 100; });
      return t.length ? t[0] : null;
    }, TIMEOUT * 3, 250);
    if (!pimg) fail("no loaded gallery picture for the share test");
    try {
      if (typeof window.dragonShareModal !== "function") fail("the share window is not reachable (dragonShareModal missing)");
      window.dragonShareModal({ kind: "image", url: pimg.src, imageUrl: pimg.src, title: "check-up share", promptText: "check-up share prompt", text: "🔥 test" });
      var ov = await waitFor(function () { return window.__dragonShareOv; }, TIMEOUT, 120);
      if (!ov) fail("the share window did not open");
      var eb = q("[data-dragon-share-edit]", ov);
      if (!eb) fail("the share window has no ✎ Edit button (Egon asked to edit before sending)");
      if (eb) eb.click();
      var pv = await waitFor(function () { return document.getElementById("dragonPrintPreview"); }, TIMEOUT, 150);
      if (!pv) fail("the ✎ Edit button did not open our editor");
      if (pv) {
        if (!q("[data-pp='use']", pv)) fail("in share mode the primary button must be \"✔ Use this picture\"");
        if (q("[data-pp='print']", pv)) fail("in share mode the print button must give way to \"✔ Use this picture\"");
        // Egon 23.09.2026 — nothing sits on the paper until its chip is pressed, so the share prompt is
        // proved by pressing 📝 Add prompt (the same rule the print editor follows).
        var apB = q("[data-pp='add-prompt']", pv);
        if (!apB) fail("the share editor has no 📝 Add prompt chip");
        var sBox = q(".dpp-box[data-box='prompt']", pv);
        if (!sBox) fail("the share editor's sheet has no prompt box");
        if (sBox && getComputedStyle(sBox).display !== "none") fail("the share editor must start with an EMPTY sheet too (Egon: badge-less until pressed)");
        if (apB) apB.click();
        await sleep(150);
        var pb = q(".dpp-box[data-box='prompt'] [data-txt]", pv);
        if (!pb || pb.textContent.indexOf("check-up share prompt") === -1) fail("the share window's prompt did not reach the editor (the box reads \"" + ((pb && pb.textContent) || "") + "\")");
        var cbk = q("[data-pp='cancel']", pv);
        if (cbk) cbk.click();
        await sleep(140);
        if (document.getElementById("dragonPrintPreview")) fail("Cancel did not close the share editor");
      }
    } finally {
      try { var p2 = document.getElementById("dragonPrintPreview"); if (p2 && p2.parentNode) p2.parentNode.removeChild(p2); } catch (e) {}
      try { if (window.__dragonShareOv && window.__dragonShareOv.parentNode) window.__dragonShareOv.parentNode.removeChild(window.__dragonShareOv); } catch (e) {}
    }
    return "the share window carries \"✎ Edit before sharing\", which opens the very same editor in share mode (\"✔ Use this picture\" as the primary action, the prompt already on the sheet) — nothing is uploaded by this test";
  }


  // 🗂️ Egon 22.09.2026 — "they disappear, how will I find these again? at least a db record in settings
  // falan tutulsun" — the BLOCK LOG. Both blocklists are written with the moment they were blocked, the
  // ⚙️ Settings card renders them NEWEST FIRST with that stamp, and the screen can always be read back.
  // Fully reversible: the check writes one fake record and restores the real lists in a finally block.
  async function checkBlockedLog() {
    ["dragonBlockedStamp", "dragonBlockedUserInfoGet", "dragonBlockedUserInfoSet", "dragonBlockedUserInfoDel",
     "dragonBlockedSortNewest", "dragonBuildBlockedCard", "dragonBlockedCardSync"].forEach(function (k) {
      if (typeof window[k] !== "function") fail("window." + k + "() is missing");
    });
    var stamp = window.dragonBlockedStamp(Date.UTC(2026, 8, 22, 17, 5));
    if (!/^\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}$/.test(stamp)) fail("dragonBlockedStamp() must print DD.MM.YYYY HH:MM, got \"" + stamp + "\"");
    if (window.dragonBlockedStamp(0) !== "\u2014") fail("an entry with no timestamp must read \"\u2014\", never a made-up time");
    var info = { "old-fake": { t: Date.UTC(2026, 0, 1) }, "new-fake": { t: Date.UTC(2026, 8, 22) } };
    var sorted = window.dragonBlockedSortNewest(["old-fake", "new-fake", "none-fake"], function () { return info; });
    if (sorted.join(",") !== "new-fake,old-fake,none-fake") fail("newest-first ordering is wrong: " + sorted.join(","));
    var u0 = null, uinfo0 = null, holder = null;
    try {
      try { u0 = localStorage.dragonBlockedUsers; } catch (e) {}
      try { uinfo0 = localStorage.dragonBlockedUserInfo || null; } catch (e) {}
      var fakeT = Date.now();
      var fakeStamp = window.dragonBlockedStamp(fakeT);
      window.dragonBlockedUserInfoSet("checkup-fake-uid", { t: fakeT, n: 3, h: "FAKE-HANDLE" });
      var rec = window.dragonBlockedUserInfoGet()["checkup-fake-uid"];
      if (!rec || Number(rec.n) !== 3 || rec.h !== "FAKE-HANDLE") fail("the uploader record did not store n/h");
      window.dragonBlockedAdd("checkup-fake-uid");
      if (JSON.parse(localStorage.dragonBlockedUsers || "[]").indexOf("checkup-fake-uid") === -1) fail("dragonBlockedAdd() did not write the block");
      var card = window.dragonBuildBlockedCard();
      holder = document.createElement("div");
      holder.style.cssText = "position:fixed; left:-10000px; top:0;";
      holder.appendChild(card);
      document.body.appendChild(holder);
      var rows = card.querySelectorAll("#dragonBlockedUserList > div");
      if (!rows.length) fail("the ⚙️ Settings blocked card renders no uploader rows");
      var first = rows[0].textContent || "";
      if (first.indexOf("blocked " + fakeStamp) === -1) fail("the first blocked row does not carry its block date+time (" + fakeStamp + " vs \"" + first.slice(0, 60) + "\")");
      if (first.indexOf("hid 3") === -1) fail("the blocked row does not report how many pictures it hid");
      if ((card.querySelector(".dragon-set-h") || {}).textContent === undefined) fail("the card has no header");
      // 🚫 Egon 20.09.2026 — the card is an ACCORDION now ("panel should open and close with a button"):
      // the header toggles the body, the marker follows, the state survives, and an uploader row prints a
      // SHORT handle instead of a 64-hex id.
      if (typeof window.dragonBlockedShortLabel !== "function") fail("window.dragonBlockedShortLabel() is missing");
      var _sl = window.dragonBlockedShortLabel("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef", {});
      if (!_sl || _sl.length > 26 || _sl.indexOf("\u2026") === -1) fail("dragonBlockedShortLabel() must shorten a 64-hex uploader id, got \"" + _sl + "\"");
      var headEl = card.querySelector("#dragonBlockedHead"), bodyEl = card.querySelector(".dragon-set-body");
      if (!headEl || !bodyEl) fail("the blocked card has no collapsible header/body");
      var openKey0 = null;
      try { openKey0 = localStorage.getItem("dragonBlockedCardOpen"); } catch (e) {}
      var wasOpen = bodyEl.style.display !== "none";
      headEl.onclick();
      var nowOpen = bodyEl.style.display !== "none";
      if (nowOpen === wasOpen) fail("tapping the 🚫 Blocked header did not collapse/expand the list");
      var chev = card.querySelector("#dragonBlockedChev");
      if (!chev || !chev.textContent) fail("the header shows no open/closed marker");
      headEl.onclick();
      if ((bodyEl.style.display !== "none") !== wasOpen) fail("the second tap did not put the card back");
      try { if (openKey0 === null) localStorage.removeItem("dragonBlockedCardOpen"); else localStorage.setItem("dragonBlockedCardOpen", openKey0); } catch (e) {}
    } finally {
      try { window.dragonBlockedRemove("checkup-fake-uid"); } catch (e) {}
      try { window.dragonBlockedUserInfoDel("checkup-fake-uid"); } catch (e) {}
      try { if (u0 === null) delete localStorage.dragonBlockedUsers; else localStorage.dragonBlockedUsers = u0; } catch (e) {}
      try { if (uinfo0 === null) delete localStorage.dragonBlockedUserInfo; else localStorage.dragonBlockedUserInfo = uinfo0; } catch (e) {}
      if (holder && holder.parentNode) holder.parentNode.removeChild(holder);
    }
    return "record t/n/h stored, newest-first order held, the Settings row read \"blocked " + stamp + "\", real lists restored";
  }

  // 🔍 Egon 23.09.2026 — the old "🔍 Find A Button" AND the old "📖 Legends" button are now ONE window:
  // "🔍 Buttons & Legends". Its single search box narrows BOTH the live controls of the whole generator
  // (built from the live DOM, never a fixed list) AND the legends directory below it; the useless ▶ chip
  // is gone, and picking a row opens the right page, scrolls the control into view and flashes it.
  async function checkSiteSearch() {
    if (typeof window.dragonOpenSiteSearch !== "function") fail("window.dragonOpenSiteSearch() must stay as the entry point of the merged window");
    if (typeof window.dragonSiteSearchIndex !== "function") fail("window.dragonSiteSearchIndex() is missing");
    var nav = qa(".dragon-nav-item").filter(function (e) { return e.dataset && e.dataset.navPage === "account"; })[0];
    if (nav) nav.click();
    var card = await waitFor(function () { return document.querySelector(".dragon-set-board"); }, TIMEOUT * 2, 250);
    if (!card) fail("the Settings board did not open, so the 🔍 button cannot be checked");
    // the merged panel is built together with the Settings board (that is where the legends live)
    if (typeof window.dragonOpenLegends !== "function") fail("window.dragonOpenLegends() is missing (the merged 🔍 Buttons & Legends window)");
    var btn = qa(".dragon-set-board button").filter(function (b) { return /Buttons & Legends/i.test(b.textContent || ""); })[0];
    if (!btn) fail("the Settings board has no 🔍 Buttons & Legends button");
    var soloLegends = qa(".dragon-set-board button").filter(function (b) { return /📖/.test(b.textContent || ""); })[0];
    if (soloLegends) fail("the separate 📖 Legends button must be gone — legends live inside 🔍 Buttons & Legends now (Egon)");
    var full = window.dragonSiteSearchIndex();
    if (full.length < 200) fail("the live index is suspiciously small (" + full.length + " controls)");
    if (!full.some(function (c) { return c.go; })) fail("the index carries no top-level pages");
    var ss = full.filter(function (c) { return /screen saver/i.test(c.lb || "") || /screen saver/i.test(c.kw || ""); });
    if (!ss.length) fail("the index cannot find the Screen Saver control Egon was looking for");
    // Egon 10.10.2026 — ONE symbol per Buttons & functions row: the icon column carries the button's
    // own mark, so the DISPLAY label must carry no emoji at all (buttons keep their design, mirrored
    // pairs included — only the row is tidied; search still reads the full label).
    if (typeof window.dragonFindStripEmoji !== "function") fail("window.dragonFindStripEmoji is missing (the single-symbol row rule)");
    var dbl = full.filter(function (c) {
      var t = String(window.dragonFindStripEmoji(c.lb));
      try { return /\p{Extended_Pictographic}/u.test(t); } catch (e) { return false; }
    });
    if (dbl.length) fail(dbl.length + " button row(s) still carry emoji in the display label (e.g. \"" + String(dbl[0].lb).slice(0, 60) + "\")");
    // the old name must still open the same window
    window.dragonOpenSiteSearch();
    var alias = await waitFor(function () { return document.getElementById("dragonLegendsOverlay"); }, TIMEOUT, 120);
    if (!alias) fail("window.dragonOpenSiteSearch() no longer opens the merged window");
    try { alias.remove(); } catch (e) {}
    if (typeof window.dragonSettingsTab === "function") window.dragonSettingsTab("tools");   // the button lives in the 🧰 tab now
    btn.click();
    var ov = await waitFor(function () { return document.getElementById("dragonLegendsOverlay"); }, TIMEOUT, 120);
    if (!ov) fail("pressing 🔍 Buttons & Legends did not open the merged window");
    var inp = ov.querySelector("input");
    if (!inp) fail("the merged window has no search input");
    inp.value = "screen";
    inp.dispatchEvent(new Event("input", { bubbles: true }));
    await sleep(150);
    var rows = qa("div", ov).filter(function (d) { return d.style && d.style.cursor === "pointer"; });
    if (!rows.length) fail("typing \"screen\" matched no button row");
    var all = rows.map(function (r) { return r.textContent || ""; }).join(" | ");
    if (!/screen saver/i.test(all)) fail("the \"screen\" results never mention the Screen Saver: " + all.slice(0, 140));
    var play = qa("button", ov).filter(function (b) { return (b.textContent || "").trim() === "▶"; });
    if (play.length) fail("the old ▶ (go / activate) chip must be gone from every row (Egon: gereksiz)");
    var legHead = ov.querySelector("#dragonLegendsSecHead");
    if (!legHead) fail("the merged window shows no 📖 Legends section");
    var legRows = qa("div", ov).filter(function (d) { return d.style && d.style.minWidth === "6.6rem"; });
    if (legRows.length < 1) fail("the legends directory did not render in the merged window (its search must filter it too)");
    var target = rows.filter(function (r) { return /screen saver/i.test(r.textContent || ""); })[0] || rows[0];
    var wantTxt = String(target.textContent || "").split("in:")[0].replace(/^[^A-Za-z0-9]+/, "").trim().slice(0, 10);
    target.click();
    await sleep(560);
    if (document.getElementById("dragonLegendsOverlay")) fail("the merged window stayed open after a hit was chosen");
    var fl = document.querySelector(".dragon-find-flash");
    if (!fl) fail("the chosen control was never flashed yellow");
    if (wantTxt && String(fl.textContent || "").toLowerCase().indexOf(wantTxt.toLowerCase().slice(0, 6)) === -1) fail("the flashed control is not the searched one (wanted \"" + wantTxt + "\", flashed \"" + String(fl.textContent).slice(0, 40) + "\")");
    await sleep(200);
    return "ONE 🔍 Buttons & Legends window: " + full.length + " live controls indexed (incl. the Screen Saver one), its box also narrows the 📖 Legends directory (" + legRows.length + " legend rows under \"screen\"), no ▶ chip on the rows, alias window.dragonOpenSiteSearch() kept, and the chosen hit was scrolled to and flashed";
  }

  // 💬 Egon 23.09.2026 — the picture COMMENT SYSTEM. Nothing to do with comments-plugin / the chat: our own
  // panel, our own server region. This check proves the module is loaded with its whole API, that a picture's
  // key is stable and per-picture, that the panel really opens and closes, and that the tile badge is painted
  // from the server's own count. It never posts a comment (the server's own rate limits are not touched).
  async function checkPictureComments() {
    ["dragonCommentsOpen", "dragonCommentsClose", "dragonCommentsKey", "dragonCommentsBadges", "dragonSharedSocket", "dragonPopover",
     "dragonCommentsRepaint", "dragonCommentsCountOf", "dragonCommentsPrefetch", "dragonCommentName", "dragonCommentUid"].forEach(function (k) {
      if (typeof window[k] !== "function") fail("window." + k + "() is missing (src/dragon-comments.js not loaded?)");
    });
    var k1 = window.dragonCommentsKey({ imageId: "abc123" });
    var k2 = window.dragonCommentsKey({ url: "https://example.com/x.jpg" });
    if (k1 !== "abc123") fail("the key of an id-carrying picture must be its id, got \"" + k1 + "\"");
    if (!k2 || k2 === k1) fail("a picture without an id must fall back to its own url");
    // 🪪 Egon 23.09.2026 — the visitor posts under their own SYSTEM name, and the id the server enforces
    // "one comment per visitor" with is a STABLE random value that never leaves the browser raw.
    var nm = String(window.dragonCommentName() || "").trim();
    if (!nm) fail("dragonCommentName() returned nothing (the system name must always resolve, even for a guest)");
    var u1 = window.dragonCommentUid(), u2 = window.dragonCommentUid();
    if (!u1 || typeof u1 !== "string") fail("dragonCommentUid() returned nothing");
    if (u1 !== u2) fail("the visitor's comment id changed between two calls — it must be stable (localStorage)");
    if (u1 === nm) fail("the visitor's comment id must be an opaque value, not the display name");
    if (window.dragonCommentsCountOf("checkup-unknown-key") !== -1) fail("dragonCommentsCountOf() must answer -1 for a picture whose count is not known yet");
    var pf = window.dragonCommentsPrefetch([]);
    if (!pf || typeof pf.then !== "function") fail("dragonCommentsPrefetch() must return a promise (the gallery awaits it before painting a slice)");
    window.dragonCommentsOpen({ imageId: "checkup-comment-target", url: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" });
    var panel = await waitFor(function () { return document.getElementById("dragonCm"); }, TIMEOUT, 120);
    if (!panel) fail("the 💬 panel did not open");
    var sendB = panel.querySelector(".dcm-send");
    if (!sendB) fail("the 💬 panel has no Send button");
    if (!panel.querySelector("textarea")) fail("the 💬 panel has no comment box");
    // 🪪 Egon 23.09.2026 — "Name should not be editable. system name should be given to the user." The nickname box that
    // used to live in the footer is GONE (asserted both ways: no text input, and the name is SHOWN as a
    // fact in the 🪪 chip instead).
    var inputs = qa("input", panel).filter(function (i) { return i.type !== "range" && i.type !== "checkbox"; });
    if (inputs.length) fail("the 💬 panel still carries an editable name/title input (" + inputs.length + ") — Egon removed the Name box in favour of the visitor's system name");
    var chip = qa("span", panel).filter(function (s) { return /^\uD83E\uDEAA\s+\S/.test(String(s.textContent || "").trim()); })[0];
    if (!chip) fail("the 💬 panel does not show the 🪪 system-name chip");
    if (String(chip.textContent).trim() !== "\uD83E\uDEAA " + nm) fail("the 🪪 chip must show the visitor's own system name (expected \"\uD83E\uDEAA " + nm + "\", got \"" + String(chip.textContent).trim() + "\")");
    if (!/one comment per picture/i.test(panel.textContent || "")) fail("the 💬 panel must tell the visitor they may post ONE comment per picture (and edit it) — that promise is missing");
    if (!/edit/i.test(panel.textContent || "")) fail("the 💬 panel must say the visitor can edit their own comment");
    window.dragonCommentsClose();
    await sleep(200);
    if (document.getElementById("dragonCm")) fail("dragonCommentsClose() left the panel on screen");
    return "the 💬 comment module is loaded (open/close/badges/key/shared socket/popover/counts/prefetch/name/uid), the panel has NO name box \u2014 it shows \u201C\uD83E\uDEAA " + nm + "\u201D plus the one-comment/editable note \u2014 and the visitor's id is stable";
  }

  // 🖼️ Egon 23.09.2026 — both new gallery checks below may run FIRST (a focused `only` run), so they bring
  // the gallery up themselves instead of assuming `public-gallery` already did. The listing is fetched
  // through the proxy and takes 22-26s cold, so the wait is the same 4x budget checkPublicGallery uses, and
  // an empty first attempt forces one clean re-render (the plugin's open flag early-returns otherwise).
  async function galTilesReady() {
    window.dragonGoPage("gallery");
    var t = await waitFor(function () { var a = qa(".dragon-gal-tile"); return a.length ? a : null; }, TIMEOUT * 4, 250);
    if (t) return t;
    var gal = q("#imageGalleryCtn8569284");
    if (gal) gal.dataset.dragonOpen = "";
    window.dragonGoPage("gallery");
    t = await waitFor(function () { var a = qa(".dragon-gal-tile"); return a.length ? a : null; }, TIMEOUT * 2, 250);
    if (!t) fail("no public gallery tiles rendered (the listing never arrived)");
    return t;
  }

  // 💬⭐ Egon 23.09.2026 — THE IMAGE SORT MENU grew two LOCAL modes ("Commented" and "Liked") and its button
  // finally NAMES itself ("Image Sort"). The two new modes are filters over the listing, not perchance sort
  // orders, so the honest test is behavioural: pick the mode and check what the grid is allowed to contain.
  async function checkImageSort() {
    await galTilesReady();
    var sortSel = await waitFor(function () {
      var sels = qa("select");
      for (var i = 0; i < sels.length; i++) {
        var txt = Array.prototype.map.call(sels[i].options, function (o) { return o.textContent; }).join("|");
        if (txt.indexOf("Best") !== -1 && txt.indexOf("Trending") !== -1) return sels[i];
      }
      return null;
    }, TIMEOUT * 2, 250);
    if (!sortSel) fail("the image sort menu (Best/Recent/Trending/\u2026) is missing from the toolbar");
    var labels = Array.prototype.map.call(sortSel.options, function (o) { return String(o.textContent).trim(); });
    var want = ["🏆 Best", "🔜 Recent", "🔥 Trending", "⭐ Liked"];
    var values = Array.prototype.map.call(sortSel.options, function (o) { return o.value; });
    var wantV = ["top", "recent", "trending", "liked"];
    for (var i = 0; i < want.length; i++) {
      if (labels[i] !== want[i]) fail("image sort row " + (i + 1) + " must be \u201C" + want[i] + "\u201D, got \u201C" + labels[i] + "\u201D");
      if (values[i] !== wantV[i]) fail("image sort row " + (i + 1) + " must carry the value \u201C" + wantV[i] + "\u201D, got \u201C" + values[i] + "\u201D");
    }
    if (sortSel.options.length !== 4) fail("the image sort menu must offer exactly 4 modes, got " + sortSel.options.length);
    var wrap = sortSel.parentElement || null;
    var btn = wrap ? wrap.querySelector("button") : null;
    if (!btn) fail("the image sort control has no visible button (dragonModernSel did not wrap the select)");
    if (String(btn.title) !== "Image Sort") fail("the image sort BUTTON's tooltip must be exactly \u201CImage Sort\u201D (the hidden <select>'s title has to reach the visible button), got \u201C" + btn.title + "\u201D");
    // 🎨 Egon 25.09.2026 — the ⓘ beside every row is a tiny ROUND badge (Designbook §5: nothing in the
    // generator has hard corners) and the popup itself is painted from the THEME TOKENS, so switching the
    // theme really repaints it — it used to carry its own fixed navy/gold design.
    var infoBadge = "";
    try {
      btn.click();
      var popEl = await waitFor(function () {
        return qa("div").filter(function (d) { return d.getAttribute("data-dragon-info-rows") === "1"; })[0] || null;
      }, 3000, 100);
      if (!popEl) fail("the image sort popup did not open (no [data-dragon-info-rows])");
      var badges = qa("button", popEl).filter(function (b) { return String(b.textContent).trim() === "i"; });
      if (badges.length < 4) fail("every image sort row must carry its own mini \u24D8 badge (found " + badges.length + ")");
      var br = badges[0].getBoundingClientRect();
      var bc = window.getComputedStyle(badges[0]);
      if (br.width > 20 || br.height > 20) fail("the \u24D8 badge must stay MINI (got " + Math.round(br.width) + "x" + Math.round(br.height) + " px)");
      if (Math.abs(br.width - br.height) > 2.5) fail("the \u24D8 badge must be a circle, got " + Math.round(br.width) + "x" + Math.round(br.height));
      if (String(bc.borderRadius).indexOf("50%") === -1) fail("the \u24D8 badge must be round (border-radius " + bc.borderRadius + " \u2014 it used to be a square box with a border-left)");
      if (bc.borderLeftWidth !== bc.borderTopWidth) fail("the \u24D8 badge still carries the old square box's heavy left edge");
      var pbg = window.getComputedStyle(popEl).backgroundColor;
      if (pbg === "rgb(22, 22, 29)") fail("the image sort popup still paints the fixed #16161d navy instead of the theme tokens");
      infoBadge = "the mini \u24D8 badge is round (" + Math.round(br.width) + "px, radius " + bc.borderRadius + ") and the menu is theme-painted (" + pbg + ")";
    } finally {
      try { btn.click(); } catch (eClose) {}   // close the menu again
      // 🧭 Egon 25.09.2026 — leave no trace: the menu rebuilds its rows on every open (buildList), so
      // clearing them here keeps later checks (which read the surrounding DOM) from counting its ⓘ rows.
      try {
        var _popLeft = qa("div").filter(function (d) { return d.getAttribute("data-dragon-info-rows") === "1"; })[0];
        if (_popLeft && _popLeft.firstElementChild) _popLeft.firstElementChild.textContent = "";
      } catch (eClearInfo) {}
    }
    var prevVal = null, prevIdx = sortSel.selectedIndex;
    try { prevVal = localStorage.getItem("dragonGallerySort"); } catch (e) {}
    var out = [];
    try {
      // 🔥 Trending is perchance's own ordering again (Egon 03.10.2026) — it only has to render tiles.
      sortSel.value = "trending";
      sortSel.dispatchEvent(new Event("change", { bubbles: true }));
      await waitFor(function () { return qa(".dragon-gal-tile").length > 0; }, 6000, 200);
      await sleep(400);
      var t3 = qa(".dragon-gal-tile");
      out.push("🔥 Trending → " + t3.length + " tile(s), perchance's own ordering");
      // ⭐ Liked is back (W-LIKEDSORT): the GLOBAL ranking decides, not the page order — proven end
      // to end on two REAL tiles with throwaway visitors (unvoted afterwards, so every count is
      // byte-identical to before; the head cache from the Recent view below makes this fast).
      sortSel.value = "recent";
      sortSel.dispatchEvent(new Event("change", { bubbles: true }));
      await waitFor(function () { return qa(".dragon-gal-tile").length >= 2; }, 8000, 200);
      var _rt = qa(".dragon-gal-tile");
      var _u1 = (_rt[0]._t && _rt[0]._t.url) || "", _u2 = (_rt[1]._t && _rt[1]._t.url) || "";
      if (!_u1 || !_u2 || _u1 === _u2) fail("could not read two gallery tile urls for the liked-order probe");
      var _k1 = window.dragonLikeKey(_u1), _k2 = window.dragonLikeKey(_u2);
      var _va = "checkup-oa-" + Math.random().toString(36).slice(2, 8);
      var _vb = "checkup-ob-" + Math.random().toString(36).slice(2, 8);
      async function _v(k, u, d) {
        var r = await window.dragonServerRpc("dragonLikeVote", JSON.stringify({ i: k, u: u, d: d }));
        var o = null;
        try { o = JSON.parse(r); } catch (e) { o = null; }
        if (!o || !o.ok) fail("a liked-order probe vote was refused");
      }
      await _v(_k1, _va, 1); await _v(_k2, _va, 1); await _v(_k2, _vb, 1);
      sortSel.value = "liked";
      sortSel.dispatchEvent(new Event("change", { bubbles: true }));
      var _p1 = -1, _p2 = -1;
      try {
      await waitFor(function () {
        var t = qa(".dragon-gal-tile"), a = -1, b = -1;
        for (var i = 0; i < t.length; i++) {
          var u = (t[i]._t && t[i]._t.url) || "";
          if (u === _u1 && a < 0) a = i;
          if (u === _u2 && b < 0) b = i;
        }
        if (a >= 0 && b >= 0) { _p1 = a; _p2 = b; return true; }
        return false;
      }, 90000, 500);
      } finally {
        // Egon 10.10.2026: the probe votes always go back, even when the wait above throws
        try { await _v(_k1, _va, 0); } catch (eU1) {}
        try { await _v(_k2, _va, 0); } catch (eU2) {}
        try { await _v(_k2, _vb, 0); } catch (eU3) {}
      }
      if (_p1 < 0 || _p2 < 0) fail("the ⭐ Liked view painted no tiles for two freshly liked pictures");
      if (!(_p2 < _p1)) fail("the ⭐ Liked view is not globally ordered (the 2-vote picture is not above the 1-vote picture)");
      out.push("⭐ Liked → global order proven live (2-vote picture above the 1-vote picture, then unvoted clean)");
    } finally {
      // the visitor's own sort choice comes back byte-exact, and the grid is re-listed with it
      try { sortSel.value = values[prevIdx] || "recent"; } catch (e) {}
      try { sortSel.dispatchEvent(new Event("change", { bubbles: true })); } catch (e) {}
      try { if (prevVal === null) localStorage.removeItem("dragonGallerySort"); else localStorage.setItem("dragonGallerySort", prevVal); } catch (e) {}
      await sleep(500);
    }
    return "sort rows " + labels.join(" \u00B7 ") + "; button tooltip \u201C" + btn.title + "\u201D; " + out.join("; ") + "; " + infoBadge + "; the visitor's own sort restored";
  }

  // ⭐ Egon 23.09.2026 — "every image gets a like score (stored on server) as the like button is pressed and
  // it is then sorted based on this score". The counter is a real server region now, so the honest test
  // drives the RPC end to end with a throwaway key (no real picture is touched, nothing is left behind):
  // one visitor = one point, a repeat press changes nothing, a second visitor makes two, un-starring
  // takes the point back, and a picture with no likes is simply absent from the counts payload.
  async function checkLikedCount() {
    var hooks = ["dragonLikeVote", "dragonLikeCountOf", "dragonLikePrefetch", "dragonLikeBadges", "dragonLikeKey", "dragonLikeTop", "dragonLikeServerTag"];
    for (var i = 0; i < hooks.length; i++) if (typeof window[hooks[i]] !== "function") fail("window." + hooks[i] + " is missing (src/dragon-likes.js did not load)");
    if (typeof window.dragonServerRpc !== "function") fail("window.dragonServerRpc is missing (the shared server rpc path, rule I104)");
    var k1 = window.dragonLikeKey("https://example.invalid/a.jpg");
    var k2 = window.dragonLikeKey("https://example.invalid/a.jpg");
    if (!k1 || k1 !== k2) fail("dragonLikeKey must be stable and non-empty for one picture");
    var key = "checkup-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
    var va = "checkup-a-" + Math.random().toString(36).slice(2, 8);
    var vb = "checkup-b-" + Math.random().toString(36).slice(2, 8);
    async function vote(u, d) {
      var raw = await window.dragonServerRpc("dragonLikeVote", JSON.stringify({ i: key, u: u, d: d }));
      var o = null;
      try { o = JSON.parse(raw); } catch (e) { o = null; }
      if (!o || !o.ok) fail("dragonLikeVote refused a plain vote (" + ((o && o.err) || "no answer") + ")");
      return o.c | 0;
    }
    var c1 = await vote(va, 1);
    if (c1 !== 1) fail("the first ⭐ vote must make the count 1, got " + c1);
    var c1b = await vote(va, 1);
    if (c1b !== 1) fail("pressing ⭐ twice must NOT count twice for one visitor (got " + c1b + ")");
    var c2 = await vote(vb, 1);
    if (c2 !== 2) fail("a second visitor's ⭐ must make the count 2, got " + c2);
    var c3 = await vote(va, 0);
    if (c3 !== 1) fail("taking the ⭐ back must drop the count to 1, got " + c3);
    var raw = await window.dragonServerRpc("dragonLikeCounts", key);
    var payload = null;
    try { payload = JSON.parse(raw); } catch (e) {}
    if (!payload || (payload[key] | 0) !== 1) fail("dragonLikeCounts must report this picture as 1, got " + JSON.stringify(payload));
    var c4 = await vote(vb, 0);
    if (c4 !== 0) fail("the last vote back must leave the count at 0, got " + c4);
    var raw2 = await window.dragonServerRpc("dragonLikeCounts", key);
    var payload2 = null;
    try { payload2 = JSON.parse(raw2); } catch (e) {}
    if (payload2 && payload2[key] !== undefined) fail("a picture with no likes must NOT appear in the counts payload (got " + JSON.stringify(payload2) + ")");
    // the client cache: an unknown picture reads -1, and a prefetch turns that into its real count
    var unknownUrl = "https://example.invalid/checkup-" + Date.now().toString(36) + ".jpg";
    if (window.dragonLikeCountOf(unknownUrl) !== -1) fail("an unseen picture must read -1 from the cache before it is fetched");
    await window.dragonLikePrefetch([unknownUrl]);
    if (window.dragonLikeCountOf(unknownUrl) !== 0) fail("after a prefetch an unliked picture must read 0 (got " + window.dragonLikeCountOf(unknownUrl) + ")");
    // W-LIKEDSORT: the global top-1000 ranking, end to end with throwaway keys (no real picture touched).
    var tka = "checkup-top-a-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    var tkb = "checkup-top-b-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    async function tvote(k, u, d) {
      var r = await window.dragonServerRpc("dragonLikeVote", JSON.stringify({ i: k, u: u, d: d }));
      var o = null;
      try { o = JSON.parse(r); } catch (e) { o = null; }
      if (!o || !o.ok) fail("a top-1000 probe vote was refused");
      return o.c | 0;
    }
    await tvote(tka, va, 1); await tvote(tka, vb, 1); await tvote(tkb, va, 1);
    try {
    var topRaw = await window.dragonServerRpc("dragonLikeTop", "");
    var top = null;
    try { top = JSON.parse(topRaw); } catch (e) { top = null; }
    if (!top || !top.ok || !top.top) fail("dragonLikeTop did not answer with a ranking");
    // the ledger speaks server tags, not raw keys (cmtTag double-hash on arrival)
    var ta = window.dragonLikeServerTag(tka), tb = window.dragonLikeServerTag(tkb);
    var ia = -1, ib = -1, ti;
    for (ti = 0; ti < top.top.length; ti++) {
      if (top.top[ti][0] === ta) ia = ti;
      if (top.top[ti][0] === tb) ib = ti;
    }
    if (ia < 0 || ib < 0) fail("the probe pictures are missing from the top-1000");
    if (!(ia < ib)) fail("the top-1000 is not globally ordered (2-vote picture at " + ia + ", 1-vote at " + ib + ")");
    if (top.top[ia][1] !== 2 || top.top[ib][1] !== 1) fail("the top-1000 counts are wrong (got " + top.top[ia][1] + " and " + top.top[ib][1] + ")");
    for (ti = 1; ti < top.top.length; ti++) if (top.top[ti][1] > top.top[ti - 1][1]) fail("the top-1000 is not sorted most-first (break at " + ti + ")");
    } finally {
      // Egon 10.10.2026: the probe votes always go back, even when an assert above throws
      try { await tvote(tka, va, 0); } catch (eW1) {}
      try { await tvote(tka, vb, 0); } catch (eW2) {}
      try { await tvote(tkb, va, 0); } catch (eW3) {}
    }
    return "one visitor = one point (repeat press stayed 1, second visitor 2, un-star 1 (repeat press stayed 1, second visitor 2, un-star 1 \u2192 0), empty pictures stay out of the payload, cache -1 \u2192 0 after a prefetch, top-1000 globally ordered (2 before 1, most-first)";
  }

  // 🖼️ W-GALTOP (Egon 10.10.2026) — the maintained per-gallery top lists: votes WITH context register
  // their picture (url+gallery+rating) and keep that gallery's lists ordered; unvoting to zero drops the
  // picture; count-only votes never register; adopt teaches urls for held votes. One fixed scratch
  // gallery ("checkup") claims one slot once and is reused forever; every probe vote is taken back, so
  // nothing with a count is left behind (registry records stay, as designed).
  async function checkGalleryTop() {
    var hooks = ["dragonGalleryTop", "dragonGalleryAdoptSend", "dragonLikeServerTag", "dragonLikeKey"];
    for (var i = 0; i < hooks.length; i++) if (typeof window[hooks[i]] !== "function") fail("window." + hooks[i] + " is missing (src/dragon-likes.js did not load)");
    var G = "checkup", U = "https://aigc.uploads.dev/image/checkup-gt-";
    var stamp = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    var ka = "checkup-gt-a-" + stamp, kb = "checkup-gt-b-" + stamp, kd = "checkup-gt-d-" + stamp;
    var va = "checkup-gt-va-" + stamp, vb = "checkup-gt-vb-" + stamp;
    // Egon 10.10.2026: stamped urls per run — a failed run must never poison the next one (fixed urls
    // made leaked votes indistinguishable from fresh ones); every probe vote is taken back in a
    // finally, so this run's pictures hold no live vote afterwards.
    var ua = U + "a-" + stamp + ".jpeg", ub = U + "b-" + stamp + ".jpeg", ud = U + "d-" + stamp + ".jpeg";
    async function gvote(k, u, d, url, r) {
      var p = { i: k, u: u, d: d };
      if (url) { p.l = url; p.g = G; p.r = r; }
      var raw = await window.dragonServerRpc("dragonLikeVote", JSON.stringify(p));
      var o = null;
      try { o = JSON.parse(raw); } catch (e) { o = null; }
      if (!o || !o.ok) fail("a gallery-top probe vote was refused");
      return o.c | 0;
    }
    async function fresh(r, n) {
      // the probe votes below bypass the client's own vote path (raw RPC), so drop its 30 s cache
      // explicitly before every read — a real visitor's own star press invalidates it by itself
      window.dragonGalleryTopForget();
      return await window.dragonGalleryTop(G, r, n);
    }
    function posOf(t, url) {
      for (var pi = 0; pi < t.length; pi++) if (t[pi].u === url) return pi;
      return -1;
    }
    try {
    await gvote(ka, va, 1, ua, 0); await gvote(ka, vb, 1, ua, 0);
    await gvote(kb, va, 1, ub, 0);
    var t = await fresh(0, 50);
    var ca = posOf(t, ua), cb = posOf(t, ub);
    if (ca < 0 || cb < 0) fail("the maintained gallery top lists fewer than the 2 voted pictures");
    if (!(ca < cb)) fail("the maintained gallery top is not score-ordered with urls (2-vote picture not above 1-vote picture)");
    if ((t[ca].c | 0) !== 2 || (t[cb].c | 0) !== 1) fail("the maintained gallery top counts are wrong");
    await gvote(kb, va, 0, ub, 0);
    var t2 = await fresh(0, 50);
    if (posOf(t2, ub) >= 0) fail("an unvoted picture must drop out of the maintained list");
    // count-only vote registers nothing, adopt teaches it afterwards
    await gvote(kd, va, 1, null, 0);
    var t3 = await fresh(0, 50);
    for (var ti = 0; ti < t3.length; ti++) if ((t3[ti].c | 0) === 1 && t3[ti].u === ud) fail("a count-only vote must not appear in the maintained list");
    var tagD = window.dragonLikeServerTag(kd);
    var ad = null, adRaw = "";
    for (var ar = 0; ar < 8; ar++) {
      adRaw = await window.dragonServerRpc("dragonGalleryAdopt", JSON.stringify({ a: [[tagD, ud, G, 1]] }));
      try { ad = JSON.parse(adRaw); } catch (e) { ad = null; }
      // the page's own backfill (one batch per 11 s while it still has urls to teach) may own the
      // 10 s adopt gate — wait it out; it always ends (finite entries per gallery view)
      if (!ad || ad.err !== "rate") break;
      await sleep(12000);
    }
    if (!ad || !ad.ok || (ad.added | 0) !== 1) fail("dragonGalleryAdopt refused a well-formed batch (" + String(adRaw).slice(0, 80) + ")");
    var t4 = await fresh(1, 10);
    var found = false;
    for (var ti4 = 0; ti4 < t4.length; ti4++) if (t4[ti4].u === ud && (t4[ti4].c | 0) === 1) found = true;
    if (!found) fail("an adopted picture must join its rating's maintained list");
    } finally {
      try { await gvote(ka, va, 0, ua, 0); } catch (eC1) {}
      try { await gvote(ka, vb, 0, ua, 0); } catch (eC2) {}
      try { await gvote(kb, va, 0, ub, 0); } catch (eC3) {}
      try { await gvote(kd, va, 0, null, 0); } catch (eC4) {}
    }
    var t5 = await fresh(0, 50);
    if (posOf(t5, ua) >= 0 || posOf(t5, ub) >= 0 || posOf(t5, ud) >= 0) fail("this run's probe pictures must leave the maintained list");
    return "votes with context keep " + G + "/G ordered with urls (2 before 1), unvoted pictures drop out, count-only votes stay unlisted until adopted, adopt taught 1 url";
  }

  // 📐 Egon 23.09.2026 — "the gallery selection menu button in the 1st row of the mobile public gallery toolbar
  // should be longer, positioned xx to the right and xx to the left of the total length of the buttons in the 2nd row
  // and center the selected gallery text on the button" + "… since it became a collapsed toolbar twin, it should also show this
  // change accordingly". The check reads the app's OWN mobile rule
  // (window.dragonIsMobileView) and measures what the visitor sees, on both sides of the breakpoint.
  // 📡⭐ Egon 23.09.2026 — the ⭐ counts are LIVE: a vote cast anywhere (another device, another browser)
  // reaches an open gallery through the server's pub/sub topic instead of waiting out the 60 s count
  // cache, and every rebuilt view FORGETS that cache, so the Refresh Gallery button and a sort switch
  // really re-read the truth (this is exactly the F5 bug Egon hit and reported). Measured with a fixed
  // throwaway picture, so no real one is touched and repeated runs reuse the same probe.
  async function checkLikesLive() {
    var hooks = ["dragonLikeLive", "dragonLikeLiveState", "dragonLikeForget", "dragonSharedTopic"];
    for (var i = 0; i < hooks.length; i++) if (typeof window[hooks[i]] !== "function") fail("missing hook " + hooks[i]);
    await galTilesReady();                                  // the gallery's own FIRST load must switch the channel on
    var live = window.dragonLikeLiveState();
    if (!live.subscribed || live.users.indexOf("gallery") === -1) fail("a gallery on screen does not hold the live \u2B50 channel (" + JSON.stringify(live) + ")");
    var probe = "https://checkup.invalid/likes-live-probe.jpg";
    var key = window.dragonLikeKey(probe);
    var voter = "checkup-live";
    await window.dragonServerRpc("dragonLikeVote", JSON.stringify({ i: key, u: voter, d: 0 }));   // clean leftovers
    await window.dragonLikePrefetch([probe]);
    if (window.dragonLikeCountOf(probe) !== 0) fail("an unliked picture must read 0 after a prefetch");
    window.dragonLikeForget();
    if (window.dragonLikeCountOf(probe) !== -1) fail("dragonLikeForget must empty the cache (-1), got " + window.dragonLikeCountOf(probe));
    await window.dragonLikePrefetch([probe]);
    var t0 = now(), ms = -1;
    // The legacy vote carries no picture url, so the count is real, nothing is registered anywhere,
    // and the popularity region stays untouched (a url would bank a popularity point for a probe picture).
    await window.dragonServerRpc("dragonLikeVote", JSON.stringify({ i: key, u: voter, d: 1 }));
    for (var w = 0; w < 60; w++) { if (window.dragonLikeCountOf(probe) !== 0) { ms = Math.round(now() - t0); break; } await sleep(100); }
    if (ms < 0) fail("a like cast by another visitor never arrived through the live channel (only the 30 s poll would have found it)");
    await window.dragonServerRpc("dragonLikeVote", JSON.stringify({ i: key, u: voter, d: 0 }));
    var back = false;
    for (var w2 = 0; w2 < 50; w2++) { if (window.dragonLikeCountOf(probe) === 0) { back = true; break; } await sleep(100); }
    if (!back) fail("taking the vote back did not reach this screen (count still " + window.dragonLikeCountOf(probe) + ")");
    return "the gallery holds the live \u2B50 channel (" + JSON.stringify(live.users) + "), a rebuild forgets the count cache, and a foreign like landed here in " + ms + " ms (its removal followed)";
  }

  // ⭐ W-DATA169/B Egon 23.09.2026, retired W-CLEAN374 (09.10.2026) — THE VOTE CONTRACT: the registry
  // back-fill path is gone (no adopt-state hook, no monthly Top feed), so this item now proves the thin
  // contract a like still stands on: the hooks exist, one RPC vote counts exactly one, the plain comma
  // query form answers, and taking the vote back restores zero. Throwaway key, nothing left behind.
  async function checkLikeBackfill() {
    var hooks = ["dragonLikePrefetch", "dragonLikeKey", "dragonServerRpc", "dragonCommentUid", "dragonLikeCountOf", "dragonLikeForget"];
    for (var i = 0; i < hooks.length; i++) if (typeof window[hooks[i]] !== "function") fail("missing hook " + hooks[i]);
    if (typeof window.dragonLikeAdoptState !== "undefined") fail("dragonLikeAdoptState is still exposed (the back-fill path was retired)");
    var probe = "https://checkup.invalid/contract-" + Date.now().toString(36) + ".jpg";
    var key = window.dragonLikeKey(probe);
    var uid = String(window.dragonCommentUid() || "");
    if (!uid) fail("this browser has no visitor id, so a vote could never be accepted");
    async function rpcVote(dir) {
      var raw = await window.dragonServerRpc("dragonLikeVote", JSON.stringify({ i: key, u: uid, d: dir }));
      var o = null;
      try { o = JSON.parse(raw); } catch (e) { o = null; }
      if (!o || !o.ok) fail("dragonLikeVote refused a contract probe vote (" + ((o && o.err) || "no answer") + ")");
      return o.c | 0;
    }
    async function bare() {
      var raw = await window.dragonServerRpc("dragonLikeCounts", key);
      var d = null;
      try { d = JSON.parse(raw); } catch (e) { d = null; }
      return d;
    }
    try {
      if (await rpcVote(1) !== 1) fail("the probe vote must make the count 1");
      await window.dragonLikePrefetch([probe]);
      if (window.dragonLikeCountOf(probe) !== 1) fail("the client cache did not pick the probe vote up (got " + window.dragonLikeCountOf(probe) + ")");
      var b1 = await bare();
      if (!b1 || b1[key] !== 1) fail("the plain count query form no longer answers (" + JSON.stringify(b1) + ")");
      if (await rpcVote(1) !== 1) fail("a repeat press must change nothing (expected count 1)");
      if (await rpcVote(0) !== 0) fail("taking the vote back must restore 0");
      window.dragonLikeForget();
      await window.dragonLikePrefetch([probe]);
      if (window.dragonLikeCountOf(probe) !== 0) fail("the restored zero did not reach the cache (" + window.dragonLikeCountOf(probe) + ")");
    } finally {
      try { await window.dragonServerRpc("dragonLikeVote", JSON.stringify({ i: key, u: uid, d: 0 })); } catch (e) {}
      try { window.dragonLikeForget(); } catch (e) {}
    }
    return "no back-fill hook is exposed anymore; one vote counts exactly one (client cache + plain query form agree), a repeat press changes nothing, taking it back restores 0 (throwaway key, wiped after)";
  }

  async function checkGalMenuFit() {
    await galTilesReady();
    var wrap = await waitFor(function () { return document.querySelector(".dragon-gal-galsel"); }, TIMEOUT * 2, 200);
    if (!wrap) fail("the row-1 gallery menu (.dragon-gal-galsel) is missing");
    var btn = wrap.querySelector(".dragon-gal-galsel-btn");
    if (!btn) fail("the row-1 gallery menu button (.dragon-gal-galsel-btn) is missing");
    var lbl = btn.querySelector("span");
    if (!lbl) fail("the gallery menu button has no label span");
    var mob = (typeof window.dragonIsMobileView === "function") ? window.dragonIsMobileView() : (window.innerWidth <= 760);
    // 📐 Egon 23.09.2026 — measure the PHONE fit only once the app has actually applied it: the fit is
    // scheduled on the frame after the toolbar appears (rAF + 260 ms, plus the page-open hook), and on a warm
    // cache the tiles can be ready before it lands. Asking for it explicitly and letting it settle makes this
    // check measure the bar as the visitor sees it, not a half-fitted one.
    if (mob && typeof window.dragonGalMobileSplit === "function") {
      try { window.dragonGalMobileSplit(); } catch (e) {}
      await sleep(450);
      try { window.dragonGalMobileSplit(); } catch (e) {}
      await sleep(300);
    }
    var r = btn.getBoundingClientRect();
    var centreOff = Math.round((lbl.getBoundingClientRect().left + lbl.getBoundingClientRect().width / 2) - (r.left + r.width / 2));
    if (!mob) {
      // 🧹 no phone residue may survive on a desktop: the mobile fit sets an !important width, centres the
      // wrap and stretches the label — everything it wrote must be gone again (it used to stick because the
      // "did I apply it?" flag was a local that reset on every call).
      var wS = String(wrap.getAttribute("style") || ""), bS = String(btn.getAttribute("style") || ""), lS = String(lbl.getAttribute("style") || "");
      if (/justify-content/i.test(wS)) fail("a phone session left \u201Cjustify-content\u201D on the gallery menu wrap (desktop residue): " + wS);
      if (/width[^;]*!important/i.test(bS) || /max-width[^;]*!important/i.test(bS)) fail("a phone session left an !important width on the gallery menu button (desktop residue): " + bS);
      if (/flex[^;]*!important/i.test(lS) || /text-align[^;]*!important/i.test(lS)) fail("a phone session left !important centring on the gallery menu label (desktop residue): " + lS);
      return "desktop (" + window.innerWidth + "px): the phone fit leaves NO residue on the gallery menu (no !important width / justify-content / label flex); button " + Math.round(r.width) + "px";
    }
    // 📱 the menu must be as wide as the three buttons UNDER it plus GAL_SEL_OVERHANG (18px) on EACH side
    var three = qa("button").filter(function (b) {
      return isVisible(b) && /All Recents|All Random/.test(String(b.textContent || "")) && wrap.parentElement && wrap.parentElement.parentElement && wrap.parentElement.parentElement.contains(b);
    });
    var mini = null;
    var all = qa(".dragon-gal-row1 > *, .dragon-gal-row1 button").filter(function (e) { return isVisible(e) && /Toolbox/i.test(String(e.textContent || "")); })[0] || null;
    var group = three.slice();
    if (all) group.push(all);
    var vis = group.filter(function (g) { return g && g.getBoundingClientRect().width > 0 && g.getBoundingClientRect().top > r.bottom - 2; });
    if (vis.length < 2) fail("the three buttons under the gallery menu (All Recents / Toolbox / All Random) are not on the line below it");
    var l0 = Math.min.apply(null, vis.map(function (g) { return g.getBoundingClientRect().left; }));
    var r0 = Math.max.apply(null, vis.map(function (g) { return g.getBoundingClientRect().right; }));
    var want = Math.round((r0 - l0) + 18 * 2);
    var got = Math.round(r.width);
    if (got > Math.round(document.querySelector(".dragon-gal-row1").getBoundingClientRect().width)) fail("the gallery menu button is wider than its own row (" + got + "px)");
    if (Math.abs(got - want) > 4) fail("the phone's gallery menu must be the width of the three buttons below it + 18px on each side: wanted \u2248" + want + "px (group " + Math.round(r0 - l0) + "px), got " + got + "px");
    if (Math.abs(centreOff) > 3) fail("the selected gallery's label must be CENTRED on the phone's gallery menu button (off by " + centreOff + "px)");
    // 🔽 the collapsed toolbar carries the SAME control — its label must be centred too
    var panel = document.querySelector(".dragon-gal-panel");
    var twinOff = null, twinW = 0;
    if (panel) {
      try {
        panel.classList.add("dragon-gal-collapsed");
        await sleep(450);
        var twinBtn = qa(".dragon-gal-collapse-bar .dragon-col-galsel button")[0] || null;
        if (!twinBtn) fail("the collapsed toolbar has no gallery menu of its own (the twin)");
        var tr = twinBtn.getBoundingClientRect(), tl = twinBtn.querySelector("span").getBoundingClientRect();
        twinOff = Math.round((tl.left + tl.width / 2) - (tr.left + tr.width / 2));
        twinW = Math.round(tr.width);
        if (Math.abs(twinOff) > 3) fail("the collapsed toolbar's twin gallery menu must centre its label the same way (off by " + twinOff + "px)");
        // 🧯 Egon 23.09.2026 (W-UI233) — the bar must never clip a name: a name that does not fit the bar
        // takes the neutral bar name instead ("Other Generator Gallery", window.dragonGalBarFit). So the label
        // must either fit in full or be exactly the neutral name.
        if (typeof window.dragonGalBarFit !== "function") fail("window.dragonGalBarFit() is missing (the W-UI233 bar-name rule)");
        if (tl.width + 1 < twinBtn.querySelector("span").scrollWidth) fail("the collapsed twin's gallery label is clipped (W-UI233: a name that does not fit the bar must take the neutral bar name)");
        var twinTxt = String(twinBtn.querySelector("span").textContent || "").trim();
        if (twinTxt === "Other Generator Gallery" && twinBtn.querySelector("span").scrollWidth > twinBtn.querySelector("span").clientWidth + 1) fail("even the neutral bar name is clipped");
      } finally {
        try { panel.classList.remove("dragon-gal-collapsed"); } catch (e) {}
        await sleep(250);
      }
    }
    return "phone (" + window.innerWidth + "px): menu " + got + "px = group " + Math.round(r0 - l0) + "px + 18px on each side, label centred (off " + centreOff + "px); collapsed twin " + twinW + "px, label centred (off " + twinOff + "px)";
  }

  // 🖌️ Egon 23.09.2026 — the LOCAL RETOUCH BRUSH (src/dragon-brush.js), built because Egon scored the
  // feature 8/10 ("do it if between 7 and 10"). This check opens the editor and sweeps its whole toolset; it
  // deliberately does NOT press ✔ Done — that would upload a file to the visitor's storage on every run.
  async function checkRetouchBrush() {
    if (typeof window.dragonBrushOpen !== "function") fail("window.dragonBrushOpen() is missing (src/dragon-brush.js not loaded?)");
    var c0 = document.createElement("canvas"); c0.width = 12; c0.height = 8;
    var cx0 = c0.getContext("2d"); cx0.fillStyle = "#4466aa"; cx0.fillRect(0, 0, 12, 8);
    window.dragonBrushOpen(c0.toDataURL("image/png"), "check-up brush", function () {});
    var ov = await waitFor(function () { return document.getElementById("dragonBrushOv"); }, TIMEOUT, 120);
    if (!ov) fail("the brush editor did not open");
    var closed = false;
    try {
      var cv = ov.querySelector("canvas");
      if (!cv) fail("the brush editor has no canvas");
      else {
        await waitFor(function () { return cv.width === 12 && cv.height === 8; }, TIMEOUT, 100);
        if (!(cv.width === 12 && cv.height === 8)) fail("the brush canvas was not sized to the picture (" + cv.width + "x" + cv.height + ")");
        // ⚖️ Egon 23.09.2026 — the native crosshair + a second, unrelated circle used to float near the
        // canvas corner; now the ring IS the cursor (canvas cursor:none) and it holds a + in its middle.
        if (getComputedStyle(cv).cursor !== "none") fail("the brush canvas must hide the native cursor (cursor:none) — the ring is the cursor now, got " + getComputedStyle(cv).cursor);
        var ring = null, rl = qa("div", ov).filter(function (d) { return d.textContent === "+" && /50%/.test(d.style.borderRadius || ""); });
        ring = rl[0] || null;
        if (!ring) fail("the brush cursor ring (the circle with a + in it) is missing");
        else {
          var cr = cv.getBoundingClientRect(), stg = cv.parentElement;
          var sp = stg.getBoundingClientRect();
          cv.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, cancelable: true, pointerId: 41, pointerType: "mouse", clientX: cr.left + 40, clientY: cr.top + 30 }));
          await sleep(80);
          var wantL = Math.round(cr.left - sp.left + 40 - parseFloat(ring.style.width) / 2);
          var wantT = Math.round(cr.top - sp.top + 30 - parseFloat(ring.style.height) / 2);
          if (Math.abs(parseFloat(ring.style.left) - wantL) > 2 || Math.abs(parseFloat(ring.style.top) - wantT) > 2) fail("the ring must sit exactly under the pointer (left " + ring.style.left + " vs " + wantL + "px, top " + ring.style.top + " vs " + wantT + "px) — it used to float away near the canvas corner (Egon)");
          // clone mode: a LEFT click before any sample must not draw (it only guides the visitor)
          qa("button", ov).filter(function (b) { return /Clone/.test(b.textContent); })[0].click();
          await sleep(70);
          var before = ring.parentElement.querySelector("canvas").toDataURL().length;
          cv.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 42, pointerType: "mouse", button: 0, buttons: 1, clientX: cr.left + 30, clientY: cr.top + 20 }));
          cv.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, pointerId: 42, pointerType: "mouse", button: 0, buttons: 0, clientX: cr.left + 30, clientY: cr.top + 20 }));
          await sleep(90);
          if (cv.toDataURL().length !== before) fail("a LEFT click without a sample must not paint anything in clone mode (Egon: right-click samples first)");
          // … and a RIGHT click takes the sample, so the picture can be painted afterwards
          cv.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: cr.left + 6, clientY: cr.top + 5 }));
          await sleep(100);
          var dotShown = qa("div", ov).some(function (d) { return /dashed/.test(d.style.border || "") || /dashed/.test(d.getAttribute("style") || ""); });
          if (!dotShown) fail("a right-click must mark the SAMPLE point on the picture (Egon: her right click yeni sample)");
        }
      }
      var labels = qa("button", ov).map(function (b) { return (b.textContent || "").trim(); }).join(" | ");
      ["Paint", "Clone", "Undo", "Reset", "Done"].forEach(function (w) {
        if (labels.indexOf(w) === -1) fail("the brush editor has no \"" + w + "\" button (found: " + labels + ")");
      });
      if (!ov.querySelector("input[type='range']")) fail("the brush has no size slider");
      if (!ov.querySelector("input[type='color']")) fail("the brush has no colour picker");
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      await sleep(260);
      if (document.getElementById("dragonBrushOv")) fail("Escape did not close the brush editor");
      closed = true;
    } finally {
      if (!closed) { try { var o2 = document.getElementById("dragonBrushOv"); if (o2 && o2.parentNode) o2.parentNode.removeChild(o2); } catch (e) {} }
    }
    return "the 🖌️ retouch brush (score 8/10 → built, now living inside the ✏️ Image Editor) opens a full-screen editor: Paint / Clone / ↶ Undo / ↺ Reset / ✔ Done plus a size slider and a colour picker, on a canvas sized to the picture; its cursor ring (circle + \"+\") sits exactly under the pointer, clone mode refuses a left click before a sample and a right click marks the sample, and Escape closes it (✔ Done was NOT pressed — it uploads)";
  }

  // ⛶ Egon 23.09.2026 (rev.2) — the saver's CORNER fullscreen button was REMOVED. Egon: "⛶ saver corner
  // button is still there … does the button appear when the screen saver kicks in? what's the
  // point of putting a button when the screen saver is on, nobody can click it because mouse movement already disables the screen saver. be realistic."
  // He is right — a button inside a screen that ANY input dismisses can never be pressed — so the node and
  // its handlers are gone and the overlay is back to pictures + clock + hint. The saver's two LOOKS are a
  // Settings choice instead (see checkSaverStyle). This test keeps the removal from creeping back.
  async function checkSaverClean() {
    var ovl = document.getElementById("dragonScreenOverlay");
    if (!ovl) fail("#dragonScreenOverlay is missing, so the saver cannot be checked");
    if (document.getElementById("dragonScreenFullBtn")) fail("the saver's ⛶ corner button is BACK (#dragonScreenFullBtn) — Egon removed it");
    var btns = [].slice.call(ovl.querySelectorAll("button"));
    if (btns.length) fail("the saver overlay carries " + btns.length + " button(s) again: " + btns.map(function (b) { return String(b.textContent || b.id).trim().slice(0, 18); }).join(" | "));
    var stray = [].slice.call(ovl.children).filter(function (c) { return !c.id; });
    if (stray.length) fail("the saver overlay has " + stray.length + " unidentified child node(s) again");
    return "the screen saver carries NO corner control any more (its overlay is exactly the picture frame, the clock and the dismiss hint) — the two looks are a Settings choice instead";
  }

  // 🖼️ Egon 23.09.2026 — "i told you to put this button under the screen saver button in settings, kid
  // :S let it be a choice, screen saver v1 is current, full screen screen saver v2." The saver's two presentations are now
  // a real Settings button: #dragonSsStyleBtn sits in the SAME stacked block as the Screen Saver and
  // 🌧 Rainy Only buttons (🧰 Tools & Extras), its label follows EGON's numbering (v1 = the framed look the
  // visitor has today, v2 = the fullscreen look), a press flips the overlay's `.dragon-ss-framed` class AND
  // the label, and the choice is really written to localStorage (the module used to write the preference but
  // never read it back — that is fixed as well).
  async function checkSaverStyle() {
    var opened = false;
    var was = null;
    try {
      if (typeof window.dragonAccountOpen !== "function") fail("window.dragonAccountOpen() is missing");
      was = window.dragonScreenStyleGet();
      window.dragonAccountOpen(); opened = true;
      // the saver trio lives in the 🧰 Tools tab now — without opening it every rect measures 0
      if (typeof window.dragonSettingsTab === "function") { try { window.dragonSettingsTab("tools"); } catch (e) {} }
      await sleep(300);
      var btn = await waitFor(function () { return document.getElementById("dragonSsStyleBtn"); }, TIMEOUT, 200);
      if (!btn) fail("Settings has no screen-saver presentation button (#dragonSsStyleBtn)");
      var line2 = btn.parentNode;                       // the line the presentation button owns
      var ssBlock = line2 && line2.parentNode;          // the saver block (two lines)
      var ssb = ssBlock && ssBlock.querySelector(".dragon-ss-cycle");
      if (!ssb) fail("the presentation button is not in the same block as the 🖼️ Screen Saver button");
      var rainB = ssBlock && ssBlock.querySelector("#dragonSsRainBtn");
      if (!rainB) fail("the presentation button is not grouped with the 🌧 Rainy Only button");
      if (btn.getBoundingClientRect().top <= ssb.getBoundingClientRect().top) fail("the presentation button is not painted under the Screen Saver button");
      // ⚖️ Egon 23.09.2026 (rev.2, narrowed 08.10.2026) — "I just told you to make these buttons short/small in settings
      // we said the buttons should be in this standard ... place them properly, they're just floating." The trio now
      // uses the SAME small size as every other half-line card button: 🖼️ Screen Saver + 🌧 Rainy Only share
      // ONE line and the presentation button is SMALL too (half width, centred on its own line below them).
      // Every one of the three is exactly 34px tall like the rest of the card.
      var rS = ssb.getBoundingClientRect(), rR = rainB.getBoundingClientRect(), rP = btn.getBoundingClientRect();
      var blockW = ssBlock.getBoundingClientRect().width;
      if (Math.abs(rS.top - rR.top) > 3) fail("the 🖼️ Screen Saver and 🌧 Rainy Only buttons no longer share one line (tops " + Math.round(rS.top) + " / " + Math.round(rR.top) + ")");
      if (Math.abs(rS.width - rR.width) > 6) fail("the two small saver buttons are not equal width (" + Math.round(rS.width) + " / " + Math.round(rR.width) + ")");
      if (!(rS.width > 60 && rS.width < blockW - 20)) fail("the small saver buttons are not the half-line standard width (" + Math.round(rS.width) + " of " + Math.round(blockW) + ")");
      if (!(rP.width > 60 && rP.width < blockW - 20)) fail("the presentation button is not the half-line small standard width (" + Math.round(rP.width) + " of " + Math.round(blockW) + ")");
      [["presentation", rP], ["🖼️ Screen Saver", rS], ["🌧 Rainy Only", rR]].forEach(function (pair) {
        if (Math.abs(pair[1].height - 34) > 1.5) fail("the " + pair[0] + " saver button is " + Math.round(pair[1].height) + "px tall — the standard is 34px");
      });
      // ⚖️ Egon 23.09.2026 (rev.2) — a SMALL button is half a line, so on a phone its label has room
      // for ~96px. Measured before this fix: the saver cycle button carried 149px of text in a 118px box
      // (CUT OFF mid-word) and the rainy button fitted with ZERO margin. The visible labels are the short
      // pair now ("🖼️ Saver: 5m" / "🌧 Rainy: On") with the full wording in the tooltips, so this
      // asserts BOTH that the button still names itself AND that no saver label is clipped.
      if (!/Saver/.test(String(ssb.textContent || ""))) fail("the saver cycle button no longer names a Saver: \"" + String(ssb.textContent || "").trim() + "\"");
      if (!/Rainy/.test(String(rainB.textContent || ""))) fail("the rainy button no longer names Rainy: \"" + String(rainB.textContent || "").trim() + "\"");
      [["saver cycle", ssb], ["rainy", rainB], ["presentation", btn]].forEach(function (pair) {
        if (pair[1].scrollWidth > pair[1].clientWidth + 1) fail("the " + pair[0] + " saver button's label is CLIPPED (" + pair[1].scrollWidth + "px of text in a " + pair[1].clientWidth + "px box) — a small button must carry a label that fits");
      });
      var labelled = String(btn.textContent || "").trim();
      if (!/v1|v2/.test(labelled)) fail("the button label does not name the presentation (v1/v2): " + labelled);
      // the press really flips the presentation, the overlay class AND the label
      var before = window.dragonScreenStyleGet();
      var ovl = document.getElementById("dragonScreenOverlay");
      btn.click();
      await sleep(90);
      var after = window.dragonScreenStyleGet();
      if (after === before) fail("pressing the button did not change the presentation");
      var wantFramed = (after === "v2");
      if (ovl && ovl.classList.contains("dragon-ss-framed") !== wantFramed) fail("the overlay's frame class does not match the chosen presentation");
      var flipped = String(btn.textContent || "").trim();
      if (flipped === labelled) fail("the button label did not follow the presentation: " + flipped);
      var stored = null; try { stored = localStorage.getItem("dragonScreenStyle"); } catch (e) {}
      if (stored !== after) fail("the choice was not written to localStorage (stored " + stored + ", expected " + after + ")");
    } finally {
      try { if (was != null) window.dragonScreenStyleSet(was); } catch (e) {}
      try { if (opened) window.dragonAccountClose(); } catch (e) {}
    }
    return "the saver's two presentations are a real Settings choice: #dragonSsStyleBtn sits in the saver block of 🧰 Tools & Extras (🖼️ Screen Saver + 🌧 Rainy Only on one half-width line above it, the presentation button half width below them, all three 34px per the card standard), its label names v1 (framed — the current look) or v2 (fullscreen), a press flips the overlay's frame class and the label together, and the choice is written to localStorage";
  }

  // ⚖️ Egon 23.09.2026 — SETTINGS BUTTON STANDARD: every button of every Settings card is exactly 34px
  // tall, in ONE font (.72rem / weight 700), white on the purple theme unless it is one of the declared
  // SPECIAL buttons (🗑️ purge · 🔢 gallery numbers · ⚡ load speed · 🖼️ background · 🪄 auto · ✅ preview),
  // and the 📦 About card is excluded from all of it. The 🔧 UI SCALE button must carry the words AND the
  // percentage.
  async function checkSettingsButtons() {
    if (typeof window.dragonAccountOpen !== "function") fail("window.dragonAccountOpen() is missing");
    var wasOpen = !!document.querySelector(".dragon-account-page");
    window.dragonAccountOpen();
    try {
    try { window.dragonGoPage("account"); } catch (e) {}
    var board = await waitFor(function () { return document.querySelector(".dragon-set-board"); }, TIMEOUT, 200);
    if (!board) fail("the Settings board (.dragon-set-board) never appeared");
    var cards = [].slice.call(board.querySelectorAll(".dragon-set-card"));
    if (cards.length < 6) fail("only " + cards.length + " Settings cards were found");
    var about = cards.filter(function (c) { return c.classList.contains("dragon-set-aboutcard"); });
    if (about.length !== 1) fail("the 📦 About card is not marked with .dragon-set-aboutcard");
    var bad = [], seen = 0, specials = 0, normal = 0, judged = [];
    // Egon 08.10.2026 — SETTINGS TABS: measure every pane (union, each button judged once).
    var tabIds = (typeof window.dragonSettingsTabs === "function") ? window.dragonSettingsTabs() : [null];
    for (var ti = 0; ti < tabIds.length; ti++) {
      if (tabIds[ti] && typeof window.dragonSettingsTab === "function") window.dragonSettingsTab(tabIds[ti]);
    cards.forEach(function (card) {
      if (card.classList.contains("dragon-set-aboutcard")) return;
      [].slice.call(card.querySelectorAll("button")).forEach(function (b) {
        if (judged.indexOf(b) !== -1) return;
        var r = b.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) return;          // parked / hidden controls are not judged
        judged.push(b);
        seen++;
        var cs = getComputedStyle(b);
        var label = (String(b.textContent || "").trim().slice(0, 24) || b.id || "button");
        var spec = b.classList.contains("dragon-set-special") || b.classList.contains("dragon-galnum-btn") ||
          b.classList.contains("dragon-galnumvis-btn") || b.classList.contains("dragon-star-preview") ||
          b.classList.contains("dragon-set-stdbtn") || b.id === "dragonPrivPurgeBtn";
        if (spec) specials++; else normal++;
        if (Math.abs(r.height - 34) > 1.5) bad.push(label + " height=" + Math.round(r.height));
        if (Math.abs(parseFloat(cs.fontSize) - 11.52) > 0.6) bad.push(label + " font-size=" + cs.fontSize);
        if (String(cs.fontWeight) !== "700") bad.push(label + " weight=" + cs.fontWeight);
        if (!spec && cs.color.replace(/\s/g, "") !== "rgb(255,255,255)") bad.push(label + " colour=" + cs.color);
      });
    });
    } // end SETTINGS TABS pane loop
    // the UI-scale button lives in the 🖼 pane — open it before picking the visible one
    if (typeof window.dragonSettingsTab === "function") window.dragonSettingsTab("display");
    if (seen < 18) fail("only " + seen + " visible Settings buttons were found — the board did not build");
    if (specials < 4) fail("the SPECIAL buttons were not marked (only " + specials + " found)");
    if (normal < 10) fail("only " + normal + " standard buttons found — the standard did not apply");
    if (bad.length) fail("off-standard buttons: " + bad.slice(0, 8).join(" | "));
    // the rating faces of the 📦 About card must keep their own size (the card is excluded)
    var rate = board.querySelector(".dragon-about-rate button");
    if (rate && parseFloat(getComputedStyle(rate).fontSize) < 20) fail("the 📦 About rating faces lost their own size (" + getComputedStyle(rate).fontSize + ")");
    // 🔧 UI SCALE button: words + percentage ON the button (the factory is shared, so pick the VISIBLE one)
    var sbs = [].slice.call(document.querySelectorAll(".dragon-ui-scale-btn")).filter(function (b) { return b.getBoundingClientRect().height > 1; });
    if (!sbs.length) fail("no visible 🔧 UI SCALE button (.dragon-ui-scale-btn) was found in Settings");
    var sb = sbs[0];
    var st = String(sb.textContent || "");
    if (!/UI SCALE\s+\d+\s*%/.test(st)) fail("the UI-scale button must read \"UI SCALE <n>%\", got \"" + st + "\"");
    if (Math.abs(sb.getBoundingClientRect().height - 34) > 1.5) fail("the 🔧 UI SCALE button is not 34px tall (" + Math.round(sb.getBoundingClientRect().height) + ")");
    // Egon 23.09.2026 — the button must say which state automatic sizing is in: “… · AUTO: ON” while it
    // sizes the bars itself, “… · AUTO: OFF” once he pressed it and the slider came out.
    if (!/AUTO:\s*(ON|OFF)/.test(st)) fail("the UI-scale button must name its automatic state (\"· AUTO: ON\" / \"· AUTO: OFF\"), got \"" + st + "\"");
    } finally {
      try { if (!wasOpen && window.dragonAccountClose) window.dragonAccountClose(); } catch (eClose) {}
    }
    return seen + " card buttons on ONE standard (34px / .72rem / 700 / white — " + specials + " special ones keep their colours) + the \"" + st + "\" button";
  }

  // 🗂️ Egon 23.09.2026 — the two full pages open with the SAME title: 🕘 History and ⚙️ Settings carry the
  // same font family, size, weight and colour, sit the same distance under the navbar and are both centered.
  async function checkPageHeadings() {
    function statsOf(el) {
      var c = getComputedStyle(el), r = el.getBoundingClientRect();
      return { fs: c.fontSize, fw: c.fontWeight, ff: c.fontFamily, col: c.color, y: Math.round(r.y), cx: Math.round(r.x + r.width / 2) };
    }
    // 📝 Egon 26.09.2026 — the old History PAGE (and its .dragon-hist-title) was deleted, so the shared
    // page-title standard is checked on the Settings page title alone ("⚙️ Settings"); the History side
    window.dragonGoPage("account");
    var sett = await waitFor(function () {
      var all = document.querySelectorAll("div");
      for (var i = 0; i < all.length; i++) {
        if (!all[i].children.length && /^⚙️ Settings$/.test((all[i].textContent || "").trim())) return statsOf(all[i]);
      }
      return null;
    }, TIMEOUT, 200);
    if (!sett) fail("the Settings page title is missing");
    if (parseFloat(sett.fs) < 23) fail("the Settings page title is too small (" + sett.fs + ") — Egon asked for bigger, bold ones");
    if (String(sett.fw) !== "800") fail("the Settings page title must be bold (800), got " + sett.fw);
    window.dragonGoPage("history");
    var panel = await waitFor(function () {
      var p = document.getElementById("dragonHistoryPanel");
      return (p && isVisible(p)) ? p : null;
    }, TIMEOUT, 200);
    if (!panel) fail("the 📝 Prompt Panel did not open from the 'history' route");
    var head = panel.querySelector(":scope > button");
    if (!head) fail("the 📝 Prompt Panel head button is missing");
    if (!/Prompt Panel/.test(head.textContent || "")) fail("the panel head does not read \"📝 Prompt Panel\" (got \"" + (head.textContent || "").trim() + "\")");
    if (!panel.querySelector(".dragon-pp-symbol")) fail("the {a|b} Prompt Panel symbol is missing from the head");
    var hc = getComputedStyle(head);
    if (/(\d+),\s*(\d+)/.test(hc.backgroundImage) && /rgb\(13, 33, 56\)/.test(hc.backgroundImage)) fail("the Prompt Panel head is painted with the Control Panel's BLUE — it must be GREY");
    return "Settings title standard kept (" + sett.fs + " / " + sett.fw + ") and the 📝 Prompt Panel head ({a|b} symbol, grey) opens from the 'history' route";
  }

  // 🕒 Egon 23.09.2026 — Dexa's POSTED messages (the update-notes announcements) carry the date and time
  // they arrived as a small centred line at the TOP of their bubble.
  async function checkChatStamp() {
    var api = window.dragonBotAPI;
    if (!api) fail("window.dragonBotAPI is missing");
    if (typeof api.post !== "function") fail("window.dragonBotAPI.post() is missing");
    if (typeof api.stampTest !== "function") fail("window.dragonBotAPI.stampTest() (chat timestamp test hook) is missing");
    var b = api.stampTest(new Date(2026, 8, 23, 4, 45).getTime());
    if (!b) fail("the stamped chat bubble could not be built");
    var s = b.querySelector(".dragon-chat-stamp");
    if (!s) fail("a posted message bubble carries no .dragon-chat-stamp line");
    var txt = String(s.textContent || "").trim();
    if (!/^\uD83D\uDCC5 \d{2}\.\d{2}\.\d{4}\s+\u00B7\s+\d{2}:\d{2}$/.test(txt)) fail("the chat timestamp is not a \"📅 DD.MM.YYYY · HH:MM\" line: \"" + txt + "\"");
    if (txt.indexOf("23.09.2026") === -1 || txt.indexOf("04:45") === -1) fail("the chat timestamp did not render the given moment: \"" + txt + "\"");
    var cs = getComputedStyle(s);
    if (cs.textAlign !== "center") fail("the chat timestamp must be centred, text-align = " + cs.textAlign);
    if (parseFloat(cs.fontSize) > 11) fail("the chat timestamp must stay small (font-size = " + cs.fontSize + ")");
    if (b.firstElementChild !== s) fail("the chat timestamp must sit at the TOP of the bubble");
    try { var w = b.parentElement; if (w && w.parentElement) w.parentElement.removeChild(w); } catch (e) {}
    return "a posted chat message carries a small centred " + txt + " line at the top of its bubble";
  }

  // 🧪 Egon 23.09.2026 (W-UI190, rule I116) — LEGENDS ↔ LIVE CONTROLS SYNC. Every new button must get a 📖
  // rows, and nothing may quietly fall out of the reference. Three things are proven here: (a) the legends
  // DATA is well-formed (it is exposed at module level now, so a cold page already carries it), (b) the
  // merged 🔍 Buttons & Legends window really PAINTS every one of those rows when its search box is empty,
  // and (c) the live control list has not grown past what was accepted: a new button on the navbar or in
  // the Settings board fails the check until it has its legends row and `dragonLegendsSyncAccept()` records
  // the new state. The same baseline remembers how many visible controls still have no legend of their own.
  var LEGENDS_BASE_KEY = "dragonLegendsSyncBase";
  function legendsNorm(s) {
    return String(s || "").toLowerCase()
      .replace(/[\u2190-\u21FF\u2300-\u27BF\u2B00-\u2BFF\u{1F000}-\u{1FAFF}\uFE0F\u200D]/gu, " ")
      .replace(/[^a-z0-9\s]/gi, " ").replace(/\s+/g, " ").trim();
  }
  function legendsWords(s) {
    return legendsNorm(s).split(" ").filter(function (w) { return w.length >= 4; });
  }
  function legendsEmoji(s) {
    try { var m = String(s || "").match(/^(\p{Extended_Pictographic}[\uFE0F\u200D\p{Extended_Pictographic}]*)/u); return m ? m[1] : ""; } catch (e) { return ""; }
  }
  function legendsRowsOf(L) {
    var out = [];
    (L || []).forEach(function (sec) {
      (sec[1] || []).forEach(function (it) {
        out.push({ sec: sec[0], name: String(it[0] || ""), n: legendsNorm(it[0]), w: legendsWords(it[0]), e: legendsEmoji(it[0]) });
      });
    });
    return out;
  }
  // a live control counts as DOCUMENTED when a legend row names it (or its parent family): same flattened
  // label either way round, a shared significant word, or the same leading symbol carrying a word of its own
  function legendsCovered(c, rows) {
    var cn = legendsNorm(c.lb) || legendsNorm(c.kw), cw = legendsWords((c.lb || "") + " " + (c.kw || "")), ce = c.ic;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (!cn || !r.n) continue;
      if (r.n === cn) return true;
      if (cn.length >= 4 && (r.n.indexOf(cn) !== -1 || cn.indexOf(r.n) !== -1)) return true;
      var ov = 0;
      for (var j = 0; j < r.w.length; j++) if (cw.indexOf(r.w[j]) !== -1) ov++;
      if (ce && r.e === ce && ov >= 1) return true;
      if (ov >= 1 && r.w.length <= 4 && cw.length <= 6) return true;
    }
    return false;
  }
  function legendsBaseRead() { try { var o = JSON.parse(localStorage.getItem(LEGENDS_BASE_KEY) || "null"); return (o && typeof o === "object") ? o : null; } catch (e) { return null; } }
  function legendsScope(c) {
    try { return !!(c.el && (c.el.closest(".dragon-set-board") || c.el.closest(".dragon-nav") || c.el.closest(".dragon-navbar"))); } catch (e) { return false; }
  }
  // one measurement, taken in the SAME state the check uses (the Settings board open), so the ratchet and the
  // check can never disagree — the numbers are only comparable this way.
  function legendsSnapshot(L) {
    L = L || (window.dragonLegendsDataGet ? window.dragonLegendsDataGet() : []);
    var rows = 0, secs = 0;
    (L || []).forEach(function (sec) { secs++; rows += (sec[1] || []).length; });
    var idx = window.dragonSiteSearchIndex();
    var rowsM = legendsRowsOf(L);
    var vis = idx.filter(function (c) { return !c.go && legendsScope(c) && c.vis !== false; });
    var undoc = vis.filter(function (c) { return !legendsCovered(c, rowsM); });
    return { rows: rows, secs: secs, vis: vis.length, matched: vis.length - undoc.length, undoc: undoc.length,
      undocNames: undoc.map(function (c) { return c.lb || "?"; }),
      // informational only — NOT ratcheted: the board also renders live lists (news lane, visitor list), so
      // this number keeps growing while the board is open (measured 52 → 118 in one session). The ratchet
      // uses `vis`/`nav`, i.e. the search index's own entries in the navbar/Settings scope.
      board: document.querySelectorAll(".dragon-set-board button").length,
      nav: document.querySelectorAll(".dragon-nav-item").length, at: Date.now() };
  }
  function legendsBaseWrite(snap) { try { localStorage.setItem(LEGENDS_BASE_KEY, JSON.stringify(snap)); } catch (e) {} }
  async function checkLegendsSync() {
    if (typeof window.dragonLegendsDataGet !== "function") fail("window.dragonLegendsDataGet() is missing \u2014 the legends data must be readable on a COLD page (W-UI190)");
    if (typeof window.dragonLegendsSyncAccept !== "function") fail("window.dragonLegendsSyncAccept() is missing (the ratchet cannot be re-armed)");
    var L = window.dragonLegendsDataGet();
    if (!Array.isArray(L) || !L.length) fail("the legends data is empty or not an array");
    var secs = 0, rows = 0, seen = {}, dup = [], thin = [];
    for (var i = 0; i < L.length; i++) {
      var sec = L[i];
      if (!Array.isArray(sec) || typeof sec[0] !== "string" || !sec[0].trim()) fail("legends section #" + i + " has no name");
      if (!Array.isArray(sec[1]) || !sec[1].length) fail("legends section \"" + sec[0] + "\" has no rows");
      secs++;
      for (var j = 0; j < sec[1].length; j++) {
        var it = sec[1][j] || [];
        rows++;
        var nm = (typeof it[0] === "string") ? it[0].trim() : "";
        var ds = (typeof it[1] === "string") ? it[1].trim() : "";
        if (!nm || ds.length < 8) thin.push(sec[0] + " \u25B8 " + (nm || "(no name)"));
        if (nm) { var dk = sec[0] + "||" + nm; if (seen[dk]) dup.push(sec[0] + " \u25B8 " + nm); seen[dk] = 1; }
      }
    }
    if (thin.length) fail("legend rows with no name or no real description: " + thin.slice(0, 3).join(" \u00B7 "));
    if (dup.length) fail("duplicate legend rows: " + dup.slice(0, 3).join(" \u00B7 "));
    if (secs < 8) fail("only " + secs + " legends sections (at least 8 expected)");
    if (rows < 100) fail("only " + rows + " legend rows (at least 100 expected)");
    // (b) the merged window must paint EVERY row while its search box is empty
    var nav = qa(".dragon-nav-item").filter(function (e) { return e.dataset && e.dataset.navPage === "account"; })[0];
    // ⚠️ Egon 23.09.2026 — the Settings item TOGGLES the board, so clicking it blind CLOSES a board another
    // check has left open: the ratchet then measured the bare navbar (8 controls, measured live) instead of
    // the board. Open it only when it is really absent.
    if (!document.querySelector(".dragon-set-board")) { if (nav) { try { nav.click(); } catch (e) {} } }
    var board = await waitFor(function () { return document.querySelector(".dragon-set-board"); }, TIMEOUT * 2, 250);
    if (!board) fail("the Settings board did not open, so the legends window cannot be checked");
    if (typeof window.dragonOpenLegends !== "function") fail("window.dragonOpenLegends() is missing");
    window.dragonOpenLegends();
    var ov = await waitFor(function () { return document.getElementById("dragonLegendsOverlay"); }, TIMEOUT, 150);
    if (!ov) fail("the merged \uD83D\uDD0D Buttons & Legends window did not open");
    var painted = qa("div", ov).filter(function (d) { return d.style && d.style.minWidth === "6.6rem"; });
    try { ov.remove(); } catch (e) {}
    if (painted.length !== rows) fail("the window painted " + painted.length + " legend rows while the data holds " + rows);
    // (c) the ratchet on the live control list
    var idx = window.dragonSiteSearchIndex();
    if (idx.length < 200) fail("the live control index is suspiciously small (" + idx.length + " controls)");
    var snap = legendsSnapshot(L);
    var base = legendsBaseRead();
    var seeded = false;
    if (!base) { legendsBaseWrite(snap); base = snap; seeded = true; }
    var problems = [];
    if (base) {
      if (snap.rows < (base.rows | 0)) problems.push("a legends row vanished (" + snap.rows + " rows now, " + base.rows + " accepted)");
      // ⚠️ Egon 23.09.2026 — WHAT IS RATCHETED, and why it is not the raw control count. Rule I116 is about a
      // NEW CONTROL NEEDING ITS 📖 ROW, so the honest failure is "a visible navbar/Settings control has no
      // legend" (`undoc`), plus a legends row or a navbar item that disappears. The control COUNT is not part
      // of the rule at all — a control that carries its own legend does not violate anything — and it turned
      // out to be state-dependent: the board also holds live lists (news lane, visitor list) whose buttons
      // grew while the board stayed open (52 → 107 → 118 measured in one session) and an expanded card
      // briefly puts its own controls in scope (measured 55 in a full run, all of them documented). Both
      // produced a failure for a check that only ever meant "give the new control its 📖 row".
      // `vis`/`board` stay in the snapshot as information for the report; `nav` (8, rock steady) guards the
      // one control list that is deliberately hand-curated.
      if (snap.nav > (base.nav | 0)) problems.push("the navbar now has " + snap.nav + " items (accepted: " + base.nav + ") \u2014 give the new control its \uD83D\uDCD6 row, then run window.dragonLegendsSyncAccept()");
      if (snap.undoc > (base.undoc | 0)) problems.push(snap.undoc + " of the " + snap.vis + " visible navbar/Settings controls have no legend (accepted: " + base.undoc + ") \u2014 e.g. " + snap.undocNames.slice(0, 4).join(", "));
    }
    if (problems.length) fail(problems.join(" \u00B7 "));
    return snap.secs + " sections / " + snap.rows + " rows, all painted by the merged window; " + snap.vis + " visible navbar+Settings controls, " + snap.matched + " matched to a legend, " + snap.undoc + " still undocumented" + (seeded ? " \u2014 baseline recorded from this run (the ratchet starts here)" : " (ratchet accepted)");
  }
  window.dragonLegendsSyncAccept = function () {
    // must be run in the state the check measures in — the Settings board open, i.e. straight after a
    // legends-sync check (the numbers are only comparable then)
    var snap = legendsSnapshot();
    legendsBaseWrite(snap);
    return snap;
  };

  // 🧪 Egon 23.09.2026 (W-DATA191, rule I117) — SURVEY ↔ LIVE SYSTEMS SYNC. The survey is how Egon decides what
  // to build next, so a system that vanishes from it (or a row that loses its symbol/description) must be
  // caught. The list is exposed and ratcheted: dropping a system fails until it is either put back or
  // `dragonSurveySyncAccept()` records the smaller survey on purpose.
  var SURVEY_BASE_KEY = "dragonSurveySyncBase";
  function surveyBaseRead() { try { var o = JSON.parse(localStorage.getItem(SURVEY_BASE_KEY) || "null"); return (o && typeof o === "object") ? o : null; } catch (e) { return null; } }
  async function checkSurveySync() {
    if (typeof window.dragonSurveySyncAccept !== "function") fail("window.dragonSurveySyncAccept() is missing (the ratchet cannot be re-armed)");
    var items = window.dragonSurveyItems, next = window.dragonSurveyNext;
    if (!Array.isArray(items)) fail("window.dragonSurveyItems is missing (W-DATA191)");
    if (!Array.isArray(next)) fail("window.dragonSurveyNext is missing");
    if (items.length < 20 || items.length > 64) fail("the survey asks about " + items.length + " systems (expected 20-64)");
    if (next.length !== 0) fail("the survey offers " + next.length + " \"next feature\" options (expected 0 — the question is retired)");
    var seen = {}, dup = [], thin = [];
    function scan(arr, tag) {
      arr.forEach(function (it, i) {
        var s = it && it.s, n = it && it.n, d = it && it.d;
        if (typeof n !== "string" || !n.trim()) thin.push(tag + " #" + i + " (no name)");
        if (typeof s !== "string" || !s.trim()) thin.push(tag + " " + (n || "#" + i) + " (no symbol)");
        if (typeof d !== "string" || d.trim().length < 12) thin.push(tag + " " + (n || "#" + i) + " (no description)");
        if (n) { var k = tag + "|" + n; if (seen[k]) dup.push(n); seen[k] = 1; }
      });
    }
    scan(items, "item"); scan(next, "next");
    if (thin.length) fail("survey rows missing a symbol, name or description: " + thin.slice(0, 3).join(" \u00B7 "));
    if (dup.length) fail("duplicate survey rows: " + dup.slice(0, 3).join(" \u00B7 "));
    // cross-reference: a system the survey names should still exist as a control or a legend row
    var idx = window.dragonSiteSearchIndex();
    var live = "";
    idx.forEach(function (c) { live += " " + legendsNorm(c.lb) + " " + legendsNorm(c.kw); });
    var L = (typeof window.dragonLegendsDataGet === "function") ? window.dragonLegendsDataGet() : [];
    var leg = "";
    (L || []).forEach(function (sec) { leg += " " + legendsNorm(sec[0]); (sec[1] || []).forEach(function (it) { leg += " " + legendsNorm(it[0]) + " " + legendsNorm(it[1]); }); });
    var hay = live + " || " + leg;
    var unmatched = items.filter(function (it) {
      var n = legendsNorm(it.n);
      if (!n) return true;
      if (hay.indexOf(n) !== -1) return false;
      return !legendsWords(n).some(function (w) { return hay.indexOf(w) !== -1; });
    }).map(function (it) { return it.n; });
    if (unmatched.length > 3) fail(unmatched.length + " survey systems no longer exist anywhere in the generator: " + unmatched.slice(0, 4).join(", "));
    var base = surveyBaseRead();
    var seeded = false;
    if (!base) { base = { items: items.length, next: next.length, at: Date.now() }; try { localStorage.setItem(SURVEY_BASE_KEY, JSON.stringify(base)); } catch (e) {} seeded = true; }
    if (base) {
      if (items.length < (base.items | 0)) fail("the survey lost " + ((base.items | 0) - items.length) + " system(s): " + items.length + " now, " + base.items + " accepted \u2014 put them back, or record the smaller survey with window.dragonSurveySyncAccept()");
      if (next.length !== 0 && next.length < (base.next | 0)) fail("the survey lost a \"next feature\" option (" + next.length + " now, " + base.next + " accepted)");
    }
    return items.length + " systems + " + next.length + " options, every row with symbol/name/description, no duplicates; " + (items.length - unmatched.length) + " found in the live controls/legends" + (unmatched.length ? " (unmatched: " + unmatched.join(", ") + ")" : "") + (seeded ? ", baseline recorded from this run (the ratchet starts here)" : " (ratchet accepted at " + base.items + "/" + base.next + ")");
  }
  window.dragonSurveySyncAccept = function () {
    var items = window.dragonSurveyItems || [], next = window.dragonSurveyNext || [];
    var base = { items: items.length, next: next.length, at: Date.now() };
    try { localStorage.setItem(SURVEY_BASE_KEY, JSON.stringify(base)); } catch (e) {}
    return base;
  };

  // 📱 Egon 23.09.2026 (W-UX195) — THE HOME STACK MUST ALWAYS BE REACHABLE. On a short viewport (a phone in
  // LANDSCAPE, or a very short window) the header/CTA stack is taller than the space under the navbar; the
  // floating centre then clamped its top just below the navbar, which pushed its BOTTOM past the viewport
  // edge — and because the home page was `overflow:hidden` and a `position:fixed` box takes part in no
  // scroll flow, the lower half (every button below Character Creation) could not be reached at all. The
  // invariant here is size-independent: the stack is EITHER fully inside the page, OR the page really
  // scrolls and its bottom is reachable by scrolling.
  async function checkHomeCtaReach() {
    window.dragonGoPage("home");
    var page = await waitFor(function () {
      var p = document.getElementById("dragonHomePage");
      return (p && getComputedStyle(p).display !== "none") ? p : null;
    }, TIMEOUT * 2, 250);
    if (!page) fail("the home page did not render");
    if (typeof window.dragonHomeCenterCC === "function") { try { window.dragonHomeCenterCC(); } catch (e) {} }
    await sleep(280);
    var cta = page.querySelector(".dragon-home-cta");
    if (!cta || getComputedStyle(cta).display === "none") return "this home style shows no floating CTA box, so there is nothing that could be cut off";
    var pr = page.getBoundingClientRect(), cr = cta.getBoundingClientRect();
    var inside = cr.top >= pr.top - 2 && cr.bottom <= pr.bottom + 2;
    if (inside) return "the home header/CTA fits inside the page (" + Math.round(cr.height) + "px stack, " + Math.round(pr.height) + "px of page)";
    if (!(page.scrollHeight > page.clientHeight + 4)) fail("the home header/CTA (" + Math.round(cr.height) + "px) does not fit the page (" + Math.round(pr.height) + "px) and the page CANNOT scroll (clientHeight " + page.clientHeight + ", scrollHeight " + page.scrollHeight + ") \u2014 its lower half is unreachable (W-UX195)");
    var keep = page.scrollTop;
    page.scrollTop = page.scrollHeight;
    await sleep(240);
    var moved = page.scrollTop > keep + 4;
    var cr2 = cta.getBoundingClientRect();
    var reachable = cr2.bottom <= pr.bottom + 4;
    page.scrollTop = keep;
    await sleep(160);
    if (!moved) fail("the home page reports content to scroll but its scrollTop did not move");
    if (!reachable) fail("scrolling to the very end still leaves the bottom of the home stack " + Math.round(cr2.bottom - pr.bottom) + "px below the page");
    return "the stack is taller than this viewport (" + Math.round(cr.height) + "px in " + Math.round(pr.height) + "px) so the page scrolls (" + page.scrollHeight + "px of content) and its bottom is reachable";
  }

  // 🗂️ Egon 23.09.2026 (rule I77/GREEN-CYCLE, Egon: "Write the check-up category and tasks into the rule ... back
  // item that passed 3 successful checks in the back; not checked again unless a regulation regarding that item arrives
  // not checked … however, a Global Check-up is performed every 20 check-ups") — every check belongs to a CATEGORY
  // (the rule lists them; the Logbook record is grouped by category), and a check that has been clean three
  // runs in a row while its OWN source is unchanged is skipped as "green" until something touches it. The
  // source hash below is the check function's text: editing the check re-arms it. Every 20th run is a
  // GLOBAL check-up: nothing is skipped, and the run says so.
  var CATS = {
    protocol: ["globals", "plugins", "build-sync", "console-clean", "duplicate-ids", "fnfix-immunity", "region-map"],
    shell: ["navbar", "pages", "overflow", "home-v7", "home-cta-reach", "page-headings", "settings-buttons", "news-detail", "site-background"],
    generate: ["generate-ui", "talk-bubble", "dexa-context", "dexa-persona", "dexa-legends", "dexa-auto-highlight", "dexa-feature-tip", "tools-buttons", "reload-notice-wake", "auto-tags", "style-registry", "studio"],
    gallery: ["public-gallery", "gal-load-window", "gal-title", "gal-toolbar", "gal-search-tools", "gal-sort-menu",
      "gal-sub-chrome", "gal-sub-sort", "tile-range", "gal-justified", "tile-walls", "display-twin", "display-matrix", "pub-count", "view-count-source", "image-sort",
      "pager-idle", "lb-close-nomove", "gal-menu-fit", "site-search", "marquee-lane"],
    likes: ["liked-count", "likes-live", "like-backfill", "likes-ledger", "gallery-top"],

    vault: ["private-vault", "vault-menu", "storage-dialog", "undupe"],
    people: ["user-search", "blocked-log", "picture-comments", "chat", "chat-close", "chat-stamp"],
    survey: ["survey", "survey-sync"],
    popup: ["popup-region", "admin-page", "admin-records", "ban-vault", "whatsnew"],
    "media-tools": ["print-editor", "share-edit", "retouch-brush", "collage"],
    saver: ["saver-clean", "saver-style", "rainy-saver"],
    stats: ["visitor-stats", "visitors-merge", "visitor-devices", "permanent-ledger"],
    standards: ["btn-families", "kissing-standard", "tabs-strip", "mini-arrange", "toolbar-collapse-guard", "legends-sync", "art-style-panel"],
    sweep: ["self-test-sweep"]
  };
  function catOf(name) {
    for (var k in CATS) { if (CATS[k].indexOf(name) !== -1) return k; }
    return "other";
  }
  var GREEN_KEY = "dragonCheckupGreen";
  var RUNS_KEY = "dragonCheckupRuns";
  var GREEN_AFTER = 3;
  var GLOBAL_EVERY = 20;
  var LOW_COVERAGE = 0.8;
  var DEPS = {
    "globals": [], "plugins": [], "build-sync": [], "navbar": [], "overflow": [],
    "btn-families": [], "kissing-standard": [], "self-test-sweep": [], "console-clean": [],
    "tools-buttons": [], "saver-clean": [],
    "pages": ["src/JS/dragon-pages.js"],
    "generate-ui": ["src/JS/dragon-pages.js"],
    "public-gallery": ["src/JS/dragon-pages.js"],
    "gal-load-window": ["src/JS/dragon-app-core.js", "src/JS/dragon-pages.js"],
    "private-vault": ["src/JS/dragon-pages.js"],
    "vault-menu": ["src/JS/dragon-pages.js"],
    "chat": ["src/JS/dragon-pages.js"],
    "chat-close": ["src/JS/dragon-pages.js"],
    "toolbar-collapse-guard": ["src/JS/dragon-app-core.js", "src/JS/dragon-pages.js"],
    "storage-dialog": ["src/JS/dragon-app-core.js"],
    "survey": ["src/JS/dragon-visitor-survey.js"],
    "permanent-ledger": ["src/JS/dragon-visitor-survey.js"],
    "region-map": ["src/JS/dragon-comments.js"],
    "purge-scope": ["src/JS/dragon-pages.js"],
    "likes-ledger": ["src/JS/dragon-likes.js", "src/JS/dragon-comments.js"],
    "popup-region": ["src/JS/dragon-popup.js", "src/JS/dragon-comments.js"],
    "admin-page": ["src/JS/dragon-admin.js", "src/JS/dragon-app-core.js", "src/JS/dragon-comments.js"],
    "admin-records": ["src/JS/dragon-admin.js"],
    "ban-vault": ["src/JS/dragon-admin.js"],
    "whatsnew": ["src/JS/dragon-whatsnew.js"],
    "auto-tags": ["src/JS/dragon-app-core.js", "src/JS/dragon-auto-tags.js", "src/JS/dragon-pages.js"],
    "style-registry": ["src/JS/dragon-app-core.js", "src/JS/dragon-auto-tags.js", "src/JS/dragon-pages.js"],
    "art-style-panel": ["src/JS/dragon-pages.js", "src/JS/dragon-art-panel.js", "src/JS/dragon-app-core.js"],
    "studio": ["src/JS/dragon-studio.js", "src/JS/dragon-pages.js", "src/JS/dragon-visitor-survey.js"],
    "site-background": ["src/JS/dragon-bg.js"],
    "rainy-saver": ["src/JS/dragon-screensaver.js", "src/JS/dragon-pages.js"],
    "duplicate-ids": ["src/JS/dragon-pages.js"],
    "visitor-stats": ["src/JS/dragon-live-stats.js", "src/JS/dragon-pages.js"],
    "visitors-merge": ["src/JS/dragon-live-stats.js", "src/JS/dragon-pages.js"],
    "visitor-devices": ["src/JS/dragon-live-stats.js", "src/JS/dragon-pages.js"],
    "pager-idle": ["src/JS/dragon-pages.js"],
    "lb-close-nomove": ["src/JS/dragon-pages.js"],
    "gal-title": ["src/JS/dragon-app-core.js", "src/JS/dragon-pages.js"],
    "gal-toolbar": ["src/JS/dragon-pages.js", "src/JS/dragon-app-core.js"],
    "home-v7": ["src/JS/dragon-pages.js"],
    "marquee-lane": ["src/JS/dragon-live-stats.js"],
    "reload-notice-wake": ["src/JS/dragon-live-stats.js"],
    "undupe": ["src/JS/dragon-vault-dedupe.js", "src/JS/dragon-pages.js"],
    "gal-search-tools": ["src/JS/dragon-pages.js"],
    "gal-sort-menu": ["src/JS/dragon-pages.js"],
    "talk-bubble": ["src/JS/dragon-dexa-ui.js"],
    "gal-sub-chrome": ["src/JS/dragon-pages.js", "src/JS/dragon-app-core.js"],
    "gal-sub-sort": ["src/JS/dragon-app-core.js"],
    "tile-range": ["src/JS/dragon-pages.js", "src/JS/dragon-app-core.js"],
    "user-search": ["src/JS/dragon-app-core.js"],
    "tabs-strip": ["src/JS/dragon-app-core.js", "src/JS/dragon-pages.js"],
    "mini-arrange": ["src/JS/dragon-app-core.js", "src/JS/dragon-pages.js"],
    "gal-justified": ["src/JS/dragon-layouts.js", "src/JS/dragon-pages.js", "src/JS/dragon-app-core.js"],
    "tile-walls": ["src/JS/dragon-layouts.js", "src/JS/dragon-display.js", "src/JS/dragon-pages.js"],
    "fnfix-immunity": ["src/JS/dragon-display.js"],
    "display-twin": ["src/JS/dragon-display.js", "src/JS/dragon-pages.js", "src/JS/dragon-tag-system.js"],
    "display-matrix": ["src/JS/dragon-display.js", "src/JS/dragon-pages.js"],
    "pub-count": ["src/JS/dragon-pages.js", "src/JS/dragon-app-core.js"],
    "view-count-source": ["src/JS/dragon-pages.js"],
    "print-editor": ["src/JS/dragon-pages.js", "src/JS/dragon-img-panels.js"],
    "share-edit": ["src/JS/dragon-pages.js", "src/JS/dragon-app-core.js"],
    "blocked-log": ["src/JS/dragon-app-core.js", "src/JS/dragon-live-stats.js"],
    "site-search": ["src/JS/dragon-pages.js"],
    "picture-comments": ["src/JS/dragon-comments.js", "src/JS/dragon-pages.js"],
    "image-sort": ["src/JS/dragon-comments.js", "src/JS/dragon-likes.js"],
    "liked-count": ["src/JS/dragon-likes.js", "src/JS/dragon-comments.js"],
    "gallery-top": ["src/JS/dragon-likes.js", "src/JS/dragon-app-core.js", "index.html"],
    "likes-live": ["src/JS/dragon-likes.js", "src/JS/dragon-comments.js"],
    "like-backfill": ["src/JS/dragon-likes.js", "src/JS/dragon-comments.js"],
    "gal-menu-fit": ["src/JS/dragon-brush.js", "src/JS/dragon-app-core.js"],
    "retouch-brush": ["src/JS/dragon-brush.js"],
    "saver-style": ["src/JS/dragon-pages.js", "src/JS/dragon-screensaver.js"],
    "settings-buttons": ["src/JS/dragon-pages.js"],
    "page-headings": ["src/JS/dragon-pages.js"],
    "chat-stamp": ["src/JS/dragon-dexa-ui.js"],
    "legends-sync": ["src/JS/dragon-pages.js"],
    "survey-sync": ["src/JS/dragon-visitor-survey.js", "src/JS/dragon-pages.js"],
    "home-cta-reach": ["src/JS/dragon-pages.js"],
    "dexa-context": ["src/JS/dragon-dexa-ui.js", "src/JS/dragon-persona.js", "src/JS/dragon-visitor-survey.js"],
    "dexa-persona": ["src/JS/dragon-persona.js", "src/JS/dragon-dexa-ui.js"],
    "dexa-legends": ["src/JS/dragon-dexa-ui.js"],
    "dexa-auto-highlight": ["src/JS/dragon-dexa-ui.js", "src/JS/dragon-pages.js"],
    "dexa-feature-tip": ["src/JS/dexa-talk.js", "src/JS/dragon-collage.js"],
    "news-detail": ["src/JS/dexa-news.js", "src/JS/dragon-pages.js"],
    "collage": ["src/JS/dragon-collage.js", "src/JS/dragon-img-panels.js", "src/JS/dragon-pages.js"],
  };
  function greenRead() { try { var o = JSON.parse(localStorage.getItem(GREEN_KEY) || "{}"); return (o && typeof o === "object") ? o : {}; } catch (e) { return {}; } }
  function greenWrite(o) { try { localStorage.setItem(GREEN_KEY, JSON.stringify(o)); } catch (e) {} }
  function runsRead() { try { return parseInt(localStorage.getItem(RUNS_KEY) || "0", 10) || 0; } catch (e) { return 0; } }
  function runsWrite(n) { try { localStorage.setItem(RUNS_KEY, String(n)); } catch (e) {} }
  function sigOf(fn) {
    var s = "";
    try { s = String(fn); } catch (e) { s = "?"; }
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return h.toString(36) + ":" + s.length;
  }
  function hashText(s) {
    var h = 5381, i;
    for (i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return h.toString(36) + ":" + s.length;
  }
  var _depCache = {};
  async function depManifestHash(files) {
    var parts = [], i, f;
    for (i = 0; i < files.length; i++) {
      f = files[i];
      if (!_depCache[f]) {
        var t = null;
        try {
          var r = await fetch(f);
          if (!r || !r.ok) return null;
          t = await r.text();
        } catch (e) { return null; }
        if (t == null) return null;
        _depCache[f] = hashText(t);
      }
      parts.push(_depCache[f]);
    }
    return hashText(parts.join("|"));
  }
  window.dragonCheckupGreenState = function () { return { runs: runsRead(), green: greenRead() }; };
  window.dragonCheckupGreenReset = function () { greenWrite({}); runsWrite(0); return "green memory cleared"; };

  // 🧠 Egon 23.09.2026 (W-DATA188) — DEXA'S SITE KNOWLEDGE. The answer is a static prompt string, so the
  // whole thing is testable WITHOUT spending a generation: the context must name every system the visitor
  // survey lists (one list, one source), must keep the sections that are easy to lose in an edit, and must
  // really reach the prompt that is sent to the model. Nothing here talks to the network.
  async function checkDexaContext() {
    var ctx = typeof window.dragonDexaSiteContext === "function" ? window.dragonDexaSiteContext() : null;
    if (!ctx || typeof ctx !== "string") fail("window.dragonDexaSiteContext is missing (src/dragon-dexa-ui.js)");
    if (ctx.length < 9000) fail("Dexa's site context is suspiciously short (" + ctx.length + " chars)");
    var items = window.dragonSurveyItems || [];
    if (!items.length) fail("the visitor survey's system list (window.dragonSurveyItems) is empty");
    var missing = [], i;
    for (i = 0; i < items.length; i++) if (ctx.indexOf(items[i].n) === -1) missing.push(items[i].n);
    if (missing.length) fail("Dexa's site context does not name " + missing.length + " of the " + items.length + " systems the survey lists: " + missing.join(", "));
    var must = ["VISITOR SURVEY", "Retouch Brush", "private gallery", "not certain"], gone = [];
    for (i = 0; i < must.length; i++) if (ctx.indexOf(must[i]) === -1) gone.push(must[i]);
    if (gone.length) fail("Dexa's site context lost a key section: " + gone.join(", "));
    var bi = typeof window.dragonDexaBuildInstruction === "function" ? window.dragonDexaBuildInstruction("zz-test") : "";
    if (!bi || bi.indexOf(ctx) === -1) fail("the site context does not actually reach the prompt Dexa is sent");
    return "Dexa's site context names all " + items.length + " systems the survey lists (" + ctx.length + " chars), keeps the survey / retouch brush / private gallery / \"not certain\" sections, and really reaches the prompt that is sent (no generation was spent)";
  }

  // 🧬 23.09.2026 — THE AUTHORED CHARACTER CARD (src/dragon-persona.js). The companion must be authored on
  // the full 72-axis schema and each card (look + axes + the image-prompt wording for her own body) must
  // really reach the prompt that is sent — proven through the deterministic hook, so no generation is spent.
  async function checkDexaPersona() {
    var P = window.dragonPersona;
    if (!P || !Array.isArray(P.AXES) || !Array.isArray(P.CATEGORIES)) fail("window.dragonPersona is missing (src/dragon-persona.js)");
    if (P.AXES.length !== 72) fail("the axis registry holds " + P.AXES.length + " axes, expected 72");
    if (P.CATEGORIES.length !== 8) fail("the registry holds " + P.CATEGORIES.length + " categories, expected 8");
    var ids = {}, i;
    for (i = 0; i < P.AXES.length; i++) {
      var a = P.AXES[i];
      if (!a || !a.id || !a.name || !a.left || !a.right) fail("axis #" + i + " is incomplete");
      if (!a.category) fail("axis \"" + a.id + "\" carries no category");
      if (ids[a.id]) fail("duplicate axis id \"" + a.id + "\"");
      ids[a.id] = 1;
    }
    var bots = ["dexa"], bi, bad = [], k;
    for (bi = 0; bi < bots.length; bi++) {
      var id = bots[bi], prof = P.PROFILES[id];
      if (!prof) { bad.push(id + " has no profile"); continue; }
      var keys = Object.keys(prof);
      if (keys.length !== 72) bad.push(id + " carries " + keys.length + " values");
      for (k = 0; k < keys.length; k++) {
        var v = prof[keys[k]];
        if (typeof v !== "number" || v < 1 || v > 10 || v !== Math.round(v)) bad.push(id + "." + keys[k] + "=" + v);
      }
      for (k = 0; k < P.AXES.length; k++) if (!(P.AXES[k].id in prof)) bad.push(id + " misses " + P.AXES[k].id);
      var card = P.cardOf(id);
      if (!card) { bad.push(id + " has no card"); continue; }
      if (!card.look || card.look.length < 150) bad.push(id + " look is too thin");
      if (!card.lookPrompt || card.lookPrompt.length < 80) bad.push(id + " lookPrompt is too thin");
      if (!/^https:\/\//.test(String(card.referenceImage || ""))) bad.push(id + " referenceImage is not a URL");
      var cardText = P.block(id);
      if (!cardText || cardText.indexOf(card.look) === -1) bad.push(id + " block does not carry the look");
      var rows = cardText.split("\n").filter(function (l) { return /^\s{2}\S/.test(l); });
      if (rows.length !== 72) bad.push(id + " block carries " + rows.length + " axis rows");
    }
    if (bad.length) fail("character-card problems: " + bad.join(", "));
    // The card must actually REACH the prompt the reply is built from.
    var prompt = typeof window.dragonDexaBuildInstruction === "function" ? window.dragonDexaBuildInstruction("zz-test") : "";
    if (!prompt) fail("window.dragonDexaBuildInstruction is missing");
    var reached = 0, looks = [P.CARDS.dexa.look];
    for (i = 0; i < looks.length; i++) if (prompt.indexOf(looks[i]) !== -1) reached++;
    if (reached !== 1) fail("exactly one companion's card must reach the prompt (found " + reached + ")");
    if (prompt.indexOf("PERSONALITY AXES") === -1) fail("the prompt carries no personality-axis section");
    return "72 axes / 8 categories, profile complete, the look + 72 axis rows reach the prompt (no generation spent)";
  }

  // W-UI189 DEXA SHOWS THE LEGENDS BUTTONS. The grid is driven on a THROWAWAY bubble
  // (never the visitor's real chat) and the [[legends]] marker is tested through the deterministic hooks, so
  // nothing here spends a generation or writes into the chat history.
  // (Egon 22.10.2026: the "I'm HERE" badge is retired — chips navigate; nothing is marked.)
  async function checkDexaLegends() {
    var groups = window.dragonDexaLegendGroups;
    if (!Array.isArray(groups) || groups.length < 2) fail("window.dragonDexaLegendGroups is missing or thin (src/dragon-dexa-ui.js)");
    var items = [], gi, ii;
    for (gi = 0; gi < groups.length; gi++) {
      if (!groups[gi] || !Array.isArray(groups[gi].items) || !groups[gi].items.length) fail("legends group " + gi + " carries no items");
      for (ii = 0; ii < groups[gi].items.length; ii++) items.push(groups[gi].items[ii]);
    }
    if (items.length < 11) fail("the legends grid offers only " + items.length + " buttons");
    var bad = [];
    for (var k = 0; k < items.length; k++) {
      var it = items[k];
      if (!it || !it.key || !it.icon || !Array.isArray(it.find) || !it.find.length || typeof it.go !== "function") bad.push(it && it.key ? it.key : ("#" + k));
      // Egon 23.09.2026 (rev) — the chips are PLAIN ENGLISH now, like the navbar labels: a label must be
      // a non-empty ASCII word/phrase (a stray non-English or localized label would fail here).
      else {
        var lb = (typeof it.label === "string") ? it.label : (it.label && it.label.en);
        if (!lb || !/^[\x20-\x7e]+$/.test(lb) || !/[A-Za-z]/.test(lb)) bad.push(it.key + " (label)");
      }
    }
    if (bad.length) fail("incomplete legends entries: " + bad.join(", "));
    var live = 0;
    for (k = 0; k < items.length; k++) {
      var hit = null;
      for (var f = 0; f < items[k].find.length; f++) { try { hit = document.querySelector(items[k].find[f]); } catch (e) { hit = null; } if (hit) break; }
      if (hit) live++;
    }
    if (typeof window.dragonDexaStripMarkers !== "function") fail("window.dragonDexaStripMarkers is missing (the W-UI189 test hook)");
    var stripped = window.dragonDexaStripMarkers("here you go [[legends]]");
    if (/legends/i.test(stripped)) fail("the [[legends]] marker survives into the visible reply: " + stripped);
    var plain = window.dragonDexaStripMarkers("just a normal reply");
    if (plain !== "just a normal reply") fail("the marker stripper damages an ordinary reply: " + plain);
    var line = typeof window.dragonDexaBotPromptLine === "function" ? window.dragonDexaBotPromptLine() : "";
    if (line.indexOf("[[legends]]") === -1) fail("the prompt does not teach the model the [[legends]] marker");
    var host = document.createElement("div");
    host.style.cssText = "position:fixed;left:-12000px;top:0;width:320px;";
    var bubble = document.createElement("div");
    bubble.textContent = "check";
    host.appendChild(bubble);
    document.body.appendChild(host);
    var chipCount = 0;
    try {
      if (!window.dragonDexaLegendsGrid(bubble)) fail("window.dragonDexaLegendsGrid refused to draw the grid");
      var chips = bubble.parentElement.querySelectorAll(".dragon-legend-chip");
      chipCount = chips.length;
      if (chipCount !== items.length) fail("the grid drew " + chipCount + " chips for " + items.length + " legends entries");
    } finally {
      try { host.remove(); } catch (e) {}
      try { window.dragonHere.rescan(); } catch (e) {}
    }
    return "the legends grid draws " + items.length + " buttons in " + groups.length + " groups, " + live + "/" + items.length + " resolve to a live control, and the [[legends]] marker is stripped from the reply AND taught in the prompt (no generation spent)";
  }

  // 🧠 Egon 23.09.2026 (W-FEAT193, rule I122) — DEXA'S UNUSED-FEATURE TIP. Deterministic: the templates, the
  // 3-4 hour window and the no-repeat rotation are all readable without sending anything to the model, and
  // the visitor's own tip ledger + used flags are restored in the `finally`.

  // 🎯 Egon 23.09.2026 (W-UI219) — THE ANSWER PICKS THE CHIP. Dexa's own reply (plus the visitor's
  // question) decides WHICH legend chip is lit: anket ⇒ Visitor Survey,
  // statistics ⇒ Settings, update notes ⇒ Update Notes. The scorer is deterministic (no network) and
  // the DOM side is driven on a THROWAWAY bubble, so nothing is sent and the visitor's badge ledger is
  // restored in the `finally`. A confident single winner is required; otherwise NOTHING may light up.
  // 📰 Egon 23.09.2026 (W-UI180) — THE INTERACTIVE UPDATE-NOTES WINDOW. A note's row is a button: tapping
  // it opens the note's OWN window (the FULL text, never truncated) carrying the navbar button of the page
  // the note is about ABOVE the done row and carries a back-arrow to the list. The note→page mapping
  // is deterministic (window.dragonNewsPageOf), so this check spends no generation and restores the page.
  async function checkNewsDetail() {
    if (typeof window.dragonNewsPageOf !== "function") fail("window.dragonNewsPageOf is missing (src/dexa-news.js, W-UI180)");
    if (typeof window.dragonNewsOfferChat !== "function") fail("window.dragonNewsOfferChat is missing (W-UI180 item 3: the chat's page button)");
    var cases = [
      ["Masonry gallery wall", "The masonry wall packs the gallery into columns.", "gallery"],
      ["Visitor survey results", "Open the survey from the settings page.", "account"],
      ["Faster generation", "Generate images faster with the new prompt engine.", "generate"],
      ["New character outfits", "Premade character outfits were added.", "character"],
      ["Saved likes", "Your likes are now synced for the whole site.", "likes"],
      ["History tools", "The prompt bank moved into history.", "history"],
      ["A quiet fix", "We repaired a tiny thing.", null]
    ];
    var c, miss = [];
    for (c = 0; c < cases.length; c++) {
      var got = window.dragonNewsPageOf({ nameFull: cases[c][0], descFull: cases[c][1] });
      var want = cases[c][2];
      if ((got ? got.page : null) !== want) miss.push('"' + cases[c][0] + '" → ' + (got ? got.page : "null") + " (expected " + want + ")");
    }
    if (miss.length) fail("a note is mapped to the wrong page: " + miss.join(" · "));
    var items = (window.dragonNews && window.dragonNews.items) || [];
    if (!items.length) fail("window.dragonNews.items is empty (there is nothing to open)");
    var idx = -1, q;
    for (q = 0; q < items.length; q++) { if (window.dragonNewsPageOf(items[q])) { idx = q; break; } }
    if (idx < 0) fail("not one update note names a page, so a page button can never appear");
    var pg = window.dragonNewsPageOf(items[idx]);
    var startPage = "";
    try { startPage = String(window.dragonPage || ""); } catch (e) {}
      var savedSeen = null;
    try { savedSeen = localStorage.getItem("dragonNewsSeen"); } catch (e) {}
    var ovId = "dragonNewsOverlay";
    function rowAt() { var o = document.getElementById(ovId); return o ? o.querySelectorAll(".dragon-news-row-entry")[idx] : null; }
    try {
      var stale = document.getElementById(ovId); if (stale) stale.remove();
      window.dragonOpenUpdateNotes();
      var ov = await waitFor(function () { return document.getElementById(ovId); }, TIMEOUT, 120);
      if (!ov) fail("window.dragonOpenUpdateNotes did not open the panel");
      if (typeof window.dragonNewsOpenDetail !== "function") fail("the panel did not expose its whole-note opener (window.dragonNewsOpenDetail)");
      var row = rowAt();
      if (!row) fail("the notes list drew no tappable row at the note that names a page");
      row.click();
      var det = await waitFor(function () { return document.getElementById("dragonNewsDetail"); }, TIMEOUT, 120);
      if (!det) fail("tapping a note did not open the whole-note window");
      var card = det.firstChild;
      var panelCard = ov.firstChild;
      if (!card || !panelCard || card.clientWidth < panelCard.clientWidth * 0.9) fail("the whole-note window is not as wide as the panel (" + (card ? Math.round(card.clientWidth) : 0) + " vs " + (panelCard ? Math.round(panelCard.clientWidth) : 0) + ")");
      var dbody = det.querySelector(".dragon-news-detail-body");
      if (!dbody) fail("the whole-note window carries no text body");
      var full = String(items[idx].descFull || items[idx].desc || "");
      if (full.length > 0 && dbody.textContent.indexOf(full.slice(0, Math.min(48, full.length))) === -1) fail("the window does not show the note's FULL text (it is still truncated)");
      var pbtn = det.querySelector("#dragonNewsPageBtn");
      if (!pbtn) fail('the note is about the "' + pg.label + '" page but its window has no page button');
      if (String(pbtn.textContent).indexOf(pg.label) === -1) fail('the page button does not name "' + pg.label + '" (got "' + pbtn.textContent + '")');
      var foot = pbtn.parentElement, kids = foot.children;
      if (kids.length !== 2 || kids[0] !== pbtn) fail("the page button is not the control ABOVE the done row (Egon's item 2)");
      var backBtn = kids[1].querySelector("button");
      if (!backBtn || String(backBtn.textContent).indexOf("\u2B05") === -1) fail("the done row is missing the back-arrow to the list");
      // Escape closes the whole-note window FIRST and leaves the list open behind it.
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      await sleep(340);
      if (document.getElementById("dragonNewsDetail")) fail("Escape did not close the whole-note window");
      if (!document.getElementById(ovId)) fail("Escape closed the whole panel instead of only the note window");
      // Re-open it and press the page button: every window closes and the page switches.
      var row2 = rowAt();
      if (!row2) fail("the notes row vanished after the note window was closed");
      row2.click();
      if (!(await waitFor(function () { return document.getElementById("dragonNewsDetail"); }, TIMEOUT, 120))) fail("the whole-note window could not be reopened");
      var pbtn2 = document.querySelector("#dragonNewsDetail #dragonNewsPageBtn");
      if (!pbtn2) fail("the reopened window lost its page button");
      pbtn2.click();
      await sleep(900);
      var chatOpened = false;
      if (pg.page === "chat") {
        // 💬 the Chat is a floating window, not a page-state: its button opens the window, the page stays.
        var cw = document.getElementById("dragonChatWindow");
        var cwVis = cw && cw.getBoundingClientRect && cw.getBoundingClientRect().width > 50;
        if (!cwVis) fail('the page button did not open the Chat window for the "' + pg.label + '" note');
        chatOpened = true;
      } else if (String(window.dragonPage || "") !== pg.page) fail('the page button did not switch to the "' + pg.label + '" page (on "' + window.dragonPage + '")');
      if (document.getElementById(ovId) || document.getElementById("dragonNewsDetail")) fail("the page button did not close every window");
      var sel = '.dragon-nav-item[data-nav-page="' + pg.page + '"]';
      var tgt = document.querySelector(sel);
      if (!tgt) fail('after the switch the "' + pg.label + '" target control (' + sel + ") is not in the DOM");
      // (Egon 22.10.2026: the "I'm HERE" badge is retired — the page switch itself is the assert.)
    } finally {
      try { if (chatOpened && window.dragonChatClose) window.dragonChatClose(); } catch (e) {}
      var leftOv = document.getElementById(ovId); if (leftOv) { try { leftOv.remove(); } catch (e) {} }
      var leftDet = document.getElementById("dragonNewsDetail"); if (leftDet) { try { leftDet.remove(); } catch (e) {} }
      try { if (savedSeen === null) localStorage.removeItem("dragonNewsSeen"); else localStorage.setItem("dragonNewsSeen", savedSeen); } catch (e) {}
      try { if (startPage && window.dragonGoPage) window.dragonGoPage(startPage); } catch (e) {}
      try { window.dragonHere.rescan(); } catch (e) {}
    }
    return "the note→page mapping is right (" + cases.length + " cases, including a page-less one), tapping a note opens a window as wide as the panel with its FULL text and the page button ABOVE the back-arrow/done row, Escape closes only the note window, and the page button closes every window and switches to the \"" + pg.label + "\" page (no generation spent, the visitor's page restored)";
  }

  async function checkDexaAutoHighlight() {
    if (typeof window.dragonDexaPickLegend !== "function") fail("window.dragonDexaPickLegend is missing (src/dragon-dexa-ui.js, W-UI219)");
    var cases = [
      ["where are my likes?", "Your likes live on the Likes page.", "legend-likes"],
      ["anket sonuçlarını nerede görürüm?", "Open the Visitor Survey from the Settings page.", "legend-survey"],
      ["istatistikler nerede?", "Visitor stats live on the Settings page.", "legend-settings"],
      ["güncelleme notları var mı?", "Update Notes are in Settings.", "legend-notes"],
      ["public galeri nerede?", "The public gallery is under Galleries.", "legend-gallery"]
    ];
    var c, miss = [];
    for (c = 0; c < cases.length; c++) {
      var got = window.dragonDexaPickLegend(cases[c][0], cases[c][1]);
      if (!got || got.key !== cases[c][2]) miss.push(cases[c][0] + " → " + (got ? got.key : "null") + " (expected " + cases[c][2] + ")");
    }
    if (miss.length) fail("the answer→chip scorer picked wrong: " + miss.join(" · "));
    // NO confident match ⇒ NOTHING may light (Egon: \"random shining is forbidden — there should be no misleading\").
    var noMatch = [["hello", "Hi! How can I help you today?"], ["", ""], ["what is 2+2?", "It is 4."]];
    for (c = 0; c < noMatch.length; c++) {
      if (window.dragonDexaPickLegend(noMatch[c][0], noMatch[c][1])) fail("the scorer invented a match for unrelated text: \"" + noMatch[c][0] + "\"");
    }
    function draw(q, a) {
      var host = document.createElement("div");
      host.style.cssText = "position:fixed;left:-12000px;top:0;width:320px;";
      var b = document.createElement("div");
      b.textContent = "auto-highlight";
      host.appendChild(b);
      document.body.appendChild(host);
      var ok = window.dragonDexaLegendsGrid(b, a, q);
      var wrap = b.parentElement;
      var chips = wrap ? wrap.querySelectorAll(".dragon-legend-chip") : [];
      var lit = wrap ? wrap.querySelectorAll(".dragon-legend-chip-on") : [];
      var keys = [], litKeys = [];
      for (var i = 0; i < chips.length; i++) if (!chips[i].getAttribute("data-legend-key")) keys.push("x");
      for (var j = 0; j < lit.length; j++) litKeys.push(lit[j].getAttribute("data-legend-key"));
      return { host: host, ok: ok, chips: chips.length, keyless: keys.length, lit: litKeys };
    }
    var res = [];
    try {
      var A = draw("where are my likes?", "Your likes live on the Likes page.");
      res.push(A);
      if (!A.ok) fail("window.dragonDexaLegendsGrid refused to draw for the auto-highlight check");
      if (A.chips < 11) fail("the grid drew only " + A.chips + " chips");
      if (A.keyless) fail(A.keyless + " chips carry no data-legend-key (the scorer cannot find them)");
      if (A.lit.length !== 1 || A.lit[0] !== "legend-likes") fail("a likes reply lit " + JSON.stringify(A.lit) + " (exactly ['legend-likes'] expected)");
      var B = draw("hello", "Hi there!");
      res.push(B);
      if (B.lit.length !== 0) fail("an unrelated reply still lit " + JSON.stringify(B.lit) + " (nothing must light)");
      // W-UI272 (Egon 24.09.2026): an answer about a control that lives on ANOTHER page still registers
      // the pick as a HAND-OFF when the visitor reaches that page. Proven end-to-end here: a survey answer
      // registers the hand-off.
      if (typeof window.dragonDexaLegendHandOff !== "function") fail("window.dragonDexaLegendHandOff is missing (W-UI272 test hook)");
      if (window.dragonGoPage) window.dragonGoPage("home");
      await sleep(150);
      var C = draw("anket hakkında bilgi ver", "The Visitor Survey is opened from the Settings page.");
      res.push(C);
      if (C.lit.length !== 1 || C.lit[0] !== "legend-survey") fail("a survey answer lit " + JSON.stringify(C.lit) + " (expected ['legend-survey'])");
      var held = window.dragonDexaLegendHandOff();
      if (held !== "legend-survey") fail("the off-screen survey target was NOT remembered as a hand-off (got " + held + ")");
      // (Egon 22.10.2026: the "I'm HERE" badge is retired — the remembered hand-off above is the assert.)
    } finally {
      for (var r = 0; r < res.length; r++) { try { res[r].host.remove(); } catch (e) {} }
      try { window.dragonHere.rescan(); } catch (e) {}
    }
    return "the scorer maps anket/istatistik/notes/gallery/likes to the right chip and returns NOTHING for unrelated text; a likes reply lights EXACTLY legend-likes, an unrelated reply lights NONE, and a survey answer registers the legend-survey hand-off (throwaway bubble, no generation spent)";
  }

  async function checkDexaFeatureTip() {
    if (typeof window.dragonDexaFeatureState !== "function") fail("window.dragonDexaFeatureState is missing (src/dexa-talk.js, W-FEAT193)");
    var st = window.dragonDexaFeatureState();
    if (!st || typeof st.due !== "boolean" || !Array.isArray(st.unused)) fail("window.dragonDexaFeatureState() returned an unexpected shape");
    if (!(st.gapMs >= 3 * 3600000 && st.gapMs <= 4 * 3600000)) fail("the feature-tip gap is not the 3-4 hour window (got " + st.gapMs + " ms)");
    var keys = typeof window.dragonDexaFeatureKeys === "function" ? window.dragonDexaFeatureKeys() : null;
    if (!keys || !keys.length) fail("window.dragonDexaFeatureKeys is missing (the W-FEAT193 test hook)");
    if (keys.length < 11) fail("the tracked main-feature list is thin (" + keys.length + " keys, ~11 expected)");
    var needKeys = ["like", "chat", "character", "generate", "survey", "dexa", "galleries", "promptbank", "print", "editor", "comment"];
    var miss = [];
    for (var nk = 0; nk < needKeys.length; nk++) if (keys.indexOf(needKeys[nk]) === -1) miss.push(needKeys[nk]);
    if (miss.length) fail("the tracked feature list lost: " + miss.join(", "));
    var lines = typeof window.dragonDexaFeatureLines === "function" ? window.dragonDexaFeatureLines("ZZFEATURE") : null;
    if (!lines) fail("window.dragonDexaFeatureLines is missing (the W-FEAT193 test hook)");
    var langs = Object.keys(lines), bad = [], li, ai;
    if (langs.length < 14) fail("the feature-tip templates cover only " + langs.length + " languages");
    for (li = 0; li < langs.length; li++) {
      var arr = lines[langs[li]];
      if (!arr || arr.length < 2) { bad.push(langs[li] + " (thin)"); continue; }
      for (ai = 0; ai < arr.length; ai++) if (String(arr[ai]).indexOf("ZZFEATURE") === -1 || /[{}]/.test(String(arr[ai]))) bad.push(langs[li]);
    }
    if (bad.length) fail("feature-tip templates with an unfilled placeholder or a missing feature name: " + bad.join(", "));
    var savedTips = null;
    try { savedTips = localStorage.getItem("dragonDexaFeatureTips"); } catch (e) {}
    var added = [], first = "", notes = [];
    try {
      window.dragonDexaFeatureReset();
      if (st.unused.length) {
        var p1 = window.dragonDexaFeaturePeek();
        if (!p1 || !p1.due || !p1.pick || !p1.pick.key) fail("with a clean ledger and " + st.unused.length + " unused feature(s) the tip is neither due nor pickable");
        first = p1.pick.key;
        if (st.unused.indexOf(first) === -1) fail("the picked feature (" + first + ") is not one of the unused ones");
        // (a) a feature that has already been hinted is never offered again: the window stays open (last = 0)
        var tips = { hinted: {}, last: 0 };
        tips.hinted[first] = Date.now();
        try { localStorage.setItem("dragonDexaFeatureTips", JSON.stringify(tips)); } catch (e) {}
        var p2 = window.dragonDexaFeaturePeek();
        if (p2.pick && p2.pick.key === first) fail("a feature that was already hinted is offered a second time");
        if (!p2.pick && st.unused.length > 1) fail("the unused pool emptied although " + st.unused.length + " features are untouched (the hinted ledger is too greedy)");
      } else {
        notes.push("this visitor has already used every tracked feature, so the rotation could not be driven");
      }
      // (b) the window really closes after a tip: last = now → not due
      try { localStorage.setItem("dragonDexaFeatureTips", JSON.stringify({ hinted: {}, last: Date.now() })); } catch (e) {}
      if (window.dragonDexaFeatureState().due) fail("the 3-4 hour window did not close right after a feature tip");
      // (c) a feature the visitor has USED drops out of the pool
      if (first) {
        try { localStorage.setItem("dragonDexaFeatureTips", JSON.stringify({ hinted: {}, last: 0 })); } catch (e) {}
        window.dragonDexaUsed(first); added.push(first);
        var unused2 = window.dragonDexaFeatureState().unused;
        if (unused2.indexOf(first) !== -1) fail("a feature the visitor has used is still listed as unused");
        var p3 = window.dragonDexaFeaturePeek();
        if (p3.pick && p3.pick.key === first) fail("a feature the visitor has used is offered as a tip");
      }
    } finally {
      for (var di = 0; di < added.length; di++) { try { localStorage.removeItem("dragonDexaUsed_" + added[di]); } catch (e) {} }
      try { if (savedTips === null) localStorage.removeItem("dragonDexaFeatureTips"); else localStorage.setItem("dragonDexaFeatureTips", savedTips); } catch (e) {}
    }
    return "the unused-feature tip keeps a " + (Math.round(st.gapMs / 360000) / 10) + "-hour window, tracks " + keys.length + " main features, names an untouched feature in all " + langs.length + " languages (2 templates each, no unfilled placeholder), never repeats an already hinted feature, closes the window after a tip, and drops a feature the moment the visitor uses it" + (notes.length ? " — " + notes.join("; ") : "") + " (the visitor's own tip ledger was restored)";
  }

  // 🟣 Egon 23.09.2026 (W-UI194, rule I114) — THE "I'M HERE" BADGE + PURPLE GLOW PRIMITIVE. It is shared
  // infrastructure that W-UI180 and W-UI189 will call, so this check drives it head-on with THROWAWAY
  // buttons: the visitor's own badge state is read before the run and put back in the `finally`, so a real
  // pending badge can never be wiped by a check-up.
  // 🧩 Egon 23.09.2026 (W-UX157) — THE COLLAGE EDITOR (src/dragon-collage.js). Driven entirely through the
  // W-UX157 test hook with throwaway canvas pictures, so the whole feature is proven without touching the
  // public or the private gallery, and no generation is spent.
  // 🧩 Egon 23.09.2026 (W-UI234 follow-up) — the button LEFT the public gallery toolbar and now lives in the
  // ✏️ Image Editor ("collage is essentially about printing … put it somewhere that suits the editor's
  // page"), and the picker reads ONLY the visitor's own gallery. Both are asserted here.
  async function checkCollage() {
    if (typeof window.dragonCollageOpen !== "function") fail("window.dragonCollageOpen is missing (src/dragon-collage.js, W-UX157)");
    var T = window.dragonCollageTest;
    if (!T) fail("window.dragonCollageTest is missing (the W-UX157 test hook)");
    var startPage = ""; try { startPage = String(window.dragonPage || ""); } catch (e) {}
    if (qa(".dragon-gal-bar .dragon-collage-btn, .dragon-gal-row1 .dragon-collage-btn, .dragon-gal-collapse-bar .dragon-collage-btn, .dragon-gal-panel .dragon-collage-btn").length) {
      fail("the \uD83E\uDDE9 Collage button must NOT sit in the public gallery toolbar any more (Egon 23.09.2026: it belongs in the editor)");
    }
    // 🗂️ W-UI252 — the picker opens on a FOLDER dropdown that lists the private gallery's own folders, and
    // the grid below lists the CHOSEN folder's pictures (W-UI252 (Egon 24.09.2026): the "All folders"
    // choice is gone, the picker opens on "general", and the grid shows EVERY picture of that folder.
    var folders = T.folders();
    if (!folders || !folders.length) fail("dragonCollageTest.folders() returned nothing (W-UI252)");
    T.openPicker();
    var fpick = await waitFor(function () { return document.getElementById("dragonCollagePick"); }, TIMEOUT, 120);
    if (!fpick) fail("the collage picker did not open");
    var gridLoading = function () { var g = document.querySelector("#dragonCollagePick .dragon-cl-grid"); return !g || g.textContent.indexOf("Reading your gallery") >= 0; };
    var fsel = document.getElementById("dragonClFolder");
    if (!fsel) { T.close(); fail("the collage picker has no folder dropdown (W-UI252)"); }
    var fopts = [].slice.call(fsel.options).map(function (o) { return o.value; });
    // 🧩 W-UI252 (Egon 24.09.2026): the "All folders" choice is GONE and the picker opens on "general".
    if (fopts.indexOf("*") !== -1) { T.close(); fail('the folder dropdown still offers "All folders" (Egon 24.09.2026: remove it and open on "general")'); }
    for (var fi = 0; fi < folders.length; fi++) {
      if (fopts.indexOf(folders[fi]) === -1) { T.close(); fail('the folder dropdown is missing the folder "' + folders[fi] + '"'); }
    }
    if (fopts.indexOf("Collages") === -1) { T.close(); fail('the private gallery does not offer the Collages folder that collage Save to my gallery writes into (W-UI252)'); }
    var wantFolder = (folders.indexOf("general") !== -1) ? "general" : folders[0];
    if (fsel.value !== wantFolder) { T.close(); fail('the folder dropdown did not open on "' + wantFolder + '" (got "' + fsel.value + '")'); }
    if (T.mainTicked && T.mainTicked() !== null && T.mainTicked() !== true) { T.close(); fail("the \u2611 Use main image box is not ticked by default"); }
    for (var w3 = 0; w3 < 60 && gridLoading(); w3++) await sleep(200);
    if (gridLoading()) { T.close(); fail("the picker grid never finished reading the private gallery"); }
    var allCells = T.shownCells();
    // 🧩 W-UI252 (Egon 24.09.2026): the counter reads Total / Selected / Max, left to right, and the grid
    // really offers every picture in the folder (it used to stop at ~150 of 1618 — the old hard cap).
    var ctext = T.countText() || "";
    if (!/^Total \d+/.test(ctext)) { T.close(); fail('the picker counter does not start with "Total N" (got "' + ctext + '")'); }
    if (ctext.indexOf("Selected") === -1 || ctext.indexOf("Max") === -1) { T.close(); fail('the picker counter is missing "Selected"/"Max" (got "' + ctext + '")'); }
    if (T.folderPictures() !== allCells) { T.close(); fail("the picker shows " + allCells + " tiles for a folder holding " + T.folderPictures() + " pictures (W-UI252)"); }
    fsel.value = folders[0];
    fsel.dispatchEvent(new Event("change", { bubbles: true }));
    for (var w4 = 0; w4 < 34 && gridLoading(); w4++) await sleep(200);
    if (gridLoading()) { T.close(); fail('switching the dropdown to "' + folders[0] + '" never repainted the grid (W-UI252)'); }
    var oneCells = T.shownCells();
    if (oneCells > allCells) { T.close(); fail("one folder listed more pictures (" + oneCells + ") than all folders together (" + allCells + ")"); }
    T.close();
    await sleep(140);
    if (T.isPickerOpen()) fail("the collage picker did not close");
    // open the ✏️ Image Editor on a throwaway 8x8 data URL — nothing is generated and nothing is uploaded
    var c0 = document.createElement("canvas"); c0.width = 8; c0.height = 8;
    var cx0 = c0.getContext("2d"); cx0.fillStyle = "#223355"; cx0.fillRect(0, 0, 8, 8);
    window.dragonPrintEditor({ url: c0.toDataURL("image/png"), prompt: "check-up collage" });
    var pv = await waitFor(function () { return document.getElementById("dragonPrintPreview"); }, TIMEOUT, 150);
    var editorDown = function () { try { window.dragonPrintPreviewClose(); } catch (e) {} };
    if (!pv) fail("the \u270F\uFE0F Image Editor did not open for the collage check");
    var btn = null;
    try { btn = document.querySelector("[data-pp='collage']"); } catch (e) {}
    if (!btn) { editorDown(); fail("the \uD83E\uDDE9 Collage button is missing from the \u270F\uFE0F Image Editor (Egon 23.09.2026: collage belongs in the editor)"); }
    if (String(btn.textContent).indexOf("Collage") === -1) { editorDown(); fail('the editor\'s collage button does not read "Collage" (got "' + btn.textContent + '")'); }
    var color = ["#e11d2f", "#7a4ddb", "#0ea5e9", "#22c55e", "#f59e0b", "#ec4899"];
    var items = color.map(function (c) {
      var cv = document.createElement("canvas"); cv.width = 40; cv.height = 40;
      var g = cv.getContext("2d"); g.fillStyle = c; g.fillRect(0, 0, 40, 40);
      return { url: cv.toDataURL("image/png"), kind: "check" };
    });
    var sigs = {};
    try {
      T.close();
      await sleep(80);
      T.openEditor(items);
      await sleep(120);
      if (!T.isOpen()) fail("the collage editor did not open");
      if (T.patterns.length < 6) fail("only " + T.patterns.length + " automatic patterns are offered (5-6 expected)");
      for (var i = 0; i < T.patterns.length; i++) {
        var name = T.patterns[i];
        var rects = T.applyPattern(name);
        if (rects.length !== items.length) fail('the "' + name + '" pattern placed ' + rects.length + " of " + items.length + " pictures");
        var cov = rects.reduce(function (a, r) { return a + r.w * r.h; }, 0) / 100;
        if (cov < 80 || cov > 100.5) fail('the "' + name + '" pattern covers ' + Math.round(cov) + "% of the canvas (a full layout expected)");
        for (var qq = 0; qq < rects.length; qq++) {
          var r = rects[qq];
          if (!(r.w > 0 && r.h > 0)) fail('the "' + name + '" pattern produced a zero-size tile');
          if (r.x < -0.5 || r.y < -0.5 || r.x + r.w > 100.5 || r.y + r.h > 100.5) fail('the "' + name + '" pattern places a picture outside the canvas (' + Math.round(r.x) + "," + Math.round(r.y) + " " + Math.round(r.w) + "x" + Math.round(r.h) + ")");
        }
        sigs[name] = rects.map(function (r) { return Math.round(r.x) + "," + Math.round(r.y) + "," + Math.round(r.w) + "," + Math.round(r.h); }).join("|");
      }
      var uniq = {}; Object.keys(sigs).forEach(function (k) { uniq[sigs[k]] = 1; });
      if (Object.keys(uniq).length < 6) fail("two of the six patterns lay the pictures out identically");
      // drag: a picture really follows the pointer
      T.applyPattern("grid2");
      var stage = T.stageRect();
      if (!stage || stage.width < 100) fail("the collage canvas has no measurable size");
      var before = T.tiles()[0];
      var el = T.tileEl(0);
      if (!el) fail("no tile was drawn on the canvas");
      var pd = function (type, x, y) { el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, buttons: 1, pointerId: 11, pointerType: "mouse" })); };
      pd("pointerdown", stage.left + 12, stage.top + 12);
      pd("pointermove", stage.left + 90, stage.top + 80);
      pd("pointerup", stage.left + 90, stage.top + 80);
      await sleep(80);
      var after = T.tiles()[0];
      if (before.x === after.x && before.y === after.y) fail("dragging a picture did not move it");
      // 🔍 W-UI252 (Egon 24.09.2026) — ONE zoom for the whole canvas: it must shrink / grow EVERY tile, never a
      // single one, and the picture inside a tile must be switchable between fill (cropped) and whole-picture.
      T.setZoom(1);
      var slots = T.tiles();
      if (T.setZoom(0.5) !== 0.5) fail("the collage canvas zoom refused 50%");
      var half = T.zRects();
      if (half.length !== slots.length) fail("the zoom changed the number of tiles");
      for (var zi = 0; zi < half.length; zi++) {
        if (!(half[zi].w < slots[zi].w && half[zi].h < slots[zi].h)) fail("the canvas zoom did not shrink every tile");
      }
      if (String(T.zoomPct()).indexOf("50") === -1) fail('the zoom did not report 50% (got "' + T.zoomPct() + '")');
      T.setZoom(1);
      if (T.fit && T.setFit("contain") !== "contain") fail("the collage refused the whole-picture mode");
      var tEl = T.tileEl(0);
      if (tEl && tEl.querySelector("img") && String(tEl.querySelector("img").style.objectFit) !== "contain") fail("the whole-picture mode did not reach the tiles");
      if (T.fit) T.setFit("cover");
      var n0 = T.tiles().length;
      T.addTile(items[0], 50, 50);
      if (T.tiles().length !== n0 + 1) fail("adding a picture from the left strip did not grow the collage");
      // export: the chosen aspect really drives the PNG
      T.setAspect("4:3");
      var blob = await T.exportBlob();
      if (!blob || blob.type !== "image/png" || blob.size < 500) fail("the collage did not export a real PNG (" + (blob ? blob.size + " bytes, " + blob.type : "null") + ")");
      var bmp = null; try { bmp = await createImageBitmap(blob); } catch (e) {}
      if (!bmp) fail("the exported PNG could not be decoded");
      var w1 = bmp.width, h1 = bmp.height; try { bmp.close(); } catch (e) {}
      T.setAspect("16:9");
      var blob2 = await T.exportBlob();
      var bmp2 = null; try { bmp2 = await createImageBitmap(blob2); } catch (e) {}
      if (!bmp2) fail("the 16:9 collage did not export");
      var w2 = bmp2.width, h2 = bmp2.height; try { bmp2.close(); } catch (e) {}
      if (w1 !== 1600 || h1 !== 1200) fail("the 4:3 export came out " + w1 + "x" + h1 + " (1600x1200 expected)");
      if (w2 !== 1600 || h2 !== 900) fail("the 16:9 export came out " + w2 + "x" + h2 + " (1600x900 expected)");
    } finally {
      try { T.close(); } catch (e) {}
      try { window.dragonPrintPreviewClose(); } catch (e) {}
      try { if (startPage && window.dragonGoPage) window.dragonGoPage(startPage); } catch (e) {}
    }
    return "the \uD83E\uDDE9 Collage button now sits in the \u270F\uFE0F Image Editor (and NOT in the public gallery toolbar), its picker reads only the visitor's own gallery and opens on \u201Cgeneral\u201D (no \u201CAll folders\u201D), it shows the folder's full picture count in a \u201CTotal / Selected / Max\u201D counter, the Collages folder is registered in the private gallery, the opened picture is ticked into the collage by default, all " + T.patterns.length + " automatic patterns place every picture (each covering the whole canvas and each layout distinct), a picture can be dragged on the canvas, ONE zoom shrinks or grows every tile together, a copy can be added from the left strip, and the export renders a real PNG at the chosen aspect (no generation spent)";
  }


  var CHECKS = [
    ["globals", function () { return checkGlobals(); }],
    ["plugins", function () { return checkPlugins(); }],
    ["build-sync", function () { return checkBuildSync(); }],
    ["navbar", function () { return checkNavbar(); }],
    ["pages", function (ctx) { return checkPages(ctx); }],
    ["overflow", function (ctx) { return checkOverflow(ctx); }],
    ["generate-ui", function () { return checkGenerateUI(); }],
    ["public-gallery", function (ctx) { return checkPublicGallery(ctx); }],
    ["gal-load-window", function () { return checkGalLoadWindow(); }],
    ["btn-families", function () { return checkBtnFamilies(); }],
    ["auto-tags", function () { return checkAutoTags(); }],
    ["style-registry", function () { return checkStyleRegistry(); }],
    ["pager-idle", function () { return checkPagerIdle(); }],
    ["lb-close-nomove", function () { return checkLightboxCloseNoMove(); }],
    ["gal-title", function () { return checkGalTitles(); }],
    ["gal-toolbar", function () { return checkGalToolbar(); }],
    ["gal-search-tools", function () { return checkGalSearchTools(); }],
    ["gal-sort-menu", function () { return checkGalSortMenu(); }],
    ["image-sort", function () { return checkImageSort(); }],
    ["liked-count", function () { return checkLikedCount(); }],
    ["gallery-top", function () { return checkGalleryTop(); }],
    ["likes-live", function () { return checkLikesLive(); }],
    ["like-backfill", function () { return checkLikeBackfill(); }],
    ["likes-ledger", function () { return checkLikesLedger(); }],
    ["popup-region", function () { return checkPopupRegion(); }],
    ["report-flow", function () { return checkReportFlow(); }],
    ["admin-page", function () { return checkAdminPage(); }],
    ["admin-records", function () { return checkAdminRecords(); }],
    ["ban-vault", function () { return checkBanVault(); }],
    ["whatsnew", function () { return checkWhatsNew(); }],
    ["gal-menu-fit", function () { return checkGalMenuFit(); }],
    ["gal-sub-chrome", function () { return checkSubChrome(); }],
    ["gal-sub-sort", function () { return checkSubSort(); }],
    ["tile-range", function () { return checkTileRange(); }],
    ["marquee-lane", function () { return checkMarqueeLane(); }],
    ["reload-notice-wake", function () { return checkReloadNoticeWake(); }],
    ["undupe", function () { return checkUndupe(); }],
    ["tools-buttons", function () { return checkToolsButtons(); }],
    ["talk-bubble", function () { return checkTalkBubble(); }],
    ["home-v7", function () { return checkHomeV7(); }],
    ["home-cta-reach", function () { return checkHomeCtaReach(); }],
    ["user-search", function () { return checkUserSearch(); }],
    ["blocked-log", function () { return checkBlockedLog(); }],
    ["tabs-strip", function () { return checkTabsStrip(); }],
    ["mini-arrange", function () { return checkMiniArrange(); }],
    ["gal-justified", function () { return checkGalJustified(); }],
    ["tile-walls", function () { return checkTileWalls(); }],
    ["display-twin", function () { return checkDisplayTwin(); }],
    ["display-matrix", function () { return checkDisplayMatrix(); }],
    ["pub-count", function () { return checkPubCount(); }],
    ["view-count-source", function () { return checkViewCountSource(); }],
    ["print-editor", function () { return checkPrintEditor(); }],
    ["share-edit", function () { return checkShareEdit(); }],
    ["site-search", function () { return checkSiteSearch(); }],
    ["picture-comments", function () { return checkPictureComments(); }],
    ["retouch-brush", function () { return checkRetouchBrush(); }],
    ["saver-clean", function () { return checkSaverClean(); }],
    ["saver-style", function () { return checkSaverStyle(); }],
    ["fnfix-immunity", function () { return checkFnScopeImmunity(); }],
    ["region-map", function () { return checkRegionMap(); }],
    ["private-vault", function (ctx) { return checkVault(ctx); }],
    ["vault-menu", function (ctx) { return checkVaultMenu(ctx); }],
    ["survey", function () { return checkSurvey(); }],
    ["permanent-ledger", function () { return checkPermLedger(); }],
    ["chat", function (ctx) { return checkChat(ctx); }],
    ["chat-close", function () { return checkChatClose(); }],
    ["toolbar-collapse-guard", function () { return checkCollapseGuard(); }],
    ["storage-dialog", function () { return checkStorageDialog(); }],
    ["purge-scope", function () { return checkPurgeScope(); }],
    ["visitor-stats", function () { return checkVisitorStats(); }],
    ["visitors-merge", function () { return checkVisitorsMerge(); }],
    ["visitor-devices", function () { return checkVisitorDevices(); }],
    ["kissing-standard", function (ctx) { return checkKissing(ctx); }],
    ["art-style-panel", function () { return checkArtStylePanel(); }],
    ["studio", function () { return checkStudio(); }],
    ["upmeta", function () { return checkUpmeta(); }],
    ["self-test-sweep", function () { return checkSweep(); }],
    ["site-background", function () { return checkSiteBg(); }],
    ["rainy-saver", function () { return checkRainySaver(); }],
    ["settings-buttons", function () { return checkSettingsButtons(); }],
    ["news-detail", function () { return checkNewsDetail(); }],
    ["collage", function () { return checkCollage(); }],
    ["page-headings", function () { return checkPageHeadings(); }],
    ["chat-stamp", function () { return checkChatStamp(); }],
    ["duplicate-ids", function () { return checkDupIds(); }],
    ["legends-sync", function () { return checkLegendsSync(); }],
    ["dexa-context", function () { return checkDexaContext(); }],
    ["dexa-persona", function () { return checkDexaPersona(); }],
    ["dexa-legends", function () { return checkDexaLegends(); }],
    ["dexa-auto-highlight", function () { return checkDexaAutoHighlight(); }],
    ["dexa-feature-tip", function () { return checkDexaFeatureTip(); }],
    ["survey-sync", function () { return checkSurveySync(); }],
    ["console-clean", function (ctx, opts) { return checkConsole(ctx, opts); }]
  ];

  async function run(opts) {
    opts = opts || {};
    var t0 = now();
    var ctx = { startPage: pageAttr() || "home", overflow: {}, errors: [], openedVault: false, openedChat: false };
    var restore = captureErrors(ctx.errors);
    // 🆕 Egon 25.09.2026 (W-EFOR282) — a check-up run must not be interrupted by the interactive popup: it is
    // suspended for the duration of the pass (its own chance is NOT spent) and released in the finally below.
    try { if (window.dragonPopupSuppress) window.dragonPopupSuppress(true); } catch (e) {}
    var list = CHECKS;
    if (opts.only && opts.only.length) list = CHECKS.filter(function (c) { return opts.only.indexOf(c[0]) !== -1; });
    // 🟢 GREEN CYCLE (Egon 23.09.2026): the run counter decides whether this is the forced GLOBAL check-up.
    var runs = runsRead() + 1;
    var globalRun = !!(opts.full || opts.global || (runs % GLOBAL_EVERY === 0));
    var onlyRun = !!(opts.only && opts.only.length);
    var green = greenRead();
    var checks = [];
    // 💬⭐🔥 Egon 23.09.2026 (+ 24.09.2026 for trending) — DETERMINISM PIN (not a product change). The
    // gallery checks measure TILE COUNTS, and the three LOCAL filter modes must never be the frame they are
    // measured in: "Commented", "Liked" and "Trending" are filters over the listing and LEGITIMATELY render
    // an empty grid while nothing carries a comment / a like / a popularity point yet. Measured on a global run:
    // the visitor's persisted localStorage.dragonGallerySort = "commented" (left behind by a sort test)
    // answered "no public gallery tiles" and turned five gallery checks red although nothing was broken.
    // The visitor's own choice is snapshotted here and put back byte-exact in the finally below.
    var sortPin = null;
    _panelOpenRestore = null;   // a check that opens a panel registers its own DOM restore here
    try {
      var _sv = localStorage.getItem("dragonGallerySort");
      if (_sv === "commented" || _sv === "liked" || _sv === "trending") { sortPin = _sv; localStorage.setItem("dragonGallerySort", "recent"); }
    } catch (e) {}
    // 🖼️ Egon 23.09.2026 — the same rule for the two LOOK settings (I129). The gallery checks switch the
    // display mode dozens of times (display-twin/display-matrix walk all 12) and each of them restores its
    // own value, but measured over a FULL run something still landed on "cover" in the end — a race between
    // a check's restore and an earlier check's still-pending repaint. The visitor's own look is snapshotted
    // here and put back byte-exact after the run, so a check-up can never change how their galleries look.
    var lookPin = null;
    try {
      lookPin = {
        gal: localStorage.getItem("dragonGalDisplay"),
        vault: localStorage.getItem("dragonVaultDisplay"),
        filter: localStorage.getItem("dragonGalleryFilter")
      };
    } catch (e) {}
    // 🏠 Egon 27.09.2026 — the same rule (I129) for the app's OWN activity bookkeeping. Simply WALKING the
    // site during a pass writes a few of the app's keys (the home tour's seen flag + item timestamp, the
    // gallery heading cache, the prompt-history url list, the Dexa tip counters). None of them is a "look"
    // setting, but they are still the visitor's own data, so they are snapshotted here and put back
    // byte-exact in the finally below.
    var bookPin = null;
    try {
      bookPin = {};
      ["dragonHomeSeen", "dragonHomeItemsTs", "dragonGalHeads", "dragonPhUrls", "dragonAiTags"].forEach(function (k) {
        bookPin[k] = localStorage.getItem(k);
      });
      Object.keys(localStorage).forEach(function (k) {
        if (k.indexOf("dragonDexaUsed_") === 0) bookPin[k] = localStorage.getItem(k);
      });
    } catch (e) {}
    try {
      for (var i = 0; i < list.length; i++) {
        var name = list[i][0], fn = list[i][1], t = now();
        var cat = catOf(name);
        var g = green[name];
        var deps = DEPS[name] || [];
        var mh = null;
        if (deps.length) mh = await depManifestHash(deps);
        var sig = mh ? (sigOf(fn) + "#" + mh) : null;
        if (!globalRun && !onlyRun && sig && g && (g.n | 0) >= GREEN_AFTER && g.s === sig) {
          checks.push({ name: name, cat: cat, ok: true, skipped: true, ms: 0, detail: "green \u00D7" + (g.n | 0) + " \u2014 unchanged since the last " + GREEN_AFTER + " clean runs (skipped per the check-up rule)" });
          continue;
        }
        var res;
        try { res = { name: name, cat: cat, ok: true, detail: String(await fn(ctx, opts) || ""), ms: Math.round(now() - t) }; }
        catch (e) { res = { name: name, cat: cat, ok: false, detail: (e && e.message) || String(e), ms: Math.round(now() - t) }; }
        checks.push(res);
        if (res.ok && sig) green[name] = { n: Math.min(99, ((g && g.s === sig) ? (g.n | 0) : 0) + 1), s: sig, at: Date.now() };
        else green[name] = { n: 0, s: sig || sigOf(fn), at: Date.now() };
      }
    } finally {
      if (ctx.openedChat && window.dragonChatClose) { try { window.dragonChatClose(); } catch (e) {} }
      try { if (window.dragonPopupSuppress) window.dragonPopupSuppress(false); } catch (e) {}
      if (ctx.startPage && window.dragonGoPage) { try { window.dragonGoPage(ctx.startPage); } catch (e) {} }
      if (sortPin !== null) { try { localStorage.setItem("dragonGallerySort", sortPin); } catch (e) {} }
      if (lookPin) {
        try {
          if (lookPin.gal === null) localStorage.removeItem("dragonGalDisplay"); else localStorage.setItem("dragonGalDisplay", lookPin.gal);
          if (lookPin.vault === null) localStorage.removeItem("dragonVaultDisplay"); else localStorage.setItem("dragonVaultDisplay", lookPin.vault);
          if (lookPin.filter === null) localStorage.removeItem("dragonGalleryFilter"); else localStorage.setItem("dragonGalleryFilter", lookPin.filter);
        } catch (e) {}
      }
      if (bookPin) {
        try {
          Object.keys(bookPin).forEach(function (k) {
            if (bookPin[k] === null) localStorage.removeItem(k); else localStorage.setItem(k, bookPin[k]);
          });
        } catch (e) {}
      }
      // ✨ a check that has to OPEN something (e.g. the Art Style panel, so its contents can be measured)
      // registers its own DOM restore here; it is called once, after every check, whatever happened.
      if (typeof _panelOpenRestore === "function") { try { _panelOpenRestore(); } catch (e) {} }
      restore();
    }
    if (!onlyRun) { greenWrite(green); runsWrite(runs); }
    var failed = checks.filter(function (c) { return !c.ok; });
    var errs = (ctx.errors || []).filter(function (e) { return !isAllowed(e, opts.allowErrors); });
    var byCat = {};
    checks.forEach(function (c) { (byCat[c.cat] = byCat[c.cat] || []).push(c); });
    var skippedN = checks.filter(function (c) { return c.skipped; }).length;
    var executedN = checks.length - skippedN;
    var coverageN = checks.length ? (executedN / checks.length) : 1;
    return {
      ok: failed.length === 0 && errs.length === 0,
      build: bv(),
      startedOn: ctx.startPage,
      page: pageAttr(),
      passed: checks.length - failed.length,
      failed: failed.length,
      skipped: skippedN,
      executed: executedN,
      coverage: Math.round(coverageN * 1000) / 1000,
      lowConfidence: coverageN < LOW_COVERAGE,
      runs: runs,
      globalRun: globalRun,
      globalDue: (runs % GLOBAL_EVERY === 0),
      categories: byCat,
      ms: Math.round(now() - t0),
      checks: checks,
      errors: errs
    };
  }

  // 🗂️ the Logbook-shaped record (rule: check-up reports are filed by CATEGORY, listing the checks that ran)
  function formatByCategory(res) {
    if (!res) return "no result";
    var lines = [];
    lines.push("Check-up " + (res.ok ? "CLEAN" : "FAILED") + " | build " + res.build + " | " + res.checks.length + " test · çalıştı " + (res.executed == null ? res.checks.length : res.executed) + " · atlandı " + (res.skipped || 0) + " · kapsam %" + Math.round(((res.coverage == null ? 1 : res.coverage)) * 100) + (res.lowConfidence ? " · ⚠️ düşük güven" : "") +
      " in " + (res.ms / 1000).toFixed(1) + "s | run #" + res.runs + (res.globalRun ? " \u2014 GLOBAL" : ""));
    var cats = res.categories || {};
    Object.keys(cats).sort().forEach(function (k) {
      var ok = cats[k].every(function (c) { return c.ok; });
      lines.push("  " + (ok ? "\u2705" : "\u274C") + " " + k + " (" + cats[k].length + "): " + cats[k].map(function (c) { return c.name + (c.skipped ? "\u2713green" : ""); }).join(" \u00B7 "));
      cats[k].forEach(function (c) { if (!c.ok) lines.push("      [FAIL] " + c.name + " - " + c.detail); });
    });
    if (res.errors && res.errors.length) {
      lines.push("  console errors:");
      res.errors.forEach(function (e) { lines.push("    - " + e.type + ": " + e.text); });
    }
    return lines.join("\n");
  }
  window.dragonCheckupByCategory = formatByCategory;

  function format(res) {
    if (!res) return "no result";
    var lines = [];
    lines.push("Check-up " + (res.ok ? "CLEAN" : "FAILED") + " | build " + res.build + " | " + res.passed + "/" + res.checks.length + " · kapsam %" + Math.round(((res.coverage == null ? 1 : res.coverage)) * 100) + (res.lowConfidence ? " · ⚠️ düşük güven" : "") + " in " + (res.ms / 1000).toFixed(1) + "s");
    res.checks.forEach(function (c) {
      lines.push((c.ok ? "  [ok]   " : "  [FAIL] ") + c.name + " - " + c.detail);
    });
    if (res.errors && res.errors.length) {
      lines.push("  console errors:");
      res.errors.forEach(function (e) { lines.push("    - " + e.type + ": " + e.text); });
    }
    return lines.join("\n");
  }

  run.__v = VERSION;
  run.format = format;
  window.dragonCheckup = run;
  window.dragonCheckupFormat = format;
  window.dragonSweep = sweepRun;
})();
