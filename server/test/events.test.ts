import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CLICK_EVENT, metricsUrl } from "../src/events";
import { _resetMemCache } from "../src/links";
import { call, env } from "./helpers";

let logged: unknown[][];
const events = () => logged.filter((args) => (args[0] as { "event.name"?: string })?.["event.name"] === CLICK_EVENT).map((a) => a[0]);

beforeEach(async () => {
  await env.DB.exec("DELETE FROM links");
  for (const k of (await env.CACHE.list()).keys) await env.CACHE.delete(k.name);
  _resetMemCache();
  logged = [];
  vi.spyOn(console, "log").mockImplementation((...args) => void logged.push(args));
});
afterEach(() => vi.restoreAllMocks());

const create = (slug: string, url: string) => call("/_/api/links", { method: "POST", body: { slug, url } });

describe("click events", () => {
  it("logs one structured object per visit, as a single argument", async () => {
    await create("docs", "https://docs.test/home?secret=1");
    logged = [];
    await call("/Docs");
    expect(logged.filter((a) => a.length === 1 && typeof a[0] === "object")).toHaveLength(1);
    expect(events()).toEqual([
      {
        "event.name": "cairn.link.click",
        "link.slug": "docs",
        "link.found": true,
        "link.target_host": "docs.test",
        "link.passthrough": false,
      },
    ]);
  });

  it("records pass-through, and never the full destination", async () => {
    await create("bug", "https://tracker.test/browse/{*}");
    await call("/bug/ABC-12?token=x", { as: null }); // not signed in: no event
    await call("/bug/ABC-12?token=x");
    const [e] = events() as Record<string, unknown>[];
    expect(e).toMatchObject({ "link.passthrough": true, "link.target_host": "tracker.test" });
    expect(JSON.stringify(logged)).not.toContain("ABC-12");
    expect(JSON.stringify(logged)).not.toContain("token=x");
  });

  it("logs misses, so you can see which names people expect to exist", async () => {
    await call("/nothing-here");
    expect(events()).toEqual([
      { "event.name": "cairn.link.click", "link.slug": "nothing-here", "link.found": false, "link.passthrough": false },
    ]);
  });

  it("logs names that could never be links as (invalid), not as typed", async () => {
    await call("/alice@example.com");
    await call("/Alice%40Example.com/x");
    expect(events()).toEqual([
      { "event.name": "cairn.link.click", "link.slug": "(invalid)", "link.found": false, "link.passthrough": false },
      { "event.name": "cairn.link.click", "link.slug": "(invalid)", "link.found": false, "link.passthrough": true },
    ]);
    expect(JSON.stringify(logged)).not.toMatch(/@/);
  });

  it("does not log for signed-out visitors, the UI, or the API", async () => {
    await create("x", "https://x.test/");
    logged = [];
    await call("/x", { as: null });
    await call("/_/");
    await call("/_/api/links");
    expect(events()).toEqual([]);
  });

  it("is the only record of a visit: redirects write nothing to D1", async () => {
    await create("n", "https://n.test/");
    const before = await env.DB.prepare("SELECT * FROM links WHERE slug = 'n'").first();
    await call("/n");
    await call("/n");
    expect(await env.DB.prepare("SELECT * FROM links WHERE slug = 'n'").first()).toEqual(before);
    expect(before).not.toHaveProperty("clicks");
  });
});

describe("dashboard link", () => {
  it("is built from METRICS_DASHBOARD_URL and exposed on links", async () => {
    await create("a.b", "https://a.test/");
    const tpl = { METRICS_DASHBOARD_URL: "https://grafana.test/d/x?var-slug={slug}&again={slug}" };
    const link = await (await call("/_/api/links/a.b", { env: tpl })).json<{ metrics_url: string | null }>();
    expect(link.metrics_url).toBe("https://grafana.test/d/x?var-slug=a.b&again=a.b");
    expect((await (await call("/_/api/links/a.b")).json<{ metrics_url: string | null }>()).metrics_url).toBeNull();
    expect(metricsUrl({ METRICS_DASHBOARD_URL: "https://dash.test/all" }, "x")).toBe("https://dash.test/all");
    expect(metricsUrl({ METRICS_DASHBOARD_URL: "javascript:alert(1)//{slug}" }, "x")).toBeNull();
  });
});

