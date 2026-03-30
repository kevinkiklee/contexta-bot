import { auth } from '@/lib/auth';
import { pool } from '@/lib/db';
import { checkServerAdmin } from '@/lib/auth-helpers';
import { NextResponse } from 'next/server';
import {
  approveKnowledgeEntry,
  rejectKnowledgeEntry,
  toggleKnowledgePin,
  toggleKnowledgeArchive,
} from '@/lib/queries';

const ACTIONS: Record<string, (db: typeof pool, serverId: string, entryId: string) => Promise<void>> = {
  approve: approveKnowledgeEntry,
  reject: rejectKnowledgeEntry,
  pin: toggleKnowledgePin,
  archive: toggleKnowledgeArchive,
};

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ serverId: string; entryId: string; action: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { serverId, entryId, action } = await params;

  const isAdmin = await checkServerAdmin(pool, session.user.id, serverId);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const handler = ACTIONS[action];
  if (!handler) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  await handler(pool, serverId, entryId);
  return NextResponse.json({ ok: true });
}
