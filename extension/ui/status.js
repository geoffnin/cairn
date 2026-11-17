// Status lines. go/ names in a message are set as .cn-go (mono, muted prefix), the product's
// signature style, so "Created go/wiki." reads the same here as in the links table.
const GO_NAME = /\bgo\/([a-z0-9](?:[a-z0-9._-]*[a-z0-9_-])?)/g;

export function say(el, text = "", isError = false) {
  const parts = [];
  let last = 0;
  for (const m of text.matchAll(GO_NAME)) {
    const name = Object.assign(document.createElement("span"), { className: "cn-go", textContent: m[1] });
    parts.push(text.slice(last, m.index), name);
    last = m.index + m[0].length;
  }
  parts.push(text.slice(last));
  el.replaceChildren(...parts.filter((p) => p !== ""));
  el.classList.toggle("is-error", isError);
}
