import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getMessages, getMessageUsers, getServerChannels } from '@/lib/queries';
import { pool } from '@/lib/db';
import { redis } from '@/lib/redis';
import { MessageList } from './message-list';

export default async function HistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ serverId: string }>;
  searchParams: Promise<{
    channel?: string;
    q?: string;
    userId?: string;
    botOnly?: string;
    before?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/');

  const { serverId } = await params;
  const { channel, q, userId, botOnly, before } = await searchParams;

  const [result, users, channels] = await Promise.all([
    getMessages(pool, {
      serverId,
      channelId: channel || undefined,
      q: q || undefined,
      userId: userId || undefined,
      botOnly: botOnly === 'true',
      before: before || undefined,
      limit: 50,
    }),
    getMessageUsers(pool, serverId),
    getServerChannels(redis, serverId),
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Message Log</h1>
        <p className="text-text-muted text-sm mt-1">
          {q ? `Search results for "${q}"` : 'Browse and search conversation history'}
        </p>
      </div>

      <MessageList
        serverId={serverId}
        messages={result.messages}
        nextCursor={result.nextCursor}
        channels={channels}
        users={users}
        activeChannel={channel || ''}
        activeQuery={q || ''}
        activeUserId={userId || ''}
        activeBotOnly={botOnly === 'true'}
      />
    </div>
  );
}
