// Structured events: one log line per go-link visit, and one per change to a link.
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
export const CREATE_EVENT = "cairn.link.create";
export const UPDATE_EVENT = "cairn.link.update";
export const DELETE_EVENT = "cairn.link.delete";

/** API writes from the extension's popup carry its chrome-extension:// origin. */
const clientKind = (req: Request): "extension" | "browser" =>
  (req.headers.get("origin") ?? "").startsWith("chrome-extension://") ? "extension" : "browser";

function hostOf(url: string): string | undefined {
  try {
    return new URL(url.replaceAll("{*}", "x")).host;
  } catch {
    return undefined;
  }
}

/** Drops undefined fields so every logged key has a value. */
function compact<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

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
  };
  const host = destination ? hostOf(destination) : undefined;
  if (host) event["link.target_host"] = host;
  const country = (req as Request & { cf?: { country?: unknown } }).cf?.country;
  if (typeof country === "string") event["client.country"] = country;
  return event;
}

// ---- link lifecycle ----
//
// Unlike clicks, these record who acted: changes to shared links are worth an audit trail.
// People appear only as opaque IDs (user.id, link.owner_id); the email for an ID lives in Cairn's
// users table and nowhere in the logs. Destinations are still reduced to their host.

interface LinkFields {
  url: string;
  description: string;
  owner_id: string;
}

export interface LinkChangeEvent {
  "event.name": typeof CREATE_EVENT | typeof UPDATE_EVENT | typeof DELETE_EVENT;
  "link.slug": string;
  /** ID of the owner after the change (for delete: the owner it had). */
  "link.owner_id": string;
  "link.target_host"?: string;
  "link.has_description": boolean;
  /** Whether the destination contains the {*} pass-through placeholder. */
  "link.has_placeholder": boolean;
  /** Update only: comma-separated names of the fields that changed, e.g. "owner,url". */
  "link.changed"?: string;
  /** Update only, when the destination changed. */
  "link.previous_target_host"?: string;
  /** Update only, when ownership was handed over: the previous owner's ID. */
  "link.previous_owner_id"?: string;
  /** ID of who made the change. */
  "user.id": string;
  /** True when an admin changed someone else's link. */
  "user.admin_override": boolean;
  /** "extension" when made from the extension's popup, otherwise "browser". */
  "client.kind": "extension" | "browser";
}

function lifecycleEvent(
  name: LinkChangeEvent["event.name"],
  req: Request,
  actorId: string,
  slug: string,
  link: LinkFields,
  ownerIdBefore: string,
): LinkChangeEvent {
  return compact({
    "event.name": name,
    "link.slug": slug,
    "link.owner_id": link.owner_id,
    "link.target_host": hostOf(link.url),
    "link.has_description": link.description !== "",
    "link.has_placeholder": link.url.includes("{*}"),
    "user.id": actorId,
    "user.admin_override": actorId !== ownerIdBefore,
    "client.kind": clientKind(req),
  });
}

export function linkCreated(req: Request, actorId: string, slug: string, link: LinkFields): LinkChangeEvent {
  return lifecycleEvent(CREATE_EVENT, req, actorId, slug, link, link.owner_id);
}

/** Returns null when nothing actually changed, so no-op saves are not logged. */
export function linkUpdated(
  req: Request,
  actorId: string,
  slug: string,
  before: LinkFields,
  after: LinkFields,
): LinkChangeEvent | null {
  const fields = { description: "description", owner_id: "owner", url: "url" } as const;
  const changed = (Object.keys(fields) as (keyof typeof fields)[]).filter((k) => before[k] !== after[k]).map((k) => fields[k]);
  if (!changed.length) return null;
  return compact({
    ...lifecycleEvent(UPDATE_EVENT, req, actorId, slug, after, before.owner_id),
    "link.changed": changed.join(","),
    "link.previous_target_host": before.url !== after.url ? hostOf(before.url) : undefined,
    "link.previous_owner_id": before.owner_id !== after.owner_id ? before.owner_id : undefined,
  });
}

export function linkDeleted(req: Request, actorId: string, slug: string, link: LinkFields): LinkChangeEvent {
  return lifecycleEvent(DELETE_EVENT, req, actorId, slug, link, link.owner_id);
}

/** Emits an event. A single object argument, so Workers Logs indexes each field. */
export function logEvent(event: ClickEvent | LinkChangeEvent | null): void {
  if (event) console.log(event);
}

/** Where "see metrics" for a link should go, from METRICS_DASHBOARD_URL ("{slug}" is substituted). */
export function metricsUrl(env: { METRICS_DASHBOARD_URL?: string }, slug: string): string | null {
  const template = env.METRICS_DASHBOARD_URL?.trim();
  if (!template) return null;
  const url = template.replaceAll("{slug}", encodeURIComponent(slug));
  return /^https?:\/\//i.test(url) ? url : null;
}
