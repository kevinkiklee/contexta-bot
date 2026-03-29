import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { checkServerAdmin } from '@/lib/auth-helpers';
import { getPersonality, updatePersonality } from '@/lib/queries';
import { pool } from '@/lib/db';
import { getSelectedBotId } from '@/lib/bot-cookie';
import { PersonalityForm } from './personality-form';

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
      <div className="rounded-2xl border border-error/20 bg-error/5 p-8 text-center animate-fade-in">
        <div className="w-10 h-10 rounded-xl bg-error/10 flex items-center justify-center mx-auto mb-4">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-error" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <h1 className="text-lg font-bold text-error mb-1">Access Denied</h1>
        <p className="text-text-muted text-sm">Only server administrators can configure personality.</p>
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
    redirect(`/dashboard/${serverId}/personality`);
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Personality</h1>
        <p className="text-text-muted text-sm mt-1">Configure how the bot communicates in this server</p>
      </div>

      <PersonalityForm action={handleSave} personality={personality} />
    </div>
  );
}
