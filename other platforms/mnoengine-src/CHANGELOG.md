# Changelog

Release notes for **MNO RPG ENGINE**. Newest Date first. Dates are **UTC**.

## 2026-11-04 UTC
- 🗡️🐛🪲🐞🗡️ *(bug fixes)*
- ✨🍻🍻🍻✨ *(tavern improvements)*

## 2026-11-02 UTC
- ✨ Added **Comments** tab on published world. Can be disabled per world in World Editor
- Tavern (Desktop only): Added Compact Mode that can be resized and positioned anywhere, giving you access to the app while keeping it open. Modes can be cycled using the square button on the top right of the tavern
- Added world comments notification. Default OFF, you can enable it in Tavern config. Notifications for world comments are opt-in only and delayed to save performance. You automatically watch your own published worlds. Other users have to leave a comment at least once (after this update) to get mention/reply notifications

## 2026-11-01 UTC
- External AI Providers: added per-call toggles (GM, Skill checks, Trackers, NPC generation, Scene image prompt, Memories, NPC life sim, Other). **On** (default) will use the external AI model. **Off** will fall back to Perchance AI. Useful when the external model is worse at a job, or to save credits. Access from `Settings/AI Model`
- External AI Images: added per-job toggles (Portraits, Scene image, Other) with an All master switch. **On** (default) uses the external image model, **Off** falls back to Perchance AI. Access from `Settings/Image Gen`

## 2026-10-31 UTC
- Fixed (?): External AI Providers: Added some breathing room to tracker and NPC tracker calls `max_tokens`, to make sure they can output them fully

## 2026-10-29 UTC
- Fixed: world editor Context tab over-counted `Latest action / turn mode` in worst-case section
- Fixed: Desktop input text out of focus/unclickable during GM stream

