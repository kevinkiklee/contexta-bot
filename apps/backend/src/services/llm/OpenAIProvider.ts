import OpenAI from 'openai';
import type { IAIProvider } from './IAIProvider.js';
import { GeminiProvider } from './GeminiProvider.js';

export class OpenAIProvider implements IAIProvider {
  private client: OpenAI;
  private modelName: string;
  private geminiForEmbeddings: GeminiProvider;

  constructor(modelName = 'gpt-4o') {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.modelName = modelName;
    this.geminiForEmbeddings = new GeminiProvider();
  }

  async generateChatResponse(
    systemPrompt: string,
    chatHistory: { role: 'user' | 'model'; parts: { text: string }[] }[],
    _cacheOptions?: { cacheId?: string; ttlMinutes?: number }
  ): Promise<string> {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...chatHistory.map(msg => ({
        role: (msg.role === 'model' ? 'assistant' : 'user') as 'assistant' | 'user',
        content: msg.parts.map(p => p.text).join('\n'),
      })),
    ];

    const response = await this.client.chat.completions.create({
      model: this.modelName,
      messages,
    });

    return response.choices[0]?.message?.content || '';
  }

  async generateEmbedding(text: string): Promise<number[]> {
    return this.geminiForEmbeddings.generateEmbedding(text);
  }

  async summarizeText(text: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an objective summarization engine. Summarize the following text accurately and concisely.' },
        { role: 'user', content: text },
      ],
    });
    return response.choices[0]?.message?.content || '';
  }

  async createServerContextCache(_lore: string, _ttlMinutes?: number): Promise<string> {
    return 'noop-openai-no-context-cache';
  }

  async describeAttachment(
    mimeType: string,
    base64Data: string,
    fileName: string
  ): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.modelName,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}` } },
            { type: 'text', text: `Describe this file (${fileName}) concisely for context in a Discord conversation. Focus on the key content, not formatting details.` },
          ],
        },
      ],
    });
    return response.choices[0]?.message?.content || 'No description available';
  }
}
