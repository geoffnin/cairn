// Go-link rules shared by local mode. These mirror the server's (server/src/links.ts) so a link
// behaves the same whether it lives in this browser or on a Cairn server.

export const PLACEHOLDER = "{*}";
const SLUG_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/;

export class ValidationError extends Error {}

export function normalizeSlug(raw) {
  const slug = String(raw ?? "").trim().toLowerCase();
  if (!SLUG_RE.test(slug)) {
    throw new ValidationError("Name must be 1-64 characters: letters, digits, '-', '_' or '.', starting with a letter or digit.");
  }
  return slug;
}

export function validateUrl(raw) {
  const url = String(raw ?? "").trim();
  if (!url || url.length > 2048) throw new ValidationError("URL is required (max 2048 characters).");
  let parsed;
  try {
    parsed = new URL(url.replaceAll(PLACEHOLDER, "x"));
  } catch {
    throw new ValidationError("URL is not valid. Include the scheme, e.g. https://example.com/page");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new ValidationError("Only http:// and https:// URLs are allowed.");
  }
  return url;
}

export function validateDescription(raw) {
  const d = String(raw ?? "").trim();
  if (d.length > 500) throw new ValidationError("Description is too long (max 500 characters).");
  return d;
}

/**
 * Build the final destination for go/<slug>/<rest>?<query>.
 * - {*} in the target is replaced by <rest> (URL-encoded when it lands in the query string).
 * - Without a placeholder, <rest> is appended to the target's path.
 * - Request query parameters are appended to the target's.
 */
export function resolveTarget(target, rest, search) {
  let out = target;
  if (target.includes(PLACEHOLDER)) {
    const q = target.indexOf("?");
    let decoded = rest;
    try {
      decoded = decodeURIComponent(rest);
    } catch {
      /* keep raw */
    }
    const forQuery = encodeURIComponent(decoded);
    out = target.replaceAll(PLACEHOLDER, (_m, offset) => (q !== -1 && offset > q ? forQuery : rest));
    rest = "";
  }
  if (!rest && search.length <= 1) return out;
  const url = new URL(out);
  if (rest) url.pathname = `${url.pathname.replace(/\/$/, "")}/${rest}`;
  for (const [k, v] of new URLSearchParams(search)) url.searchParams.append(k, v);
  return url.toString();
}

/** Splits what followed "go/" ("bug/ABC-12?x=1") into slug, rest and query string. */
export function parseGoPath(pathAndQuery) {
  const q = pathAndQuery.indexOf("?");
  const path = q === -1 ? pathAndQuery : pathAndQuery.slice(0, q);
  const search = q === -1 ? "" : pathAndQuery.slice(q);
  const cut = path.indexOf("/");
  const rawSlug = cut === -1 ? path : path.slice(0, cut);
  let slug = rawSlug;
  try {
    slug = decodeURIComponent(rawSlug);
  } catch {
    /* keep raw */
  }
  return { slug: slug.toLowerCase(), rest: cut === -1 ? "" : path.slice(cut + 1), search };
}
