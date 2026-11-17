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
        "client.kind": "browser",
      },
    ]);
  });

  it("records pass-through, extension use, and never the full destination", async () => {
    await create("bug", "https://tracker.test/browse/{*}");
    await call("/bug/ABC-12?token=x", { as: null, headers: { authorization: "Bearer cairn_nope" } }); // signed out: no event
    await call("/bug/ABC-12?token=x");
    const [e] = events() as Record<string, unknown>[];
    expect(e).toMatchObject({ "link.passthrough": true, "link.target_host": "tracker.test", "client.kind": "browser" });
    expect(JSON.stringify(logged)).not.toContain("ABC-12");
    expect(JSON.stringify(logged)).not.toContain("token=x");
  });

  it("logs misses, so you can see which names people expect to exist", async () => {
    await call("/nothing-here");
    expect(events()).toEqual([
      { "event.name": "cairn.link.click", "link.slug": "nothing-here", "link.found": false, "link.passthrough": false, "client.kind": "browser" },
    ]);
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

  it("logs a create event with who created it", async () => {
    await call("/_/api/links", { method: "POST", body: { slug: "Wiki", url: "https://wiki.test/{*}?private=1", description: "Team wiki" } });
    expect(named("cairn.link.create")).toEqual([
      {
        "event.name": "cairn.link.create",
        "link.slug": "wiki",
        "link.owner": "alice@example.com",
        "link.target_host": "wiki.test",
        "link.has_description": true,
        "link.has_placeholder": true,
        "user.email": "alice@example.com",
        "user.admin_override": false,
        "client.kind": "browser",
      },
    ]);
    expect(JSON.stringify(logged)).not.toContain("private=1");
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
    expect(named("cairn.link.update")).toEqual([
      {
        "event.name": "cairn.link.update",
        "link.slug": "doc",
        "link.owner": "bob@example.com",
        "link.target_host": "new.test",
        "link.has_description": false,
        "link.has_placeholder": false,
        "link.changed": "owner,url",
        "link.previous_target_host": "old.test",
        "link.previous_owner": "alice@example.com",
        "user.email": "alice@example.com",
        "user.admin_override": false,
        "client.kind": "browser",
      },
    ]);
  });

  it("skips no-op saves and refused updates, and flags admin changes", async () => {
    await create("same", "https://s.test/");
    await put("same", { url: "https://s.test/", description: "" });
    await put("same", { url: "https://x.test/" }, "bob@example.com"); // 403
    expect(named("cairn.link.update")).toEqual([]);

    await put("same", { description: "now described" }, "admin@example.com");
    expect(named("cairn.link.update")).toMatchObject([
      { "link.changed": "description", "user.email": "admin@example.com", "user.admin_override": true, "link.owner": "alice@example.com" },
    ]);
    expect(named("cairn.link.update")[0]).not.toHaveProperty("link.previous_owner");
  });

  it("logs deletes with the owner the link had", async () => {
    await create("gone", "https://g.test/");
    await call("/_/api/links/gone", { method: "DELETE", as: "admin@example.com" });
    expect(named("cairn.link.delete")).toMatchObject([
      { "link.slug": "gone", "link.owner": "alice@example.com", "user.email": "admin@example.com", "user.admin_override": true },
    ]);
  });

  it("marks changes made from the extension", async () => {
    await env.DB.exec("DELETE FROM extension_tokens");
    const { createToken } = await import("../src/tokens");
    const { token } = await createToken(env, { email: "alice@example.com", name: "A", groupAdmin: false });
    await call("/_/api/links", { method: "POST", body: { slug: "ext", url: "https://e.test/" }, as: null, headers: { authorization: `Bearer ${token}` } });
    expect(named("cairn.link.create")[0]).toMatchObject({ "client.kind": "extension" });
  });
});
