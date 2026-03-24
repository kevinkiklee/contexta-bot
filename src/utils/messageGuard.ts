// Case-insensitive (i) — catches mixed-case injection attempts.
// Global (g) — replaces ALL occurrences, including mid-line and multiple per line.
// No anchor — matches role prefixes anywhere in the string, not just line-start.
const ROLE_PREFIX_RE = /\[(?:System\/Contexta|User:[^\]]*)\]:\s*/gi;

// \u0002 (ASCII STX) — non-printable sentinel stored with bot messages.
// Cannot appear in Discord user input. Must be stripped from all user-supplied strings.
export const BOT_SENTINEL = '\u0002';

/** Strip control characters and dangerous bracket-structure characters from display names. */
export function sanitizeDisplayName(name: string): string {
  return name
    .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // strip all C0/C1 control chars (incl. BOT_SENTINEL)
    .replace(/[\[\]:]/g, '');              // strip chars that close [User: ...] bracket structure
}

/** Redact role-prefix injection patterns and strip control characters from message content. */
export function sanitizeMessageContent(content: string): string {
  return content
    .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // strip control chars first (incl. BOT_SENTINEL)
    .replace(ROLE_PREFIX_RE, '[REDACTED] ');
}

export function formatUserMessage(displayName: string, content: string): string {
  return `[User: ${sanitizeDisplayName(displayName)}]: ${sanitizeMessageContent(content)}`;
}
