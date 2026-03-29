import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getServerChannels, getChannelHistory } from '@/lib/queries';
import { redis } from '@/lib/redis';

export default async function HistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ serverId: string }>;
  searchParams: Promise<{ channel?: string; page?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/');

  const { serverId } = await params;
  const { channel, page } = await searchParams;

  const channels = await getServerChannels(redis, serverId);
  const selectedChannel = channel ?? channels[0] ?? null;
  const currentPage = Math.max(1, parseInt(page ?? '1', 10));
  const pageSize = 50;

  let messages: string[] = [];
  if (selectedChannel) {
    messages = await getChannelHistory(redis, selectedChannel, (currentPage - 1) * pageSize, pageSize);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Conversation History</h1>

      {channels.length === 0 ? (
        <p className="text-text-muted">No conversation history found for this server.</p>
      ) : (
        <div className="flex gap-6">
          <nav className="w-48 shrink-0">
            <h2 className="text-sm font-medium text-text-muted mb-2">Channels</h2>
            <ul className="space-y-1">
              {channels.map((ch) => (
                <li key={ch}>
                  <a
                    href={`?channel=${ch}&page=1`}
                    className={`block rounded px-3 py-1.5 text-sm transition ${
                      ch === selectedChannel
                        ? 'bg-bg-overlay text-text'
                        : 'text-text-muted hover:text-text hover:bg-bg-raised'
                    }`}
                  >
                    #{ch}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex-1 min-w-0">
            {messages.length === 0 ? (
              <p className="text-text-muted">No messages in this channel.</p>
            ) : (
              <>
                <ul className="space-y-2">
                  {messages.map((msg, i) => (
                    <li key={i} className="rounded bg-bg-raised px-3 py-2 text-sm font-mono break-all">
                      {msg}
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex gap-2">
                  {currentPage > 1 && (
                    <a
                      href={`?channel=${selectedChannel}&page=${currentPage - 1}`}
                      className="rounded bg-bg-overlay px-3 py-1 text-sm hover:bg-border transition"
                    >
                      Previous
                    </a>
                  )}
                  {messages.length === pageSize && (
                    <a
                      href={`?channel=${selectedChannel}&page=${currentPage + 1}`}
                      className="rounded bg-bg-overlay px-3 py-1 text-sm hover:bg-border transition"
                    >
                      Next
                    </a>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
