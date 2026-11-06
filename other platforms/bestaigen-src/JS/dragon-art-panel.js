// 🎨 dragon-art-panel.js — the ART STYLE accordion panel (Egon 27.09.2026, W-FEAT313 / W-LOC304).
// The old 🎨 Art Style control was a plain <select> sitting inside the description grid, with a separate
// search box and a 🎲 button, and the "Test Multiple Styles" tester opened as its own window from the
// Prompt Panel. Egon asked for all of that to become ONE accordion panel — the Control Panel's twin —
// standing directly ABOVE the Control Panel, with:
//   · head "🎨 Art Style 🎨" (the right symbol mirrored, so the two flank the label symmetrically)
//   · the search bar moved inside (with our red ✖ clear button INSIDE the bar) and the 🎲 Randomize Style
//     button right where the bar ends
//   · ⚗️ Test Multiple Styles + 🎨 Mixed Art Style (the latter deliberately not wired up yet)
//   · a button row that appears while Test Multiple Styles is ON: 🔒 Lock Seed (fair comparison) ·
//     ✅ Select All · ✖ Clear All
//   · the art styles themselves listed 3 per row (desktop), each with a "Preview Soon" placeholder tile the
//     size of the preview boxes (108px) — real previews will land there later
// The real <select data-name="artStyle"> stays in the DOM untouched (the framework reads it) and is the
// single source of the style list + the value; its old row is hidden.
// Rollback: delete this file, its <script> tag in index.html, and the notes in the books.
(function () {
  if (window.__dragonArtPanelInstalled) return;
  window.__dragonArtPanelInstalled = true;

  var LS_MULTI = "dragonArtMultiOn";
  var LS_MIX = "dragonArtMixOn";
  var LS_SEL = "dragonArtMultiSel";
  var LS_LOCK = "dragonArtLockSeed";
  var LS_SEED = "dragonArtLockSeedNum";
  var LS_OPEN = "dragonArtPanelOpen";
  var LS_HIST = "dragonArtSearchHist";
  var LS_CATS = "dragonArtCatClosed";
  var LS_FAV = "dragonArtFav";
  var PREVIEW_SIDE = "108px";
  var PREVIEW_IMG = {"Realistic Human / Photorealistic":"src/art-previews/realistic-human.jpg", "Realistic Picture":"src/art-previews/realistic-picture.jpg", "8K experiment":"src/art-previews/8k-experiment.jpg", "Realistic (experimental)":"src/art-previews/realistic-experimental.jpg", "Professional Photo":"src/art-previews/professional-photo.jpg", "Casual Photo":"src/art-previews/casual-photo.jpg", "Cinematic":"src/art-previews/cinematic.jpg", "Chiaroscuro Photorealistic":"src/art-previews/chiaroscuro-photorealistic.jpg", "Professional Photography \ud83d\udcf8":"src/art-previews/professional-photography.jpg", "Double Exposure Photo":"src/art-previews/double-exposure-photo.jpg", "Noir Film \ud83d\udcfd\ufe0f":"src/art-previews/noir-film.jpg", "Strange Photo":"src/art-previews/strange-photo.jpg", "Cursed Photo":"src/art-previews/cursed-photo.jpg", "1920s Photo":"src/art-previews/1920s-photo.jpg", "1930s Photo":"src/art-previews/1930s-photo.jpg", "1940s Photo":"src/art-previews/1940s-photo.jpg", "1950s Photo":"src/art-previews/1950s-photo.jpg", "1960s Photo":"src/art-previews/1960s-photo.jpg", "1970s Photo":"src/art-previews/1970s-photo.jpg", "1980s Photo":"src/art-previews/1980s-photo.jpg", "1990s Photo":"src/art-previews/1990s-photo.jpg", "Unretouched Realism":"src/art-previews/unretouched-realism.jpg", "Bokeh-Candid":"src/art-previews/bokeh-candid.jpg", "Beauty Macro":"src/art-previews/beauty-macro.jpg", "Golden Hour Portrait":"src/art-previews/golden-hour-portrait.jpg", "Rain-Kissed":"src/art-previews/rain-kissed.jpg", "Underwater":"src/art-previews/underwater.jpg", "NIKKOR 70-200mm Telephoto":"src/art-previews/nikkor-70-200mm-telephoto.jpg", "Photogenic Model":"src/art-previews/photogenic-model.jpg", "Anime":"src/art-previews/anime.jpg", "Cute Anime":"src/art-previews/cute-anime.jpg", "Soft Anime":"src/art-previews/soft-anime.jpg", "Studio Ghibli":"src/art-previews/studio-ghibli.jpg", "Drawn Anime":"src/art-previews/drawn-anime.jpg", "Painted Anime":"src/art-previews/painted-anime.jpg", "Anime Screencap":"src/art-previews/anime-screencap.jpg", "Manga":"src/art-previews/manga.jpg", "Waifu":"src/art-previews/waifu.jpg", "Blue Archive (Kivotos)":"src/art-previews/blue-archive-kivotos.jpg", "Soft Fantasy":"src/art-previews/soft-fantasy.jpg", "Glossy Anime":"src/art-previews/glossy-anime.jpg", "Chibi":"src/art-previews/chibi.jpg", "3D Anime":"src/art-previews/3d-anime.jpg", "Basic Anime":"src/art-previews/basic-anime.jpg", "Basic Anime II":"src/art-previews/basic-anime-ii.jpg", "Enhanced Anime":"src/art-previews/enhanced-anime.jpg", "Real-like Anime":"src/art-previews/real-like-anime.jpg", "Simple Anime Illustration":"src/art-previews/simple-anime-illustration.jpg", "Mobile Game Illustration":"src/art-previews/mobile-game-illustration.jpg", "Beautiful Waifu":"src/art-previews/beautiful-waifu.jpg", "Cute Kawaii":"src/art-previews/cute-kawaii.jpg", "Cute Kawaii 4K":"src/art-previews/cute-kawaii-4k.jpg", "Dragon Ball Style":"src/art-previews/dragon-ball-style.jpg", "Naruto Shippuden Style":"src/art-previews/naruto-shippuden-style.jpg", "My Hero Academia Style":"src/art-previews/my-hero-academia-style.jpg", "Saint Seiya Style":"src/art-previews/saint-seiya-style.jpg", "Vintage Anime":"src/art-previews/vintage-anime.jpg", "Neon Vintage Anime":"src/art-previews/neon-vintage-anime.jpg", "50s Infomercial Anime":"src/art-previews/50s-infomercial-anime.jpg", "Traditional Japanese":"src/art-previews/traditional-japanese.jpg", "Nihonga Painting":"src/art-previews/nihonga-painting.jpg", "Dark Skin Beauties":"src/art-previews/dark-skin-beauties.jpg", "Tarot Card Anime":"src/art-previews/tarot-card-anime.jpg", "Steampunk Anime":"src/art-previews/steampunk-anime.jpg", "Yami Kawaii Anime":"src/art-previews/yami-kawaii-anime.jpg", "Anime Character Sheet":"src/art-previews/anime-character-sheet.jpg", "Idol Anime":"src/art-previews/idol-anime.jpg", "Gothic Anime":"src/art-previews/gothic-anime.jpg", "Manhwa 2D":"src/art-previews/manhwa-2d.jpg", "Realistic Digital Anime":"src/art-previews/realistic-digital-anime.jpg", "Pastel Soft":"src/art-previews/pastel-soft.jpg", "2D Disney Character":"src/art-previews/2d-disney-character.jpg", "3D Disney Character":"src/art-previews/3d-disney-character.jpg", "Disney Sketch":"src/art-previews/disney-sketch.jpg", "Cartoon":"src/art-previews/cartoon.jpg", "Claymation":"src/art-previews/claymation.jpg", "Cute Figurine":"src/art-previews/cute-figurine.jpg", "3D Emoji":"src/art-previews/3d-emoji.jpg", "Digital Painting":"src/art-previews/digital-painting.jpg", "Painterly":"src/art-previews/painterly.jpg", "Oil Painting":"src/art-previews/oil-painting.jpg", "Oil Painting - Realism":"src/art-previews/oil-painting-realism.jpg", "Oil Painting - Old":"src/art-previews/oil-painting-old.jpg", "Oil Painting - 70s Pulp":"src/art-previews/oil-painting-70s-pulp.jpg", "Watercolor":"src/art-previews/watercolor.jpg", "Acrylic CGI":"src/art-previews/acrylic-cgi.jpg", "Acrylic CGI ◩ Scenery":"src/art-previews/acrylic-cgi-scenery.jpg", "Digitally Oiled":"src/art-previews/digitally-oiled.jpg", "Graphic Illustration":"src/art-previews/graphic-illustration.jpg", "Chlorophyll Effect":"src/art-previews/chlorophyll-effect.jpg", "Colored Particles":"src/art-previews/colored-particles.jpg", "Crayon Texture":"src/art-previews/crayon-texture.jpg", "Concept Art":"src/art-previews/concept-art.jpg", "Concept Sketch":"src/art-previews/concept-sketch.jpg", "Pencil":"src/art-previews/pencil.jpg", "Crayon Drawing":"src/art-previews/crayon-drawing.jpg", "Illustration":"src/art-previews/illustration.jpg", "Fantasy Painting":"src/art-previews/fantasy-painting.jpg", "Fantasy Landscape":"src/art-previews/fantasy-landscape.jpg", "Fantasy Portrait":"src/art-previews/fantasy-portrait.jpg", "Tattoo Design":"src/art-previews/tattoo-design.jpg", "Cute Illustration":"src/art-previews/cute-illustration.jpg", "Photopaint Realistic Skin":"src/art-previews/photopaint-realistic-skin.jpg", "Pixel Art":"src/art-previews/pixel-art.jpg", "2D Pokemon":"src/art-previews/2d-pokemon.jpg", "3D Pokemon":"src/art-previews/3d-pokemon.jpg", "Painted Pokemon":"src/art-previews/painted-pokemon.jpg", "YuGiOh Art":"src/art-previews/yugioh-art.jpg", "MTG Card":"src/art-previews/mtg-card.jpg", "Terraria Style":"src/art-previews/terraria-style.jpg", "Retro Game General":"src/art-previews/retro-game-general.jpg", "3D General":"src/art-previews/3d-general.jpg", "Game Art Icon":"src/art-previews/game-art-icon.jpg", "Medieval":"src/art-previews/medieval.jpg", "Fantasy World Map":"src/art-previews/fantasy-world-map.jpg", "Fantasy City Map":"src/art-previews/fantasy-city-map.jpg", "Old World Map":"src/art-previews/old-world-map.jpg", "Vintage Comic":"src/art-previews/vintage-comic.jpg", "Vintage Pulp Art":"src/art-previews/vintage-pulp-art.jpg", "Franco-Belgian Comic":"src/art-previews/franco-belgian-comic.jpg", "Tintin Comic":"src/art-previews/tintin-comic.jpg", "50s Enamel Sign":"src/art-previews/50s-enamel-sign.jpg", "Retro Poster (1950s)":"src/art-previews/retro-poster-1950s.jpg", "Jim Lee — Modern Comics":"src/art-previews/jim-lee-modern-comics.jpg", "Alex Ross — Painted Comics":"src/art-previews/alex-ross-painted-comics.jpg", "Cyberpunk":"src/art-previews/cyberpunk.jpg", "Synthwave":"src/art-previews/synthwave.jpg", "Steampunk":"src/art-previews/steampunk-aesthetic.jpg", "Vaporwave":"src/art-previews/vaporwave.jpg", "Holography X-ray (iridescent void)":"src/art-previews/holography-void.jpg", "Holography X-Ray (Rainbow)":"src/art-previews/holography-rainbow.jpg", "Glitchcore":"src/art-previews/glitchcore.jpg", "Cyberdelic":"src/art-previews/cyberdelic.jpg", "Analog Horror":"src/art-previews/analog-horror.jpg", "Liminal Space":"src/art-previews/liminal-space.jpg", "Machine Theme『Dark』":"src/art-previews/machine-dark.jpg", "Machine Theme『Light』":"src/art-previews/machine-light.jpg", "Machine Theme『Rusty』":"src/art-previews/machine-rusty.jpg", "Machine Theme『Stone』":"src/art-previews/machine-stone.jpg", "Sacred Elegance":"src/art-previews/sacred-elegance.jpg", "Sinister Occult":"src/art-previews/sinister-occult.jpg", "Neo-Noir":"src/art-previews/neo-noir.jpg", "Cosmic Horror":"src/art-previews/cosmic-horror.jpg", "Dark Academia":"src/art-previews/dark-academia.jpg", "Art Nouveau":"src/art-previews/art-nouveau.jpg", "Art Deco":"src/art-previews/art-deco.jpg", "Baroque":"src/art-previews/baroque.jpg", "Impressionism":"src/art-previews/impressionism.jpg", "Renaissance":"src/art-previews/renaissance.jpg", "Rococo":"src/art-previews/rococo.jpg", "Gothic":"src/art-previews/gothic-art.jpg", "Pop Art":"src/art-previews/pop-art.jpg", "Minimalism":"src/art-previews/minimalism.jpg", "Surrealism":"src/art-previews/surrealism.jpg", "Ukiyo-e":"src/art-previews/ukiyo-e.jpg", "Low Poly":"src/art-previews/low-poly.jpg", "Y2K":"src/art-previews/y2k.jpg", "Cottagecore":"src/art-previews/cottagecore.jpg", "Dreamcore":"src/art-previews/dreamcore.jpg", "Weirdcore":"src/art-previews/weirdcore.jpg", "Webcore":"src/art-previews/webcore.jpg", "Ethereal":"src/art-previews/ethereal.jpg", "Pre-Raphaelite":"src/art-previews/pre-raphaelite.jpg", "Realistic-fantastical Glossy":"src/art-previews/realistic-glossy.jpg", "Furry - Cinematic":"src/art-previews/furry-cinematic.jpg", "Furry - Drawn":"src/art-previews/furry-drawn.jpg", "Furry - Oil":"src/art-previews/furry-oil.jpg", "Furry - Painted":"src/art-previews/furry-painted.jpg", "3D Isometric Icon":"src/art-previews/3d-isometric-icon.jpg", "Flat Style Icon":"src/art-previews/flat-style-icon.jpg", "Flat Style Logo":"src/art-previews/flat-style-logo.jpg", "Flat Illustration":"src/art-previews/flat-illustration.jpg", "Concept Art Icon":"src/art-previews/concept-art-icon.jpg", "Digital Painting Icon":"src/art-previews/digital-painting-icon.jpg", "Cute 3D Icon":"src/art-previews/cute-3d-icon.jpg", "Cute 3D Icon 𝗦𝗲𝘁":"src/art-previews/cute-3d-icon-set.jpg", "Anime On Real Photo":"src/art-previews/anime-on-real-photo.jpg", "Cartoon On Real Photo":"src/art-previews/cartoon-on-real-photo.jpg", "2D Character In Real World":"src/art-previews/2d-character-real-world.jpg", "Semi-Real Anime Photo":"src/art-previews/semi-real-anime-photo.jpg", "Street Photography":"src/art-previews/street-photography.jpg", "Selective Color":"src/art-previews/selective-color.jpg", "Analog Vintage Photo":"src/art-previews/analog-vintage-photo.jpg", "Dark Casual Photo":"src/art-previews/dark-casual-photo.jpg", "Cinematic Illustration":"src/art-previews/cinematic-illustration.jpg", "Lomography (Plastic Lens)":"src/art-previews/lomography.jpg", "William Eggleston (Dye Transfer)":"src/art-previews/william-eggleston.jpg", "Cyanotype (Blueprint)":"src/art-previews/cyanotype.jpg", "David LaChapelle (Pop Surreal)":"src/art-previews/david-lachapelle.jpg", "Unreal Engine":"src/art-previews/unreal-engine.jpg", "Lego":"src/art-previews/lego.jpg", "Minecraft":"src/art-previews/minecraft.jpg", "Voxel Art":"src/art-previews/voxel-art.jpg", "League of Legends":"src/art-previews/league-of-legends.jpg", "JRPG":"src/art-previews/jrpg.jpg", "Anime Cinematic Masterpiece":"src/art-previews/anime-cinematic-masterpiece.jpg", "Anime Classic":"src/art-previews/anime-classic.jpg", "Makoto Shinkai (Your Name)":"src/art-previews/makoto-shinkai.jpg", "Genshin Impact":"src/art-previews/genshin-impact.jpg", "Demon Slayer":"src/art-previews/demon-slayer.jpg", "Visual Novel":"src/art-previews/visual-novel.jpg", "Cubism":"src/art-previews/cubism.jpg", "Fauvism":"src/art-previews/fauvism.jpg", "Bauhaus":"src/art-previews/bauhaus.jpg", "De Stijl":"src/art-previews/de-stijl.jpg", "Abstract Expressionism":"src/art-previews/abstract-expressionism.jpg", "Cotton Candy":"src/art-previews/cotton-candy.jpg", "Unicorn":"src/art-previews/unicorn.jpg", "Witchcraft":"src/art-previews/witchcraft.jpg", "Outer Space":"src/art-previews/outer-space.jpg", "🎬 35mm Film Grain":"src/art-previews/film-35mm.jpg", "🎬 70mm IMAX":"src/art-previews/film-70mm-imax.jpg", "🎬 Anamorphic Widescreen":"src/art-previews/film-anamorphic.jpg", "🎬 Technicolor":"src/art-previews/film-technicolor.jpg", "🎬 Kodachrome":"src/art-previews/film-kodachrome.jpg", "🎬 Ektachrome":"src/art-previews/film-ektachrome.jpg", "🎬 Polaroid Snapshot":"src/art-previews/film-polaroid.jpg", "🎬 Toy Camera":"src/art-previews/film-toy-camera.jpg", "🎬 Pinhole Camera":"src/art-previews/film-pinhole.jpg", "🎬 Tilt-Shift Miniature":"src/art-previews/film-tilt-shift.jpg", "🎬 Long Exposure":"src/art-previews/film-long-exposure.jpg", "🎬 Motion Blur":"src/art-previews/film-motion-blur.jpg", "🎬 Light Painting":"src/art-previews/film-light-painting.jpg", "🎬 French New Wave":"src/art-previews/film-french-new-wave.jpg", "🎬 Italian Neorealism":"src/art-previews/film-italian-neorealism.jpg", "🎬 Spaghetti Western":"src/art-previews/film-spaghetti-western.jpg", "🎬 Grindhouse":"src/art-previews/film-grindhouse.jpg", "🎬 Slasher Horror":"src/art-previews/film-slasher-horror.jpg", "🎬 Found Footage":"src/art-previews/film-found-footage.jpg", "🎬 VHS Tape":"src/art-previews/film-vhs-tape.jpg", "🎬 CRT Monitor":"src/art-previews/film-crt-monitor.jpg", "🎬 Surveillance Footage":"src/art-previews/film-surveillance-footage.jpg", "🎬 Documentary Still":"src/art-previews/film-documentary-still.jpg", "🎬 Wes Anderson Symmetry":"src/art-previews/film-wes-anderson.jpg", "🎬 Denis Villeneuve":"src/art-previews/film-denis-villeneuve.jpg", "🎬 Roger Deakins":"src/art-previews/film-roger-deakins.jpg", "🎬 Blade Runner 2049":"src/art-previews/film-blade-runner-2049.jpg", "🎬 Dune (2021)":"src/art-previews/film-dune-2021.jpg", "🎬 Mad Max Fury Road":"src/art-previews/film-mad-max-fury-road.jpg", "🎬 Interstellar":"src/art-previews/film-interstellar.jpg", "🎬 Spider-Verse Animation":"src/art-previews/film-spider-verse.jpg", "🎬 Arcane Series":"src/art-previews/film-arcane-series.jpg", "🖼️ Macro Photography":"src/art-previews/photo-macro-photography.jpg", "🖼️ Astrophotography":"src/art-previews/photo-astrophotography.jpg", "🖼️ Wildlife Photography":"src/art-previews/photo-wildlife-photography.jpg", "🖼️ Sports Photography":"src/art-previews/photo-sports-photography.jpg", "🖼️ Fashion Editorial":"src/art-previews/photo-fashion-editorial.jpg", "🖼️ Beauty Photography":"src/art-previews/photo-beauty-photography.jpg", "🖼️ Product Photography":"src/art-previews/photo-product-photography.jpg", "🖼️ Food Photography":"src/art-previews/photo-food-photography.jpg", "🖼️ Architecture Photography":"src/art-previews/photo-architecture-photography.jpg", "🖼️ Interior Photography":"src/art-previews/photo-interior-photography.jpg"};   // the shared preview box is 108x108
  /* Vionet20 batch (27.09.2026): 26 generated previews */
/* Egon batch (01.10.2026): 8 true-skin/photo previews, seed 777001 */
PREVIEW_IMG["True Skin Detail"] = "src/art-previews/true-skin-detail.jpg";
PREVIEW_IMG["Subsurface Portrait"] = "src/art-previews/subsurface-portrait.jpg";
PREVIEW_IMG["Rembrandt Light"] = "src/art-previews/rembrandt-light.jpg";
PREVIEW_IMG["Documentary Candid"] = "src/art-previews/documentary-candid.jpg";
PREVIEW_IMG["True Lens Optics"] = "src/art-previews/true-lens-optics.jpg";
PREVIEW_IMG["Living Eyes"] = "src/art-previews/living-eyes.jpg";
PREVIEW_IMG["Analog Film Stock"] = "src/art-previews/analog-film-stock.jpg";
PREVIEW_IMG["Anamorphic Night"] = "src/art-previews/anamorphic-night.jpg";
/* Fresh Finds batch (01.10.2026): 67 generated previews, seed 777001 */
PREVIEW_IMG["Astral Aura"] = "src/art-previews/astral-aura.jpg";
PREVIEW_IMG["Caricature"] = "src/art-previews/caricature.jpg";
PREVIEW_IMG["Character Design Sheet"] = "src/art-previews/character-design-sheet.jpg";
PREVIEW_IMG["Knolling Flat-Lay"] = "src/art-previews/knolling-flat-lay.jpg";
PREVIEW_IMG["Sticker Set"] = "src/art-previews/sticker-set.jpg";
PREVIEW_IMG["Terragen Render"] = "src/art-previews/terragen-render.jpg";
PREVIEW_IMG["Suprematism"] = "src/art-previews/suprematism.jpg";
PREVIEW_IMG["Googie"] = "src/art-previews/googie.jpg";
PREVIEW_IMG["Colored Pencil"] = "src/art-previews/colored-pencil.jpg";
PREVIEW_IMG["Ink Drip Drawing"] = "src/art-previews/ink-drip-drawing.jpg";
PREVIEW_IMG["Action Figure"] = "src/art-previews/action-figure.jpg";
PREVIEW_IMG["Harlem Renaissance"] = "src/art-previews/harlem-renaissance.jpg";
PREVIEW_IMG["Fortnite Style"] = "src/art-previews/fortnite-style.jpg";
PREVIEW_IMG["Dadaism"] = "src/art-previews/dadaism.jpg";
PREVIEW_IMG["Futurism"] = "src/art-previews/futurism.jpg";
PREVIEW_IMG["Color Field Painting"] = "src/art-previews/color-field-painting.jpg";
PREVIEW_IMG["Cel Shaded Art"] = "src/art-previews/cel-shaded-art.jpg";
PREVIEW_IMG["Dufaycolor Photo"] = "src/art-previews/dufaycolor-photo.jpg";
PREVIEW_IMG["Albumen Print"] = "src/art-previews/albumen-print.jpg";
PREVIEW_IMG["Calotype Print"] = "src/art-previews/calotype-print.jpg";
PREVIEW_IMG["Halftone Print"] = "src/art-previews/halftone-print.jpg";
PREVIEW_IMG["Cross Processed Film"] = "src/art-previews/cross-processed-film.jpg";
PREVIEW_IMG["Gyotaku"] = "src/art-previews/gyotaku.jpg";
PREVIEW_IMG["Suminagashi Marbling"] = "src/art-previews/suminagashi-marbling.jpg";
PREVIEW_IMG["Scrimshaw"] = "src/art-previews/scrimshaw.jpg";
PREVIEW_IMG["Mokume-gane"] = "src/art-previews/mokume-gane.jpg";
PREVIEW_IMG["Palekh Miniature"] = "src/art-previews/palekh-miniature.jpg";
PREVIEW_IMG["Gond Painting"] = "src/art-previews/gond-painting.jpg";
PREVIEW_IMG["Punk Collage"] = "src/art-previews/punk-collage.jpg";
PREVIEW_IMG["Coloring Book"] = "src/art-previews/coloring-book.jpg";
PREVIEW_IMG["Embroidery"] = "src/art-previews/embroidery.jpg";
PREVIEW_IMG["Chromolithograph"] = "src/art-previews/chromolithograph.jpg";
PREVIEW_IMG["Dynamic Action"] = "src/art-previews/dynamic-action.jpg";
PREVIEW_IMG["Spontaneous Snapshot"] = "src/art-previews/spontaneous-snapshot.jpg";
PREVIEW_IMG["Origami"] = "src/art-previews/origami.jpg";
PREVIEW_IMG["GTA Style"] = "src/art-previews/gta-style.jpg";
PREVIEW_IMG["Smartphone Photo"] = "src/art-previews/smartphone-photo.jpg";
PREVIEW_IMG["Paper Quilling"] = "src/art-previews/paper-quilling.jpg";
PREVIEW_IMG["Pointillism"] = "src/art-previews/pointillism.jpg";
PREVIEW_IMG["Typography Art"] = "src/art-previews/typography-art.jpg";
PREVIEW_IMG["Rubber Hose Cartoon"] = "src/art-previews/rubber-hose-cartoon.jpg";
PREVIEW_IMG["Duck Comics"] = "src/art-previews/duck-comics.jpg";
PREVIEW_IMG["Bad Flash Photo"] = "src/art-previews/bad-flash-photo.jpg";
PREVIEW_IMG["Retro Visual Novel"] = "src/art-previews/retro-visual-novel.jpg";
PREVIEW_IMG["Japanese Visual Novel"] = "src/art-previews/japanese-visual-novel.jpg";
PREVIEW_IMG["PS1 Graphics"] = "src/art-previews/ps1-graphics.jpg";
PREVIEW_IMG["PS2 Graphics"] = "src/art-previews/ps2-graphics.jpg";
PREVIEW_IMG["Modern 3D Game"] = "src/art-previews/modern-3d-game.jpg";
PREVIEW_IMG["Game Cinematic"] = "src/art-previews/game-cinematic.jpg";
PREVIEW_IMG["Hollow Knight Style"] = "src/art-previews/hollow-knight-style.jpg";
PREVIEW_IMG["Charcoal Drawing"] = "src/art-previews/charcoal-drawing.jpg";
PREVIEW_IMG["Graffiti Wall"] = "src/art-previews/graffiti-wall.jpg";
PREVIEW_IMG["Child Drawing"] = "src/art-previews/child-drawing.jpg";
PREVIEW_IMG["Yamato-e"] = "src/art-previews/yamato-e.jpg";
PREVIEW_IMG["Hanafuda Card"] = "src/art-previews/hanafuda-card.jpg";
PREVIEW_IMG["CD Cover Art"] = "src/art-previews/cd-cover-art.jpg";
PREVIEW_IMG["Silhouette Portrait"] = "src/art-previews/silhouette-portrait.jpg";
PREVIEW_IMG["Plushie Photo"] = "src/art-previews/plushie-photo.jpg";
PREVIEW_IMG["Stop Motion"] = "src/art-previews/stop-motion.jpg";
PREVIEW_IMG["Wood Sculpture"] = "src/art-previews/wood-sculpture.jpg";
PREVIEW_IMG["Metal Sculpture"] = "src/art-previews/metal-sculpture.jpg";
PREVIEW_IMG["Oceanic Tribal Art"] = "src/art-previews/oceanic-tribal-art.jpg";
PREVIEW_IMG["Claymation Film"] = "src/art-previews/claymation-film.jpg";
PREVIEW_IMG["Pictorialism"] = "src/art-previews/pictorialism.jpg";
PREVIEW_IMG["Fayum Portrait"] = "src/art-previews/fayum-portrait.jpg";
PREVIEW_IMG["Afrofuturism"] = "src/art-previews/afrofuturism.jpg";
PREVIEW_IMG["Atompunk"] = "src/art-previews/atompunk.jpg";
PREVIEW_IMG["Fineline Illustration"] = "src/art-previews/fineline-illustration.jpg";
PREVIEW_IMG["Flat Vector Illustration"] = "src/art-previews/flat-vector-illustration.jpg";
PREVIEW_IMG["Polygonal Illustration"] = "src/art-previews/polygonal-illustration.jpg";
PREVIEW_IMG["Detailed Cartoony Illustrations"] = "src/art-previews/detailed-cartoony-illustrations.jpg";
PREVIEW_IMG["Cute Cartoon Illustrations"] = "src/art-previews/cute-cartoon-illustrations.jpg";
PREVIEW_IMG["Comic/Manga Illustration"] = "src/art-previews/comic-manga-illustration.jpg";
PREVIEW_IMG["Grim Dark Fantasy Illustration"] = "src/art-previews/grim-dark-fantasy-illustration.jpg";
PREVIEW_IMG["General High Quality Anime"] = "src/art-previews/general-high-quality-anime.jpg";
PREVIEW_IMG["Old Style Anime A"] = "src/art-previews/old-style-anime-a.jpg";
PREVIEW_IMG["Old Style Anime B"] = "src/art-previews/old-style-anime-b.jpg";
PREVIEW_IMG["Color Pop Anime Illustration"] = "src/art-previews/color-pop-anime-illustration.jpg";
PREVIEW_IMG["Colored Patterns Anime"] = "src/art-previews/colored-patterns-anime.jpg";
PREVIEW_IMG["Atmospheric Painting"] = "src/art-previews/atmospheric-painting.jpg";
PREVIEW_IMG["Brushy Paintings"] = "src/art-previews/brushy-paintings.jpg";
PREVIEW_IMG["Brushy Paintings 2"] = "src/art-previews/brushy-paintings-2.jpg";
PREVIEW_IMG["Drip/Palette Knife Paintings"] = "src/art-previews/drip-palette-knife-paintings.jpg";
PREVIEW_IMG["Anime-Realism Paintings"] = "src/art-previews/anime-realism-paintings.jpg";
PREVIEW_IMG["Anime-Impressionism Paintings"] = "src/art-previews/anime-impressionism-paintings.jpg";
PREVIEW_IMG["Vintage Anime-Realistic Render"] = "src/art-previews/vintage-anime-realistic-render.jpg";
PREVIEW_IMG["Wetplate Photo Look"] = "src/art-previews/wetplate-photo-look.jpg";
PREVIEW_IMG["B&W Photo"] = "src/art-previews/bw-photo.jpg";
PREVIEW_IMG["*Realistic* Portraits"] = "src/art-previews/realistic-portraits.jpg";
PREVIEW_IMG["*Realistic* Anime"] = "src/art-previews/realistic-anime.jpg";
PREVIEW_IMG["Sims/Runescape Graphics"] = "src/art-previews/sims-runescape-graphics.jpg";
PREVIEW_IMG["Noisy/Grainy Effect"] = "src/art-previews/noisy-grainy-effect.jpg";
PREVIEW_IMG["Marble Sculpture"] = "src/art-previews/marble-sculpture.jpg";
PREVIEW_IMG["Street Photography"] = "src/art-previews/street-photography.jpg";
PREVIEW_IMG["Selective Color"] = "src/art-previews/selective-color.jpg";
PREVIEW_IMG["Analog Vintage Photo"] = "src/art-previews/analog-vintage-photo.jpg";
PREVIEW_IMG["Dark Casual Photo"] = "src/art-previews/dark-casual-photo.jpg";
PREVIEW_IMG["Cinematic Illustration"] = "src/art-previews/cinematic-illustration.jpg";
PREVIEW_IMG["Lomography (Plastic Lens)"] = "src/art-previews/lomography.jpg";
PREVIEW_IMG["William Eggleston (Dye Transfer)"] = "src/art-previews/william-eggleston.jpg";
PREVIEW_IMG["Cyanotype (Blueprint)"] = "src/art-previews/cyanotype.jpg";
PREVIEW_IMG["David LaChapelle (Pop Surreal)"] = "src/art-previews/david-lachapelle.jpg";
PREVIEW_IMG["Unreal Engine"] = "src/art-previews/unreal-engine.jpg";
PREVIEW_IMG["Artist: Vincent van Gogh"] = "src/art-previews/artist-vincent-van-gogh.jpg";
PREVIEW_IMG["Artist: Claude Monet"] = "src/art-previews/artist-claude-monet.jpg";
PREVIEW_IMG["Artist: Gustav Klimt"] = "src/art-previews/artist-gustav-klimt.jpg";
PREVIEW_IMG["Artist: Alphonse Mucha"] = "src/art-previews/artist-alphonse-mucha.jpg";
PREVIEW_IMG["Artist: Hayao Miyazaki"] = "src/art-previews/artist-hayao-miyazaki.jpg";
PREVIEW_IMG["Artist: Katsushika Hokusai"] = "src/art-previews/artist-katsushika-hokusai.jpg";
PREVIEW_IMG["\uD83C\uDF0D Sumi-e"] = "src/art-previews/sumi-e.jpg";
PREVIEW_IMG["Stained Glass"] = "src/art-previews/stained-glass.jpg";
PREVIEW_IMG["\uD83E\uDDEC Fashion Illustration"] = "src/art-previews/fashion-illustration.jpg";
PREVIEW_IMG["Steampunk"] = "src/art-previews/steampunk.jpg";
PREVIEW_IMG["Noir Film 📽️"] = "src/art-previews/noir-film.jpg";
PREVIEW_IMG["Professional Photography 📸"] = "src/art-previews/professional-photography.jpg";
PREVIEW_IMG["🧬 Botanical Illustration"] = "src/art-previews/botanical-illustration.jpg";
PREVIEW_IMG["🧬 Travel Poster"] = "src/art-previews/travel-poster.jpg";
PREVIEW_IMG["🌍 Kintsugi"] = "src/art-previews/kintsugi.jpg";
PREVIEW_IMG["🌍 Aboriginal Dot Painting"] = "src/art-previews/aboriginal-dot-painting.jpg";
PREVIEW_IMG["🌍 Aztec Art"] = "src/art-previews/aztec-art.jpg";
PREVIEW_IMG["🌍 Greek Pottery"] = "src/art-previews/greek-pottery.jpg";
PREVIEW_IMG["🌍 Islamic Geometric"] = "src/art-previews/islamic-geometric.jpg";
PREVIEW_IMG["🌍 Celtic Illumination"] = "src/art-previews/celtic-illumination.jpg";
PREVIEW_IMG["🌍 Byzantine Icon"] = "src/art-previews/byzantine-icon.jpg";
PREVIEW_IMG["🌍 Ottoman Miniature"] = "src/art-previews/ottoman-miniature.jpg";
PREVIEW_IMG["🌍 Mughal Painting"] = "src/art-previews/mughal-painting.jpg";
PREVIEW_IMG["🌍 Shan Shui"] = "src/art-previews/shan-shui.jpg";
PREVIEW_IMG["🌍 Chinese Brush"] = "src/art-previews/chinese-brush.jpg";
PREVIEW_IMG["🌍 Ink Wash"] = "src/art-previews/ink-wash.jpg";
PREVIEW_IMG["Artist: Maxfield Parrish"] = "src/art-previews/artist-maxfield-parrish.jpg";
PREVIEW_IMG["Artist: Keith Haring"] = "src/art-previews/artist-keith-haring.jpg";
PREVIEW_IMG["Artist: Kim Jung Gi"] = "src/art-previews/artist-kim-jung-gi.jpg";
PREVIEW_IMG["Artist: Yoshitaka Amano"] = "src/art-previews/artist-yoshitaka-amano.jpg";
PREVIEW_IMG["Artist: Osamu Tezuka"] = "src/art-previews/artist-osamu-tezuka.jpg";
PREVIEW_IMG["Artist: Akira Toriyama"] = "src/art-previews/artist-akira-toriyama.jpg";
PREVIEW_IMG["Artist: Moebius"] = "src/art-previews/artist-moebius.jpg";
PREVIEW_IMG["Artist: Zdzislaw Beksinski"] = "src/art-previews/artist-zdzislaw-beksinski.jpg";
PREVIEW_IMG["Artist: H.R. Giger"] = "src/art-previews/artist-hr-giger.jpg";
PREVIEW_IMG["Artist: Boris Vallejo"] = "src/art-previews/artist-boris-vallejo.jpg";
PREVIEW_IMG["Artist: Frank Frazetta"] = "src/art-previews/artist-frank-frazetta.jpg";
PREVIEW_IMG["Artist: Michael Whelan"] = "src/art-previews/artist-michael-whelan.jpg";
PREVIEW_IMG["Artist: Donato Giancola"] = "src/art-previews/artist-donato-giancola.jpg";
PREVIEW_IMG["Artist: Peter Mohrbacher"] = "src/art-previews/artist-peter-mohrbacher.jpg";
PREVIEW_IMG["Artist: Pascal Campion"] = "src/art-previews/artist-pascal-campion.jpg";
PREVIEW_IMG["Artist: Ruan Jia"] = "src/art-previews/artist-ruan-jia.jpg";
PREVIEW_IMG["Artist: James Jean"] = "src/art-previews/artist-james-jean.jpg";
PREVIEW_IMG["Artist: Craig Mullins"] = "src/art-previews/artist-craig-mullins.jpg";
PREVIEW_IMG["Artist: Simon Stalenhag"] = "src/art-previews/artist-simon-stalenhag.jpg";
PREVIEW_IMG["Artist: Syd Mead"] = "src/art-previews/artist-syd-mead.jpg";
PREVIEW_IMG["Artist: Rossdraws"] = "src/art-previews/artist-rossdraws.jpg";
PREVIEW_IMG["Artist: Loish"] = "src/art-previews/artist-loish.jpg";
PREVIEW_IMG["Artist: Guweiz"] = "src/art-previews/artist-guweiz.jpg";
PREVIEW_IMG["Artist: Ilya Kuvshinov"] = "src/art-previews/artist-ilya-kuvshinov.jpg";
PREVIEW_IMG["Artist: WLOP"] = "src/art-previews/artist-wlop.jpg";
PREVIEW_IMG["Artist: Artgerm"] = "src/art-previews/artist-artgerm.jpg";
PREVIEW_IMG["Artist: Greg Rutkowski"] = "src/art-previews/artist-greg-rutkowski.jpg";
PREVIEW_IMG["\ud83c\udf0d Gongbi"] = "src/art-previews/gongbi.jpg";
PREVIEW_IMG["\ud83c\udf0d Persian Miniature"] = "src/art-previews/persian-miniature.jpg";
PREVIEW_IMG["\ud83e\uddec Soviet Poster"] = "src/art-previews/soviet-poster.jpg";
PREVIEW_IMG["\ud83e\uddec Ink Drawing"] = "src/art-previews/ink-drawing.jpg";
PREVIEW_IMG["\ud83d\uddbc️ Wedding Photography"] = "src/art-previews/wedding-photography.jpg";
PREVIEW_IMG["\ud83d\uddbc️ Portrait Studio"] = "src/art-previews/portrait-studio.jpg";
PREVIEW_IMG["Artist: Rembrandt"] = "src/art-previews/artist-rembrandt.jpg";
PREVIEW_IMG["Artist: Andy Warhol"] = "src/art-previews/artist-andy-warhol.jpg";
PREVIEW_IMG["Artist: Takashi Murakami"] = "src/art-previews/artist-takashi-murakami.jpg";
PREVIEW_IMG["Artist: Makoto Shinkai"] = "src/art-previews/artist-makoto-shinkai.jpg";
PREVIEW_IMG["Ring-Light Selfie"] = "src/art-previews/ringlight-selfie.jpg";
PREVIEW_IMG["Fashion Editorial"] = "src/art-previews/fashion-editorial.jpg";
PREVIEW_IMG["Fine-Art Portrait"] = "src/art-previews/fine-art-portrait.jpg";
PREVIEW_IMG["Purple Fashion Editorial"] = "src/art-previews/purple-fashion-editorial.jpg";
PREVIEW_IMG["Enhanced-Physique"] = "src/art-previews/enhanced-physique.jpg";
PREVIEW_IMG["Royalty Vibe"] = "src/art-previews/royalty-vibe.jpg";
PREVIEW_IMG["Blood Velvet"] = "src/art-previews/blood-velvet.jpg";
PREVIEW_IMG["Hyperreal Anime Portrait"] = "src/art-previews/hyperreal-anime-portrait.jpg";
PREVIEW_IMG["Snapchat Selfie"] = "src/art-previews/snapchat-selfie.jpg";
PREVIEW_IMG["Bubbly Anime 2D"] = "src/art-previews/bubbly-anime-2d.jpg";
PREVIEW_IMG["Retro Cel Anime 2D"] = "src/art-previews/retro-cel-anime-2d.jpg";
PREVIEW_IMG["Artist: Junji Ito"] = "src/art-previews/artist-junji-ito.jpg";
PREVIEW_IMG["Artist: Kentaro Miura"] = "src/art-previews/artist-kentaro-miura.jpg";
PREVIEW_IMG["Artist: Yoji Shinkawa"] = "src/art-previews/artist-yoji-shinkawa.jpg";
PREVIEW_IMG["Artist: Gustave Dore"] = "src/art-previews/artist-gustave-dore.jpg";
PREVIEW_IMG["Artist: Leonardo da Vinci"] = "src/art-previews/artist-leonardo-da-vinci.jpg";
PREVIEW_IMG["Artist: Sandro Botticelli"] = "src/art-previews/artist-sandro-botticelli.jpg";
PREVIEW_IMG["Artist: Hieronymus Bosch"] = "src/art-previews/artist-hieronymus-bosch.jpg";
PREVIEW_IMG["Artist: John Singer Sargent"] = "src/art-previews/artist-john-singer-sargent.jpg";
PREVIEW_IMG["Artist: William Turner"] = "src/art-previews/artist-william-turner.jpg";
PREVIEW_IMG["Artist: Edward Hopper"] = "src/art-previews/artist-edward-hopper.jpg";
PREVIEW_IMG["Artist: Edvard Munch"] = "src/art-previews/artist-edvard-munch.jpg";
PREVIEW_IMG["Artist: M.C. Escher"] = "src/art-previews/artist-mc-escher.jpg";
PREVIEW_IMG["Artist: Norman Rockwell"] = "src/art-previews/artist-norman-rockwell.jpg";
PREVIEW_IMG["🌍 Tibetan Thangka"] = "src/art-previews/tibetan-thangka.jpg";
PREVIEW_IMG["🌍 Arabesque"] = "src/art-previews/arabesque.jpg";
PREVIEW_IMG["🌍 Moroccan Zellige"] = "src/art-previews/moroccan-zellige.jpg";
PREVIEW_IMG["🌍 Egyptian Hieroglyph"] = "src/art-previews/egyptian-hieroglyph.jpg";
PREVIEW_IMG["🌍 Roman Mosaic"] = "src/art-previews/roman-mosaic.jpg";
PREVIEW_IMG["🌍 Mayan Art"] = "src/art-previews/mayan-art.jpg";
PREVIEW_IMG["🌍 Maori Art"] = "src/art-previews/maori-art.jpg";
PREVIEW_IMG["🖼️ Travel Photography"] = "src/art-previews/travel-photography.jpg";
PREVIEW_IMG["🖼️ Documentary Photography"] = "src/art-previews/documentary-photography.jpg";
PREVIEW_IMG["🖼️ Headshot"] = "src/art-previews/headshot.jpg";
PREVIEW_IMG["🖼️ Yearbook Photo"] = "src/art-previews/yearbook-photo.jpg";
PREVIEW_IMG["🖼️ Maternity Photography"] = "src/art-previews/maternity-photography.jpg";
PREVIEW_IMG["🖼️ Newborn Photography"] = "src/art-previews/newborn-photography.jpg";
PREVIEW_IMG["🖼️ Pet Photography"] = "src/art-previews/pet-photography.jpg";
PREVIEW_IMG["🖼️ Aerial Drone"] = "src/art-previews/aerial-drone.jpg";
PREVIEW_IMG["🖼️ Satellite View"] = "src/art-previews/satellite-view.jpg";
PREVIEW_IMG["🖼️ Infrared Photography"] = "src/art-previews/infrared-photography.jpg";
PREVIEW_IMG["🖼️ Thermal Imaging"] = "src/art-previews/thermal-imaging.jpg";
PREVIEW_IMG["🖼️ X-Ray Image"] = "src/art-previews/x-ray-image.jpg";
PREVIEW_IMG["🖼️ Microscopy"] = "src/art-previews/microscopy.jpg";
PREVIEW_IMG["🖼️ Night Sky"] = "src/art-previews/night-sky.jpg";
PREVIEW_IMG["🖼️ Light Trails"] = "src/art-previews/light-trails.jpg";
PREVIEW_IMG["🖼️ Foggy Morning"] = "src/art-previews/foggy-morning.jpg";
PREVIEW_IMG["🖼️ Seascape"] = "src/art-previews/seascape.jpg";
PREVIEW_IMG["🖼️ Desertscape"] = "src/art-previews/desertscape.jpg";
PREVIEW_IMG["𝗡𝗼 𝘀𝘁𝘆𝗹𝗲"] = "src/art-previews/no-style.jpg";
PREVIEW_IMG["🌍 Medieval Illumination"] = "src/art-previews/medieval-illumination.jpg";
PREVIEW_IMG["🌍 African Tribal Art"] = "src/art-previews/african-tribal-art.jpg";
PREVIEW_IMG["🌍 Native American Ledger"] = "src/art-previews/native-american-ledger.jpg";
PREVIEW_IMG["🌍 Navajo Weaving"] = "src/art-previews/navajo-weaving.jpg";
PREVIEW_IMG["🌍 Mexican Folk Art"] = "src/art-previews/mexican-folk-art.jpg";
PREVIEW_IMG["🌍 Kente Cloth"] = "src/art-previews/kente-cloth.jpg";
PREVIEW_IMG["🌍 Batik"] = "src/art-previews/batik.jpg";
PREVIEW_IMG["🌍 Shibori"] = "src/art-previews/shibori.jpg";
PREVIEW_IMG["🧬 Vector Art"] = "src/art-previews/vector-art.jpg";
PREVIEW_IMG["🧬 Line Art"] = "src/art-previews/line-art.jpg";
PREVIEW_IMG["🧬 Continuous Line"] = "src/art-previews/continuous-line.jpg";
PREVIEW_IMG["🧬 Pen and Ink"] = "src/art-previews/pen-and-ink.jpg";
PREVIEW_IMG["🧬 Cross-Hatching"] = "src/art-previews/cross-hatching.jpg";
PREVIEW_IMG["🧬 Stippling"] = "src/art-previews/stippling.jpg";
PREVIEW_IMG["🧬 Doodle Art"] = "src/art-previews/doodle-art.jpg";
PREVIEW_IMG["🧬 Zentangle"] = "src/art-previews/zentangle.jpg";
PREVIEW_IMG["🧬 Mandala Art"] = "src/art-previews/mandala-art.jpg";
PREVIEW_IMG["🧬 Celtic Knot"] = "src/art-previews/celtic-knot.jpg";
PREVIEW_IMG["🧬 WPA Poster"] = "src/art-previews/wpa-poster.jpg";
PREVIEW_IMG["🧬 Movie Poster"] = "src/art-previews/movie-poster.jpg";
PREVIEW_IMG["🧬 Album Cover"] = "src/art-previews/album-cover.jpg";
PREVIEW_IMG["🧬 Editorial Illustration"] = "src/art-previews/editorial-illustration.jpg";
PREVIEW_IMG["🧬 Children's Book"] = "src/art-previews/childrens-book.jpg";
PREVIEW_IMG["🧬 Storybook"] = "src/art-previews/storybook.jpg";
PREVIEW_IMG["🧬 Fairy Tale"] = "src/art-previews/fairy-tale.jpg";
PREVIEW_IMG["🧬 Dark Fairytale"] = "src/art-previews/dark-fairytale.jpg";
PREVIEW_IMG["🧬 Anatomical Drawing"] = "src/art-previews/anatomical-drawing.jpg";
PREVIEW_IMG["🧬 Technical Drawing"] = "src/art-previews/technical-drawing.jpg";
PREVIEW_IMG["🧬 Blueprint"] = "src/art-previews/blueprint.jpg";
PREVIEW_IMG["🧬 Patent Drawing"] = "src/art-previews/patent-drawing.jpg";
PREVIEW_IMG["🧬 Architectural Rendering"] = "src/art-previews/architectural-rendering.jpg";
PREVIEW_IMG["🧬 Industrial Design"] = "src/art-previews/industrial-design.jpg";
PREVIEW_IMG["🧬 Papercraft"] = "src/art-previews/papercraft.jpg";
PREVIEW_IMG["Artist: Steve McCurry"] = "src/art-previews/artist-steve-mccurry.jpg";
PREVIEW_IMG["Artist: Annie Leibovitz"] = "src/art-previews/artist-annie-leibovitz.jpg";
PREVIEW_IMG["Borderlands Style"] = "src/art-previews/borderlands-style.jpg";
PREVIEW_IMG["Artist: Atey Ghailan"] = "src/art-previews/artist-atey-ghailan.jpg";
PREVIEW_IMG["Artist: Kantoku"] = "src/art-previews/artist-kantoku.jpg";
PREVIEW_IMG["Pixiv Collab"] = "src/art-previews/pixiv-collab.jpg";
PREVIEW_IMG["🎬 Kodak Portra 400"] = "src/art-previews/kodak-portra-400.jpg";
PREVIEW_IMG["🎬 Medium Format Film"] = "src/art-previews/medium-format-film.jpg";
PREVIEW_IMG["RE Engine"] = "src/art-previews/re-engine.jpg";
PREVIEW_IMG["Fire Emblem"] = "src/art-previews/fire-emblem.jpg";
PREVIEW_IMG["Persona"] = "src/art-previews/persona.jpg";
PREVIEW_IMG["Nier"] = "src/art-previews/nier.jpg";
  var ART_TAGS = {"Realistic Picture":"photo realistic", "8K experiment":"photo macro", "Realistic (experimental)":"photo realistic portrait", "Professional Photo":"photo portrait", "Casual Photo":"photo casualPhoto portrait", "Cinematic":"photo portrait render cinematic", "Cursed Photo":"creepy", "1920s Photo":"photo vintage", "1930s Photo":"photo vintage", "1940s Photo":"photo vintage", "1950s Photo":"photo vintage", "1960s Photo":"photo vintage", "1970s Photo":"photo vintage", "1980s Photo":"photo vintage portrait", "1990s Photo":"vintage", "Anime":"basicAnime anime drawing cartoon", "Cute Anime":"anime drawing cuteAnime cartoon", "Soft Anime":"anime drawing cartoon", "Studio Ghibli":"ghibli anime cartoon", "Drawn Anime":"anime drawing drawnAnime cartoon", "Painted Anime":"anime painting paintedAnime drawing cartoon", "Anime Screencap":"anime drawing cartoon", "Manga":"anime drawing manga comic cartoon", "Anime Muse":"anime muse cartoon", "Vintage Anime":"anime vintage drawing", "Neon Vintage Anime":"anime vintage", "50s Infomercial Anime":"painting anime vintage cartoon", "Traditional Japanese":"japanese vintage cartoon", "Nihonga Painting":"japanese vintage comic", "2D Disney Character":"disney portrait cartoon comic drawing", "3D Disney Character":"disney render portrait cartoon", "Disney Sketch":"disney cartoon sketch comic drawing", "Cartoon":"cartoon basicCartoon", "Claymation":"claymation", "Cute Figurine":"disney emoji", "3D Emoji":"emoji", "Digital Painting":"painting landscape digitalPainting drawing", "Painterly":"painting landscape digitalPainting drawing", "Oil Painting":"painting oilPainting landscape portrait drawing", "Oil Painting - Realism":"painting oilPainting landscape portrait drawing", "Oil Painting - Old":"painting oilPainting vintage landscape portrait drawing", "Oil Painting - 70s Pulp":"painting oilPainting vintage landscape portrait drawing", "Watercolor":"painting", "Concept Art":"painting landscape", "Concept Sketch":"sketch comic drawing", "Pencil":"drawing", "Illustration":"illustration drawing", "Fantasy Painting":"painting landscape fantasy", "Fantasy Landscape":"painting poster coverArt vintage landscape fantasy", "Fantasy Portrait":"fantasyPortrait painting fantasy portrait", "Tattoo Design":"tattoo", "Cute Illustration":"illustration drawing", "Pixel Art":"pixelArt vintage", "2D Pokemon":"pokemon drawing cartoon", "3D Pokemon":"pokemon", "Painted Pokemon":"pokemon", "YuGiOh Art":"yugioh", "Game Art Icon":"icon", "Medieval":"vintage painting portrait", "Fantasy World Map":"map fantasy", "Fantasy City Map":"map fantasy", "Old World Map":"map fantasy", "Vintage Comic":"vintage comic cartoon", "Vintage Pulp Art":"painting poster coverArt vintage comic cartoon", "Franco-Belgian Comic":"vintage comic cartoon", "Tintin Comic":"vintage comic cartoon", "50s Enamel Sign":"vintage", "Furry - Cinematic":"furry photo portrait render cinematic", "Furry - Drawn":"furry", "Furry - Oil":"furryOil furry", "Furry - Painted":"furry", "3D Isometric Icon":"icon emoji", "Flat Style Icon":"icon", "Flat Style Logo":"icon logo", "Flat Illustration":"illustration drawing", "Concept Art Icon":"icon", "Digital Painting Icon":"icon", "Cute 3D Icon":"icon", "Cute 3D Icon 𝗦𝗲𝘁":"icon", "Artist: Steve McCurry":"photo realistic portrait", "Artist: Annie Leibovitz":"photo realistic portrait", "Borderlands Style":"game cartoon", "Artist: Atey Ghailan":"painting fantasy", "Artist: Kantoku":"anime drawing", "Pixiv Collab":"anime drawing", "🎬 Kodak Portra 400":"photo film vintage", "🎬 Medium Format Film":"photo film", "RE Engine":"game render", "Fire Emblem":"game anime", "Persona":"game anime", "Nier":"game anime"};   // style name -> its main.pjs `meta:tags` keywords (for the search box; keep in sync with main.pjs when tags change)

  PREVIEW_IMG["Ukiyo-e 2"] = "src/art-previews/ukiyo-e-2.jpg";
  ART_TAGS["Ukiyo-e 2"] = "ukiyoe japanese woodblock vintage painting";
  ;function toast(m) { try { if (window.dragonToast) window.dragonToast(m); } catch (e) {} }
  ;function q(sel) { return document.querySelector(sel); }
  ;function artSelect() { return q('select[data-name="artStyle"]'); }
  ;function artCtn() { var s = artSelect(); return s ? s.closest(".input-ctn") : null; }
  ;function descCtn() { return document.getElementById("userInputsCtn8462746262"); }
  ;function lsGet(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  ;function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  // ---------------------------------------------------------------- state
  // the accordion standard is default CLOSED, exactly like the ⚙️ Control Panel and the 📝 Prompt Panel
  var open = lsGet(LS_OPEN, "0") === "1";
  var multiOn = lsGet(LS_MULTI, "0") === "1";
  var mixOn = lsGet(LS_MIX, "0") === "1";
  var lockSeed = lsGet(LS_LOCK, "1") !== "0";
  var selected = {};
  try { selected = JSON.parse(lsGet(LS_SEL, "{}")) || {}; } catch (e) { selected = {}; }
  ;function selSave() { lsSet(LS_SEL, JSON.stringify(selected)); }
  ;function selList() {
    var out = [];
    for (var k in selected) if (Object.prototype.hasOwnProperty.call(selected, k) && selected[k]) out.push(k);
    return out;
  }
  ;function syncStateFromLS() {
    multiOn = lsGet(LS_MULTI, "0") === "1";
    mixOn = lsGet(LS_MIX, "0") === "1";
    open = lsGet(LS_OPEN, "0") === "1";
    try { lockSeed = lsGet(LS_LOCK, "1") !== "0"; } catch (eL) {}
    try { selected = JSON.parse(lsGet(LS_SEL, "{}")) || {}; } catch (eS) { selected = {}; }
    try {
      var _mb = toolsEl ? toolsEl.querySelectorAll("[data-dragon-multi]") : [];
      for (var _mi = 0; _mi < _mb.length; _mi++) _mb[_mi].style.display = multiOn ? "" : "none";
    } catch (eM) {}
    try { if (mixRowEl) mixRowEl.style.display = mixOn ? "flex" : "none"; } catch (eX) {}
    try { syncMixGrid(); } catch (eG) {}
    try { syncMixBtn(); } catch (eB) {}
    try { syncPicks(); } catch (eP) {}
  }
  window.addEventListener("storage", function (e) {
    try {
      if (!e || !e.key) return;
      if (e.key === LS_MULTI || e.key === LS_MIX || e.key === LS_SEL || e.key === LS_OPEN || e.key === LS_LOCK) syncStateFromLS();
    } catch (e2) {}
  });

  // ---------------------------------------------------------------- collapsible categories + favorites
  // catClosed: {catName:1} for collapsed categories, persisted. favs: {styleName:1} in tap order, persisted.
  var catClosed = {};
  try { catClosed = JSON.parse(lsGet(LS_CATS, "{}")) || {}; } catch (e) { catClosed = {}; }
  ;function catSave() { lsSet(LS_CATS, JSON.stringify(catClosed)); }
  ;function isCatClosed(cat) { return !!catClosed[cat || ""]; }
  var favs = {};
  try { favs = JSON.parse(lsGet(LS_FAV, "{}")) || {}; } catch (e) { favs = {}; }
  ;function favSave() { lsSet(LS_FAV, JSON.stringify(favs)); }
  ;function isFav(name) { return !!favs[name]; }
  ;function favNames() {
    var out = [];
    for (var k in favs) if (Object.prototype.hasOwnProperty.call(favs, k) && favs[k]) out.push(k);
    return out;
  }
  ;function toggleFav(name) {
    if (!name) return;
    if (favs[name]) { delete favs[name]; toast("\uD83D\uDC94 removed \u201C" + name + "\u201D from favorites"); }
    else { favs[name] = 1; toast("\u2764\uFE0F \u201C" + name + "\u201D pinned to favorites"); }
    favSave();
    try { buildGrid(); } catch (e) {}
    try { syncPicks(); } catch (e2) {}
    try { applyFilter(); } catch (e3) {}
  }
  ;function toggleCatOpen(cat) {
    cat = cat || "";
    if (catClosed[cat]) delete catClosed[cat]; else catClosed[cat] = 1;
    catSave();
    try { applyFilter(); } catch (e) {}
  }
  ;function applyClosed() {
    if (!gridEl) return;
    var kids = gridEl.children, cur = null;
    for (var k = 0; k < kids.length; k++) {
      var n = kids[k];
      if (n.className === "dragon-art-cat") {
        cur = n.dataset.cat || "";
        var closed = isCatClosed(cur);
        try {
          var chv = n.querySelector(".dragon-art-chev");
          if (chv) chv.textContent = closed ? "\u25B8" : "\u25BE";
          n.style.opacity = closed ? ".75" : "1";
        } catch (e) {}
        continue;
      }
      if (cur !== null && isCatClosed(cur)) {
        if (!n.classList.contains("dragon-art-collapsed")) n.classList.add("dragon-art-collapsed");
      } else {
        if (n.classList.contains("dragon-art-collapsed")) n.classList.remove("dragon-art-collapsed");
      }
    }
  }

  // ---------------------------------------------------------------- the style list
  // Walk the (already emoji/category enhanced) artStyle <select> and group it exactly like the tester does:
  // a disabled "── <emoji> <Name> ──" option opens a new category, every real option inherits it.
  ;function groups() {
    var sel = artSelect();
    if (!sel) return [];
    var out = [], cur = null, curSym = "";
    for (var i = 0; i < sel.options.length; i++) {
      var o = sel.options[i];
      var raw = o.dataset.dragonOrig || o.text;
      if (o.disabled) {
        if (String(raw).indexOf("\u2500\u2500") !== -1) {
          var clean = String(raw).replace(/\u2500+/g, "").trim();
          var sp = clean.indexOf(" ");
          curSym = o.dataset.dragonCatSym || (sp > 0 ? clean.slice(0, sp) : "");
          cur = { sym: curSym, name: (sp > 0 ? clean.slice(sp + 1).trim() : clean), items: [] };
          out.push(cur);
        }
        continue;
      }
      if (!cur) { cur = { sym: "", name: "", items: [] }; out.push(cur); }
      var val = o.value;
      var nm = val.indexOf("ref:optionKeyName:") === 0 ? val.slice("ref:optionKeyName:".length) : val;
      cur.items.push({ value: val, name: nm, label: String(raw).replace(/\s+/g, " ").trim(), sym: cur.sym });
    }
    return out.filter(function (g) { return g.items.length; });
  }

  // ---------------------------------------------------------------- the panel
  var panel = null, bodyEl = null, headEl = null, arrows = [], gridEl = null, selRowEl = null, selSlotEl = null, mixRowEl = null, histBoxEl = null, docked = null, toolsEl = null;
  var testBtn = null, lockBtn = null, searchEl = null, searchWrap = null, countBtn = null, seedInputEl = null, searchToggleBtn = null, totalBtn = null, catHeads = [];

  // ---------------------------------------------------------------- 🎲 Random Style (item 5, Egon 27.09.2026)
  // ONE dice button, two behaviours: while the single-style mode is on a press picks one random style;
  // while Test Multiple Styles is ON every press ADDS one more random style to the comparison instead.
  ;function randomSingleStyle() {
    var s = artSelect();
    if (!s || !s.options || !s.options.length) { toast("no styles available"); return; }
    var picks = [];
    for (var i = 0; i < s.options.length; i++) if (!s.options[i].disabled) picks.push(i);
    if (!picks.length) return;
    var idx = picks[Math.floor(Math.random() * picks.length)];
    s.selectedIndex = idx;
    try { s.dispatchEvent(new Event("change", { bubbles: true })); } catch (e) {}
    toast("\uD83C\uDFB2 Art Style: " + String(s.options[idx].textContent || "").trim());
    syncPicks();
  }
  ;function addRandomStyle() {
    if (!multiOn) setMulti(true);
    var pool = [];
    for (var i = 0; i < cells.length; i++) if (!selected[cells[i].name]) pool.push(cells[i].name);
    if (!pool.length) { toast("\uD83C\uDFB2 every style is already selected"); return; }
    var pick = pool[Math.floor(Math.random() * pool.length)];
    selected[pick] = true;
    selSave();
    syncPicks();
    toast("\uD83C\uDFB2 added: " + pick + " (" + selList().length + " selected)");
  }
  ;function onArtDice(e) {
    if (e) e.stopPropagation();
    if (multiOn) addRandomStyle(); else randomSingleStyle();
  }

  ;function headCss() {
    return "width:100%; box-sizing:border-box; display:flex; align-items:center; justify-content:center; gap:.45rem; padding:.35rem .4rem; font-size:.85rem; font-weight:bold; line-height:1; border-radius:8px; cursor:pointer; flex-wrap:wrap; color:#ffd4d4; " +
      "border:1px solid #c2333f; background:linear-gradient(180deg,#2a0c10,#7d1620);";
  }
  ;function bodyCss() {
    return "display:none; flex-direction:column; gap:.4rem; width:100%; box-sizing:border-box; margin-top:0; padding:.45rem; border-radius:14px; " +
      "border:1px solid rgba(155,107,255,.3); background:linear-gradient(180deg,#15151d,#0e0e13);";
  }
  ;function btnCss() {
    return "font-size:.76rem; font-weight:bold; padding:.32rem .6rem; border-radius:9px; cursor:pointer; white-space:nowrap; " +
      "border:1px solid #6a6a86; background:linear-gradient(180deg,#2a2a35,#16161d); color:#dcd8ee;";
  }
  ;function symSpan(txt, mirror) {
    var s = document.createElement("span");
    s.textContent = txt;
    s.setAttribute("aria-hidden", "true");
    s.style.cssText = "display:inline-block; flex:0 0 auto; font-size:1rem; line-height:1;" + (mirror ? " transform:scaleX(-1);" : "");
    return s;
  }

  ;function ensure() {
    if (panel && panel.isConnected) return panel;
    var ctn = artCtn();
    var host = descCtn();
    if (!ctn || !host) return null;

    panel = document.createElement("div");
    panel.id = "dragonArtPanel";
    panel.style.cssText = "width:100%;";

    headEl = document.createElement("button");
    headEl.type = "button";
    headEl.id = "dragonArtPanelHead";
    headEl.style.cssText = headCss();
    var lbl = document.createElement("span");
    lbl.textContent = "Art Style";
    var a1 = document.createElement("span"), a2 = document.createElement("span");
    a1.textContent = a2.textContent = "\u25BE";
    a1.style.cssText = a2.style.cssText = "font-size:1.1rem; line-height:1;";
    arrows = [a1, a2];
    headEl.append(symSpan("\uD83C\uDFA8", false), a1, lbl, a2, symSpan("\uD83C\uDFA8", true));

    bodyEl = document.createElement("div");
    bodyEl.className = "dragon-art-body";
    bodyEl.style.cssText = bodyCss();

    // ---- row 1: the search bar (moved in, with the red ✖ inside it) + 🎲 Randomize Style where it ends
    var tools = document.createElement("div");
    tools.className = "dragon-art-tools";
    toolsEl = tools;
    tools.style.cssText = "display:flex; align-items:stretch; justify-content:center; gap:.4rem; flex-wrap:wrap; width:100%; position:relative;";

    searchWrap = document.createElement("span");
    searchWrap.className = "dragon-art-searchwrap";
    searchWrap.style.cssText = "display:none; position:absolute; top:34px; left:0; width:min(340px,100%); box-sizing:border-box; flex-direction:column; gap:.3rem; padding:.35rem; border-radius:10px; border:1px solid rgba(155,107,255,.45); background:linear-gradient(180deg,#1b1526,#121016); box-shadow:0 10px 28px rgba(0,0,0,.6); z-index:60;";
    var oldSearch = ctn.querySelector(".dragon-style-search");
    if (oldSearch) {
      searchEl = oldSearch;                       // MOVED, not rebuilt: its filter handler comes along
      searchEl.style.cssText += ";width:100%; box-sizing:border-box; margin:0; font-size:.76rem; font-weight:bold; padding:.32rem .6rem; padding-right:2rem; border-radius:9px; border:1px solid #6a6a86; background:#0f0f15; color:#e8e6f2;";
    } else {
      searchEl = document.createElement("input");
      searchEl.type = "text";
      searchEl.className = "dragon-style-search";
      searchEl.placeholder = "\uD83D\uDD0E filter styles...";
      searchEl.style.cssText = "width:100%; box-sizing:border-box; margin:0; font-size:.76rem; font-weight:bold; padding:.32rem .6rem; padding-right:2rem; border-radius:9px; border:1px solid #6a6a86; background:#0f0f15; color:#e8e6f2;";
      // ⚠️ MANDATORY: the t2i framework walks EVERY input/select/textarea inside the input container and
      // binds it by data-name (plugin line ~1457/1495). An element with NO data-name makes it look up
      // `userInputs[undefined]` and throw "Cannot set properties of undefined (setting '_element')" — so
      // every control we add here must carry data-name="" (the placeholder spec the framework tolerates).
      try {
        searchEl.dataset.name = "";
        var _uis = window.___userSettings746291937 && window.___userSettings746291937.userInputs;
        if (_uis && !_uis[""]) _uis[""] = { excludeFromShareLink: true };
      } catch (e) {}
    }
    var clearB = document.createElement("button");
    clearB.type = "button";
    clearB.id = "dragonArtSearchClear";
    clearB.textContent = "\u2716";
    clearB.title = "Clear the filter text (press again to clear recent searches)";
    clearB.setAttribute("aria-label", "clear the style filter");
    clearB.style.cssText = "position:absolute; right:5px; top:50%; margin:-11px 0 0; width:22px; height:22px; padding:0; display:inline-flex; align-items:center; justify-content:center; border-radius:50%; cursor:pointer; font-size:.72rem; font-weight:800; line-height:1; border:1px solid #c81e2e; background:linear-gradient(145deg,#3a1418,#170708); color:#ff9aa3;";
    clearB.onmousedown = function (e) { try { e.preventDefault(); } catch (eP) {} };
    clearB.onclick = function (e) {
      e.stopPropagation();
      try {
        if (searchEl.value) {
          searchEl.value = "";
          searchEl.dispatchEvent(new Event("input", { bubbles: true }));
          searchEl.focus({ preventScroll: true });
        } else {
          try { if (window.dragonUIEnsureCss) window.dragonUIEnsureCss(); } catch (eC) {}
          var ov = document.createElement("div");
          ov.className = "dg-ov";
          var card = document.createElement("div");
          card.className = "dg-card dg-danger";
          card.style.width = "min(15rem, calc(100vw - 32px))";
          var ttl = document.createElement("div");
          ttl.className = "dg-title";
          ttl.textContent = "Clear recent searches?";
          var tx = document.createElement("div");
          tx.className = "dg-text";
          tx.textContent = "Your recent search shortcuts will be removed from this device.";
          var acts = document.createElement("div");
          acts.className = "dg-actions";
          acts.style.justifyContent = "center";
          var okB = document.createElement("button");
          okB.type = "button";
          okB.className = "dg-btn is-danger";
          okB.textContent = "Clear";
          var noB = document.createElement("button");
          noB.type = "button";
          noB.className = "dg-btn";
          noB.textContent = "Cancel";
          var closed = false;
          var close = function () {
            if (closed) return;
            closed = true;
            try { document.removeEventListener("keydown", esc); } catch (eK) {}
            try { ov.remove(); } catch (eR) {}
          };
          var esc = function (e) { if (e && e.key === "Escape") close(); };
          okB.onclick = function () {
            close();
            try { lsSet(LS_HIST, JSON.stringify([])); } catch (eH) {}
            try { paintHist(); } catch (eP) {}
          };
          noB.onclick = close;
          acts.append(okB, noB);
          card.append(ttl, tx, acts);
          ov.appendChild(card);
          document.body.appendChild(ov);
          try {
            if (window.dragonPopover) window.dragonPopover(ov, close, { modal: true });
            else ov.onclick = function (e) { if (e.target === ov) close(); };
          } catch (eP2) { ov.onclick = function (e) { if (e.target === ov) close(); }; }
          try { document.addEventListener("keydown", esc); } catch (eK2) {}
          try { okB.focus(); } catch (eF) {}
        }
      } catch (er) {}
    };
    var fieldWrap = document.createElement("span");
    fieldWrap.className = "dragon-art-searchfield";
    fieldWrap.style.cssText = "position:relative; display:flex; align-items:center; width:100%;";
    fieldWrap.append(searchEl, clearB);
    histBoxEl = document.createElement("div");
    histBoxEl.className = "dragon-art-searchhist";
    histBoxEl.style.cssText = "display:flex; flex-wrap:wrap; gap:.25rem; width:100%; max-height:4.2rem; overflow-y:auto;";
    searchWrap.append(fieldWrap, histBoxEl);

    var dice = ctn.querySelector('.input-label button') || ctn.querySelector(".input-label + * button");
    if (dice && dice.tagName === "BUTTON") {
      dice.textContent = "\uD83C\uDFB2 Random Style";
      dice.title = "Random Style \u2014 one random style (single mode) / one MORE random style added to the comparison (test mode)";
      dice.style.cssText = btnCss() + "flex:0 0 auto;";
      dice.onclick = onArtDice;
      dice.id = "dragonArtDiceBtn";
    } else {
      dice = document.createElement("button");
      dice.type = "button";
      dice.id = "dragonArtDiceBtn";
      dice.textContent = "\uD83C\uDFB2 Random Style";
      dice.title = "Random Style \u2014 one random style (single mode) / one MORE random style added to the comparison (test mode)";
      dice.style.cssText = btnCss() + "flex:0 0 auto;";
      dice.onclick = onArtDice;
    }
    searchWrap.style.display = "none";
    searchToggleBtn = document.createElement("button");
    searchToggleBtn.type = "button";
    searchToggleBtn.id = "dragonArtSearchToggle";
    searchToggleBtn.textContent = "\uD83D\uDD0D Search";
    searchToggleBtn.title = "Search styles \u2014 show the filter bar";
    searchToggleBtn.setAttribute("aria-label", "search styles");
    searchToggleBtn.style.cssText = btnCss() + "flex:0 0 auto;";
    searchToggleBtn.onclick = function (e) {
      e.stopPropagation();
      var show = searchWrap.style.display === "none";
      searchWrap.style.display = show ? "flex" : "none";
      if (show) { try { paintHist(); } catch (eH) {} try { var _sw = searchToggleBtn.offsetWidth; if (_sw > 40) searchWrap.style.width = _sw + "px"; } catch (eW) {} try { searchWrap.style.top = (searchToggleBtn.offsetTop + searchToggleBtn.offsetHeight + 6) + "px"; } catch (eT) {} try { var _hh = searchToggleBtn.offsetHeight; if (_hh > 0) searchEl.style.height = _hh + "px"; } catch (eH2) {} }
      if (!show) { try { histPush(searchEl.value); } catch (eH3) {} }
      searchToggleBtn.title = show ? "Search styles \u2014 hide the filter bar" : "Search styles \u2014 show the filter bar";
      if (show) { try { searchEl.focus({ preventScroll: true }); } catch (er) {} }
    };
    totalBtn = document.createElement("button");
    totalBtn.type = "button";
    totalBtn.id = "dragonArtTotalBtn";
    totalBtn.style.cssText = btnCss() + "flex:0 0 auto;cursor:default;";
    totalBtn.title = "Total art styles in this panel";
    totalBtn.setAttribute("aria-label", "total art styles");
    totalBtn.onclick = function (e) { e.stopPropagation(); };
    tools.append(searchToggleBtn, searchWrap, totalBtn, dice);

    // ---- row 2: ⚗️ Test Multiple Styles + 🎨 Mixed Art Style
    var modes = null;
    testBtn = document.createElement("button");
    testBtn.type = "button";
    testBtn.id = "dragonArtTestBtn";
    testBtn.style.cssText = btnCss();
    testBtn.onclick = function (e) { e.stopPropagation(); setMulti(!multiOn); };
    var mixedBtn = document.createElement("button");
    mixedBtn.type = "button";
    mixedBtn.id = "dragonArtMixedBtn";
    mixedBtn.textContent = "\uD83C\uDFA8 Mixed Art Style";
    mixedBtn.title = "Mixed Art Style \u2014 blend two art styles";
    mixedBtn.style.cssText = btnCss();
    mixedBtn.onclick = function (e) { e.stopPropagation(); setMix(!mixOn); };
    tools.append(testBtn, mixedBtn);

    // ---- row 3: shown only while Test Multiple Styles is ON
    selRowEl = document.createElement("div");
    selRowEl.className = "dragon-art-selrow";
    selRowEl.style.cssText = "display:none; align-items:stretch; justify-content:center; gap:.4rem; width:100%; box-sizing:border-box;";
    selSlotEl = document.createElement("div");
    selSlotEl.className = "dragon-art-selslot";
    selSlotEl.style.cssText = "flex:1 1 auto; min-width:0; display:flex; align-items:stretch; justify-content:center;";
    selRowEl.append(selSlotEl);
    // ---- mix row: the 🎨 Mixed Art Style builder (own module, lazy-built on first open)
    mixRowEl = document.createElement("div");
    mixRowEl.id = "dragonArtMixBody";
    mixRowEl.className = "dragon-art-mixrow";
    mixRowEl.style.cssText = "display:none; width:100%; box-sizing:border-box;";
    lockBtn = document.createElement("button");
    lockBtn.type = "button";
    lockBtn.id = "dragonArtLockSeedBtn";
    lockBtn.style.cssText = btnCss();
    var lockLbl = document.createElement("span");
    lockLbl.id = "dragonArtLockSeedLbl";
    lockBtn.appendChild(lockLbl);
    seedInputEl = document.createElement("input");
    seedInputEl.type = "number";
    seedInputEl.min = "0";
    seedInputEl.max = "2147483647";
    seedInputEl.id = "dragonArtLockSeedNum";
    seedInputEl.placeholder = "seed";
    seedInputEl.setAttribute("data-dragon-tip", "Seed for the comparison \u2014 every style renders with this seed");
    seedInputEl.setAttribute("aria-label", "comparison seed");
    seedInputEl.style.cssText = "display:none; width:6.5rem; margin-left:.4rem; padding:.15rem .35rem; border-radius:7px; border:1px solid #ffd76a; background:#0f0f15; color:#ffe9a8; font-size:.76rem; font-weight:bold; box-sizing:border-box;";
    seedInputEl.onclick = function (e) { e.stopPropagation(); };
    seedInputEl.onmousedown = function (e) { e.stopPropagation(); };
    seedInputEl.onfocus = function (e) { e.stopPropagation(); };
    seedInputEl.onkeydown = function (e) { e.stopPropagation(); };
    seedInputEl.onchange = function () { try { lsSet(LS_SEED, seedInputEl.value); } catch (e) {} try { syncLock(); } catch (e2) {} };
    try {
      seedInputEl.dataset.name = "";
      var _uis2 = window.___userSettings746291937 && window.___userSettings746291937.userInputs;
      if (_uis2 && !_uis2[""]) _uis2[""] = { excludeFromShareLink: true };
    } catch (e) {}
    lockBtn.appendChild(seedInputEl);
    lockBtn.onclick = function (e) { e.stopPropagation(); setLock(!lockSeed); };
    // Item 8 (Egon 27.09.2026): the live selected-style counter is a button of its own in this row now,
    // sitting immediately LEFT of ✅ Select All (it used to be a " (3)" suffix on the Test button).
    countBtn = document.createElement("button");
    countBtn.type = "button";
    countBtn.id = "dragonArtCountBtn";
    countBtn.style.cssText = btnCss() + "cursor:default;";
    countBtn.onclick = function (e) {
      e.stopPropagation();
      var names = selList();
      toast(names.length ? ("\uD83C\uDFA8 selected: " + names.join(", ")) : "\uD83C\uDFA8 no styles selected yet");
    };
    var allBtn = document.createElement("button");
    allBtn.type = "button";
    allBtn.textContent = "\u2705 Select All";
    allBtn.title = "Select every style currently listed";
    allBtn.style.cssText = btnCss();
    allBtn.onclick = function (e) { e.stopPropagation(); selectAllVisible(true); };
    var noneBtn = document.createElement("button");
    noneBtn.type = "button";
    noneBtn.textContent = "\u2716 Clear All";
    noneBtn.title = "Clear the style selection";
    noneBtn.style.cssText = btnCss();
    noneBtn.onclick = function (e) { e.stopPropagation(); selectAllVisible(false); };
    lockBtn.setAttribute("data-dragon-multi", "1");
    countBtn.setAttribute("data-dragon-multi", "1");
    allBtn.setAttribute("data-dragon-multi", "1");
    noneBtn.setAttribute("data-dragon-multi", "1");
    lockBtn.style.display = "none";
    countBtn.style.display = "none";
    allBtn.style.display = "none";
    noneBtn.style.display = "none";
    var rowBr1 = document.createElement("div");
    rowBr1.style.cssText = "flex:1 1 100%; height:0; padding:0; margin:0; border:0;";
    rowBr1.setAttribute("data-dragon-multi", "1");
    var rowBr2 = document.createElement("div");
    rowBr2.style.cssText = "flex:1 1 100%; height:0; padding:0; margin:0; border:0;";
    rowBr2.setAttribute("data-dragon-multi", "1");
    tools.append(lockBtn, countBtn, allBtn, noneBtn, rowBr1, rowBr2);
    [searchToggleBtn, searchWrap, totalBtn, dice, testBtn, mixedBtn, rowBr1, countBtn, allBtn, lockBtn, noneBtn, rowBr2].forEach(function (n) { tools.appendChild(n); });
    [searchToggleBtn, totalBtn, dice, testBtn, mixedBtn].forEach(function (n) { try { n.style.flex = "1 1 0"; n.style.textAlign = "center"; } catch (eF) {} });

    // ---- the style grid (3 per row on desktop), each cell = the style + a "Preview Soon" tile
    gridEl = document.createElement("div");
    gridEl.className = "dragon-art-grid";
    gridEl.style.cssText = "display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:.4rem; width:100%; max-height:58vh; overflow-y:auto; overflow-x:hidden; padding-right:.2rem; box-sizing:border-box;";

bodyEl.append(tools, selRowEl, mixRowEl, gridEl);
    panel.append(headEl, bodyEl);

    headEl.onclick = function () { setOpen(!open); };

    // the panel stands DIRECTLY above the Control Panel, so the order is Art Style → Control Panel →
    // Prompt Panel → ✨ Generate (Egon 27.09.2026, W-LOC304).
    var cp = host.querySelector(".dragon-control-panel");
    if (cp) host.insertBefore(panel, cp); else host.appendChild(panel);

    // the real <select> is still the value holder: any change made elsewhere (🎲 Randomize Style, the
    // mobile picker, a share link) repaints the grid's highlight too.
    try {
      var selEl = artSelect();
      if (selEl && !selEl.__dragonArtPanelHook) { selEl.__dragonArtPanelHook = true; selEl.addEventListener("change", function () { try { syncPicks(); } catch (e) {} }); }
    } catch (e) {}
    // hide the OLD art style row (its <select> stays in the DOM: the framework keeps reading it)
    try {
      var oldRow = ctn.parentElement;
      if (oldRow && oldRow !== host && oldRow.parentElement === host) oldRow.style.display = "none";
    } catch (e) {}
    try { buildGrid(); } catch (e) {}
    try { applyDefaultStyle(); } catch (eDef2) {}
    syncAll();
    return panel;
  }

  // ---------------------------------------------------------------- grid + filtering
  var cells = [];   // { el, btn, prev, value, name, cat, hay }
  ;function buildGrid() {
    if (!gridEl) return;
    gridEl.innerHTML = "";
    cells = [];
    catHeads = [];
    try { if (docked && docked.cell && docked.cell.el && docked.cell.el.parentNode) docked.cell.el.parentNode.removeChild(docked.cell.el); } catch (eD) {}
    docked = null;
    var gs = groups();
    (function () {
      var byName = {}, _bk, _bj;
      for (_bk = 0; _bk < gs.length; _bk++) for (_bj = 0; _bj < gs[_bk].items.length; _bj++) byName[gs[_bk].items[_bj].name] = gs[_bk].items[_bj];
      var _pruned = false, _fk;
      for (_fk in favs) if (Object.prototype.hasOwnProperty.call(favs, _fk) && favs[_fk] && !byName[_fk]) { delete favs[_fk]; _pruned = true; }
      if (_pruned) favSave();
      var h = document.createElement("div");
      h.className = "dragon-art-cat";
      h.dataset.cat = "__fav";
      h.style.cssText = "grid-column:1/-1; display:flex; align-items:center; gap:.4rem; margin:.35rem 0 0; padding-bottom:.15rem; font-size:.72rem; font-weight:800; letter-spacing:.06em; text-transform:uppercase; color:#ffb3cd; border-bottom:1px solid rgba(255,122,168,.35); text-align:left; cursor:pointer;";
      h.title = "Collapse / expand favorites (the tick selects every favorite)";
      var hTick = document.createElement("span");
      hTick.className = "dragon-art-cattick";
      hTick.textContent = "\u2714";
      hTick.setAttribute("data-dragon-tip", "Select every favorite style (press again to clear them)");
      hTick.style.cssText = "flex:0 0 auto; display:inline-flex; align-items:center; justify-content:center; min-width:28px; height:28px; padding:0 5px; box-sizing:border-box; border-radius:8px; cursor:pointer; font-size:.95rem; font-weight:900; line-height:1; border:2px solid #6a6a86; background:linear-gradient(180deg,#2a2a35,#16161d); color:#7d7d90;";
      hTick.onclick = function (e) { e.stopPropagation(); toggleCategory(this.parentNode.dataset.cat); };
      var hChev = document.createElement("span");
      hChev.className = "dragon-art-chev";
      hChev.textContent = "\u25BE";
      hChev.style.cssText = "flex:0 0 auto;font-size:.8rem;color:#8f86b8;";
      var hName = document.createElement("span");
      hName.textContent = "\u2764\uFE0F Favorite Art Styles";
      hName.style.cssText = "flex:1 1 auto;";
      h.append(hTick, hChev, hName);
      h.onclick = function () { toggleCatOpen(this.dataset.cat); };
      catHeads.push(h);
      gridEl.appendChild(h);
      var favList = favNames().filter(function (nm) { return !!byName[nm]; });
      if (!favList.length) {
        var fhn = document.createElement("div");
        fhn.className = "dragon-art-favhint";
        fhn.style.cssText = "grid-column:1/-1; font-size:.7rem; color:#7d7d90; padding:.1rem .2rem;";
        fhn.textContent = "Hover a style and tap its \u2661 to pin it here.";
        gridEl.appendChild(fhn);
      } else {
        for (var _fi = 0; _fi < favList.length; _fi++) {
          var _fit = byName[favList[_fi]];
          makeCell(_fit, "__fav", "Favorite Art Styles favorite favorites", _fit.sym);
        }
      }
    })();
    for (var gi = 0; gi < gs.length; gi++) {
      var g = gs[gi];
      var _headIdx = catHeads.length;
      var h = document.createElement("div");
      h.className = "dragon-art-cat";
      h.dataset.cat = g.name || "";
      h.style.cssText = "grid-column:1/-1; display:flex; align-items:center; gap:.4rem; margin:.35rem 0 0; padding-bottom:.15rem; font-size:.72rem; font-weight:800; letter-spacing:.06em; text-transform:uppercase; color:#c3b2ff; border-bottom:1px solid rgba(155,107,255,.25); text-align:left;";
      // Item 7 (Egon 27.09.2026): a category behaves like a single style — it carries its own green tick
      // button on the LEFT of the name, and pressing it selects EVERY style of that category (pressing it
      // again clears them). The tick lights up while the whole category is selected.
      var hTick = document.createElement("span");
      hTick.className = "dragon-art-cattick";
      hTick.textContent = "\u2714";
      hTick.setAttribute("data-dragon-tip", "Select every style of this category (press again to clear them)");
      hTick.style.cssText = "flex:0 0 auto; display:inline-flex; align-items:center; justify-content:center; min-width:28px; height:28px; padding:0 5px; box-sizing:border-box; border-radius:8px; cursor:pointer; font-size:.95rem; font-weight:900; line-height:1; border:2px solid #6a6a86; background:linear-gradient(180deg,#2a2a35,#16161d); color:#7d7d90;";
      hTick.onclick = function (e) { e.stopPropagation(); toggleCategory(this.parentNode.dataset.cat); };
      var hName = document.createElement("span");
      hName.textContent = (g.sym ? g.sym + " " : "") + (g.name || "Styles");
      hName.style.cssText = "flex:1 1 auto;";
      var hChev = document.createElement("span");
      hChev.className = "dragon-art-chev";
      hChev.textContent = "\u25BE";
      hChev.style.cssText = "flex:0 0 auto;font-size:.8rem;color:#8f86b8;";
      h.append(hTick, hChev, hName);
      h.style.cursor = "pointer";
      h.title = "Collapse / expand this category (the tick selects every style)";
      h.onclick = function () { toggleCatOpen(this.dataset.cat); };
      catHeads.push(h);
      gridEl.appendChild(h);
      var _added = 0;
      for (var ii = 0; ii < g.items.length; ii++) {
        if (isFav(g.items[ii].name)) continue;
        makeCell(g.items[ii], g.name || "", g.name || "", g.sym || "");
        _added++;
      }
      if (!_added) {
        try {
          var _hh = catHeads[_headIdx];
          if (_hh && _hh.parentNode) _hh.parentNode.removeChild(_hh);
          catHeads.splice(_headIdx, 1);
        } catch (eEH) {}
      }
    }
    function makeCell(it, catKey, catLabel, catSym) {
          var cell = document.createElement("div");
          cell.className = "dragon-art-cell";
          cell.dataset.value = it.value;
          // NOTE: the cell's `display:flex` lives in the injected stylesheet (with !important), so the filter
          // hides a cell through the `.dragon-art-hidden` class (see hideEl) — an inline `display:none` alone
          // cannot win that cascade.
          cell.style.cssText = "position:relative; align-items:center; gap:.35rem; padding:.3rem; box-sizing:border-box; border:1px solid #3a3a48; border-radius:10px; background:rgba(0,0,0,.28); cursor:pointer;";
          var b = document.createElement("button");
          b.type = "button";
          b.className = "dragon-art-pick";
          b.textContent = it.label;
          b.title = it.name;
          b.style.cssText = "flex:1 1 auto; min-width:0; text-align:left; padding:.3rem .4rem; border-radius:8px; cursor:pointer; font-size:.76rem; font-weight:700; line-height:1.2; color:#e8e6f2; border:1px solid transparent; background:transparent; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;";
          var prev = document.createElement("div");
          prev.className = "dragon-art-prev";
          prev.style.cssText = "flex:0 0 " + PREVIEW_SIDE + "; width:" + PREVIEW_SIDE + "; height:" + PREVIEW_SIDE + "; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:.18rem; text-align:center; border-radius:8px; border:1px solid #2e2e3a; background:linear-gradient(145deg,#1c1c24,#0a0a0e); color:#9a9aad; overflow:hidden;";
          var pi = document.createElement("span");
          pi.textContent = "\uD83D\uDDBC\uFE0F";
          pi.style.cssText = "font-size:1.35rem; opacity:.7;";
          var pl = document.createElement("span");
          pl.textContent = "Preview Soon";
          pl.style.cssText = "font-size:.6rem; color:#9a9aad; padding:0 .2rem; line-height:1.15;";
          var pSrc = PREVIEW_IMG[it.name] || "";
          if (it.name.replace(/[^A-Za-z0-9]/g, "") === "" && !pSrc) pSrc = "src/art-previews/no-style.jpg";
          if (pSrc) {
            var pImg = document.createElement("img");
            pImg.src = pSrc; pImg.alt = it.name; pImg.loading = "lazy";
            pImg.style.cssText = "width:100%;height:100%;object-fit:cover;display:block;";
            pImg.onerror = function () { var s = this.src, that = this; setTimeout(function () { try { that.src = s; } catch (eR) {} }, 1500); };
            (function (el) { setTimeout(function () { try { if (!el.complete || !el.naturalWidth) el.src = el.src; } catch (eN) {} }, 4000); })(pImg);
            prev.appendChild(pImg);
            prev.title = it.name + " preview";
          } else {
            prev.append(pi, pl);
            prev.title = "A generated preview will land here later";
          }
          var heart = document.createElement("span");
          heart.className = "dragon-art-fav" + (isFav(it.name) ? " is-fav" : "");
          heart.textContent = isFav(it.name) ? "\u2764\uFE0F" : "\u2661";
          heart.title = isFav(it.name) ? "Remove from favorites" : "Pin to favorites";
          heart.onclick = function (e) { e.stopPropagation(); toggleFav(it.name); };
          cell.append(prev, b, heart);
          cell.onclick = function (e) {
            e.stopPropagation();
            if (multiOn) toggleSel(it.name);
            else choose(it.value, it.label);
          };
          gridEl.appendChild(cell);
          // Item 3 (Egon 27.09.2026): the search box looks at the whole panel — the style's name, its
          // category and its main.pjs `meta:tags` keywords (ART_TAGS), never only the visible label.
          cells.push({ el: cell, btn: b, value: it.value, name: it.name, label: it.label, cat: catKey, hay: String(it.label + " " + it.name + " " + catLabel + " " + catSym + " " + (ART_TAGS[it.name] || "")).toLowerCase() });
    }
    try { applyClosed(); } catch (eAC2) {}
  }
  // the grid's own stylesheet pins `.dragon-art-cell{display:flex !important}`, so an INLINE `display:none`
  // loses the cascade and hides nothing — the filter therefore toggles a CLASS rule that also carries
  // `!important` (the inline toggle stays as a cheap mirror for anything that reads the inline style).
  ;function hideEl(el, hide) {
    if (!el) return;
    if (hide) el.classList.add("dragon-art-hidden"); else el.classList.remove("dragon-art-hidden");
    el.style.display = hide ? "none" : "";
  }
  ;function isHidden(el) { return !!(el && el.classList.contains("dragon-art-hidden")); }
  ;function applyFilter() {
    var q2 = searchEl ? String(searchEl.value || "").trim().toLowerCase() : "";
    for (var i = 0; i < cells.length; i++) {
      if (docked && cells[i] === docked.cell) { hideEl(cells[i].el, false); continue; }
      hideEl(cells[i].el, !!(q2 && cells[i].hay.indexOf(q2) === -1));
    }
    // a category heading whose cells are all filtered out goes away with them
    if (!gridEl) return;
    var kids = gridEl.children;
    for (var k = 0; k < kids.length; k++) {
      var el = kids[k];
      if (el.className !== "dragon-art-cat") continue;
      var any = false;
      var n = el.nextElementSibling;
      while (n && n.className !== "dragon-art-cat") { if (!isHidden(n)) { any = true; break; } n = n.nextElementSibling; }
      hideEl(el, !any);
    }
    try { applyClosed(); } catch (eAC) {}
    window.__dafLast = { q: q2, shown: visibleCells().length, n: cells.length, grid: gridEl.children.length, at: Date.now() };
  }
  ;function visibleCells() {
    var out = [];
    for (var i = 0; i < cells.length; i++) if (!isHidden(cells[i].el)) out.push(cells[i]);
    return out;
  }

  // ---------------------------------------------------------------- selection
  ;function histGet() {
    try {
      var a = JSON.parse(lsGet(LS_HIST, "[]"));
      if (!Array.isArray(a)) return [];
      var out = [];
      for (var i = 0; i < a.length && out.length < 8; i++) {
        var t = String(a[i] || "").trim();
        if (t) out.push(t);
      }
      return out;
    } catch (e) { return []; }
  }
  ;function histPush(term) {
    try {
      term = String(term || "").trim();
      if (!term) return;
      var h = histGet().filter(function (t) { return t.toLowerCase() !== term.toLowerCase(); });
      h.unshift(term);
      lsSet(LS_HIST, JSON.stringify(h.slice(0, 8)));
      paintHist();
    } catch (e) {}
  }
  ;function paintHist() {
    if (!histBoxEl) return;
    histBoxEl.innerHTML = "";
    var h = histGet();
    if (!h.length) {
      var hint = document.createElement("span");
      hint.style.cssText = "font-size:.68rem; color:#7d7d90;";
      hint.textContent = "recent searches appear here";
      histBoxEl.appendChild(hint);
      return;
    }
    for (var i = 0; i < h.length; i++) {
      (function (term) {
        var c = document.createElement("button");
        c.type = "button";
        c.textContent = term;
        c.title = "Search again for " + term;
        c.style.cssText = "font-size:.68rem; font-weight:bold; padding:.18rem .45rem; border-radius:20px; cursor:pointer; border:1px solid #6a6a86; background:linear-gradient(180deg,#2a2a35,#16161d); color:#dcd8ee; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;";
        c.onclick = function (e) {
          e.stopPropagation();
          try { searchEl.value = term; searchEl.dispatchEvent(new Event("input", { bubbles: true })); histPush(term); } catch (er) {}
        };
        histBoxEl.appendChild(c);
      })(h[i]);
    }
  }
  ;function paintSelRow() {
    if (!selRowEl) return;
    selRowEl.style.display = (!multiOn && docked && !mixOn) ? "flex" : "none";
  }
  ;function undockSel() {
    if (!docked) return;
    var d = docked;
    docked = null;
    try { var _sbx = d.cell.el.querySelector(".dragon-art-selbadge"); if (_sbx) _sbx.parentNode.removeChild(_sbx); } catch (eBx) {}
    try {
      if (d.next && d.next.isConnected && gridEl) gridEl.insertBefore(d.cell.el, d.next);
      else if (gridEl) gridEl.appendChild(d.cell.el);
    } catch (e) {}
    try { applyFilter(); } catch (e2) {}
    paintSelRow();
  }
  ;function syncSelRow(curValue) {
    var want = null;
    if (!multiOn && curValue) {
      for (var i = 0; i < cells.length; i++) if (cells[i].value === curValue) { want = cells[i]; break; }
    }
    if (docked && docked.cell === want) { paintSelRow(); return; }
    if (docked) undockSel();
    if (want && gridEl && selSlotEl) {
      docked = { cell: want, next: want.el.nextElementSibling };
      try { hideEl(want.el, false); selSlotEl.appendChild(want.el); } catch (e) {}
      try {
        if (!want.el.querySelector(".dragon-art-selbadge")) {
          var _sb = document.createElement("span");
          _sb.className = "dragon-art-selbadge";
          _sb.textContent = "✓ SELECTED";
          want.el.appendChild(_sb);
        }
      } catch (eB) {}
    }
    paintSelRow();
  }
  ;function choose(value, label, silent) {
    var s = artSelect();
    if (!s) return;
    try { s.value = value; } catch (e) {}
    try { if (window.input) window.input.artStyle = value; } catch (e) {}
    try { s.dispatchEvent(new Event("change", { bubbles: true })); } catch (e) {}
    try { if (window.dragonSyncMirror) window.dragonSyncMirror("artStyle"); } catch (e) {}
    if (label && !silent) toast("\uD83C\uDFA8 Art Style: " + label);
    syncPicks();
  }
;var dragonArtDefDone = false;
  ;var dragonArtDefConfirms = 0;
  ;function artSelName() {
    try {
      var sN = artSelect();
      if (!sN) return null;
      var vN = String(sN.value || "");
      return vN.indexOf("ref:optionKeyName:") === 0 ? vN.slice("ref:optionKeyName:".length) : vN;
    } catch (eN) { return null; }
  }
  ;function artRememberedKey() {
    try {
      for (var k = 0; k < localStorage.length; k++) {
        var key = localStorage.key(k);
        if (key && key.indexOf("rememberedInput_") === 0 && key.slice(-9) === "_artStyle") return key;
      }
    } catch (eR) {}
    return null;
  }
  ;function artRemembered() {
    try { var kk = artRememberedKey(); return kk ? localStorage.getItem(kk) : null; } catch (eR2) { return null; }
  }
  ;var dragonArtDefName = "𝗡𝗼 𝘀𝘁𝘆𝗹𝗲";
  ;function applyDefaultStyle() {
    try {
      if (dragonArtDefDone || lsGet("dragonArtDefaultApplied", "0") === "3") return;
      var want = "ref:optionKeyName:" + dragonArtDefName;
      var curN = artSelName();
      if (curN === null) return;
      var rem = artRemembered();
      var remN = (rem && rem.indexOf("ref:optionKeyName:") === 0) ? rem.slice("ref:optionKeyName:".length) : rem;
      if (curN === dragonArtDefName && rem === want) { dragonArtDefConfirms++; }
      else if (curN !== "" && curN !== dragonArtDefName && remN === curN) { dragonArtDefConfirms++; }
      else {
        dragonArtDefConfirms = 0;
        try { var kk2 = artRememberedKey(); if (kk2) localStorage.setItem(kk2, want); } catch (eW) {}
        if (curN !== dragonArtDefName) {
          var s = artSelect();
          if (s && s.options) {
            var target = "", tLabel = "";
            for (var i = 0; i < s.options.length; i++) {
              if (s.options[i].disabled) continue;
              var nm = String(s.options[i].value || "");
              if (nm.indexOf("ref:optionKeyName:") === 0) nm = nm.slice("ref:optionKeyName:".length);
              if (nm === dragonArtDefName) { target = s.options[i].value; try { tLabel = String(s.options[i].dataset.dragonOrig || s.options[i].text).replace(/\s+/g, " ").trim(); } catch (eL) {} break; }
            }
            if (target) choose(target, tLabel, true);
          }
        }
      }
      if (dragonArtDefConfirms >= 2) { dragonArtDefDone = true; lsSet("dragonArtDefaultApplied", "3"); }
    } catch (eD) {}
  }
  ;function scheduleDefaultStyle() {
    if (window.__dragonArtDefSched) return;
    window.__dragonArtDefSched = true;
    var delays = [3000, 6000, 10000, 16000, 25000, 40000, 60000];
    for (var d = 0; d < delays.length; d++) {
      (function (ms) { setTimeout(function () { try { applyDefaultStyle(); } catch (eS) {} }, ms); })(delays[d]);
    }
  }
  ;function toggleSel(name) {
    selected[name] = selected[name] ? false : true;
    selSave();
    syncPicks();
  }
  ;function selectAllVisible(on) {
    var vs = visibleCells();
    for (var i = 0; i < vs.length; i++) selected[vs[i].name] = !!on;
    selSave();
    syncPicks();
    toast((on ? "\u2705 selected " : "\u2716 cleared ") + vs.length + " style" + (vs.length === 1 ? "" : "s"));
  }
  ;function catCells(cat) {
    var out = [];
    for (var i = 0; i < cells.length; i++) if (cells[i].cat === cat) out.push(cells[i]);
    return out;
  }
  ;function toggleCategory(cat) {
    var list = catCells(cat);
    if (!list.length) return;
    if (!multiOn) setMulti(true);            // a category tick only means something in the comparison mode
    var allOn = true;
    for (var i = 0; i < list.length; i++) if (!selected[list[i].name]) { allOn = false; break; }
    for (var j = 0; j < list.length; j++) selected[list[j].name] = !allOn;
    selSave();
    syncPicks();
    toast((allOn ? "\u2716 cleared " : "\u2705 selected ") + list.length + " styles in \u201C" + (cat === "__fav" ? "favorites" : (cat || "Styles")) + "\u201D");
  }
  ;function syncPicks() {
    var s = artSelect();
    var cur = "";
    try { cur = s ? (s.value.indexOf("ref:optionKeyName:") === 0 ? s.value.slice("ref:optionKeyName:".length) : s.value) : ""; } catch (e) {}
    try { syncSelRow(s ? s.value : ""); } catch (eSR) {}
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i];
      var isSel = multiOn ? !!selected[c.name] : (c.value === (s ? s.value : ""));
      c.el.style.borderColor = isSel ? "#b48dff" : "#3a3a48";
      c.el.style.background = isSel ? "rgba(155,107,255,.18)" : "rgba(0,0,0,.28)";
      c.el.style.boxShadow = isSel ? "0 0 10px rgba(155,107,255,.45)" : "none";
      c.btn.style.color = isSel ? "#ffffff" : "#e8e6f2";
      c.btn.style.borderColor = isSel ? "rgba(180,141,255,.7)" : "transparent";
      var isF = false;
      try { isF = isFav(c.name); } catch (eFv) {}
      try {
        var _ht = c.el.querySelector(".dragon-art-fav");
        if (_ht) {
          _ht.textContent = isF ? "\u2764\uFE0F" : "\u2661";
          _ht.title = isF ? "Remove from favorites" : "Pin to favorites";
          if (isF) _ht.classList.add("is-fav"); else _ht.classList.remove("is-fav");
        }
        if (isF) {
          c.el.classList.add("is-fav");
          c.el.style.borderColor = "#ff7aa8";
          c.el.style.boxShadow = (isSel ? "0 0 10px rgba(155,107,255,.45)," : "") + "0 0 12px rgba(255,90,150,.6)";
        } else c.el.classList.remove("is-fav");
      } catch (eF2) {}
      var mark = "";
      if (multiOn && selected[c.name]) mark = "\u2705 ";
      if (c.btn.dataset.mark !== mark) { c.btn.dataset.mark = mark; c.btn.textContent = mark + c.label; }
    }
    var n = selList().length;
    if (countBtn) {
      countBtn.textContent = "\uD83C\uDFA8 " + n + (n === 1 ? " style selected" : " styles selected");
      countBtn.style.borderColor = n ? "#3ddc84" : "#6a6a86";
      countBtn.style.color = n ? "#b9ffd8" : "#dcd8ee";
      countBtn.style.boxShadow = n ? "0 0 8px rgba(61,220,132,.35)" : "none";
      countBtn.title = n ? ("Selected: " + selList().join(", ")) : "No styles selected yet \u2014 tap styles to add them";
    }
    for (var ch = 0; ch < catHeads.length; ch++) {
      var head = catHeads[ch];
      if (!head.isConnected) continue;
      var list = catCells(head.dataset.cat);
      var tick = head.querySelector(".dragon-art-cattick");
      if (!tick || !list.length) continue;
      var on = 0;
      for (var li = 0; li < list.length; li++) if (selected[list[li].name]) on++;
      var full = on === list.length;
      tick.style.borderColor = full ? "#3ddc84" : (on ? "#b48dff" : "#6a6a86");
      tick.style.background = full ? "linear-gradient(180deg,#1f5c3a,#0f3320)" : "linear-gradient(180deg,#2a2a35,#16161d)";
      tick.style.color = full ? "#8affc0" : (on ? "#d8c9ff" : "#7d7d90");
      tick.style.boxShadow = full ? "0 0 8px rgba(61,220,132,.45)" : "none";
      tick.textContent = full ? "\u2611" : "\u2714";
    }
    if (totalBtn) {
      var _tn = 0;
      try {
        var _so = artSelect() ? artSelect().options : [];
        for (var _ti = 0; _ti < _so.length; _ti++) if (!_so[_ti].disabled) _tn++;
      } catch (eT) {}
      var _tt = "\uD83C\uDFA8 " + _tn + " styles";
      if (totalBtn.textContent !== _tt) totalBtn.textContent = _tt;
    }
    if (testBtn) {
      testBtn.textContent = multiOn ? "Single Art Style" : "\u2697\uFE0F Test Multiple Styles";
      testBtn.style.borderColor = "#6a6a86";
      testBtn.style.boxShadow = "none";
      testBtn.style.color = "#dcd8ee";
      testBtn.title = multiOn
        ? "Back to single art style mode"
        : "Turn on multiple selection to compare several styles at once";
    }
  }
  ;function lockNum() {
    try {
      var v = seedInputEl ? parseInt(seedInputEl.value, 10) : NaN;
      if (v >= 0 && v <= 2147483647) return v;
    } catch (e) {}
    return null;
  }
  ;function promptSeed() {
    try {
      var v = window.input ? parseInt(window.input.seed, 10) : NaN;
      if (v >= 0 && v <= 2147483647) return v;
    } catch (e) {}
    try {
      var el = document.querySelector('[data-name="seed"]');
      var w = el ? parseInt(el.value, 10) : NaN;
      if (w >= 0 && w <= 2147483647) return w;
    } catch (e2) {}
    return null;
  }
  ;function setLock(on) {
    lockSeed = !!on;
    lsSet(LS_LOCK, lockSeed ? "1" : "0");
    if (lockSeed && seedInputEl && !seedInputEl.value) {
      var sv = null;
      try { sv = lsGet(LS_SEED, ""); } catch (e) {}
      if (!sv) { var ps0 = promptSeed(); sv = ps0 !== null ? String(ps0) : ""; }
      seedInputEl.value = sv || "";
      try { lsSet(LS_SEED, seedInputEl.value); } catch (e2) {}
    }
    syncLock();
  }
  ;function testSeed() {
    var n = lockNum();
    if (n !== null) return n;
    var ps = promptSeed();
    if (ps !== null) {
      if (seedInputEl) seedInputEl.value = String(ps);
      try { lsSet(LS_SEED, String(ps)); } catch (e) {}
      return ps;
    }
    var r = Math.floor(Math.random() * 2147483647);
    if (seedInputEl) seedInputEl.value = String(r);
    try { lsSet(LS_SEED, String(r)); } catch (e2) {}
    return r;
  }
  ;function syncLock() {
    if (!lockBtn) return;
    var _lbl = document.getElementById("dragonArtLockSeedLbl");
    if (_lbl) _lbl.textContent = (lockSeed ? "\uD83D\uDD12" : "\uD83D\uDD13") + " Lock Seed";
    if (seedInputEl) seedInputEl.style.display = lockSeed ? "" : "none";
    // Item 9 (Egon 27.09.2026): the padlock shows the STATE — locked while the fair-comparison lock is
    // on (closed padlock), unlocked while it is off (open padlock).
    lockBtn.style.borderColor = lockSeed ? "#ffd76a" : "#6a6a86";
    lockBtn.style.color = lockSeed ? "#ffe9a8" : "#dcd8ee";
    lockBtn.style.boxShadow = lockSeed ? "0 0 8px rgba(255,215,106,.4)" : "none";
    lockBtn.title = lockSeed ? ("Every compared style uses the SAME seed" + (seedInputEl && seedInputEl.value ? " (" + seedInputEl.value + ")" : "") + " (fair comparison)") : "Each compared style gets its own random seed (fair comparison OFF)";
  }
  ;function setMulti(on) {
    multiOn = !!on;
    if (!multiOn && selList().length) { selected = {}; selSave(); }
    lsSet(LS_MULTI, multiOn ? "1" : "0");    try {
      var _mb = toolsEl ? toolsEl.querySelectorAll("[data-dragon-multi]") : [];
      for (var _mi = 0; _mi < _mb.length; _mi++) _mb[_mi].style.display = multiOn ? "" : "none";
    } catch (eM) {}
    syncPicks();
    toast(multiOn ? "\u2697\uFE0F multiple selection ON \u2014 tap styles to add them" : "\u2697\uFE0F multiple selection off");
  }
  ;function syncMixGrid() {
    // Egon 11.10.2026 (gece-15): while Mixed Art Style is ON the single-style grid below it is
    // functionless (the mix has its own A/B style selects), so hide it; restore on close.
    try { if (gridEl) gridEl.style.display = mixOn ? "none" : "grid"; } catch (e) {}
    try { paintSelRow(); } catch (e2) {}
  }
  ;function syncMixBtn() {    var b = null;
    try { b = document.getElementById("dragonArtMixedBtn"); } catch (e) {}
    if (!b) return;
    b.style.borderColor = mixOn ? "#a855f7" : "";
    b.style.boxShadow = mixOn ? "0 0 8px rgba(168,85,247,.45)" : "none";
    b.title = mixOn ? "Mixed Art Style \u2014 ON (tap to close)" : "Mixed Art Style \u2014 blend two art styles";
  }
  ;function setMix(on, silent) {
    mixOn = !!on;
    lsSet(LS_MIX, mixOn ? "1" : "0");
    if (mixOn && mixRowEl && (!mixRowEl.__dragonMixBuilt || !mixRowEl.children.length)) {
      // NOTE: this panel's <script> loads BEFORE dragon-art-mix.js, so on a fresh page load with
      // mixOn persisted, window.dragonArtMixBuild may not exist yet — flag only a real build, and
      // retry while the row is still empty (build() itself is idempotent: refresh-only when built).
      try {
        if (window.dragonArtMixBuild) {
          window.dragonArtMixBuild(mixRowEl);
          mixRowEl.__dragonMixBuilt = true;
        }
      } catch (e) {}
    }
    if (mixRowEl) mixRowEl.style.display = mixOn ? "flex" : "none";
    try { syncMixGrid(); } catch (eG) {}
    try { syncMixBtn(); } catch (e) {}
    if (!silent) toast(mixOn ? "\uD83C\uDFA8 Mixed Art Style on \u2014 pick two styles, set weights, Generate" : "\uD83C\uDFA8 Mixed Art Style off");
  }
  ;function setOpen(v) {
    open = !!v;
    lsSet(LS_OPEN, open ? "1" : "0");
    if (bodyEl) bodyEl.style.display = open ? "flex" : "none";
    for (var i = 0; i < arrows.length; i++) arrows[i].textContent = open ? "\u25B4" : "\u25BE";
    try { headEl.setAttribute("aria-expanded", open ? "true" : "false"); } catch (e) {}
    if (open) { try { applyFilter(); } catch (e) {} }
    try { syncOpenCards(); } catch (eS) {}
  }
  ;function syncAll() { syncLock(); setMulti(multiOn); setMix(mixOn, true); syncMixBtn(); setOpen(open); syncPicks(); applyFilter(); }

  // ---------------------------------------------------------------- the run
  // In multiple-selection mode the main ✨ Generate renders one image per selected style (the same
  // comparison the old tester window produced, reusing window.dragonStyleTestRun).
  ;function runSelected() {
    try { syncStateFromLS(); } catch (eSS) {}
    var names = selList();
    if (!names.length) return false;
    var desc = "";
    try { var ta = q('textarea[data-name="description"]'); desc = ta ? ta.value : ""; } catch (e) {}
    if (!desc) { toast("\u270F\uFE0F type a description first"); return true; }
    var neg = "";
    try { neg = (window.input && window.input.negative) || ""; } catch (e) {}
    if (!window.dragonStyleTestRun) { toast("\u26A0\uFE0F the style tester isn't ready"); return true; }
    var _seedArg = lockSeed ? testSeed() : null;
    try { syncLock(); } catch (eS) {}
    window.dragonStyleTestRun(names, desc, neg, _seedArg === null ? false : _seedArg);
    return true;
  }
  document.addEventListener("click", function (e) {
    // Item 4 (Egon 27.09.2026): while Test Multiple Styles is ON — or while the panel holds a selection —
    // the single 🎨 art style is IGNORED by the generate buttons (the panel's comparison selection wins),
    // and this catches BOTH the big ✨ Generate and the description panel's mini ✨ Generate button.
    try { syncStateFromLS(); } catch (eSS) {}
    if (!multiOn && !open && !selList().length) return;
    var t = e.target;
    if (!t || !t.closest) return;
    if (!t.closest("#generateButtonEl") && !t.closest(".dragon-gen-col")) return;
    if (!selList().length) return;
    e.preventDefault();
    e.stopPropagation();
    runSelected();
  }, true);
  window.dragonArtPanelRunSelected = runSelected;

  // ---------------------------------------------------------------- item 6: the mini ✨ Generate joins the row
  // Egon 27.09.2026: the description panel's right-hand mini ✨ Generate button belongs in the row that
  // appears with ⚗️ Test Multiple Styles. The framework's own button is PARKED in place (hidden, still a
  // child of the mini column, so the framework's own "does it exist yet?" check keeps finding it and never
  // builds a second one) and the row gets its own twin. Both halves are IDEMPOTENT: the tick may only ever
  // touch the DOM once per state, because the project's body observer calls the tick after every mutation —
  // a tick that wrote on every pass would feed itself forever (that is exactly what froze the page once).
  ;function adoptMiniGen() {
    if (!toolsEl) return;
    var col = document.querySelector(".random-input-btn-ctn");
    var src = col ? col.querySelector('[data-d="dragonGenColBtn"]') : null;
    // Egon 29.10.2026 — the description column keeps its own mini ✨ Generate ALWAYS
    // (geri getir: it never leaves the column). The test row keeps its own twin while ON.
    if (src && src.dataset.dragonArtParked === "1") {
      delete src.dataset.dragonArtParked;
      try { src.style.removeProperty("display"); } catch (e) {}
      src.removeAttribute("aria-hidden");
      src.title = "Generate";
    }
    var b = toolsEl.querySelector(".dragon-art-mingen");
    if (!b) {
    b = document.createElement("button");
    b.type = "button";
    b.className = "dragon-gen-col dragon-art-mingen";
    b.title = "Generate \u2014 runs the comparison for the style selection";
    b.setAttribute("aria-label", "generate");
    b.textContent = "\u2728 Generate \u2728";
    // Egon 29.09.2026 — the row's main action: red, in the MIDDLE of the row, auto-sized like its siblings
    // (between the counter and Select All), not a small twin at the end.
    b.style.cssText = btnCss() + "flex:0 0 auto; text-align:center; border:1px solid #c2333f;background:linear-gradient(180deg,#2a0c10,#7d1620);color:#ffd4d4;box-shadow:0 4px 14px rgba(0,0,0,.5);";
    b.onclick = function () { var m = document.getElementById("generateButtonEl"); if (m) m.click(); };
    b.setAttribute("data-dragon-multi", "1");
    if (!multiOn) b.style.display = "none";
    try { toolsEl.appendChild(b); } catch (e) {}
    if (!b.dataset.dragonW2) {
      b.dataset.dragonW2 = "1";
      try {
        requestAnimationFrame(function () {
          try {
            var w0 = b.offsetWidth;
            if (w0 > 40 && !b.style.width) b.style.width = Math.round(w0 * 2) + "px";
          } catch (eW) {}
        });
      } catch (eR) {}
    }
    }
    // Egon 29.10.2026 — the twin is visible only while the test row is ON; keep it
    // in sync on every tick (idempotent: writes only when the state actually flips).
    try {
      if (!multiOn && b.style.display !== "none") b.style.display = "none";
      else if (multiOn && b.style.display === "none") b.style.display = "";
    } catch (eV) {}
    // Egon 29.09.2026 — keep it pinned between the counter and Select All (no-op when already there,
    // so the body-observer tick can call this freely without feeding itself).
    try {
      var _cnt = toolsEl.querySelector("#dragonArtCountBtn");
      if (_cnt && _cnt.parentNode === toolsEl && b.parentNode === toolsEl && b.previousElementSibling !== _cnt)
        toolsEl.insertBefore(b, _cnt.nextSibling);
    } catch (eP) {}
  }
  window.dragonArtAdoptMiniGen = adoptMiniGen;

  // ---------------------------------------------------------------- boot / upkeep
  var _lastTickAt = 0;
  ;function tick() {
    // The project's body observer calls the tick after every DOM mutation, so a tick that wrote to the DOM
    // on every pass could feed itself forever. Every write below is idempotent AND the tick itself is
    // rate-limited: bursts of mutations cost one pass per 40ms at most.
    var _now = Date.now();
    if (_now - _lastTickAt < 40) return;
    _lastTickAt = _now;
    window.__dragonArtTickCount = (window.__dragonArtTickCount | 0) + 1;   // diagnostics: an honest tick rate
    try {
      var s = artSelect();
      var ctn = artCtn();
      if (!s || !ctn) return;
      if (!panel || !panel.isConnected) ensure();
      // the framework can rebuild the description panel; the panel is re-homed above the CP if it moved
      if (panel && panel.isConnected) {
        var host = descCtn();
        var cp = host && host.querySelector(".dragon-control-panel");
        // Egon 11.10.2026 — the Studio panel lives directly below Art (above the CP),
        // so "re-homed above the CP" is satisfied when the next sibling is the CP OR the Studio
        // panel followed by the CP. Without this tolerance the tick and the Studio placer moved
        // the panels on every mutation (~9 moves/sec: hover flicker + swallowed clicks).
        var _nx = panel.nextElementSibling;
        var _studioBetween = _nx && _nx.id === "dragonStudioPanel" && _nx.nextElementSibling === cp;
        if (cp && _nx !== cp && !_studioBetween) host.insertBefore(panel, cp);
        var oldRow = ctn.parentElement;
        if (oldRow && oldRow !== host && oldRow.parentElement === host && oldRow.style.display !== "none") oldRow.style.display = "none";
        adoptMiniGen();
        if (searchEl && !searchEl.isConnected) ensure2Rebuild();
        // Egon 11.10.2026 (gece-15): the panel script loads BEFORE dragon-art-mix.js, so a load
        // with mix persisted ON can leave an empty mix row (build attempted before the builder
        // existed). Retry here — the tick runs constantly, build() is idempotent, and once the
        // row has children this is a no-op. Gate on a populated style select so the A/B slot
        // dropdowns are never built from an empty style list.
        try {
          if (mixOn && mixRowEl && mixRowEl.isConnected && !mixRowEl.children.length && window.dragonArtMixBuild) {
            var _asM = artSelect();
            if (_asM && _asM.options && _asM.options.length > 5) setMix(true, true);
          }
        } catch (eMB) {}
        try { syncOpenCards(); } catch (eS) {}
      }
    } catch (e) {}
  }
  ;function ensure2Rebuild() {
    // the moved search box disappeared (the description panel was rebuilt) → rebuild the panel from scratch
    try { if (panel && panel.parentNode) panel.parentNode.removeChild(panel); } catch (e) {}
    try { panel = null; ensure(); } catch (e) {}
  }
  // the moved search box must drive the grid filter as well as its own (framework) filtering
  ;function hookSearch() {
    if (!searchEl || searchEl.__dragonArtGrid) return;
    searchEl.__dragonArtGrid = true;
    searchEl.addEventListener("input", function () { try { applyFilter(); } catch (e) {} });
    if (!searchEl.__dragonArtHist) { searchEl.__dragonArtHist = true; searchEl.addEventListener("change", function () { try { histPush(searchEl.value); } catch (eH) {} }); }
  }

  // W-LOC304 — the description panel's big controls (Art Style · Control Panel ·
  // Prompt Panel · Process Panel · Production Panel · Image History) kiss ZERO-TO-ZERO:
  // each panel button touches the next (the 4px container gap is pulled back with -4px),
  // while the description block above keeps its own gap and is NOT part of the kiss.
  ;function installStackCss() {
    if (document.getElementById("dragonArtStackCss")) return;
    var st = document.createElement("style");
    st.id = "dragonArtStackCss";
    // the description container spaces its children with `gap:4px`, so the three panels pull the gap back
    // out with a negative bottom margin and every extra `margin-top` is dropped.
    st.textContent =
      "html body #userInputsCtn8462746262{gap:4px !important;margin-bottom:4px !important;}" +
      "html body #dragonArtPanel{margin-top:0 !important;margin-bottom:0 !important;}" +
      "html body .dragon-control-panel{margin-top:0 !important;margin-bottom:0 !important;}" +
      "html body #dragonHistoryPanel{margin-top:0 !important;margin-bottom:0 !important;}" +
      "html body #shareLinkOuterCtn2893827{margin-bottom:0 !important;}" +
      "html body .dragon-gen-row{display:flex !important;flex-direction:column !important;gap:4px !important;margin:0 4px !important;padding:0 !important;box-sizing:border-box !important;}" +
      "html body .dragon-gen-row > div{margin-top:0 !important;margin-bottom:0 !important;}" +
      "html body #mainColumnEl85394739 #dragonArtPanel{margin-bottom:-4px !important;}" +
      "html body #mainColumnEl85394739 .dragon-control-panel{margin-bottom:-4px !important;}" +
      "html body #mainColumnEl85394739 #dragonProcessPanel{margin-bottom:-4px !important;}" +
      "html body #mainColumnEl85394739 #dragonProductionPanel{margin-bottom:-4px !important;}" +
      "html body #mainColumnEl85394739 #dragonImageHistInline{margin-top:-4px !important;}" +
      "html body #dragonProdRow{margin-top:0 !important;margin-bottom:0 !important;background:transparent !important;border:none !important;padding:0 !important;}" +
      "#generateButtonEl{width:100% !important; max-width:992px !important; box-sizing:border-box !important;}" +
      // a cell = the style button + its own preview tile, side by side; both the flex display and the
      // hidden state MUST come from here — the grid's own rules are `!important`, so the filter hides a
      // cell through this class instead of an inline `display` (see hideEl/buildGrid)
      ".dragon-art-cell{display:flex !important; align-items:center; gap:.35rem; padding:.3rem; box-sizing:border-box; border:1px solid #3a3a48; border-radius:10px; background:rgba(0,0,0,.28); cursor:pointer;}" +
      ".dragon-art-cell.dragon-art-hidden,.dragon-art-cat.dragon-art-hidden{display:none !important;}" +
      ".dragon-art-cell .dragon-art-pick{flex:1 1 auto !important; min-width:0 !important; text-align:left !important; padding:.3rem .4rem !important; border-radius:8px !important; cursor:pointer !important; font-size:.76rem !important; font-weight:700 !important; line-height:1.2 !important; color:#e8e6f2; border:1px solid transparent; background:transparent !important; overflow:hidden !important; text-overflow:ellipsis !important; white-space:nowrap !important;}" +
      // 3 art styles per row on desktop, 2 on a tablet, 1 on a phone
      ".dragon-art-grid{grid-template-columns:repeat(3, minmax(0,1fr)) !important;}" +
      "@media (max-width:900px){ .dragon-art-grid{grid-template-columns:repeat(2, minmax(0,1fr)) !important;} }" +
      "@media (max-width:520px){ .dragon-art-grid{grid-template-columns:1fr !important;} }" +
      // phone: the Lock Seed label is too long to sit beside the other two, so it takes a full row of its
      // own and Select All / Clear All share the row below it (no orphan button, no clipped label)
      ".dragon-art-selrow .dragon-art-cell{position:relative !important; flex:0 1 340px !important; max-width:100% !important; margin:0 !important;}" +
      ".dragon-art-selbadge{position:absolute !important; top:.32rem !important; left:calc(108px + .65rem) !important; right:.3rem !important; font-size:.62rem !important; font-weight:800 !important; letter-spacing:.08em !important; color:#3ddc84 !important; white-space:nowrap !important; overflow:hidden !important; text-overflow:ellipsis !important; pointer-events:none !important;}" +
      ".dragon-art-selrow .dragon-art-pick{padding-top:1.1rem !important;}" +
      ".dragon-art-searchhist button:hover{border-color:#b48dff !important; color:#fff !important;}" +
      ".dragon-art-cell{position:relative !important;}" +
      ".dragon-art-cell .dragon-art-fav{position:absolute !important;top:.2rem !important;right:.3rem !important;z-index:3 !important;font-size:1.05rem !important;line-height:1 !important;cursor:pointer !important;opacity:0 !important;transition:opacity .15s !important;text-shadow:0 1px 4px rgba(0,0,0,.85) !important;}" +
      ".dragon-art-cell:hover .dragon-art-fav,.dragon-art-cell .dragon-art-fav.is-fav{opacity:1 !important;}" +
      "@media (hover:none){.dragon-art-cell .dragon-art-fav{opacity:1 !important;}}" +
      ".dragon-art-cell.is-fav{border-color:#ff7aa8 !important;}" +
      ".dragon-art-cell.dragon-art-collapsed{display:none !important;}" +
      ".dragon-art-cat{cursor:pointer !important;}" +
      "@media (max-width:520px){ .dragon-art-tools>button{flex:1 1 auto !important;} }";
    document.head.appendChild(st);
  }

  ;function installOpenCardCss() {
    if (document.getElementById("dragonOpenCardCss")) return;
    var st = document.createElement("style");
    st.id = "dragonOpenCardCss";
    st.textContent =
      "html body #dragonArtPanel.dragon-open{background:linear-gradient(180deg,#1b1526,#121016) !important;border:1px solid rgba(166,137,255,.45) !important;border-radius:14px !important;padding:.45rem !important;box-sizing:border-box !important;}" +
      "html body .dragon-control-panel.dragon-open{background:linear-gradient(180deg,#0f1a26,#0b0e13) !important;border:1px solid rgba(63,143,214,.5) !important;border-radius:14px !important;padding:.45rem !important;box-sizing:border-box !important;}" +
      "html body #dragonHistoryPanel.dragon-open{background:linear-gradient(180deg,#1a1a20,#111114) !important;border:1px solid rgba(140,140,152,.5) !important;border-radius:14px !important;padding:.45rem !important;box-sizing:border-box !important;}" +
      "html body #dragonProcessPanel.dragon-open{background:linear-gradient(180deg,#15151d,#0e0e13) !important;border:1px solid rgba(155,107,255,.4) !important;border-radius:14px !important;padding:.45rem !important;box-sizing:border-box !important;}" +
      "html body #dragonProductionPanel.dragon-open{background:linear-gradient(180deg,#121a15,#0c100d) !important;border:1px solid rgba(61,220,132,.4) !important;border-radius:14px !important;padding:.45rem !important;box-sizing:border-box !important;}" +
      "html body #dragonArtPanel.dragon-open > #dragonArtPanelHead,html body .dragon-control-panel.dragon-open > button,html body #dragonHistoryPanel.dragon-open > button,html body #dragonProcessPanel.dragon-open > #dragonProcessHead,html body #dragonProductionPanel.dragon-open > #dragonProductionHead{margin:calc(-.45rem - 1px) calc(-.45rem - 1px) 0 !important;width:calc(100% + .9rem + 2px) !important;}" +
      "html body #dragonArtPanel.dragon-open .dragon-art-body,html body .dragon-control-panel.dragon-open .dragon-control-body,html body #dragonHistoryPanel.dragon-open .dragon-history-body,html body #dragonProcessPanel.dragon-open #dragonProcessBody,html body #dragonProductionPanel.dragon-open #dragonProductionBody{background:transparent !important;background-image:none !important;border:none !important;box-shadow:none !important;margin:.45rem 0 0 !important;padding:0 !important;}" +
      "html body #dragonImageHistHead.dragon-open{margin-top:0 !important;margin-bottom:0 !important;background:linear-gradient(180deg,#221014,#0f0b0d) !important;border:1px solid rgba(200,80,100,.45) !important;border-bottom:none !important;border-radius:14px 14px 0 0 !important;padding:.45rem .45rem 0 !important;box-sizing:border-box !important;}" +
      "html body #dragonImageHistHead.dragon-open #dragonImageHistBtn{margin:calc(-.45rem - 1px) calc(-.45rem - 1px) 0 !important;width:calc(100% + .9rem + 2px) !important;}" +
      "html body #dragonImageHistInline.dragon-open{margin-top:0 !important;margin-bottom:0 !important;background:linear-gradient(180deg,#1a1114,#0e0b0d) !important;border-color:rgba(200,80,100,.45) !important;border-top:none !important;border-radius:0 0 14px 14px !important;}" +
      "html body #dragonArtPanel .dragon-art-body,html body .dragon-control-panel .dragon-control-body,html body #dragonHistoryPanel .dragon-history-body,html body #dragonProcessPanel #dragonProcessBody,html body #dragonProductionPanel #dragonProductionBody,html body #dragonImageHistInline{scrollbar-width:thin !important;}" +
      "html body #dragonArtPanel .dragon-art-body{scrollbar-color:#7a5fd0 transparent !important;}" +
      "html body .dragon-control-panel .dragon-control-body{scrollbar-color:#3f8fd6 transparent !important;}" +
      "html body #dragonHistoryPanel .dragon-history-body{scrollbar-color:#8a8a98 transparent !important;}" +
      "html body #dragonProcessPanel #dragonProcessBody{scrollbar-color:#9b6bff transparent !important;}" +
      "html body #dragonProductionPanel #dragonProductionBody{scrollbar-color:#3ddc84 transparent !important;}" +
      "html body #dragonImageHistInline{scrollbar-color:#c05268 transparent !important;}" +
      "html body #dragonArtPanel .dragon-art-body::-webkit-scrollbar,html body .dragon-control-panel .dragon-control-body::-webkit-scrollbar,html body #dragonHistoryPanel .dragon-history-body::-webkit-scrollbar,html body #dragonProcessPanel #dragonProcessBody::-webkit-scrollbar,html body #dragonProductionPanel #dragonProductionBody::-webkit-scrollbar,html body #dragonImageHistInline::-webkit-scrollbar{width:10px !important;height:10px !important;}" +
      "html body #dragonArtPanel .dragon-art-body::-webkit-scrollbar-track,html body .dragon-control-panel .dragon-control-body::-webkit-scrollbar-track,html body #dragonHistoryPanel .dragon-history-body::-webkit-scrollbar-track,html body #dragonProcessPanel #dragonProcessBody::-webkit-scrollbar-track,html body #dragonProductionPanel #dragonProductionBody::-webkit-scrollbar-track,html body #dragonImageHistInline::-webkit-scrollbar-track{background:transparent !important;}" +
      "html body #dragonArtPanel .dragon-art-body::-webkit-scrollbar-thumb{background:#7a5fd0 !important;border-radius:8px !important;}" +
      "html body .dragon-control-panel .dragon-control-body::-webkit-scrollbar-thumb{background:#3f8fd6 !important;border-radius:8px !important;}" +
      "html body #dragonHistoryPanel .dragon-history-body::-webkit-scrollbar-thumb{background:#8a8a98 !important;border-radius:8px !important;}" +
      "html body #dragonProcessPanel #dragonProcessBody::-webkit-scrollbar-thumb{background:#9b6bff !important;border-radius:8px !important;}" +
      "html body #dragonProductionPanel #dragonProductionBody::-webkit-scrollbar-thumb{background:#3ddc84 !important;border-radius:8px !important;}" +
      "html body #dragonImageHistInline::-webkit-scrollbar-thumb{background:#c05268 !important;border-radius:8px !important;}";
    document.head.appendChild(st);
  }
  ;function syncOpenCards() {
    try {
      var a = document.getElementById("dragonArtPanel");
      if (a) a.classList.toggle("dragon-open", !!(bodyEl && bodyEl.style.display !== "none"));
      var cb = document.querySelector(".dragon-control-body");
      var cp = document.querySelector(".dragon-control-panel");
      if (cp) cp.classList.toggle("dragon-open", !!(cb && cb.style.display !== "none"));
      var pp = document.getElementById("dragonHistoryPanel");
      var pb2 = pp ? pp.querySelector(".dragon-history-body") : null;
      if (pp) pp.classList.toggle("dragon-open", !!(pb2 && pb2.style.display !== "none"));
      var pr = document.getElementById("dragonProcessPanel");
      var prb = document.getElementById("dragonProcessBody");
      if (pr) pr.classList.toggle("dragon-open", !!(prb && !prb.hidden));
      var pd = document.getElementById("dragonProductionPanel");
      var pdb = pd ? pd.querySelector("#dragonProductionBody") : null;
      if (pd) pd.classList.toggle("dragon-open", !!(pdb && !pdb.hidden));
      var ihh = document.getElementById("dragonImageHistHead");
      var ihb = document.getElementById("dragonImageHistInline");
      var ihOpen = !!(ihb && !ihb.hidden);
      if (ihh) ihh.classList.toggle("dragon-open", ihOpen);
      if (ihb) ihb.classList.toggle("dragon-open", ihOpen);
    } catch (e) {}
  }
  // ---------------------------------------------------------------- item 13: ONE open panel at a time
  // Egon 27.09.2026: on the Generate page, pressing one panel button closes the other panels, and pressing
  // ✨ Generate closes whatever is still open. Delegated from `document` in the CAPTURE phase, so it runs
  // BEFORE the head's own toggle (which therefore still works) and survives any rebuild of a panel.
  ;function artIsOpen() { return !!bodyEl && bodyEl.style.display !== "none"; }
  ;function cpIsOpen() {
    var b = document.querySelector(".dragon-control-body");
    return !!b && b.style.display !== "none";
  }
  ;function cpClose() {
    if (!cpIsOpen()) return;
    var h = document.querySelector(".dragon-control-panel > button");
    if (h) h.click();
  }
  ;function ppIsOpen() {
    var b = document.querySelector("#dragonHistoryPanel .dragon-history-body");
    return !!b && b.style.display !== "none";
  }
  ;function ppClose() {
    if (!ppIsOpen()) return;
    try { if (window.dragonCloseHistWin) window.dragonCloseHistWin(); } catch (e) {}
  }
  ;function closePanelsExcept(keep) {
    // driven off the DOM as well as the remembered flag: a flag that fell out of step with the body
    // would otherwise leave a panel open (the rule is "one panel at a time", whatever the flag says)
    if (keep !== "art" && (open || artIsOpen())) setOpen(false);
    if (keep !== "cp") cpClose();
    if (keep !== "pp") ppClose();
  }
  ;function panelHeadOf(t) {
    if (!t || !t.closest) return null;
    if (t.closest("#dragonArtPanelHead")) return "art";
    if (t.closest(".dragon-control-panel > button")) return "cp";
    var pp = document.getElementById("dragonHistoryPanel");
    if (pp && pp.firstElementChild && pp.firstElementChild.contains(t)) return "pp";
    return null;
  }
  ;function installStackAccordion() {    if (window.__dragonArtStackAccordion) return;
    window.__dragonArtStackAccordion = true;
    document.addEventListener("click", function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var head = panelHeadOf(t);
      if (head) { try { closePanelsExcept(head); } catch (er) {} return; }
      if (t.closest("#generateButtonEl") || t.closest(".dragon-gen-col")) {
        try { closePanelsExcept(""); } catch (er2) {}
      }
    }, true);
  }
  window.dragonArtClosePanelsExcept = closePanelsExcept;
  window.dragonSyncOpenCards = syncOpenCards;
  ;function installOpenCardSync() {
    if (window.__dragonOpenCardSync) return;
    window.__dragonOpenCardSync = true;
    document.addEventListener("click", function () { try { syncOpenCards(); } catch (e) {} });
  }

  var tries = 0;
  ;function boot() {
    installStackCss();
    installOpenCardCss();
    installStackAccordion();
    try { scheduleDefaultStyle(); } catch (eSch) {}
    installOpenCardSync();
    try {
      ensure();
      hookSearch();
      tick();
    } catch (e) {}
    tries++;
    if (tries < 200) setTimeout(boot, 300);
  }
  try { if (window.dragonBodyObserve) window.dragonBodyObserve(tick); } catch (e) {}
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window.dragonArtPanel = {
    ensure: ensure,
    open: function () { ensure(); setOpen(true); },
    close: function () { setOpen(false); },
    toggle: function () { ensure(); setOpen(!open); },
    filter: applyFilter,
    rebuild: function () { ensure(); buildGrid(); syncAll(); },
    // the two read-only seams the check-up uses (it must be able to prove the TAG search without
    // knowing the style list): the filter haystack of a style, and its meta:tags keywords alone.
    hayOf: function (name) {
      for (var i = 0; i < cells.length; i++) if (cells[i].name === name) return cells[i].hay;
      return "";
    },
    tagsOf: function (name) { return ART_TAGS[name] || ""; },
    tagCount: function () { var n = 0; for (var k in ART_TAGS) if (Object.prototype.hasOwnProperty.call(ART_TAGS, k)) n++; return n; },
    searchValue: function () { return searchEl ? String(searchEl.value) : "(no search element)"; },
    searchSame: function (el) { return searchEl === el; },
    diag: function () { return { last: window.__dafLast || null, searchConnected: searchEl ? searchEl.isConnected : null, searchInPanel: !!(panel && searchEl && panel.contains(searchEl)), panelConnected: panel ? panel.isConnected : null, inDom: document.querySelectorAll("#dragonArtPanel").length, cells: cells.length, gridKids: gridEl ? gridEl.children.length : -1, open: open }; }
  };
})();
