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
  userId: string
): Promise<{ server_id: string; server_name: string | null; is_admin: boolean; active_model: string }[]> {
  const result = await db.query(
    `SELECT us.server_id, us.server_name, us.is_admin, ss.active_model
     FROM user_servers us
     INNER JOIN server_settings ss ON us.server_id = ss.server_id
     WHERE us.user_id = $1
     ORDER BY us.server_name NULLS LAST, us.server_id`,
    [userId]
  );
  return result.rows as { server_id: string; server_name: string | null; is_admin: boolean; active_model: string }[];
}

// --- Server settings ---

export async function getServerSettings(db: DbClient, serverId: string) {
  const result = await db.query(
    'SELECT server_id, active_model, is_active FROM server_settings WHERE server_id = $1',
    [serverId]
  );
  return (result.rows[0] as { server_id: string; active_model: string; is_active: boolean }) ?? null;
}

export async function updateServerModel(db: DbClient, serverId: string, model: string): Promise<void> {
  await db.query('UPDATE server_settings SET active_model = $1 WHERE server_id = $2', [model, serverId]);
}

// --- Lore ---

export async function getServerLore(db: DbClient, serverId: string): Promise<string | null> {
  const result = await db.query(
    'SELECT server_lore FROM server_settings WHERE server_id = $1',
    [serverId]
  );
  return (result.rows[0] as { server_lore: string | null })?.server_lore ?? null;
}

export async function updateServerLore(db: DbClient, serverId: string, lore: string): Promise<void> {
  await db.query('UPDATE server_settings SET server_lore = $1 WHERE server_id = $2', [lore, serverId]);
}

// --- Channel history ---

export async function getServerChannels(
  redis: Pick<RedisReader, 'smembers' | 'get'>,
  serverId: string
): Promise<string[]> {
  const allChannels = await redis.smembers('active_channels');
  if (allChannels.length === 0) return [];

  const serverIds = await Promise.all(
    allChannels.map((channelId) => redis.get(`channel:${channelId}:server`))
  );

  return allChannels.filter((_, i) => serverIds[i] === serverId);
}

export async function getChannelHistory(
  redis: Pick<RedisReader, 'lrange'>,
  channelId: string,
  offset: number,
  limit: number
): Promise<string[]> {
  return redis.lrange(`channel:${channelId}:history`, offset, offset + limit - 1);
}
