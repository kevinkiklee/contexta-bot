import { auth } from '@/lib/auth';
import { checkServerMembership } from '@/lib/auth-helpers';
import { getServerChannels } from '@/lib/queries';
import { pool } from '@/lib/db';
import { redis } from '@/lib/redis';
import { NextResponse } from 'next/server';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ serverId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json([], { status: 401 });

  const { serverId } = await params;
  const membership = await checkServerMembership(pool, session.user.id, serverId);
  if (!membership) return NextResponse.json([], { status: 403 });

  const channels = await getServerChannels(redis, serverId);
  return NextResponse.json(channels);
}
