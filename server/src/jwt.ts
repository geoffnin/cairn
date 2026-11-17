// Minimal RS256 JWT verification against a remote JWKS, using WebCrypto only.
import { b64urlDecode, b64urlDecodeText, nowSeconds } from "./util";

type Jwk = JsonWebKey & { kid?: string };
const jwksCache = new Map<string, { keys: Jwk[]; fetchedAt: number }>();
const JWKS_TTL = 3600;
const JWKS_MIN_REFETCH = 60;
const CLOCK_SKEW = 60;

async function findKey(jwksUrl: string, kid: string | undefined): Promise<Jwk | undefined> {
  const pick = (keys: Jwk[]) => (kid ? keys.find((k) => k.kid === kid) : keys[0]);
  const cached = jwksCache.get(jwksUrl);
  const age = cached ? nowSeconds() - cached.fetchedAt : Infinity;
  if (cached && age < JWKS_TTL) {
    const key = pick(cached.keys);
    // Unknown kid usually means the IdP rotated keys; refetch, but not more than once a minute.
    if (key || age < JWKS_MIN_REFETCH) return key;
  }
  const res = await fetch(jwksUrl, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
  const { keys } = (await res.json()) as { keys: Jwk[] };
  jwksCache.set(jwksUrl, { keys, fetchedAt: nowSeconds() });
  return pick(keys);
}

export interface VerifyOptions {
  jwksUrl: string;
  issuer: string;
  audience: string;
}

export async function verifyJwt(token: string, opts: VerifyOptions): Promise<Record<string, unknown>> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("malformed JWT");
  const [h, p, s] = parts as [string, string, string];
  const header = JSON.parse(b64urlDecodeText(h)) as { alg?: string; kid?: string };
  if (header.alg !== "RS256") throw new Error(`unsupported JWT alg: ${header.alg}`);

  const jwk = await findKey(opts.jwksUrl, header.kid);
  if (!jwk) throw new Error("no matching signing key");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlDecode(s), new TextEncoder().encode(`${h}.${p}`));
  if (!valid) throw new Error("bad JWT signature");

  const claims = JSON.parse(b64urlDecodeText(p)) as Record<string, unknown>;
  const now = nowSeconds();
  if (claims.iss !== opts.issuer) throw new Error("wrong issuer");
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.includes(opts.audience)) throw new Error("wrong audience");
  if (typeof claims.exp !== "number" || claims.exp + CLOCK_SKEW < now) throw new Error("token expired");
  if (typeof claims.nbf === "number" && claims.nbf - CLOCK_SKEW > now) throw new Error("token not yet valid");
  return claims;
}

export function _resetJwksCache(): void {
  jwksCache.clear();
}
