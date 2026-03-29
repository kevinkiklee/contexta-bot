const WINDOW_MS = 10_000;
const MAX_REQUESTS = 2;
const MAX_MAP_SIZE = 50_000;

const timestamps = new Map<string, number[]>();

/** Exposed only for tests — evicts at a custom threshold. */
export function _testEvict(maxSize: number): void {
  evict(maxSize);
}

function evict(maxSize: number): void {
  if (timestamps.size < maxSize) return;
  const now = Date.now();
  for (const [userId, ts] of timestamps) {
    if (ts.every(t => now - t >= WINDOW_MS)) timestamps.delete(userId);
  }
}

export function isRateLimited(userId: string): boolean {
  evict(MAX_MAP_SIZE);
  const now = Date.now();
  const recent = (timestamps.get(userId) ?? []).filter(t => now - t < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS) return true;
  recent.push(now);
  timestamps.set(userId, recent);
  return false;
}

export function clearRateLimitState(): void {
  timestamps.clear();
}
