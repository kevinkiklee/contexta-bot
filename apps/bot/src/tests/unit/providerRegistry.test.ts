import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getProvider, clearProviderCache } from '../../llm/providerRegistry.js';

describe('providerRegistry', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, GEMINI_API_KEY: 'test-gemini-key' };
    clearProviderCache();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns GeminiProvider for gemini-* models', () => {
    const provider = getProvider('gemini-2.5-flash');
    expect(provider.constructor.name).toBe('GeminiProvider');
  });

  it('returns GeminiProvider for gemini-2.5-pro', () => {
    const provider = getProvider('gemini-2.5-pro');
    expect(provider.constructor.name).toBe('GeminiProvider');
  });

  it('returns OpenAIProvider for gpt-* models', () => {
    process.env.OPENAI_API_KEY = 'test-openai-key';
    const provider = getProvider('gpt-4o');
    expect(provider.constructor.name).toBe('OpenAIProvider');
  });

  it('returns AnthropicProvider for claude-* models', () => {
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
    const provider = getProvider('claude-sonnet-4-20250514');
    expect(provider.constructor.name).toBe('AnthropicProvider');
  });

  it('throws for unknown model prefix', () => {
    expect(() => getProvider('llama-3')).toThrow('Unsupported model');
  });

  it('throws when OPENAI_API_KEY is missing for OpenAI model', () => {
    delete process.env.OPENAI_API_KEY;
    expect(() => getProvider('gpt-4o')).toThrow('OPENAI_API_KEY');
  });

  it('throws when ANTHROPIC_API_KEY is missing for Anthropic model', () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(() => getProvider('claude-sonnet-4-20250514')).toThrow('ANTHROPIC_API_KEY');
  });

  it('caches provider instances per model string', () => {
    const p1 = getProvider('gemini-2.5-flash');
    const p2 = getProvider('gemini-2.5-flash');
    expect(p1).toBe(p2);
  });

  it('returns different instances for different models', () => {
    process.env.OPENAI_API_KEY = 'test-openai-key';
    const gemini = getProvider('gemini-2.5-flash');
    const openai = getProvider('gpt-4o');
    expect(gemini).not.toBe(openai);
  });
});