describe("link lifecycle events", () => {
  const named = (name: string) => logged.map((a) => a[0] as Record<string, unknown>).filter((e) => e?.["event.name"] === name);
  const put = (slug: string, body: unknown, as?: string) => call(`/_/api/links/${slug}`, { method: "PUT", body, as });
  const idOf = async (email: string) =>
    (await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first<{ id: string }>())?.id;

  it("identifies people by opaque ID, never by email", async () => {
    await call("/_/api/links", { method: "POST", body: { slug: "Wiki", url: "https://wiki.test/{*}?private=1", description: "Team wiki" } });
    const alice = await idOf("alice@example.com");
    expect(alice).toMatch(/^[0-9a-f]{32}$/);
    expect(named("cairn.link.create")).toEqual([
      {
        "event.name": "cairn.link.create",
        "link.slug": "wiki",
        "link.owner_id": alice,
        "link.target_host": "wiki.test",
        "link.has_description": true,
        "link.has_placeholder": true,
        "user.id": alice,
        "user.admin_override": false,
        "client.kind": "browser",
      },
    ]);
    expect(JSON.stringify(logged)).not.toContain("private=1");
  });

  it("never logs an email address in any event", async () => {
    await create("pii", "https://a.test/");
    await put("pii", { owner: "bob@example.com", url: "https://b.test/" });
    await call("/_/api/links/pii", { method: "DELETE", as: "admin@example.com" });
    await call("/pii");
    expect(logged.length).toBeGreaterThan(2);
    expect(JSON.stringify(logged)).not.toMatch(/@/);
  });

  it("does not log a create that failed", async () => {
    await create("dup", "https://a.test/");
    await call("/_/api/links", { method: "POST", body: { slug: "dup", url: "https://b.test/" }, as: "bob@example.com" });
    await call("/_/api/links", { method: "POST", body: { slug: "bad name", url: "https://b.test/" } });
    expect(named("cairn.link.create")).toHaveLength(1);
  });

  it("logs which fields an update changed, with previous host and owner", async () => {
    await create("doc", "https://old.test/a");
    await put("doc", { url: "https://new.test/b", owner: "bob@example.com" });
    const [alice, bob] = [await idOf("alice@example.com"), await idOf("bob@example.com")];
    expect(bob).toMatch(/^[0-9a-f]{32}$/);
    expect(bob).not.toBe(alice);
    expect(named("cairn.link.update")).toEqual([
      {
        "event.name": "cairn.link.update",
        "link.slug": "doc",
        "link.owner_id": bob,
        "link.target_host": "new.test",
        "link.has_description": false,
        "link.has_placeholder": false,
        "link.changed": "owner,url",
        "link.previous_target_host": "old.test",
        "link.previous_owner_id": alice,
        "user.id": alice,
        "user.admin_override": false,
        "client.kind": "browser",
      },
    ]);
  });

  it("skips no-op saves and refused updates, and flags admin changes", async () => {
    await create("same", "https://s.test/");
    await put("same", { url: "https://s.test/", description: "", owner: "Alice@Example.com" });
    await put("same", { url: "https://x.test/" }, "bob@example.com"); // 403
    expect(named("cairn.link.update")).toEqual([]);

    await put("same", { description: "now described" }, "admin@example.com");
    expect(named("cairn.link.update")).toMatchObject([
      {
        "link.changed": "description",
        "user.id": await idOf("admin@example.com"),
        "user.admin_override": true,
        "link.owner_id": await idOf("alice@example.com"),
      },
    ]);
    expect(named("cairn.link.update")[0]).not.toHaveProperty("link.previous_owner_id");
  });

  it("logs deletes with the owner the link had", async () => {
    await create("gone", "https://g.test/");
    await call("/_/api/links/gone", { method: "DELETE", as: "admin@example.com" });
    expect(named("cairn.link.delete")).toMatchObject([
      { "link.slug": "gone", "link.owner_id": await idOf("alice@example.com"), "user.id": await idOf("admin@example.com"), "user.admin_override": true },
    ]);
  });

  it("marks changes made from the extension's popup", async () => {
    await call("/_/api/links", { method: "POST", body: { slug: "ext", url: "https://e.test/" }, headers: { origin: "chrome-extension://abcdef" } });
    expect(named("cairn.link.create")[0]).toMatchObject({ "client.kind": "extension" });
  });
});

