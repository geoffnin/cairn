import type { Preview } from "@storybook/svelte-vite";
import "../ui/src/styles/global.css";

// Theme and density are set on <html>, as the apps do, so stories render with the real tokens.
const preview: Preview = {
  globalTypes: {
    theme: {
      description: "Colour theme",
      toolbar: { title: "Theme", icon: "mirror", items: ["light", "dark"], dynamicTitle: true },
    },
    density: {
      description: "Density",
      toolbar: { title: "Density", icon: "component", items: ["compact", "default", "comfortable"], dynamicTitle: true },
    },
  },
  initialGlobals: { theme: "light", density: "default" },
  decorators: [
    (_story, { globals }) => {
      document.documentElement.dataset.theme = globals.theme ?? "light";
      document.documentElement.dataset.density = globals.density ?? "default";
      return _story();
    },
  ],
  // A play function's click is synthetic, so Chrome treats the focus it leaves on a button as
  // keyboard focus and draws the ring, which a real click never shows. Let go of it once the
  // story has played, so the story rests as people see it.
  afterEach: () => {
    if (document.activeElement instanceof HTMLButtonElement) document.activeElement.blur();
  },
  parameters: {
    layout: "padded",
    backgrounds: { disable: true },
    // Accessibility violations fail the story's test.
    a11y: { test: "error" },
    options: {
      storySort: { order: ["Foundations", "Primitives", "Parts", "Sections", "Journeys"] },
    },
  },
};
export default preview;
