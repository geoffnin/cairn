import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { env as baseEnv } from "cloudflare:workers";
import worker from "../src/index";
import { seal } from "../src/seal";
import type { Env } from "../src/types";

export const env = baseEnv as unknown as Env;
export const ORIGIN = "https://go.example.com";

export async function sessionCookie(email: string, groupAdmin = false): Promise<string> {
  return `cairn_session=${await seal({ email, name: email, groupAdmin }, env.SESSION_SECRET!, 3600)}`;
}

export interface CallOpts {
  as?: string | null; // email to sign in as; null = anonymous
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  env?: Partial<Env>;
  origin?: string;
}

export async function call(path: string, opts: CallOpts = {}): Promise<Response> {
  const headers = new Headers(opts.headers);
  const as = opts.as === undefined ? "alice@example.com" : opts.as;
  if (as) headers.set("cookie", await sessionCookie(as));
  const method = opts.method ?? "GET";
  if (method !== "GET" && !headers.has("x-cairn-request")) headers.set("x-cairn-request", "1");
  const req = new Request((opts.origin ?? ORIGIN) + path, {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    redirect: "manual",
  });
  const ctx = createExecutionContext();
  const res = await worker.fetch(req as never, { ...env, ...opts.env }, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}
