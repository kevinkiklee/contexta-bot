import type { KnowledgeCitation } from '@contexta/shared';

export function confidenceDots(confidence: number): string {
  if (confidence >= 0.7) return '●●●';
  if (confidence >= 0.4) return '●●○';
  return '●○○';
}

export function makeCitation(entry: { id: string; type: string; confidence: number; title: string }): KnowledgeCitation {
  return {
    shortId: `KE-${entry.id.slice(0, 4)}`,
    entryId: entry.id,
    type: entry.type,
    confidence: entry.confidence,
    title: entry.title,
  };
}

export function formatCitationFooter(citations: KnowledgeCitation[]): string {
  if (citations.length === 0) return '';

  const parts = citations.map(
    (c) => `\`${c.shortId}\` (${c.type}, ${confidenceDots(c.confidence)})`
  );

  return `\n───\n📚 Sources: ${parts.join(' · ')}`;
}

export function appendCitationFooter(response: string, citations: KnowledgeCitation[]): string {
  const footer = formatCitationFooter(citations);
  if (!footer) return response;

  const maxResponseLen = 2000 - footer.length;
  const truncated = response.length > maxResponseLen
    ? response.slice(0, maxResponseLen - 3) + '...'
    : response;

  return truncated + footer;
}

export function resolveShortId(input: string): string {
  if (input.includes('-') && input.length > 8) return input.toLowerCase();
  const match = input.match(/^ke-(.+)$/i);
  return match ? match[1].toLowerCase() : input.toLowerCase();
}
