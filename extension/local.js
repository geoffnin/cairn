// Local mode: links stored in this browser (chrome.storage.local, not synced to other devices).
import { ValidationError, normalizeSlug, validateDescription, validateUrl } from "./golinks.js";

const KEY = "localLinks";
const LOCK = "cairn-local-links";
const now = () => Math.floor(Date.now() / 1000);

// A dictionary with no prototype, so a name like "constructor" is never mistaken for a saved link.
async function readAll() {
  return Object.assign(Object.create(null), (await chrome.storage.local.get(KEY))[KEY]);
}
const present = (slug, l) => ({ slug, ...l });

/**
 * Runs one read-modify-write of the whole dictionary under a lock shared by every extension page
 * (popup, settings, link manager), so two saves at once cannot erase each other. Nothing is
 * written if `change` throws.
 */
function mutate(change) {
  return navigator.locks.request(LOCK, async () => {
    const all = await readAll();
    const result = await change(all);
    await chrome.storage.local.set({ [KEY]: { ...all } });
    return result;
  });
}

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
  return mutate((all) => {
    if (all[s]) throw new ValidationError(`go/${s} already exists.`);
    all[s] = link;
    return present(s, link);
  });
}

export async function updateLink(slug, { url, description }) {
  return mutate((all) => {
    const link = all[slug];
    if (!link) throw new ValidationError(`go/${slug} does not exist.`);
    all[slug] = {
      ...link,
      url: url === undefined ? link.url : validateUrl(url),
      description: description === undefined ? link.description : validateDescription(description),
      updated_at: now(),
    };
    return present(slug, all[slug]);
  });
}

export async function deleteLink(slug) {
  return mutate((all) => {
    delete all[slug];
  });
}
