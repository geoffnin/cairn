export interface Env {
  DB: D1Database;
  CACHE: KVNamespace;

  AUTH_MODE?: string;

  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;

  ADMIN_EMAILS?: string;
  ADMIN_GROUPS?: string;
  ALLOWED_EMAIL_DOMAINS?: string;

  DEV_USER_EMAIL?: string;


  METRICS_DASHBOARD_URL?: string;
  REDIRECT_CACHE_SECONDS?: string;
}

export interface User {
  email: string;
  name: string;
  isAdmin: boolean;
}


export interface Link {
  slug: string;
  url: string;
  description: string;
  /** Opaque ID of the owner (users.id). */
  owner_id: string;
  /** The owner's email, joined in from the users table for the API and UI; never logged. */
  owner: string;
  created_at: number;
  updated_at: number;
  /** Changes on every write; used to reject stale updates and deletes. */
  rev: string;
}
