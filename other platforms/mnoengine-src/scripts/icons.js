// icons.js — the single source of truth for every SVG in the app.
//
// Everything that used to be a separate `.svg` file (icon-bell/expand/compress,
// menu-squares), an inline `<svg>` string scattered across 8 modules, or a glyph
// in the retired `mno-glyphs` fallback font now lives here as an exported string.
// `logo.svg` stays a file (branding); `icon-*.png` masks stay files (out of scope).
//
// Conventions:
// - Chrome icons keep their drawn size via width/height attributes (15/16/26px…),
//   exactly as they rendered before — this file only moves them, it doesn't restyle.
// - Text-inline icons (download/hearts) carry the EXACT outlines extracted from
//   the retired mno-glyphs.woff2 (decompressed + read with opentype.js — not
//   redrawn); import/export are redrawn bolder in the same triangle-to-bar
//   design (124-unit stem, 470-wide × 124-thick bar floating 72 units off the tip).
//   Each viewBox is cropped to the glyph's visible contours — EXCEPT the hearts,
//   which carry 108 units of optical padding ABOVE the contours. The heart is
//   top-heavy (wide lobes over a sharp tip): its ink centroid sits ~9% above its
//   box center, so a bare-contour crop centers the BOX while the mark reads as
//   floating above the digits beside it in flex rows. The padding puts the INK
//   on center instead; the bottom edge is untouched. Per-icon width/height in em
//   matches the (padded) viewBox, so a flex row's centering pairs the visible
//   mark with the digits beside it; per-icon vertical-align in the inline style
//   puts the baseline exactly where the text character's was (import/export
//   bottoms sit on it, download hangs 0.081em below, hearts float 0.059em above
//   — still true, since the hearts' bottom edge never moved).
// - All icons use `currentColor` and `aria-hidden`, so they theme with surrounding text.

export const ICON_X_SM = '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';

export const ICON_MENU_SM = '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="M2 4.2h12M2 8h12M2 11.8h12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';

export const ICON_CHEV_LEFT_SM = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M10 3 L5 8 L10 13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export const ICON_CHEV_LEFT_LG = '<svg viewBox="0 0 16 16" width="26" height="26" aria-hidden="true"><path d="M10 3 L5 8 L10 13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export const ICON_CHEV_RIGHT_LG = '<svg viewBox="0 0 16 16" width="26" height="26" aria-hidden="true"><path d="M6 3 L11 8 L6 13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export const ICON_X_LG = '<svg viewBox="0 0 16 16" width="26" height="26" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

export const ICON_FS_EXPAND = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';

export const ICON_FS_COMPRESS = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>';

export const ICON_MONITOR = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="4" width="19" height="12.5" rx="1.5"/><path d="M9.5 20.5h5M12 16.5v4"/></svg>';

export const ICON_PHONE = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M10.8 18.5h2.4"/></svg>';

export const ICON_SEARCH = '<svg class="hm-bic" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="7" cy="7" r="4.2"/><path d="M10.3 10.3L14 14" stroke-linecap="round"/></svg>';

export const ICON_FUNNEL = '<svg class="hm-bic" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M2.2 3.2h11.6L9.5 7.8v4.2l-3 1.8V7.8z" stroke-linejoin="round"/></svg>';

export const ICON_SORT = '<svg class="hm-bic" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4.8 13V3.6M4.8 3.6L2.6 5.9M4.8 3.6l2.2 2.3M11.2 3v9.4M11.2 12.4l2.2-2.3M11.2 12.4l-2.2-2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export const ICON_BACK_CHEV = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5 8 12l7 7"/></svg>';

export const ICON_ED_NARRATIVE = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 3v6.5h3v3l3.8-3h4.2V3h-11z"/></svg>';

export const ICON_ED_TRACKERS = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 13.5h11"/><path d="M5 13V9.5"/><path d="M8 13V6"/><path d="M11 13V8"/></svg>';

export const ICON_ED_NPC = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="5.4" r="2.4"/><path d="M1.6 13.6c.6-2.8 2.2-4.2 4.4-4.2s3.8 1.4 4.4 4.2"/><circle cx="11.4" cy="5.8" r="1.9"/><path d="M11 9.6c1.9.4 3 1.7 3.4 3.6"/></svg>';

export const ICON_VERIFIED = '<svg class="disc-verified" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><circle cx="8" cy="8" r="7" fill="currentColor"/><path d="M5 8.3l2 2 3.9-4.5" fill="none" stroke="#141310" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export const ICON_OWNER_STAR = '<svg class="disc-verified disc-owner" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><circle cx="8" cy="8" r="7" fill="currentColor"/><g transform="translate(8 8) scale(1.0769) translate(-8 -8)"><path d="M8 1.5C8.8 5.2 10.8 7.2 14.5 8 10.8 8.8 8.8 10.8 8 14.5 7.2 10.8 5.2 8.8 1.5 8 5.2 7.2 7.2 5.2 8 1.5Z" fill="#141310"/></g></svg>';

