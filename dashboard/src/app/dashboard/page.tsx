import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getUserServers } from '@/lib/queries';
import { pool } from '@/lib/db';
import Link from 'next/link';

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/');

  const servers = await getUserServers(pool, session.user.id);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Your Servers</h1>
      {servers.length === 0 ? (
        <p className="text-gray-400">
          No servers found. Make sure Contexta is added to your Discord server.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {servers.map((server) => (
            <Link
              key={server.server_id}
              href={`/dashboard/${server.server_id}`}
              className="block rounded-lg border border-gray-800 p-4 hover:border-gray-600 transition"
            >
              <h2 className="font-semibold">{server.server_id}</h2>
              <p className="text-sm text-gray-400 mt-1">
                {server.is_admin ? 'Admin' : 'Member'} &middot; {server.active_model}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
