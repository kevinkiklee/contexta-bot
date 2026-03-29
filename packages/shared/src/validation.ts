import { z } from 'zod';
import { SUPPORTED_MODELS } from './constants.js';

export const SwitchModelSchema = z.object({
  model: z.enum(SUPPORTED_MODELS),
});

export const UpdateLoreSchema = z.object({
  text: z.string().min(1).max(10_000),
});

export const AskQuerySchema = z.object({
  serverId: z.string().min(1),
  query: z.string().min(1).max(4_000),
});

export const SummarizeSchema = z.object({
  serverId: z.string().min(1),
  channelId: z.string().min(1),
  messages: z.array(z.string()),
});

export const EmbeddingRequestSchema = z.object({
  serverId: z.string().min(1),
  channelId: z.string().min(1),
  text: z.string().min(1),
});
