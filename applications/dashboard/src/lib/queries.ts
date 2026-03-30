interface DbClient {
  query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number }>;
}

interface RedisReader {
  smembers: (key: string) => Promise<string[]>;
  get: (key: string) => Promise<string | null>;
  lrange: (key: string, start: number, stop: number) => Promise<string[]>;
}

// --- Server list ---

export async function getUserServers(
  db: DbClient,
  userId: string,
  botId: string
): Promise<{ server_id: string; server_name: string | null; is_admin: boolean; active_model: string }[]> {
  const result = await db.query(
    `SELECT us.server_id, us.server_name, us.is_admin, ss.active_model
     FROM user_servers us
     INNER JOIN server_settings ss ON us.server_id = ss.server_id
     WHERE us.user_id = $1 AND ss.bot_id = $2 AND ss.is_active = true
     ORDER BY us.server_name NULLS LAST, us.server_id`,
    [userId, botId]
  );
  return result.rows as { server_id: string; server_name: string | null; is_admin: boolean; active_model: string }[];
}

// --- Server settings ---

export async function getServerSettings(db: DbClient, serverId: string, botId: string) {
  const result = await db.query(
    'SELECT server_id, bot_id, active_model, is_active FROM server_settings WHERE server_id = $1 AND bot_id = $2',
    [serverId, botId]
  );
  return (result.rows[0] as { server_id: string; bot_id: string; active_model: string; is_active: boolean }) ?? null;
}

export async function updateServerModel(db: DbClient, serverId: string, botId: string, model: string): Promise<void> {
  await db.query('UPDATE server_settings SET active_model = $1 WHERE server_id = $2 AND bot_id = $3', [model, serverId, botId]);
}

// --- Lore ---

export async function getServerLore(db: DbClient, serverId: string, botId: string): Promise<string | null> {
  const result = await db.query(
    'SELECT server_lore FROM server_settings WHERE server_id = $1 AND bot_id = $2',
    [serverId, botId]
  );
  return (result.rows[0] as { server_lore: string | null })?.server_lore ?? null;
}

export async function updateServerLore(db: DbClient, serverId: string, botId: string, lore: string): Promise<void> {
  await db.query('UPDATE server_settings SET server_lore = $1 WHERE server_id = $2 AND bot_id = $3', [lore, serverId, botId]);
}

// --- Personality ---

