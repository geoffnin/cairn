import { env as baseEnv } from "cloudflare:workers";
import worker from "../src/index";
import { _seedJwks } from "../src/jwt";
import type { Env } from "../src/types";
import { b64urlEncode } from "../src/util";

export const env = baseEnv as unknown as Env;
export const ORIGIN = "https://go.example.com";
export const ISSUER = "https://team.cloudflareaccess.com";
export const CERTS = `${ISSUER}/cdn-cgi/access/certs`;

export const genKeys = () =>
  crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  ) as Promise<CryptoKeyPair>;

// Stands in for the Access team's signing key.
export const accessKeys = await genKeys();
const publicJwk = { ...((await crypto.subtle.exportKey("jwk", accessKeys.publicKey)) as JsonWebKey), kid: "k1" };
export const seedAccessKeys = (ageSeconds = 0) => _seedJwks(CERTS, [publicJwk], ageSeconds);

export async function signJwt(claims: Record<string, unknown>, key = accessKeys.privateKey, alg = "RS256"): Promise<string> {
  const head = b64urlEncode(JSON.stringify({ alg, kid: "k1", typ: "JWT" }));
  const body = b64urlEncode(JSON.stringify(claims));
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${head}.${body}`));
  return `${head}.${body}.${b64urlEncode(sig)}`;
}

/** The token Cloudflare Access would attach for this person. */
export function accessToken(email: string, extra: Record<string, unknown> = {}): Promise<string> {
  return signJwt({ iss: ISSUER, aud: ["aud123"], exp: Math.floor(Date.now() / 1000) + 300, email, type: "app", ...extra });
}

export interface CallOpts {
  as?: string | null; // email to sign in as; null = no Access token
  method?: string;
  body?: unknown;
  rawBody?: string;
  headers?: Record<string, string>;
  env?: Partial<Env>;
  origin?: string;
  /** Leave the key cache as the test set it. */
  keepKeys?: boolean;
  /**
   * Simulate Access turned on for the Worker: ctx.access is present and getIdentity() returns
   * this (undefined = Access gave no identity). Leave out to use the Access JWT header instead.
   */
  workerAccess?: CloudflareAccessIdentity | undefined;
}

export function fakeCtx(opts: Pick<CallOpts, "workerAccess">): ExecutionContext {
  const ctx = { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext & { access?: CloudflareAccessContext };
  if ("workerAccess" in opts) {
    ctx.access = { aud: "worker-aud", getIdentity: async () => opts.workerAccess };
  }
  return ctx;
}

export async function call(path: string, opts: CallOpts = {}): Promise<Response> {
  if (!opts.keepKeys) seedAccessKeys();
  const headers = new Headers(opts.headers);
  const as = opts.as === undefined ? "alice@example.com" : opts.as;
  if (as && !headers.has("cf-access-jwt-assertion")) headers.set("cf-access-jwt-assertion", await accessToken(as));
  const method = opts.method ?? "GET";
  if (method !== "GET" && !headers.has("x-cairn-request")) headers.set("x-cairn-request", "1");
  const req = new Request((opts.origin ?? ORIGIN) + path, {
    method,
    headers,
    body: opts.rawBody ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body)),
    redirect: "manual",
  });
  return worker.fetch(req as never, { ...env, ...opts.env }, fakeCtx(opts));
}
