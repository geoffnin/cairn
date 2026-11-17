// Links on this Cairn server, through its API. Same origin, signed in by Cloudflare Access.
import type { Link, LinkSource } from "@cairn/ui/lib/links";

export interface Me {
  email: string;
  isAdmin: boolean;
}

export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/_/api${path}`, {
      method,
      headers: { "content-type": "application/json", "x-cairn-request": "1" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    // Cloudflare Access answers an expired session with a redirect to its login page, which
    // fetch cannot follow across origins.
    throw new Error("Your sign-in has expired. Reload the page to sign in again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

const slugPath = (link: Link) => `/links/${encodeURIComponent(link.slug)}`;

export const serverLinks: LinkSource = {
  shared: true,
  async list({ q, mine }) {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (mine) p.set("owner", "me");
    return (await api<{ links: Link[] }>("GET", `/links?${p}`)).links;
  },
  create: (link) => api<Link>("POST", "/links", link),
  async update(link, changes) {
    await api("PUT", slugPath(link), { ...changes, rev: link.rev });
  },
  async remove(link) {
    await api("DELETE", `${slugPath(link)}?rev=${encodeURIComponent(link.rev ?? "")}`);
  },
  href: (link) => `/${encodeURIComponent(link.slug)}`,
  confirmDelete: (link) => `Delete go/${link.slug}? Anyone using it will land on the "create link" page instead.`,
};
