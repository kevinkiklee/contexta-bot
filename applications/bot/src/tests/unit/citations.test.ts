import { describe, it, expect } from 'vitest';
import { formatCitationFooter, resolveShortId, confidenceDots } from '../../lib/citations.js';
import type { KnowledgeCitation } from '@contexta/shared';

describe('confidenceDots', () => {
  it('returns ●●● for high confidence (>= 0.7)', () => {
    expect(confidenceDots(0.7)).toBe('●●●');
    expect(confidenceDots(0.95)).toBe('●●●');
  });

  it('returns ●●○ for moderate confidence (0.4-0.69)', () => {
    expect(confidenceDots(0.4)).toBe('●●○');
    expect(confidenceDots(0.65)).toBe('●●○');
  });

  it('returns ●○○ for low confidence (< 0.4)', () => {
    expect(confidenceDots(0.1)).toBe('●○○');
    expect(confidenceDots(0.39)).toBe('●○○');
  });
});

describe('formatCitationFooter', () => {
  const citations: KnowledgeCitation[] = [
    { shortId: 'KE-3f8a', entryId: '3f8a1234-0000-0000-0000-000000000000', type: 'decision', confidence: 0.85, title: 'Redis Decision' },
    { shortId: 'KE-1c2d', entryId: '1c2d5678-0000-0000-0000-000000000000', type: 'topic', confidence: 0.52, title: 'Caching Strategy' },
  ];

  it('formats citations with separator and confidence dots', () => {
    const footer = formatCitationFooter(citations);
    expect(footer).toContain('───');
    expect(footer).toContain('📚');
    expect(footer).toContain('`KE-3f8a`');
    expect(footer).toContain('`KE-1c2d`');
    expect(footer).toContain('decision');
    expect(footer).toContain('●●●');
    expect(footer).toContain('●●○');
  });

  it('returns empty string for empty citations', () => {
    expect(formatCitationFooter([])).toBe('');
  });
});

describe('resolveShortId', () => {
  it('extracts hex part from KE-xxxx format', () => {
    expect(resolveShortId('KE-3f8a')).toBe('3f8a');
  });

  it('extracts hex part from ke-xxxx (case insensitive)', () => {
    expect(resolveShortId('ke-3F8A')).toBe('3f8a');
  });

  it('treats raw hex as-is', () => {
    expect(resolveShortId('3f8a')).toBe('3f8a');
  });

  it('treats full UUID as full id', () => {
    const uuid = '3f8a1234-0000-0000-0000-000000000000';
    expect(resolveShortId(uuid)).toBe(uuid);
  });
});
