// Pass-through destinations: {*} in a destination takes whatever follows the name, so
// https://docs.example.com/rfcs/{*} makes go/rfc/7 open …/rfcs/7. When the page being linked ends
// in an ID, the popup offers to turn that ID into {*}.

export const PASS_THROUGH = "{*}";

/** The last path segment, when it looks like an ID: a number ("0042"), a key ("ABC-12") or a hash. */
export function suggestPassThrough(url: string): { template: string; token: string } | null {
  if (url.includes(PASS_THROUGH)) return null;
  const m = /^(https?:\/\/[^/?#]+(?:\/[^/?#]*)*\/)([^/?#]*\d[^/?#]*)(\/?)(?:[?#].*)?$/i.exec(url);
  if (!m) return null;
  const [, head, token, slash] = m as unknown as [string, string, string, string];
  if (!/^(\d+|[a-z]+-\d+|[0-9a-f]{8,}|[0-9a-f-]{36})$/i.test(token)) return null;
  return { template: `${head}${PASS_THROUGH}${slash}`, token };
}

/** Fills {*} the way the server does. */
export const fillPassThrough = (template: string, rest: string) => template.replaceAll(PASS_THROUGH, rest);

/**
 * The two examples under the field: this page's own ID, and another one, with where it goes.
 * go/rfc/0042 opens this page; go/rfc/7 opens …/rfcs/7.
 */
export function passThroughExamples(slug: string, template: string, token: string) {
  const other = /^\d+$/.test(token) ? "7" : "other";
  const dest = fillPassThrough(template, other).replace(/^https?:\/\/[^/]+/i, "");
  const tail = dest.split("/").filter(Boolean).slice(-2).join("/");
  return { mine: `${slug}/${token}`, other: `${slug}/${other}`, otherDest: `…/${tail}` };
}
