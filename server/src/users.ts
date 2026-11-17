// People are identified by an opaque random ID; this module is the only place that maps it to an
// email. Event logs carry IDs only, so they reveal nothing without access to this table.
//
// Not cached: lookups happen only when a link changes or someone lists their own links, both
// rare, and a cache could hand out the ID of a user row that has since been removed.
import type { Env } from "./types";
import { nowSeconds } from "./util";

function newUserId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** The ID for this email, created on first use (making a link, or being handed one). */
export async function userIdFor(env: Env, email: string): Promise<string> {
  // One statement for both cases: a no-op update on conflict lets RETURNING give the existing ID.
  const row = await env.DB.prepare(
    "INSERT INTO users (id, email, created_at) VALUES (?, ?, ?) ON CONFLICT (email) DO UPDATE SET email = excluded.email RETURNING id",
  )
    .bind(newUserId(), email.trim().toLowerCase(), nowSeconds())
    .first<{ id: string }>();
  if (!row) throw new Error("could not record user");
  return row.id;
}
