CREATE TABLE links (
  slug            TEXT PRIMARY KEY,          -- normalized: lowercase
  url             TEXT NOT NULL,             -- may contain the {*} placeholder
  description     TEXT NOT NULL DEFAULT '',
  owner           TEXT NOT NULL,             -- email, lowercase
  created_at      INTEGER NOT NULL,          -- unix seconds
  updated_at      INTEGER NOT NULL,
  clicks          INTEGER NOT NULL DEFAULT 0,
  last_clicked_at INTEGER
);
CREATE INDEX links_owner ON links (owner);
