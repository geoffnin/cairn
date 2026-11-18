// The web UI and redirects, as people use them.
import { ADMIN, DEST, createLink, expect, expectArrivedAt, pageAs, row, test, unique } from "./fixtures";

test("shows who is signed in", async ({ page, user }) => {
  await page.goto("/");
  await expect(page).toHaveURL("/_/");
  await expect(page.getByText(user)).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign out" })).toBeVisible();
});

test("create a link, find it, and follow it with text passed through", async ({ page, user }) => {
  const slug = unique("bug");
  await createLink(page, slug, `${DEST}/browse/{*}`, "Bug tracker");

  await expect(row(page, slug)).toContainText(user);
  await page.getByRole("searchbox").fill("bug tracker");
  await expect(row(page, slug)).toBeVisible();

  await page.goto(`/${slug}/ABC-12`);
  await expectArrivedAt(page, "/browse/ABC-12");
});

test("a name nobody has claimed opens the form with the name filled in", async ({ page }) => {
  const slug = unique("unclaimed");
  await page.goto(`/${slug}`);

  await expect(page).toHaveURL(`/_/?new=${slug}`);
  await expect(page.getByRole("textbox", { name: "Name" })).toHaveValue(slug);
  await expect(page.getByRole("status").filter({ hasText: `${slug} does not exist yet` })).toBeVisible();

  await page.getByRole("textbox", { name: "Destination URL" }).fill(`${DEST}/claimed`);
  await page.getByRole("button", { name: "Create link" }).click();
  await expect(row(page, slug)).toBeVisible();

  // The miss was cached on the way in; creating the link must replace it.
  await page.goto(`/${slug}`);
  await expectArrivedAt(page, "/claimed");
});

test("editing a link changes where it goes", async ({ page }) => {
  const slug = unique("edit");
  await createLink(page, slug, `${DEST}/before`);
  await page.goto(`/${slug}`); // warm the redirect caches
  await expectArrivedAt(page, "/before");

  await page.goto("/_/");
  await row(page, slug).getByRole("button", { name: "Edit" }).click();
  // The dialog has no accessible name of its own yet, so find it by its heading.
  const dialog = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: `Edit go/${slug}` }) });
  await dialog.getByRole("textbox", { name: "Destination URL" }).fill(`${DEST}/after`);
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await expect(row(page, slug)).toContainText(`${new URL(DEST).host}/after`);

  await page.goto(`/${slug}`);
  await expectArrivedAt(page, "/after");
});

test("deleting a link sends people to the create form again", async ({ page }) => {
  const slug = unique("gone");
  await createLink(page, slug, `${DEST}/gone`);

  page.once("dialog", (d) => d.accept());
  await row(page, slug).getByRole("button", { name: "Delete" }).click();
  await expect(row(page, slug)).toHaveCount(0);

  await page.goto(`/${slug}`);
  await expect(page).toHaveURL(`/_/?new=${slug}`);
});

test("only the owner and admins can change a link; anyone can use it", async ({ page, browser, baseURL }) => {
  const slug = unique("owned");
  await createLink(page, slug, `${DEST}/owned`);

  const other = await pageAs(browser, `${unique("other")}@e2e.test`, baseURL!);
  await other.goto("/_/");
  await expect(row(other, slug)).toBeVisible();
  await expect(row(other, slug).getByRole("button", { name: "Edit" })).toHaveCount(0);
  await other.getByRole("checkbox", { name: "Only mine" }).check();
  await expect(row(other, slug)).toHaveCount(0);
  await other.goto(`/${slug}`);
  await expectArrivedAt(other, "/owned");

  // An admin can hand the link over to someone else.
  const newOwner = `${unique("heir")}@e2e.test`;
  const admin = await pageAs(browser, ADMIN, baseURL!);
  await admin.goto("/_/");
  await expect(admin.getByText(`${ADMIN} (admin)`)).toBeVisible();
  await row(admin, slug).getByRole("button", { name: "Edit" }).click();
  const dialog = admin.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "Owner" }).fill(newOwner);
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(row(admin, slug)).toContainText(newOwner);

  // The original owner no longer can.
  await page.reload();
  await expect(row(page, slug)).toContainText(newOwner);
  await expect(row(page, slug).getByRole("button", { name: "Edit" })).toHaveCount(0);
});
