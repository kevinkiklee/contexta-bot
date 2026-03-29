export interface BotConfig {
  label: string;
  botId: string;
}

/**
 * Parse BOTS env var: "Dev:123456,Prod:789012"
 * Returns array of { label, botId }. First entry is the default.
 */
export function parseBots(): BotConfig[] {
  const raw = process.env.BOTS || '';
  if (!raw) return [];
  return raw.split(',').map((entry) => {
    const [label, botId] = entry.trim().split(':');
    return { label: label.trim(), botId: botId.trim() };
  }).filter((b) => b.label && b.botId);
}

/** Get bot configs. Cached after first call. */
let _bots: BotConfig[] | null = null;
export function getBots(): BotConfig[] {
  if (!_bots) _bots = parseBots();
  return _bots;
}

/** Find bot by ID, or return the first (default) bot. */
export function getBot(botId: string | undefined): BotConfig | undefined {
  const bots = getBots();
  if (!botId) return bots[0];
  return bots.find((b) => b.botId === botId) ?? bots[0];
}
