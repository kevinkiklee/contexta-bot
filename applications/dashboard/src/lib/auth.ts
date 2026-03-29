import NextAuth from 'next-auth';
import { syncUserGuilds } from './auth-helpers';
import { pool } from './db';
import { authConfig } from './auth.config';

const DISCORD_API_BASE = 'https://discord.com/api/v10';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      if (!account?.access_token) return false;

      const res = await fetch(`${DISCORD_API_BASE}/users/@me/guilds`, {
        headers: { Authorization: `Bearer ${account.access_token}` },
      });

      if (!res.ok) {
        console.error('[Auth] Failed to fetch guilds:', res.status);
        return false;
      }

      const guilds = (await res.json()) as { id: string; permissions: string }[];

      await syncUserGuilds(pool, {
        id: user.id!,
        username: user.name ?? 'Unknown',
        avatar_url: user.image ?? null,
      }, guilds);

      return true;
    },
  },
});
