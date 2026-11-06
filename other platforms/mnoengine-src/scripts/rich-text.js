// One renderer for every place the app shows authored or generated prose — the transcript, a world's
// description (on its card and in its details panel, whether it's your own world or one from the
// community) and the changelog. Kept in one module so `**bold**`, `*italic*` and `` `code` `` read
// identically everywhere, instead of each panel rolling its own regexes (they drifted: the same world
// description rendered markdown in the library panel but showed raw asterisks and collapsed paragraphs
// in the Explore panel).
//
// The source is escaped FIRST, so displayed text can never inject markup — the markers are turned into
// tags only after every angle bracket in the input is inert. Safe on other players' descriptions.

// Quotes are escaped too (not just &<>): callers reuse these renderers for attribute-adjacent
// spots, and an unescaped `"` there closes the attribute early (stored XSS).
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// `code` spans are lifted out first and swapped back at the very end: their contents must survive the
// bold/italic passes untouched (a literal `*` inside `` `a*b*c` `` is code, not a marker), and the
// placeholder holds nothing a later pass could match. Uses NUL, which cannot occur in the input.
const CODE_MARK = "\u0000";

function core(s, withQuotes, withMentions) {
  const codes = [];
  let out = esc(s).replace(/`([^`]+)`/g, (_, code) => {
    codes.push(code);
    return CODE_MARK + (codes.length - 1) + CODE_MARK;
  });
  // @mentions run on the escaped text while code contents are still lifted out, so a `@name`
  // inside `` `code` `` stays literal. The emitted button holds no `*`, backtick or `&quot;`,
  // and usernames can't contain them either — so the quote/bold/italic passes below wrap around
  // the button instead of breaking it (e.g. `**hey @Bob**` bolds the whole run, button included).
  if (withMentions) out = out.replace(MENTION_RE, (_, name) => mentionBtn(name));
  // Quotes arrive escaped as &quot; (esc runs first so text can never inject markup).
  // Match the entity, not a literal `"`, and re-emit the entity inside the span — visually
  // identical to `"` but still inert if this HTML is ever reused near an attribute (stored XSS).
  // Curly “…” arrive literally (esc leaves them alone) and highlight the same way.
  if (withQuotes) {
    out = out
      .replace(/&quot;([\s\S]*?)&quot;/g, '<span class="q">&quot;$1&quot;</span>')
      .replace(/“([^”]*?)”/g, '<span class="q">“$1”</span>');
  }
  out = out
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")   // bold before italic, so **a** is taken whole
    .replace(/\*([^*\n]+)\*/g, '<i class="em">$1</i>');
  return out.replace(new RegExp(CODE_MARK + "(\\d+)" + CODE_MARK, "g"), (_, i) => "<code>" + codes[+i] + "</code>");
}

// Inline marks only: `code`, **bold**, *italic*. Italic renders as `.em` — faded relative to the line
// it sits in (see styles.css).
export const inlineMd = (s) => core(s, false, false);

// `inlineMd` plus the transcript's two extras: "quoted speech" gets its own brighter tone, and newlines
// become real breaks (a world description separates its paragraphs with a blank line, which plain HTML
// would collapse into the previous sentence).
export const richText = (s) => core(s, true, false).replace(/\n/g, "<br>");

