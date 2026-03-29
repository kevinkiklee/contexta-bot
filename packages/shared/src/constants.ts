export const SUPPORTED_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gpt-4o',
  'gpt-4o-mini',
  'claude-sonnet-4-20250514',
  'claude-haiku-4-5-20251001',
] as const;

export type SupportedModel = (typeof SUPPORTED_MODELS)[number];

export const DEFAULT_MODEL: SupportedModel = 'gemini-2.5-flash';

export const EMBEDDING_DIMS = 768;

export const MAX_DISCORD_MESSAGE_LENGTH = 2000;

export const RATE_LIMIT_MAX_REQUESTS = 2;
export const RATE_LIMIT_WINDOW_MS = 10_000;

export const CHANNEL_HISTORY_LIMIT = 50;

export const WORKER_MIN_MESSAGES = 10;

export const DISCORD_PERMISSIONS = {
  ADMINISTRATOR: 0x8n,
  MANAGE_GUILD: 0x20n,
} as const;
