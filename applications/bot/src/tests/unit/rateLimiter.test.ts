import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isRateLimited, clearRateLimitState, _testEvict } from '../../utils/rateLimiter.js';

beforeEach(() => {
  clearRateLimitState();
  vi.useRealTimers();
});

describe('isRateLimited', () => {
  it('allows first request', () => {
    expect(isRateLimited('user1')).toBe(false);
  });

  it('blocks when max requests in window are exceeded', () => {
    // Default: max 2 requests per 10s window
    isRateLimited('user1'); // 1st — allowed
    isRateLimited('user1'); // 2nd — allowed
    expect(isRateLimited('user1')).toBe(true); // 3rd — blocked
  });

  it('does not affect other users', () => {
    isRateLimited('user1');
    isRateLimited('user1');
    isRateLimited('user1'); // user1 is blocked
    expect(isRateLimited('user2')).toBe(false); // user2 is fine
  });

  it('allows requests again after the window expires', () => {
    vi.useFakeTimers();
    isRateLimited('user1');
    isRateLimited('user1');
    expect(isRateLimited('user1')).toBe(true);

    vi.advanceTimersByTime(11_000); // move past 10s window
    expect(isRateLimited('user1')).toBe(false);
  });
});

describe('maybeEvict', () => {
  it('deletes entries with all stale timestamps when map exceeds threshold', () => {
    clearRateLimitState();

    vi.useFakeTimers();
    isRateLimited('stale-user-1');
    isRateLimited('stale-user-2');
    vi.advanceTimersByTime(20_000); // beyond WINDOW_MS=10s

    // Add a recent entry
    isRateLimited('active-user');

    // Trigger eviction with threshold=2 (lower than actual 50k to force sweep)
    _testEvict(2);

    // stale users should be evicted (fresh start)
    expect(isRateLimited('stale-user-1')).toBe(false);
    // active user's slot is still counted (1 used of 2)
    expect(isRateLimited('active-user')).toBe(false);
  });

  it('does not delete entries with any recent timestamp', () => {
    clearRateLimitState();

    vi.useFakeTimers();
    isRateLimited('user1'); // adds a fresh timestamp
    isRateLimited('user1'); // now at limit (2 of 2 used)

    _testEvict(0); // force eviction sweep regardless of size

    vi.advanceTimersByTime(0); // no time passes
    // user1 entry retained — still at limit
    expect(isRateLimited('user1')).toBe(true);
  });
});