// ---------------------------------------------------------------------------
// @mentions — `@name` becomes a profile button reading like the author line
// ---------------------------------------------------------------------------
// The world detail panels (both of them, plus the Session tab's Currently Playing block) render
// descriptions and author's notes through this instead of `richText`, so a `@username` in the
// prose opens that user's profile exactly like the `by @author` button above it.
//
// Usernames are 3–20 characters: a letter/number first and last, with letters, numbers, spaces
// and `_. -` in the middle (see community.js `validateUsername` and the server's claim rules).
// The sync pass below matches single-token names only (no spaces) on purpose: a greedy
// multi-word match can't tell the name from the sentence around it ("@Winter fixed the bug"
// would link "Winter fixed the bug"). Names with spaces are upgraded afterwards by
// `renderWithResolvedMentions`, which only links the exact prefix the catalog confirms.
// The lookbehind keeps emails ("foo@bar.com") and handles ("a@b") plain: a mention starts at
// a word boundary, never mid-token.
const MENTION_RE = /(?<![\p{L}\p{N}_])@([\p{L}\p{N}][\p{L}\p{N}_.-]{1,18}[\p{L}\p{N}])/gu;
const mentionBtn = (name) =>
  `<button type="button" class="at-mention" data-mention="${esc(name)}">@${esc(name)}</button>`;

// `richText` plus the sync single-token mention pass. Every plausible `@token` links —
// even one the catalog has never heard of, which then lands on the profile page's existing
// "No user named @…" empty state rather than doing nothing.
export const richTextWithMentions = (s) => core(String(s == null ? "" : s), true, true).replace(/\n/g, "<br>");

// Greedy mention candidates for the async upgrade: `@` plus up to 20 valid name characters,
// spaces included. Each candidate is the longest text that *could* be a mention starting at
// its `@`; the resolver shrinks it word by word until the catalog confirms a prefix (so
// "@Aria the Grey is great" tries "Aria the Grey is awe…" — the 20-char cap may cut the last
// word short — then "Aria the Grey is", then links "Aria the Grey"). Positions are indexes
// into the source string, so the caller can splice exact spans after resolving.
const MENTION_CAND_RE = /(?<![\p{L}\p{N}_])@([\p{L}\p{N}][\p{L}\p{N} _.\-]{1,18}[\p{L}\p{N}])/gu;
export function mentionCandidates(s) {
  const src = String(s == null ? "" : s);
  const out = [];
  const re = new RegExp(MENTION_CAND_RE);
  let m;
  while ((m = re.exec(src))) out.push({ index: m.index, text: m[1] });
  return out;
}

// Render `source` with exact multi-word mentions plus the sync single-token fallback. `spans`
// are non-overlapping `{ start, end, name }` ranges over the source (start = the `@`, end =
// just past the mention's last character, name = the catalog's canonical casing). Each span
// is swapped for a U+0001 placeholder before rendering — U+0001 survives escaping and every
// marker pass untouched (the same trick code spans play with NUL, which is taken) — then swapped for the real button, so
// markdown around a spaced name (`**@Aria the Grey**`) formats without breaking the link.
const MENTION_MARK = "\u0001";
export function renderWithResolvedMentions(source, spans) {
  let text = String(source == null ? "" : source);
  const ordered = (Array.isArray(spans) ? spans : []).slice().sort((a, b) => b.start - a.start);
  const names = [];
  for (const sp of ordered) {
    if (!sp || !(sp.start >= 0) || !(sp.end > sp.start) || !sp.name) continue;
    names.push(String(sp.name));
    text = text.slice(0, sp.start) + MENTION_MARK + (names.length - 1) + MENTION_MARK + text.slice(sp.end);
  }
  let html = richTextWithMentions(text);
  for (let k = 0; k < names.length; k++) html = html.split(MENTION_MARK + k + MENTION_MARK).join(mentionBtn(names[k]));
  return html;
}

// Chat markdown for the Discussion page: ```code blocks```, `code`, **bold**,
// *italic* / _italic_, __underline__, ~~struck~~, ||spoiler|| (click to reveal), `> quote`
// single lines (consecutive ones group into one block) and `>>> ` rest-of-message quotes.
// Escape-first like everything else in this module, so other players' messages can never
// inject markup. Code contents survive every later pass untouched (same NUL trick as core);
// block-code slots use \u0001 so a fenced block survives line-splitting as one unit.
const BLOCK_MARK = "\x01";
const GT = "&gt;"; // '>' after esc()

