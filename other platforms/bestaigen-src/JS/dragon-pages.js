
(function () {
  // ===== DRAGON PAGES (Egon 10.09.2026) — navbar buttons become separate pages =====
  if (window.__dragonPagesInstalled) return;
  window.__dragonPagesInstalled = true;
  // 🧪 Egon 23.09.2026 (W-UI190) — the legends DATA now lives at MODULE level (this function),
  // not inside the Settings rebuild, so the check-up can read it the moment the page loads. A new button
  // that never got a legends row is exactly what must not slip by (rule I116).
  ;function dragonLegendsData() {
        var L = [
          ["Top navigation bar", [
            ["\uD83C\uDFE0 Home", "The welcome page \u2014 a rotating wall of community images and the main buttons."],
            ["\u2728 Generate", "The main creation page: prompt, Control Panel, Art Style and the Generate button."],
            ["\uD83D\uDC83 Character Creation", "Builds a character step by step from categories (hair, outfit, pose\u2026)."],
            ["\uD83D\uDDBC\uFE0F Galleries", "Opens the galleries \u2014 the public feed and your private collection."],
            ["\u2B50 Likes", "Your own saved images, organised into folders, favourites and tags."],
            ["\uD83D\uDD58 History", "Image History and Prompt History \u2014 your own recent images, and the most recent prompts generated here."],
            ["\uD83D\uDCAC Chat", "Opens the floating community chat window."],
            ["\uD83D\uDC8C Private Messages", "The \uD83D\uDC8C button left of the \uD83D\uDD14 toggle opens your private message box: end-to-end encrypted chats for two, each conversation deletable with Delete/Cancel. The \uD83D\uDC65 button in the box header lists the people in chat, each with its own \uD83D\uDC8C send button."],
            ["\u2699\uFE0F Settings", "Sound, themes, display preferences \u2014 and the \uD83D\uDD0D Buttons & Legends reference (search + every symbol explained)."],
            ["\uD83D\uDD1D", "Scroll to top \u2014 appears once you scroll down; returns to the very top."]
          ]],
          ["Chat \u2014 the floating window", [
            ["\u26F6 in the chat header", "Switch the chat between the floating window and the full page under the navbar. The floating window is the DEFAULT; your choice is remembered."],
            ["\u2715 on a channel name", "Appears ONLY on a channel you added yourself: click it to close that channel for yourself. The built-in channels (General, Room 1, Room 2, Prompts, Images, Suggestion) are always there, and General is never closable."],
            ["\uFF0B beside the channel names", "Add a chat channel \u2014 or type the name of a channel you closed to bring it back. While the add-channel window is open the \uFF0B button is inactive, so it cannot open a second window."],
            ["\uD83D\uDDD3\uFE0F left of the channel names", "Message range \u2014 narrow the feed to Today / This week / This month / This year, or All messages. All messages (no filter at all) is the DEFAULT; picking a range really applies it (the channel is reloaded), and a range with no messages yet anchors on the newest message so the window is never empty."]
          ]],
          ["Home page", [
            ["\u2728 Generate \u2728", "Goes to the creation page, ready for a new prompt."],
            ["\uD83D\uDC83 Character Creation \uD83D\uDC83", "Opens the character builder."],
            ["\uD83D\uDDBC\uFE0F Galleries \uD83D\uDDBC\uFE0F", "Opens the galleries."],
            ["\u2728 Ai Chat \u2728", "Opens the Ai Chat page \u2014 chatting with Dexa and the character bots moves in with the chat build."],
            ["\uD83C\uDFE0 Home style", "The home page can wear eight looks \u2014 Settings \u25B8 \uD83C\uDFE0 Home Page switches between them. The default one, \u201CMosaic\u201D (V8), paves the whole screen with gallery images as one wall of equal-height rows, cut into rounded tiles with small gaps between them; \u201CSeamless\u201D (V7) is the same wall with no gaps at all. Both show the same title and buttons \u2014 they differ only in the background. Your choice is remembered."]
          ]],
          ["Create page \u2014 the prompt box", [
            ["\u2728 Generate \u2728", "Purple button under the description: generates from the text in the box."],
            ["\u2728 generate", "The main Generate button in the bottom bar \u2014 the same action, always visible."],
            ["\uD83C\uDFB2", "Fills the description with a random ready-made prompt."],
            ["\uD83E\uDDE0", "AI Suggest \u2014 the AI writes a fresh prompt for you."],
            ["\uD83E\uDE84", "AI Magic \u2014 the AI improves the prompt already written in the description."],
            ["\u2795", "Add new prompt line \u2014 adds the description as a new prompt line; press Generate and every line (including any text still in the box) produces Count images at the same time."],
            ["\u2B06\uFE0F / \u2B07\uFE0F", "Steps back / forward through your recent prompts."],
            ["\uD83D\uDD12", "Seed Lock \u2014 keeps the same random seed so the next image keeps the same look."],
            ["\uD83D\uDCA1", "Tips \u2014 how to use the generator."],
            ["\uD83C\uDF10", "Auto-Translate \u2014 turns the description into English before generating."],
            ["\uD83C\uDFAD", "Character Lock \u2014 keeps the same character across generations."],
            ["\u270F\uFE0F", "Image to Prompt \u2014 reads a picture and turns it into a prompt."],
            ["\uD83C\uDFE6", "Prompt Bank \u2014 brings the next saved prompt into the box."],
            ["\uD83D\uDDD1", "Prompt Bank \u2014 removes the current prompt from the bank."],
            ["\uD83D\uDCCC", "Prompt Bank \u2014 saves the current prompt to the bank."],
            ["\uD83D\uDCDD", "Scratchpad \u2014 a quick notepad for prompts."],
            ["\uD83E\uDDEA Tag Lab", "Prompt Tag Lab \u2014 build, test and save prompt tags."],
            ["\uD83C\uDFA8 Art Style panel", "The \uD83C\uDFA8 Art Style panel stands directly above the \uD83D\uDEE0 Studio (and the Studio above the \u2699\uFE0F Control Panel, then the \uD83D\uDCDD Prompt Panel, then \u2728 Generate \u2014 one stack, all the same width, touching). Filter the styles with the search bar, clear the filter with the red \u2716 inside it, \uD83C\uDFB2 Randomize Style picks one for you, and the styles are listed three to a row \u2014 tap one to use it. No style is the default style, and every style that already has a generated preview shows it in its own tile. The grey box beside every style is its own preview tile; it reads \u201CPreview Soon\u201D until the generated previews arrive."],
            ["\uD83D\uDEE0 Studio", "The \uD83D\uDEE0 Studio panel stands directly below the \uD83C\uDFA8 Art Style panel. Its \uD83D\uDCD5 Lookbook: describe a character once, edit the poses (add outfits for a poses-times-outfits matrix) and press Produce: every frame renders as a real tile with one fixed seed, so the cards and the history fill through the normal paths. Stop and resume any time, race seeds on pose one, and optionally save the frames to the Private Gallery studio folder. The \uD83E\uDD16 AutoPilot tab produces endlessly from word pools (subject, pool and word settings inside)."],
            ["\u2697\uFE0F Test Multiple Styles", "Turns MULTIPLE SELECTION on. A button row appears under it \u2014 \uD83D\uDD12 Lock Seed \u00B7 style counter \u00B7 big red \u2728 Generate \u2728 \u00B7 \u2705 Select All \u00B7 \u2716 Clear All \u2014 and every style you tap is collected (the button counts them). Pick at least two and press \u2728 Generate: the same prompt is rendered once per chosen style, side by side, so the styles can be compared at a glance. \uD83D\uDD12 Lock Seed keeps every compared style on ONE seed. Your selection is remembered on your device: it survives generating and closing plus reopening the panel. Every category heading also carries its own bigger tick box on the left — one press selects or clears that whole category."],
            ["\uD83C\uDFA8 Mixed Art Style", "Blend two art styles into one prompt \u2014 weighted fusion, diptych, mashup and more."],
            ["\uD83C\uDFF7\uFE0F Image Info", "The \uD83C\uDFF7\uFE0F Image Info row inside the \u2699\uFE0F Control Panel stamps gallery uploads: a Title plus a Username (sent as TITLE by X, or the bare username when the title is empty \u2014 an empty row sends no title at all unless the server user tag is already known, never a prompt excerpt). The production date is stamped automatically, there is no date box. Everything is remembered on this device. Titled gallery pictures show their title on the tile (unless hidden again); history cards show each image's stamped title and date. The public gallery toolbar's 🧰 Toolbox carries a Show menu (Title · Username · Date, each on/off starting off, all off hides every caption and the Prompt Info title row)."],
            ["\uD83D\uDDBC\uFE0F Image History", "Your own generated images, grouped by day \u2014 click a date heading to collapse or expand that day\u2019s images — the production cards above it follow the Control Panel's Display setting instead. Its head is a full-width button with exactly the Control Panel's size; each date heading carries its own \uD83E\uDDF9 button that deletes ONLY that day\u2019s images. It stays visible in EVERY Display mode and reappears by itself after a generation."],
            ["\uD83D\uDCBB\uFE0F Process Panel", "Replaces the old generate button above the output boxes: expand it to see the output display boxes (and the small Original boxes button), collapse it to hide them. The production cards sit directly under this panel."],
            ["\uD83D\uDDBC\uFE0F Original boxes", "Inside the Process Panel, under the output boxes: drops our picture buttons and shows the original generation boxes instead. Click again to bring our cards back."],
            ["\uD83D\uDDBC\uFE0F Image Generation Monitor", "Control Panel (Generate page), under the CFG / Panels / Display / Seed / Count controls: switches the generated-image look — Default (original boxes + action buttons below, Process panel only) / Modern (tiles and finished cards in one box, Process panel only) / Seperated (small output row + finished cards, Process and Production panels) / Custom Monitor (your own mix: panels, tile size, card home and buttons, or the Default Panel with original boxes and nothing extra)."],
            ["\uD83C\uDFF7\uFE0F Automatic Quality Tags", "Switches OFF the quality tags the generator adds to every prompt on its own. Green means ON (default). With it OFF your prompt goes exactly as you wrote it, plus whatever the chosen art style adds. Click to change it \u2014 the next generate follows the switch."],
            ["\uD83D\uDEAB Automatic Negative Prompt", "Switches OFF the negative prompt the generator adds on its own. Green means ON (default). With it OFF only the negatives you wrote yourself are used. Click to change it \u2014 the next generate follows the switch."],
            ["\uD83D\uDD90 Arrange Buttons", "Makes the small buttons around the prompt box movable. There are FOUR places a button can live: the control-panel row (the row of mini buttons under the prompt box), the description column (the narrow column of buttons right of the description box), and TWO extra strips inside the grey Description panel \u2014 one running across the TOP of the description box and one down its LEFT side. Drag any button to any of the four: from the control panel to the description column or the other way round, or into the top / left strip, where it sits as a full-width row or a side column. The two strips take no room at all while they are empty, so nothing moves until you actually drop a button there; turning arrange mode on opens them with a dashed outline and a purple glow so you can see where they are. The SET of buttons never changes, only their order and which of the four places they sit in, and a button that moves takes on the size standard of its new home. Press \u21BA Reset to put the original layout back and \u2714 Done to leave the mode; your arrangement is remembered until you reset it."]
          ]],
          ["Generated image \u2014 the round action row", [
            ["Share", "Sends the image to WhatsApp, Facebook, X, Telegram\u2026"],
            ["\uD83D\uDCCC", "Save To Prompt Bank \u2014 keeps the prompt that produced this image."],
            ["\uD83C\uDFAD", "Persona / Chat \u2014 builds a character card from the image and chats with them."],
            ["\uD83D\uDD06", "Enhance \u2014 recreates the image at higher quality."],
            ["\uD83C\uDFAC", "AI Video \u2014 turns the image into a short video."],
            ["\uD83D\uDC41\uFE0F", "AI Analyze & Improve \u2014 the AI looks at the image and rewrites its prompt."],
            ["\uD83D\uDCAB", "Upscale \u2014 increases the resolution."],
            ["\u2B07\uFE0F", "Download \u2014 saves the image to your device."],
            ["\uD83D\uDD0D", "Zoom In \u2014 opens the image in the full-screen viewer."],
            ["\uD83D\uDD04", "Refresh with a NEW seed \u2014 regenerates only this image with a fresh random seed (the blue one)."],
            ["\u267B\uFE0F", "Refresh with the SAME seed \u2014 regenerates only this image with its own seed (the red one)."],
            ["\u2B50", "Save To Likes \u2014 saves the image to your private gallery."]
          ]],
          ["Full-screen viewer (lightbox)", [
            ["\u2764\uFE0F / \uD83D\uDC98", "Favorites / What I Like \u2014 moves the image into Favorites and opens its tags."],
            ["\u2B50", "Save To Likes \u2014 a green tick means it is already saved."],
            ["\u2139\uFE0F", "Prompt Info \u2014 shows prompt, negative prompt and seed, with a centered top row: Copy, Use Prompt (puts this prompt into the description box), Save To Prompt Bank, Capture Style and Generate 4."],
            ["\uD83D\uDEA9", "Report Image \u2014 opens the report window for this picture."],
            ["\uD83C\uDFA8 Image Editor", "The round \uD83C\uDFA8 (artist's palette) button in the \u2026 menu. Print \u2014 opens OUR OWN paper editor straight away. The picture lands on a real white sheet, fitted so its longer side sits exactly on the paper edge with no white seam; pick the paper first \u2014 A6, A5, A4, Letter, Legal, A3, Tabloid, Square, A2, A1, A0 and four poster sizes up to 60\u00D790 cm (\u25A1 dropdown) \u2014 and the browser\u2019s dialog is asked for exactly that paper and orientation. Drag the picture to move it, drag the sheet to crop, wheel or \uD83D\uDD0D\u2212 / \uD83D\uDD0D+ to zoom (1 % a press, and holding the button keeps zooming, from slow to fast \u2014 the same zoom as every lightbox), click the percentage in the middle to go back to the fitted size, and \u26F6 Fit / \u25A3 Cover / \u2696 Centre place it for you (they are NOT the same job: Fit is a pure contain \u2014 whichever side is longer lands exactly on the paper edge, so it RESIZES the picture; Centre keeps the size you chose and only shrinks it if it would stick out). \uD83D\uDD04 turns the PAPER, \u21BB turns the PICTURE and \u21BA Default puts the picture back the way it looked when the editor opened (straight, centred, fitted) while your text, colour and emoji stay; \u21BA Reset, the button right of \u2716 Cancel, goes all the way back instead \u2014 everything you added in this editor (size, position, text, colours, emoji) is thrown away and the sheet is exactly as it was the moment the editor opened, while a \uD83D\uDCAB upscaled picture is kept. The prompt, today\u2019s date, your page address and any text of your own are separate boxes ON the sheet \u2014 drag them anywhere, resize them with the small square at their bottom-right corner \u2014 drag it sideways to widen the box, or diagonally to make the box wider AND taller, which scales the writing with it (the text always fills its box, so a bigger box means bigger writing) \u2014 and switch each one on or off with \uD83D\uDCDD Add prompt / \uD83D\uDCC5 date / \uD83D\uDD17 page link; a \uD83D\uDFE2 \u2713 in a chip\u2019s corner means it is on the sheet, and no \u2713 means it adds nothing yet. Pressing Add prompt simply puts the prompt on the sheet \u2014 it no longer jumps to the prompt view, because the prompt\u2019s own words cannot be changed there anyway and the box is right in front of you. Every box has its own font (six), bold, A+ / A\u2212 and a colour swatch, in the row right under its writing area; \uD83D\uDCDD Prompt view shows the picture\u2019s own prompt read-only so the same controls style it. \u23CE makes a real new line. \uD83D\uDE0A Add emoji reveals the size buttons and the emoji table underneath it: every emoji lands in the middle of the sheet as its own draggable object, tapping one puts a marker ring around it and \u2212 / [current emoji] / + resizes it. \uD83D\uDCAB Upscale sends the picture to the upscale window; when the bigger picture comes back the SAME button names its ACTION \u2014 on the upscaled picture it reads \u21BA Return to Original, on the original it reads \uD83D\uDCAB Return to Upscaled \u2014 and one press swaps the two pictures of the same job (nothing else changes). \uD83D\uDDA8\uFE0F Print sends exactly that sheet to the browser\u2019s dialog (which also offers \u201CSave as PDF\u201D); the same editor opens from the \uD83D\uDCE4 share window as \u201C\u270E Edit before sharing\u201D. The editor is titled \u201C\u270F\uFE0F Image Editor\u201D (the lightbox button that opens it wears a \u270F\uFE0F for that reason) and its \u2699\uFE0F Settings panel also carries \uD83D\uDD8C\uFE0F Retouch Brush: the brush opens on the sheet\u2019s picture \u2014 \uD83D\uDD8C Paint with a colour and a size, or \uD83E\uDE79 Clone to copy a clean patch (RIGHT-click the clean spot to take a sample, then LEFT-click the blemish to paint it away) \u2014 and \u2714 Done hands the retouched picture straight back to this editor."],
            ["\uD83D\uDD0D + / \u2212", "Zoom out / in \u2014 the viewer\u2019s own pair of zoom buttons, in the same action row."],
            ["\uD83D\uDCE4 Share", "Share \u2014 the image\u2019s own share window (WhatsApp, Facebook, X, Telegram, Reddit, Pinterest\u2026), which also carries \u201C\u270E Edit before sharing\u201D: it opens this same paper editor with the picture already loaded."],
            ["\uD83D\uDCAC Comments", "Comments \u2014 opens this picture\u2019s own comment panel. Comments live on OUR server, not in the chat: they are public and kept by the picture itself. There is NO name box to fill in \u2014 you post under the name this generator already knows you by (shown as a \uD83E\uDEAA chip at the bottom of the panel), and you may write ONE comment per picture: if you already wrote one, your own text is loaded into the box and the button becomes \u201C\uD83D\uDCBE Update my comment\u201D, so saving replaces it (an edited comment is marked \u201Cedited\u201D). Type and press Send \u2014 Enter sends, Shift+Enter starts a new line \u2014 and a picture that already has comments shows a \uD83D\uDCAC number chip in the top-left corner of its tile, in every gallery, whether or not you open it."],
            ["\uD83D\uDC64", "Search This User \u2014 instantly lists what one uploader has put into the gallery you are looking at. The window opens ON TOP of everything with a dimmed background (the image viewer steps aside for it \u2014 only one of the two is ever on screen), shows the pictures already loaded straight away, and carries one reading control: \u23E9 Read the gallery (walk the listing page by page, 200 rows at a time \u2014 it asks once before a long walk, because it uses data) / \u23F9 Stop, plus its own \u2716. Tap any result to open it full size: the search window then steps aside and comes straight back when the viewer closes. It sits immediately LEFT of the zoom \u2212/+."],
            ["person + \uD83D\uDEAB", "Block This User \u2014 a purple person under a red ring and a red bar: hides every picture of that uploader in every gallery on this device, right away (the viewer then moves to the next picture, so the button you just pressed no longer stands for that uploader \u2014 a second press would block someone else). No question is asked, and the button glows red while the current picture belongs to a blocked uploader. WHERE TO UNBLOCK: \uD83D\uDDC2\uFE0F Gallery Management \u2192 \u201CBlocked users\u201D), where every block is listed NEWEST FIRST with the date and time it was made."],
            ["picture + \uD83D\uDEAB", "Block This Image \u2014 the same badge over a picture: hides this ONE image in every gallery on this device, right away. WHERE TO UNBLOCK: \uD83D\uDDC2\uFE0F Gallery Management \u2192 \u201CBlocked images\u201D), which shows a thumbnail, the start of the prompt, the date and time it was blocked and a \u2716 that brings it back."],
            ["\u2026", "More Options \u2014 everything that is not a constant daily button: GIF/Movie \u00B7 AI Video \u00B7 Download \u00B7 Copy Prompt \u00B7 Persona / Chat \u00B7 Enhance \u00B7 AI Analyze \u00B7 Upscale Image \u00B7 Image Editor \u00B7 Prompt Bank \u00B7 Scratchpad."],
            ["\u2716", "Close the viewer."]
          ]],
          ["Galleries \u2014 toolbar", [
            ["\uD83D\uDD0D", "Search the gallery (and your private gallery)."],
            ["Refresh / Order", "Choose the gallery and how often it refreshes."],
            ["gallery menu", "Pick the gallery AND drive the list from the same window: the \uD83D\uDDC2\uFE0F Sort-galleries control sits right under its search box (red \u25BE arrows on both sides) and the search box itself carries a \uD83C\uDFB2 dice (open a random gallery) and a red \u2716 (clear the search) as mini buttons. THIS generator's own gallery is always the first, centred row (it needs no pin), the other rows start with a \uD83D\uDCCC pin (pin a gallery to float it to the top), and a gallery you never opened is marked *New*. Every row's second line is the gallery's readable NAME, worked out from its own title \u2014 advertising wording (free, unlimited, no login, sign-up, text-to-image, perchance.org, image generator \u2026) is left out, and when the title says nothing the name comes from the gallery's own address (\"you-are-the-best\" reads \"You are the best\"); a gallery with no usable name at all simply reads \"Other Generator Gallery\"."],
            ["\uD83C\uDFB2 + \u2716 (inside the search box)", "The gallery menu's search box carries two mini buttons: the \uD83C\uDFB2 dice opens a RANDOM gallery for you (your sort choice stays as it is), and the red \u2716 clears what you typed in the search box. There is no separate widen button any more \u2014 the gallery button is sized so this generator's own name is always readable in full."],
            ["\uD83C\uDFC6 Best / \uD83D\uDD1C Recent / \uD83D\uDD25 Trending / ⭐ Liked", "The IMAGE sort menu (its tooltip reads \u201CImage Sort\u201D). It sorts the pictures inside the gallery you are looking at: \uD83C\uDFC6 Best (Perchance's own all-time ranking), \uD83D\uDD1C Recent (newest first) and Trending, and Liked (the pictures visitors starred most — server-counted and globally ordered; public gallery only, in a sub-channel the menu offers Best, Recent and Trending). The number is live: a like cast on another device appears on an open gallery within about a second, and pressing Refresh always asks the server for the newest count."],
            ["\u23F0 All Time / Past 24h / Past 3d / Past 7d / Past 30d / Past 365d", "The time range for the \uD83C\uDFC6 Best sort \u2014 it sits right beside that menu and its window opens to the right of the button."],
            ["Sliders", "Zoom and tile size. The toolbar's second row carries a compact \u2212 / Npx / + tile-size control, immediately to the LEFT of the 🏆 Best / 🗓 Recent / 🔥 Trending / ⭐ Liked menu: \u2212 and + step the tile size and the middle button puts it back to the default size. The number on the middle button IS the real size of a tile \u2014 every press of \u2212 or + makes every tile that many pixels smaller or bigger, with no dead steps \u2014 and the row simply holds as many tiles as fit across (the little strip left over on the right is the honest remainder). Tiles run from 60px (a dense wall of thumbnails) to 1600px (one big image per row) and the default is the size that suits your device. It changes the TILE size only, never the page text."],
            ["\uD83D\uDEAB", "Exclude words from the results."],
            ["\uD83D\uDDBC\uFE0F Display", "How images fill their tile \u2014 ONE control, the SAME eleven choices in the public gallery and in your private gallery: \uD83D\uDCD0 Justified (the default: equal-height rows filled edge to edge, nothing cropped), \uD83D\uDDBC\uFE0F Default (the classic gallery look: equal-height rows at each picture\u2019s own width, so the right edge is ragged), \uD83D\uDCCC Pinterest (true column packing that reads left to right), \uD83E\uDDE9 Puzzle (equal-height rows that always close; the first row starts on the right), \uD83C\uDFB2 Mosaic (the same perfect fill with the order mixed at random), \uD83E\uDDF1 Mixed (a wall of bigger and smaller aligned blocks, hole-free), \uD83E\uDDF1 Masonry (CSS columns: top to bottom), Original (true native size), Crop (fills the square tile), Fit (the whole picture inside it) and Stretch (fills the tile even if it distorts). The button shows only its symbol; the current mode is ticked inside its menu. In the row modes the \u2212 / Npx / + slider sets the ROW height."],
            ["\u26A1", "Image load speed \u2014 how many pictures are fetched ahead of the ones already on screen, counted in SCREENS: \uD83D\uDC0C Slow 1.5 \u00B7 \uD83D\uDD30 Balanced 3 (the default) \u00B7 \u26A1 Fast 4 \u00B7 \uD83D\uDC8E Best 6 (the widest window) \u00B7 \uD83D\uDCA4 Lazy none (load as you scroll) \u00B7 \uD83E\uDDCA Virtual (draws only what is on screen) \u00B7 \uD83D\uDD04 Default (plain perchance-gallery loading: always fresh, no prefetch). One screen holds ~18 pictures on a wide desktop but only ~3 on a phone, so the same setting means the same amount of scrolling on every device. More ahead means the next rows are already there when you reach them. Your choice is remembered, and the Settings button shows the active mode."],
            ["\uD83D\uDE48", "Hide all / reveal all."],
            ["\uD83E\uDDF0 Toolbox", "Extra gallery tools in one panel: order, refresh, search, filters, reveal, sliders, display, load, dedupe. The load-speed button shows only the symbol of the active mode (\uD83D\uDD04 Default \u00B7 \uD83D\uDCA4 Lazy \u00B7 \uD83D\uDC0C Slow \u00B7 \uD83D\uDD30 Balanced \u00B7 \u26A1 Fast \u00B7 \uD83D\uDC8E Special \u00B7 \uD83E\uDDCA Virtual)."],
            ["\uD83C\uDF9E\uFE0F", "GIF/Movie \u2014 in the full-screen viewer’s \u201C\u2026\u201D menu: animate the picture you are looking at into a GIF or WebM video (or upload a different image)."],
            ["\uD83C\uDFAC", "AI Video \u2014 in the full-screen viewer’s \u201C\u2026\u201D menu: turn the picture you are looking at into a short video (or upload a different image)."],
            ["\uD83C\uDF0D All Recents", "The newest images from every gallery, loaded in stages."],
            ["\uD83C\uDFB2 All Random", "Randomly picked images from every gallery."],
            ["\uD83D\uDFE2 G", "Content filter \u2014 choose the allowed rating."],
            ["\u2B50 / \u2705", "Save the image / already saved."],
            ["\uFF0B", "Add a new channel (sub-gallery)."],
            ["Scan Subchannels", "Scans the current gallery for its sub-channels and REMEMBERS what it finds. Press it to start, press it again to stop where it is (partial results are kept). While it runs the button shows a live percentage and tints with the colour of the list being read (\uD83D\uDFE2 G \u2192 \uD83D\uDFE1 PG13 \u2192 \uD83D\uDD34 none); when it finishes it turns blue and reads \"Scan Subchannels Complete\". The number next to a sub-channel is the REAL image count \u2014 a listing is sent 200 at a time, so a channel that fills a page is counted deeper instead of being left at 200, and that deeper count happens in the SAME pass as the scan itself. The scan searches exactly what the gallery is showing, so it obeys the content filter you have selected (switch the filter and scan again for that filter's own numbers) and each filter keeps its own result. Each gallery keeps its own result: a gallery you never scanned shows \"Click to start subchannel scan\" again."],
            ["\u25BE appearance (in \u2699\uFE0F Settings \u25B8 \uD83D\uDDBC UI & Display)", "How the scan button paints its progress: list-colour bar (the default), calm dots, wave dots, or a % counter only. In \u2699\uFE0F Settings \u25B8 \uD83D\uDDBC UI & Display a full-width button shows a live preview of the Scan button mid-scan and steps to the next look every time you press it."],
            ["Slider (right edge of the sub-channel row)", "When a gallery has more than three rows of sub-channels, the row scrolls inside a three-row window: drag the thin slider on its right edge, click its track or wheel over it to travel through the rest. The chips and the row's own controls stay one line high. This fold-out handle appears the MOMENT the chips stop fitting into three rows \u2014 whether a scan is still running or not \u2014 so nothing is ever hidden without a way to reach it."],
            ["\u2195 sort (left of the public chip)", "Sorts the sub-channel chips: most images (default), A\u2192Z, or the order they were found. It is the small \u2195 button sitting IMMEDIATELY LEFT of the public channel chip. The public channel always stays first and the coloured groups (\uD83D\uDFE2 G \u00B7 \uD83D\uDFE1 PG13 \u00B7 \uD83D\uDD34 none) are never mixed. Your choice is remembered."],
            ["\uD83E\uDDE9 Collage (in the \u270F\uFE0F Image Editor)", "The \uD83E\uDDE9 Collage button lives in the \u270F\uFE0F Image Editor (not in the gallery toolbar any more). It opens the collage editor: pick several pictures from your own gallery, choose one of six automatic layouts (2\u00D72, 3\u00D73, vertical strip, horizontal band, mosaic, spotlight) and drag the pictures around freely. Done renders a PNG you can download or save to your gallery."],
            ["\uD83E\uDE9F Tabs", "Open several galleries at once as browser-style tabs. Press the \uD83E\uDE9F button in the toolbox to switch the mode on, then DOUBLE-CLICK a gallery in the gallery menu to open it in its own tab (a single click still just switches). The tabs sit in a strip right under the navbar, above the gallery toolbar: the current one is purple, the others blue, \u2715 closes a tab, and you can drag them into the order you like. Each tab remembers which gallery it shows and where you had scrolled. Switching the mode off removes the strip completely."],
            ["\uD83D\uDCCA gallery counter", "Under the gallery: how many images of the view you are looking at are loaded and how many there are in total (\u201cN Loaded / N Total\u201d, \u201c10200+\u201d when a gallery is larger than the listing server will count). Both numbers belong to the SAME content filter and sort you have selected, and hovering the counter tells you how many of the loaded images you have already seen — the next page arrives when you press \u2B07\uFE0F Load more below the grid, just like the default perchance gallery."]
          ]],
          ["\uD83E\uDDE9 Collage \u2014 editor", [
            ["\uD83E\uDDE9 Collage", "The button in the public gallery toolbar: it opens the collage editor."],
            ["the picker", "Two tabs \u2014 \uD83D\uDDBC\uFE0F Public gallery and \uD83D\uDD12 My gallery. Tap pictures to select them; the number on each tile is its order in the collage (up to 100)."],
            ["the six patterns", "2\u00D72 grid, 3\u00D73 grid, vertical strip, horizontal band, mosaic and spotlight \u2014 each one places every picture automatically."],
            ["the left strip", "Every selected picture waits in the strip on the left; drag one onto the canvas (or tap it) to add another copy."],
            ["drag and drop", "Pictures are moved freely on the canvas by dragging; the \u2715 on a picture removes it."],
            ["aspect + background", "The collage can be 1:1, 4:3, 3:4 or 16:9, over one of four background colours."],
            ["\u2713 Done", "Renders the collage as a PNG you can download, or save straight into your gallery (the \u201CCollages\u201D folder)."],
          ]],
          ["Likes \u2014 your private gallery", [
            ["\uD83D\uDD0D", "Search your saved images by prompt and tag."],
            ["\uD83E\uDDEC", "Dedupe \u2014 collapses images that share the same prompt into the first one (with an \u00D7N badge). Nothing is deleted. While they are collapsed the button turns into \u21A9\uFE0F Undupe: press it and every copy is shown again, listed centred in rows inside the viewer."],
            ["#", "Numbers \u2014 when the gallery image numbers are shown: public always \u00b7 private hover, both always, or both on hover."],
            ["\uD83D\uDC98", "What I Like \u2014 favourites and tags."],
            ["\uD83D\uDCBD", "Counter \u2014 how many images and how much space you use."],
            ["\u2630 Menu", "The gallery menu: Save Backup, Load Backup, Import Local File, Import from URL, Storage Info and Clear ALL Data."],
            ["\uD83D\uDCC1 folder menu", "Pick a folder, create one, delete one, or rename / re-symbol one with \uD83C\uDFA8."],
            ["\uD83D\uDCE4 / \uD83C\uDF10 Import", "Both ask WHICH Likes folder the file(s) should go into before importing."],
            ["\uD83D\uDCBE Save Backup", "Asks what to include, then downloads a .zip backup of your Likes."],
            ["\uD83D\uDCC2 Load Backup", "Asks which folder to restore into (and remembers it) \u2014 the backup is merged in."],
            ["\uD83D\uDCBD Storage Info", "How much space your Likes use and whether the browser keeps it."],
            ["\uD83D\uDCA3 Clear ALL Data", "Deletes every saved image from this browser (type YES to confirm)."]
          ]],
          ["Settings", [
            ["\uD83C\uDFA7", "Sound \u2014 completion chime style and volume."],
            ["\uD83C\uDFA8", "Generator Themes \u2014 22 colour themes."],
            ["\uD83D\uDDBC\uFE0F", "Background \u2014 put one of 10 pictures behind the whole site, or none (the default)."],
            ["\uD83D\uDDBC\uFE0F Screen Saver", "How long you can be away before the privacy screen saver appears \u2014 it shows \u201C\uD83D\uDDBC\uFE0F Saver: \u2026\u201D (the tooltip spells the whole thing out) and steps through off \u2192 5s \u2192 10s \u2192 15s \u2192 30s \u2192 1m \u2192 5m (the default) \u2192 10m \u2192 15m \u2192 30m \u2192 60m, and round again. In \u2699\uFE0F Settings \u25B8 \uD83E\uDDF0 Tools & Extras it is the LEFT half of the first line of the three screen-saver buttons, next to \uD83C\uDF27 Rainy."],
            ["\uD83C\uDF27 Rainy", "Screen saver weather \u2014 the RIGHT half of the first line of the three screen-saver buttons in \u2699\uFE0F Settings \u25B8 \uD83E\uDDF0 Tools & Extras (they are the two SMALL buttons, side by side, with the presentation button full width under them). Off (the default) plays the usual warm landscapes; On plays only rainy landscapes (rain, fog, storms) and lays a falling-rain layer over them. It never touches the generator itself: the rain starts when the saver appears and stops the moment you come back. Your choice is remembered."],
            ["\uD83D\uDDBC\uFE0F / \u26F6 Screen saver look", "The saver's two presentations \u2014 the LAST of the three screen-saver buttons in \u2699\uFE0F Settings \u25B8 \uD83E\uDDF0 Tools & Extras (the full-width one under the two small saver buttons) reads \u201C\uD83D\uDDBC\uFE0F Screen Saver: v1 (framed)\u201D or \u201C\u26F6 Screen Saver: v2 (fullscreen)\u201D, and pressing it switches to the other one. v1 is the look you have now: the landscape sits in a matte frame with the clock. v2 is the FULLSCREEN look: the landscape fills the whole screen. Your choice is remembered. The saver itself carries no buttons at all \u2014 any click or key simply brings you back (press F11 / \u2325\u2318F if you want the browser's own bars hidden)."],
            ["\uD83D\uDD27 UI SCALE", "The size the navbar and BOTH gallery toolbars (and their buttons) are drawn at, 70-200% \u2014 the number shown ON the button is the current size. The button itself does two things: it switches automatic sizing ON or OFF, and it shows or hides the slider. Automatic ON \u2014 the button then reads \u201C\uD83D\uDD27 UI SCALE <n>% \u00B7 AUTO: ON\u201D \u2014 sizes the bars to your screen on its own and keeps the slider closed, so a mistap can never wreck the layout; automatic OFF \u2014 the button then reads \u201C\uD83D\uDD27 UI SCALE <n>% \u00B7 AUTO: OFF\u201D and the slider opens so you can set the size yourself. The identical control also lives in both galleries' \uD83C\uDF9A Sliders menus."],
            ["\uD83D\uDCBE / \uD83D\uDCC2", "Save or load a backup."],
            ["\uD83D\uDDD1\uFE0F PURGE ALL DATA", "Deletes everything stored in this browser (cannot be undone)."],
            ["\uD83D\uDD16 Add Bookmark", "Add this generator to your browser bookmarks \u2014 press Ctrl / \u2318 + D, or drag the button from the panel onto your bookmarks bar."],
            ["\uD83D\uDCE4 Share", "Shares this generator \u2014 WhatsApp, Facebook, X, Telegram\u2026"],
            ["🧭 Click Navigation", "The command palette (Ctrl / ⌘ + K) — jump to any page, panel or action. Its search bar wears a 🔍 on the left, a red ✕ clear button on the right and a Close button at the bottom."],
            ["\uD83D\uDD0D Buttons & Legends", "ONE window that answers both questions \u2014 where is that button, and what does it do. Its search box reads the WHOLE generator live (every button, control, slider, checkbox and the seven top-level pages) AND every legend entry below it. Type a word \u2014 \u201Cscreen saver\u201D, \u201Cfullscreen\u201D, \u201Cupscale\u201D, \u201Ctheme\u201D \u2014 and each hit shows its own symbol, its name and the card it lives in; a control that is hidden or retired is marked \u201Chidden\u201D, which makes it an easy cleanup list. Pick a row and the generator opens the right page, scrolls the control into view and flashes it yellow. It is built for exactly the case of a button you know exists but cannot find."],
            ["\uD83D\uDCD6 Legends", "This key \u2014 explains every button in the generator."],
            ["\uD83D\uDCCB Survey \u00b7 NEW", "The visitor survey \u2014 like/dislike the systems you use and vote on what to build next; the tally is stored on the server and shown live. At the end of the survey there is an optional suggestion box: what you write there is posted to the public Suggestion chat channel. While you have never taken it, this button wears a small red NEW badge \u2014 it disappears for good once you submit."],
            ["\uD83D\uDCCB survey invite", "A one-time bar just under the navbar, shown after 60 minutes of active time; it opens the SAME survey window and never returns once you have taken part."],
            ["\uD83D\uDCCA Visitor Stats", "The board in Settings that shows how busy the generator has been: one bar per hour for the last 24 hours, one bar per day for the last 7 days, one bar per day for the last 30 days, or one bar per calendar month (Last 24h / Last 7d / Last 30d / Months). The tallest bar sets the scale, the current bar is gold, and hovering (or tapping) a bar reads its reading under your finger \u2014 the online peak at that minute of the hour in the 24h view, THE DAY'S TOTAL VISITS in the 7d / 30d views, and THE MONTH'S TOTAL VISITS in the Months view; the info panel always appears BELOW the pointer, and on a phone dragging over the chart moves the panel instead of scrolling the page. \u27F3 refreshes it. The bar at the FAR RIGHT is \uD83D\uDC65 First-time vs Returning: it always stays on the right (every online bar stays to its left), it is split green (first-time visitors) / red (returning visitors) for the period you selected, and its tooltip plus the line under the board carry that period's visit counts and the all-time first-time / returning totals."],
            ["Months (Visitor Stats)", "The Months view of the \uD83D\uDCCA Visitor Stats board \u2014 one bar per calendar month, starting with the month the records begin (an unfinished month keeps growing until it ends). Hovering a bar reads that day's online peak plus that day's and that month's first-time / returning visit counts."],
            ["\uD83D\uDEAB Blocked", "The record of everything you have blocked on this device, hidden in Settings storage — unblock in Gallery Management: \uD83D\uDC64 blocked uploaders and \uD83D\uDDBC\uFE0F blocked pictures, NEWEST FIRST, every row carrying the date and time it was blocked (\u201Cblocked 22.09.2026 18:12\u201D, plus how many pictures a blocked uploader hid). The card is CLOSED by default so it never eats the panel \u2014 its header counts what is blocked (\u201C18 uploaders \u00B7 1 picture\u201D) and one tap on that header opens or closes it (the state is remembered). Press \u2716 on a row to bring that uploader or picture back in every gallery, or \uD83D\uDD13 Unblock everything to clear the whole list. Blocks are per device and are never sent anywhere."],
            ["\uD83D\uDDBC UI & Display tab", "Settings opens one section at a time: this tab holds the look controls — load speed, background, gallery numbers, Generator Themes, scan-button look, Home Page, thumbnails, hero pictures, the companion picker and UI Scale (always last) — plus \uD83C\uDF10 Language as a toggle button on its first line."],
            ["\uD83E\uDDB0 Tools & Extras tab", "The Settings tab with the site tools: \uD83D\uDD0D Buttons & Legends, \uD83D\uDD16 Add Bookmark, \uD83E\uDDED Click Navigation, \uD83D\uDCE4 Share, feedback, fullscreen, Lite Mode, the screen-saver trio beside 🔔 Social Alerts, and the 🔊 Generating Sound button (Classic · Soft Pop · Bell Ding · Tech · Off) with its volume slider on the last line below it — the slider hides while Off is selected."],
            ["\uD83D\uDCBE Data & Saves tab", "The Settings tab with the 🔒 privacy block (\uD83D\uDCBE Save Backup + \uD83D\uDCC2 Load Backup on one line, \uD83D\uDDD1\uFE0F PURGE ALL DATA + \uD83D\uDCBD Storage Info below them, ⭐ Save Folder + ⭐ Already-Saved Star on the third line)."],
            ["\uD83D\uDCCA Stats tab", "The Settings tab with the live \uD83C\uDF10 Visitors panel (where everyone is from) above the \uD83D\uDCCA Visitor Stats board (Last 24h / Last 7d / Last 30d / Months)."],
            ["\uD83D\uDEAB Blocked record", "Uploaders and pictures blocked on this device, newest first — sits hidden in Settings storage — unblock in Gallery Management."],
            ["\uD83D\uDCE6 About panel", "The panel under Settings with the generator profile, the build number, \uD83C\uDD95 Update Notes, the rating faces and the \uD83D\uDCCB Survey."],
            ["\uD83D\uDD95 Update Notes", "What changed in each build, newest first — opens the Update Notes window. Lives in the \uD83D\uDCE6 About panel under Settings; while you have not seen the newest note the button wears a red NEW badge."],
            ["⭐ Rate bestaigen", "The five rating faces in the \uD83D\uDCE6 About panel under Settings — press one to rate the generator 1 to 5 stars; the tally is stored on the server."],
            ["☕ Buy me a coffee", "Support Egon with a coffee — opens his Buy Me a Coffee page. Lives in the \uD83D\uDCE6 About panel under Settings."],
            ["\uD83C\uDF10 Language", "Dexa and the news feed follow your choice here (Auto = browser language). Lives on the first line of ⚙️ Settings ▸ \uD83D\uDDBC UI & Display as a \uD83C\uDF10 Language button that opens its menu; the button always names the active language."],
            ["🔔 Classic", "Completion chime style — the classic notification bell. Pick the chime with the 🔊 Generating Sound button at the bottom of ⚙️ Settings ▸ 🧰 Tools & Extras."],
            ["🎵 Soft Pop", "Completion chime style — a soft pop. Pick the chime with the 🔊 Generating Sound button at the bottom of ⚙️ Settings ▸ 🧰 Tools & Extras."],
            ["🚀 Tech", "Completion chime style — a techy blip. Pick the chime with the 🔊 Generating Sound button at the bottom of ⚙️ Settings ▸ 🧰 Tools & Extras."],
            ["\uD83E\uDDCD Character Panel Version", "Chooses which Character Creation panel version to show. Lives in ⚙️ Settings ▸ \uD83E\uDDB0 Tools & Extras."],
            ["⌨️ Keyboard Shortcuts", "Opens the keyboard-shortcut list in its own window (with a Close button at the bottom). Lives in ⚙️ Settings ▸ 🧰 Tools & Extras."],
            ["\uD83D\uDDE3\uFE0F Feedback", "Opens the feedback window — send feedback straight to Egon. Lives in ⚙️ Settings ▸ \uD83E\uDDB0 Tools & Extras."],
            ["⛶ Fullscreen", "Fills the whole screen with the generator (browser fullscreen). Lives in ⚙️ Settings ▸ \uD83E\uDDB0 Tools & Extras."],
            ["🪶 Lite Mode", "Light visual settings for weaker devices: heavy animations, glow and blur go off. Lives in ⚙️ Settings ▸ 🧰 Tools & Extras."],
            ["🔢 Numbers", "Gallery image numbers — which galleries show them and when (public always · private hover and the other combinations), plus their colour. Lives in ⚙️ Settings ▸ 🖼 UI & Display."],
            ["🎭 Hero Pics", "Hero pictures on the Generate page — cycles Off, 5, 10, 15, 30, 60 seconds. Lives in ⚙️ Settings ▸ 🖼 UI & Display."],
            ["🐾 Companion", "The Generator Companion picker — a little creature that follows your cursor. Lives in ⚙️ Settings ▸ 🖼 UI & Display."],
            ["🔊 Generating Sound button", "Generating sound in one button on the last line of ⚙️ Settings ▸ 🧰 Tools & Extras: each press plays the NEXT style aloud and the button wears its name (Classic · Soft Pop · Bell Ding · Tech · Off), with the volume slider below it — the slider hides while Off is selected."],
            ["🔊 Volume", "The volume slider below the Generating Sound button: loudness of the completion chime. It hides while Off is selected."],
            ["🔔 Social Alerts", "A sound when social activity arrives (chat, forum, messages). Lives beside the screen-saver presentation button in ⚙️ Settings ▸ 🧰 Tools & Extras; full per-channel wiring lands with the Social build."]
          ]],
          ["Banners & notices", [
            ["\uD83D\uDD04 purple update bar", "Tells you BestAiGen was just updated and scrolls across the top of the page in purple with Dexa's picture. Click it once to stop it (click again to let it continue), double-click (or three taps on a phone) to reload the page now, and right-click (or two taps) to dismiss it for this session."],
            ["\uD83D\uDCE3 Dexa's news ticker", "Scrolling line at the top of a page when there is something new to read \u2014 press it to open Update Notes, right-click / two taps to dismiss. Only ONE announcement ever runs at a time and at least TWO minutes of quiet follow it: the scrolling banners and Dexa's speech bubble all share one lane, so a page can never greet you with a pile of messages at once."],
            ["\uD83D\uDCAC Dexa's speech bubble", "Appears above her avatar from time to time and types its line out from the first character to the last; it also hugs the text, so it is never wider than what she says. It shares the announcement lane with the scrolling banners, so it never lands on top of one or straight after one \u2014 at least two minutes of quiet separate any two announcements."]
          ]]
        ];
    try { window.dragonLegendsData = L; } catch (e) {}
    return L;
  }
  window.dragonLegendsData = dragonLegendsData();
  window.dragonLegendsDataGet = dragonLegendsData;

  ;function toast(m) { try { if (window.dragonToast) window.dragonToast(m); } catch (e) {} }

  // ---------- theme colour map (for Account theme buttons) ----------
  var THEME_COLORS = {
    "default": { c: "#4a4a55", fg: "#eee" },
    "sugar-pink": { c: "#ff7ab8", fg: "#3a0d22" },
    "baby-blue": { c: "#7ec8ff", fg: "#082a3a" },
    "silver": { c: "#c0c4cc", fg: "#1a1c20" },
    "gold": { c: "#d4af37", fg: "#2a2205" },
    "ocean": { c: "#2a8fcf", fg: "#eaf6ff" },
    "autumn": { c: "#c1662f", fg: "#2a1505" },
    "winter": { c: "#a9d6ff", fg: "#0a1a2a" },
    "spring": { c: "#5fc23a", fg: "#0a2a0a" },
    "summer": { c: "#ffcf3a", fg: "#3a2a05" },
    "dark-dungeon": { c: "#8a1c1c", fg: "#f0d0d0" },
    "scifi": { c: "#1fb8a8", fg: "#04201e" },
    "calm": { c: "#8fb3c9", fg: "#10202a" },
    "happy": { c: "#ffd166", fg: "#3a2a05" },
    "neon": { c: "#39ff14", fg: "#0a2a0a" },
    "cyber": { c: "#00e5ff", fg: "#001f2a" },
    "ghost": { c: "#b0a8d0", fg: "#1a1428" },
    "rainbow": { c: "#b84dff", fg: "#111" },
    "emerald": { c: "#2ecc71", fg: "#052e16" },
    "sunset": { c: "#ff6b35", fg: "#2a0f05" }
  };
  ;function shade(hex, amt) {
    var h = String(hex || "#3a3a44").replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    if (isNaN(n)) return hex;
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.max(0, Math.min(255, r + amt));
    g = Math.max(0, Math.min(255, g + amt));
    b = Math.max(0, Math.min(255, b + amt));
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  // ---------- CSS ----------
  ;function injectCss() {
    if (document.getElementById("dragonPagesCss")) return;
    var css = document.createElement("style");
    css.id = "dragonPagesCss";
    css.textContent = [
      /* sensible pre-JS defaults for the navbar-slot control size (JS refines it in sizeNavVar) */
      /* static defaults so the navbar, its slot controls and the page offsets always agree,
         even before JS runs (sizeNavVar just re-confirms the same numbers) */
      "html{--dragon-ui-scale:1; --dragon-nav-h:calc(36px * var(--dragon-ui-scale,1)); --dragon-nav-ctl:calc(30px * var(--dragon-ui-scale,1));}",
      "@media (max-width:600px){html{--dragon-nav-h:calc(32px * var(--dragon-ui-scale,1)); --dragon-nav-ctl:calc(24px * var(--dragon-ui-scale,1));}}",
      /* navbar: leave room for the online-button (left) and helper bot (right) slots */
      ".dragon-navbar{padding-left:calc(var(--dragon-nav-ctl,32px) + 14px) !important; padding-right:calc(var(--dragon-nav-ctl,32px) + 14px) !important;}",
      /* the spacer that keeps content below the fixed bar always matches the bar height */
      "#dragonNavSpacer{height:var(--dragon-nav-h,36px) !important;}",
      /* Egon 11.09.2026 — navbar must never shift between pages (scrollbar gutter) and switching
         must be instant; the active page gets a glow. */
      "html{scrollbar-gutter:stable;}",
      ".dragon-navbar .dragon-nav-item{transition:none !important;}",
      ".dragon-navbar .dragon-nav-item.dragon-nav-active{background:linear-gradient(180deg,rgba(155,107,255,.40),rgba(155,107,255,.10)) !important; color:#fff !important; box-shadow:inset 0 -3px 0 #9b6bff, 0 0 14px rgba(155,107,255,.6) !important; text-shadow:0 0 8px rgba(200,170,255,.9);}",
      ".dragon-navbar .dragon-nav-item.dragon-nav-active .dragon-nav-ic{filter:drop-shadow(0 0 6px rgba(155,107,255,.95));}",
      ".dragon-navbar .dragon-nav-item.dragon-nav-active .dragon-nav-lb{opacity:1; color:#fff !important;}",
      /* Egon 11.09.2026 — the big SHOW/HIDE GALLERIES + CHAT mirror buttons are obsolete:
         the Galleries page is opened from the navbar and Chat lives in the navbar. */
      "#showHideGalleryAndCommentsButtonsCtn83728732671{display:none !important;}",
      /* bottom-left circles being removed/merged into the navbar */
      ".dragon-shortcut-circle,.dragon-util-circle,.dragon-hist-circle{display:none !important;}",
      "html[data-dragon-page] .dragon-shortcut-circle,html[data-dragon-page] .dragon-util-circle,html[data-dragon-page] .dragon-hist-circle{display:none !important;}",
      /* bottom-right floating generate + private-gallery buttons removed */
      ".dragon-floating-gen,.dragon-vault-btn{display:none !important;}",
      /* live online/stats button -> top-left (visual navbar left slot) */
      ".dragon-online-circle{top:calc((var(--dragon-nav-h,42px) - var(--dragon-nav-ctl,32px)) / 2) !important; left:6px !important; bottom:auto !important; transform:none !important; width:var(--dragon-nav-ctl,32px) !important; height:var(--dragon-nav-ctl,32px) !important; font-size:.82rem !important; z-index:100000 !important;}",
      ".dragon-stats-mirror{top:calc(var(--dragon-nav-h,42px) + 6px) !important; left:6px !important; bottom:auto !important; z-index:2147483300 !important;}",
      "#dragonBotHost > div:first-child{display:none !important;}",
      /* Egon 17.10.2026 (W-UI380) — the Dexa avatar button lives INSIDE the navbar (top-right slot):
         cap it at the navbar control size so it never overflows the bar. The 3.4rem
         --dragon-btn-size still drives every floating button; only the navbar-pinned
         button is shrunk. The host is exactly bar-height with its content centered. */
      "#dragonBotHost{padding:0 6px 0 0 !important; height:var(--dragon-nav-h,36px) !important; justify-content:center !important;}",
      "#dragonBotHost > button{width:var(--dragon-nav-ctl,30px) !important; height:var(--dragon-nav-ctl,30px) !important;}",
      /* Egon 12.09.2026 — the bot sits INSIDE the navbar on mobile too (vertically centered, equal
         top/bottom gap); chat opens right under the navbar via --dragon-nav-h.
         PARKED (obsolete mobile override that pushed the bot below the navbar):
         "@media (max-width:600px){#dragonBotHost{top:50px !important;}#dragonBotChat{top:92px !important; bottom:auto !important;}}" */
      "@media (max-width:600px){#dragonBotChat{top:calc(var(--dragon-nav-h,42px) + 6px) !important; bottom:auto !important;}}",
      /* ---------- HOME page ---------- */
      "#dragonHomePage{position:fixed; left:0; right:0; top:var(--dragon-nav-h,42px); bottom:0; overflow-y:auto; z-index:99980; display:none; box-sizing:border-box; padding:.2rem .8rem 3rem; background:radial-gradient(120% 60% at 50% 0%, rgba(155,107,255,.16), transparent 62%), #0b0b0f; --dragon-home-x:1.15rem; --dragon-home-x-head:.95rem;}",
      "#dragonHomePage .dragon-home-title{text-align:center; font-size:1.5rem; font-weight:800; letter-spacing:.02em; margin:.3rem 0 0; background:linear-gradient(90deg,#b79bff,#9b6bff,#c9a8ff); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; color:#c9a8ff;}",
      // 🏠 Egon 22.09.2026 — HEADING → DESCRIPTION DISTANCE IS NOW ONE RULE ON THE WHOLE HOME PAGE.
      // (Egon: "a bit less than the 'best ai image generator' text under the 'bestaigen' heading on the home page
      // pull up. each description text should be x distance from its heading. the heading and the text I specified are this
      // follow the rule. set these symmetrically.")
      // `--dragon-home-x` (1.15rem = 18.4px) is THE distance a button keeps from its own caption — the CTA's
      // .34rem flex gap x3 + the two .06rem .dragon-home-gap spacers — and it is also the reference for the
      // title → "Best Ai Image Generator" pair. `--dragon-home-x-head` (.95rem ≈ 15px, a hair smaller on purpose)
      // is that same distance expressed for the bare-text pair: a caption sits inside a pill whose HARD top
      // edge is only 18px below its button, while the big title's fluffy 3D ink + sparkles leave no such
      // edge — measured against the rendered page, 12.8px of box gap under the title reads as exactly the
      // same amount of air as the 18.4px under a button. The title's old `translateY(.7rem)` (which pushed
      // the title DOWN into its own text) is gone: the title sits a little higher, and title → sub reads
      // exactly like button → caption. Values are re-tuned for the two Home media queries as well
      // (.62rem on phones, .42rem on short screens) so the rhythm stays symmetric there too.
      "#dragonHomePage .dragon-home-sub{text-align:center; font-size:.76rem; opacity:.72; margin-top:var(--dragon-home-x-head); margin-bottom:.9rem; color:#cfd6e6;}",
      // Egon 13.09.2026 — CLICKABILITY LOCK on HOME: only Generate and Galleries buttons are clickable.
      // Tiles are now unclickable (old lightbox cancelled) → cursor:default + pointer-events:none.
      "#dragonHomePage .dragon-home-tile{position:relative; border-radius:10px; overflow:hidden; cursor:default; pointer-events:none; border:1px solid #33333d; background:linear-gradient(145deg,#1b1b22,#0d0d11); transition:border-color .15s ease, box-shadow .15s ease;}",
      // Egon 12.09.2026 — Home images DO NOT MOVE when hovered (translateY removed);
      // only border + glow change. No growth/movement on click (I59).
      "#dragonHomePage .dragon-home-tile:hover{transform:none !important; border-color:#9b6bff; box-shadow:0 8px 24px rgba(155,107,255,.28);}",
      "#dragonHomePage .dragon-home-tile:active{transform:none !important;}",
      "#dragonHomePage .dragon-home-tile img{display:block; opacity:0; transition:opacity .5s ease;}",
      "#dragonHomePage .dragon-home-tile img.on{opacity:1;}",
      // Egon 15.09.2026 — DOUBLE-CLICK BLUE SELECTION COMPLETELY OFF: double-clicking image/title on Home
      // does not select or drag any text/image (entire page + all children).
      "#dragonHomePage, #dragonHomePage *{-webkit-user-select:none !important; -moz-user-select:none !important; -ms-user-select:none !important; user-select:none !important; -webkit-user-drag:none !important; -khtml-user-drag:none !important; -webkit-touch-callout:none !important;}",
      // Egon 13.09.2026 — Title/subtitle/description texts are also unclickable (only 2 CTA buttons are clickable).
      // Since buttons are NOT children of these elements, pointer-events:none is safely applied; buttons are unaffected.
      "#dragonHomePage .dragon-home-hero, #dragonHomePage .dragon-home-title, #dragonHomePage .dragon-home-sub, #dragonHomePage .dragon-home-cta-sub, #dragonHomePage .dragon-home-gap{pointer-events:none; -webkit-user-select:none; user-select:none;}",
      // Egon 13.09.2026 — CTA container should not swallow clicks, but buttons inside should remain clickable.
      "#dragonHomePage .dragon-home-cta{pointer-events:none;}",
      "#dragonHomePage .dragon-home-cta button{pointer-events:auto;}",
      /* --- v1: original aspect ratio, uncropped images in a clean responsive grid --- */
      "#dragonHomePage.dragon-home-v1 .dragon-home-grid{display:grid; grid-template-columns:repeat(4,1fr); gap:.55rem; max-width:1180px; margin:0 auto; align-items:start;}",
      "#dragonHomePage.dragon-home-v1 .dragon-home-tile{background:linear-gradient(145deg,#1b1b22,#0d0d11);}",
      "#dragonHomePage.dragon-home-v1 .dragon-home-tile img{width:100%; height:auto; object-fit:contain;}",
      /* --- home hero (shared; v2/v3/v4 turn it into a full banner) --- */
      "#dragonHomePage .dragon-home-hero{width:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:.3rem 0 .2rem; background-position:center; background-size:cover;}" +
      // Egon 15.09.2026 — Pull Home V1-V4 content (title/text/buttons) up by approximately ONE TITLE HEIGHT.
      "#dragonHomePage.dragon-home-v1 .dragon-home-hero, #dragonHomePage.dragon-home-v2 .dragon-home-hero, #dragonHomePage.dragon-home-v3 .dragon-home-hero, #dragonHomePage.dragon-home-v4 .dragon-home-hero{margin-top:-1.1rem;}" +
      "#dragonHomePage .dragon-home-logo{width:76px; height:76px; border-radius:18px; object-fit:cover; margin-bottom:.35rem; border:1px solid rgba(201,168,255,.5); box-shadow:0 6px 24px rgba(155,107,255,.5);}",
      "#dragonHomePage.dragon-home-v5 .dragon-home-logo{display:none;}",
      "#dragonHomePage .dragon-home-cta{display:none;}",
      /* --- v2: editorial — hero banner + masonry collage --- */
      "#dragonHomePage.dragon-home-v2{padding:0 0 3rem;}",
      "#dragonHomePage.dragon-home-v2 .dragon-home-hero{position:relative; min-height:42vh; margin-bottom:.9rem; padding:1rem;}",
      "#dragonHomePage.dragon-home-v2 .dragon-home-hero::after{content:''; position:absolute; inset:0; background:linear-gradient(180deg,rgba(11,11,15,.25),rgba(11,11,15,.92));}",
      "#dragonHomePage.dragon-home-v2 .dragon-home-hero > *{position:relative; z-index:2;}",
      "#dragonHomePage.dragon-home-v2 .dragon-home-title{font-size:2.3rem;}",
      "#dragonHomePage.dragon-home-v2 .dragon-home-grid{column-count:5; column-gap:.45rem; max-width:1240px; margin:0 auto; padding:0 .8rem; display:block;}",
      "#dragonHomePage.dragon-home-v2 .dragon-home-tile{width:100%; height:auto; margin:0 0 .45rem; display:inline-block; break-inside:avoid; -webkit-column-break-inside:avoid; page-break-inside:avoid; background:linear-gradient(145deg,#1b1b22,#0d0d11);}",
      "#dragonHomePage.dragon-home-v2 .dragon-home-tile img{width:100%; height:auto; object-fit:contain; display:block;}",
      /* --- v3: gallery wall — compact banner + clean 3-column wall --- */
      "#dragonHomePage.dragon-home-v3 .dragon-home-hero{position:relative; min-height:26vh; margin-bottom:.8rem; border-radius:14px; overflow:hidden; max-width:1200px; margin-left:auto; margin-right:auto;}",
      "#dragonHomePage.dragon-home-v3 .dragon-home-hero::after{content:''; position:absolute; inset:0; background:linear-gradient(180deg,rgba(11,11,15,.2),rgba(11,11,15,.88));}",
      "#dragonHomePage.dragon-home-v3 .dragon-home-hero > *{position:relative; z-index:2;}",
      "#dragonHomePage.dragon-home-v3 .dragon-home-grid{display:grid; grid-template-columns:repeat(3,1fr); gap:.6rem; max-width:1200px; margin:0 auto;}",
      "#dragonHomePage.dragon-home-v3 .dragon-home-tile img{width:100%; height:auto; object-fit:contain;}",
      /* --- v4: cinematic — full-bleed featured first tile + 4-col strip --- */
      "#dragonHomePage.dragon-home-v4 .dragon-home-hero{position:relative; min-height:20vh; margin-bottom:.7rem;}",
      "#dragonHomePage.dragon-home-v4 .dragon-home-hero::after{content:''; position:absolute; inset:0; background:linear-gradient(180deg,rgba(11,11,15,.1),rgba(11,11,15,.9));}",
      "#dragonHomePage.dragon-home-v4 .dragon-home-hero > *{position:relative; z-index:2;}",
      "#dragonHomePage.dragon-home-v4 .dragon-home-grid{display:grid; grid-template-columns:repeat(4,1fr); gap:.45rem; max-width:1280px; margin:0 auto; align-items:start;}",
      "#dragonHomePage.dragon-home-v4 .dragon-home-tile img{width:100%; height:auto; object-fit:contain;}",
      "#dragonHomePage.dragon-home-v4 .dragon-home-tile:first-child{grid-column:1/-1; max-height:56vh; overflow:hidden; cursor:default; pointer-events:none;}",
      "#dragonHomePage.dragon-home-v4 .dragon-home-tile:first-child img{width:100%; height:56vh; object-fit:cover;}",
      /* --- v5: spotlight — huge centered Generate button over a blurred collage --- */
      "#dragonHomePage.dragon-home-v5{padding:0; overflow:hidden;}",
      "#dragonHomePage.dragon-home-v5 .dragon-home-title, #dragonHomePage.dragon-home-v5 .dragon-home-sub{display:none;}",
      "#dragonHomePage.dragon-home-v5 .dragon-home-grid{position:fixed; top:var(--dragon-nav-h,42px); left:0; right:0; bottom:0; display:grid; grid-template-columns:repeat(4,1fr); grid-auto-rows:1fr; gap:5px; filter:blur(2px) brightness(.42) saturate(1.1); z-index:1; max-width:none; margin:0; padding:0;}",
      "#dragonHomePage.dragon-home-v5 .dragon-home-tile{border-radius:0; border:0; cursor:default;}",
      "#dragonHomePage.dragon-home-v5 .dragon-home-tile img{width:100%; height:100%; object-fit:cover;}",
      "#dragonHomePage.dragon-home-v5 .dragon-home-cta{display:flex; position:fixed; left:50%; top:calc(40% - 1rem); transform:translate(-50%,-50%); z-index:5; flex-direction:column; align-items:center; gap:.7rem;}",
      // Egon 15.09.2026 — hover no longer MOVES (transform:scale FORBIDDEN; Egon rule): only color/shadow/aura.
      "#dragonHomePage .dragon-home-cta button{padding:1.15rem 2.6rem; font-size:1.55rem; font-weight:800; border-radius:999px; cursor:pointer; border:2px solid #c9a8ff; background:linear-gradient(180deg,#7a4dff,#3a1d8a); color:#fff; box-shadow:0 10px 40px rgba(155,107,255,.6); letter-spacing:.03em; transition:box-shadow .28s ease, background .28s ease, border-color .28s ease; outline:none;}",
      "#dragonHomePage .dragon-home-cta button:hover{background:linear-gradient(180deg,#8a5dff,#47209c); border-color:#e6dcff; box-shadow:0 16px 60px rgba(155,107,255,.9), 0 0 0 5px rgba(155,107,255,.22);}",
      // Egon 15.09.2026 — "pitch black" backgrounds are now blackish + SEMI-TRANSPARENT (looks softer on image/tiles).
      // 📏 Egon 23.09.2026 (W-UI175) — "for both mobile and desktop, move the button captions closer to their respective buttons
      // one notch closer": each caption is pulled up by .32rem with a NEGATIVE top margin. Because a
      // negative top margin also shrinks the flow height, the following button keeps exactly the distance it
      // had (the gap AFTER the caption is untouched) — only the button→its-own-caption gap gets ~5px tighter.
      "#dragonHomePage .dragon-home-cta-sub{font-size:1.05rem; font-weight:800; letter-spacing:.02em; color:#fff; opacity:1; margin:-.32rem 0 .42rem; text-shadow:0 1px 6px rgba(0,0,0,.72); padding:.4rem 1rem; border-radius:999px; background:rgba(13,10,20,.52); -webkit-backdrop-filter:blur(3px); backdrop-filter:blur(3px); border:1px solid rgba(201,168,255,.4); box-shadow:0 6px 22px rgba(0,0,0,.35); max-width:min(94vw,760px); text-align:center; line-height:1.25;}",
      // Egon 15.09.2026 — new Home CTA spacing + GALLERIES button. GALLERIES only provides COLOR; size/padding
      // comes from the base `.dragon-home-cta button` rule → mobile scaling rule scales both automatically.
      "#dragonHomePage .dragon-home-gap{height:.06rem; width:1px;}",
      "#dragonHomePage .dragon-home-cta .dragon-home-gal-btn{border-color:#8fd0ff; background:linear-gradient(180deg,#2f8fd8,#173e7a); box-shadow:0 10px 40px rgba(74,163,255,.55);}",
      "#dragonHomePage .dragon-home-cta .dragon-home-gal-btn:hover{background:linear-gradient(180deg,#3fa2ea,#1d4d94); border-color:#e3f2ff; box-shadow:0 16px 60px rgba(74,163,255,.9), 0 0 0 5px rgba(74,163,255,.22);}",
      // Egon 15.09.2026 — CHARACTER CREATION button is now in the RED color of the CC action bar (Egon's request).
      "#dragonHomePage .dragon-home-cta .dragon-home-char-btn{border-color:#c81e2e; color:#ffd4d4; background:linear-gradient(180deg,#7d1620,#2a0c10); box-shadow:0 10px 40px rgba(200,30,46,.55); display:inline-flex; align-items:center; justify-content:center; gap:.3rem; white-space:nowrap;}",
      "#dragonHomePage .dragon-home-cta .dragon-home-char-btn:hover{background:linear-gradient(180deg,#a01a2a,#3a0c12); border-color:#ff6b78; box-shadow:0 16px 60px rgba(200,30,46,.9), 0 0 0 5px rgba(200,30,46,.22);}",
      // Egon 29.09.2026 — Ai Chat button (ex-Social): identical design/size to the other Home CTA
      // buttons (size comes from the base rule), in the Social purple, FUNCTIONAL (opens the Social page).
      "#dragonHomePage .dragon-home-cta .dragon-home-social-btn{border-color:#9b6bff; color:#efe7ff; background:linear-gradient(180deg,#5b34c0,#2a1650); box-shadow:0 10px 40px rgba(155,107,255,.55); display:inline-flex; align-items:center; justify-content:center; gap:.3rem; white-space:nowrap;}",
      "#dragonHomePage .dragon-home-cta .dragon-home-social-btn:hover{background:linear-gradient(180deg,#6f45d8,#341b62); border-color:#d3bfff; box-shadow:0 16px 60px rgba(155,107,255,.9), 0 0 0 5px rgba(155,107,255,.22);}",
      // Egon 15.09.2026 — symmetric dancer ON BOTH SIDES of the button label; the right one is mirrored (looks left).
      "#dragonHomePage .dragon-home-cta .dragon-dancer{display:inline-block; line-height:1; font-size:.72em;}",
      "#dragonHomePage .dragon-home-cta .dragon-dancer-r{transform:scaleX(-1);}",
      // Egon 14.09.2026 — the character label is longer than the others, so it wrapped to 2 lines and made the
      // middle button taller than Generate/Galleries. Drop the inherited letter-spacing + trim the horizontal
      // padding on JUST this label so it stays on ONE line: all three buttons keep identical width + height.
      "#dragonHomePage.dragon-home-v6 .dragon-home-cta .dragon-home-char-btn{letter-spacing:0; padding-left:.6rem; padding-right:.6rem;}",
      /* --- v6: conveyor — center Generate + title/logo on top; background images stream in from
         top-left and shift right, wrapping to the next row's left (snake), bottom one drops off. --- */
      "#dragonHomePage.dragon-home-v6{padding:0; overflow:hidden;}",
      // Egon 15.09.2026 — v6: header is no longer fixed at the top; it is moved inside the CTA (JS) and floats ABOVE the Generate button. Top tiles do not close.
      "#dragonHomePage.dragon-home-v6 .dragon-home-hero{position:static; left:auto; top:auto; right:auto; z-index:auto; padding:0 0 .3rem; pointer-events:none;}",
      // Egon 15.09.2026 — v6 header was enlarged 2-3 FOLD (1.7rem → 3.6rem); the description line below was REMOVED.
      // Egon 15.09.2026 (v2) — MODERN header: purple clip-gradient + heavy text-shadow looked "weird" in the new version
      // (double shadow/smudge behind letters). Now it's a white→purple vertical gradient + a single soft
      // drop-shadow following the glyph, tight letter spacing, 900 weight. text-shadow is COMPLETELY off.
      // Egon 15.09.2026 (v3) — header expanded to the width of 2 VISUALS (2 column tiles); subtitle scaled proportionally.
      // Since the v6 grid is 4 equal columns, 2 tiles are ~50vw; the header fills that width in a single line (nowrap).
      // Egon 15.09.2026 — header color DARKENED: white→purple transition removed, a dark vertical gradient
      // based on the default theme's purple tones (c9a8ff → 9b6bff → 5b34c0) + a calmer shadow.
      "#dragonHomePage.dragon-home-v6 .dragon-home-title{font-size:clamp(2.4rem,5.2vw,6.5rem); line-height:1.02; letter-spacing:-.02em; font-weight:900; white-space:nowrap; width:100%; background:none; -webkit-text-fill-color:currentcolor; color:#8a6bff; text-shadow:none; filter:none; display:flex; align-items:center; justify-content:center; gap:.06em; padding:0 .2rem;}"
      +
      // Egon 18.09.2026 — 3D "BESTAIGEN": gradient face + stacked drop-shadow extrusion, sparkles kept
      // (right sparkle is MIRRORED like the Character Creation dancer emojis).
      "#dragonHomePage .dragon-home-title .dragon-3d{display:inline-block; background:linear-gradient(180deg,#f2e8ff 0%,#d6b9ff 16%,#ac80ff 40%,#814ef2 61%,#5b2fc4 79%,#391698 100%); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; color:#8a6bff; filter:drop-shadow(0 1px 0 #4a2596) drop-shadow(0 1px 0 #4a2596) drop-shadow(0 1px 0 #48248f) drop-shadow(0 1px 0 #452289) drop-shadow(0 1px 0 #411f82) drop-shadow(0 1px 0 #3d1c7a) drop-shadow(0 1px 0 #391a73) drop-shadow(0 8px 12px rgba(0,0,0,.55)) drop-shadow(0 0 28px rgba(155,107,255,.5));}" +
      "#dragonHomePage .dragon-home-title .dragon-spark{-webkit-text-fill-color:currentcolor; color:#d7b6ff; display:inline-block; font-size:.72em; line-height:1; filter:drop-shadow(0 0 10px rgba(201,168,255,.85));}" +
      "#dragonHomePage .dragon-home-title .dragon-spark-r{transform:scaleX(-1);}",
      // Egon 15.09.2026 — in v6, Generate and Galleries buttons are EXACTLY the same size (fixed width + centered text).
      "#dragonHomePage.dragon-home-v6 .dragon-home-cta button{width:min(80vw,340px); box-sizing:border-box; padding:1rem 1.1rem; font-size:clamp(1.05rem,3.4vw,1.5rem); text-align:center;}",
      // Egon 15.09.2026 — in v6, subtitle is now VISIBLE: "Best Ai Image Generator" immediately below the header.
      // Egon 15.09.2026 — subtitle is PROPORTIONAL to header: while header is max 6.2rem, subtitle is ~35%.
      "#dragonHomePage.dragon-home-v6 .dragon-home-sub{display:block; font-size:clamp(1.1rem,1.95vw,2.1rem); font-weight:800; letter-spacing:.03em; color:#d9c9ff; opacity:1; margin:var(--dragon-home-x-head) 0 .2rem; text-shadow:0 1px 8px rgba(0,0,0,.7); padding:.2rem .9rem; border-radius:999px; background:rgba(13,10,20,.5); -webkit-backdrop-filter:blur(3px); backdrop-filter:blur(3px);}",
      "#dragonHomePage.dragon-home-v6 .dragon-home-grid{position:fixed; top:var(--dragon-nav-h,42px); left:0; right:0; bottom:0; display:grid; grid-template-columns:repeat(4,1fr); grid-template-rows:repeat(4,1fr); gap:4px; z-index:1; max-width:none; margin:0; padding:0;}",
      // Egon 15.09.2026 — the flat black gradient at the top was covering the first row of images → radial (dark in center, light at edges/top).
      "#dragonHomePage.dragon-home-v6 .dragon-home-grid::after{content:''; position:fixed; inset:0; background:radial-gradient(56% 40% at 50% 54%, rgba(11,11,15,.6), rgba(11,11,15,.16) 72%, rgba(11,11,15,.08)); z-index:2; pointer-events:none;}",
      "#dragonHomePage.dragon-home-v6 .dragon-home-tile{border-radius:0; border:0; cursor:default; overflow:hidden;}",
      "#dragonHomePage.dragon-home-v6 .dragon-home-tile img{width:100%; height:100%; object-fit:cover; will-change:transform; transition:transform .6s ease, opacity .6s ease;}",
      "#dragonHomePage.dragon-home-v6 .dragon-home-cta{display:flex; position:fixed; left:50%; top:calc(38% + 2.7rem); transform:translate(-50%,-50%); z-index:6; flex-direction:column; align-items:center; gap:.34rem; max-width:min(96vw,880px); text-align:center;}",
      /* --- v7: seamless — the v6 look (full-bleed wall, floating title + CTA, dark radial) with ONE
         difference: the images keep their ORIGINAL aspect ratio (nothing is cropped) and the tiles
         KISS — no gap anywhere. The wall itself is a JS-computed JUSTIFIED layout (dragonHomeV7Layout):
         a row is filled until its height reaches the target, then every tile in that row gets exactly
         `rowHeight * imageRatio` → the row covers the full width with no gap and no crop, and the rows
         stack with no vertical gap. The wall may overflow the viewport; the extra is clipped. --- */
      "#dragonHomePage.dragon-home-v7{padding:0; overflow:hidden;}",
      // Egon 22.09.2026 — HOME V8 uses V7's HEADER/CTA STYLING VERBATIM ("copy everything from v7
      // to v8 except the background; the ONLY difference between v7 and v8 is the order of background images"). So the hero, title,
      // subtitle, CTA box and buttons are declared ONCE for both versions — the selector lists v7 AND v8, so
      // the two can never drift apart again. Only the wall/veil (grid + tile + ::after) stays v8-specific.
      "#dragonHomePage.dragon-home-v7 .dragon-home-hero, #dragonHomePage.dragon-home-v8 .dragon-home-hero{position:static; left:auto; top:auto; right:auto; z-index:auto; padding:0 0 .3rem; pointer-events:none;}",
      "#dragonHomePage.dragon-home-v7 .dragon-home-title, #dragonHomePage.dragon-home-v8 .dragon-home-title{font-size:clamp(2.4rem,5.2vw,6.5rem); line-height:1.02; letter-spacing:-.02em; font-weight:900; white-space:nowrap; width:100%; background:none; -webkit-text-fill-color:currentcolor; color:#8a6bff; text-shadow:none; filter:none; display:flex; align-items:center; justify-content:center; gap:.06em; padding:0 .2rem;}",
      "#dragonHomePage.dragon-home-v7 .dragon-home-sub, #dragonHomePage.dragon-home-v8 .dragon-home-sub{display:block; font-size:clamp(1.1rem,1.95vw,2.1rem); font-weight:800; letter-spacing:.03em; color:#d9c9ff; opacity:1; margin:var(--dragon-home-x-head) 0 .2rem; text-shadow:0 1px 8px rgba(0,0,0,.7); padding:.2rem .9rem; border-radius:999px; background:rgba(13,10,20,.5); -webkit-backdrop-filter:blur(3px); backdrop-filter:blur(3px);}",
      "#dragonHomePage.dragon-home-v7 .dragon-home-cta, #dragonHomePage.dragon-home-v8 .dragon-home-cta{display:flex; position:fixed; left:50%; top:calc(38% + 2.7rem); transform:translate(-50%,-50%); z-index:6; flex-direction:column; align-items:center; gap:.34rem; max-width:min(96vw,880px); text-align:center;}",
      "#dragonHomePage.dragon-home-v7 .dragon-home-cta button, #dragonHomePage.dragon-home-v8 .dragon-home-cta button{width:min(80vw,340px); box-sizing:border-box; padding:1rem 1.1rem; font-size:clamp(1.05rem,3.4vw,1.5rem); text-align:center;}",
      "#dragonHomePage.dragon-home-v7 .dragon-home-grid{position:fixed; top:var(--dragon-nav-h,42px); left:0; right:0; bottom:0; display:block; max-width:none; margin:0; padding:0; z-index:1; overflow:hidden;}",
      "#dragonHomePage.dragon-home-v7 .dragon-home-tile{position:absolute; border-radius:0; border:0; cursor:default; overflow:hidden; margin:0; padding:0; line-height:0; background:#0d0d11;}",
      "#dragonHomePage.dragon-home-v7 .dragon-home-tile img{width:100%; height:100%; display:block; object-fit:cover; will-change:transform; transition:transform .6s ease, opacity .6s ease;}",
      "#dragonHomePage.dragon-home-v7::after{content:''; position:fixed; inset:0; background:radial-gradient(56% 40% at 50% 54%, rgba(11,11,15,.6), rgba(11,11,15,.16) 72%, rgba(11,11,15,.08)); z-index:2; pointer-events:none;}",
      // Egon 21.09.2026 — HOME V8 "MOSAIC" (W-LOC109 tile paving): the v7 justified packing, but paved as a
      // DESIGNED mosaic — 10px gutters, 14px rounded tiles, a 16px outer margin and a dark scrim, with the
      // header + CTA borrowing v7's own styling so the captions stay readable over the images. Tile geometry
      // comes from `dragonHomeV8Layout` (inline left/top/width/height), exactly like v7. Since 22.09.2026 the
      // header/CTA rules live in the v7 block above (shared selector) — only the WALL is v8-specific.
      "#dragonHomePage.dragon-home-v8{padding:0; overflow:hidden; background:#08080c;}",
      "#dragonHomePage.dragon-home-v8 .dragon-home-grid{position:fixed; top:var(--dragon-nav-h,42px); left:0; right:0; bottom:0; display:block; max-width:none; margin:0; padding:0; z-index:1; overflow:hidden;}",
      "#dragonHomePage.dragon-home-v8 .dragon-home-tile{position:absolute; border-radius:14px; border:0; cursor:default; overflow:hidden; margin:0; padding:0; line-height:0; background:#12121a; box-shadow:0 8px 26px rgba(0,0,0,.45);}",
      "#dragonHomePage.dragon-home-v8 .dragon-home-tile img{width:100%; height:100%; display:block; object-fit:cover; will-change:transform; transition:transform .7s ease, opacity .7s ease;}",
      // 🖼 Egon 22.09.2026 — the veil no longer swallows the wall: the middle of the screen (where the
      // mosaic is the point) is almost untouched and only the outer edge darkens.
      "#dragonHomePage.dragon-home-v8::after{content:''; position:fixed; inset:0; z-index:2; pointer-events:none; background:radial-gradient(126% 92% at 50% 50%, rgba(8,8,12,.06) 0%, rgba(8,8,12,.13) 46%, rgba(8,8,12,.46) 100%);}",
      // Egon 22.09.2026 — v8's OWN header/CTA styling (gradient wordmark, small subtitle, the CTA box's
      // padding/shield leftovers, the ambient purple glow and the per-button glow) was REMOVED on his
      // request: v7 and v8 must differ ONLY in how the background images are arranged. The rules it used
      // now live on the shared v7/v8 selectors in the v7 block further up.
      // Short viewports (small laptops, phone in landscape): the heading rhythm is tightened so the CTA
      // never overflows the bottom edge (same for both styles, since they share the header rules now).
      "@media (max-height:820px){ #dragonHomePage{--dragon-home-x-head:.42rem;} }",
      "@media (max-width:600px){ #dragonHomePage{--dragon-home-x-head:.62rem;} #dragonHomePage.dragon-home-v1 .dragon-home-grid{grid-template-columns:repeat(2,1fr); gap:.4rem;} #dragonHomePage.dragon-home-v2 .dragon-home-grid{column-count:2; column-gap:.35rem;} #dragonHomePage.dragon-home-v3 .dragon-home-grid{grid-template-columns:repeat(2,1fr);} #dragonHomePage.dragon-home-v4 .dragon-home-grid{grid-template-columns:repeat(2,1fr);} #dragonHomePage.dragon-home-v5 .dragon-home-grid{grid-template-columns:repeat(3,1fr);} #dragonHomePage .dragon-home-title{font-size:1.15rem;} #dragonHomePage .dragon-home-cta button{font-size:1.15rem; padding:.9rem 1.8rem;} #dragonHomePage.dragon-home-v2 .dragon-home-title{font-size:1.6rem;} #dragonHomePage.dragon-home-v6 .dragon-home-title{font-size:min(2.1rem,9vw);} #dragonHomePage.dragon-home-v6 .dragon-home-gap{height:.04rem;} #dragonHomePage.dragon-home-cta-sub{font-size:.86rem;} #dragonHomePage.dragon-home-v6 .dragon-home-cta{gap:.26rem; max-width:96vw;} #dragonHomePage.dragon-home-v6 .dragon-home-cta button{font-size:1.1rem; padding:.85rem 1.4rem;} #dragonHomePage.dragon-home-v6 .dragon-home-cta-sub{font-size:.8rem; padding:.28rem .8rem;} #dragonHomePage.dragon-home-v7 .dragon-home-grid{column-count:2;} #dragonHomePage.dragon-home-v7 .dragon-home-title, #dragonHomePage.dragon-home-v8 .dragon-home-title{font-size:min(2.1rem,9vw);} #dragonHomePage.dragon-home-v7 .dragon-home-cta, #dragonHomePage.dragon-home-v8 .dragon-home-cta{gap:.26rem; max-width:96vw;} #dragonHomePage.dragon-home-v7 .dragon-home-cta button, #dragonHomePage.dragon-home-v8 .dragon-home-cta button{font-size:1.1rem; padding:.85rem 1.4rem;} #dragonHomePage.dragon-home-v7 .dragon-home-cta-sub, #dragonHomePage.dragon-home-v8 .dragon-home-cta-sub{font-size:.8rem; padding:.28rem .8rem;} }",
      // Egon 15.09.2026 — CC action bar breaks evenly into two lines on narrow screens: top is 🎲 All Random +
      // 🧹 Clear All, full width at the bottom ✨ Generate ⭐.
      "@media (max-width:620px){ .dragon-cc-genbar > button:nth-child(1){order:1;} .dragon-cc-genbar > button:nth-child(3){order:2;} .dragon-cc-genbar > button:nth-child(2){order:3; flex-basis:100% !important; max-width:none !important;} .dragon-premade-selrow > button:nth-child(1){order:1;} .dragon-premade-selrow > button:nth-child(3){order:2;} .dragon-premade-selrow > button:nth-child(2){order:3; flex-basis:100% !important; max-width:none !important;} }",
      // Egon 15.09.2026 — t2i-plugin's "click ➡ / ⬅ click / ⬆ click" help texts were removed (Egon's request).
      "#leftClickHelperEl, #rightClickHelperEl, #bottomClickHelperEl{display:none !important;}",
      /* ---------- 🕘 THE OLD HISTORY PAGE — CSS REMOVED (Egon 26.09.2026) ----------
         The whole #dragonHistoryPage rule set (page shell · title · tabs · list · grid · card · cap · meta ·
         acts · empty · back-to-top circle · the `data-dragon-page="history"` visibility rules) is gone:
         the page itself was deleted. The removed CSS is parked in Librarybook.enc (DEPO, W-CLEAN338) —
         byte-exact from the pre-W-UI327 archive copy (see the honesty note in that DEPO entry).
         The .dragon-hist-* CLASSES are NOT dead — the shared renderers (renderHistoryRecent /
         renderMyPromptHistory) still build .dragon-hist-grid/.dragon-hist-card/
         .dragon-hist-list, and the Image History + Prompt Panel rules below style them. */
      /* ---------- page visibility ---------- */
      "html[data-dragon-page=\"home\"] #dragonHomePage{display:block !important;}",
      "html[data-dragon-page=\"home\"] #mainColumnEl85394739{display:none !important;}",
      /* generate page: hide the character-creation panels (they live on their own page) */
      "html[data-dragon-page=\"generate\"] #userInputsCtn8462746262 > [class*=\"dragon-char-wrap\"],html[data-dragon-page=\"generate\"] #userInputsCtn8462746262 > .dragon-premade-stack,html[data-dragon-page=\"generate\"] #showSocialsButtonCtn9000274628,html[data-dragon-page=\"generate\"] #showHideGalleryAndCommentsButtonsCtn83728732671{display:none !important;}",
      /* character page: only the character panel + generate button/output */
      "html[data-dragon-page=\"character\"] .dragon-artstyle-panel,html[data-dragon-page=\"character\"] #userInputsCtn8462746262 > .input-ctn,html[data-dragon-page=\"character\"] #userInputsCtn8462746262 > .dragon-control-panel,html[data-dragon-page=\"character\"] #userInputsCtn8462746262 > #dragonHistoryPanel,html[data-dragon-page=\"character\"] #shareLinkOuterCtn2893827,html[data-dragon-page=\"character\"] #showSocialsButtonCtn9000274628,html[data-dragon-page=\"character\"] #showHideGalleryAndCommentsButtonsCtn83728732671{display:none !important;}",
      /* Egon 29.10.2026 — the Studio panel and the generate-page purple Generate never
         belong on the Character page (the button lives inside .input-ctn so it is
         covered above; the Studio rule is belt-and-suspenders for rebuilds). The hero
         banner STAYS: on this page its pictures are girls (see dragonWowRender). */
      "html[data-dragon-page=\"character\"] #dragonStudioPanel,html[data-dragon-page=\"character\"] .dragon-gen-btn{display:none !important;}",
      /* gallery page: only the gallery */
      "html[data-dragon-page=\"gallery\"] #userInputsCtn8462746262,html[data-dragon-page=\"gallery\"] #outputAreaEl,html[data-dragon-page=\"gallery\"] #shareLinkOuterCtn2893827,html[data-dragon-page=\"gallery\"] .dragon-gen-row,html[data-dragon-page=\"gallery\"] #showHideGalleryAndCommentsButtonsCtn83728732671{display:none !important;}",
      /* Egon 12.09.2026 — on the Gallery page, open the gallery directly under the navbar:
         hide the HIDE GALLERIES button + CHAT mirror button, and the title/hero banner. */
      "html[data-dragon-page=\"gallery\"] #showSocialsButtonCtn9000274628{display:none !important;}",
      "html[data-dragon-page=\"gallery\"] #dragonWowHeroBanner{display:none !important;}",
      /* Egon 13.09.2026 — Gallery page should start immediately below the navbar: remove the "🖼️ Gallery"
         heading and the intervening spacing (comments box + margin). */
      "html[data-dragon-page=\"gallery\"] .dragon-gal-title{display:none !important;}",
      "html[data-dragon-page=\"gallery\"] #commentsPluginCtn654732{display:none !important;}",
      "html[data-dragon-page=\"gallery\"] #clickCountBasedSocialDisplayNotifierEl{display:none !important;}",
      "html[data-dragon-page=\"gallery\"] #imageGalleryCtn8569284{margin-top:0 !important; padding-top:0 !important;}",
      /* Egon 13.09.2026 — gallery should ONLY be visible on the Gallery page; it should not appear in any way on the Generate/Character/Home/
         History/Likes/Account pages (even if the gallery was opened from the navbar). This also eliminates the 2nd vertical scrollbar appearing on the right. */
      "html:not([data-dragon-page=\"gallery\"]) #imageGalleryCtn8569284{display:none !important;}",
      /* ---------- private gallery (Likes) ---------- */
      /* Egon 11.09.2026: the mini menu / folder / sort / filter bar was sitting
         underneath the fixed navbar (root top:0, z-index 9999 < navbar 99990).
         Push the whole Likes view below the navbar and above it so the controls
         are visible at the very top again. */
      "#localMediaGallery_root{top:var(--dragon-nav-h,42px) !important; z-index:100050 !important;}",
      /* toolbox tools row inside control panel */
      ".dragon-cp-tools-row .dragon-shortcut-tool{font-size:.68rem !important; border-radius:6px !important;}",
      /* Egon 11.09.2026 (#8) — the on-image magnifier overlay button was removed, but its
         purple hover glow is now applied GLOBALLY to every button in the generator. */
      ".t2i-image-ctn{position:relative !important;}",
      "button{transition:box-shadow .15s ease, filter .15s ease;}",
      "button:hover:not(:disabled){box-shadow:0 0 0 1px rgba(155,107,255,.6), 0 0 14px rgba(155,107,255,.55) !important; filter:brightness(1.08);}",
      /* Egon 12.09.2026 — I59: no button changes SIZE/POSITION on click. The old global
         `transform:scale(.97)` rule used to shrink CC v1 headers (and other buttons) upon clicking;
         it has now been neutralized app-wide (only glow + brightness remain). */
      "button:active:not(:disabled){transform:none !important;}",
      "button:focus-visible{outline:none; box-shadow:0 0 0 2px rgba(155,107,255,.75), 0 0 18px rgba(155,107,255,.6) !important;}",
      /* Egon 14.09.2026 — ♿ Full keyboard/accessibility: visible focus ring for all interactive elements except buttons (input/select/textarea/link/tabindex). Clear when navigating via keyboard. */
      "input:focus-visible,select:focus-visible,textarea:focus-visible,a:focus-visible,[tabindex]:focus-visible,[contenteditable]:focus-visible{outline:2px solid #9b6bff !important; outline-offset:2px !important;}",
      /* Egon 14.09.2026 (#13) — SKELETON LOADER IS NOW DISABLED (DEPOT): it was reported that some squares remained stuck as gray/shimmer; calls were also disabled. To re-enable, restore these CSS lines and the dragonSkelMark() calls (2 places). */
      /* "@keyframes dragon-skel-shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}", */
      /* "img.dragon-skel{background:linear-gradient(100deg,#1b1b22 30%,#2c2c3c 50%,#1b1b22 70%) !important; background-size:200% 100% !important; animation:dragon-skel-shimmer 1.25s linear infinite !important; color:transparent !important;}", */
      /* "@media (prefers-reduced-motion: reduce){img.dragon-skel{animation:none !important;}}", */
      ".dragon-gal-empty{display:flex; flex-direction:column; align-items:center; justify-content:center; gap:.15rem;}",
      /* Egon 14.09.2026 (#12) — VIRTUAL load mode: the browser skips layout+paint of off-screen tiles
         (only ~visible ones are really rendered) while keeping the DOM/scroll height intact. This is
         the safe, standards-based way to get a "virtual list" without rewriting the gallery renderer.
         Additive: to remove the mode, delete this CSS + the "virtual" entry points in the load helpers. */
      /* Egon 09/14/2026 — virtual applies ONLY on the public gallery page (removed from private). */
      // 📱 Egon 22.09.2026 — "it lags a lot while browsing the gallery on mobile". The paint-virtualisation half of
      // 🧊 Virtual (off-screen tiles are NOT rendered/painted; `contain-intrinsic-size:auto` keeps the scroll
      // height stable) is now ON FOR EVERY LOAD-SPEED MODE, not just Virtual. It changes nothing about WHICH
      // images are downloaded (so it cannot slow loading — I100 is untouched) — it only stops the browser
      // from painting the hundreds of tiles that are off-screen, which is exactly what stutters on a phone.
      // 🖼️ Egon 22.09.2026 (batch 2.28.0) — the height a NOT-painted tile reports: dragonGalEagerWindow writes
      // `--dragon-gal-intrinsic` = the tile's real outer width in the square display modes (cover/contain/
      // stretch), because there the outer height IS the outer width — so a tile that the browser has not
      // painted yet occupies exactly the same height as a painted one and the page can never grow/jump as
      // tiles enter the viewport. In the image-driven modes (justified/masonry/original/grow) the variable is
      // absent and the fallback `auto 300px` keeps the previous behaviour (Chrome's last-remembered size).
      "html[data-dragon-page='gallery'] .dragon-gal-tile{content-visibility:auto; contain-intrinsic-size:var(--dragon-gal-intrinsic, auto 300px);}",
      // 🖼️ Egon 22.09.2026 (batch 2.28.0) — RETENTION BAND. The tiles within ~2 screens ABOVE the viewport
      // (and everything down to the end of the prefetch window) get this class from dragonGalEagerWindow's
      // paint pass, which makes them FULLY painted again: a picture the visitor has already looked at is
      // still there when they scroll back to it, instead of the browser having thrown its pixels away and
      // re-rendering (and re-decoding) it from scratch exactly when it re-enters the screen. Tiles further
      // away keep the `content-visibility:auto` behaviour above, so a phone still only paints the small band
      // around the viewport instead of hundreds of tiles. The `--dragon-gal-intrinsic` height is kept equal
      // to the real tile height by the same paint pass, so entering/leaving this band can never move the page.
      "html[data-dragon-page='gallery'] .dragon-gal-tile.dragon-gal-cv-keep{content-visibility:visible;}",
      /* Egon 11.09.2026 — the red "?" unseen-count badges on chat channels confused users;
         channels other than the loaded one always show "?" and look broken. Remove them. */
      ".tabbed-comments-plugin-unseen-count{display:none !important;}",
      /* Egon 19.09.2026 — per-channel ✕: hovering a channel name reveals a tiny red ✕ at the tab's
         top-right; clicking it closes that channel for this visitor (General is never closable).
         It is absolutely positioned, so the tab's size never changes (I59). On touch devices there
         is no hover, so it stays faintly visible there and becomes solid on tap. */
      "#dragonChatWindow .tabbed-comments-plugin-channel-tab{position:relative; flex:0 0 auto;}",
      "#dragonChatWindow .dragon-chat-tabx{position:absolute; top:-2px; right:-2px; width:13px; height:13px; box-sizing:border-box; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:9px; line-height:1; font-weight:bold; color:#fff; background:#b3261e; border:1px solid #ff8a80; box-shadow:0 1px 4px rgba(0,0,0,.6); cursor:pointer; opacity:0; pointer-events:none; transition:opacity .12s ease; z-index:3; user-select:none;}",
      "#dragonChatWindow .tabbed-comments-plugin-channel-tab:hover .dragon-chat-tabx,#dragonChatWindow .tabbed-comments-plugin-channel-tab:focus-within .dragon-chat-tabx{opacity:1; pointer-events:auto;}",
      "#dragonChatWindow .dragon-chat-tabx:hover{background:#e53935; border-color:#fff;}",
      "@media (hover:none){#dragonChatWindow .dragon-chat-tabx{opacity:.65; pointer-events:auto;}}",
      /* Egon 19.09.2026 — ✕ is offered ONLY on the currently selected channel, so the ✕ sits on the
         ACTIVE tab; the plugin's own add-channel tab is dimmed and inert while its dialog is open. */
      "#dragonChatWindow .tabbed-comments-plugin-add-custom-channel.dragon-chat-addbusy{opacity:.4 !important; pointer-events:none !important; cursor:default !important;}",
      /* 🗓️ message-range button beside the channel tabs (Egon 19.09.2026: the "load one more week" step
         bar was removed — only the range menu remains). */
      /* Egon 19.09.2026 — the plugin draws ⬅️ ➡️ (move channel left/right) and 🗑️ ("Hide or unpin this
         channel") around the ACTIVE custom channel. Both are retired: the visitor leaves a room with
         our own red ✕ on the tab, and rooms are simply ordered by when they were added.
         IMPORTANT: hide ONLY the control buttons. The plugin keeps the ACTIVE custom channel's TAB
         itself inside `.tabbed-comments-plugin-active-custom-channel-control-cluster`, so hiding that
         cluster would hide the tab (and its ✕) as well. */
      "#dragonChatWindow .tabbed-comments-plugin-channel-control-btn{display:none !important;}",
      "#dragonChatWindow .dragon-chat-sortbtn{min-width:1.7rem; display:inline-flex; align-items:center; justify-content:center; cursor:pointer; font-size:.9rem; padding:0 .35rem;}",
      "#dragonChatWindow .dragon-chat-sortbtn:hover{background:rgba(155,107,255,.18);}",
      ".dragon-chat-menu{position:fixed; z-index:2147483400; min-width:172px; padding:.3rem; border:1px solid #5a5a7a; border-radius:12px; background:linear-gradient(180deg,#1a1a22,#101017); box-shadow:0 12px 34px rgba(0,0,0,.6); font:13px/1.35 system-ui; color:#e9e6f2; text-align:left;}",
      ".dragon-chat-menu-row{display:flex; align-items:center; gap:.45rem; padding:.42rem .6rem; border-radius:8px; cursor:pointer; white-space:nowrap;}",
      ".dragon-chat-menu-row:hover{background:rgba(155,107,255,.16);}",
      ".dragon-chat-menu-row.is-active{background:rgba(255,215,106,.14); color:#ffe9a8; font-weight:700;}",
      ".dragon-chat-menu-row .ic{width:1.1rem; text-align:center;}",
      /* ➕ add-channel dialog: the plugin builds it (getUserInput) with inline styles on <body>, so it is
         re-dressed with !important rules + a to-the-top z-index (see chatDlgScan). */
      ".dragon-chat-dlg{background:rgba(8,8,12,.7) !important; z-index:2147483350 !important;}",
      ".dragon-chat-dlg > div{background:linear-gradient(180deg,#1a1a22,#0f0f14) !important; border:1px solid #4a4a58 !important; border-radius:16px !important; color:#e9e6f2 !important; box-shadow:0 18px 50px rgba(0,0,0,.65) !important; font:14px/1.45 system-ui !important; padding:16px !important; width:min(520px,94vw) !important;}",
      ".dragon-chat-dlg input,.dragon-chat-dlg textarea,.dragon-chat-dlg select{background:#0d0d12 !important; border:1px solid #4a4a58 !important; border-radius:10px !important; color:#e9e6f2 !important; padding:9px 10px !important; font:14px/1.4 system-ui !important; box-sizing:border-box !important;}",
      ".dragon-chat-dlg input::placeholder,.dragon-chat-dlg textarea::placeholder{color:#8d86a8 !important;}",
      ".dragon-chat-dlg button{border-radius:10px !important; font-weight:700 !important; padding:8px 16px !important; font-size:.85rem !important; cursor:pointer !important; border:1px solid #5b4a7d !important; background:linear-gradient(180deg,#2c2340,#1a1428) !important; color:#d8c9ff !important;}",
      ".dragon-chat-dlg button:hover{filter:brightness(1.12) !important;}",
      ".dragon-chat-dlg button:last-of-type{background:linear-gradient(180deg,#2bbd62,#178a43) !important; border-color:#2e9e54 !important; color:#fff !important;}",
      ".dragon-chat-dlg details summary{color:#d8c9ff !important; cursor:pointer;}",
      ".dragon-chat-dlg ul{margin:.3rem 0 0 .95rem !important; padding:0 !important;}",
      ".dragon-chat-dlg li{margin:.35rem 0 !important; font-size:.78rem !important; line-height:1.4 !important;}",
      /* ---------- floating chat window (Egon 11.09.2026) ---------- */
      /* Egon 17.10.2026 (W-SOC381) — the chat opens as the floating window by default; the ⛶
         header button switches to the full page under the navbar (choice remembered).
         (Feed overlay shelved: src/JS/dragon-chatfeed.js.) */
      "#dragonChatWindow{position:fixed; z-index:2147483200; right:.6rem; bottom:.6rem; left:auto; top:auto; width:min(400px, calc(100vw - 1.2rem)); height:min(620px, calc(100vh - var(--dragon-nav-h,42px) - 1.2rem)); max-width:none; max-height:none; display:flex; flex-direction:column; background:linear-gradient(180deg,#16161d,#0e0e12); border:1px solid #4a4a58; border-radius:14px; box-shadow:0 18px 50px rgba(0,0,0,.65); overflow:hidden; font:14px/1.4 system-ui; color:#e9e6f2; resize:none;}",
      "#dragonChatWindow.dragon-chat-full{top:var(--dragon-nav-h,42px) !important; left:0 !important; right:0 !important; bottom:0 !important; width:auto !important; height:auto !important; border-radius:0; border-left:none; border-right:none; border-bottom:none;}",
      "#dragonChatWindow.dragon-chat-min{bottom:0px !important; height:46px !important; min-height:46px; overflow:hidden;}",
      "#dragonChatWindow.dragon-chat-full .dragon-chat-resize{display:none;}",
      "#dragonChatWindow.dragon-feed-mini .tabbed-comments-plugin-outer-ctn{position:absolute !important; inset:0 !important; width:auto !important; max-width:none !important; height:100% !important; max-height:none !important;}",
      "#dragonChatWindow.dragon-feed-mini .dragon-chat-tools{display:none !important;}",
      "#dragonChatWindow .dragon-chat-head{display:flex; align-items:center; gap:.3rem; padding:.5rem .6rem; background:linear-gradient(180deg,#241a3a,#171022); border-bottom:1px solid #4a4a58; user-select:none; flex:0 0 auto;}",
      "#dragonChatWindow .dragon-chat-head.dragon-dragging{cursor:grabbing;}",
      "#dragonChatWindow .dragon-chat-title{flex:0 0 auto; font-weight:800; font-size:.86rem; color:#d8c9ff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; letter-spacing:.02em;}",
      "#dragonChatSettings{display:none!important;}",
      "#dragonChatWindow .dragon-chat-btn{width:30px; height:30px; flex:0 0 auto; display:flex; align-items:center; justify-content:center; border:1px solid #5b4a7d; background:linear-gradient(180deg,#2c2340,#1a1428); color:#d8c9ff; border-radius:9px; cursor:pointer; font-size:.95rem; line-height:1; transition:background .12s ease, transform .1s ease;}",
      "#dragonChatWindow .dragon-chat-btn:hover{background:linear-gradient(180deg,#3d3157,#241b39); color:#fff;}",
      "#dragonChatWindow .dragon-chat-btn:active{transform:none !important; filter:brightness(1.2);}",
      "#dragonChatWindow .dragon-chat-btn.dragon-chat-close{border-color:#7d3a48; background:linear-gradient(180deg,#4a2230,#2a1018); color:#ffb3c0;}",
      "#dragonChatWindow .dragon-chat-btn.dragon-chat-close:hover{background:linear-gradient(180deg,#6a2c3c,#3a1620);}",
      // Egon 15.09.2026 — overflow:auto → hidden: the outer (functionless) scrollbar is gone; the
      // comments iframe keeps its own internal scroll. Single scrollbar only.
      "#dragonChatWindow .dragon-chat-body{flex:1; min-height:0; overflow:hidden; position:relative; background:#0d0d12;}",
      "#dragonChatWindow .dragon-chat-body .comments-plugin-ctn,#dragonChatWindow .dragon-chat-body #commentsPluginCtn654732{height:100%;}",
      "#dragonChatWindow .dragon-chat-foot{display:none;}",
      "#dragonChatWindow .dragon-chat-resize{position:absolute; right:2px; bottom:2px; width:18px; height:18px; cursor:nwse-resize; opacity:.7; z-index:5; background:linear-gradient(135deg,transparent 45%,#9b6bff 45%,#9b6bff 55%,transparent 55%,transparent 70%,#9b6bff 70%,#9b6bff 80%,transparent 80%);}",
      "#dragonChatWindow.dragon-chat-min .dragon-chat-resize{display:none;}",
      /* inside the floating window the tabbed plugin should fill height */
      "#dragonChatWindow .tabbed-comments-plugin-outer-ctn{height:100% !important;}",
      "#dragonChatWindow .tabbed-comments-plugin-outer-ctn > div:first-child{height:100% !important;}",
      "#dragonChatWindow .tabbed-comments-plugin-ctn{height:100% !important; min-height:0 !important; max-height:100% !important;}",
      "#dragonChatWindow .tabbed-comments-ctn-left,#dragonChatWindow .tabbed-comments-ctn-right{display:none !important;}",
      "#dragonChatWindow .tabbed-comments-ctn-middle{flex:1 !important; min-width:0;}",
      "#dragonChatWindow .tabbed-comments-plugin-content{height:100% !important; min-height:0;}",
      "#dragonChatWindow .tabbed-comments-plugin-content iframe{height:100% !important; min-height:0;}",
      "#dragonChatWindow .tabbed-comments-show-auto-comment-area-btn{display:none !important;}",
      "#dragonChatWindow .tabbed-comments-auto-comment-ctn{display:none !important;}",
      /* Egon 11.09.2026 (v2) — tools (Say hi / emoji / image) are a VERTICAL column hugging the
         left edge of the comment input, and Submit sits on the RIGHT of the comment input.
         The comments-plugin renders its input inside a cross-origin iframe, so we reserve a
         left/right gutter in the iframe's container and float our controls inside those gutters. */
      /* Egon 16.09.2026 — SINGLE LINE: native ⚙️ comments-plugin gear is pushed to the right on the iframe's BOTTOM button row
         (settingsButtonStyle: margin-left:auto; margin-right:104px, main.pjs). Our [👋 😊 🖼️] overlay stays on the LEFT of the same row; ➤ Submit is on the far RIGHT. Therefore, the iframe uses full height (the old 54px bottom strip was removed) and
         our tools are overlaid on the remaining bottom-left corner of the iframe. */
      "#dragonChatWindow .tabbed-comments-plugin-content{height:100% !important;}",
      "#dragonChatWindow .dragon-chat-tools{position:absolute; left:8px; bottom:2px; z-index:8; display:flex; flex-direction:row; align-items:center; gap:.15rem; padding:0;}",
      "#dragonChatWindow .dragon-chat-tool{min-width:0; width:58px; height:44px; padding:0; display:inline-flex; align-items:center; justify-content:center; gap:.3rem; border:none; background:transparent; color:#d8c9ff; border-radius:10px; cursor:pointer; font-size:28px; line-height:1; box-shadow:none; transition:background .2s, color .2s;}",
      "#dragonChatWindow .dragon-chat-tool:hover{background:rgba(155,107,255,.18); color:#fff;}",
      // Egon 15.09.2026 — Submit: "Submit" word gone → round green ➤ (I59: never resizes).
      // Egon 15.09.2026 (v2) — Submit no longer OVERLAPS the comment box. Egon: a long comment "ended up
      // UNDER the submit button"; he wants the ➤ BESIDE the input, kissing its right edge. Native layout
      // (comments-plugin embed): #submitCtn = [textarea#inputEl (min-height 50px, inputAreaStyle margin 8px)]
      // ABOVE [#buttonsRowCtn, 44px tall]. The input is narrowed by inputAreaStyle (main.pjs:
      // width calc(100% - 60px)) so a 52px gutter stays free on the right; the ➤ sits in it:
      // right:8px (flush against the box's right edge → "kisses") + bottom:52px (its bottom edge aligns
      // with the input's bottom edge, which never moves because the input grows UPWARD).
      // Egon 15.09.2026: [307]'s vertical-centering was REVERTED on Egon's request (see changelog [308]) →
      // this is back to the [306] default: the ➤ hugs the box's BOTTOM edge.
      // Egon 19.09.2026 — the ➤ is no longer OUR overlay button: the plugin's native submit button is
      // styled to look and sit exactly like it (main.pjs submitButtonStyle per channel). The old rules
      // for `#dragonChatWindow .dragon-chat-submit` (44px round green, right:8px, bottom:52px) are now
      // the live values inside that main.pjs string.
      // Egon 15.09.2026 — non-clickable hint that points at the original comments-settings gear that renames
      // you. Text: "Click to ⚙️" / "change Username" as two nowrap lines. It is NOT a button (cursor:default,
      // no handler) so it can never "not work". Egon 15.09.2026 (v2) — the gear now lives at the RIGHT end of
      // the row, so the hint is no longer a gap-filler: chatUpdateNameHint() gives it its natural width
      // (78–110px) and a margin-left that GLUES its right edge to the gear's left edge (Egon: "shift the
      // change user name button to the right as well"), shrinking the font (never below 7px) so the two lines
      // never wrap or clip; it hides only when the window is too narrow to show it beside the tools.
      "#dragonChatWindow .dragon-chat-namehint{flex:0 0 auto; height:44px; box-sizing:border-box; display:inline-flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:2px 4px; border:1px solid #4a4166; background:rgba(155,107,255,.10); color:#cfc4ea; border-radius:10px; font-size:.58rem; line-height:1.16; font-weight:700; cursor:default; user-select:none; letter-spacing:.01em; overflow:hidden;}",
      "#dragonChatWindow .dragon-chat-namehint .l1,#dragonChatWindow .dragon-chat-namehint .l2{display:block; white-space:nowrap; line-height:1.16;}",
      "#dragonChatWindow .dragon-chat-namehint[hidden]{display:none !important;}",
      // Egon 15.09.2026 — on a NARROW chat window (phone, or a desktop window the user shrank) the three
      // [👋 😊 🖼️] tools slim down a little so the "Click to ⚙️ change Username" hint keeps a fully
      // readable width instead of clipping. The class is toggled by JS (chatUpdateNameHint) from the
      // window's real width, so it also kicks in when the window is resized on desktop.
      "#dragonChatWindow.dragon-chat-narrow .dragon-chat-tool{width:52px; font-size:25px;}",
      "#dragonChatWindow.dragon-chat-min .dragon-chat-tools{display:none;}",
      /* Egon 13.09.2026 — minimize flies the window to the LEFT edge (vertically centered), not the page bottom. */
      /* Egon 15.09.2026 — I59: the chat circle was jumping due to transform loss on :active → NO transform, center `calc(50% - 28px)`. */
      // Egon 15.09.2026 — the minimized chat circle now lives at the BOTTOM-LEFT on every screen size
      // (was left-middle on desktop), matching Egon's request.
      // Egon 15.09.2026 — the screen showing the shrunk chat circle is in the BOTTOM-LEFT corner and
      // KISSING the edges (8px inside). The minimize animation flies exactly here (chatMinimizeFly target is also 8px).
      "#dragonChatBubble{position:fixed; left:8px; bottom:8px; top:auto; z-index:2147483250; width:56px; height:56px; box-sizing:border-box; border-radius:50%; display:none; align-items:center; justify-content:center; border:1px solid #5b4a7d; background:linear-gradient(180deg,#3a2f57,#201830); color:#d8c9ff; font-size:1.5rem; cursor:pointer; box-shadow:0 10px 30px rgba(0,0,0,.55);}",
      "#dragonChatBubble.dragon-on{display:flex;}",
      // Egon 15.09.2026 — bubble is bottom-left everywhere now, so the mobile override is just a no-op safety net.
      "@media (max-width:600px){ #dragonChatBubble{top:auto !important; bottom:8px !important; transform:none !important;} }",
      "#dragonChatBubble:hover{filter:brightness(1.15);}",
      ".dragon-emoji-pop{position:fixed; z-index:2147483300; width:320px; max-height:280px; overflow:auto; padding:.5rem; border:1px solid #4a4a58; border-radius:14px; background:linear-gradient(180deg,#1a1a22,#0f0f14); box-shadow:0 14px 40px rgba(0,0,0,.6); display:grid; grid-template-columns:repeat(8,1fr); gap:.2rem;}",
      ".dragon-emoji-pop button{font-size:1.25rem; padding:.15rem; border:none; background:transparent; cursor:pointer; border-radius:8px; line-height:1.2;}",
      ".dragon-emoji-pop button:hover{background:rgba(155,107,255,.28);}",
      ".dragon-chat-imgpick{position:fixed; z-index:2147483300; width:min(560px,92vw); height:min(72vh,640px); overflow:hidden; display:flex; flex-direction:column; border:1px solid #4a4a58; border-radius:14px; background:linear-gradient(180deg,#1a1a22,#0f0f14); box-shadow:0 14px 40px rgba(0,0,0,.6);}",
      ".dragon-chat-imgpick .dragon-cip-head{display:flex; align-items:center; gap:.4rem; padding:.55rem .7rem; border-bottom:1px solid #3a3a48; font-weight:bold; color:#d8c9ff; cursor:move; touch-action:none;}",
      ".dragon-chat-imgpick .dragon-cip-tabs{display:flex; gap:.3rem; padding:.45rem .6rem;}",
      ".dragon-chat-imgpick .dragon-cip-tab{padding:.28rem .7rem; border:1px solid #4a4a58; border-radius:20px; background:#1b1b24; color:#cfd6e6; cursor:pointer; font-size:.76rem; font-weight:bold;}",
      ".dragon-chat-imgpick .dragon-cip-tab.dragon-cip-on{background:linear-gradient(180deg,#6a4fae,#3a2a66); color:#fff; border-color:#9b6bff;}",
      ".dragon-chat-imgpick .dragon-cip-grid{flex:1; min-height:0; overflow:auto; display:grid; grid-template-columns:repeat(auto-fill,minmax(104px,1fr)); grid-auto-rows:104px; gap:.5rem; padding:.6rem; align-content:start;}",
      ".dragon-chat-imgpick .dragon-cip-cell{position:relative; width:100%; height:104px; border-radius:9px; overflow:hidden; cursor:pointer; border:1px solid #33333d; background:#0d0d11;}",
      ".dragon-chat-imgpick .dragon-cip-cell img{width:100%; height:100%; object-fit:cover; display:block;}",
      ".dragon-chat-imgpick .dragon-cip-cell:hover{border-color:#9b6bff; box-shadow:0 0 0 2px rgba(155,107,255,.5);}",
      ".dragon-chat-imgpick .dragon-cip-warn{padding:.4rem .7rem; font-size:.72rem; color:#ffb3c0; background:rgba(180,40,60,.16); border-top:1px solid rgba(180,40,60,.4);}",
      // ---- Egon 15.09.2026 — NAVBAR CHAT BADGE (unread messages) ----
      "#dragonNavChatBtn{position:relative;}",
      ".dragon-chat-badge{position:absolute; top:-3px; right:calc(50% - 20px); min-width:16px; height:16px; padding:0 4px; box-sizing:border-box; border-radius:9px; background:linear-gradient(180deg,#ff4d5e,#c40f28); color:#fff; font-size:.58rem; font-weight:800; line-height:16px; text-align:center; border:1px solid #ffd0d6; box-shadow:0 0 8px rgba(255,60,80,.85); pointer-events:none; z-index:5;}",
      ".dragon-chat-badge[hidden]{display:none !important;}",
      "#dragonChatBubble .dragon-chat-badge{top:0; right:0; line-height:16px;}",
      // ---- Egon 15.09.2026 — tiny notification toggles inside the chat input row ----
      "#dragonChatWindow .dragon-chat-tool.dragon-chat-tool-slim{width:34px; font-size:19px;}",
      "#dragonChatWindow .dragon-chat-tool.dragon-chat-tool-off{color:#8a8a9c; filter:grayscale(.85);}",
      // Egon 15.09.2026 — notif/sound/translate toggles now live in the header, so they must match the
      // other header buttons (30x30, never resize per I59). Only the icon + this dim class change.
      "#dragonChatWindow .dragon-chat-head-togs{display:inline-flex; align-items:center; gap:.28rem; flex:0 0 auto; margin-left:auto;}",
      "#dragonChatWindow .dragon-chat-btn.dragon-chat-btn-off{opacity:.5; filter:grayscale(.9);}",
      // ---- Egon 15.09.2026 — username pill in the chat header ----
      // Egon 15.09.2026 — header shows "Username: <name>" and is NO LONGER clickable (Egon: "button is not working,
      // I didn't want this"). The rename hint now lives in the bottom row next to 🖼️.
      "#dragonChatWindow .dragon-chat-me{flex:0 1 auto; min-width:0; max-width:60%; display:inline-flex; align-items:baseline; gap:.25rem; padding:.12rem .45rem; border:1px solid #5b4a7d; border-radius:999px; background:rgba(155,107,255,.12); color:#d8c9ff; font-size:.62rem; font-weight:700; white-space:nowrap; overflow:hidden; cursor:default;}",
      "#dragonChatWindow .dragon-chat-me .lbl{flex:0 0 auto; opacity:.82; font-weight:600;}",
      "#dragonChatWindow .dragon-chat-me b{font-weight:800; color:#fff; min-width:0; overflow:hidden; text-overflow:ellipsis; flex:0 1 auto;}",
      "#dragonChatWindow .dragon-chat-me i{display:none;}",
      // Egon 15.09.2026 — on a narrow chat window (phone) the "(click ⚙️ to change name)" hint is dropped
      // so the 💬 Chat title doesn't collapse to zero width; the hint stays in the pill's title tooltip.
      "@media (max-width:460px){ #dragonChatWindow .dragon-chat-me i{display:none;} }",
      // ---- Egon 15.09.2026 — 🌐 TRANSLATE POPUP (per-message translate buttons) ----
      // Egon 15.09.2026 — the native feed rows live in a CROSS-ORIGIN iframe, so a 🌐 can't be injected
      // into each row. Instead this is now a COMPACT popup (Egon: "the window above is a bit of a long story")
      // anchored above the input row: message list + a 🌐 per incoming message, one tap each.
      // Egon 15.09.2026 — Egon: "a translation button to the left of every chat message; it should
      // translate the message in its own row and show it as a popup in the EXACT CENTER of the chat window." The list panel now
      // opens in the exact center of the window; 🌐 is on the far LEFT in every row; the translation itself appears in a separate
      // popup (.dragon-chat-xres) in the center. NOTE: since native feed rows are inside a cross-origin iframe, 🌐 CANNOT be injected
      // directly into feed rows — this panel is its exact equivalent.
      "#dragonChatWindow .dragon-chat-xlate{position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); width:min(360px,92%); height:min(74%,470px); z-index:13; display:flex; flex-direction:column; background:linear-gradient(180deg,#12121a,#0b0b10); border:1px solid #4a4a58; border-radius:14px; box-shadow:0 16px 44px rgba(0,0,0,.7); overflow:hidden;}",
      "#dragonChatWindow .dragon-chat-xlate[hidden]{display:none !important;}",
      "#dragonChatWindow .dragon-xlate-head{display:flex; align-items:center; gap:.4rem; padding:.5rem .6rem; border-bottom:1px solid #3a3a48; font-size:.76rem; font-weight:800; color:#d8c9ff;}",
      "#dragonChatWindow .dragon-xlate-head span.ch{flex:1; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-weight:600; font-size:.7rem; opacity:.85;}",
      "#dragonChatWindow .dragon-xlate-btn{width:26px; height:26px; flex:0 0 auto; border:1px solid #5b4a7d; border-radius:8px; background:linear-gradient(180deg,#2c2340,#1a1428); color:#d8c9ff; cursor:pointer; font-size:.8rem; line-height:1;}",
      "#dragonChatWindow .dragon-xlate-body{flex:1; min-height:0; overflow:auto; padding:.5rem .55rem; text-align:left;}",
      "#dragonChatWindow .dragon-xrow{display:flex; align-items:flex-start; gap:.4rem; padding:.32rem .1rem; border-bottom:1px solid rgba(255,255,255,.06);}",
      "#dragonChatWindow .dragon-xrow:last-child{border-bottom:none;}",
      // Egon 15.09.2026 — 🌐 button is on the far LEFT in every row (to the left of the message, single column from top to bottom).
      // In our own messages, an invisible spacer of the same width stands instead of the button so that the texts remain aligned.
      "#dragonChatWindow .dragon-xrow .who{flex:0 0 auto; width:6.2rem; font-size:.62rem; font-weight:800; color:#b9a6e6; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; padding-top:.15rem;}",
      "#dragonChatWindow .dragon-xrow .txt{flex:1 1 auto; min-width:0; font-size:.74rem; line-height:1.4; color:#e9e6f2; word-break:break-word; white-space:pre-wrap;}",
      "#dragonChatWindow .dragon-xrow .txt .tr{display:block; margin-top:.18rem; color:#8ef0b8;}",
      "#dragonChatWindow .dragon-xrow .txt .tr.err{color:#ffb3c0;}",
      "#dragonChatWindow .dragon-xrow .txb{flex:0 0 auto; width:30px; height:26px; border:1px solid #3f6b8a; border-radius:7px; background:linear-gradient(180deg,#16303f,#0d1c26); color:#9fd8ff; cursor:pointer; font-size:.8rem; line-height:1; padding:0;}",
      "#dragonChatWindow .dragon-xrow .txb:hover{filter:brightness(1.2);}",
      "#dragonChatWindow .dragon-xrow .txb:disabled{opacity:.5; cursor:default;}",
      "#dragonChatWindow .dragon-xrow .txb-sp{flex:0 0 auto; width:30px; height:26px;}",
      "#dragonChatWindow .dragon-xlate-empty{padding:1.2rem .8rem; text-align:center; font-size:.74rem; color:#9d9ab5;}",
      "#dragonChatWindow .dragon-chat-xlate .tx-miss{color:#9d9ab5; font-size:.68rem;}",
      // ---- Egon 15.09.2026 — 🌐 TRANSLATION RESULT POPUP (in the EXACT CENTER of the chat window) ----
      // When pressing a message's 🌐, the translation opens here as a card in the center of the window:
      // translation on top (green), faded "original text" below, Google Translate / Copy at the bottom.
      "#dragonChatWindow .dragon-chat-xres{position:absolute; inset:0; z-index:14; display:flex; align-items:center; justify-content:center; padding:1rem; background:rgba(8,8,12,.62);}",
      "#dragonChatWindow .dragon-chat-xres[hidden]{display:none !important;}",
      "#dragonChatWindow .dragon-xres-card{width:min(420px,95%); max-height:82%; display:flex; flex-direction:column; background:linear-gradient(180deg,#171722,#0d0d13); border:1px solid #4a4a58; border-radius:14px; box-shadow:0 18px 50px rgba(0,0,0,.72); overflow:hidden;}",
      "#dragonChatWindow .dragon-xres-head{display:flex; align-items:center; gap:.4rem; padding:.5rem .6rem; border-bottom:1px solid #3a3a48; font-size:.78rem; font-weight:800; color:#d8c9ff;}",
      "#dragonChatWindow .dragon-xres-head .sp{flex:1; min-width:0;}",
      "#dragonChatWindow .dragon-xres-head .who{min-width:0; max-width:45%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:.68rem; font-weight:700; color:#b9a6e6;}",
      "#dragonChatWindow .dragon-xres-body{flex:1; min-height:0; overflow:auto; padding:.65rem; text-align:left; font-size:.82rem; line-height:1.45; color:#e9e6f2;}",
      "#dragonChatWindow .dragon-xres-tr{color:#8ef0b8; white-space:pre-wrap; word-break:break-word;}",
      "#dragonChatWindow .dragon-xres-line{padding:.3rem 0; border-bottom:1px solid rgba(255,255,255,.07); white-space:pre-wrap; word-break:break-word;}",
      "#dragonChatWindow .dragon-xres-line:last-child{border-bottom:none;}",
      "#dragonChatWindow .dragon-xres-line b{color:#b9a6e6; font-size:.7rem;}",
      "#dragonChatWindow .dragon-xres-orig{margin-top:.55rem; padding-top:.45rem; border-top:1px dashed rgba(255,255,255,.16); font-size:.71rem; color:#9d9ab5; white-space:pre-wrap; word-break:break-word;}",
      "#dragonChatWindow .dragon-xres-foot{display:flex; gap:.4rem; justify-content:flex-end; padding:.5rem .6rem; border-top:1px solid #3a3a48;}",
      "#dragonChatWindow .dragon-xres-b{padding:.32rem .6rem; border:1px solid #3f6b8a; border-radius:8px; background:linear-gradient(180deg,#16303f,#0d1c26); color:#9fd8ff; cursor:pointer; font-size:.72rem; font-weight:700;}",
      "#dragonChatWindow .dragon-xres-b:hover{filter:brightness(1.15);}"
    ].join("");
    document.head.appendChild(css);
  }

  var PAGES = ["home", "generate", "character", "gallery", "history", "social", "likes", "account"];
  window.dragonPage = "home";

  // ---------- find popovers by their head text ----------
  ;function findPopByHead(txt) {
    var pops = document.querySelectorAll(".dragon-shortcut-pop");
    for (var i = 0; i < pops.length; i++) {
      var h = pops[i].querySelector(".dragon-pop-head");
      if (h && (h.textContent || "").indexOf(txt) !== -1) return pops[i];
    }
    return null;
  }

  // ---------- helper: move the live Options popover into Account ----------
  var accountPopMounted = false;
  ;function findOptionsPop() { return findPopByHead("Options"); }
  ;function recolorThemeButtons(pop) {
    if (!pop) return;
    var cur = document.documentElement.getAttribute("data-dragon-theme") || "default";
    var curScheme = (window.getCurrentColorScheme ? window.getCurrentColorScheme() : "dark");
    var btns = pop.querySelectorAll("[data-th]");
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i], t = b.dataset.th;
      // Egon 15.09.2026 — button colors are now separate PER THEME (Gold ≠ Happy, Neon = magenta,
      // Rainbow = actual rainbow). Old THEME_COLORS (neon green!) only remains as a backup.
      if (window.dragonThemeBtnCss) {
        var active = (t === "__dark") ? (curScheme === "dark")
                   : (t === "__light") ? (curScheme === "light")
                   : (cur === t);
        b.style.cssText = window.dragonThemeBtnCss(t, active);
        continue;
      }
      var m = THEME_COLORS[t] || THEME_COLORS["default"];
      if (t === "rainbow") {
        b.style.background = "linear-gradient(90deg,#ff4d4d,#ffb84d,#ffe94d,#4dff88,#4dd2ff,#b84dff)";
        b.style.color = "#111";
      } else {
        b.style.background = "linear-gradient(180deg," + m.c + "," + shade(m.c, -45) + ")";
        b.style.color = m.fg;
      }
      var active2 = (cur === t);
      b.style.border = "1px solid " + (active2 ? "#ffffff" : shade(m.c, 35));
      b.style.borderRadius = "12px";
      b.style.fontWeight = "bold";
      b.style.cursor = "pointer";
      b.style.boxShadow = active2 ? "0 0 0 2px rgba(255,255,255,.85) inset, 0 0 10px " + m.c : "none";
    }
  }
  // Egon 11.09.2026 — Account/Options card grid: wraps the scattered sections of the Options popover
  // (header + content) into individual "cards" and arranges them in a responsive grid. Thus, the Account page
  // fills with a proportional desktop layout from right to left, instead of a vertical mobile column.
  window.dragonAccountCardify = function (pop) {
    if (!pop || pop.__dragonCardified) return;
    var disp = null;
    [].slice.call(pop.children).forEach(function (c) { if (!disp || (c.children && c.children.length > disp.children.length)) disp = c; });
    if (!disp) return;
    pop.__dragonCardified = true;
    disp.__dragonCardified = true;
    ;function isClassHead(el) { return !!(el && el.classList && el.classList.contains("dragon-pop-head")); }
    ;function isStart(el) {
      if (!el || !el.classList) return false;
      if (isClassHead(el)) return true;
      if (el.querySelector && el.querySelector(".dragon-pop-head")) return true;
      return !!(el.classList && el.classList.contains("dragon-pedo-mini")) || /Pedo Shield/i.test(el.textContent || "");
    }
    var kids = [].slice.call(disp.children), cards = [], cur = null, prevMini = false;
    for (var i = 0; i < kids.length; i++) {
      var el = kids[i];
      if (el.style && el.style.display === "none") { prevMini = false; continue; }
      var isMini = !!(el.classList && el.classList.contains("dragon-pedo-mini")) || /Pedo Shield/i.test(el.textContent || "");
      // A class-head enters the same card only if it is preceded by a "mini-head" (Pedo Shield row);
      // otherwise, every header starts a NEW card (head-only sections do not merge).
      var merge = isClassHead(el) && prevMini;
      if (isStart(el) && !merge) { cur = document.createElement("div"); cur.className = "dragon-opt-card"; cards.push(cur); }
      else if (!cur) { cur = document.createElement("div"); cur.className = "dragon-opt-card"; cards.push(cur); }
      cur.appendChild(el);
      prevMini = isMini;
    }
    // NOTE: appendChild automatically removes elements from disp; therefore, whichever element is moved to a card
    // drops from disp. Skipped hidden (display:none) sections remain in disp → NOT DELETED.
    disp.style.cssText = "margin-top:.4rem; display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:.55rem; align-items:stretch;";
    disp.className = (disp.className ? disp.className + " " : "") + "dragon-acc-grid";
    // Egon 13.09.2026 — hide empty "black area" cards (e.g., moved rpRow) and make Screen Saver /
    // Load Speed cards plain (without background) so only the button is visible.
    cards = cards.filter(function (c) {
      if (c.querySelector(".dragon-ss-cycle, .dragon-living-btn")) return true;
      return !!(c.textContent || "").trim() || !!c.querySelector("img,canvas,input,button,select");
    });
    cards.forEach(function (c) {
      if (c.querySelector(".dragon-ss-cycle, .dragon-living-btn")) c.classList.add("dragon-opt-card-bare");
    });
    cards.forEach(function (c) { disp.appendChild(c); });
  };
  // Egon 13.09.2026 — clean up Account/Options layout: wraps the scattered quick-button row
  // at the top into a card, moves it to the card grid, and gives the cards a meaningful order.
  window.dragonAccountTidy = function (pop) {
    if (!pop || pop.__dragonTidied) return;
    var grid = pop.querySelector(".dragon-acc-grid");
    if (!grid) return;
    pop.__dragonTidied = true;
    try {
      var tool = pop.querySelector(".dragon-shortcut-tool");
      var toolRow = tool ? tool.parentElement : null;
      if (toolRow && toolRow.parentElement !== grid && toolRow !== grid) {
        var card = document.createElement("div");
        card.className = "dragon-opt-card dragon-acc-quick";
        var head = document.createElement("div");
        head.className = "dragon-pop-head";
        head.textContent = "⚡ Quick Options";
        card.appendChild(head);
        toolRow.parentElement.insertBefore(card, toolRow);
        card.appendChild(toolRow);
        card.style.order = "0";
        grid.insertBefore(card, grid.firstChild);
      }
      // order: quick → appearance → theme
      var orderMap = [
        ["Screen Saver", "1"], ["Home Page", "2"], ["Star Save", "3"],
        ["Already-Saved", "4"], ["Generator Themes", "5"]
      ];
      [].slice.call(grid.querySelectorAll(":scope > .dragon-opt-card")).forEach(function (c) {
        if (c.classList.contains("dragon-acc-quick")) return;
        var h = c.querySelector(".dragon-pop-head");
        var t = h ? (h.textContent || "") : (c.textContent || "");
        for (var i = 0; i < orderMap.length; i++) {
          if (t.indexOf(orderMap[i][0]) !== -1) { c.style.order = orderMap[i][1]; return; }
        }
      });
    } catch (e) {}
  };
  // Egon 13.09.2026 — Account/Options FINAL LAYOUT (Egon request list):
  //   1. row = action buttons (Dupes / Export Zip / Feedback / Fullscreen / Stats)
  //   2nd row  = green "living" buttons (Mini Thumbnails / Screen Saver /
  //               Gallery image load speed / Heart Style / Home Page / Already-Saved Star + child button)
  //   3rd row  = everything else, with their own subheadings (Star Save / Generator Themes / Cloud Sync / Tools)
  //   "⚡ Quick Options" TEXT IS DELETED, the dark background block REMAINS; rows are centered.
  window.dragonAccountLayout = function (pop) {
    if (!pop || pop.__dragonLaidOut) return;
    var quick = pop.querySelector(".dragon-acc-quick");
    if (!quick) return;
    pop.__dragonLaidOut = true;
    ;function tool(t) { return pop.querySelector(".dragon-shortcut-tool[data-tool='" + t + "']"); }
    ;function living(needle) {
      var all = pop.querySelectorAll(".dragon-living-btn");
      for (var i = 0; i < all.length; i++) { if ((all[i].textContent || "").toLowerCase().indexOf(needle.toLowerCase()) !== -1) return all[i]; }
      return null;
    }
    ;function optByText(needle) {
      var all = pop.querySelectorAll(".dragon-optbtn");
      for (var i = 0; i < all.length; i++) { if ((all[i].textContent || "").toLowerCase().indexOf(needle.toLowerCase()) !== -1) return all[i]; }
      return null;
    }
    // ---- 1st row ----
    var row1 = document.createElement("div");
    row1.className = "dragon-opt-row dragon-opt-row1";
    ["export", "feedback", "fullscreen", "stats"].forEach(function (t) { var b = tool(t); if (b) row1.appendChild(b); });
    // ---- 2nd row ----
    var row2 = document.createElement("div");
    row2.className = "dragon-opt-row dragon-opt-row2";
    [living("Mini Thumbnails"), pop.querySelector(".dragon-ss-cycle"), living("Gallery image load speed"), optByText("Heart Style"), living("Home Page")].forEach(function (b) {
      if (b && b.parentNode) row2.appendChild(b);
    });
    // Egon 15.09.2026 (v2) — ⭐ Already-Saved Star button + SEPARATE ROUND preview button must stay ADJACENT.
    // In the previous version, the preview button remained elsewhere inside the pop-up (user: "you put it way too far away").
    // Now both are in a single tight wrapper, with only 2px between them; preview is a CIRCLE as shown in the image.
    var astarBtn = living("Already-Saved");
    var astarPrev = pop.querySelector(".dragon-star-preview") || document.querySelector(".dragon-star-preview");
    if (astarBtn) {
      var astarWrap = document.createElement("span");
      astarWrap.className = "dragon-astar-wrap";
      astarWrap.style.cssText = "display:inline-flex; align-items:center; gap:2px;";
      if (astarPrev && astarPrev.parentNode) astarPrev.parentNode.removeChild(astarPrev);
      astarWrap.appendChild(astarBtn);
      if (astarPrev) astarWrap.appendChild(astarPrev);
      row2.appendChild(astarWrap);
    }
    [].slice.call(row2.querySelectorAll(".dragon-living-btn")).forEach(function (b) {
      if (/already-saved/i.test(b.textContent || "")) b.__dragonSplitDone = true;
    });
    // "⚡ Quick Options" text is DELETED; dark background remains.
    var qh = quick.querySelector(".dragon-pop-head");
    if (qh) qh.remove();
    var inner = document.createElement("div");
    inner.className = "dragon-opt-quickinner";
    inner.appendChild(row1);
    inner.appendChild(row2);
    quick.appendChild(inner);
    quick.style.order = "-1";
    quick.style.gridColumn = "1 / -1";
    // ---- 3rd row: remaining tool buttons in a single card ----
    var leftovers = [];
    [tool("comments"), tool("dark")].forEach(function (b) { if (b) leftovers.push(b); });
    [optByText("Keyboard Shortcuts"), optByText("Character Panel Version"), optByText("Comment Settings")].forEach(function (b) { if (b) leftovers.push(b); });
    var grid = pop.querySelector(".dragon-acc-grid");
    if (leftovers.length && !pop.querySelector(".dragon-opt-tools-card")) {
      var tcard = document.createElement("div");
      tcard.className = "dragon-opt-card dragon-opt-tools-card";
      tcard.style.order = "9";
      var th = document.createElement("div"); th.className = "dragon-pop-head"; th.textContent = "\uD83E\uDDF0 Tools & Shortcuts";
      var tr = document.createElement("div"); tr.className = "dragon-opt-row dragon-opt-tools-row";
      leftovers.forEach(function (b) { tr.appendChild(b); });
      tcard.appendChild(th); tcard.appendChild(tr);
      var sc = pop.querySelector(".dragon-account-shortcuts");
      if (sc) tcard.appendChild(sc);
      (grid || pop).appendChild(tcard);
    }
    // clear empty headings/cards
    var grid2 = pop.querySelector(".dragon-acc-grid") || pop;
    [].slice.call(grid2.children).forEach(function (c) {
      if (c === quick) return;
      var cls = c.classList || {};
      var hasCtl = c.querySelector && c.querySelector("button, input, select, canvas, img");
      var anyText = (c.textContent || "").trim();
      if (cls.contains && cls.contains("dragon-opt-card-bare") && !hasCtl) { c.remove(); return; }
      if (cls.contains && cls.contains("dragon-pedo-mini")) { c.remove(); return; }
      if (cls.contains && cls.contains("dragon-pop-head") && !anyText) { c.remove(); return; }
      if (cls.contains && cls.contains("dragon-opt-card") && !hasCtl && !anyText) c.remove();
    });
  };
  (function () {
    if (document.getElementById("dragonAccountLayoutCss")) return;
    var st = document.createElement("style");
    st.id = "dragonAccountLayoutCss";
    st.textContent =
      // Egon 11.09.2026 (v2) — safety note top-center; the remaining single column below (Options & Settings)
      // uses full width (left core column was already empty → single column is more balanced).
      ".dragon-account-shell{grid-template-columns:1fr !important;}" +
      // Egon 11.09.2026 (v2) — Options cards/sections + buttons inside are compatible with the site's purple theme.
      ".dragon-opt-card{padding:.6rem .65rem; border:1px solid rgba(155,107,255,.28); border-radius:12px; background:linear-gradient(180deg,#181820,#101015); min-width:0; box-shadow:0 4px 14px rgba(0,0,0,.35);}" +
      ".dragon-acc-grid{justify-content:center;}" +
      ".dragon-opt-card.dragon-acc-quick{grid-column:1/-1; padding:.55rem .7rem;}" +
      ".dragon-acc-quick > .dragon-pop-head{margin:.05rem 0 .4rem !important; font-size:.95rem !important;}" +
      ".dragon-acc-quick .dragon-shortcut-tool{flex:0 0 auto;}" +
      // Egon 13.09.2026 — Screen Saver / Load Speed cards: no black background or border, just the button.
      ".dragon-opt-card.dragon-opt-card-bare{padding:0 !important; border:0 !important; background:transparent !important; box-shadow:none !important;}" +
      ".dragon-opt-card > .dragon-pop-head:first-child{margin-top:0 !important; color:#b79bff !important;}" +
      ".dragon-account-optwrap{overflow:visible !important;}" +
      ".dragon-account-optwrap .dragon-shortcut-tool{border:1px solid rgba(155,107,255,.5) !important; background:linear-gradient(145deg,#2a2a36,#15151c) !important; color:#d8c9ff !important; border-radius:8px !important;}" +
      ".dragon-account-optwrap .dragon-shortcut-tool:hover{background:linear-gradient(145deg,#3a3a4a,#20202b) !important; color:#fff !important;}" +
      ".dragon-account-optwrap .dragon-pop-head{color:#b79bff !important;}" +
      // Egon 13.09.2026 — 1st/2nd row (centered inside dark block) + 3rd row tool card styles.
      ".dragon-opt-quickinner{display:flex;flex-direction:column;gap:.5rem;align-items:center;margin-top:.1rem;}" +
      ".dragon-opt-row{display:flex;flex-wrap:wrap;gap:.4rem;justify-content:center;align-items:center;width:100%;}" +
      ".dragon-opt-row1{gap:.5rem;}" +
      ".dragon-opt-tools-card{grid-column:1/-1;}" +
      ".dragon-opt-tools-row{justify-content:center;}" +
      ".dragon-split{display:inline-flex;align-items:stretch;}" +
      ".dragon-split>.dragon-living-btn{border-top-right-radius:0 !important;border-bottom-right-radius:0 !important;}" +
      ".dragon-split-child{padding:0 .42rem;border:1px solid #7a7a8c;border-left:0;border-top-right-radius:8px;border-bottom-right-radius:8px;background:linear-gradient(180deg,#1a1a20,#3a3a44);color:#ddd;font-weight:bold;cursor:pointer;}" +
      ".dragon-split-child:hover{background:linear-gradient(180deg,#3a3a4a,#20202b);color:#fff;}" +
      // ===== Egon 15.09.2026 — OPTIONS & SETTINGS new layout (Sound panel + group by type) =====
      // Egon 14.09.2026 — DESKTOP LAYOUT: board is centered + width is limited (so cards don't
      // spread across the screen and look "scattered").
      // Egon 08.10.2026 — the title-to-buttons gap matches the Social page exactly: the head keeps
      // its .35rem bottom margin and the board adds nothing on top (was .55rem), while the tab strip
      // carries .65rem below it — the same strip-to-body gap as the Social tab strip.
      ".dragon-set-board{margin-top:0; display:flex; flex-direction:column; gap:0; width:100%; max-width:1080px; margin-left:auto; margin-right:auto; box-sizing:border-box;}" +
      // Egon 08.10.2026 — the Settings overlay scrolls in the same 8px gutter as the Social page body,
      // so both centered boxes sit at exactly the same left/right distance (was shifted ~4px by the
      // overlay's wider default scrollbar).
      ".dragon-account-page{scrollbar-width:thin;}" +
      ".dragon-account-page::-webkit-scrollbar{width:8px;}" +
      ".dragon-account-page::-webkit-scrollbar-thumb{background:rgba(155,107,255,.4);border-radius:4px;}" +
      ".dragon-account-page::-webkit-scrollbar-track{background:transparent;}" +
      ".dragon-set-h{font-size:.92rem; font-weight:800; letter-spacing:.05em; color:#c3a8ff; margin:0 0 .55rem; text-align:center; text-transform:uppercase;}" +
      ".dragon-set-sound{max-width:560px; margin:0 auto; width:100%; box-sizing:border-box; padding:.55rem .7rem .6rem; border:1px solid rgba(155,107,255,.5); border-radius:14px; background:radial-gradient(130% 150% at 50% 0%, rgba(155,107,255,.2), transparent 62%), linear-gradient(180deg,#1a1a23,#101015); box-shadow:0 8px 22px rgba(0,0,0,.45), 0 0 0 1px rgba(155,107,255,.12) inset; text-align:center;}" +
      ".dragon-set-sound .dragon-set-h{text-align:center; font-size:.92rem; margin-bottom:.35rem; color:#d8c9ff;}" +
      ".dragon-set-soundbody{display:flex; flex-direction:column; align-items:center; gap:.25rem;}" +
      ".dragon-set-sound .dragon-vol-btn{font-size:.68rem !important; padding:.14rem .38rem !important;}" +
      ".dragon-set-sound #dragonSoundSliderWrap{margin-top:.25rem !important; padding:.18rem 0 !important;}" +
      // Egon 14.09.2026 — DESKTOP LAYOUT FIX: FIXED column count (1 → 2 → 3) instead of auto-fit and
      // align-items:stretch → cards in the same row are EQUAL size/aligned; cards don't swell based on content.
      ".dragon-set-groups{display:grid; grid-template-columns:1fr; gap:.7rem; align-items:stretch;}" +
      ".dragon-set-card{min-width:0; height:100%; box-sizing:border-box; display:flex; flex-direction:column; padding:.75rem .8rem .85rem; border:1px solid rgba(155,107,255,.3); border-radius:14px; background:linear-gradient(180deg,#181820,#101015); box-shadow:0 6px 18px rgba(0,0,0,.38); text-align:center;}" +
      ".dragon-set-wide{grid-column:1/-1;}" +
      ".dragon-set-span2{grid-column:span 2;}" +
      ".dragon-set-body{display:block; flex:1 1 auto; width:100%; line-height:1.95; text-align:center;}" +
      ".dragon-set-body > button{margin:0 .3rem .32rem 0; vertical-align:middle;}" +
      ".dragon-set-body > .dragon-pop-head{margin:.15rem 0 .35rem;}" +
      // Egon 15.09.2026 — every row is centered; Data & Saves content was shrunk to fit the card.
      ".dragon-set-row{display:flex; flex-wrap:wrap; gap:.35rem; justify-content:center; align-items:center; margin-bottom:.36rem;}" +
      ".dragon-set-about{display:flex; justify-content:center; width:100%; margin-top:.15rem;}" +
      ".dragon-set-about .dragon-set-card{max-width:440px; width:100%;}" +
      // 18.09.2026 — 🌐 Visitors panel (Settings, directly above About): compact flag + count chips, A→Z (English).
      // Flags are real IMAGES (flagcdn) because Windows renders regional-indicator emoji as plain letters.
      // NOTE: the popover carries `.dragon-shortcut-pop *{font-size:12.8px !important}`, so every size here
      // is scoped through .dragon-set-card and marked !important to win on specificity.
      ".dragon-visitors-list{display:flex; flex-wrap:wrap; gap:.34rem .4rem; align-items:center; justify-content:center; max-width:100%;}" +
      ".dragon-visitors-chip{display:inline-flex; align-items:center; gap:2px; padding:1px 8px 2px; border-radius:999px; border:1px solid rgba(155,107,255,.30); background:linear-gradient(180deg,rgba(155,107,255,.13),rgba(155,107,255,.04)); line-height:1.25; white-space:nowrap;}" +
      ".dragon-set-card .dragon-visitors-flag{font-size:1.02rem !important; line-height:1; display:inline-block;}" +
      ".dragon-set-card img.dragon-visitors-flag-img{width:20px !important; height:14px !important; border-radius:2px; object-fit:cover; display:inline-block; vertical-align:-2px; box-shadow:0 0 0 1px rgba(0,0,0,.4);}" +
      ".dragon-set-card .dragon-visitors-count{font-size:.86rem !important; font-weight:800 !important; color:#cdbcff;}" +
      ".dragon-visitors-unknown{opacity:.52; border-style:dashed;}" +
      // 📱💻 W-UX271 — the pinned mobile/desktop pair: same chip family as the flags; the symbol is a plain
      // emoji (the parked line-art SVG pair is NOT restored verbatim — Egon asked for a new symbol).
      ".dragon-visitors-devices{display:inline-flex; flex-wrap:wrap; align-items:center; gap:.34rem .4rem;}" +
      ".dragon-set-card .dragon-visitors-devicon-box{display:inline-block; line-height:0;}" +
      ".dragon-set-card .dragon-visitors-devicon{font-size:.94rem !important; line-height:1; display:inline-block; vertical-align:-1px;}" +
      ".dragon-set-card .dragon-visitors-empty{font-size:.78rem !important; color:#8f86a8; text-align:center; padding:.4rem 0;}" +
      // ⚖️ Egon 23.09.2026 — the per-class size overrides that used to live here (`.dragon-optbtn`,
      // `.dragon-living-btn`, `.dragon-set-stdbtn`, `.dragon-set-themebtn`, `.dragon-shortcut-tool`)
      // are GONE: ONE standard block below (second style sheet, searched by "SETTINGS CARD BUTTON
      // STANDARD") now sizes and colours every button of every Settings card, so the page can no longer
      // drift. The retired rules are parked in the internal library (Librarybook DEPO).
      // Egon 12.09.2026 — the old grey `.dragon-set-stdbtn` design and the 20.09.2026 purple
      // `.dragon-set-themebtn` override were BOTH SUPERSEDED on 23.09.2026 by the single "SETTINGS CARD
      // BUTTON STANDARD" block in the second style sheet below (one spec for one page). The retired
      // declarations are parked in the internal library (Librarybook DEPO) and nothing on the page
      // targets those two classes any more.
      // Egon 12.09.2026 — Rate emojis should fit their boxes perfectly: override the popover's 12.8px !important rule,
      // scale emoji to fill the button.
      ".dragon-shortcut-pop .dragon-about-rate button{font-size:2.6rem !important; line-height:1 !important; padding:0 !important;}" +
      ".dragon-set-card select{max-width:100% !important;}" +
      // Gallery #N color: button background ALWAYS shows active color (overrides theme !important).
      ".dragon-shortcut-pop .dragon-shortcut-tool.dragon-galnum-btn," +
      "html[data-dragon-theme] .dragon-shortcut-pop .dragon-shortcut-tool.dragon-galnum-btn{" +
      "background:var(--dragon-gal-num-c,#7cc4ff) !important; border:1px solid #ffffff !important; color:#101014 !important;" +
      "text-shadow:none !important; box-shadow:0 0 0 2px rgba(255,255,255,.35) !important; font-weight:800 !important;}" +
      // Egon 14.09.2026 — desktop progressive columns (mobile single column is kept EXACTLY as is).
      // Egon 12.09.2026 — first 3 panels equal size: sub-grid + grid-auto-rows:1fr.
      ".dragon-set-first3{grid-column:1/-1; display:grid; gap:.7rem; grid-template-columns:1fr; grid-auto-rows:1fr; align-items:stretch;}" +
      "@media (min-width:680px){ .dragon-set-groups{grid-template-columns:repeat(2,minmax(0,1fr));} .dragon-set-first3{grid-template-columns:repeat(2,minmax(0,1fr));} }" +
      "@media (min-width:1040px){ .dragon-set-groups{grid-template-columns:repeat(3,minmax(0,1fr));} .dragon-set-first3{grid-template-columns:repeat(3,minmax(0,1fr));} }" +
      // Egon 12.09.2026 — 🎨 Generator Themes card: on desktop it sits in the CENTER column,
      // directly below the "🖼 Image — Looks & Display" card (same column, next grid row).
      ".dragon-set-stack3{display:flex; flex-direction:column; gap:.7rem; min-width:0; align-self:start;}" +
      ".dragon-set-stack3 > .dragon-set-card{height:auto;}" +
      // ⚖️ Egon 23.09.2026 — ON A PHONE the three panels (🧰 Tools & Extras · 🖼 UI & Display · 💾 Data &
      // Saves) must NOT share one height: `grid-auto-rows:1fr` forced every row to the tallest panel, which
      // is exactly the empty space Egon saw on mobile. One column = every panel ends at its own last button.
      // (On a desktop they sit side by side, so there the shared bottom edge is kept — measured in JS by
      // window.dragonLevelSettingsCards.)
      "@media (max-width:679px){ .dragon-set-first3{grid-auto-rows:auto;} .dragon-set-first3 .dragon-set-card{height:auto !important;} }" +
      // Egon 12.09.2026 — mobile: Save / PURGE / Load always stack (one per row); other panel
      // buttons keep natural wrapping (2 per row when they fit, 1 when they don't).
      "@media (max-width:680px){ #dragonPrivacyRow{flex-direction:column !important; align-items:stretch !important;} #dragonPrivacyRow > button{width:100% !important;} }" +
      ".dragon-set-card .dragon-privacy-note{margin-top:-.35rem !important; padding-top:.4rem !important; padding-bottom:.5rem !important;}" +
      "#dragonPrivacyRow{margin-top:-.1rem !important;}" +
      "@media (max-width:760px){ .dragon-set-span2{grid-column:1/-1;} }" +
      "@media (max-width:560px){ .dragon-set-groups{grid-template-columns:1fr;} .dragon-set-sound{padding:.7rem .7rem .9rem;} }" +
      ".dragon-set-toprow{display:flex; gap:.7rem; align-items:stretch; width:100%; box-sizing:border-box;}" +
      ".dragon-set-toprow > *{flex:1 1 0; min-width:0;}" +
      ".dragon-set-toprow > .dragon-set-sound{max-width:none; margin:0;}" +
      ".dragon-set-toprow > .dragon-set-card{height:auto;}" +
      ".dragon-set-toprow > .dragon-set-card .dragon-set-body{display:flex !important; flex-direction:column; justify-content:center; align-items:center;}" +
      "@media (max-width:560px){ .dragon-set-toprow{flex-direction:column;} }" +
      // Egon 08.10.2026 — SETTINGS TABS: one section at a time, so a phone no longer scrolls the whole
      // board. The strip copies the Social tab look; panes are plain. Tab buttons are NOT in cards, so the
      // 34px Settings button standard never applies to them.
      ".dragon-set-tabs{display:flex;flex-wrap:wrap;gap:0;margin-bottom:.625rem;border:1px solid rgba(155,107,255,.3);border-radius:12px;overflow:hidden;background:linear-gradient(180deg,#1a1a20,#101015);}" +
      ".dragon-set-tab{flex:1 1 auto;display:flex;align-items:center;justify-content:center;gap:.3rem;min-height:2.6rem;padding:.45rem .5rem;border:0;border-left:1px solid rgba(155,107,255,.22);background:transparent;color:#c3cbdd;font-size:.78rem;font-weight:700;cursor:pointer;white-space:nowrap;}" +
      ".dragon-set-tab:first-child{border-left:0;}" +
      ".dragon-set-tab[aria-selected='true']{background:linear-gradient(180deg,#5b34c0,#2a1650);color:#efe7ff;}" +
      ".dragon-set-pane{display:none;}" +
      ".dragon-set-pane.on{display:block;}" +
      ".dragon-set-pane .dragon-set-card{height:auto;}" +
      ".dragon-set-pane > .dragon-set-card + .dragon-set-card{margin-top:.7rem;}" +
      // ⚖️ SETTINGS CARD BUTTON STANDARD — Egon 23.09.2026: "what did you do to the settings buttons, they've become huge
      // they've become??? make them normal like before... for these settings buttons (except for the about part),
      // define a standard (same font, either fixed long button width and height, fixed short button width and
      // height, and font type; color can be white if it's not a special button. for example purge, gallery
      // numbers, load speed, background special button.)
      //   • SIZE   — every button of every Settings card is EXACTLY 34px tall. LONG buttons take the whole
      //              row (100%), SHORT buttons take half a row (calc(50% - .18rem)); the two widths are
      //              assigned by the card builders (packCardButtons / stdColBtn) and never resize.
      //   • FONT   — inherit / .72rem / weight 700 / letter-spacing .01em / ONE line (never wrapped).
      //   • COLOUR — white text on the purple theme gradient for every NORMAL button.
      //   • SPECIAL buttons keep their own colours: 🗑️ PURGE ALL DATA (#dragonPrivPurgeBtn), 🔢 Gallery
      //     Image Numbers (.dragon-galnum-btn / .dragon-galnumvis-btn), ⚡ Gallery image load speed,
      //     🖼️ Background, 🪄 Auto and the ✅ star preview — they carry `.dragon-set-special`.
      //   • 📦 About (`.dragon-set-aboutcard`) is EXCLUDED and keeps exactly the look it had, including
      //     the 2.6rem rating faces.
      // The board can live inside the account page or inside the options popover, so the hook is a doubled
      // class: a stable, high-specificity selector that wins wherever the board is hosted.
      "html .dragon-set-board.dragon-set-board .dragon-set-card:not(.dragon-set-aboutcard) button:not([hidden]){" +
        "height:34px !important; min-height:34px !important; max-height:34px !important; box-sizing:border-box !important;" +
        "font-family:inherit !important; font-size:.72rem !important; font-weight:700 !important; letter-spacing:.01em !important;" +
        "line-height:32px !important; padding:0 .55rem !important; border-radius:9px !important; margin:0 !important;" +
        "text-shadow:none !important; white-space:nowrap !important; overflow:hidden !important; text-overflow:ellipsis !important;" +
        "text-align:center !important; display:inline-block !important; vertical-align:middle !important;}" +
      // ⚖️ Egon 23.09.2026 — the Visitor-Stats period chips (`.dragon-set-stdbtn`) used to be EXCLUDED from
      // this colour rule so they could "keep their own colours"; those colours were retired with the old
      // grey design, so the chips fell back to the browser's faded grey. They are no longer excluded: they
      // now wear the SAME standard purple as every other Settings button, and the SELECTED period stays
      // readable because its inline gold border/text (`setActive`) is applied with !important and wins.
      "html .dragon-set-board.dragon-set-board .dragon-set-card:not(.dragon-set-aboutcard) button:not(.dragon-set-special):not(.dragon-galnum-btn):not(.dragon-galnumvis-btn):not(.dragon-star-preview):not(#dragonPrivPurgeBtn){" +
        "color:#ffffff !important; border:1px solid #9b6bff !important; background:linear-gradient(180deg,#2a1a4a,#1a102e) !important; box-shadow:none !important;}" +
      "html .dragon-set-board.dragon-set-board .dragon-set-card:not(.dragon-set-aboutcard) button:not(.dragon-set-special):not(.dragon-galnum-btn):not(.dragon-galnumvis-btn):not(.dragon-star-preview):not(#dragonPrivPurgeBtn):hover{" +
        "background:linear-gradient(180deg,#3a2666,#241640) !important; color:#ffffff !important;}" +
      "html .dragon-set-board.dragon-set-board .dragon-set-card:not(.dragon-set-aboutcard) button[data-on='1']{border-color:#57d97a !important;}" +
      "html .dragon-set-board.dragon-set-board .dragon-set-card:not(.dragon-set-aboutcard) select{height:34px !important; box-sizing:border-box !important; font-size:.72rem !important;}" +
      // A long SPECIAL label (e.g. "⚡ Gallery image load speed: 🔰 Balanced") may WRAP inside its 34px line
      // instead of being cut off with an ellipsis — the height keeps the row rhythm either way.
      "html .dragon-set-board.dragon-set-board .dragon-set-card:not(.dragon-set-aboutcard) button.dragon-set-special{" +
        "display:inline-flex !important; align-items:center !important; justify-content:center !important;" +
        "white-space:normal !important; line-height:1.1 !important; text-overflow:clip !important; overflow-wrap:anywhere !important;}" +
      // ⚖️ Egon 23.09.2026 — the ✅ star preview is an EXCEPTION to the standard and keeps the look it
      // always had: a perfect CIRCLE, 34x34, with no side padding (its glyph would be cropped otherwise).
      "html .dragon-set-board.dragon-set-board .dragon-set-card:not(.dragon-set-aboutcard) button.dragon-star-preview{padding:0 !important; border-radius:50% !important; width:34px !important; min-width:34px !important; max-width:34px !important; flex:0 0 34px !important;}" +
      // the card rows no longer STRETCH: a tall card must not inflate its buttons (that was the "kocaman" bug)
      "html .dragon-set-board.dragon-set-board .dragon-set-body{align-content:flex-start !important;}" +
      // 📦 About keeps the look it had (its buttons were never part of the standard)
      "html .dragon-set-board.dragon-set-board .dragon-set-aboutcard button{font-size:.8rem !important;}" +
      "html .dragon-set-board.dragon-set-board .dragon-about-rate button{font-size:2.6rem !important; line-height:1 !important; padding:0 !important;}";
    document.head.appendChild(st);
  })();
  // ===================== Egon 15.09.2026 — OPTIONS & SETTINGS: clean layout from scratch =====================
  // PREVIOUS state: Options popover was embedded into Account as is, and the scattered sections inside
  // were haphazardly grouped with cardify/tidy/layout → overlapping, unreadable layout.
  // NOW: ALL controls (including live buttons, WITHOUT CLONING) are moved to a single "board":
  //   • At the VERY TOP center, a visible 🔊 Sound panel,
  //   • cards grouped by their own type underneath.
  // Old wrappers are NOT DELETED — only hidden (STORAGE).
  // ===== 🗄️ BESTAIGEN STORAGE REGISTRY (W-DATA299 / package G) =====
  // The purge is the ONE destructive control in the app. It used to be a blanket localStorage.clear() +
  // sessionStorage.clear() + indexedDB.deleteDatabase(EVERY database) + caches.delete(EVERY cache) + delete
  // EVERY cookie on this origin - which also destroyed keys that belong to OTHER software on this origin:
  // the t2i framework's local-media-gallery index (localMediaGallery_.*), the platform's own UI flags
  // (autoShowSocialsNextTime), the comments plugin's private self-id / reply-ding keys. Measured inventory
  // of the whole codebase (25.09.2026, W-DATA299): we write dragon* keys (65 patterns across 48 files), two
  // non-dragon keys of our own, TWO sessionStorage keys, ONE IndexedDB database, and no cache entry or
  // cookie of our own at all. So the purge now works from THIS registry and touches nothing else.
  // RULE (package G): a new BESTAIGEN key must be registered here in the same change that creates it,
  // otherwise it survives a purge. A foreign key is never deleted, and the dialog says so out loud.
  var DRAGON_STORE_REGISTRY = {
    exact: ["forceColorScheme", "__tabbedCommentsPluginCustomChannels"],
    prefixes: ["dragon", "explorerSubs_"],
    // The t2i framework remembers the visitor's own prompt inputs under "rememberedInput_<hash>_<field>".
    // The hash is the framework's own input-set id (NOT our publicId), so ownership rests on the ORIGIN being
    // generator-private: each generator runs in its own subdomain (window.generatorPublicId), and a measured
    // sweep of this origin found every rememberedInput_ key to belong to this generator. They are purged with
    // the rest - "delete my data" has to mean the form the user filled in comes back empty.
    scoped: ["rememberedInput_"],
    sessionPrefixes: ["dragon"],
    idb: ["dragonHistDB"],
    caches: []
  };
  // Deliberately NOT in the registry (the measured foreign names): the framework's local-media-gallery
  // index (localMediaGallery_.names / .activeGalleryName / .seenPersistenceWarning), the comments plugin's
  // own view keys (__tabbedCommentsPluginLastViewedChannel ...), the platform's flags (antiBotKey, ssW,
  // fresh, generateClickCount, rememberedInput_* of OTHER generators) and its session keys. The framework's
  // picture blob store is an IndexedDB database whose name this code cannot enumerate reliably, and deleting
  // its index without its blobs would corrupt the framework - so the framework's local gallery is out of
  // scope until Egon rules on it (reported, never silently approximated).
  function dragonStoreScopedOwned(key) {
    for (var i = 0; i < DRAGON_STORE_REGISTRY.scoped.length; i++) {
      var p = DRAGON_STORE_REGISTRY.scoped[i];
      if (key.indexOf(p) === 0) return true;
    }
    return false;
  }
  function dragonStoreOwned(key) {
    if (typeof key !== "string" || !key.length) return false;
    for (var i = 0; i < DRAGON_STORE_REGISTRY.exact.length; i++) if (key === DRAGON_STORE_REGISTRY.exact[i]) return true;
    for (var j = 0; j < DRAGON_STORE_REGISTRY.prefixes.length; j++) if (key.indexOf(DRAGON_STORE_REGISTRY.prefixes[j]) === 0) return true;
    return dragonStoreScopedOwned(key);
  }
  function dragonStoreOwnedSession(key) {
    for (var j = 0; j < DRAGON_STORE_REGISTRY.sessionPrefixes.length; j++) if (key.indexOf(DRAGON_STORE_REGISTRY.sessionPrefixes[j]) === 0) return true;
    return false;
  }
  function dragonStoreScan(store) {
    var keys = [], i;
    try { for (i = 0; i < store.length; i++) { var k = store.key(i); if (k != null) keys.push(k); } } catch (e) {}
    return keys;
  }
  // A DRY RUN: what the purge would delete (owned) and what it will leave alone (foreign). The dialog shows
  // these numbers, so the promise on screen is the code's actual behaviour.
  function dragonStorePlan(ls, ss) {
    var plan = { owned: { ls: [], ss: [], idb: DRAGON_STORE_REGISTRY.idb.slice(0), caches: DRAGON_STORE_REGISTRY.caches.slice(0) }, foreign: { ls: [], ss: [] } };
    var k = dragonStoreScan(ls), i;
    for (i = 0; i < k.length; i++) { if (dragonStoreOwned(k[i])) plan.owned.ls.push(k[i]); else plan.foreign.ls.push(k[i]); }
    k = dragonStoreScan(ss);
    for (i = 0; i < k.length; i++) { if (dragonStoreOwnedSession(k[i])) plan.owned.ss.push(k[i]); else plan.foreign.ss.push(k[i]); }
    return plan;
  }
  function dragonStorePurge(ls, ss) {
    var plan = dragonStorePlan(ls, ss), i;
    for (i = 0; i < plan.owned.ls.length; i++) { try { ls.removeItem(plan.owned.ls[i]); } catch (e) {} }
    for (i = 0; i < plan.owned.ss.length; i++) { try { ss.removeItem(plan.owned.ss[i]); } catch (e) {} }
    for (i = 0; i < plan.owned.idb.length; i++) { try { indexedDB.deleteDatabase(plan.owned.idb[i]); } catch (e) {} }
    for (i = 0; i < plan.owned.caches.length; i++) { try { caches.delete(plan.owned.caches[i]); } catch (e) {} }
    return plan;
  }
  window.dragonStorePlan = function () { return dragonStorePlan(localStorage, sessionStorage); };
  window.dragonStorePurge = function () { return dragonStorePurge(localStorage, sessionStorage); };
  window.dragonStoreOwns = function (key) { return dragonStoreOwned(key) || dragonStoreOwnedSession(key); };
  // Self-test for the check-up: the whole purge path runs against MOCKS, so a check-up run can never touch
  // the visitor's real storage (same discipline as the likes-ledger repair test).
  window.dragonStoreSelfTest = function () {
    function mock(seed) {
      var m = { _d: {} };
      m.getItem = function (k) { return Object.prototype.hasOwnProperty.call(this._d, k) ? this._d[k] : null; };
      m.setItem = function (k, v) { this._d[k] = String(v); };
      m.removeItem = function (k) { delete this._d[k]; };
      m.key = function (i) { var ks = Object.keys(this._d); return i < ks.length ? ks[i] : null; };
      Object.defineProperty(m, "length", { get: function () { return Object.keys(this._d).length; } });
      for (var k in seed) m.setItem(k, seed[k]);
      return m;
    }
    var ls = mock({ dragonGalDisplay: "justified", dragonScreenStyle: "1", forceColorScheme: "dark", "__tabbedCommentsPluginCustomChannels": "{}", "localMediaGallery_.names": "[\"a\"]", "commentsPlugin.privateSelfId": "uuid", autoShowSocialsNextTime: "1" });
    var ss = mock({ dragonVkSent: "1", dragonVerNotice: "2", someForeignSessionKey: "x" });
    var plan = dragonStorePlan(ls, ss);
    var purged = dragonStorePurge(ls, ss);
    var left = dragonStoreScan(ls), leftSs = dragonStoreScan(ss), i;
    var ownedGone = left.indexOf("dragonGalDisplay") < 0 && left.indexOf("dragonScreenStyle") < 0 && left.indexOf("forceColorScheme") < 0 && left.indexOf("__tabbedCommentsPluginCustomChannels") < 0 && leftSs.indexOf("dragonVkSent") < 0 && leftSs.indexOf("dragonVerNotice") < 0;
    var foreignKept = left.indexOf("localMediaGallery_.names") >= 0 && left.indexOf("commentsPlugin.privateSelfId") >= 0 && left.indexOf("autoShowSocialsNextTime") >= 0 && leftSs.indexOf("someForeignSessionKey") >= 0;
    return { planOwnedLs: plan.owned.ls.length, planForeignLs: plan.foreign.ls.length, planOwnedSs: plan.owned.ss.length, planForeignSs: plan.foreign.ss.length, idb: plan.owned.idb, caches: plan.owned.caches, ownedGone: ownedGone, foreignKept: foreignKept, leftLs: left.length, leftSs: leftSs.length };
  };
  // ===== Egon 15.09.2026 — PURGE ME =====
  // Permanently deletes this generator's OWN footprint in the browser: the registered localStorage /
  // sessionStorage keys, our IndexedDB database and our caches - and NOTHING else (see the registry above;
  // a blanket clear used to wipe other software's keys too). Because this touches the private gallery /
  // Likes data, it keeps the mandated TWO shields: an info+continue shield, then a "type PURGE" shield.
  // (User explicitly requested this feature.)
  window.dragonPurgeAllData = function () {
    ;function shield(build) {
      var ov = document.createElement("div");
      ov.style.cssText = "position:fixed; inset:0; z-index:2147483647; background:rgba(6,4,10,.96); display:flex; align-items:center; justify-content:center; padding:1rem;";
      var box = document.createElement("div");
      box.style.cssText = "max-width:520px; width:100%; background:linear-gradient(180deg,#1a1216,#0e0709); border:1px solid #e0244c; border-radius:16px; padding:1.2rem 1.2rem 1.3rem; color:#ffe9ee; font-family:system-ui; text-align:center; box-shadow:0 16px 50px rgba(0,0,0,.7);";
      ov.appendChild(box); document.body.appendChild(ov);
      build(box, function () { try { ov.remove(); } catch (e) {} });
      return ov;
    }
    shield(function (box, close) {
      var h = document.createElement("div");
      h.textContent = "\u26A0\uFE0F PURGE ALL DATA \u2014 delete ALL your data \u26A0\uFE0F";
      h.style.cssText = "font-size:1.1rem; font-weight:800; color:#ff4a6a; margin-bottom:.6rem; text-align:center;";
      var p = document.createElement("div");
      p.style.cssText = "font-size:.86rem; line-height:1.6; opacity:.95; margin-bottom:1rem; text-align:center;";
      var plan1 = null;
      try { plan1 = dragonStorePlan(localStorage, sessionStorage); } catch (e) {}
      var nOwn = plan1 ? (plan1.owned.ls.length + plan1.owned.ss.length) : 0;
      var nForeign = plan1 ? (plan1.foreign.ls.length + plan1.foreign.ss.length) : 0;
      p.innerHTML = "This permanently erases <b>everything BESTAIGEN saved in your browser</b>:<br>\u2022 your Likes / private gallery images<br>\u2022 featured images, tags, ratings & saved prompts<br>\u2022 all BESTAIGEN settings, themes, preferences & history<br>\u2022 " + nOwn + " BESTAIGEN storage key(s) and our local database (dragonHistDB)"
        + (nForeign ? "<br><br><span style=\"opacity:.78\">Left untouched: " + nForeign + " key(s) that belong to the platform or to plugins \u2014 not ours to delete.</span>" : "");
      var row = document.createElement("div");
      row.style.cssText = "display:flex; gap:.7rem; justify-content:center; flex-wrap:wrap;";
      var cancel = document.createElement("button");
      cancel.textContent = "Cancel";
      cancel.style.cssText = "padding:.5rem 1.1rem; font-size:.86rem; font-weight:bold; border:1px solid #7a7a8c; background:linear-gradient(145deg,#3a3a44,#17171c); color:#eee; border-radius:9px; cursor:pointer;";
      cancel.onclick = close;
      var cont = document.createElement("button");
      cont.textContent = "Continue";
      cont.style.cssText = "padding:.5rem 1.2rem; font-size:.86rem; font-weight:bold; border:1px solid #e0244c; background:linear-gradient(180deg,#5a1018,#2a0508); color:#ffc9d0; border-radius:9px; cursor:pointer;";
      cont.onclick = function () {
        close();
        // ---- second shield: type YES ----
        shield(function (box2, close2) {
          var h2 = document.createElement("div");
          h2.textContent = "\uD83D\uDEA8 FINAL CONFIRMATION";
          h2.style.cssText = "font-size:1.1rem; font-weight:800; color:#ff4a6a; margin-bottom:.6rem;";
          var p2 = document.createElement("div");
          p2.style.cssText = "font-size:.86rem; line-height:1.6; margin-bottom:.9rem;";
          p2.innerHTML = "Type <b>PURGE</b> below to permanently delete all your data. There is no going back.";
          var inp = document.createElement("input");
          inp.type = "text"; inp.placeholder = "type PURGE";
          inp.style.cssText = "width:70%; padding:.5rem .6rem; font-size:.95rem; text-align:center; border:1px solid #e0244c; border-radius:9px; background:#12060a; color:#fff; margin-bottom:.9rem;";
          var row2 = document.createElement("div");
          row2.style.cssText = "display:flex; gap:.7rem; justify-content:center; flex-wrap:wrap;";
          var cancel2 = document.createElement("button");
          cancel2.textContent = "Cancel";
          cancel2.style.cssText = cancel.style.cssText;
          cancel2.onclick = close2;
          var purge = document.createElement("button");
          purge.textContent = "\uD83D\uDCA3 PURGE EVERYTHING";
          purge.disabled = true;
          purge.style.cssText = "padding:.5rem 1.2rem; font-size:.86rem; font-weight:bold; border:1px solid #e0244c; background:linear-gradient(180deg,#5a1018,#2a0508); color:#ffc9d0; border-radius:9px; cursor:pointer; opacity:.45;";
          inp.addEventListener("input", function () {
            var ok = /^purge$/i.test(inp.value.trim());
            purge.disabled = !ok;
            purge.style.opacity = ok ? "1" : ".45";
          });
          inp.addEventListener("keydown", function (e) { if (e.key === "Enter" && !purge.disabled) purge.click(); });
          purge.onclick = function () {
            if (purge.disabled) return;
            close2();
            // 🗄️ SCOPED PURGE (W-DATA299 / package G): only the registered BESTAIGEN names. A foreign key,
            // database, cache or cookie is left alone - the dialog already promised exactly that, and the
            // promise must stay true (the old blanket clear also destroyed the framework's and the plugins'
            // keys). window.dragonStorePurge() runs the same plan the dialog just displayed.
            try { if (window.dragonStorePurge) window.dragonStorePurge(); } catch (e) {}
            try { if (window.dragonToast) dragonToast("\uD83D\uDCA3 everything deleted \u2014 reloading\u2026"); } catch (e) {}
            setTimeout(function () { try { location.reload(); } catch (e) {} }, 900);
          };
          row2.append(cancel2, purge);
          box2.append(h2, p2, inp, row2);
          setTimeout(function () { try { inp.focus(); } catch (e) {} }, 60);
        });
      };
      var warn = document.createElement("div");
      warn.textContent = "This cannot be undone!";
      warn.style.cssText = "font-size:.98rem; font-weight:800; color:#ff4a6a; text-align:center; margin:.85rem 0 1rem; letter-spacing:.02em; text-shadow:0 0 10px rgba(224,36,76,.55);";
      row.append(cancel, cont);
      box.append(h, p, warn, row);
    });
  };
  // Egon 12.09.2026 — IDEMPOTENT placer that puts 💾 Save / 🗑️ PURGE / 📂 Load buttons INSIDE
  // the 🔒 "Your privacy" panel. Root cause: the `dragonSettingsRebuild` pop element was ONLY
  // running ONCE (guard: `pop.__dragonSetBuilt`); when the Account closed and reopened, a NEW
  // privacy note was created, but because of the rebuild guard, it didn't run again, so the buttons
  // WERE DISAPPEARING. This function is called every time an Account opens: it creates the buttons once, then
  // reuses them (no dupes) and places them in the note in order: save → purge → load.
  window.dragonEnsurePrivacyButtons = function () {
    // 🗂️ Egon 22.09.2026 — the ⚙️ Settings cards are built once per page (guard: `__dragonSetBuilt`),
    // so a block made after that moment would leave a stale list. This function runs on EVERY Account
    // open, which makes it the natural place to re-read the two blocklists.
    try { if (window.dragonBlockedCardSync) window.dragonBlockedCardSync(); } catch (e) {}
    // 🗂️ Egon 24.09.2026 — SURVIVOR-FIRST (the actual fix for "the Backup / PURGE / Load buttons vanished"):
    // the privacy note that SURVIVES the de-duplication is chosen FIRST, and the three buttons are placed
    // INSIDE it. Root cause of the disappearance: the row used to be appended to the FIRST
    // `.dragon-privacy-note` of the document while the survivor could be a DIFFERENT note (the one already
    // sitting in 💾 Data & Saves); the note HOLDING the buttons was then removed as a duplicate — and the
    // buttons died with it. One host, chosen once, then everything is placed into that host (rule I104).
    var saveCard = null;
    var _setCards = document.querySelectorAll(".dragon-set-card");
    for (var ci = 0; ci < _setCards.length; ci++) {
      if (/Data & Saves/.test((_setCards[ci].querySelector(".dragon-set-h") || {}).textContent || "")) { saveCard = _setCards[ci]; break; }
    }
    var dc = saveCard ? saveCard.querySelector(".dragon-set-body") : null;
    var notes = [].slice.call(document.querySelectorAll(".dragon-privacy-note"));
    var keep = null;
    for (var ni = 0; ni < notes.length; ni++) {
      if (!keep && dc && notes[ni].parentElement === dc) keep = notes[ni];
    }
    if (!keep) keep = notes[0] || null;
    for (var nj = 0; nj < notes.length; nj++) {
      if (notes[nj] === keep) continue;
      try { notes[nj].parentNode.removeChild(notes[nj]); } catch (e) {}
    }
    if (keep && dc) { try { dc.insertBefore(keep, dc.firstChild); } catch (e) {} }
    var host = keep || dc;
    if (!host) return false;
    var btnStyle = "padding:.42rem .8rem; font-size:.76rem; font-weight:bold; border-radius:9px; cursor:pointer; border:1px solid rgba(155,107,255,.55); background:linear-gradient(145deg,#2a2a36,#15151c); color:#d8c9ff;";
    var row = document.getElementById("dragonPrivacyRow");
    if (!row) {
      row = document.createElement("div");
      row.id = "dragonPrivacyRow";
      row.className = "dragon-set-row dragon-privacy-row";
      // Egon 08.10.2026 — two half-width lines: 💾 Save + 📂 Load on the first, 🗑️ PURGE + 💽 Storage below.
      row.style.cssText = "margin-top:.6rem; display:flex; flex-direction:column; gap:.45rem; width:100%;";
      var lineA = document.createElement("div");
      lineA.style.cssText = "display:flex; gap:.45rem; width:100%;";
      var lineB = document.createElement("div");
      lineB.style.cssText = "display:flex; gap:.45rem; width:100%;";
      var saveB = document.createElement("button");
      saveB.id = "dragonPrivSaveBtn";
      saveB.type = "button"; saveB.textContent = "💾 Save Backup";
      saveB.title = "Choose what to include and download a .zip backup to your device";
      saveB.style.cssText = btnStyle;
      saveB.onclick = function (e) { e.stopPropagation(); if (window.dragonBackupSaveDialog) window.dragonBackupSaveDialog(); else if (window.dragonToast) dragonToast("Backup tool not ready yet"); };
      var purgeB = document.createElement("button");
      purgeB.id = "dragonPrivPurgeBtn";
      purgeB.type = "button";
      purgeB.textContent = "🗑️ PURGE ALL DATA";
      purgeB.title = "Delete ALL your personal data & generator browser data (cannot be undone)";
      purgeB.style.cssText = "padding:.4rem .9rem; font-size:.74rem; font-weight:800; border-radius:9px; cursor:pointer; border:1px solid #e0244c; background:linear-gradient(180deg,#5a1018,#2a0508); color:#ffc9d0; letter-spacing:.04em;";
      purgeB.onclick = function (e) { e.stopPropagation(); if (window.dragonPurgeAllData) window.dragonPurgeAllData(); };
      var loadB = document.createElement("button");
      loadB.id = "dragonPrivLoadBtn";
      loadB.type = "button"; loadB.textContent = "📂 Load Backup";
      loadB.title = "Import a .zip backup into your Likes";
      loadB.style.cssText = btnStyle;
      loadB.onclick = function (e) { e.stopPropagation(); if (window.dragonVaultMenuAction) window.dragonVaultMenuAction("loadBackup"); else if (window.dragonToast) dragonToast("Likes not ready — open Likes once"); };
      var storB = document.createElement("button");
      storB.id = "dragonPrivStorageBtn";
      storB.type = "button"; storB.textContent = "💽 Storage Info";
      storB.title = "How much space your Likes use and whether the browser keeps it";
      storB.style.cssText = btnStyle;
      storB.onclick = function (e) { e.stopPropagation(); if (window.dragonVaultOpenStorageInfo) window.dragonVaultOpenStorageInfo(); };
      lineA.append(saveB, loadB);
      lineB.append(purgeB, storB);
      row.append(lineA, lineB);
      // half-width lines: each button owns half of its line
      [saveB, loadB, purgeB, storB].forEach(function (b) { b.style.flex = "1 1 0"; b.style.minWidth = "0"; b.style.width = "auto"; b.style.boxSizing = "border-box"; try { b.style.setProperty("white-space", "normal", "important"); b.style.setProperty("overflow-wrap", "anywhere", "important"); } catch (eWS2) {} });
    }
    if (row.parentElement !== host) host.appendChild(row);
    // Egon 29.10.2026 (A16) — the last-backup reminder: refreshed on every Account open.
    try {
      var _bl = document.getElementById("dragonBackupAgeLine");
      if (!_bl) {
        _bl = document.createElement("div");
        _bl.id = "dragonBackupAgeLine";
        _bl.setAttribute("role", "note");
        _bl.style.cssText = "font-size:.74rem; text-align:center; width:100%;";
        row.appendChild(_bl);
      }
      var _bt = 0;
      try { _bt = Number(localStorage.dragonLastBackupAt || 0); } catch (eBT) {}
      if (!_bt) { _bl.textContent = "No backup saved on this device yet."; _bl.style.color = "#e0a23c"; }
      else {
        var _dd = Math.floor((Date.now() - _bt) / 86400000);
        var _ds = new Date(_bt);
        var _dstr = _ds.getFullYear() + "-" + ("0" + (_ds.getMonth() + 1)).slice(-2) + "-" + ("0" + _ds.getDate()).slice(-2);
        _bl.textContent = "Last backup: " + _dstr + (_dd > 15 ? " — over 15 days ago, time for a fresh one." : (_dd === 0 ? " (today)" : " (" + _dd + " days ago)"));
        _bl.style.color = _dd > 15 ? "#ff9aa5" : "#9fb6cc";
      }
    } catch (eBL) {}
    var starLine = document.getElementById("dragonPrivacyStarLine");
    if (!starLine) {
      starLine = document.createElement("div");
      starLine.id = "dragonPrivacyStarLine";
      starLine.style.cssText = "display:flex; gap:.45rem; width:100%;";
    }
    ;function privStarBtn(needle) {
      var bs = dc ? dc.querySelectorAll("button") : [];
      for (var i = 0; i < bs.length; i++) { if ((bs[i].textContent || "").indexOf(needle) !== -1) return bs[i]; }
      var all = document.querySelectorAll("button");
      for (var j = 0; j < all.length; j++) { if ((all[j].textContent || "").indexOf(needle) !== -1) return all[j]; }
      return null;
    }
    try {
      var _sfB = privStarBtn("Save Folder:");
      if (_sfB && !_sfB.closest("#dragonPrivacyStarLine")) {
        var _sfWrap = _sfB.parentElement;
        if (_sfWrap && _sfWrap.parentElement) { try { _sfWrap.parentElement.removeChild(_sfWrap); } catch (eW) {} }
        if (_sfWrap) {
          _sfWrap.style.width = "100%";
          _sfWrap.style.boxSizing = "border-box";
          var _hA = document.createElement("div");
          _hA.style.cssText = "flex:1 1 0; min-width:0;";
          _hA.appendChild(_sfWrap);
          starLine.appendChild(_hA);
        }
      }
      var _dupB = privStarBtn("Already-Saved Star:");
      if (_dupB && !_dupB.closest("#dragonPrivacyStarLine")) {
        var _dupWrap = _dupB.parentElement;
        var _dpar = _dupWrap && _dupWrap.parentElement;
        if (_dpar && _dpar.childElementCount <= 3 && !(_dpar.classList && (_dpar.classList.contains("dragon-shortcut-pop") || _dpar.classList.contains("dragon-set-body") || _dpar.classList.contains("dragon-set-pane")))) _dupWrap = _dpar;
        if (_dupWrap && _dupWrap.parentElement) { try { _dupWrap.parentElement.removeChild(_dupWrap); } catch (eW2) {} }
        if (_dupWrap) {
          _dupWrap.style.width = "100%";
          _dupWrap.style.boxSizing = "border-box";
          var _hB = document.createElement("div");
          _hB.style.cssText = "flex:1 1 0; min-width:0;";
          _hB.appendChild(_dupWrap);
          starLine.appendChild(_hB);
        }
      }
      if (starLine.parentElement !== row) row.appendChild(starLine);
      var _oldSP = dc ? dc.querySelector(".dragon-set-starpair") : null;
      if (_oldSP && !_oldSP.querySelector("button")) { try { _oldSP.parentElement.removeChild(_oldSP); } catch (eSP) {} }
    } catch (eStar) {}
    // Egon 23.09.2026 — the whole 🔒 "Your privacy" block (note text + the three buttons) sits at the TOP
    // of the 💾 Data & Saves card. The de-duplication runs BEFORE the buttons are placed now
    // (24.09.2026 — one implementation, rule I104; see the note at the top of this function).
    return true;
  };
  window.dragonSettingsRebuild = function (pop) {
    if (!pop || pop.__dragonSetBuilt) return;
    pop.__dragonSetBuilt = true;
    ;function tool(t) { return pop.querySelector(".dragon-shortcut-tool[data-tool='" + t + "']"); }
    ;function byText(sel, needle) {
      var a = pop.querySelectorAll(sel);
      for (var i = 0; i < a.length; i++) { if ((a[i].textContent || "").toLowerCase().indexOf(needle.toLowerCase()) !== -1) return a[i]; }
      return null;
    }
    ;function opt(needle) { return byText(".dragon-optbtn", needle); }
    ;function live(needle) { return byText(".dragon-living-btn", needle); }
    ;function head(needle) { return byText(".dragon-pop-head", needle); }

    var soundHead = head("Sound");
    var themeHead = head("Generator Themes");
    var cloudHead = head("Cloud Sync");
    var starHead = head("Star Save");
    // Egon 08.10.2026 — the "⭐ Star Save — Auto Folder" heading is gone (its sentence lives in the
    // folder button's tooltip now), so the row is found by its BUTTON, not by its heading.
    var starRow = starHead && starHead.nextElementSibling;
    if (!starRow) {
      var _sfB = byText("button", "Save Folder");
      if (_sfB && _sfB.parentElement && _sfB.parentElement !== pop) starRow = _sfB.parentElement;
    }
    var asHead = head("Already-Saved");
    var asWrap = asHead && asHead.parentElement;
    if (!asWrap) {
      var _dupB = byText("button", "Already-Saved Star");
      if (_dupB && _dupB.parentElement && _dupB.parentElement !== pop) asWrap = _dupB.parentElement;
    }
    var themeRow = (function () { var s = pop.querySelector("[data-th]"); return s && s.parentElement; })();
    var buildHead = head("Build");

    var refs = {
      galnum: tool("galnum"), galnumvis: tool("galnumvis"), feedback: tool("feedback"), fullscreen: tool("fullscreen"),
      kb: opt("Keyboard Shortcuts"), heart: opt("Heart Style"), charPanel: opt("Character Panel Version"), comment: opt("Comment Settings"),
      mini: live("Thumbnails"), lite: live("Lite Mode"), hero: live("Hero Pics"),
      loadSpeed: live("Gallery image load speed"), homePage: live("Home Page:"),
      ssCycle: pop.querySelector(".dragon-ss-cycle"),
      ssRain: (window.dragonBuildSsRainBtn ? window.dragonBuildSsRainBtn() : null),
      ssStyle: (window.dragonBuildSsStyleBtn ? window.dragonBuildSsStyleBtn() : null),
      shortcuts: pop.querySelector(".dragon-account-shortcuts"),
      soundDesc: soundHead && soundHead.nextElementSibling,
      soundStyles: pop.querySelector("#dragonSoundStyles"),
      soundVol: pop.querySelector("#dragonSoundVolRow"),
      soundSlider: pop.querySelector("#dragonSoundSliderWrap"),
      cloudBox: cloudHead && cloudHead.nextElementSibling,
      starRow: starRow,
      share: pop.querySelector("#dragonShareGenBtn") || byText("button", "\uD83D\uDCE4 Share"),
      buildVer: buildHead && buildHead.nextElementSibling,
      // Egon 16.09.2026 — new buttons (they will be moved to the Settings card)
      upNotes: pop.querySelector("#dragonUpdateNotesBtn"),
      dexaBub: pop.querySelector("#dragonDexaBubblesBtn")
    };

    ;function mkH(txt) { var d = document.createElement("div"); d.className = "dragon-set-h"; d.textContent = txt; return d; }
    ;function mkCard(title, items, wide) {
      var c = document.createElement("div");
      c.className = "dragon-set-card" + (wide ? " dragon-set-wide" : "");
      if (title) c.appendChild(mkH(title));
      var b = document.createElement("div"); b.className = "dragon-set-body";
      (items || []).forEach(function (el) { if (el) b.appendChild(el); });
      c.appendChild(b);
      return c;
    }

    var board = document.createElement("div"); board.className = "dragon-set-board";

    // ---- 🌐 Language: a dropdown button on the first line of UI & Display ----
    // Press it and the languages open in a menu; the button always names the active language.
    var langBtn = null, langNote = null, langWrap = null;
    ;function syncLangBtn() {
      if (!langBtn || !window.dragonLang) return;
      var m = null;
      try { m = window.dragonLang.manual(); } catch (e) {}
      var nm = "Auto";
      try { if (m) nm = window.dragonLang.name(m); } catch (e2) {}
      langBtn.textContent = "🌐 Language: " + nm;
    }
    ;function closeLangMenu() {
      try { if (langWrap) { var mn = langWrap.querySelector(".dragon-lang-menu"); if (mn) mn.remove(); } } catch (e) {}
    }
    ;function langMenuToggle() {
      if (!langWrap || !window.dragonLang) return;
      var old = langWrap.querySelector(".dragon-lang-menu");
      if (old) { old.remove(); return; }
      var menu = document.createElement("div");
      menu.className = "dragon-lang-menu";
      menu.style.cssText = "position:absolute; top:calc(100% + 4px); left:0; right:0; z-index:2147483600; max-height:16rem; overflow-y:auto; border:1px solid rgba(155,107,255,.55); border-radius:10px; background:linear-gradient(180deg,#221a38,#12101c); box-shadow:0 14px 40px rgba(0,0,0,.7); padding:.3rem;";
      function langRow(code, label) {
        var r = document.createElement("button");
        r.type = "button";
        var m = null;
        try { m = window.dragonLang.manual(); } catch (e) {}
        var on = (code === "auto" && !m) || (code !== "auto" && m === code);
        r.textContent = (on ? "✓ " : "　") + label;
        r.title = label;
        r.style.cssText = "display:block; width:100%; box-sizing:border-box; text-align:left; padding:.4rem .6rem; font-size:.78rem; font-weight:" + (on ? "800" : "400") + "; border:0; border-radius:7px; cursor:pointer; background:" + (on ? "linear-gradient(180deg,#5b34c0,#2a1650)" : "transparent") + "; color:" + (on ? "#efe7ff" : "#d8c9ff") + ";";
        r.onclick = function (e) {
          if (e) e.stopPropagation();
          var cur = null;
          try { cur = window.dragonLang.set(code); } catch (e2) {}
          try { if (window.dragonToast) window.dragonToast("Language: " + window.dragonLang.name(cur)); } catch (e3) {}
          syncLangBtn();
          closeLangMenu();
        };
        return r;
      }
      menu.appendChild(langRow("auto", "Auto (browser language)"));
      var langs = [];
      try { langs = window.dragonLang.list || []; } catch (e) {}
      for (var li = 0; li < langs.length; li++) menu.appendChild(langRow(langs[li][0], langs[li][1]));
      langWrap.appendChild(menu);
      try { if (window.dragonHookOutside) window.dragonHookOutside(menu, closeLangMenu); } catch (e) {}
    }
    try {
      if (window.dragonLang) {
        langWrap = document.createElement("div");
        langWrap.style.cssText = "position:relative; width:100%;";
        langBtn = document.createElement("button");
        langBtn.type = "button";
        langBtn.className = "dragon-set-themebtn";
        langBtn.title = "Language — Dexa and the news feed follow your choice here (Auto = browser language)";
        langWrap.appendChild(langBtn);
        syncLangBtn();
        langBtn.onclick = function (e) { if (e) e.stopPropagation(); langMenuToggle(); };
        try { window.dragonLang.onChange(function () { syncLangBtn(); closeLangMenu(); }); } catch (eOC) {}
      }
    } catch (eLang) { langBtn = null; }
    // 🎵 Music — removed (2026-09-18): the Settings music card is retired; the generator plays no
    // background music. The removed panel is parked in the internal library (Librarybook).

    // ---- cards grouped by type ----
    var groups = document.createElement("div"); groups.className = "dragon-set-groups";

    ;function row(items) {
      var r = document.createElement("div"); r.className = "dragon-set-row";
      (items || []).forEach(function (el) { if (el) r.appendChild(el); });
      return r;
    }

    // ⚡ Quick Actions
    // ⚡+🧰 MERGED CARD — Egon 12.09.2026: "⚡ Quick Actions" and "🧰 Tools & Shortcuts"
    // were merged into a SINGLE card and given a NEW name (neither "Quick Actions" nor "Tools & Shortcuts",
    // nor "Options"/"Settings"). The vacated Tools & Shortcuts panel was COMPLETELY removed.
    if (refs.heart) refs.heart.style.display = "none";
    // Tools & Shortcuts buttons share the SAME standard appearance as Quick Actions (dragon-set-stdbtn).
    [refs.lite, refs.share, refs.charPanel, refs.comment, refs.kb, refs.feedback, refs.fullscreen, refs.dexaBub].forEach(function (b) {
      if (!b) return;
      b.classList.remove("dragon-set-stdbtn");
      b.classList.add("dragon-set-themebtn");
      // 🧰 Egon 20.09.2026 — dexa-talk.js writes an inline `white-space:nowrap !important` on the Dexa
      // Bubbles button at load time, BEFORE it is moved into this card, so it would overflow the narrow
      // two-column card on phones. Inside the card it must wrap like every other button.
      try { b.style.setProperty("white-space", "normal", "important"); b.style.setProperty("overflow-wrap", "anywhere", "important"); } catch (e) {}
    });
    // 🧰 Egon 19.09.2026 — the Tools & Extras card is re-grouped into tidy rows, and every row runs
    // RIGHT-TO-LEFT (the first button of a row sits at its RIGHT end), reading just like the
    // 🖼 Image — Looks & Display card. Feedback and Fullscreen stay; 📦 Export Zip and 📊 Generator Stats
    // are gone (parked in the internal library — rule I89). Share is simply "Share" now.
    var mergedCard = mkCard("🧰 Tools & Extras", []);
    var mergedBody = mergedCard.querySelector(".dragon-set-body");
    // 🧰 Egon 22.09.2026 — "make the buttons spread across 2 rows in tools and extras into a single row ... let them stand
    // alone on the top rows, and once those are done, let the small buttons be lined up in pairs underneath."
    // The two-column masonry (which left five labels split over TWO rows of text) is gone. A button whose
    // label needs two lines now gets a FULL-WIDTH line of its own at the top, so every label reads on ONE
    // row; the short-labelled buttons below them are packed TWO PER LINE. The lines still read
    // right-to-left (the first button of a line sits at its RIGHT end — `direction:rtl` on the body, each
    // button resets its own direction to ltr so nothing is mirrored).
    mergedBody.style.display = "flex";
    mergedBody.style.flexWrap = "wrap";
    mergedBody.style.alignItems = "stretch";
    mergedBody.style.gap = ".4rem";
    mergedBody.style.direction = "rtl";
    mergedBody.style.textAlign = "center";
    ;function rtlRow(items, wide) {
      var r = row(items);
      r.style.display = "contents";
      for (var _ci = 0; _ci < items.length; _ci++) stdColBtn(items[_ci], wide);
      return r;
    }
    // `wide` = this button owns the whole line; otherwise it shares the line with the next button
    // (half of the card, minus half of the .4rem gap).
    ;function stdColBtn(b, wide) {
      if (!b || !b.style) return b;
      var _w = wide ? "100%" : "calc(50% - .2rem)";
      b.style.display = "flex";
      b.style.alignItems = "center";
      b.style.justifyContent = "center";
      b.style.flex = wide ? "0 0 100%" : "0 0 calc(50% - .2rem)";
      b.style.width = _w;
      b.style.maxWidth = _w;
      b.style.direction = "ltr";
      b.style.margin = "0";
      b.style.boxSizing = "border-box";
      b.style.textAlign = "center";
      try { b.style.setProperty("white-space", "normal", "important"); b.style.setProperty("overflow-wrap", "anywhere", "important"); } catch (eWS) {}
      return b;
    }
    // `wide` = Comment Settings shares its line with the 🔊 Generating Sound button (built
    // below, appended as one half-width pair with the slider still full-width beneath them).
    // Short-labelled buttons — appended below the full-width block, two per line.
    var toolsWide = [];
    // Short-labelled buttons — appended below the full-width block, two per line.
    var toolsHalf = [refs.charPanel, refs.dexaBub, refs.kb, refs.feedback, refs.fullscreen, refs.share, refs.lite];
    // Egon 08.10.2026 — the inline shortcuts panel is gone: ⌨️ Keyboard Shortcuts opens its own
    // window now (window.dragonOpenKbWindow), so there is nothing to append to this card.
    // Egon 16.09.2026 — 🗨️ Dexa Talking Bubbles (live on/off) stays in the Tools card.
    // The Update Notes button MOVED into the About card (Egon 16.09.2026): centered, right under the build line.
    // 🔖 Egon 18.09.2026 — one-click "add to browser bookmarks" for visitors (Tools & Extras).
    (function buildBookmark() {
      if (!window.dragonAddBookmark) {
        window.dragonAddBookmark = function () {
          var url = "https://perchance.org/" + (window.generatorName || "bestaigen");
          var title = "BestAiGen — Best AI Image Generator";
          try { if (window.external && window.external.AddFavorite) { window.external.AddFavorite(url, title); return; } } catch (e) {}
          var ov = document.createElement("div");
          ov.style.cssText = "position:fixed; inset:0; z-index:2147483646; display:flex; align-items:center; justify-content:center; padding:1rem; background:rgba(6,4,10,.82); -webkit-backdrop-filter:blur(6px); backdrop-filter:blur(6px);";
          var card = document.createElement("div");
          card.style.cssText = "position:relative; width:min(94vw,30rem); padding:1.2rem 1.3rem 1.3rem; border:1px solid rgba(155,107,255,.55); border-radius:16px; background:linear-gradient(180deg,#1c1230,#0d0918); box-shadow:0 22px 70px rgba(0,0,0,.78); color:#ece6ff; text-align:center;";
          var x = document.createElement("button");
          x.type = "button"; x.textContent = "✕"; x.title = "Close";
          x.style.cssText = "position:absolute; top:.55rem; right:.6rem; width:28px; height:28px; padding:0; border-radius:50%; border:1px solid rgba(155,107,255,.6); background:rgba(20,12,38,.85); color:#e6dcff; font-size:.85rem !important; cursor:pointer;";
          x.onclick = function () { ov.remove(); };
          var h = document.createElement("div");
          h.textContent = "🔖 Bookmark";
          h.style.cssText = "font-size:1.05rem; font-weight:800; color:#d8c9ff; margin:.1rem 0 .7rem;";
          var mac = false; try { mac = /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent || ""); } catch (e) {}
          var p = document.createElement("div");
          p.innerHTML = "Save the generator to your browser bookmarks so you can come back in one click.<br><br><b>Option 1</b> — press <b>" + (mac ? "⌘ + D" : "Ctrl + D") + "</b> on your keyboard.<br><br><b>Option 2</b> — drag this button onto your bookmarks bar:";
          p.style.cssText = "font-size:.82rem; line-height:1.5; color:#ded6f4;";
          var a = document.createElement("a");
          a.href = url; a.draggable = true; a.textContent = "🔖 BestAiGen"; a.title = title;
          a.style.cssText = "display:inline-block; margin:.8rem auto .2rem; padding:.5rem 1.1rem; border-radius:10px; border:1px solid #9b6bff; background:linear-gradient(180deg,#2a1a4a,#1a102e); color:#d8c9ff; font-weight:bold; font-size:.84rem; text-decoration:none; cursor:grab;";
          var hint = document.createElement("div");
          hint.textContent = url;
          hint.style.cssText = "font-size:.7rem; color:#9f8fd0; margin-top:.55rem; word-break:break-all;";
          card.append(x, h, p, a, hint);
          ov.appendChild(card);
          ov.addEventListener("click", function (e) { if (e.target === ov) ov.remove(); });
          document.body.appendChild(ov);
        };
      }
      var b = document.createElement("button");
      b.type = "button"; b.className = "dragon-set-themebtn";
      b.textContent = "\uD83D\uDD16 Add Bookmark";
      b.title = "Add BestAiGen to your browser bookmarks";
      b.onclick = function (e) { e.stopPropagation(); window.dragonAddBookmark(); };
      toolsHalf.push(b);
    })();
    // Egon 19.09.2026 — 🧭 Click Navigation (the ⌘K / Ctrl+K command palette). It used to sit on the History
    // tool row; it is a site-wide navigation tool, so it now lives here in "Tools & Extras".
    (function buildClickNav() {
      var b = document.createElement("button");
      b.type = "button"; b.className = "dragon-set-themebtn";
      b.textContent = "\uD83E\uDDED Click Navigation";
      b.title = "The command palette (Ctrl / \u2318 + K) \u2014 jump to any page, panel or action";
      b.onclick = function (e) { e.stopPropagation(); if (window.dragonOpenCommandPalette) window.dragonOpenCommandPalette(); };
      toolsHalf.push(b);
    })();
    // Egon 23.09.2026 — 🔍 BUTTONS & LEGENDS: the site-wide button search and the Legends reference are
    // now ONE button on the TOP row of this card (Egon: "we should merge the Legends button and find ...
    // the new Legends button should have a search feature; the button should also have a lens"). It indexes every control
    // of every card and every page live, and the same search box filters the legends.
    (function buildButtonsLegends() {
      var b = document.createElement("button");
      b.type = "button"; b.className = "dragon-set-themebtn";
      // W-UI189 — a stable id so Dexa's legends grid can point at THIS button
      // (resolved after the Settings board is built).
      b.id = "dragonButtonsLegendsBtn";
      b.textContent = "\uD83D\uDD0D Buttons & Legends";
      b.title = "Search every button, control and page of the generator \u2014 and the legends that explain them";
      b.onclick = function (e) { e.stopPropagation(); if (window.dragonOpenLegends) window.dragonOpenLegends(); };
      toolsHalf.unshift(b);
    })();
    // Egon 18.09.2026 — 📖 Legends: phones and tablets have no hover, so tooltips cannot be read
    // there. This panel is the single place where a visitor can look up what any button does.
    (function buildLegends() {
      if (!window.dragonOpenLegends) {
        var L = window.dragonLegendsDataGet ? window.dragonLegendsDataGet() : [];
        // 🧪 Egon 23.09.2026 (W-UI190) — the DATA itself is defined at module level
        // (dragonLegendsData) so a cold page already carries it; see the note next to that function.
        // 🔍 Egon 23.09.2026 — LEGENDS AND THE BUTTON SEARCH ARE NOW ONE WINDOW ("🔍 Buttons & Legends"):
        // one search box filters BOTH the live controls of the whole generator AND every legends entry, so
        // the answer to "where is that button / what does it do" always comes from the same place. The old
        // separate "Find A Button" window (and its useless ▶ chip on every row) is gone.
        window.dragonOpenLegends = function () {
          try { var _old = document.getElementById("dragonLegendsOverlay"); if (_old) _old.remove(); } catch (e) {}
          var all = [];
          try { all = dragonSiteSearchIndex(); } catch (e) { all = []; }
          var ov = document.createElement("div");
          ov.id = "dragonLegendsOverlay";
          ov.style.cssText = "position:fixed; inset:0; z-index:2147483647; display:flex; align-items:center; justify-content:center; padding:1rem; background:rgba(6,4,10,.86); -webkit-backdrop-filter:blur(6px); backdrop-filter:blur(6px);";
          var card = document.createElement("div");
          card.style.cssText = "position:relative; width:min(94vw,44rem); max-height:88vh; display:flex; flex-direction:column; border:1px solid rgba(155,107,255,.55); border-radius:16px; background:linear-gradient(180deg,#1c1230,#0d0918); box-shadow:0 22px 70px rgba(0,0,0,.78); color:#ece6ff; text-align:left; overflow:hidden; font:14px/1.4 system-ui;";
          var head = document.createElement("div");
          head.style.cssText = "display:flex; align-items:center; gap:.5rem; padding:.85rem 1rem; border-bottom:1px solid rgba(155,107,255,.35); background:linear-gradient(135deg,rgba(155,107,255,.22),rgba(40,40,60,.08));";
          var ttl = document.createElement("div");
          ttl.textContent = "\uD83D\uDD0D Buttons & Legends";
          ttl.style.cssText = "flex:1 1 auto; font-size:1.02rem; font-weight:800; color:#d8c9ff; letter-spacing:.01em;";
          var x = document.createElement("button");
          x.type = "button"; x.textContent = "\u2715"; x.title = "Close";
          x.style.cssText = "flex:0 0 auto; width:30px; height:30px; padding:0; border-radius:50%; border:1px solid rgba(155,107,255,.6); background:rgba(20,12,38,.85); color:#e6dcff; font-size:.9rem; cursor:pointer;";
          head.append(ttl, x);
          var inp = document.createElement("input");
          inp.type = "text";
          inp.placeholder = "Search every button, control and legend\u2026 (screen saver, fullscreen, upscale, theme, bookmark)";
          inp.style.cssText = "width:100%; box-sizing:border-box; padding:.7rem 1rem; font-size:.92rem; border:0; border-bottom:1px solid rgba(155,107,255,.3); background:#12121a; color:#fff; outline:none; font-family:inherit;";
          var body = document.createElement("div");
          body.style.cssText = "flex:1 1 auto; min-height:0; overflow-y:auto; padding:.9rem 1rem 1.2rem;";
          var hint = document.createElement("div");
          hint.textContent = "Type a word to search BOTH the buttons of the whole generator and the legends below. Pick a button row to jump straight to it \u2014 the page opens, the control scrolls into view and flashes yellow.";
          hint.style.cssText = "font-size:.76rem; line-height:1.45; color:#b7a9e6; margin:0 0 .9rem; padding:.5rem .7rem; border-radius:9px; background:rgba(155,107,255,.12); border:1px solid rgba(155,107,255,.28);";
          var btnHead = document.createElement("div");
          btnHead.style.cssText = "font-size:.8rem; font-weight:800; text-transform:uppercase; letter-spacing:.05em; color:#c9a8ff; margin:.2rem 0 .4rem;";
          var btnWrap = document.createElement("div");
          btnWrap.style.cssText = "display:flex; flex-direction:column; gap:.22rem; margin-bottom:.5rem;";
          var legWrap = document.createElement("div");
          body.append(hint, btnHead, btnWrap, legWrap);
          card.append(head, inp, body);
          ov.appendChild(card);
          document.body.appendChild(ov);

          var CLEAN = ov;
          ;function close() {
            try { if (window.dragonFastTipHide) window.dragonFastTipHide(); } catch (e) {}
            try { document.removeEventListener("keydown", onKey, true); } catch (e) {}
            try { CLEAN.remove(); } catch (e) {}
          }
          ;function flash(el) {
            try {
              if (!document.getElementById("dragonFindCss")) {
                var st = document.createElement("style");
                st.id = "dragonFindCss";
                st.textContent = "@keyframes dragonFindPulse{0%,100%{outline:3px solid rgba(255,215,106,0);outline-offset:2px}35%{outline:3px solid #ffd76a;outline-offset:3px;box-shadow:0 0 22px rgba(255,215,106,.8)}}"
                  + ".dragon-find-flash{animation:dragonFindPulse 1.05s ease-in-out 3 !important;outline:3px solid #ffd76a !important;outline-offset:3px !important;border-radius:10px !important;}";
                document.head.appendChild(st);
              }
              el.classList.add("dragon-find-flash");
              setTimeout(function () { try { el.classList.remove("dragon-find-flash"); } catch (e2) {} }, 3400);
            } catch (e) {}
          }
          ;function locate(entry) {
            if (!entry) return;
            if (entry.go) { close(); if (window.dragonGoPage) window.dragonGoPage(entry.go); return; }
            var el = entry.el;
            if (!el || !el.isConnected) { if (window.dragonToast) dragonToast("\u26A0\uFE0F that control is not on the page any more"); return; }
            close();
            // Egon 08.10.2026 — SETTINGS TABS: open the pane holding the control before scrolling to it.
            try {
              var sp = el.closest ? el.closest("[data-setpane]") : null;
              if (sp && sp.dataset && sp.dataset.setpane && window.dragonSettingsTab) window.dragonSettingsTab(sp.dataset.setpane);
            } catch (eTab) {}
            if (!dragonFindVisible(el)) {
              try {
                var anc = el, opened = false, d = 0;
                while (anc && d < 14 && !opened) {
                  var pg = anc.getAttribute && (anc.getAttribute("data-dragon-page") || "");
                  if (pg && window.dragonGoPage) { window.dragonGoPage(pg); opened = true; break; }
                  anc = anc.parentElement; d++;
                }
                if (!opened && window.dragonOpenOptionsPanel) window.dragonOpenOptionsPanel();
              } catch (e) {}
            }
            setTimeout(function () {
              try { el.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (e) { try { el.scrollIntoView(); } catch (e2) {} }
              flash(el);
            }, 260);
          }
          ;function renderList(q) {
            btnWrap.textContent = "";
            var vis = all.filter(function (c) {
              if (!q) return c.vis !== false || c.go;
              return (dragonFindNorm(c.lb) + " " + dragonFindNorm(c.kw) + " " + dragonFindNorm(c.sec)).indexOf(q) !== -1;
            }).slice(0, 120);
            btnHead.textContent = "\uD83D\uDD0D Buttons & functions \u2014 " + vis.length + (q ? " match" + (vis.length === 1 ? "" : "es") : " (of " + all.length + " indexed)");
            vis.forEach(function (c) {
              var r = document.createElement("div");
              r.style.cssText = "display:flex; align-items:center; gap:.6rem; padding:.42rem .55rem; border-radius:9px; cursor:pointer; background:rgba(255,255,255,.035); border:1px solid rgba(255,255,255,.06);";
              r.onmouseenter = function () { r.style.background = "rgba(155,107,255,.22)"; };
              r.onmouseleave = function () { r.style.background = "rgba(255,255,255,.035)"; };
              var ic = document.createElement("span"); ic.textContent = c.ic; ic.style.cssText = "font-size:1.02rem; width:1.3rem; text-align:center;";
              var mid = document.createElement("span"); mid.style.cssText = "flex:1; min-width:0;";
              var lb = document.createElement("span"); lb.textContent = dragonFindStripEmoji(c.lb); lb.style.cssText = "display:block; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:.82rem;";
              mid.appendChild(lb);
              var sub = c.sec ? ("in: " + c.sec) : (c.kw ? c.kw.slice(0, 52) : "");
              if (c.vis === false) sub = (sub ? sub + " \u00B7 " : "") + "hidden / not on screen";
              if (sub) { var h = document.createElement("span"); h.textContent = sub; h.style.cssText = "display:block; font-size:.68rem; color:" + (c.vis === false ? "#e0b26a" : "#8f8fa8") + "; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"; mid.appendChild(h); }
              r.append(ic, mid);
              r.onclick = function () { locate(c); };
              btnWrap.appendChild(r);
            });
            if (!vis.length) {
              var e = document.createElement("div");
              e.textContent = "no button matches \u2014 try a word like \u201Cscreen\u201D, \u201Cfull\u201D or \u201Ctheme\u201D";
              e.style.cssText = "padding:.6rem; color:#8a8a9a; font-size:.78rem;";
              btnWrap.appendChild(e);
            }
          }
          ;function renderLegends(q) {
            legWrap.textContent = "";
            var secH = document.createElement("div");
            secH.id = "dragonLegendsSecHead";
            secH.textContent = "\uD83D\uDCD6 Legends \u2014 what every button does";
            secH.style.cssText = "font-size:.8rem; font-weight:800; text-transform:uppercase; letter-spacing:.05em; color:#c9a8ff; margin:.9rem 0 .4rem;";
            legWrap.appendChild(secH);
            var shown = 0;
            L.forEach(function (sec) {
              var hits = sec[1].filter(function (it) {
                if (!q) return true;
                return (dragonFindNorm(it[0]) + " " + dragonFindNorm(it[1]) + " " + dragonFindNorm(sec[0])).indexOf(q) !== -1;
              });
              if (!hits.length) return;
              shown += hits.length;
              var h = document.createElement("div");
              h.textContent = sec[0];
              h.style.cssText = "font-size:.78rem; font-weight:800; letter-spacing:.04em; color:#b79bff; margin:.7rem 0 .35rem;";
              legWrap.appendChild(h);
              var wrap = document.createElement("div");
              wrap.style.cssText = "display:flex; flex-direction:column; gap:.28rem;";
              hits.forEach(function (it) {
                var rowEl = document.createElement("div");
                rowEl.style.cssText = "display:flex; align-items:flex-start; gap:.6rem; padding:.36rem .55rem; border-radius:9px; background:rgba(255,255,255,.035); border:1px solid rgba(255,255,255,.06);";
                var ic = document.createElement("div");
                ic.textContent = it[0];
                ic.style.cssText = "flex:0 0 auto; min-width:6.6rem; font-size:.78rem; font-weight:700; color:#fff;";
                var ds = document.createElement("div");
                ds.textContent = it[1];
                ds.style.cssText = "flex:1 1 auto; font-size:.78rem; line-height:1.4; color:#d7d0ec;";
                rowEl.append(ic, ds);
                wrap.appendChild(rowEl);
              });
              legWrap.appendChild(wrap);
            });
            secH.textContent = "\uD83D\uDCD6 Legends \u2014 " + (q ? shown + " match" + (shown === 1 ? "" : "es") : "what every button does");
          }
          ;function render() {
            var q = dragonFindNorm(inp.value);
            renderList(q);
            renderLegends(q);
          }
          var onKey = function (e) {
            if (!document.body || !document.body.contains(ov)) { try { document.removeEventListener("keydown", onKey, true); } catch (e2) {} return; }
            if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
          };
          inp.addEventListener("input", render);
          document.addEventListener("keydown", onKey, true);
          x.onclick = close;
          ov.addEventListener("mousedown", function (e) { if (e.target === ov) close(); });
          render();
          try { inp.focus(); } catch (e) {}
        };
        // the old name still works (the navbar/command palette and older code call it)
        window.dragonOpenSiteSearch = window.dragonOpenLegends;
      }
      // Egon 23.09.2026 — the separate "📖 Legends" button is GONE: legends live inside
      // "🔍 Buttons & Legends" now (one home per function, rule I104), so no second entry point exists.
    })();
    // Egon 08.10.2026 — ⌨️ Keyboard Shortcuts opens in its OWN window: the shortcut list in the
    // middle, a Close button at the very bottom (plus ✕ / Esc / backdrop to get out).
    if (!window.dragonOpenKbWindow) {
      window.dragonOpenKbWindow = function () {
        try { var _old = document.getElementById("dragonKbOverlay"); if (_old) _old.remove(); } catch (e) {}
        var ov = document.createElement("div");
        ov.id = "dragonKbOverlay";
        ov.style.cssText = "position:fixed; inset:0; z-index:2147483646; display:flex; align-items:center; justify-content:center; padding:1rem; background:rgba(6,4,10,.82); -webkit-backdrop-filter:blur(6px); backdrop-filter:blur(6px);";
        var card = document.createElement("div");
        card.style.cssText = "position:relative; width:min(94vw,30rem); max-height:86vh; display:flex; flex-direction:column; border:1px solid rgba(155,107,255,.55); border-radius:16px; background:linear-gradient(180deg,#1c1230,#0d0918); box-shadow:0 22px 70px rgba(0,0,0,.78); color:#ece6ff; overflow:hidden; font:14px/1.4 system-ui;";
        var head = document.createElement("div");
        head.style.cssText = "display:flex; align-items:center; gap:.5rem; padding:.85rem 1rem; border-bottom:1px solid rgba(155,107,255,.35);";
        var ttl = document.createElement("div");
        ttl.textContent = "⌨️ Keyboard Shortcuts";
        ttl.style.cssText = "flex:1 1 auto; font-size:1.02rem; font-weight:800; color:#d8c9ff;";
        var x = document.createElement("button");
        x.type = "button"; x.textContent = "✕"; x.title = "Close";
        x.style.cssText = "flex:0 0 auto; width:30px; height:30px; padding:0; border-radius:50%; border:1px solid rgba(155,107,255,.6); background:rgba(20,12,38,.85); color:#e6dcff; font-size:.9rem; cursor:pointer;";
        head.append(ttl, x);
        var kbBody = document.createElement("div");
        kbBody.style.cssText = "flex:1 1 auto; min-height:0; overflow-y:auto; padding:.8rem 1rem; font-size:.82rem; line-height:1.95; color:#ddd; text-align:left;";
        var nodes = window.__dragonShortcutNodes || [];
        if (nodes.length) { for (var i = 0; i < nodes.length; i++) kbBody.appendChild(nodes[i].cloneNode(true)); }
        else kbBody.textContent = "Shortcuts unavailable.";
        var foot = document.createElement("div");
        foot.style.cssText = "display:flex; justify-content:center; padding:.7rem 1rem .9rem; border-top:1px solid rgba(155,107,255,.3);";
        var closeB = document.createElement("button");
        closeB.type = "button"; closeB.textContent = "Close"; closeB.title = "Close";
        closeB.style.cssText = "padding:.5rem 1.4rem; font-size:.84rem; font-weight:bold; border:1px solid #9b6bff; background:linear-gradient(180deg,#2a1a4a,#1a102e); color:#d8c9ff; border-radius:9px; cursor:pointer;";
        foot.appendChild(closeB);
        card.append(head, kbBody, foot);
        ov.appendChild(card);
        document.body.appendChild(ov);
        function done() { try { ov.remove(); } catch (eR) {} try { document.removeEventListener("keydown", onKey, true); } catch (eK) {} }
        function onKey(e) {
          if (!document.body || !document.body.contains(ov)) { try { document.removeEventListener("keydown", onKey, true); } catch (eK2) {} return; }
          if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); done(); }
        }
        document.addEventListener("keydown", onKey, true);
        x.onclick = done; closeB.onclick = done;
        ov.addEventListener("mousedown", function (e) { if (e.target === ov) done(); });
      };
    }
    // 🧰 Egon 22.09.2026 — the SINGLE append pass (every button now exists): the full-width buttons come
    // first, each alone on its own line, then the short-labelled ones below them, two per line.
    toolsWide.forEach(function (b) { if (b) mergedBody.appendChild(rtlRow([b], true)); });
    for (var _tw = 0; _tw < toolsHalf.length; _tw += 2) {
      var _pair = toolsHalf.slice(_tw, _tw + 2).filter(Boolean);
      if (!_pair.length) continue;
      // ⚖️ Egon 23.09.2026 — an ODD last short button has no partner, and a half-width button sitting
      // beside an EMPTY half is exactly the "they are just floating in the air" look he complained about (its label also
      // clipped: measured "🔖 Add Bookmark" = 120px of text in a 118px box at 390px). Per his own rule —
      // "if two fit on the same row, fit them, if not, let it be alone" — the unpaired one OWNS the whole line.
      mergedBody.appendChild(rtlRow(_pair.length === 1 ? [_pair[0]] : _pair, _pair.length === 1));
    }
    var first3 = document.createElement("div");
    first3.className = "dragon-set-first3";
    first3.appendChild(mergedCard);

    // 💾 Data & Saves — normal card of the SAME size as the merged card. Save/Load/PURGE are no longer HERE,
    // 🔒 inside the privacy note (Egon 12.09.2026).
    var savesCard = mkCard("💾 Data & Saves", []);
    var dataBody = savesCard.querySelector(".dragon-set-body");
    // W-SOCIALCUT 10.10.2026 — the Cloud Sync login form was adopted into Data & Saves here (parked: Librarybook.enc DEPO).
    first3.appendChild(savesCard);

    // ---- 💾 Save / 🗑️ PURGE / 📂 Load --------------------------------------------------------------------
    // PARKED (Egon 23.09.2026, rule I89 — found through 🔍 Find a button, which listed these three a second
    // time): the duplicate Save/Load/PURGE buttons that used to be BUILT here were never appended to the
    // page — the single production lives in the 🔒 "Your privacy" panel (dragonEnsurePrivacyButtons).
    // They were dead DOM nodes only, so they are deleted rather than hidden (see Librarybook DEPO entry).
    if (window.dragonEnsurePrivacyButtons) window.dragonEnsurePrivacyButtons();

    // 🖼 Image — Looks & Display
    // 🧰 Egon 23.09.2026 — the screen-saver buttons MOVED OUT of this card: "bence screen saver ile ilgili
    // you should put the buttons in tools and extras as small buttons one below the other." The block is built below and
    // appended to 🧰 Tools & Extras at the end of that card's single append pass (see `ssBlock`).
    var ssBlock = null;
    if (refs.ssCycle) {
      // ⚖️ Egon 23.09.2026 (rev.2) — "🖼️ Screen Saver: 5 min / 🌧 Rainy Only: On / ⛶ Screen Saver: v2
      // (fullscreen) — I just told you to make these buttons short/small, these are settings buttons
      // we said it should be standard. ... place them properly, they are just floating in the air.
      // They are STANDARD buttons of the same two sizes as the rest of the card now — the old third size
      // ("fit-content, floating in the middle") is gone, which is exactly what looked unattached:
      //   line 1: 🖼️ Screen Saver: …   |   🌧 Rainy Only: …   (two SMALL buttons, half width each)
      //   line 2: the presentation button                    (one SMALL button, half width, centred on
      //                                                       its own line — the same small size as the rest)
      // `direction:ltr` is kept on each button (the card body is rtl), so every label reads symbol-first.
      ssBlock = document.createElement("div");
      ssBlock.className = "dragon-ss-block";
      ssBlock.style.cssText = "display:flex; flex-wrap:wrap; gap:.4rem; justify-content:center; align-items:stretch; width:100%; max-width:100%; margin-top:.35rem;";
      [refs.ssCycle, refs.ssRain, refs.ssStyle].forEach(function (b) {
        if (!b) return;
        try {
          b.style.setProperty("direction", "ltr", "important");
          b.style.setProperty("text-align", "center", "important");
        } catch (e) {}
      });
      ;function ssSize(b, wide) {
        if (!b || !b.style) return b;
        var w = wide ? "100%" : "calc(50% - .2rem)";
        try {
          b.style.setProperty("flex", wide ? "0 0 100%" : "0 0 calc(50% - .2rem)", "important");
          b.style.setProperty("width", w, "important");
          b.style.setProperty("max-width", w, "important");
          b.style.setProperty("margin", "0", "important");
          b.style.setProperty("box-sizing", "border-box", "important");
          b.style.setProperty("direction", "ltr", "important");
          b.style.setProperty("white-space", "normal", "important");
          b.style.setProperty("overflow-wrap", "anywhere", "important");
        } catch (e) {}
        return b;
      }
      ;function ssRow() {
        var r = document.createElement("div");
        r.className = "dragon-set-row";
        r.style.cssText = "display:flex; flex-wrap:wrap; gap:.4rem; justify-content:center; align-items:stretch; margin:0; width:100%;";
        return r;
      }
      var ssLine1 = ssRow();
      ssLine1.appendChild(ssSize(refs.ssCycle, false));
      if (refs.ssRain) ssLine1.appendChild(ssSize(refs.ssRain, false));
      var ssLine2 = ssRow();
      if (refs.ssStyle) ssLine2.appendChild(ssSize(refs.ssStyle, false));
      // 🔔 Social Alerts lives beside the presentation button (same small size, one shared line).
      try {
        if (window.dragonChatNotifToggleEl) {
          var saB = window.dragonChatNotifToggleEl();
          try { saB.classList.add("dragon-set-special"); } catch (eSA2) {}
          ssLine2.appendChild(ssSize(saB, false));
        }
      } catch (eSA) {}
      ssBlock.append(ssLine1, ssLine2);
      // the block joins the 🧰 Tools & Extras card as its own last line (§the card body is assembled
      // earlier in this function, so the block is appended where it is built — same card).
      try { mergedBody.appendChild(ssBlock); } catch (e) {}
    }
    // ---- 🔊 Generating Sound button + volume slider: the bottom lines of 🧰 Tools & Extras ----
    // One button (each press plays the NEXT style aloud and wears its name: Classic · Soft Pop ·
    // Bell Ding · Tech · Off), the slider below it (hidden while Off is selected).
    // The old full Sound panel is gone; the Control Panel keeps its own shared copy.
    ;(function buildSoundFooter() {
      var list = [];
      try { list = window.dragonSoundStyleList || []; } catch (e) {}
      if (!list || !list.length) list = [["classic", "🔔 Classic"]];
      list = list.slice(0);
      list.push(["off", "🔇 Off"]);
      function curIsOff() { try { return window.dragonSoundOffGet && window.dragonSoundOffGet(); } catch (eO) { return false; } }
      function curStyle() {
        try { if (window.dragonSoundGet) return window.dragonSoundGet().style || "classic"; } catch (eG) {}
        return "classic";
      }
      function curIdx() {
        if (curIsOff()) return list.length - 1;
        var cur = curStyle();
        for (var i = 0; i < list.length; i++) if (list[i][0] === cur) return i;
        return 0;
      }
      var b = document.createElement("button");
      b.type = "button";
      b.className = "dragon-set-themebtn";
      b.title = "Generating sound style — each press plays the next style aloud (Off hides the volume slider)";
      function sync() {
        var off = curIsOff();
        var st = list[curIdx()];
        b.textContent = "🔊 Generating Sound: " + st[1];
        try { vrow.style.display = off ? "none" : "flex"; } catch (eD) {}
        var g = null;
        try { g = window.dragonSoundGet ? window.dragonSoundGet() : null; } catch (eG2) {}
        var vol = g ? Number(g.vol || 0) : 0;
        if (off || !g || g.muted) vol = 0;
        try {
          sld.value = vol;
          valEl.textContent = vol + "%";
          icEl.textContent = vol === 0 ? "🔇 Volume" : "🔊 Volume";
        } catch (e2) {}
      }
      b.onclick = function (e) {
        if (e) e.stopPropagation();
        var ni = (curIdx() + 1) % list.length;
        try { if (window.dragonSoundSetStyle) window.dragonSoundSetStyle(list[ni][0]); } catch (e2) {}
        try { sync(); } catch (e5) {}
        try { if (window.dragonSoundSyncUI) window.dragonSoundSyncUI(); } catch (e6) {}
        if (list[ni][0] !== "off") {
          try {
            if (window.dragonChime) window.dragonChime(0, true);
            else if (typeof dragonChime === "function") dragonChime(0, true);
          } catch (e7) {}
        }
        try { if (window.dragonToast) window.dragonToast("generating sound: " + list[ni][1]); } catch (e8) {}
      };
      var vrow = document.createElement("div");
      vrow.style.cssText = "display:flex; align-items:center; gap:.45rem; width:100%; flex:0 0 100%; box-sizing:border-box; direction:ltr;";
      var icEl = document.createElement("span");
      icEl.style.cssText = "font-size:.72rem; opacity:.85; white-space:nowrap;";
      var sld = document.createElement("input");
      sld.type = "range"; sld.min = "0"; sld.max = "100"; sld.step = "1";
      sld.title = "Volume (0 = off)";
      sld.style.cssText = "flex:1 1 auto; min-width:0; accent-color:#7b6cff; cursor:pointer;";
      var valEl = document.createElement("span");
      valEl.style.cssText = "font-size:.72rem; font-weight:bold; min-width:2.2rem; text-align:right;";
      vrow.append(icEl, sld, valEl);
      sld.addEventListener("input", function () {
        var v = Number(sld.value);
        try {
          if (window.dragonSetSoundVol) window.dragonSetSoundVol(v, false);
          else {
            window.dragonSoundVol = v; window.dragonSoundMuted = v === 0;
            try { localStorage.dragonSoundVol = v; localStorage.dragonSoundMuted = window.dragonSoundMuted ? "1" : "0"; } catch (eS) {}
          }
          if (v > 0) localStorage.setItem("dragonSoundOff", "0");
        } catch (e) {}
        try { if (window.dragonSoundSyncUI) window.dragonSoundSyncUI(); } catch (e2) {}
        try { sync(); } catch (e3) {}
      });
      sld.addEventListener("change", function () {
        try {
          if (window.dragonChime) window.dragonChime(0, true);
          else if (typeof dragonChime === "function") dragonChime(0, true);
        } catch (e) {}
      });
      sync();
      try { window.dragonSoundPanels.push(sync); } catch (e) {}
      if (mergedBody) {
        mergedBody.appendChild(rtlRow([b], true));
        try { mergedBody.appendChild(vrow); } catch (e2) {}
        try { sync(); } catch (eS) {}
      }
    })();
    // 🖼 UI & Display  (Egon 23.09.2026 — renamed from "🖼 Image — Looks & Display")
    // ⚖️ Egon 23.09.2026 (rev.2) — "you've also shrunk the buttons in this settings ui and display panel
    // according to your own judgment. look, in the tools and extras panel there are 2 sizes you previously defined as standard
    // large (single row) and small 2 buttons in one row. adjust these small buttons in ui and display
    // according to this standard. and arrange these, the small ones, as two buttons in a single row. in this ui and display
    // panel, keep the ui scale at the very bottom."
    // So this card now uses the SAME two declared sizes as 🧰 Tools & Extras and NOTHING else:
    //   • BIG   = one button per line, FULL width (the long labels: ⚡ load speed · 🖼️ Background ·
    //             🔢 Gallery Image Numbers · its visibility twin · the theme button)
    //   • SMALL = two buttons per line, half width each (🏠 Home Page · 🖼️ Thumbnails)
    // The old "shrink to its own content width and float in the middle" treatment is gone — that is exactly
    // what made these buttons look arbitrary next to the Tools & Extras ones.
    // Order: ⚡ load speed first, 🏠 Home Page right after it (as Egon asked for earlier), then the rest;
    // 🔧 UI SCALE is always the LAST line of the card.
    var imageCard = mkCard("\uD83D\uDDBC UI & Display", []);
    var imageBody = imageCard.querySelector(".dragon-set-body");
    imageBody.style.display = "flex";
    imageBody.style.flexDirection = "column";
    imageBody.style.flexWrap = "nowrap";
    imageBody.style.justifyContent = "flex-start";
    imageBody.style.alignItems = "center";
    imageBody.style.gap = ".36rem";
    imageBody.style.lineHeight = "normal";
    // one line of the card (a flex row; the buttons inside carry the two standard sizes)
    ;function uiLine(items) {
      var r = document.createElement("div");
      r.className = "dragon-set-row";
      r.style.cssText = "display:flex; flex-wrap:wrap; gap:.4rem; justify-content:center; align-items:stretch; margin:0; width:100%;";
      (items || []).forEach(function (x) { if (x) r.appendChild(x); });
      return r;
    }
    // the standard's two sizes, written inline !important so nothing on the page can drift them
    ;function uiSize(b, wide) {
      if (!b || !b.style) return b;
      var w = wide ? "100%" : "calc(50% - .2rem)";
      b.style.setProperty("flex", wide ? "0 0 100%" : "0 0 calc(50% - .2rem)", "important");
      b.style.setProperty("width", w, "important");
      b.style.setProperty("max-width", w, "important");
      if (!b.hasAttribute("hidden")) b.style.setProperty("display", "flex", "important");
      b.style.setProperty("align-items", "center", "important");
      b.style.setProperty("justify-content", "center", "important");
      b.style.setProperty("margin", "0", "important");
      b.style.setProperty("box-sizing", "border-box", "important");
      b.style.setProperty("text-align", "center", "important");
      b.style.setProperty("white-space", "normal", "important");
      b.style.setProperty("overflow-wrap", "anywhere", "important");
      return b;
    }
    // ⚖️ SPECIAL buttons keep their OWN colours (Egon's list: purge · gallery numbers · load speed · background)
    [refs.loadSpeed, refs.galnum, refs.galnumvis].forEach(function (b) { try { if (b) b.classList.add("dragon-set-special"); } catch (e) {} });
    // the "🖼️ Background: …" button is built by the background module itself (so the button and its picker
    // always agree) and is tinted with the theme colour of the chosen background.
    var bgBtn = null;
    if (window.dragonBuildBgControl) {
      try { bgBtn = window.dragonBuildBgControl(); if (bgBtn) bgBtn.classList.add("dragon-set-special"); } catch (e) {}
    }
    // 🎨 GENERATOR THEMES (Egon 23.09.2026) — the button MOVED here from its own card: "generator themes
    // put the button inside ui and display as a full-size button, i.e., large (long button) and let this one take the selected theme
    // color and be a special button. delete the now empty generator themes panel." It is a FULL-WIDTH
    // special button, painted in the ACTIVE THEME'S OWN accent colour (--dt-accent, the same value the
    // themes themselves use) and re-tinted live if the visitor switches theme while Settings is open.
    var themesOpenBtn = document.createElement("button");
    themesOpenBtn.type = "button";
    themesOpenBtn.className = "dragon-set-special dragon-open-themes";
    themesOpenBtn.textContent = "\uD83C\uDFA8 Open Generator Themes";
    themesOpenBtn.title = "Generator Themes \u2014 pick the colours of the whole site (22 themes, plus day/night) and the background picture";
    themesOpenBtn.onclick = function (e) { e.stopPropagation(); if (window.dragonOpenOptionsThemes) window.dragonOpenOptionsThemes(); };
    ;function tintThemesBtn() {
      try {
        // NOTE: no font-weight/size override — the button is a SPECIAL one only in COLOUR, so it keeps the
        // standard's .72rem / weight 700 / 34px (the check-up asserts that for every card button).
        themesOpenBtn.style.setProperty("background", "var(--dt-accent, #9b6bff)", "important");
        themesOpenBtn.style.setProperty("color", "#101014", "important");
        themesOpenBtn.style.setProperty("border", "1px solid #ffffff", "important");
        themesOpenBtn.style.setProperty("box-shadow", "0 0 0 2px rgba(255,255,255,.26)", "important");
      } catch (e) {}
    }
    tintThemesBtn();
    try {
      new MutationObserver(tintThemesBtn).observe(document.documentElement, { attributes: true, attributeFilter: ["data-dragon-theme"] });
    } catch (e) {}
    // ---- the card's lines, in order ----
    // Egon 08.10.2026 — every button SMALL, two per line (colours untouched, UI Scale excluded).
    // The odd one out owns its line, exactly like the Tools & Extras odd-one-out rule.
    var companionBtn = null;
    try { if (window.dragonBuildCompanionBtn) companionBtn = window.dragonBuildCompanionBtn(); } catch (eC0) {}
    ;function halfWrap(w, wide) {
      if (!w || !w.style) return w;
      var hw = wide ? "100%" : "calc(50% - .2rem)";
      w.style.setProperty("flex", wide ? "0 0 100%" : "0 0 calc(50% - .2rem)", "important");
      w.style.setProperty("width", hw, "important");
      w.style.setProperty("max-width", hw, "important");
      w.style.setProperty("margin", "0", "important");
      w.style.setProperty("box-sizing", "border-box", "important");
      return w;
    }
    var dispItems = [];
    if (langWrap) { halfWrap(langWrap, false); if (langBtn) uiSize(langBtn, true); dispItems.push(langWrap); }
    [refs.loadSpeed, bgBtn, refs.galnum, refs.galnumvis, themesOpenBtn, scanAppearBtn, refs.homePage, refs.mini, refs.hero, companionBtn].forEach(function (b) { if (b && dispItems.indexOf(b) === -1) dispItems.push(b); });
    for (var _di = 0; _di < dispItems.length; _di += 2) {
      (function (_pair) {
        var _w1 = _pair.length === 1;
        imageBody.appendChild(uiLine(_pair.map(function (k) { return k === langWrap ? halfWrap(k, _w1) : uiSize(k, _w1); })));
      })(dispItems.slice(_di, _di + 2));
    }
    // 🔍 Egon 24.09.2026 — the SCAN-BUTTON APPEARANCE picker, moved here from the 🧰 toolbox. A
    // full-width special button that previews the Scan button mid-scan and steps through the looks.
    var scanAppearBtn = null;
    try { if (window.dragonBuildScanAppearanceBtn) scanAppearBtn = window.dragonBuildScanAppearanceBtn(); } catch (e) {}
    if (scanAppearBtn) { try { scanAppearBtn.classList.add("dragon-set-special"); } catch (e) {} }
    // ⚖️ Egon 08.10.2026 — the card's lines are built paired two-per-line above (dispItems);
    // nothing is appended here any more.
    // 🐾 Egon 24.09.2026 (W-FEAT281) — the Generator Companion picker: a full-width SPECIAL button that opens
    // a small menu (Off · Baby Dragon · Cat · Dog + follow-lag presets). The creature itself is drawn by
    // src/dragon-companion.js; this row only owns the control.
    try {
      if (companionBtn) {
        // already placed (the odd one out owns its line above) — nothing to append here.
      } else if (window.dragonLazyReady) {
        // 🐾 Paket A5 (W-PERF293) — the companion ships with the deferred (lazy) boot; put its setting here
        // the moment the module arrives (dragonLazyReady fires at once if it is already loaded).
        // Egon 08.10.2026 — it JOINS the lone Hero Pics button as its pair; only when that row is gone
        // does it take a full line of its own (always above UI Scale, never below it).
        window.dragonLazyReady(function () {
          if (!window.dragonBuildCompanionBtn) return;
          var cb = window.dragonBuildCompanionBtn();
          var placed = false;
          try {
            var hb = refs.hero;
            var hr = hb && hb.parentElement;
            if (hr && hr.classList && hr.classList.contains("dragon-set-row") && hr.parentElement === imageBody && hr.children.length === 1) {
              hr.appendChild(uiSize(cb, false));
              try { uiSize(hb, false); } catch (eRZ) {}
              placed = true;
            }
          } catch (eP) {}
          if (!placed) {
            var anchor = imageBody.querySelector('[data-dragon-ui-scale="1"]');
            imageBody.insertBefore(uiLine([uiSize(cb, true)]), anchor || null);
          }
        });
        // (the 🚧 "work in progress" note moved INSIDE the picker menu itself — Egon 25.09.2026)
      }
    } catch (eC) {}
    // (the screen-saver trio — 🖼️ Screen Saver, 🌧️ Rainy Only and the 🖼️ v1/v2 presentation button — is NOT
    // here: per Egon 23.09.2026 it lives in 🧰 Tools & Extras, see `ssBlock` above.)
    // Egon 10.09.2026 — 🖼 PREVIEW ENGINE v1/v2 toggle button (Toolbox preview generator).
    (function () {
      var pvBtn = document.createElement("button");
      pvBtn.type = "button";
      pvBtn.className = "dragon-living-btn";
      pvBtn.dataset.tool = "pvver";
      ;function pvSync() {
        var v = "v1";
        try { v = localStorage.dragonPvVersion === "v2" ? "v2" : "v1"; } catch (e) {}
        pvBtn.textContent = "\uD83D\uDDBC Preview Engine: " + v + (v === "v2" ? " \u26A1 fast" : " (standard)");
        pvBtn.title = "Toolbox preview generator. v1 = standard (your shape, sharpest). v2 = fast (512px + session cache, quicker). Toggle to compare; switch back anytime.";
      }
      pvBtn.onclick = function (e) {
        e.stopPropagation();
        var cur = "v1";
        try { cur = localStorage.dragonPvVersion === "v2" ? "v2" : "v1"; } catch (er) {}
        var nv = cur === "v2" ? "v1" : "v2";
        try { localStorage.dragonPvVersion = nv; } catch (er) {}
        pvSync();
        if (window.dragonToast) dragonToast("\uD83D\uDDBC Preview Engine \u2192 " + nv + (nv === "v2" ? " \u26A1 fast" : " (standard)"));
      };
      // Egon 10.09.2026 — DEPOT: Preview Engine toggle button REMOVED (v2 is now default,
      // v1 in depot). Button is kept hidden; can be reopened with a single line if needed later.
      pvSync();
      pvBtn.style.display = "none";
      // ⚖️ Egon 23.09.2026 — the Settings button standard forces `display` on every card button, which
      // had resurfaced this retired toggle; the `hidden` attribute always wins, so it stays away.
      pvBtn.hidden = true;
      var ib = imageCard.querySelector(".dragon-set-body");
      if (ib) ib.appendChild(pvBtn);
    })();
    // 🔧 UI SCALE — Egon 16.09.2026: the UI Scale control MUST also live in Settings. We reuse the
    // SAME shared factory (dragonUiScaleRow) so every copy stays in lockstep ("one control, several
    // places"). Zoom / Tile Size intentionally stay in the gallery 🎚 menus only.
    // Egon 23.09.2026 — the "🔧 UI Scale" heading line is gone (the symbol now sits left of the
    // percentage inside the row itself), so the row reads as ONE line: "🔧 141%" + [🪄 Auto: ON].
    (function () {
      var ibx = imageCard.querySelector(".dragon-set-body");
      if (!ibx || !window.dragonUiScaleRow) return;
      var uiRowS = window.dragonUiScaleRow();
      // Egon 08.10.2026 — ONE settings-button standard: the UI SCALE button wears the same
      // half-width size as every other card button (its slider keeps the full line below it).
      try {
        var _uisB = uiRowS.row.querySelector("button");
        if (_uisB) {
          _uisB.style.setProperty("width", "calc(50% - .2rem)", "important");
          _uisB.style.setProperty("max-width", "calc(50% - .2rem)", "important");
          _uisB.style.setProperty("flex", "0 0 auto", "important");
          _uisB.style.setProperty("align-self", "center", "important");
          _uisB.style.setProperty("margin", "0 auto", "important");
          _uisB.style.setProperty("white-space", "nowrap", "important");
          _uisB.style.setProperty("overflow", "hidden", "important");
          _uisB.style.setProperty("text-overflow", "ellipsis", "important");
        }
      } catch (eUB) {}
      var wrapS = document.createElement("div");
      wrapS.className = "dragon-set-row";
      wrapS.dataset.dragonUiScale = "1";
      wrapS.style.cssText = "justify-content:center; flex-wrap:wrap; width:100%; max-width:100%; box-sizing:border-box; margin:0 0 .36rem;";
      wrapS.appendChild(uiRowS.row);
      ibx.appendChild(wrapS);
      ibx.appendChild(uiRowS.infoBlock);
    })();
    // ⚖️ Egon 08.10.2026 — the card is already paired two-per-line at build time (see above);
    // stackImageCard only re-enforces those sizes on resize. UI Scale stays out of it (always last,
    // full width) and the language wrap keeps its half size; colours are never touched here.
    ;function stackImageCard() {
      var host = imageCard.querySelector(".dragon-set-body");
      if (!host) return;
      [].slice.call(host.children).forEach(function (el) {
        if (!el || el.hidden) return;
        if (el.dataset && el.dataset.dragonUiScale === "1") return;
        if (!el.classList || !el.classList.contains("dragon-set-row")) return;
        var kids = [].slice.call(el.children).filter(function (k) { return !k.hidden; });
        if (!kids.length) return;
        var wide = kids.length === 1;
        kids.forEach(function (k) {
          if (k.tagName === "BUTTON") uiSize(k, wide);
          else halfWrap(k, wide);
        });
      });
    }
    window.dragonStackImageCard = stackImageCard;
    stackImageCard();
    setTimeout(stackImageCard, 60);
    if (!window.__dragonPackHooked) {
      window.__dragonPackHooked = true;
      var _rpT = null;
      window.addEventListener("resize", function () {
        if (_rpT) clearTimeout(_rpT);
        _rpT = setTimeout(function () {
          try { if (window.dragonStackImageCard) window.dragonStackImageCard(); } catch (e) {}
          try { if (window.dragonLevelSettingsCards) window.dragonLevelSettingsCards(); } catch (e) {}
        }, 180);
      });
    }
    first3.appendChild(imageCard);

    // 🎨 Generator Themes card — DELETED (Egon 23.09.2026): "the leftover generator themes panel
    // delete it after moving the button." Its single button now lives in 🖼 UI & Display (built above,
    // as a full-width special button painted in the active theme's colour), so the card that held nothing
    // else is gone. The legacy Options-popover theme rows are still hidden here as before.
    if (themeHead) { try { themeHead.style.display = "none"; } catch (e) {} }
    if (themeRow) { try { themeRow.style.display = "none"; } catch (e) {} }
    // (the removed card is parked byte-exact in the internal library — see the Librarybook DEPO entry.)

    // 📦 About — Egon 15.09.2026: at the bottom, FULL WIDTH and CENTERED (desktop "bottom center" request).
    var aboutWrap = document.createElement("div"); aboutWrap.className = "dragon-set-about";
    var aboutCard = mkCard("\uD83D\uDCE6 About", [], true);
    // ⚖️ Egon 23.09.2026 — the 📦 About card is EXCLUDED from the Settings button standard ("about section
    // excluded"): it keeps its own look (profile button, Update Notes, rating faces, Survey).
    aboutCard.classList.add("dragon-set-aboutcard");
    var aboutBody = aboutCard.querySelector(".dragon-set-body") || aboutCard;
    // Egon 18.09.2026 — the visible "Generator Created by Egon" line was REMOVED (he disliked it;
    // the profile button above already credits him). The element is kept as an EMPTY, hidden
    // anchor because the army-feed script at the top of index.html injects #dragonCustomAboutLine
    // directly AFTER the first .dragon-about-credit node.
    var credit = document.createElement("div");
    credit.className = "dragon-about-credit";
    credit.hidden = true;
    credit.setAttribute("aria-hidden", "true");
    // Egon 18.09.2026 — 🐉 profile button sits ABOVE the credit line (opens the personal-letter window).
    if (window.dragonEgonButton) { try { aboutBody.appendChild(window.dragonEgonButton()); } catch (e) {} }
    aboutBody.appendChild(credit);
    if (refs.buildVer) aboutBody.appendChild(refs.buildVer);
    // Egon 16.09.2026 — 🆕 Update Notes button: moved here, centered, directly UNDER the build line.
    if (refs.upNotes) {
      try {
        var ub = refs.upNotes;
        ub.style.setProperty("display", "block", "important");
        ub.style.setProperty("margin", ".6rem auto .2rem", "important");
        ub.style.setProperty("width", "fit-content", "important");
        ub.style.setProperty("padding", ".45rem 1.1rem", "important");
        // NOTE: no inline font-size here — the button inherits the single Settings button font standard
        // (`.dragon-account-page .dragon-set-board button`, .8rem) so no button on this page can drift.
        ub.style.setProperty("font-weight", "bold", "important");
      } catch (e) {}
      aboutBody.appendChild(refs.upNotes);
    }
    // Egon 14.09.2026 — 🐉 "Did you like this generator? Please rate us!" + 5 emoji (1-5) + live counts.
    (function buildRatingBlock() {
      var rateWrap = document.createElement("div");
      rateWrap.className = "dragon-about-rate";
      rateWrap.style.cssText = "margin:.5rem auto .3rem; text-align:center; width:100%;";
      var rateQ = document.createElement("div");
      rateQ.textContent = "Did you like this generator? Please rate us!";
      rateQ.style.cssText = "font-size:.88rem; font-weight:800; color:#eae1ff; margin-bottom:.5rem; letter-spacing:.01em;";
      var rateRow = document.createElement("div");
      rateRow.style.cssText = "display:flex; justify-content:center; align-items:flex-start; gap:.55rem; flex-wrap:wrap;";
      var RATE_EMOJI = ["\uD83D\uDE20", "\uD83D\uDE41", "\uD83D\uDE10", "\uD83D\uDE0A", "\uD83E\uDD29"]; // 😠 🙁 😐 😊 🤩 = 1..5
      var cells = [];
      for (var ri = 0; ri < 5; ri++) (function (i) {
        var cell = document.createElement("div");
        cell.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:.18rem; min-width:3.1rem;";
        var b = document.createElement("button");
        b.type = "button";
        b.textContent = RATE_EMOJI[i];
        b.title = "Rate " + (i + 1) + " / 5";
        b.style.cssText = "font-size:1.55rem; line-height:1; width:3rem; height:3rem; display:inline-flex; align-items:center; justify-content:center; background:linear-gradient(180deg,#2a2a36,#14141b); border:1px solid rgba(155,107,255,.5); border-radius:12px; cursor:pointer; transition:box-shadow .12s, filter .12s;";
        b.onmouseenter = function () { b.style.filter = "brightness(1.22)"; b.style.boxShadow = "0 0 14px rgba(155,107,255,.7)"; };
        b.onmouseleave = function () { b.style.filter = ""; b.style.boxShadow = ""; };
        b.onclick = function (e) {
          e.stopPropagation();
          if (window.dragonRateVote) window.dragonRateVote(i + 1);
          if (window.dragonToast) dragonToast("\u2764\uFE0F thanks for rating " + (i + 1) + "/5!");
        };
        var cnt = document.createElement("div");
        cnt.className = "dragon-rate-count";
        cnt.dataset.rateIdx = String(i);
        cnt.textContent = "0";
        cnt.style.cssText = "font-size:.74rem; font-weight:800; color:#c9b8ff;";
        cell.append(b, cnt);
        rateRow.appendChild(cell);
        cells.push(cnt);
      })(ri);
      var rateThanks = document.createElement("div");
      rateThanks.className = "dragon-rate-thanks";
      rateThanks.style.cssText = "font-size:.72rem; color:#8aff9e; margin-top:.4rem; min-height:1em;";
      rateWrap.append(rateQ, rateRow, rateThanks);
      aboutBody.appendChild(rateWrap);
      // Global refresh for every About instance + live totals streaming in from the stats socket.
      window.dragonRefreshRateUI = function (ratings) {
        if (ratings && ratings.length) {
          window.__dragonLastRatings = ratings;
          for (var i = 0; i < 5; i++) { if (cells[i]) cells[i].textContent = String(ratings[i] || 0); }
        }
        var voted = false;
        try { voted = localStorage.dragonRated === "1"; } catch (e) {}
        rateThanks.textContent = voted ? "Thanks for rating! \u2764\uFE0F" : "";
      };
      window.dragonRefreshRateUI(window.__dragonLastRatings || null);
      // Ask the live server for the current totals right away (the UI may be built after connect).
      try {
        var _sk = window.__dragonStatsSockets && window.__dragonStatsSockets().socket;
        if (_sk) _sk.rpc.getStats("").then(function (s) { try { window.dragonRefreshRateUI(JSON.parse(s).ratings); } catch (e) {} }).catch(function () {});
      } catch (e) {}
    })();
    // 2026-09-19 — 📋 SURVEY: the PERMANENT entry point (Settings -> About). The invite bar is the
    // one-time path; this button always opens the SAME window and lets a visitor re-take the survey.
    (function buildSurveyButton() {
      try { dragonUIEnsureCss(); } catch (e) {}
      var wrap = document.createElement("div");
      wrap.style.cssText = "display:flex;justify-content:center;margin:.6rem 0 .1rem;";
      var b = document.createElement("button");
      b.type = "button";
      b.id = "dragonSurveyBtn";
      b.className = "dg-btn is-primary";
      b.textContent = "\uD83D\uDCCB Survey";
      b.title = "Visitor survey \u2014 tell us what to build next";
      // 🔴 Egon 19.09.2026 — while the visitor has NEVER taken the survey, this button wears a small
      // "NEW" badge; the moment they submit (localStorage.dragonSurveyDone is written by the survey's
      // own submit) the badge disappears for good and never comes back.
      b.style.position = "relative";
      var sBadge = document.createElement("span");
      sBadge.id = "dragonSurveyNewBadge";
      sBadge.textContent = "NEW";
      sBadge.style.cssText = "position:absolute; top:-7px; right:-9px; background:linear-gradient(180deg,#ff4d6a,#c81e3a); color:#fff; font-size:.5rem; font-weight:800; letter-spacing:.06em; padding:1px 5px; border-radius:8px; border:1px solid #ff98a8; box-shadow:0 2px 8px rgba(255,60,90,.6); pointer-events:none;";
      b.appendChild(sBadge);
      var surveyBadgeSync = function () {
        try { sBadge.style.display = localStorage.getItem("dragonSurveyDone") ? "none" : ""; } catch (e) {}
      };
      surveyBadgeSync();
      try { setInterval(surveyBadgeSync, 4000); } catch (e) {}
      b.addEventListener("click", function () { if (window.dragonSurveyOpen) window.dragonSurveyOpen(); });
      wrap.appendChild(b);
      aboutBody.appendChild(wrap);
    })();
    // Egon 12.09.2026 — ☕ "Buy me a coffee" MINI PANEL: official BMC (golden) button + ☕ on both sides.
    // visible under About card if `tipUrl` in main.pjs is populated; otherwise not visible at all.
    (function buildTipBlock() {
      var tipUrl = "";
      try { tipUrl = String((window.root && root.tipUrl) || "").replace(/^["']|["']$/g, "").trim(); } catch (e) {}
      if (!tipUrl || !/^https?:\/\//i.test(tipUrl)) return;
      var tipLabel = "\u2615 Buy me a coffee";
      try { if (window.root && root.tipLabel) tipLabel = String(root.tipLabel).replace(/^["']|["']$/g, ""); } catch (e) {}
      var panel = document.createElement("div");
      panel.style.cssText = "margin:.6rem auto .15rem; max-width:360px; padding:.6rem .7rem .7rem; border:1px solid rgba(255,221,0,.5); border-radius:12px; background:linear-gradient(180deg,rgba(255,221,0,.10),rgba(255,221,0,.03)); text-align:center; box-shadow:0 4px 16px rgba(0,0,0,.35);";
      var ttl = document.createElement("div");
      ttl.textContent = "\uD83D\uDC09 Enjoying BestAiGen?";
      ttl.style.cssText = "font-size:.82rem; font-weight:800; color:#ffe9b0; margin-bottom:.5rem; letter-spacing:.01em;";
      var row = document.createElement("div");
      row.style.cssText = "display:flex; align-items:center; justify-content:center; gap:.45rem;";
      ;function emo() { var s = document.createElement("span"); s.textContent = "\u2615"; s.style.cssText = "font-size:1.25rem; filter:drop-shadow(0 0 6px rgba(255,221,0,.5));"; return s; }
      var a = document.createElement("a");
      a.href = tipUrl; a.target = "_blank"; a.rel = "noopener noreferrer";
      a.title = tipLabel + " \u2014 " + tipUrl;
      a.setAttribute("aria-label", tipLabel);
      var img = document.createElement("img");
      img.src = "https://user.uploads.dev/file/6c54f3017f7df2547a3fb14d269ce714.png";
      img.alt = "Buy me a coffee";
      img.style.cssText = "height:38px; width:auto; display:block; border-radius:8px; box-shadow:0 3px 10px rgba(0,0,0,.4);";
      a.appendChild(img);
      a.onmouseenter = function () { a.style.transform = "translateY(-1px)"; a.style.filter = "brightness(1.06)"; };
      a.onmouseleave = function () { a.style.transform = ""; a.style.filter = ""; };
      row.append(emo(), a, emo());
      var hint = document.createElement("div");
      hint.textContent = "Every coffee keeps the dragon breathing fire \uD83D\uDD25";
      hint.style.cssText = "font-size:.68rem; color:#c9b98a; margin-top:.45rem;";
      panel.append(ttl, row, hint);
      aboutBody.appendChild(panel);
    })();
    aboutWrap.appendChild(aboutCard);
    aboutWrap.style.display = "none"; // PARKED — the old centered wrapper is no longer used

    // Egon 12.09.2026 — desired card order (About BOTTOM-MOST, full width, centered):
    //   🧰 Tools & Extras → 🖼 Image → 💾 Data & Saves → 🎨 Generator Themes → 📦 About
    // Tools & Shortcuts panel REMOVED (content moved to Tools & Extras).
    // Egon 12.09.2026 — the first 3 panels (🧰 Tools & Extras · 🖼 Image · 💾 Data & Saves) are gathered in a SINGLE
    // sub-grid; thanks to `grid-auto-rows:1fr` they remain EQUAL size on EVERY screen width
    // (previously in 2 columns, the 3rd card stayed alone and had a different height).
    var stack3 = document.createElement("div");
    stack3.className = "dragon-set-stack3";
    stack3.append(savesCard);
    first3.append(mergedCard, imageCard, stack3);
    // ⚖️ Egon 23.09.2026 — "I said to shorten these settings panels above, but among tools and extras + ui and
    // display + data and saves panels, whichever has the lowest button, these 3 panels should align to that level
    // shorten it enough" + "raise the panels of related buttons high enough to include the last button too.
    // there will be gaps on mobile right now if you don't fix it."
    // Measured, not guessed: each of the three cards is put back to height:auto, its OWN content height is
    // read, and all three are then given min-height = the tallest of the three. So every panel ends exactly
    // at the level of the lowest button in the group — nothing is stretched past its content, and the three
    // still share one bottom edge. On a PHONE (one column) the equalising is OFF: there each panel simply
    // ends at its own last button (a stretched card IS the empty gap Egon complained about).
    var levelCards = [mergedCard, imageCard, savesCard];
    ;function levelThreeCards() {
      try {
        if (!levelCards[0] || !levelCards[0].parentNode) return;
        levelCards.forEach(function (c) { c.style.height = "auto"; c.style.minHeight = "0px"; });
        if (window.innerWidth <= 679) return;
        var max = 0;
        levelCards.forEach(function (c) { var h = c.getBoundingClientRect().height; if (h > max) max = h; });
        if (!(max > 60)) return;   // the panel is not laid out (hidden) yet — the retries below will do it
        levelCards.forEach(function (c) { c.style.minHeight = Math.ceil(max) + "px"; });
      } catch (e) {}
    }
    window.dragonLevelSettingsCards = levelThreeCards;
    levelThreeCards();
    setTimeout(levelThreeCards, 90);
    setTimeout(levelThreeCards, 450);
    setTimeout(levelThreeCards, 1500);
    groups.appendChild(first3);
    // 🌐 Visitors — 18.09.2026: a live "where is everyone from" panel, placed directly ABOVE About.
    var visitorsCard = null;
    try { if (window.dragonBuildVisitorsCard) visitorsCard = window.dragonBuildVisitorsCard(); } catch (e) { visitorsCard = null; }
    if (visitorsCard) groups.appendChild(visitorsCard);
    // 📊 Visitor Stats — the 24h / 7d online-history board, right below the live Visitors panel.
    var statsCard = null;
    try { if (window.dragonBuildStatsCard) statsCard = window.dragonBuildStatsCard(); } catch (e) { statsCard = null; }
    if (statsCard) groups.appendChild(statsCard);
    // 🚫 Blocked — the record of everything the owner blocked (uploaders + single pictures), newest
    // first with the date and time. Placed right under the Visitor Stats board, above 📦 About.
    var blockedCard = null;
    try { if (window.dragonBuildBlockedCard) blockedCard = window.dragonBuildBlockedCard(); } catch (e) { blockedCard = null; }
    if (blockedCard) groups.appendChild(blockedCard);
    groups.appendChild(aboutCard);

    // Egon 08.10.2026 — SETTINGS TABS (one section at a time; phones stop scrolling kilometres of panels).
    // Cards are MOVED into panes (never cloned, so every handler survives). Egon 09.10.2026 — Login &
    // W-SOCIALCUT 10.10.2026 — Login & Safety card parked (see DEPO); the board opens straight on the tab panes.
    // Language becomes a toggle BUTTON inside UI & Display.
    var SET_TABS = [
      ["display", "🖼 UI & Display"],
      ["tools", "🧰 Tools & Extras"],
      ["saves", "💾 Data & Saves"],
      ["stats", "📊 Stats"]
    ];
    var setTabBar = document.createElement("div");
    setTabBar.className = "dragon-set-tabs";
    setTabBar.setAttribute("role", "tablist");
    setTabBar.setAttribute("aria-label", "Settings sections");
    var setPaneWrap = document.createElement("div");
    setPaneWrap.className = "dragon-set-panes";
    var setPanes = {};
    ["display", "tools", "saves", "stats"].forEach(function (id) {
      var p = document.createElement("div");
      p.className = "dragon-set-pane";
      p.dataset.setpane = id;
      setPanes[id] = p;
      setPaneWrap.appendChild(p);
    });
    SET_TABS.forEach(function (t) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "dragon-set-tab";
      b.dataset.settab = t[0];
      b.setAttribute("role", "tab");
      b.textContent = t[1];
      b.title = t[1];
      b.onclick = function () { if (window.dragonSettingsTab) window.dragonSettingsTab(t[0]); };
      setTabBar.appendChild(b);
    });
    if (mergedCard && setPanes.tools) setPanes.tools.appendChild(mergedCard);
    if (imageCard && setPanes.display) setPanes.display.appendChild(imageCard);
    if (savesCard && setPanes.saves) setPanes.saves.appendChild(savesCard);
    if (visitorsCard && setPanes.stats) setPanes.stats.appendChild(visitorsCard);
    if (statsCard && setPanes.stats) setPanes.stats.appendChild(statsCard);
    // W-SOCIALCUT 10.10.2026 — the Login & Safety card (cloud login + profile + safety host) lived here (parked: Librarybook.enc DEPO).
    // Egon 09.10.2026 — Login & Safety is NO tab anymore: its card moves to the very
    // top of the Settings body, above the title-to-tabs area. The Blocked record left
    // Settings entirely (it lives hidden as storage; unblocking happens in Gallery Management).
    // Egon 08.10.2026 — the language button is already the first half-width item of the
    // 🖼 UI & Display card (built with dispItems above); the note line under it is gone
    // (the tooltip carries the same sentence).
    ;function setShowTab(id) {
      var ok = false, ti, tj;
      for (ti = 0; ti < SET_TABS.length; ti++) if (SET_TABS[ti][0] === id) ok = true;
      if (!ok) {
        try { id = localStorage.getItem("dragonSettingsTab") || "display"; } catch (e) { id = "display"; }
        for (tj = 0; tj < SET_TABS.length; tj++) if (SET_TABS[tj][0] === id) ok = true;
        if (!ok) id = "display";
      }
      try { localStorage.setItem("dragonSettingsTab", id); } catch (e2) {}
      try { if (setTabBar.style.display === "none") setTabBar.style.display = ""; } catch (eRev) {}
      var tabs = setTabBar.querySelectorAll(".dragon-set-tab");
      for (var i = 0; i < tabs.length; i++) tabs[i].setAttribute("aria-selected", tabs[i].dataset.settab === id ? "true" : "false");
      for (var k in setPanes) if (setPanes[k]) setPanes[k].classList.toggle("on", k === id);
      try {
        [mergedCard, imageCard, savesCard].forEach(function (c) { if (c) { c.style.height = "auto"; c.style.minHeight = "0px"; } });
        if (window.dragonLevelSettingsCards) setTimeout(window.dragonLevelSettingsCards, 60);
      } catch (e3) {}
    }
    window.dragonSettingsTab = setShowTab;
    window.dragonSettingsTabs = function () { return SET_TABS.map(function (t) { return t[0]; }); };
    // The Account page rebuilds its top (Pedo note) on EVERY open while this
    // board persists, so the adoption below runs on every open via dragonAccountMountExtras (stale copies
    // are replaced, the emptied page-top wrapper is hidden).
    board.appendChild(setTabBar);
    board.appendChild(setPaneWrap);
    if (aboutCard) board.appendChild(aboutCard);
    // W-SOCIALCUT 10.10.2026 — safety card insert removed (parked).
    var setToggleWrap = document.createElement("div");
    setToggleWrap.className = "dragon-set-tabs";
    var setToggle = document.createElement("button");
    setToggle.type = "button";
    setToggle.className = "dragon-set-tab";
    setToggle.textContent = "\u2699\uFE0F Click to Open settings \u2699\uFE0F";
    setToggle.title = "Show the Settings sections";
    setTabBar.style.display = "none";
    setToggleWrap.appendChild(setToggle);
    board.insertBefore(setToggleWrap, setTabBar);
    function fitSetToggle() {
      try {
        var fs = 40;
        setToggle.style.whiteSpace = "nowrap";
        setToggle.style.setProperty("font-size", fs + "px", "important");
        while (fs > 10 && setToggle.scrollWidth > setToggle.clientWidth + 1) {
          fs--;
          setToggle.style.setProperty("font-size", fs + "px", "important");
        }
      } catch (eF) {}
    }
    setToggle.onclick = function (e) {
      if (e) e.stopPropagation();
      var show = setTabBar.style.display === "none";
      setTabBar.style.display = show ? "" : "none";
      if (show) {
        var cur = "display";
        try { cur = localStorage.getItem("dragonSettingsTab") || "display"; } catch (eS) {}
        if (window.dragonSettingsTab) window.dragonSettingsTab(cur);
      } else {
        for (var k in setPanes) if (setPanes[k]) setPanes[k].classList.remove("on");
      }
      setToggle.title = show ? "Hide the Settings sections" : "Show the Settings sections";
      fitSetToggle();
    };
    setTimeout(fitSetToggle, 120);
    if (blockedCard) { blockedCard.style.display = "none"; board.appendChild(blockedCard); }
    try { if (first3 && first3.parentNode === groups) groups.removeChild(first3); } catch (e6) {}
    try { if (groups && groups.parentNode === board) board.removeChild(groups); } catch (e7) {}
    var setStart = "display";
    try { setStart = localStorage.getItem("dragonSettingsTab") || "display"; } catch (e9) {}
    setShowTab(setStart);
    setTabBar.style.display = "none";
    for (var _pk in setPanes) if (setPanes[_pk]) setPanes[_pk].classList.remove("on");

    // add board to pop; hide all OLD direct children (do not delete — STORAGE).
    var oldKids = [].slice.call(pop.children);
    pop.appendChild(board);
    oldKids.forEach(function (k) { try { k.style.display = "none"; } catch (e) {} });
    // Egon 08.10.2026 — the Settings title-to-buttons gap matches the Social page: the old
    // wrappers (optwrap padding/border + the popover's own padding) used to stack ~45px of dead
    // air above the board. They collapse to nothing once the board owns the page.
    try {
      pop.style.setProperty("padding", "0", "important");
      pop.style.setProperty("border", "0", "important");
      pop.style.setProperty("background", "none", "important");
      var _pw = pop.parentElement;
      if (_pw && _pw.classList && _pw.classList.contains("dragon-account-optwrap")) {
        _pw.style.setProperty("padding", "0", "important");
        _pw.style.setProperty("border", "0", "important");
        _pw.style.setProperty("background", "none", "important");
        _pw.style.setProperty("margin-top", "0", "important");
      }
    } catch (eCol) {}
    try { if (window.dragonRefreshVisitorsPanel) window.dragonRefreshVisitorsPanel(); } catch (e) {}
  };
  ;function removeAccountSections(box) {
    var scope = box.querySelector(".dragon-account-core") || box;
    var kids = [].slice.call(scope.children);
    for (var i = 0; i < kids.length; i++) {
      var el = kids[i];
      if (!el.tagName || el.children.length) continue;
      var tx = (el.textContent || "").trim();
      if (tx.indexOf("Theme") !== -1 || tx.indexOf("Quick Options") !== -1) {
        try { el.remove(); } catch (e) {}
        if (kids[i + 1]) { try { kids[i + 1].remove(); } catch (e) {} }
      }
    }
  }
  window.dragonAccountMountExtras = function (box, secHead, optBtn) {
    if (!box || box.__dragonExtras) return;
    box.__dragonExtras = true;
    accountPopMounted = true;
    removeAccountSections(box);
    if (!secHead) secHead = function (txt) { var h = document.createElement("div"); h.style.cssText = "margin:1rem 0 .45rem; font-size:.85rem; font-weight:bold; color:#9fb6d6; letter-spacing:.03em;"; h.textContent = txt; return h; };
    if (!optBtn) optBtn = function (txt, title, fn) { var b = document.createElement("button"); b.type = "button"; b.className = "dragon-optbtn"; b.textContent = txt; b.title = title || txt; b.style.cssText = "padding:.45rem .7rem; font-size:.76rem; font-weight:bold; border-radius:9px; cursor:pointer; border:1px solid rgba(155,107,255,.5); background:linear-gradient(145deg,#2a2a36,#15151c); color:#d8c9ff;"; b.onclick = function (e) { e.stopPropagation(); fn(); }; return b; };
    // ----- options popover moved in -----
    var pop = findOptionsPop() || window.__dragonAcctPop;
    if (pop) {
      window.__dragonAcctPop = pop;
      window.__dragonAcctPopParent = pop.parentElement;
      pop._dragonPopOpen = true;
      pop.__dragonAccountMounted = true;
      if (pop._dragonTimer) { clearTimeout(pop._dragonTimer); pop._dragonTimer = null; }
      try { var _pc = document.querySelector(".dragon-pop-catcher"); if (_pc) _pc.remove(); } catch (e) {}
      // Chat now lives in the navbar → drop the redundant Chat tool from Options.
      try { var _ct = pop.querySelector(".dragon-shortcut-tool[data-tool='comments']"); if (_ct) _ct.style.display = "none"; } catch (e) {}
      // Egon 15.09.2026 — Dark/Light has been moved to the "Generator Themes" menu; hide the separate button in Options.
      try { var _dt = pop.querySelector(".dragon-shortcut-tool[data-tool='dark']"); if (_dt) _dt.style.display = "none"; } catch (e) {}
      var wrap = document.createElement("div");
      wrap.className = "dragon-account-optwrap";
      wrap.style.cssText = "margin-top:.2rem; padding:.7rem; border:1px solid rgba(155,107,255,.3); border-radius:14px; background:linear-gradient(180deg,#15151d,#0e0e13);";
      wrap.appendChild(pop);
      pop.style.position = "static"; pop.style.left = "auto"; pop.style.bottom = "auto";
      pop.style.width = "100%"; pop.style.maxWidth = "100%"; pop.style.maxHeight = "none";
      pop.style.display = "block"; pop.style.overflow = "visible";
      var optCol = box.querySelector(".dragon-account-optcol") || box;
      // Egon 23.09.2026 — the "⚙️ Options & Settings" heading line is gone: the cards below already say
      // what they are, so the line only took space.
      optCol.appendChild(wrap);
      try { if (pop._dragonRefresh) pop._dragonRefresh(); } catch (e) {}
      recolorThemeButtons(pop);
      // Egon 13.09.2026 — Generator Themes should remain CLOSED BY DEFAULT (Egon's request).
      // Previously it was forced open when entering Account; now we don't open it, the header ▾ and row remain closed.
      try {
        var thSample = pop.querySelector("[data-th]");
        var thRowEl = thSample && thSample.parentElement;
        var thHeadEl = (thRowEl && thRowEl.previousElementSibling && /Generator Themes/.test(thRowEl.previousElementSibling.textContent || "")) ? thRowEl.previousElementSibling : null;
        if (!thHeadEl) thHeadEl = [].slice.call(pop.querySelectorAll(".dragon-pop-head")).filter(function (h) { return /Generator Themes/.test(h.textContent || ""); })[0] || null;
        // Kartify skips moving the default closed (display:none) theme row to the cards → the row
        // remains an orphan in the grid. Place it back inside the card where its header is located.
        if (thRowEl && thHeadEl && thRowEl.previousElementSibling !== thHeadEl) {
          thHeadEl.parentNode.insertBefore(thRowEl, thHeadEl.nextSibling);
        }
        if (thRowEl && thRowEl.style.display !== "flex") {
          thRowEl.style.display = "none";
          if (thHeadEl) thHeadEl.textContent = "🎨 Generator Themes ▾";
        }
      } catch (e) {}
      if (!pop.__dragonRecolorHooked) {
        pop.__dragonRecolorHooked = true;
        pop.addEventListener("click", function () { setTimeout(function () { recolorThemeButtons(pop); }, 0); }, true);
      }
    }
    // ----- keyboard shortcuts button + panel (Egon 11.09.2026: moved INTO the Options panel) -----
    var scPanel = document.createElement("div");
    scPanel.className = "dragon-account-shortcuts";
    scPanel.style.cssText = "display:none; margin-top:.5rem; padding:.6rem .7rem; border:1px solid #4a4a58; border-radius:10px; background:linear-gradient(180deg,#131318,#0d0d11); font-size:.78rem; line-height:1.95; color:#ddd;";
    var nodes = window.__dragonShortcutNodes || [];
    if (nodes.length) {
      for (var i = 0; i < nodes.length; i++) scPanel.appendChild(nodes[i].cloneNode(true));
    } else {
      scPanel.innerHTML = "<div style='opacity:.7'>Shortcuts unavailable.</div>";
    }
    var btn = optBtn ? optBtn("⌨️ Keyboard Shortcuts", "Open the keyboard shortcuts in a window", function () {
      if (window.dragonOpenKbWindow) window.dragonOpenKbWindow();
    }) : null;
    if (pop && !pop.__dragonAcctToolsDone) {
      pop.__dragonAcctToolsDone = true;
      var toolRow = pop.querySelector(".dragon-shortcut-tool");
      toolRow = toolRow ? toolRow.parentElement : null;
      if (btn && toolRow) toolRow.appendChild(btn);
      // Egon 11.09.2026 — Heart Style moved here from the lightbox "..." menu.
      if (optBtn && toolRow) {
        var hsBtn = optBtn("\u2764\uFE0F Heart Style: v" + (localStorage.dragonFavStyle === "v2" ? "2" : "1"), "Switch the like-heart style (v1/v2)", function () {
          if (window.dragonToggleFavStyle) window.dragonToggleFavStyle();
          hsBtn.textContent = "\u2764\uFE0F Heart Style: v" + (localStorage.dragonFavStyle === "v2" ? "2" : "1");
        });
        // Egon 15.09.2026 — Heart Style button is now GREEN (consistent with other active buttons).
        hsBtn.style.border = "1px solid #4ade80";
        hsBtn.style.background = "linear-gradient(180deg,#14532d,#052e16)";
        hsBtn.style.color = "#bbf7d0";
        toolRow.appendChild(hsBtn);
        // Egon 11.09.2026 — the Character navbar button now opens the Character page;
        // keep the panel-version picker reachable from Account/Options.
        var ccBtn = optBtn("\uD83E\uDDCD Character Panel Version", "Choose which Character Creation panel version to show", function () {
          if (window.dragonCCPickerOpen) window.dragonCCPickerOpen();
        });
        toolRow.appendChild(ccBtn);
        // PARKED (Egon 23.09.2026 — rule I89/I62): the native comments-plugin ⚙️ settings could not be
        // moved/opened from outside its cross-origin iframe; it only opened the chat's manual nick/avatar
        // window. Egon removed it because our own comment system (src/dragon-comments.js) is taking over.
        // The button and its handler are deleted (see Librarybook DEPO entry).
        // Egon 12.09.2026 — force a row break so the first row is exactly
        // Dark / Dupes / Export Zip / Feedback / Fullscreen / Stats, and the
        // appended buttons (Keyboard Shortcuts / Heart Style / Character Panel Version) start row 2.
        try {
          var firstOpt = toolRow.querySelector(".dragon-optbtn");
          if (firstOpt && !toolRow.querySelector(".dragon-optbtn-rowbreak")) {
            var brk = document.createElement("div");
            brk.className = "dragon-optbtn-rowbreak";
            brk.style.cssText = "flex-basis:100%; height:0; margin:0; padding:0;";
            toolRow.insertBefore(brk, firstOpt);
          }
        } catch (e) {}
        // Egon 12.09.2026 — move the living Mini Thumbnails button into this button row.
        try {
          var lbs = window.__dragonLivingBtns || [];
          for (var bi = 0; bi < lbs.length; bi++) { if (lbs[bi] && lbs[bi].parentElement !== toolRow) toolRow.appendChild(lbs[bi]); }
        } catch (e) {}
      }
      if (toolRow && toolRow.parentElement) {
        if (toolRow.nextSibling) toolRow.parentElement.insertBefore(scPanel, toolRow.nextSibling);
        else toolRow.parentElement.appendChild(scPanel);
      } else {
        pop.appendChild(scPanel);
      }
    }
    // Egon 15.09.2026 — OLD haphazard layered layout (cardify + tidy + homeThemeRow + layout)
    // is DEPRECATED (STORAGE). A SINGLE, clean layout written from scratch is now used.
    // try { if (pop && window.dragonAccountCardify) window.dragonAccountCardify(pop); } catch (e) {}
    // try { if (pop && window.dragonAccountTidy) window.dragonAccountTidy(pop); } catch (e) {}
    // if (window.dragonHomeThemeRow) { try { window.dragonHomeThemeRow(pop); } catch (e) {} }
    // try { if (pop && window.dragonAccountLayout) window.dragonAccountLayout(pop); } catch (e) {}
    try { if (pop && window.dragonSettingsRebuild) window.dragonSettingsRebuild(pop); } catch (e) {}
    // Egon 12.09.2026 — Account generates a NEW privacy note on every opening; reposition the buttons here
    // (buttons were disappearing due to the rebuild one-time guard).
    try { if (window.dragonEnsurePrivacyButtons) window.dragonEnsurePrivacyButtons(); } catch (e) {}
    // W-SOCIALCUT 10.10.2026 — safety-pane adoption call removed (parked).
  };
  // Egon 13.09.2026 — Because Kartify skipped moving the default closed (display:none) "Generator Themes" row
  // to the cards, the row remained an orphan in the grid. This helper moves the theme row
  // puts it back inside the card where the title is (right under the title) and keeps it closed.
  window.dragonHomeThemeRow = function (pop) {
    if (!pop) return;
    var sample = pop.querySelector("[data-th]");
    var row = sample && sample.parentElement;
    if (!row) return;
    var head = [].slice.call(pop.querySelectorAll(".dragon-pop-head")).filter(function (h) { return /Generator Themes/.test(h.textContent || ""); })[0] || null;
    if (head && row.previousElementSibling !== head) head.parentNode.insertBefore(row, head.nextSibling);
    if (row.style.display !== "flex") {
      row.style.display = "none";
      if (head) head.textContent = "🎨 Generator Themes ▾";
    }
  };
  window.dragonAccountPopRestore = function () {
    // Never steal the pop while an Account page is open: a stale scheduled restore (the close
    // observer's setTimeout) firing after a fresh open used to hide + detach the live board's pop,
    // leaving every Settings button at 0px (the settings-buttons red).
    try { if (document.querySelector(".dragon-account-page")) return; } catch (eGuard) {}
    var pop = window.__dragonAcctPop || findOptionsPop();
    if (!pop) return;
    var insideAcct = pop.closest && pop.closest(".dragon-account-page");
    if (!window.__dragonAcctPop && !insideAcct) return;
    pop.style.position = ""; pop.style.left = ""; pop.style.bottom = "";
    pop.style.width = ""; pop.style.maxWidth = ""; pop.style.maxHeight = "";
    pop.style.overflow = ""; pop.style.display = "none";
    try { pop.__dragonAccountMounted = false; } catch (e) {}
    var par = window.__dragonAcctPopParent;
    try { (par && par.isConnected) ? par.appendChild(pop) : document.body.appendChild(pop); } catch (e) {}
    window.__dragonAcctPop = null;
    if (window.dragonClosePops) { try { window.dragonClosePops(); } catch (e) {} }
  };

  // ---------- move toolbox tools into the control panel ----------
  ;function installCpTools() {
    if (document.querySelector(".dragon-cp-tools-row")) return true;
    var upop = findPopByHead("Shortcuts");
    if (!upop) return false;
    var body = document.querySelector(".dragon-control-body");
    if (!body) return false;
    var kids = [].slice.call(upop.children);
    var toolsCtn = null, kbds = [];
    for (var i = 0; i < kids.length; i++) {
      var k = kids[i];
      if (!k.querySelector) continue;
      if (k.querySelector("kbd")) kbds.push(k);
      if (!toolsCtn && k.querySelector(".dragon-shortcut-tool")) toolsCtn = k;
    }
    window.__dragonShortcutNodes = kbds;
    var row = document.createElement("div");
    row.className = "dragon-cp-tools-row";
    row.style.cssText = "margin-top:.55rem; padding-top:.5rem; border-top:1px dashed #4a4a58;";
    var head = document.createElement("div");
    head.style.cssText = "font-size:.72rem; font-weight:bold; color:#9fd0ff; text-align:center; margin-bottom:.3rem; letter-spacing:.04em;";
    head.textContent = "\uD83E\uDDF0 TOOLS";
    row.appendChild(head);
    if (toolsCtn) row.appendChild(toolsCtn);
    body.appendChild(row);
    // Egon 13.09.2026 — Toolbox items were distributed to relevant locations (user report below):
    //   Production-time actions → Control Panel top button row (#dragonDescBtnsRow):
    //     A/B, Grid 4, Compare, Reimagine, Remove BG, Char Lock
    //   Vehicle panels → tool row on the Toolbox (History) page: Zoom Last
    //   • Kalanlar (Dark / Export Zip / Fullscreen / Stats / Dupes / Comments / History / Likes)
    //     since it is already in the Options line or navbar, it will not be shown AGAIN here.
    //   Therefore, the old TOOLBOX row in the Control Panel is hidden (not deleted; PARKED).
    try {
      ;function _tb(t) { return row.querySelector(".dragon-shortcut-tool[data-tool='" + t + "']"); }
      var _ctrl = (typeof dragonDescBtnsRow === "function") ? dragonDescBtnsRow() : null;
      // Egon 13.09.2026 — "charlock" REMOVED from the list: already real in #dragonDescBtnsRow
      // [data-d="charlock"] button existed → toolbox copy was creating a second 🎭 (duplicate).
      // Egon 15.09.2026 — These 5 buttons, with the mini icon buttons next to them (📝 🌐 🇺🇸 ➕ ? 🏦 🗑 📌)
      // should be in the SAME view: only symbol + tooltip. Previously, it was carrying text like "🆚 A/B" and
      // looked mismatched with the .dragon-shortcut-tool style (without background).
      var _sym = {
        ab: ["\uD83C\uDD9A", "A/B \u2014 generate 2 variations"],
        grid4: ["\u25A6", "Grid 4 \u2014 generate 4 variations"],
        compare: ["\u29C9", "Compare last 2 generated images"],
        reimagine: ["\uD83D\uDCF7", "Reimagine \u2014 use a photo as base"],
        // Egon 12.09.2026 — Remove BG symbol was 🪄 but it was clashing with the AI Magic button → ✂️ (cut out).
        // ImgtoPrompt was 🖼️ → changed to ✏️ (neither is used elsewhere anymore).
        bg: ["\u2702\uFE0F", "Remove BG \u2014 transparent PNG toggle"]
      };
      if (_ctrl) ["ab", "grid4", "compare", "reimagine", "bg"].forEach(function (t) {
        var b = _tb(t);
        if (!b) return;
        var sym = _sym[t];
        b.className = "dragon-desc-mini dragon-tool-icon";
        // 🖐 W-UI116 (Egon 25.09.2026, third round) — a STABLE key for the movable-button layout. The layout
        // used to key these buttons by their TITLE, and "Remove BG" changes its title with its state
        // ("Remove BG: OFF — click to make transparent"), so the key the layout had saved no longer matched
        // and the button silently stopped following the visitor's arrangement. `data-d` never changes.
        b.dataset.d = "tool-" + t;
        b.textContent = sym[0];
        b.title = sym[1];
        b.setAttribute("aria-label", sym[1]);
        _ctrl.appendChild(b);
      });
      // Egon 13.09.2026 — a retired toolbox button and Zoom Last (not working) were moved to PARKED.
      // Egon 26.09.2026 — the #dragonHistoryPage page is deleted, so the old `_hist` lookup
      // (its .dragon-hist-tools row) is gone with it.
      // PARKED: var _hist = document.querySelector("#dragonHistoryPage .dragon-hist-tools");
      // if (_hist) ["zoomlast"].forEach(function (t) { var b = _tb(t); if (b) _hist.appendChild(b); });
      row.style.display = "none";
    } catch (e) {}
    return true;
  }

  // ---------- mark runtime rows for CSS ----------
  ;function markRows() {
    var mc = document.getElementById("mainColumnEl85394739");
    if (mc) {
      for (var i = 0; i < mc.children.length; i++) {
        var c = mc.children[i];
        if (c.querySelector && c.querySelector("#generateButtonEl")) c.classList.add("dragon-gen-row");
      }
    }
    var art = document.querySelector('[data-name="artStyle"]');
    if (art) { var ac = art.closest(".input-ctn"); if (ac) ac.classList.add("dragon-artstyle-ctn"); }
    // Egon 15.09.2026 — mark description panel (for modifier line reserve; see CSS .dragon-desc-ctn).
    var descIn = document.querySelector('[data-name="description"]');
    if (descIn) { var dc = descIn.closest(".input-ctn"); if (dc) dc.classList.add("dragon-desc-ctn"); }
    var inp = document.getElementById("userInputsCtn8462746262");
    if (inp) {
      for (var j = 0; j < inp.children.length; j++) {
        var ch = inp.children[j];
        if (ch.classList && ch.classList.contains("dragon-char-wrap")) continue;
        if (ch.textContent && ch.textContent.indexOf("Test Multiple Styles") !== -1) ch.classList.add("dragon-artstyle-panel");
      }
    }
  }
  ;function activeCharWrap() {
    var sels = [".dragon-char-wrap", ".dragon-char-wrap2", ".dragon-char-wrap3", ".dragon-char-wrap4", ".dragon-char-wrap5"];
    for (var i = 0; i < sels.length; i++) {
      var el = document.querySelector(sels[i]);
      if (el && getComputedStyle(el).display !== "none") return el;
    }
    return null;
  }
  ;function expandActiveCharPanel() {
    var wrap = activeCharWrap();
    if (!wrap) return;
    var body = wrap.children[1] || wrap.querySelector('[class*="dragon-char-body"]');
    if (body && getComputedStyle(body).display === "none") {
      var hdr = wrap.firstElementChild;
      if (hdr && hdr.tagName === "BUTTON") { try { hdr.click(); } catch (e) {} }
    }
  }
  window.__dragonExpandActiveCharPanel = expandActiveCharPanel;
  // Egon 14.09.2026 — CLOSE the active character panel (called when the premade panel opens; avoid having both open at once).
  ;function collapseActiveCharPanel() {
    var wrap = activeCharWrap();
    if (!wrap) return;
    var body = wrap.children[1] || wrap.querySelector('[class*="dragon-char-body"]');
    if (body && getComputedStyle(body).display !== "none") {
      var hdr = wrap.firstElementChild;
      if (hdr && hdr.tagName === "BUTTON") { try { hdr.click(); } catch (e) {} }
    }
  }
  window.__dragonCollapseActiveCharPanel = collapseActiveCharPanel;

  // ---------- HOME page (rotating public-gallery showcase; V1 grid / V2 collage) ----------
  var homeItems = [];
  var homeUrls = [];
  var homeRotTimer = null;
  var homeSpotTimer = null;
  var homeConvTimer = null;
  var homeSeq = [];
  var homeFilling = false;
  // 18.09.2026 — IMAGE-LOAD RESILIENCE (see the helpers under `homeItemFor`): a gallery image request
  // that never answers (no load, NO error) used to freeze its tile forever, because the proxy fallback
  // was wired to `onerror` only. `homeDead` blocks those URLs for this page load, `homeSpare` keeps
  // spare pool picks ready, and HOME_POOL_TTL lets a stale localStorage pool be replaced.
  var homeSpare = [];
  var homeDead = {};
  var homePoolRefreshing = false;
  var homeLastPoolTry = 0;
  // HOME_DEAD_TTL: a blocked URL is retried after 3 min (so a host that recovers heals the board
  // without a reload) while still preventing a retry storm while it is down.
  var HOME_IMG_TIMEOUT = 4200, HOME_FILL_TRIES = 4, HOME_POOL_TTL = 6 * 60 * 60 * 1000, HOME_DEAD_TTL = 180000;
  ;function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  var HOME_VERS = ["v1", "v2", "v3", "v4", "v5", "v6", "v7", "v8"];
  var HOME_VER_DESC = { v1: "grid", v2: "editorial", v3: "gallery wall", v4: "cinematic", v5: "spotlight", v6: "conveyor", v7: "seamless", v8: "mosaic" };
  // Egon 15.09.2026 — HOME DEFAULT FOR EVERYONE: a one-time migration pulls the stored value to the default
  // version once (the older toggle bug had locked many browsers to a stray version); whatever the visitor
  // picks in Settings AFTERWARDS is preserved forever, because the flag is never written twice.
  // Egon 20.09.2026 — THE DEFAULT IS NOW V7 ("I liked this home page design, make v7 default for everyone"):
  // the same one-time migration now lands everyone on V7, and any browser with no stored value reads V7.
  // Egon 22.09.2026 — THE DEFAULT IS NOW V8 "MOSAIC" ("now our default home page is v8"): v8 is v7's
  // arrangement paved as a designed mosaic, so the same one-time migration now lands everyone on V8 and a
  // browser with no stored value reads V8. The retired V6/V7 flags are written too, so old logic stays quiet.
  try {
    if (!localStorage.getItem("dragonHomeVerDefaultV7")) {
      localStorage.setItem("dragonHomeVersion", "v7");
      localStorage.setItem("dragonHomeVerDefaultV6", "1");   // keep the retired v6 flag set so old logic stays quiet
      localStorage.setItem("dragonHomeVerDefaultV7", "1");
    }
    if (!localStorage.getItem("dragonHomeVerDefaultV8")) {
      localStorage.setItem("dragonHomeVersion", "v8");
      localStorage.setItem("dragonHomeVerDefaultV6", "1");
      localStorage.setItem("dragonHomeVerDefaultV7", "1");
      localStorage.setItem("dragonHomeVerDefaultV8", "1");
    }
  } catch (e) {}
  ;function dragonHomeVerGet() { try { var v = localStorage.getItem("dragonHomeVersion"); return HOME_VERS.indexOf(v) >= 0 ? v : "v8"; } catch (e) { return "v8"; } }
  window.dragonHomeVerGet = dragonHomeVerGet; // Egon 13.09.2026 — expose so the Account button can read it (was the toggle bug)
  window.dragonHomeVers = HOME_VERS.slice();
  window.HOME_VER_DESC = HOME_VER_DESC;
  // Egon 15.09.2026 — Home CTA: The EXACT CENTER of the Character Creation button should align with the EXACT CENTER of the page.
  // Since CTA is centered with `top` + translateY(-50%), the deviation (d) of the CC button relative to the CTA center
  // is measured and top = 50% - d is set. Recalculated when the window is resized.
  // W-UI176 — "or select one of our N Premade Characters": N is the live premade count (exposed by
  // src/dragon-reapply-item5.js as window.dragonPremadeTotal); the phrase is filled in once it is known.
  ;function dragonHomePremadePhrase() { var t = 0; try { t = window.dragonPremadeTotal || 0; } catch (e) {} return t ? (" " + t + " Premade Characters") : " Premade Characters"; }
  ;function dragonHomePremadeCaption() {
    try {
      var t = 0; try { t = window.dragonPremadeTotal || 0; } catch (e) {}
      var p = document.getElementById("dragonHomePage");
      if (!p) return;
      var subs = p.querySelectorAll(".dragon-home-cta-sub");
      if (subs[1]) subs[1].textContent = "Tap to design your own character step by step \u2014 or select one of our" + dragonHomePremadePhrase() + "!";
    } catch (e) {}
  }
  window.dragonHomePremadeCaption = dragonHomePremadeCaption;
  ;function dragonHomeCenterCC() {
    try {
      var cta = document.querySelector("#dragonHomePage .dragon-home-cta");
      if (!cta || getComputedStyle(cta).display === "none") return;
      var cc = document.getElementById("dragonHomeCharBtn");
      if (!cc) return;
      var cr = cta.getBoundingClientRect(), br = cc.getBoundingClientRect();
      if (!cr.height || !br.height) return;
      var d = (br.top + br.height / 2) - (cr.top + cr.height / 2);
      // Egon 15.09.2026 — SHORT SCREEN LOCK: ideal "50% - d" position of CTA/header on short mobile screen
      // it was shifting BELOW (above) the navbar. Now the calculated position is immediately (a) below the navbar
      // is CLIPPED to the range where (a) it stays below, (b) the bottom edge of the CTA does not overflow the screen.
      var vh = window.innerHeight || document.documentElement.clientHeight || 0;
      var navH = 42;
      try { navH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--dragon-nav-h")) || 42; } catch (e) {}
      // cta.top -> "50% - d" (px)
      var top = (vh / 2) - d;
      // 📱 Egon 23.09.2026 (W-UI175) — "make the home page buttons on mobile symmetrical with desktop.
      // while there is a good order on desktop, the title starts from the bottom on mobile." On a phone the stack fills the
      // whole screen, and putting the CC button's centre on the page centre left the block sitting low: the
      // title started ~18% down while the last caption nearly touched the bottom edge (~96%), because the
      // part BELOW the CC button is heavier than the part above it on a narrow screen. A phone therefore
      // centres the WHOLE block (equal gap above the title and below the last caption — the balance the
      // desktop layout shows), while the desktop/tablet rule stays exactly as Egon set it on 15.09.2026
      // ("the EXACT CENTER of the Character Creation button on the EXACT CENTER of the page").
      var _narrow = (window.innerWidth || document.documentElement.clientWidth || 0) <= 600;
      if (_narrow) top = vh / 2;
      var hero = cta.querySelector(".dragon-home-hero");
      var heroOff = hero ? (hero.getBoundingClientRect().top - cr.top) : 0;
      // Since CTA uses translate(-50%,-50%), IMAGE top = top - H/2, IMAGE bottom = top + H/2.
      var halfH = cr.height / 2;
      var minTop = navH + 4 - heroOff + halfH;
      var maxTop = vh - 6 - halfH;
      if (maxTop < minTop) maxTop = minTop;
      // 📱 Egon 23.09.2026 (W-UX195) — TALL-STACK FALLBACK (phone in landscape, very short windows). The
      // stack can be taller than the space under the navbar, and the clamp above then pins its top just
      // below the navbar — which pushes its BOTTOM far past the viewport, where nothing can reach it: the
      // home page could not be scrolled (overflow:hidden) and the floating CTA is not part of any scroll
      // flow. So when the stack does not fit, the header/CTA leaves the floating centre and joins the
      // page's normal flow (top of the scrollable area) and the home page is allowed to SCROLL — the wall
      // itself is `position:fixed`, so it stays pinned behind it. The moment there IS room, the floating
      // layout is restored byte-for-byte.
      var hp = document.getElementById("dragonHomePage");
      var needH = cr.height, availH = vh - navH - 10;
      if (hp && getComputedStyle(cta).position === "fixed" && needH > availH) {
        cta.dataset.dragonFlow = "1";
        cta.style.position = "absolute";
        cta.style.transform = "none";
        cta.style.left = "0";
        cta.style.right = "0";
        cta.style.top = "0";
        cta.style.margin = "0 auto";
        cta.style.paddingBottom = "1.2rem";
        hp.style.overflowY = "auto";
        // NOTE: no padding-bottom here — on this fixed, inset-constrained box a big padding-bottom makes the
        // engine grow the BOX itself (measured: padding 742px -> height 742px), which would swallow the very
        // scrolling this mode exists for. The absolutely positioned stack already contributes to the
        // scrollable area (measured: scrollHeight 714 vs clientHeight 354), so the page scrolls by itself.
        return;
      }
      if (hp && cta.dataset.dragonFlow === "1") {
        // still taller than the screen (measured in the FLOW layout): stay in scroll mode
        if (needH > availH) return;
        delete cta.dataset.dragonFlow;
        cta.style.position = "";
        cta.style.transform = "";
        cta.style.left = "";
        cta.style.right = "";
        cta.style.top = "";
        cta.style.margin = "";
        cta.style.paddingBottom = "";
        hp.style.overflowY = "";
        hp.style.paddingBottom = "";
      }
      if (top < minTop) top = minTop;
      if (top > maxTop) top = maxTop;
      cta.style.top = top.toFixed(1) + "px";
    } catch (e) {}
  }
  window.dragonHomeCenterCC = dragonHomeCenterCC;
  (function () {
    var _ccT = 0;
    window.addEventListener("resize", function () { clearTimeout(_ccT); _ccT = setTimeout(dragonHomeCenterCC, 120); });
  })();
  // ============================================================
  //  HOME V7 — "SEAMLESS" WALL (Egon 20.09.2026)
  //  Same arrangement as v6 (full-bleed wall behind the floating title + CTA) with ONE difference:
  //  every image keeps its ORIGINAL aspect ratio (no crop) and the tiles KISS (no gap anywhere).
  //  That is a JUSTIFIED layout: images are packed into a row until the row's height drops to the
  //  target, then the row is closed and every tile in it gets exactly `rowHeight * imageRatio` — so a
  //  row always covers the full width with no gap and no crop, and rows stack with no vertical gap.
  //  When the packed rows do not reach the bottom, the whole wall is scaled UP (never down), so the
  //  overflow is clipped and a gap can never open. Ratios change whenever a tile is rotated, so every
  //  tile image carries a `load` listener that re-runs the layout (debounced).
  // ============================================================
  var _v7T = null;
  ;function dragonHomeV7Reset() {
    var grid = document.querySelector("#dragonHomePage .dragon-home-grid");
    if (!grid) return;
    var tiles = grid.querySelectorAll(".dragon-home-tile"), i;
    for (i = 0; i < tiles.length; i++) {
      tiles[i].style.left = ""; tiles[i].style.top = "";
      tiles[i].style.width = ""; tiles[i].style.height = "";
    }
  }
  ;function dragonHomeV7Layout() {
    if (dragonHomeVerGet() !== "v7") return;
    var grid = document.querySelector("#dragonHomePage .dragon-home-grid");
    if (!grid) return;
    // Egon 22.09.2026 — never inherit a PARKED tile from the mosaic: a stale V8 pack can have hidden tiles
    // with `display:none` (measured: 12 of 25 after a fast V8→V7 switch), and a hidden tile would leave an
    // invisible hole in the seamless wall. Un-park everything before packing.
    var _pv = grid.querySelectorAll(".dragon-home-tile"), _pi;
    for (_pi = 0; _pi < _pv.length; _pi++) if (_pv[_pi].style.display === "none") _pv[_pi].style.display = "";
    var W = grid.clientWidth || window.innerWidth || 0;
    var H = grid.clientHeight || 0;
    if (W < 40 || H < 40) return;
    var all = grid.querySelectorAll(".dragon-home-tile"), items = [], i, t, img, r;
    for (i = 0; i < all.length; i++) {
      t = all[i]; img = t.querySelector("img");
      r = (img && img.naturalWidth && img.naturalHeight) ? (img.naturalWidth / img.naturalHeight) : 0.7;
      if (!(r > 0.05)) r = 0.7; // not loaded yet → assume a portrait frame (refined on `load`)
      items.push({ el: t, r: r });
    }
    if (!items.length) return;
    var target = H / (W <= 700 ? 3 : 2.4); // a phone shows ~3 rows, a desktop ~2.4
    var rows = [], cur = [], sum = 0;
    for (i = 0; i < items.length; i++) {
      sum += items[i].r; cur.push(items[i]);
      if (W / sum <= target) { rows.push({ items: cur, sum: sum }); cur = []; sum = 0; }
    }
    if (cur.length) rows.push({ items: cur, sum: sum });
    var total = 0;
    for (i = 0; i < rows.length; i++) total += W / rows[i].sum;
    if (!(total > 0)) return;
    var k = total < H ? (H / total) : 1;
    // Integer SHARED boundaries: neighbouring tiles must not sit on fractional edges (a browser can
    // show a hairline of the background between two sub-pixel neighbours). Each tile therefore gets
    // `round(nextBoundary) - round(thisBoundary)` as its size, so every edge is shared exactly.
    var y = 0, ri, h, xf, x0, x1;
    for (ri = 0; ri < rows.length; ri++) {
      h = k * W / rows[ri].sum;
      var y0 = Math.round(y), y1 = Math.round(y + h);
      xf = 0;
      for (i = 0; i < rows[ri].items.length; i++) {
        var it = rows[ri].items[i];
        x0 = Math.round(xf); x1 = Math.round(xf + h * it.r);
        it.el.style.left = x0 + "px";
        it.el.style.top = y0 + "px";
        it.el.style.width = (x1 - x0) + "px";
        it.el.style.height = (y1 - y0) + "px";
        xf += h * it.r;
      }
      y += h;
    }
  }
  window.dragonHomeV7Layout = dragonHomeV7Layout;
  // Egon 22.09.2026 — VERSION GUARDS (bug: a STALE deferred call could move/pack the wall AFTER the visitor
  // switched style — measured: leaving V8 for V7 within ~60 ms let a pending `dragonHomeV8Init` pack the wall
  // for the mosaic, which PARKED 12 of 25 tiles with `display:none`; the V7 wall then had invisible holes and
  // its own tile count was wrong). Every deferred wall call now re-checks the CURRENT style before it touches
  // anything, and the V7 wall un-parks the tiles itself, so V7 can never inherit a parked/hidden tile.
  ;function dragonHomeV7LayoutSoon() {
    if (_v7T) clearTimeout(_v7T);
    _v7T = setTimeout(function () { _v7T = null; try { if (dragonHomeVerGet() === "v7") dragonHomeV7Layout(); } catch (e) {} }, 90);
  }
  ;function dragonHomeV7Init() {
    var grid = document.querySelector("#dragonHomePage .dragon-home-grid");
    if (!grid) return;
    if (dragonHomeVerGet() !== "v7") return;   // a stale (already superseded) call must not touch the wall
    var imgs = grid.querySelectorAll("img"), i;
    for (i = 0; i < imgs.length; i++) {
      if (imgs[i].__v7) continue;
      imgs[i].__v7 = 1;
      imgs[i].addEventListener("load", dragonHomeV7LayoutSoon);
    }
    dragonHomeV7Layout();
  }
  window.dragonHomeV7Init = dragonHomeV7Init;
  (function () {
    var _rt = 0;
    window.addEventListener("resize", function () {
      clearTimeout(_rt);
      _rt = setTimeout(function () { try { if (dragonHomeVerGet() === "v7") dragonHomeV7Layout(); else if (dragonHomeVerGet() === "v8") dragonHomeV8Layout(); } catch (e) {} }, 150);
    });
  })();
  // ============================================================
  //  HOME V8 — "MOSAIC" (Egon 21.09.2026: "build home page v8 with tile flooring")
  //  The SAME justified packing as v7 (every image keeps its own aspect ratio; every row covers the
  //  full width so nothing is cropped and nothing gaps) but paved as a DESIGNED mosaic instead of a
  //  raw full-bleed wall: 10px gutters, rounded tiles, a small outer margin and a dark scrim, with the
  //  header + CTA on a frosted panel so the captions stay readable over the images.
  //
  //  Rows are built in two steps:
  //   1. `dragonHomeV8Rows` spreads the tiles over R rows longest-first (LPT) so every row's ratio-SUM —
  //      and therefore its HEIGHT — is nearly equal, and every row is full-width (no short leftover row
  //      holding two giant tiles). Tiles are absolutely positioned, so a row does not need to be a
  //      contiguous slice of the list, which is exactly what makes this balance so well.
  //   2. Row height = `(usableWidth − (cols−1)·G) / ratioSum`, so the images keep their own aspect ratio
  //      and the gutter never squeezes them. The row count comes from the desired tile height, and the
  //      rows' natural total is then SEALED to the viewport with one small uniform height factor.
  // ============================================================
  ;function dragonHomeV8G() { return (window.innerWidth || 1280) <= 700 ? 6 : 10; }
  ;function dragonHomeV8M(W) { return W <= 700 ? 6 : 16; }
  // Spread the tiles over `R` rows so every row's ratio-sum (and therefore its HEIGHT, `usableWidth /
  // ratioSum`) is nearly equal: longest-processing-time first — the widest image is placed on the row that
  // is currently the shortest, repeatedly. Tiles are absolutely positioned, so a row does not have to be a
  // contiguous slice of the list; dropping that constraint is exactly what lets LPT balance the rows far
  // better than a contiguous partition can.
  ;function dragonHomeV8Rows(items, R) {
    var rows = [], i, j, pick;
    for (i = 0; i < R; i++) rows.push({ items: [], sum: 0 });
    var order = items.slice().sort(function (a, b) { return b.r - a.r; });
    for (i = 0; i < order.length; i++) {
      pick = 0;
      for (j = 1; j < R; j++) if (rows[j].sum < rows[pick].sum) pick = j;
      rows[pick].items.push(order[i]);
      rows[pick].sum += order[i].r;
    }
    return rows;
  }
  ;function dragonHomeV8Layout() {
    if (dragonHomeVerGet() !== "v8") return;
    var grid = document.querySelector("#dragonHomePage .dragon-home-grid");
    if (!grid) return;
    var W = grid.clientWidth || window.innerWidth || 0;
    var H = grid.clientHeight || 0;
    if (W < 60 || H < 60) return;
    var els = grid.querySelectorAll(".dragon-home-tile"), n = els.length, i, rr;
    if (n < 2) return;
    // Self-correcting tile COUNT: the very first paint usually happens while the grid is not yet at its
    // final height (and the images have not loaded), which yields the wrong tile count for the real
    // viewport. So whenever the optimal count for the CURRENT size differs from what is on screen by more
    // than a couple of tiles, re-provision and let the freshly picked images' `load` events re-run the
    // layout. Guarded by a timestamp so a load-triggered relayout can never ping-pong.
    var nVis = 0;
    for (i = 0; i < n; i++) if (els[i].style.display !== "none") nVis++;
    var nowT = Date.now();
    if (!grid.__v8LastEnsure || (nowT - grid.__v8LastEnsure) > 900) {
      var rat = [];
      for (i = 0; i < n; i++) {
        var im2 = els[i].querySelector("img");
        rat.push((im2 && im2.naturalWidth && im2.naturalHeight) ? (im2.naturalWidth / im2.naturalHeight) : 0);
      }
      var want = dragonHomeV8BestN(rat, W, H);
      if (Math.abs(want - nVis) > 2) {
        grid.__v8LastEnsure = nowT;
        if (dragonHomeV8Ensure(want)) { try { fillTiles(); } catch (e) {} }
        clearTimeout(grid.__v8Retry);
        grid.__v8Retry = setTimeout(function () { try { dragonHomeWallSoon(); } catch (e) {} }, 700);
        return;
      }
    }
    var G = dragonHomeV8G(), MX = dragonHomeV8M(W), MY = MX;
    var AW = Math.max(60, W - 2 * MX);      // usable row width
    var AH = Math.max(60, H - 2 * MY);      // usable column height
    var items = [];
    for (i = 0; i < n; i++) {
      if (els[i].style.display === "none") continue;   // parked surplus tile (see dragonHomeV8Ensure)
      var img = els[i].querySelector("img");
      var r = (img && img.naturalWidth && img.naturalHeight) ? (img.naturalWidth / img.naturalHeight) : 0.72;
      if (!(r > 0.05)) r = 0.72;            // not loaded yet → assume a portrait frame (refined on `load`)
      r = Math.max(0.22, Math.min(3.4, r));
      items.push({ el: els[i], r: r });
    }
    n = items.length;
    if (n < 2) return;
    // ── Rows, and sealing the height ────────────────────────────────────────────────────────────────
    // The row height is `(AW − (cols−1)·G) / rowRatioSum`, so with the mosaic pinned to the full usable
    // width every row is exactly `usableWidth` wide and no image is ever cropped horizontally. The row
    // count comes from the desired tile height; then the rows' natural total is SEALED to the viewport by
    // one small uniform height factor (`c`). `c` is almost always within a couple of percent — the tile
    // count makes it so — and a couple of percent of extra height is invisible (the image covers its box),
    // whereas any leftover would otherwise show as an empty band. Everything stays flush, top and bottom.
    var hT = W <= 700 ? 155 : (W <= 1100 ? 240 : 300);
    var R = Math.max(1, Math.min(8, n, Math.round(AH / hT)));
    var rows = dragonHomeV8Rows(items, R);
    var hs = [], total = 0, h, cn, sm;
    for (rr = 0; rr < R; rr++) {
      cn = rows[rr].items.length;
      sm = rows[rr].sum;
      h = (cn > 0 && sm > 0) ? (AW - (cn - 1) * G) / sm : 0;
      hs.push(h); total += h;
    }
    total += (R - 1) * G;
    var c = total > 0 ? AH / total : 1;
    if (c > 1.16) c = 1.16;
    if (c < 0.86) c = 0.86;
    var totalH = (R - 1) * G;
    for (rr = 0; rr < R; rr++) { hs[rr] *= c; totalH += hs[rr]; }
    var xf, x0, x1, y0, y1, it, nn, isLast, ri;
    var y = MY + Math.max(0, (AH - totalH) / 2);
    for (rr = 0; rr < R; rr++) {
      nn = rows[rr].items.length;
      if (nn <= 0) continue;
      y0 = Math.round(y);
      y1 = Math.round(y + hs[rr]);
      if (y1 <= y0) y1 = y0 + 1;
      xf = MX;
      for (ri = 0; ri < nn; ri++) {
        it = rows[rr].items[ri];
        isLast = (ri === nn - 1);
        x0 = Math.round(xf);
        xf += hs[rr] * it.r;
        x1 = isLast ? Math.round(MX + AW) : Math.round(xf);
        if (x1 <= x0) x1 = x0 + 1;
        it.el.style.left = x0 + "px";
        it.el.style.top = y0 + "px";
        it.el.style.width = (x1 - x0) + "px";
        it.el.style.height = (y1 - y0) + "px";
        xf += G;
      }
      y += hs[rr] + G;
    }
  }
  window.dragonHomeV8Layout = dragonHomeV8Layout;
  // How many tiles should this viewport show? `N = rows² · usableWidth / (usableHeight · meanRatio)` — a
  // phone asks for ~10 tiles, a 27" desktop for ~26, each roughly the size of the desired tile height. It
  // is only a PREFERENCE: the layout seals whatever count it is given by nudging the row heights a hair, so
  // a one-tile wobble while images are still loading is invisible.
  ;function dragonHomeV8BestN(ratios, W, H) {
    var MX = dragonHomeV8M(W);
    var AW = Math.max(60, W - 2 * MX), AH = Math.max(60, H - 2 * MX);
    var hT = W <= 700 ? 155 : (W <= 1100 ? 240 : 300);
    var Rd = Math.max(1, Math.round(AH / hT));
    var s = 0, c = 0, i;
    for (i = 0; i < ratios.length && i < 40; i++) {
      if (ratios[i] > 0.05) { s += Math.max(0.22, Math.min(3.4, ratios[i])); c++; }
    }
    var ra = c ? (s / c) : 0.72;
    var N = Math.round(Rd * Rd * AW / (AH * ra));
    if (!(N >= 1)) N = 16;
    return Math.max(10, Math.min(32, N));
  }
  ;function dragonHomeV8Ensure(N) {
    var grid = document.querySelector("#dragonHomePage .dragon-home-grid");
    if (!grid) return false;
    var i, made = false;
    var ex = grid.querySelectorAll(".dragon-home-tile.dragon-home-x").length;
    var base = grid.querySelectorAll(".dragon-home-tile").length - ex;
    for (i = base + ex; i < N; i++) {
      var tile = document.createElement("div");
      tile.className = "dragon-home-tile dragon-home-x";
      tile.draggable = false;
      tile.style.pointerEvents = "none";
      var nimg = document.createElement("img");
      nimg.loading = "lazy"; nimg.alt = ""; nimg.draggable = false;
      tile.appendChild(nimg);
      grid.appendChild(tile);
      made = true;
    }
    var tiles = grid.querySelectorAll(".dragon-home-tile"), i2, changed = false;
    for (i2 = 0; i2 < tiles.length; i2++) {
      var park = (i2 >= N);
      if ((tiles[i2].style.display === "none") !== park) { tiles[i2].style.display = park ? "none" : ""; changed = true; }
    }
    return made || changed;
  }
  ;function dragonHomeV8Reset() {
    var grid = document.querySelector("#dragonHomePage .dragon-home-grid");
    if (grid) {
      var xs = grid.querySelectorAll(".dragon-home-tile.dragon-home-x"), i;
      for (i = 0; i < xs.length; i++) { try { xs[i].parentNode.removeChild(xs[i]); } catch (e) {} }
      var tiles = grid.querySelectorAll(".dragon-home-tile");
      for (i = 0; i < tiles.length; i++) if (tiles[i].style.display === "none") tiles[i].style.display = "";
      var imgs = grid.querySelectorAll("img");
      for (i = 0; i < imgs.length; i++) imgs[i].__wall = 0;   // re-armed on the next v8 entry
    }
    dragonHomeV7Reset();
  }
  window.dragonHomeV8Reset = dragonHomeV8Reset;
  ;function dragonHomeWallSoon() {
    if (_v7T) clearTimeout(_v7T);
    _v7T = setTimeout(function () {
      _v7T = null;
      // Egon 22.09.2026 — only the wall style that is ACTUALLY on screen may move the tiles: the old
      // `else` branch fell through to the V7 wall for v1–v6 as well, which wrote inline positions over
      // their own CSS layout (and a stale pack could even park tiles for the mosaic).
      try { var _wv = dragonHomeVerGet(); if (_wv === "v8") dragonHomeV8Layout(); else if (_wv === "v7") dragonHomeV7Layout(); } catch (e) {}
    }, 90);
  }
  ;function dragonHomeV8Init() {
    var grid = document.querySelector("#dragonHomePage .dragon-home-grid");
    if (!grid) return;
    if (dragonHomeVerGet() !== "v8") return;   // Egon 22.09.2026 — a stale (superseded) call must not pack the wall
    var W = grid.clientWidth || window.innerWidth || 0, H = grid.clientHeight || 0;
    if (W < 60 || H < 60) return;
    var els0 = grid.querySelectorAll(".dragon-home-tile"), i, ratios = [];
    for (i = 0; i < els0.length; i++) {
      var im0 = els0[i].querySelector("img");
      ratios.push((im0 && im0.naturalWidth && im0.naturalHeight) ? (im0.naturalWidth / im0.naturalHeight) : 0);
    }
    var made = dragonHomeV8Ensure(dragonHomeV8BestN(ratios, W, H));
    var imgs = grid.querySelectorAll("img");
    for (i = 0; i < imgs.length; i++) {
      if (imgs[i].__wall) continue;          // one listener per image, shared by the v7/v8 wall layouts
      imgs[i].__wall = 1;
      imgs[i].addEventListener("load", dragonHomeWallSoon);
    }
    if (made) { try { fillTiles(); } catch (e) {} }   // fetch images for the new tiles (empty tiles only)
    // The grid is `position:fixed`, so its size only changes when the viewport does — but that is exactly
    // when the tile count has to be re-provisioned, and a window `resize` can be missed (e.g. a mobile URL
    // bar collapsing). A ResizeObserver makes the mosaic re-pack for any size change.
    if (!grid.__v8RO && window.ResizeObserver) {
      grid.__v8RO = new ResizeObserver(function () { try { dragonHomeWallSoon(); } catch (e) {} });
      try { grid.__v8RO.observe(grid); } catch (e) {}
    }
    dragonHomeV8Layout();
  }
  window.dragonHomeV8Init = dragonHomeV8Init;
  ;function dragonHomeApplyVer() {
    var p = document.getElementById("dragonHomePage");
    if (!p) return;
    var v = dragonHomeVerGet();
    HOME_VERS.forEach(function (x) { p.classList.toggle("dragon-home-" + x, v === x); });
    // Egon 15.09.2026 — move the header block into the CTA (Generate button) in v6 → floating above the button
    // stops, does not cover the tiles above. In other versions, it is reverted to its old position (the first child of the page).
    try {
      var hero = p.querySelector(".dragon-home-hero");
      var cta = p.querySelector(".dragon-home-cta");
      if (hero && cta) {
        if (v === "v6" || v === "v7" || v === "v8") { if (hero.parentElement !== cta) cta.insertBefore(hero, cta.firstChild); }
        else if (hero.parentElement !== p) { p.insertBefore(hero, p.firstChild); }
      }
      // Egon 15.09.2026 — hero background IMAGE is not wanted in v5/v6 (it was covering the top row images);
      // title should remain as text/glow only. In other versions, the old behavior is preserved.
      // Egon 20.09.2026 — v7 is the v6 arrangement with uncropped tiles, so it is included here too.
      // Egon 21.09.2026 — v8 (mosaic) is the same arrangement, so it is included as well.
      if (hero && (v === "v5" || v === "v6" || v === "v7" || v === "v8")) hero.style.backgroundImage = "none";
    } catch (e) {}
    // Egon 20.09.2026 — v7 seamless wall: the tiles are positioned by JS (justified rows). Entering v7
    // lays them out; leaving v7 CLEARS those inline positions so every other version keeps its own CSS.
    // Egon 21.09.2026 — v8 (mosaic) uses the same JS positioning with gutters/rounded tiles.
    try {
      if (v === "v8") { setTimeout(function () { try { if (dragonHomeVerGet() === "v8") dragonHomeV8Init(); } catch (e) {} }, 60); }
      else {
        // Leaving v8 must remove its extra tiles and un-park the base 16 BEFORE any other version lays them
        // out (v7 included) — otherwise the next style inherits a wrong tile count / hidden tiles.
        dragonHomeV8Reset();
        if (v === "v7") setTimeout(function () { try { if (dragonHomeVerGet() === "v7") dragonHomeV7Init(); } catch (e) {} }, 60);
      }
    } catch (e) {}
    // Egon 15.09.2026 — Align CC button to page center (a few more times once layout/fonts are settled).
    try { [40, 400, 1200].forEach(function (ms) { setTimeout(function () { try { window.dragonHomeCenterCC(); } catch (e) {} }, ms); }); } catch (e) {}
  }
  window.dragonHomeApplyVer = dragonHomeApplyVer; // Egon 20.09.2026 — exposed so the check-up can switch the style without the toast/refill
  window.dragonHomeSetVer = function (v) {
    if (HOME_VERS.indexOf(v) < 0) v = "v8";   // Egon 22.09.2026 — V8 (mosaic) is the default now
    try { localStorage.setItem("dragonHomeVersion", v); } catch (e) {}
    dragonHomeApplyVer();
    // Egon 20.09.2026 — keep the U0001F3E0 Home Page button inside Settings in lockstep with the real value.
    try { if (window._dragonSyncHomeCycle) window._dragonSyncHomeCycle(); } catch (e) {}
    if (typeof dragonToast === "function") dragonToast("\uD83C\uDFE0 home page: " + v.toUpperCase() + " (" + (HOME_VER_DESC[v] || "grid") + ")");
    var grid = document.querySelector("#dragonHomePage .dragon-home-grid");
    if (grid) { var imgs = grid.querySelectorAll("img"); for (var i = 0; i < imgs.length; i++) imgs[i].classList.remove("on"); }
    setTimeout(function () { fillTiles(true); syncHomeFx(); }, 60);
  };
  ;function dragonHomeSeenGet() { try { return JSON.parse(localStorage.getItem("dragonHomeSeen") || "{}") || {}; } catch (e) { return {}; } }
  ;function dragonHomeSeenAdd(ids) {
    var seen = dragonHomeSeenGet(), now = Date.now(), i;
    for (i = 0; i < ids.length; i++) if (ids[i]) seen[ids[i]] = now;
    var ks = Object.keys(seen);
    if (ks.length > 200) { ks.sort(function (a, b) { return seen[a] - seen[b]; }); for (i = 0; i < ks.length - 200; i++) delete seen[ks[i]]; }
    try { localStorage.setItem("dragonHomeSeen", JSON.stringify(seen)); } catch (e) {}
  }
  ;function homeSeriesKey(it) {
    var id = String(it.id || "");
    var p = String(it.prompt || "").slice(0, 64);
    return (id ? id.replace(/[0-9a-f]{6,}$/i, "") : "") + "|" + p;
  }
  // Egon 13.09.2026 — `homeKey`: cooldown tracking is done via id (if not available, via url).
  ;function homeKey(it) { return (it && (it.id || it.url)) || ""; }
  // Egon 13.09.2026 — Cooldown is no longer a PRIORITY, but a HARD FILTER. An image shown within 120 sec
  // does not enter the eligible list → guarantee that "the same visual should not be shown again before 120 sec".
  // (Priority-sorting in the old version would bring back fresh visuals as a last resort when the pool shrank.)
  ;function homeEligible(exclude) {
    var seen = dragonHomeSeenGet(), now = Date.now(), COOLDOWN = 120000;
    var eligible = [], cooling = [], i;
    for (i = 0; i < homeItems.length; i++) {
      var it = homeItems[i]; if (!it) continue;
      var k = homeKey(it); if (!k) continue;
      if (exclude && exclude[k]) continue;
      if (homeIsDead(it.url)) continue; // 18.09.2026 — never re-offer a URL that already hung this page load
      var t = seen[k];
      if (!t || (now - t) >= COOLDOWN) eligible.push(it);
      else cooling.push({ it: it, t: t });
    }
    return { eligible: eligible, cooling: cooling, seen: seen };
  }
  ;function homePick(n, exclude) {
    var r = homeEligible(exclude);
    var picked = [], seriesCount = {}, i;
    // Scattered queue: images that have never been shown come first (let the wall traverse the entire pool), then the old ones whose 120s
    // cooldown has expired. Both groups are shuffled → the queue differs with every change.
    var unseen = [], aged = [];
    for (i = 0; i < r.eligible.length; i++) { (r.seen[homeKey(r.eligible[i])] ? aged : unseen).push(r.eligible[i]); }
    var order = shuffle(unseen).concat(shuffle(aged));
    // At most 1 image from the same series (same prompt) is preferred. This preference is only made within the eligible set,
    // cooldown'u BOZMAZ (eligible daima doluyor).
    ;function takePass(maxPerSeries) {
      for (i = 0; i < order.length && picked.length < n; i++) {
        var it = order[i]; if (it.__p) continue;
        var sk = homeSeriesKey(it);
        if ((seriesCount[sk] || 0) >= maxPerSeries) continue;
        it.__p = 1; seriesCount[sk] = (seriesCount[sk] || 0) + 1; picked.push(it);
      }
    }
    takePass(1); takePass(2); takePass(9e9);
    for (i = 0; i < order.length; i++) delete order[i].__p;
    // Last resort (if the pool is truly too small for the 120s rule): add the coldest images sequentially.
    if (picked.length < n) {
      r.cooling.sort(function (a, b) { return a.t - b.t; });
      for (i = 0; i < r.cooling.length && picked.length < n; i++) picked.push(r.cooling[i].it);
    }
    if (!picked.length) return [];
    dragonHomeSeenAdd(picked.map(homeKey));
    return shuffle(picked);
  }
  // Egon 13.09.2026 — SINGLE TILE CROSSFADE: the old image is moved to the tile's background, the new image
  // softly fades in (0.45s) on top → smooth transition without black flickering.
  ;function dragonHomeCrossfade(img, url, item, depth) {
    if (!img || !url) return;
    if (depth === undefined) depth = 0;
    var tile = img.parentElement;
    var old = img.__url;
    // 18.09.2026 — token: a slow crossfade that a newer one has replaced must not commit (it would
    // re-insert an outdated picture / drop the `on` class on a freshly filled tile).
    var tok = (img.__cf = (img.__cf || 0) + 1);
    var commit = function (finalUrl) {
      if (img.__cf !== tok) return;
      if (tile && old && old !== finalUrl) {
        try {
          tile.style.backgroundImage = "url(\"" + old + "\")";
          tile.style.backgroundSize = "cover";
          tile.style.backgroundPosition = "center";
        } catch (e) {}
      }
      try { img.style.transition = "opacity .45s ease"; } catch (e) {}
      img.classList.remove("on");
      setTimeout(function () {
        if (img.__cf !== tok) return;
        img.__url = url; img.__item = item || { url: url };
        img.src = finalUrl;
        void img.offsetWidth;
        img.classList.add("on");
        setTimeout(function () {
          if (!tile) return;
          try { tile.style.backgroundImage = ""; tile.style.backgroundSize = ""; tile.style.backgroundPosition = ""; } catch (e) {}
        }, 520);
      }, 440);
    };
    // 18.09.2026 — watchdog-covered load: a pick that never answers is blocked for this page load and
    // the tile is handed a different live image instead of silently keeping the old frame.
    homeLoadImage(url, function (finalUrl) {
      if (img.__cf !== tok) return;
      if (finalUrl) { commit(finalUrl); return; }
      homeMarkDead(url);
      if (depth >= 3) return;
      var alt = homeAnyLive();
      if (alt && alt.url) dragonHomeCrossfade(img, alt.url, alt, depth + 1);
    });
  }
  // Egon 13.09.2026 — B RULE: every 30s, RANDOM `k` tiles (default 4) change with a soft transition.
  // - The same image is not shown again before 120s pass (homePick → COOLDOWN).
  // - Changing tiles and their order are RANDOM (scattered) each round → the layout changes every shift.
  // - Images currently on screen cannot enter the new selection (exclude) → no duplicate images on the board.
  // Less network load than changing the entire board at once (A): 4 images are downloaded every 30s instead of 16.
  ;function rotateHomeBatch(k) {
    var grid = document.querySelector("#dragonHomePage .dragon-home-grid");
    if (!grid || !homeItems.length) return;
    var imgs = grid.querySelectorAll("img");
    if (!imgs.length) return;
    k = Math.min(k || 4, imgs.length);
    var shown = {};
    for (var i = 0; i < imgs.length; i++) { var it = imgs[i].__item; if (it) { var _k = homeKey(it); if (_k) shown[_k] = 1; } }
    // Egon 13.09.2026 — Cooldown is counted from the moment of REMOVAL from display: every image staying on screen
    // is stamped as "currently showing" every round. Thus, the 120s counter starts the moment a tile leaves the board →
    // it cannot return before 120s pass (the time a tile spends waiting on the board does not start the counter early).
    dragonHomeSeenAdd(Object.keys(shown));
    // 18.09.2026 — every tick also repairs tiles that never got an image (dead pick / host hang).
    homeRepairEmptyTiles();
    var picks = homePick(k, shown);
    if (!picks.length) return;
    var idxs = [], j;
    for (j = 0; j < imgs.length; j++) idxs.push(j);
    shuffle(idxs);
    for (j = 0; j < picks.length && j < idxs.length; j++) {
      var p = picks[j];
      dragonHomeCrossfade(imgs[idxs[j]], p && p.url, p);
    }
  }
  window.dragonHomeRotateBatch = rotateHomeBatch;
  window.dragonHomeFillTile = homeFillTile;         // test hook (18.09.2026 image-load resilience)
  window.dragonHomeLoadImage = homeLoadImage;
  window.dragonHomeAnyLive = homeAnyLive;
  window.dragonHomeRepairEmptyTiles = homeRepairEmptyTiles;
  window.dragonHomeDiag = function () {
    var r = homeEligible({});
    var withId = 0, withUrl = 0, i;
    for (i = 0; i < homeItems.length; i++) { if (homeItems[i] && homeItems[i].id) withId++; if (homeItems[i] && homeItems[i].url) withUrl++; }
    return { pool: homeItems.length, withId: withId, withUrl: withUrl, eligible: r.eligible.length, cooling: r.cooling.length, seen: Object.keys(dragonHomeSeenGet()).length, dead: Object.keys(homeDead).length, spare: homeSpare.length, refreshing: homePoolRefreshing };
  };
  ;function parseHomeItems(html) {
    var items = [], used = {}, i;
    try {
      var doc = new DOMParser().parseFromString(html, "text/html");
      var nodes = doc.querySelectorAll(".imageCtn");
      for (i = 0; i < nodes.length; i++) {
        var el = nodes[i], img = el.querySelector("img");
        var src = (img && (img.getAttribute("src") || img.getAttribute("data-src"))) || "";
        if (!src || src.indexOf("aigc.uploads.dev") === -1) continue;
        if (el.getAttribute("data-is-n"+"sfw") === "true" || (img && img.getAttribute("data-is-n"+"sfw") === "true")) continue;
        if (used[src]) continue;
        used[src] = 1;
        items.push({
          url: src,
          id: el.getAttribute("data-image-id") || (img && img.getAttribute("data-image-id")) || "",
          prompt: el.getAttribute("data-prompt") || (img && img.getAttribute("data-prompt")) || "",
          seed: el.getAttribute("data-seed") || (img && img.getAttribute("data-seed")) || ""
        });
      }
    } catch (e) {}
    if (items.length < 9) {
      try {
        var all = new DOMParser().parseFromString(html, "text/html").querySelectorAll("img");
        for (i = 0; i < all.length; i++) {
          var s = all[i].getAttribute("src") || "";
          if (s.indexOf("uploads.dev") === -1) continue;
          if (!/(jpe?g|png|webp)/i.test(s)) continue;
          if (used[s]) continue;
          used[s] = 1;
          items.push({ url: s, id: "", prompt: all[i].getAttribute("data-prompt") || "", seed: all[i].getAttribute("data-seed") || "" });
        }
      } catch (e2) {}
    }
    for (i = 0; i < items.length; i++) items[i].__fi = i;
    return items;
  }
  // 18.09.2026 — the pool is adopted through ONE place (so the stored timestamp can never drift) and
  // the localStorage copy is no longer immortal: a stale pool (or one whose images keep dying) is
  // replaced IN THE BACKGROUND — the board on screen is untouched, only later picks benefit.
  ;function homeAdoptPool(items, merge) {
    if (!Array.isArray(items) || items.length < 9) return false;
    if (merge && homeItems.length) {
      // 18.09.2026 — a refresh MERGES instead of replacing: the old URLs are kept (they may still be in
      // the browser cache / HTTP cache and therefore load instantly), the fresh ones come first.
      var have = {}, i;
      for (i = 0; i < items.length; i++) have[homeUrlOf(items[i])] = 1;
      for (i = 0; i < homeItems.length && items.length < 300; i++) {
        var u = homeUrlOf(homeItems[i]);
        if (u && !have[u]) { have[u] = 1; items.push(homeItems[i]); }
      }
    }
    homeItems = items;
    for (var i = 0; i < homeItems.length; i++) homeItems[i].__fi = i;
    homeUrls = homeItems.map(function (x) { return x.url; });
    try { localStorage.setItem("dragonHomeItems", JSON.stringify(homeItems.map(function (x) { return { url: x.url, id: x.id, prompt: x.prompt, seed: x.seed }; }))); } catch (e) {}
    try { localStorage.setItem("dragonHomeItemsTs", String(Date.now())); } catch (e) {}
    try { localStorage.setItem("dragonPhUrls", JSON.stringify(homeUrls.slice(0, 80))); } catch (e) {}
    return true;
  }
  try {
    var _phu = JSON.parse(localStorage.getItem("dragonPhUrls") || "[]");
    if (Array.isArray(_phu) && _phu.length) {
      var _phh = document.head || document.documentElement;
      for (var _phi = 0; _phi < Math.min(12, _phu.length); _phi++) {
        try {
          var _plk = document.createElement("link");
          _plk.rel = "preload"; _plk.as = "image"; _plk.href = _phu[_phi];
          try { _plk.fetchPriority = "high"; } catch (eFP) {}
          _phh.appendChild(_plk);
        } catch (ePL2) {}
      }
    }
  } catch (ePL) {}
  ;function fetchHomePool() {
    var ch = window.generatorName || "bestaigen";
    var url = "https://image-generation.perchance.org/gallery?channel=" + encodeURIComponent(ch) + "&subChannel=public&sort=recent&timeRange=all-time&contentFilter=g";
    var fetchFn = window.dragonSuperFetch || window.fetch;
    return Promise.resolve().then(function () { return fetchFn(url); }).then(function (r) { return r.text(); }).then(function (html) { return parseHomeItems(html); });
  }
  ;function maybeRefreshHomePool() {
    if (homePoolRefreshing) return;
    var now = Date.now();
    if ((now - homeLastPoolTry) < 60000) return;
    var ts = 0;
    try { ts = Number(localStorage.getItem("dragonHomeItemsTs") || 0); } catch (e) {}
    var stale = !ts || (now - ts) > HOME_POOL_TTL || homePoolDeadRatio() > 0.3;
    if (!stale) return;
    homeLastPoolTry = now;
    homePoolRefreshing = true;
    fetchHomePool().then(function (items) {
      homePoolRefreshing = false;
      homeAdoptPool(items, true);
    }).catch(function () { homePoolRefreshing = false; });
  }
  ;function loadHomeUrls() {
    if (homeItems.length > 8) { maybeRefreshHomePool(); return Promise.resolve(homeItems); }
    try {
      var cached = JSON.parse(localStorage.getItem("dragonHomeItems") || "[]");
      if (Array.isArray(cached) && cached.length > 8) {
        homeAdoptPool(cached);
        maybeRefreshHomePool();
        return Promise.resolve(homeItems);
      }
    } catch (e) {}
    return fetchHomePool().then(function (items) {
      homeAdoptPool(items);
      return homeItems;
    }).catch(function () { return homeItems; });
  }
  ;function homeItemFor(it) { return (it && typeof it === "object") ? it : { url: it || "", prompt: "" }; }
  // ---------- 18.09.2026 — HOME IMAGE-LOAD RESILIENCE ----------
  ;function homeUrlOf(it) { return (it && (it.url || (typeof it === "string" ? it : ""))) || ""; }
  ;function homeMarkDead(u) { if (u) homeDead[u] = Date.now(); }
  ;function homeIsDead(u) { var t = u ? homeDead[u] : 0; return !!(t && (Date.now() - t) < HOME_DEAD_TTL); }
  ;function homePoolDeadRatio() {
    if (!homeItems.length) return 0;
    var d = 0;
    for (var i = 0; i < homeItems.length; i++) if (homeIsDead(homeUrlOf(homeItems[i]))) d++;
    return d / homeItems.length;
  }
  // One watchdog-covered loader for every tile image: tries the direct URL, then the proxy on a FAST
  // error, and reports success/failure EXPLICITLY (a hang can never stall a tile again).
  ;function homeLoadImage(url, cb) {
    var done = false, timer = 0;
    ;function finish(ok, finalUrl) {
      if (done) return; done = true;
      try { clearTimeout(timer); } catch (e) {}
      cb(ok ? finalUrl : null);
    }
    ;function arm() { try { clearTimeout(timer); } catch (e) {} timer = setTimeout(function () { finish(false, null); }, HOME_IMG_TIMEOUT); }
    ;function tryProxy() {
      if (done) return;
      var p = "";
      try { p = window.dragonProxiedUrl ? window.dragonProxiedUrl(url) : ""; } catch (e) {}
      if (!p || p === url) { finish(false, null); return; }
      var im2 = new Image();
      im2.onload = function () { finish(true, p); };
      im2.onerror = function () { finish(false, null); };
      arm();
      im2.src = p;
    }
    var im = new Image();
    im.onload = function () { finish(true, url); };
    im.onerror = function () { tryProxy(); };
    arm();
    im.src = url;
  }
  ;function homeNextSpare() {
    while (homeSpare.length) {
      var it = homeSpare.shift(), u = homeUrlOf(it);
      if (u && !homeIsDead(u)) return it;
    }
    return null;
  }
  // Any pool image that is neither dead nor (first pass) already on the board — used when a tile's
  // pick dies, so a blank tile can be filled without spending the 120s cooldown pool.
  ;function homeAnyLive() {
    var shown = {}, grid = document.querySelector("#dragonHomePage .dragon-home-grid"), i, it, u;
    if (grid) { var im = grid.querySelectorAll("img"); for (i = 0; i < im.length; i++) { if (im[i].__url) shown[im[i].__url] = 1; } }
    var pass, pool = [];
    for (pass = 0; pass < 2; pass++) {
      pool = [];
      for (i = 0; i < homeItems.length; i++) {
        it = homeItems[i]; if (!it) continue;
        u = homeUrlOf(it);
        if (!u || homeIsDead(u)) continue;
        if (!pass && shown[u]) continue;
        pool.push(it);
      }
      if (pool.length) break;
    }
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }
  ;function homeFillTile(img, it, depth) {
    if (!img) return;
    var item = homeItemFor(it), u = homeUrlOf(item);
    if (!u || homeIsDead(u)) {
      if (depth < HOME_FILL_TRIES) { var s0 = homeNextSpare(); if (s0) { homeFillTile(img, s0, depth + 1); return; } }
      return;
    }
    img.__cf = (img.__cf || 0) + 1; // cancels any in-flight crossfade on this tile
    img.__item = item; img.__url = u;
    homeLoadImage(u, function (finalUrl) {
      // A LATE answer must never touch a tile that a newer fill has already taken over — otherwise a
      // stale failure could strip the `on` class (tile invisible even though its image is fine) or a
      // stale success could overwrite a newer picture.
      if (img.__url !== u) return;
      if (!finalUrl) {
        homeMarkDead(u);
        img.__url = ""; img.__item = null;
        try { img.classList.remove("on"); } catch (e) {}
        if (depth < HOME_FILL_TRIES) {
          var nx = homeNextSpare() || homeAnyLive();
          if (nx) { homeFillTile(img, nx, depth + 1); return; }
        }
        return;
      }
      img.src = finalUrl;
      setTimeout(function () { if (img.__url === u) { try { img.classList.add("on"); } catch (e) {} } }, 0);
    });
  }
  // Every rotation tick also repairs tiles that never got an image (dead pick / host hang), so the
  // board heals itself while the page stays open.
  ;function homeRepairEmptyTiles() {
    var grid = document.querySelector("#dragonHomePage .dragon-home-grid");
    if (!grid || !homeItems.length) return;
    var imgs = grid.querySelectorAll("img"), i;
    for (i = 0; i < imgs.length; i++) {
      if (imgs[i].__url) continue;
      var it = homeAnyLive();
      if (!it) return;
      homeFillTile(imgs[i], it, 0);
    }
  }
  ;function fillTiles(force) {
    var grid = document.querySelector("#dragonHomePage .dragon-home-grid");
    if (!grid) return;
    var imgs = grid.querySelectorAll("img");
    if (!imgs.length) return;
    if (!homeItems.length && !homeUrls.length) {
      for (var z = 0; z < imgs.length; z++) { imgs[z].parentElement.style.background = "linear-gradient(145deg,#241a33,#0d0d11)"; }
      return;
    }
    if (homeFilling && !force) return;
    homeFilling = true;
    // Egon 13.09.2026 — IF NOT force (re-entering Home), images on the board are PRESERVED; new images are pulled
    // only for empty tiles. Thus, entering/exiting the page does not consume the 120s cooldown.
    var picks;
    if (homeItems.length) {
      picks = [];
      var missingIdx = [], fi;
      for (fi = 0; fi < imgs.length; fi++) {
        var kept = (!force && imgs[fi].__item && imgs[fi].__url) ? imgs[fi].__item : null;
        picks.push(kept);
        if (!kept) missingIdx.push(fi);
      }
      homeSpare = [];
      if (missingIdx.length) {
        // 18.09.2026 — ask for SPARES too: if a tile's pick never answers it is swapped to the next
        // spare immediately instead of being left blank.
        var extra = homePick(missingIdx.length + 12);
        for (fi = 0; fi < missingIdx.length; fi++) picks[missingIdx[fi]] = extra[fi] || null;
        homeSpare = extra.slice(missingIdx.length);
      }
    } else {
      homeSpare = [];
      picks = shuffle(homeUrls.slice());
      homeSpare = picks.slice(imgs.length);
    }
    // Egon 13.09.2026 — v2/v3/v4 hero banner gets the first picked image as its background.
    // Egon 15.09.2026 — EXCEPT v5/v6: in these versions, an image background is NOT PLACED on the hero (so it doesn't cover the top row).
    var _hpg = document.getElementById("dragonHomePage");
    var _hmm = _hpg && _hpg.className.match(/dragon-home-(v\d)/);
    var _hv = _hmm ? _hmm[1] : "";
    var heroEl = document.querySelector("#dragonHomePage .dragon-home-hero");
    if (heroEl && picks && picks.length && _hv !== "v5" && _hv !== "v6" && _hv !== "v7" && _hv !== "v8") {
      var firstIt = homeItemFor(picks[0]);
      if (firstIt && firstIt.url) heroEl.style.backgroundImage = "linear-gradient(180deg,rgba(11,11,15,.2),rgba(11,11,15,.9)), url('" + firstIt.url + "')";
    }
    for (var _ei = 0; _ei < Math.min(8, imgs.length); _ei++) {
      try { imgs[_ei].loading = "eager"; imgs[_ei].fetchPriority = "high"; imgs[_ei].decoding = "async"; } catch (eEI) {}
    }
    for (var i = 0; i < imgs.length; i++) {
      if (!picks[i]) continue;
      homeFillTile(imgs[i], picks[i], 0);
    }
    homeFilling = false;
  }
  ;function buildHomePage() {
    if (document.getElementById("dragonHomePage")) { dragonHomeApplyVer(); return; }
    var p = document.createElement("div");
    p.id = "dragonHomePage";
    p.innerHTML =
      "<div class='dragon-home-hero'>" +
        // Egon 15.09.2026 — REMOVED unapproved dragon+sparkle logo added during production (show first, get approval).
        // REPOSITORY: "<img class='dragon-home-logo' src='https://user.uploads.dev/file/3a7a50cdfb130bbec4255101330a95ef.jpg' alt='Best AI Image Generator logo'>" +
        // Egon 15.09.2026 — Title is now "✨ BESTAIGEN ✨" (URL + generator name) and immediately below
        // the phrase "Best Ai Image Generator"; both together provide brand/link reinforcement.
        "<div class='dragon-home-title'><span class='dragon-spark dragon-spark-l'>✨</span><span class='dragon-3d'>BESTAIGEN</span><span class='dragon-spark dragon-spark-r'>✨</span></div>" +
        "<div class='dragon-home-sub'>Best Ai Image Generator</div>" +
      "</div>" +
      "<div class='dragon-home-grid'></div>" +
      // Egon 15.09.2026 — Home CTA new layout: title (moved here in v6) → 2 spaces → GENERATE →
      // caption → 2 spaces → GALLERIES → caption. Captions show current counts.
      // Egon 15.09.2026 — NEW CTA layout: each button + 2x spaces BELOW + its corresponding description.
      // CC button is aligned to the EXACT center of the page via JS (dragonHomeCenterCC).
      "<div class='dragon-home-cta'>" +
        "<button type='button' id='dragonHomeGenBtn'><span class='dragon-spark-em'>\u2728</span> Generate <span class='dragon-spark-em dragon-spark-em-r'>\u2728</span></button>" +
        "<div class='dragon-home-gap'></div><div class='dragon-home-gap'></div>" +
        "<div class='dragon-home-cta-sub'>Tap to create your own image with over 400 art styles \u2014 or get help from our AI Artist and Helper!</div>" +
        "<div class='dragon-home-gap'></div><div class='dragon-home-gap'></div>" +
        "<button type='button' id='dragonHomeCharBtn' class='dragon-home-char-btn'><span class='dragon-dancer dragon-dancer-l'>\uD83D\uDC83</span> Character Creation <span class='dragon-dancer dragon-dancer-r'>\uD83D\uDC83</span></button>" +
        "<div class='dragon-home-gap'></div><div class='dragon-home-gap'></div>" +
        "<div class='dragon-home-cta-sub'>Tap to design your own character step by step \u2014 or select one of our" + dragonHomePremadePhrase() + "!</div>" +
        "<div class='dragon-home-gap'></div><div class='dragon-home-gap'></div>" +
        "<button type='button' id='dragonHomeGalBtn' class='dragon-home-gal-btn'>\uD83D\uDDBC\uFE0F Galleries 🖼️</button>" +
        "<div class='dragon-home-gap'></div><div class='dragon-home-gap'></div>" +
        "<div class='dragon-home-cta-sub'>Tap to view over 1 million images from 1,000+ galleries \u2014 like and save to a single Private Gallery</div>" +
        "<div class='dragon-home-gap'></div><div class='dragon-home-gap'></div>" +
        // Egon 29.09.2026 — 👥 SOCIAL: same design/size as the other Home CTA buttons, opens the Social page.
        "<button type='button' id='dragonHomeSocialBtn' class='dragon-home-social-btn' title='Ai Chat \u2014 Dexa and character bots'>\u2728 Ai Chat \u2728</button>" +
        "<div class='dragon-home-gap'></div><div class='dragon-home-gap'></div>" +
        "<div class='dragon-home-cta-sub'>Tap to open the Ai Chat page \u2014 chatting with Dexa and the character bots moves in with the chat build...</div>" +
      "</div>";
    // The Home corner 🔊 music button is gone: the generator has no background music any more, so
    // the Home page carries no music control at all.
    document.body.appendChild(p);
    dragonHomeApplyVer();
    try { dragonHomePremadeCaption(); [80, 500, 1500].forEach(function (ms) { setTimeout(dragonHomePremadeCaption, ms); }); } catch (e) {}
    var grid = p.querySelector(".dragon-home-grid");
    for (var i = 0; i < 16; i++) {
      var tile = document.createElement("div");
      tile.className = "dragon-home-tile";
      var img = document.createElement("img");
      img.loading = "lazy"; img.alt = "";
      img.draggable = false;
      tile.draggable = false;
      tile.appendChild(img);
      // Egon 13.09.2026 — HOME IMAGES ARE NOW NON-CLICKABLE (Egon: "displayed images should not be clickable;
      // only Generate and Galleries buttons on the page should be clickable"). The old `tile.onclick`
      // that opened the lightbox was REMOVED (REPOSITORY). Also protected via CSS `pointer-events:none`.
      tile.style.pointerEvents = "none";
      grid.appendChild(tile);
    }
    var ctaBtn = p.querySelector("#dragonHomeGenBtn");
    if (ctaBtn) ctaBtn.onclick = function (e) {
      e.stopPropagation();
      if (window.dragonGoPage) window.dragonGoPage("generate");
    };
    // Egon 15.09.2026 — GALLERIES button (Home CTA equivalent of the old Show Gallery) → opens the Galleries page.
    var galBtn = p.querySelector("#dragonHomeGalBtn");
    if (galBtn) galBtn.onclick = function (e) {
      e.stopPropagation();
      if (window.dragonGoPage) window.dragonGoPage("gallery");
    };
    // Egon 14.09.2026 — CHARACTER CREATION button (between Generate and Galleries) → character page.
    var charBtn = p.querySelector("#dragonHomeCharBtn");
    if (charBtn) charBtn.onclick = function (e) {
      e.stopPropagation();
      if (window.dragonGoPage) window.dragonGoPage("character");
    };
    // Egon 29.09.2026 — Ai Chat button → the Ai Chat (social) page (same as the navbar's Ai Chat).
    var socialBtn = p.querySelector("#dragonHomeSocialBtn");
    if (socialBtn) socialBtn.onclick = function (e) {
      e.stopPropagation();
      if (window.dragonGoPage) window.dragonGoPage("social");
    };
  }
  ;function startHomeRot() {
    dragonHomeApplyVer();
    fillTiles();
    // PRESERVE THE BOARD ON RE-ENTRY: fillTiles() without force keeps the tiles already on the board and only
    // fills empty tiles. Re-entering Home (or pressing the Home button) must NOT re-randomize the showcase —
    // image changes only come from the scheduled rotation algorithm (rotateHomeBatch / homePick cooldown rule).
    loadHomeUrls().then(function () { fillTiles(); syncHomeFx(); });
    // Egon 13.09.2026 — Return is 5min instead of 60sec in Lite mode (less network/CPU).
    // Egon 15.09.2026 — cycle time 60sec → 20sec (still sparse in Lite mode: 5min).
    var rotMs = (function () { try { return localStorage.dragonLite === "1" ? 300000 : 30000; } catch (e) { return 30000; } })();
    if (!homeRotTimer) homeRotTimer = setInterval(function () {
      // Egon 13.09.2026 — RULE B: Every 30 sec, 4 RANDOM tiles change with a soft crossfade
      // (instead of changing the whole board at once). 120 sec repeat-ban + shuffled order inside `homePick`;
      // images currently on screen do not enter the new selection. ~4x less network load according to rule A.
      rotateHomeBatch(4);
    }, rotMs);
    syncHomeFx();
  }
  ;function stopHomeRot() {
    if (homeRotTimer) { clearInterval(homeRotTimer); homeRotTimer = null; }
    stopHomeFx();
  }
  ;function homeIsActive() { try { return (document.documentElement.getAttribute("data-dragon-page") || "home") === "home"; } catch (e) { return true; } }
  ;function randomHomeItem() {
    if (!homeItems.length) return null;
    var it = homeItems[Math.floor(Math.random() * homeItems.length)];
    return (it && it.url) ? it : null;
  }
  ;function applyTileImg(img, url, item, fade) {
    if (!img || !url) return;
    var pre = new Image();
    pre.onload = function () {
      if (fade) { try { img.classList.remove("on"); } catch (e) {} }
      img.__url = url; img.__item = item || { url: url };
      img.src = url;
      setTimeout(function () { try { img.classList.add("on"); } catch (e) {} }, fade ? 30 : 0);
    };
    pre.onerror = function () {
      var p = (window.dragonProxiedUrl ? window.dragonProxiedUrl(url) : url);
      if (!p) return;
      img.__url = url; img.__item = item || { url: url };
      img.src = p;
      try { img.classList.add("on"); } catch (e) {}
    };
    pre.src = url;
  }
  // V5 spotlight: every turn, replace 1-2 RANDOM tiles with another random image (NOT all at once).
  ;function startSpotlightSwap() {
    if (homeSpotTimer) return;
    var schedule = function () { try { return localStorage.dragonLite === "1" ? 9000 : (1800 + Math.random() * 2800); } catch (e) { return 2500; } };
    var loop = function () {
      homeSpotTimer = setTimeout(function () {
        try {
          if (dragonHomeVerGet() === "v5" && homeIsActive()) {
            var grid = document.querySelector("#dragonHomePage .dragon-home-grid");
            if (grid && homeItems.length) {
              var imgs = grid.querySelectorAll("img");
              var k = 1 + Math.floor(Math.random() * 2);
              for (var n = 0; n < k && imgs.length; n++) {
                var img = imgs[Math.floor(Math.random() * imgs.length)];
                var it = null, guard = 0;
                do { it = randomHomeItem(); guard++; } while (it && it.url === img.__url && guard < 8);
                if (it && it.url && it.url !== img.__url) applyTileImg(img, it.url, it, true);
              }
            }
          }
        } catch (e) {}
        loop();
      }, schedule());
    };
    loop();
  }
  // V6 conveyor: NEW image to top-left every 3 sec; others shift right, wraps to the
  // start of the next row at the end of the row; the bottom-right one drops (snake/loop).
  ;function startConveyor() {
    if (homeConvTimer) return;
    var cols = 4;
    var seedSeq = function () {
      var grid = document.querySelector("#dragonHomePage .dragon-home-grid");
      if (!grid) { homeSeq = []; return; }
      homeSeq = [];
      var imgs = grid.querySelectorAll("img");
      for (var i = 0; i < imgs.length; i++) homeSeq.push(imgs[i].__item || (imgs[i].__url ? { url: imgs[i].__url } : null));
    };
    var step = function () {
      homeConvTimer = setTimeout(function () {
        try {
          if (dragonHomeVerGet() === "v6" && homeIsActive()) {
            var grid = document.querySelector("#dragonHomePage .dragon-home-grid");
            if (grid && homeItems.length) {
              var imgs = grid.querySelectorAll("img");
              if (!homeSeq.length || homeSeq.length !== imgs.length) seedSeq();
              var n = imgs.length;
              var next = [randomHomeItem()];
              for (var i = 1; i < n; i++) next.push(homeSeq[i - 1] || null);
              for (var j = 0; j < n; j++) {
                var img = imgs[j], it = next[j];
                if (!it || !it.url) continue;
                var gc = img.getBoundingClientRect();
                var fromX = 0, fromY = 0;
                if (j > 0) { if (j % cols === 0) { fromY = -(gc.height + 4); } else { fromX = -(gc.width + 4); } }
                img.style.transition = "none";
                img.style.transform = (j > 0) ? ("translate(" + fromX + "px," + fromY + "px)") : "none";
                img.style.opacity = (j > 0) ? "1" : "0";
                (function (im, itm) {
                  var pre = new Image();
                  pre.onload = function () { im.__url = itm.url; im.__item = itm; im.src = itm.url; };
                  pre.onerror = function () { var p = window.dragonProxiedUrl ? window.dragonProxiedUrl(itm.url) : itm.url; if (p) { im.__url = itm.url; im.__item = itm; im.src = p; } };
                  pre.src = itm.url;
                })(img, it);
                void img.offsetWidth; /* reflow */
                img.style.transition = "transform .55s ease, opacity .55s ease";
                img.style.transform = "translate(0,0)";
                img.style.opacity = "1";
              }
              homeSeq = next;
            }
          }
        } catch (e) {}
        step();
      }, (function () { try { return localStorage.dragonLite === "1" ? 9000 : 3000; } catch (e) { return 3000; } })());
    };
    step();
  }
  ;function stopHomeFx() {
    if (homeSpotTimer) { clearTimeout(homeSpotTimer); homeSpotTimer = null; }
    if (homeConvTimer) { clearTimeout(homeConvTimer); homeConvTimer = null; }
  }
  // Egon 15.09.2026 — v5 spotlight + v6 conveyor fast (2-3 sec) effects DISABLED (DEPOT);
  // instead, a single, slow (20 sec) bulk loop runs at `startHomeRot`. `startSpotlightSwap` and
  // `startConveyor` functions were not deleted (kept above for reference).
  ;function syncHomeFx() {
    stopHomeFx();
  }
  window.syncHomeFx = syncHomeFx;

  // ============================================================
  //  HISTORY PAGE (Egon 11.09.2026 v2) — a real full-screen page (not a modal window).
  //  Tabs: 🖼️ Recent Created Images (responsive card grid, click → full lightbox) and
  //  📚 Prompt History, your own (with preview + "x ago" time). Generate → closes page and runs
  //  the prompt on the Generate page, scrolling to the generated images area.
  // ============================================================
  ;function histFmtMs(t) {
    var d = Date.now() - (t || 0);
    if (d < 60000) return "just now";
    if (d < 3600000) return Math.floor(d / 60000) + "m ago";
    if (d < 86400000) return Math.floor(d / 3600000) + "h ago";
    return Math.floor(d / 86400000) + "d ago";
  }
  ;function histFmtSec(t) { return histFmtMs((t || 0) * 1000); }
  ;function histEl(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }
  ;function histBtn(label, title, fn, style) {
    var b = document.createElement("button");
    b.type = "button"; b.textContent = label; if (title) b.title = title;
    // Egon 29.10.2026 (A18) — every history-bar button names itself for screen readers.
    try { b.setAttribute("aria-label", title || String(label)); } catch (eA) {}
    b.style.cssText = style || "font-size:.62rem; padding:.22rem .4rem; border:1px solid #6a6a78; background:linear-gradient(145deg,#24242d,#131318); color:#ccc; border-radius:6px; cursor:pointer;";
    b.onclick = function (e) { e.stopPropagation(); try { fn(); } catch (er) {} };
    return b;
  }
  // Close the page and generate the given prompt on the Generate page (full flow).
  ;function histGenerate(prompt, seed) {
    if (window.dragonGoPage) window.dragonGoPage("generate");
    // Background one-shot seed — never writes the seed <input>, so the seed-lock button stays untouched.
    if (seed != null && String(seed).replace(/\D/g, "") !== "") { if (window.dragonForceSeed) window.dragonForceSeed(seed); }
    if (window.dragonSetDesc) window.dragonSetDesc(prompt);
    if (window.dragonTriggerGen) window.dragonTriggerGen();
    else toast("\u26A0\uFE0F generate not ready");
  }
  ;function histOpenImage(en) {
    var go = function (url) {
      if (!url) return;
      // Egon 13.09.2026 — To make Prompt Info work, pass the prompt/seed/neg/gs along with the image.
      var item = { url: url, prompt: en.p || "", neg: en.neg || "", seed: en.seed, gs: en.gs };
      // Egon 12.09.2026 — ALL Image History list is moved to lightbox → clicking RIGHT of the image
      // goes to the next, clicking LEFT goes to the previous history image (standard behavior).
      var merged = [], arr = null, li = 0;
      try { merged = (window.dragonHistGetMerged && window.dragonHistGetMerged()) || []; } catch (e) { merged = []; }
      if (merged.length > 1) {
        var mem = {};
        try { mem = (typeof histFullMem !== "undefined" && histFullMem) || {}; } catch (e) { mem = {}; }
        arr = merged.map(function (x) {
          return { url: x.full || (x.id && mem[x.id]) || x.thumb || "", prompt: x.p || "", neg: x.neg || "", seed: x.seed, gs: x.gs, isFlagged: x.isFlagged };
        });
        li = merged.indexOf(en);
        if (li < 0) li = 0;
        arr[li] = item;
      }
      if (window.dragonZoomLightbox) window.dragonZoomLightbox(item, null, arr, li, null, { pushPublic: true });
      else window.open(url, "_blank");
      // Upgrade neighbor URLs to the best source (full → ~1000px medium): since `arr` is shared via
      // reference, the clear image opens instead of a SMALL thumbnail when navigating forward/backward in lightbox.
      if (arr && window.dragonHistResolveImage) {
        for (var k = 0; k < arr.length; k++) (function (k) {
          if (k === li) return;
          try { window.dragonHistResolveImage(merged[k], function (u) { if (u && arr[k]) arr[k].url = u; }); } catch (e) {}
        })(k);
      }
    };
    if (window.dragonHistResolveImage) window.dragonHistResolveImage(en, go);
    else go(en.thumb || "");
  }
  // 👥 SOCIAL PAGE — MOVED OUT of this file on 27.09.2026 (Egon, W-DOC267): every Social-page/document item
  // lives in src/social/ now. The page builder is src/social/social-page.js, loaded from index.html right
  // after this file, and it exposes window.dragonBuildSocialPage; see src/social/README.md for the register.
  ;function buildSocialPage() {
    if (window.dragonBuildSocialPage) { try { window.dragonBuildSocialPage(); return; } catch (e) {} }
  }
  // ===================== 🕘 THE OLD HISTORY PAGE — REMOVED (Egon 26.09.2026) =====================
  // Egon 26.09.2026 order: drop the old Control Panel button (parked in DEPO) and clean up the old history page + its code.
  // The whole #dragonHistoryPage (buildHistoryPage / attachHistTop / renderHistoryPage + its CSS block)
  // is GONE. It had no navbar button any more and every surviving tool it held lives in the 📝 Prompt
  // Panel now (Prompt Bank · Prompt History + Image History tiles under the output area).
  // The removed code is parked in Librarybook.enc (DEPO, W-CLEAN338) — restore from there if ever needed
  // (CSS + buildHistoryPage/attachHistTop/renderHistoryPage/renderHistoryRecent + the old entry points;
  // the DEPO entry carries an honesty note about the archive source).
  // window.dragonHistoryPanel / dragonGenHistoryPanel are re-pointed at the
  // Prompt Panel further down this file (they are defined AFTER this point on purpose, so they win over
  // the older definitions in src/dragon-gen-history.js).
  // Egon 12.09.2026 — Recent Created Images tiles were blurry because they used the tiny (96px)
  // history thumbnail stretched to ~190px. Resolve a higher-res source (full / ~1000px medium) and
  // swap it in for tiles near the viewport; the first rows load eagerly so they never sit blank.
  var _histIO = null;
  ;function _histUpgrade(img, en) {
    if (!img || !window.dragonHistResolveImage) return;
    window.dragonHistResolveImage(en, function (url) {
      try { if (url && url !== img.getAttribute("src")) img.src = url; } catch (e) {}
    });
  }
  ;function _histObserveImg(img, en, onSeen) {
    if (!window.IntersectionObserver) { _histUpgrade(img, en); if (onSeen) { try { onSeen(); } catch (e) {} } return; }
    if (!_histIO) {
      // The tiles live in the normal page flow (under the output area), so the observer watches the
      // VIEWPORT (root: null). A non-scrolling element as root would make every tile intersect at once.
      var rootEl = null;
      _histIO = new IntersectionObserver(function (entries) {
        for (var k = 0; k < entries.length; k++) {
          var ent = entries[k];
          if (ent.isIntersecting) {
            try { _histIO.unobserve(ent.target); } catch (e) {}
            _histUpgrade(ent.target, ent.target.__dragonHistEn);
            // Once a tile becomes visible, resolve its send-button state.
            if (ent.target.__dragonOnSeen) { try { ent.target.__dragonOnSeen(); } catch (e) {} }
          }
        }
      }, { root: rootEl || null, rootMargin: "400px 0px" });
    }
    img.__dragonHistEn = en;
    img.__dragonOnSeen = onSeen || null;
    _histIO.observe(img);
  }
  ;function renderHistoryRecent(body) {
    if (_histIO) { try { _histIO.disconnect(); } catch (e) {} _histIO = null; }
    var merged = (window.dragonHistGetMerged && window.dragonHistGetMerged()) || [];
    var grid = histEl("div", "dragon-hist-grid");
    if (!merged.length) {
      var em = histEl("div", "dragon-hist-empty");
      em.textContent = "No history yet \u2014 generate a few images and they'll show up here.";
      body.appendChild(em); return;
    }
    var _pending = [];
    // The send-button state of a card is resolved lazily: dimmed until it is proven fresh.
    ;function histPushStateFor(it) {
      if (!it || !it.sendB) return;
      var mem = {};
      try { mem = (typeof histFullMem !== "undefined" && histFullMem) || {}; } catch (e) { mem = {}; }
      var u = it.en.full || (it.en.id && mem[it.en.id]) || it.en.thumb || "";
      window.dragonRefreshPushState(it.sendB, u, it.en.p || "", it.en.seed);
    }
    // Tiles are grouped under a day heading (Today / Yesterday / DD.MM.YYYY) built from each tile's own
    // timestamp, newest day first.
    ;function _histDayKey(t) { var d = new Date(t || 0); return d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate(); }
    ;function _histDayStamp(t) {
      var d = new Date(t || 0);
      return (d.getDate() < 10 ? "0" : "") + d.getDate() + "." + (d.getMonth() < 9 ? "0" : "") + (d.getMonth() + 1) + "." + d.getFullYear();
    }
    ;function _histDayLabel(t) {
      var now = new Date(), y = new Date(now.getTime() - 86400000);
      if (_histDayKey(t) === _histDayKey(now.getTime())) return "Today \u00B7 " + _histDayStamp(t);
      if (_histDayKey(t) === _histDayKey(y.getTime())) return "Yesterday \u00B7 " + _histDayStamp(t);
      return _histDayStamp(t);
    }
    var _histLastDay = null;
    for (var i = 0; i < merged.length; i++) (function (en) {
      if (_histDayKey(en.t) !== _histLastDay) {
        _histLastDay = _histDayKey(en.t);
        var dayEl = histEl("div", "dragon-hist-day");
        dayEl.textContent = _histDayLabel(en.t);
        grid.appendChild(dayEl);
      }
      var card = histEl("div", "dragon-hist-card");
      var img = document.createElement("img");
      img.loading = (i < 8) ? "eager" : "lazy"; img.alt = ""; img.src = en.thumb || ""; img.title = "Click To View Full Image";
      img.onclick = function () { histOpenImage(en); };
      var cap = histEl("div", "dragon-hist-cap"); cap.textContent = en.p || "";
      // The prompt text under a tile stays hidden: a tile shows only its picture, and the full prompt is
      // readable from the "Prompt Info" button in the lightbox. The gallery upload TITLE is not the
      // prompt, so it IS shown (Egon 12.10.2026).
      if (en.stitle) { cap.textContent = en.stitle; cap.title = en.sdesc || en.stitle; }
      else cap.style.display = "none";
      var meta = histEl("div", "dragon-hist-meta");
      meta.textContent = histFmtMs(en.t) + (en.seed ? " \u00B7 seed " + en.seed : "") + (en.res ? " \u00B7 " + en.res : "") + (en._session ? " \u00B7 this session" : "") + (en.sdate ? " \u00B7 \uD83D\uDCC5 " + en.sdate : "");
      var acts = histEl("div", "dragon-hist-acts");
      // The action strip holds a delete button, a generate-this-prompt button and a send-to-public-gallery
      // button; the send button stays dimmed and not clickable until dragonRefreshPushState proves the image
      // is fresh in this session.
      var delB = histBtn("\uD83D\uDDD1\uFE0F", "Delete this image", function () { if (window.dragonHistDelete) window.dragonHistDelete(en); card.remove(); });
      var genB = histBtn("\u2728 Generate", "Generate this prompt on the Generate page", function () { histGenerate(en.p, en.seed); });
      var sendB = histBtn("\uD83D\uDCEE", "Send to Public Gallery", function () {
        if (!sendB.__dragonPushOk) return;
        var _mem = {};
        try { _mem = (typeof histFullMem !== "undefined" && histFullMem) || {}; } catch (e) { _mem = {}; }
        var _u = en.full || (en.id && _mem[en.id]) || en.thumb || "";
        if (window.dragonSendToPublicGallery) window.dragonSendToPublicGallery(_u, "BestAiGen", en.p || "", sendB, undefined, en.seed);
      });
      window.dragonSetPushState(sendB, false);
      acts.append(delB, genB, sendB);
      card.append(img, cap, meta, acts);
      grid.appendChild(card);
      _pending.push({ img: img, en: en, sendB: sendB });
    })(merged[i]);
    // "Clear all" is not drawn in the tile grid: it is the small button at the FAR RIGHT of the Image
    // History dropdown head row (dragonImgHistEnsure / #dragonImageHistClearBtn), shown only while that
    // panel is open. The retired in-grid toolbar is parked in the Librarybook DEPO.
    body.appendChild(grid);
    // Observe/upgrade tiles only AFTER they are attached: observing detached nodes made the
    // IntersectionObserver never fire, leaving a stretched, blurry thumb.
    if (window.dragonHistResolveImage) {
      for (var _q = 0; _q < _pending.length; _q++) (function (it, q) {
        if (q < 12) { _histUpgrade(it.img, it.en); histPushStateFor(it); }
        else _histObserveImg(it.img, it.en, function () { histPushStateFor(it); });
      })(_pending[_q], _q);
    }
  }
  // ═══════════════ 🖼️ THE NEW IMAGE HISTORY CARD (WP-UI005, Egon 27.09.2026) ═══════════════
  // Egon: "⭐ bu aksiyon butonlarından kalkacak görselin sağ üstüne taşınacak ... ℹ️ da zaten lightbox'ta
  // olan buton lightbox'tan copy/paste görselin sol üstüne gelecek. 📮 bu zaten var olan buton bunu da sol
  // alta koyacaksın."
  //  • the picture is shown FULL and UNCROPPED,
  //  • ℹ️ top-left · ⭐ top-right · 📮 bottom-left · 🔄 new seed bottom-right · 🔄 same seed above it are
  //    painted ON the picture by src/dragon-image-card.js (the SAME helpers the lightbox uses),
  //  • the strip UNDER the picture keeps every per-image button except ⭐, plus 🗑️ Delete as its
  //    leftmost item, and ✨ Generate is gone.
  // The grid is RECONCILED, never rebuilt (rule I145): every card owns its node for life, so the picture
  // already loaded into it is never thrown away and re-fetched when a new entry arrives.
  ;function dragonHistDayKey(t) { var d = new Date(t || 0); return d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate(); }
  ;function dragonHistDayStamp(t) {
    var d = new Date(t || 0);
    return (d.getDate() < 10 ? "0" : "") + d.getDate() + "." + (d.getMonth() < 9 ? "0" : "") + (d.getMonth() + 1) + "." + d.getFullYear();
  }
  ;function dragonHistDayLabel(t) {
    var now = new Date(), y = new Date(now.getTime() - 86400000);
    if (dragonHistDayKey(t) === dragonHistDayKey(now.getTime())) return "Today \u00B7 " + dragonHistDayStamp(t);
    if (dragonHistDayKey(t) === dragonHistDayKey(y.getTime())) return "Yesterday \u00B7 " + dragonHistDayStamp(t);
    return dragonHistDayStamp(t);
  }
  ;function histAct(label, title, cls, fn) {
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.title = title;
    b.setAttribute("aria-label", title);
    if (cls) b.className = cls;
    b.addEventListener("click", function (e) { e.stopPropagation(); e.preventDefault(); try { fn(); } catch (er) { try { console.warn("histAct", er); } catch (e2) {} } });
    return b;
  }
  ;function dragonHistCard(en, index) {
    var card = histEl("div", "dragon-hist-card");
    card.__dragonEn = en;
    try { en.__card = card; } catch (e) {}

    // the picture + the overlay that floats exactly over it
    var shot = histEl("div", "dragon-hist-shot");
    var img = document.createElement("img");
    img.loading = (index < 8) ? "eager" : "lazy";
    img.alt = "";
    img.src = en.thumb || "";
    img.title = "Click To View Full Image";
    img.onclick = function () { histOpenImage(en); };
    shot.appendChild(img);
    card.appendChild(shot);

    // a hidden stand-in for the tile-shaped helpers (they only ever ask for
    // `ctn.querySelector("iframe").textToImagePluginOutput`), so a history card can drive the
    // SAME Persona / Vision code a live output tile drives.
    var bWrap = document.createElement("div");
    bWrap.style.cssText = "display:none;";
    var bFrame = document.createElement("iframe");
    bWrap.appendChild(bFrame);
    ;function syncBridge() {
      var u = (img && img.src) || en.thumb || "";
      bFrame.textToImagePluginOutput = {
        dataUrl: u, url: u,
        inputs: { prompt: en.p || "", negativePrompt: en.neg || "", seed: en.seed != null ? en.seed : null, guidanceScale: en.gs != null ? en.gs : null, resolution: en.res || "" }
      };
      return bWrap;
    }
    ;function info() {
      return {
        url: (img && img.src) || en.thumb || "",
        prompt: en.p || "", neg: en.neg || "",
        seed: en.seed != null ? en.seed : null,
        gs: en.gs != null ? en.gs : null,
        res: en.res || "", isFlagged: !!en.isFlagged,
        ctn: syncBridge(), entry: en
      };
    }

    var cap = histEl("div", "dragon-hist-cap"); cap.textContent = en.p || "";
    var meta = histEl("div", "dragon-hist-meta");
    meta.textContent = histFmtMs(en.t) + (en.seed ? " \u00B7 seed " + en.seed : "") + (en.res ? " \u00B7 " + en.res : "") + (en.sdate ? " \u00B7 \uD83D\uDCC5 " + en.sdate : "");
    // Egon 12.10.2026 — gallery meta display: the upload title stamped at generation time.
    var ttl = null;
    if (en.stitle) {
      ttl = histEl("div", "dragon-hist-cap");
      ttl.textContent = en.stitle; ttl.title = en.sdesc || en.stitle;
      ttl.style.fontWeight = "bold";
    }

    var acts = histEl("div", "dragon-hist-acts");
    // 🗑️ LEFTMOST — the delete of the OLD history row, kept as the strip's first button.
    acts.appendChild(histAct("\uD83D\uDDD1\uFE0F", "Delete this image", "dragon-hist-del", function () {
      if (window.dragonHistDelete) window.dragonHistDelete(en);
      if (window.dragonHistRerender) window.dragonHistRerender();
    }));
    
    acts.appendChild(histAct("\uD83D\uDCCC", "Save To Prompt Bank", "", function () { if (window.dragonBankSendFromGallery) window.dragonBankSendFromGallery(info()); }));
    
    
    
    
    
    acts.appendChild(histAct("\u2B07\uFE0F", "Download Image", "", function () { if (window.dragonDownloadImage) window.dragonDownloadImage(info().url); }));
    

    card.append(cap, meta, acts);
    if (ttl) { try { card.insertBefore(ttl, cap); } catch (eT) {} }
    // ⭐/📮/ℹ️/🔄/🔄 painted ON the picture (src/dragon-image-card.js)
    if (window.dragonImageOverlay) {
      try {
        window.dragonImageOverlay(shot, {
          entry: en,
          eager: index < 8,
          getInfo: function () { return info(); }
        });
      } catch (e) { try { console.warn("dragonImageOverlay", e); } catch (e2) {} }
    }
    return card;
  }
  ;function dragonHistDayCollapsedGet() {
    try {
      var a = JSON.parse(localStorage.getItem("dragonHistDayCollapsed") || "[]");
      var m = {};
      if (Array.isArray(a)) for (var i = 0; i < a.length; i++) m[a[i]] = true;
      return m;
    } catch (e) { return {}; }
  }
  ;function dragonHistDayCollapsedSet(m) {
    try { var a = []; for (var k in m) if (m[k]) a.push(k); localStorage.setItem("dragonHistDayCollapsed", JSON.stringify(a)); } catch (e) {}
  }
  window.dragonHistDayToggle = function (dk) {
    var m = dragonHistDayCollapsedGet();
    if (m[dk]) delete m[dk]; else m[dk] = true;
    dragonHistDayCollapsedSet(m);
    var grid = document.querySelector("#dragonImageHistInline .dragon-hist-grid");
    if (grid) dragonHistDayApply(grid, m);
  };
  ;function dragonHistDayFloat(box) {
    try {
      box = box || document.getElementById("dragonImageHistInline");
      if (!box) return;
      var tb = box.__dragonTb || box.querySelector(".dragon-hist-toolbar");
      var top = 0;
      try { top = tb ? tb.offsetHeight : 0; } catch (eH) { top = 0; }
      var days = box.querySelectorAll(".dragon-hist-day");
      for (var i = 0; i < days.length; i++) { try { days[i].style.top = ""; } catch (eT) {} }
    } catch (e) {}
  }
  ;function dragonHistClearDay(dk) {
    var merged = (window.dragonHistGetMerged && window.dragonHistGetMerged()) || [];
    var victims = merged.filter(function (en) { return dragonHistDayKey(en.t) === dk; });
    if (!victims.length) return;
    victims.forEach(function (en) { try { if (window.dragonHistDelete) window.dragonHistDelete(en); } catch (e) {} });
    try { if (window.dragonHistRerender) window.dragonHistRerender(); } catch (e2) {}
    try { if (window.dragonToast) window.dragonToast("\uD83E\uDDF9 that day\u2019s images were deleted"); } catch (e3) {}
  }
  ;function dragonHistDayApply(grid, collapsed) {
    var cur = false;
    var kids = grid.children;
    for (var i = 0; i < kids.length; i++) {
      var el = kids[i];
      if (el.classList && el.classList.contains("dragon-hist-day")) {
        cur = !!(collapsed && collapsed[el.__dragonDk]);
        var ars = el.querySelectorAll(".dragon-hist-dayarrow");
        for (var ai = 0; ai < ars.length; ai++) ars[ai].textContent = cur ? "\u25BE" : "\u25B4";
        try { el.setAttribute("aria-expanded", cur ? "false" : "true"); } catch (e) {}
      } else if (el.classList && el.classList.contains("dragon-hist-sec")) {
        var secBtn = el.querySelector(".dragon-hist-day");
        var dk = secBtn ? secBtn.__dragonDk : null;
        var secCur = !!(dk && collapsed && collapsed[dk]);
        if (secBtn) {
          var sars = secBtn.querySelectorAll(".dragon-hist-dayarrow");
          for (var si = 0; si < sars.length; si++) sars[si].textContent = secCur ? "\u25BE" : "\u25B4";
          try { secBtn.setAttribute("aria-expanded", secCur ? "false" : "true"); } catch (eSB) {}
        }
        var scards = el.querySelectorAll(".dragon-hist-card");
        for (var sc = 0; sc < scards.length; sc++) { try { scards[sc].style.display = secCur ? "none" : ""; } catch (eSC) {} }
        try {
          var btnH = 40;
          try { btnH = (secBtn && secBtn.offsetHeight) || 40; } catch (eBH) {}
          el.style.height = secCur ? (btnH + "px") : ((el.__dragonH || btnH) + "px");
        } catch (eSH) {}
        cur = false;
      } else if (el.classList && el.classList.contains("dragon-hist-card")) {
        el.style.display = cur ? "none" : "";
      }
    }
  }
  ;function dragonHistRenderCards(body) {
    if (!body) return;
    var merged = (window.dragonHistGetMerged && window.dragonHistGetMerged()) || [];
    var grid = body.querySelector(".dragon-hist-grid");
    if (!grid) {
      grid = histEl("div", "dragon-hist-grid");
      body.appendChild(grid);
      grid.__dragonCards = {};
      grid.__dragonDays = {};
    }
    if (!grid.__dragonCards) grid.__dragonCards = {};
    if (!grid.__dragonDays) grid.__dragonDays = {};
    var empty = body.querySelector(".dragon-hist-empty");
    if (!merged.length) {
      if (!empty) {
        empty = histEl("div", "dragon-hist-empty");
        empty.textContent = "No history yet \u2014 generate a few images and they'll show up here.";
        body.appendChild(empty);
      }
      grid.hidden = true;
      return;
    }
    if (empty) { try { empty.remove(); } catch (e) {} }
    grid.hidden = false;

    var want = [], lastDay = null;
    var counts = {};
    for (var ci = 0; ci < merged.length; ci++) { var ck = dragonHistDayKey(merged[ci].t); counts[ck] = (counts[ck] || 0) + 1; }
    for (var i = 0; i < merged.length; i++) {
      var en = merged[i];
      var dk = dragonHistDayKey(en.t);
      if (dk !== lastDay) {
        lastDay = dk;
        var dayEl = grid.__dragonDays[dk];
        if (!dayEl || dayEl.tagName !== "BUTTON") {
          try { if (dayEl) dayEl.remove(); } catch (eR) {}
          dayEl = document.createElement("button");
          dayEl.type = "button";
          dayEl.className = "dragon-hist-day";
          grid.__dragonDays[dk] = dayEl;
          (function (dd) { dayEl.addEventListener("click", function () { window.dragonHistDayToggle(dd); }); })(dk);
        }
        dayEl.__dragonDk = dk;
        var lbl = dragonHistDayLabel(en.t) + " (" + (counts[dk] || 0) + ")";
        dayEl.innerHTML = "";
        var _dar = document.createElement("span"); _dar.className = "dragon-hist-dayarrow"; _dar.textContent = "\u25BE";
        var _dlb = document.createElement("span"); _dlb.textContent = lbl; _dlb.style.cssText = "flex:1 1 auto;text-align:center;white-space:nowrap;min-width:0;overflow:hidden;text-overflow:ellipsis;";
        var _dar2 = document.createElement("span"); _dar2.className = "dragon-hist-dayarrow"; _dar2.textContent = "\u25BE";
        var _dclr = document.createElement("span"); _dclr.className = "dragon-hist-dayclear"; _dclr.textContent = "\uD83E\uDDF9";
        _dclr.setAttribute("data-dragon-tip", "Delete ONLY this day\u2019s images");
        _dclr.setAttribute("role", "button");
        _dclr.style.cssText = "flex:0 0 auto;font-size:.68rem;font-weight:800;padding:.08rem .5rem;border-radius:999px;cursor:pointer;border:1px solid #c81e2e;background:linear-gradient(145deg,#3a1418,#170708);color:#ff9aa3;";
        _dclr.addEventListener("click", function (ev) { try { ev.stopPropagation(); ev.preventDefault(); } catch (eS) {} dragonHistClearDay(dayEl.__dragonDk); });
        dayEl.append(_dar, _dlb, _dar2, _dclr);
        dayEl.title = lbl + " \u2014 click to collapse or expand this day's images";
        want.push(dayEl);
      }
      var key = String(en.id || (en.t + "|" + en.p));
      var card = grid.__dragonCards[key];
      if (!card) {
        card = dragonHistCard(en, i);
        grid.__dragonCards[key] = card;
        card.__dragonKey = key;
        try {
          if (i < 12) { if (window.dragonHistResolveImage) _histUpgrade(card.querySelector("img"), en); }
          else _histObserveImg(card.querySelector("img"), en, null);
        } catch (e) {}
      } else {
        card.__dragonEn = en;
        try { en.__card = card; } catch (e) {}
      }
      want.push(card);
    }
    // retire the nodes that left the list …
    var kids = Array.prototype.slice.call(grid.children);
    for (var q = 0; q < kids.length; q++) {
      var k = kids[q];
      if (want.indexOf(k) === -1) {
        if (k.classList && k.classList.contains("dragon-hist-card") && k.__dragonKey) { try { delete grid.__dragonCards[k.__dragonKey]; } catch (e) {} }
        else if (k.classList && k.classList.contains("dragon-hist-day")) { for (var dkk in grid.__dragonDays) if (grid.__dragonDays[dkk] === k) delete grid.__dragonDays[dkk]; }
        try { k.remove(); } catch (e) {}
      }
    }
    // … then put everything in order by MOVING the existing nodes (their pictures are never reloaded).
    var prev = null;
    for (var w = 0; w < want.length; w++) {
      var el = want[w];
      if (prev) { if (prev.nextSibling !== el) grid.insertBefore(el, prev.nextSibling); }
      else if (grid.firstChild !== el) grid.insertBefore(el, grid.firstChild);
      prev = el;
    }
    try { dragonHistDayApply(grid, dragonHistDayCollapsedGet()); } catch (eDA) {}
  }
  // Egon 13.09.2026 — Preview no longer TRIGGERS the MAIN generate flow. A single image is produced directly
  // via the text-to-image plugin and is visible ONLY in this preview slot (it does not drop into the output area
  // or history).
  ;function _pvThumb(dataUrl, cb) {
    try {
      var im = new Image();
      im.onload = function () {
        try {
          var s = Math.min(1, 256 / Math.max(im.width, im.height));
          var w = Math.max(1, Math.round(im.width * s)), h = Math.max(1, Math.round(im.height * s));
          var c = document.createElement("canvas"); c.width = w; c.height = h;
          c.getContext("2d").drawImage(im, 0, 0, w, h);
          cb(c.toDataURL("image/jpeg", 0.7));
        } catch (e) { cb(dataUrl); }
      };
      im.onerror = function () { cb(dataUrl); };
      im.src = dataUrl;
    } catch (e) { cb(dataUrl); }
  }
  var pvBusy = {};
  // Egon 14.09.2026 — 🟢 PREVIEW PROGRESS BAR (estimated / ETA).
  // IMPORTANT FACT: only `readyForData` and `finished` postMessages come from the t2i iframe;
  // THERE IS NO INTERMEDIATE STAGE PERCENTAGE. This bar shows a progress ESTIMATION based on the
  // PAST AVERAGE DURATION, not the actual stage (each production duration is added to the average, and the bar fills accordingly). When the image arrives
  // sessizce kaybolur.
  window.dragonMakeProgressBar = function (host, opts) {
    if (!host) return null;
    opts = opts || {};
    var wrap = document.createElement("div");
    wrap.className = "dragon-pv-progress";
    wrap.style.cssText = opts.fixed
      ? "position:absolute; left:5px; right:5px; bottom:4px; z-index:4;"
      : "width:100%; max-width:240px; margin:.3rem auto 0;";
    // Egon 17.09.2026 — the "generating…" bar under a tile looked too small on the Generate page; with
    // opts.big it now gets a clearly larger size (used for generated tiles). Previews stay unchanged.
    // Egon 18.09.2026 — with opts.big the bar is now clearly larger + rounded + softly glowing (it used
    // to look like a thin, odd little strip under a queued tile).
    var _trackH = opts.big ? "14px" : (opts.thin ? "5px" : "7px");
    var track = document.createElement("div");
    track.style.cssText = "width:100%; height:" + _trackH + "; border-radius:" + (opts.big ? "8px" : "6px") + "; background:rgba(255,255,255,.16); overflow:hidden; box-shadow:inset 0 1px 2px rgba(0,0,0,.5)" + (opts.big ? ",0 0 8px rgba(74,222,128,.35)" : "") + ";";
    var fill = document.createElement("div");
    fill.style.cssText = "height:100%; width:0%; background:linear-gradient(90deg,#16a34a,#4ade80,#16a34a); transition:width .4s linear;";
    track.appendChild(fill);
    wrap.appendChild(track);
    var lbl = null;
    if (!opts.noLabel) {
      lbl = document.createElement("div");
      lbl.style.cssText = "font-size:" + (opts.big ? ".8rem" : ".58rem") + "; color:#cfe8d6; text-align:center; margin-top:" + (opts.big ? ".34rem" : ".18rem") + "; text-shadow:0 1px 2px #000;";
      wrap.appendChild(lbl);
    }
    host.appendChild(wrap);
    var done = false;
    return {
      el: wrap,
      fill: fill,
      set: function (pct, text) { if (done) return; fill.style.width = Math.max(0, Math.min(100, pct)) + "%"; if (lbl && text != null) lbl.textContent = text; },
      done: function () { if (done) return; done = true; try { wrap.remove(); } catch (e) {} }
    };
  };
  // Egon 14.09.2026 — Generate + Character Creation was exposed so that the same ~Ns progress
  // bar is used for "generating images" (setupCapture calls it upon seeing the new .t2i-image-ctn).
  // Egon 12.09.2026 — 🟢 PROGRESS BAR IS NOW "HONEST": only `readyForData` and
  // `finished` postMessages come from the t2i iframe; THERE IS NO INTERMEDIATE STAGE PERCENTAGE. The old bar was
  // ESTIMATING duration from the past average ("~12s left") and this estimate was misleading (placebo). Now an INDETERMINATE
  // shimmer bar is shown: no fake numbers/durations are written, it just says "generating…" and
  // disappears when the image arrives. The look is preserved, the duration claim is removed.
  window.dragonRunProgress = _pvRunProgress;
  ;function _pvRunProgress(host, opts) {
    if (!host) return { set: function () {}, done: function () {} };
    var bar = window.dragonMakeProgressBar(host, opts || { fixed: true });
    var anim = null;
    try {
      if (bar && bar.fill) {
        bar.fill.style.width = "34%";
        bar.fill.style.transition = "none";
        anim = bar.fill.animate(
          [{ transform: "translateX(-130%)" }, { transform: "translateX(300%)" }],
          { duration: 1400, iterations: Infinity, easing: "ease-in-out" }
        );
      }
    } catch (e) {}
    if (bar) bar.set(34, "Generating\u2026");
    return {
      set: function (pct, text) { if (bar) bar.set(pct, text); },
      done: function () { try { if (anim) anim.cancel(); } catch (e) {} if (bar) bar.done(); }
    };
  }
  ;function generatePreviewInto(it, cb, host) {
    var p = String((it && it.p) || "");
    if (!p) return;
    // Egon 15.09.2026 — hardening: preventing the start of a SECOND simultaneous production for the same prompt
    // (double-clicking / triggering from two places) → prevents unnecessary production and iframe accumulation.
    if (pvBusy[p]) return;
    if (!window.___textToImagePlugin746291937) { toast("\u26A0\uFE0F plugin not ready"); return; }
    pvBusy[p] = true;
    ;function finish(url) { try { delete pvBusy[p]; } catch (e) {} if (cb) cb(url); }
    var opts = null;
    try { opts = window.___getImageOptions746291937 ? window.___getImageOptions746291937() : null; } catch (e) {}
    var out = { prompt: p, style: "width:1px;height:1px;" };
    var sd = String(it.seed == null ? "" : it.seed).replace(/\\D/g, "");
    if (sd) out.seed = Number(sd);
    ["negativePrompt", "guidanceScale", "saveTitle"].forEach(function (k) { if (opts && opts[k] !== undefined) out[k] = opts[k]; });
    // Egon 15.09.2026 — the options object carries an ODDS-GROUP under `resolution` (not a string),
    // so the plugin couldn't read it and previews came out tiny. Resolve a real resolution string,
    // preferring the user's selected shape so the preview aspect ratio matches.
    var resStr = "512x768";
    try {
      var sh = (window.input && window.input.shape) || (opts && opts.resolution);
      if (sh && sh.evaluateItem) resStr = String(sh.evaluateItem);
      else if (typeof sh === "string") resStr = sh;
    } catch (e) {}
    if (!/^\d{3,4}x\d{3,4}$/.test(resStr)) resStr = "512x768";
    // Egon 10.09.2026 — 🖼 PREVIEW ENGINE v1/v2 (switch from Settings). v1 = current behavior
    // (user's shape, sharpest). v2 = FAST: lower resolution (512x512) + same
    // prompt cache in session (same prompt isn't generated twice → arrives instantly).
    // Egon 10.09.2026 — v2 is now DEFAULT (genuinely faster). v1 is only used if the user
    // specifically wrote "v1" to localStorage; code is preserved in REPO.
    var pvVer = "v2";
    try { pvVer = localStorage.dragonPvVersion === "v1" ? "v1" : "v2"; } catch (e) {}
    if (pvVer === "v2") {
      window.__dragonPvV2Cache = window.__dragonPvV2Cache || {};
      if (window.__dragonPvV2Cache[p]) {
        try { delete pvBusy[p]; } catch (e) {}
        try { if (window.dragonPvFullSet) window.dragonPvFullSet(it.p, window.__dragonPvV2Cache[p]); } catch (e) {}
        if (cb) cb(window.__dragonPvV2Cache[p]);
        return;
      }
      resStr = "512x512";
    }
    out.resolution = resStr;
    var holder = document.createElement("div");
    holder.className = "t2i-image-ctn";
    // Egon 15.09.2026 — ROOT-CAUSE FIX: the t2i plugin lazy-loads its iframe with an
    // IntersectionObserver against the viewport, so an offscreen holder (left:-10000px) never
    // intersected and the iframe never loaded → "generating" with no result. Keep it in the
    // viewport but invisible & non-interactive.
    holder.style.cssText = "position:fixed; left:0; top:0; width:1px; height:1px; overflow:hidden; opacity:0.001; pointer-events:none; z-index:-9999;";
    var html;
    try { html = String(window.___textToImagePlugin746291937(out)); } catch (e) { toast("\u26A0\uFE0F generation failed"); return; }
    holder.innerHTML = html;
    document.body.appendChild(holder);
    toast("\u2728 generating preview\u2026");
    var prog = host ? _pvRunProgress(host) : null;
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      var f = holder.querySelector("iframe");
      var o = f && f.textToImagePluginOutput;
      if (o && o.dataUrl) {
        clearInterval(iv);
        if (prog) prog.done();
        try { holder.remove(); } catch (e) {}
        try { if (window.dragonMarkFreshImage) window.dragonMarkFreshImage(o.dataUrl); } catch (eMK) {}
        try { if (window.dragonPvFullSet) window.dragonPvFullSet(it.p, o.dataUrl); } catch (e) {}
        // Egon 10.09.2026 — v2: cache this preview in session cache (so same prompt arrives instantly).
        if (pvVer === "v2") {
          try {
            window.__dragonPvV2Cache = window.__dragonPvV2Cache || {};
            window.__dragonPvV2Cache[p] = o.dataUrl;
            var _ck = Object.keys(window.__dragonPvV2Cache);
            while (_ck.length > 24) { delete window.__dragonPvV2Cache[_ck.shift()]; }
          } catch (e) {}
        }
        _pvThumb(o.dataUrl, function (t) { try { if (window.dragonPvSet) window.dragonPvSet(it.p, t); } catch (e) {} finish(o.dataUrl); });
      } else if (tries > 120) { clearInterval(iv); if (prog) prog.done(); try { holder.remove(); } catch (e) {} toast("\u26A0\uFE0F preview timed out"); finish(null); }
    }, 1000);
  }
  // Egon 10.09.2026 — 📮 "send to public gallery": uploads a preview image to bestaigen's PUBLIC
  // gallery. IMPORTANT: this request DOES NOT WORK via fetch-proxy (server verifies the image
  // was produced in the same session and returns "image_expired" upon seeing the proxy's server-IP).
  // Therefore, we send it DIRECTLY via same-site (perchance.org) fetch (credentials:include);
  // the response cannot be read due to CORS (mode:"no-cors"), which is why the RESULT is verified
  // afterwards by reading the public gallery itself.
  // Egon 18.09.2026 — 🐞 FALSE "SUCCESS" ROOT-CAUSE FIX (changelog [355]): the old verifier compared
  // only the FIRST 40 normalized characters of the prompt. Any prompt that opened with a commonly reused
  // style prefix (e.g. "ultra realistic photo, RAW photograph, photorealistic photography") — or simply
  // shared an opening phrase with an already-public image — was therefore reported as "✅ Confirmed"
  // even when the upload had never been accepted (the t2i save endpoint silently returns image_expired
  // for images it no longer recognises, and mode:"no-cors" hides the error). The public gallery exposes
  // every image's SHA-256 as `data-image-id`, so we now confirm by EXACT byte identity, with a strict
  // full-prompt + brand-new-image fallback that only covers transcoded uploads.
  ;function _galNorm(s) {
    return String(s || "").replace(/&(amp|lt|gt|quot|#39|apos|#x27);/g, " ").replace(/[^a-zA-Z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  }
  ;function _dragonGalIds(html) {
    var set = {}; var re = /data-image-id="([a-f0-9]{64})"/g; var m;
    while ((m = re.exec(html))) set[m[1]] = true;
    return set;
  }
  ;async function _dragonGalFetchHtml(sub) {
    if (!window.dragonSuperFetch) return "";
    var url = "https://image-generation.perchance.org/gallery?channel=" + encodeURIComponent(window.generatorName || "") +
      "&subChannel=" + encodeURIComponent(sub || "public") + "&sort=recent&timeRange=all-time&contentFilter=none&imageElementsHtmlOnly=true&skip=0&__cacheBust=" + Math.random();
    try { return await window.dragonSuperFetch(url).then(function (r) { return r.text(); }); } catch (e) { return ""; }
  }
  // Returns {state:"confirmed"|"notfound"|"unknown", by:"hash"|"prompt"}.
  ;async function dragonGalleryConfirm(promptText, uploadHash, beforeIds, sub) {
    var html = await _dragonGalFetchHtml(sub);
    if (!html) return { state: "unknown" };
    // Egon 12.10.2026 (rev 3) — learn the SERVER-STAMPED user id off our own confirmed upload
    // (the same id the gallery stores as data-user-id; an empty username falls back to it).
    try {
      if (uploadHash && html.indexOf(uploadHash) !== -1) {
        // attribute order is data-image-id … data-user-id, so scan the window AFTER the hash.
        var _hp = html.indexOf(uploadHash);
        var _hw = html.slice(_hp, _hp + 3000);
        var _hu = _hw.match(/data-user-id="([a-f0-9]{64})"/);
        if (_hu && window.dragonServerUserIdNote) window.dragonServerUserIdNote(_hu[1]);
        return { state: "confirmed", by: "hash" };
      }
    } catch (eUid) {}
    var fpn = _galNorm(promptText);
    if (fpn.length < 4) return { state: "notfound" };
    var ids = []; var mm; var idRe = /data-image-id="([a-f0-9]{64})"/g;
    while ((mm = idRe.exec(html))) ids.push({ id: mm[1], pos: mm.index });
    for (var i = 0; i < ids.length; i++) {
      if (beforeIds && beforeIds[ids[i].id]) continue;
      var from = ids[i].pos;
      var to = (i + 1 < ids.length) ? ids[i + 1].pos : Math.min(html.length, from + 40000);
      var pm = /data-prompt="([\s\S]*?)"\s+data-negative-prompt=/.exec(html.slice(from, to));
      if (!pm) continue;
      var g = _galNorm(pm[1]);
      if (g === fpn || (fpn.length >= 24 && g.indexOf(fpn) !== -1)) return { state: "confirmed", by: "prompt" };
    }
    return { state: "notfound" };
  }
  window.dragonGalleryConfirm = dragonGalleryConfirm;
  // Backwards-compatible wrapper (kept for tooling/tests): true only on an EXACT image or full-prompt match.
  window.dragonGalleryHasPrompt = function (promptText) {
    return dragonGalleryConfirm(promptText, null, null).then(function (r) { return r.state === "confirmed"; });
  };
  ;function _dragonB64Bytes(b64) {
    var bin = atob(b64); var n = bin.length; var u = new Uint8Array(n);
    for (var i = 0; i < n; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  ;async function _dragonSha256Hex(u8) {
    var h = await crypto.subtle.digest("SHA-256", u8);
    var a = new Uint8Array(h); var s = "";
    for (var i = 0; i < a.length; i++) s += ("0" + a[i].toString(16)).slice(-2);
    return s;
  }
  window.dragonRefreshGalleryIframes = function () {
    try {
      document.querySelectorAll(".text-to-image-plugin-gallery").forEach(function (el) {
        try { if (el.contentWindow) el.contentWindow.postMessage({ doRefreshIfSortingByRecent: true }, "https://image-generation.perchance.org"); } catch (e) {}
      });
    } catch (e) {}
  };
  // Egon 18.09.2026 — 📮 SEND-TO-PUBLIC PROGRESS WINDOW. A non-blocking floating window that follows
  // the REAL pipeline of window.dragonSendToPublicGallery (prepare → upload → confirm) and reports the
  // honest result. A successful send auto-closes 5s after it completes (unless OK is pressed first);
  // a failed send stays open until OK is pressed.
  ;function dragonSendStatusWindow(opts) {
    opts = opts || {};
    window.__dragonSendWinSeq = (window.__dragonSendWinSeq || 0) + 1;
    if (!document.getElementById("dragonSendWinCss")) {
      var css = document.createElement("style");
      css.id = "dragonSendWinCss";
      css.textContent = "@keyframes dragonSendSpin{to{transform:rotate(360deg)}}" +
        ".dragonSendWin .dsw-row{display:flex;align-items:center;justify-content:center;gap:.5rem;font-size:.85em;color:#c9c9d6;padding:.22rem 0;text-align:left}" +
        ".dragonSendWin .dsw-ic{flex:0 0 18px;width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.74rem;border:1px solid #4a4a58;background:#15151b;color:#8a8a99;box-sizing:border-box}" +
        ".dragonSendWin .dsw-active{color:#eae6ff}.dragonSendWin .dsw-active .dsw-ic{border-color:#9b6bff;color:#c9a9ff}" +
        ".dragonSendWin .dsw-done .dsw-ic{border-color:#3ddc84;color:#3ddc84}" +
        ".dragonSendWin .dsw-fail{color:#f0b6b3}.dragonSendWin .dsw-fail .dsw-ic{border-color:#e0554f;color:#e0554f}" +
        ".dragonSendWin .dsw-spin{width:14px;height:14px;flex:0 0 14px;border-radius:50%;border:2px solid rgba(155,107,255,.3);border-top-color:#9b6bff;animation:dragonSendSpin .8s linear infinite;display:none}" +
        ".dragonSendWin .dsw-active .dsw-spin{display:block}" +
        ".dragonSendWin .dsw-chtag{cursor:pointer;border:1px solid #4a4a58;background:#15151b;color:#c9c9d6;border-radius:999px;padding:.14rem .55rem;font-size:.72rem;font-weight:700;}" +
        ".dragonSendWin .dsw-chtag:hover{border-color:#9b6bff;color:#fff;}" +
        ".dragonSendWin .dsw-chinput{width:100%;box-sizing:border-box;background:#0d0d12;border:1px solid #4a4a58;color:#eee;border-radius:8px;padding:.4rem .6rem;font-size:.85rem;font-family:inherit;}" +
        ".dragonSendWin .dsw-sendbtn{cursor:pointer;border:1px solid #9b6bff;background:linear-gradient(180deg,#4a3a8a,#2a1d52);color:#fff;border-radius:8px;padding:.42rem .6rem;font-weight:bold;font-size:.9rem;font-family:inherit;flex:1 1 0;min-width:0;white-space:nowrap;}" +
        ".dragonSendWin .dsw-cancelbtn{cursor:pointer;border:1px solid #7a7a8c;background:linear-gradient(145deg,#4a4a55,#17171c);color:#eee;border-radius:8px;padding:.42rem .6rem;font-weight:bold;font-size:.9rem;font-family:inherit;flex:1 1 0;min-width:0;white-space:nowrap;}";
      document.head.appendChild(css);
    }
    var anchor = opts.anchor || null;
    try {
      if (anchor && (!anchor.isConnected || !anchor.getBoundingClientRect || anchor.getBoundingClientRect().width < 40)) anchor = null;
    } catch (e) { anchor = null; }
    var holder = null;
    if (anchor) {
      try { if (getComputedStyle(anchor).position === "static") anchor.style.position = "relative"; } catch (e2) {}
      holder = document.createElement("div");
      holder.className = "dragonSendHolder";
      holder.style.cssText = "position:absolute;inset:0;z-index:30;display:flex;align-items:center;justify-content:center;background:rgba(5,5,9,.62);border-radius:inherit;overflow:auto;padding:.6rem;box-sizing:border-box;";
      anchor.appendChild(holder);
    }
    var win = document.createElement("div");
    win.className = "dragonSendWin";
    try { win.id = "dragonSendWin-" + window.__dragonSendWinSeq; } catch (e) {}
    if (holder) {
      win.style.cssText = "width:min(100%,21rem);max-width:100%;max-height:100%;overflow:auto;box-sizing:border-box;background:linear-gradient(160deg,#1e1e28,#0d0d12);" +
        "border:1px solid #4a4a58;border-radius:14px;padding:.9rem 1rem .85rem;box-shadow:0 16px 48px rgba(0,0,0,.66);" +
        "font-family:system-ui,sans-serif;color:#eee;text-align:center;";
    } else {
      win.style.cssText = "position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:2147483647;" +
        "width:min(92vw,27rem);max-width:92vw;max-height:92vh;overflow:auto;box-sizing:border-box;background:linear-gradient(160deg,#1e1e28,#0d0d12);" +
        "border:1px solid #4a4a58;border-radius:14px;padding:1.1rem 1.2rem 1rem;box-shadow:0 16px 48px rgba(0,0,0,.66);" +
        "font-family:system-ui,sans-serif;color:#eee;text-align:center;";
    }
    var h = document.createElement("div");
    h.textContent = "📮 Sending to gallery";
    h.style.cssText = "font-weight:bold;font-size:1.02em;margin-bottom:.75rem;";
    var rowsCtn = document.createElement("div");
    rowsCtn.style.cssText = "margin:0 0 .3rem;";
    var steps = ["Preparing", "Inspecting", "Uploading", "Confirming"];
    var rows = [];
    for (var si = 0; si < steps.length; si++) {
      var row = document.createElement("div");
      row.className = "dsw-row";
      var ic = document.createElement("span");
      ic.className = "dsw-ic";
      ic.textContent = String(si + 1);
      var tx = document.createElement("span");
      tx.textContent = steps[si];
      var sp = document.createElement("span");
      sp.className = "dsw-spin";
      row.append(ic, tx, sp);
      rowsCtn.appendChild(row);
      rows.push({ row: row, ic: ic });
    }
    var msg = document.createElement("div");
    msg.style.cssText = "display:none;font-size:.82em;color:#9a9aa8;line-height:1.4;margin:.4rem 0 .7rem;text-align:center;";
    var ok = document.createElement("button");
    ok.type = "button";
    ok.textContent = "OK";
    ok.style.cssText = "display:none;cursor:pointer;border:1px solid #7a7a8c;background:linear-gradient(145deg,#4a4a55,#17171c);color:#eee;border-radius:8px;padding:.42rem 1.6rem;font-weight:bold;font-size:.9rem;font-family:inherit;";
    var closed = false, timer = null;
    ;function close() {
      if (closed) return; closed = true;
      if (timer) clearTimeout(timer);
      try { win.remove(); } catch (e) {}
      try { if (holder && holder.parentNode) holder.remove(); } catch (e2) {}
    }
    ok.onclick = close;
    win.append(h, rowsCtn, msg, ok);
    if (holder) holder.appendChild(win);
    else document.body.appendChild(win);
    try {
      var _aw2 = (anchor && anchor.getBoundingClientRect) ? anchor.getBoundingClientRect().width : 0;
      if (_aw2 > 0) { var _sc2 = Math.max(0.72, Math.min(1, _aw2 / 320)); win.style.fontSize = (16 * _sc2).toFixed(1) + "px"; win.__dragonSendScale = _sc2; }
    } catch (eSC) {}
    return {
      el: win,
      step: function (n, state) {
        var r = rows[n - 1]; if (!r) return;
        r.row.className = "dsw-row dsw-" + state;
        r.ic.textContent = state === "done" ? "✓" : state === "fail" ? "✕" : String(n);
      },
      status: function (msg) {},
      finish: function (good, text) {
        msg.style.display = "block";
        msg.textContent = text;
        msg.style.color = good ? "#9fe8b8" : "#f0b6b3";
        ok.style.display = "inline-block";
        if (good) { ok.style.borderColor = "#3ddc84"; timer = setTimeout(close, 5000); }
        else { ok.style.borderColor = "#e0554f"; }
      },
      close: close
    };
  }
  window.dragonSendStatusWindow = dragonSendStatusWindow;
  ;function dragonPushLastChannel() {
    try { return localStorage.getItem("dragonPushChannel") || "public"; } catch (e) { return "public"; }
  }
  ;function dragonPushChannels() {
    try {
      var a = JSON.parse(localStorage.getItem("dragonPushChannels") || "[]");
      return Array.isArray(a) ? a.filter(function (x) { return x && x !== "public"; }).slice(0, 8) : [];
    } catch (e) { return []; }
  }
  ;function dragonPushRememberChannel(ch) {
    try {
      localStorage.setItem("dragonPushChannel", ch);
      if (ch && ch !== "public") {
        var a = dragonPushChannels().filter(function (x) { return x !== ch; });
        a.unshift(ch);
        localStorage.setItem("dragonPushChannels", JSON.stringify(a.slice(0, 8)));
      }
    } catch (e) {}
  }
  window.dragonPushChannelDialog = function (opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var W = dragonSendStatusWindow(opts);
      var done = false;
      ;function shut(val) { if (done) return; done = true; try { W.close(); } catch (e) {} resolve(val); }
      try {
        var _rs = W.el.querySelectorAll(".dsw-row");
        for (var _ri = 0; _ri < _rs.length; _ri++) _rs[_ri].style.display = "none";
      } catch (e) {}
      var body = document.createElement("div");
      body.style.cssText = "margin:.1rem 0 .7rem;text-align:left;";
      var lab = document.createElement("div");
      lab.textContent = "Channel";
      lab.style.cssText = "font-size:.74rem;font-weight:800;color:#b9b9c6;margin-bottom:.3rem;";
      var inp = document.createElement("input");
      inp.className = "dsw-chinput";
      inp.value = dragonPushLastChannel();
      inp.setAttribute("spellcheck", "false");
      inp.setAttribute("autocomplete", "off");
      body.appendChild(lab);
      body.appendChild(inp);
      var tags = ["public"].concat(dragonPushChannels());
      if (tags.length) {
        var tw = document.createElement("div");
        tw.style.cssText = "display:flex;flex-wrap:wrap;gap:.3rem;margin-top:.45rem;";
        tags.forEach(function (t) {
          var b = document.createElement("button");
          b.type = "button";
          b.className = "dsw-chtag dragon-keep";
          b.textContent = t;
          b.addEventListener("click", function () { inp.value = t; try { inp.focus(); } catch (e) {} });
          tw.appendChild(b);
        });
        body.appendChild(tw);
      }
      // Egon 29.10.2026 — Image info: Title + Username, prefilled from the
      // Control Panel row and remembered in this browser (saved on Send).
      // Egon 30.10.2026 — collapsible: the Title/Username row stays hidden behind an "Add Image info"
      // toggle under the heading; opened automatically when remembered values exist.
      var metaLab = document.createElement("div");
      metaLab.style.cssText = "font-size:.74rem;font-weight:800;color:#b9b9c6;margin:.6rem 0 .3rem;text-align:center;";
      var _mi1 = document.createElement("div");
      _mi1.textContent = "Image info";
      var _mi2 = document.createElement("div");
      _mi2.textContent = "(optional — remembered in this browser)";
      _mi2.style.cssText = "font-weight:400;font-size:.68rem;color:#9a9aa8;margin-top:.1rem;";
      metaLab.append(_mi1, _mi2);
      var metaWrap = document.createElement("div");
      metaWrap.style.cssText = "text-align:center;margin:.15rem 0 .1rem;";
      var metaToggle = document.createElement("button");
      metaToggle.type = "button";
      metaToggle.className = "dsw-metatoggle dragon-keep";
      metaToggle.setAttribute("aria-expanded", "false");
      metaToggle.style.cssText = "cursor:pointer;border:1px solid #6f6f80;background:linear-gradient(145deg,#2c2c38,#14141a);color:#cfd2e4;border-radius:8px;padding:.32rem .8rem;font-size:.78rem;font-weight:700;font-family:inherit;";
      metaWrap.appendChild(metaToggle);
      var metaOpen = false;
      ;function setMeta(open) {
        metaOpen = !!open;
        metaToggle.textContent = metaOpen ? "Hide Image info" : "Add Image info";
        metaToggle.setAttribute("aria-expanded", metaOpen ? "true" : "false");
        metaLab.style.display = metaOpen ? "" : "none";
        metaRow.style.display = open ? "flex" : "none";
        if (metaOpen) { try { tInp.focus(); } catch (eF) {} }
      }
      metaToggle.addEventListener("click", function () { setMeta(!metaOpen); });
      var metaRow = document.createElement("div");
      metaRow.style.cssText = "display:flex;gap:.4rem;flex-wrap:wrap;justify-content:center;";
      var _um = {};
      try { if (window.dragonUpMeta) _um = window.dragonUpMeta() || {}; } catch (eUM) {}
      var tInp = document.createElement("input");
      tInp.value = String((_um && _um.title) || "");
      tInp.maxLength = 20; tInp.placeholder = "Title"; tInp.title = "Gallery upload title, max 20 chars (empty = no title is sent)";
      tInp.setAttribute("spellcheck", "false"); tInp.setAttribute("autocomplete", "off");
      try { tInp.setAttribute("aria-label", "Gallery upload title, max 20 chars"); } catch (eTA) {}
      tInp.style.cssText = "flex:1 1 0;box-sizing:border-box;background:#0e0e13;border:1px solid #6f6f80;border-radius:7px;color:#eee;font-size:.8rem;padding:.4rem .5rem;min-width:0;";
      var uInp = document.createElement("input");
      uInp.value = String((_um && _um.username) || "");
      uInp.maxLength = 40; uInp.placeholder = "Username"; uInp.title = "Visible username credit (empty falls back to the server-stamped user id)";
      uInp.setAttribute("spellcheck", "false"); uInp.setAttribute("autocomplete", "off");
      try { uInp.setAttribute("aria-label", "Visible username credit for the gallery upload"); } catch (eUA) {}
      uInp.style.cssText = "flex:1 1 0;box-sizing:border-box;background:#0e0e13;border:1px solid #6f6f80;border-radius:7px;color:#eee;font-size:.8rem;padding:.4rem .5rem;min-width:0;";
      metaRow.append(tInp, uInp);
      // Egon 30.10.2026 (2) — toggle + label + boxes all sit right under the heading, before Channel.
      body.insertBefore(metaWrap, body.firstChild);
      metaWrap.after(metaLab, metaRow);
      setMeta(!!(String(tInp.value || "") || String(uInp.value || "")));
      var foot = document.createElement("div");
      // Egon 28.09.2026 (W-UI358) — Send + Cancel share ONE button size (half row each) and can
      // never force a horizontal scrollbar: equal flex, min-width 0, no-wrap.
      foot.style.cssText = "display:flex;justify-content:center;gap:.6rem;margin-top:.7rem;max-width:100%;box-sizing:border-box;";
      var send = document.createElement("button");
      send.type = "button";
      send.className = "dsw-sendbtn";
      send.textContent = "Send";
      var cancel = document.createElement("button");
      cancel.type = "button";
      cancel.textContent = "Cancel";
      cancel.className = "dsw-cancelbtn";
      send.addEventListener("click", function () {
        try { if (window.dragonUpMetaSave) window.dragonUpMetaSave({ title: tInp.value, username: uInp.value }); } catch (eMS) {}
        try { var _rt = document.getElementById("dragonUpMetaTitle"); if (_rt) _rt.value = tInp.value; var _ru = document.getElementById("dragonUpMetaUser"); if (_ru) _ru.value = uInp.value; } catch (eMU) {}
        var v = String(inp.value || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
        if (!v) v = "public";
        dragonPushRememberChannel(v);
        shut(v);
      });
      cancel.addEventListener("click", function () { shut(null); });
      inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); send.click(); } if (e.key === "Escape") shut(null); });
      foot.append(send, cancel);
      try {
        var h = W.el.firstChild;
        W.el.insertBefore(body, h.nextSibling);
        W.el.insertBefore(foot, body.nextSibling);
      } catch (e) { body.remove(); }
      try { setTimeout(function () { try { inp.focus(); inp.select(); } catch (e2) {} }, 60); } catch (e3) {}
    });
  };
  // Egon 18.09.2026 — 🚦 FRESHNESS PRE-FLIGHT (batch48). The gallery server only accepts an image it
  // still recognises from a CURRENT generation (the t2i embed tells the server to expire images via
  // `canExpireImageIds` when it unloads), so stale vault images — or images this generator never
  // produced — come back as `image_expired`. Previously that only surfaced after the long "confirming"
  // poll. We now record the SHA-256 of every image the t2i pipeline produces DURING THIS PAGE LOAD and
  // step 1 of the send flow refuses anything outside that set, so a stale image fails instantly.
  window.__dragonFreshHashes = window.__dragonFreshHashes || {};
  window.dragonMarkFreshImage = async function (dataUrl) {
    try {
      if (!dataUrl || typeof dataUrl !== "string" || dataUrl.indexOf("data:") !== 0) return "";
      var mm = /^data:[^;]+;base64,(.*)$/.exec(dataUrl);
      if (!mm) return "";
      var h = await _dragonSha256Hex(_dragonB64Bytes(mm[1]));
      window.__dragonFreshHashes[h] = Date.now();
      return h;
    } catch (e) { return ""; }
  };
  window.dragonIsFreshImage = function (hash) {
    try { return !!(hash && window.__dragonFreshHashes && window.__dragonFreshHashes[hash]); } catch (e) { return false; }
  };
  (function () {
    if (window.__dragonFreshListener) return;
    window.__dragonFreshListener = true;
    window.addEventListener("message", function (e) {
      try {
        if (e.origin !== "https://image-generation.perchance.org") return;
        var d = e.data;
        if (!d || d.type !== "finished" || !d.dataUrl) return;
        window.dragonMarkFreshImage(d.dataUrl);
      } catch (err) {}
    });
  })();
  // Egon 18.09.2026 — 📮 SHARED STATE HELPERS (batch49). A lightbox/preview can now ask whether its CURRENT
  // image is sendable to the public gallery: true only when the exact bytes were produced by our own t2i
  // pipeline during THIS page load (freshness registry above) — the gallery server expires an image when its
  // producing embed unloads, so anything older is rejected. dragonSetPushState owns the visual state (dim +
  // disabled + explanatory tooltip) and dragonRefreshPushState recomputes it asynchronously.
  window.dragonUrlHash = async function (url) {
    try {
      if (!url) return "";
      if (url.indexOf("data:") === 0) {
        var mm = /^data:[^;]+;base64,(.*)$/.exec(url);
        if (!mm) return "";
        return await _dragonSha256Hex(_dragonB64Bytes(mm[1]));
      }
      var rr = await fetch(url);
      if (!rr || !rr.ok) return "";
      var bb = await rr.arrayBuffer();
      return await _dragonSha256Hex(new Uint8Array(bb));
    } catch (e) { return ""; }
  };
  window.dragonResolveOriginalForPush = async function (url, promptText, seed) {
    try {
      if (promptText && window.dragonPvFullGetAsync) {
        var orig = await window.dragonPvFullGetAsync(String(promptText), seed);
        if (orig && orig.indexOf("data:") === 0) return orig;
      }
    } catch (e) {}
    return url || "";
  };
  // Egon 12.10.2026 — mirrors the send rule above (VERIFY-BEFORE-SUBSTITUTE): a tapped image
  // whose own bytes are fresh is sendable as-is; otherwise the seed-scoped slot is consulted.
  window.dragonIsPushable = async function (url, promptText, seed) {
    try {
      if (url && window.dragonUrlHash && window.dragonIsFreshImage) {
        var th = await window.dragonUrlHash(url);
        if (th && window.dragonIsFreshImage(th)) return true;
      }
      var src = await window.dragonResolveOriginalForPush(url, promptText, seed);
      if (!src) return false;
      var h = await window.dragonUrlHash(src);
      return !!h && window.dragonIsFreshImage(h);
    } catch (e) { return false; }
  };
  window.dragonSetPushState = function (btn, fresh) {
    if (!btn) return;
    // Egon 17.10.2026 — WATCHER preban lock wins over every recompute: a rejected image
    // stays closed no matter what the freshness check says.
    try {
      if (window.dragonWatcherBtnLocked && window.dragonWatcherBtnLocked(btn)) {
        if (window.dragonWatcherLockBtn) window.dragonWatcherLockBtn(btn);
        return;
      }
    } catch (eWL) {}
    btn.__dragonPushOk = !!fresh;
    btn.disabled = !fresh;
    btn.style.opacity = fresh ? "" : ".42";
    btn.style.cursor = fresh ? "pointer" : "not-allowed";
    btn.title = "Send to Public Gallery";
  };
  window.dragonRefreshPushState = async function (btn, url, promptText, seed) {
    if (!btn) return;
    // Egon 17.10.2026 — WATCHER: a locally-locked button stays locked; a hash the
    // watcher rejected in an earlier session locks the button again on reopen.
    try {
      if (window.dragonWatcherBtnLocked && window.dragonWatcherBtnLocked(btn)) {
        if (window.dragonWatcherLockBtn) window.dragonWatcherLockBtn(btn);
        return;
      }
    } catch (eWL2) {}
    var tok = (btn.__dragonPushTok || 0) + 1;
    btn.__dragonPushTok = tok;
    window.dragonSetPushState(btn, false);
    try {
      var ok = await window.dragonIsPushable(url, promptText, seed);
      if (btn.__dragonPushTok === tok) {
        try {
          if (ok && window.dragonWatcherIsRejected && await window.dragonWatcherIsRejected(url)) {
            if (window.dragonWatcherLockBtn) window.dragonWatcherLockBtn(btn, "already-rejected");
            return;
          }
        } catch (eWR) {}
        window.dragonSetPushState(btn, ok);
      }
    } catch (e) {}
  };
  // Egon 12.10.2026 — `seed` (6th): batch siblings share one prompt, so the full-original lookup
  // is seed-scoped; without it the last-finishing sibling shadows the others and the send uploads
  // the wrong image. Seed-less callers keep the legacy prompt-only behaviour.
  window.dragonSendToPublicGallery = async function (dataUrl, title, promptText, btn, sub, seed) {
    var p = String(promptText || "");
    var anchor = null;
    try {
      if (btn && btn.closest) anchor = btn.closest(".dragon-hist-shot,.dragon-prod-shot,.t2i-image-ctn");
      if (anchor && (!anchor.isConnected || anchor.getBoundingClientRect().width < 40)) anchor = null;
    } catch (e) { anchor = null; }
    if (sub === undefined || sub === null) {
      try {
        if (window.dragonPushChannelDialog) sub = await window.dragonPushChannelDialog({ anchor: anchor });
      } catch (e2) { sub = "public"; }
      if (!sub) return;
    }
    var W = (typeof dragonSendStatusWindow === "function") ? dragonSendStatusWindow({ anchor: anchor }) : null;
    ;function restoreBtn(state) {
      if (!btn) return;
      if (state === "sent") { btn.textContent = "✅"; btn.title = "Confirmed in the public gallery"; btn.style.borderColor = "#3ddc84"; btn.style.background = "linear-gradient(180deg,#1f6b3a,#0d3a1f)"; btn.disabled = false; }
      else if (state === "unsure") { btn.textContent = "📮"; btn.title = "Sent, but not confirmed in the public gallery yet (may be under review)"; btn.style.borderColor = "#e0a23c"; btn.disabled = false; }
      else { btn.textContent = "📮"; btn.title = "Send to public gallery — send this image to the public gallery"; btn.disabled = false; }
    }
    ;function fail(stepN, msg) { if (W) { if (stepN) W.step(stepN, "fail"); W.finish(false, msg); } restoreBtn("fail"); }
    // Egon 12.09.2026 — ROOT CAUSE FIX: the gallery API matches the uploaded bytes with a FULL HASH;
    // a re-encoded thumbnail came back as "image_expired" and failed SILENTLY. We therefore use the
    // ORIGINAL production of that prompt (permanent full resolution in kv) whenever it is available.
    // Egon 12.10.2026 — VERIFY-BEFORE-SUBSTITUTE (same fix, hardened): the lookup is by prompt +
    // seed, but a batch sibling, a lockseed twin or a same-seed re-run can still sit in that slot
    // with DIFFERENT bytes — and every image carries its own unique code, its SHA-256 (the same
    // hash the gallery stores as data-image-id). So the tapped image's own hash decides: fresh
    // tapped bytes are NEVER replaced (exactly what was tapped is what uploads — like the default
    // plugin, which sends the tile's own bytes straight away); the slot is used only when the
    // tapped bytes are stale but the slot holds fresh ones (the thumb-rescue case).
    var src = dataUrl;
    if (W) { W.step(1, "active"); W.status("Preparing the original image…"); }
    // Egon 12.10.2026 — VERIFY-BEFORE-SUBSTITUTE (see the note above): fresh tapped bytes win,
    // always; the slot lookup runs only for stale tapped bytes (thumb-rescue).
    var _tapFresh = false;
    try {
      if (dataUrl && window.dragonUrlHash && window.dragonIsFreshImage) {
        var _th = await window.dragonUrlHash(dataUrl);
        _tapFresh = !!(_th && window.dragonIsFreshImage(_th));
      }
    } catch (eTF) {}
    if (!_tapFresh) {
      try {
        if (window.dragonPvFullGetAsync) {
          var orig = await window.dragonPvFullGetAsync(p, seed);
          if (orig) {
            var _oh = (window.dragonUrlHash ? await window.dragonUrlHash(orig) : "");
            if (_oh && window.dragonIsFreshImage && window.dragonIsFreshImage(_oh)) src = orig;
          }
        }
      } catch (e) {}
    }
    if (src && src.indexOf("data:") !== 0 && (src.indexOf("blob:") === 0 || src.indexOf("http") === 0)) {
      // Egon 17.09.2026 — the private-gallery tile / lightbox hand us a blob: (or hosted) URL; read its
      // bytes and turn them into a data: URL so the ORIGINAL bytes are posted (a re-encode would lose the
      // gallery hash and come back as image_expired).
      try {
        var _rr = await fetch(src);
        var _bb = await _rr.blob();
        src = await new Promise(function (res, rej) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.onerror = rej; fr.readAsDataURL(_bb); });
      } catch (e) {}
    }
    if (!src || src.indexOf("data:") !== 0) { fail(1, "No image is available to send."); return; }
    var m = /^data:image\/([a-zA-Z0-9.+-]+);base64,(.*)$/.exec(src);
    if (!m) { fail(1, "The image data is not supported."); return; }
    var ext = m[1].toLowerCase();
    if (ext === "jpg") ext = "jpeg";
    if (ext !== "jpeg" && ext !== "webp") { fail(1, "This format cannot be sent to the gallery (" + ext + ")."); return; }
    var b64 = m[2];
    var ch = window.generatorName || "";
    if (!ch) { fail(1, "No gallery channel was found."); return; }
    // Egon 12.10.2026 (rev 3) — gallery upload meta (src/JS/dragon-upmeta.js): the Control
    // Panel's title / username are processed into the POSTed TITLE here, and the production
    // day is stamped into the DESCRIPTION automatically (no date input). EMPTY = NO TITLE:
    // an empty title + username sends the server user tag once it has been learned from a
    // confirmed upload (the 4-letter code on the default cards — never a prompt excerpt). `p` itself is left untouched: the confirm
    // poll below matches the gallery's data-prompt against the ORIGINAL prompt, and the full-size
    // lookup above needs it too.
    var upTitle = "", upDesc = p;
    try { if (window.dragonUpMetaTitle) upTitle = window.dragonUpMetaTitle(); } catch (eMT) {}
    try {
      if (window.dragonUpMetaDesc && window.dragonUpMetaNewMarker) upDesc = window.dragonUpMetaDesc(window.dragonUpMetaNewMarker());
    } catch (eMD) {}
    // Egon 18.09.2026 — record the EXACT SHA-256 of the bytes we are about to post, plus the set of image
    // ids already in the public gallery BEFORE the upload. The gallery's own `data-image-id` IS the image's
    // SHA-256, so a later hash hit proves this exact file went live (no false positives), and `beforeIds`
    // guarantees the full-prompt fallback only ever matches a genuinely NEW image.
    var uploadHash = "";
    try { uploadHash = await _dragonSha256Hex(_dragonB64Bytes(b64)); } catch (e) {}
    // Egon 18.09.2026 — FAIL FAST (batch48): if these exact bytes were not produced by our own t2i
    // pipeline in this page load, the gallery server cannot still recognise them — no point uploading
    // or entering the confirm poll. Report the truth immediately, in the "prepare image" step.
    if (!window.dragonIsFreshImage(uploadHash)) {
      fail(1, "\u26a0\ufe0f Not sent \u2014 this image was not generated in this session, and the public gallery only accepts images it still recognises from a current generation (older / imported images come back as expired). Nothing was added to the public gallery. Please generate a fresh image and send that instead.");
      return;
    }
    // Egon 17.10.2026 — WATCHER pre-upload inspection (src/JS/dragon-watcher.js): vision
    // looks at the image AND the prompt BEFORE anything is posted. Reject = preban
    // (nothing uploads, the send button for that image locks); flag = undecided (the
    // upload proceeds under Perchance's own auto-tag rating, and the watcher queues a
    // hidden inspect badge that is filed server-side once the upload is confirmed).
    var _wVerdict = null;
    try {
      if (W) { W.step(1, "done"); W.step(2, "active"); W.status("Inspecting the image…"); }
      if (typeof window.dragonWatcherInspect === "function") {
        _wVerdict = await window.dragonWatcherInspect({ dataUrl: src, prompt: p, ext: ext, hash: uploadHash });
      } else if (W) { W.step(2, "done"); }
    } catch (eW) { _wVerdict = null; try { if (W) W.step(2, "done"); } catch (eW2) {} }
    if (_wVerdict && _wVerdict.action === "reject") {
      try { if (btn && window.dragonWatcherLockBtn) window.dragonWatcherLockBtn(btn, _wVerdict.lockReason); } catch (eL) {}
      fail(2, String(_wVerdict.message || "⛔ Not sent — the upload inspector rejected this image."));
      return;
    }
    var _wTag = (_wVerdict && _wVerdict.action === "ok" && _wVerdict.rating >= 0) ?
      (" · watcher: " + (["G", "PG13", "none"][_wVerdict.rating] || "?")) : "";
    var beforeIds = null;
    try { var _bh = await _dragonGalFetchHtml(sub); if (_bh) beforeIds = _dragonGalIds(_bh); } catch (e) {}
    if (W) { W.step(2, "done"); W.step(3, "active"); W.status("Uploading the original bytes…" + _wTag); }
    var url = "https://image-generation.perchance.org/api/saveImageToGallery?channel=" + encodeURIComponent(ch) +
      "&subChannel=" + encodeURIComponent(sub || "public") + "&fileExtension=" + encodeURIComponent(ext) +
      "&title=" + encodeURIComponent(upTitle) +
      "&description=" + encodeURIComponent(upDesc) + "&__cacheBust=" + Math.random();
    if (btn) { btn.disabled = true; btn.textContent = "⏳"; btn.title = "Sending…"; }
    var sent = false;
    try {
      await fetch(url, { method: "POST", body: b64, credentials: "include", mode: "no-cors" });
      sent = true;
    } catch (e) { sent = false; }
    if (!sent) { fail(3, "Could not reach the public gallery (network error)."); return; }
    // Egon 18.09.2026 — a new image was just pushed: drop every cached gallery page and re-prefetch, so
    // the image is guaranteed to show under G, PG13 AND none (the stale per-filter listing bug).
    try {
      window.dragonGalLastPage = null;
      window.dragonGalPrefetch = null;
      window.dragonGalFilterPages = null;
      window.dragonGalSkipHead = true; // the next gallery paint skips the stale head snapshot once, so the pushed image can land on top
      if (window.dragonGalPrefetchKick) window.dragonGalPrefetchKick();
    } catch (e) {}
    window.dragonRefreshGalleryIframes();
    if (btn) { btn.textContent = "⏳"; btn.title = "Sent — waiting for it to appear in the public gallery…"; }
    if (W) { W.step(3, "done"); W.step(4, "active"); W.status("Submitted. Waiting for it to be published…"); }
    // Submission sent; now REALLY wait for it to appear in the gallery (there might be moderation/lag).
    // Egon 18.09.2026 — `dragonGalleryConfirm` verifies by EXACT SHA-256 (or, for a transcoded upload, by a
    // brand-new image whose FULL prompt matches). The old 40-char prefix test could match a pre-existing
    // public image and reported "success" for uploads the server had actually rejected.
    var verdict = { state: "unknown" };
    var attempts = 0;
    while (attempts < 14) {
      var wait = attempts < 8 ? 15000 : 30000;
      attempts++;
      if (W) W.status("Checking the public gallery\u2026 attempt " + attempts + " of 14");
      await new Promise(function (r) { setTimeout(r, wait); });
      try { verdict = await dragonGalleryConfirm(p, uploadHash, beforeIds, sub); } catch (e) { verdict = { state: "unknown" }; }
      if (verdict.state === "confirmed") break;
    }
    if (verdict.state === "confirmed") {
      // Egon 17.10.2026 — WATCHER: an undecided upload that made it live files its hidden
      // inspect badge now (the hash IS the gallery's data-image-id, so the admin page
      // can find the picture later). Rejected images never reach this branch.
      try { if (window.dragonWatcherOnConfirmed) window.dragonWatcherOnConfirmed(uploadHash); } catch (eWC) {}
      if (W) { W.step(4, "done"); W.finish(true, "\u2705 Confirmed \u2014 the exact image is now live in the public gallery."); }
      restoreBtn("sent");
    } else if (verdict.state === "notfound") {
      if (W) { W.step(4, "fail"); W.finish(false, "\u26a0\ufe0f Not published. The gallery server did not accept this image \u2014 it only accepts images it still recognises from a recent generation, so older saved images are usually rejected. Nothing was added to the public gallery. Try sending a freshly generated image instead."); }
      restoreBtn("unsure");
    } else {
      if (W) { W.step(4, "fail"); W.finish(false, "\u26a0\ufe0f The upload was submitted, but the public gallery could not be read to confirm it. Please check the public gallery yourself in a little while."); }
      restoreBtn("unsure");
    }
  };
  // Egon 18.09.2026 — PARKED (batch49): no longer called; the 📮 send action moved into the lightbox.
  ;function dragonAttachGalSave(box, getFull, getPrompt, getTitle) {
    if (!box) return;
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = "\uD83D\uDCEE";
    b.title = "Send to Public Gallery";
    b.style.cssText = "position:absolute; right:4px; bottom:4px; z-index:3; width:26px; height:26px; min-width:0; padding:0; box-sizing:border-box; border-radius:50%; border:1px solid #4aa3ff; background:linear-gradient(180deg,#2f8fd8,#173e7a); color:#fff; font-size:.8rem; line-height:1; cursor:pointer; box-shadow:0 2px 8px rgba(0,0,0,.55);";
    b.onclick = function (e) {
      e.stopPropagation(); e.preventDefault();
      var full = ""; try { full = getFull() || ""; } catch (er) {}
      if (window.dragonSendToPublicGallery) window.dragonSendToPublicGallery(full, getTitle(), getPrompt(), b);
    };
    box.appendChild(b);
  }
  // Egon 15.09.2026 — shared mini preview box, used for Prompt Bank entries:
  // it shows the saved thumbnail if it exists, otherwise says "🖼️ click to preview" and
  // generates a SINGLE image for that prompt when clicked, filling the same box.
  window.dragonMiniPreviewBox = function (promptText, size) {
    var p = String(promptText || "");
    var SZ = size || 108;
    var box = document.createElement("div");
    box.style.cssText = "position:relative; flex:0 0 " + SZ + "px; width:" + SZ + "px; height:" + SZ + "px; min-height:" + SZ + "px; border-radius:8px; overflow:hidden; border:1px solid #2e2e3a; background:linear-gradient(145deg,#1c1c24,#0a0a0e); display:flex; align-items:center; justify-content:center; box-sizing:border-box;";
    ;function showImg(url) {
      box.innerHTML = "";
      var im = document.createElement("img");
      im.src = url; im.alt = "";
      im.style.cssText = "width:100%; height:100%; object-fit:cover; cursor:zoom-in;";
      im.onclick = async function () {
        var full = "";
        try { full = (window.dragonPvFullGetAsync ? await window.dragonPvFullGetAsync(p) : (window.dragonPvFullGet && window.dragonPvFullGet(p))) || ""; } catch (e) {}
        if (window.dragonZoomLightbox) window.dragonZoomLightbox(full || url, null, null, 0);
      };
      box.appendChild(im);
      // Egon 18.09.2026 — 📮 REMOVED from this preview box (batch49): the send action now lives in the
      // lightbox that opens when the preview is clicked (the pushPublic option of dragonZoomLightbox).
    }
    ;function showEmpty() {
      box.innerHTML = "";
      var wrap = document.createElement("div");
      wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; justify-content:center; gap:.22rem; width:100%; height:100%; text-align:center; padding:.25rem; line-height:1.15; cursor:pointer; box-sizing:border-box;";
      var ic = document.createElement("span"); ic.textContent = "\uD83D\uDDBC\uFE0F"; ic.style.cssText = "font-size:1.5rem; opacity:.75;";
      var lbl = document.createElement("span"); lbl.textContent = "click to generate preview"; lbl.style.cssText = "font-size:.6rem; color:#9a9aad;";
      wrap.append(ic, lbl);
      wrap.title = "No preview yet \u2014 click to generate this prompt and show the image here";
      wrap.onclick = function () {
        if (box.__busy || !p) return;
        box.__busy = true;
        box.innerHTML = "";
        var sp = document.createElement("span"); sp.textContent = "\u23F3"; sp.style.cssText = "font-size:1.25rem; cursor:wait;"; box.appendChild(sp);
        var flip = false, spin = setInterval(function () { flip = !flip; sp.style.transform = flip ? "rotate(180deg)" : ""; }, 500);
        generatePreviewInto({ p: p }, function (url) {
          clearInterval(spin); box.__busy = false;
          if (url) showImg(url); else showEmpty();
        }, box);
      };
      box.appendChild(wrap);
    }
    var pv = "";
    try { pv = (window.dragonPvGet && window.dragonPvGet(p)) || ""; } catch (e) {}
    if (pv) showImg(pv); else showEmpty();
    return box;
  };
  ;function _histPromptRow(it) {
    var row = histEl("div");
    row.style.cssText = "display:flex; gap:.55rem; align-items:stretch; border:1px solid #3a3a48; border-radius:10px; padding:.45rem .55rem; background:#0f0f15;";
    var prev = histEl("div");
    // Egon 15.09.2026 — preview box enlarged (so "click to preview" text fits comfortably when empty).
    prev.style.cssText = "position:relative; flex:0 0 108px; width:108px; height:108px; min-height:108px; border-radius:8px; overflow:hidden; border:1px solid #2e2e3a; background:linear-gradient(145deg,#1c1c24,#0a0a0e); display:flex; align-items:center; justify-content:center; font-size:1.1rem; color:#6f6f80;";
    var _best = "";
    ;function showImg(url) {
      if (url) _best = url;
      prev.innerHTML = "";
      var pim = document.createElement("img"); pim.src = url; pim.alt = "";
      pim.style.cssText = "width:100%; height:100%; object-fit:cover; cursor:zoom-in;";
      pim.onclick = async function () {
        // Egon 12.09.2026 — show the ACTUAL (original) resolution when enlarging; otherwise fall back to the best available source.
        var full = "";
        try { full = (window.dragonPvFullGetAsync ? await window.dragonPvFullGetAsync(it.p) : (window.dragonPvFullGet && window.dragonPvFullGet(it.p))) || ""; } catch (e) {}
        if (window.dragonZoomLightbox) window.dragonZoomLightbox(full || _best || url, null, null, 0, null, { pushPublic: true });
      };
      prev.appendChild(pim);
      // Egon 18.09.2026 — 📮 REMOVED from this preview box (batch49): the send action now lives in the
      // lightbox that opens when the preview is clicked (the pushPublic option of dragonZoomLightbox).
    }
    var pv = (window.dragonPvGet && window.dragonPvGet(it.p)) || "";
    if (pv) {
      showImg(pv);
      // Egon 12.09.2026 — first try the PERMANENT ORIGINAL (kv) of that prompt: both preview and lightbox
      // will show actual pixels. Otherwise, fall back to the ~1000px medium in History (old behavior).
      try {
        if (window.dragonPvFullGetAsync) {
          window.dragonPvFullGetAsync(it.p).then(function (orig) { if (orig) showImg(orig); });
        }
      } catch (e) {}
      // Egon 10.09.2026 — same fix as Image History: the stored 160px preview looked pixelated.
      // Resolve a higher-res source (full / ~1000px medium) from the matching History entry and
      // swap it in (exactly like _histUpgrade does for history tiles).
      setTimeout(function () { try {
        if (_best && _best.length > pv.length) return; // instant original is already here
        var _merged = (window.dragonHistGetMerged && window.dragonHistGetMerged()) || [];
        for (var _mi = 0; _mi < _merged.length; _mi++) {
          if (_merged[_mi] && _merged[_mi].p === it.p) {
            (function (en2) {
              if (window.dragonHistResolveImage) window.dragonHistResolveImage(en2, function (url) { if (url && url !== pv) showImg(url); });
            })(_merged[_mi]);
            break;
          }
        }
      } catch (e) {} }, 500);
    } else {
      var pl = document.createElement("div");
      pl.style.cssText = "display:flex; flex-direction:column; align-items:center; justify-content:center; gap:.22rem; width:100%; height:100%; text-align:center; padding:.25rem; line-height:1.15; cursor:pointer; box-sizing:border-box;";
      var plc = document.createElement("span"); plc.textContent = "\uD83D\uDDBC\uFE0F"; plc.style.cssText = "font-size:1.5rem; opacity:.75;";
      var pll = document.createElement("span"); pll.textContent = "click to generate preview"; pll.style.cssText = "font-size:.6rem; color:#9a9aad;";
      pl.append(plc, pll);
      pl.title = "No preview yet \u2014 click to generate this prompt and show the image here";
      // Egon 15.09.2026 — clicking now generates ONE image discreetly and shows a loading state
      // inside this preview slot while it works; on success the image fills the same slot.
      pl.onclick = function () {
        if (pl.__busy) return;
        pl.__busy = true;
        prev.innerHTML = "";
        var sp = document.createElement("span");
        sp.textContent = "\u23F3";
        sp.style.cssText = "font-size:1.15rem; cursor:wait;";
        sp.title = "generating\u2026";
        prev.appendChild(sp);
        var spin = setInterval(function () { sp.style.transform = sp.style.transform ? "" : "rotate(180deg)"; }, 500);
        generatePreviewInto(it, function (url) {
          clearInterval(spin);
          pl.__busy = false;
          if (url) showImg(url);
          else { prev.innerHTML = ""; prev.appendChild(pl); }
        }, prev);
      };
      prev.appendChild(pl);
    }
    var col = histEl("div");
    col.style.cssText = "flex:1 1 auto; min-width:0; display:flex; flex-direction:column; gap:.3rem;";
    var txt = histEl("div"); txt.textContent = it.p; txt.style.cssText = "font-size:.78rem; color:#e8e6ee; word-break:break-word; line-height:1.4;";
    var sub = histEl("div"); sub.style.cssText = "display:flex; align-items:center; gap:.35rem;";
    var tm = histEl("span"); tm.textContent = histFmtSec(it.t); tm.style.cssText = "font-size:.65rem; color:#8a8a9a; flex:1;";
    var cp = histBtn("\uD83D\uDCCB Copy", "", function () { try { navigator.clipboard.writeText(it.p); cp.textContent = "\u2713 copied"; } catch (e) {} });
    var us = histBtn("\u26A1 Generate", "Generate this prompt on the Generate page", function () { histGenerate(it.p, null); }, "font-size:.66rem; padding:.15rem .5rem; border:1px solid #d4af37; background:linear-gradient(180deg,#4a3a1a,#2a2416); color:#ffe9a8; border-radius:6px; cursor:pointer; font-weight:bold;");
    var del = histBtn("🗑", "Delete this prompt from history (you get an Undo)", function () {
      // Egon 29.10.2026 (A10) — single delete with Undo (the purge waits for the toast window).
      try {
        var _tk = String(it.p || "").trim().toLowerCase();
        var _all = (window.dragonHistGetMerged && window.dragonHistGetMerged()) || [it];
        var _victims = [];
        for (var _di = 0; _di < _all.length; _di++) { if (String(_all[_di].p || "").trim().toLowerCase() === _tk) _victims.push(_all[_di]); }
        if (!_victims.length) _victims = [it];
        if (window.dragonHistDeleteEntriesUndoable) { window.dragonHistDeleteEntriesUndoable(_victims); return; }
        for (var _dj = 0; _dj < _victims.length; _dj++) { try { if (window.dragonHistDelete) window.dragonHistDelete(_victims[_dj]); } catch (eD) {} }
        if (window.dragonHistRerender) window.dragonHistRerender();
      } catch (e) {}
    }, "font-size:.62rem; padding:.22rem .4rem; border:1px solid #a03030; background:linear-gradient(145deg,#3a1a1a,#131010); color:#f0b0b0; border-radius:6px; cursor:pointer;");
    var sv = histBtn("📌", "Save this prompt to the Prompt Bank", function () {
      try {
        if (!window.dragonBankAdd) { toast("prompt bank not ready"); return; }
        var bank = {};
        try { bank = JSON.parse(localStorage.dragonPromptBank || "{}") || {}; } catch (eB) { bank = {}; }
        var n = Object.keys(bank).length + 1, nm = "Prompt" + n;
        while (bank[nm]) { n++; nm = "Prompt" + n; }
        if (window.dragonBankAdd(nm, it.p)) { sv.textContent = "✓ saved"; setTimeout(function () { try { sv.textContent = "📌"; } catch (eS) {} }, 1500); }
      } catch (e) {}
    });
    sub.append(tm, cp, us, del, sv); col.append(txt, sub); row.append(prev, col);
    return row;
  }
  // 📝 Egon 26.09.2026 — ALL THREE legacy entry points lead into the 📝 PROMPT PANEL now (the old
  // History PAGE they used to build/open is deleted). The panel lives directly under the Control Panel
  // on the Generate page, so from any other page we first switch to Generate — the visitor then really
  // SEES the panel open instead of landing on nothing.
  ;function dragonOpenPromptPanelTab(tab) {
    try { if (window.dragonPage !== "generate") window.dragonGoPage("generate"); } catch (e) {}
    try { dragonEnsureHistoryTools(); } catch (e) {}
    var panel = dragonHistPanelEnsure();
    if (panel) { try { panel.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (e) {} }
    return dragonHistPanelOpen(tab || "mine");
  }
  // Egon 14.09.2026 — global re-render hook: undo (dragonHistClearAll) and any history change refresh the
  // open Prompt Panel tab AND the inline Image History.
  window.dragonHistRerender = function () {
    try { dragonEnsureHistoryTools(); dragonHistPanelRender(_dragonHistTab); } catch (e) {}
    try { window.dragonImageHistRefresh && window.dragonImageHistRefresh(); } catch (e) {}
  };
  window.dragonHistoryPanel = window.dragonGenHistoryPanel = function () { return dragonOpenPromptPanelTab("mine"); };
  // The old public seams keep working; they simply lead into the Prompt Panel now.

  // ---------- gallery / vault helpers ----------
  ;function openGallery() {
    var ctn = document.getElementById("showSocialsButtonCtn9000274628");
    if (ctn) ctn.style.display = "block";
    var gal = document.getElementById("imageGalleryCtn8569284");
    if (!gal) {
      var _gn2 = 0;
      var _giv2 = setInterval(function () {
        _gn2++;
        if (document.getElementById("imageGalleryCtn8569284")) { clearInterval(_giv2); try { openGallery(); } catch (e) {} }
        else if (_gn2 > 40) clearInterval(_giv2);
      }, 150);
      return;
    }
    // Egon 24.09.2026 — NEVER hand a boot-time open to the plugin's default handler. If our wrapper is
    // not installed yet (a reload carrying `#gallery` opens the gallery before boot finishes), install it
    // and WAIT for it instead of calling whatever `__showSocialsButtonClickHandler98347938` happens to be
    // — the plugin's original took that call, removed the "show galleries" button and locked our custom
    // gallery out for the rest of the session. See setupGalleryBtn in dragon-app-core.js.
    if (!window.dragonGalleryReady) {
      try { if (window.dragonSetupGalleryBtn) window.dragonSetupGalleryBtn(); } catch (e) {}
    }
    if (!window.dragonGalleryReady) {
      var _gw = 0;
      var _gwiv = setInterval(function () {
        _gw++;
        if (window.dragonGalleryReady) { clearInterval(_gwiv); try { openGallery(); } catch (e) {} }
        else if (_gw > 50) clearInterval(_gwiv);
      }, 150);
      return;
    }
    // Already rendered → nothing to do.
    if (gal.dataset.dragonOpen === "1" && gal.querySelector(".dragon-gal-panel")) return;
    // Flag says open but the panel is empty/gone → force a fresh render.
    if (!gal.querySelector(".dragon-gal-panel")) gal.dataset.dragonOpen = "";
    if (window.__showSocialsButtonClickHandler98347938) { try { window.__showSocialsButtonClickHandler98347938(); } catch (e) {} }
  }
  ;function openVault() {
    if (window.t2i_privateGallery && window.t2i_privateGallery.show) { try { window.t2i_privateGallery.show(); } catch (e) {} }
    else toast("\uD83D\uDC98 Likes not ready yet");
  }
  ;function closeVault() {
    var vr = document.getElementById("localMediaGallery_root");
    if (vr) { try { document.documentElement.style.overflow = ""; document.body.style.overflow = ""; } catch (e) {} try { vr.remove(); } catch (e) {} }
  }

  // ---------- navbar decoration (Egon 11.09.2026) ----------
  ;function updateNavGlow(name) {
    var items = document.querySelectorAll(".dragon-nav-item");
    for (var i = 0; i < items.length; i++) {
      var on = items[i].dataset.page === name;
      items[i].classList.toggle("dragon-nav-active", on);
    }
  }
  ;function decorateNav() {
    var bar = document.querySelector(".dragon-navbar");
    if (!bar) return false;
    var map = { "Home": "home", "Generate": "generate", "Character": "character", "Character Creation": "character", "Gallery": "gallery", "Galleries": "gallery", "History": "history", "Toolbox": "history", "Tools": "history", "Likes": "likes", "Social": "social", "Chat": "chat", "Account": "account", "Settings": "account", "Options": "account" };
    var items = bar.querySelectorAll(".dragon-nav-item");
    for (var i = 0; i < items.length; i++) {
      var lb = items[i].querySelector(".dragon-nav-lb");
      var txt = lb ? lb.textContent.trim() : "";
      if (txt === "Gallery" && lb) { lb.textContent = "Galleries"; items[i].title = "Galleries \u2014 public images"; txt = "Galleries"; }
      var pg = map[txt] || "";
      if (pg) items[i].dataset.page = pg;
    }
    updateNavGlow(window.dragonPage || "home");
    return true;
  }
  window.dragonDecorateNav = decorateNav;

  // ---------- 🎵 BACKGROUND MUSIC — removed (2026-09-18): no generator-wide music wiring ----------

  // ---------- page switching ----------
  ;function setPage(name) {
    if (PAGES.indexOf(name) === -1) name = "home";
    var prev = window.dragonPage;   // Egon 03.10.2026 — only used below to close the vault when leaving likes
    window.dragonPage = name;
    if (name === "social") { try { buildSocialPage(); } catch (e) {} }
    try { document.documentElement.setAttribute("data-dragon-page", name); } catch (e) {}
    try { document.body.setAttribute("data-dragon-page", name); } catch (e) {}
    try { if (name !== "gallery") { var _gc = document.querySelector(".dragon-gal-counter"); if (_gc) _gc.style.display = "none"; } } catch (e) {}
    updateNavGlow(name);
    // Egon 15.09.2026 — hero pics: keep visible regardless of transition (frozen opacity fix).
    try { document.querySelectorAll(".dragon-wow-hero").forEach(function (i) { if (i && i.complete && i.naturalWidth) { i.style.opacity = "1"; i.style.animation = "none"; } }); } catch (e) {}
    if (name !== "account") { var aov = document.querySelector(".dragon-account-page"); if (aov) { try { aov.remove(); } catch (e) {} try { document.documentElement.style.overflow = ""; document.body.style.overflow = ""; } catch (e) {} } }
    if (name !== "history") { var hov = document.querySelector(".dragon-genhist-modal"); if (hov) { try { hov.remove(); } catch (e) {} } }
    if (name !== "character") { var pov = document.querySelector(".dragon-cc-picker"); if (pov) { try { pov.remove(); } catch (e) {} } }
    // Egon 14.09.2026 — close remaining premade / panel-style menus when the page changes (e.g., Toolbox).
    try { if (window.dragonClosePremadeMenu) window.dragonClosePremadeMenu(); } catch (e) {}
    try { if (window.dragonClosePanelStyleMenu) window.dragonClosePanelStyleMenu(); } catch (e) {}
    if (name !== "account" && window.dragonAccountPopRestore) { try { window.dragonAccountPopRestore(); } catch (e) {} }
    if (prev === "likes" && name !== "likes") closeVault();
    // Egon 17.10.2026 — tam-sayfa chat arkada kalan sayfayı görünmez yapıyordu; baloncuk da
    // istenmiyor: sayfa DEĞİŞİNCE açık chat KAPANIR. Bildirimler çalışmaya devam eder (gizli
    // aktif iframe + navbar rozeti), sohbet Chat butonuyla geri açılır. İlk açılışta prev boş,
    // preload görünmez — ikisinde de dokunma.
    if (prev && prev !== name) { try {
      if (chatWinEl && !chatPreloading && chatWinEl.style.display !== "none" &&
          chatWinEl.style.opacity !== "0" && !chatWinEl.classList.contains("dragon-chat-min") &&
          window.dragonChatClose) window.dragonChatClose();
    } catch (e) {} }
    if (name === "home") startHomeRot();
    else stopHomeRot();
  }
  window.dragonSetPage = setPage;

  // Egon 24.09.2026 (W-DOC167) — READABLE PAGE ADDRESSES. perchance.org gives a generator ONE path
  // (perchance.org/<name>), so /home · /chat · /settings can never exist: measured, `perchance.org/bestaigen/home`
  // returns the server's own "Cannot GET /bestaigen/home" page, and no code change can fix that. The shareable
  // form is therefore the HASH — perchance.org/bestaigen#chat opens the chat, #history the history page,
  // #settings the Settings page, and so on. This block is the ONE bridge between the two directions:
  //   page -> hash : written on every switch, so the address always names the page you are on;
  //   hash -> page : read at boot AND on every hashchange, so a pasted/shared link really opens that page.
  // The HOME page keeps the CLEAN root URL (its hash is removed), so `perchance.org/bestaigen` stays exactly
  // what it has always been. Written with history.replaceState (never location.hash) so no hashchange fires
  // and the page can never navigate itself in a loop; `#edit*` is left alone (the platform owns it).
  var HASH_OF = { home: "home", generate: "generation", character: "character", gallery: "gallery", history: "history", social: "social", likes: "likes", account: "settings" };
  var PAGE_OF_HASH = { home: "home", generation: "generate", generate: "generate", character: "character", gallery: "gallery", galleries: "gallery", history: "history", social: "social", likes: "likes", settings: "account", account: "account" };
  ;function pageFromHash() {
    var h = "";
    try { h = String(location.hash || "").replace(/^#/, "").split("?")[0].trim().toLowerCase(); } catch (e) { return null; }
    if (!h || h.indexOf("edit") === 0 || h === "closecodeadmin") return null;
    if (h.charAt(0) === "/") h = h.slice(1);
    if (h === "chat") return "chat";                     // opens the chat window (see openFromHash)
    return PAGE_OF_HASH[h] || null;
  }
  ;function writeHash(name) {
    try {
      if (document.getElementById("dragonAdminPage")) return;
      var want = name === "home" ? "" : ("#" + (HASH_OF[name] || name));
      if (String(location.hash || "") === want) return;
      history.replaceState(null, "", location.pathname + location.search + want);
    } catch (e) {}
  }
  window.dragonPageHashUrl = function (name) {
    var n = (name === "chat") ? "chat" : (HASH_OF[name] || name || "home");
    var nm = "";
    try { nm = window.generatorName || ""; } catch (e) {}
    return "https://perchance.org/" + nm + (n === "home" ? "" : "#" + n);
  };
  ;function openFromHash() {
    var pg = pageFromHash();
    if (pg === "chat") { try { if (window.dragonChatOpen) window.dragonChatOpen(); } catch (e) {} return true; }
    if (!pg) return false;
    window.dragonGoPage(pg);
    return true;
  }
  window.dragonOpenFromHash = openFromHash;
  // The page modules can ask for the address to follow them (kept in the URL).
  window.dragonWritePageHash = function (name) { try { writeHash(name); } catch (e) {} };

  window.dragonGoPage = function (name) {
    setPage(name);
    writeHash(name);
    // Egon 15.09.2026 — hero pics safety net: keep hero images VISIBLE regardless of which page is
    // transitioned to (prevent them from disappearing due to frozen opacity transition).
    try { document.querySelectorAll(".dragon-wow-hero").forEach(function (i) { if (i && i.complete && i.naturalWidth) { i.style.opacity = "1"; i.style.animation = "none"; } }); } catch (e) {}
    try {
      if (name === "generate") { try { if (window.__dragonRefitDesc) window.__dragonRefitDesc(); } catch (e) {} window.scrollTo(0, 0); return; }
      if (name === "character") {
        // Egon 19.09.2026 — place the premade bar FIRST, so it and the CC panel appear in the same paint
        // (no panel-first-then-bar-arrives jump). See placePremadeOutside.
        if (window.dragonPlacePremadeOutside) { try { window.dragonPlacePremadeOutside(); } catch (e) {} }
        if (window.dragonOpenCharPanel) { try { window.dragonOpenCharPanel(); } catch (e) {} }
        try { expandActiveCharPanel(); } catch (e) {}
        if (window.dragonPlacePremadeOutside) { try { window.dragonPlacePremadeOutside(); } catch (e) {} }
        window.scrollTo(0, 0); return;
      }
      if (name === "gallery") {
        openGallery();
        window.scrollTo(0, 0);
        // Egon 22.09.2026 (batch 2.28.1) — re-apply the eager window now that the gallery is really on screen.
        // The window is ALSO computed while the panel is off screen (a scroll/resize can fire during a page
        // switch); there the grid reports no measurable box, so that pass can only fall back to "the first
        // screenful" = a 24-tile window and NO retention band, and it stays that way until the next scroll.
        // Applying it here makes the visible viewport authoritative again the moment the gallery opens.
        // Measured before the fix: entering the gallery -> eager 24 / band 0; after the first scroll or after
        // this call -> eager 84 / band 84 (1920x1080: 118/118). reset()+refresh() is a single read pass, idempotent.
        var _ewRef = function () { try { if (window._dragonEagerReset) window._dragonEagerReset(); } catch (e) {} };
        _ewRef();
        try { requestAnimationFrame(_ewRef); } catch (e) {}
        setTimeout(_ewRef, 150);
        // 📱 Egon 23.09.2026 — the PHONE fit of the row-1 gallery menu is measured from the three buttons
        // UNDER it, and it bails when they have no box: the split can run while the panel is still off screen
        // (a resize during a page switch) or while the gallery was built at a desktop width, and nothing
        // retried once the gallery came on screen — measured live at 390: the menu sat at 353px with its
        // label off-centre until a window resize happened to re-fit it (the check-up's `gal-menu-fit`).
        // Re-running the split now that the gallery is really visible applies the fit (it is idempotent: a
        // hidden pass simply bails again, and the same three buttons are only re-ordered, never duplicated).
        var _gmRef = function () { try { if (window.dragonGalMobileSplit) window.dragonGalMobileSplit(); } catch (e) {} };
        _gmRef();
        try { requestAnimationFrame(_gmRef); } catch (e) {}
        setTimeout(_gmRef, 150);
        return;
      }
      // 📝 Egon 26.09.2026 — the old History PAGE is gone; "history" is now a ROUTE that lands on the
      // Generate page with the 📝 PROMPT PANEL opened (this is what every older caller — the command
      // palette, Dexa, the check-up — means by "go to History").
      if (name === "history") { try { window.dragonHistoryPanel(); } catch (e) {} return; }
      if (name === "likes") { openVault(); window.scrollTo(0, 0); return; }
      if (name === "account") { if (window.dragonAccountOpen) { try { window.dragonAccountOpen(); } catch (e) {} } window.scrollTo(0, 0); return; }
      if (name === "home") { window.scrollTo(0, 0); return; }
    } catch (e) {}
  };

  // ---------- HOME left-click lock (Egon 15.09.2026) ----------
  // On the Home page NOTHING responds to a left click except the 3 CTA buttons (Generate /
  // Character Creation / Galleries). The navbar sits OUTSIDE #dragonHomePage, so it (and any
  // panel it opens — online stats, helper bot chat…) stays fully interactive. We enforce
  // this in the CAPTURE phase so even an element that forgot pointer-events:none stays inert.
  (function installHomeClickLock() {
    if (window.__dragonHomeClickLock) return;
    window.__dragonHomeClickLock = true;
    var onHome = function () { try { return document.documentElement.getAttribute("data-dragon-page") === "home"; } catch (e) { return false; } };
    document.addEventListener("click", function (e) {
      if (e.button && e.button !== 0) return;                 // only LEFT click
      if (!onHome()) return;
      var t = e.target;
      if (!t || !t.closest) return;
      if (!t.closest("#dragonHomePage")) return;              // not on the home overlay → allow
      if (t.closest(".dragon-home-cta button")) return;       // the 3 CTA buttons → allow
      e.preventDefault();
      e.stopPropagation();
    }, true);
    // Egon 15.09.2026 — double clicking should NOT SELECT text/images (blue highlight). selectstart + dblclick +
    // dragstart are also closed in the capture phase (extra safeguard for CSS user-select:none).
    document.addEventListener("selectstart", function (e) {
      if (!onHome()) return;
      var t = e.target;
      if (t && t.closest && t.closest("#dragonHomePage")) e.preventDefault();
    }, true);
    document.addEventListener("dblclick", function (e) {
      if (!onHome()) return;
      var t = e.target;
      if (t && t.closest && t.closest("#dragonHomePage") && !t.closest(".dragon-home-cta button")) e.preventDefault();
    }, true);
    document.addEventListener("dragstart", function (e) {
      if (!onHome()) return;
      var t = e.target;
      if (t && t.closest && t.closest("#dragonHomePage")) e.preventDefault();
    }, true);
  })();

  // ---------- navbar size -> CSS var for the home page top offset ----------
  // ---------- navbar height: CSS owns it ----------
  // The bar has a FIXED height in CSS (36px, or 32px at <=600px) and --dragon-nav-h /
  // --dragon-nav-ctl are declared right next to it, so they can never disagree with the bar.
  // We deliberately do NOT write them inline from a one-off measurement any more: a viewport
  // change does not reliably deliver a resize event, which used to leave a stale DESKTOP value
  // behind on mobile and make the online button / bot sag out of the bar (Egon 12.09.2026).
  ;function sizeNavVar() {
    var spacer = document.getElementById("dragonNavSpacer");
    if (!spacer) return;
    try {
      var h = getComputedStyle(document.documentElement).getPropertyValue("--dragon-nav-h").trim();
      if (h) spacer.style.height = h;
    } catch (e) {}
  }
  window.dragonSizeNavVar = sizeNavVar;

  // ---------- account close observer (restore the moved options popover) ----------
  ;function watchAccountClose() {
    if (window.__dragonAcctObserver) return;
    window.__dragonAcctObserver = new MutationObserver(function () {
      var ov = document.querySelector(".dragon-account-page");
      if (ov) {
        var box = ov.firstElementChild || ov;
        if (box && !box.__dragonExtras && window.dragonAccountMountExtras) window.dragonAccountMountExtras(box);
      } else if (accountPopMounted) {
        accountPopMounted = false;
        setTimeout(function () { try { window.dragonAccountPopRestore(); } catch (e) {} }, 0);
      }
    });
    try {
      window.__dragonAcctObserver.observe(document.body, { childList: true });
      var orig = window.dragonAccountOpen;
      if (orig && !orig.__dragonWrapped) {
        var wrapped = function () { var r = orig.apply(this, arguments); try { sizeNavVar(); var ov = document.querySelector(".dragon-account-page"); var box = ov && (ov.firstElementChild || ov); if (box && window.dragonAccountMountExtras) window.dragonAccountMountExtras(box); } catch (e) {} return r; };
        wrapped.__dragonWrapped = true;
        window.dragonAccountOpen = wrapped;
      }
    } catch (e) {}
  }

  // ============================================================
  //  FLOATING CHAT WINDOW  (Egon 11.09.2026)
  //  Draggable / resizable / minimizable / maximizable / closable,
  //  remembers geometry, opens on the current page. Channels come from
  //  the tabbed comments plugin (General / Room 1-3 / Prompts / Images / Feedback).
  // ============================================================
  var chatWinEl = null, chatBodyEl = null, chatBuilt = false;
  var chatBubble = null, chatFlying = false, chatFlyAnim = null;
  var chatInputText = Object.create(null);
  var chatPrevGeo = null;
  var chatPreloading = false;   // Egon 15.09.2026 — true while the chat window is built hidden for background notifications
  var chatOpenedByUser = false; // Egon 15.09.2026 — true once the user explicitly opens the chat (preload must not re-hide it)

  ;function chatLS(k, d) { try { return localStorage.getItem(k) == null ? d : localStorage.getItem(k); } catch (e) { return d; } }
  ;function chatLSSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  window.addEventListener("message", function (e) {
    if (e.origin !== "https://comments-plugin.perchance.org") return;
    if (e.data && e.data.type === "input_el_text_change") {
      var ch = (e.data.channel != null) ? String(e.data.channel) : "";
      chatInputText[ch] = e.data.text || "";
    }
  }, false);

  ;function chatActive() {
    var w = chatWinEl;
    if (!w) return null;
    var tab = w.querySelector(".tabbed-comments-plugin-channel-tab.tabbed-comments-plugin-active-tab");
    var ch = tab ? (tab.dataset.channel || "") : "";
    var content = w.querySelector(".tabbed-comments-plugin-content.tabbed-comments-plugin-active-content");
    if (!content) content = w.querySelector(".tabbed-comments-plugin-content");
    var iframe = content ? content.querySelector("iframe") : null;
    return { channel: ch, content: content, iframe: iframe };
  }
  ;function chatIsGeneral(ch) { return ch === "" || ch === "general"; }
  ;function chatPost(msg) {
    var a = chatActive();
    if (!a || !a.iframe || !a.iframe.contentWindow) return false;
    try { a.iframe.contentWindow.postMessage(msg, "https://comments-plugin.perchance.org"); return true; } catch (e) { return false; }
  }
  ;function chatBuildContent() {
    if (chatBuilt || !chatBodyEl) return;
    if (typeof window.generateCommentsPluginElement85638294 !== "function") return;
    try {
      var el = window.generateCommentsPluginElement85638294();
      chatBodyEl.appendChild(el);
      chatBuilt = true;
      chatApplyTabTips();
      setTimeout(chatApplyTabTips, 700);
      setTimeout(chatApplyTabTips, 2000);
    } catch (e) {}
  }
  // Some environments don't fire IntersectionObserver (so the comments plugin's lazy iframe
  // loader never runs and every channel stays on its loading facade). Detect that and rebuild
  // the tabbed comments with a temporary eager IntersectionObserver so the iframes are created.
  ;function chatEnsureLoaded(force) {
    setTimeout(function () {
      if (!chatWinEl) return;
      if (!force && chatWinEl.style.display === "none") return;
      var active = chatWinEl.querySelector(".tabbed-comments-plugin-content.tabbed-comments-plugin-active-content");
      if (active && active.querySelector("iframe")) return;
      var RealIO = window.IntersectionObserver;
      if (!RealIO || RealIO.__dragonEagerShim) return;
      ;function ShimIO(cb, opts) {
        var self = this;
        self._cb = cb;
        self.disconnect = function () {};
        self.unobserve = function () {};
        self.takeRecords = function () { return []; };
        self.observe = function (el) {
          setTimeout(function () {
            var r = el.getBoundingClientRect ? el.getBoundingClientRect() : { top: 0, left: 0, width: 1, height: 1 };
            try { cb([{ isIntersecting: true, intersectionRatio: 1, target: el, boundingClientRect: r, intersectionRect: r, rootBounds: r, time: Date.now() }], self); } catch (e) {}
          }, 0);
        };
      }
      ShimIO.__dragonEagerShim = true;
      window.IntersectionObserver = ShimIO;
      try { if (chatBodyEl) chatBodyEl.innerHTML = ""; } catch (e) {}
      chatBuilt = false;
      chatBuildContent();
      setTimeout(function () { if (window.IntersectionObserver === ShimIO) window.IntersectionObserver = RealIO; }, 1500);
    }, 2600);
  }

  ;function chatSaveGeo() {
    if (!chatWinEl) return;
    // Egon 17.10.2026 (W-SOC381) — the full page has no geometry worth remembering (its box is the
    // whole screen); saving it would reopen the floating window screen-sized. Only the min flag is kept.
    if (chatWinEl.classList.contains("dragon-chat-full") && !chatWinEl.classList.contains("dragon-chat-min")) return;
    // Egon 15.09.2026 — before SAVING position/size, we cancel the unfinished flight animation and
    // clear the inline transform. Otherwise, `getBoundingClientRect` would read the scaled box (e.g.,
    // 280x260 mid-flight) and permanently save the CORRUPT geometry (observed exactly in live test:
    // the window opened as 280x260 on the next launch).
    chatKillFlyAnim();
    var r = chatWinEl.getBoundingClientRect();
    // Egon 15.09.2026 — the remembered SIZE is the user's chosen size (the inline style), NOT the visual box:
    // on a narrow viewport the box is clamped by max-width/max-height, and we must not overwrite the
    // real (e.g. desktop) size with that clamped value.
    var sw = parseFloat(chatWinEl.style.width), sh = parseFloat(chatWinEl.style.height);
    var w = (sw > 0) ? Math.round(sw) : Math.round(r.width);
    var h = (sh > 0) ? Math.round(sh) : Math.round(r.height);
    chatLSSet("dragonChatGeo", JSON.stringify({
      left: Math.round(r.left), top: Math.round(r.top), width: w, height: h,
      state: chatWinEl.classList.contains("dragon-chat-min") ? "min" : "normal"
    }));
  }
  // Egon 15.09.2026 — the window can NEVER overflow the visible screen (so it "won't get lost" again).
  // We clip the position so it remains fully visible (6px margin; if the window is larger than the screen,
  // it sticks to the left/top edge and only the clippable part stays outside).
  ;function chatClampPos(left, top, w, h) {
    var m = 6;
    var maxL = Math.max(m, window.innerWidth - w - m);
    var maxT = Math.max(m, window.innerHeight - h - m);
    return { left: Math.round(Math.max(m, Math.min(maxL, left))), top: Math.round(Math.max(m, Math.min(maxT, top))) };
  }
  ;function chatClampCurrent() {
    if (!chatWinEl || chatWinEl.style.display === "none") return;
    if (chatFlying) return;
    if (chatWinEl.classList.contains("dragon-chat-full")) return;   // the full page is the screen; nothing to clip
    if (chatWinEl.classList.contains("dragon-chat-min")) return;
    var r = chatWinEl.getBoundingClientRect();
    var p = chatClampPos(r.left, r.top, r.width, r.height);
    if (p.left !== Math.round(r.left) || p.top !== Math.round(r.top)) {
      chatWinEl.style.left = p.left + "px"; chatWinEl.style.top = p.top + "px";
      chatWinEl.style.right = "auto"; chatWinEl.style.bottom = "auto";
      chatSaveGeo();
    }
  }
  ;function chatApplyGeo() {
    if (!chatWinEl) return;
    var g = null;
    try { g = JSON.parse(chatLS("dragonChatGeo", "") || "null"); } catch (e) { g = null; }
    if (!g) return;
    if (g.state === "min") chatWinEl.classList.add("dragon-chat-min");
    // Egon 17.10.2026 (W-SOC381) — windowed view restores the remembered size/position (clamped to
    // this screen); the full page ignores geometry (the stylesheet owns its box). A save that is
    // clearly a fullscreen-era box (screen-wide) is dropped so the window reopens small, not wall-sized.
    if (chatWinEl.classList.contains("dragon-chat-full")) return;
    var staleFull = (+g.width) >= window.innerWidth - 20 && (+g.height) >= window.innerHeight - 120;
    if (staleFull) return;
    var w = Math.max(280, Math.min(window.innerWidth - 10, (+g.width) || 0));
    var h = Math.max(260, Math.min(window.innerHeight - 10, (+g.height) || 0));
    if ((+g.width) > 0) chatWinEl.style.width = w + "px";
    if ((+g.height) > 0) chatWinEl.style.height = h + "px";
    if (typeof g.left === "number" && typeof g.top === "number") {
      var p = chatClampPos(g.left, g.top, w || 400, h || 600);
      chatWinEl.style.left = p.left + "px"; chatWinEl.style.top = p.top + "px";
      chatWinEl.style.right = "auto"; chatWinEl.style.bottom = "auto";
    }
  }
  // Egon 17.10.2026 (W-SOC381) — chat VIEW: "win" (floating window, the default) or "full"
  // (full page under the navbar). Remembered in localStorage; the ⛶ header button flips it.
  ;function chatView() { return chatLS("dragonChatView", "win") === "full" ? "full" : "win"; }
  ;function chatApplyView() {
    if (!chatWinEl) return;
    var full = chatView() === "full";
    chatWinEl.classList.toggle("dragon-chat-full", full);
    if (full) {
      chatWinEl.style.left = ""; chatWinEl.style.top = "";
      chatWinEl.style.width = ""; chatWinEl.style.height = "";
      chatWinEl.style.right = ""; chatWinEl.style.bottom = "";
    } else {
      chatApplyGeo();
    }
    if (window.__dragonChatSyncViewBtn) window.__dragonChatSyncViewBtn();
  }
  ;function chatSetView(v) { chatLSSet("dragonChatView", v === "full" ? "full" : "win"); chatApplyView(); }
  window.dragonChatView = chatView; window.dragonChatSetView = chatSetView;

  // Egon 15.09.2026 — chat OPEN POSITION rule (Egon 17.10.2026 W-SOC381: the window opens WINDOWED
  //    by default; the full page only when the ⛶ button chose it):
  //  • Opening puts the window where it was (remembered geometry) or at the default corner;
  //    the full page clears stale inline geometry first (the stylesheet owns its box).
  //  • If it WAS minimized (the bottom-left bubble is showing), any chat button restores it
  //    in the current view instead (see chatRestoreFromBubble).
  ;function chatIsMinimized() {
    return !!((chatWinEl && chatWinEl.classList.contains("dragon-chat-min")) ||
              (chatBubble && chatBubble.classList.contains("dragon-on")));
  }
  // Egon 15.09.2026 (v2) — the "Click to ⚙️ change Username" hint is now GLUED TO THE GEAR: Egon moved the
  // native ⚙️ to the RIGHT END of the bottom row (main.pjs settingsButtonStyle: max(196px, 100% - 84px)), so
  // the hint is no longer a filler between 🖼️ and the gear — it is a compact box whose RIGHT edge touches the
  // gear's LEFT edge (Egon: "also shift the change user name button next to it to the right"). Its width is its natural
  // content width (clamped 78–110px) and the font is scaled down (never below 7px) so the two nowrap lines
  // always fit. It hides only when the window is genuinely too narrow for it to sit beside the tools.
  // Egon 24.09.2026 — the [😊][🖼️][👋] overlay row used to start at left:8px, which sat ON TOP of the
  // comments-plugin's OWN quick-avatar button (#quickAvatarSwitchBtn > #currentUserAvatarDisplayEl) — the
  // user's PROFILE PICTURE, at the left end of the native buttons row. That avatar lives inside the
  // CROSS-ORIGIN chat iframe, so it cannot be measured directly; it is however always glued to the iframe's
  // left edge (margin-left:2px + a 1.2rem picture), so the row is placed just past
  // `iframe.left + 2px + 1.2rem + 8px`. The iframe's left inset inside the chat window is NOT constant
  // (37px on desktop, ~0 on a phone — the tabbed plugin centres its middle column), so it is measured LIVE
  // (on open, on every resize, and by chatNameHintSoon's retries) instead of being hard-coded.
  ;function chatPlaceTools() {
    if (!chatWinEl) return;
    var tools = chatWinEl.querySelector(".dragon-chat-tools");
    if (!tools) return;
    var ifr = chatWinEl.querySelector(".tabbed-comments-plugin-content iframe") || chatWinEl.querySelector("iframe");
    if (!ifr) return;
    var winR = chatWinEl.getBoundingClientRect();
    var ifrR = ifr.getBoundingClientRect();
    var left = Math.round((ifrR.left - winR.left) + 2 + 19.2 + 8);   // avatar (2px margin + 1.2rem) + 8px gap
    if (left < 8) left = 8;
    tools.style.left = left + "px";
  }
  window.dragonChatPlaceTools = chatPlaceTools;

  ;function chatUpdateNameHint() {
    chatPlaceTools();
    var el = window.__dragonChatNameHintEl;
    if (!el || !chatWinEl) return;
    var winR = chatWinEl.getBoundingClientRect();
    // Narrow window: slim the [👋 😊 🖼️] tools (52px instead of 58px) so the hint keeps its full width.
    // Toggled from the real window width so a shrunken desktop window gets it too.
    chatWinEl.classList.toggle("dragon-chat-narrow", winR.width < 470);
    var ifr = chatWinEl.querySelector(".tabbed-comments-plugin-content iframe") || chatWinEl.querySelector("iframe");
    if (!ifr) { el.hidden = true; return; }
    var ifrR = ifr.getBoundingClientRect();
    // MUST stay in sync with main.pjs settingsButtonStyle (margin-left: max(196px, calc(100% - 84px))):
    // the gear's left edge, relative to the chat window.
    var margin = Math.max(196, ifrR.width - 84);
    var gearLeft = (ifrR.left - winR.left) + margin;
    var tools = chatWinEl.querySelector(".dragon-chat-tools");
    var toolBtns = tools ? tools.querySelectorAll(".dragon-chat-tool") : null;
    var lastTool = toolBtns && toolBtns.length ? toolBtns[toolBtns.length - 1] : null;
    var toolsRight = lastTool ? (lastTool.getBoundingClientRect().right - winR.left) : 188;
    // measure the hint's natural content width at the base font, then choose the box width
    el.hidden = false;
    el.style.fontSize = "";
    el.style.marginLeft = "0px";
    el.style.width = "auto";
    var natural = el.getBoundingClientRect().width;
    var boxW = Math.min(110, Math.max(78, Math.ceil(natural) + 8));
    // Egon 24.09.2026 — the tool row now starts further right (it clears the native avatar), so the free gap
    // between the tools and the gear is smaller: shave the box to that gap (the font is scaled down below)
    // so the hint survives on a phone instead of vanishing. 78px is the readable floor — below it the hint
    // is dropped entirely, exactly as before.
    var availW = Math.floor(gearLeft - toolsRight - 6);
    if (availW < 78) { el.hidden = true; return; }
    if (boxW > availW) boxW = availW;
    var hintLeft = Math.round(gearLeft - boxW);
    el.style.width = boxW + "px";
    var baseLeft = el.getBoundingClientRect().left - winR.left;   // actual left with margin-left:0 (includes the flex gap)
    el.style.marginLeft = Math.round(hintLeft - baseLeft) + "px";
    var inner = boxW - 8;                          // minus 2×4px padding
    var l2 = el.querySelector(".l2");
    if (!l2) return;
    var need = l2.getBoundingClientRect().width;
    if (need > inner) {
      var fs = Math.max(7, 9.28 * inner / need);   // scale the text down to fit
      el.style.fontSize = fs.toFixed(2) + "px";
      if (l2.getBoundingClientRect().width > inner) el.hidden = true;   // even at 7px it won't fit
    }
  }
  window.dragonChatUpdateNameHint = chatUpdateNameHint;
  // Egon 15.09.2026 — the comments iframe is created ASYNCHRONOUSLY (the plugin's lazy loader), so at the
  // moment the chat opens there is no iframe yet and chatUpdateNameHint would hide the hint forever.
  // chatNameHintSoon() re-runs it a few times over the next few seconds so the hint appears as soon as
  // the gear (and thus the free gap) actually exists.
  ;function chatNameHintSoon() {
    chatUpdateNameHint();
    [80, 300, 800, 1600, 3000, 5200].forEach(function (t) { setTimeout(chatUpdateNameHint, t); });
  }
  window.dragonChatNameHintSoon = chatNameHintSoon;

  // ===== PARKED (Egon 15.09.2026) — [307] ➤ VERTICAL-CENTER TRACKING — REVERTED at Egon's request (see [308]) =====
  // Parked intact (NOT deleted). To re-enable: remove the /* and */ markers around this block, then re-add the
  // chatSyncSubmitPos() calls in the input_el_text_change handler, the resize handler, buildChatWindow() and
  // chatInsertText(). It measured ≤0.3px off-centre against a same-origin replica at every box size.
  /*  // Egon 15.09.2026 — the ➤ Submit now sits at the VERTICAL CENTER of the comment box's right side and
  // FOLLOWS it as the box grows (Egon: "if the submit button stayed centered to the comment area — and stayed centered vertically on the right as the area grew"). The comment <textarea> lives inside the CROSS-ORIGIN comments embeds, so
  // its height cannot be read from the DOM — but it is deterministic, so we REPRODUCE it: the embed gives the
  // textarea `field-sizing:content; min-height:50px; max-height:40vh; padding:10px 16px; box-sizing:border-box`
  // and `width:calc(100% - 60px)` (our inputAreaStyle), and its text is mirrored to us via the plugin's
  // `input_el_text_change` postMessage (kept in chatInputText). So we wrap the SAME text in a hidden textarea
  // with the same font (sans-serif 14px, line-height:normal), the same CONTENT width (iframeWidth − 92) and
  // the same wrapping rules, then read its scrollHeight. Measured against a same-origin replica of the embed:
  // exact (0px error) at every size, including the 50px min and the 40vh cap.
  var chatMeasureEl = null;
  ;function chatTextareaHeight(text, contentW, cap) {
    if (!chatMeasureEl) {
      chatMeasureEl = document.createElement("textarea");
      chatMeasureEl.id = "dragonChatMeasure";
      chatMeasureEl.tabIndex = -1;
      chatMeasureEl.setAttribute("aria-hidden", "true");
      chatMeasureEl.style.cssText = "position:fixed; left:-20000px; top:0; height:0; padding:0; border:0; margin:0;" +
        "font-family:sans-serif; font-size:14px; font-weight:400; font-style:normal; line-height:normal;" +
        "letter-spacing:normal; text-transform:none; text-indent:0; box-sizing:content-box;" +
        "white-space:pre-wrap; overflow-wrap:break-word; overflow:hidden; resize:none;";
      document.body.appendChild(chatMeasureEl);
    }
    chatMeasureEl.style.width = contentW + "px";
    chatMeasureEl.value = text || "";
    return Math.min(cap, Math.max(50, 20 + chatMeasureEl.scrollHeight));   // + the textarea's 10px top/bottom padding
  }
  // Centers our ➤ on the comment box and keeps it there while the box grows. The embed is cross-origin, so the
  // numbers come from chatTextareaHeight() plus the iframe's own geometry (see the comment above).
  ;function chatSyncSubmitPos() {
    if (!chatWinEl) return;
    var sub = chatWinEl.querySelector(".dragon-chat-submit");
    if (!sub) return;
    var a = chatActive();
    if (!a || !a.iframe) { sub.style.bottom = ""; return; }
    var ifrR = a.iframe.getBoundingClientRect();
    var winR = chatWinEl.getBoundingClientRect();
    if (!ifrR.height) { sub.style.bottom = ""; return; }
    var contentW = Math.max(40, ifrR.width - 92);   // 60px gutter (inputAreaStyle) + 16px×2 padding
    var cap = Math.max(50, 0.4 * ifrR.height);      // max-height:40vh (vh = the iframe's own viewport height)
    var h = chatTextareaHeight(chatInputText[a.channel] || "", contentW, cap);
    // The textarea's bottom edge sits 52px above the iframe's bottom (44px native buttons row + its 8px margin).
    // Center our 44px button on the textarea → its bottom offset from the chat window's bottom edge.
    // NOTE: an absolutely-positioned child is offset from the window's PADDING box, so subtract its border width.
    var borderB = parseFloat(getComputedStyle(chatWinEl).borderBottomWidth) || 0;
    sub.style.bottom = ((winR.bottom - borderB - ifrR.bottom) + 30 + h / 2) + "px";   // 30 = 52 − 44/2; no rounding → sub-pixel exact
  }
  window.dragonChatSyncSubmitPos = chatSyncSubmitPos;
  // Same lazy-iframe problem as the rename hint: at open there is no iframe yet, so re-run for a few seconds.
  ;function chatSyncSubmitPosSoon() {
    chatSyncSubmitPos();
    [80, 300, 800, 1600, 3000, 5200].forEach(function (t) { setTimeout(chatSyncSubmitPos, t); });
  }
  window.dragonChatSyncSubmitPosSoon = chatSyncSubmitPosSoon;  */

  ;function chatMakeDraggable(win, head) {
    var sx, sy, ox, oy, dragging = false;
    head.addEventListener("pointerdown", function (e) {
      if (win.classList.contains("dragon-chat-full")) return;   // the full page never drags
      if (e.target.closest && e.target.closest(".dragon-chat-btn")) return;
      dragging = true; head.classList.add("dragon-dragging");
      var r = win.getBoundingClientRect();
      win.style.left = r.left + "px"; win.style.top = r.top + "px";
      win.style.right = "auto"; win.style.bottom = "auto";
      sx = e.clientX; sy = e.clientY; ox = r.left; oy = r.top;
      try { head.setPointerCapture(e.pointerId); } catch (_) {}
      e.preventDefault();
    });
    head.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      // Egon 15.09.2026 — the window can no longer be dragged COMPLETELY outside the visible screen (loss protection).
      var p = chatClampPos(ox + e.clientX - sx, oy + e.clientY - sy, win.offsetWidth, win.offsetHeight);
      win.style.left = p.left + "px"; win.style.top = p.top + "px";
    });
    ;function end() { if (!dragging) return; dragging = false; head.classList.remove("dragon-dragging"); chatSaveGeo(); }
    head.addEventListener("pointerup", end);
    head.addEventListener("pointercancel", end);
  }
  ;function chatMakeResizable(win, handle) {
    var sx, sy, ow, oh, rz = false;
    handle.addEventListener("pointerdown", function (e) {
      if (win.classList.contains("dragon-chat-full")) return;   // the full page never resizes
      if (win.classList.contains("dragon-chat-min")) return;
      rz = true;
      var r = win.getBoundingClientRect();
      win.style.left = r.left + "px"; win.style.top = r.top + "px";
      win.style.right = "auto"; win.style.bottom = "auto";
      sx = e.clientX; sy = e.clientY; ow = r.width; oh = r.height;
      try { handle.setPointerCapture(e.pointerId); } catch (_) {}
      e.preventDefault(); e.stopPropagation();
    });
    handle.addEventListener("pointermove", function (e) {
      if (!rz) return;
      win.style.width = Math.max(280, Math.min(window.innerWidth - 10, ow + e.clientX - sx)) + "px";
      win.style.height = Math.max(260, Math.min(window.innerHeight - 10, oh + e.clientY - sy)) + "px";
    });
    ;function end() { if (!rz) return; rz = false; chatClampCurrent(); chatSaveGeo(); }
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  }

  // Egon 12.09.2026 — minimize now flies the whole window into a circular button at the
  // bottom-left corner (the navbar chat symbol), and clicking that circle reopens the window
  // at its remembered position.
  ;function chatEnsureBubble() {
    if (chatBubble && chatBubble.isConnected) return chatBubble;
    var b = document.createElement("button");
    b.id = "dragonChatBubble";
    b.type = "button";
    b.title = "Open chat";
    b.innerHTML = "\uD83D\uDCAC";
    b.onclick = function (e) { e.stopPropagation(); chatRestoreFromBubble(); };
    document.body.appendChild(b);
    chatBubble = b;
    return b;
  }
  ;function chatShowBubble(on) {
    var b = chatEnsureBubble();
    if (on) b.classList.add("dragon-on"); else b.classList.remove("dragon-on");
  }
  // Egon 15.09.2026 — the SOLE owner of the shrink/re-open flight animation (WAAPI). If a new flight
  // started while one was ongoing, the transform effect of the old animation remained on top, leaving the window
  // in the wrong place/hanging; we call this BEFORE every flight to clear it.
  ;function chatKillFlyAnim() {
    try { if (chatFlyAnim) chatFlyAnim.cancel(); } catch (e) {}
    chatFlyAnim = null;
    if (chatWinEl) { chatWinEl.style.transform = ""; chatWinEl.style.opacity = ""; chatWinEl.style.borderRadius = ""; }
  }
  ;function chatMinimizeFly() {
    if (!chatWinEl || chatFlying) return;
    if (chatWinEl.style.display === "none") return;
    // Egon 17.10.2026 — baloncuğa inince de #chat adresten düşer (görünmeyen sohbet adres olmasın).
    try { if (String(location.hash || "").toLowerCase() === "#chat") history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
    chatSaveGeo();
    chatWinEl.classList.remove("dragon-chat-min");
    chatKillFlyAnim();
    var r = chatWinEl.getBoundingClientRect();
    // Egon 15.09.2026 — target: the BOTTOM-LEFT corner of the visible screen; should be EXACTLY in the same place
    // as the shrunk circle (#dragonChatBubble, CSS left/bottom:8px). Since `transform` scaling occurs
    // around the element's CENTER, it is MANDATORY to compensate the target relative to the center: the old code
    // used `endLeft - r.left` / `endTop - r.top`, so the shrinking window shifted right (~182px) and down (~180px)
    // it was flying to "bottom center". Correct: hedef_merkez - eleman_merkezi.
    var bubbleBox = 56, edge = 8;
    var endLeft = edge;
    var endTop = Math.round(window.innerHeight - edge - bubbleBox);
    var sx = bubbleBox / Math.max(1, r.width), sy = bubbleBox / Math.max(1, r.height);
    var tx = endLeft + bubbleBox / 2 - (r.left + r.width / 2);
    var ty = endTop + bubbleBox / 2 - (r.top + r.height / 2);
    chatFlying = true;
    chatEnsureBubble();
    var anim = null;
    try {
      anim = chatWinEl.animate([
        { transform: "none", opacity: 1, borderRadius: "16px" },
        { transform: "translate(" + tx + "px," + ty + "px) scale(" + sx + "," + sy + ")", opacity: 0, borderRadius: "50%" }
      ], { duration: 420, easing: "cubic-bezier(.4,.9,.3,1)", fill: "forwards" });
    } catch (e) {}
    if (anim) chatFlyAnim = anim;
    // Egon 15.09.2026 — Web Animations `onfinish` sometimes NEVER fires in this environment (animation
    // completes but neither finish nor cancel event arrives); in that case `chatFlying` stayed true forever
    // and shrinking/re-opening would completely lock up (observed exactly in live test).
    // Therefore, finish is NOT the SOLE entry point: onfinish + anim.finished promise + duration-guaranteed
    // setTimeout, all tied to the same idempotent `finish`.
    var done = false;
    var finish = function () {
      if (done) return;
      done = true;
      chatFlying = false;
      chatWinEl.style.display = "none";
      try { if (anim) anim.cancel(); } catch (e) {}
      if (chatFlyAnim === anim) chatFlyAnim = null;
      chatWinEl.style.transform = "";
      chatWinEl.style.opacity = "";
      chatWinEl.style.borderRadius = "";
      chatShowBubble(true);
    };
    if (anim) {
      anim.onfinish = finish;
      try { if (anim.finished) anim.finished.then(finish, finish); } catch (e) {}
    }
    setTimeout(finish, anim ? 620 : 30);
  }
  ;function chatRestoreFromBubble() {
    if (!chatWinEl || chatFlying) return;
    var b = chatEnsureBubble();
    var br = b.getBoundingClientRect();
    chatOpenedByUser = true;
    chatShowBubble(false);
    chatWinEl.classList.remove("dragon-chat-min");
    chatApplyGeo();
    chatApplyView();
    chatWinEl.style.display = "flex";
    try { writeHash("chat"); } catch (e) {}
    chatRefreshMeLabel();
    chatNameHintSoon();
    chatBadgeSet(0);   // Egon 15.09.2026 — restoring the chat window also clears the unread badge
    chatKillFlyAnim();
    var r = chatWinEl.getBoundingClientRect();
    var sx = Math.max(1, br.width) / Math.max(1, r.width), sy = Math.max(1, br.height) / Math.max(1, r.height);
    // Egon 15.09.2026 — reverse animation should also use the same center-compensation, otherwise the window
    // starts from the wrong point while expanding from the circle (hedef_merkez - eleman_merkezi).
    var tx = br.left + br.width / 2 - (r.left + r.width / 2);
    var ty = br.top + br.height / 2 - (r.top + r.height / 2);
    chatFlying = true;
    var anim = null;
    try {
      anim = chatWinEl.animate([
        { transform: "translate(" + tx + "px," + ty + "px) scale(" + sx + "," + sy + ")", opacity: 0, borderRadius: "50%" },
        { transform: "none", opacity: 1, borderRadius: "16px" }
      ], { duration: 420, easing: "cubic-bezier(.4,.9,.3,1)" });
    } catch (e) {}
    if (anim) chatFlyAnim = anim;
    var done = false;
    var finish = function () {
      if (done) return;
      done = true;
      chatFlying = false;
      try { if (anim) anim.cancel(); } catch (e) {}
      if (chatFlyAnim === anim) chatFlyAnim = null;
      chatWinEl.style.transform = "";
      chatWinEl.style.opacity = "";
      chatWinEl.style.borderRadius = "";
    };
    if (anim) {
      anim.onfinish = finish;
      try { if (anim.finished) anim.finished.then(finish, finish); } catch (e) {}
    }
    setTimeout(finish, anim ? 620 : 30);
  }
  window.dragonChatMinimizeFly = chatMinimizeFly;
  window.dragonChatRestoreFromBubble = chatRestoreFromBubble;

  // Per-channel hover tooltips for the tabbed-comments channel tabs.
  var CHAT_CHANNEL_TIPS = {
    "": "General \u2014 hang out and chat with everyone",
    "general": "General \u2014 hang out and chat with everyone",
    "chat1": "Room 1 \u2014 a side room for casual chat",
    "chat2": "Room 2 \u2014 a side room for casual chat",
    "prompts": "Prompts \u2014 share cool prompts & styles",
    "images": "Images \u2014 share image links (keep it friendly)",
    "suggestion": "Suggestion \u2014 propose a new feature or improvement"
  };
  // Egon 19.09.2026 — the channels that come from main.pjs `commentChannels`. These are the generator's
  // OWN rooms: a visitor can never close one of them. Only a room the visitor added themselves (through
  // the ＋ dialog) is theirs to leave.
  var CHAT_DEFAULT_CHANNELS = ["", "general", "chat1", "chat2", "prompts", "images", "suggestion"];
  ;function chatApplyTabTips() {
    if (!chatWinEl) return;
    var tabs = chatWinEl.querySelectorAll(".tabbed-comments-plugin-channel-tab");
    for (var i = 0; i < tabs.length; i++) {
      var t = tabs[i];
      var ch = t.dataset ? (t.dataset.channel || "") : "";
      var tip = CHAT_CHANNEL_TIPS[ch];
      if (!tip) { var lbl = (t.textContent || "").trim(); tip = lbl ? (lbl + " channel") : "Chat channel"; }
      t.title = tip;
    }
    chatDecorateTabs();
  }

  // ============================================================
  //  ✕ CLOSE A CHAT CHANNEL   (Egon 19.09.2026, v2 same day)
  //  v2: the ✕ is offered ONLY on the CURRENTLY SELECTED channel, and only when that channel is one
  //  the visitor added themselves — the generator's own default rooms (General, Room 1, Room 2,
  //  Prompts, Images, Suggestion) can never be closed. Closing a custom room is permanent for that
  //  visitor: we drop the plugin's own stored-custom-channel entry and let the plugin remove the tab
  //  (the plugin reacts to the synthetic "storage" event). Typing the name into ＋ again brings it
  //  back, exactly like adding a fresh room.
  // ============================================================
  var CHAT_HIDDEN_KEY = "dragonChatHidden";
  var chatTabsObs = null, chatTabsObsT = 0, chatTabSyncTimer = 0, chatTabSyncUntil = 0;

  ;function chatCustoms() { try { return JSON.parse(localStorage.getItem("__tabbedCommentsPluginCustomChannels") || "{}") || {}; } catch (e) { return {}; } }
  ;function chatTabChOf(t) { return (t && t.dataset) ? (t.dataset.channel || "") : ""; }
  ;function chatActiveCh() {
    var w = chatWinEl;
    if (!w) return null;
    var act = w.querySelector(".tabbed-comments-plugin-channel-tab.tabbed-comments-plugin-active-tab");
    return act ? chatTabChOf(act) : null;
  }
  // a channel is closable only when it is NOT one of the generator's own default rooms
  ;function chatTabClosable(ch) { return !!ch && CHAT_DEFAULT_CHANNELS.indexOf(ch) < 0; }
  ;function chatIsCustomCh(ch) { return chatTabClosable(ch) && !!chatCustoms()[ch]; }
  ;function chatTabXOf(t) {
    for (var i = 0; i < t.children.length; i++) { if (t.children[i].classList && t.children[i].classList.contains("dragon-chat-tabx")) return t.children[i]; }
    return null;
  }
  ;function chatHideChannel(ch) {
    if (!chatTabClosable(ch) || !chatWinEl) return;
    // Forget the visitor's own room: deleting the stored custom-channel entry is the plugin's own
    // removal path (it also removes the tab + its content), and the synthetic storage event is the
    // signal the plugin syncs on for every other open chat module on the page.
    var customs = chatCustoms();
    if (customs[ch]) {
      delete customs[ch];
      try { localStorage.setItem("__tabbedCommentsPluginCustomChannels", JSON.stringify(customs)); } catch (e) {}
      try { window.dispatchEvent(new StorageEvent("storage", { key: "__tabbedCommentsPluginCustomChannels" })); } catch (e) {}
    }
    try { localStorage.removeItem(CHAT_HIDDEN_KEY); } catch (e) {}
    chatDecorateTabs();
  }
  // one-time cleanup of the v1 hidden-channel set (that mechanism is retired: default rooms are no
  // longer closable, so any left-over entry would keep a room hidden forever)
  try { if (localStorage.getItem(CHAT_HIDDEN_KEY)) localStorage.removeItem(CHAT_HIDDEN_KEY); } catch (e) {}
  ;function chatDecorateTabs() {
    chatTabsWatch();
    var w = chatWinEl;
    if (!w) return;
    var tabs = w.querySelectorAll(".tabbed-comments-plugin-channel-tab");
    var active = chatActiveCh();
    for (var i = 0; i < tabs.length; i++) {
      var t = tabs[i], ch = chatTabChOf(t);
      var x = chatTabXOf(t);
      var want = (ch === active && chatTabClosable(ch));
      if (want && !x) {
        x = document.createElement("span");
        x.className = "dragon-chat-tabx";
        x.textContent = "\u2715";
        x.title = "Leave this room (a room you added yourself) \u2014 bring it back with the \uFF0B button";
        x.setAttribute("role", "button");
        x.onclick = (function (c) { return function (ev) { ev.stopPropagation(); ev.preventDefault(); chatHideChannel(c); }; })(ch);
        t.appendChild(x);
      } else if (!want && x) {
        x.remove();
      }
    }
    // Egon 19.09.2026 — the plugin's own ⬅️ ➡️ ("move channel") and 🗑️ ("Hide or unpin this channel")
    // buttons are retired: the visitor leaves a room with our red ✕ on the tab, and rooms keep the order
    // they were added in. They are deleted from the DOM (the plugin only re-creates them if its cached
    // reference is empty), so no leftover of the feature survives.
    var _ctl = w.querySelectorAll(".tabbed-comments-plugin-channel-control-btn");
    for (var _ci = 0; _ci < _ctl.length; _ci++) { try { _ctl[_ci].remove(); } catch (e) {} }
    chatRangeSync();
    try { chatCustomEnsure(); } catch (e) {}
  }
  ;function chatTabsWatch() {
    if (chatTabsObs || !chatBodyEl || !window.MutationObserver) return;
    try {
      chatTabsObs = new MutationObserver(function () {
        var now = Date.now();
        if (now - chatTabsObsT < 180) return;
        chatTabsObsT = now;
        chatDecorateTabs();
      });
      chatTabsObs.observe(chatBodyEl, { childList: true, subtree: true });
      chatBodyEl.addEventListener("click", function (e) {
        var t = e.target;
        if (t && t.classList && t.classList.contains("tabbed-comments-plugin-add-custom-channel")) chatTabRestorePoll();
        else if (t && t.closest && t.closest(".tabbed-comments-plugin-channel-tab")) chatTabRestorePoll();
      }, true);
    } catch (e) {}
  }
  // after a ＋ confirm or a tab switch the plugin swaps tabs/iframes a moment later — poll briefly so
  // the ✕ and the message-range always land on whatever is showing now
  ;function chatTabRestorePoll() {
    chatTabSyncUntil = Date.now() + 12000;
    if (chatTabSyncTimer) return;
    chatTabSyncTimer = setInterval(function () {
      chatDecorateTabs();
      if (Date.now() > chatTabSyncUntil) { clearInterval(chatTabSyncTimer); chatTabSyncTimer = 0; }
    }, 400);
  }
  window.dragonChatHiddenChannels = function () { return []; };
  window.dragonChatTabDecorate = chatDecorateTabs;

  // ============================================================
  //  ➕ A ROOM THE VISITOR ADDED MUST LOOK EXACTLY LIKE GENERAL  (Egon 19.09.2026)
  //  The plugin stores every self-added room in localStorage.__tabbedCommentsPluginCustomChannels as
  //  {name:{channel:name}} — and that object IS the commentOptions handed to the embed. A fresh room
  //  therefore inherits only the plugin's default submit look (a plain green rounded box), which is why
  //  "deneme" looked broken next to General. We write the SAME round ➤ options main.pjs gives to its own
  //  channels into every stored custom room, then (only if the tab already exists with the old look) ask
  //  the plugin to rebuild that tab by dropping and immediately re-adding its storage entry.
  // ============================================================
  var CHAT_SUBMIT_CSS = "position:absolute; right:8px; bottom:52px; z-index:9; width:44px; height:44px; min-width:44px; padding:0; overflow:hidden; display:inline-flex; align-items:center; justify-content:center; border:1px solid #2e9e54; background:linear-gradient(180deg,#2bbd62,#178a43); color:#fff; border-radius:50%; cursor:pointer; font-size:19px; line-height:1; box-shadow:0 4px 14px rgba(37,211,102,.35);";
  ;function chatCustomPatch() {
    var customs = chatCustoms(), changed = [];
    for (var k in customs) {
      var o = customs[k];
      if (!o || typeof o !== "object") continue;
      var name = String(o.channel || k);
      if (o.submitButtonText === "\u27A4" && o.submitButtonSuccessText === "\u2714" && o.submitButtonStyle === CHAT_SUBMIT_CSS) continue;
      o.channel = name;
      o.submitButtonText = "\u27A4";
      o.submitButtonSuccessText = "\u2714";
      o.submitButtonStyle = CHAT_SUBMIT_CSS;
      changed.push(name);
    }
    if (changed.length) { try { localStorage.setItem("__tabbedCommentsPluginCustomChannels", JSON.stringify(customs)); } catch (e) {} }
    return changed;
  }
  var chatCustomRebuildT = Object.create(null);
  ;function chatCustomEnsure() {
    chatCustomPatch();
    var w = chatWinEl;
    if (!w) return;
    var need = [];
    var ctns = w.querySelectorAll(".tabbed-comments-plugin-content[data-channel]");
    for (var i = 0; i < ctns.length; i++) {
      var ch = ctns[i].dataset.channel;
      if (!ch || CHAT_DEFAULT_CHANNELS.indexOf(ch) >= 0) continue;
      var ifr = ctns[i].querySelector("iframe");
      if (!ifr || !ifr.src) continue;
      var h = null;
      try { h = JSON.parse(decodeURIComponent(new URL(ifr.src).hash.replace(/^#/, ""))); } catch (e) {}
      if (!h || h.submitButtonText === "\u27A4") continue;
      need.push(ch);
    }
    if (!need.length) return;
    var now = Date.now();
    need = need.filter(function (ch) { return !chatCustomRebuildT[ch] || now - chatCustomRebuildT[ch] > 6000; });
    if (!need.length) return;
    need.forEach(function (ch) { chatCustomRebuildT[ch] = now; });
    var full = chatCustoms(), without = JSON.parse(JSON.stringify(full));
    need.forEach(function (ch) { delete without[ch]; });
    ;function writeMap(m) {
      try { localStorage.setItem("__tabbedCommentsPluginCustomChannels", JSON.stringify(m)); } catch (e) {}
      try { window.dispatchEvent(new StorageEvent("storage", { key: "__tabbedCommentsPluginCustomChannels" })); } catch (e) {}
    }
    writeMap(without);   // the plugin drops those tabs...
    writeMap(full);      // ...and re-adds them at once, this time with the round ➤ options
  }
  window.dragonChatCustomEnsure = chatCustomEnsure;
  // Egon 19.09.2026 — dangerous files are refused in every chat channel (the guard itself is main.pjs
  // `beforeSubmit`; this is just the visitor-facing warning).
  window.dragonChatBlockTxt = function () {
    try { if (window.dragonToast) window.dragonToast("\uD83D\uDEAB That file type can't be shared here for safety \u2014 images and plain links only."); } catch (e) {}
  };

  // ============================================================
  //  🗓️ CHAT MESSAGE RANGE  (Egon 19.09.2026)
  //  The feed is rendered by the comments plugin inside a cross-origin iframe, so the only way to ask it
  //  for a time window is the plugin's own "hideCommentsBeforeDate" option, which it reads from the
  //  iframe URL hash when it loads. ONE control talks to it: the 🗓️ range button at the LEFT of the
  //  channel tabs (Today / This week / This month / This year / All messages).
  //  Default = All messages (no filter) — i.e. exactly what the chat shows today; a range applies only
  //  once the visitor picks one. The iframe is reloaded for real (cache-busting query param) on every
  //  change, otherwise a hash-only change is a same-document navigation and nothing happens.
  //  The window is never allowed to come out empty: if the newest message is older than the window, the
  //  window is anchored on that message instead of on "now", so the last active week stays visible.
  // ============================================================
  // Egon 19.09.2026 — key bumped (…Range → …Range2) so the new "no filter by default" default actually
  // applies: the old stored value would otherwise keep a previously-picked range on Egon's browser.
  var CHAT_RANGE_KEY = "dragonChatRange2";
  var CHAT_RANGE_OPTS = [
    { id: "day", days: 1, label: "Today", icon: "\u2600\uFE0F" },
    { id: "week", days: 7, label: "This week", icon: "\uD83D\uDDD3\uFE0F" },
    { id: "month", days: 30, label: "This month", icon: "\uD83D\uDCC5" },
    { id: "year", days: 365, label: "This year", icon: "\uD83D\uDCC6" },
    { id: "all", days: 0, label: "All messages", icon: "\u221E" }
  ];
  // Egon 19.09.2026 — the DEFAULT is "no time filter" (the chat opens showing everything, exactly as it
  // does today); a range only kicks in once the visitor actively picks one from the 🗓️ menu.
  var chatRangeState = { id: "all", extra: 0 };
  ;function chatRangeOpt(id) { for (var i = 0; i < CHAT_RANGE_OPTS.length; i++) if (CHAT_RANGE_OPTS[i].id === id) return CHAT_RANGE_OPTS[i]; return null; }
  try {
    var _rs = JSON.parse(localStorage.getItem(CHAT_RANGE_KEY) || "null");
    if (_rs && _rs.id && chatRangeOpt(_rs.id)) chatRangeState = { id: _rs.id, extra: Math.max(0, _rs.extra | 0) };
  } catch (e) {}
  ;function chatRangeSave() { try { localStorage.setItem(CHAT_RANGE_KEY, JSON.stringify(chatRangeState)); } catch (e) {} }
  ;function chatRangeDays() { var o = chatRangeOpt(chatRangeState.id); if (!o) return 7; return (o.days || 0) + (chatRangeState.extra || 0) * 7; }
  ;function chatNewestTimeOf(ch) {
    var arr = chatMsgStore[ch == null ? "" : ch] || [];
    var best = 0;
    for (var i = 0; i < arr.length; i++) { var t = +arr[i].time || 0; if (t > best) best = t; }
    return best;
  }
  ;function chatRangeCutoff() {
    var days = chatRangeDays();
    if (!days) return null;
    var base = Date.now();
    var newest = chatNewestTimeOf(chatActiveCh());
    if (newest && (base - newest) > days * 864e5) base = newest;
    return new Date(base - days * 864e5).toDateString();
  }
  ;function chatRangeIframe() {
    var w = chatWinEl; if (!w) return null;
    var content = w.querySelector(".tabbed-comments-plugin-content.tabbed-comments-plugin-active-content") || w.querySelector(".tabbed-comments-plugin-content");
    return content ? content.querySelector("iframe") : null;
  }
  ;function chatRangeIframeCutoff(ifr) {
    try {
      var u = new URL(ifr.src);
      var h = JSON.parse(decodeURIComponent(u.hash.replace(/^#/, "")));
      return h.hideCommentsBeforeDate || null;
    } catch (e) { return null; }
  }
  ;function chatRangeApply(force) {
    var ifr = chatRangeIframe();
    if (!ifr) { chatRangePaint(); return; }
    var cutoff = chatRangeCutoff();
    var cur = chatRangeIframeCutoff(ifr);
    if ((cutoff || null) === (cur || null) && !force) { chatRangePaint(); return; }
    try {
      var u = new URL(ifr.src);
      var h = JSON.parse(decodeURIComponent(u.hash.replace(/^#/, "")));
      if (cutoff) h.hideCommentsBeforeDate = cutoff; else delete h.hideCommentsBeforeDate;
      u.hash = encodeURIComponent(JSON.stringify(h));
      // 🐛 Egon 19.09.2026 — ROOT CAUSE of "I picked Today and it still shows everything": changing ONLY
      // the fragment is a SAME-DOCUMENT navigation, so the browser never reloads the comments iframe and
      // the embed never re-reads the hash. Bumping a query parameter forces a real reload.
      u.searchParams.set("_rg", String(Date.now()));
      ifr.src = u.href;
    } catch (e) {}
    chatRangePaint();
  }
  ;function chatRangeSync() { if (!chatWinEl) return; chatSortBtnEnsure(); chatRangeApply(false); }
  ;function chatRangeLabel() {
    var o = chatRangeOpt(chatRangeState.id) || CHAT_RANGE_OPTS[1];
    return o.label;
  }
  // DEPOT (src/Librarybook.enc): the "‹ Load one more week" step bar that lived above the message area
  // (chatRangeBarEnsure + chatRangeMore + the #dragonChatRangeBar markup/CSS) — removed 19.09.2026.
  ;function chatRangePaint() {
    var btn = chatWinEl && chatWinEl.querySelector("#dragonChatSortBtn");
    if (btn) { btn.textContent = (chatRangeOpt(chatRangeState.id) || CHAT_RANGE_OPTS[1]).icon; btn.title = "Message range: " + chatRangeLabel(); }
  }
  ;function chatRangeSelect(id) {
    if (!chatRangeOpt(id)) return;
    if (chatRangeState.id === id && !(chatRangeState.extra || 0)) { chatRangePaint(); return; }
    chatRangeState = { id: id, extra: 0 };
    chatRangeSave();
    chatRangeApply(true);
  }
  window.dragonChatRangeSelect = chatRangeSelect;
  window.dragonChatRangeState = function () { return { id: chatRangeState.id, extra: chatRangeState.extra, cutoff: chatRangeCutoff() }; };
  ;function chatSortBtnEnsure() {
    var w = chatWinEl; if (!w) return;
    var head = w.querySelector(".tabbed-comments-plugin-header");
    if (!head) return;
    var btn = head.querySelector("#dragonChatSortBtn");
    if (!btn) {
      btn = document.createElement("div");
      btn.id = "dragonChatSortBtn";
      btn.className = "tabbed-comments-plugin-tab dragon-chat-sortbtn";
      btn.setAttribute("role", "button");
      btn.onclick = function (ev) { ev.stopPropagation(); chatRangeMenu(btn); };
      head.insertBefore(btn, head.firstChild);
    }
  }
  ;function chatRangeMenu(anchor) {
    var open = document.getElementById("dragonChatRangeMenu");
    if (open) { open.remove(); return; }
    var menu = document.createElement("div");
    menu.id = "dragonChatRangeMenu";
    menu.className = "dragon-chat-menu";
    for (var i = 0; i < CHAT_RANGE_OPTS.length; i++) {
      (function (o) {
        var row = document.createElement("div");
        row.className = "dragon-chat-menu-row" + (o.id === chatRangeState.id ? " is-active" : "");
        row.innerHTML = "<span class='ic'>" + o.icon + "</span><span>" + o.label + "</span>";
        row.onclick = function (ev) { ev.stopPropagation(); menu.remove(); chatRangeSelect(o.id); };
        menu.appendChild(row);
      })(CHAT_RANGE_OPTS[i]);
    }
    document.body.appendChild(menu);
    // every dropdown opens CENTRED on its button and is clamped to the viewport (global rule, Egon 19.09.2026)
    var r = anchor.getBoundingClientRect();
    var mw = menu.getBoundingClientRect().width, mh = menu.getBoundingClientRect().height;
    var left = Math.min(Math.max(r.left + r.width / 2 - mw / 2, 8), Math.max(8, window.innerWidth - mw - 8));
    var top = r.bottom + 6;
    if (top + mh > window.innerHeight - 8) top = Math.max(8, r.top - 6 - mh);
    menu.style.left = Math.round(left) + "px";
    menu.style.top = Math.round(top) + "px";
    var close = function (e) { if (!menu.contains(e.target) && e.target !== anchor) { menu.remove(); document.removeEventListener("mousedown", close, true); } };
    setTimeout(function () { document.addEventListener("mousedown", close, true); }, 0);
  }

  // ============================================================
  //  ➕ ADD-CHANNEL DIALOG  (Egon 19.09.2026)
  //  The dialog itself is built by the tabbed-comments plugin (getUserInput) and appended to <body> with
  //  its own inline style, so we cannot restyle it in the source — we decorate the element the moment it
  //  appears: the generator's look, and an explicit z-index ABOVE the chat window (the dialog's own
  //  99,999,999 sits far below the chat window's 2,147,483,200, which is why it used to open BEHIND it).
  //  While it is open the ＋ tab is put in a busy state and further clicks are swallowed, so pressing ＋
  //  again can never stack a second dialog on top of the first.
  // ============================================================
  var chatDlgOpen = false;
  ;function chatDlgMarkBtn(on) {
    var w = chatWinEl; if (!w) return;
    var b = w.querySelector(".tabbed-comments-plugin-add-custom-channel");
    if (b) b.classList.toggle("dragon-chat-addbusy", !!on);
  }
  var CHAT_DLG_SEL = "body > .dragon-chat-dlg, body > div[tabindex='0'][style*='99999999']";
  ;function chatDlgScan() {
    var list = document.querySelectorAll(CHAT_DLG_SEL);
    if (!list.length) { if (chatDlgOpen) { chatDlgOpen = false; chatDlgMarkBtn(false); } return; }
    for (var i = 0; i < list.length; i++) {
      if (!list[i].classList.contains("dragon-chat-dlg")) list[i].classList.add("dragon-chat-dlg");
      list[i].style.zIndex = "2147483350";
    }
    if (!chatDlgOpen) { chatDlgOpen = true; chatDlgMarkBtn(true); }
  }
  ;function chatDlgInit() {
    chatDlgScan();
    if (!window.MutationObserver || document.body.__dragonChatDlgObs) return;
    try {
      document.body.__dragonChatDlgObs = new MutationObserver(function () { chatDlgScan(); });
      document.body.__dragonChatDlgObs.observe(document.body, { childList: true });
    } catch (e) {}
  }
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (t && t.closest && t.closest(".tabbed-comments-plugin-add-custom-channel")) {
      chatDlgScan();
      if (chatDlgOpen) {
        e.preventDefault(); e.stopPropagation();
        if (!document.querySelector(".dragon-chat-tabx")) { /* no-op */ }
      }
    }
  }, true);
  window.dragonChatDlgOpen = function () { return chatDlgOpen; };

  // ============================================================
  //  💬 CHAT NOTIFICATIONS + 🌐 TRANSLATE   (Egon 15.09.2026)
  //  Messages arrive through the pjs hooks in main.pjs
  //  (defaultCommentOptions.onComment/onLoad → window.dragonChatOnComment/OnLoad).
  //  Nothing is written to the generator's own files; every preference lives in THIS
  //  visitor's browser (localStorage) only.
  // ============================================================
  ;function chatNotifBool(key, def) { try { var v = localStorage.getItem(key); return v == null ? def : v === "1"; } catch (e) { return def; } }
  var chatNotifOn = chatNotifBool("dragonChatNotifOn", true);
  var chatNotifSoundOn = chatNotifBool("dragonChatNotifSound", true);
  var chatUnread = 0;
  var chatMsgStore = Object.create(null);   // channel -> array of comments (newest last)
  var chatMsgSeen = Object.create(null);    // channel -> id map (no duplicates)
  var chatNotifPanels = [];
  window.dragonChatNotifPanels = chatNotifPanels;

  ;function chatPlain(html) {
    var s = String(html == null ? "" : html);
    s = s.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|blockquote)>/gi, "\n");
    s = s.replace(/<[^>]*>/g, "");
    s = s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
    return s.replace(/\n{3,}/g, "\n\n").trim();
  }

  // Egon 15.09.2026 — the chat notification now uses its OWN "5th" voice (window.dragonChatChime,
  // defined next to the completion beeps): a descending pitch-bend pop, so it can never be confused
  // with the 4 rising completion styles. The old inline sine 880→1318 chime (which WAS confusable)
  // is retired. Chat's own on/off (dragonChatNotifSound) + the shared volume/mute still apply.
  ;function chatNotifyBeep() {
    if (!chatNotifSoundOn) return;
    try { if (window.dragonChatChime) window.dragonChatChime(); } catch (e) {}
  }

  ;function chatBadgeEls() {
    var out = [];
    var nb = document.getElementById("dragonNavChatBtn");
    if (nb) out.push(nb);
    var bb = document.getElementById("dragonChatBubble");
    if (bb) out.push(bb);
    return out;
  }
  ;function chatBadgeSet(n) {
    chatUnread = Math.max(0, n | 0);
    chatBadgeEls().forEach(function (host) {
      var b = host.querySelector(".dragon-chat-badge");
      if (!chatUnread) { if (b) b.hidden = true; return; }
      if (!b) { b = document.createElement("span"); b.className = "dragon-chat-badge"; host.appendChild(b); }
      b.hidden = false;
      b.textContent = chatUnread > 99 ? "99+" : String(chatUnread);
    });
  }
  window.dragonChatBadgeSet = chatBadgeSet;
  window.dragonChatUnreadReset = function () { chatBadgeSet(0); };

  ;function chatIsViewing(channel) {
    if (!chatWinEl || chatWinEl.style.display === "none") return false;
    if (chatWinEl.classList.contains("dragon-chat-min")) return false;
    var a = chatActive();
    if (!a) return false;
    var ch = a.channel || "", target = channel || "";
    if (target === ch) return true;
    if (chatIsGeneral(target) && chatIsGeneral(ch)) return true;
    return false;
  }

  ;function chatStoreComment(comment) {
    if (!comment || !comment.id) return;
    var ch = (comment.channel != null) ? String(comment.channel) : "";
    if (!chatMsgStore[ch]) { chatMsgStore[ch] = []; chatMsgSeen[ch] = Object.create(null); }
    if (chatMsgSeen[ch][comment.id]) return;
    chatMsgSeen[ch][comment.id] = 1;
    chatMsgStore[ch].push(comment);
    if (chatMsgStore[ch].length > 400) chatMsgStore[ch] = chatMsgStore[ch].slice(-400);
  }
  window.dragonChatMsgStore = chatMsgStore;

  window.dragonChatOnLoad = function (comments) {
    try {
      (comments || []).forEach(chatStoreComment);
      if (chatWinEl && chatWinEl.querySelector(".dragon-chat-xlate:not([hidden])")) chatXlateRender();
    } catch (e) {}
  };
  window.dragonChatOnComment = function (comment) {
    try {
      if (!comment || !comment.id) return;
      chatStoreComment(comment);
      if (chatWinEl && chatWinEl.querySelector(".dragon-chat-xlate:not([hidden])")) chatXlateRender();
      chatRefreshMeLabel();
      if (comment.byCurrentUser) return;          // never notify about your own message
      if (String(comment.channel == null ? "" : comment.channel) === "suggestion") return;  // the suggestion inbox never pings anyone
      if (chatIsViewing(comment.channel)) return;  // you're literally looking at that channel
      // Egon 27.10.2026 — the ❗ button is VISUAL-only (unread badge); sound is governed
      // solely by the 🔊 button (chatNotifSoundOn, checked inside chatNotifyBeep).
      if (chatNotifOn) chatBadgeSet(chatUnread + 1);
      chatNotifyBeep();
    } catch (e) {}
  };

  ;function chatNotifToggle() {
    chatNotifOn = !chatNotifOn;
    try { localStorage.setItem("dragonChatNotifOn", chatNotifOn ? "1" : "0"); } catch (e) {}
    if (window.__dragonChatSyncToolToggles) { try { window.__dragonChatSyncToolToggles(); } catch (e) {} }
    if (window.dragonToast) window.dragonToast(chatNotifOn ? "\u2757 chat notifications on" : "\u2755 chat notifications off");
  }
  ;function chatNotifSoundToggle() {
    chatNotifSoundOn = !chatNotifSoundOn;
    try { localStorage.setItem("dragonChatNotifSound", chatNotifSoundOn ? "1" : "0"); } catch (e) {}
    chatNotifPanels.forEach(function (fn) { try { fn(); } catch (e) {} });
    if (window.__dragonChatSyncToolToggles) { try { window.__dragonChatSyncToolToggles(); } catch (e) {} }
    if (chatNotifSoundOn) chatNotifyBeep();
    if (window.dragonToast) window.dragonToast(chatNotifSoundOn ? "\uD83D\uDD0A notification sound on" : "\uD83D\uDD07 notification sound off");
  }
  window.dragonChatNotifOn = function () { return chatNotifOn; };
  window.dragonChatNotifSoundOn = function () { return chatNotifSoundOn; };
  window.dragonChatNotifToggle = chatNotifToggle;
  window.dragonChatNotifSoundToggle = chatNotifSoundToggle;
  window.dragonChatBeep = chatNotifyBeep; // Egon 18.10.2026 — the PM inbox reuses chat's chime (toggle respected inside)

  // The name shown in the chat header pill (last name we posted with, else our stored one).
  ;function chatCurrentName() {
    try {
      for (var ch in chatMsgStore) {
        var arr = chatMsgStore[ch];
        for (var i = arr.length - 1; i >= 0; i--) {
          var c = arr[i];
          if (c.byCurrentUser && c.user) {
            var n = c.user.nickname || c.user.name;
            if (n) return n;
          }
        }
      }
    } catch (e) {}
    try { var s = localStorage.getItem("dragonChatNick"); if (s) return s; } catch (e) {}
    return "you";
  }
  ;function chatRefreshMeLabel() {
    var el = chatWinEl && chatWinEl.querySelector("#dragonChatMeName");
    if (el) el.textContent = chatCurrentName();
  }
  window.dragonChatRefreshMeLabel = chatRefreshMeLabel;

  // Shared living toggle: the 🔔 Social Alerts button (Tools & Extras card + Control Panel copy).
  window.dragonChatNotifToggleEl = function () {
    var b = document.createElement("button");
    b.type = "button";
    b.style.cssText = "padding:.24rem .6rem; font-size:.72rem; font-weight:bold; border-radius:7px; cursor:pointer; white-space:nowrap;";
    ;function sync() {
      b.textContent = chatNotifSoundOn ? "🔔 Social Alerts: On" : "🔇 Social Alerts: Off";
      try {
        b.style.border = chatNotifSoundOn ? "1px solid #9b6bff" : "1px solid #5a789a";
        b.style.background = chatNotifSoundOn ? "linear-gradient(180deg,#2a1f4a,#14101f)" : "linear-gradient(180deg,#1a2632,#2c3f52)";
        b.style.color = chatNotifSoundOn ? "#d8c9ff" : "#cfe3ff";
      } catch (eS) {}
      b.title = "Social Alerts — play a sound when new chat, forum or message activity arrives (full per-channel wiring lands with the Social build)";
    }
    sync.__el = b;
    b.onclick = function (e) {
      e.stopPropagation();
      chatNotifSoundOn = !chatNotifSoundOn;
      try { localStorage.setItem("dragonChatNotifSound", chatNotifSoundOn ? "1" : "0"); } catch (er) {}
      chatNotifPanels.forEach(function (fn) { try { fn(); } catch (er) {} });
      if (chatNotifSoundOn) chatNotifyBeep();
      if (window.dragonToast) window.dragonToast(chatNotifSoundOn ? "\uD83D\uDD14 social alerts on" : "\uD83D\uDD07 social alerts off");
    };
    for (var i = chatNotifPanels.length - 1; i >= 0; i--) { if (!chatNotifPanels[i].__el || !chatNotifPanels[i].__el.isConnected) chatNotifPanels.splice(i, 1); }
    chatNotifPanels.push(sync);
    sync();
    return b;
  };

  // ---- 🌐 TRANSLATE PANEL (per-message translate buttons) ----
  ;function chatXlateEnsure() {
    if (!chatWinEl) return null;
    var p = chatWinEl.querySelector(".dragon-chat-xlate");
    if (p) return p;
    p = document.createElement("div");
    p.className = "dragon-chat-xlate";
    p.hidden = true;
    p.innerHTML =
      "<div class='dragon-xlate-head'>\uD83C\uDF10 Translate <span class='ch'></span>" +
        "<button class='dragon-xlate-btn' data-x='all' title='Translate all messages'>All</button>" +
        "<button class='dragon-xlate-btn' data-x='close' title='Close'>\u2715</button>" +
      "</div>" +
      "<div class='dragon-xlate-body'></div>";
    p.querySelector("[data-x='close']").onclick = function (e) { e.stopPropagation(); chatXlateClose(); };
    p.querySelector("[data-x='all']").onclick = function (e) { e.stopPropagation(); chatXlateTranslateAll(); };
    chatWinEl.appendChild(p);
    return p;
  }
  ;function chatXlateOpen() {
    var p = chatXlateEnsure();
    if (!p) return;
    p.hidden = false;
    chatXlateRender();
  }
  ;function chatXlateClose() { var p = chatWinEl && chatWinEl.querySelector(".dragon-chat-xlate"); if (p) p.hidden = true; }
  window.dragonChatXlateOpen = chatXlateOpen;
  window.dragonChatXlateClose = chatXlateClose;

  ;function chatXlateChannelInfo() {
    var a = chatActive();
    var ch = a ? (a.channel || "") : "";
    return { channel: ch, messages: chatMsgStore[ch] || [] };
  }
  ;function chatXlateRender() {
    var p = chatWinEl && chatWinEl.querySelector(".dragon-chat-xlate");
    if (!p) return;
    var body = p.querySelector(".dragon-xlate-body");
    var info = chatXlateChannelInfo();
    var lbl = chatIsGeneral(info.channel) ? "General" : (CHAT_CHANNEL_TIPS[info.channel] || info.channel);
    p.querySelector(".ch").textContent = lbl + " \u00B7 " + info.messages.length + " msg";
    body.innerHTML = "";
    if (!info.messages.length) {
      var e = document.createElement("div");
      e.className = "dragon-xlate-empty";
      e.innerHTML = "No messages loaded for this channel yet.<br>Open this channel in the chat once, then come back here.";
      body.appendChild(e);
      return;
    }
    info.messages.forEach(function (c) {
      var row = document.createElement("div");
      row.className = "dragon-xrow";
      var who = document.createElement("span");
      who.className = "who";
      who.textContent = chatXlateWho(c);
      var txt = document.createElement("span");
      txt.className = "txt";
      txt.textContent = chatPlain(c.message) || "(empty)";
      if (!c.byCurrentUser) {   // Egon: a translate button on every message EXCEPT your own
        // Egon 15.09.2026 — 🌐 is now on the FAR LEFT of the line: to the left of the message text, single column from top to bottom.
        var btn = document.createElement("button");
        btn.type = "button"; btn.className = "txb"; btn.title = "Translate this message"; btn.textContent = "\uD83C\uDF10";
        btn.onclick = function (e) { e.stopPropagation(); chatXlateOne(c); };
        row.append(btn, who, txt);
      } else {
        // No button in our own messages → invisible spacer of the same width to keep texts aligned.
        var sp = document.createElement("span"); sp.className = "txb-sp";
        row.append(sp, who, txt);
      }
      body.appendChild(row);
    });
    body.scrollTop = body.scrollHeight;
  }
  ;function chatXlateWho(c) {
    return c.byCurrentUser ? "You" : ((c.user && (c.user.nickname || c.user.name || c.user.visualId)) || "anon");
  }
  // Egon 15.09.2026 — 🌐 TRANSLATION RESULT: a popup card EXACTLY IN THE MIDDLE of the chat window.
  // (The card stays absolute within the window, so it's always at the window's center.)
  ;function chatXresEnsure() {
    if (!chatWinEl) return null;
    var ov = chatWinEl.querySelector(".dragon-chat-xres");
    if (ov) return ov;
    ov = document.createElement("div");
    ov.className = "dragon-chat-xres";
    ov.hidden = true;
    ov.innerHTML =
      "<div class='dragon-xres-card'>" +
        "<div class='dragon-xres-head'>\uD83C\uDF10 Translate<span class='sp'></span><span class='who'></span>" +
          "<button class='dragon-xlate-btn' data-x='close' title='Close'>\u2715</button>" +
        "</div>" +
        "<div class='dragon-xres-body'></div>" +
        "<div class='dragon-xres-foot'>" +
          "<button class='dragon-xres-b' data-x='copy' title='Copy the translation'>\uD83D\uDCCB Copy</button>" +
          "<button class='dragon-xres-b' data-x='gt' title='Open this message in Google Translate'>\uD83C\uDF10 Google</button>" +
        "</div>" +
      "</div>";
    chatWinEl.appendChild(ov);
    ov.addEventListener("click", function (e) { if (e.target === ov) ov.hidden = true; });
    ov.querySelector("[data-x='close']").onclick = function (e) { e.stopPropagation(); ov.hidden = true; };
    ov.querySelector("[data-x='copy']").onclick = function (e) {
      e.stopPropagation();
      var t = ov.querySelector(".dragon-xres-body .dragon-xres-tr") || ov.querySelector(".dragon-xres-body");
      try { navigator.clipboard.writeText((t && t.textContent) || ""); } catch (er) {}
      if (window.dragonToast) window.dragonToast("\uD83D\uDCCB translation copied");
    };
    ov.querySelector("[data-x='gt']").onclick = function (e) {
      e.stopPropagation();
      var o = ov.querySelector(".dragon-xres-orig");
      var txt = (o && o.textContent) || "";
      var tl = chatTranslateTargetLang();
      try { window.open("https://translate.google.com/?sl=auto&tl=" + encodeURIComponent(tl) + "&text=" + encodeURIComponent(txt) + "&op=translate", "_blank", "noopener"); } catch (er) {}
    };
    return ov;
  }
  window.dragonChatXresOpen = function (text) {         // can also be called from outside
    var ov = chatXresEnsure();
    if (!ov) return;
    ov.hidden = false;
    chatXlateOne({ message: text });
  };
  // Translates the message in its own line; result appears in the MIDDLE popup (not inline).
  ;function chatXlateOne(c) {
    var original = chatPlain(c && c.message);
    if (!original) { if (window.dragonToast) window.dragonToast("\u26A0\uFE0F nothing to translate"); return; }
    var ov = chatXresEnsure();
    if (!ov) { chatXlatePopup(original, null); return; }   // old full-page fallback if window doesn't exist
    ov.hidden = false;
    ov.querySelector(".dragon-xres-head .who").textContent = (c && c.byCurrentUser !== undefined) ? chatXlateWho(c) : "";
    var body = ov.querySelector(".dragon-xres-body");
    body.innerHTML = "";
    var tr = document.createElement("div");
    tr.className = "dragon-xres-tr"; tr.textContent = "\u23F3 translating\u2026";
    var orig = document.createElement("div");
    orig.className = "dragon-xres-orig"; orig.textContent = original;
    body.append(tr, orig);
    body.scrollTop = 0;
    chatTranslateText(original, function (res) {
      if (res && res.ok && res.text) tr.textContent = res.text;
      else tr.textContent = "\u26A0\uFE0F inline translation unavailable \u2014 use the \uD83C\uDF10 Google button below";
    });
  }
  // "All" → translates all incoming messages in order and lists them in the same middle popup.
  ;function chatXlateTranslateAll() {
    var info = chatXlateChannelInfo();
    var msgs = (info.messages || []).filter(function (c) { return !c.byCurrentUser && chatPlain(c.message); });
    if (!msgs.length) { if (window.dragonToast) window.dragonToast("\u26A0\uFE0F nothing to translate"); return; }
    var ov = chatXresEnsure();
    if (!ov) return;
    ov.hidden = false;
    ov.querySelector(".dragon-xres-head .who").textContent = msgs.length + " messages";
    var body = ov.querySelector(".dragon-xres-body");
    body.innerHTML = "";
    var i = 0;
    (function next() {
      if (i >= msgs.length) return;
      var c = msgs[i++];
      var line = document.createElement("div");
      line.className = "dragon-xres-line";
      var b = document.createElement("b");
      b.textContent = chatXlateWho(c) + ": ";
      var sp = document.createElement("span");
      sp.textContent = "\u23F3\u2026";
      line.append(b, sp);
      body.appendChild(line);
      body.scrollTop = body.scrollHeight;
      chatTranslateText(chatPlain(c.message), function (res) {
        sp.textContent = (res && res.ok && res.text) ? res.text : "\u26A0\uFE0F unavailable";
        body.scrollTop = body.scrollHeight;
        setTimeout(next, 120);
      });
    })();
  }
  ;function chatTranslateTargetLang() {
    var tl = "en";
    try { tl = String((navigator.languages && navigator.languages[0]) || navigator.language || "en").split("-")[0].toLowerCase(); } catch (e) {}
    return tl || "en";
  }
  ;function chatTranslateText(text, cb) {
    var tl = chatTranslateTargetLang();
    var sf = window.dragonSuperFetch || window.fetch;
    var providers = [
      function () {
        var u = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=" + encodeURIComponent(tl) + "&dt=t&q=" + encodeURIComponent(text);
        return sf(u).then(function (r) { return r.json(); }).then(function (j) {
          var out = "";
          if (j && j[0]) for (var k = 0; k < j[0].length; k++) { if (j[0][k] && j[0][k][0]) out += j[0][k][0]; }
          if (!out) throw new Error("empty");
          return { ok: true, text: out, lang: tl };
        });
      },
      function () {
        var u = "https://api.mymemory.translated.net/get?q=" + encodeURIComponent(text) + "&langpair=auto|" + encodeURIComponent(tl);
        return sf(u).then(function (r) { return r.json(); }).then(function (j) {
          var out = j && j.responseData && j.responseData.translatedText;
          if (!out || /MYMEMORY WARNING|INVALID/i.test(out)) throw new Error("empty");
          return { ok: true, text: out, lang: tl };
        });
      }
    ];
    (function tryNext(i) {
      if (i >= providers.length) { cb({ ok: false, lang: tl }); return; }
      var settled = false;
      var to = setTimeout(function () { if (!settled) { settled = true; tryNext(i + 1); } }, 9000);
      Promise.resolve().then(providers[i]).then(function (res) {
        if (settled) return; settled = true; clearTimeout(to); cb(res);
      }).catch(function () { if (settled) return; settled = true; clearTimeout(to); tryNext(i + 1); });
    })(0);
  }
  window.dragonChatTranslate = function (text) { return new Promise(function (res) { chatTranslateText(text, res); }); };
  // Fallback window: shown when the translation can't be rendered inline.
  ;function chatXlatePopup(original, res) {
    if (document.querySelector(".dragon-xlate-pop")) return;
    var tl = (res && res.lang) || chatTranslateTargetLang();
    var ov = document.createElement("div");
    ov.className = "dragon-xlate-pop";
    ov.style.cssText = "position:fixed; inset:0; z-index:2147483650; background:rgba(8,8,12,.74); display:flex; align-items:center; justify-content:center; padding:1rem; text-align:left;";
    ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
    var card = document.createElement("div");
    card.style.cssText = "width:min(520px,94vw); max-height:82vh; overflow:auto; background:linear-gradient(180deg,#1a1a22,#0f0f14); border:1px solid #4a4a58; border-radius:14px; box-shadow:0 14px 40px rgba(0,0,0,.6); padding:.9rem; color:#e9e6f2; font:13px/1.45 system-ui;";
    var h = document.createElement("div");
    h.style.cssText = "font-weight:800; color:#d8c9ff; margin-bottom:.4rem;";
    h.textContent = "\uD83C\uDF10 Translate";
    var note = document.createElement("div");
    note.style.cssText = "font-size:.74rem; opacity:.85; margin-bottom:.5rem;";
    note.textContent = "Inline translation isn't available right now, so here's the message. You can open it in Google Translate:";
    var pre = document.createElement("div");
    pre.style.cssText = "white-space:pre-wrap; word-break:break-word; background:rgba(255,255,255,.05); border:1px solid #33333d; border-radius:9px; padding:.55rem; margin-bottom:.6rem;";
    pre.textContent = original;
    var row = document.createElement("div");
    row.style.cssText = "display:flex; gap:.4rem; justify-content:flex-end;";
    var gt = document.createElement("button");
    gt.textContent = "\uD83C\uDF10 Open Google Translate";
    gt.style.cssText = "padding:.4rem .7rem; border:1px solid #3f6b8a; border-radius:8px; background:linear-gradient(180deg,#16303f,#0d1c26); color:#9fd8ff; cursor:pointer; font-weight:bold;";
    gt.onclick = function () { try { window.open("https://translate.google.com/?sl=auto&tl=" + encodeURIComponent(tl) + "&text=" + encodeURIComponent(original) + "&op=translate", "_blank", "noopener"); } catch (e) {} };
    var cl = document.createElement("button");
    cl.textContent = "Close";
    cl.style.cssText = "padding:.4rem .7rem; border:1px solid #5b4a7d; border-radius:8px; background:linear-gradient(180deg,#2c2340,#1a1428); color:#d8c9ff; cursor:pointer; font-weight:bold;";
    cl.onclick = function () { ov.remove(); };
    row.append(gt, cl);
    card.append(h, note, pre, row);
    ov.appendChild(card);
    document.body.appendChild(ov);
  }

  ;function buildChatWindow() {
    if (chatWinEl) return chatWinEl;
    var win = document.createElement("div");
    win.id = "dragonChatWindow";
    win.innerHTML =
      "<div class='dragon-chat-head' id='dragonChatHead'>" +
        "<span class='dragon-chat-title'>\uD83D\uDCAC Chat</span>" +
        // Egon 15.09.2026 — plain label (no click handler): "Username: <name>". The clickable rename shortcut
        // never worked reliably, so the hint is now a non-clickable button in the bottom row instead.
        "<span class='dragon-chat-me' id='dragonChatMe' title='Your chat username'><span class='lbl'>Username:</span><b id='dragonChatMeName'>you</b></span>" +
        "<span class='dragon-chat-head-togs' id='dragonChatHeadTogs'></span>" +
        "<button class='dragon-chat-btn' id='dragonChatSettings' title='Comments settings' style='display:none;'>&#9881;&#65039;</button>" +
        "<button class='dragon-chat-btn' id='dragonChatMin' title='Minimize'>\u2013</button>" +
        "<button class='dragon-chat-btn dragon-chat-close' id='dragonChatClose' title='Close'>\u2715</button>" +
      "</div>" +
      "<div class='dragon-chat-body' id='dragonChatBody'></div>" +
      "<div class='dragon-chat-foot' id='dragonChatFoot' style='display:flex;'></div>" +
      "<div class='dragon-chat-resize' id='dragonChatResize'></div>";
    document.body.appendChild(win);
    chatWinEl = win;
    chatBodyEl = win.querySelector("#dragonChatBody");
    chatApplyGeo();

    // header buttons
    win.querySelector("#dragonChatClose").onclick = function () { window.dragonChatClose(); };
    win.querySelector("#dragonChatMin").onclick = function () {
      // Egon 12.09.2026 — minimize flies the window into the bottom-left chat circle.
      // DEPOT (previous): var wasMin = win.classList.contains("dragon-chat-min"); win.classList.remove("dragon-chat-max"); if (wasMin) { win.classList.remove("dragon-chat-min"); } else { win.classList.add("dragon-chat-min"); } chatSaveGeo();
      chatMinimizeFly();
    };
    win.querySelector("#dragonChatSettings").onclick = function (e) { openChatSettings(e.currentTarget); };
    // Egon 15.09.2026 — the username label is display-only now (the old pill→settings shortcut is gone).
    chatRefreshMeLabel();

    // Egon 15.09.2026 — ❗ notifications · 🔊 notification-sound · 🌐 translate toggles, now IN the header
    // (there was no room in the bottom row beside the native ⚙️ + Submit). 30x30 like the other header
    // buttons so they never resize (I59); only the icon + .dragon-chat-btn-off class change on toggle.
    var hbtn = function (icon, title, fn) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "dragon-chat-btn";
      b.title = title; b.textContent = icon;
      b.onclick = function (ev) { ev.stopPropagation(); fn(b); };
      return b;
    };
    var notifBtn = hbtn("\u2757", "Chat notifications \u2014 on/off", function () { chatNotifToggle(); });
    var soundBtn = hbtn("\uD83D\uDD0A", "Chat notification sound \u2014 on/off", function () { chatNotifSoundToggle(); });
    var xlateBtn = hbtn("\uD83C\uDF10", "Translate messages \u2014 open the translate panel", function () { chatXlateOpen(); });
    var togsCtn = win.querySelector("#dragonChatHeadTogs");
    if (togsCtn) togsCtn.append(notifBtn, soundBtn, xlateBtn);
    ;function syncToolToggles() {
      notifBtn.textContent = chatNotifOn ? "\u2757" : "\u2755";
      notifBtn.classList.toggle("dragon-chat-btn-off", !chatNotifOn);
      notifBtn.title = chatNotifOn ? "Chat notifications: ON \u2014 click to turn off" : "Chat notifications: OFF \u2014 click to turn on";
      soundBtn.textContent = chatNotifSoundOn ? "\uD83D\uDD0A" : "\uD83D\uDD07";
      soundBtn.classList.toggle("dragon-chat-btn-off", !chatNotifSoundOn);
      soundBtn.title = chatNotifSoundOn ? "Notification sound: ON \u2014 click to mute" : "Notification sound: OFF \u2014 click to unmute";
      xlateBtn.title = "Translate messages \u2014 open the translate panel";
    }
    window.__dragonChatSyncToolToggles = syncToolToggles;
    syncToolToggles();

    // Egon 17.10.2026 (W-SOC381) — ⛶ view button: floating window ↔ full page (same 30x30 header
    // family as its siblings; the icon shows where the NEXT click goes).
    var viewBtn = hbtn("⛶", "Chat is a floating window — click for the full page", function () { chatSetView(chatView() === "full" ? "win" : "full"); });
    viewBtn.id = "dragonChatView";
    // Egon 18.10.2026 — the view button sits immediately LEFT of ✕ (not in the toggles group).
    var closeBtn = win.querySelector("#dragonChatClose");
    if (closeBtn) closeBtn.before(viewBtn);
    else if (togsCtn) togsCtn.append(viewBtn);
    window.__dragonChatSyncViewBtn = function () {
      var full = chatView() === "full";
      viewBtn.textContent = full ? "❐" : "⛶";
      viewBtn.title = full ? "Chat is full page — click for the floating window" : "Chat is a floating window — click for the full page";
    };
    window.__dragonChatSyncViewBtn();
    // (Egon 22.10.2026: the "I'm HERE" badge is retired — nothing is marked or cleared anymore.)

    // Egon 17.10.2026 (W-SOC381) — windowed view drags + resizes; the full page does neither.
    chatMakeDraggable(win, win.querySelector("#dragonChatHead"));
    chatMakeResizable(win, win.querySelector("#dragonChatResize"));
    // Egon 15.09.2026 — keep the rename hint's visibility in sync as the window is resized (the hint only
    // fits when the chat window is >= ~396px wide, matching the gear's clamp() margin).
    try { if (window.ResizeObserver) new ResizeObserver(function () { chatUpdateNameHint(); }).observe(win); } catch (e) {}
    window.addEventListener("resize", function () { chatUpdateNameHint(); chatClampCurrent(); });

    // ---- left tools column: Say hi · Emoji · Add image (Egon 11.09.2026 v2: vertical, left of input) ----
    var tools = document.createElement("div");
    tools.className = "dragon-chat-tools";
    ;function tool(icon, label, title, fn) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "dragon-chat-tool"; b.title = title || label;
      b.innerHTML = icon + (label ? " <span style='font-size:.72rem;font-weight:bold;'>" + label + "</span>" : "");
      b.onclick = function (ev) { ev.stopPropagation(); fn(b); };
      return b;
    }

    tools.append(
      tool("\uD83D\uDE0A", "", "Add emoji", function (b) { openEmojiPicker(b); }),
      tool("\uD83D\uDDBC\uFE0F", "", "Add an image from the public or private gallery", function (b) { openImagePicker(b); }),
      tool("\uD83D\uDC4B", "", "Say hi \u2014 post a random friendly greeting", function () { chatSayHi(); })
      // Egon 24.09.2026 — 👋 Say hi moved to the RIGHT of 🖼️ Add image (Egon: "move Say hi to the right of
      // Add an image"): the row now reads [😊 emoji][🖼️ add image][👋 say hi] + [⚙️ native] + [➤ Submit].
      // Egon 16.09.2026 — manual ⚙️ removed: the ORIGINAL comments-plugin gear (inside iframe) is now used.
      // User wanted a single line: [😊 emoji][🖼️ add image][👋 Say hi] + [⚙️ native] + [➤ Submit on the far right].
      // Old manual gear line WAREHOUSE:
      // tool("\u2699\uFE0F", "", "Comments settings \u2014 display name & avatar", function (b) { openChatSettings(b); })
    );
    // Egon 15.09.2026 — "Click to ⚙️ change Username": a NON-clickable hint (a div styled like a button)
    // placed between 🖼️ Add image and the native ⚙️. It just tells you which gear renames you; the actual
    // rename happens in the native comments-settings modal. chatUpdateNameHint() hides it when the window
    // is too narrow for it to fit beside the gear + Submit.
    var nameHint = document.createElement("div");
    nameHint.className = "dragon-chat-namehint";
    nameHint.id = "dragonChatNameHint";
    nameHint.innerHTML = "<span class='l1'>Click to \u2699\uFE0F</span><span class='l2'>change Username</span>";
    nameHint.title = "Open the \u2699\uFE0F comments-settings button to change your username";
    tools.appendChild(nameHint);
    window.__dragonChatNameHintEl = nameHint;
    win.appendChild(tools);
    // Egon 15.09.2026 — the 🔔/🔊/🌐 toggles were moved up into the header (see above) because the
    // bottom row only has room for [👋][😊][🖼️] + native ⚙️ + Submit.
    if (window.__dragonChatSyncToolToggles) window.__dragonChatSyncToolToggles();
    // ---- right Submit button ----
    // Egon 19.09.2026 — our own ➤ overlay button is GONE. The plugin's NATIVE submit button now wears
    // exactly that look (round, 44px, green gradient) and sits in the same spot (see submitButtonStyle
    // for each channel in main.pjs). Reason: replying to a message only works through the plugin's own
    // submit path — the programmatic submit our button used silently dropped the reply target, which is
    // why "reply" appeared to do nothing. chatSubmitCurrent() is parked in the depot file.
    chatUpdateNameHint();

    // lightbox on click for chat images/links
    chatBodyEl.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest("a");
      var img = e.target.closest && e.target.closest("img");
      var url = "";
      if (img && img.src && /^https?:/i.test(img.src)) url = img.src;
      else if (a && a.href && /\.(jpe?g|png|webp|gif)(\?|$)/i.test(a.href)) url = a.href;
      if (!url) return;
      e.preventDefault(); e.stopPropagation();
      if (window.dragonZoomLightbox) window.dragonZoomLightbox(url, null, null, 0);
      else if (window.dragonLightbox) window.dragonLightbox({ url: url, prompt: "" });
      else window.open(url, "_blank");
    }, true);
    // Egon 15.09.2026 — hidden 🌐 translate panel (opened from the tools row) + refresh the name pill.
    chatXlateEnsure();
    chatRefreshMeLabel();
    // Egon 19.09.2026 — the 🗓️ message-range button + the ➕ dialog watcher live on top of this window.
    try { chatRangePaint(); chatDlgInit(); chatCustomEnsure(); } catch (e) {}
    return win;
  }

  ;function chatHiText() {
    try {
      var m = (window.root && window.root.dragonHiMessages) || null;
      if (m && m.selectOne) { var s = m.selectOne.evaluateItem; if (typeof s === "string" && s.trim()) return s.trim(); }
    } catch (e) {}
    return "\uD83D\uDC4B Hello there! Just popped in to say hi \uD83D\uDE0A";
  }
  ;function chatSayHi() {
    var a = chatActive();
    if (!a || !a.iframe) { toast("open the chat first"); return; }
    var channel = a.channel || "";
    var text = chatHiText();
    var requestId = Math.random().toString() + Math.random().toString();
    var done = false;
    var handler = function (e) {
      if (e.origin !== "https://comments-plugin.perchance.org") return;
      if (e.data && e.data.type === "message_submit_response" && e.data.requestId === requestId) {
        window.removeEventListener("message", handler); done = true;
        toast(e.data.success ? "\uD83D\uDCAC " + text : "\u26A0\uFE0F couldn't send — try again");
      }
    };
    window.addEventListener("message", handler);
    try { a.iframe.contentWindow.postMessage({ type: "trigger_programmatic_submit", text: text, nickname: null, auth: null, channel: channel, requestId: requestId }, "https://comments-plugin.perchance.org"); }
    catch (err) { window.removeEventListener("message", handler); toast("\u26A0\uFE0F couldn't send"); return; }
    setTimeout(function () { if (!done) { window.removeEventListener("message", handler); toast("\u23F3 chat not ready yet"); } }, 8000);
  }

  ;function chatInsertText(txt) {    var a = chatActive();
    if (!a || !a.iframe) { toast("open the chat first"); return; }
    var ch = a.channel || "";
    var cur = chatInputText[ch] || "";
    var next = cur + txt;
    try { a.iframe.contentWindow.postMessage({ type: "set_input_el_text", channel: ch, text: next }, "https://comments-plugin.perchance.org"); } catch (e) {}
    chatInputText[ch] = next;
  }

  var EMOJIS = "\uD83D\uDE00 \uD83D\uDE03 \uD83D\uDE04 \uD83D\uDE01 \uD83D\uDE06 \uD83D\uDE05 \uD83D\uDE02 \uD83E\uDD23 \uD83D\uDE0A \uD83D\uDE07 \uD83D\uDE42 \uD83D\uDE43 \uD83D\uDE09 \uD83D\uDE0C \uD83D\uDE0D \uD83E\uDD70 \uD83D\uDE18 \uD83D\uDE17 \uD83D\uDE19 \uD83D\uDE1A \uD83D\uDE0B \uD83D\uDE1B \uD83D\uDE1C \uD83D\uDE1D \uD83E\uDD2A \uD83E\uDD28 \uD83D\uDE10 \uD83D\uDE11 \uD83D\uDE36 \uD83D\uDE44 \uD83D\uDE0F \uD83D\uDE12 \uD83D\uDE14 \uD83D\uDE15 \uD83E\uDD2C \uD83D\uDE2C \uD83D\uDE0E \uD83E\uDD13 \uD83D\uDE25 \uD83D\uDE22 \uD83D\uDE2D \uD83D\uDE2A \uD83D\uDE35 \uD83D\uDE2B \uD83E\uDD14 \uD83D\uDE2F \uD83D\uDE28 \uD83D\uDE31 \uD83D\uDE30 \uD83D\uDE26 \uD83D\uDE27 \uD83D\uDE29 \uD83E\uDD2F \uD83D\uDE24 \uD83D\uDE20 \uD83D\uDE21 \uD83E\uDD2E \uD83D\uDE33 \uD83D\uDE32 \uD83E\uDD73 \uD83D\uDE08 \uD83D\uDE2E \uD83E\uDD2D \uD83D\uDE34 \uD83E\uDD24 \uD83D\uDE22 \uD83E\uDD7A \uD83D\uDE0C \uD83D\uDC96 \uD83D\uDC95 \uD83D\uDC9E \uD83D\uDC9F \uD83D\uDC9C \uD83D\uDC94 \uD83D\uDC8B \uD83D\uDC8C \u2764\uFE0F \uD83E\uDDE1 \uD83D\uDC9B \uD83D\uDC99 \uD83D\uDC9A \uD83D\uDC9C \uD83D\uDDA4 \uD83E\uDD0D \uD83E\uDD0E \u2728 \uD83D\uDD25 \u2B50 \uD83C\uDF1F \uD83D\uDC4D \uD83D\uDC4E \uD83D\uDC4C \uD83D\uDC4F \uD83D\uDE4C \uD83E\uDD1D \uD83D\uDE4F \uD83D\uDCAA \uD83C\uDF89 \uD83C\uDF8A \uD83C\uDF8A \uD83E\uDD73 \uD83C\uDF81 \uD83D\uDC51 \uD83C\uDF1E \uD83C\uDF08 \uD83C\uDF38 \uD83C\uDF3B \uD83C\uDF3C \uD83C\uDF40 \uD83C\uDF37 \uD83C\uDF3A \uD83C\uDF3E \uD83D\uDC3E \uD83D\uDC31 \uD83D\uDC36 \uD83E\uDD8A \uD83D\uDC3C \uD83D\uDC3A \uD83E\uDD84 \uD83D\uDC09 \uD83D\uDD4A \uD83E\uDD85 \uD83D\uDC2F".split(" ");
  var emojiPop = null;
  ;function openEmojiPicker(anchor) {
    if (emojiPop) { emojiPop.remove(); emojiPop = null; }
    var pop = document.createElement("div");
    pop.className = "dragon-emoji-pop";
    EMOJIS.forEach(function (em) {
      if (!em) return;
      var b = document.createElement("button");
      b.type = "button"; b.textContent = em;
      b.onclick = function () { chatInsertText(" " + em + " "); };
      pop.appendChild(b);
    });
    document.body.appendChild(pop);
    var r = anchor.getBoundingClientRect();
    pop.style.left = Math.max(6, Math.min(r.left, window.innerWidth - 330)) + "px";
    pop.style.top = Math.max(6, r.top - pop.offsetHeight - 6) + "px";
    emojiPop = pop;
    setTimeout(function () {
      var close = function (ev) { if (pop.contains(ev.target)) return; pop.remove(); if (emojiPop === pop) emojiPop = null; document.removeEventListener("pointerdown", close, true); };
      document.addEventListener("pointerdown", close, true);
    }, 0);
  }

  ;function chatSendUrl(url) {
    var a = chatActive();
    if (!a || !a.iframe) { toast("open the chat first"); return; }
    var channel = a.channel || "";
    var requestId = Math.random().toString() + Math.random().toString();
    try { a.iframe.contentWindow.postMessage({ type: "trigger_programmatic_submit", text: url, nickname: null, auth: null, channel: channel, requestId: requestId }, "https://comments-plugin.perchance.org"); toast("\uD83D\uDDBC\uFE0F image sent"); }
    catch (e) { toast("\u26A0\uFE0F couldn't send"); }
  }

  ;function chatGeneralContent() {
    var w = chatWinEl;
    if (!w) return null;
    var list = w.querySelectorAll(".tabbed-comments-plugin-content");
    for (var k = 0; k < list.length; k++) {
      var ch = (list[k].dataset && list[k].dataset.channel) || "";
      if (ch === "" || ch === "general") return list[k];
    }
    return null;
  }
  ;async function chatResolveSendableUrl(url) {
    if (/^https?:/i.test(url)) return url;
    var up = (window.root && window.root.uploadPlugin) || window.uploadPlugin || null;
    if (!up) { toast("\u26A0\uFE0F couldn't send"); return null; }
    toast("\u23F3 uploading image\u2026");
    try {
      var payload = url;
      if (/^blob:/i.test(url)) {
        var b = await fetch(url).then(function (r) { return r.blob(); });
        payload = await blobToDataUrl(b);
      }
      if (!payload) { toast("\u26A0\uFE0F couldn't send"); return null; }
      var res = await up(payload);
      if (res && res.url && !res.error) return String(res.url);
    } catch (e) {}
    toast("\u26A0\uFE0F upload failed");
    return null;
  }
  ;function chatSubmitToGeneral(text, dryRun) {
    try { if (window.dragonChatOpen) window.dragonChatOpen(); } catch (e) {}
    var w = chatWinEl;
    if (!w) { toast("open the chat first"); return; }
    try {
      var tab = w.querySelector('.tabbed-comments-plugin-channel-tab[data-channel=""]') || w.querySelector('.tabbed-comments-plugin-channel-tab[data-channel="general"]');
      if (tab && !tab.classList.contains("tabbed-comments-plugin-active-tab")) tab.click();
    } catch (e) {}
    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      var content = chatGeneralContent();
      var iframe = content ? content.querySelector("iframe") : null;
      if ((!iframe || !iframe.contentWindow) && tries < 40) return;
      clearInterval(timer);
      if (!iframe || !iframe.contentWindow) { toast("\u23F3 chat not ready yet"); return; }
      if (dryRun) { toast("\uD83D\uDCAC General channel ready"); return; }
      var channel = (content.dataset && content.dataset.channel) || "";
      var requestId = Math.random().toString() + Math.random().toString();
      var done = false;
      var handler = function (e) {
        if (e.origin !== "https://comments-plugin.perchance.org") return;
        if (e.data && e.data.type === "message_submit_response" && e.data.requestId === requestId) {
          window.removeEventListener("message", handler); done = true;
          toast(e.data.success ? "\uD83D\uDCE3 sent to General chat" : "\u26A0\uFE0F couldn't send \u2014 try again");
        }
      };
      window.addEventListener("message", handler);
      try { iframe.contentWindow.postMessage({ type: "trigger_programmatic_submit", text: text, nickname: null, auth: null, channel: channel, requestId: requestId }, "https://comments-plugin.perchance.org"); }
      catch (err) { window.removeEventListener("message", handler); toast("\u26A0\uFE0F couldn't send"); return; }
      setTimeout(function () { if (!done) { window.removeEventListener("message", handler); } }, 8000);
    }, 300);
  }
  window.dragonChatSendImage = function (url, opts) {
    opts = opts || {};
    if (opts.dryRun) { chatSubmitToGeneral("", true); return; }
    if (/\.(txt|bat|cmd|com|scr|pif|exe|msi|ps1|vbs|vbe|js|jse|wsf|wsh|hta|html|htm|xhtml|svg|jar|apk|dmg|iso|sh|py|lnk)\b/i.test(String(url || ""))) { try { if (window.dragonChatBlockTxt) window.dragonChatBlockTxt(); } catch (e) {} return; }
    var go = async function () {
      var sendable = await chatResolveSendableUrl(String(url || ""));
      if (!sendable) return;
      chatSubmitToGeneral(sendable, false);
    };
    if (opts.isFlagged) {
      var p = window.dragonVaultConfirm ? window.dragonVaultConfirm({ title: "Filtered picture", body: "This picture is rated none. Its link will still be posted to the General chat, where everyone sees Perchance's own age warning before opening it. Send it anyway?", confirmText: "Send to General", danger: true }) : Promise.resolve({ ok: true });
      p.then(function (res) { if (res && res.ok) go(); });
    } else go();
  };

  var chatPickEl = null;
  // Egon 17.10.2026 — the REAL "Add image" picker (public/private gallery + upload tabs), also opened from our own feed.
  window.dragonChatImagePicker = openImagePicker;
  ;function blobToDataUrl(b) { return new Promise(function (res) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.onerror = function () { res(null); }; fr.readAsDataURL(b); }); }

  ;function openImagePicker(anchor) {
    if (chatPickEl) { chatPickEl.remove(); chatPickEl = null; }
    var a = chatActive();
    var general = !a || chatIsGeneral(a.channel || "");
    var ov = document.createElement("div");
    ov.className = "dragon-chat-imgpick";
    document.body.appendChild(ov);
    chatPickEl = ov;
    var head = document.createElement("div");
    head.className = "dragon-cip-head";
    head.innerHTML = "<span style='flex:1;'>\uD83D\uDDBC\uFE0F Add image</span>";
    var x = document.createElement("button");
    x.textContent = "\u2715"; x.style.cssText = "width:28px;height:28px;border:1px solid #7a7a8c;background:#2a2a33;color:#eee;border-radius:8px;cursor:pointer;";
    x.onclick = function () { closePicker(); };
    head.appendChild(x);
    var tabs = document.createElement("div");
    tabs.className = "dragon-cip-tabs";
    var grid = document.createElement("div");
    grid.className = "dragon-cip-grid";
    var warn = document.createElement("div");
    warn.className = "dragon-cip-warn";
    warn.style.display = general ? "block" : "none";
    warn.textContent = "\u26A0\uFE0F General channel: only G-rated images can be added here.";
    ov.append(head, tabs, grid, warn);
    // Centered over the chat window (fallback: viewport), clamped into view. The header is a
    // drag handle so the user can move the picker anywhere.
    var ref = (chatWinEl && chatWinEl.style.display !== "none") ? chatWinEl.getBoundingClientRect() : null;
    var bw = ov.offsetWidth || Math.min(560, window.innerWidth * 0.92);
    var bh = ov.offsetHeight || Math.min(window.innerHeight * 0.72, 640);
    var baseLeft = ref ? (ref.left + (ref.width - bw) / 2) : ((window.innerWidth - bw) / 2);
    var baseTop = ref ? (ref.top + (ref.height - bh) / 2) : ((window.innerHeight - bh) / 2);
    ov.style.left = Math.max(6, Math.min(baseLeft, window.innerWidth - bw - 10)) + "px";
    ov.style.top = Math.max(6, Math.min(baseTop, window.innerHeight - bh - 10)) + "px";
    (function () {
      var dsx, dsy, ox, oy, drag = false;
      head.addEventListener("pointerdown", function (e) {
        if (e.target.closest("button")) return;
        drag = true;
        var rr = ov.getBoundingClientRect();
        ox = rr.left; oy = rr.top; dsx = e.clientX; dsy = e.clientY;
        try { head.setPointerCapture(e.pointerId); } catch (err) {}
        e.preventDefault();
      });
      head.addEventListener("pointermove", function (e) {
        if (!drag) return;
        var nx = Math.max(4, Math.min(window.innerWidth - 60, ox + e.clientX - dsx));
        var ny = Math.max(4, Math.min(window.innerHeight - 40, oy + e.clientY - dsy));
        ov.style.left = nx + "px"; ov.style.top = ny + "px";
      });
      ;function stop() { drag = false; }
      head.addEventListener("pointerup", stop);
      head.addEventListener("pointercancel", stop);
    })();
    ;function closePicker() {
      if (chatPickEl) { chatPickEl.remove(); chatPickEl = null; }
      grid.querySelectorAll("img").forEach(function (im) { if (im.dataset.ourl) { try { URL.revokeObjectURL(im.dataset.ourl); } catch (e) {} } });
    }
    ;function mkTab(label, active, fn) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "dragon-cip-tab" + (active ? " dragon-cip-on" : ""); b.textContent = label;
      b.onclick = function () { tabs.querySelectorAll(".dragon-cip-tab").forEach(function (t) { t.classList.remove("dragon-cip-on"); }); b.classList.add("dragon-cip-on"); fn(); };
      return b;
    }
    ;function cell(url) {
      var c = document.createElement("div"); c.className = "dragon-cip-cell";
      var im = document.createElement("img"); im.loading = "lazy"; im.src = url; c.appendChild(im);
      c.onclick = function () { chatSendUrl(url); closePicker(); };
      return c;
    }
    ;async function loadPublic() {
      grid.innerHTML = "<div style='grid-column:1/-1;text-align:center;color:#9d9ab5;padding:1rem;'>loading public gallery\u2026</div>";
      try {
        var ch = window.generatorName || "bestaigen";
        var url = "https://image-generation.perchance.org/gallery?channel=" + encodeURIComponent(ch) + "&subChannel=public&sort=recent&timeRange=all-time&contentFilter=g";
        var f = window.dragonSuperFetch || window.fetch;
        var html = await f(url).then(function (r) { return r.text(); });
        var re = /https:\/\/[a-z0-9.\-]+\.uploads\.dev\/[^"'\s)]+?\.(?:jpe?g|png|webp)/gi, m, out = {}, urls = [];
        while ((m = re.exec(html))) { if (!out[m[0]]) { out[m[0]] = 1; urls.push(m[0]); } }
        grid.innerHTML = "";
        if (!urls.length) { grid.innerHTML = "<div style='grid-column:1/-1;text-align:center;color:#9d9ab5;padding:1rem;'>No public images found.</div>"; return; }
        urls.slice(0, 120).forEach(function (u) { grid.appendChild(cell(u)); });
      } catch (e) { grid.innerHTML = "<div style='grid-column:1/-1;text-align:center;color:#ffb3c0;padding:1rem;'>Could not load public gallery.</div>"; }
    }
    var privUrls = [];
    ;async function loadPrivate() {
      grid.innerHTML = "<div style='grid-column:1/-1;text-align:center;color:#9d9ab5;padding:1rem;'>reading your Likes\u2026</div>";
      try {
        var folders = {};
        var dbs = await indexedDB.databases();
        for (var i = 0; i < dbs.length; i++) {
          var nm = dbs[i].name || "";
          if (nm.indexOf("localMediaGallery_.") !== 0 || nm.indexOf("localMediaGallery_..") === 0 || nm.slice(-"-db-kv-plugin".length) !== "-db-kv-plugin" || nm.indexOf("blobs") !== -1) continue;
          folders[nm.slice("localMediaGallery_.".length, -"-db-kv-plugin".length)] = nm;
        }
        var ratingMap = {};
        try { ratingMap = JSON.parse(localStorage.dragonRatingMap || "{}"); } catch (e) { ratingMap = {}; }
        grid.innerHTML = "";
        var shown = 0;
        var ids = [];
        for (var f in folders) {
          try {
            var db = await window.dragonOpenIDB(folders[f]);
            var recs = await window.dragonStoreAll(db);
            db.close();
            for (var j = 0; j < recs.length; j++) {
              var id = String(recs[j].id);
              if (general) {
                var hash = window.dragonHashForVaultId ? window.dragonHashForVaultId(id) : "";
                var r = (hash && ratingMap[hash]) || (f === "NS"+"FW" ? "none" : "g");
                if (r !== "g" && r !== "safe") continue;
              }
              ids.push(id);
            }
          } catch (e) {}
        }
        if (!ids.length) { grid.innerHTML = "<div style='grid-column:1/-1;text-align:center;color:#9d9ab5;padding:1rem;'>No matching images in your Likes.</div>"; return; }
        ids.slice(0, 160).forEach(function (id) {
          var c = document.createElement("div"); c.className = "dragon-cip-cell";
          var im = document.createElement("img"); c.appendChild(im);
          grid.appendChild(c);
          window.dragonVaultBlobGet(id).then(function (rec) {
            var b = null;
            try { b = (rec instanceof Blob) ? rec : (rec ? window.dragonToBlob(rec) : null); } catch (e) {}
            if (!b || !c.isConnected) return;
            var u = URL.createObjectURL(b); im.dataset.ourl = u; im.src = u;
            c.onclick = async function () {
              toast("\u23F3 uploading image\u2026");
              try {
                var up = (window.root && window.root.uploadPlugin) || window.uploadPlugin;
                var du = await blobToDataUrl(b);
                var res = await up(du);
                if (res && res.url && !res.error) { chatSendUrl(String(res.url)); closePicker(); }
                else toast("\u26A0\uFE0F upload failed");
              } catch (e) { toast("\u26A0\uFE0F upload failed"); }
            };
          }).catch(function () {});
        });
      } catch (e) { grid.innerHTML = "<div style='grid-column:1/-1;text-align:center;color:#ffb3c0;padding:1rem;'>Could not read Likes.</div>"; }
    }
    tabs.append(
      mkTab("\uD83C\uDF10 Public", true, loadPublic),
      mkTab("\uD83D\uDD12 Private", false, loadPrivate)
    );
    loadPublic();
    setTimeout(function () {
      var close = function (ev) { if (!ov.isConnected) { document.removeEventListener("pointerdown", close, true); return; } if (ov.contains(ev.target) || anchor.contains(ev.target)) return; closePicker(); document.removeEventListener("pointerdown", close, true); };
      document.addEventListener("pointerdown", close, true);
    }, 0);
  }

  ;function openChatSettings(anchor) {
    var existing = document.querySelector(".dragon-chat-settings-pop");
    if (existing) { existing.remove(); return; }
    var pop = document.createElement("div");
    pop.className = "dragon-chat-settings-pop";
    pop.style.cssText = "position:fixed; z-index:2147483300; width:min(320px,92vw); padding:.8rem; border:1px solid #4a4a58; border-radius:14px; background:linear-gradient(180deg,#1a1a22,#0f0f14); box-shadow:0 14px 40px rgba(0,0,0,.6); font:13px/1.4 system-ui; color:#e9e6f2;";
    pop.innerHTML =
      "<div style='font-weight:800;color:#d8c9ff;margin-bottom:.5rem;'>\u2699\uFE0F Comments settings</div>" +
      "<label style='display:block;margin:.35rem 0;'>Display name<input id='dragonChatNick' style='width:100%;box-sizing:border-box;margin-top:.2rem;padding:.4rem .5rem;border:1px solid #4a4a58;border-radius:8px;background:#12121a;color:#eee;'></label>" +
      "<label style='display:block;margin:.35rem 0;'>Avatar image URL<input id='dragonChatAvatar' placeholder='https://\u2026' style='width:100%;box-sizing:border-box;margin-top:.2rem;padding:.4rem .5rem;border:1px solid #4a4a58;border-radius:8px;background:#12121a;color:#eee;'></label>" +
      "<label style='display:flex;align-items:center;gap:.45rem;margin:.55rem 0 .1rem;cursor:pointer;'><input type='checkbox' id='dragonDexaBotTgl' style='width:1rem;height:1rem;accent-color:#2bbd62;'>❖ This browser hosts Dexa (answers in General)</label>" +
      "<div style='display:flex;gap:.4rem;flex-wrap:wrap;margin-top:.5rem;'>" +
        "<button id='dragonChatNickSave' style='flex:1;padding:.4rem;border:1px solid #5a4a7d;border-radius:9px;background:linear-gradient(180deg,#3a2f57,#201830);color:#e6dcff;cursor:pointer;font-weight:bold;'>Save name</button>" +
        "<button id='dragonChatAvatarSave' style='flex:1;padding:.4rem;border:1px solid #5a4a7d;border-radius:9px;background:linear-gradient(180deg,#3a2f57,#201830);color:#e6dcff;cursor:pointer;font-weight:bold;'>Save avatar</button>" +
      "</div>" +
      "<button id='dragonChatReload' style='width:100%;margin-top:.5rem;padding:.4rem;border:1px solid #7d3a48;border-radius:9px;background:linear-gradient(180deg,#4a2230,#2a1018);color:#ffb3c0;cursor:pointer;font-weight:bold;'>\u21BB Reload chat</button>";
    document.body.appendChild(pop);
    var r = anchor.getBoundingClientRect();
    pop.style.left = Math.max(6, Math.min(r.right - pop.offsetWidth, window.innerWidth - pop.offsetWidth - 8)) + "px";
    pop.style.top = (r.bottom + 6) + "px";
    try { pop.querySelector("#dragonChatNick").value = localStorage.getItem("dragonChatNick") || ""; } catch (e) {}
    pop.querySelector("#dragonChatNickSave").onclick = function () {
      var v = pop.querySelector("#dragonChatNick").value;
      try { localStorage.setItem("dragonChatNick", v); } catch (e) {}
      chatPost({ type: "set_next_submit_nickname", channel: (chatActive() || {}).channel || "", nickname: v });
      chatRefreshMeLabel();
      toast("\u2705 name saved");
    };
    pop.querySelector("#dragonChatAvatarSave").onclick = function () {
      var v = pop.querySelector("#dragonChatAvatar").value;
      chatPost({ type: "set_next_submit_avatar_url", channel: (chatActive() || {}).channel || "", nickname: v });
      toast("\u2705 avatar saved");
    };
    try { pop.querySelector("#dragonDexaBotTgl").checked = (function () { try { return localStorage.getItem("dragonDexaBotHost") === "1"; } catch (e) { return false; } })(); } catch (e2) {}
    pop.querySelector("#dragonDexaBotTgl").onchange = function () {
      var on = false;
      try { on = !!pop.querySelector("#dragonDexaBotTgl").checked; localStorage.setItem("dragonDexaBotHost", on ? "1" : "0"); } catch (e) {}
      toast(on ? "Dexa lives in this browser now" : "Dexa does not answer from here");
    };
    pop.querySelector("#dragonChatReload").onclick = function () {
      if (!chatBodyEl) return;
      chatBodyEl.innerHTML = ""; chatBuilt = false; chatBuildContent();
      toast("\u21BB chat reloaded");
      pop.remove();
    };
    setTimeout(function () {
      var close = function (ev) { if (pop.contains(ev.target) || anchor.contains(ev.target)) return; pop.remove(); document.removeEventListener("pointerdown", close, true); };
      document.addEventListener("pointerdown", close, true);
    }, 0);
  }

  window.dragonChatSettingsOpen = openChatSettings;
  window.dragonChatOpen = function () {
    buildChatWindow();
    // Egon 15.09.2026 — if it was minimized to the bubble, ANY chat button restores it where it was;
    // otherwise the position rule below applies.
    if (chatIsMinimized() && chatWinEl.style.display === "none") { chatRestoreFromBubble(); return; }
    chatOpenedByUser = true;
    chatWinEl.style.display = "flex";
    chatWinEl.style.opacity = "";         // clear any background-preload invisibility
    chatWinEl.style.pointerEvents = "";
    chatWinEl.classList.remove("dragon-chat-min");
    chatShowBubble(false);
    // Egon 17.10.2026 (W-SOC381) — open in the remembered view (floating window by default);
    // the full page drops stale inline geometry so the stylesheet's rule applies.
    chatApplyView();
    chatLSSet("dragonChatSeen", "1");
    // Egon 17.10.2026 — the old plugin chat docks as the fixed corner mini (see dragon-feed-mini).
    chatBuildContent();
    chatEnsureLoaded();
    chatRefreshMeLabel();
    chatNameHintSoon();
    chatBadgeSet(0);   // Egon 15.09.2026 — opening the chat clears the unread notification badge
    chatLSSet("dragonChatOpen", "1");
    // Egon 17.10.2026 — açık chat adrese yazılır: perchance.org/bestaigen#chat (replaceState, loop yok).
    try { writeHash("chat"); } catch (e) {}
    try { if (window.dragonCommentsParkSoon) window.dragonCommentsParkSoon(600); } catch (e) {}   // Paket C4: only the active channel stays alive
  };
  window.dragonChatClose = function () {
    if (!chatWinEl) return;
    chatSaveGeo();      // Egon 15.09.2026 — remember the last position when closing (next opening will be at the same place)
    chatWinEl.style.display = "none";
    chatShowBubble(false);
    chatLSSet("dragonChatOpen", "0");
    // Egon 17.10.2026 — chat kapandıysa #chat de adresten düşer (başka hash'e dokunmaz).
    try { if (String(location.hash || "").toLowerCase() === "#chat") history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
    try { if (window.dragonCommentsParkSoon) window.dragonCommentsParkSoon(600); } catch (e) {}   // Paket C4: park the channels the visitor is not looking at
  };
  window.dragonChatToggle = function () {
    buildChatWindow();
    // Egon 28.09.2026 (W-UI360) — the background preload keeps the window laid out but INVISIBLE
    // (opacity 0, display "") for a few seconds; reading display alone then takes the CLOSE path on
    // the very first press. An invisible window always counts as closed here.
    var invisible = (chatWinEl.style.display === "none") || chatPreloading || (chatWinEl.style.opacity === "0");
    if (invisible) window.dragonChatOpen(); else window.dragonChatClose();
  };

  // Egon 15.09.2026 — BACKGROUND PRELOAD (for notifications that work WITHOUT opening the chat first).
  // The comments feed lives in an iframe that is only created while the chat window is visible, so with
  // no iframe there is nothing to fire window.dragonChatOnComment. We build the window once the app has
  // settled, keep it laid out but INVISIBLE (opacity:0 + pointer-events:none) so the comments plugin's
  // OWN IntersectionObserver loads just the ACTIVE channel's iframe (hidden background tabs have no box,
  // so they stay lazy — forcing every channel would spin up ~8 iframes). As soon as that one iframe is
  // up we hide the window completely; the iframe keeps polling, so new messages notify even if the user
  // never opened the chat. If the user opens it during this window we never hide it.
  ;function chatPreload() {
    try {
      if (chatWinEl) return;                                              // already open/built
      if (typeof window.generateCommentsPluginElement85638294 !== "function") return; // plugin not ready yet
      buildChatWindow();                                                  // appended this same tick
      chatWinEl.style.opacity = "0";                                      // invisible but still laid out
      chatWinEl.style.pointerEvents = "none";
      chatPreloading = true;
      chatBuildContent();
      var ticks = 0;
      var poll = setInterval(function () {
        ticks++;
        var act = chatWinEl && chatWinEl.querySelector(".tabbed-comments-plugin-active-content iframe");
        if (act || ticks > 60) {
          clearInterval(poll);
          chatPreloading = false;
          try {
            chatWinEl.style.opacity = "";
            chatWinEl.style.pointerEvents = "";
            if (!chatOpenedByUser) chatWinEl.style.display = "none";
          } catch (e) {}
          // Egon 17.10.2026 — the hidden feed is what fires message notifications; on a slow
          // boot the embed can still be missing after 30 s, so keep re-arming in the background.
          if (!act && !chatOpenedByUser) chatPreloadRearm();
        }
      }, 500);
    } catch (e) {}
  }
  // Egon 17.10.2026 — RE-ARM: if the embed still was not up, try again every 45 s (max 8).
  // Each attempt re-lays the window out invisibly (display:none gives the plugin's
  // IntersectionObserver no box, so it must be flex + opacity:0), polls briefly, then hides
  // again. Stops the moment the user opens the chat or an iframe exists. Cheap: a few DOM
  // reads per attempt, no network of its own.
  var chatRearms = 0;
  ;function chatPreloadRearm() {
    try {
      if (chatRearms >= 8) return;
      if (!chatWinEl || chatOpenedByUser) return;
      if (chatWinEl.querySelector(".tabbed-comments-plugin-active-content iframe")) return;
      chatRearms++;
      setTimeout(function () {
        try {
          if (!chatWinEl || chatOpenedByUser) return;
          if (chatWinEl.querySelector(".tabbed-comments-plugin-active-content iframe")) return;
          chatWinEl.style.display = "flex";
          chatWinEl.style.opacity = "0";
          chatWinEl.style.pointerEvents = "none";
          chatPreloading = true;
          try { chatBuildContent(); } catch (eB) {}
          var t2 = 0;
          var p2 = setInterval(function () {
            t2++;
            var a2 = chatWinEl && chatWinEl.querySelector(".tabbed-comments-plugin-active-content iframe");
            if (a2 || t2 > 40 || !chatWinEl || chatOpenedByUser) {
              clearInterval(p2);
              chatPreloading = false;
              try {
                if (chatWinEl && !chatOpenedByUser) {
                  chatWinEl.style.opacity = "";
                  chatWinEl.style.pointerEvents = "";
                  chatWinEl.style.display = "none";
                }
              } catch (eH) {}
              if (!a2) chatPreloadRearm();
            }
          }, 500);
        } catch (eO) {}
      }, 45000);
    } catch (e) {}
  }
  ;(function chatPreloadWatch() {
    var tries = 0;
    var t = setInterval(function () {
      tries++;
      if (chatWinEl || tries > 60) { clearInterval(t); return; }
      if (typeof window.generateCommentsPluginElement85638294 === "function") {
        clearInterval(t);
        setTimeout(chatPreload, 5000);   // let the main app finish booting before adding the hidden feed
      }
    }, 1000);
  })();
  // Egon 19.09.2026 — SUGGESTION INBOX. The survey's free-text box posts into the chat's "suggestion"
  // channel. The tabbed comments element only builds the iframe of the channel that is ACTIVE, so the
  // first use quietly switches the (usually hidden) chat window to the Suggestion tab, gives it a box so
  // the plugin's lazy loader can build its iframe, and switches straight back; after that the iframe
  // stays alive and later posts go straight to it. Messages in this channel never raise a badge or a
  // sound (see the guard in window.dragonChatOnComment), so nobody is pinged by a suggestion.
  ;function chatSuggestionFrame() {
    if (!chatWinEl) return null;
    return chatWinEl.querySelector(".tabbed-comments-plugin-content[data-channel='suggestion'] iframe");
  }
  ;function chatSuggestionPrepare(cb) {
    if (chatSuggestionFrame()) { cb(true); return; }
    if (typeof window.generateCommentsPluginElement85638294 !== "function") { cb(false); return; }
    buildChatWindow();
    chatBuildContent();
    var w = chatWinEl;
    if (!w) { cb(false); return; }
    var tabs = w.querySelectorAll(".tabbed-comments-plugin-channel-tab");
    var prev = null, target = null;
    for (var i = 0; i < tabs.length; i++) {
      var ch = tabs[i].dataset ? tabs[i].dataset.channel : "";
      if (tabs[i].classList.contains("tabbed-comments-plugin-active-tab")) prev = tabs[i];
      if (ch === "suggestion") target = tabs[i];
    }
    if (!target) { cb(false); return; }
    // The window is normally a hidden preload (display:none). Lazy iframes need a real box, so it is
    // laid out but invisible for the few hundred ms this takes, then restored exactly as it was.
    var wasDisp = w.style.display, wasOp = w.style.opacity, wasPE = w.style.pointerEvents;
    var needBox = (wasDisp === "none");
    if (needBox) { w.style.display = "flex"; w.style.opacity = "0"; w.style.pointerEvents = "none"; }
    try { target.click(); } catch (e) {}
    var ticks = 0;
    var iv = setInterval(function () {
      ticks++;
      var f = chatSuggestionFrame();
      if (f || ticks > 40) {
        clearInterval(iv);
        try { if (prev && prev !== target) prev.click(); } catch (e) {}
        if (needBox) { try { w.style.display = wasDisp; w.style.opacity = wasOp; w.style.pointerEvents = wasPE; } catch (e) {} }
        cb(!!f);
      }
    }, 250);
  }
  window.dragonSuggestPrepare = chatSuggestionPrepare;   // test hook: prepares the Suggestion iframe without posting
  window.dragonSuggestSubmit = function (text, cb) {
    var msg = String(text == null ? "" : text).trim().slice(0, 600);
    if (!msg) { if (cb) cb(false, "empty"); return; }
    chatSuggestionPrepare(function (ok) {
      var f = chatSuggestionFrame();
      if (!ok || !f || !f.contentWindow) { if (cb) cb(false, "notready"); return; }
      var requestId = "sug-" + Date.now() + "-" + Math.random().toString(36).slice(2);
      var done = false;
      var handler = function (e) {
        if (e.origin !== "https://comments-plugin.perchance.org") return;
        if (e.data && e.data.type === "message_submit_response" && e.data.requestId === requestId) {
          window.removeEventListener("message", handler); done = true;
          if (cb) cb(!!e.data.success, e.data.success ? "" : (e.data.message || "failed"));
        }
      };
      window.addEventListener("message", handler);
      try {
        f.contentWindow.postMessage({ type: "trigger_programmatic_submit", text: msg, nickname: null, auth: null, channel: "suggestion", requestId: requestId }, "https://comments-plugin.perchance.org");
      } catch (err) { window.removeEventListener("message", handler); if (cb) cb(false, "post"); return; }
      setTimeout(function () { if (!done) { window.removeEventListener("message", handler); if (cb) cb(false, "timeout"); } }, 20000);
    });
  };

  // ===================== ⌘K COMMAND PALETTE (Egon 10.09.2026) =====================
  // A single shortcut (Ctrl+K / ⌘K) opens a search box in the center; page transitions, production, theme,
  // existing functions like cleaning and searching are called from a single place. There is a test button in the Toolbox.
  ;function dragonCmdList() {
    return [
      { ic: "\u2728", lb: "Generate image now", h: "generate", run: function () { if (window.dragonTriggerGen) window.dragonTriggerGen(); else { var g = document.getElementById("generateButtonEl"); if (g) g.click(); } } },
      { ic: "\uD83C\uDFE0", lb: "Go to Home", h: "home page", run: function () { if (window.dragonGoPage) window.dragonGoPage("home"); } },
      { ic: "\u2728", lb: "Go to Generate", h: "generate page", run: function () { if (window.dragonGoPage) window.dragonGoPage("generate"); } },
      { ic: "\uD83D\uDC83", lb: "Go to Character Creation", h: "character", run: function () { if (window.dragonGoPage) window.dragonGoPage("character"); } },
      { ic: "\uD83D\uDDBC\uFE0F", lb: "Go to Galleries", h: "gallery public", run: function () { if (window.dragonGoPage) window.dragonGoPage("gallery"); } },
      { ic: "\uD83D\uDD58", lb: "Go to History", h: "history tools", run: function () { if (window.dragonGoPage) window.dragonGoPage("history"); } },
      { ic: "\u2B50", lb: "Go to Likes", h: "likes saved private", run: function () { if (window.dragonGoPage) window.dragonGoPage("likes"); } },
      { ic: "\u2699\uFE0F", lb: "Go to Settings", h: "account options", run: function () { if (window.dragonGoPage) window.dragonGoPage("account"); } },
      { ic: "\uD83C\uDF14", lb: "Toggle Dark / Light mode", h: "dark mode theme", run: function () { if (window.toggleManualDarkMode_jv83hb27igksf) window.toggleManualDarkMode_jv83hb27igksf(); } },
      { ic: "\uD83E\uDDF9", lb: "Clear prompt", h: "clear description", run: function () { if (window.dragonSetDesc) window.dragonSetDesc(""); var ta = document.querySelector('textarea[data-name="description"]'); if (ta) { ta.value = ""; ta.dispatchEvent(new Event("input", { bubbles: true })); ta.focus(); } if (window.dragonToast) dragonToast("\uD83E\uDDF9 prompt cleared"); } },
      { ic: "\uD83D\uDD0D", lb: "Search Likes (private gallery)", h: "search find saved", run: function () { if (window.dragonOpenVaultSearch) window.dragonOpenVaultSearch(); } },
      { ic: "\uD83C\uDFE6", lb: "Open Prompt Bank", h: "bank", run: function () { if (window.dragonBank) window.dragonBank(); } },
      { ic: "\uD83D\uDCDD", lb: "Open Scratchpad", h: "scratchpad notes", run: function () { if (window.dragonScratchpad) window.dragonScratchpad(); } },
      { ic: "\uD83C\uDFA8", lb: "Open Generator Themes", h: "themes colors", run: function () { if (window.dragonOpenOptionsThemes) window.dragonOpenOptionsThemes(); } },
      { ic: "\uD83E\uDDF9", lb: "Clear character selections", h: "clear all character", run: function () { if (window.dragonClearAllChar) window.dragonClearAllChar(); } },
      { ic: "\uD83D\uDDE3\uFE0F", lb: "Open Chat", h: "chat comments", run: function () { if (window.dragonChatToggle) window.dragonChatToggle(); } },
      { ic: "\u29C9", lb: "Compare last 2 images", h: "compare", run: function () { if (window.dragonOpenCompare) window.dragonOpenCompare(); } }
    ];
  }
  // 🔍 Egon 23.09.2026 — SETTINGS ▸ SITE SEARCH. Egon could not find a button he knew existed
  // ("cannot find the screen saver full screen button"), so the whole interface is now searchable.
  // The index is rebuilt on EVERY open (it can never go stale) and it walks every control that is in
  // the document at that moment — its visible label, its tooltip, its aria-label and the settings card
  // it sits in — plus the seven top-level pages. Picking a hit scrolls it into view and flashes it; the
  // ▶ chip on the row actually presses it. Matching is case- and accent-insensitive.
  ;function dragonFindNorm(s) {
    s = String(s == null ? "" : s).toLowerCase();
    try { s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); } catch (e) {}
    return s.replace(/\s+/g, " ").trim();
  }
  ;function dragonFindSection(el) {
    var p = el && el.parentElement, depth = 0;
    while (p && depth < 14) {
      if (p.classList && (p.classList.contains("dragon-set-card") || p.classList.contains("dragon-set-board"))) {
        var hd = p.querySelector(".dragon-set-h, .dragon-set-head, .dragon-set-title, .dragon-set-cap, h1, h2, h3");
        var t = dragonFindNorm(hd ? hd.textContent : "");
        if (t) return t.replace(/^[^a-z0-9\u00e0-\u00ff]+/, "").slice(0, 42);
      }
      p = p.parentElement; depth++;
    }
    return "";
  }
  ;function dragonFindVisible(el) {
    try { var r = el.getBoundingClientRect(); return !!(r.width || r.height) && el.offsetParent !== null; } catch (e) { return false; }
  }
  ;function dragonFindLabel(el) {
    var tag = (el.tagName || "").toLowerCase(), raw = "", tip = "", aria = "";
    try {
      if (tag === "select") raw = (el.options && el.selectedIndex >= 0 && el.options[el.selectedIndex]) ? el.options[el.selectedIndex].text : "";
      else if (tag === "input") raw = (el.type === "checkbox" || el.type === "range") ? "" : (el.value || "");
      else raw = el.textContent || "";
    } catch (e) {}
    try { tip = el.getAttribute("title") || el.getAttribute("data-dragon-tip") || ""; } catch (e) {}
    try { aria = el.getAttribute("aria-label") || ""; } catch (e) {}
    // The DISPLAY label keeps its original capitals; the `n` field is the flattened copy the search
    // matches against (case- and accent-insensitive, emoji-safe).
    var shown = String(raw || aria || tip || "").replace(/\s+/g, " ").trim();
    if (shown.length > 78) shown = shown.slice(0, 78) + "\u2026";
    return { lb: shown, n: dragonFindNorm(shown), tip: dragonFindNorm(tip).slice(0, 120) };
  }
  ;function dragonFindIcon(lb) {
    try { var m = String(lb || "").match(/^(\p{Extended_Pictographic}[\uFE0F\u200D\p{Extended_Pictographic}]*)/u); if (m) return m[1]; } catch (e) {}
    return "\uD83D\uDD18";
  }
  // Egon 10.10.2026 — ONE symbol per Buttons & functions row: the icon column already carries the
  // button's symbol, so the display label is shown WITHOUT emoji (buttons keep their own design —
  // mirrored pairs included — only the index row is tidied). Search/dedup keep reading the full label.
  ;function dragonFindStripEmoji(s) {
    try {
      var t = String(s || "").replace(/\p{Extended_Pictographic}\uFE0F?(\u200D\p{Extended_Pictographic}\uFE0F?)*/gu, "");
      t = t.replace(/\s+/g, " ").replace(/^[\s/:|·•\-–—]+/, "").replace(/[\s/:|·•\-–—]+$/, "").trim();
      return t;
    } catch (e) { return String(s || ""); }
  }
  window.dragonFindStripEmoji = dragonFindStripEmoji;
  ;function dragonSiteSearchIndex() {
    var out = [], seen = {}, i, j;
    var pages = [
      ["\u2728", "Generate", "create image prompt page", "generate"],
      ["\uD83C\uDFE0", "Home", "welcome start page", "home"],
      ["\uD83D\uDC83", "Character Creation", "character builder page", "character"],
      ["\uD83D\uDDBC\uFE0F", "Galleries", "public gallery feed page", "gallery"],
      ["\u2B50", "Likes", "saved private gallery favourites page", "likes"],
      ["\uD83D\uDD58", "History", "recent images and prompts page", "history"],
      ["\u2699\uFE0F", "Settings", "options account page", "account"]
    ];
    for (i = 0; i < pages.length; i++) out.push({ ic: pages[i][0], lb: pages[i][1], sec: "page", kw: pages[i][2], go: pages[i][3] });
    var nodes = document.querySelectorAll("button, a[href], [role='button'], input[type='button'], input[type='submit'], input[type='checkbox'], input[type='range'], select");
    for (i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      try {
        if (el.closest(".dragon-find-overlay, .dragon-cmdk-overlay, #dragonPrintPreview, #dragonPrintEditor")) continue;
        if (el.closest("[data-local-media-gallery-lightbox]")) continue;
        if (el.disabled) continue;
      } catch (e) { continue; }
      var L = dragonFindLabel(el);
      if (!L.lb && !L.n && !L.tip) continue;
      var sec = dragonFindSection(el);
      // Egon 23.09.2026 — ONE row per real control: the same button used to be listed twice when its
      // copies had different tooltips, so the key is now the visible LABEL (+ where it lives), and a
      // VISIBLE copy always wins over a hidden one. Hidden/retired controls stay searchable on purpose
      // (Egon: it is a cheap cleanup list) — the row says "(hidden)" instead.
      var key = dragonFindNorm(L.lb || L.n || L.tip).slice(0, 60) + "|" + sec;
      var vis = dragonFindVisible(el);
      if (Object.prototype.hasOwnProperty.call(seen, key)) {
        if (!vis) continue;                                     // a hidden copy never replaces/duplicates
        var prevIdx = seen[key];
        if (out[prevIdx] && out[prevIdx].vis === false) out[prevIdx] = null;   // a visible copy wins
        else continue;
      }
      seen[key] = out.length;
      out.push({ ic: dragonFindIcon(L.lb), lb: L.lb || L.tip.slice(0, 40), n: L.n || L.tip, kw: L.tip, sec: sec, el: el, vis: vis });
    }
    return out.filter(Boolean);
  }
  window.dragonSiteSearchIndex = dragonSiteSearchIndex;
  // Egon 23.09.2026 — the SEPARATE "🔍 Find a button" window is gone: its live-index search now lives
  // inside the merged "🔍 Buttons & Legends" panel (window.dragonOpenLegends), which also carries the
  // legends and has no per-row ▶ chip. The merged panel is built together with the Settings board, so
  // this alias also OPENS that page first when it has not been built yet — a caller (the command palette,
  // an old bookmark, a shortcut) therefore works from anywhere on the site, not only from Settings.
  window.dragonOpenSiteSearch = function () {
    if (window.dragonOpenLegends) { window.dragonOpenLegends(); return; }
    try { if (window.dragonGoPage) window.dragonGoPage("account"); } catch (e) {}
    setTimeout(function () { if (window.dragonOpenLegends) window.dragonOpenLegends(); }, 240);
  };
  window.dragonOpenCommandPalette = function () {
    var old = document.querySelector(".dragon-cmdk-overlay");
    if (old) { old.remove(); return; }
    var ov = document.createElement("div");
    ov.className = "dragon-cmdk-overlay";
    ov.style.cssText = "position:fixed; inset:0; z-index:2147483647; background:rgba(0,0,0,.55); backdrop-filter:blur(2px); display:flex; align-items:flex-start; justify-content:center; padding-top:12vh;";
    var box = document.createElement("div");
    box.style.cssText = "width:min(620px,92vw); max-height:70vh; display:flex; flex-direction:column; border-radius:14px; overflow:hidden; border:1px solid #5a4a7d; background:linear-gradient(180deg,#181822,#0e0e14); box-shadow:0 24px 70px rgba(0,0,0,.75); font:14px/1.4 system-ui; color:#e9e6f2;";
    var searchRow = document.createElement("div");
    searchRow.style.cssText = "display:flex; align-items:center; gap:.5rem; padding:.7rem .9rem; border-bottom:1px solid #2c2c3a; background:#12121a;";
    var mag = document.createElement("span");
    mag.textContent = "🔍";
    mag.style.cssText = "font-size:1rem; flex:0 0 auto;";
    var inp = document.createElement("input");
    inp.type = "text";
    inp.placeholder = "Where do you want to go? (type: gallery, history, character, themes…)";
    inp.style.cssText = "flex:1 1 auto; min-width:0; box-sizing:border-box; padding:.15rem 0; font-size:1rem; border:0; background:transparent; color:#fff; outline:none;";
    var clr = document.createElement("button");
    clr.type = "button"; clr.textContent = "✕"; clr.title = "Clear search";
    clr.style.cssText = "flex:0 0 auto; width:26px; height:26px; padding:0; border-radius:50%; border:1px solid #e0244c; background:linear-gradient(180deg,#3a1016,#1c0808); color:#ffb3c0; font-size:.75rem; cursor:pointer;";
    clr.onclick = function (e) { if (e) e.stopPropagation(); inp.value = ""; sel = 0; render(); try { inp.focus(); } catch (eF) {} };
    searchRow.append(mag, inp, clr);
    var list = document.createElement("div");
    list.style.cssText = "flex:1; overflow-y:auto; padding:.35rem;";
    var palFoot = document.createElement("div");
    palFoot.style.cssText = "display:flex; justify-content:center; padding:.6rem; border-top:1px solid #2c2c3a;";
    var palClose = document.createElement("button");
    palClose.type = "button"; palClose.textContent = "Close"; palClose.title = "Close";
    palClose.style.cssText = "padding:.45rem 1.4rem; font-size:.84rem; font-weight:bold; border:1px solid #9b6bff; background:linear-gradient(180deg,#2a1f4a,#14101f); color:#d8c9ff; border-radius:9px; cursor:pointer;";
    palClose.onclick = function () { close(); };
    palFoot.appendChild(palClose);
    box.append(searchRow, list, palFoot);
    ov.appendChild(box);
    document.body.appendChild(ov);
    var all = dragonCmdList(), sel = 0, vis = all.slice();
    ;function render() {
      list.innerHTML = "";
      vis = all.filter(function (c) {
        var q = inp.value.trim().toLowerCase();
        if (!q) return true;
        return (c.lb + " " + c.h).toLowerCase().indexOf(q) !== -1;
      });
      if (sel >= vis.length) sel = Math.max(0, vis.length - 1);
      if (!vis.length) { var e = document.createElement("div"); e.textContent = "no matching command"; e.style.cssText = "padding:1rem; text-align:center; color:#8a8a9a; font-size:.85rem;"; list.appendChild(e); }
      vis.forEach(function (c, i) {
        var r = document.createElement("div");
        r.style.cssText = "display:flex; align-items:center; gap:.6rem; padding:.55rem .7rem; border-radius:9px; cursor:pointer; background:" + (i === sel ? "rgba(155,107,255,.25)" : "transparent") + ";";
        var ic = document.createElement("span"); ic.textContent = c.ic; ic.style.cssText = "font-size:1.05rem;";
        var lb = document.createElement("span"); lb.textContent = c.lb; lb.style.cssText = "flex:1; font-weight:600;";
        var h = document.createElement("span"); h.textContent = c.h; h.style.cssText = "font-size:.7rem; color:#8f8fa8;";
        r.append(ic, lb, h);
        r.onmouseenter = function () { sel = i; render(); };
        r.onclick = function () { run(vis[i]); };
        list.appendChild(r);
      });
    }
    // Egon 19.09.2026 — Escape must close the palette from ANYWHERE inside it (before, the Escape
    // handler lived on the search input only, so after clicking a list row Escape did nothing and the
    // only way out was the backdrop). The keyboard handling is now one document-level (capture)
    // listener that is removed the moment the palette closes.
    var closed = false;
    var close = function () {
      if (closed) return;
      closed = true;
      try { document.removeEventListener("keydown", onDocKey, true); } catch (e) {}
      try { ov.remove(); } catch (e) {}
    };
    ;function run(c) { if (!c) return; close(); try { c.run(); } catch (e) {} }
    var onDocKey = function (e) {
      if (!document.body || !document.body.contains(ov)) { try { document.removeEventListener("keydown", onDocKey, true); } catch (er) {} return; }
      var k = e.key;
      if (k === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
      else if (k === "ArrowDown") { e.preventDefault(); sel = Math.min(vis.length - 1, sel + 1); render(); }
      else if (k === "ArrowUp") { e.preventDefault(); sel = Math.max(0, sel - 1); render(); }
      else if (k === "Enter") { e.preventDefault(); run(vis[sel]); }
    };
    inp.addEventListener("input", function () { sel = 0; render(); });
    document.addEventListener("keydown", onDocKey, true);
    ov.addEventListener("mousedown", function (e) { if (e.target === ov) close(); });
    render();
    setTimeout(function () { try { inp.focus(); } catch (e) {} }, 30);
  };
  document.addEventListener("keydown", function (e) {
    var k = String(e.key || "").toLowerCase();
    if ((k === "k") && (e.ctrlKey || e.metaKey) && !e.altKey) {
      e.preventDefault(); e.stopPropagation();
      window.dragonOpenCommandPalette();
    }
  }, true);
  // ---------- boot (idempotent, retrying) ----------
  var booted = false, tries = 0;
  ;function init() {
    injectCss();
    buildHomePage();
    // 🕘 Egon 26.09.2026 — buildHistoryPage() REMOVED: the old History page is deleted (Prompt Panel).
    sizeNavVar();
    markRows();
    installCpTools();
    watchAccountClose();
    decorateNav();
    if (!booted) {
      var hasNav = document.querySelector(".dragon-navbar");
      var hasMain = document.getElementById("mainColumnEl85394739");
      if (hasNav && hasMain) {
        booted = true;
        var url = (location.search || "") + (location.hash || "");
        var start = pageFromHash() || (url.indexOf("gallery") !== -1 ? "gallery" : (url.indexOf("likes") !== -1 ? "likes" : "home"));
        if (start === "chat") {
          // Egon 24.09.2026 (W-DOC167) — `#chat` opens the chat window over the home page; dragonSetPage is used
          // (not dragonGoPage) so the #chat in the address is PRESERVED instead of being rewritten to the root.
          try { window.dragonSetPage("home"); } catch (e) {}
          try { if (window.dragonChatOpen) window.dragonChatOpen(); } catch (e) {}
        } else window.dragonGoPage(start);
      }
      // Egon 24.09.2026 (W-DOC167) — a pasted/edited hash navigates live (the platform forwards the top page's
      // hashchange into this embed, and this listener is the page's end of it). Registered ONCE.
      if (!window.__dragonHashRoute) {
        window.__dragonHashRoute = true;
        try { window.addEventListener("hashchange", function () { try { openFromHash(); } catch (e) {} }); } catch (e) {}
      }
    }
  }
  ;function loop() {
    tries++;
    try { init(); } catch (e) { try { console.warn("dragonPages init", e); } catch (e2) {} }
    if (booted && document.querySelector(".dragon-cp-tools-row")) { clearInterval(window.__dragonPagesTimer); window.__dragonPagesTimer = null; }
    if (tries > 120 && window.__dragonPagesTimer) { clearInterval(window.__dragonPagesTimer); window.__dragonPagesTimer = null; }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(loop, 400); });
  else setTimeout(loop, 400);
  window.__dragonPagesTimer = setInterval(loop, 600);

  // ---------- 📝 Egon 26.09.2026 (W-UI329 rev.2 / WP-UI002) — 📝 PROMPT PANEL + 🖼️ INLINE IMAGE HISTORY ----
  // Egon (aynen): "bu History bar değil de; Prompt Panel olsun bar'ın adı. ve ⚗️ Test Multiple Styles
  // 🧪 Prompt Tag Lab bunları da içine koy. ... control panelde prompt bank butonu ve tıklandığında açılan
  // bir sayfa var bunu yeni history bara koy ve sayfasını yeni sistemimize entegre et. Prompt bank butonu,
  // diğer butonların ortasında dursun. ... prompt banka kaydedilen son kayıt
  // en üstte görünsün. ... Bu Prompt bar için başka renk ayarla. cp ile aynı renk olmasın. ... conrol panel
  // gibi gradientli ama gri olsun. üzerinde '{a|b}' ifadeleri bulunan sembol yap kendin bizim yuvarlak
  // butonlarımıza benzesin ama Prompt Panel'de sembol olarak kullanacağımız için uygun ölçekte olsun."
  //
  // WHAT THIS IS
  //  (1) ONE accordion called 📝 PROMPT PANEL, built and placed exactly like the Control Panel button
  //      (same shape, same downward opening, DIRECTLY UNDER it) but painted GREY instead of blue, wearing
  //      a self-made {a|b} badge as its symbol. The element id stays #dragonHistoryPanel so nothing else
  //      has to move; only the visible name/style/symbol changed.
  //  (2) Its tab strip holds EVERY prompt tool in ONE place, in Egon's order:
  //        🏦 Prompt Bank · 📝 Prompt History · 🧪 Prompt Tag Lab · 📝 Presets
  //      Test Multiple Styles / Tag Lab / Presets render INLINE
  //      into the same dropdown body (modalShell's inline mode), so their old standalone buttons (under the
  //      Art Style dropdown, and in the Control Panel) are gone — hence no button crowding.
  //  (3) Image History is NOT in there: it stays under the 📷 placeholder box, OPEN by default, painting
  //      the same tiles in the size the Control Panel's Display setting asks for, with NO black strip or
  //      captions under the pictures — and its 🧹 Clear all button moved to the FAR RIGHT of its own
  //      dropdown head row, visible only while the panel is open.
  window.dragonRenderHistoryRecent = dragonHistRenderCards;

  // ⚗️ "Test Multiple Styles" left this panel on 27.09.2026 (W-FEAT313): the tester is a button in the
  // Art Style panel now — four tabs remain.
  var DRAGON_HIST_TABS = [
    ["bank", "\uD83C\uDFE6 Prompt Bank"],
    ["mine", "\uD83D\uDCDD Prompt History"],
    ["taglab", "\uD83E\uDDEA Prompt Tag Lab"],
    ["presets", "\uD83D\uDCDD Prompt Presets"]
  ];
  var _dragonHistTab = "mine";
  var _dragonImgHistOpen = true;   // Egon: "buton default açık olsun"
  var _dragonImgHistTick = 0;
  var _dragonHistBody = null;      // the .dragon-hw-body of the open tab (so tools can repaint it)

  // ---------------------------------------------------------------- 📝 PROMPT HISTORY
  ;function renderMyPromptHistory(body) {
    var merged = (window.dragonHistGetMerged && window.dragonHistGetMerged()) || [];
    // Egon 29.10.2026 (gercek silme) — no cutoff hiding anymore: Clear All really deletes.
    var seen = {}, out = [];
    for (var i = 0; i < merged.length; i++) {
      var en = merged[i] || {};
      var p = String(en.p || "").trim();
      if (!p) continue;
      var k = p.toLowerCase();
      if (seen[k]) continue;
      seen[k] = 1; out.push(en);
    }
    if (!out.length) {
      var em = histEl("div", "dragon-hist-empty");
      em.textContent = "You haven't generated anything yet \u2014 the prompts you use will appear here.";
      body.appendChild(em); return;
    }
    // Egon 29.10.2026 (gercek silme) \u2014 Clear All really deletes (their image records go too; Undo brings them back).
    var clrBar = histEl("div");
    clrBar.style.cssText = "display:flex; justify-content:center; margin-bottom:.5rem;";
    var clrAll = histBtn("\uD83E\uDDF9 Clear All", "Delete ALL prompts in history for real (their image records go too \u2014 you get an Undo)", function () { try { if (window.dragonHistClearPrompts) window.dragonHistClearPrompts(); } catch (e) {} }, "font-size:.72rem; font-weight:700; padding:.4rem .9rem; border:1px solid #a03030; background:linear-gradient(145deg,#5a2a2a,#1c1010); color:#f0b0b0; border-radius:8px; cursor:pointer;");
    clrBar.appendChild(clrAll);
    body.appendChild(clrBar);
    var list = histEl("div", "dragon-hist-list");
    body.appendChild(list);
    for (var j = 0; j < out.length; j++) list.appendChild(_histPromptRow(out[j]));
  }
  window.dragonRenderMyPromptHistory = renderMyPromptHistory;

  // ---------------------------------------------------------------- 🏦 PROMPT BANK (the REAL one, inline)
  // Egon 26.09.2026 — "control panelde prompt bank butonu ve tıklandığında açılan bir sayfa var bunu yeni
  // history bara koy ve sayfasını yeni sistemimize entegre et. ... şuan mevcut olan prompt banktaki
  // butonlar ve isim, prompt alanları vs bu kez history barındaki dropdown panelin üst kısmında olsun.
  // prompt banka kaydedilen son kayıt en üstte görünsün."
  // This is the Control Panel bank WINDOW's content, rebuilt INLINE: the save row / manual-paste row /
  // export-import-clear row form the TOP of the panel body, and the saved list below it shows the NEWEST
  // entry FIRST. It reads and writes the SAME storage key the rest of the site uses (dragonPromptBank,
  // name -> prompt) through the SAME helpers (window.dragonBankAdd), so the two views can never disagree.
  var DRAGON_BANK_LIMIT = 100;
  ;function dragonBankAutoNameLocal(bank) {
    var n = Object.keys(bank).length + 1;
    while (bank["Prompt" + n]) n++;
    return "Prompt" + n;
  }
  ;function renderBankTab(body) {
    var bank = {};
    try { bank = JSON.parse(localStorage.dragonPromptBank || "{}") || {}; } catch (e) { bank = {}; }
    var purpleBtn = "border:1px solid rgba(155,107,255,.55); background:linear-gradient(145deg,#3a3a44,#14141a); color:#d8c9ff; border-radius:8px; padding:.4rem .8rem; cursor:pointer; font-size:.78rem; font-weight:700;";
    var inputCss = "box-sizing:border-box; padding:.42rem .55rem; font-size:.82rem; border:1px solid #6f6f80; border-radius:8px; background:#0e0e13; color:#eee;";

    var wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; gap:.45rem; width:100%; max-width:1000px; margin:0 auto;";

    // ---- header (count) ----
    var head = document.createElement("div");
    head.style.cssText = "display:flex; align-items:center; justify-content:center; gap:.5rem; flex-wrap:wrap;";
    var title = document.createElement("span");
    title.textContent = "\uD83C\uDFE6 Prompt Bank";
    title.style.cssText = "font-weight:800; font-size:.9rem; color:#dededf;";
    var countBadge = document.createElement("span");
    countBadge.style.cssText = "color:#dededf; border:1px solid rgba(200,200,210,.5); border-radius:999px; padding:.05rem .55rem; font-size:.76rem;";
    head.append(title, countBadge);

    // ---- TOP SECTION 1: save the current description under a name ----
    var saveRow = document.createElement("div");
    saveRow.style.cssText = "display:flex; gap:.4rem; align-items:center; flex-wrap:wrap;";
    var nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = "\u270F\uFE0F name (optional)";
    nameInput.value = dragonBankAutoNameLocal(bank);
    nameInput.style.cssText = inputCss + " flex:1 1 12rem; font-weight:bold;";
    var saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.textContent = "\uD83D\uDCCC Save To Prompt Bank";
    saveBtn.title = "Save the CURRENT description panel as a bank prompt";
    saveBtn.style.cssText = purpleBtn;
    saveRow.append(nameInput, saveBtn);
    // Egon 29.10.2026 (A23 + A18) — Enter saves, and the name box names itself for screen readers.
    try { nameInput.setAttribute("aria-label", "Name for the saved prompt (optional)"); } catch (eNA) {}
    nameInput.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); try { saveBtn.click(); } catch (eC) {} } });

    // ---- TOP SECTION 2: paste any prompt straight into the bank ----
    var manualRow = document.createElement("div");
    manualRow.style.cssText = "display:flex; gap:.4rem; align-items:center; flex-wrap:wrap;";
    var manualTa = document.createElement("textarea");
    manualTa.placeholder = "paste any prompt here, then save \u2014 no need to touch the description field";
    manualTa.style.cssText = inputCss + " flex:1 1 16rem; min-height:3.6rem; resize:vertical;";
    var manualBtn = document.createElement("button");
    manualBtn.type = "button";
    manualBtn.textContent = "\uD83D\uDCCC Save Your Manual Prompt";
    manualBtn.title = "Save the pasted prompt above straight to the bank";
    manualBtn.style.cssText = purpleBtn;
    manualRow.append(manualTa, manualBtn);

    // ---- TOP SECTION 3: export / import / clear all ----
    var actRow = document.createElement("div");
    actRow.style.cssText = "display:flex; gap:.4rem; align-items:center; justify-content:center; flex-wrap:wrap;";
    var expBtn = document.createElement("button");
    expBtn.type = "button"; expBtn.textContent = "\uD83D\uDCE4 Export"; expBtn.title = "Export every saved prompt as a .txt file";
    expBtn.style.cssText = purpleBtn;
    expBtn.onclick = function (e) { e.stopPropagation(); if (window.dragonBankExportNow) window.dragonBankExportNow(); };
    var impBtn = document.createElement("button");
    impBtn.type = "button"; impBtn.textContent = "\uD83D\uDCE5 Import"; impBtn.title = "Import prompts from an exported .txt file";
    impBtn.style.cssText = purpleBtn;
    impBtn.onclick = function (e) {
      e.stopPropagation();
      var fi = document.createElement("input");
      fi.type = "file"; fi.accept = ".txt,text/plain"; fi.style.display = "none";
      document.body.appendChild(fi);
      fi.onchange = function () { if (fi.files && fi[0]) { if (window.dragonBankImportNow) window.dragonBankImportNow(fi.files[0]); } fi.remove(); };
      fi.click();
    };
    var clearBtn = document.createElement("button");
    clearBtn.type = "button"; clearBtn.textContent = "\uD83D\uDDD1\uFE0F Clear All";
    clearBtn.title = "Delete every saved prompt";
    clearBtn.style.cssText = "border:1px solid #a03030; background:linear-gradient(145deg,#5a2a2a,#1c1010); color:#f0b0b0; border-radius:8px; padding:.4rem .8rem; cursor:pointer; font-size:.78rem; font-weight:700;";
    actRow.append(expBtn, impBtn, clearBtn);

    var top = document.createElement("div");
    top.style.cssText = "display:flex; flex-direction:column; gap:.35rem; width:100%; padding:.55rem .6rem; box-sizing:border-box; border:1px solid rgba(200,200,210,.28); border-radius:10px; background:rgba(0,0,0,.22);";
    top.append(head, saveRow, manualRow, actRow);

    var hint = document.createElement("div");
    hint.textContent = "\uD83D\uDCA1 Click a name to rename it \u00b7 newest saved prompt first";
    hint.style.cssText = "color:#8f8f9c; font-size:.72rem; text-align:center;";

    // ---- the list ----
    var list = document.createElement("div");
    list.style.cssText = "display:flex; flex-direction:column; gap:.35rem; width:100%;";
    var count = document.createElement("div");
    count.style.cssText = "font-size:.72rem; font-weight:800; color:#b9b9c6; text-align:center; letter-spacing:.04em;";

    wrap.append(top, hint, count, list);
    body.appendChild(wrap);

    ;function draw() {
      var bankNow = {};
      try { bankNow = JSON.parse(localStorage.dragonPromptBank || "{}") || {}; } catch (e) { bankNow = {}; }
      // NEWEST FIRST: object key order is insertion order, so reverse it.
      var names = Object.keys(bankNow).reverse();
      countBadge.textContent = Object.keys(bankNow).length + "/" + DRAGON_BANK_LIMIT;
      count.textContent = names.length ? ("SAVED PROMPTS \u00b7 " + names.length) : "";
      nameInput.value = dragonBankAutoNameLocal(bankNow);
      list.innerHTML = "";
      if (!names.length) {
        var em = histEl("div", "dragon-hist-empty");
        em.textContent = "Your prompt bank is empty \u2014 save a prompt above and it will appear here (newest first).";
        list.appendChild(em);
        return;
      }
      names.forEach(function (nm) {
        var txt = String(bankNow[nm] || "");
        var row = histEl("div", "dragon-hw-bankrow");
        var nEl = histEl("span", "dragon-hw-bankname"); nEl.textContent = nm; nEl.title = "Click to rename";
        nEl.addEventListener("click", function () {
          var inp = document.createElement("input");
          inp.type = "text"; inp.value = nm;
          inp.style.cssText = inputCss + " width:8rem; font-weight:bold;";
          nEl.replaceWith(inp); inp.focus(); inp.select();
          ;function commit() {
            if (!inp.isConnected) return;
            var nn = String(inp.value || "").trim();
            if (nn && nn !== nm) {
              if (window.dragonBankRenameNow) window.dragonBankRenameNow(nm, nn);
              draw();
              return;
            }
            draw();
          }
          inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); commit(); } else if (e.key === "Escape") { draw(); } });
          inp.addEventListener("blur", commit);
        });
        var pEl = histEl("span", "dragon-hw-bankp"); pEl.textContent = txt; pEl.title = txt;
        var loadB = document.createElement("button"); loadB.type = "button"; loadB.textContent = "\uD83D\uDCDD Load";
        loadB.title = "Put this prompt in the description box";
        loadB.addEventListener("click", function () {
          var ta = document.querySelector('textarea[data-name="description"]');
          if (ta) { ta.value = txt; ta.dispatchEvent(new Event("input", { bubbles: true })); ta.focus(); }
          if (window.dragonToast) dragonToast("loaded \u201C" + nm + "\u201D");
        });
        var genB = document.createElement("button"); genB.type = "button"; genB.textContent = "\u2728";
        genB.title = "Load this prompt and generate";
        try { genB.setAttribute("aria-label", "Load this prompt and generate"); } catch (eGA) {}
        genB.addEventListener("click", function () {
          var ta = document.querySelector('textarea[data-name="description"]');
          if (ta) { ta.value = txt; ta.dispatchEvent(new Event("input", { bubbles: true })); }
          if (window.dragonAutoGenerate) window.dragonAutoGenerate();
          if (window.dragonToast) dragonToast("\u2728 generating \u201C" + nm + "\u201D");
        });
        var copyB = document.createElement("button"); copyB.type = "button"; copyB.textContent = "\uD83D\uDCCB";
        copyB.title = "Copy this prompt";
        try { copyB.setAttribute("aria-label", "Copy this prompt"); } catch (eCA) {}
        copyB.addEventListener("click", function () {
          try { if (navigator.clipboard) navigator.clipboard.writeText(txt); } catch (e) {}
          if (window.dragonToast) dragonToast("prompt copied");
        });
        var delB = document.createElement("button"); delB.type = "button"; delB.textContent = "\uD83D\uDDD1";
        delB.title = "Remove from the bank";
        try { delB.setAttribute("aria-label", "Remove from the bank"); } catch (eDA) {}
        delB.addEventListener("click", function () {
          try {
            var b2 = JSON.parse(localStorage.dragonPromptBank || "{}") || {};
            delete b2[nm];
            localStorage.dragonPromptBank = JSON.stringify(b2);
          } catch (e) {}
          if (window.dragonToast) dragonToast("removed \u201C" + nm + "\u201D from bank");
          draw();
        });
        row.append(nEl, pEl, loadB, genB, copyB, delB);
        list.appendChild(row);
      });
    }
    saveBtn.onclick = function (e) {
      e.stopPropagation();
      var ta = document.querySelector('textarea[data-name="description"]');
      var v = ta ? String(ta.value || "").trim() : "";
      if (!v) { if (window.dragonToast) dragonToast("description is empty"); return; }
      var n = String(nameInput.value || "").trim();
      var bankNow = {}; try { bankNow = JSON.parse(localStorage.dragonPromptBank || "{}") || {}; } catch (er) { bankNow = {}; }
      if (!n) n = dragonBankAutoNameLocal(bankNow);
      if (window.dragonBankAdd ? window.dragonBankAdd(n, v) : false) draw();
      else if (!window.dragonBankAdd) {
        bankNow[n] = v;
        try { localStorage.dragonPromptBank = JSON.stringify(bankNow); } catch (er) {}
        if (window.dragonToast) dragonToast("saved \u201C" + n + "\u201D to bank");
        draw();
      }
    };
    manualBtn.onclick = function (e) {
      e.stopPropagation();
      var v = String(manualTa.value || "").trim();
      if (!v) { if (window.dragonToast) dragonToast("paste a prompt first"); return; }
      var n = String(nameInput.value || "").trim();
      var bankNow = {}; try { bankNow = JSON.parse(localStorage.dragonPromptBank || "{}") || {}; } catch (er) { bankNow = {}; }
      if (!n) n = dragonBankAutoNameLocal(bankNow);
      if (window.dragonBankAdd ? window.dragonBankAdd(n, v) : false) { manualTa.value = ""; draw(); }
    };
    clearBtn.onclick = function (e) {
      e.stopPropagation();
      if (window.dragonBankClearAllNow) window.dragonBankClearAllNow();
      else if (window.dragonBankClearAll) window.dragonBankClearAll();
      setTimeout(draw, 400);
    };
    draw();
    // Egon 29.10.2026 (A23) — the name box takes focus when the bank tab opens, so typing starts at once.
    setTimeout(function () { try { nameInput.focus({ preventScroll: true }); } catch (eF) { try { nameInput.focus(); } catch (eF2) {} } }, 120);
    // The old bank WINDOW refreshes itself through window.__dragonBankRefresh; while this tab is the
    // visible bank, that hook points here too so both can never show different data.
    window.__dragonBankPanelRefresh = draw;
  }
  window.dragonRenderBankTab = renderBankTab;

  // ---------------------------------------------------------------- 📝 PRESETS (the SAME widget, moved)
  ;function renderPresetsTab(body) {
    if (!window.dragonGetPresetPanel) {
      var em = histEl("div", "dragon-hist-empty");
      em.textContent = "Presets aren't ready yet \u2014 open the Control Panel once and try again.";
      body.appendChild(em); return;
    }
    var panel = window.dragonGetPresetPanel();
    if (!panel) return;
    // the widget is MOVED here (same node the Control Panel builds) — never copied, so the two can't drift
    body.appendChild(panel);
    panel.style.display = "flex";
    panel.style.alignItems = "stretch";
    // 27.09.2026 (Egon): the panel this button opens wears the BLACK ground of the other panel bodies
    // (it used to sit in the Control Panel's translucent blue-tinted box).
    try {
      panel.style.setProperty("background", "linear-gradient(180deg,#15151d,#0e0e13)", "important");
      panel.style.setProperty("border-color", "rgba(155,107,255,.3)", "important");
    } catch (e) {}
    if (window.dragonRenderPresets) { try { window.dragonRenderPresets(); } catch (e) {} }
  }

  // ---------------------------------------------------------------- ⚗️ / 🧪 the two generation tools, inline
  ;function renderInlineTool(body, which) {
    if (which === "styles") {
      if (window.dragonStyleTester) { try { window.dragonStyleTester(body); return; } catch (e) {} }
      var em = histEl("div", "dragon-hist-empty");
      em.textContent = "\u2697\uFE0F The style tester isn't ready yet \u2014 try again in a second.";
      body.appendChild(em); return;
    }
    if (window.dragonTagLab) { try { window.dragonTagLab(body); return; } catch (e) {} }
    var em2 = histEl("div", "dragon-hist-empty");
    em2.textContent = "\uD83E\uDDEA The tag lab isn't ready yet \u2014 try again in a second.";
    body.appendChild(em2);
  }

  // ---------------------------------------------------------------- the {a|b} symbol
  ;function dragonHistPromptIcon() {
    // 🎛️ The Prompt Panel's OWN symbol: a small rounded button-badge carrying "{a|b}", cut from the same
    // cloth as our mini round symbol buttons (soft grey gradient, thin light border, inner top highlight)
    // but scaled to a 28x20 glyph so it reads as a SYMBOL in the panel head rather than as a button.
    var s = document.createElement("span");
    s.setAttribute("aria-hidden", "true");
    s.className = "dragon-pp-symbol";
    s.textContent = "{a|b}";
    s.style.cssText = "display:inline-flex; align-items:center; justify-content:center; flex:0 0 auto; width:28px; height:16px; border-radius:8px; font-size:8.5px; font-weight:800; letter-spacing:-.4px; font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; line-height:1; background:linear-gradient(180deg,#55555f,#2c2c34); border:1px solid #9a9aa8; color:#f4f4f8; text-shadow:0 1px 1px rgba(0,0,0,.75); box-shadow:inset 0 1px 0 rgba(255,255,255,.15), 0 1px 2px rgba(0,0,0,.5);";
    return s;
  }

  ;function dragonHistCss() {
    if (document.getElementById("dragonHistPanelCss")) return;
    var s = document.createElement("style");
    s.id = "dragonHistPanelCss";
    s.textContent =
      // 📝 the PROMPT PANEL accordion — the Control Panel's twin in shape, GREY in colour (the blue
      // !important rules in index.html are scoped to .dragon-control-* only, so nothing has to fight).
      "#dragonHistoryPanel{width:100%; margin-top:2px;}" +
      "#dragonHistoryPanel .dragon-history-body{display:none; flex-direction:column; gap:.2rem; width:100%; margin-top:2px;}" +
      ".dragon-hw-tabs{display:flex; gap:.4rem; flex-wrap:wrap; justify-content:center; padding:.1rem 0 .2rem;}" +
      ".dragon-hw-tab{display:flex; align-items:center; gap:.35rem; flex:0 0 auto; white-space:nowrap; font-size:.76rem; font-weight:700; padding:.32rem .6rem; border-radius:10px; cursor:pointer; border:1px solid #54545f; background:linear-gradient(160deg,#22222a,#121216); color:#e2e2e8;}" +
      ".dragon-hw-tab:hover{border-color:#9a9aa8;}" +
      ".dragon-hw-tab.on{border-color:#c8c8d4; color:#fff; background:linear-gradient(180deg,#5a5a66,#35353d); box-shadow:0 0 10px rgba(200,200,214,.28);}" +
      ".dragon-hw-body{max-height:58vh; overflow-y:auto; overflow-x:hidden; padding:.35rem .25rem .2rem 0;}" +
      ".dragon-hw-body .dragon-hist-list{max-width:1000px; margin:0 auto; display:flex; flex-direction:column; gap:.45rem;}" +
      ".dragon-hw-body .dragon-hist-empty{color:#aaa; font-size:.82rem; text-align:center; padding:1.5rem;}" +
      // 🏦 the inline prompt-bank rows (name · prompt · load · generate · copy · delete)
      ".dragon-hw-bankrow{display:flex; align-items:center; gap:.4rem; border:1px solid #4a4a5e; border-radius:9px; background:#0e0e13; padding:.4rem .5rem;}" +
      ".dragon-hw-bankname{flex:0 0 26%; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#dededf; font-weight:700; font-size:.78rem; text-align:left; cursor:pointer;}" +
      ".dragon-hw-bankp{flex:1 1 auto; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#b9b9c6; font-size:.74rem; text-align:left;}" +
      ".dragon-hw-bankrow button{flex:0 0 auto; font-size:.7rem; font-weight:700; padding:.24rem .45rem; border-radius:8px; cursor:pointer; border:1px solid #54545f; background:linear-gradient(160deg,#22222a,#121216); color:#e2e2e8;}" +
      ".dragon-hw-bankrow button:hover{border-color:#9a9aa8;}" +
      // 🖼️ Image History — head row (button + 🧹 Clear all) then the tiles at a fixed medium size.
      // The head button now wears the Control Panel's own geometry (Egon 27.09.2026) and 🧹 Clear all is
      // OVERLAID on that button's right end instead of standing beside it (visible only while open).
      "#dragonImageHistHead{position:relative; display:block; width:100%; max-width:1000px; margin:.5rem auto 0;}" +
      "#dragonImageHistHead[hidden]{display:none !important;}" +
      "#dragonImageHistBtn{position:relative; width:100%; box-sizing:border-box; display:flex; align-items:center; justify-content:center; gap:.45rem; min-height:30px; line-height:1; margin:0; font-size:.85rem; font-weight:bold; padding:.35rem .4rem; border-radius:8px; cursor:pointer; border:1px solid var(--dt-border,#5a5a6f); background:linear-gradient(160deg,var(--dt-panel1,#16161d),var(--dt-bg,#0d0d11)); color:var(--dt-fg,#eee);}" +
      

      "#dragonImageHistBtn{border-color:#a03d52;background:linear-gradient(160deg,#2b0f18,#571c2a);color:#ffdfe6;}" +
      "#dragonImageHistHead{margin-bottom:0;}" +
      "#dragonImageHistInline{margin-top:0;}" +
      "#dragonImageHistInline .dragon-hist-day{grid-column:1/-1;width:100%;box-sizing:border-box;margin:.45rem 0 -.55rem;padding:.32rem .5rem;font-size:.72rem;font-weight:800;letter-spacing:.06em;color:#dcf7f0;border:1px solid #3f8a7d;border-radius:8px;background:linear-gradient(160deg,#123034,#1a3f43);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:.45rem;text-transform:none;}" +
      // the black ground runs under EVERY tile (including a long wall of them), never stopping at the first row
      // Egon 27.09.2026 (WP-UI005) — THE PANEL NOW OWNS ITS HEIGHT: the pictures live inside this box and it
      // scrolls ITSELF (exactly like the Prompt Panel's body), so the page can never become a 50 000px wall.
      "#dragonImageHistInline{width:100%; max-width:1000px; margin:0 auto .2rem; box-sizing:border-box; padding:0 .6rem .55rem; border:1px solid rgba(155,107,255,.28); border-radius:14px; background:linear-gradient(180deg,#15151d,#0e0e13); max-height:min(80vh,52rem); overflow-y:auto; overflow-x:hidden;}" +
      "#dragonImageHistInline[hidden]{display:none !important;}" +
      "#dragonImageHistInline .dragon-hist-grid{display:grid; grid-template-columns:repeat(auto-fill,minmax(min(var(--dragon-ih-tile,300px),100%),1fr)); gap:.55rem; align-items:start;}" +
      "#dragonImageHistInline .dragon-hist-card{position:relative; display:flex; flex-direction:column; border:1px solid #33333d; border-radius:10px; overflow:hidden; background:transparent;}" +
      "#dragonImageHistInline .dragon-hist-shot{position:relative; display:block; overflow:hidden; background:#0d0d11;}" +
      // FULL, UNCROPPED picture (Egon 27.09.2026): object-fit:cover cut the sides off the picture; the image
      // is shown whole now, capped only so one very tall render cannot take over the whole panel.
      "#dragonImageHistInline .dragon-hist-card img{width:100%; height:auto; max-height:min(76vh,44rem); object-fit:contain; display:block; cursor:zoom-in; background:#0d0d11;}" +
      // A tile is its picture plus a TRANSPARENT action strip; the caption and the meta strip stay hidden
      // (prompt, seed and resolution are readable from the lightbox that opens on a click).
      "#dragonImageHistInline .dragon-hist-card .dragon-hist-cap{display:none !important;}" +
      "#dragonImageHistInline .dragon-hist-card .dragon-hist-meta{display:none !important;}" +
      // The action strip keeps EVERY per-image button except ⭐ (which moved ON the picture) and carries
      // 🗑️ Delete as its LEFTMOST item; each button is only as wide as it needs to be and the strip wraps.
      "#dragonImageHistInline .dragon-hist-card .dragon-hist-acts{display:flex !important; flex-wrap:wrap; justify-content:center !important; gap:.28rem; padding:.32rem .4rem .42rem; background:transparent;}" +
      "#dragonImageHistInline .dragon-hist-card .dragon-hist-acts button{flex:0 0 auto; width:2.15rem; height:2.15rem; min-width:0; padding:0; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-size:.98rem; font-weight:700; line-height:1; cursor:pointer; white-space:nowrap; border:1px solid #6a6a78; background:linear-gradient(145deg,#24242d,#131318); color:#ccc;}" +
      "#dragonImageHistInline .dragon-hist-card .dragon-hist-acts button:hover{border-color:#9a9aa8; color:#fff;}" +
      "#dragonImageHistInline .dragon-hist-card .dragon-hist-acts button.dragon-hist-del{border-color:#c81e2e; background:linear-gradient(145deg,#3a1418,#170708); color:#ff9aa3;}" +
      "@media (max-width:560px){#dragonImageHistInline .dragon-hist-card .dragon-hist-acts button{width:1.85rem; height:1.85rem; font-size:.86rem;}}" +
      "#dragonImageHistInline .dragon-hist-card{container-type:inline-size;}" +
      "#dragonImageHistInline .dragon-hist-card .dragon-hist-acts button{width:clamp(1.4rem,19cqw,2.6rem);height:clamp(1.4rem,19cqw,2.6rem);font-size:clamp(.7rem,8.5cqw,1.15rem);}" +
      "#dragonImageHistInline .dragon-hist-card .dragon-imgov-btn{width:clamp(1.4rem,19cqw,2.6rem);height:clamp(1.4rem,19cqw,2.6rem);font-size:clamp(.7rem,8.5cqw,1.15rem);}" +
      "#dragonImageHistInline .dragon-hist-card .dragon-imgov-btn.is-br2{bottom:calc(6px + clamp(1.4rem,19cqw,2.6rem) + 6px);}" +
      "" +
      // One heading per calendar day groups the tiles; it carries the date the removed per-tile date text showed.
      "#dragonImageHistInline .dragon-hist-day{grid-column:1/-1; margin:.45rem 0 -.55rem; padding-bottom:.2rem; font-size:.72rem; font-weight:800; letter-spacing:.06em; text-transform:uppercase; color:#b9b9c6; border-bottom:1px solid rgba(140,140,152,.25); text-align:left;}" +
      "#dragonImageHistInline button.dragon-hist-day{position:static;width:100%;box-sizing:border-box;margin:.45rem 0 -.55rem;padding:.28rem .5rem;font-size:.72rem;font-weight:800;letter-spacing:.06em;text-transform:none;text-align:center;color:#e9e9f0;border:1px solid #6a6a78;border-radius:8px;background:linear-gradient(160deg,#2b2b33,#17171c);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:.45rem;flex-wrap:nowrap;white-space:nowrap;}" +
      "#dragonImageHistInline .dragon-hist-dayarrow{flex:0 0 auto;font-size:.8rem;line-height:1;}#dragonImageHistInline .dragon-hist-grid > .dragon-hist-day:first-child{margin-top:0;}" +
      "#dragonImageHistInline .dragon-hist-empty{color:#aaa; font-size:.82rem; text-align:center; padding:1.2rem;}" +
      // The Control Panel's tools row once carried the old History shortcut; the Prompt Panel has its own
      // head right above it, so the duplicate is hidden.
      ".dragon-cp-tools-row [data-tool='history']{display:none !important;}" +
      // 🧪 / ⚗️ the INLINE tool shells (modalShell's inline mode) must fill the panel body width
      ".dragon-hw-body .dragon-inline-shell{width:100%;}" +
      ".dragon-hw-body .dragon-tester-modal, .dragon-hw-body .dragon-taglab-modal{width:100%;}";
    document.head.appendChild(s);
  }
  ;function dragonHistPanelEnsure() {
    dragonHistCss();
    if (!document.body) return null;
    var panel = document.getElementById("dragonHistoryPanel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "dragonHistoryPanel";
      var head = document.createElement("button");
      head.type = "button";
      var lb = document.createElement("span");
      lb.textContent = "Prompt Panel";
      var ar1 = document.createElement("span"), ar2 = document.createElement("span");
      ar1.textContent = "\u25BE"; ar2.textContent = "\u25BE";
      ar1.style.cssText = ar2.style.cssText = "font-size:1.1rem; line-height:1;";
      var body = document.createElement("div");
      body.className = "dragon-history-body";
      body.style.display = "none";   // the inline value is the source of truth for the head's toggle
      var tabs = document.createElement("div");
      tabs.className = "dragon-hw-tabs";
      var list = document.createElement("div");
      list.className = "dragon-hw-body";
      body.append(tabs, list);
      head.append(dragonHistPromptIcon(), ar1, lb, ar2, dragonHistPromptIcon());
      head.onclick = function () { dragonHistPanelToggle(body.style.display === "none"); };
      panel.__head = head;
      panel.__arrows = [ar1, ar2];
      panel.append(head, body);
    }
    // The panel sits DIRECTLY under the Control Panel button; until that exists it simply waits (it is
    // never dumped onto the raw body, so a broken framework render cannot leave a stray panel at the bottom).
    var cp = document.querySelector(".dragon-control-panel");
    if (cp && cp.parentElement && panel.previousElementSibling !== cp) {
      cp.parentElement.insertBefore(panel, cp.nextSibling);
    }
    return panel;
  }
  ;function dragonHistPanelIsOpen() {
    var panel = document.getElementById("dragonHistoryPanel");
    if (!panel) return false;
    var body = panel.querySelector(".dragon-history-body");
    return !!body && body.style.display !== "none";
  }
  ;function dragonHistPanelOpen(mode) {
    var panel = dragonHistPanelEnsure();
    if (!panel) return false;
    var body = panel.querySelector(".dragon-history-body");
    body.style.display = "flex";
    var ars = panel.__arrows || [];
    for (var i = 0; i < ars.length; i++) ars[i].textContent = "\u25B4";
    try { panel.__head.setAttribute("aria-expanded", "true"); } catch (e) {}
    dragonHistPanelRender(mode || _dragonHistTab);
    try { if (window.dragonSyncOpenCards) window.dragonSyncOpenCards(); } catch (eS) {}
    return true;
  }
  ;function dragonHistPanelClose() {
    var panel = document.getElementById("dragonHistoryPanel");
    if (!panel) return false;
    var body = panel.querySelector(".dragon-history-body");
    if (body) body.style.display = "none";
    var ars = panel.__arrows || [];
    for (var i = 0; i < ars.length; i++) ars[i].textContent = "\u25BE";
    try { panel.__head.setAttribute("aria-expanded", "false"); } catch (e) {}
    // leaving the panel also drops the inline tools (the tester / tag lab) so nothing keeps running hidden
    dragonHistPanelRender(_dragonHistTab);
    try { if (window.dragonSyncOpenCards) window.dragonSyncOpenCards(); } catch (eS) {}
    return true;
  }
  ;function dragonHistPanelToggle(open) {
    if (open === true) return dragonHistPanelOpen();
    return dragonHistPanelClose();
  }
  ;function dragonHistPanelRender(mode) {
    var panel = dragonHistPanelEnsure();
    if (!panel) return false;
    if (typeof mode === "string" && mode) _dragonHistTab = mode;
    var known = false;
    for (var i = 0; i < DRAGON_HIST_TABS.length; i++) if (DRAGON_HIST_TABS[i][0] === _dragonHistTab) known = true;
    if (!known) _dragonHistTab = "mine";
    var tabs = panel.querySelector(".dragon-hw-tabs");
    var body = panel.querySelector(".dragon-hw-body");
    if (!tabs || !body) return false;
    _dragonHistBody = body;
    tabs.innerHTML = ""; body.innerHTML = "";
    DRAGON_HIST_TABS.forEach(function (t) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "dragon-hw-tab" + (t[0] === _dragonHistTab ? " on" : "");
      b.textContent = t[1];
      b.addEventListener("click", function () { dragonHistPanelRender(t[0]); });
      tabs.appendChild(b);
    });
    if (_dragonHistTab === "bank") renderBankTab(body);
    else if (_dragonHistTab === "mine") renderMyPromptHistory(body);
    else if (_dragonHistTab === "presets") renderPresetsTab(body);
    else renderInlineTool(body, _dragonHistTab);
    return true;
  }
  // The old public seams keep working; they simply lead into the Prompt Panel now.
  window.dragonOpenHistWindow = dragonHistPanelOpen;
  window.dragonCloseHistWin = dragonHistPanelClose;
  window.dragonHistoryPanelOpen = dragonHistPanelOpen;
  window.dragonHistoryPanelRender = dragonHistPanelRender;
  window.dragonPromptPanelOpen = dragonHistPanelOpen;
  window.dragonPromptPanelOpenTab = dragonOpenPromptPanelTab;
  // The Prompt Bank's own page IS the panel's 🏦 tab now. Every old caller (Ctrl+B, the command palette,
  // the gallery lightbox gear) goes through window.dragonBank, so that seam is re-pointed at the tab; the
  // old modal remains only as a fallback where the panel cannot exist (no Control Panel on the page).
  var _dragonBankModal = window.dragonBank;
  window.dragonBank = function () {
    try { if (document.querySelector(".dragon-control-panel")) return dragonOpenPromptPanelTab("bank"); } catch (e) {}
    return _dragonBankModal ? _dragonBankModal.apply(this, arguments) : null;
  };

  // ---------------- 🖼️ INLINE IMAGE HISTORY (under the placeholder box) ----------------
  // Tile size follows the history toolbar's OWN Size setting (key `dragonHistSize`), never the
  // Control Panel's Display — the same option values (Micro..Full Screen), default Small (180px).
  ;function dragonHistSizeGet() {
    try {
      var v = localStorage.getItem("dragonHistSize");
      if (v === "90" || v === "120" || v === "180" ||
          v === "300" || v === "450") return v;
    } catch (e) {}
    return "180";
  }
  ;function dragonImgHistTile() {
    var v = dragonHistSizeGet();
    return v === "100%" ? "100%" : (v + "px");
  }
;function dragonImgHistApplyTile() {
    var box = document.getElementById("dragonImageHistInline");
    if (!box) return;
    var ihT = dragonImgHistTile();
    if (box.__dragonTile === ihT) return;
    box.__dragonTile = ihT;
    box.style.setProperty("--dragon-ih-tile", ihT);
  }
  // ---------------- 🖼️ IMAGE HISTORY TOOLBAR (Egon 28.09.2026) ----------------
  // Fixed toolbar at the top of the Image History body (only the body scrolls): Clear All,
  // storage settings (full-size count + total count), Collapse/Expand Days, an INDEPENDENT
  // display-mode copy (the SAME menu rows as the galleries via window.dragonDisplayBuild, but
  // its own key `dragonHistDisplay` — gallery picks never touch it and vice versa) and a live
  // "X full · ~Y MB" usage line. Every visitor pick persists in localStorage.
  ;function dragonHistTbGet(key, fb) {
    try {
      var v = localStorage.getItem(key);
      if (v === "inf" || v === "200" || v === "400" || v === "600" || v === "800" || v === "1000" ||
          v === "2000" || v === "4000" || v === "6000" || v === "8000" || v === "10000") return v;
    } catch (e) {}
    return fb;
  }
  ;function dragonHistToolbarCss() {
    if (document.getElementById("dragonHistToolbarCss")) return;
    var st = document.createElement("style");
    st.id = "dragonHistToolbarCss";
    st.textContent = [
      ".dragon-hist-toolbar{position:sticky;top:0;z-index:30;display:flex;flex-wrap:nowrap;align-items:center;gap:.35rem;padding:.35rem .45rem;background:linear-gradient(180deg,#17171f,#101016);border:1px solid #3a3a48;border-radius:10px;margin-bottom:0;overflow-x:auto;}",
      ".dragon-hist-toolbar button,.dragon-hist-toolbar select{font-size:.85rem;font-weight:700;padding:.18rem .55rem;border-radius:7px;cursor:pointer;background:linear-gradient(180deg,#23232e,#14141a);color:#e8e4f5;border:1px solid #4a4a5c;white-space:nowrap;flex:0 0 auto;}",
      ".dragon-hist-toolbar label{flex:0 0 auto;white-space:nowrap;font-size:.85rem;font-weight:700;}",
      ".dragon-hist-toolbar{border-radius:0 0 10px 10px;}",
      ".dragon-hist-toolbar{scrollbar-width:none;}",
      ".dragon-hist-toolbar::-webkit-scrollbar{display:none;}",
      ".dragon-hist-toolbar select{padding:.14rem .3rem;max-width:6.2rem;}",
      "@media (max-width:640px){.dragon-hist-toolbar{flex-wrap:wrap !important;overflow-x:visible !important;}.dragon-hist-usage{margin-left:0 !important;}}",
      ".dragon-hist-clearall{border:1px solid #c81e2e !important;background:linear-gradient(145deg,#3a1418,#170708) !important;color:#ff9aa3 !important;}",
      ".dragon-hist-record-go{border:1px solid #4ade80 !important;background:linear-gradient(145deg,#14532d,#052e16) !important;color:#bbf7d0 !important;}",
      ".dragon-hist-usage{margin-left:auto;font-size:.85rem;font-weight:700;color:#b9b3d6;white-space:nowrap;flex:0 0 auto;}",
      ".dragon-hist-grid-display-masonry{display:block !important;column-gap:.55rem;}",
      ".dragon-hist-grid-display-masonry .dragon-hist-day{column-span:all;}",
      ".dragon-hist-grid-display-contain .dragon-hist-shot,.dragon-hist-grid-display-cover .dragon-hist-shot,.dragon-hist-grid-display-stretch .dragon-hist-shot{aspect-ratio:1/1;overflow:hidden;}",
      ".dragon-hist-grid-display-contain .dragon-hist-shot img{width:100% !important;height:100% !important;object-fit:contain !important;background:#0a0a0e;}",
      ".dragon-hist-grid-display-cover .dragon-hist-shot img{width:100% !important;height:100% !important;object-fit:cover !important;}",
      ".dragon-hist-grid-display-stretch .dragon-hist-shot img{width:100% !important;height:100% !important;object-fit:fill !important;}",
      ".dragon-hist-grid-display-original .dragon-hist-shot img{width:auto !important;max-width:100%;height:auto !important;}",
      ".dragon-hist-eng{position:relative;display:block !important;}",
      ".dragon-hist-eng .dragon-hist-sec{position:relative;width:100%;overflow:hidden;}",
      ".dragon-hist-eng .dragon-hist-sec .dragon-hist-day{width:100%;}",
      ".dragon-hist-eng .dragon-hist-card{position:absolute;margin:0 !important;}",
      ".dragon-hist-eng .dragon-hist-card .dragon-hist-cap,.dragon-hist-eng .dragon-hist-card .dragon-hist-meta,.dragon-hist-eng .dragon-hist-card .dragon-hist-acts{display:none !important;}",
      ".dragon-hist-eng .dragon-hist-card .dragon-hist-shot{height:100% !important;}",
      ".dragon-hist-eng .dragon-hist-card .dragon-hist-shot img{width:100% !important;height:100% !important;}",
      ".dragon-hist-eng-cover .dragon-hist-card .dragon-hist-shot img{object-fit:cover !important;}",
      "",
      ""
    ].join("\n");
    document.body.appendChild(st);
  }
  ;function dragonHistDispGet() {
    try {
      var v = localStorage.getItem("dragonHistDisplay");
      if (window.dragonDisplayIsMode && window.dragonDisplayIsMode(v)) return v;
    } catch (e) {}
    return "default";
  }
  ;function dragonHistDispPick(v) {
    try {
      if (!(window.dragonDisplayIsMode && window.dragonDisplayIsMode(v))) v = "default";
      localStorage.setItem("dragonHistDisplay", v);
      if (v === "mosaic") {
        try { localStorage.setItem("dragonHistMosaicSeed", String((Math.floor(Math.random() * 2147483646) + 1) || 1)); } catch (eS) {}
      }
    } catch (e) {}
    try { dragonHistDispApply(); } catch (eA) {}
    try { if (window.dragonToast) window.dragonToast("🖼️ history display: " + (window.dragonDisplayLabel ? window.dragonDisplayLabel(v) : v)); } catch (eT) {}
  }
  ;function dragonHistCardRatio(card) {
    try {
      var img = card.querySelector("img");
      if (img && img.naturalWidth > 0 && img.naturalHeight > 0) return img.naturalWidth / img.naturalHeight;
    } catch (e) {}
    try {
      var en = card.__dragonEn;
      if (en && en.res) {
        var m = String(en.res).match(/(\d+)\s*x\s*(\d+)/);
        if (m && (+m[2]) > 0) return (+m[1]) / (+m[2]);
      }
    } catch (e2) {}
    return 0.75;
  }
  ;function dragonHistDispUnwrap(box) {
    try {
      var grid = box.querySelector(".dragon-hist-grid");
      if (!grid) return;
      var secs = grid.querySelectorAll(".dragon-hist-sec");
      for (var i = 0; i < secs.length; i++) {
        (function (sec) {
          var par = sec.parentNode, kids = [];
          for (var k = 0; k < sec.children.length; k++) kids.push(sec.children[k]);
          for (var j = 0; j < kids.length; j++) {
            
            try { par.insertBefore(kids[j], sec); } catch (eI) {}
          }
          try { sec.remove(); } catch (eS) {}
        })(secs[i]);
      }
      var cards = grid.querySelectorAll(".dragon-hist-card");
      for (var c = 0; c < cards.length; c++) {
        try {
          cards[c].style.position = ""; cards[c].style.left = ""; cards[c].style.top = "";
          cards[c].style.width = ""; cards[c].style.height = "";
        } catch (eC) {}
      }
      try { grid.style.height = ""; grid.style.position = ""; } catch (eG) {}
    } catch (e) {}
  }
  ;function dragonHistDispTeardown(box) {
    try {
      dragonHistDispUnwrap(box);
      var grid = box.querySelector(".dragon-hist-grid");
      if (grid) {
        var cl = ["dragon-hist-eng", "dragon-hist-eng-cover",
          "dragon-hist-grid-display-masonry", "dragon-hist-grid-display-contain",
          "dragon-hist-grid-display-cover", "dragon-hist-grid-display-stretch",
          "dragon-hist-grid-display-original"];
        for (var i = 0; i < cl.length; i++) { try { grid.classList.remove(cl[i]); } catch (e) {} }
      }
      if (box.__dragonDispObs) { try { box.__dragonDispObs.disconnect(); } catch (eO) {} box.__dragonDispObs = null; }
      box.__dragonDispMode = "";
    } catch (e) {}
  }
  ;function dragonHistDispPack(box) {
    try {
      var grid = box.querySelector(".dragon-hist-grid");
      if (!grid || !window.dragonLayouts) return false;
      var mode = dragonHistDispGet();
      var ENG = { justified: 1, puzzle: 1, mosaic: 1, pinterest: 1, mixed: 1 };
      if (!ENG[mode]) return false;
      var W = grid.clientWidth;
      if (!(W > 50)) return false;
      dragonHistDispUnwrap(box);
      var L = window.dragonLayouts, gap = 8;
      try { var _sds = grid.querySelectorAll(".dragon-hist-sec-del"); for (var _sdi = 0; _sdi < _sds.length; _sdi++) _sds[_sdi].remove(); } catch (eSD) {}
      var seed = 0;
      try { seed = parseInt(localStorage.getItem("dragonHistMosaicSeed") || "0", 10) || 0; } catch (eS) {}
      var cols = W < 500 ? 2 : (W < 900 ? 3 : 4);
      var groups = [], cur = null;
      var kids = grid.children;
      for (var i = 0; i < kids.length; i++) {
        (function (el) {
          if (el.classList && el.classList.contains("dragon-hist-day")) { cur = { btn: el, cards: [] }; groups.push(cur); }
          else if (el.classList && el.classList.contains("dragon-hist-card") && cur) cur.cards.push(el);
        })(kids[i]);
      }
      for (var g = 0; g < groups.length; g++) (function (gr) {
        if (!gr.cards.length) return;
        var ratios = [];
        for (var k = 0; k < gr.cards.length; k++) ratios.push(dragonHistCardRatio(gr.cards[k]));
        var out = null;
        if (mode === "justified") out = L.rows(ratios, W, { gap: gap, target: 220 });
        else if (mode === "puzzle") out = L.rows(ratios, W, { gap: gap, target: 220, mirror: true });
        else if (mode === "mosaic") out = L.rows(ratios, W, { gap: gap, target: 220, seed: seed || 1 });
        else if (mode === "pinterest") out = L.pinterest(ratios, W, { gap: gap, cols: cols });
        else if (mode === "mixed") out = L.mixed(ratios, W, { gap: gap, cols: W < 700 ? 4 : 5 });
        if (!out || !out.rects) return;
        var sec = document.createElement("div");
        sec.className = "dragon-hist-sec";
        grid.insertBefore(sec, gr.btn);
        sec.appendChild(gr.btn);
        var byI = {};
        for (var q = 0; q < out.rects.length; q++) byI[out.rects[q].i] = out.rects[q];
        for (var c = 0; c < gr.cards.length; c++) (function (card, idx) {
          var r = byI[idx];
          if (!r) return;
          card.style.position = "absolute";
          card.style.left = r.x + "px";
          card.style.top = r.y + "px";
          card.style.width = Math.max(4, r.w) + "px";
          card.style.height = Math.max(4, r.h) + "px";
          sec.appendChild(card);
        })(gr.cards[c], c);
        var btnH = 0;
        try { btnH = gr.btn.offsetHeight || 40; } catch (eB) { btnH = 40; }
        for (var c2 = 0; c2 < gr.cards.length; c2++) {
          try {
            var cd = gr.cards[c2];
            cd.style.top = (btnH + parseFloat(cd.style.top || "0")) + "px";
          } catch (eT) {}
        }
        sec.__dragonH = Math.ceil(btnH + (out.height || 0));
        sec.style.height = sec.__dragonH + "px";
      })(groups[g]);
      grid.classList.add("dragon-hist-eng");
      if (mode === "mixed") grid.classList.add("dragon-hist-eng-cover");
      try { dragonHistDayApply(grid, dragonHistDayCollapsedGet()); } catch (eDA) {}
      try { box.__dragonPackQuiet = Date.now() + 600; } catch (eQ) {}
      return true;
    } catch (e) { return false; }
  }
  ;function dragonHistDispApply() {
    try {
      var box = document.getElementById("dragonImageHistInline");
      if (!box) return;
      var grid = box.querySelector(".dragon-hist-grid");
      var mode = dragonHistDispGet();
      dragonHistDispTeardown(box);
      if (!grid) return;
      box.__dragonDispMode = mode;
      if (mode === "masonry" || mode === "contain" || mode === "cover" || mode === "stretch" || mode === "original") {
        grid.classList.add("dragon-hist-grid-display-" + mode);
      } else if (mode === "justified" || mode === "puzzle" || mode === "mosaic" || mode === "pinterest" || mode === "mixed") {
        if (!dragonHistDispPack(box)) { box.__dragonDispMode = "default"; return; }
        if (!box.__dragonDispObs) {
          try {
            box.__dragonDispObs = new MutationObserver(function () {
              if (box.__dragonDispT) return;
              try { if (box.__dragonPackQuiet && Date.now() < box.__dragonPackQuiet) return; } catch (eQ) {}
              box.__dragonDispT = setTimeout(function () {
                box.__dragonDispT = 0;
                try { if (dragonHistDispGet() !== "default" && box.__dragonDispMode !== "default") dragonHistDispPack(box); } catch (e) {}
              }, 250);
            });
            box.__dragonDispObs.observe(grid, { childList: true, subtree: true });
          } catch (eO) {}
        }
        if (!box.__dragonDispResize) {
          box.__dragonDispResize = true;
          try {
            window.addEventListener("resize", function () {
              try { if (box.__dragonDispMode && box.__dragonDispMode !== "default") dragonHistDispPack(box); } catch (e) {}
            });
          } catch (eR) {}
        }
        if (!box.__dragonDispLoad) {
          box.__dragonDispLoad = true;
          try {
            grid.addEventListener("load", function (e) {
              try {
                if (e && e.target && e.target.tagName === "IMG" && box.__dragonDispMode && box.__dragonDispMode !== "default") {
                  if (box.__dragonDispT) return;
                  box.__dragonDispT = setTimeout(function () { box.__dragonDispT = 0; try { dragonHistDispPack(box); } catch (e2) {} }, 300);
                }
              } catch (e3) {}
            }, true);
          } catch (eL) {}
        }
      }
      try { if (box.__dragonTbSync) box.__dragonTbSync(); } catch (eS) {}
    } catch (e) {}
  }
  ;function dragonHistCollapseToggle() {
    try {
      var merged = (window.dragonHistGetMerged && window.dragonHistGetMerged()) || [];
      var m = dragonHistDayCollapsedGet();
      var keys = {};
      for (var i = 0; i < merged.length; i++) { try { keys[dragonHistDayKey(merged[i].t)] = true; } catch (eK) {} }
      var anyOpen = false, k;
      for (k in keys) { if (!m[k]) { anyOpen = true; break; } }
      for (k in keys) { if (anyOpen) m[k] = true; else delete m[k]; }
      dragonHistDayCollapsedSet(m);
      var box = document.getElementById("dragonImageHistInline");
      var grid = box ? box.querySelector(".dragon-hist-grid") : null;
      if (grid) { try { dragonHistDayApply(grid, m); } catch (eA) {} }
      try { if (box && box.__dragonTbSync) box.__dragonTbSync(); } catch (eS) {}
    } catch (e) {}
  }
  window.dragonHistCollapseToggle = dragonHistCollapseToggle;
  ;function dragonHistSizeOptions() {
    return [["90", "Tiny"], ["120", "Mini"], ["180", "Small"], ["300", "Medium"], ["450", "Big"]];
  }
  ;function dragonHistLimitOptions() {
    return [["200", "200"], ["400", "400"], ["600", "600"], ["800", "800"], ["1000", "1000"], ["inf", "No Limit"]];
  }
  ;function dragonHistTotalOptions() {
    return [["2000", "2000"], ["4000", "4000"], ["6000", "6000"], ["8000", "8000"], ["10000", "10000"], ["inf", "No Limit"]];
  }
  ;function dragonHistToolbarEnsure(box) {
    try {
      if (!box) return;
      dragonHistToolbarCss();
      var tb = box.__dragonTb;
      if (!tb || !tb.isConnected) {
        tb = document.createElement("div");
        tb.className = "dragon-hist-toolbar";
        var clr = document.createElement("button");
        clr.type = "button"; clr.className = "dragon-hist-clearall"; clr.textContent = "🧹Clear All";
        clr.title = "Delete ALL Image History permanently";
        clr.onclick = function () {
          try {
            var histClearGo = function () {
            if (window.dragonHistClearAll) window.dragonHistClearAll();
            try { dragonImgHistRender(true); } catch (eR) {}
            };
            if (window.dragonVaultConfirm) { window.dragonVaultConfirm({ title: "Clear All", body: "Delete ALL Image History permanently? This cannot be undone.", confirmText: "Clear All", danger: true }).then(function (res) { if (res.ok) histClearGo(); }); }
            else { if (!window.confirm("Delete ALL Image History permanently? This cannot be undone.")) return; histClearGo(); }
          } catch (e) {}
        };
        var fl = document.createElement("label");
        fl.textContent = "Full ";
        fl.title = "How many full-size images to keep";
        var fs = document.createElement("select");
        if (window.dragonStyleSelect) window.dragonStyleSelect(fs);
        dragonHistLimitOptions().forEach(function (o) {
          var op = document.createElement("option"); op.value = o[0]; op.textContent = o[1]; fs.appendChild(op);
        });
        fs.onchange = function () {
          try { localStorage.setItem("dragonHistFullKeep", fs.value); } catch (e) {}
          try { if (window.dragonHistApplyLimits) window.dragonHistApplyLimits(); } catch (e2) {}
          try { dragonImgHistRender(true); } catch (e3) {}
        };
        fl.appendChild(fs);
        var tl = document.createElement("label");
        tl.textContent = "Total ";
        tl.title = "How many history entries to keep";
        var ts = document.createElement("select");
        if (window.dragonStyleSelect) window.dragonStyleSelect(ts);
        dragonHistTotalOptions().forEach(function (o) {
          var op2 = document.createElement("option"); op2.value = o[0]; op2.textContent = o[1]; ts.appendChild(op2);
        });
        ts.onchange = function () {
          try { localStorage.setItem("dragonHistTotalKeep", ts.value); } catch (e) {}
          try { if (window.dragonHistApplyLimits) window.dragonHistApplyLimits(); } catch (e2) {}
          try { dragonImgHistRender(true); } catch (e3) {}
        };
        tl.appendChild(ts);
        var col = document.createElement("button");
        col.type = "button";
        col.title = "Collapse or expand all days";
        col.onclick = function () { try { dragonHistCollapseToggle(); } catch (e) {} };
        var use = document.createElement("span");
        use.className = "dragon-hist-usage";
        var sl = document.createElement("label");
        sl.textContent = "Size ";
        sl.title = "History tile size — this panel only";
        var ss = document.createElement("select");
        if (window.dragonStyleSelect) window.dragonStyleSelect(ss);
        dragonHistSizeOptions().forEach(function (o) {
          var op3 = document.createElement("option"); op3.value = o[0]; op3.textContent = o[1]; ss.appendChild(op3);
        });
        ss.onchange = function () {
          try { localStorage.setItem("dragonHistSize", ss.value); } catch (e) {}
          try { box.__dragonTile = ""; dragonImgHistApplyTile(); } catch (e2) {}
          try { dragonHistDispApply(); } catch (e3) {}
          try { if (box.__dragonTbSync) box.__dragonTbSync(); } catch (e4) {}
        };
        sl.appendChild(ss);
        var rec = document.createElement("button");
        rec.type = "button";
        rec.title = "Stop recording new images into Image History";
        rec.onclick = function () {
          try {
            var off = !(window.dragonHistRecordOff && window.dragonHistRecordOff());
            var recMsg = off ? "Stop recording? New generated images will NOT be saved into Image History until you start recording again." : "Start recording again? New generated images will be saved into Image History.";
            var recGo = function () {
            if (window.dragonHistRecordSet) window.dragonHistRecordSet(off);
            if (window.dragonToast) window.dragonToast(off ? "⏺️ history recording OFF — new images will not be saved" : "⏺️ history recording ON");
            try { if (box.__dragonTbSync) box.__dragonTbSync(); } catch (eS) {}
            };
            if (window.dragonVaultConfirm) { window.dragonVaultConfirm({ title: "Image History", body: recMsg, confirmText: off ? "Stop recording" : "Start recording" }).then(function (res) { if (res.ok) recGo(); }); }
            else { if (!window.confirm(recMsg)) return; recGo(); }
          } catch (e) {}
        };
        tb.appendChild(fl); tb.appendChild(tl); tb.appendChild(col);
        if (window.dragonDisplayBuild) {
          try {
            var dc = window.dragonDisplayBuild({ getMode: dragonHistDispGet, onPick: dragonHistDispPick });
            tb.appendChild(dc.wrap);
            tb.__dragonDispCtl = dc;
          } catch (eDC) {}
        }
        tb.appendChild(sl);
        tb.appendChild(use);
        tb.appendChild(rec);
        tb.appendChild(clr);
        box.__dragonTb = tb;
        box.__dragonTbRefs = { fs: fs, ts: ts, col: col, use: use, ss: ss, rec: rec };
        if (!box.__dragonTbTick && window.dragonTick) {
          box.__dragonTbTick = true;
          try {
            window.dragonTick(function () {
              try {
                if (!box.isConnected || box.hidden) return;
                if (window.dragonHistBackfillSizes) window.dragonHistBackfillSizes(8);
                var u = box.__dragonTbRefs && box.__dragonTbRefs.use;
                if (u && window.dragonHistStorageStats) {
                  var s = window.dragonHistStorageStats();
                  u.textContent = String(s.fulls) + " full · ~" + (s.mb >= 10 ? Math.round(s.mb) : (Math.round(s.mb * 10) / 10)) + " MB";
                }
              } catch (eT) {}
            }, 4000);
          } catch (eTT) {}
        }
        box.__dragonTbSync = function () {
          try {
            var r = box.__dragonTbRefs;
            if (!r) return;
            var fv = "200", tv = "2000";
            try {
              fv = localStorage.getItem("dragonHistFullKeep") || "200";
              tv = localStorage.getItem("dragonHistTotalKeep") || "2000";
            } catch (eG) {}
            r.fs.value = fv; r.ts.value = tv;
            try { if (r.ss) r.ss.value = dragonHistSizeGet(); } catch (eSZ) {}
            try {
              if (r.rec) {
                var off = window.dragonHistRecordOff && window.dragonHistRecordOff();
                r.rec.textContent = off ? "Start Record" : "Stop Record";
                r.rec.classList.toggle("dragon-hist-record-go", !!off);
                r.rec.classList.toggle("dragon-hist-clearall", !off);
                r.rec.title = off ? "Recording is OFF — new images are NOT saved. Click to record again." : "Stop recording new images into Image History";
              }
            } catch (eRC) {}
            var m = dragonHistDayCollapsedGet();
            var merged = (window.dragonHistGetMerged && window.dragonHistGetMerged()) || [];
            var anyOpen = false;
            for (var i = 0; i < merged.length; i++) {
              try { if (!m[dragonHistDayKey(merged[i].t)]) { anyOpen = true; break; } } catch (eK) {}
            }
            r.col.textContent = anyOpen ? "Collapse Days" : "Expand Days";
            if (window.dragonHistStorageStats) {
              var s = window.dragonHistStorageStats();
              r.use.textContent = String(s.fulls) + " full · ~" + (s.mb >= 10 ? Math.round(s.mb) : (Math.round(s.mb * 10) / 10)) + " MB";
            }
            if (tb.__dragonDispCtl) { try { tb.__dragonDispCtl.sync(); } catch (eD) {} }
            try { dragonHistDayFloat(box); } catch (eFL) {}
          } catch (e) {}
        };
      }
      if (box.firstChild !== tb) { try { box.insertBefore(tb, box.firstChild); } catch (eI) {} }
      try { if (box.__dragonTbSync) box.__dragonTbSync(); } catch (eS) {}
    } catch (e) {}
  }
    ;function dragonImgHistMerged() {
    return (window.dragonHistGetMerged && window.dragonHistGetMerged()) || [];
  }
  ;function dragonImgHistLabel(n) {
    var btn = document.getElementById("dragonImageHistBtn");
    var clearB = document.getElementById("dragonImageHistClearBtn");
    var head = document.getElementById("dragonImageHistHead");
    if (btn) {
      btn.innerHTML = "";
      var _i1 = document.createElement("span"); _i1.textContent = "\uD83D\uDDBC\uFE0F";
      var _a1 = document.createElement("span"); _a1.textContent = _dragonImgHistOpen ? "\u25B4" : "\u25BE";
      var _lb = document.createElement("span"); _lb.textContent = "Image History";
      var _a2 = document.createElement("span"); _a2.textContent = _dragonImgHistOpen ? "\u25B4" : "\u25BE";
      var _i2 = document.createElement("span"); _i2.textContent = "\uD83D\uDDBC\uFE0F";
      _a1.style.cssText = _a2.style.cssText = "font-size:1.1rem;line-height:1;";
      btn.append(_i1, _a1, _lb, _a2, _i2);
      btn.setAttribute("aria-expanded", _dragonImgHistOpen ? "true" : "false");
      btn.title = "Image History \u2014 your generated images (" + (_dragonImgHistOpen ? "click to hide" : "click to show") + ")";
    }
    // The Clear-all button sits at the FAR RIGHT of the Image History head, visible only while the panel
    // is open.
    if (clearB) { clearB.hidden = !_dragonImgHistOpen; clearB.title = "Delete ALL of your image history (" + n + " image" + (n === 1 ? "" : "s") + ")"; }
    if (head) { head.hidden = false; head.classList.toggle("dragon-ih-open", !!_dragonImgHistOpen); }
  }
  ;function dragonImgHistRender(force) {
    var box = document.getElementById("dragonImageHistInline");
    if (!box || !_dragonImgHistOpen) return false;
    dragonImgHistApplyTile();
    var merged = dragonImgHistMerged();
    dragonImgHistLabel(merged.length);
    // Egon 27.09.2026 (WP-UI005) — the grid is RECONCILED (rule I145): the old code wiped the box with
    // innerHTML="" on every change, which threw away every already-loaded picture and reset the scroll.
    // The signature now also tracks the NEWEST entry id, so a per-image refresh (which adds an entry)
    // repaints while a plain tick does not.
    var sig = merged.length + "|" + (merged[0] ? String(merged[0].id || merged[0].t || "") : "");
    if (!force && box.__dragonSig === sig && box.querySelector(".dragon-hist-grid")) { try { dragonIhFitFirstRow(); } catch (eF) {} return false; }
    box.__dragonSig = sig;
    var st = 0;
    try { st = box.scrollTop || 0; } catch (eST) { st = 0; }
    try { dragonHistDispUnwrap(box); } catch (eUW) {}
    dragonHistRenderCards(box);
    try { dragonHistToolbarEnsure(box); } catch (eTB) {}
    try { dragonHistDispApply(); } catch (eDA) {}
    try { dragonHistDayFloat(box); } catch (eFL) {}
    try { dragonIhFitFirstRow(); } catch (eF2) {}
    try { if (box.scrollTop !== st) box.scrollTop = st; } catch (eSR) {}
    return true;
  }
  ;function dragonImgHistToggle(open) {
    _dragonImgHistOpen = (open == null) ? !_dragonImgHistOpen : !!open;
    var box = document.getElementById("dragonImageHistInline");
    if (box) box.hidden = !_dragonImgHistOpen;
    dragonImgHistLabel(dragonImgHistMerged().length);
    if (_dragonImgHistOpen) dragonImgHistRender(true);
    try { if (window.dragonSyncOpenCards) window.dragonSyncOpenCards(); } catch (eS) {}
    return _dragonImgHistOpen;
  }
;function dragonIhFitFirstRow() {
    try {
      var box = document.getElementById("dragonImageHistInline");
      if (!box || box.hidden) return;
      var grid = box.querySelector(".dragon-hist-grid");
      var hasCards = !!(grid && !grid.hidden && grid.querySelector(".dragon-hist-card"));
      if (hasCards) {
        try {
          var curH = parseFloat(box.style.height) || 0;
          if (Math.abs(curH - 500) > 2) box.style.height = "500px";
          if (!box.style.overflowY) box.style.overflowY = "auto";
        } catch (eF) {}
        return;
      }
      try { box.style.height = ""; } catch (eR) {}
      return;
      var grid = box.querySelector(".dragon-hist-grid");
      if (!grid || grid.hidden) { try { box.style.height = ""; } catch (eR) {} return; }
      var cards = grid.querySelectorAll(".dragon-hist-card");
      var firstTop = null, bot = 0, n = 0;
      for (var i = 0; i < cards.length; i++) {
        var c = cards[i];
        if (c.style.display === "none" || c.offsetParent === null) continue;
        var r = c.getBoundingClientRect();
        if (firstTop === null) firstTop = r.top;
        if (Math.abs(r.top - firstTop) > 4) break;
        if (r.bottom > bot) bot = r.bottom;
        n++;
      }
      if (!n) { try { box.style.height = ""; } catch (eR2) {} return; }
      var br = box.getBoundingClientRect();
      var padB = 0;
      try { padB = parseFloat(getComputedStyle(box).paddingBottom) || 0; } catch (eP) {}
      var h = Math.round(bot - br.top + box.scrollTop + padB - 2);
      var max = Math.round(window.innerHeight * 0.8);
      if (h < 110) h = 110;
      if (h > max) h = max;
      var cur = parseFloat(box.style.height) || 0;
      if (Math.abs(cur - h) > 2) box.style.height = h + "px";
    } catch (e) {}
  }
  ;function dragonIhFitWatch() {
    try {
      var box = document.getElementById("dragonImageHistInline");
      if (!box || box.__dragonFitObs) return;
      box.__dragonFitObs = true;
      var ft = null;
      var soon = function () { if (ft) return; ft = setTimeout(function () { ft = null; try { dragonIhFitFirstRow(); } catch (e) {} }, 150); };
      try { if (window.ResizeObserver) new ResizeObserver(soon).observe(box); } catch (eR) {}
      try { window.addEventListener("resize", soon); } catch (eW) {}
      setInterval(function () { try { if (!box.hidden) dragonIhFitFirstRow(); } catch (eI) {} }, 2500);
    } catch (e) {}
  }
  ;function dragonImgHistEnsure() {
    if (!document.body) return;
    var head = document.getElementById("dragonImageHistHead");
    if (!head) {
      head = document.createElement("div");
      head.id = "dragonImageHistHead";
      head.className = "dragon-keep";
      var btn = document.createElement("button");
      btn.id = "dragonImageHistBtn";
      btn.type = "button";
      btn.className = "dragon-keep";
      btn.addEventListener("click", function () { dragonImgHistToggle(); });
      head.append(btn);
      dragonImgHistLabel(0);
    }
    var box = document.getElementById("dragonImageHistInline");
    if (!box) {
      box = document.createElement("div");
      box.id = "dragonImageHistInline";
      box.className = "dragon-keep";
      box.hidden = !_dragonImgHistOpen;
    }
    // Egon 27.09.2026 (WP-UI005) — THE PANEL LIVES OUTSIDE #outputAreaEl NOW. The output area is
    // Perchance's OWN progress board: the framework replaces its innerHTML on every generation, so
    // anything we park inside it is destroyed (that was the whole "Image History vanishes after a
    // generation" bug). The panel is a SIBLING of the output area, directly BELOW it in the main column,
    // so a generation can never wipe it and it keeps its own bounded height + its own scrollbar.
    var area = document.getElementById("outputAreaEl");
    var host = document.getElementById("mainColumnEl85394739");
    var prow = document.getElementById("dragonProductionPanel");
    if (!prow) { var _pr0 = document.getElementById("dragonProdRow"); if (_pr0 && _pr0.parentElement && _pr0.parentElement.id !== "dragonProductionBody") prow = _pr0; }
    var proc = document.getElementById("dragonProcessPanel");
    var genRow = document.querySelector(".dragon-gen-row");
    // Egon 27.09.2026 — the output boxes moved INSIDE the Process Panel body, so the panel now lives
    // in the main column directly AFTER the production row (which sits after the Process Panel).
    // Egon 28.09.2026 — the Image Generation Monitor (invisible twin parent) now carries the Process +
    // Production panels between the Prompt Panel and Image History, so Image History anchors directly
    // AFTER the monitor; the older anchors below stay as fallbacks for unusual renders.
    var anchor = null;
    try {
      var _mon = document.getElementById("dragonMonitorPanel");
      if (_mon && _mon.isConnected) anchor = _mon;
    } catch (eMon) { anchor = null; }
    try {
      if (!anchor && (window.dragonPage || "") === "character") {
        var _cp = document.querySelector(".dragon-placeholder");
        if (_cp && _cp.isConnected) anchor = _cp;
      }
    } catch (ePg2) { anchor = null; }
    if (!anchor) anchor = (prow && prow.isConnected) ? prow : ((proc && proc.isConnected) ? proc : ((genRow && genRow.isConnected) ? genRow : area));
    try {
      var _oa = document.getElementById("outputAreaEl");
      if (_oa && anchor && (_oa === anchor || _oa.contains(anchor))) anchor = null;
    } catch (eOA) {}
    if (!anchor) anchor = (prow && prow.isConnected) ? prow : ((proc && proc.isConnected) ? proc : ((genRow && genRow.isConnected) ? genRow : area));
    var ahost = (anchor && anchor.parentElement) ? anchor.parentElement : host;
    if (ahost && anchor && ahost.contains(anchor)) {
      if (head.previousElementSibling !== anchor) ahost.insertBefore(head, anchor.nextSibling);
      if (box.previousElementSibling !== head) ahost.insertBefore(box, head.nextSibling);
    } else if (host && area && host.contains(area) && area.parentElement === host) {
      var anchor2 = (prow && prow.parentElement === host) ? prow : area;
      if (head.previousElementSibling !== anchor2) host.insertBefore(head, anchor2.nextSibling);
      if (box.previousElementSibling !== head) host.insertBefore(box, head.nextSibling);
    } else {
      // fallback (an unusual render / the Character page): under the 📷 placeholder box if there is one
      var ph = document.querySelector(".dragon-placeholder");
      var phP = ph ? ph.parentElement : null;
      if (ph && phP) {
        if (head.previousElementSibling !== ph) phP.insertBefore(head, ph.nextSibling);
        if (box.previousElementSibling !== head) phP.insertBefore(box, head.nextSibling);
      } else if (area && area.parentElement) {
        if (head.previousElementSibling !== area) area.parentElement.insertBefore(head, area.nextSibling);
        if (box.previousElementSibling !== head) head.parentElement.insertBefore(box, head.nextSibling);
      }
    }
    box.hidden = !_dragonImgHistOpen;

    dragonImgHistWatch();
    try { dragonIhFitWatch(); } catch (eFW) {}
  }
  // Egon 27.09.2026 (W-UI345) — "Image History sometimes works on mobile, sometimes not; it vanishes after
  // a generation, and with Display = Small it is gone too. It must be visible in EVERY display mode."
  // Cause: the framework REPLACES #outputAreaEl's innerHTML on every generation, which deletes the history
  // head + tiles that live inside it; the only thing that put them back was a re-insert interval that GAVE
  // UP after ~10 minutes (400 ticks). A MutationObserver now re-inserts them for the whole session, and a
  // slow rebinder covers the case where the output area itself is rebuilt.
  ;function dragonImgHistWatch() {
    try {
      var _soon = function () {
        if (window.__dragonImgHistPending) return;
        window.__dragonImgHistPending = true;
        setTimeout(function () { window.__dragonImgHistPending = false; try { dragonImgHistEnsure(); } catch (e) {} }, 60);
      };
      var bind = function () {
        var area = document.getElementById("outputAreaEl");
        if (!area || area.__dragonImgHistObs) return;
        area.__dragonImgHistObs = true;
        new MutationObserver(_soon).observe(area, { childList: true });
      };
      bind();
      if (!window.__dragonImgHistRebind) {
        window.__dragonImgHistRebind = true;
        setInterval(function () { if (document.hidden) return; bind(); }, 3000);
        document.addEventListener("visibilitychange", function () { if (!document.hidden) _soon(); });
      }
    } catch (e) {}
  }

  ;function dragonEnsureHistoryTools() {
    dragonHistCss();
    try { dragonHistPanelEnsure(); } catch (e) {}
    try { dragonImgHistEnsure(); } catch (e) {}
    // pick up newly generated images
    _dragonImgHistTick++;
    try {
      if (!_dragonImgHistOpen) return;
      if (_dragonImgHistTick % 4 === 1) dragonImgHistRender(false);
      else dragonImgHistApplyTile();
    } catch (e) {}
  }
  window.dragonEnsureHistoryTools = dragonEnsureHistoryTools;
  window.dragonImageHistToggle = dragonImgHistToggle;
  window.dragonImageHistRefresh = function () { return dragonImgHistRender(true); };
  // NOTE: this runs on its OWN timer instead of dragonTick(), because dragonTick jobs are skipped while
  // document.hidden is true (the editor's preview iframe reports hidden) — a plain interval keeps the
  // panel/button in place on every kind of page and popup.
  try {
    var _dragonHistTries = 0;
    var _dragonHistIv = setInterval(function () {
      _dragonHistTries++;
      try { dragonEnsureHistoryTools(); } catch (e) {}
      if (_dragonHistTries > 400) clearInterval(_dragonHistIv); // ~10 minutes, then the work is long done
    }, 1500);
  } catch (e) {}
})();