export const ICON_MOD_SHIELD = '<svg class="disc-verified disc-mod" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M7.3 1.8 2.8 3.6v4.8c0 2.6 2.1 4.5 4.5 5.8Z" fill="currentColor"/><path d="M8.7 1.8l4.5 1.8v4.8c0 2.6-2.1 4.5-4.5 5.8Z" fill="currentColor"/></svg>';

export const ICON_REDDIT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 0C5.373 0 0 5.373 0 12c0 3.314 1.343 6.314 3.515 8.485l-2.286 2.286C.775 23.225 1.097 24 1.738 24H12c6.627 0 12-5.373 12-12S18.627 0 12 0Zm4.388 3.199c1.104 0 1.999.895 1.999 1.999 0 1.105-.895 2-1.999 2-.946 0-1.739-.657-1.947-1.539v.002c-1.147.162-2.032 1.15-2.032 2.341v.007c1.776.067 3.4.567 4.686 1.363.473-.363 1.064-.58 1.707-.58 1.547 0 2.802 1.254 2.802 2.802 0 1.117-.655 2.081-1.601 2.531-.088 3.256-3.637 5.876-7.997 5.876-4.361 0-7.905-2.617-7.998-5.87-.954-.447-1.614-1.415-1.614-2.538 0-1.548 1.255-2.802 2.803-2.802.645 0 1.239.218 1.712.585 1.275-.79 2.881-1.291 4.64-1.365v-.01c0-1.663 1.263-3.034 2.88-3.207.188-.911.993-1.595 1.959-1.595Zm-8.085 8.376c-.784 0-1.459.78-1.506 1.797-.047 1.016.64 1.429 1.426 1.429.786 0 1.371-.369 1.418-1.385.047-1.017-.553-1.841-1.338-1.841Zm7.406 0c-.786 0-1.385.824-1.338 1.841.047 1.017.634 1.385 1.418 1.385.785 0 1.473-.413 1.426-1.429-.046-1.017-.721-1.797-1.506-1.797Zm-3.703 4.013c-.974 0-1.907.048-2.77.135-.147.015-.241.168-.183.305.483 1.154 1.622 1.964 2.953 1.964 1.33 0 2.47-.81 2.953-1.964.057-.137-.037-.29-.184-.305-.863-.087-1.795-.135-2.769-.135Z"/></svg>';

export const ICON_DISCORD = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/></svg>';

// --- ex-file SVGs (were icon-*.svg masks, now inline currentColor) ---
export const ICON_SQUARES = '<svg viewBox="0 0 1024 1024" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M160 448a32 32 0 0 1-32-32V160.064a32 32 0 0 1 32-32h256a32 32 0 0 1 32 32V416a32 32 0 0 1-32 32H160zm448 0a32 32 0 0 1-32-32V160.064a32 32 0 0 1 32-32h255.936a32 32 0 0 1 32 32V416a32 32 0 0 1-32 32H608zM160 896a32 32 0 0 1-32-32V608a32 32 0 0 1 32-32h256a32 32 0 0 1 32 32v256a32 32 0 0 1-32 32H160zm448 0a32 32 0 0 1-32-32V608a32 32 0 0 1 32-32h255.936a32 32 0 0 1 32 32v256a32 32 0 0 1-32 32H608z"/></svg>';

export const ICON_BELL = '<svg viewBox="0 0 64 64" width="18" height="18" aria-hidden="true"><circle cx="32" cy="8.5" r="4.5" fill="currentColor"/><path fill="currentColor" stroke="currentColor" stroke-width="5" stroke-linejoin="round" d="M32 15c-9.5 0-16 7.2-16 16.5V41l-6.5 8h45L48 41v-9.5C48 22.2 41.5 15 32 15z"/><circle cx="32" cy="54.5" r="5" fill="currentColor"/></svg>';

export const ICON_EXPAND_SQ = '<svg viewBox="0 0 64 64" width="18" height="18" aria-hidden="true"><rect x="12" y="12" width="40" height="40" fill="none" stroke="currentColor" stroke-width="7"/></svg>';

export const ICON_COMPRESS_SQ = '<svg viewBox="0 0 64 64" width="18" height="18" aria-hidden="true"><path d="M28 40V10h30v28" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><rect x="6" y="26" width="32" height="32" fill="currentColor"/></svg>';

export const ICON_FLOAT_SQ = '<svg viewBox="0 0 64 64" width="18" height="18" aria-hidden="true"><rect x="6" y="15" width="52" height="34" fill="none" stroke="currentColor" stroke-width="6"/><rect x="34" y="35" width="18" height="12" fill="currentColor"/></svg>';

// --- ex-font glyphs (download/hearts carry the old font's contours verbatim;
// --- import/export are redrawn bolder below, same triangle-to-bar design) ---
export const ICON_IMPORT = '<svg class="ic-tx" viewBox="42 14 470 786" style="width:0.47em;height:0.786em" fill="currentColor" aria-hidden="true"><path d="M215 800L215 385L95 385L277 210L458 385L339 385L339 800ZM42 138L512 138L512 14L42 14Z"/></svg>';

