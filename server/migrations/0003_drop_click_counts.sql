-- Usage is now counted from cairn.link.click log events in your metrics platform (decision D18),
-- so redirects no longer write to D1. Applying this deletes any click counts stored so far.
ALTER TABLE links DROP COLUMN clicks;
ALTER TABLE links DROP COLUMN last_clicked_at;
