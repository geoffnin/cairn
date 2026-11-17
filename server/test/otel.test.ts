import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { _resetMemCache } from "../src/links";
import { encodeClickMetric, metricsUrl } from "../src/otel";
import { call, env } from "./helpers";

const hex = (b: ArrayBuffer | Uint8Array) => [...new Uint8Array(b as ArrayBuffer)].map((x) => x.toString(16).padStart(2, "0")).join("");

// Decoded with the `opentelemetry-proto` Python package (ExportMetricsServiceRequest) and confirmed to
// parse as the intended message and re-serialise to these exact bytes.
const GOLDEN =
  "0aad010a190a170a0c736572766963652e6e616d6512070a05636169726e128f010a070a05636169726e1283010a11636169726e2e6c696e6b2e636c69636b73122a4e756d626572206f662074696d657320612073686f7274206c696e6b2077617320666f6c6c6f7765642e1a077b636c69636b7d3a390a331100002a36fe9c9717190070f3e8899d9717312a000000000000003a160a096c696e6b2e736c756712090a07726f61646d617010021801";

let sent: { url: string; headers: Headers; body: Uint8Array }[];
let respond: () => Response | Promise<Response>;

beforeEach(async () => {
  await env.DB.exec("DELETE FROM links");
  for (const k of (await env.CACHE.list()).keys) await env.CACHE.delete(k.name);
  _resetMemCache();
  sent = [];
  respond = () => new Response(null, { status: 200 });
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    sent.push({ url: String(input), headers: new Headers(init?.headers), body: init?.body as Uint8Array });
    return respond();
  });
});
afterEach(() => vi.unstubAllGlobals());

const otel = { OTEL_EXPORTER_OTLP_ENDPOINT: "https://otlp.test/base/", OTEL_EXPORTER_OTLP_HEADERS: "Authorization=Basic%20abc, x-team = t1" };
const create = (slug: string) => call("/_/api/links", { method: "POST", body: { slug, url: "https://t.test/" } });

// Minimal reader for the fields we assert on: walks nested length-delimited messages by path.
function field(buf: Uint8Array, path: number[]): Uint8Array | bigint | undefined {
  let i = 0;
  const varint = () => {
    let n = 0, shift = 0;
    for (;;) {
      const b = buf[i++]!;
      n += (b & 0x7f) * 2 ** shift;
      shift += 7;
      if (!(b & 0x80)) return n;
    }
  };
  while (i < buf.length) {
    const key = varint();
    const [no, wire] = [Math.floor(key / 8), key % 8];
    let value: Uint8Array | bigint;
    if (wire === 0) value = BigInt(varint());
    else if (wire === 1) { value = new DataView(buf.buffer, buf.byteOffset + i, 8).getBigUint64(0, true); i += 8; }
    else { const len = varint(); value = buf.subarray(i, i + len); i += len; }
    if (no === path[0]) return path.length === 1 ? value : field(value as Uint8Array, path.slice(1));
  }
  return undefined;
}
const text = (b: unknown) => new TextDecoder().decode(b as Uint8Array);
const POINT = [1, 2, 2, 7, 1]; // request > resource_metrics > scope_metrics > metric > sum > data_points

describe("otlp encoding", () => {
  it("matches bytes verified against the official opentelemetry-proto definitions", () => {
    const bytes = encodeClickMetric("cairn", true, { slug: "roadmap", value: 42, startMs: 1_700_000_000_000, timeMs: 1_700_000_600_000 });
    expect(hex(bytes)).toBe(GOLDEN);
  });
});

describe("click metric", () => {
  it("is not sent unless an endpoint is configured", async () => {
    await create("quiet");
    await call("/quiet");
    expect(sent).toHaveLength(0);
  });

  it("sends a cumulative data point per click by default", async () => {
    await create("docs");
    await call("/docs", { env: otel });
    await call("/docs", { env: otel });
    expect(sent).toHaveLength(2);
    const req = sent[1]!;
    expect(req.url).toBe("https://otlp.test/base/v1/metrics");
    expect(req.headers.get("content-type")).toBe("application/x-protobuf");
    expect(req.headers.get("authorization")).toBe("Basic abc");
    expect(req.headers.get("x-team")).toBe("t1");

    expect(text(field(req.body, [1, 1, 1, 2, 1]))).toBe("cairn"); // service.name
    expect(text(field(req.body, [1, 2, 2, 1]))).toBe("cairn.link.clicks");
    expect(field(req.body, [1, 2, 2, 7, 2])).toBe(2n); // cumulative
    expect(field(req.body, [1, 2, 2, 7, 3])).toBe(1n); // monotonic
    expect(field(req.body, [...POINT, 6])).toBe(2n); // running total
    expect(text(field(req.body, [...POINT, 7, 2, 1]))).toBe("docs"); // link.slug
    const created = (await (await call("/_/api/links/docs")).json<{ created_at: number }>()).created_at;
    expect(field(req.body, [...POINT, 2])).toBe(BigInt(created) * 1_000_000_000n); // start = link creation
  });

  it("sends deltas of 1 when asked, to an explicit metrics endpoint", async () => {
    await create("d");
    const cfg = { OTEL_EXPORTER_OTLP_METRICS_ENDPOINT: "https://m.test/custom", OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE: "delta", OTEL_SERVICE_NAME: "golinks" };
    await call("/d", { env: cfg });
    await call("/d", { env: cfg });
    expect(sent[1]!.url).toBe("https://m.test/custom");
    expect(field(sent[1]!.body, [1, 2, 2, 7, 2])).toBe(1n); // delta
    expect(field(sent[1]!.body, [...POINT, 6])).toBe(1n);
    expect(text(field(sent[1]!.body, [1, 1, 1, 2, 1]))).toBe("golinks");
  });

  it("never lets a failing collector affect redirects or the count", async () => {
    await create("up");
    respond = () => { throw new Error("collector down"); };
    expect((await call("/up", { env: otel })).headers.get("location")).toBe("https://t.test/");
    respond = () => new Response("nope", { status: 500 });
    expect((await call("/up", { env: otel })).status).toBe(302);
    expect((await (await call("/_/api/links/up")).json<{ clicks: number }>()).clicks).toBe(2);
  });

  it("sends nothing for unknown links", async () => {
    await call("/missing", { env: otel });
    expect(sent).toHaveLength(0);
  });
});

describe("dashboard link", () => {
  it("is built from METRICS_DASHBOARD_URL and exposed on links", async () => {
    await create("a.b");
    const tpl = { METRICS_DASHBOARD_URL: "https://grafana.test/d/x?var-slug={slug}&again={slug}" };
    const link = await (await call("/_/api/links/a.b", { env: tpl })).json<{ metrics_url: string | null }>();
    expect(link.metrics_url).toBe("https://grafana.test/d/x?var-slug=a.b&again=a.b");
    expect((await (await call("/_/api/links/a.b")).json<{ metrics_url: string | null }>()).metrics_url).toBeNull();
    expect(metricsUrl({ METRICS_DASHBOARD_URL: "https://dash.test/all" } as never, "x")).toBe("https://dash.test/all");
    expect(metricsUrl({ METRICS_DASHBOARD_URL: "javascript:alert(1)//{slug}" } as never, "x")).toBeNull();
  });
});
