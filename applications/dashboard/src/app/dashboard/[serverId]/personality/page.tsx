import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { checkServerAdmin } from '@/lib/auth-helpers';
import { getPersonality, updatePersonality } from '@/lib/queries';
import { pool } from '@/lib/db';
import { getSelectedBotId } from '@/lib/bot-cookie';
import { PersonalityForm } from './personality-form';
import { SavedBanner } from '@/components/saved-banner';

const DEFAULTS = {
  tone: 'friendly',
  formality: 'medium',
  humor: 'subtle',
  verbosity: 'balanced',
  languageStyle: 'plain',
  customInstructions: '',
};

export default async function PersonalityPage({
  params,
}: {
  params: Promise<{ serverId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/');

  const { serverId } = await params;
  const isAdmin = await checkServerAdmin(pool, session.user.id, serverId);
  if (!isAdmin) {
    return (
      <div className="border border-border rounded-lg p-6 bg-bg-raised flex items-center gap-3">
        <svg className="w-5 h-5 text-text-muted shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
        <p className="text-sm text-text-muted">You need admin permissions to access this page.</p>
      </div>
    );
  }

  const botId = await getSelectedBotId();
  const raw = await getPersonality(pool, serverId, botId);
  const personality = { ...DEFAULTS, ...raw };

  async function handleSave(formData: FormData) {
    'use server';
    const updated = {
      tone: formData.get('tone') as string,
      formality: formData.get('formality') as string,
      humor: formData.get('humor') as string,
      verbosity: formData.get('verbosity') as string,
      languageStyle: formData.get('languageStyle') as string,
      customInstructions: (formData.get('customInstructions') as string || '').slice(0, 1000),
    };
    await updatePersonality(pool, serverId, botId, updated);
    revalidatePath(`/dashboard/${serverId}/personality`);
    redirect(`/dashboard/${serverId}/personality?saved=true`);
  }

  return (
    <div>
      <SavedBanner />

      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Personality</h1>
        <p className="text-text-muted text-sm mt-1">Configure how the bot communicates in this server</p>
      </div>

      <PersonalityForm action={handleSave} personality={personality} />
    </div>
  );
}
