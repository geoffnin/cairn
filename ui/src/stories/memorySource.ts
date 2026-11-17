// Stories only: a LinkSource that keeps links in memory, like the extension's local mode.
import type { Link, LinkSource } from "../lib/links";

export function memorySource(initial: Link[] = [], shared = false): LinkSource {
  const links = new Map(initial.map((l) => [l.slug, { ...l }]));
  return {
    shared,
    async list({ q }) {
      const term = q.toLowerCase();
      return [...links.values()]
        .filter((l) => !term || [l.slug, l.url, l.description].some((v) => v.toLowerCase().includes(term)))
        .sort((a, b) => a.slug.localeCompare(b.slug));
    },
    async create(l) {
      if (links.has(l.slug)) throw new Error(`go/${l.slug} already exists.`);
      links.set(l.slug, { ...l });
      return { ...l };
    },
    async update(l, changes) {
      links.set(l.slug, { ...l, ...changes });
    },
    async remove(l) {
      links.delete(l.slug);
    },
    href: (l) => `#/${l.slug}`,
    confirmDelete: (l) => `Delete go/${l.slug}?`,
  };
}
