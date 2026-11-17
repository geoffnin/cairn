// Applies the reader's theme and density (chosen on the settings page) before first paint.
// A classic script in <head>, not a module, so it runs before the body renders.
// Extension pages share one origin, so localStorage reaches them all synchronously.
(() => {
  let prefs = {};
  try {
    prefs = JSON.parse(localStorage.getItem("cairn.display")) || {};
  } catch {}
  const html = document.documentElement;
  if (prefs.theme === "light" || prefs.theme === "dark") html.dataset.theme = prefs.theme;
  // A page that fixes its own density (the popup is always compact) keeps it.
  if (!html.dataset.density && (prefs.density === "compact" || prefs.density === "comfortable")) html.dataset.density = prefs.density;
})();
