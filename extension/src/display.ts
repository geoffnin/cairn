// Theme and density, chosen on the settings page. Stored in localStorage, which every extension
// page shares, so public/display.js can apply them before first paint.
export type Theme = "system" | "light" | "dark";
export type Density = "compact" | "default" | "comfortable";
export interface Display {
  theme: Theme;
  density: Density;
}

const KEY = "cairn.display";
const DEFAULTS: Display = { theme: "system", density: "default" };

export function readDisplay(): Display {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveDisplay(display: Display) {
  try {
    localStorage.setItem(KEY, JSON.stringify(display));
  } catch {
    /* storage off: it still applies to this page */
  }
  applyDisplay(display);
}

export function applyDisplay({ theme, density }: Display) {
  const html = document.documentElement;
  if (theme === "system") delete html.dataset.theme;
  else html.dataset.theme = theme;
  if (density === "default") delete html.dataset.density;
  else html.dataset.density = density;
}

/** Another settings tab changed them. */
export function onDisplayChange(callback: (display: Display) => void): () => void {
  const listener = (e: StorageEvent) => e.key === KEY && callback(readDisplay());
  window.addEventListener("storage", listener);
  return () => window.removeEventListener("storage", listener);
}
