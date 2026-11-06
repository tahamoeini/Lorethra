# ✨ Ai Chat — the navbar's Ai Chat button & page (ex-👥 Social, 10.10.2026)

This folder is the HOME of everything about the navbar's **✨ Ai Chat** item: the page itself, its look, its
future surfaces and every document/note we write about it. Egon, 27.09.2026 (W-DOC267):
W-SOCIALCUT 10.10.2026 (Egon order): the page used to be called 👥 Social with Chat / AI Chat / Story / Games / P.M. tabs.
Chat, Story, Games and P.M. are PARKED (code in the Librarybook DEPO) until their builds land; only AI Chat stays,
so the button is now named Ai Chat. Page key stays `social`.

> "src/social diye klasör oluştur bundan sonra navbar social butonu/sayfası ile ilgili çalışmalarımızı
> belgelerimizi vs onun içine atalım. bari geçmişte düzenli olamadık şimdiden sonra düzenli olalım.
> mevcuttaki navbar social butonu ile ilgili olanları da içine taşı."

## Files

| File | What it is |
| --- | --- |
| `social-page.js` | The page builder (`window.dragonBuildSocialPage()`), its CSS (`#dragonSocialCss`) and the tab strip. W-SOCIALCUT 10.10.2026: only the AI Chat tab stays; Chat / Story / Games / P.M. are parked in the Librarybook DEPO. |
| `aichat/live/engine.js` | The AI engine (`window.dragonAiChat`): 10-bot roster, prompt, kv memory, renderer. |
| `aichat/live/shell.js` | The AI surface: mounts the engine into the AI Chat tab (roster + session). |
| `aichat/live/settings.js` | General + per-companion settings dialogs (`window.dragonAiChatSettings`), kv-backed. |
| `aichat/live/README.md` | The AI build plan + slice status. |
| `README.md` | This register. |

## The register — everything that touches Social, and where it lives

Keep this list current whenever the Social button or page changes (rule I116: a moved/renamed control must be
reflected in the Legends too).

1. **The navbar button** — `src/dragon-app-core.js`, `navBtn('<img social-icon>', "Ai Chat", "Ai Chat — Dexa &
   character bots (work in progress)", "social", ...)` (icon still `src/social-icon.png`). The page key stays `social`.
2. **The page list** — `src/dragon-pages.js`, `var PAGES = [...]` must contain `"social"`.
3. **The page builder** — `window.dragonBuildSocialPage()`, defined HERE in `social-page.js`. `dragon-pages.js`
   keeps a thin `buildSocialPage()` that simply delegates to it (the page-switch code at `dragonSetPage()`
   calls it when the page key is `"social"`).
4. **The URL hash map** — `src/dragon-pages.js`, `HASH_OF` / `PAGE_OF_HASH` (`social` ⇄ `social`).
5. **The script tag** — `index.html`, immediately after `src/dragon-pages.js`.
6. **The Legends** — `src/dragon-pages.js`, `dragonLegendsData()` → the "Home page" card
   (`✨ Ai Chat ✨`). The login/profile/avatar rows were removed with the panels (W-SOCIALCUT).
7. **The Home CTA** — `src/dragon-pages.js`, `#dragonHomeSocialBtn` (Egon 29.09.2026: the old
   "Advanced Chat" teaser became the functional 👥 Social button opening the `social` page;
   W-SOCIALCUT 10.10.2026: renamed ✨ Ai Chat).

## How the page is painted

`#dragonSocialPage` is a fixed overlay (`top: var(--dragon-nav-h, 42px)`) that is `display:none` until
`html[data-dragon-page="social"]` is set; while Social is the active page, `#mainColumnEl85394739` and
`#dragonHomePage` are hidden. Background and buttons use the theme tokens (`--dt-*`) — no bare hex colours
where a token exists, and no sharp corners (Designbook §1/§3/§4). Read the Designbook before changing the look.

## Social plan register (Egon's roadmap, 09.10.2026)

Source: W-SOC260 master record + the 13-item directive (src/WORKSPACE/EGON.enc)
+ today's session. Status is updated as builds land.

| Phase | Tab | Content | Status |
| --- | --- | --- | --- |
| P0–P2 | identity | Register (age 18+, country), login, encrypted settings backup, secret Q&A, password reset | DONE 09.10.2026 |
| P1 | Profile (Settings Login & Safety since 09.10.2026, Egon order) | Avatar, name, member-since, badges, age, country + edits | DONE 09.10.2026 |
| P3 | Chat | Chat page reading the `onlineUsers` presence list | PARKED 10.10.2026 (W-SOCIALCUT — code in DEPO) |
| P4 | P.M. | Private messages | PARKED 10.10.2026 (W-SOCIALCUT — code in DEPO) |
| P4 | badges | Badge awarding (server-awarded, counter-based) + avatar upload UX | OPEN |
| P5 | Chat/AI/Story | User chat (Advanced Chat), AI chat, story mode; Board lands inside Chat | PARKED 10.10.2026 except the AI Chat placeholder tab (W-SOCIALCUT — code in DEPO) |
| P6 | Games | 3–5 mini games, per-player best score (one row per player), top-10 board | PARKED 10.10.2026 (W-SOCIALCUT — code in DEPO) |
| — | Forum | Topics + replies, badges under avatars (W-SOC263) | PARKED 10.10.2026 (W-SOCIALCUT) |
| — | caps | Settings-bloat caps | UNAPPROVED — do not build without Egon |

Rules: no manual account deletion (no button/RPC — Egon 09.10.2026: his own
test account stays as his smurf, never delete it). 365-day idle accounts are
swept on the month's last day (the first login/register that day triggers
the server sweep — the server cannot wake itself, so it rides that command).
No mail anywhere. Settings never in DS. Birth date + country immutable after
register; age is always derived.

## Adding a surface

Each planned surface is one row in `items` inside `buildSocialPage()`:

```js
["\uD83D\uDCAC", "Advanced Chat"]      // [ icon, label ]
```

A surface that is not built yet stays a **disabled** button (`b.disabled = true`,
`aria-disabled="true"`, title `"<name> — coming soon"`). When a surface is actually implemented, wire its
click handler in the same loop and drop the disabled state, then update this register **and** the Legends.
