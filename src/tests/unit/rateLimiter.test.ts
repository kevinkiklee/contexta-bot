import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isRateLimited, clearRateLimitState } from '../../utils/rateLimiter.js';

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
