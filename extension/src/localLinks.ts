// Links kept in this browser (local.js), as a LinkSource for the shared manage page.
import type { LinkSource } from "@cairn/ui/lib/links";
import { createLink, deleteLink, getLink, listLinks, updateLink } from "../local.js";

export const localLinks: LinkSource = {
  shared: false,
  list: ({ q }) => listLinks(q),
  get: (slug) => getLink(slug),
  create: (link) => createLink(link),
  async update(link, { url, description }) {
    await updateLink(link.slug, { url, description });
  },
  async remove(link) {
    await deleteLink(link.slug);
  },
  // Straight to the local resolver: http://go/... would follow whichever mode is active.
  href: (link) => chrome.runtime.getURL(`go.html#${encodeURIComponent(link.slug)}`),
  confirmDelete: (link) => `Delete go/${link.slug}?`,
  watch(onChange) {
    const listener = (changes: Record<string, unknown>, area: string) => {
      if (area === "local" && "localLinks" in changes) onChange();
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  },
};
