import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { _resetMemCache, cacheSeconds, resolveTarget } from "../src/links";
import { call, env } from "./helpers";

const create = (slug: string, url: string, as?: string) => call("/_/api/links", { method: "POST", body: { slug, url }, as });

beforeEach(async () => {
  await env.DB.exec("DELETE FROM links");
  for (const k of (await env.CACHE.list()).keys) await env.CACHE.delete(k.name);
  _resetMemCache();
});

describe("resolveTarget", () => {
  it.each([
    ["https://a.test/x", "", "", "https://a.test/x"],
    ["https://a.test/x", "y/z", "", "https://a.test/x/y/z"],
    ["https://a.test/x/", "y", "?a=1", "https://a.test/x/y?a=1"],
    ["https://a.test/x?k=v", "", "?a=1", "https://a.test/x?k=v&a=1"],
    ["https://a.test/browse/{*}", "ABC-12", "", "https://a.test/browse/ABC-12"],
    ["https://a.test/browse/{*}", "", "", "https://a.test/browse/"],
    ["https://a.test/s?q={*}", "a%20b&c=d/e", "", "https://a.test/s?q=a%20b%26c%3Dd%2Fe"],
    ["https:a.test", "", "", "https://a.test/"],
    ["https://a.test/文档", "", "", "https://a.test/%E6%96%87%E6%A1%A3"],
  ])("%s + %s %s", (target, rest, search, want) => {
    expect(resolveTarget(target, rest, search)).toBe(want);
  });
});

describe("redirects", () => {
  it("redirects and is case-insensitive", async () => {
    expect((await create("Docs", "https://docs.test/home")).status).toBe(201);
    const res = await call("/DOCS");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://docs.test/home");
    await call("/docs/sub?x=1").then((r) => expect(r.headers.get("location")).toBe("https://docs.test/home/sub?x=1"));
  });

  it("sends unknown names to the create form", async () => {
    const res = await call("/nope");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/_/?new=nope");
  });

  it("refuses requests that did not come through Cloudflare Access", async () => {
    const res = await call("/docs/a?b=1", { as: null });
    expect(res.status).toBe(401);
    expect(res.headers.get("location")).toBeNull();
  });

  it("serves from cache and invalidates on update and delete", async () => {
    await create("c1", "https://one.test/");
    expect(await env.CACHE.get("l:c1")).toBe("https://one.test/");

    // Prove reads do not need D1: remove the row behind the cache's back.
    await env.DB.exec("DELETE FROM links WHERE slug = 'c1'");
    _resetMemCache();
    expect((await call("/c1")).headers.get("location")).toBe("https://one.test/");

    await create("c2", "https://two.test/");
    await call("/c2");
    await call("/_/api/links/c2", { method: "PUT", body: { url: "https://two-b.test/" } });
    expect((await call("/c2")).headers.get("location")).toBe("https://two-b.test/");
    await call("/_/api/links/c2", { method: "DELETE" });
    expect((await call("/c2")).headers.get("location")).toBe("/_/?new=c2");
    expect(await env.CACHE.get("l:c2")).toBeNull();
  });

  it("reads D1 on a KV miss without writing KV (only changes write it)", async () => {
    await env.DB.exec("INSERT INTO links (slug,url,owner_id,created_at,updated_at) VALUES ('cold','https://cold.test/','u1',1,1)");
    expect((await call("/cold")).headers.get("location")).toBe("https://cold.test/");
    expect(await env.CACHE.get("l:cold")).toBeNull();
  });

  it("normalizes destinations before redirecting", async () => {
    await create("short", "https:example.com");
    expect((await call("/short")).headers.get("location")).toBe("https://example.com/");
    await create("docs-zh", "https://example.com/文档");
    expect((await call("/docs-zh")).headers.get("location")).toBe("https://example.com/%E6%96%87%E6%A1%A3");
  });
});

