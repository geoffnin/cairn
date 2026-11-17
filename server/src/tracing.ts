// Custom spans, on top of the spans the Workers runtime records by itself (the request, and
// every KV, D1 and fetch call). Spans are recorded only when tracing is enabled for the Worker
// and the request is sampled (observability.traces in wrangler.jsonc); otherwise this costs a
// function call. Attributes never include emails: links, cache layers, methods, status codes.
import { tracing } from "cloudflare:workers";

export type SpanAttributes = Record<string, string | number | boolean | undefined>;
export interface SpanHandle {
  setAttribute(key: string, value: string | number | boolean): unknown;
  setAttributes(attributes: SpanAttributes): unknown;
  recordException(exception: { name: string; message?: string; stack?: string }): unknown;
}
interface Tracer {
  enterSpan<T>(name: string, callback: (span: SpanHandle) => T): T;
}

let tracer: Tracer = tracing as unknown as Tracer;

const record = (span: SpanHandle, e: unknown) => {
  const err = e instanceof Error ? e : new Error(String(e));
  span.recordException({ name: err.name, message: err.message, stack: err.stack });
};

/** Runs `fn` inside a span named `name`. Exceptions and rejections are recorded and rethrown. */
export function inSpan<T>(name: string, attributes: SpanAttributes, fn: (span: SpanHandle) => T): T {
  return tracer.enterSpan(name, (span) => {
    span.setAttributes(attributes);
    try {
      const result = fn(span);
      if (result instanceof Promise) {
        return result.catch((e: unknown) => {
          record(span, e);
          throw e;
        }) as T;
      }
      return result;
    } catch (e) {
      record(span, e);
      throw e;
    }
  });
}

/** Tests: record spans instead of sending them to the runtime. */
export function _setTracer(t: Tracer | null): void {
  tracer = t ?? (tracing as unknown as Tracer);
}
