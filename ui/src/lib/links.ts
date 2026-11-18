// What both UIs know about links, and the one seam between them: a LinkSource. The extension's
// local mode keeps links in the browser; the server UI calls the Cairn API. The shared
// components (LinksPage, LinkForm, LinkTable) only ever talk to a LinkSource.

export interface Link {
  slug: string;
  url: string;
  description: string;
  /** Shared servers only. */
  owner?: string;
  rev?: string;
  can_edit?: boolean;
  metrics_url?: string | null;
}

export interface NewLink {
  slug: string;
  url: string;
  description: string;
}

export interface LinkChanges {
  url: string;
  description: string;
  /** Shared servers only. */
  owner?: string;
}

export interface LinkSource {
  /** A shared server: links have owners and edit rights, and "Only mine" filters. */
  readonly shared: boolean;
  list(query: { q: string; mine: boolean }): Promise<Link[]>;
  create(link: NewLink): Promise<Link>;
  update(link: Link, changes: LinkChanges): Promise<void>;
  remove(link: Link): Promise<void>;
  /** Where a link's name points. */
  href(link: Link): string;
  /** Asked before deleting. */
  confirmDelete(link: Link): string;
  /** Calls back when links change elsewhere (another tab, the popup). Returns an unsubscribe. */
  watch?(onChange: () => void): () => void;
}

/** Splits text so every go/name in it can be set in the go-name style. */
export type Segment = { text: string } | { name: string };
const GO_NAME = /\bgo\/([a-z0-9](?:[a-z0-9._-]*[a-z0-9_-])?)/g;

export function goNameSegments(text: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(GO_NAME)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    out.push({ name: m[1]! });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

/** A destination as people read it: scheme dropped, then host and the rest. */
export function splitDestination(url: string): { host: string; rest: string } | null {
  const m = /^https?:\/\/([^/?#]+)(.*)$/i.exec(url);
  return m ? { host: m[1]!, rest: m[2]! } : null;
}

/** One line of feedback; `error` sets it in clay and announces it assertively. */
export interface Message {
  text: string;
  error?: boolean;
}

/** What is known about a name while it is being typed. */
export type NameCheck =
  | { state: "checking" }
  | { state: "free" }
  /** `alternative` is a free name to offer instead. */
  | { state: "taken"; link: Link; alternative?: string };

/** A link with how often it was used in the last 30 days. */
export interface UsedLink extends Link {
  uses: number;
}

/** A row of the server's directory: a used link, and when it last changed (ISO time). */
export interface DirectoryLink extends UsedLink {
  updated: string;
}
