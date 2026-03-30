export interface ServerSettings {
  serverId: string;
  activeModel: string;
  serverLore: string | null;
  contextCacheId: string | null;
  cacheExpiresAt: Date | null;
  isActive: boolean;
  createdAt: Date;
}

export interface GlobalUser {
  userId: string;
  globalName: string;
  createdAt: Date;
  lastInteraction: Date | null;
}

export interface ServerMember {
  serverId: string;
  userId: string;
  inferredContext: string | null;
  preferences: Record<string, unknown>;
  interactionCount: number;
}

export interface ChannelMemoryVector {
  id: string;
  serverId: string;
  channelId: string;
  summaryText: string;
  embedding: number[];
  timeStart: Date;
  timeEnd: Date;
  createdAt: Date;
}

export interface DashboardUser {
  id: string;
  username: string;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserServer {
  userId: string;
  serverId: string;
  isAdmin: boolean;
}

export interface WorkerStats {
  status: string;
  reason?: string;
  channelsProcessed: number;
  embeddingsCreated: number;
  errors: string[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export type Tone = 'friendly' | 'professional' | 'casual' | 'sarcastic' | 'academic';
export type Formality = 'low' | 'medium' | 'high';
export type Humor = 'none' | 'subtle' | 'moderate' | 'heavy';
export type Verbosity = 'concise' | 'balanced' | 'detailed';
export type LanguageStyle = 'plain' | 'technical' | 'eli5';

export interface Personality {
  tone: Tone;
  formality: Formality;
  humor: Humor;
  verbosity: Verbosity;
  languageStyle: LanguageStyle;
  customInstructions: string;
}

export const DEFAULT_PERSONALITY: Personality = {
  tone: 'friendly',
  formality: 'medium',
  humor: 'subtle',
  verbosity: 'balanced',
  languageStyle: 'plain',
  customInstructions: '',
};

// --- Knowledge Management Types ---

export type KnowledgeEntryType = 'topic' | 'decision' | 'entity' | 'action_item' | 'reference';
export type RelationshipType = 'relates_to' | 'supersedes' | 'part_of' | 'led_to';
export type LinkCreator = 'pipeline' | 'admin' | 'correction';
export type KnowledgeEntryStatus = 'published' | 'pending_review' | 'rejected';

export interface KnowledgeEntry {
  id: string;
  serverId: string;
  type: KnowledgeEntryType;
  title: string;
  content: string;
  confidence: number;
  sourceChannelId?: string;
  sourceMessageIds: string[];
  metadata: Record<string, unknown>;
  isArchived: boolean;
  isPinned: boolean;
  status: KnowledgeEntryStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface KnowledgeEntryLink {
  id: string;
  sourceId: string;
  targetId: string;
  relationship: RelationshipType;
  createdBy: LinkCreator;
  createdAt: Date;
}

export interface ChannelSummary {
  id: string;
  serverId: string;
  channelId: string;
  periodStart: Date;
  periodEnd: Date;
  summary: string;
  topics: string[];
  decisions: string[];
  openQuestions: string[];
  actionItems: string[];
  messageCount: number;
  createdAt: Date;
}

export interface UserExpertise {
  userId: string;
  serverId: string;
  topic: string;
  score: number;
  messageCount: number;
  lastSeenAt: Date;
}

export interface MessageTags {
  topics: string[];
  isDecision: boolean;
  isActionItem: boolean;
  isReference: boolean;
  confidence: number;
}

export interface KnowledgeConfig {
  extractionEnabled: boolean;
  summaryInterval: 'daily' | 'weekly';
  crossChannelEnabled: boolean;
  injectionAggressiveness: 'conservative' | 'moderate' | 'assertive';
  autoPublishThreshold: number;
  reviewRequired: boolean;
}

export const DEFAULT_KNOWLEDGE_CONFIG: KnowledgeConfig = {
  extractionEnabled: true,
  summaryInterval: 'daily',
  crossChannelEnabled: true,
  injectionAggressiveness: 'assertive',
  autoPublishThreshold: 0.7,
  reviewRequired: false,
};

export interface KnowledgeCitation {
  shortId: string;
  entryId: string;
  type: string;
  confidence: number;
  title: string;
}

export function personalityToPrompt(p: Personality): string {
  const parts: string[] = [];

  const toneMap: Record<Tone, string> = {
    friendly: 'Your tone is warm, approachable, and friendly.',
    professional: 'Your tone is professional and measured.',
    casual: 'Your tone is casual and laid-back, like chatting with a friend.',
    sarcastic: 'Your tone is sarcastic and witty — use dry humor and playful jabs.',
    academic: 'Your tone is scholarly and precise, like an informed lecturer.',
  };
  parts.push(toneMap[p.tone]);

  const formalityMap: Record<Formality, string> = {
    low: 'Use informal language — slang, abbreviations, and emojis are fine.',
    medium: 'Balance casual and formal language depending on context.',
    high: 'Use formal language — proper grammar, no slang or abbreviations.',
  };
  parts.push(formalityMap[p.formality]);

  const humorMap: Record<Humor, string> = {
    none: 'Stay serious — avoid jokes or humor.',
    subtle: 'Use occasional light humor when appropriate.',
    moderate: 'Be funny when you can — jokes and wordplay are welcome.',
    heavy: 'Be as funny as possible — prioritize humor and entertainment.',
  };
  parts.push(humorMap[p.humor]);

  const verbosityMap: Record<Verbosity, string> = {
    concise: 'Keep responses short and to the point — a few sentences max.',
    balanced: 'Give thorough but not excessive answers.',
    detailed: 'Give comprehensive, in-depth responses with examples.',
  };
  parts.push(verbosityMap[p.verbosity]);

  const styleMap: Record<LanguageStyle, string> = {
    plain: 'Use plain, everyday language anyone can understand.',
    technical: 'Use technical language and assume the audience is knowledgeable.',
    eli5: 'Explain everything as simply as possible, like talking to a beginner.',
  };
  parts.push(styleMap[p.languageStyle]);

  if (p.customInstructions.trim()) {
    parts.push(`Additional instructions: ${p.customInstructions.trim()}`);
  }

  return parts.join(' ');
}
