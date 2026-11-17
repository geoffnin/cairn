const enc = new TextEncoder();
const dec = new TextDecoder();

export function b64urlEncode(data: ArrayBuffer | Uint8Array | string): string {
  const bytes =
    typeof data === "string" ? enc.encode(data) : data instanceof Uint8Array ? data : new Uint8Array(data);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64urlDecode(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function b64urlDecodeText(s: string): string {
  return dec.decode(b64urlDecode(s));
}

export function randomToken(bytes = 32): string {
  return b64urlEncode(crypto.getRandomValues(new Uint8Array(bytes)));
}

export function csv(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

export function redirect(location: string, headers: [string, string][] = []): Response {
  const h = new Headers({ location, "cache-control": "no-store" });
  for (const [k, v] of headers) h.append(k, v);
  return new Response(null, { status: 302, headers: h });
}

/**
 * The word people type before the slash ("go" in go/roadmap). It is used as a hostname by the
 * browser extension, so it must be a single DNS label.
 */
export function linkPrefix(env: { LINK_PREFIX?: string }): string {
  const p = (env.LINK_PREFIX || "go").trim().toLowerCase();
  if (!/^[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?$/.test(p)) {
    throw new Error(`LINK_PREFIX "${env.LINK_PREFIX}" is invalid: use 1-32 letters, digits or hyphens.`);
  }
  return p;
}
