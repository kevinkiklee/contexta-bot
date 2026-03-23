// Case-insensitive (i) to catch mixed-case injection attempts.
// Multiline (m) so ^ matches the start of each line, not just the string.
// No global (g) flag — regex is stateless, safe to reuse across .map() iterations.
// NOTE: bot-written messages must never be passed through sanitizeMessageContent;
// they are stored directly in Redis and are not user-controlled input.
const ROLE_PREFIX_RE = /^\[(?:System\/Contexta|User:[^\]]*)\]:\s*/im;

export function sanitizeDisplayName(name: string): string {
  return name.replace(/[\[\]]/g, '');
}

export function sanitizeMessageContent(content: string): string {
  return content
    .split('\n')
    .map(line => ROLE_PREFIX_RE.test(line) ? line.replace(ROLE_PREFIX_RE, '[REDACTED] ') : line)
    .join('\n');
}

export function formatUserMessage(displayName: string, content: string): string {
  return `[User: ${sanitizeDisplayName(displayName)}]: ${sanitizeMessageContent(content)}`;
}
