CREATE TABLE topics (
  id TEXT PRIMARY KEY,
  rkey TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  keywords TEXT NOT NULL,          -- JSON array of lowercase strings
  exclude_keywords TEXT NOT NULL,  -- JSON array of lowercase strings
  created_at INTEGER NOT NULL
);

CREATE TABLE posts (
  uri TEXT NOT NULL,
  topic_id TEXT NOT NULL REFERENCES topics(id),
  indexed_at INTEGER NOT NULL,
  PRIMARY KEY (uri, topic_id)
);

CREATE INDEX idx_posts_topic_time ON posts (topic_id, indexed_at DESC);
