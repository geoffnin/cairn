// Local mode resolver. The redirect rule sends go/<path> here as go.html#<path>.
import { parseGoPath, resolveTarget } from "./golinks.js";
import { getLink } from "./local.js";

const { slug, rest, search } = parseGoPath(location.hash.slice(1));
const link = slug ? await getLink(slug) : null;
if (link) {
  location.replace(resolveTarget(link.url, rest, search));
} else {
  // Unknown name (or bare go/): offer to create it, as the server does.
  location.replace(slug ? `links.html?new=${encodeURIComponent(slug)}` : "links.html");
}
