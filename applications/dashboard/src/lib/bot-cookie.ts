import { cookies } from 'next/headers';
import { getBots, getBot } from './bots';

export async function getSelectedBotId(): Promise<string> {
  const cookieStore = await cookies();
  const stored = cookieStore.get('bot_id')?.value;
  const bot = getBot(stored);
  return bot?.botId ?? 'unknown';
}