function discInline(s) {
  return s
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")         // bold before italic, so **a** is taken whole
    .replace(/__([^_\n]+)__/g, "<u>$1</u>")
    .replace(/~~([^~\n]+)~~/g, "<s>$1</s>")
    .replace(/\*([^*\n]+)\*/g, '<i class="em">$1</i>')
    .replace(/(^|\W)_([^_\n]+)_(\W|$)/g, '$1<i class="em">$2</i>$3')
    .replace(/\|\|([^|\n]+)\|\|/g, '<span class="spoiler" tabindex="0" role="button" aria-label="Spoiler — activate to reveal">$1</span>');
}

export function chatMd(s) {
  const codes = [];   // inline `code` spans (CODE_MARK slots)
  const blocks = [];  // ```fenced``` blocks (BLOCK_MARK slots)
  let src = esc(s);
  src = src
    .replace(/```([\s\S]*?)```/g, (_, code) => {
      blocks.push(code.replace(/^\n/, "").replace(/^[A-Za-z0-9_+-]+[^\S\n]*\n/, ""));
      return BLOCK_MARK + (blocks.length - 1) + BLOCK_MARK;
    })
    .replace(/```[\s\S]*$/g, (rest) => { // unclosed fence runs to the end
      blocks.push(rest.slice(3).replace(/^\n/, "").replace(/^[A-Za-z0-9_+-]+[^\S\n]*\n/, ""));
      return BLOCK_MARK + (blocks.length - 1) + BLOCK_MARK;
    })
    .replace(/`([^`\n]+)`/g, (_, code) => {
      codes.push(code);
      return CODE_MARK + (codes.length - 1) + CODE_MARK;
    });
  const inlineRestore = (t) =>
    discInline(t).replace(new RegExp(CODE_MARK + "(\\d+)" + CODE_MARK, "g"), (_, i) => "<code>" + codes[+i] + "</code>");
  const blockHtml = (i) => `<pre class="disc-pre">${blocks[+i]}</pre>`;
  // A line holding block slots is split around them: text/code run inline, fences break the line.
  const renderLine = (line) => {
    const parts = line.split(new RegExp("(" + BLOCK_MARK + "\\d+" + BLOCK_MARK + ")", "g"));
    return parts.map((p) => {
      const m = new RegExp("^" + BLOCK_MARK + "(\\d+)" + BLOCK_MARK + "$").exec(p);
      return m ? `</div>${blockHtml(m[1])}<div class="disc-line">` : inlineRestore(p);
    }).join("");
  };
  let out = '<div class="disc-line">';
  let quoteBuf = [];
  const flushQuote = () => {
    if (!quoteBuf.length) return;
    out += `</div><div class="disc-quote">${quoteBuf.map(inlineRestore).join("<br>")}</div><div class="disc-line">`;
    quoteBuf = [];
  };
  let multi = null; // >>> rest-of-message quote: every remaining line joins it
  for (const line of src.split("\n")) {
    if (multi) { multi.push(line); continue; }
    if (line.startsWith(GT + GT + GT)) {
      multi = [line.slice((GT + GT + GT).length).replace(/^ /, "")];
      continue;
    }
    if (line.startsWith(GT + " ") || line === GT) {
      quoteBuf.push(line === GT ? "" : line.slice((GT + " ").length));
      continue;
    }
    flushQuote();
    out += renderLine(line) + "<br>";
  }
  flushQuote();
  if (multi) out += `</div><div class="disc-quote">${multi.map(inlineRestore).join("<br>")}</div><div class="disc-line">`;
  out += "</div>";
  // Tidy empties the structure leaves behind (blank lines, quote edges, adjacent breaks).
  out = out.replace(/<br><\/div>/g, "</div>");
  out = out.replace(/(<div class="disc-line"><\/div>)+$/g, "");
  out = out.replace(/<div class="disc-line"><\/div>/g, "");
  return out || inlineRestore("");
}
