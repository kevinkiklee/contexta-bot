import { describe, it, expect, vi } from 'vitest';
import { createMockDb } from '../helpers/mockDb';
import {
  getUserServers,
  getServerSettings,
  updateServerModel,
  getServerLore,
  updateServerLore,
  getServerChannels,
  getChannelHistory,
} from '@/lib/queries';

const BOT_ID = 'bot-123';

describe('getUserServers', () => {
  it('returns servers where bot is present (inner join with server_settings)', async () => {
    const db = createMockDb();
    db.query.mockResolvedValueOnce({
      rows: [
        { server_id: 's1', is_admin: true, active_model: 'gemini-2.5-flash' },
        { server_id: 's2', is_admin: false, active_model: 'gemini-2.5-pro' },
      ],
      rowCount: 2,
    });

    const result = await getUserServers(db, 'user-1', BOT_ID);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ server_id: 's1', is_admin: true, active_model: 'gemini-2.5-flash' });
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INNER JOIN server_settings'),
      ['user-1', BOT_ID]
    );
  });

  it('returns empty array when user has no servers with bot', async () => {
    const db = createMockDb();
    db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const result = await getUserServers(db, 'user-1', BOT_ID);
    expect(result).toEqual([]);
  });
});

describe('getServerSettings', () => {
  it('returns server settings row', async () => {
    const db = createMockDb();
    db.query.mockResolvedValueOnce({
      rows: [{ server_id: 's1', bot_id: BOT_ID, active_model: 'gemini-2.5-flash', is_active: true }],
      rowCount: 1,
    });

    const result = await getServerSettings(db, 's1', BOT_ID);
    expect(result).toEqual({ server_id: 's1', bot_id: BOT_ID, active_model: 'gemini-2.5-flash', is_active: true });
  });

  it('returns null when server not found', async () => {
    const db = createMockDb();
    const result = await getServerSettings(db, 's1', BOT_ID);
    expect(result).toBeNull();
  });
});

describe('updateServerModel', () => {
  it('updates active_model for server and bot', async () => {
    const db = createMockDb();
    await updateServerModel(db, 's1', BOT_ID, 'gemini-2.5-pro');

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE server_settings'),
      ['gemini-2.5-pro', 's1', BOT_ID]
    );
  });
});

describe('getServerLore', () => {
  it('returns lore text', async () => {
    const db = createMockDb();
    db.query.mockResolvedValueOnce({ rows: [{ server_lore: 'Be nice.' }], rowCount: 1 });

    const result = await getServerLore(db, 's1', BOT_ID);
    expect(result).toBe('Be nice.');
  });

  it('returns null when no lore set', async () => {
    const db = createMockDb();
    db.query.mockResolvedValueOnce({ rows: [{ server_lore: null }], rowCount: 1 });

    const result = await getServerLore(db, 's1', BOT_ID);
    expect(result).toBeNull();
  });
});

describe('updateServerLore', () => {
  it('updates server_lore column', async () => {
    const db = createMockDb();
    await updateServerLore(db, 's1', BOT_ID, 'New lore text');

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE server_settings'),
      ['New lore text', 's1', BOT_ID]
    );
  });
});

describe('getServerChannels', () => {
  it('returns channels with names belonging to a server', async () => {
    const mockRedis = {
      smembers: vi.fn().mockResolvedValue(['c1', 'c2', 'c3']),
      get: vi.fn((key: string) => {
        const data: Record<string, string> = {
          'channel:c1:server': 's1',
          'channel:c2:server': 's1',
          'channel:c3:server': 's2',
          'channel:c1:name': 'general',
          'channel:c2:name': 'random',
          'channel:c3:name': 'off-topic',
        };
        return Promise.resolve(data[key] ?? null);
      }),
    };

    const result = await getServerChannels(mockRedis, 's1');
    expect(result).toEqual([
      { id: 'c1', name: 'general' },
      { id: 'c2', name: 'random' },
    ]);
  });
});

describe('getChannelHistory', () => {
  it('returns messages from Redis list', async () => {
    const mockRedis = {
      lrange: vi.fn().mockResolvedValue(['[User: Alice]: hello', '[User: Bob]: hi']),
    };

    const result = await getChannelHistory(mockRedis, 'c1', 0, 50);
    expect(result).toEqual(['[User: Alice]: hello', '[User: Bob]: hi']);
    expect(mockRedis.lrange).toHaveBeenCalledWith('channel:c1:history', 0, 49);
  });
});
