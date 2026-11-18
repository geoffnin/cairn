// The Chrome extension against the local server: typing go/name in the address bar.
// Needs extension/dist (`npm run build -w extension`; `npm run e2e` does it first).
import { chromium, type BrowserContext, type Worker } from "@playwright/test";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { DEST, expect, expectArrivedAt, signedInAs, test as base, unique } from "./fixtures";

const extensionPath = fileURLToPath(new URL("../extension/dist", import.meta.url));

const test = base.extend<{ extensionContext: BrowserContext; background: Worker }>({
  // Extensions load only in a persistent context, with Chromium's full build ("chromium" channel),
  // which runs headless too.
  extensionContext: async ({ user }, use) => {
    if (!existsSync(extensionPath)) throw new Error("extension/dist is missing: run `npm run build -w extension` first.");
    const context = await chromium.launchPersistentContext("", {
      channel: "chromium",
      extraHTTPHeaders: signedInAs(user),
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });
    await use(context);
    await context.close();
  },
  background: async ({ extensionContext }, use) => {
    await use(extensionContext.serviceWorkers()[0] ?? (await extensionContext.waitForEvent("serviceworker")));
  },
});

test("go/name in the address bar goes through the server to the destination", async ({ extensionContext, background, request, baseURL, user }) => {
  const slug = unique("ext");
  const created = await request.post("/_/api/links", {
    headers: { ...signedInAs(user), "x-cairn-request": "1" },
    data: { slug, url: `${DEST}/docs/{*}` },
  });
  expect(created.status()).toBe(201);

  // What the settings page does when someone picks this server. The background script then
  // points the go/ redirect rule at it.
  await background.evaluate((url) => chrome.storage.sync.set({ serverUrl: url, mode: "shared" }), baseURL!);
  await expect
    .poll(() => background.evaluate(async () => (await chrome.declarativeNetRequest.getDynamicRules())[0]?.action.redirect?.regexSubstitution))
    .toBe(`${baseURL}/\\1`);

  const page = await extensionContext.newPage();
  await page.goto(`http://go/${slug}/setup`);
  await expectArrivedAt(page, "/docs/setup");
});
