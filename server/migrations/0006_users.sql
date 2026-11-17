-- People are referred to by an opaque random ID everywhere except this table, so event logs
-- carry no email addresses (decision D27). The API and UI join emails back in from here.
CREATE TABLE users (
  id         TEXT PRIMARY KEY,         -- 32 random hex characters
  email      TEXT NOT NULL UNIQUE,     -- lowercase
  created_at INTEGER NOT NULL          -- unix seconds
);

INSERT INTO users (id, email, created_at)
  SELECT lower(hex(randomblob(16))), owner, unixepoch() FROM (SELECT DISTINCT owner FROM links);

ALTER TABLE links ADD COLUMN owner_id TEXT NOT NULL DEFAULT '';
UPDATE links SET owner_id = (SELECT id FROM users WHERE users.email = links.owner);
DROP INDEX links_owner;
ALTER TABLE links DROP COLUMN owner;
CREATE INDEX links_owner_id ON links (owner_id);
