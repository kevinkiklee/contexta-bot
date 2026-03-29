/**
 * Standard interface for all AI interactions,
 * ensuring the bot is decoupled from any specific LLM provider.
 */
export interface IAIProvider {
  /**
   * Generates a chat response based on the provided messages.
   * @param systemPrompt The overarching server rules or context.
   * @param chatHistory The array of recent messages.
   * @param cacheOptions Optional parameters for Context Caching.
   */
  generateChatResponse(
    systemPrompt: string,
    chatHistory: { role: 'user' | 'model'; parts: { text: string }[] }[],
    cacheOptions?: { cacheId?: string; ttlMinutes?: number }
  ): Promise<string>;

  /**
   * Generates a semantic vector embedding for the given text.
   * @param text The text to embed.
   * @returns A multi-dimensional floating-point array.
   */
  generateEmbedding(text: string): Promise<number[]>;

  /**
   * Summarizes a chunk of text (e.g., chat history) for long-term storage.
   * @param text The text to summarize.
   */
  summarizeText(text: string): Promise<string>;

  /**
   * Creates a context cache for persistent server rules or lore.
   * @param lore The overarching rules text.
   * @param ttlMinutes Duration for the cache to exist.
   */
  createServerContextCache(lore: string, ttlMinutes?: number): Promise<string>;

  /**
   * Describes an image or document attachment for context in conversation.
   * @param mimeType The MIME type of the attachment.
   * @param base64Data The base64-encoded binary data.
   * @param fileName The original filename.
   */
  describeAttachment(
    mimeType: string,
    base64Data: string,
    fileName: string
  ): Promise<string>;
}
