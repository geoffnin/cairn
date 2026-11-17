// Local mode: links stored in this browser (chrome.storage.local, not synced to other devices).
import { ValidationError, normalizeSlug, validateDescription, validateUrl } from "./golinks.js";

const KEY = "localLinks";
const now = () => Math.floor(Date.now() / 1000);

async function readAll() {
  return (await chrome.storage.local.get(KEY))[KEY] ?? {};
}
const writeAll = (links) => chrome.storage.local.set({ [KEY]: links });
const present = (slug, l) => ({ slug, ...l });

export async function getLink(slug) {
  const l = (await readAll())[slug];
  return l ? present(slug, l) : null;
}

export async function listLinks(q = "", limit = 500) {
  const needle = q.trim().toLowerCase();
  return Object.entries(await readAll())
    .map(([slug, l]) => present(slug, l))
    .filter((l) => !needle || [l.slug, l.url, l.description].some((v) => v.toLowerCase().includes(needle)))
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .slice(0, limit);
}

export async function countLinks() {
  return Object.keys(await readAll()).length;
}

export async function createLink({ slug, url, description }) {
  const s = normalizeSlug(slug);
  const link = { url: validateUrl(url), description: validateDescription(description), created_at: now(), updated_at: now() };
  const all = await readAll();
  if (all[s]) throw new ValidationError(`go/${s} already exists.`);
  all[s] = link;
  await writeAll(all);
  return present(s, link);
}

export async function updateLink(slug, { url, description }) {
  const all = await readAll();
  const link = all[slug];
  if (!link) throw new ValidationError(`go/${slug} does not exist.`);
  all[slug] = {
    ...link,
    url: url === undefined ? link.url : validateUrl(url),
    description: description === undefined ? link.description : validateDescription(description),
    updated_at: now(),
  };
  await writeAll(all);
  return present(slug, all[slug]);
}

export async function deleteLink(slug) {
  const all = await readAll();
  delete all[slug];
  await writeAll(all);
}
