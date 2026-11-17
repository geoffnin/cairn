// Emits link clicks as an OpenTelemetry metric over OTLP/HTTP.
//
// Cloudflare's built-in OpenTelemetry export covers traces and logs but not custom metrics, so
// the Worker sends the data point itself. The payload is binary protobuf, the one encoding every
// OTLP receiver must accept (JSON is optional and some vendors reject it). The message is tiny
// and fixed in shape, so it is encoded by hand rather than pulling in a protobuf library.
import type { Env } from "./types";

export const METRIC_NAME = "cairn.link.clicks";
const DELTA = 1;
const CUMULATIVE = 2;

// ---- minimal protobuf writer ----

const utf8 = new TextEncoder();

function varint(n: number): number[] {
  const out: number[] = [];
  while (n > 0x7f) {
    out.push((n % 0x80) | 0x80);
    n = Math.floor(n / 0x80);
  }
  out.push(n);
  return out;
}
const tag = (field: number, wire: number) => varint(field * 8 + wire);
const bytes = (field: number, body: number[] | Uint8Array) => [...tag(field, 2), ...varint(body.length), ...body];
const str = (field: number, s: string) => bytes(field, utf8.encode(s));
const enumOrBool = (field: number, n: number) => [...tag(field, 0), ...varint(n)];
function fixed64(field: number, value: bigint): number[] {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, value, true);
  return [...tag(field, 1), ...b];
}

const keyValue = (key: string, value: string) => [...str(1, key), ...bytes(2, str(1, value))]; // KeyValue{key, AnyValue{string_value}}

export interface ClickPoint {
  slug: string;
  /** Delta: clicks in this point (1). Cumulative: total clicks for the link so far. */
  value: number;
  startMs: number;
  timeMs: number;
}

/** Encodes an ExportMetricsServiceRequest holding one monotonic Sum data point. */
export function encodeClickMetric(service: string, cumulative: boolean, p: ClickPoint): Uint8Array {
  const point = [
    ...fixed64(2, BigInt(p.startMs) * 1_000_000n), // start_time_unix_nano
    ...fixed64(3, BigInt(p.timeMs) * 1_000_000n), // time_unix_nano
    ...fixed64(6, BigInt(p.value)), // as_int (sfixed64)
    ...bytes(7, keyValue("link.slug", p.slug)), // attributes
  ];
  const sum = [...bytes(1, point), ...enumOrBool(2, cumulative ? CUMULATIVE : DELTA), ...enumOrBool(3, 1)]; // is_monotonic
  const metric = [
    ...str(1, METRIC_NAME),
    ...str(2, "Number of times a short link was followed."),
    ...str(3, "{click}"),
    ...bytes(7, sum),
  ];
  const scopeMetrics = [...bytes(1, str(1, "cairn")), ...bytes(2, metric)];
  const resource = bytes(1, keyValue("service.name", service));
  const resourceMetrics = [...bytes(1, resource), ...bytes(2, scopeMetrics)];
  return new Uint8Array(bytes(1, resourceMetrics));
}

// ---- configuration (standard OpenTelemetry environment variable names) ----

function metricsEndpoint(env: Env): string | null {
  if (env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT) return env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT;
  if (env.OTEL_EXPORTER_OTLP_ENDPOINT) return `${env.OTEL_EXPORTER_OTLP_ENDPOINT.replace(/\/+$/, "")}/v1/metrics`;
  return null;
}

/** "key=value,key2=value2", values optionally percent-encoded, as in the OTel spec. */
function parseHeaders(raw: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of (raw ?? "").split(",")) {
    const i = pair.indexOf("=");
    if (i <= 0) continue;
    let value = pair.slice(i + 1).trim();
    try {
      value = decodeURIComponent(value);
    } catch {
      /* use as written */
    }
    out[pair.slice(0, i).trim()] = value;
  }
  return out;
}

export const otelEnabled = (env: Env) => metricsEndpoint(env) !== null;
export const otelCumulative = (env: Env) =>
  (env.OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE || "cumulative").toLowerCase() !== "delta";

/** Sends one data point. Never throws: metrics must not break redirects. */
export async function exportClick(env: Env, point: ClickPoint): Promise<void> {
  const endpoint = metricsEndpoint(env);
  if (!endpoint) return;
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { ...parseHeaders(env.OTEL_EXPORTER_OTLP_HEADERS), "content-type": "application/x-protobuf" },
      body: encodeClickMetric(env.OTEL_SERVICE_NAME || "cairn", otelCumulative(env), point),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.warn("otel export rejected", res.status, (await res.text()).slice(0, 200));
  } catch (e) {
    console.warn("otel export failed", e);
  }
}

// ---- dashboard link ----

/** Where "see metrics" for a link should go, from METRICS_DASHBOARD_URL ("{slug}" is substituted). */
export function metricsUrl(env: Env, slug: string): string | null {
  const template = env.METRICS_DASHBOARD_URL?.trim();
  if (!template) return null;
  const url = template.replaceAll("{slug}", encodeURIComponent(slug));
  return /^https?:\/\//i.test(url) ? url : null;
}
