-- A revision token per link, changed on every write. Updates and deletes only apply to the
-- revision they were checked against, so a delayed or stale request cannot overwrite a newer
-- edit or delete a link someone has since recreated.
ALTER TABLE links ADD COLUMN rev TEXT NOT NULL DEFAULT '';
UPDATE links SET rev = lower(hex(randomblob(8))) WHERE rev = '';
