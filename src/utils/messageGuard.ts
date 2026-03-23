// Matches role prefixes the bot uses internally, at the start of any line
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
