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
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Conversation History</h1>
        <p className="text-text-muted text-sm mt-1">Browse recent conversations by channel</p>
      </div>

      {channels.length === 0 ? (
        <div className="rounded-xl border border-border bg-bg-raised p-8 text-center">
          <p className="text-text-muted">No conversation history found for this server.</p>
        </div>
      ) : (
        <>
          {/* Channel tabs */}
          <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
            {channels.map((ch) => (
              <a
                key={ch}
                href={`?channel=${ch}&page=1`}
                className={`shrink-0 px-3 py-1.5 rounded-md text-sm transition ${
                  ch === selectedChannel
                    ? 'bg-primary text-white font-medium'
                    : 'text-text-muted hover:text-text hover:bg-bg-raised'
                }`}
              >
                #{ch}
              </a>
            ))}
          </div>

          {/* Messages */}
          <div className="rounded-xl border border-border bg-bg-raised overflow-hidden">
            {messages.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-text-muted">No messages in this channel.</p>
              </div>
            ) : (
              <>
                <ul className="divide-y divide-border">
                  {messages.map((msg, i) => (
                    <li key={i} className="px-4 py-3 text-sm font-mono break-all text-text-subtle">
                      {msg}
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between border-t border-border px-4 py-3">
                  <div>
                    {currentPage > 1 ? (
                      <a
                        href={`?channel=${selectedChannel}&page=${currentPage - 1}`}
                        className="btn-press text-sm text-text-muted hover:text-text transition"
                      >
                        ← Previous
                      </a>
                    ) : (
                      <span />
                    )}
                  </div>
                  <span className="text-xs text-text-muted">Page {currentPage}</span>
                  <div>
                    {messages.length === pageSize && (
                      <a
                        href={`?channel=${selectedChannel}&page=${currentPage + 1}`}
                        className="btn-press text-sm text-text-muted hover:text-text transition"
                      >
                        Next →
                      </a>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
