import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

/**
 * Every table below is deliberately abstract. No column, table or index may
 * name a content domain — the first real theme arrives as rows, through the
 * panel, long after this file is written.
 */

/** The catalogue of reusable game mechanics. Rows are seeded from the code registry. */
export const gameType = sqliteTable("game_type", {
  key: text("key").primaryKey(),
  label: text("label").notNull(),
  description: text("description").notNull().default(""),
  requiresDictionary: integer("requires_dictionary", { mode: "boolean" })
    .notNull()
    .default(false),
  registeredAt: integer("registered_at").notNull(),
})

/** One playable product: type + theme + settings + content. */
export const gameInstance = sqliteTable("game_instance", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  gameTypeKey: text("game_type_key").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  /** Serialised `Theme`. The engine owns its validation. */
  themeJson: text("theme_json").notNull(),
  /** Serialised settings, validated by the instance's game type schema. */
  settingsJson: text("settings_json").notNull(),
  published: integer("published", { mode: "boolean" }).notNull().default(false),
  expertModeEnabled: integer("expert_mode_enabled", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
})

/** One piece of content. `payload_json`'s shape belongs to the game type. */
export const contentItem = sqliteTable("content_item", {
  id: text("id").primaryKey(),
  gameInstanceId: text("game_instance_id").notNull(),
  position: integer("position").notNull().default(0),
  payloadJson: text("payload_json").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
})

/** The curated universe of valid answers for one instance. */
export const dictionaryEntry = sqliteTable("dictionary_entry", {
  id: text("id").primaryKey(),
  gameInstanceId: text("game_instance_id").notNull(),
  value: text("value").notNull(),
  aliasesJson: text("aliases_json").notNull().default("[]"),
  createdAt: integer("created_at").notNull(),
})

/**
 * A stable identity for a player. Today it is created on first use with no
 * login; when real accounts exist, an `account` row points at the same player,
 * so the score history never has to be migrated.
 */
export const player = sqliteTable("player", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull().default(""),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
})

/** Reserved for a future auth provider. Empty today. */
export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  playerId: text("player_id").notNull(),
  createdAt: integer("created_at").notNull(),
})

/** One finished ranked attempt. Only server-verified rows land here. */
export const scoreEntry = sqliteTable("score_entry", {
  id: text("id").primaryKey(),
  gameInstanceId: text("game_instance_id").notNull(),
  playerId: text("player_id").notNull(),
  score: integer("score").notNull(),
  roundsPlayed: integer("rounds_played").notNull(),
  bestStreak: integer("best_streak").notNull().default(0),
  mode: text("mode").notNull(),
  /** False for offline/practice results that must never enter the ranking. */
  ranked: integer("ranked", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull(),
})

/** Configurable block list for the automatic name filter. */
export const blockedTerm = sqliteTable("blocked_term", {
  id: text("id").primaryKey(),
  term: text("term").notNull().unique(),
  createdAt: integer("created_at").notNull(),
})

/** Manual moderation backup for names the automatic filter did not catch. */
export const moderationFlag = sqliteTable("moderation_flag", {
  id: text("id").primaryKey(),
  playerId: text("player_id").notNull(),
  hidden: integer("hidden", { mode: "boolean" }).notNull().default(true),
  reason: text("reason").notNull().default(""),
  createdAt: integer("created_at").notNull(),
})

/** Runtime settings the panel owns: themes, limits and moderation options. */
export const appSetting = sqliteTable("app_setting", {
  key: text("key").primaryKey(),
  valueJson: text("value_json").notNull(),
  updatedAt: integer("updated_at").notNull(),
})
