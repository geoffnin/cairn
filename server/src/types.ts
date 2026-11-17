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
  owner: string;
  created_at: number;
  updated_at: number;
  clicks: number;
  last_clicked_at: number | null;
}
