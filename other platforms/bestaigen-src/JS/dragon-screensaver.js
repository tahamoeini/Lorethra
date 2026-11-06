// dragon-screensaver.js — moved VERBATIM out of index.html (Paket A1, 25.09.2026). Classic script
// (not a module), inserted at the same point of the boot order, so globals and ordering are unchanged.
// Rollback: paste this file's body back into index.html as a plain <script> at its old place.
(function(){
  // PERCHANCE EDIT: privacy screen saver — full-screen landscape overlay after 60s idle (or via
  // Options → 🖼️ Screen saver → ▶ Test now). Crossfades to a random landscape every 60s.
  // ANY input dismisses it without touching generator state (in-flight generations keep running).
  // SFW landscapes only — NO living creatures. Grow the pool by adding URLs to window.dragonScreenImages.
  window.dragonScreenImages = [
    "https://user.uploads.dev/file/89d12e187daa74b146fc3bbf5772833f.jpg", // mountain ridge + lake at dawn
    "https://user.uploads.dev/file/9d082dda571a2fb6820273584946e71b.jpg", // aurora over frozen arctic lake
    // "https://user.uploads.dev/file/45b42a74bc027517da18918a3ec9aafa.jpg"
    "https://user.uploads.dev/file/92fbe6d8268173252ffb9b30661cad0a.jpg", // forest sunbeams + wildflowers
    "https://user.uploads.dev/file/465cb809dce7d9f5aa6b86a863fe579d.jpg", // coastal sunset, ocean + headland
    "https://user.uploads.dev/file/9ce842fa51834d1378bf4f35b1affa7f.jpg", // golden-hour meadow, rolling hills + mist
    "https://user.uploads.dev/file/14fd40dc5f39e87aabbb660c33b1fe70.jpg", // turquoise mountain lake at sunrise
    "https://user.uploads.dev/file/b8e2fd1b640f05b529ec65acd31edfd1.jpg", // green coastal cliffs, pastel sunset
    "https://user.uploads.dev/file/766d613ee05b34ed29c1ab9d0a3614eb.jpg", // lavender field at golden hour
    "https://user.uploads.dev/file/429cabb13b86c6d4c36e27d7bfc352ba.jpg", // still life: pampas grass + eucalyptus by window
    "https://user.uploads.dev/file/98f29f389611d7c29888cbe085770f0c.jpg", // still life: bowl of oranges on marble
    // checked with vision (0 containing living things). ★ = 50 suggested by agenty. Rule: no living things, warm & relaxing. —
    // ★ agenty's picks (50):
    "https://user.uploads.dev/file/80268b35e38e761c47b2740dc35c38d5.jpg",
    "https://user.uploads.dev/file/ddf158bb773d72b782483db97a5b5424.jpg",
    "https://user.uploads.dev/file/d9558d363b1b956bfb183723c8f03c8c.jpg",
    "https://user.uploads.dev/file/793854d6ea3bfeeb6b75aa15fb0d7263.jpg",
    "https://user.uploads.dev/file/0578bd694bb73f3210bffee463885bf6.jpg",
    "https://user.uploads.dev/file/291aeb75685fea8bae78133716c13f03.jpg",
    "https://user.uploads.dev/file/263d506eba107c5c527bb55fc4990ba8.jpg",
    "https://user.uploads.dev/file/efabb55d33abdc5f43989728a71141e7.jpg",
    "https://user.uploads.dev/file/fb4986c570518029f9bdb41358ea59a0.jpg",
    "https://user.uploads.dev/file/f5904445b192b509e8bae870c74c40c2.jpg",
    "https://user.uploads.dev/file/5d09fd1ba30ae100982df8174824e468.jpg",
    "https://user.uploads.dev/file/2a6490a4a9c8b227ff7ff1861facc796.jpg",
    "https://user.uploads.dev/file/c0725879e2f9671b4667dec0d1062f91.jpg",
    "https://user.uploads.dev/file/065af291bd2ba3a60c25ddcde3f01f8c.jpg",
    "https://user.uploads.dev/file/3ac78ac5bd0d34878ccbb98ed9f53b2b.jpg",
    "https://user.uploads.dev/file/6c0b49addeea71497bd4ec6276425f24.jpg",
    "https://user.uploads.dev/file/6fa254ace00909caf9387ebb036868f4.jpg",
    "https://user.uploads.dev/file/22cc4813cb07d34cb65d4e290168dd0c.jpg",
    "https://user.uploads.dev/file/ffb2ebff0936af48781870226dabbca6.jpg",
    "https://user.uploads.dev/file/b178817b36bb7cd0ef48cfe483d1746f.jpg",
    "https://user.uploads.dev/file/0483b90b1e397bb34029bad3952e703b.jpg",
    "https://user.uploads.dev/file/16f2766cf41e99d67522049f0820820e.jpg",
    "https://user.uploads.dev/file/4d0d03d29bc6ce4ed193c4c6e19df344.jpg",
    "https://user.uploads.dev/file/2bc2a380b83b1d6f1d224f17e102decb.jpg",
    "https://user.uploads.dev/file/19c0bd0a27eb09e9e4cf1ea6f4f5dd7e.jpg",
    "https://user.uploads.dev/file/bb61fdb71692d32c9668532aa6f21dfe.jpg",
    "https://user.uploads.dev/file/6a106a3f0f97138b44ddd30439047dfa.jpg",
    "https://user.uploads.dev/file/e94a9934cdbfbd734717bb75d1a055f2.jpg",
    "https://user.uploads.dev/file/82fa63c2cb49313b14809158bbb11079.jpg",
    "https://user.uploads.dev/file/03a2e68adebe17472746525923410d3f.jpg",
    "https://user.uploads.dev/file/d8547ed54eed02a1da04e4d05c8eb4f1.jpg",
    "https://user.uploads.dev/file/591ede4d1a425897b06e71be29f92455.jpg",
    "https://user.uploads.dev/file/66c7922abb8b782e5ab0512fab68346a.jpg",
    "https://user.uploads.dev/file/5535d6f3ff59f577a52f75ba3f642993.jpg",
    "https://user.uploads.dev/file/f5692974719772b78c418e31010514ec.jpg",
    "https://user.uploads.dev/file/00e6b11fbf52ba22f47b71caef6e821e.jpg",
    "https://user.uploads.dev/file/708d920404754c1e7ccbf4c9f3ced6e7.jpg",
    "https://user.uploads.dev/file/d1df1df63f20c55bc9ac1d59eba2c637.jpg",
    "https://user.uploads.dev/file/da5d89666cac1ce501e779bc2dded156.jpg",
    "https://user.uploads.dev/file/2df6f0e708a775d7094cb065d5db22e5.jpg",
    "https://user.uploads.dev/file/2e7209cb8f010009d4b832ce9d2b5008.jpg",
    "https://user.uploads.dev/file/125bfc3f8d27c5626fa50ad275352ed0.jpg",
    "https://user.uploads.dev/file/7879a0bab532684cf270adb2506f4e0c.jpg",
    "https://user.uploads.dev/file/e2e1287b97500f26e5d0f931ae378595.jpg",
    "https://user.uploads.dev/file/679aaee1ac7d1f083f98d6276e2556e7.jpg",
    "https://user.uploads.dev/file/78e5e7ad7f56f78c12f88d65f838ea11.jpg",
    "https://user.uploads.dev/file/48b21829b695b07ed269c1b70225598e.jpg",
    "https://user.uploads.dev/file/a55250bfc46bee5fc698df031ebdd37d.jpg",
    "https://user.uploads.dev/file/18ee8650e9ef36383f92179c0ea81478.jpg",
    "https://user.uploads.dev/file/8c21a59cd6951a5e63510a470a14a86c.jpg", 
    // the remaining 50:
    "https://user.uploads.dev/file/d26dcfb6deb6f02e370a6fe82820c063.jpg",
    "https://user.uploads.dev/file/bd4b9045f7396d520fb9754f5dca1a4c.jpg",
    "https://user.uploads.dev/file/3f6bafecbbf1e5ef258f0f455dd88835.jpg",
    "https://user.uploads.dev/file/8c7f99dfa006787740124872a9f56ad9.jpg",
    "https://user.uploads.dev/file/a3d4d1a2412c0a2951badd8b49a42e0d.jpg",
    "https://user.uploads.dev/file/618ad791173a18aa463d3124e527df3a.jpg",
    "https://user.uploads.dev/file/73046cce20ba8ac5a2caf8e6191d50b9.jpg",
    "https://user.uploads.dev/file/ef21eacad91d1df6bf2ef1e7989193db.jpg",
    "https://user.uploads.dev/file/bb59340479c420a3ed26604c3f0bef25.jpg",
    "https://user.uploads.dev/file/f173baf2737fa059a5df77dd651bb677.jpg",
    "https://user.uploads.dev/file/ef7256705077841bb686020ce47dc6d3.jpg",
    "https://user.uploads.dev/file/19579335ae678135caf0b9d14b5eeffc.jpg",
    "https://user.uploads.dev/file/b83e5ee375d3a8f3fd823600d969314b.jpg",
    "https://user.uploads.dev/file/8c7696fbe5d4e3a552fc0c2abd40b21e.jpg",
    "https://user.uploads.dev/file/9f61e53410ab8a9cf4b0a6ce2d7d484b.jpg",
    "https://user.uploads.dev/file/a712bd33cb67250040153b9b002ca264.jpg",
    "https://user.uploads.dev/file/7d526a824c4e805c4aff7a095a899ecb.jpg",
    "https://user.uploads.dev/file/a9db3adc0889f5a8527ff0348f71d25b.jpg",
    "https://user.uploads.dev/file/961acb15d56eeea85917a4d1d2ec03f5.jpg",
    "https://user.uploads.dev/file/722c2b47890636fcd7aafa383c7b0dbb.jpg",
    "https://user.uploads.dev/file/3cc9be54d70d0d9676e2b4874a0e4d9f.jpg",
    "https://user.uploads.dev/file/aab622cf32666243d8e5d2140c9a3389.jpg",
    "https://user.uploads.dev/file/90cda2053be6e966320a519ed186f8c8.jpg",
    "https://user.uploads.dev/file/ff586264b2f4b703a40a74c0d5eaddbc.jpg",
    "https://user.uploads.dev/file/5a9f1d36fbd59fa0c7ddfb54ed5f67d1.jpg",
    "https://user.uploads.dev/file/a18b9025b60fd4026044869c9a4fdd54.jpg",
    "https://user.uploads.dev/file/d8c65546a695e94a1ca4e5585257ac32.jpg",
    "https://user.uploads.dev/file/7939b907760ba53a402195506ad0d119.jpg",
    "https://user.uploads.dev/file/0dbb1f63b6947947b7c67540b8e1c5bc.jpg",
    "https://user.uploads.dev/file/40f1cb261fcd35d1dc1b9e4f481d77b6.jpg",
    "https://user.uploads.dev/file/e82a7692bd2ab3117422aa874dfbf2e0.jpg",
    "https://user.uploads.dev/file/56fc0d16c3c2cfe7c9bdece90b74b703.jpg",
    "https://user.uploads.dev/file/65dccf27815ca5a7f966c0b2a4058622.jpg",
    "https://user.uploads.dev/file/10f1ebda07087e65f8846b3eec13f6dc.jpg",
    "https://user.uploads.dev/file/5a6f28ddd3fd9b999bd401f202c04041.jpg",
    "https://user.uploads.dev/file/02b092ea29fae198ca810ce2aaee82d6.jpg",
    "https://user.uploads.dev/file/1ab63a909b8c8e9fdf1110dc47390df8.jpg",
    "https://user.uploads.dev/file/f4f99f01f35e9cb73128aed966cf7a8e.jpg",
    "https://user.uploads.dev/file/16118b62c80960445222feedae3a95cc.jpg",
    "https://user.uploads.dev/file/4b3b2a112c97ac3571487aa2d8bcd709.jpg",
    "https://user.uploads.dev/file/5dd17f50990c89410c33485b0e574e9b.jpg",
    "https://user.uploads.dev/file/d32db6fe098e8890b764b5516bf3f13d.jpg",
    "https://user.uploads.dev/file/a2e14605dbba9ff3ef7c0e1ec373c652.jpg",
    "https://user.uploads.dev/file/07fb31dedfbc6c37eb792e2d72bd38bc.jpg",
    "https://user.uploads.dev/file/cf937857dc254cd484be7044c924c940.jpg",
    "https://user.uploads.dev/file/cce069c3b63e6761a4650c673f2b4102.jpg",
    "https://user.uploads.dev/file/8e4d3b6dc0fc235d74f8bca04f731ae3.jpg",
    "https://user.uploads.dev/file/79b27d6dc41ae5903ac37a706d33dd5b.jpg",
    "https://user.uploads.dev/file/2ec1190d6e65a571eeb33057725dfe97.jpg",
    "https://user.uploads.dev/file/d999cbdf070f573a9a3f2f806ab5e60d.jpg"
  ];
  // "🌧️ Rainy Only" (Options → 🖼 Image — Looks & Display → the toggle right under the Screen Saver
  // button; localStorage.dragonSsRainy). The main pool above is deliberately warm, sunny and dry — a
  // luminance/saturation/blue-shift scan of all 110 of its pictures found essentially no rain — so the
  // rain/fog/storm, no living creatures and no text. While the overlay is up the animated rain layer
  // (power-rain-plugin, imported in main.pjs) runs on top of these.
  window.dragonScreenRainyImages = [
    "https://user.uploads.dev/file/0ad3d6706c7e3ba46206c09fd71daf3e.jpg", // rain over rice terraces
    "https://user.uploads.dev/file/2854624175ce1d05e35fb9a0bbe3deaf.jpg", // rainy mountain valley, mist
    "https://user.uploads.dev/file/7e693b2f2e5fa7611e46eab85baff905.jpg", // raindrops on a window, blurred skyline
    "https://user.uploads.dev/file/8e1f9a6d08b98b05edfd46005136539a.jpg", // storm rain over a turquoise sea
    "https://user.uploads.dev/file/37f18008c062c4e8ee0b240720a4a570.jpg", // rain in a pine forest, fog
    "https://user.uploads.dev/file/92b9be7d7a1f3d9606e42e1ac48f6396.jpg", // wet cobblestone street at night, lamps
    "https://user.uploads.dev/file/1220eb7b9274ad20c86668b94bec6fe5.jpg", // monsoon rain over a tea plantation
    "https://user.uploads.dev/file/892cb0e867ff93298a2713958f73aa91.jpg", // rain showers over a calm lake
    "https://user.uploads.dev/file/818e0f2607cd725436d20f29cf8e77e8.jpg", // autumn rain, empty country road
    "https://user.uploads.dev/file/9246c7848a26fabec99119a7baf7e329.jpg"  // heavy rain on lush tropical leaves
  ];
  var IDLE_MS = 300*1000; // default: 5 dk idle before the AFK privacy screensaver appears
  var ssCycle = 60;       // crossfade to a new landscape every 60s while visible
  try { var siv = Number(localStorage.dragonScreenInterval); if (siv >= 5 && siv <= 3600) IDLE_MS = siv*1000; } catch (e) {}
  var idleTimer = null;
  var cycleTimer = null;
  var ssCurrentIdx = -1;
  var ssTop = null;
  var visible = false;
  var ssStyle = "v2";
  // ("the choice is remembered") but nothing ever read localStorage back: the module always started from the
  // default "v2". "v1"/"full" = the plain full-screen picture, "v2"/"frame" = the framed + matte look.
  try {
    var _ssv = localStorage.dragonScreenStyle;
    if (_ssv === "v1" || _ssv === "full") ssStyle = "v1";
    else if (_ssv === "v2" || _ssv === "frame") ssStyle = "v2";
  } catch (e) {}
  var NOISE = "url(\"" + ("data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="140" height="140"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.07 0"/></filter><rect width="140" height="140" filter="url(#n)"/></svg>')) + "\")";
  var ssCssEl = document.createElement("style");
  ssCssEl.textContent =
    "#dragonScreenOverlay { background:#000; }" +
    // from both — see the note where its rules used to be). Base rules = full-screen look; the
    // `.dragon-ss-framed` block below only shifts the clock up above the matte.
    "#dragonScreenClock { display:block; position:absolute; left:0; right:0; bottom:clamp(2.6rem, 9vh, 4.6rem); text-align:center; z-index:3; }" +
    "#dragonScreenClockTxt { display:inline-block; background:linear-gradient(180deg,rgba(24,21,14,.78),rgba(10,9,6,.6)); border:1px solid rgba(255,255,255,.12); border-top:2px solid rgba(255,255,255,.16); border-bottom:3px solid rgba(0,0,0,.55); border-radius:16px; padding:.2rem 1.6rem .35rem; color:var(--dt-accent,#e0244c); font-size:clamp(2.2rem, 7vh, 4.4rem); font-weight:600; letter-spacing:.16em; text-shadow:0 3px 22px rgba(0,0,0,.65); box-shadow: inset 0 1px 0 rgba(255,255,255,.1), 0 10px 20px rgba(0,0,0,.5); font-variant-numeric:tabular-nums; }" +
    "#dragonScreenImgA, #dragonScreenImgB { position:absolute; top:0; left:0; width:100%; height:100%; object-fit:cover; background:#000; }" +
    "#dragonScreenFrame { position:absolute; inset:0; }" +
    "#dragonScreenMatte { position:absolute; inset:0; overflow:hidden; }" +
    "#dragonScreenOverlay.dragon-ss-framed { background: radial-gradient(120% 90% at 50% 0%, var(--dt-bg2,#16161c) 0%, transparent 55%), var(--dt-bg,#000); }" +
    "#dragonScreenOverlay.dragon-ss-framed::before { content:\"\"; position:absolute; left:0; right:0; top:0; bottom:0; background:radial-gradient(120% 100% at 50% 50%, transparent 60%, rgba(0,0,0,.32) 100%); z-index:1; pointer-events:none; }" +
    "#dragonScreenOverlay.dragon-ss-framed #dragonScreenFrame { --frame: clamp(8px, 1.1vh, 13px); position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); width:min(88vw, calc(100vh - 15vh)); height:calc(100% - 16vh); padding:var(--frame); box-sizing:border-box; border-radius:14px; border:3px solid; border-color: rgba(255,255,255,.42) rgba(0,0,0,.5) rgba(0,0,0,.5) rgba(255,255,255,.42); background: repeating-linear-gradient(90deg, rgba(255,255,255,.05) 0px, rgba(255,255,255,.05) 1px, rgba(0,0,0,.04) 1px, rgba(0,0,0,.04) 2px), var(--dt-accent,#e0244c); box-shadow: inset 1px 1px 3px rgba(255,255,255,.35), inset -1px -1px 3px rgba(0,0,0,.4), 0 0 0 2px rgba(0,0,0,.9), 0 0 0 3px rgba(0,0,0,.45), 0 8px 20px rgba(0,0,0,.6), 0 32px 64px rgba(0,0,0,.55); z-index:2; }" +
    "#dragonScreenOverlay.dragon-ss-framed #dragonScreenFrame::after { content:\"\"; position:absolute; inset:-1px; border-radius:15px; pointer-events:none; background: linear-gradient(135deg, rgba(0,0,0,.25) 0%, rgba(0,0,0,0) 9%), linear-gradient(225deg, rgba(0,0,0,.25) 0%, rgba(0,0,0,0) 9%), linear-gradient(45deg, rgba(0,0,0,.25) 0%, rgba(0,0,0,0) 9%), linear-gradient(315deg, rgba(0,0,0,.25) 0%, rgba(0,0,0,0) 9%); }" +
    "#dragonScreenOverlay.dragon-ss-framed #dragonScreenMatte { --matte: clamp(14px, 2.6vh, 34px); position:relative; width:100%; height:100%; box-sizing:border-box; padding:var(--matte); border-radius:9px; background: " + NOISE + ", linear-gradient(180deg,#f8f3e8 0%,#ebe2cf 100%); box-shadow: 0 0 0 2px rgba(0,0,0,.6), inset 0 2px 8px rgba(0,0,0,.08), inset 0 -2px 8px rgba(0,0,0,.05); }" +
    "#dragonScreenOverlay.dragon-ss-framed #dragonScreenImgA, #dragonScreenOverlay.dragon-ss-framed #dragonScreenImgB { top:var(--matte); left:var(--matte); width:calc(100% - var(--matte) - var(--matte)); height:calc(100% - var(--matte) - var(--matte)); border-radius:4px; box-shadow: inset 0 0 0 1px rgba(0,0,0,.14), inset 0 2px 5px rgba(0,0,0,.3), inset 0 8px 18px rgba(0,0,0,.16), inset 0 -4px 14px rgba(0,0,0,.16); }" +
    "#dragonScreenOverlay.dragon-ss-framed #dragonScreenClock { display:block; position:absolute; left:0; right:0; bottom:clamp(3.4rem, 11.5vh, 6rem); text-align:center; z-index:3; }" +
    "#dragonScreenOverlay.dragon-ss-framed #dragonScreenClockTxt { display:inline-block; background:linear-gradient(180deg,rgba(24,21,14,.78),rgba(10,9,6,.6)); border:1px solid rgba(255,255,255,.12); border-top:2px solid rgba(255,255,255,.16); border-bottom:3px solid rgba(0,0,0,.55); border-radius:16px; padding:.2rem 1.6rem .35rem; color:var(--dt-accent,#e0244c); font-size:clamp(2.2rem, 7vh, 4.4rem); font-weight:600; letter-spacing:.16em; text-shadow:0 3px 22px rgba(0,0,0,.65); box-shadow: inset 0 1px 0 rgba(255,255,255,.1), 0 10px 20px rgba(0,0,0,.5); font-variant-numeric:tabular-nums; }" +
    // GONE from BOTH presentations (markup, CSS and the ticker that filled it). It used to let a visitor
    // name a landscape they disliked ("delete №37"); the pool is now reviewed through the normal
    // `window.dragonScreenImages` list instead. The retired code is stored in src/Librarybook.enc → DEPO.
    "#dragonScreenOverlay.dragon-ss-framed #dragonScreenHint { text-transform:uppercase; letter-spacing:.08em; }";
  document.head.appendChild(ssCssEl);
  ;function applyFrameClass(){
    var o = overlayEl();
    if(!o) return;
    o.classList.toggle("dragon-ss-framed", ssStyle === "v2");
  }
  window.dragonScreenStyleGet = function(){ return ssStyle; };
  // cover image, the look agenty's screen saver uses), "v2" = FRAMED (matte + accent frame + clock, the
  // default since 12.09). "full"/"frame" are accepted as readable aliases; the choice is remembered.
  window.dragonScreenStyleSet = function(s){
    ssStyle = (s === "v1" || s === "full") ? "v1" : "v2";
    try { localStorage.dragonScreenStyle = ssStyle; } catch(e) {}
    applyFrameClass();
    try { if (window.dragonSyncSsStyleBtn) window.dragonSyncSsStyleBtn(); } catch (e) {}
    return ssStyle;
  };
  window.dragonScreenStyleToggle = function(){ return window.dragonScreenStyleSet(ssStyle === "v2" ? "v1" : "v2"); };
  ;function enabled(){ return localStorage.dragonScreenSaver !== "off"; }
  window.dragonScreenOn = function(){ return enabled(); };
  window.dragonScreenSet = function(on){
    try { localStorage.dragonScreenSaver = on ? "on" : "off"; } catch(e) {}
    if(!on && visible) hideOverlay();
    else if(on) resetIdle();
  };
  window.dragonScreenIntervalGet = function(){ return Math.round(IDLE_MS/1000); };
  window.dragonScreenIntervalSet = function(sec){
    sec = Number(sec);
    if(!(sec >= 5 && sec <= 3600)) return false;
    IDLE_MS = sec*1000;
    try { localStorage.dragonScreenInterval = String(sec); } catch(e) {}
    resetIdle();
    return true;
  };
  ;function overlayEl(){ return document.getElementById("dragonScreenOverlay"); }
  ;function overlayVisible(){ var o = overlayEl(); return !!o && o.style.display === "flex"; }
  ;function ssRainyOn(){ try { return localStorage.dragonSsRainy === "on"; } catch (e) { return false; } }
  window.dragonSsRainyGet = ssRainyOn;
  window.dragonSsRainySet = function (on) {
    try { localStorage.dragonSsRainy = on ? "on" : "off"; } catch (e) {}
    try { if (window.dragonSyncSsRainBtn) window.dragonSyncSsRainBtn(); } catch (e) {}
    // If the saver is showing right now, honour the change immediately.
    if (overlayVisible()) { if (on) { showOverlay2Refresh(); ssRainStart(); } else { ssRainStop(); } }
    return ssRainyOn();
  };
  window.dragonSsRainyToggle = function () { return window.dragonSsRainySet(!ssRainyOn()); };
  // Re-roll the picture from the newly active pool without touching visibility/cycle state.
  ;function showOverlay2Refresh(){
    var urls = ssActivePool();
    if (!urls.length) return;
    var i = Math.floor(Math.random() * urls.length);
    if (urls.length > 1 && i === ssCurrentIdx) i = (i + 1) % urls.length;
    ssShowIndex(i);
  }
  ;function ssActivePool(){
    var rainy = window.dragonScreenRainyImages || [];
    if (ssRainyOn() && rainy.length) return rainy;
    return window.dragonScreenImages || [];
  }
  // The plugin's #rainContainer is created with z-index 1000000, which is BELOW the overlay
  // (2147483647) — raise it inline (inline beats the plugin's own stylesheet) so the drops fall
  // over the picture. The container is appended to <body> when the rain starts, i.e. after the
  // overlay element, so an equal z-index would also be enough, but the inline z-index makes it
  // independent of DOM order.
  ;function ssRainStart(){
    if (!ssRainyOn()) return;
    try {
      if (root && root.powerRain) {
        var running = false;
        try { running = !!root.powerRain("running"); } catch (e2) {}
        if (!running) root.powerRain({ intensity: 45, speed: 1.2, weight: 46, angle: 8, color: "#9fd6ff70" });
      }
      var rc = document.getElementById("rainContainer");
      if (rc) rc.style.zIndex = "2147483647";
    } catch (e) {}
  }
  ;function ssRainStop(){
    try { if (root && root.powerRain && root.powerRain("running")) root.powerRain("stop"); } catch (e) {}
    try { var rc = document.getElementById("rainContainer"); if (rc && rc.parentNode) rc.parentNode.removeChild(rc); } catch (e) {}
  }
  window.dragonSsRainStart = ssRainStart;
  window.dragonSsRainStop = ssRainStop;
  var rainBtn = null;
  ;function syncRainBtn(){
    if(!rainBtn) return;
    var on = ssRainyOn();
    // needed 96px of label room and fit with ZERO margin (measured: scrollWidth 118 = clientWidth 118 —
    // one font metric away from a clipped label). "🌧 Rainy: On" keeps the meaning and leaves ~28px of
    // slack, so the small standard can never cut a saver label again. The tooltip still spells it out.
    rainBtn.textContent = "\uD83C\uDF27 Rainy: " + (on ? "On" : "Off");
    rainBtn.title = on
      ? "Screen saver plays RAINY landscapes with a falling-rain layer \u2014 click to switch back to the normal warm pool"
      : "Screen saver plays the normal landscapes \u2014 click to make it rainy: only rain/fog/storm pictures plus a falling-rain layer";
    rainBtn.setAttribute("data-on", on ? "1" : "0");
    rainBtn.style.border = "1px solid " + (on ? "#4ade80" : "#7a7a8c");
    rainBtn.style.background = on ? "linear-gradient(180deg,#14532d,#052e16)" : "linear-gradient(180deg,#1a1a20,#3a3a44)";
    rainBtn.style.color = on ? "#bbf7d0" : "#ddd";
    rainBtn.style.boxShadow = on ? "0 0 8px #4ade8088" : "none";
  }
  window.dragonSyncSsRainBtn = syncRainBtn;
  window.dragonBuildSsRainBtn = function(){
    if(rainBtn){ syncRainBtn(); return rainBtn; }
    rainBtn = document.createElement("button");
    rainBtn.type = "button";
    rainBtn.id = "dragonSsRainBtn";
    rainBtn.className = "dragon-living-btn dragon-ss-rain";
    rainBtn.style.cssText = "display:block; margin:.28rem auto 0; flex:0 0 auto; padding:.24rem .62rem; font-size:.72rem; font-weight:bold; border-radius:8px; cursor:pointer; white-space:nowrap;";
    rainBtn.onclick = function(e){
      e.stopPropagation();
      var on = window.dragonSsRainyToggle();
      syncRainBtn();
      if(window.dragonToast) dragonToast("\uD83C\uDF27 Rainy screen saver: " + (on ? "On" : "Off"));
    };
    syncRainBtn();
    return rainBtn;
  };
  var styleBtn = null;
  ;function syncStyleBtn(){
    if(!styleBtn) return;
    var full = (ssStyle === "v1");
    styleBtn.textContent = full ? "\u26F6 Screen Saver: v2 (fullscreen)" : "\uD83D\uDDBC\uFE0F Screen Saver: v1 (framed)";
    styleBtn.title = full
      ? "Screen saver v2 \u2014 the FULLSCREEN look: the landscape fills the whole screen. Click to go back to v1, the current look (framed picture with the clock)."
      : "Screen saver v1 \u2014 the current look: the landscape sits in a matte frame with the clock. Click for v2, the FULLSCREEN look (landscape fills the whole screen).";
    styleBtn.setAttribute("data-on", full ? "1" : "0");
  }
  window.dragonSyncSsStyleBtn = syncStyleBtn;
  window.dragonBuildSsStyleBtn = function(){
    if(styleBtn){ syncStyleBtn(); return styleBtn; }
    styleBtn = document.createElement("button");
    styleBtn.type = "button";
    styleBtn.id = "dragonSsStyleBtn";
    styleBtn.className = "dragon-living-btn dragon-ss-style";
    styleBtn.style.cssText = "display:block; margin:.24rem auto 0; flex:0 0 auto; padding:.24rem .62rem; font-size:.72rem; font-weight:bold; border-radius:8px; cursor:pointer; white-space:nowrap;";
    styleBtn.onclick = function(e){
      e.stopPropagation();
      var full = window.dragonScreenStyleToggle() === "v1";
      syncStyleBtn();
      if(window.dragonToast) dragonToast("\uD83D\uDDBC\uFE0F Screen saver: " + (full ? "v2 \u2014 fullscreen" : "v1 \u2014 framed"));
    };
    syncStyleBtn();
    return styleBtn;
  };
  // Egon 01.10.2026 — PRELOAD-FIRST: the overlay used to receive its <img> src the same moment it
  // appeared, so the first frame was a loading/broken icon until the download finished (and a 1.5s
  // fallback started the fade even when nothing had arrived yet). A picture is now NEVER painted before
  // it is decoded: it is fetched with a detached Image first and only then handed to the visible <img>
  // (already in the HTTP cache, so it paints instantly). While the saver is up the old picture simply
  // stays until the next one is ready; the saver itself opens only once its first picture is ready
  // (bounded wait, so it can never get stuck while offline).
  var ssPreImg = null;  // the in-flight / last-finished preload (kept, so it is never GC'd mid-load)
  var ssPreUrl = "";    // which URL ssPreImg belongs to
  var ssNextIdx = -1;   // primed during idle: the picture the next opening will most likely show
  var ssPrimeAt = 0;    // last idle-prime time (throttled: at most one extra download per 30s of idle)
  ;function ssPreload(u, cb, ms){
    var done = false;
    var timer = null;
    var go = function(ok){ if(done) return; done = true; try{ clearTimeout(timer); }catch(e){} try{ cb(ok); }catch(e){} };
    try {
      var im = new Image();
      im.decoding = "async";
      im.onload = function(){ go(true); };
      im.onerror = function(){ go(false); };
      im.src = u;
      ssPreImg = im; ssPreUrl = u;
    } catch(e){ go(false); return; }
    timer = setTimeout(function(){ go(false); }, (ms > 0) ? ms : 8000);
  }
  ;function ssPreloadedOk(u){
    try { return u === ssPreUrl && ssPreImg && ssPreImg.complete && ssPreImg.naturalWidth > 0; } catch(e){ return false; }
  }
  // Prime ONE upcoming picture: the next opening or crossfade then usually finds its image already
  // cached. Called while idle (throttled) and after every painted crossfade.
  ;function ssPrimeOne(){
    try {
      var urls = ssActivePool();
      if(!urls.length) return;
      var i = Math.floor(Math.random()*urls.length);
      if(urls.length > 1 && i === ssCurrentIdx) i = (i + 1) % urls.length;
      ssNextIdx = i;
      var u = urls[i % urls.length];
      if(ssPreloadedOk(u)) return;
      ssPreload(u, function(){}, 8000);
    } catch(e){}
  }
  ;function ssPrimeIdle(){
    try {
      var now = Date.now();
      if(now - ssPrimeAt < 30000) return;
      if(ssPreImg && !ssPreImg.complete) return;   // a fetch is already running: do not pile on
      ssPrimeAt = now;
      ssPrimeOne();
    } catch(e){}
  }
  ;function ssPaintIndex(i, instant){
    var urls = ssActivePool();
    if(!urls.length) return;
    var a = document.getElementById("dragonScreenImgA");
    var b = document.getElementById("dragonScreenImgB");
    if(!a || !b) return;
    if(ssTop == null){ ssTop = a; ssTop.style.transition = "none"; ssTop.style.opacity = "1"; b.style.transition = "none"; b.style.opacity = "0"; }
    var incoming = (ssTop === a) ? b : a;
    var outgoing = ssTop;
    var u = urls[i % urls.length];
    incoming.style.transition = "none";
    if(instant){
      incoming.style.opacity = "1";
      if(outgoing && outgoing !== incoming) outgoing.style.opacity = "0";
      ssTop = incoming;
    } else {
      incoming.style.opacity = "0";
      var t0 = performance.now();
      var DUR = 600;
      (function step(){
        var p = Math.min(1, (performance.now() - t0)/DUR);
        incoming.style.opacity = String(p);
        if(outgoing && outgoing !== incoming) outgoing.style.opacity = String(1 - p);
        if(p < 1){ setTimeout(step, 33); }
        else { ssTop = incoming; }
      })();
    }
    incoming.src = u;   // cached by the preload above: paints instantly, never a broken frame
    ssCurrentIdx = i;
    // into the overlay any more. `ssCurrentIdx` is still tracked (the crossfade uses it to avoid repeating
    // the same landscape twice in a row).
  }
  // Crossfade while the saver is already up: the old picture stays until the new one is decoded.
  ;function ssEnsureShow(i, triesLeft){
    var urls = ssActivePool();
    if(!urls.length) return;
    var u = urls[i % urls.length];
    if(ssPreloadedOk(u)){ ssPaintIndex(i, false); ssPrimeOne(); return; }
    ssPreload(u, function(ok){
      if(!overlayVisible()) return;   // dismissed while fetching: leave the old frame alone
      if(ok){ ssPaintIndex(i, false); ssPrimeOne(); return; }
      if(triesLeft > 0 && urls.length > 1){
        var j = Math.floor(Math.random()*urls.length);
        if(j === i) j = (j + 1) % urls.length;
        ssEnsureShow(j, triesLeft - 1);
        return;
      }
      // every candidate failed (offline): keep the current picture, never a broken frame.
    }, 8000);
  }
  ;function ssShowIndex(i){
    ssEnsureShow(i, 3);
  }
  ;function startCycle(){
    stopCycle();
    cycleTimer = setInterval(function(){
      var urls = ssActivePool();
      if(urls.length < 2 || !overlayVisible()) return;
      var i = Math.floor(Math.random()*urls.length);
      if(urls.length > 1 && i === ssCurrentIdx) i = (i + 1 + Math.floor(Math.random()*(urls.length-1))) % urls.length;
      ssShowIndex(i);
    }, ssCycle * 1000);
  }
  ;function stopCycle(){ if(cycleTimer){ clearInterval(cycleTimer); cycleTimer = null; } }
  ;function showOverlay(){
    if(!enabled()) return;
    var o = overlayEl();
    if(!o || overlayVisible()) return;
    var urls = ssActivePool();
    if(!urls.length) return;
    var i = (ssNextIdx >= 0 && ssNextIdx < urls.length) ? ssNextIdx : Math.floor(Math.random()*urls.length);
    if(urls.length > 1 && i === ssCurrentIdx) i = (i + 1) % urls.length;
    var u = urls[i % urls.length];
    var open = function(idx){
      if(!enabled() || overlayVisible()) return;
      o.style.display = "flex";
      applyFrameClass();
      if(idx >= 0) ssPaintIndex(idx, true);   // instant: the image is decoded, no broken first frame
      startCycle();
      startClock();
      ssRainStart();
      visible = true;
      ssPrimeOne();
    };
    if(ssPreloadedOk(u)){ open(i); return; }
    // Cold start (nothing primed yet): fetch first, open the moment it is ready. Bounded retries,
    // then open anyway — a clock on black still beats no privacy screen while offline.
    var tries = 2;
    (function attempt(j){
      ssPreload(urls[j % urls.length], function(ok){
        if(!enabled() || overlayVisible()) return;
        if(ok){ open(j); return; }
        if(tries-- > 0 && urls.length > 1){ attempt((j + 1 + Math.floor(Math.random()*(urls.length-1))) % urls.length); return; }
        open(-1);
      }, 6000);
    })(i);
  }
  var clockTimer = null;
  ;function updateClock(){
    var el = document.getElementById("dragonScreenClockTxt") || document.getElementById("dragonScreenClock");
    if(!el) return;
    el.textContent = new Date().toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"});
  }
  ;function startClock(){ stopClock(); updateClock(); clockTimer = setInterval(updateClock, 10000); }
  ;function stopClock(){ if(clockTimer){ clearInterval(clockTimer); clockTimer = null; } }
  ;function hideOverlay(){
    if(visible){
      visible = false;
      ssRainStop();
      stopCycle();
      stopClock();
      var o = overlayEl();
      if(o) o.style.display = "none";
    }
    resetIdle();
  }
  ;function resetIdle(){
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function(){ if(enabled() && !overlayVisible()) showOverlay(); }, IDLE_MS);
    try { ssPrimeIdle(); } catch(e){}   // Egon 01.10.2026 — fetch one upcoming picture while idle (throttled), so the opening usually finds it cached
  }
  window.activateScreensaver = function(){ showOverlay(); };
  applyFrameClass();
  // catch its clicks are gone; see the note in the overlay markup above.
  var ssEvents = ["mousemove","mousedown","touchstart","touchmove","keydown","wheel","click"];
  for(var i=0;i<ssEvents.length;i++) window.addEventListener(ssEvents[i], function(e){
    if(overlayVisible()) hideOverlay(); else resetIdle();
  }, {capture:true, passive:true});
  resetIdle();
  window.__screensaverFireIdle = showOverlay; // test hook
  window.__screensaverCycle = startCycle; // test hook
})();
