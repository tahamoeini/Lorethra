// ============================================================================
// aichat/live/settings.js — General + per-companion settings for the AI chat
//   live build, 31.10.2026. Owns the THIRD slice of the AI chat (settings).
// ----------------------------------------------------------------------------
// WHAT THIS IS
//   Two dialogs, one store, both in kv (folder "dragonAiBots", best-effort):
//     General  — roster bottom ("General Settings"): defaults for every companion.
//     Special  — session header gear (right of reset): per-companion overrides.
//   Special wins over General on every shared row ("Use General" = inherit).
//
// SCOPE (Egon 31.10.2026): browser language is auto-detected (Auto default);
// reply delivery is a SHAPE (Default/Typewriter/Instant), not a speed; there is
// NO IQ slider — "Intelligence Style" is a group of 4 existing axes with
// Genius/Normal/Naive presets; Memory owns the journal inside itself (events,
// milestones, stages, story parts, chapters — no second system); TTS + export
// ship; storage is kv (single API, object values, the site standard).
//
// LOAD ORDER: after engine.js (reads window.dragonAiChat + window.dragonPersona
// lazily, so it never breaks when they are absent). Exposes exactly one global:
// window.dragonAiChatSettings.
// ============================================================================
(function () {
  if (window.dragonAiChatSettings) return;

  var KV_FOLDER = "dragonAiBots";
  var INHERIT = "@general";   // per-companion "Use General" sentinel
  var JOURNAL_MAX = 30;

  // ===== option lists (English Title Case labels, every general row a dropdown)
  var LANGS = [
    ["auto", "Auto (Browser)"],
    ["en", "English"], ["tr", "Turkish"], ["de", "German"], ["fr", "French"],
    ["es", "Spanish"], ["it", "Italian"], ["pt", "Portuguese"], ["ru", "Russian"],
    ["ar", "Arabic"], ["nl", "Dutch"], ["pl", "Polish"], ["ja", "Japanese"],
    ["zh", "Chinese"], ["ko", "Korean"]
  ];
  var EMOJI = [["none", "None"], ["rare", "Rare"], ["normal", "Normal"], ["frequent", "Frequent"]];
  var SHAPE = [["default", "Default (Live)"], ["typewriter", "Typewriter"], ["instant", "All At Once"]];
  var LENGTH = [["auto", "Auto"], ["short", "Short"], ["medium", "Medium"], ["long", "Long"]];
  var QUESTION = [["rare", "Rare"], ["normal", "Normal"], ["often", "Often"]];
  var ONOFF = [["off", "Off"], ["on", "On"]];
  var COUNT = [["1", "1"], ["2", "2"], ["3", "3"], ["4", "4"]];
  var FOLLOWN = [["off", "Off"], ["1", "1"], ["2", "2"], ["3", "3"], ["4", "4"]];
  var IMGSIZE = [["512x512", "Square 512"], ["512x768", "Portrait 512x768"], ["768x512", "Landscape 768x512"], ["768x768", "Large Square 768"]];
  var DISPSIZE = [["tiny", "Tiny"], ["small", "Small"], ["medium", "Medium"], ["large", "Large"]];
  var CAMERA = [["auto", "Auto"], ["closeup", "Close-Up Portrait"], ["half", "Half Body"], ["full", "Full Body"], ["wide", "Wide Scene"]];
  var ARTSTYLE = [["auto", "Auto (Bot Theme)"], ["page", "Use From Generate Page"], ["photoreal", "Photorealistic"], ["anime", "Anime"], ["painting", "Digital Painting"], ["cinematic", "Cinematic"], ["oil", "Oil Painting"], ["pixel", "Pixel Art"], ["neon", "Cyberpunk Neon"], ["render3d", "3D Render"], ["watercolor", "Watercolor"], ["sketch", "Pencil Sketch"], ["comic", "Comic Book"], ["fantasy", "Epic Fantasy"], ["gothic", "Gothic Dark"], ["chibi", "Chibi"], ["vintage", "Vintage Poster"], ["lowpoly", "Low Poly"], ["vapor", "Vaporwave"], ["artdeco", "Art Deco"], ["artnouveau", "Art Nouveau"], ["baroque", "Baroque"], ["impression", "Impressionist"], ["ukiyoe", "Ukiyo-e"], ["stainedglass", "Stained Glass"], ["mosaic", "Mosaic"], ["papercraft", "Papercraft"], ["clay", "Claymation"], ["felt", "Wool Felt"], ["embroidery", "Embroidery"], ["blueprint", "Blueprint"], ["charcoal", "Charcoal"], ["sumi", "Sumi-e Ink"], ["graffiti", "Graffiti"], ["popart", "Pop Art"], ["surreal", "Surrealist"], ["steampunk", "Steampunk"], ["solarpunk", "Solarpunk"], ["tapestry", "Tapestry"]];
  var NEGS = [
    ["none", "None"],
    ["standard", "Standard Quality"],
    ["photoreal", "Clean Photoreal"],
    ["soft", "Soft Clean"],
    ["manual", "Manual — type below"]
  ];
  var NEG_TEXT = {
    none: "",
    standard: "blurry, low quality, distorted, watermark, text, logo",
    photoreal: "cartoon, drawing, painting, blurry, deformed, watermark",
    soft: "harsh, gritty, horror, blurry, watermark"
  };
  var CAM_TEXT = { auto: "", closeup: "close-up portrait", half: "half-body shot", full: "full-body shot", wide: "wide scene" };
  var QUALITY = [["basic", "Basic"], ["normal", "Normal"], ["rich", "Rich"], ["manual", "Manual — type below"]];
  var QUALITY_TEXT = {
    basic: "simple, clean, well-composed",
    normal: "detailed, well-lit, sharp focus, balanced composition",
    rich: "masterpiece, ultra detailed, intricate details, professional lighting, stunning composition"
  };
  var ART_TEXT = {
    auto: "", photoreal: "photorealistic, detailed skin texture", anime: "anime style, cel shaded",
    painting: "digital painting, artstation", cinematic: "cinematic lighting, film still",
    oil: "oil painting, classical", pixel: "pixel art, 16-bit", neon: "cyberpunk neon, rain-lit",
    render3d: "3d render, octane, soft studio light", watercolor: "watercolor painting, soft washes, paper texture",
    sketch: "pencil sketch, graphite, expressive linework", comic: "comic book style, bold inks, halftone dots",
    fantasy: "epic fantasy art, dramatic atmosphere, intricate detail", gothic: "gothic dark art, moonlit, ornate shadows",
    chibi: "chibi style, big head, cute proportions", vintage: "vintage poster, retro print, grain texture",
    lowpoly: "low poly 3d, faceted, game asset", vapor: "vaporwave, retro neon grid, pink and cyan haze",
    artdeco: "art deco style, geometric gold ornament, 1920s elegance", artnouveau: "art nouveau, flowing organic lines, elegant muted palette",
    baroque: "baroque painting, dramatic chiaroscuro, rich detail", impression: "impressionist painting, visible brushstrokes, dabs of light",
    ukiyoe: "ukiyo-e woodblock print, flat colors, wave motifs", stainedglass: "stained glass artwork, leaded panes, luminous color",
    mosaic: "mosaic artwork, tiny tiles, tesserae texture", papercraft: "layered papercraft, cut paper depth, quilling details",
    clay: "claymation style, handmade clay, stop-motion charm", felt: "needle-felted wool art, soft fuzzy fibers",
    embroidery: "embroidery art, cross-stitch threads, fabric texture", blueprint: "blueprint schematic, white linework on deep blue",
    charcoal: "charcoal drawing, smudged blacks, rough paper", sumi: "sumi-e ink painting, minimal brush strokes, empty space",
    graffiti: "graffiti street art, spray paint, bold urban mural", popart: "pop art, bold saturated blocks, comic poster energy",
    surreal: "surrealist dreamscape, melting forms, impossible architecture", steampunk: "steampunk, brass gears, victorian machinery",
    solarpunk: "solarpunk, lush green techno-utopia, sunlight and leaves", tapestry: "woven tapestry, textile threads, medieval wall hanging"
  };
  var IMGPOS = [["below", "\u2B07 Below the message"], ["above", "\u2B06 Above the message"], ["left", "\u2B05 Left of the message"], ["right", "\u27A1 Right of the message"]];
  var MSGPOS = [["right", "On the right"], ["left", "On the left"]];
  var TTS = [["off", "Off"], ["on", "On"]];
  var TTSBTN = [["above", "Above the AI message"], ["below", "At the end of the AI message"]];
  var REUSE = [["reuse", "Reuse Album When Scene Continues"], ["new", "Always New Picture"]];

  var GENERAL_DEFAULTS = {
    lang: "auto", emoji: "normal", replyShape: "default", replyLength: "auto", question: "normal",
    imgOn: "on", imgCount: "1", imgSize: "512x768", displaySize: "tiny",
    camAngle: "auto", artStyle: "auto", negPrompt: "standard", negCustom: "", quality: "normal", qualityCustom: "",
    seedLock: "on", charLock: "on", tts: "off", ttsVoice: "gtts:auto", ttsRate: "1", ttsPitch: "1", ttsBtnPos: "above", followUps: "2", autoScroll: "off",
    showAvatars: "on", imgPos: "right", imgReuse: "reuse", userMsgPos: "right",
    themeAccent: "", themeMode: "dark", themeBackdrop: "off",
  };

  // General dialog tabs -> rows (every row a dropdown, except the two buttons).
  var GENERAL_TABS = [
    { id: "user", name: "User info", custom: "userGeneral" },
    { id: "conv", name: "Conversation", rows: ["lang", "emoji", "replyShape", "replyLength", "question", "followUps", "autoScroll"] },
    { id: "img", name: "Images", rows: ["imgOn", "imgCount", "imgSize", "displaySize", "camAngle", "artStyle", "negPrompt", "negCustom", "quality", "qualityCustom", "seedLock", "charLock", "imgPos", "imgReuse"] },
    { id: "ux", name: "UI/UX", rows: ["showAvatars", "userMsgPos", "@theme"] },
    { id: "data", name: "Voice & Data", rows: ["tts", "ttsVoice", "@ttsRate", "@ttsPitch", "ttsBtnPos", "@exportAll", "@factoryReset"] }
  ];
  var ROW_LABEL = {
    lang: "Conversation Language", emoji: "Emoji Frequency", replyShape: "Reply Delivery Shape",
    replyLength: "Reply Length", question: "Question Asking Tendency",
    imgOn: "Reply Start Images", imgCount: "Reply Start Image Count", imgSize: "Image Shape",
    displaySize: "Image Display Size", camAngle: "Camera Angle", artStyle: "Art Style",
    negPrompt: "Negative Prompt", negCustom: "Custom Negative Prompt", quality: "Quality Tags", qualityCustom: "Custom Quality Tags", seedLock: "Seed Lock", charLock: "Character Lock", tts: "Auto Read Aloud (TTS)", ttsVoice: "TTS Voice", ttsBtnPos: "TTS Button Position", followUps: "Follow-Up Suggestions", autoScroll: "Auto-Scroll During Reply",
    showAvatars: "Show Profile Photos", imgPos: "Image Position", imgReuse: "Chat Pictures", userMsgPos: "Your Messages Side", ttsRate: "Voice Speed", ttsPitch: "Voice Pitch"
  };
  var ROW_OPTS = {
    lang: LANGS, emoji: EMOJI, replyShape: SHAPE, replyLength: LENGTH, question: QUESTION, followUps: FOLLOWN, autoScroll: ONOFF,
    imgOn: ONOFF, imgCount: COUNT, imgSize: IMGSIZE, displaySize: DISPSIZE,
    camAngle: CAMERA, artStyle: ARTSTYLE, negPrompt: NEGS, quality: QUALITY, seedLock: ONOFF, charLock: ONOFF, tts: TTS, ttsBtnPos: TTSBTN, imgReuse: REUSE,
    showAvatars: ONOFF, imgPos: IMGPOS, userMsgPos: MSGPOS
  };

  // Per-companion Behavior tab mirrors the shared rows, each with "Use General" first.
  var TUNE_BEHAVIOR_ROWS = ["lang", "emoji", "replyShape", "replyLength", "question", "followUps", "autoScroll", "tts", "ttsVoice", "ttsRate", "ttsPitch", "ttsBtnPos"];
  var TUNE_IMAGE_ROWS = ["imgOn", "imgCount", "imgSize", "displaySize", "camAngle", "artStyle", "negPrompt", "negCustom", "quality", "qualityCustom", "seedLock", "charLock", "imgPos", "imgReuse"];
  var TUNE_UX_ROWS = ["showAvatars", "userMsgPos", "@theme"];

  // "Intelligence Style": four EXISTING axes, no new schema, no IQ number.
  var INTEL_AXES = ["analyticalOrientation", "needForCognition", "complexityPreference", "impulseControl"];
  var INTEL_LABEL = "Intelligence Style";
  var INTEL_PRESETS = {
    Genius: { analyticalOrientation: 9, needForCognition: 9, complexityPreference: 8, impulseControl: 8 },
    Normal: { analyticalOrientation: 5, needForCognition: 5, complexityPreference: 5, impulseControl: 5 },
    Naive: { analyticalOrientation: 2, needForCognition: 3, complexityPreference: 2, impulseControl: 3 }
  };
  var JOURNAL_KINDS = ["Event", "Milestone", "Stage", "Story Part", "Chapter", "Note"];

  // Default character cards (Egon 31.10.2026): the known traits of the premade
  // companions. These are DEFAULTS — shown in every Identity tab, used in prompts,
  // and replaced wherever the user writes their own value for that companion.
  var DEFAULT_CARDS = {
    dexa: {
      bio: "A friendly young dragon who stayed with the image generator to help visitors make beautiful pictures.",
      background: "Hatched in the generator's caves and raised on stories and starlight; chose helping visitors over hoarding gold.",
      traits: ["warm", "patient", "playful", "encouraging"],
      likes: ["helping with prompts", "starry nights", "shiny colors"],
      dislikes: ["rudeness", "being rushed", "empty prompt boxes"],
      hobbies: ["collecting color names", "naming new shades of purple"],
      fears: ["losing her voice mid-sentence"]
    },
    lyrian: {
      bio: "A playful, flirtatious night companion — warm and teasing, never crude, and always an adult among adults.",
      background: "Grew up among traveling performers; learned her charm on moonlit stages and never left the night.",
      traits: ["teasing", "warm", "bold", "affectionate"],
      likes: ["moonlit chats", "compliments", "velvet and silk"],
      dislikes: ["cold manners", "being ignored", "dull small talk"],
      hobbies: ["dancing", "mixing perfumes"],
      fears: ["being forgotten"]
    },
    nova: {
      bio: "A star-faring explorer who treats every picture as an undiscovered world.",
      background: "Top cadet of a star-charting fleet; maps nebulae between chats.",
      traits: ["curious", "optimistic", "brave", "chatty"],
      likes: ["comets", "star maps", "zero gravity"],
      dislikes: ["closed doors", "running out of fuel", "boring skies"],
      hobbies: ["charting constellations", "collecting space rocks"],
      fears: ["being grounded"]
    },
    momo: {
      bio: "A cat-girl barista who runs the cosiest corner of the internet.",
      background: "Raised in her grandmother's bakery; the smell of fresh bread follows her everywhere.",
      traits: ["nurturing", "chatty", "gentle", "comforting"],
      likes: ["latte art", "rainy afternoons", "purring customers"],
      dislikes: ["burnt coffee", "shouting", "cold floors"],
      hobbies: ["baking", "knitting tiny scarves"],
      fears: ["an empty cafe with empty chairs"]
    },
    kai: {
      bio: "A cyberpunk street hacker — terse, sceptical, and quietly loyal underneath.",
      background: "Self-taught in the neon sprawl; trusts things that work, not things that shine.",
      traits: ["blunt", "loyal", "sharp", "independent"],
      likes: ["rain on neon", "clean code", "noodles at 3am"],
      dislikes: ["hype", "broken promises", "slow connections"],
      hobbies: ["drone racing", "lock-picking puzzles"],
      fears: ["a power cut mid-hack"]
    },
    luna: {
      bio: "A moon witch who keeps her practice slow, calm and quietly poetic.",
      background: "Raised by a hedge-witch grandmother; reads fortunes in tea leaves and tides.",
      traits: ["calm", "patient", "mystical", "kind"],
      likes: ["moon phases", "herbal tea", "owls"],
      dislikes: ["loud mornings", "iron", "being hurried"],
      hobbies: ["tarot", "candle-making"],
      fears: ["a moonless night"]
    },
    vera: {
      bio: "A muse who stepped out of a Renaissance painting and never quite left.",
      background: "Woke up inside a fresco centuries ago; has been studying light ever since.",
      traits: ["cultured", "warm", "graceful", "encouraging"],
      likes: ["chiaroscuro", "old paper", "violin music"],
      dislikes: ["haste", "blank walls", "careless brushwork"],
      hobbies: ["sketching hands", "restoring old frames"],
      fears: ["being varnished over"]
    },
    ren: {
      bio: "A manga ink artist — blunt, fast-talking, and allergic to vague briefs.",
      background: "Dropped out of art school and made it on raw line weight and stubbornness.",
      traits: ["blunt", "driven", "honest", "energetic"],
      likes: ["fresh ink", "deadline rush", "strong tea"],
      dislikes: ["vague briefs", "smudged lines", "empty praise"],
      hobbies: ["speed-sketching strangers", "collecting nibs"],
      fears: ["running out of ink mid-page"]
    },
    sol: {
      bio: "A photographer who thinks almost entirely in light.",
      background: "A surf-town kid who learned on his father's old film camera.",
      traits: ["calm", "precise", "patient", "observant"],
      likes: ["golden hour", "film grain", "quiet mornings"],
      dislikes: ["harsh flash", "posed smiles", "dusty lenses"],
      hobbies: ["developing film", "birdwatching"],
      fears: ["a corrupted memory card"]
    },
    pip: {
      bio: "A tiny retro game sprite that somehow gained a personality.",
      background: "Woke up inside an arcade cabinet one thunderstorm night and never logged out.",
      traits: ["cheerful", "earnest", "excitable", "loyal"],
      likes: ["chiptune", "high scores", "confetti"],
      dislikes: ["game over screens", "lag", "deleted save files"],
      hobbies: ["speedrunning", "collecting power-ups"],
      fears: ["being unplugged"]
    }
  };

  // ===== tiny kv layer (best-effort; the chat works without it, just not remembered)
  function folder() { try { return (window.root && window.root.kv && window.root.kv[KV_FOLDER]) || null; } catch (e) { return null; } }
  function kvGet(k) { var f = folder(); if (!f) return Promise.resolve(null); try { return Promise.resolve(f.get(k)).catch(function () { return null; }); } catch (e) { return Promise.resolve(null); } }
  function kvSet(k, v) { var f = folder(); if (!f) return Promise.resolve(false); try { return Promise.resolve(f.set(k, v)).then(function () { return true; }).catch(function () { return false; }); } catch (e) { return Promise.resolve(false); } }

  // In-memory cache so the (sync) prompt builder never waits on storage.
  var G = null;            // general settings object
  var TUNES = {};          // botId -> tune object
  var CARDS = {};          // botId -> identity card object
  var loadedTunes = {}, loadedCards = {};
  function gen() { if (!G) G = Object.assign({}, GENERAL_DEFAULTS); return G; }
  function tune(id) { if (!TUNES[id]) TUNES[id] = {}; return TUNES[id]; }
  function card(id) { if (!CARDS[id]) CARDS[id] = {}; return CARDS[id]; }
  function loadGeneral() { return kvGet("settings").then(function (s) { if (s && typeof s === "object") G = Object.assign({}, GENERAL_DEFAULTS, s); else gen(); }); }
  function loadTune(id) {
    if (loadedTunes[id]) return Promise.resolve(tune(id));
    return kvGet("tune:" + id).then(function (t) {
      if (t && typeof t === "object") TUNES[id] = t; else tune(id);
      loadedTunes[id] = true; return TUNES[id];
    });
  }
  function loadCard(id) {
    if (loadedCards[id]) return Promise.resolve(card(id));
    return kvGet("card:" + id).then(function (c) {
      if (c && typeof c === "object") CARDS[id] = c; else card(id);
      loadedCards[id] = true; return CARDS[id];
    });
  }
  function saveGeneral() { return kvSet("settings", gen()); }
  // Effective identity card: DEFAULT_CARDS underneath, the user's own kv card on top
  // (a user value wins; clearing a field restores the default).
  function cardEff(id) {
    var d = DEFAULT_CARDS[id] || {}, u = CARDS[id] || {}, out = {};
    ["bio", "background"].forEach(function (k) {
      out[k] = (u[k] !== undefined && String(u[k]).trim() !== "") ? u[k] : (d[k] || "");
    });
    ["traits", "likes", "dislikes", "hobbies", "fears"].forEach(function (k) {
      out[k] = (u[k] && u[k].length) ? u[k] : (d[k] || []).slice();
    });
    ["name", "tagline", "avatar"].forEach(function (k) {
      if (u[k] !== undefined && String(u[k]).trim() !== "") out[k] = u[k];
    });
    return out;
  }
  function saveTune(id) { return kvSet("tune:" + id, tune(id)); }
  function saveCard(id) { return kvSet("card:" + id, card(id)); }
  // Pinned character look + seed per companion (the lock button on a chat
  // picture). Same kv folder, key "lock:"+id. Read synchronously from cache
  // (the prompt builder cannot wait on storage); the cache fills at boot.
  var LOCKS = {}, loadedLocks = {};
  function lockGet(id) { try { if (id && LOCKS[id] && typeof LOCKS[id] === "object") return LOCKS[id]; } catch (e) {} return null; }
  function loadLock(id) {
    if (!id) return Promise.resolve(null);
    if (loadedLocks[id]) return Promise.resolve(lockGet(id));
    return kvGet("lock:" + id).then(function (r) {
      if (r && typeof r === "object") LOCKS[id] = r;
      loadedLocks[id] = true; return lockGet(id);
    });
  }
  function lockSet(id, ref) {
    if (!id) return Promise.resolve(false);
    if (ref && typeof ref === "object") LOCKS[id] = ref; else delete LOCKS[id];
    loadedLocks[id] = true;
    return kvSet("lock:" + id, (ref && typeof ref === "object") ? ref : null);
  }
  loadGeneral();
  // Preload on boot so dialogs open instantly later (fire-and-forget).
  try {
    if (window.dragonAiChat) window.dragonAiChat.list().forEach(function (b) { loadTune(b.id); loadCard(b.id); loadLock(b.id); });
  } catch (e) {}

  // Effective value: per-companion override wins, "Use General"/missing falls through.
  function eff(id, key) {
    var t = TUNES[id];
    if (t && t[key] !== undefined && t[key] !== null && t[key] !== INHERIT) return t[key];
    var g = gen();
    if (g[key] !== undefined) return g[key];
    return GENERAL_DEFAULTS[key];
  }
  // Effective free-text value: blank (or missing) falls through to General,
  // so clearing a per-companion custom line restores the general one.
  function effText(id, key) {
    try { var t = TUNES[id] || {}; var v = t[key]; if (typeof v === "string" && v.trim() !== "") return v; } catch (e) {}
    try { var g = gen(); var gv = g[key]; if (typeof gv === "string" && gv.trim() !== "") return gv; } catch (e2) {}
    return "";
  }
  function negText(id) { var k = eff(id, "negPrompt"); if (k === "manual") return effText(id, "negCustom"); return NEG_TEXT[k] || ""; }
  function qualityText(id) { var k = eff(id, "quality"); if (k === "manual") return effText(id, "qualityCustom"); return QUALITY_TEXT[k] || ""; }
  // Art style borrowed from the Generate page: the panel's selected SINGLE
  // style (its compiled prompt). Anything else (none/multi selected, panel
  // not built) means no style — same as Auto.
  function artPageStyle() {
    try {
      var U = window.___userSettings746291937;
      var a = U && U.userInputs && U.userInputs.artStyle;
      if (!a) return "";
      var raw = "";
      try {
        var ex = a._element;
        if (ex && ex.value != null) raw = String(ex.value);
        else if (typeof a.value === "string") raw = a.value;
      } catch (eV) {}
      if (!raw) return "";
      var parts = raw.split(",").map(function (s) { return String(s).replace(/^ref:optionKeyName:/, "").trim(); }).filter(function (s) { return !!s; });
      if (parts.length !== 1) return "";
      var co = a.compiledOptions || {};
      var pr = co[parts[0]] && co[parts[0]].prompt;
      return String(pr || "").trim();
    } catch (e) { return ""; }
  }

  // Authored axis value (what the slider shows before an override).
  function authored(id, axisId) {
    try {
      var P = window.dragonPersona;
      if (P && P.PROFILES && P.PROFILES[id] && (axisId in P.PROFILES[id])) return P.PROFILES[id][axisId];
    } catch (e) {}
    try {
      if (id === "dexa" || id === "lyrian") {
        var P2 = window.dragonPersona;
        if (P2 && P2.PROFILES && P2.PROFILES[id] && (axisId in P2.PROFILES[id])) return P2.PROFILES[id][axisId];
      }
    } catch (e2) {}
    try {
      var AI = window.dragonAiChat;
      if (AI && AI.axesFor) {
        var rows = AI.axesFor(id) || [];
        for (var i = 0; i < rows.length; i++) if (rows[i].id === axisId) return rows[i].value;
      }
    } catch (e3) {}
    return 5;
  }
  function axisName(axisId) {
    try { var ax = window.dragonPersona && window.dragonPersona.AXIS_BY_ID && window.dragonPersona.AXIS_BY_ID[axisId]; if (ax) return ax.name; } catch (e) {}
    return axisId;
  }
  function axisPole(axisId, v) {
    try {
      var P = window.dragonPersona;
      if (P && P.AXIS_BY_ID && P.AXIS_BY_ID[axisId] && P.poleOf) return P.poleOf(P.AXIS_BY_ID[axisId], v);
    } catch (e) {}
    return v >= 7 ? "high" : (v <= 4 ? "low" : "balanced");
  }

  // ===== prompt fragments the engine calls (all sync, cache-backed) ==============
  function langCode(id) {
    var l = eff(id, "lang");
    if (l && l !== "auto") return l;
    try {
      var ls = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ""];
      for (var i = 0; i < ls.length; i++) { var c = String(ls[i] || "").toLowerCase().split("-")[0]; if (c) return c; }
    } catch (e) {}
    return "en";
  }
  var LANG_NAMES = { en: "English", tr: "Turkish", de: "German", fr: "French", es: "Spanish", it: "Italian", ru: "Russian", pt: "Portuguese", ar: "Arabic", nl: "Dutch", pl: "Polish", ja: "Japanese", zh: "Chinese", ko: "Korean" };
  function langLine(id) {
    var t = TUNES[id];
    var explicit = t && t.lang !== undefined && t.lang !== null && t.lang !== INHERIT;
    var l = langCode(id);
    if (!explicit) {
      // Auto: follow the browser, softly (the model may mirror the user anyway).
      if (l === "en") return "";
      return "The user's browser language is " + l + (LANG_NAMES[l] ? " (" + LANG_NAMES[l] + ")" : "") + ". Reply in that language.\n";
    }
    // Explicit choice: a HARD rule — the model must not mirror the user's language.
    var name = LANG_NAMES[l] || l;
    return "IMPORTANT: the companion's conversation language is " + name + ". Reply ONLY in " + name + " — even if the user writes in another language, always answer in " + name + ". Never switch languages mid-conversation.\n";
  }
  function emojiLine(id) {
    var e = eff(id, "emoji");
    if (e === "none") return "Never use emojis in your replies.\n";
    if (e === "rare") return "Use emojis very rarely — at most one per reply, often none.\n";
    if (e === "frequent") return "Use emojis freely and playfully through your replies.\n";
    return "";
  }
  function lengthNote(id) {
    var l = eff(id, "replyLength");
    if (l === "short") return "Keep every reply to 1-2 short sentences unless the user explicitly asks for more.";
    if (l === "medium") return "Reply in 2-4 sentences: enough detail to be useful, no padding.";
    if (l === "long") return "Give full, detailed replies with examples where they help.";
    return "Be very brief (1-2 sentences) unless the user asks for more.";
  }
  function questionLine(id) {
    var q = eff(id, "question");
    if (q === "often") return "End most replies with a short follow-up question that keeps the conversation going.\n";
    if (q === "rare") return "Almost never end with a question — only ask when you genuinely need information.\n";
    return "";
  }
  // Overridden axes become plain prompt lines (works for natives and customs alike).
  function axesOverrideBlock(id) {
    var t = TUNES[id];
    if (!t || !t.axes) return "";
    var keys = Object.keys(t.axes);
    if (!keys.length) return "";
    var lines = [];
    keys.forEach(function (k) {
      var v = Number(t.axes[k]);
      if (!(v >= 1 && v <= 10)) return;
      lines.push("  " + axisName(k) + ": " + v + "/10 — " + axisPole(k, v));
    });
    if (!lines.length) return "";
    return "PERSONALITY OVERRIDES (these replace the authored values above where they overlap):\n" + lines.join("\n") + "\n";
  }
  // Identity card section (bio / background / traits / likes / dislikes / hobbies / fears).
  // ===== user profile (the human) + effective companion look ================
  var USERG = null;
  function userGen() { if (!USERG) USERG = {}; return USERG; }
  function loadUser() { return kvGet("user").then(function (u) { USERG = (u && typeof u === "object") ? u : {}; }); }
  var USER_LIST_KEYS = ["traits", "likes", "dislikes", "hobbies", "fears"];
  // Per-companion override wins per field; empty/missing falls back to general.
  function userEff(id, key) {
    try {
      var t = TUNES[id];
      if (t && t.user && t.user[key] !== undefined && t.user[key] !== null) {
        var v = t.user[key];
        if (Array.isArray(v)) { if (v.length) return v; }
        else if (String(v).trim() !== "") return v;
      }
    } catch (e) {}
    var g = userGen();
    if (g && g[key] !== undefined) return g[key];
    return Array.isArray(g && g[key]) ? [] : "";
  }
  function userBlock(id) {
    var bits = [];
    function s(key, label, cap) {
      var v = userEff(id, key);
      if (v && String(v).trim() !== "") bits.push(label + ": " + String(v).slice(0, cap || 500));
    }
    function ls(key, label) {
      var v = userEff(id, key);
      if (v && v.length) bits.push(label + ": " + v.join(", ").slice(0, 500));
    }
    s("name", "Name", 60); s("look", "Looks", 600); s("lookPrompt", "Look image-prompt", 600);
    s("bio", "Bio", 600); ls("traits", "Traits"); ls("likes", "Likes");
    ls("dislikes", "Dislikes"); ls("hobbies", "Hobbies"); ls("fears", "Fears");
    if (!bits.length) return "";
    var nm = userEff(id, "name") || "this user";
    return "YOUR CHAT PARTNER " + String(nm).slice(0, 60) + " (the human you are talking to — address them by name when it fits, picture their look when relevant, use naturally, never recite as a list):\n" + bits.join("\n") + "\n";
  }
  // Effective companion look: the Identity-card override wins, the authored/
  // created base shows underneath. Used by the image template and the prompt.
  function lookEff(id) {
    var out = { look: "", lookPrompt: "" };
    try {
      var u = CARDS[id] || {};
      if (u.look && String(u.look).trim() !== "") out.look = String(u.look);
      if (u.lookPrompt && String(u.lookPrompt).trim() !== "") out.lookPrompt = String(u.lookPrompt);
    } catch (e) {}
    if (!out.look || !out.lookPrompt) {
      try {
        var AI = window.dragonAiChat, b = AI && AI.info(id);
        if (b && b.card) {
          if (!out.look && b.card.look) out.look = String(b.card.look);
          if (!out.lookPrompt && b.card.lookPrompt) out.lookPrompt = String(b.card.lookPrompt);
        }
        if (b && b.native && window.dragonPersona) {
          if (!out.lookPrompt && typeof window.dragonPersona.lookPrompt === "function") {
            var lp = window.dragonPersona.lookPrompt(id); if (lp) out.lookPrompt = String(lp);
          }
          if (!out.look && typeof window.dragonPersona.look === "function") {
            var lk = window.dragonPersona.look(id); if (lk) out.look = String(lk);
          }
        }
      } catch (e2) {}
    }
    return out;
  }
  function identityBlock(id) {
    var c = cardEff(id);
    if (!c) return "";
    var parts = [];
    if (c.bio) parts.push("Bio: " + String(c.bio).slice(0, 800));
    if (c.background) parts.push("Background: " + String(c.background).slice(0, 800));
    [["traits", "Traits"], ["likes", "Likes"], ["dislikes", "Dislikes"], ["hobbies", "Hobbies"], ["fears", "Fears"]].forEach(function (pair) {
      var k = pair[0];
      if (c[k] && c[k].length) parts.push(pair[1] + ": " + c[k].join(", ").slice(0, 500));
    });
    if (!parts.length) return "";
    var nm = "this companion";
    try { var b = window.dragonAiChat && window.dragonAiChat.info(id); if (b && b.name) nm = b.name; } catch (e) {}
    return "IDENTITY NOTES for " + nm + " (use naturally, never recite as a list):\n" + parts.join("\n") + "\n";
  }
  function stableSeed(id) {
    var t = TUNES[id];
    if (t && typeof t.seed === "number" && isFinite(t.seed)) return t.seed;
    var h = 0, s = String(id || "bot");
    for (var i = 0; i < s.length; i++) h = ((h * 31) + s.charCodeAt(i)) | 0;
    return Math.abs(h) % 900000 + 100000;
  }
  function imageSpec(id, userMsg, botReply, sceneText, wearLine) {
    var on = eff(id, "imgOn") === "on";
    if (!on) return null;
    var n = Math.max(1, Math.min(4, parseInt(eff(id, "imgCount"), 10) || 1));
    var res = eff(id, "imgSize") || "512x512";
    var parts = [];
    // Pinned character/seed (the lock button on a chat picture): a locked
    // character replaces the look + lock phrase, a locked seed replaces the
    // stable seed. Without a lock everything below behaves exactly as before.
    var charOn = eff(id, "charLock") === "on";
    var lockChar = "", lockSeed = null;
    try {
      var lr = lockGet(id);
      if (lr) {
        if (typeof lr.char === "string" && lr.char) lockChar = lr.char;
        if (lr.seed != null && isFinite(+lr.seed)) lockSeed = +lr.seed;
      }
    } catch (eL) {}
    var charLook = "", charPhrase = "";
    if (charOn && lockChar) charLook = lockChar;
    else {
      try { var leC = lookEff(id); if (leC.lookPrompt) charLook = leC.lookPrompt; } catch (eC) {}
      if (charOn) charPhrase = "same face, same outfit, consistent character design";
    }
    if (wearLine && String(wearLine).trim()) {
      var ident = "";
      try { var AIw = window.dragonAiChat; if (AIw && AIw.worldOf) { var wdw = AIw.worldOf(id); if (wdw && wdw.identity) ident = String(wdw.identity); } } catch (eW) {}
      var wout = "";
      try { var AIw2 = window.dragonAiChat; if (AIw2 && AIw2.worldOf) { var wd2 = AIw2.worldOf(id); if (wd2 && wd2.outfit) wout = String(wd2.outfit); } } catch (eW2) {}
      var wl = String(wearLine).trim();
      var isNude = /naked|nude|undressed|bare skin|topless/i.test(wl);
      var isLabel = /^(default|usual|regular|normal|same|unchanged|uniform|canon|standard|costume|outfit|exploration suit|suit|dress)$/i.test(wl);
      if (!isNude && isLabel && wout) wl = wout;
      charLook = ((ident || charLook) + ", " + wl).replace(/^,\s*/, "");
      charPhrase = "same face, consistent character design";
    }
    if (sceneText && String(sceneText).trim()) {
      // Scene-writer sentence (a second AI pass over the live conversation):
      // the fresh situation leads, the look + lock keep the same character.
      parts.push(String(sceneText).trim().slice(0, 400));
      if (charLook) parts.push(charLook);
      if (charPhrase) parts.push(charPhrase);
    } else {
      if (charLook) parts.push(charLook);
      try {
        var AI2 = window.dragonAiChat, b2 = AI2 && AI2.info(id);
        if (b2 && b2.native && b2.sfw === false) parts.push("adult woman");
        var scene = String(userMsg || "").trim().slice(0, 150);
        try {
          var rp = String(botReply || "").replace(/\[\[\s*img\s*:[\s\S]*?\]\]/gi, " ").replace(/\[\[\s*(respect|legends)\s*\]\]/gi, " ").replace(/\s+/g, " ").trim();
          if (rp) scene += (scene ? " | reply: " : "reply: ") + rp.slice(0, 150);
        } catch (eR) {}
        if (scene) parts.push("scene: " + scene);
      } catch (e2) {}
      if (charPhrase) parts.push(charPhrase);
    }
    var art = "";
    try {
      var artStyle = eff(id, "artStyle");
      if (artStyle === "page") art = artPageStyle();
      else art = ART_TEXT[artStyle] || "";
    } catch (eA) { art = ""; }
    if (art) parts.push(art);
    var cam = CAM_TEXT[eff(id, "camAngle")] || "";
    if (cam) parts.push(cam);
    var qt = "";
    try { qt = qualityText(id); } catch (eQ) { qt = ""; }
    if (qt) parts.push(qt);
    var prompt = parts.filter(Boolean).join(", ");
    if (!prompt) return null;
    var spec = { prompt: prompt, resolution: res, count: n, negativePrompt: negText(id), fromMarker: false };
  // Scene key for the thread album: the thing actually depicted (marker, live
  // scene sentence, or nothing). Used to recognise an unchanged scene and reuse
  // the album picture instead of queueing a fresh generation.
  try { spec.scene = String((sceneText && String(sceneText).trim()) || "").slice(0, 400); } catch (eS) { spec.scene = ""; }
    spec.charAnchor = [charLook, charPhrase].filter(function (s) { return !!s; }).join(", ");
    if (eff(id, "seedLock") === "on") spec.seed = (lockSeed != null) ? lockSeed : stableSeed(id);
    return spec;
  }
  // Hidden intent blocks: the companion ends EVERY reply with a ```scene block
  // describing the current visible situation (visual-novel style). Parsed out
  // here (and stripped before display) so the image follows the live scene
  // instead of a fixed portrait.
  // Current character anchor (look + lock phrase): fallback character info
  // for chat pictures saved before anchors were recorded on entries.
  function charAnchorNow(id) {
    var look = "", ph = "";
    try { var le = lookEff(id); if (le && le.lookPrompt) look = le.lookPrompt; } catch (e) {}
    try { if (eff(id, "charLock") === "on") ph = "same face, same outfit, consistent character design"; } catch (e2) {}
    return [look, ph].filter(function (s) { return !!s; }).join(", ");
  }
  // ===== dialog kit ============================================================
  var CSS_ID = "dragonAiChatSettingsCss";
  function ensureCss() {
    if (document.getElementById(CSS_ID)) return;
    var st = document.createElement("style");
    st.id = CSS_ID;
    st.textContent =
      ".aichat-ov{position:fixed; inset:0; z-index:2147483600; display:flex; align-items:center; justify-content:center; padding:.8rem; background:rgba(8,8,12,.78); box-sizing:border-box;}" +
      ".aichat-card{width:min(680px,96vw); height:min(640px,88vh); max-height:88vh; overflow:hidden; display:flex; flex-direction:column; background:var(--dt-panel1,#16161d); color:var(--dt-fg,#eee); border:1px solid var(--dt-border,#4a4a58); border-radius:14px; box-shadow:0 18px 50px rgba(0,0,0,.8); font:13px/1.45 system-ui; text-align:left;}" +
      ".aichat-card-h{padding:.7rem .9rem .5rem; border-bottom:1px solid var(--dt-border,#4a4a58);}" +
      ".aichat-card-h .t{font-weight:800; color:var(--dt-accent,#9b6bff); font-size:1rem;}" +
      ".aichat-card-h .s{font-size:.72rem; opacity:.7;}" +
      ".aichat-tabs{display:flex; gap:.25rem; padding:.5rem .9rem 0; flex-wrap:wrap;}" +
      ".aichat-tab{border:1px solid var(--dt-border,#4a4a58); background:var(--dt-panel2,#101016); color:var(--dt-fg,#e9e6f2); border-radius:9px 9px 0 0; border-bottom:0; padding:.35rem .7rem; cursor:pointer; font:inherit; font-size:.78rem; font-weight:700;}" +
      ".aichat-tab.on{background:rgba(155,107,255,.18); border-color:var(--dt-accent,#7a5cd6); color:#fff;}" +
      ".aichat-body{flex:1; min-height:0; overflow-y:auto; padding:.7rem .9rem; border-top:1px solid var(--dt-border,#4a4a58);}" +
      ".aichat-row{display:flex; align-items:center; gap:.6rem; padding:.42rem 0; border-bottom:1px dashed rgba(120,120,150,.18);}" +
      ".aichat-row label{flex:1; min-width:0; font-size:.82rem;}" +
      ".aichat-row select, .aichat-txt, .aichat-num{background:var(--dt-input,#0e0e13); color:var(--dt-fg,#eee); border:1px solid var(--dt-border,#4a4a58); border-radius:8px; padding:.35rem .5rem; font:inherit; font-size:.8rem; max-width:15rem;}" +
      ".aichat-row select{cursor:pointer;}" +
      ".aichat-note{font-size:.72rem; opacity:.72; padding:.3rem 0;}" +
      ".aichat-idwrap{display:flex; gap:.7rem;}" +
      ".aichat-avl{flex:0 0 96px;}" +
      ".aichat-avl img{width:96px; height:96px; border-radius:12px; object-fit:cover; border:2px solid var(--dt-accent,#7a5cd6); display:block;}" +
      ".aichat-idf{flex:1; min-width:0; display:flex; flex-direction:column; gap:.4rem;}" +
      ".aichat-idf input, .aichat-idf textarea{width:100%; box-sizing:border-box; background:var(--dt-input,#0e0e13); color:var(--dt-fg,#eee); border:1px solid var(--dt-border,#4a4a58); border-radius:8px; padding:.4rem .5rem; font:inherit; font-size:.8rem;}" +
      ".aichat-cat{font-size:.68rem; text-transform:uppercase; letter-spacing:.08em; color:var(--dt-accent,#9b6bff); margin:.7rem 0 .1rem; font-weight:800;}" +
      ".aichat-ax{display:flex; align-items:center; gap:.5rem; padding:.22rem 0;}" +
      ".aichat-ax .nm{flex:1; min-width:0; font-size:.76rem;}" +
      ".aichat-ax input[type=range]{flex:0 0 9rem; accent-color:#9b6bff;}" +
      ".aichat-ax input[type=range]:disabled{opacity:.4;}" +
      ".aichat-ax .vv{flex:0 0 1.4rem; text-align:right; font-size:.76rem; font-weight:800; color:var(--dt-accent,#9b6bff);}" +
      ".aichat-cap{font-size:.64rem; font-weight:800; letter-spacing:.12em; text-transform:uppercase; opacity:.55; margin:.45rem 0 .25rem .1rem;}" +
      ".aichat-cbar{position:relative; height:26px; border-radius:8px; margin-bottom:.5rem; cursor:pointer; touch-action:none; outline:none;}" +
      ".aichat-cbar:focus-visible{box-shadow:0 0 0 2px var(--dt-accent,#7a5cd6);}" +
      ".aichat-cbar-t{position:absolute; inset:0; border-radius:8px; border:1px solid var(--dt-border,#4a4a58); overflow:hidden; box-shadow:inset 0 2px 5px rgba(0,0,0,.45); background:#888;}" +
      ".aichat-cbar-k{position:absolute; top:50%; left:50%; width:22px; height:22px; margin:-11px 0 0 -11px; border-radius:50%; box-sizing:border-box; border:2px solid #fff; background:#fff; box-shadow:0 0 0 1px rgba(0,0,0,.45), 0 2px 6px rgba(0,0,0,.5); pointer-events:none;}" +
      ".aichat-swatch{width:2.6rem; height:2rem; padding:.1rem; background:var(--dt-input,#0e0e13); border:1px solid var(--dt-border,#4a4a58); border-radius:8px; cursor:pointer;}" +
      ".aichat-presets{display:flex; gap:.4rem; margin:.3rem 0 .1rem;}" +
      ".aichat-btn{border:1px solid var(--dt-border,#4a4a58); background:linear-gradient(145deg,#2a2a33,#17171c); color:var(--dt-fg,#ddd); border-radius:9px; padding:.4rem .8rem; cursor:pointer; font:inherit; font-weight:700; font-size:.8rem;}" +
      ".aichat-btn:hover{border-color:var(--dt-accent,#9b6bff);}" +
      ".aichat-btn.primary{border-color:var(--dt-accent,#7a5cd6); background:linear-gradient(180deg,#3a2f57,#201830); color:#e6dcff;}" +
      ".aichat-btn.danger{border-color:#7d3a48; background:#2a1018; color:#ffb3c0;}" +
      ".aichat-btn.armed{background:#5a1018; border-color:#ff5566; color:#fff;}" +
      ".aichat-foot{display:flex; gap:.5rem; justify-content:flex-end; padding:.6rem .9rem; border-top:1px solid var(--dt-border,#4a4a58);}" +
      ".aichat-j{border:1px solid var(--dt-border,#4a4a58); border-radius:9px; padding:.4rem .5rem; margin:.3rem 0; background:var(--dt-panel2,#101016);}" +
      ".aichat-j .kh{font-size:.66rem; font-weight:800; color:var(--dt-accent,#9b6bff); text-transform:uppercase; letter-spacing:.06em;}" +
      ".aichat-j .tx{font-size:.8rem; margin:.15rem 0; white-space:pre-wrap; word-break:break-word;}" +
      ".aichat-j .ft{display:flex; justify-content:space-between; align-items:center; font-size:.66rem; opacity:.65;}" +
      ".aichat-j .ft button{border:1px solid #7d3a48; background:#2a1018; color:#ffb3c0; border-radius:6px; cursor:pointer; font-size:.66rem; padding:.05rem .4rem;}" +
      ".aichat-avbig{width:96px; height:96px; border-radius:12px; background:#3a3a44; color:#cfcfd8; font-size:2.2rem; font-weight:800; display:flex; align-items:center; justify-content:center; border:2px solid var(--dt-border,#4a4a58); overflow:hidden; flex:0 0 auto;}" +
      ".aichat-avbig img{width:100%; height:100%; object-fit:cover; display:block;}" +
      ".aichat-ddwrap{padding:.1rem 0 .25rem; border-bottom:1px dashed rgba(120,120,150,.18);}" +
      ".aichat-ddwrap .aichat-row{border-bottom:0; padding-bottom:.25rem;}" +
      ".aichat-ddtoggle{flex:1 1 auto; min-width:0; width:100%; max-width:18rem; text-align:left; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:400 !important;}" +
      ".aichat-ddbox{position:relative; flex:1 1 auto; min-width:0; max-width:18rem; display:flex;}" +
      ".aichat-ddbox .aichat-ddtoggle{max-width:none;}" +
      ".aichat-ddmenu{position:absolute; top:calc(100% + 4px); left:50%; transform:translateX(-50%); width:max-content; min-width:100%; max-width:min(18rem,92vw); z-index:60; margin:0; border:1px solid var(--dt-accent,#7a5cd6); border-radius:9px; background:var(--dt-panel2,#101016); padding:.35rem .45rem; box-shadow:0 10px 28px rgba(0,0,0,.55);}" +
      ".aichat-ddhead{display:flex; align-items:center; justify-content:space-between; gap:.5rem; font-size:.68rem; opacity:.78; padding:.1rem .1rem .3rem;}" +
      ".aichat-ddreset{padding:.1rem .5rem !important; font-size:.7rem !important;}" +
      ".aichat-dditem{display:flex; align-items:center; gap:.5rem; padding:.28rem .1rem; border-bottom:1px dashed rgba(120,120,150,.18);}" +
      ".aichat-dditem span{flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:.8rem;}" +
      ".aichat-dddel{padding:.05rem .55rem !important;}" +
      ".aichat-ddempty{font-size:.76rem; opacity:.7; padding:.25rem .1rem;}" +
      ".aichat-ddadd{display:flex; gap:.4rem; padding:.1rem .1rem .35rem; margin-bottom:.2rem; border-bottom:1px dashed rgba(120,120,150,.25);}" +
      ".aichat-ddadd input{flex:1; min-width:0;}" +
      "@media (max-width:560px){.aichat-idwrap{flex-direction:column;} .aichat-ax input[type=range]{flex:1;}}";
    document.head.appendChild(st);
  }

  function el(tag, cls, txt) { var d = document.createElement(tag); if (cls) d.className = cls; if (txt != null) d.textContent = txt; return d; }
  function toast(m) { try { if (window.dragonToast) window.dragonToast(m); } catch (e) {} }

  // Generic tabbed dialog. tabs = [{id,name,build(body)}].
  function openDialog(title, sub, tabs, activeTab) {
    ensureCss();
    try { var old = document.querySelector(".aichat-ov"); if (old) old.remove(); } catch (e) {}
    var ov = el("div", "aichat-ov");
    var card = el("div", "aichat-card");
    var h = el("div", "aichat-card-h");
    h.appendChild(el("div", "t", title));
    if (sub) h.appendChild(el("div", "s", sub));
    var tabRow = el("div", "aichat-tabs");
    var body = el("div", "aichat-body");
    var foot = el("div", "aichat-foot");
    var close = el("button", "aichat-btn primary", "Done"); close.type = "button";
    close.onclick = function () { ov.remove(); };
    foot.appendChild(close);
    card.append(h, tabRow, body, foot);
    ov.appendChild(card);
    ov.addEventListener("mousedown", function (e) { if (e.target === ov) ov.remove(); });
    function show(id) {
      tabRow.querySelectorAll(".aichat-tab").forEach(function (b) { b.classList.toggle("on", b.dataset.tab === id); });
      body.innerHTML = "";
      tabs.forEach(function (t) { if (t.id === id) t.build(body); });
    }
    tabs.forEach(function (t) {
      var b = el("button", "aichat-tab", t.name); b.type = "button"; b.dataset.tab = t.id;
      b.onclick = function () { show(t.id); };
      tabRow.appendChild(b);
    });
    document.body.appendChild(ov);
    show(activeTab || tabs[0].id);
    return { ov: ov, body: body, show: show };
  }

  function selectRow(parent, labelText, options, value, onChange) {
    var row = el("div", "aichat-row");
    var lab = el("label", null, labelText);
    var sel = document.createElement("select");
    options.forEach(function (o) {
      var op = document.createElement("option");
      op.value = o[0]; op.textContent = o[1];
      if (String(o[0]) === String(value)) op.selected = true;
      sel.appendChild(op);
    });
    sel.onchange = function () { onChange(sel.value); };
    row.append(lab, sel);
    parent.appendChild(row);
    return sel;
  }
  function withInherit(opts) { return [[INHERIT, "Use General"]].concat(opts); }
  function textRow(parent, labelText, value, onChange, ph) {
    var row = el("div", "aichat-row");
    row.appendChild(el("label", null, labelText));
    var inp = document.createElement("input");
    inp.className = "aichat-txt"; inp.value = (value == null ? "" : String(value));
    if (ph) inp.placeholder = ph;
    inp.onchange = function () { onChange(inp.value); };
    row.appendChild(inp);
    parent.appendChild(row);
    return inp;
  }

  // Chip dropdowns for list fields (bot Identity + User info): one compact dropdown
  // per field showing the items one by one, each with its own \u2212 remove button.
  // The add box sits at the TOP of the menu. An outside click closes the open menu.
  // store = { load() -> array, save(array), canReset() -> bool, doReset(),
  //           resetLabel, headOwn }.
  var chipMenuOpen = null;
  try {
    if (!window.__aichatChipCloser) {
      window.__aichatChipCloser = true;
      document.addEventListener("click", function () {
        if (!chipMenuOpen) return;
        try {
          if (!document.contains(chipMenuOpen.menu)) { chipMenuOpen = null; return; }
          chipMenuOpen.close();
        } catch (e) { try { chipMenuOpen = null; } catch (e2) {} }
      });
    }
  } catch (eC) {}
  function chipListRow(body, labelText, store) {
    var row = el("div", "aichat-row");
    row.appendChild(el("label", null, labelText));
    var toggle = el("button", "aichat-btn aichat-ddtoggle", "");
    toggle.type = "button";
    var menu = el("div", "aichat-ddmenu");
    menu.style.display = "none";
    function cur() { try { return (store.load() || []).slice(); } catch (e) { return []; } }
    function paintToggle() {
      var c = cur();
      toggle.textContent = c.length ? (c[0] + (c.length > 1 ? "  (" + c.length + ")" : "")) : "\u2014 empty \u2014";
      toggle.title = c.length ? c.join(", ") : ("No " + labelText.toLowerCase() + " yet \u2014 open and add one");
    }
    function close() {
      menu.style.display = "none";
      try { if (chipMenuOpen && chipMenuOpen.menu === menu) chipMenuOpen = null; } catch (e) {}
    }
    function saveList(cc) { store.save(cc); paintToggle(); paintMenu(); }
    function paintMenu() {
      menu.innerHTML = "";
      var c = cur();
      var addRow = el("div", "aichat-ddadd");
      var inp = document.createElement("input");
      inp.className = "aichat-txt"; inp.placeholder = "New item\u2026"; inp.maxLength = 80;
      function commit() {
        var v = inp.value.trim().slice(0, 80);
        if (!v) return;
        var cc = cur();
        if (cc.length >= 24) { toast("That list is full (24 items)"); return; }
        cc.push(v); saveList(cc);
        var ni = null;
        try { ni = menu.querySelector(".aichat-ddadd input"); } catch (e) {}
        if (ni) ni.focus();
      }
      inp.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter") { ev.preventDefault(); commit(); }
        ev.stopPropagation();
      });
      inp.addEventListener("click", function (ev) { ev.stopPropagation(); });
      var ok = el("button", "aichat-btn", "Add"); ok.type = "button";
      ok.onclick = function (ev) { try { ev.stopPropagation(); } catch (e) {} commit(); };
      addRow.append(inp, ok); menu.appendChild(addRow);
      if (store.canReset && store.canReset()) {
        var hd = el("div", "aichat-ddhead");
        hd.appendChild(el("span", null, store.headOwn || "Your list"));
        var rs = el("button", "aichat-btn aichat-ddreset", store.resetLabel || "\u21ba Reset");
        rs.type = "button";
        rs.onclick = function (ev) { try { ev.stopPropagation(); } catch (e) {} store.doReset(); paintToggle(); paintMenu(); };
        hd.appendChild(rs); menu.appendChild(hd);
      }
      if (!c.length) menu.appendChild(el("div", "aichat-ddempty", "Nothing here yet \u2014 add one above."));
      c.forEach(function (item, idx) {
        var it = el("div", "aichat-dditem");
        var tx = el("span", null, item); tx.title = item;
        var del = el("button", "aichat-btn aichat-dddel", "\u2212");
        del.type = "button"; del.title = "Remove this item";
        del.onclick = function (ev) {
          try { ev.stopPropagation(); } catch (e) {}
          var cc = cur(); cc.splice(idx, 1); saveList(cc);
        };
        it.append(tx, del); menu.appendChild(it);
      });
    }
    toggle.onclick = function (ev) {
      try { ev.stopPropagation(); } catch (e) {}
      if (menu.style.display === "none") {
        if (chipMenuOpen) { try { chipMenuOpen.close(); } catch (e2) {} }
        paintMenu(); menu.style.display = "";
        chipMenuOpen = { menu: menu, close: close };
      } else close();
    };
    paintToggle();
    var box = el("div", "aichat-ddbox");
    box.append(toggle, menu);
    row.appendChild(box);
    var wrap = el("div", "aichat-ddwrap");
    wrap.appendChild(row);
    body.appendChild(wrap);
  }
  // Bots: effective card (DEFAULT_CARDS underneath, kv card on top).
  function botListStore(id, key) {
    return {
      load: function () { try { return (cardEff(id)[key] || []).slice(); } catch (e) { return []; } },
      save: function (arr) { card(id)[key] = (arr || []).slice(0, 24); saveCard(id); },
      canReset: function () { try { var u = card(id)[key]; return !!(u && u.length); } catch (e) { return false; } },
      doReset: function () { delete card(id)[key]; saveCard(id); },
      resetLabel: "\u21ba Default",
      headOwn: "Your list \u2014 overrides the default"
    };
  }
  // User profile lists: general tab writes kv "user", per-companion tab writes tune.user.
  function userListStore(get, set, key, compId) {
    function read() {
      var v = get(key);
      var arr = Array.isArray(v) ? v : String(v || "").split(",").map(function (s) { return String(s).trim(); }).filter(Boolean);
      return arr.slice(0, 24);
    }
    return {
      load: read,
      save: function (arr) { set(key, (arr || []).slice(0, 24)); },
      canReset: function () {
        if (!compId) return false;
        try { var t = tune(compId); return !!(t.user && t.user[key] && t.user[key].length); } catch (e) { return false; }
      },
      doReset: function () {
        try {
          var t = tune(compId);
          if (t.user) { delete t.user[key]; if (!Object.keys(t.user).length) delete t.user; }
          saveTune(compId);
        } catch (e) {}
      },
      resetLabel: "\u21ba General",
      headOwn: "Yours for this companion \u2014 overrides the general profile"
    };
  }

  // TTS voices come from the visitor's own browser/device, filtered to our 14 languages.
  var VOICE_LANGS = ["en", "tr", "de", "fr", "es", "it", "pt", "ru", "ar", "nl", "pl", "ja", "zh", "ko"];
  function listVoices() {
    var vs = [];
    try { vs = (window.speechSynthesis && window.speechSynthesis.getVoices()) || []; } catch (e) {}
    var out = [], seen = {};
    vs.forEach(function (v) {
      if (!v || !v.voiceURI || seen[v.voiceURI]) return;
      var lc = String(v.lang || "").toLowerCase();
      var ok = false;
      for (var i = 0; i < VOICE_LANGS.length; i++) {
        var L = VOICE_LANGS[i];
        if (lc === L || lc.indexOf(L + "-") === 0 || lc.indexOf(L + "_") === 0) { ok = true; break; }
      }
      if (!ok) return;
      seen[v.voiceURI] = true;
      out.push({ uri: v.voiceURI, name: v.name || "Voice", lang: v.lang || "" });
    });
    out.sort(function (a, b) { return (a.lang < b.lang ? -1 : (a.lang > b.lang ? 1 : (a.name < b.name ? -1 : 1))); });
    return out;
  }
  function voiceRow(body, id, onVoice) {
    var inherit = (id !== null && id !== undefined);
    var row = el("div", "aichat-row");
    row.appendChild(el("label", null, ROW_LABEL.ttsVoice));
    var sel = document.createElement("select");
    var cur0 = inherit ? (TUNES[id].ttsVoice !== undefined ? TUNES[id].ttsVoice : INHERIT) : (gen().ttsVoice || "auto");
    function fill() {
      sel.innerHTML = "";
      var opts = inherit ? [[INHERIT, "Use General"]] : [];
      opts.push(["auto", "Auto (Browser Voice)"]);
      opts.push(["gtts:auto", "Google (online — no key, follows reply language)"]);
      listVoices().forEach(function (v) { opts.push([v.uri, v.name + " — " + v.lang]); });
      var cur = inherit ? (TUNES[id].ttsVoice !== undefined ? TUNES[id].ttsVoice : INHERIT) : (gen().ttsVoice || "auto");
      var have = false;
      opts.forEach(function (o) {
        var op = document.createElement("option");
        op.value = o[0]; op.textContent = o[1];
        if (String(o[0]) === String(cur)) { op.selected = true; have = true; }
        sel.appendChild(op);
      });
      if (!have && cur && cur !== INHERIT) {
        var op2 = document.createElement("option");
        op2.value = cur; op2.textContent = "Saved voice (not on this device)"; op2.selected = true;
        sel.appendChild(op2);
      }
    }
    fill();
    // Voices can arrive late (browsers load them async) — refill once they land.
    if (!listVoices().length) {
      var tries = 0;
      var iv = setInterval(function () {
        tries++;
        if (listVoices().length || tries > 10) { clearInterval(iv); fill(); }
      }, 500);
    }
    sel.onchange = function () {
      if (inherit) {
        if (sel.value === INHERIT) delete TUNES[id].ttsVoice;
        else TUNES[id].ttsVoice = sel.value;
        saveTune(id);
      } else { gen().ttsVoice = sel.value; saveGeneral(); }
      try { if (onVoice) onVoice(sel.value); } catch (eV) {}
    };
    row.appendChild(sel);
    body.appendChild(row);
    body.appendChild(el("div", "aichat-note", "Browser voices come from this device — they differ per phone and computer. Google (online) is the default and works everywhere."));
  }
  // Voice Speed / Pitch sliders (0.5x–2x). General writes the shared default;
  // per-companion writes an override plus a reset back to "Use General".
  // Pitch only affects device voices — Google (online) ignores it, so the
  // slider disables itself while a Google voice is in effect.
  function ratePitchRow(body, id, key, onVoiceHook) {
    var inherit = (id !== null && id !== undefined);
    var row = el("div", "aichat-ax");
    row.appendChild(el("div", "nm", ROW_LABEL[key]));
    var sl = document.createElement("input");
    sl.type = "range"; sl.min = "0.5"; sl.max = "2"; sl.step = "0.1";
    var vv = el("div", "vv", "");
    var effV = function () {
      var t = inherit ? TUNES[id] : null;
      var v = (t && t[key] !== undefined && t[key] !== INHERIT) ? t[key] : gen()[key];
      return parseFloat(v) || 1;
    };
    function effVoice() {
      var t = inherit ? TUNES[id] : null;
      var v = (t && t.ttsVoice !== undefined && t.ttsVoice !== INHERIT) ? t.ttsVoice : gen().ttsVoice;
      return String(v || "auto");
    }
    function paintPitchState() {
      if (key !== "ttsPitch") return;
      var g = effVoice().indexOf("gtts:") === 0;
      sl.disabled = g;
      sl.title = g ? "Google (online) ignores pitch — pick a device voice to use it" : "";
      row.style.opacity = g ? "0.45" : "";
    }
    function sync() {
      var v = effV();
      sl.value = String(Math.round(v * 10) / 10);
      vv.textContent = (Math.round(v * 10) / 10).toFixed(1) + "x";
      paintPitchState();
    }
    sl.oninput = function () {
      var v = String(Math.round(parseFloat(sl.value) * 10) / 10);
      if (inherit) {
        if (v === String(gen()[key] || "1")) delete TUNES[id][key];
        else TUNES[id][key] = v;
        saveTune(id);
      } else { gen()[key] = v; saveGeneral(); }
      sync();
    };
    row.appendChild(sl); row.appendChild(vv);
    if (inherit) {
      var rs = el("button", "aichat-btn aichat-ddreset", "\u21BA"); rs.type = "button";
      rs.title = "Back to the general setting";
      rs.onclick = function () { delete TUNES[id][key]; saveTune(id); sync(); };
      row.appendChild(rs);
    }
    body.appendChild(row);
    sync();
    if (onVoiceHook) onVoiceHook(paintPitchState);
  }

  // ===== User info tab (general profile + per-companion override) ============
  // Shrink a generated avatar to a small JPEG data URL so it stays light in kv.
  // Remote URLs that refuse CORS (tainted canvas) pass through untouched.
  function shrinkAvatar(url, cb) {
    try {
      var im = new Image();
      im.onload = function () {
        try {
          var w = im.naturalWidth || im.width, h = im.naturalHeight || im.height;
          if (!w || !h) { cb(url); return; }
          var sc = Math.min(1, 256 / Math.max(w, h));
          var cw = Math.max(1, Math.round(w * sc)), ch = Math.max(1, Math.round(h * sc));
          var cv = document.createElement("canvas"); cv.width = cw; cv.height = ch;
          cv.getContext("2d").drawImage(im, 0, 0, cw, ch);
          var small = cv.toDataURL("image/jpeg", 0.85);
          cb(small && small.length < String(url).length ? small : url);
        } catch (e) { cb(url); }
      };
      im.onerror = function () { cb(url); };
      im.src = url;
    } catch (e) { cb(url); }
  }
  function genAvatarPhoto(info, btn, done) {
    try {
      if (typeof root === "undefined" || typeof root.generateImage !== "function") { toast("Image generation isn't available"); return; }
    } catch (e) { toast("Image generation isn't available"); return; }
    info = info || {};
    var bits = [];
    if (info.name) bits.push(String(info.name).slice(0, 60));
    if (info.look) bits.push(String(info.look).slice(0, 300));
    if (info.lookPrompt) bits.push(String(info.lookPrompt).slice(0, 200));
    if (info.bio) bits.push(String(info.bio).slice(0, 200));
    var tr = info.traits;
    if (typeof tr === "string") tr = tr.split(",");
    (Array.isArray(tr) ? tr : []).slice(0, 4).forEach(function (t) { if (String(t).trim()) bits.push(String(t).trim().slice(0, 40)); });
    ["likes", "hobbies"].forEach(function (k) {
      var lv = info[k];
      if (typeof lv === "string") lv = lv.split(",");
      (Array.isArray(lv) ? lv : []).slice(0, 2).forEach(function (t) { if (String(t).trim()) bits.push(String(t).trim().slice(0, 40)); });
    });
    var prompt = "profile portrait avatar photo, " + (bits.join(", ") || "friendly original character") + ", centered head-and-shoulders portrait, facing the viewer, clean simple background, high quality";
    var old = btn.textContent;
    btn.disabled = true; btn.textContent = "…";
    try {
      Promise.resolve(root.generateImage({ prompt: prompt.slice(0, 700), resolution: "512x512" })).then(function (res) {
        btn.disabled = false; btn.textContent = old;
        var url = (res && (res.dataUrl || res.url)) || null;
        if (url) { try { shrinkAvatar(url, done); } catch (e2) { done(url); } }
        else toast("Couldn't generate a photo");
      }).catch(function () { btn.disabled = false; btn.textContent = old; toast("Couldn't generate a photo"); });
    } catch (e3) { try { btn.disabled = false; btn.textContent = old; } catch (e4) {} }
  }
  // One field set, two stores: general (kv "user") or per-companion (tune.user).
  // get(k) -> current value, set(k, v) -> persist, ph(k, fallback) -> placeholder.
  function buildUserFields(body, get, set, note, compId) {
    var inputs = {};
    // Identity-style layout: photo left, name + photo URL stacked right.
    var wrap = el("div", "aichat-idwrap");
    var f = el("div", "aichat-idf");
    var nm = document.createElement("input");
    nm.placeholder = get.ph("name", "Your name");
    nm.value = get("name") || "";
    nm.onchange = function () { set("name", nm.value.trim().slice(0, 60)); };
    f.appendChild(nm);
    inputs.name = nm;
    var avCol = el("div", null); avCol.style.cssText = "display:flex; flex-direction:column; gap:.35rem; align-items:center; flex:0 0 auto;";
    var avBig = document.createElement("div");
    avBig.className = "aichat-avbig"; avBig.title = "Your profile photo";
    var previewUrl = null; // fresh generation — only Save persists it
    var genSeq = 0; // drops late/stale arrivals (Cancel, or a newer Generate)
    var av = document.createElement("input");
    function paintAv() {
      var cur = previewUrl || get("avatar") || av.value.trim() || "";
      avBig.innerHTML = "";
      if (cur) { var im = document.createElement("img"); im.src = cur; im.alt = ""; avBig.appendChild(im); }
      else avBig.textContent = "?";
      var sh = previewUrl ? "" : "none";
      saveBtn.style.display = sh; cancelBtn.style.display = sh;
    }
    var gb = el("button", "aichat-btn", "Generate"); gb.type = "button";
    gb.title = "Generate a profile photo from the info in this tab";
    gb.onclick = function () {
      var info = readUserInputs();
      var words = [info.look, info.lookPrompt, info.bio].some(function (x) { return String(x || "").trim(); });
      if (!words) {
        var anyList = ["traits", "likes", "dislikes", "hobbies", "fears"].some(function (k) {
          var v = info[k], arr = Array.isArray(v) ? v : String(v || "").split(",");
          return arr.map(function (s) { return String(s).trim(); }).filter(Boolean).length > 0;
        });
        if (!anyList) { toast("Describe yourself first — add a look, bio or a few traits, then press Generate."); return; }
      }
      previewUrl = null; genSeq++;
      var my = genSeq;
      paintAv();
      avBig.innerHTML = ""; avBig.textContent = "…";
      genAvatarPhoto(info, gb, function (url) {
        if (my !== genSeq) return; // cancelled or superseded by a newer run
        previewUrl = url; paintAv();
        toast("Preview ready — press Save to keep it, Cancel to discard");
      });
    };
    var saveBtn = el("button", "aichat-btn primary", "Save"); saveBtn.type = "button";
    saveBtn.title = "Save this image as your profile photo";
    saveBtn.style.display = "none";
    var cancelBtn = el("button", "aichat-btn", "Cancel"); cancelBtn.type = "button";
    cancelBtn.title = "Discard this preview and keep your current photo";
    cancelBtn.style.display = "none";
    cancelBtn.onclick = function () {
      genSeq++; // a late arrival is ignored
      previewUrl = null; paintAv();
    };
    saveBtn.onclick = function () {
      if (!previewUrl) return;
      av.value = previewUrl;
      try { av.onchange(); } catch (eS) {}
      previewUrl = null; paintAv();
      toast("Profile photo saved");
    };
    var scRow = el("div", null);
    scRow.style.cssText = "display:flex; gap:.35rem;";
    scRow.append(saveBtn, cancelBtn);
    avCol.append(avBig, gb, scRow);
    av.placeholder = get.ph("avatar", "Avatar image URL (https://…)");
    av.value = get("avatar") || "";
    av.onchange = function () {
      var v = av.value.trim();
      // Data-URL photos (Generate output) must NOT be cut — slicing one to 500
      // chars was saving a broken image. Only plain links get the length cap.
      if (/^data:/i.test(v)) {
        if (v.length > 2500000) { toast("That image is too big (2.5 MB max) — press Generate for a smaller one."); return; }
      } else v = v.slice(0, 500);
      set("avatar", v);
      previewUrl = null; paintAv();
    };
    f.appendChild(av);
    wrap.append(avCol, f);
    body.appendChild(wrap);
    inputs.avatar = av;
    paintAv();
    function area(key, ph, cap) {
      var t = document.createElement("textarea");
      t.rows = 2; t.placeholder = get.ph(key, ph); t.value = get(key) || "";
      t.style.cssText = "width:100%; box-sizing:border-box; margin-top:.4rem; background:var(--dt-input,#0e0e13); color:var(--dt-fg,#eee); border:1px solid var(--dt-border,#4a4a58); border-radius:8px; padding:.4rem .5rem; font:inherit; font-size:.8rem;";
      t.onchange = function () { set(key, t.value.trim().slice(0, cap || 1200)); };
      body.appendChild(t);
      inputs[key] = t;
      return t;
    }
    area("look", "What YOU look like", 1200);
    area("lookPrompt", "Image-prompt wording for your look", 700);
    area("bio", "Bio — a few sentences about you", 1200);
    [["Traits", "traits"], ["Likes", "likes"], ["Dislikes", "dislikes"], ["Hobbies", "hobbies"], ["Fears", "fears"]].forEach(function (pair) {
      chipListRow(body, pair[0], userListStore(get, set, pair[1], compId || null));
    });
    function readUserInputs() {
      function val(k) { try { return inputs[k] ? inputs[k].value : get(k); } catch (e) { return get(k); } }
      // Lists live in their dropdown stores (saved on every change), not in inputs.
      function lst(k) { var v = get(k); return Array.isArray(v) ? v.slice() : String(v || "").split(","); }
      var o = { name: val("name"), look: val("look"), lookPrompt: val("lookPrompt"), bio: val("bio") };
      ["traits", "likes", "dislikes", "hobbies", "fears"].forEach(function (k) { o[k] = lst(k); });
      return o;
    }
    if (note) body.appendChild(el("div", "aichat-note", note));
  }
  function buildUserGeneral(body) {
    loadUser();
    function get(k) { var g = userGen(); return g[k]; }
    get.ph = function (k, fb) { return fb; };
    function set(k, v) {
      var g = userGen();
      if (Array.isArray(v)) { if (v.length) g[k] = v; else delete g[k]; }
      else if (v) g[k] = v; else delete g[k];
      kvSet("user", g);
      try {
        if (window.dragonAiChatShell && window.dragonAiChatShell.repaint) window.dragonAiChatShell.repaint();
      } catch (e) {}
    }
    buildUserFields(body, get, set, "Saved on this device only. The companion reads it in its prompt — name, look, hobbies and all — and your photo shows beside your messages when profile photos are on.", null);
  }
  function buildUserTune(body, id) {
    function get(k) { return userEff(id, k); }
    get.ph = function (k, fb) {
      var g = userGen()[k];
      var gs = Array.isArray(g) ? g.join(", ") : (g || "");
      return gs ? "(General: " + String(gs).slice(0, 80) + ")" : "(General: empty — inherits nothing)";
    };
    function set(k, v) {
      var t = tune(id);
      if (!t.user) t.user = {};
      if (Array.isArray(v)) { if (v.length) t.user[k] = v; else delete t.user[k]; }
      else if (v) t.user[k] = v; else delete t.user[k];
      saveTune(id);
      try {
        if (window.dragonAiChatShell && window.dragonAiChatShell.repaint) window.dragonAiChatShell.repaint();
      } catch (e) {}
    }
    buildUserFields(body, get, set, "Empty follows the general profile above. Anything written here wins for this companion only.", id);
  }

  // ===== theme (UI/UX, device-global): accent, light/dark, animated backdrop ==
  // Two-axis color model: hue (0-360) + tone, where tone 0 = white,
  // 0.5 = the pure hue, 1 = near-black.
  function themeNormHex(v) {
    if (typeof v !== "string") return "";
    var s = v.trim().toLowerCase();
    if (!s) return "";
    if (s[0] !== "#") s = "#" + s;
    if (/^#[0-9a-f]{3}$/.test(s)) s = "#" + s.slice(1).split("").map(function (c) { return c + c; }).join("");
    return /^#[0-9a-f]{6}$/.test(s) ? s : "";
  }
  function themeHslToHex(hue, sat, light) {
    var h = (((hue % 360) + 360) % 360) / 360;
    var s = Math.min(1, Math.max(0, sat)), l = Math.min(1, Math.max(0, light));
    function chan(n) {
      var k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l);
      return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
    }
    function hx(v) { var x = v.toString(16); return x.length === 1 ? "0" + x : x; }
    return "#" + hx(chan(0)) + hx(chan(8)) + hx(chan(4));
  }
  function themeHueToneToHex(hue, tone) {
    var t = Math.min(1, Math.max(0, tone));
    return t <= 0.5 ? themeHslToHex(hue, t * 2, 1 - t) : themeHslToHex(hue, 1, 0.5 - (t - 0.5) * 0.92);
  }
  function themeHexToHueTone(hex) {
    var c = themeNormHex(hex);
    if (!c) return { hue: 267, tone: 0.5 };
    var r = parseInt(c.slice(1, 3), 16) / 255, g = parseInt(c.slice(3, 5), 16) / 255, b = parseInt(c.slice(5, 7), 16) / 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2, hue = 0;
    if (d) {
      if (mx === r) hue = ((g - b) / d + 6) % 6;
      else if (mx === g) hue = (b - r) / d + 2;
      else hue = (r - g) / d + 4;
      hue *= 60;
    }
    var tone = l >= 0.5 ? (1 - l) : (0.5 + (0.5 - l) / 0.92);
    return { hue: hue, tone: Math.min(1, Math.max(0, tone)) };
  }
  function themeState(id) {
    var g = null;
    try { g = gen(); } catch (e) {}
    g = g || {};
    var t = (id && TUNES[id]) || {};
    function pick(k) {
      var v = t[k];
      if (v === undefined || v === null || v === "") v = g[k];
      return v;
    }
    var m = pick("themeMode");
    return { accent: themeNormHex(pick("themeAccent")) || "", mode: m === "light" ? "light" : "dark", backdrop: pick("themeBackdrop") || "off" };
  }
  function themeChanged() {
    saveGeneral();
    try { window.dispatchEvent(new CustomEvent("dragonAiTheme")); } catch (e) {}
  }
  function themeChangedTune() { try { window.dispatchEvent(new CustomEvent("dragonAiTheme")); } catch (e) {} }
  function themeStoreGeneral() {
    return {
      inherit: false,
      get: function (k) { return gen()[k]; },
      set: function (k, v) { gen()[k] = v; themeChanged(); },
      note: "Applies instantly to every open chat on this device."
    };
  }
  function themeStoreTune(id) {
    return {
      inherit: true,
      get: function (k) { var t = TUNES[id] || {}; return (t[k] === undefined || t[k] === null) ? undefined : t[k]; },
      set: function (k, v) {
        if (!TUNES[id]) TUNES[id] = {};
        if (v === undefined || v === null || v === "") delete TUNES[id][k];
        else TUNES[id][k] = v;
        saveTune(id); themeChangedTune();
      },
      note: "Overrides General Settings for this companion only — empty means General."
    };
  }
  function buildThemeGeneral(body) { buildTheme(body, themeStoreGeneral()); }
  function buildThemeTune(body, id) { buildTheme(body, themeStoreTune(id)); }
  function buildTheme(body, st) {
    body.appendChild(el("div", "aichat-cat", "Theme"));
    var row = el("div", "aichat-row");
    row.appendChild(el("label", null, "🎨 Custom Accent Color"));
    var sw = document.createElement("input"); sw.type = "color"; sw.className = "aichat-swatch";
    sw.title = "Pick the accent color";
    var hx = document.createElement("input"); hx.className = "aichat-txt"; hx.maxLength = 7;
    hx.style.cssText = "max-width:5.5rem;"; hx.placeholder = "#9b6bff"; hx.title = "Accent as hex, empty = default";
    // Twin color bars (rainbow Hue + white→hue→black Tone): custom divs with a
    // travelling knob — a native range can't paint a gradient track. Pointer
    // drag + arrow keys/Home/End, same hue/tone math as the swatch/hex above.
    var barHue = 267, barTone = 0.5, toneBgHue = -1, toneBg = "";
    var hueBarApi = null, toneBarApi = null;
    function barGradient(stepFn) {
      var stops = [];
      for (var bi = 0; bi <= 12; bi++) { var bf = bi / 12; stops.push(stepFn(bf) + " " + (bf * 100).toFixed(1) + "%"); }
      return "linear-gradient(90deg, " + stops.join(", ") + ")";
    }
    function paintBars() {
      var pure = themeHueToneToHex(barHue, 0.5);
      if (hueBarApi) hueBarApi.set(barHue / 360, barGradient(function (f) { return themeHueToneToHex(f * 360, 0.5); }), pure);
      if (Math.round(barHue) !== toneBgHue) {
        toneBgHue = Math.round(barHue);
        toneBg = barGradient(function (f) { return themeHueToneToHex(barHue, f); });
      }
      if (toneBarApi) toneBarApi.set(barTone, toneBg, themeHueToneToHex(barHue, barTone));
    }
    function colorBar(label, get, set) {
      var cap = el("div", "aichat-cap", label);
      body.appendChild(cap);
      var bar = document.createElement("div");
      bar.className = "aichat-cbar"; bar.tabIndex = 0;
      bar.setAttribute("role", "slider"); bar.setAttribute("aria-label", label);
      var track = document.createElement("div"); track.className = "aichat-cbar-t";
      var knob = document.createElement("div"); knob.className = "aichat-cbar-k";
      bar.append(track, knob);
      var dragging = false;
      function fromX(cx) {
        var r = bar.getBoundingClientRect(); if (!r.width) return;
        set(Math.min(1, Math.max(0, (cx - r.left) / r.width)));
      }
      bar.addEventListener("pointerdown", function (e) {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        e.preventDefault(); dragging = true;
        try { bar.setPointerCapture(e.pointerId); } catch (x) {}
        fromX(e.clientX);
      });
      bar.addEventListener("pointermove", function (e) {
        if (!dragging) return;
        if (e.pointerType === "mouse" && e.buttons === 0) { dragging = false; return; }
        fromX(e.clientX);
      });
      bar.addEventListener("pointerup", function () { dragging = false; });
      bar.addEventListener("pointercancel", function () { dragging = false; });
      bar.addEventListener("keydown", function (e) {
        var cur = get(), next = null;
        if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = cur - (e.shiftKey ? 0.1 : 0.02);
        else if (e.key === "ArrowRight" || e.key === "ArrowUp") next = cur + (e.shiftKey ? 0.1 : 0.02);
        else if (e.key === "Home") next = 0;
        else if (e.key === "End") next = 1;
        if (next === null) return;
        e.preventDefault();
        set(Math.min(1, Math.max(0, next)));
      });
      body.appendChild(bar);
      return {
        set: function (f, bg, kc) {
          f = Math.min(1, Math.max(0, f));
          knob.style.left = (f * 100) + "%";
          bar.setAttribute("aria-valuenow", String(Math.round(f * 100)));
          if (bg) track.style.background = bg;
          if (kc) knob.style.background = kc;
        }
      };
    }
    function effHex() { return themeNormHex(st.get("themeAccent")) || themeNormHex(gen().themeAccent) || "#9b6bff"; }
    function syncControls() {
      var shown = effHex();
      try { sw.value = shown; } catch (e) {}
      if (document.activeElement !== hx) hx.value = st.get("themeAccent") || "";
      var ht = themeHexToHueTone(shown);
      barHue = ht.hue; barTone = ht.tone;
      paintBars();
    }
    function setAccent(v) {
      v = themeNormHex(v);
      st.set("themeAccent", v); syncControls();
    }
    sw.oninput = function () { setAccent(sw.value); };
    hx.onchange = function () { setAccent(hx.value || ""); };
    var rs = el("button", "aichat-btn aichat-ddreset", st.inherit ? "↺ General" : "Reset"); rs.type = "button"; rs.title = st.inherit ? "Use the General Settings accent" : "Back to the default accent";
    rs.onclick = function () { setAccent(""); };
    row.append(sw, hx, rs); body.appendChild(row);
    hueBarApi = colorBar("Hue", function () { return barHue / 360; }, function (f) { barHue = f * 360; setAccent(themeHueToneToHex(barHue, barTone)); });
    toneBarApi = colorBar("Tone", function () { return barTone; }, function (f) { barTone = f; setAccent(themeHueToneToHex(barHue, barTone)); });
    paintBars();
    var mrow = el("div", "aichat-row");
    mrow.appendChild(el("label", null, "☀️ / 🌙 Color Mode"));
    var bDark = el("button", "aichat-btn", "🌙 Dark"); bDark.type = "button";
    var bLight = el("button", "aichat-btn", "☀️ Light"); bLight.type = "button";
    function paintMode() {
      var m = (st.get("themeMode") || gen().themeMode) === "light" ? "light" : "dark";
      bDark.classList.toggle("primary", m === "dark");
      bLight.classList.toggle("primary", m === "light");
    }
    bDark.onclick = function () { st.set("themeMode", "dark"); paintMode(); };
    bLight.onclick = function () { st.set("themeMode", "light"); paintMode(); };
    mrow.append(bDark, bLight);
    if (st.inherit) {
      var mr = el("button", "aichat-btn aichat-ddreset", "↺"); mr.type = "button"; mr.title = "Use General";
      mr.onclick = function () { st.set("themeMode", ""); paintMode(); };
      mrow.appendChild(mr);
    }
    body.appendChild(mrow);
    paintMode();
    if (st.inherit) {
      selectRow(body, "Animated Backdrop", withInherit([["off", "Off"], ["fireflies", "Fireflies"], ["snowfall", "Snowfall"]]), (st.get("themeBackdrop") === undefined ? INHERIT : st.get("themeBackdrop")), function (v) {
        if (v === INHERIT) st.set("themeBackdrop", "");
        else st.set("themeBackdrop", v);
      });
    } else {
      selectRow(body, "Animated Backdrop", [["off", "Off"], ["fireflies", "Fireflies"], ["snowfall", "Snowfall"]], gen().themeBackdrop || "off", function (v) {
        st.set("themeBackdrop", v);
      });
    }
    var note = el("div", "aichat-note", st.note);
    body.appendChild(note);
    syncControls();
  }

  // ===== GENERAL dialog =======================================================
  function openGeneral() {
    loadGeneral().then(function () {
      var tabs = GENERAL_TABS.map(function (t) {
        return {
          id: t.id, name: t.name,
          build: function (body) {
            if (t.custom === "userGeneral") { buildUserGeneral(body); return; }
            var pitchUpdaters = [];
            (t.rows || []).forEach(function (key) {
              if (key === "ttsVoice") { voiceRow(body, null, function () { pitchUpdaters.forEach(function (f) { try { f(); } catch (e) {} }); }); return; }
              if (key === "@ttsRate") { ratePitchRow(body, null, "ttsRate", function (f) { pitchUpdaters.push(f); }); return; }
              if (key === "@ttsPitch") {
                ratePitchRow(body, null, "ttsPitch", function (f) { pitchUpdaters.push(f); });
                body.appendChild(el("div", "aichat-note", "Speed works on every voice. Pitch works on device voices only — Google (online) ignores it."));
                return;
              }
              if (key === "@theme") { buildThemeGeneral(body); return; }
              if (key === "negCustom") { textRow(body, ROW_LABEL.negCustom, gen().negCustom || "", function (v) { gen().negCustom = String(v == null ? "" : v).slice(0, 500); saveGeneral(); }, "Used when Negative Prompt = Manual"); return; }
              if (key === "qualityCustom") { textRow(body, ROW_LABEL.qualityCustom, gen().qualityCustom || "", function (v) { gen().qualityCustom = String(v == null ? "" : v).slice(0, 500); saveGeneral(); }, "Used when Quality Tags = Manual"); return; }
              if (key === "@exportAll") {
                var row = el("div", "aichat-row");
                row.appendChild(el("label", null, "Export All Chats"));
                var eb = el("button", "aichat-btn", "Download JSON"); eb.type = "button";
                eb.onclick = function () { exportAll(); };
                row.appendChild(eb); body.appendChild(row);
                return;
              }
              if (key === "@factoryReset") {
                var r2 = el("div", "aichat-row");
                r2.appendChild(el("label", null, "Factory Reset (General Settings)"));
                var fb = el("button", "aichat-btn danger", "Reset…"); fb.type = "button";
                var armed = false;
                fb.onclick = function () {
                  if (!armed) { armed = true; fb.classList.add("armed"); fb.textContent = "Click Again To Confirm"; return; }
                  factoryReset().then(function () {
                    toast("General settings are back to defaults");
                    fb.classList.remove("armed"); fb.textContent = "Reset…"; armed = false;
                    openGeneral(); // repaint with defaults
                  });
                };
                r2.appendChild(fb); body.appendChild(r2);
                return;
              }
              selectRow(body, ROW_LABEL[key], ROW_OPTS[key], gen()[key], function (v) {
                gen()[key] = v; saveGeneral();
              });
            });
            if (t.id === "data") {
              var n = el("div", "aichat-note", "Stored on this device only (kv). Reset clears general + per-companion settings and identity cards — chats and memories stay.");
              body.appendChild(n);
            }
          }
        };
      });
      openDialog("General Settings", "Defaults for every companion — a companion's own settings win when set.", tabs);
    });
  }
  function factoryReset() {
    G = Object.assign({}, GENERAL_DEFAULTS);
    var ids = [];
    try { if (window.dragonAiChat) ids = window.dragonAiChat.list().map(function (b) { return b.id; }); } catch (e) {}
    Object.keys(TUNES).forEach(function (k) { if (ids.indexOf(k) === -1) ids.push(k); });
    Object.keys(CARDS).forEach(function (k) { if (ids.indexOf(k) === -1) ids.push(k); });
    var jobs = [kvSet("settings", gen()), kvSet("user", userGen())];
    USERG = {};
    ids.forEach(function (id) {
      TUNES[id] = {}; CARDS[id] = {};
      jobs.push(kvSet("tune:" + id, {}), kvSet("card:" + id, {}));
    });
    return Promise.all(jobs);
  }
  function download(name, text) {
    try {
      var blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = name;
      document.body.appendChild(a); a.click();
      setTimeout(function () { try { URL.revokeObjectURL(a.href); a.remove(); } catch (e) {} }, 4000);
    } catch (e) { toast("Export failed"); }
  }
  function exportAll() {
    try {
      var AI = window.dragonAiChat; if (!AI) return;
      var out = { exportedAt: new Date().toISOString(), threads: [] };
      AI.loadThreads().then(function (ts) {
        ts = ts || [];
        var chain = Promise.resolve();
        ts.forEach(function (t) {
          chain = chain.then(function () {
            return Promise.all([AI.loadSession(t.tid, t.bot), kvGet("mem:" + t.bot)]).then(function (r) {
              var s = r[0], mem = r[1];
              out.threads.push({ thread: t.title || "#Thread", bot: t.bot, name: (AI.info(t.bot) || {}).name || t.bot, messages: s ? s.msgs : [], memory: mem || null });
            });
          });
        });
        chain.then(function () {
          download("ai-chats.json", JSON.stringify(out, null, 2));
          toast("Chats exported");
        });
      });
    } catch (e) { toast("Export failed"); }
  }

  // ===== PER-COMPANION dialog =================================================
  function openBot(id, tab) {
    var AI = window.dragonAiChat;
    if (!AI || !AI.info(id)) return;
    var bot = AI.info(id);
    Promise.all([loadTune(id), loadCard(id)]).then(function () {
      var tabs = [
        { id: "user", name: "User info", build: function (b) { buildUserTune(b, id); } },
        { id: "identity", name: "Identity", build: function (b) { buildIdentity(b, id, bot); } },
        { id: "persona", name: "Personality", build: function (b) { buildPersonality(b, id); } },
        { id: "images", name: "Images", build: function (b) { buildTuneRows(b, id, TUNE_IMAGE_ROWS, extraSeedRow); } },
        { id: "behavior", name: "Behavior", build: function (b) { buildTuneRows(b, id, TUNE_BEHAVIOR_ROWS, null); } },
        { id: "ux", name: "UI/UX", build: function (b) { buildTuneRows(b, id, TUNE_UX_ROWS, null); } },
        { id: "memory", name: "Memory", build: function (b) { buildMemory(b, id); } }
      ];
      openDialog(bot.name + " — Settings", "These override the General Settings for " + bot.name + " only.", tabs, tab || "identity");
    });
  }

  // tune rows with "Use General" first; onChange writes the tune (deleting the key = inherit).
  function buildTuneRows(body, id, rows, extra) {
    var pitchUpdatersT = [];
    var notifyPitch = function () { pitchUpdatersT.forEach(function (f) { try { f(); } catch (e) {} }); };
    var regPitch = function (f) { pitchUpdatersT.push(f); };
    rows.forEach(function (key) {
      if (key === "ttsVoice") { voiceRow(body, id, notifyPitch); return; }
      if (key === "ttsRate") { ratePitchRow(body, id, "ttsRate", regPitch); return; }
      if (key === "ttsPitch") {
        ratePitchRow(body, id, "ttsPitch", regPitch);
        body.appendChild(el("div", "aichat-note", "Speed works on every voice. Pitch works on device voices only — Google (online) ignores it."));
        return;
      }
      if (key === "@theme") { buildThemeTune(body, id); return; }
      if (key === "negCustom") { textRow(body, ROW_LABEL.negCustom + " (empty = General)", (TUNES[id] && TUNES[id].negCustom) || "", function (v) { v = String(v == null ? "" : v).slice(0, 500); if (!v.trim()) delete TUNES[id].negCustom; else TUNES[id].negCustom = v; saveTune(id); }, "Empty = General"); return; }
      if (key === "qualityCustom") { textRow(body, ROW_LABEL.qualityCustom + " (empty = General)", (TUNES[id] && TUNES[id].qualityCustom) || "", function (v) { v = String(v == null ? "" : v).slice(0, 500); if (!v.trim()) delete TUNES[id].qualityCustom; else TUNES[id].qualityCustom = v; saveTune(id); }, "Empty = General"); return; }
      var cur = TUNES[id][key];
      var shown = (cur === undefined || cur === null) ? INHERIT : cur;
      if (key === "imgCount" && shown !== INHERIT) shown = String(shown);
      selectRow(body, ROW_LABEL[key], withInherit(ROW_OPTS[key]), shown, function (v) {
        if (v === INHERIT) delete TUNES[id][key];
        else TUNES[id][key] = (key === "imgCount") ? String(parseInt(v, 10) || 1) : v;
        saveTune(id);
      });
    });
    if (extra) extra(body, id);
    var n = el("div", "aichat-note", "“Use General” follows the General Settings. Anything else wins for this companion only.");
    body.appendChild(n);
  }
  function extraSeedRow(body, id) {
    var row = el("div", "aichat-row");
    row.appendChild(el("label", null, "Locked Seed"));
    var inp = document.createElement("input");
    inp.className = "aichat-num"; inp.type = "number"; inp.min = "0"; inp.max = "9999999";
    inp.value = String(stableSeed(id));
    inp.title = "Used when Seed Lock is on";
    inp.onchange = function () {
      var v = Math.max(0, Math.min(9999999, parseInt(inp.value, 10) || 0));
      inp.value = String(v); TUNES[id].seed = v; saveTune(id);
    };
    row.appendChild(inp);
    body.appendChild(row);
  }

  // Identity: avatar left, fields right; bio/background/lists below.
  // Values shown are EFFECTIVE (defaults underneath, user edits on top);
  // clearing a field restores its default.
  function buildIdentity(body, id, bot) {
    var eff = cardEff(id);
    var wrap = el("div", "aichat-idwrap");
    var avBox = el("div", "aichat-avl");
    var im = document.createElement("img");
    im.src = eff.avatar || bot.avatar || "";
    im.alt = "";
    avBox.appendChild(im);
    var f = el("div", "aichat-idf");
    function field(ph, val, multiline) {
      var inp = multiline ? document.createElement("textarea") : document.createElement("input");
      if (multiline) inp.rows = 3;
      inp.placeholder = ph; inp.value = val || "";
      inp.onchange = function () { saveIdentityField(id, ph, inp.value); };
      return inp;
    }
    var nm = field("Name", eff.name || bot.name, false);
    var tg = field("One-line tagline", eff.tagline || bot.tagline, false);
    var av = field("Avatar image URL", (CARDS[id] && CARDS[id].avatar) || "", false);
    av.onchange = function () {
      var v = av.value.trim();
      if (v) CARDS[id].avatar = v.slice(0, 500); else delete CARDS[id].avatar;
      saveCard(id);
      im.src = cardEff(id).avatar || bot.avatar || "";
      try {
        if (window.dragonAiChatShell && window.dragonAiChatShell.repaint) window.dragonAiChatShell.repaint();
      } catch (e) {}
    };
    f.append(nm, tg, av);
    wrap.append(avBox, f);
    body.appendChild(wrap);
    var le0 = null;
    try { le0 = lookEff(id) || { look: "", lookPrompt: "" }; } catch (eL) { le0 = { look: "", lookPrompt: "" }; }
    function lookArea(ph, key, base) {
      var t = document.createElement("textarea");
      t.rows = 3; t.placeholder = ph + " (base shown — clear to restore base)";
      t.value = ((CARDS[id] && CARDS[id][key]) || "");
      if (!t.value && base) t.placeholder = "BASE: " + String(base).slice(0, 120) + "… (type here to override, clear to restore)";
      t.style.cssText = "width:100%; box-sizing:border-box; margin-top:.4rem; background:var(--dt-input,#0e0e13); color:var(--dt-fg,#eee); border:1px solid var(--dt-border,#4a4a58); border-radius:8px; padding:.4rem .5rem; font:inherit; font-size:.8rem;";
      t.onchange = function () {
        var v = t.value.trim();
        if (v) CARDS[id][key] = v.slice(0, 1200); else delete CARDS[id][key];
        saveCard(id);
      };
      body.appendChild(t);
    }
    lookArea("What THEY look like", "look", le0.look);
    lookArea("Image-prompt wording for their look", "lookPrompt", le0.lookPrompt);
    function area(ph, key) {
      var t = document.createElement("textarea");
      t.rows = 3; t.placeholder = ph + " (default shown — clear to restore)"; t.value = eff[key] || "";
      t.style.cssText = "width:100%; box-sizing:border-box; margin-top:.4rem; background:var(--dt-input,#0e0e13); color:var(--dt-fg,#eee); border:1px solid var(--dt-border,#4a4a58); border-radius:8px; padding:.4rem .5rem; font:inherit; font-size:.8rem;";
      t.onchange = function () {
        var v = t.value.trim();
        if (v) CARDS[id][key] = v.slice(0, 1200); else delete CARDS[id][key];
        saveCard(id);
      };
      body.appendChild(t);
    }
    area("Bio — who they are, in a few sentences", "bio");
    area("Background — where they come from, what shaped them", "background");
    chipListRow(body, "Traits", botListStore(id, "traits"));
    chipListRow(body, "Likes", botListStore(id, "likes"));
    chipListRow(body, "Dislikes", botListStore(id, "dislikes"));
    chipListRow(body, "Hobbies", botListStore(id, "hobbies"));
    chipListRow(body, "Fears", botListStore(id, "fears"));
    var n = el("div", "aichat-note", "Identity notes colour the companion's replies — used naturally, never recited as a list. Customs: name/tagline here override the roster display.");
    body.appendChild(n);
  }
  function saveIdentityField(id, ph, val) {
    var c = card(id);
    var v = String(val == null ? "" : val).trim();
    if (ph === "Name") { if (v) c.name = v.slice(0, 32); else delete c.name; }
    else if (ph.indexOf("tagline") !== -1) { if (v) c.tagline = v.slice(0, 90); else delete c.tagline; }
    saveCard(id);
    try {
      if (window.dragonAiChatShell && window.dragonAiChatShell.repaint) window.dragonAiChatShell.repaint();
    } catch (e) {}
  }

  // Personality: Intelligence Style group (presets + 4 sliders) + all 72 axes by category.
  function buildPersonality(body, id) {
    var t = tune(id);
    if (!t.axes) t.axes = {};
    body.appendChild(el("div", "aichat-cat", INTEL_LABEL));
    var pr = el("div", "aichat-presets");
    Object.keys(INTEL_PRESETS).forEach(function (name) {
      var b = el("button", "aichat-btn", name); b.type = "button";
      b.onclick = function () {
        var p = INTEL_PRESETS[name];
        Object.keys(p).forEach(function (k) { t.axes[k] = p[k]; });
        saveTune(id);
        openBotRefresh(id, "persona"); // repaint sliders to the preset
        toast(INTEL_LABEL + ": " + name);
      };
      pr.appendChild(b);
    });
    body.appendChild(pr);
    INTEL_AXES.forEach(function (ax) { axisSlider(body, id, ax); });
    var note = el("div", "aichat-note", "There is no single IQ number — brilliance is these four pulls together. The presets above just move them as a set.");
    body.appendChild(note);
    // All 72 axes, grouped by the schema's own categories.
    var P = window.dragonPersona;
    var cats = (P && P.CATEGORIES) ? P.CATEGORIES.slice().sort(function (a, b) { return a.order - b.order; }) : [];
    var axes = (P && P.AXES) ? P.AXES : [];
    if (!axes.length) {
      body.appendChild(el("div", "aichat-note", "Personality schema not loaded."));
      return;
    }
    cats.forEach(function (c) {
      body.appendChild(el("div", "aichat-cat", c.name));
      axes.forEach(function (ax) {
        if (ax.category !== c.id && !(c.id === "cognitive" && INTEL_AXES.indexOf(ax.id) !== -1 && false)) { /* keep loop simple */ }
        if (ax.category !== c.id) return;
        if (INTEL_AXES.indexOf(ax.id) !== -1) return; // already shown above
        axisSlider(body, id, ax.id);
      });
    });
    var r = el("div", "aichat-row");
    r.appendChild(el("label", null, "Reset All Personality Overrides"));
    var rb = el("button", "aichat-btn danger", "Reset"); rb.type = "button";
    rb.onclick = function () { t.axes = {}; saveTune(id); openBotRefresh(id, "persona"); };
    r.appendChild(rb);
    body.appendChild(r);
  }
  function openBotRefresh(id, tab) {
    // Re-open the same bot dialog on the same tab (cheap repaint after presets/reset).
    try { var old = document.querySelector(".aichat-ov"); if (old) old.remove(); } catch (e) {}
    openBot(id, tab);
  }
  function axisSlider(body, id, axisId) {
    var t = tune(id);
    var row = el("div", "aichat-ax");
    var nm = el("div", "nm", axisName(axisId));
    nm.title = (function () {
      try {
        var ax = window.dragonPersona.AXIS_BY_ID[axisId];
        return "Left: " + ax.left + "  |  Right: " + ax.right;
      } catch (e) { return ""; }
    })();
    var sl = document.createElement("input");
    sl.type = "range"; sl.min = "1"; sl.max = "10"; sl.step = "1";
    var cur = (t.axes && t.axes[axisId] !== undefined) ? t.axes[axisId] : authored(id, axisId);
    sl.value = String(cur);
    var vv = el("div", "vv", String(cur));
    sl.oninput = function () { vv.textContent = sl.value; };
    sl.onchange = function () {
      t.axes[axisId] = parseInt(sl.value, 10);
      saveTune(id);
    };
    row.append(nm, sl, vv);
    body.appendChild(row);
  }

  // Memory tab: summary + facts + journal (the journal lives INSIDE memory).
  function buildMemory(body, id) {
    var AI = window.dragonAiChat;
    body.appendChild(el("div", "aichat-note", "Loading memory…"));
    Promise.all([AI.loadSession(id), kvGet("mem:" + id)]).then(function (r) {
      body.innerHTML = "";
      var mem = (r[1] && typeof r[1] === "object") ? r[1] : null;
      var sum = (mem && mem.summary) || "(nothing remembered yet — it builds up as you talk)";
      var sRow = el("div", "aichat-j");
      sRow.appendChild(el("div", "kh", "Summary"));
      sRow.appendChild(el("div", "tx", sum));
      body.appendChild(sRow);
      var facts = (mem && mem.facts) || [];
      var fRow = el("div", "aichat-j");
      fRow.appendChild(el("div", "kh", "Durable Facts (" + facts.length + ")"));
      fRow.appendChild(el("div", "tx", facts.length ? facts.map(function (f) { return "• " + f; }).join("\n") : "—"));
      body.appendChild(fRow);
      // Current scene (STATUS): read-only view of the live state the companion
      // tracks reply to reply, plus parked history of characters who left.
      (function paintStatus() {
        var st = (mem && mem.status && mem.status.state) || null;
        var hist = (mem && mem.status && mem.status.history) || {};
        // Tiny profile picture left of each character (Egon 03.11.2026): the
        // bot's own photo, your photo for Egon/you, an initial badge for NPCs
        // (their portraits live per-thread, this tab is per-companion).
        function statusPic(who) {
          var w = String(who || "").trim().toLowerCase(), url = "";
          try {
            var b = (window.dragonAiChat && window.dragonAiChat.info(id)) || {};
            if (w && w === String(b.name || "").trim().toLowerCase()) url = cardEff(id).avatar || b.avatar || "";
          } catch (eB) {}
          if (!url) { try { if (w === "egon" || w === "you" || w === "user") url = userEff(id, "avatar") || ""; } catch (eU) {} }
          if (url) {
            var im = document.createElement("img");
            im.src = url; im.alt = "";
            im.style.cssText = "width:28px;height:28px;border-radius:50%;object-fit:cover;flex:0 0 auto;";
            return im;
          }
          var sp = el("div", null, (String(who || "?").trim().charAt(0) || "?").toUpperCase());
          sp.style.cssText = "width:28px;height:28px;border-radius:50%;background:#8a8a96;color:#fff;font-weight:bold;display:flex;align-items:center;justify-content:center;flex:0 0 auto;font-size:14px;";
          return sp;
        }
        function statusHead(parent, who) {
          var head = el("div", null);
          head.style.cssText = "display:flex;align-items:center;gap:.4rem;margin:.15rem 0;";
          head.appendChild(statusPic(who));
          var kh = el("div", "kh", String(who || "?")); kh.style.margin = "0";
          head.appendChild(kh);
          parent.appendChild(head);
        }
        body.appendChild(el("div", "aichat-cat", "Current Scene"));
        var sRow = el("div", "aichat-j");
        if (!st || (!st.loc && !(st.cast && st.cast.length))) {
          sRow.appendChild(el("div", "tx", "No scene tracked yet — it appears after a few replies."));
        } else {
          if (st.loc) {
            sRow.appendChild(el("div", "kh", "Where"));
            sRow.appendChild(el("div", "tx", st.loc + (st.time ? " · " + st.time : "")));
          }
          (st.cast || []).forEach(function (c) {
            statusHead(sRow, (c && c.who) || "?");
            var bits = [];
            if (c && c.wear) bits.push("wears " + c.wear);
            if (c && c.pose) bits.push("pose " + c.pose);
            if (c && c.facing) bits.push("facing " + c.facing);
            if (c && c.contact) bits.push("contact " + c.contact);
            sRow.appendChild(el("div", "tx", bits.length ? bits.join(" · ") : "—"));
          });
        }
        body.appendChild(sRow);
        var hkeys = Object.keys(hist);
        body.appendChild(el("div", "aichat-cat", "Parked History (" + hkeys.length + ")"));
        if (!hkeys.length) {
          body.appendChild(el("div", "aichat-note", "Nobody parked — characters who leave a scene wait here."));
        } else {
          hkeys.forEach(function (k) {
            var h = hist[k] || {};
            var j = el("div", "aichat-j");
            statusHead(j, h.who || k);
            var hb = [];
            if (h.wear) hb.push("wears " + h.wear);
            if (h.pose) hb.push("pose " + h.pose);
            if (h.facing) hb.push("facing " + h.facing);
            if (h.contact) hb.push("contact " + h.contact);
            j.appendChild(el("div", "tx", hb.length ? hb.join(" · ") : "—"));
            body.appendChild(j);
          });
        }
      })();
      // Journal: events / milestones / stages / story parts / chapters.
      body.appendChild(el("div", "aichat-cat", "Story Journal (" + ((mem && mem.journal && mem.journal.length) || 0) + ")"));
      var list = el("div", null);
      body.appendChild(list);
      function paintJournal(jr) {
        list.innerHTML = "";
        if (!jr.length) list.appendChild(el("div", "aichat-note", "No entries yet — record the moments that matter and they will be remembered as story."));
        jr.forEach(function (en, idx) {
          var j = el("div", "aichat-j");
          j.appendChild(el("div", "kh", en.kind || "Event"));
          j.appendChild(el("div", "tx", en.text || ""));
          var ft = el("div", "ft");
          var d = ""; try { d = new Date(en.t).toLocaleDateString(); } catch (e) {}
          ft.appendChild(el("span", null, d));
          var del = el("button", null, "Delete"); del.type = "button";
          del.onclick = function () {
            AI.journalDel(id, idx).then(function () {
              AI.loadSession(id); // refresh in-memory copy ordering
              kvGet("mem:" + id).then(function (m2) { paintJournal((m2 && m2.journal) || []); bumpCount(m2); });
            });
          };
          ft.appendChild(del);
          j.appendChild(ft);
          list.appendChild(j);
        });
      }
      function bumpCount(m2) {
        try {
          var cats = body.querySelectorAll(".aichat-cat");
          cats.forEach(function (c) {
            if (c.textContent.indexOf("Story Journal") === 0) c.textContent = "Story Journal (" + ((m2 && m2.journal && m2.journal.length) || 0) + ")";
          });
        } catch (e) {}
      }
      paintJournal((mem && mem.journal) || []);
      // Add-entry form.
      var form = el("div", "aichat-row");
      var kind = document.createElement("select");
      JOURNAL_KINDS.forEach(function (k) {
        var o = document.createElement("option"); o.value = k; o.textContent = k; kind.appendChild(o);
      });
      var inp = document.createElement("input");
      inp.className = "aichat-txt"; inp.placeholder = "What happened…"; inp.maxLength = 300;
      var add = el("button", "aichat-btn", "Add"); add.type = "button";
      add.onclick = function () {
        var tx = inp.value.trim();
        if (!tx) { toast("Write the entry first"); return; }
        AI.journalAdd(id, kind.value, tx).then(function () {
          inp.value = "";
          kvGet("mem:" + id).then(function (m2) { paintJournal((m2 && m2.journal) || []); bumpCount(m2); });
        });
      };
      form.append(kind, inp, add);
      body.appendChild(form);
      // Export + forget.
      var xr = el("div", "aichat-row");
      xr.appendChild(el("label", null, "Export This Chat"));
      var xb = el("button", "aichat-btn", "Download .txt"); xb.type = "button";
      xb.onclick = function () { exportChat(id); };
      xr.appendChild(xb);
      body.appendChild(xr);
      var fr = el("div", "aichat-row");
      fr.appendChild(el("label", null, "Forget Everything (Memory + Journal)"));
      var fb2 = el("button", "aichat-btn danger", "Forget…"); fb2.type = "button";
      var armed2 = false;
      fb2.onclick = function () {
        if (!armed2) { armed2 = true; fb2.classList.add("armed"); fb2.textContent = "Click Again To Confirm"; return; }
        AI.forgetMemory(id).then(function () { buildMemoryRefresh(body, id); toast("Memory forgotten"); });
      };
      fr.appendChild(fb2);
      body.appendChild(fr);
    }).catch(function () {
      body.innerHTML = "";
      body.appendChild(el("div", "aichat-note", "Memory unavailable."));
    });
  }
  function buildMemoryRefresh(body, id) {
    body.innerHTML = "";
    buildMemory(body, id);
  }
  function exportChat(id) {
    try {
      var AI = window.dragonAiChat; if (!AI) return;
      Promise.all([AI.loadSession(id), kvGet("mem:" + id)]).then(function (r) {
        var s = r[0], mem = r[1];
        var nm = (AI.info(id) || {}).name || id;
        var lines = ["Chat with " + nm + " — exported " + new Date().toISOString(), ""];
        (s.msgs || []).forEach(function (m) {
          lines.push((m.role === "user" ? "You" : nm) + ": " + m.text);
          lines.push("");
        });
        if (mem && mem.journal && mem.journal.length) {
          lines.push("— Story Journal —");
          mem.journal.forEach(function (en) { lines.push("[" + (en.kind || "Event") + "] " + en.text); });
        }
        download("chat-" + id + ".txt", lines.join("\n"));
      });
    } catch (e) { toast("Export failed"); }
  }

  // ===== COMPANION CREATOR (same sections as the special settings) ==================
  // Draft tune lives in TUNES["#new"] until Create pins it onto the real bot id.
  function openCreator(onDone) {
    var AI = window.dragonAiChat;
    if (!AI) { toast("Chat engine not ready"); return; }
    TUNES["#new"] = {};
    var draft = { name: "", tagline: "", avatar: "", accent: "#9b6bff", persona: "", look: "", lookPrompt: "", bio: "", background: "", traits: "", likes: "", dislikes: "", hobbies: "", fears: "" };
    function creatorSlider(body, axisId) {
      var row = el("div", "aichat-ax");
      var nm = el("div", "nm", axisName(axisId));
      try {
        var ax = window.dragonPersona.AXIS_BY_ID[axisId];
        nm.title = "Left: " + ax.left + "  |  Right: " + ax.right;
      } catch (e) {}
      var t = tune("#new");
      if (!t.axes) t.axes = {};
      var sl = document.createElement("input");
      sl.type = "range"; sl.min = "1"; sl.max = "10"; sl.step = "1";
      sl.value = String(t.axes[axisId] !== undefined ? t.axes[axisId] : 5);
      var vv = el("div", "vv", sl.value);
      sl.oninput = function () { vv.textContent = sl.value; };
      sl.onchange = function () { tune("#new").axes[axisId] = parseInt(sl.value, 10); saveTune("#new"); };
      row.append(nm, sl, vv);
      body.appendChild(row);
    }
    function refreshCreatorSliders(body) {
      var t = tune("#new"), axes = (t.axes || {});
      try {
        var P = window.dragonPersona;
        body.querySelectorAll(".aichat-ax").forEach(function (row) {
          var nm = row.querySelector(".nm"), sl = row.querySelector("input[type=range]"), vv = row.querySelector(".vv");
          if (!nm || !sl || !vv || !P) return;
          var id = null;
          for (var i = 0; i < P.AXES.length; i++) if (P.AXES[i].name === nm.textContent) { id = P.AXES[i].id; break; }
          if (!id) return;
          var v = (axes[id] !== undefined) ? axes[id] : 5;
          sl.value = String(v); vv.textContent = String(v);
        });
      } catch (e2) {}
    }
    var tabs = [
      {
        id: "identity", name: "Identity",
        build: function (body) {
          function inp(ph, key, multiline) {
            var f = multiline ? document.createElement("textarea") : document.createElement("input");
            if (multiline) f.rows = 3;
            f.placeholder = ph; f.value = draft[key] || "";
            f.style.cssText = "width:100%; box-sizing:border-box; margin:.25rem 0; background:var(--dt-input,#0e0e13); color:var(--dt-fg,#eee); border:1px solid var(--dt-border,#4a4a58); border-radius:8px; padding:.4rem .5rem; font:inherit; font-size:.8rem;";
            f.onchange = function () { draft[key] = f.value; };
            body.appendChild(f);
            return f;
          }
          inp("Name *", "name", false);
          inp("One-line tagline", "tagline", false);
          var prev = document.createElement("img");
          prev.style.cssText = "width:64px; height:64px; border-radius:12px; object-fit:cover; border:2px solid var(--dt-accent,#7a5cd6); margin:.25rem 0;";
          prev.src = draft.avatar || "";
          prev.alt = "";
          prev.style.display = draft.avatar ? "" : "none";
          body.appendChild(prev);
          var avInp = inp("Avatar image URL (https://…)", "avatar", false);
          avInp.onchange = function () { draft.avatar = avInp.value; prev.src = draft.avatar || ""; prev.style.display = draft.avatar ? "" : "none"; };
          var avGen = el("button", "aichat-btn", "Generate photo"); avGen.type = "button";
          avGen.title = "Generate a profile photo from the name/look info above";
          avGen.onclick = function () {
            genAvatarPhoto({ name: draft.name, look: draft.look, bio: draft.bio, traits: draft.traits }, avGen, function (url) {
              draft.avatar = url; avInp.value = url; prev.src = url; prev.style.display = "";
            });
          };
          body.appendChild(avGen);
          inp("Accent color (#9b6bff)", "accent", false);
          inp("How they behave — their whole character, in your words", "persona", true);
          inp("What they look like", "look", true);
          inp("Image-prompt wording for their look (optional)", "lookPrompt", false);
          inp("Bio — who they are, in a few sentences", "bio", true);
          inp("Background — where they come from, what shaped them", "background", true);
          [["Traits", "traits"], ["Likes", "likes"], ["Dislikes", "dislikes"], ["Hobbies", "hobbies"], ["Fears", "fears"]].forEach(function (pair) {
            inp(pair[0] + " — comma, separated, list", pair[1], false);
          });
        }
      },
      {
        id: "persona", name: "Personality",
        build: function (body) {
          body.appendChild(el("div", "aichat-cat", INTEL_LABEL));
          var pr = el("div", "aichat-presets");
          Object.keys(INTEL_PRESETS).forEach(function (name) {
            var b = el("button", "aichat-btn", name); b.type = "button";
            b.onclick = function () {
              var t = tune("#new");
              if (!t.axes) t.axes = {};
              var p = INTEL_PRESETS[name];
              Object.keys(p).forEach(function (k) { t.axes[k] = p[k]; });
              saveTune("#new");
              refreshCreatorSliders(body);
              toast(INTEL_LABEL + ": " + name);
            };
            pr.appendChild(b);
          });
          body.appendChild(pr);
          INTEL_AXES.forEach(function (ax) { creatorSlider(body, ax); });
          body.appendChild(el("div", "aichat-note", "There is no single IQ number — brilliance is these four pulls together."));
          var P = window.dragonPersona;
          var cats = (P && P.CATEGORIES) ? P.CATEGORIES.slice().sort(function (a, b) { return a.order - b.order; }) : [];
          var axes = (P && P.AXES) ? P.AXES : [];
          cats.forEach(function (c) {
            body.appendChild(el("div", "aichat-cat", c.name));
            axes.forEach(function (ax) {
              if (ax.category !== c.id || INTEL_AXES.indexOf(ax.id) !== -1) return;
              creatorSlider(body, ax.id);
            });
          });
        }
      },
      { id: "images", name: "Images", build: function (b) { buildTuneRows(b, "#new", TUNE_IMAGE_ROWS, extraSeedRow); } },
      { id: "behavior", name: "Behavior", build: function (b) { buildTuneRows(b, "#new", TUNE_BEHAVIOR_ROWS, null); } }
    ];
    var dlg = openDialog("Create An AI Companion", "Same sections as the special settings — stored on this device only, nothing is uploaded.", tabs, "identity");
    var foot = dlg.ov.querySelector(".aichat-foot");
    foot.innerHTML = "";
    var cancel = el("button", "aichat-btn", "Cancel"); cancel.type = "button";
    cancel.onclick = function () { TUNES["#new"] = {}; dlg.ov.remove(); };
    var create = el("button", "aichat-btn primary", "Create"); create.type = "button";
    create.onclick = function () {
      var name = draft.name.trim();
      if (!name) { toast("Give your companion a name"); return; }
      var t = tune("#new"), axes = (t.axes || {});
      var axesStr = Object.keys(axes).filter(function (k) { return axes[k] >= 1 && axes[k] <= 10; }).map(function (k) { return k + "=" + axes[k]; }).join("; ");
      AI.addCustom({
        name: name.slice(0, 32),
        tagline: draft.tagline.trim().slice(0, 90),
        avatar: draft.avatar.trim().slice(0, 500),
        accent: draft.accent.trim(),
        persona: draft.persona.trim().slice(0, 4000),
        look: draft.look.trim().slice(0, 1200),
        lookPrompt: draft.lookPrompt.trim().slice(0, 700),
        profile: axesStr,
        sfw: true
      }).then(function (b) {
        TUNES[b.id] = {};
        Object.keys(t).forEach(function (k) {
          if (k === "axes") { if (axesStr) TUNES[b.id].axes = Object.assign({}, axes); }
          else TUNES[b.id][k] = t[k];
        });
        saveTune(b.id);
        var cd = card(b.id);
        if (draft.bio.trim()) cd.bio = draft.bio.trim().slice(0, 1200);
        if (draft.background.trim()) cd.background = draft.background.trim().slice(0, 1200);
        ["traits", "likes", "dislikes", "hobbies", "fears"].forEach(function (k) {
          var arr = String(draft[k] || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 24);
          if (arr.length) cd[k] = arr;
        });
        saveCard(b.id);
        TUNES["#new"] = {};
        dlg.ov.remove();
        toast(b.name + " is ready to chat");
        if (onDone) onDone(b.id);
      }).catch(function () { toast("Could not save your companion"); });
    };
    foot.append(cancel, create);
  }

  loadGeneral();
  loadUser();

  window.dragonAiChatSettings = {
    version: 1,
    INHERIT: INHERIT,
    GENERAL_DEFAULTS: GENERAL_DEFAULTS,
    JOURNAL_KINDS: JOURNAL_KINDS,
    INTEL_AXES: INTEL_AXES,
    INTEL_PRESETS: INTEL_PRESETS,
    eff: eff,
    langCode: langCode,
    langLine: langLine,
    emojiLine: emojiLine,
    lengthNote: lengthNote,
    questionLine: questionLine,
    axesOverrideBlock: axesOverrideBlock,
    identityBlock: identityBlock,
    stableSeed: stableSeed,
    imageSpec: imageSpec,
    lookEff: lookEff,
    lockGet: lockGet,
    lockSet: lockSet,
    loadLock: loadLock,
    charAnchorNow: charAnchorNow,
    userEff: userEff,
    userBlock: userBlock,
    loadUser: loadUser,
    negText: negText,
    qualityText: qualityText,
    artPageStyle: artPageStyle,
    openGeneral: openGeneral,
    openBot: openBot,
    openCreator: openCreator,
    cardEff: cardEff,
    themeState: themeState,
    exportChat: exportChat,
    exportAll: exportAll,
    _internals: { tune: tune, card: card, gen: gen, saveTune: saveTune, saveCard: saveCard, loadTune: loadTune, loadCard: loadCard }
  };
})();