describe("api", () => {
  it("validates input", async () => {
    for (const [slug, url] of [
      ["_x", "https://a.test"],
      ["a b", "https://a.test"],
      ["ok", "javascript:alert(1)"],
      ["ok", "not a url"],
      ["ok", ""],
    ]) {
      expect((await create(slug!, url!)).status, `${slug} ${url}`).toBe(400);
    }
  });

  it("rejects duplicates", async () => {
    await create("dup", "https://a.test");
    const res = await create("DUP", "https://b.test", "bob@example.com");
    expect(res.status).toBe(409);
  });

  it("lets only the owner or an admin change a link", async () => {
    await create("mine", "https://a.test");
    const put = (as: string) => call("/_/api/links/mine", { method: "PUT", body: { url: "https://b.test" }, as });
    expect((await put("bob@example.com")).status).toBe(403);
    expect((await call("/_/api/links/mine", { method: "DELETE", as: "bob@example.com" })).status).toBe(403);
    expect((await put("alice@example.com")).status).toBe(200);
    expect((await put("admin@example.com")).status).toBe(200);
  });

  it("transfers ownership", async () => {
    await create("gift", "https://a.test");
    const res = await call("/_/api/links/gift", { method: "PUT", body: { owner: "Bob@Example.com" } });
    expect((await res.json<{ owner: string }>()).owner).toBe("bob@example.com");
    expect((await call("/_/api/links/gift", { method: "DELETE" })).status).toBe(403);
  });

  it("searches and filters", async () => {
    await create("alpha", "https://a.test/wiki");
    await create("beta", "https://b.test/100%_done", "bob@example.com");
    const names = async (qs: string) =>
      (await (await call(`/_/api/links?${qs}`)).json<{ links: { slug: string }[] }>()).links.map((l) => l.slug);
    expect(await names("")).toEqual(["alpha", "beta"]);
    expect(await names("q=WIKI")).toEqual(["alpha"]);
    expect(await names("q=%25_")).toEqual(["beta"]); // LIKE wildcards are literal
    expect(await names("owner=me")).toEqual(["alpha"]);
  });

  it("requires sign-in and blocks cross-site writes", async () => {
    expect((await call("/_/api/links", { as: null })).status).toBe(401);
    const post = (headers: Record<string, string>) =>
      call("/_/api/links", { method: "POST", body: { slug: "x", url: "https://a.test" }, headers });
    expect((await post({ "x-cairn-request": "0" })).status).toBe(403);
    expect((await post({ origin: "https://evil.test" })).status).toBe(403);
    expect((await post({ origin: "chrome-extension://abcdef" })).status).toBe(201);
  });
});

describe("redirect cache TTL", () => {
  const clock = (t: number) => vi.spyOn(Date, "now").mockReturnValue(t);
  const T0 = 1_800_000_000_000;
  // Change a link behind the cache's back (another isolate or a direct DB edit), clearing KV,
  // so only this isolate's memory still holds the old destination.
  const changeBehindCache = async (slug: string, url: string) => {
    await env.DB.prepare("UPDATE links SET url = ? WHERE slug = ?").bind(url, slug).run();
    await env.CACHE.delete(`l:${slug}`);
  };
  const where = async (slug: string, e: Record<string, string> = {}) => (await call(`/${slug}`, { env: e })).headers.get("location");

  afterEach(() => vi.restoreAllMocks());

  it("reads REDIRECT_CACHE_SECONDS, clamped, defaulting to 30", () => {
    const s = (v?: string) => cacheSeconds({ REDIRECT_CACHE_SECONDS: v } as never);
    expect([s(), s(""), s("abc"), s("-5"), s("0"), s("12.9"), s("99999")]).toEqual([30, 30, 30, 30, 0, 12, 3600]);
  });

  it("serves the cached destination until the TTL runs out", async () => {
    clock(T0);
    await create("ttl", "https://old.test/");
    await changeBehindCache("ttl", "https://new.test/");
    clock(T0 + 29_000);
    expect(await where("ttl")).toBe("https://old.test/");
    clock(T0 + 31_000);
    expect(await where("ttl")).toBe("https://new.test/");
  });

  it("honours a custom TTL, and 0 turns the memory layer off", async () => {
    const ten = { REDIRECT_CACHE_SECONDS: "10" };
    clock(T0);
    await call("/_/api/links", { method: "POST", body: { slug: "short", url: "https://old.test/" }, env: ten });
    await changeBehindCache("short", "https://new.test/");
    clock(T0 + 11_000);
    expect(await where("short", ten)).toBe("https://new.test/");

    const off = { REDIRECT_CACHE_SECONDS: "0" };
    await call("/_/api/links", { method: "POST", body: { slug: "off", url: "https://old.test/" }, env: off });
    await changeBehindCache("off", "https://new.test/");
    expect(await where("off", off)).toBe("https://new.test/");
  });

  it("forgets unknown names after 5 seconds, so new links show up quickly", async () => {
    clock(T0);
    expect(await where("soon")).toBe("/_/?new=soon");
    // Created through another isolate: this one's memory still says "unknown".
    await env.DB.exec("INSERT INTO links (slug,url,owner_id,created_at,updated_at) VALUES ('soon','https://soon.test/','u1',1,1)");
    clock(T0 + 4_000);
    expect(await where("soon")).toBe("/_/?new=soon");
    clock(T0 + 6_000);
    expect(await where("soon")).toBe("https://soon.test/");
  });
});

