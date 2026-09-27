-- Playloop · initial schema. Abstract entities only.

CREATE TABLE IF NOT EXISTS game_type (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  requires_dictionary INTEGER NOT NULL DEFAULT 0,
  registered_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS game_instance (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  game_type_key TEXT NOT NULL REFERENCES game_type(key),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  theme_json TEXT NOT NULL,
  settings_json TEXT NOT NULL,
  published INTEGER NOT NULL DEFAULT 0,
  expert_mode_enabled INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS game_instance_type_idx ON game_instance(game_type_key);
CREATE INDEX IF NOT EXISTS game_instance_published_idx ON game_instance(published);

CREATE TABLE IF NOT EXISTS content_item (
  id TEXT PRIMARY KEY,
  game_instance_id TEXT NOT NULL REFERENCES game_instance(id),
  position INTEGER NOT NULL DEFAULT 0,
  payload_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS content_item_instance_idx ON content_item(game_instance_id, position);

CREATE TABLE IF NOT EXISTS dictionary_entry (
  id TEXT PRIMARY KEY,
  game_instance_id TEXT NOT NULL REFERENCES game_instance(id),
  value TEXT NOT NULL,
  aliases_json TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS dictionary_entry_instance_idx ON dictionary_entry(game_instance_id);

CREATE TABLE IF NOT EXISTS player (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS account (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES player(id),
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS score_entry (
  id TEXT PRIMARY KEY,
  game_instance_id TEXT NOT NULL REFERENCES game_instance(id),
  player_id TEXT NOT NULL REFERENCES player(id),
  score INTEGER NOT NULL,
  rounds_played INTEGER NOT NULL,
  best_streak INTEGER NOT NULL DEFAULT 0,
  mode TEXT NOT NULL,
  ranked INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- The leaderboard is always per game instance, never global.
CREATE INDEX IF NOT EXISTS score_entry_ranking_idx
  ON score_entry(game_instance_id, ranked, score DESC);

CREATE TABLE IF NOT EXISTS blocked_term (
  id TEXT PRIMARY KEY,
  term TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS moderation_flag (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES player(id),
  hidden INTEGER NOT NULL DEFAULT 1,
  reason TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS app_setting (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