export const ICON_EXPORT = '<svg class="ic-tx" viewBox="42 14 470 786" style="width:0.47em;height:0.786em" fill="currentColor" aria-hidden="true"><path d="M215 14L215 429L95 429L277 604L458 429L339 429L339 14ZM42 676L512 676L512 800L42 800Z"/></svg>';

export const ICON_DOWNLOAD = '<svg class="ic-tx" viewBox="175 -19 725 900" style="width:0.725em;height:0.9em;vertical-align:-0.081em" fill="currentColor" aria-hidden="true"><path d="M439 -19L636 -19L636 488L900 267L900 529L537 881L175 529L175 267L439 488Z"/></svg>';

export const ICON_COMMENT = '<svg class="ic-tx" viewBox="0 0 16 16" style="width:0.9em;height:0.9em" fill="currentColor" aria-hidden="true"><path d="M2.5 2.5h11v7H7.9l-3.4 3v-3H2.5z"/></svg>';

export const ICON_NOTE_DOC = '<svg class="ic-tx" viewBox="0 0 16 16" style="width:0.9em;height:0.9em" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3.5 1.5h5.5l3.5 3.5v9.5h-9z" stroke-linejoin="round"/><path d="M9 1.5v3.5h3.5M5.8 8h4.4M5.8 10.2h4.4M5.8 12.4h2.8" stroke-linecap="round"/></svg>';

export const ICON_OVERVIEW = '<svg class="ic-tx" viewBox="0 0 16 16" style="width:0.9em;height:0.9em" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M2.5 4h11M2.5 8h11M2.5 12h7" stroke-linecap="round"/></svg>';

export const ICON_HEART = '<svg class="ic-tx" viewBox="46 50 593 691" style="width:0.593em;height:0.691em;vertical-align:0.059em" fill="currentColor" aria-hidden="true"><path d="M489 158L489 158C508 158 527 161 545 168C563 175 579 186 593 200C607 214 618 232 626 254C634 275 639 300 639 330L639 330C639 362 633 393 623 421C613 449 599 475 582 500C565 525 546 548 525 570C503 591 482 612 460 632C438 652 417 670 397 688C376 706 359 724 344 741L344 741L340 741C325 724 308 706 288 688C268 670 246 651 225 632C203 612 181 591 160 570C139 548 119 525 103 500C86 475 72 449 62 421C51 393 46 362 46 330L46 330C46 301 50 275 58 254C67 232 78 214 92 200C106 186 121 175 139 168C157 161 176 158 195 158L195 158C214 158 231 160 245 165C260 170 274 177 285 185C297 193 308 203 317 213C326 224 333 235 340 246L340 246L344 246C351 235 359 224 368 213C377 203 387 193 399 185C411 177 424 170 439 165C454 160 471 158 489 158Z"/></svg>';

export const ICON_HEART_OUTLINE = '<svg class="ic-tx" viewBox="46 50 593 691" style="width:0.593em;height:0.691em;vertical-align:0.059em" fill="currentColor" aria-hidden="true"><path d="M489 158L489 158C508 158 527 161 545 168C563 175 579 186 593 200C607 214 618 232 626 254C634 275 639 300 639 330L639 330C639 362 633 393 623 421C613 449 599 475 582 500C565 525 546 548 525 570C503 591 482 612 460 632C438 652 417 670 397 688C376 706 359 724 344 741L344 741L340 741C325 724 308 706 288 688C268 670 246 651 225 632C203 612 181 591 160 570C139 548 119 525 103 500C86 475 72 449 62 421C51 393 46 362 46 330L46 330C46 301 50 275 58 254C67 232 78 214 92 200C106 186 121 175 139 168C157 161 176 158 195 158L195 158C214 158 231 160 245 165C260 170 274 177 285 185C297 193 308 203 317 213C326 224 333 235 340 246L340 246L344 246C351 235 359 224 368 213C377 203 387 193 399 185C411 177 424 170 439 165C454 160 471 158 489 158ZM107 330L107 330C107 356 112 380 120 404C129 427 140 448 153 469C167 489 182 509 199 527C216 545 234 562 251 578C269 594 286 609 302 623C318 637 332 651 343 663L343 663C355 651 368 638 384 623C400 609 417 594 434 578C452 562 469 545 486 527C503 509 518 489 531 469C545 448 556 427 564 404C573 381 577 356 577 330L577 330C577 310 575 293 570 279C566 264 560 252 552 243C544 234 535 228 524 223C513 219 502 217 489 217L489 217C470 217 454 221 439 228C424 236 411 246 399 258C387 270 376 284 367 299C358 314 349 330 342 345L342 345C335 330 326 314 317 299C308 284 298 270 286 258C274 246 261 236 246 228C231 221 214 217 195 217L195 217C183 217 171 219 161 223C150 227 141 234 133 243C125 252 119 264 114 279C110 293 107 310 107 330Z"/></svg>';