describe("users table", () => {
  it("shows emails in the API, from the users table only", async () => {
    await create("mine", "https://m.test/");
    const link = await (await call("/_/api/links/mine")).json<Record<string, unknown>>();
    expect(link.owner).toBe("alice@example.com");
    expect(link.owner_id).toMatch(/^[0-9a-f]{32}$/);
    const row = await env.DB.prepare("SELECT * FROM links WHERE slug = 'mine'").first<Record<string, unknown>>();
    expect(JSON.stringify(row)).not.toMatch(/@/);
  });

  it("keeps the previous Worker version working during the upgrade", async () => {
    // Statements the previous version (migration 0006's code) runs, against the new schema.
    const alice = (await env.DB.prepare("INSERT INTO users (id, email, created_at) VALUES ('a1', 'erin@example.com', 1) RETURNING id").first<{ id: string }>())!.id;
    await env.DB.prepare(
      "INSERT INTO links (slug, url, description, owner_id, owner, created_at, updated_at, rev) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind("old", "https://old.test/", "", alice, "erin@example.com", 1, 1, "r0").run();
    await env.DB.prepare("UPDATE links SET url = ?, description = ?, owner_id = ?, owner = ?, updated_at = ?, rev = ? WHERE slug = ? AND rev = ?")
      .bind("https://old2.test/", "", alice, "erin@example.com", 2, "r1", "old", "r0").run();
    // The new version reads and edits that row without the column.
    expect((await (await call("/_/api/links/old")).json<{ owner: string }>()).owner).toBe("erin@example.com");
    expect((await call("/_/api/links/old", { method: "PUT", body: { description: "edited" }, as: "erin@example.com" })).status).toBe(200);
  });

  it("changes nothing if looking up who is acting fails", async () => {
    await create("safe", "https://one.test/");
    // A database whose users queries fail, standing in for any failure of the lookup.
    const failingUsers = new Proxy(env.DB, {
      get(target, prop) {
        if (prop === "prepare") {
          return (sql: string) => {
            if (sql.includes("users (")) throw new Error("users unavailable");
            return target.prepare(sql);
          };
        }
        const v = Reflect.get(target, prop);
        return typeof v === "function" ? v.bind(target) : v;
      },
    });
    const broken = { env: { DB: failingUsers } };
    expect((await call("/_/api/links/safe", { method: "PUT", body: { url: "https://two.test/" }, ...broken })).status).toBe(500);
    expect((await call("/_/api/links/safe", { method: "DELETE", ...broken })).status).toBe(500);
    const row = await env.DB.prepare("SELECT url FROM links WHERE slug = 'safe'").first<{ url: string }>();
    expect(row?.url).toBe("https://one.test/");
    expect(logged.map((a) => (a[0] as Record<string, unknown>)?.["event.name"])).not.toContain("cairn.link.update");
  });

  it("gives each email one ID, case-insensitively, and keeps it", async () => {
    const { userIdFor } = await import("../src/users");
    const a = await userIdFor(env, "Carol@Example.com");
    expect(await userIdFor(env, "carol@example.com")).toBe(a);
    expect(await userIdFor(env, "dave@example.com")).not.toBe(a);
  });

  it("still filters 'only mine' and transfers ownership by email", async () => {
    await create("a1", "https://a.test/");
    await call("/_/api/links", { method: "POST", body: { slug: "b1", url: "https://b.test/" }, as: "bob@example.com" });
    const mine = async (as: string) =>
      (await (await call("/_/api/links?owner=me", { as })).json<{ links: { slug: string }[] }>()).links.map((l) => l.slug);
    expect(await mine("alice@example.com")).toEqual(["a1"]);
    expect(await mine("nobody@example.com")).toEqual([]);
    await call("/_/api/links/a1", { method: "PUT", body: { owner: "Bob@Example.com" } });
    expect(await mine("bob@example.com")).toEqual(["a1", "b1"]);
    expect((await (await call("/_/api/links/a1")).json<{ owner: string }>()).owner).toBe("bob@example.com");
  });
});
