-- Second half of the users change (decision D27): links no longer store owners' emails.
--
-- The Worker version running while this applies (the deploy script migrates first) still writes
-- links.owner, so the column is dropped, removing every stored email, and re-added empty and
-- optional for that version's writes. The new version never reads or writes it, so a later
-- release can drop it outright at any time.

-- Rows written without an owner ID before 0006's code was live get one now.
INSERT INTO users (id, email, created_at)
  SELECT lower(hex(randomblob(16))), owner, unixepoch()
  FROM (SELECT DISTINCT owner FROM links WHERE owner_id = '' AND owner <> '')
  WHERE true
  ON CONFLICT (email) DO NOTHING;
UPDATE links SET owner_id = (SELECT id FROM users WHERE users.email = links.owner)
  WHERE owner_id = '' AND owner <> '';

DROP INDEX links_owner;
ALTER TABLE links DROP COLUMN owner;
ALTER TABLE links ADD COLUMN owner TEXT NOT NULL DEFAULT '';