## 2026-10-27 UTC
- Added **Switch World** button on adventures. Useful if you duplicate a world and want to bring your adventure to the new one
- Improved low storage handling (doesn't get rid of it, low storage still eventually fails)
- Fixed: restore backup merge wasn't working correctly

## 2026-10-26 UTC
- Improved messaging when device/browser is running low on space, and it will give you option to download/backup everything
- Fixed: NPC life sim getting stuck rewording the same mini-goal over and over again
- Fixed: Narrative vibe was incorrectly counted on top of system prompt in context meter and estimate

## 2026-10-25 UTC
- Fixed: publishing world succeeded with a failed download URL

## 2026-10-24 UTC
- Added **Fullscreen** and **Install App** buttons on the landing nav (App is PWA on supported browsers. Your data is still stored in local browser storage, back them up regularly just in case!)
- NPC Life tab is now editable
- Fixed: AI providers openrouter/free refused call with max_tokens error
- Increased GM memory and lore caps for external providers (x2) (this doesn't affect Perchance AI)
- Pinned auto memories now will be fed to GM if the owner is active in the scene (will eat token, use responsibly)

## 2026-10-23 UTC
- General improvements to Tavern performance (still a bit laggy on first load, but much better, and once it cache it should be smooth)
- Fixed: some links were not working in Tavern
- Stickers!
- Fixed: `[[Choice]]` tag failed to render
- Fixed: harmless error popup when rotating the phone with Tavern open

## 2026-10-22 UTC
- ✨ **NEW: Tavern** 
Community chat for the MNO RPG Engine. This took me way too long lol.
Based on the official `comments-plugin`. Stickers were generated using `emoji-sticker-generator`. Please be kind and civil if you're using it! 
I'll hop in there from time to time (maybe).

## 2026-10-20 UTC
- World details: `@username` mentions in a world's description and author's notes are now clickable and open that user's profile
- Mobile friendly tooltip (WIP) currently on stats and trackers

## 2026-10-19 UTC
- World editor: added **Author's Notes** (can be used to place your changelog, tutorial, etc)
- Importing adventure/world with the same existing id now will give choice to replace/duplicate
- Added **Show tracker changes** toggle in story preferences
- Improved edit message UI

## 2026-10-18 UTC
- ✨ **NEW: NPC Life Sim** 
NPCs that haven’t been seen for a while will pursue their own mini-goals. They may record memorable events of their own life. This is a per adventure feature that you can enable/disable in Story panel *(default ON)*.
The sim runs every 5 turns, each run will simulate up to 2 NPCs. Works better in worlds with day, time, and location trackers.
It's really rudimentary at the moment, but has room to grow. My goal with this is not an actual/accurate simulation of their life. I just want to make it **feels** like they have life when they're not interacting with us, the players. And hopefully to add a bit of spice and immersion for long term roleplay.
- **NEW: Rename NPCs** 
You can rename NPCs in adventure now. Can be accessed from NPC profile panel, right after their name. Recommended for newly introduced/generated NPC to prevent breaking long narrative. World defined NPCs **cannot** be renamed. 
- **Token Optimization**
Tons of works has been put into dynamically adjusting the GM context to fit the token context window. Some methods are only applied when using Perchance AI and won't affect external providers.
This doesn't mean it will always fit nicely, sometimes even after all that it still won't fit. In such cases, it will be at the mercy of Perchance AI. *(from my own personal tests, it's still working good enough even at 10k, but results may vary)*
- Added **"Add Memory"** button to memory tab in NPC profile
- Fixed: Skill check only produced **"hard"** or **"very hard"** target

## 2026-10-16 UTC
- Hero creation: added text input direction for generate with AI
- Hero creation: added history for avatar *(last 8)*
- Hero creation: added final review tab before starting adventure
- Fixed (an attempt): AI leaking trackers into the narrative writing
- ✨ **NEW: External image gen providers** currently supported: OpenAI and OpenRouter
- Scene image will use NPC avatar as reference on supported models using external providers *(does not work with Perchance image gen)*
- Settings: ai model and image gen dropdown now select and save instantly when selecting from dropdown instead of having to hit the save button

## 2026-10-15 UTC
- Further tweaks and improvements towards memories and characters context matching
- Removed the caps and auto prune for auto memories and NPCs. It was there originally to keep save data small, but turns out it isn't taking much. You keep everything now
- Fixed: skipping turn now counts as a new turn, instead of merging to previous response

## 2026-10-14 UTC
- Added context meter toggle in `Settings > Interface` (default OFF)
- Fixed: trackers and npc trackers prompt formatting
- Added duplicate button on adventures
- Unbound adventures now automatically search the public worlds and see if there's a match
- Fixed: completed/failed quest tag did not survive edit
- World Cards: like and download counts above 1000 now shown as 1k

## 2026-10-13 UTC
- ✨ **Experimental: Better searching/matching** for lore, memories, and NPC profile, in an effort to reduce overall token usage by not including things the scene doesn't need. Let me know how it goes for you!

## 2026-10-12 UTC
- Added a new share option to external library, currently supported: **Unseen Scribe Library**
- You can also open/import scenario from Unseen Scribe Library now (using "Open in MNO Engine" button there)
- Fixed: command menu misaligned

## 2026-10-11 UTC
- World Editor - Images: You can include trackers on scene images now, useful for trackers that affect appearance
- World Editor - Images, Stats: You can now select which individual tracker to include in `Include trackers` and `Include NPC trackers` advanced settings (default to all)
- World Editor - Images: added a bunch of image style presets
- World Editor - Basics: bumped max tags from 5 to 8

## 2026-10-10 UTC
- Fixed: back button broken page navigations
- Fixed: in mobile the re-roll / edit / delete buttons sometimes flashed without firing
- Fixed: re-rolling scene images no longer deletes the old ones before the new ones arrived
- Failed image generations now auto-retry (3 attempts total)
- Fixed: memory roll-up sent a whole overgrown backlog in one summarizer call, it is now chunked instead
- Lightbox reworked and improved

## 2026-10-09 UTC
- ✨ **Improved NPC name matching:** previously "Maya's Friend" will point to "Maya" profile. and the chat got rewritten, so Maya's Friend essentially gone from the chat. Now they keep whatever name the GM write them in.
- ✨ **Added NPC name linking options in the chat:** if the chat has different name than the actual profile, it can now be managed using a faded 🔗 button beside the name. You can decide if it's linked to a correct profile, link it to another NPC, or it should be a new NPC altogether.

## 2026-10-08 UTC
- Chat left rail rework: new **Menu** tab with a quick-nav grid (Worlds, Adventures, Explore, Settings, and Changelog) to make it easier to navigate the app
- Renamed for clarity: chat rail's Adventures tab is now **Session**, and the old Settings tab is now **Story**

## 2026-10-07 UTC
- **🚨 IMPORTANT NOTICE 🚨** Changed how user profile works: the old one has a major bug where users couldn't update their profile at all *(bio and avatar)*. Unfortunately, **ALL USERS** bio need to be re-saved. **Please re-save your bio in `Settings > Identity`**. I'm sorry! *(Only re-save bio/avatar, you don't need to re-claim or change username)* 
- Streamlined the **Direct the prompt** in scene image panel, now you only need to hit one generate button instead of re-generate prompt then generate image
- Added global guidance scale slider for image gen in Settings
- ✨ **Fuzzy name matching for NPC Profile:** "Garreth" will point to "Captain Garreth" profile, instead of creating a new NPC
- Added sampling controls for custom AI providers: temperature, top-p, top-k and repeat-penalty sliders in `Settings > AI Model`
- Custom AI providers now respect each call's `maxTokens` output cap (sent as `max_tokens`); tracker calls have dynamic cap
- Improved level/exp handling
- Fixed: some XSS issues

## 2026-10-06 UTC
- The 🎨 button beside the chat input is now instant: it generates a scene image right away using the amount and aspect ratio saved in the command menu, no panel to go through. Can be switched back from `Settings > Interface`
- The Scene Image panel (accessed from `⋮` menu) has a new **Direct the prompt** toggle: switch it on to tell the AI what the image should focus on. Amount, aspect ratio, and the toggle are now remembered globally
- Cover Studio: you can now freely position the logo (scale, position, rotation) directly on the preview
- Cover Studio: added clean up slider for logo, useful if the generated logo still have lefover background noise
- Cover Studio: added optional outline to logo

## 2026-10-05 UTC
- Fixed: updating public world sometimes failed (another upload is in progress)
- Image gallery now uses masonry grid layout
- Scene Image prompt generation improvement and fixes

## 2026-10-04 UTC
- Nothing exciting, just a bunch of UI bug fixes

## 2026-10-03 UTC
- Fixed: adventure turn count also counted deleted turns. Deleting a turn now decrements it, and old saves are reconciled on load
- Some more prompt optimizations
- **Experimental:** lowering the recent convo context in attempt to save tokens (lowered from 15 to 10 turns), please let me know if you notice any differences!

## 2026-10-02 UTC
- Added new edit message mode, courtesy of **@Winter**. Editing message will keep the layout/UI of the chat. Full edit mode still available via toggle
- Switched cover images to `.webp` format (previous worlds unaffected)
- Added random sorting in explore page
- Fixed: scene image throwed an error when prompt contains certain characters `[ ]`. the prompt is now sanitized before generating.
- Scene images in the chat is now sized proportionally between square, portrait, and landscape
- Switched scene images to `.webp` as well to save space
- Fixed: restoring your secret key didn't restore your published world. Also added 'Restore my published worlds' button in settings
- Fixed: settings navigation blocked by identity loading
- Fixed: exp trackers showed negative changes when level up
- Improved level up notification UI
- Improved hero creation randomizer

## 2026-10-01 UTC
- Fixed: Generate profile button when new npc appears in the chat wasn't working
- World Editor: improved the stats and trackers generation using AI
- World Editor: Trackers can now be `hidden` — still tracked by the AI but hidden in UI (still editable when editing chat)
- World Editor: Added color picker for trackers (only affects number trackers with max value)

## 2026-09-30 UTC
- ✨ **NEW: Simple User Profile** you can edit your profile in Settings > Identity (need to claim a username first)
- Improved profile layout on mobile
- Fixed: Long trackers overflowed in NPC profile and Hero panel
- Fixed: Quest/Objective tagged empty value `—` as completed
- ✨ World Editor: Added a simple cover image studio where you can generate and position logo on top of your cover

## 2026-09-29 UTC
- System prompt optimizations
- Improved cover image generation

## 2026-09-28 UTC
- World Editor (Lorebook): Improved the **Split with AI** features. Much more accurate and less stuff will go missing (not 100% foolproof, always check the output)
- Improved world creation using **Craft with AI**
- World Editor: Added **Generate** and **Presets** buttons to the Stats, Trackers, and NPC Trackers tabs. Generate will generate the entries with AI, while Presets contains common entries that can be added quickly into the world
- Fixed some issues when using OpenRouter as AI provider, also added thinking budget for it in the settings
- Memory panel: situation and threads are now editable
- Less tendency to time skip when skipping turn

## 2026-09-27 UTC
- Fixed: there was a stupid bug that prevented you from getting the latest version of the worlds you've added, also added a bulk `update all` button
- Fixed: skill-check for non-d20 did not have the correct difficulty check value
- Added range to difficulty check
- Skill-check call improvement
- World Editor (Stats): added creation ceiling to cap starting stats in the hero creation
- World Editor (Stats): added custom instruction field to skill-check
- World Editor (Stats): added toggles to feed the skill-check referee the last turn's tracker / NPC tracker values

## 2026-09-26 UTC
- ✨ **NEW: AI Model Provider** switch between the built-in Perchance AI and bring your own key with OpenAI/DeepSeek/OpenRouter/Ollama
- Fixed: a failed generation no longer writes an error into the story
- Moved the `prune` button to chat settings

## 2026-09-25 UTC
- World Editor: added a generate npc button
- World Editor: added drag and drop to re-order list
- Fixed: Map POI with missing brief
- Improved quest/objective tracker, added simple completed/failed UI
- Fixed: Stuck/stale NPC profile UI when re-generating profile
- Fixed: on mobile, exports still using the old extension
- Fixed: published world description got cut off (please re-publish to fix)

## 2026-09-24 UTC
- Explore: opening a world's details panel now puts that world's share link in the address bar, so you can copy or share the page URL straight from the browser
- Usernames: renaming now frees your old name for anyone to claim
- Fixed: Explore's world panel could stay on top of the chat after `▶ Continue`

## 2026-09-23 UTC
- Map: the map now scales from a room all the way to interstellar space
- Chat: Travel now render in a system bubble instead of player's bubble
- Chat: If GM writes a line for your own character *(it's designed not to, but I see now it depends on your playstyle)*, the bubble now shows your portrait and opens the Hero panel instead of offering to generate an NPC profile
- Explore: new 'Liked' filter
- Explore: added shareable link for published worlds
- World editor: Better UI for Lorebook, NPC, Stats, and Trackers *(list and editor instead of one giant scrolling)*
- World editor: the tags field now offers a common-tag pick-list
- World editor: added entry delete confirmation
- World editor: duplicate keys/names are flagged
- World editor: context budget estimate fixed and improved
- World editor: sets a per-character max for NPC tracker when the tracker has a literal max
- Lorebook: keyword-triggered lore feed is now capped per turn, and ranked by scene recency, so a big or shotgun-triggered lorebook can't flood the GM context
- Fixed: NPC name matching treated a common word inside a name (the, and, etc) as a hit — everyday words are now ignored
- Fixed: leaving an adventure while the map was generating could throw an error, and could leave the map stuck
- Fixed: the ♥/♡ hearts glyphs didn't render right on some devices
- Fixed: `exp` tracker with no max value showed as `0/undefined`. a blank exp max now defaults to 100
- Unified markdown text rendering

## 2026-09-22 UTC
- Fixed: a world could stay in Explore pointing at a file that's gone from the host — **🌐 Publish** now re-uploads the file when it's missing
- Settings panel: fixed height, switching sections no longer resizes the panel
- Fixed: Explore page, sort by name error

## 2026-09-21 UTC
- ✨ **NEW: Community** — publish your worlds for others to find, and play the ones they've shared; every device keeps its own creator identity, a username and a secret creator code
- ✨ **NEW: Landing page** is the app's home now. Reach **Worlds**, **Adventures**, **Explore**, **Settings** and **Changelog** from the left nav menu
- ✨ **NEW: Worlds** your library of worlds — your own creations, the bundled worlds, imported files and the ones you've added from the community
- ✨ **NEW: Adventures** your saved journeys moved here. With search, sort, per-world filters and a **Group by world** view
- ✨ **NEW: Explore** a community catalog of worlds other players have published, to browse, search, sort and filter
- ✨ **NEW: Settings** set up your **Identity**, **Content settings** and **Data & Backup** in one panel
- **Settings: Identity** claim or change your username, reveal your secret creator code, and switch identity to a code you paste in
- **Settings: Content settings** the tags you'd rather not see and the authors you've muted, applied everywhere in the app
- **Settings: Data & Backup** download everything as a single file, and import it back merged or as a full replace
- UI: Added bunch of new icons

## 2026-09-18 UTC
- Added nsfw toggle
- Landing Page: added live storage meter (bottom of the page)

## 2026-09-17 UTC
- ✨ NPC profile: Added Memory tab that shows memories for each NPC
- Memory UI improvements
- Memory: Added ON and OFF switch on Manual Memory to control which memory is active
- Memory: auto-memory cap raised
- NPC: unpinned characters are kept much longer before being forgotten
- NPC: countdown badge warns when an unpinned character is close to being forgotten
- NPC: world-cast characters are never forgotten
- NPC Trackers optimization
- Adventure save file size optimization
- Import/Export: worlds now export as `.mno-world`, adventures as `.mno-adv`, lorebooks as `.mno-lore`, so the import picker shows only the relevant files (your old exports still work, just rename the extension)

## 2026-09-16 UTC
- ✨ NEW: NPC Trackers. Accessible from the world editor > NPC Trackers. Define a tracker once, and every NPC Profile will have it
- Better NPC profile generation for first time NPCs that are not defined in the world
- Hero creation: new "Randomize" button fills the whole bio instantly without AI
- World editor: "show in" dropdown reads "chat header / hero panel / both", default to chat header

## 2026-09-15 UTC
- Landing Page: added changelog (top right)
- Chat: Stop button (stop AI generation)
- Chat: `[[CHOICE: ...]]` rendered as choice button
- Enforced NPC names to be more consistent, preventing multiple NPC profiles for the same NPC
- Fixed: Generic NPCs (guard, bartender, etc) were silently stored in the save game, causing unnecessary bloat
- Fixed: Stale tracker value in hero panel when it was already opened
- Fixed: Import/Export icons (⭱/⭳) showed as empty boxes on some devices

## 2026-09-14 UTC
- ✨ World Editor: added context estimate
- Lorebook: split with AI improvements
- Memory: Tiered memory recall
- Tightened level-up rules
- Fixed: scene images were generated for wrong event/character
- Fixed: NPC profile generation did not follow the NPCs defined in the world
- Fixed: GM did not use the full name of each NPC defined in the world

## 2026-09-13 UTC
- ✨ World editor: custom formula for skill checks
- Mobile UI improvements
- Map system improvements

## 2026-09-12 UTC
- ✨ Initial release: RP Chat and world editor
