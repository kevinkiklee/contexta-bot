import {
  pgTable,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  uuid,
  jsonb,
  index,
  primaryKey,
  customType,
  real,
} from 'drizzle-orm/pg-core';

const vector = customType<{ data: number[]; driverParam: string }>({
  dataType() {
    return `vector(768)`;
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: unknown): number[] {
    return JSON.parse(value as string);
  },
});

export const serverSettings = pgTable('server_settings', (t) => ({
  serverId: varchar('server_id', { length: 255 }).notNull(),
  botId: varchar('bot_id', { length: 255 }).notNull().default('unknown'),
  activeModel: varchar('active_model', { length: 50 }).default('gemini-2.5-flash'),
  serverLore: text('server_lore'),
  contextCacheId: varchar('context_cache_id', { length: 255 }),
  cacheExpiresAt: timestamp('cache_expires_at'),
  personality: jsonb('personality').default('{}'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
}), (table) => [
  primaryKey({ columns: [table.serverId, table.botId] }),
]);

export const globalUsers = pgTable('global_users', {
  userId: varchar('user_id', { length: 255 }).primaryKey(),
  globalName: varchar('global_name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  lastInteraction: timestamp('last_interaction'),
});

export const serverMembers = pgTable('server_members', (t) => ({
  serverId: varchar('server_id', { length: 255 }).notNull(),
  userId: varchar('user_id', { length: 255 }).references(() => globalUsers.userId),
  inferredContext: text('inferred_context'),
  preferences: jsonb('preferences').default('{}'),
  interactionCount: integer('interaction_count').default(0),
}), (table) => [
  primaryKey({ columns: [table.serverId, table.userId] }),
]);

export const channelMemoryVectors = pgTable('channel_memory_vectors', {
  id: uuid('id').primaryKey().defaultRandom(),
  serverId: varchar('server_id', { length: 255 }).notNull(),
  channelId: varchar('channel_id', { length: 255 }).notNull(),
  summaryText: text('summary_text').notNull(),
  embedding: vector('embedding').notNull(),
  timeStart: timestamp('time_start').notNull(),
  timeEnd: timestamp('time_end').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('channel_memory_meta_idx').on(table.serverId, table.channelId),
]);

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull(),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  serverId: varchar('server_id', { length: 255 }).notNull(),
  channelId: varchar('channel_id', { length: 255 }).notNull(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  content: text('content').notNull(),
  isBot: boolean('is_bot').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  embedding: vector('embedding'),
}, (table) => [
  index('idx_messages_channel_time').on(table.serverId, table.channelId, table.createdAt),
  index('idx_messages_user').on(table.serverId, table.userId),
]);

export const userServers = pgTable('user_servers', (t) => ({
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  serverId: text('server_id').notNull(),
  isAdmin: boolean('is_admin').notNull().default(false),
  serverName: text('server_name'),
}), (table) => [
  primaryKey({ columns: [table.userId, table.serverId] }),
  index('idx_user_servers_server').on(table.serverId),
]);

export const knowledgeEntries = pgTable('knowledge_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  serverId: varchar('server_id', { length: 255 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  title: varchar('title', { length: 500 }).notNull(),
  content: text('content').notNull(),
  confidence: real('confidence').notNull().default(0.5),
  sourceChannelId: varchar('source_channel_id', { length: 255 }),
  sourceMessageIds: text('source_message_ids').array().default([]),
  embedding: vector('embedding'),
  metadata: jsonb('metadata').default({}),
  isArchived: boolean('is_archived').notNull().default(false),
  isPinned: boolean('is_pinned').notNull().default(false),
  status: varchar('status', { length: 20 }).notNull().default('published'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_ke_server_type').on(table.serverId, table.type),
  index('idx_ke_confidence').on(table.serverId, table.confidence),
  index('idx_ke_created').on(table.serverId, table.createdAt),
  index('idx_ke_status').on(table.serverId, table.status),
]);

export const knowledgeEntryLinks = pgTable('knowledge_entry_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  sourceId: uuid('source_id').notNull().references(() => knowledgeEntries.id, { onDelete: 'cascade' }),
  targetId: uuid('target_id').notNull().references(() => knowledgeEntries.id, { onDelete: 'cascade' }),
  relationship: varchar('relationship', { length: 50 }).notNull(),
  createdBy: varchar('created_by', { length: 50 }).notNull().default('pipeline'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_kel_source').on(table.sourceId),
  index('idx_kel_target').on(table.targetId),
]);

export const channelSummaries = pgTable('channel_summaries', {
  id: uuid('id').primaryKey().defaultRandom(),
  serverId: varchar('server_id', { length: 255 }).notNull(),
  channelId: varchar('channel_id', { length: 255 }).notNull(),
  periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
  summary: text('summary').notNull(),
  topics: text('topics').array().default([]),
  decisions: text('decisions').array().default([]),
  openQuestions: text('open_questions').array().default([]),
  actionItems: text('action_items').array().default([]),
  embedding: vector('embedding'),
  messageCount: integer('message_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_cs_channel_time').on(table.serverId, table.channelId, table.periodEnd),
]);

export const userExpertise = pgTable('user_expertise', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  serverId: varchar('server_id', { length: 255 }).notNull(),
  topic: varchar('topic', { length: 255 }).notNull(),
  score: real('score').notNull().default(0.0),
  messageCount: integer('message_count').notNull().default(0),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_ue_server_topic').on(table.serverId, table.topic, table.score),
  index('idx_ue_user').on(table.userId, table.serverId),
]);

export const reports = pgTable('reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  serverId: varchar('server_id', { length: 255 }).notNull(),
  template: varchar('template', { length: 50 }).notNull(),
  title: varchar('title', { length: 500 }).notNull(),
  content: text('content').notNull(),
  generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_reports_server').on(table.serverId, table.generatedAt),
]);
