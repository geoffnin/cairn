import { test as base, expect, type Browser, type Page } from "@playwright/test";

/** A name no other test uses, so tests can share one database. */
export const unique = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** The header that picks who is signed in, honoured only by AUTH_MODE=dev on localhost. */
export const signedInAs = (email: string) => ({ "x-cairn-dev-user": email });

export const ADMIN = "admin@e2e.test"; // in ADMIN_EMAILS (e2e/server.mjs)

/** A page signed in as someone else, alongside the test's own `page`. */
export async function pageAs(browser: Browser, email: string, baseURL: string): Promise<Page> {
  const context = await browser.newContext({ baseURL, extraHTTPHeaders: signedInAs(email) });
  return context.newPage();
}

export const test = base.extend<{ user: string }>({
  // Each test signs in as its own person, so "Only mine" and ownership checks see only its links.
  user: async ({}, use) => use(`${unique("user")}@e2e.test`),
  extraHTTPHeaders: async ({ user }, use) => use(signedInAs(user)),
});

export { expect };

/** Fills in the New link card and waits for the confirmation. */
export async function createLink(page: Page, slug: string, url: string, description = "") {
  await page.goto("/_/");
  await page.getByRole("textbox", { name: "Name" }).fill(slug);
  await page.getByRole("textbox", { name: "Destination URL" }).fill(url);
  if (description) await page.getByRole("textbox", { name: "Description (optional)" }).fill(description);
  await page.getByRole("button", { name: "Create link" }).click();
  // "go/" is drawn by CSS, so it is not in the text.
  await expect(page.getByRole("status").filter({ hasText: "Created" }).filter({ hasText: slug })).toBeVisible();
}

/** The links table row for go/<slug>. */
export const row = (page: Page, slug: string) =>
  page.getByRole("row").filter({ has: page.getByRole("link", { name: `go/${slug}`, exact: true }) });

/** Where test links point: e2e/destination.mjs, which answers any path. */
export const DEST = `http://localhost:${process.env.DEST_PORT ?? 8790}`;

/** Asserts the page followed a link all the way to DEST<path>. */
export async function expectArrivedAt(page: Page, path: string) {
  await expect(page).toHaveURL(`${DEST}${path}`);
  await expect(page.getByText(`Arrived at ${path}`)).toBeVisible();
}
