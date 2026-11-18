// Local mode resolver. The redirect rule sends go/<path> here as go.html#<path>.
// The search rule sends a web search for "go/<path>" here as go.html?search=<path, URL-encoded>;
// that one goes on to http://go/<path>, which the redirect rule sends wherever links live.
// Any site can link to go/ (so the page is web-accessible to all of them), but none may run it
// in a frame: it only ever handles a top-level navigation, like the link itself.
import "@cairn/ui/styles/global.css";
import { omniboxPath, parseGoPath, resolveTarget } from "../golinks.js";
import { getLink } from "../local.js";

const searched = new URLSearchParams(location.search).get("search");

if (window.top !== window) {
  // Framed: do nothing.
} else if (searched !== null) {
  location.replace(`http://go/${omniboxPath(searched)}`);
} else {
  const { slug, rest, search } = parseGoPath(location.hash.slice(1));
  const link = slug ? await getLink(slug) : null;
  if (link) {
    location.replace(resolveTarget(link.url, rest, search));
  } else {
    // Unknown name (or bare go/): offer to create it, as the server does.
    location.replace(slug ? `links.html?new=${encodeURIComponent(slug)}` : "links.html");
  }
}
