// How Cairn writes numbers, dates, people and URLs in lists, where space is short. Dates are
// formatted in UTC so a page reads the same everywhere (and in tests).

const counts = new Intl.NumberFormat("en-US");
/** 1204 → "1,204". */
export const formatCount = (n: number) => counts.format(n);

const monthDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const monthDayYear = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const weekdayMonthDay = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

const toDate = (d: Date | string) => (typeof d === "string" ? new Date(d) : d);

/** "Nov 15", or "Mar 4, 2025" outside the current year. */
export function formatDate(date: Date | string, now: Date = new Date()): string {
  const d = toDate(date);
  return d.getUTCFullYear() === now.getUTCFullYear() ? monthDay.format(d) : monthDayYear.format(d);
}

/** Always with the year: "Mar 4, 2026". */
export const formatFullDate = (date: Date | string) => monthDayYear.format(toDate(date));

/** "Thu, Oct 22". */
export const formatDay = (date: Date | string) => weekdayMonthDay.format(toDate(date));

/**
 * How long ago, for a list's Updated column: "just now", "4 min ago", "3h ago", "2d ago", then
 * the date once it is a week old.
 */
export function formatAgo(date: Date | string, now: Date = new Date()): string {
  const seconds = (now.getTime() - toDate(date).getTime()) / 1000;
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 7 * 86400) return `${Math.floor(seconds / 86400)}d ago`;
  return formatDate(date, now);
}

/** Longer, for a sentence: "4 minutes ago", "1 hour ago", "3 days ago", then the date. */
export function formatAgoLong(date: Date | string, now: Date = new Date()): string {
  const seconds = (now.getTime() - toDate(date).getTime()) / 1000;
  const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"} ago`;
  if (seconds < 60) return "just now";
  if (seconds < 3600) return unit(Math.floor(seconds / 60), "minute");
  if (seconds < 86400) return unit(Math.floor(seconds / 3600), "hour");
  if (seconds < 7 * 86400) return unit(Math.floor(seconds / 86400), "day");
  return formatDate(date, now);
}

/** An owner in a list: "you" for the person looking, else the address up to the @: "sam@". */
export function formatOwner(email: string | undefined, me?: string): string {
  if (!email) return "";
  if (me && email.toLowerCase() === me.toLowerCase()) return "you";
  const at = email.indexOf("@");
  return at > 0 ? email.slice(0, at + 1) : email;
}

/**
 * A URL shortened for a narrow column: the host, then the path with its middle elided when it has
 * more than two segments. "https://docs.example.com/product/plans/q4-planning" →
 * "docs.example.com/…/q4-planning". Query and fragment are dropped. `scheme` keeps "https://".
 * Anything that is not an http(s) URL comes back unchanged.
 */
export function shortUrl(url: string, { scheme = false }: { scheme?: boolean } = {}): string {
  const m = /^(https?:\/\/)([^/?#]+)([^?#]*)/i.exec(url);
  if (!m) return url;
  const [, prefix, host, path] = m as unknown as [string, string, string, string];
  const segments = path.split("/").filter(Boolean);
  const kept = segments.length > 2 ? `/…/${segments.at(-1)}` : segments.length ? `/${segments.join("/")}${path.endsWith("/") ? "/" : ""}` : path;
  return `${scheme ? prefix : ""}${host}${kept}`;
}
