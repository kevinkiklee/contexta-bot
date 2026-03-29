import Anthropic from '@anthropic-ai/sdk';
import type { IAIProvider } from './IAIProvider.js';
import { GeminiProvider } from './GeminiProvider.js';

export class AnthropicProvider implements IAIProvider {
  private client: Anthropic;
  private modelName: string;
  private geminiForEmbeddings: GeminiProvider;

  constructor(modelName = 'claude-sonnet-4-20250514') {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    this.modelName = modelName;
    this.geminiForEmbeddings = new GeminiProvider();
  }

  async generateChatResponse(
    systemPrompt: string,
    chatHistory: { role: 'user' | 'model'; parts: { text: string }[] }[],
    _cacheOptions?: { cacheId?: string; ttlMinutes?: number }
  ): Promise<string> {
    const messages: Anthropic.MessageParam[] = chatHistory.map(msg => ({
      role: (msg.role === 'model' ? 'assistant' : 'user') as 'assistant' | 'user',
      content: msg.parts.map(p => p.text).join('\n'),
    }));

    const response = await this.client.messages.create({
      model: this.modelName,
      max_tokens: 2048,
      system: systemPrompt,
      messages,
    });

    const textBlock = response.content.find(block => block.type === 'text');
    return textBlock ? textBlock.text : '';
  }

  async generateEmbedding(text: string): Promise<number[]> {
    return this.geminiForEmbeddings.generateEmbedding(text);
  }

  async summarizeText(text: string): Promise<string> {
    const response = await this.client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: 'You are an objective summarization engine. Summarize the following text accurately and concisely.',
      messages: [{ role: 'user', content: text }],
    });

    const textBlock = response.content.find(block => block.type === 'text');
    return textBlock ? textBlock.text : '';
  }

  async createServerContextCache(_lore: string, _ttlMinutes?: number): Promise<string> {
    return 'noop-anthropic-no-context-cache';
  }

  async describeAttachment(
    mimeType: string,
    base64Data: string,
    fileName: string
  ): Promise<string> {
    const response = await this.client.messages.create({
      model: this.modelName,
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mimeType as any, data: base64Data } },
            { type: 'text', text: `Describe this file (${fileName}) concisely for context in a Discord conversation. Focus on the key content, not formatting details.` },
          ],
        },
      ],
    });

    const textBlock = response.content.find(block => block.type === 'text');
    return textBlock ? textBlock.text : 'No description available';
  }
}
