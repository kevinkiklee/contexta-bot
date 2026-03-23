import { GoogleGenAI } from '@google/genai';
import { IAIProvider } from './IAIProvider.js';

export class GeminiProvider implements IAIProvider {
  private ai: GoogleGenAI;
  private modelName = 'gemini-2.5-flash';
  private embeddingModel = 'text-embedding-004';

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }

  async generateChatResponse(
    systemPrompt: string,
    chatHistory: { role: 'user' | 'model'; parts: { text: string }[] }[],
    cacheOptions?: { cacheId?: string; ttlMinutes?: number }
  ): Promise<string> {
    // Note for Context Caching: In a full production build, we would pass the
    // existing `cacheOptions.cacheId` directly to the API instead of `systemInstruction`.
    
    const response = await this.ai.models.generateContent({
      model: this.modelName,
      contents: chatHistory,
      config: {
        systemInstruction: systemPrompt,
      }
    });

    return response.text || '';
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.ai.models.embedContent({
      model: this.embeddingModel,
      contents: text
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
      }
    });
    return response.text || '';
  }

  async createServerContextCache(lore: string, ttlMinutes = 60): Promise<string> {
    console.log(`[Gemini] Mock creating context cache for server rules (TTL = ${ttlMinutes} mins)`);
    // Full implementation relies on uploading boundaries to the File API 
    // and calling ai.caches.create.
    // For now, this placeholder returns a mock cache ID that would be saved in PG.
    return `cached-lore-${Date.now()}`;
  }
}
