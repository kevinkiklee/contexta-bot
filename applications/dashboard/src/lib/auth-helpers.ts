const MANAGE_GUILD = 0x20n;
const ADMINISTRATOR = 0x8n;

export function hasManageGuild(permissionsString: string): boolean {
  const perms = BigInt(permissionsString);
  return (perms & ADMINISTRATOR) !== 0n || (perms & MANAGE_GUILD) !== 0n;
}

export interface GuildPermission {
  serverId: string;
  isAdmin: boolean;
}

export function parseGuildPermissions(
  guilds: { id: string; name: string; permissions: string }[]
): (GuildPermission & { name: string })[] {
  return guilds.map(g => ({
    serverId: g.id,
    name: g.name,
    isAdmin: hasManageGuild(g.permissions),
  }));
}

interface DbClient {
  query: (text: string, params?: unknown[]) => Promise<unknown>;
}

interface UserProfile {
  id: string;
  username: string;
  avatar_url: string | null;
}

export async function syncUserGuilds(
  db: DbClient,
  user: UserProfile,
  guilds: { id: string; name: string; permissions: string }[]
): Promise<void> {
  await db.query(
    `INSERT INTO users (id, username, avatar_url) VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET username = $2, avatar_url = $3, updated_at = NOW()`,
    [user.id, user.username, user.avatar_url]
  );

  await db.query('DELETE FROM user_servers WHERE user_id = $1', [user.id]);

  if (guilds.length === 0) return;

  const parsed = parseGuildPermissions(guilds);
  const values = parsed.map((g, i) => `($1, $${i * 3 + 2}, $${i * 3 + 3}, $${i * 3 + 4})`).join(', ');
  const params: unknown[] = [user.id];
  for (const g of parsed) {
    params.push(g.serverId, g.isAdmin, g.name);
  }

  await db.query(`INSERT INTO user_servers (user_id, server_id, is_admin, server_name) VALUES ${values}`, params);
}

interface UserServerRow {
  user_id: string;
  server_id: string;
  is_admin: boolean;
}

export async function checkServerMembership(
  db: DbClient,
  userId: string,
  serverId: string
): Promise<UserServerRow | null> {
  const result = await db.query(
    'SELECT user_id, server_id, is_admin FROM user_servers WHERE user_id = $1 AND server_id = $2',
    [userId, serverId]
  ) as { rows: UserServerRow[] };
  return result.rows[0] ?? null;
}

export async function checkServerAdmin(
  db: DbClient,
  userId: string,
  serverId: string
): Promise<boolean> {
  const membership = await checkServerMembership(db, userId, serverId);
  return membership?.is_admin ?? false;
}
