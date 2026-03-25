import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { checkServerMembership } from '@/lib/auth-helpers';
import { pool } from '@/lib/db';

export default async function ServerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ serverId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/');

  const { serverId } = await params;
  const membership = await checkServerMembership(pool, session.user.id, serverId);

  if (!membership) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold text-red-400">Access Denied</h1>
        <p className="text-gray-400 mt-2">You are not a member of this server.</p>
      </div>
    );
  }

  return <>{children}</>;
}