export async function getPersonality(db: DbClient, serverId: string, botId: string): Promise<Record<string, unknown>> {
  const result = await db.query(
    'SELECT personality FROM server_settings WHERE server_id = $1 AND bot_id = $2',
    [serverId, botId]
  );
  const raw = result.rows[0]?.personality;
  return (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
}

export async function updatePersonality(db: DbClient, serverId: string, botId: string, personality: Record<string, unknown>): Promise<void> {
  await db.query(
    'UPDATE server_settings SET personality = $1 WHERE server_id = $2 AND bot_id = $3',
    [JSON.stringify(personality), serverId, botId]
  );
}

// --- Channel history ---

export interface ChannelInfo {
  id: string;
  name: string;
}

export async function getServerChannels(
  redis: Pick<RedisReader, 'smembers' | 'get'>,
  serverId: string
): Promise<ChannelInfo[]> {
  const allChannels = await redis.smembers('active_channels');
  if (allChannels.length === 0) return [];

  const [serverIds, names] = await Promise.all([
    Promise.all(allChannels.map((id) => redis.get(`channel:${id}:server`))),
    Promise.all(allChannels.map((id) => redis.get(`channel:${id}:name`))),
  ]);

  return allChannels
    .map((id, i) => ({ id, name: names[i] || id, serverId: serverIds[i] }))
    .filter((ch) => ch.serverId === serverId)
    .map(({ id, name }) => ({ id, name }));
}

export async function getChannelHistory(
  redis: Pick<RedisReader, 'lrange'>,
  channelId: string,
  offset: number,
  limit: number
): Promise<string[]> {
  return redis.lrange(`channel:${channelId}:history`, offset, offset + limit - 1);
}

// --- Messages (Postgres) ---

export interface MessageRow {
  id: string;
  server_id: string;
  channel_id: string;
  user_id: string;
  display_name: string;
  content: string;
  is_bot: boolean;
  created_at: string;
}

export interface MessageQuery {
  serverId: string;
  channelId?: string;
  q?: string;
  userId?: string;
  botOnly?: boolean;
  before?: string;
  limit?: number;
}

export async function getMessages(
  db: DbClient,
  query: MessageQuery
): Promise<{ messages: MessageRow[]; nextCursor: string | null }> {
  const { serverId, channelId, q, userId, botOnly, before, limit = 50 } = query;

  const conditions: string[] = ['server_id = $1'];
  const params: unknown[] = [serverId];
  let idx = 2;

  if (channelId) { conditions.push(`channel_id = $${idx++}`); params.push(channelId); }
  if (userId) { conditions.push(`user_id = $${idx++}`); params.push(userId); }
  if (botOnly) { conditions.push('is_bot = true'); }
  if (before) { conditions.push(`created_at < $${idx++}`); params.push(before); }

  const where = conditions.join(' AND ');

  // Full-text search
  if (q) {
    params.push(q);
    params.push(limit);
    const result = await db.query(
      `SELECT id, server_id, channel_id, user_id, display_name, content, is_bot, created_at,
              ts_rank(search_vec, plainto_tsquery('english', $${idx})) AS rank
       FROM messages
       WHERE ${where} AND search_vec @@ plainto_tsquery('english', $${idx++})
       ORDER BY rank DESC, created_at DESC
       LIMIT $${idx}`,
      params
    );
    return { messages: result.rows as unknown as MessageRow[], nextCursor: null };
  }

  // Chronological browse
  params.push(limit + 1);
  const result = await db.query(
    `SELECT id, server_id, channel_id, user_id, display_name, content, is_bot, created_at
     FROM messages
     WHERE ${where}
     ORDER BY created_at DESC
     LIMIT $${idx}`,
    params
  );

  const rows = result.rows as unknown as MessageRow[];
  const hasMore = rows.length > limit;
  if (hasMore) rows.pop();

  return {
    messages: rows,
    nextCursor: hasMore && rows.length > 0 ? rows[rows.length - 1].created_at : null,
  };
}

export async function getMessageUsers(
  db: DbClient,
  serverId: string
): Promise<{ user_id: string; display_name: string; is_bot: boolean }[]> {
  const result = await db.query(
    `SELECT DISTINCT user_id, display_name, is_bot
     FROM messages WHERE server_id = $1 ORDER BY display_name`,
    [serverId]
  );
  return result.rows as { user_id: string; display_name: string; is_bot: boolean }[];
}

export async function getMessageChannels(
  db: DbClient,
  serverId: string
): Promise<{ channel_id: string; channel_name: string }[]> {
  // Get distinct channels from messages, with name from Redis fallback to ID
  const result = await db.query(
    `SELECT DISTINCT channel_id FROM messages WHERE server_id = $1 ORDER BY channel_id`,
    [serverId]
  );
  return (result.rows as { channel_id: string }[]).map((r) => ({
    channel_id: r.channel_id,
    channel_name: r.channel_id, // Will be enriched with Redis channel names in the page
  }));
}

// --- Knowledge queries ---

export interface KnowledgeEntryRow {
  id: string;
  server_id: string;
  type: string;
  title: string;
  content: string;
  confidence: number;
  status: string;
  source_channel_id: string | null;
  is_archived: boolean;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeStats {
  published: number;
  pending_review: number;
  rejected: number;
  archived: number;
  avg_confidence: number;
  created_this_week: number;
}

export interface KnowledgeFilters {
  serverId: string;
  status?: string;
  type?: string;
  search?: string;
  pinnedOnly?: boolean;
  before?: string;
  limit?: number;
}

export async function getKnowledgeEntries(
  db: DbClient,
  filters: KnowledgeFilters
): Promise<{ entries: KnowledgeEntryRow[]; nextCursor: string | null }> {
  const { serverId, status, type, search, pinnedOnly, before, limit = 20 } = filters;

  const conditions: string[] = ['server_id = $1', 'is_archived = false'];
  const params: unknown[] = [serverId];
  let idx = 2;

  if (status) {
    conditions.push(`status = $${idx++}`);
    params.push(status);
  }
  if (type) {
    conditions.push(`type = $${idx++}`);
    params.push(type);
  }
  if (pinnedOnly) {
    conditions.push('is_pinned = true');
  }
  if (before) {
    conditions.push(`created_at < $${idx++}`);
    params.push(before);
  }
  if (search) {
    conditions.push(`(title ILIKE $${idx} OR content ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }

  params.push(limit + 1);

  const result = await db.query(
    `SELECT id, server_id, type, title, content, confidence, status, source_channel_id, is_archived, is_pinned, created_at, updated_at
     FROM knowledge_entries
     WHERE ${conditions.join(' AND ')}
     ORDER BY created_at DESC
     LIMIT $${idx}`,
    params
  );

  const rows = result.rows as unknown as KnowledgeEntryRow[];
  const hasMore = rows.length > limit;
  if (hasMore) rows.pop();
  return {
    entries: rows,
    nextCursor: hasMore && rows.length > 0 ? rows[rows.length - 1].created_at : null,
  };
}

export async function getKnowledgeStats(db: DbClient, serverId: string): Promise<KnowledgeStats> {
  const result = await db.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'published' AND NOT is_archived)::int AS published,
       COUNT(*) FILTER (WHERE status = 'pending_review' AND NOT is_archived)::int AS pending_review,
       COUNT(*) FILTER (WHERE status = 'rejected' AND NOT is_archived)::int AS rejected,
       COUNT(*) FILTER (WHERE is_archived)::int AS archived,
       COALESCE(ROUND(AVG(confidence)::numeric, 2), 0)::float AS avg_confidence,
       COUNT(*) FILTER (WHERE created_at > now() - interval '7 days' AND NOT is_archived)::int AS created_this_week
     FROM knowledge_entries
     WHERE server_id = $1`,
    [serverId]
  );

  return (result.rows[0] as unknown as KnowledgeStats) ?? {
    published: 0, pending_review: 0, rejected: 0, archived: 0, avg_confidence: 0, created_this_week: 0,
  };
}

export async function approveKnowledgeEntry(db: DbClient, serverId: string, entryId: string): Promise<void> {
  await db.query(
    `UPDATE knowledge_entries SET status = 'published', updated_at = now() WHERE server_id = $1 AND id = $2`,
    [serverId, entryId]
  );
}

export async function rejectKnowledgeEntry(db: DbClient, serverId: string, entryId: string): Promise<void> {
  await db.query(
    `UPDATE knowledge_entries SET status = 'rejected', updated_at = now() WHERE server_id = $1 AND id = $2`,
    [serverId, entryId]
  );
}

export async function toggleKnowledgePin(db: DbClient, serverId: string, entryId: string): Promise<void> {
  await db.query(
    `UPDATE knowledge_entries SET is_pinned = NOT is_pinned, updated_at = now() WHERE server_id = $1 AND id = $2`,
    [serverId, entryId]
  );
}

export async function toggleKnowledgeArchive(db: DbClient, serverId: string, entryId: string): Promise<void> {
  await db.query(
    `UPDATE knowledge_entries SET is_archived = NOT is_archived, updated_at = now() WHERE server_id = $1 AND id = $2`,
    [serverId, entryId]
  );
}

export async function updateKnowledgeEntry(
  db: DbClient,
  serverId: string,
  entryId: string,
  data: { title?: string; content?: string; type?: string; confidence?: number }
): Promise<void> {
  const sets: string[] = ['updated_at = now()'];
  const params: unknown[] = [serverId, entryId];
  let idx = 3;

  if (data.title !== undefined) { sets.push(`title = $${idx++}`); params.push(data.title); }
  if (data.content !== undefined) { sets.push(`content = $${idx++}`); params.push(data.content); }
  if (data.type !== undefined) { sets.push(`type = $${idx++}`); params.push(data.type); }
  if (data.confidence !== undefined) { sets.push(`confidence = $${idx++}`); params.push(data.confidence); }

  await db.query(
    `UPDATE knowledge_entries SET ${sets.join(', ')} WHERE server_id = $1 AND id = $2`,
    params
  );
}

export async function getKnowledgeConfig(db: DbClient, serverId: string, botId: string) {
  const result = await db.query(
    `SELECT knowledge_config FROM server_settings WHERE server_id = $1 AND bot_id = $2`,
    [serverId, botId]
  );
  return (result.rows[0] as { knowledge_config: Record<string, unknown> } | undefined)?.knowledge_config ?? null;
}

export async function updateKnowledgeConfig(
  db: DbClient,
  serverId: string,
  botId: string,
  config: { autoPublishThreshold: number; reviewRequired: boolean }
): Promise<void> {
  await db.query(
    `UPDATE server_settings
     SET knowledge_config = COALESCE(knowledge_config, '{}'::jsonb) || $3::jsonb
     WHERE server_id = $1 AND bot_id = $2`,
    [serverId, botId, JSON.stringify(config)]
  );
}