describe("review fixes", () => {
  const put = (slug: string, b: unknown, as?: string) => call(`/_/api/links/${slug}`, { method: "PUT", body: b, as });
  const get = async (slug: string) => (await call(`/_/api/links/${slug}`)).json<{ rev: string; url: string; owner: string }>();

  it("rejects names the router reserves", async () => {
    for (const name of ["robots.txt", "favicon.ico", "ROBOTS.TXT"]) {
      const res = await create(name, "https://a.test/");
      expect(res.status, name).toBe(400);
    }
  });

  it("clamps the list limit to a whole number between 1 and 500", async () => {
    await create("a1", "https://a.test/");
    await create("a2", "https://a.test/");
    const count = async (limit: string) => (await (await call(`/_/api/links?limit=${limit}`)).json<{ links: unknown[] }>()).links.length;
    expect(await count("-1")).toBe(1);
    expect(await count("0")).toBe(1);
    expect(await count("1.9")).toBe(1);
    expect(await count("abc")).toBe(2);
    expect(await count("999999")).toBe(2);
  });

  it("returns a revision and refuses updates and deletes made against an old one", async () => {
    await create("rv", "https://one.test/");
    const r1 = (await get("rv")).rev;
    expect(r1).toMatch(/^[0-9a-f-]{36}$/);
    expect((await put("rv", { url: "https://two.test/", rev: r1 })).status).toBe(200);
    const r2 = (await get("rv")).rev;
    expect(r2).not.toBe(r1);
    // A client still holding r1 (an old form, a delayed request) must not win.
    expect((await put("rv", { url: "https://stale.test/", rev: r1 })).status).toBe(409);
    expect((await call(`/_/api/links/rv?rev=${r1}`, { method: "DELETE" })).status).toBe(409);
    expect((await get("rv")).url).toBe("https://two.test/");
    expect((await call(`/_/api/links/rv?rev=${r2}`, { method: "DELETE" })).status).toBe(200);
  });

  it("makes the write itself conditional, so a change in between cannot be undone", async () => {
    // The API checks permission against the row it read; these call the store directly with
    // that (now stale) revision, as a request delayed past another change would.
    const { updateLink, deleteLink, getLink } = await import("../src/links");
    await create("race", "https://one.test/");
    const seen = (await getLink(env, "race"))!;
    await put("race", { owner: "bob@example.com" }); // ownership handed over meanwhile
    expect(await updateLink(env, "race", seen.rev, { url: seen.url, description: "", owner_id: seen.owner_id })).toBeNull();
    expect((await get("race")).owner).toBe("bob@example.com");

    // Deleted and recreated by someone else meanwhile: the old delete must not remove it.
    const old = (await getLink(env, "race"))!;
    await call(`/_/api/links/race`, { method: "DELETE", as: "bob@example.com" });
    await create("race", "https://recreated.test/", "carol@example.com");
    expect(await deleteLink(env, "race", old.rev)).toBe(false);
    expect((await get("race")).url).toBe("https://recreated.test/");
  });

  it("refuses to change a link when the cache cannot be cleared", async () => {
    await create("kv", "https://one.test/");
    const broken = {
      get: (k: string) => env.CACHE.get(k),
      put: () => Promise.reject(new Error("quota")),
      delete: () => Promise.reject(new Error("quota")),
      list: () => env.CACHE.list(),
    } as unknown as KVNamespace;
    const res = await call("/_/api/links/kv", { method: "PUT", body: { url: "https://two.test/" }, env: { CACHE: broken } });
    expect(res.status).toBe(503);
    expect((await get("kv")).url).toBe("https://one.test/");
    expect((await call("/_/api/links/kv", { method: "DELETE", env: { CACHE: broken } })).status).toBe(503);
    expect(await env.CACHE.get("l:kv")).toBe("https://one.test/");
  });

  it("serves the new destination after an edit, even if the cache write afterwards fails", async () => {
    await create("fill", "https://one.test/");
    const putFails = {
      get: (k: string) => env.CACHE.get(k),
      put: () => Promise.reject(new Error("quota")),
      delete: (k: string) => env.CACHE.delete(k),
      list: () => env.CACHE.list(),
    } as unknown as KVNamespace;
    expect((await call("/_/api/links/fill", { method: "PUT", body: { url: "https://two.test/" }, env: { CACHE: putFails } })).status).toBe(200);
    expect(await env.CACHE.get("l:fill")).toBeNull();
    _resetMemCache();
    expect((await call("/fill")).headers.get("location")).toBe("https://two.test/");
  });
});
