// Extension sign-in tokens: random, stored hashed in D1 so they can be revoked, and cached in
// memory for a minute so the redirect path rarely touches D1 for them.
import type { Env, Identity } from "./types";
import { b64urlEncode, nowSeconds, randomToken } from "./util";

const PREFIX = "cairn_";
const MEM_TTL_MS = 60_000;
const MEM_MAX = 5000;
const mem = new Map<string, { who: (Identity & { expires_at: number }) | null; exp: number }>();

async function hashOf(token: string): Promise<string> {
  return b64urlEncode(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
}

export function tokenTtlSeconds(env: Env): number {
  const days = Number(env.EXTENSION_TOKEN_TTL_DAYS);
  return (days > 0 ? days : 30) * 86400;
}

export async function createToken(env: Env, who: Identity): Promise<{ token: string; expires_at: number }> {
  const token = PREFIX + randomToken(32);
  const now = nowSeconds();
  const expires_at = now + tokenTtlSeconds(env);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM extension_tokens WHERE expires_at < ?").bind(now),
    env.DB.prepare(
      "INSERT INTO extension_tokens (hash, email, name, group_admin, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).bind(await hashOf(token), who.email, who.name, who.groupAdmin ? 1 : 0, now, expires_at),
  ]);
  return { token, expires_at };
}

export async function lookupToken(env: Env, token: string): Promise<Identity | null> {
  if (!token.startsWith(PREFIX)) return null;
  const hash = await hashOf(token);
  let hit = mem.get(hash);
  if (!hit || hit.exp < Date.now()) {
    const row = await env.DB.prepare("SELECT email, name, group_admin, expires_at FROM extension_tokens WHERE hash = ?")
      .bind(hash)
      .first<{ email: string; name: string; group_admin: number; expires_at: number }>();
    if (mem.size >= MEM_MAX) mem.delete(mem.keys().next().value!);
    hit = {
      who: row && { email: row.email, name: row.name, groupAdmin: !!row.group_admin, expires_at: row.expires_at },
      exp: Date.now() + MEM_TTL_MS,
    };
    mem.set(hash, hit);
  }
  return hit.who && hit.who.expires_at > nowSeconds() ? hit.who : null;
}

export async function revokeToken(env: Env, token: string): Promise<void> {
  const hash = await hashOf(token);
  await env.DB.prepare("DELETE FROM extension_tokens WHERE hash = ?").bind(hash).run();
  mem.delete(hash);
}

export async function revokeTokensFor(env: Env, email: string): Promise<number> {
  const res = await env.DB.prepare("DELETE FROM extension_tokens WHERE email = ?").bind(email).run();
  for (const [hash, hit] of mem) if (hit.who?.email === email) mem.delete(hash);
  return res.meta.changes ?? 0;
}

export function _resetTokenCache(): void {
  mem.clear();
}
