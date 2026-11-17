-- Long-lived sign-ins issued to the browser extension. Only a hash of the token is stored.
CREATE TABLE extension_tokens (
  hash        TEXT PRIMARY KEY,   -- base64url(SHA-256(token))
  email       TEXT NOT NULL,
  name        TEXT NOT NULL DEFAULT '',
  group_admin INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,   -- unix seconds
  expires_at  INTEGER NOT NULL
);
CREATE INDEX extension_tokens_email ON extension_tokens (email);
