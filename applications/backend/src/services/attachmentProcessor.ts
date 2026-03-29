import type { IAIProvider } from './llm/IAIProvider.js';

export interface AttachmentInfo {
  url: string;
  name: string;
  contentType: string | null;
  size: number;
}

export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

export const MAX_TEXT_LENGTH = 4000;

const SUPPORTED_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
]);

const SUPPORTED_DOCUMENT_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'text/csv',
  'text/markdown',
]);

const BLOCKED_EXTENSIONS = new Set([
  '.env', '.conf', '.properties', '.ini', '.cfg',
  '.gitignore', '.dockerignore', '.editorconfig',
]);

const TEXT_LIKE_EXTENSIONS = new Set([
  '.ts', '.js', '.tsx', '.jsx', '.py', '.rb', '.go', '.rs', '.java',
  '.c', '.cpp', '.h', '.cs', '.swift', '.kt', '.sh', '.bash',
  '.json', '.yaml', '.yml', '.xml', '.html', '.css', '.scss',
  '.sql', '.graphql', '.proto', '.toml',
  '.txt', '.md', '.csv', '.log',
]);

const ALLOWED_ATTACHMENT_HOSTS = new Set([
  'cdn.discordapp.com',
  'media.discordapp.net',
  'images-ext-1.discordapp.net',
  'images-ext-2.discordapp.net',
]);

export function isAllowedAttachmentUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return ALLOWED_ATTACHMENT_HOSTS.has(hostname);
  } catch {
    return false;
  }
}

export function resolveEffectiveMimeType(contentType: string | null, fileName: string): string | null {
  const ext = fileName.includes('.') ? '.' + fileName.split('.').pop()!.toLowerCase() : '';
  if (BLOCKED_EXTENSIONS.has(ext)) return null;

  if (contentType && contentType !== 'application/octet-stream') {
    const normalized = normalizeMimeType(contentType);
    if (normalized === 'application/octet-stream') {
      // fall through to extension check below
    } else if (SUPPORTED_IMAGE_TYPES.has(normalized) || SUPPORTED_DOCUMENT_TYPES.has(normalized)) {
      return normalized;
    } else {
      return null;
    }
  }

  if (TEXT_LIKE_EXTENSIONS.has(ext)) {
    return 'text/plain';
  }
  return null;
}

export function isSupportedMimeType(mimeType: string): boolean {
  const normalized = normalizeMimeType(mimeType);
  return SUPPORTED_IMAGE_TYPES.has(normalized) || SUPPORTED_DOCUMENT_TYPES.has(normalized);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function normalizeMimeType(raw: string): string {
  const base = raw.split(';')[0].trim();
  return base.toLowerCase();
}

export function isTextMimeType(mimeType: string): boolean {
  return mimeType.startsWith('text/');
}

export async function describeAttachment(
  ai: IAIProvider,
  attachment: AttachmentInfo,
  fetchFn: typeof fetch = globalThis.fetch
): Promise<string> {
  const name = attachment.name || 'unknown';

  if (attachment.size > MAX_FILE_SIZE) {
    return `[Attachment: ${name} (${formatFileSize(attachment.size)}) — file too large to process]`;
  }

  if (!isAllowedAttachmentUrl(attachment.url)) {
    return `[Attachment: ${name} — unsupported source]`;
  }

  const effectiveMime = resolveEffectiveMimeType(attachment.contentType, name);
  if (!effectiveMime) {
    return `[Attachment: ${name} (${formatFileSize(attachment.size)}) — unsupported file type]`;
  }

  let buffer: Buffer;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const response = await fetchFn(attachment.url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    buffer = Buffer.from(await response.arrayBuffer());
  } catch (err) {
    console.error(`[attachmentProcessor] Failed to fetch ${name}:`, err);
    return `[Attachment: ${name} — description unavailable]`;
  }

  if (isTextMimeType(effectiveMime)) {
    let text = buffer.toString('utf-8');
    if (text.length > MAX_TEXT_LENGTH) {
      text = text.slice(0, MAX_TEXT_LENGTH) + ' [truncated]';
    }
    // Sanitize before constructing the return string.
    // We apply role-prefix redaction and control-char stripping inline rather than
    // calling sanitizeMessageContent, because that function strips \n and \t which
    // are structurally meaningful in multi-line text files (code, CSV, markdown).
    // Tab (\x09) and newline (\x0A) are intentionally preserved here.
    const sanitizedText = text
      .replace(/[\x00-\x08\x0B-\x1F\x7F-\x9F]/g, '')                     // strip C0/C1 except \t and \n
      .replace(/\[(?:System\/Contexta|User:[^\]]*)\]:\s*/gi, '[REDACTED] '); // redact role prefixes
    return `[Attachment: ${name} — ${sanitizedText}]`;
  }

  try {
    const base64Data = buffer.toString('base64');
    const description = await ai.describeAttachment(effectiveMime, base64Data, name);
    return `[Attachment: ${name} — ${description}]`;
  } catch (err) {
    console.error(`[attachmentProcessor] Failed to describe ${name}:`, err);
    return `[Attachment: ${name} — description unavailable]`;
  }
}

export async function processAttachments(
  ai: IAIProvider,
  attachments: AttachmentInfo[],
  fetchFn: typeof fetch = globalThis.fetch
): Promise<string> {
  if (attachments.length === 0) return '';

  const results = await Promise.allSettled(
    attachments.map(att => describeAttachment(ai, att, fetchFn))
  );

  return results
    .map(r => r.status === 'fulfilled' ? r.value : `[Attachment: unknown — description unavailable]`)
    .join(' ');
}
