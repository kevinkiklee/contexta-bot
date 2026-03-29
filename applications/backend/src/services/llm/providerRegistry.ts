import type { IAIProvider } from './IAIProvider.js';
import { GeminiProvider } from './GeminiProvider.js';
import { OpenAIProvider } from './OpenAIProvider.js';
import { AnthropicProvider } from './AnthropicProvider.js';

const providerCache = new Map<string, IAIProvider>();

function getProviderPrefix(modelName: string): string {
  if (modelName.startsWith('gemini-')) return 'gemini';
  if (modelName.startsWith('gpt-')) return 'openai';
  if (modelName.startsWith('claude-')) return 'anthropic';
  throw new Error(`Unsupported model: "${modelName}". Expected a model starting with gemini-, gpt-, or claude-.`);
}

export function getProvider(modelName: string): IAIProvider {
  const cached = providerCache.get(modelName);
  if (cached) return cached;

  const prefix = getProviderPrefix(modelName);
  let provider: IAIProvider;

  switch (prefix) {
    case 'gemini':
      provider = new GeminiProvider(modelName);
      break;
    case 'openai':
      if (!process.env.OPENAI_API_KEY) {
        throw new Error(`OPENAI_API_KEY is required to use ${modelName}. Set it in your environment variables.`);
      }
      provider = new OpenAIProvider(modelName);
      break;
    case 'anthropic':
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error(`ANTHROPIC_API_KEY is required to use ${modelName}. Set it in your environment variables.`);
      }
      provider = new AnthropicProvider(modelName);
      break;
    default:
      throw new Error(`Unsupported model prefix: ${prefix}`);
  }

  providerCache.set(modelName, provider);
  return provider;
}

export function clearProviderCache(): void {
  providerCache.clear();
}
