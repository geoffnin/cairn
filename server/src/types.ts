export interface Env {
  DB: D1Database;
  CACHE: KVNamespace;

  AUTH_MODE?: string;
  SESSION_SECRET?: string;
  SESSION_TTL_HOURS?: string;

  OIDC_ISSUER?: string;
  OIDC_CLIENT_ID?: string;
  OIDC_CLIENT_SECRET?: string;
  OIDC_SCOPES?: string;

  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;

  ADMIN_EMAILS?: string;
  ADMIN_GROUPS?: string;
  ALLOWED_EMAIL_DOMAINS?: string;

  DEV_USER_EMAIL?: string;

  LINK_PREFIX?: string;

  METRICS_DASHBOARD_URL?: string;
  EXTENSION_TOKEN_TTL_DAYS?: string;
}

export interface User {
  email: string;
  name: string;
  isAdmin: boolean;
  /** Admin by IdP group at sign-in time (as opposed to ADMIN_EMAILS, which is checked live). */
  groupAdmin: boolean;
}

/** What we remember about a signed-in person, in a session cookie or behind an extension token. */
export interface Identity {
  email: string;
  name: string;
  groupAdmin: boolean;
}

export interface Link {
  slug: string;
  url: string;
  description: string;
  owner: string;
  created_at: number;
  updated_at: number;
}
