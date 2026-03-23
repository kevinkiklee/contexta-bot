const WINDOW_MS = 10_000; // 10-second sliding window — tune as needed for your community
const MAX_REQUESTS = 2;   // max requests per user per window — intentionally conservative for MVP

const timestamps = new Map<string, number[]>();

export function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const recent = (timestamps.get(userId) ?? []).filter(t => now - t < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS) return true;
  recent.push(now);
  timestamps.set(userId, recent);
  return false;
}

/** Exposed only for tests — resets internal state. */
export function clearRateLimitState(): void {
  timestamps.clear();
}
