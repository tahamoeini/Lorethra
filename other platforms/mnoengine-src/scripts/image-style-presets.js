// image-style-presets.js — style-tag presets for the world editor's Images tab
// (the style template dropdown in world-editor.js). Edit freely: each entry is a
// { label, text } pair; label shows in the dropdown, text loads into the style tags.
// Entries render under unselectable <optgroup> section headers taken from each
// entry's group — keep entries of the same group adjacent so they stay in one section.

export const IMAGE_STYLE_TEMPLATES = [
  {
    label: "Digital Painting",
    group: "2D Illustration",
    text: "breathtaking digital art, trending on artstation, in the style of atey ghailan, in the style of greg rutkowski, in the style of greg tocchini, in the style of james gilleard, 8k, high resolution, best quality. Overall, it's an absolute world-class masterpiece digital painting. It's an aesthetically pleasing digital painting with impeccable attention to detail and impressive composition."
  },
  {
    label: "Painterly",
    group: "2D Illustration",
    text: "digital painting in the style of Ilya Kuvshinov with painterly brush strokes, in the style of Ilya Kuvshinov, world-class painterly masterpiece. Overall, it's an absolute world-class masterpiece painterly digital painting. It's an aesthetically pleasing painterly digital painting with impeccable attention to detail and impressive composition."
  },
  {
    label: "Vibrant Fantasy",
    group: "2D Illustration",
    text: "rich illustrated fantasy painting, expressive painterly brushwork, warm atmospheric light, vibrant jewel-toned palette, magical mood, intricate detail, epic fantasy atmosphere"
  },
  {
    label: "Historical Painting",
    group: "2D Illustration",
    text: "grand classical history painting, dramatic realistic figures, rich chiaroscuro, museum-master composition, epic historical moment captured in oils, timeless academic finish"
  },
  {
    label: "Medieval Illustration",
    group: "2D Illustration",
    text: "medieval illuminated-manuscript illustration, flat stylized figures, tempera colors with gold-leaf accents, no linear perspective, antique vellum feel"
  },
  {
    label: "Semi-Realistic",
    group: "2D Illustration",
    text: "polished semi-realistic illustration, smoothly blended rendering, lifelike skin and fabric, soft studio lighting, natural color, clean balanced composition, premium high-end finish, detailed and refined"
  },
  {
    label: "Watercolor",
    group: "2D Illustration",
    text: "watercolor illustration, translucent layered washes, soft flowing pigment, delicately bleeding edges, airy composition, subtle paper texture, warm storybook finish"
  },
  {
    label: "Ink Wash",
    group: "2D Illustration",
    text: "ink-wash painting, flowing calligraphic brush strokes, dry-brush texture, ink bleeding into textured paper, generous empty negative space, restrained near-monochrome with faint warm accents"
  },
  {
    label: "Art Nouveau",
    group: "2D Illustration",
    text: "art-nouveau illustration, elegant flowing ornamental linework, botanical motifs, luxurious flat color fields, intricate decorative framing, refined silhouette, vintage poster harmony"
  },
  {
    label: "Tarot Card",
    group: "2D Illustration",
    text: "ornate tarot card illustration, mystical occult symbolism, decorative gilt borders, rich jewel tones with gold accents, flat emblematic composition, esoteric fortune-telling art"
  },
  {
    label: "Anime",
    group: "Anime, Manga & Toon",
    text: "world-class masterpiece, 4k, best quality, anime art. Overall, it's an absolute world-class masterpiece anime-inspired artwork. It's an aesthetically pleasing anime art with impeccable attention to detail and beautiful composition."
  },
  {
    label: "Painted Anime",
    group: "Anime, Manga & Toon",
    text: "art in the style of atey ghailan, painterly anime style at pixiv, art in the style of kantoku, in art style of redjuice/necömi/rella/tiv pixiv collab, your name anime art style, masterpiece digital painting, exquisite lighting and composition, inspired by wlop art style, 8k, sharp, very detailed, high resolution, illustration. Overall, it's an absolute world-class masterpiece painterly anime-inspired digital art. It's an aesthetically pleasing painterly anime-inspired digital artwork with impeccable attention to detail and impressive composition."
  },
  {
    label: "Realistic Anime",
    group: "Anime, Manga & Toon",
    text: "photorealistic anime style, lifelike anime faces with detailed eyes and natural skin, cinematic lighting, ultra-detailed rendering, artstation-quality finish, seamless 2D/3D blend"
  },
  {
    label: "Colored Manga",
    group: "Anime, Manga & Toon",
    text: "colored manga illustration, crisp ink line art, clean screentone-style shading, vibrant flat colors, dynamic panel-like composition, expressive characters, polished print-manga finish"
  },
  {
    label: "B&W Manga",
    group: "Anime, Manga & Toon",
    text: "black-and-white manga illustration, crisp ink line art, detailed screentone shading, stark ink blacks, dynamic composition, expressive characters, classic print-manga finish"
  },
  {
    label: "Manhwa",
    group: "Anime, Manga & Toon",
    text: "Korean manhwa webtoon style, clean elegant line art, soft full-color rendering, tall fashionable characters, glossy polished finish, dramatic vertical-scroll composition, stylish modern flair"
  },
  {
    label: "Modern Toon",
    group: "Anime, Manga & Toon",
    text: "cel-shaded toon style, bold clean outlines, flat color fills with sharp stepped shadows, crisp two-tone lighting, vibrant stylized look, anime-meets-game art, crisp graphic finish"
  },
  {
    label: "Cartoon 2D",
    group: "Anime, Manga & Toon",
    text: "TV cartoon style, bold thick outlines, flat bright colors, exaggerated goofy proportions, playful wacky energy, simple appealing shapes, minimal flat shading, fun expressive characters"
  },
  {
    label: "Web Comic",
    group: "Comics & Print",
    text: "in a soft, cute, minimalist, webcomic-style illustration. Line art is somewhat bold but gentle, with clean lines, and subtle variation. Colors are soft, flat, with gentle pastel tones. No shading except for light inner shadows or simple highlights. The background is plain white or contains a light wash of color with subtle textured style. The overall scene is wholesome and endearing like a page from a Liz Climo comic. evoking authentic warmth through the wholesome, soft, web comic style. It's an aesthetically pleasing masterpiece, showing high skill in evoking an authentic and beautifully minimalist style."
  },
  {
    label: "Superhero Comic",
    group: "Comics & Print",
    text: "blockbuster superhero comic art, bold ink outlines, powerful heroic anatomy, dynamic action poses, dramatic foreshortening, explosive composition, vivid saturated colors, high-energy comic-cover impact"
  },
  {
    label: "Retro Pulp",
    group: "Comics & Print",
    text: "vintage pulp-cover painting, bold painted shapes, strong shadow design, limited retro print palette, subtle aged-print texture, dramatic paperback composition, deep shadows and bold highlights"
  },
  {
    label: "Vector",
    group: "Stylized Graphic",
    text: "clean flat vector illustration, smooth geometric shapes, crisp uniform edges, flat color fills with simple gradients, minimal detail, modern graphic-design poster look, sharp at any size"
  },
  {
    label: "Pixel Art",
    group: "Stylized Graphic",
    text: "detailed pixel art, crisp clean pixels, limited retro palette, chunky readable shapes, careful dithering, smooth banded gradients, 16-bit game sprite quality, sharp and charming at small sizes"
  },
  {
    label: "Noir Graphic",
    group: "Stylized Graphic",
    text: "black-and-white graphic novel art, bold ink shadows, stark high contrast, deep blacks, sharp rim lighting, strong readable silhouette, dramatic noir composition"
  },
  {
    label: "3D Render",
    group: "3D",
    text: "stylized 3D character render, sculpted high-poly look, PBR materials, dimensional hair and cloth, soft cinematic studio lighting, gentle shading, polished 3D game-art finish"
  },
  {
    label: "Epic Fantasy 3D",
    group: "3D",
    text: "epic stylized fantasy 3D in the spirit of classic high-fantasy MMOs, exaggerated heroic proportions, bulky ornate armor and oversized weapons, hand-painted textures, vibrant saturated colors, dramatic epic composition, larger-than-life game art"
  },
  {
    label: "Animated Feature 3D",
    group: "3D",
    text: "big-studio 3D animation style, soft rounded stylized characters, large expressive eyes, smooth appealing surfaces, vibrant family-film palette, warm cheerful lighting, polished animated-feature finish, wholesome and charming"
  },
  {
    label: "Low-Poly 3D",
    group: "3D",
    text: "low-poly 3D render, flat-shaded polygon facets, blocky geometric forms, crisp hard-edged lighting with sharp shadow breaks, no smooth shading, stylized game art, strong readable silhouette"
  },
  {
    label: "Stylized 3D",
    group: "3D",
    text: "stylized 3D in the spirit of modern hero shooters, overwatch style, fortnite style, chunky cartoonish proportions with big heads and hands, smooth toy-like surfaces, bold readable shapes, vibrant saturated colors, playful high-energy game art"
  },
  {
    label: "Hand-Painted 3D",
    group: "3D",
    text: "hand-painted stylized low-poly 3D, (painterly textured surfaces with visible brushwork), thick brush strokes, dramatic cinematic lighting, rich moody palette, expressive faces, exaggerated features, stylized proportion, high contrast texture"
  },
  {
    label: "AAA Game",
    group: "3D",
    text: "AAA video game cinematic key art, ultra-detailed realistic rendering, rich complex materials and textures, dramatic cinematic lighting, atmospheric depth and particle effects, epic composition, blockbuster splash-art quality"
  },
  {
    label: "Cinematic",
    group: "Photo & Film",
    text: "a real cinematic photo, movie scene, film still, key visual, (cinematic shot:1.3), Panavision cinemascope, 85mm lens, F/2.8 aperture, bokeh depth of field, sharp focus, fine details, cinematic lighting, volumetric dramatic lighting, Technicolor, cinematic color grading, dramatic mood, detailed background, IMAX render, ultra HDR, 8k resolution, high quality, masterpiece"
  },
  {
    label: "Photography",
    group: "Photo & Film",
    text: "soft focus, depth of field, 8k photo, HDR, professional lighting, taken with Canon EOS R5, DSLR, 75mm lens."
  },
  {
    label: "Photorealistic",
    group: "Photo & Film",
    text: "photorealistic rendering, lifelike detail, natural skin texture and true-to-life materials, realistic lighting and shadows, true color, ultra-detailed, indistinguishable from a photograph"
  },
  {
    label: "Casual Photo",
    group: "Photo & Film",
    text: "A casual real-life photograph, The light falling across the subject in the gradual, the subsurface scattering of light through skin tissue visible as a faint glow along edges and in thin areas, restrained post-processing, real photograph, amateur snapshot, candid body documentation, It's a casual photo, Overall it's an actual real-life photograph. A casual real-life photograph, a casual photo."
  },
  {
    label: "Pinup Cover",
    group: "Adult & Risqué",
    text: "glossy adult magazine cover style, glamorous pinup pose, sultry confident expression, tasteful alluring framing, soft flattering studio lighting, high-gloss retouch, bold cover-model energy"
  },
  {
    label: "Boudoir Photo",
    group: "Adult & Risqué",
    text: "intimate boudoir photography, soft lighting, silk and lace textures, tasteful sensual poses, shallow depth of field, romantic warm tones, elegant and alluring"
  },
  {
    label: "Erotic Oil Classic",
    group: "Adult & Risqué",
    text: "sensual classical oil painting, old-master chiaroscuro, luminous skin tones, drapery and shadow play, romantic passion, tasteful eroticism in the tradition of classical nudes"
  },
  {
    label: "Fanservice Anime",
    group: "Adult & Risqué",
    text: "risque anime illustration, playful fan-service framing, form-fitting outfits, blushing expressive faces, glossy vibrant finish, cheeky ero-manga polish, stylish and seductive"
  },
  {
    label: "Burlesque Poster",
    group: "Adult & Risqué",
    text: "vintage burlesque show poster art, feathers and stage glamour, warm theatrical lighting, cheeky vintage erotica charm, bold poster composition, playful seduction"
  }
];
