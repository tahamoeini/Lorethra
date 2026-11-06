# aichat/live — the shippable AI chat build

Home of the AI Chat implementation that will be wired into the navbar's
✨ Ai Chat page (`src/SOCIAL/social-page.js`, page key `social`, tab P5).

Status: LIVE (30.10.2026) — engine.js + shell.js ship the real AI chat.

## Conventions (from src/SOCIAL/README.md + Designbook)

- Theme tokens (`--dt-*`), no bare hex where a token exists, no sharp corners.
- Page key stays `social`; the tab strip lives in `social-page.js`.
- Text backend: `root.generateText` (ai-text-plugin, already imported in main.pjs).
- Presence/counts: `root.createServerSocket` (server-plugin, already imported).
- Persistence: `root.kv` (per-user IndexedDB). No chat content in DS.
- Every new control/surface: update the SOCIAL register + Legends (rule I116).

## Planned slices (each slice lands tested, then the next starts)

1. `engine.js` — DONE 30.10.2026: registry (10 bots, names as drafted), prompt,
   kv memory, streaming renderer. Pending: Sexa gate + badge.
   (Egon: badgeless, no gate for now).
2. `shell.js` — DONE 30.10.2026: roster left / session right in the AI Chat tab,
   Dexa default, Sexa badgeless, customs + creator.
3. `settings.js` — DONE 31.10.2026: general (roster-bottom Chat Settings) + per-companion
   (session-header gear) dialogs with category tabs, kv-backed (folder dragonAiBots:
   settings / tune:<id> / card:<id>). Special wins over general. Covers: Auto browser
   language, emoji, reply delivery SHAPE (default/typewriter/instant), reply length,
   question tendency, reply-start images (on/off, count, size, display size, camera,
   art style, negative presets, seed lock, character lock), TTS read-aloud, chat/JSON
   export, factory reset; per-bot Identity (avatar+name/tagline/bio/background/
   traits/likes/dislikes), Personality (Intelligence Style presets Genius/Normal/Naive
   over 4 existing axes + all 72 sliders), Images + Behavior (Use General rows),
   Memory (summary/facts + in-memory story journal: event/milestone/stage/story
   part/chapter/note). No IQ slider by design; journal is part of memory.
4. Helper-window picker (draft PART 2) — OPEN: window stays Dexa-only, no regression.
4. Check-up items (draft PART 5 §5, rule I77) + viewport runs — OPEN.
5. `settings.js` REV 31.10.2026 (Egon): reply-start images BELOW the reply (were above);
   imgSize default 512x768 portrait; ARTSTYLE 8→18 (3D Render, Watercolor, Pencil Sketch,
   Comic Book, Epic Fantasy, Gothic Dark, Chibi, Vintage Poster, Low Poly, Vaporwave, each
   with its own prompt phrase); seedLock + charLock default ON; New-companion button to the
   roster TOP under Chat settings in the same button design, creator dialog rebuilt with the
   special-settings sections (Identity incl. avatar/accent/persona/look/bio/background/
   traits/likes/dislikes/hobbies/fears, Personality incl. Intelligence Style + 72 sliders,
   Images + Behavior rows incl. TTS voice); DEFAULT_CARDS for all 10 premades (bio/
   background/traits/likes/dislikes/hobbies/fears as defaults, user edit wins,
   clear-to-default restores, used in prompts + shown in Identity tabs); second 🔊 press =
   session auto read-aloud (image prompts never spoken, green state, third press off);
   TTS Voice dropdown (browser/device voices for the 14 languages) in general Voice & Data
   + per-bot Behavior (Use General).
6. Starter suggestions REV 31.10.2026 (Egon): transcript emptyken Write alanının üstünde
   6 hazır mesaj çipi (tarayıcı diline göre TR/EN: selam, sohbet, RP, görsel, prompt yardımı,
   şaşırt — son ikisi editörün ekleri). Basış ilk mesaj olarak gönderir, ilk mesajda (buton
   ya da manuel fark etmez) kalkar; reset sonrası yeniden gelir. Çipler satırda ortalıdır.
7. 🔊 REV + Follow-Up REV 31.10.2026 (Egon): 🔊 döngüsü 1.basış=oku, 2.=session auto-okuma,
   3.=sus (auto off + ses kesilir), 4.=1.basışa dönüş; buton mesajın ALTINDA değil ÜSTÜNDE.
   Follow-Up Suggestions (genel Conversation + özel Behavior, Off/1/2/3/4, varsayılan 2):
   bot cevabından sonra Write üstünde tıklanabilir 2-7 kelimelik öneri çipleri (son
   konuşmadan üretilir); basış gönderir, manuel yazım gizler.
8. REV 31.10.2026 (Egon): 🔊 mesajın BAŞINDA satır içi (🔊 + mesaj, akan yazı butonu silmiyor);
   follow-up çipleri NUMARALI ("1- …", "2- …"); Write'a çıplak numara + Enter o çipi gönderir.
9. REV 31.10.2026 (Egon): 🔊 satır DIŞINDA, balonun önünde kendi yerinde (🔊 + (metin), akan
   yazı dokunmuyor); her basış farklı renk — 1 yeşil (oku), 2 baby blue (auto açıldı),
   3 kırmızı (sus), 4 yine yeşil (başa dönüş). Auto açılınca diğer balonların butonları
   baby blue olur, susunca temizlenir.
10. REV 31.10.2026 (Egon — THREADS): sol liste SADECE başlatılan sohbetleri gösterir;
    BİR botun ÇOK thread'i olur (kart basışı = taze thread: #Thread, #Thread 2, …); thread
    satırında isim + düzenlenebilir #title, hover'da ♥ (pin, en üste) + ✖ (onaylı kapat/sil);
    Companions kartları tam-boy görsel + alt isim/bilgi + sağ-üst ♥ (liste başına sabitleme);
    Chat settings + Companions ayrı ama yakın (2px); panel sabit yükseklikte (büyümez);
    🔊 mesajın SON satırında satır-içi ((metin) + 🔊, ekstra satır yok);
    serbest kaydırma (varsayılan: sadece dipteyken takip; genel+özel "Auto-Scroll During
    Reply" On = her zaman takip); Dexa HER ZAMAN varsayılan görünüm.
11. DİL DÜZELTMESİ 31.10.2026 (Egon): özel-genel dil seçimi artık SERT kural cümlesi kurar
    ("Reply ONLY in X — even if the user writes in another language…"); boş (auto-İngilizce)
    talimat bug'ı giderildi; follow-up çipleri de seçili dilde zorlanır.
12. REV 31.10.2026 (Egon): 🔊 satır-sonu rozetli — emoji `color` tutmadığı için basış geri
    bildirimi buton yanındaki mini rozette (▶ play yeşil / 🔁 auto baby blue / ⏹ stop
    kırmızı, 4.=▶); kalpler 3D emoji (🤍/💗, thread + companion kartları).
