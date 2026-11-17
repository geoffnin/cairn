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

  LINK_PREFIX?: string;

  METRICS_DASHBOARD_URL?: string;
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
}
