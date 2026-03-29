import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { checkServerMembership } from '@/lib/auth-helpers';
import { pool } from '@/lib/db';
import Link from 'next/link';

export default async function ServerOverviewPage({
  params,
}: {
  params: Promise<{ serverId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/');

  const { serverId } = await params;
  const membership = await checkServerMembership(pool, session.user.id, serverId);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Server: {serverId}</h1>
      <div className="flex flex-col gap-3">
        {membership?.is_admin && (
          <>
            <Link
              href={`/dashboard/${serverId}/settings`}
              className="rounded-lg border border-gray-800 p-4 hover:border-gray-600 transition"
            >
              Settings — Configure bot model and cache
            </Link>
            <Link
              href={`/dashboard/${serverId}/lore`}
              className="rounded-lg border border-gray-800 p-4 hover:border-gray-600 transition"
            >
              Lore — Edit server rules and themes
            </Link>
          </>
        )}
        <Link
          href={`/dashboard/${serverId}/history`}
          className="rounded-lg border border-gray-800 p-4 hover:border-gray-600 transition"
        >
          History — Browse conversation history
        </Link>
      </div>
    </div>
  );
}
