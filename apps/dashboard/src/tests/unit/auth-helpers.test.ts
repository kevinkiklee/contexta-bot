import { describe, it, expect, vi } from 'vitest';
import { hasManageGuild, parseGuildPermissions, syncUserGuilds, checkServerMembership, checkServerAdmin } from '@/lib/auth-helpers';
import { createMockDb } from '../helpers/mockDb';

describe('hasManageGuild', () => {
  it('returns true when MANAGE_GUILD (0x20) bit is set', () => {
    expect(hasManageGuild('32')).toBe(true);
  });

  it('returns true when MANAGE_GUILD is part of a larger bitmask', () => {
    expect(hasManageGuild('40')).toBe(true);
  });

  it('returns false when MANAGE_GUILD bit is not set', () => {
    expect(hasManageGuild('2048')).toBe(false);
  });

  it('returns false for zero permissions', () => {
    expect(hasManageGuild('0')).toBe(false);
  });

  it('returns true when ADMINISTRATOR (0x8) bit is set', () => {
    expect(hasManageGuild('8')).toBe(true);
  });
});

describe('parseGuildPermissions', () => {
  it('returns guild entries with is_admin derived from permissions', () => {
    const guilds = [
      { id: 'guild-1', permissions: '40' },
      { id: 'guild-2', permissions: '2048' },
    ];
    const result = parseGuildPermissions(guilds);
    expect(result).toEqual([
      { serverId: 'guild-1', isAdmin: true },
      { serverId: 'guild-2', isAdmin: false },
    ]);
  });

  it('returns empty array for empty input', () => {
    expect(parseGuildPermissions([])).toEqual([]);
  });
});

describe('syncUserGuilds', () => {
  it('upserts user and replaces user_servers rows', async () => {
    const db = createMockDb();
    const user = { id: 'user-1', username: 'Alice', avatar_url: 'https://cdn.example.com/a.png' };
    const guilds = [
      { id: 'guild-1', permissions: '40' },
      { id: 'guild-2', permissions: '2048' },
    ];

    await syncUserGuilds(db, user, guilds);

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO users'),
      expect.arrayContaining(['user-1', 'Alice', 'https://cdn.example.com/a.png'])
    );
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM user_servers'),
      ['user-1']
    );
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO user_servers'),
      expect.arrayContaining(['user-1'])
    );
  });

  it('handles empty guild list', async () => {
    const db = createMockDb();
    const user = { id: 'user-1', username: 'Alice', avatar_url: null };

    await syncUserGuilds(db, user, []);

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO users'),
      expect.anything()
    );
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM user_servers'),
      ['user-1']
    );
    expect(db.query).toHaveBeenCalledTimes(2);
  });
});

describe('checkServerMembership', () => {
  it('returns the row when user is a member', async () => {
    const db = createMockDb();
    db.query.mockResolvedValueOnce({ rows: [{ user_id: 'u1', server_id: 's1', is_admin: false }], rowCount: 1 });

    const result = await checkServerMembership(db, 'u1', 's1');
    expect(result).toEqual({ user_id: 'u1', server_id: 's1', is_admin: false });
  });

  it('returns null when user is not a member', async () => {
    const db = createMockDb();
    db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const result = await checkServerMembership(db, 'u1', 's1');
    expect(result).toBeNull();
  });
});

describe('checkServerAdmin', () => {
  it('returns true when user is admin for server', async () => {
    const db = createMockDb();
    db.query.mockResolvedValueOnce({ rows: [{ user_id: 'u1', server_id: 's1', is_admin: true }], rowCount: 1 });

    expect(await checkServerAdmin(db, 'u1', 's1')).toBe(true);
  });

  it('returns false when user is member but not admin', async () => {
    const db = createMockDb();
    db.query.mockResolvedValueOnce({ rows: [{ user_id: 'u1', server_id: 's1', is_admin: false }], rowCount: 1 });

    expect(await checkServerAdmin(db, 'u1', 's1')).toBe(false);
  });

  it('returns false when user is not a member at all', async () => {
    const db = createMockDb();
    db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    expect(await checkServerAdmin(db, 'u1', 's1')).toBe(false);
  });
});
