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
