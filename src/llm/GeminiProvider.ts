import { GoogleGenAI } from '@google/genai';
import { IAIProvider } from './IAIProvider.js';

export class GeminiProvider implements IAIProvider {
  private ai: GoogleGenAI;
  private modelName: string;
  private embeddingModel = 'text-embedding-004';

  constructor(modelName = 'gemini-2.5-flash') {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    this.modelName = modelName;
  }

  async generateChatResponse(
    systemPrompt: string,
    chatHistory: { role: 'user' | 'model'; parts: { text: string }[] }[],
    cacheOptions?: { cacheId?: string; ttlMinutes?: number }
  ): Promise<string> {
    const config: Record<string, any> = {};

    if (cacheOptions?.cacheId) {
      config.cachedContent = cacheOptions.cacheId;
    } else {
      config.systemInstruction = systemPrompt;
    }

    try {
      const response = await this.ai.models.generateContent({
        model: this.modelName,
        contents: chatHistory,
        config,
      });
      return response.text || '';
    } catch (err) {
      if (cacheOptions?.cacheId) {
        console.warn('[Gemini] Cache miss or expired, falling back to systemInstruction');
        const fallbackResponse = await this.ai.models.generateContent({
          model: this.modelName,
          contents: chatHistory,
          config: { systemInstruction: systemPrompt },
        });
        return fallbackResponse.text || '';
      }
      throw err;
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.ai.models.embedContent({
      model: this.embeddingModel,
      contents: text,
    });

    if (response.embeddings && response.embeddings.length > 0) {
      return response.embeddings[0].values || [];
    }
    throw new Error('Failed to generate embeddings via Gemini.');
  }

  async summarizeText(text: string): Promise<string> {
    const response = await this.ai.models.generateContent({
      model: this.modelName,
      contents: text,
      config: {
        systemInstruction: 'You are an objective summarization engine. Summarize the following text accurately and concisely.',
      },
    });
    return response.text || '';
  }

  async createServerContextCache(lore: string, ttlMinutes = 60): Promise<string> {
    const ttlSeconds = ttlMinutes * 60;

    const cache = await this.ai.caches.create({
      model: this.modelName,
      config: {
        ttl: `${ttlSeconds}s`,
        contents: [
          {
            role: 'user',
            parts: [{ text: lore }],
          },
        ],
      },
    });

    console.log(`[Gemini] Created context cache: ${cache.name} (TTL = ${ttlMinutes} mins)`);
    return cache.name!;
  }

  async describeAttachment(
    mimeType: string,
    base64Data: string,
    fileName: string
  ): Promise<string> {
    const response = await this.ai.models.generateContent({
      model: this.modelName,
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType, data: base64Data } },
          { text: `Describe this file (${fileName}) concisely for context in a Discord conversation. Focus on the key content, not formatting details.` },
        ],
      }],
      config: {
        systemInstruction: 'You are a concise file descriptor. Output a single short paragraph describing the content. No preamble.',
      },
    });

    return response.text || 'No description available';
  }
}
