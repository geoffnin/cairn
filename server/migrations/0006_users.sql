-- People are referred to by an opaque random ID, and the users table is where an ID maps to an
-- email, so event logs carry no email addresses (decision D27).
--
-- This is the "expand" half of the change: it only adds. links.owner stays, so the Worker
-- version running while this migration applies (the deploy script migrates before deploying)
-- keeps working, and so does rolling the Worker back. A later release drops links.owner once no
-- running version uses it.
CREATE TABLE users (
  id         TEXT PRIMARY KEY,         -- 32 random hex characters
  email      TEXT NOT NULL UNIQUE,     -- lowercase
  created_at INTEGER NOT NULL          -- unix seconds
);

INSERT INTO users (id, email, created_at)
  SELECT lower(hex(randomblob(16))), owner, unixepoch() FROM (SELECT DISTINCT owner FROM links);

ALTER TABLE links ADD COLUMN owner_id TEXT NOT NULL DEFAULT '';
UPDATE links SET owner_id = (SELECT id FROM users WHERE users.email = links.owner);
CREATE INDEX links_owner_id ON links (owner_id);
