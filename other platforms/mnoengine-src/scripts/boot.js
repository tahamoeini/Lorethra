// Page boot: exposes the Perchance plugin references on `window` for the ES modules under
// src/scripts/ (modules and src/ files can't see the engine's bare globals, so we read them off
// `root`). Loaded as a classic script in index.html BEFORE main.js (classic scripts run during
// parse, modules are deferred), so `window.genText` & co. are ready when the modules evaluate.

window.genText = root.generateText;
window.genImage = root.generateImage;
window.kv = root.kv;
window.uploadPlugin = root.uploadPlugin;
window.createServerSocket = root.createServerSocket;
window.commentsPlugin = root.commentsPlugin;

// Install prompt, captured EARLY (this classic script runs during parse, before the deferred
// modules). The platform bridge re-dispatches the parent's `beforeinstallprompt` as a synthetic
// event on this window — but the shim drops repeat eventIds, so a dispatch that arrives before
// any listener exists is lost for good. An inline-script listener (like the
// installable-app-demo's) always wins that race; a deferred-module listener often loses it after
// a cold boot. Stash the event here so the footer button can use it whenever it mounts.
window.__mnoInstallEvent = null;
window.addEventListener("beforeinstallprompt", function (e) {
  try { e.preventDefault(); } catch (err) {}
  window.__mnoInstallEvent = e;
});
window.addEventListener("appinstalled", function () { window.__mnoInstallEvent = null; });

// Fill the boot splash title from $meta (runs synchronously during parse, so first paint already
// shows the right brand; the static HTML text is only the fallback).
try {
  var __bsTitle = document.querySelector("#bootSplash .bs-title");
  if (__bsTitle && root && root.$meta && root.$meta.title) __bsTitle.textContent = root.$meta.title.evaluateItem || __bsTitle.textContent;
} catch (e) {}
