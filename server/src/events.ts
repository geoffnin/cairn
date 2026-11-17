// Click events: one structured log line per go-link visit.
//
// Cloudflare captures console.log output from the Worker, keeps it in Workers Logs (queryable
// in the dashboard), and can forward it to any OpenTelemetry logs endpoint. Configure that with
// `observability.logs.destinations` in wrangler.jsonc. The Worker therefore sends nothing
// itself: no exporter code, no credentials, no outbound request per click. Counting, grouping
// and charting happen in whatever platform receives the logs.
//
// Fields are flat, dotted keys in OpenTelemetry attribute style so they stay queryable however
// the platform maps the object (attributes, or a JSON body it parses).

export const CLICK_EVENT = "cairn.link.click";

export interface ClickEvent {
  "event.name": typeof CLICK_EVENT;
  /** The name as requested, lowercased. */
  "link.slug": string;
  /** false when nobody owns this name yet: people tried it and were sent to the create form. */
  "link.found": boolean;
  /** Host of the destination, never the full URL (paths and query strings can be sensitive). */
  "link.target_host"?: string;
  /** Whether text after the name was passed through (go/bug/ABC-12). */
  "link.passthrough": boolean;
  /** "extension" when the browser extension's sign-in was used, otherwise "browser". */
  "client.kind": "extension" | "browser";
  /** Two-letter country of the visitor, from Cloudflare. */
  "client.country"?: string;
}

export function clickEvent(
  req: Request,
  slug: string,
  found: boolean,
  destination: string | null,
  passthrough: boolean,
): ClickEvent {
  const event: ClickEvent = {
    "event.name": CLICK_EVENT,
    "link.slug": slug,
    "link.found": found,
    "link.passthrough": passthrough,
    "client.kind": /^Bearer\s/i.test(req.headers.get("authorization") ?? "") ? "extension" : "browser",
  };
  if (destination) {
    try {
      event["link.target_host"] = new URL(destination).host;
    } catch {
      /* leave it out */
    }
  }
  const country = (req as Request & { cf?: { country?: unknown } }).cf?.country;
  if (typeof country === "string") event["client.country"] = country;
  return event;
}

/** Emits the event. A single object argument, so Workers Logs indexes each field. */
export function logClick(event: ClickEvent): void {
  console.log(event);
}

/** Where "see metrics" for a link should go, from METRICS_DASHBOARD_URL ("{slug}" is substituted). */
export function metricsUrl(env: { METRICS_DASHBOARD_URL?: string }, slug: string): string | null {
  const template = env.METRICS_DASHBOARD_URL?.trim();
  if (!template) return null;
  const url = template.replaceAll("{slug}", encodeURIComponent(slug));
  return /^https?:\/\//i.test(url) ? url : null;
}
