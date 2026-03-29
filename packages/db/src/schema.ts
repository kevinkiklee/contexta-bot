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

export const serverSettings = pgTable('server_settings', {
  serverId: varchar('server_id', { length: 255 }).primaryKey(),
  activeModel: varchar('active_model', { length: 50 }).default('gemini-2.5-flash'),
  serverLore: text('server_lore'),
  contextCacheId: varchar('context_cache_id', { length: 255 }),
  cacheExpiresAt: timestamp('cache_expires_at'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

export const globalUsers = pgTable('global_users', {
  userId: varchar('user_id', { length: 255 }).primaryKey(),
  globalName: varchar('global_name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  lastInteraction: timestamp('last_interaction'),
});

export const serverMembers = pgTable('server_members', (t) => ({
  serverId: varchar('server_id', { length: 255 }).references(() => serverSettings.serverId),
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

export const userServers = pgTable('user_servers', (t) => ({
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  serverId: text('server_id').notNull(),
  isAdmin: boolean('is_admin').notNull().default(false),
}), (table) => [
  primaryKey({ columns: [table.userId, table.serverId] }),
  index('idx_user_servers_server').on(table.serverId),
]);
