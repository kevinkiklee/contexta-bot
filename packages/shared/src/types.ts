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
