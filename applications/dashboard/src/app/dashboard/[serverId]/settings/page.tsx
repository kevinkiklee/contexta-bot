import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { checkServerAdmin } from '@/lib/auth-helpers';
import { getServerSettings, updateServerModel } from '@/lib/queries';
import { pool } from '@/lib/db';
import { getSelectedBotId } from '@/lib/bot-cookie';

const PROVIDERS = [
  {
    name: 'Google',
    color: 'text-blue-500',
    models: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', tag: 'Fast' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', tag: 'Powerful' },
    ],
  },
  {
    name: 'OpenAI',
    color: 'text-emerald-500',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', tag: 'Balanced' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', tag: 'Efficient' },
    ],
  },
  {
    name: 'Anthropic',
    color: 'text-orange-400',
    models: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', tag: 'Creative' },
      { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', tag: 'Speedy' },
    ],
  },
];

const ALL_MODELS = PROVIDERS.flatMap((p) => p.models);

export default async function SettingsPage({
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
      <div className="rounded-xl border border-border bg-bg-raised p-8 text-center">
        <h1 className="text-lg font-bold text-error">Access Denied</h1>
        <p className="text-text-muted mt-2 text-sm">Only server administrators can access settings.</p>
      </div>
    );
  }

  const botId = await getSelectedBotId();
  const settings = await getServerSettings(pool, serverId, botId);
  const currentModel = settings?.active_model ?? 'gemini-2.5-flash';

  async function handleUpdateModel(formData: FormData) {
    'use server';
    const model = formData.get('model') as string;
    if (ALL_MODELS.some((m) => m.id === model)) {
      await updateServerModel(pool, serverId, botId, model);
    }
    revalidatePath(`/dashboard/${serverId}/settings`);
    redirect(`/dashboard/${serverId}/settings`);
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-text-muted text-sm mt-1">Configure your bot for this server</p>
      </div>

      <form action={handleUpdateModel}>
        <div className="max-w-lg space-y-6">
          {PROVIDERS.map((provider) => (
            <div key={provider.name}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`w-2 h-2 rounded-full ${provider.color.replace('text-', 'bg-')}`} />
                <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">{provider.name}</h2>
              </div>
              <div className="space-y-2">
                {provider.models.map((model) => (
                  <label
                    key={model.id}
                    className={`flex items-center gap-3 rounded-xl border p-3.5 cursor-pointer transition-all ${
                      currentModel === model.id
                        ? 'border-primary bg-primary-muted ring-1 ring-primary/50'
                        : 'border-border bg-bg-raised hover:border-border hover:bg-bg-overlay'
                    }`}
                  >
                    <input
                      type="radio"
                      name="model"
                      value={model.id}
                      defaultChecked={currentModel === model.id}
                      className="sr-only"
                    />
                    <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${
                      currentModel === model.id
                        ? 'border-primary'
                        : 'border-border'
                    }`}>
                      {currentModel === model.id && (
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{model.name}</div>
                    </div>
                    <span className="text-[10px] text-text-muted bg-bg-overlay px-2 py-0.5 rounded-md font-medium">
                      {model.tag}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}

          <button
            type="submit"
            className="btn-press rounded-xl bg-primary px-5 py-2.5 text-white text-sm font-semibold hover:bg-primary-hover transition shadow-sm shadow-primary/20"
          >
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}
