// Tamper-proof (not secret) values for cookies: base64url(JSON) + "." + HMAC-SHA256.
import { b64urlDecode, b64urlDecodeText, b64urlEncode, nowSeconds } from "./util";

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

export async function seal(payload: object, secret: string, ttlSeconds: number): Promise<string> {
  const body = b64urlEncode(JSON.stringify({ ...payload, exp: nowSeconds() + ttlSeconds }));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), new TextEncoder().encode(body));
  return `${body}.${b64urlEncode(sig)}`;
}

export async function unseal<T>(value: string | null, secret: string): Promise<T | null> {
  if (!value) return null;
  const [body, sig, extra] = value.split(".");
  if (!body || !sig || extra !== undefined) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(secret), b64urlDecode(sig), new TextEncoder().encode(body));
    if (!ok) return null;
    const payload = JSON.parse(b64urlDecodeText(body)) as T & { exp?: number };
    if (typeof payload.exp !== "number" || payload.exp < nowSeconds()) return null;
    return payload;
  } catch {
    return null;
  }
}
