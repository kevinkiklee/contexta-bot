import type { IAIProvider } from '../llm/IAIProvider.js';

export interface AttachmentInfo {
  url: string;
  name: string;
  contentType: string | null;
  size: number;
}

export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

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

const TEXT_LIKE_EXTENSIONS = new Set([
  '.ts', '.js', '.tsx', '.jsx', '.py', '.rb', '.go', '.rs', '.java',
  '.c', '.cpp', '.h', '.cs', '.swift', '.kt', '.sh', '.bash',
  '.json', '.yaml', '.yml', '.xml', '.html', '.css', '.scss',
  '.sql', '.graphql', '.proto', '.toml', '.ini', '.cfg',
  '.txt', '.md', '.csv', '.log',
  '.env', '.conf', '.properties', '.editorconfig', '.gitignore', '.dockerignore',
]);

export function resolveEffectiveMimeType(contentType: string | null, fileName: string): string | null {
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

  const ext = fileName.includes('.') ? '.' + fileName.split('.').pop()!.toLowerCase() : '';
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

export async function describeAttachment(
  ai: IAIProvider,
  attachment: AttachmentInfo,
  fetchFn: typeof fetch = globalThis.fetch
): Promise<string> {
  const name = attachment.name || 'unknown';

  if (attachment.size > MAX_FILE_SIZE) {
    return `[Attachment: ${name} (${formatFileSize(attachment.size)}) — file too large to process]`;
  }

  const effectiveMime = resolveEffectiveMimeType(attachment.contentType, name);
  if (!effectiveMime) {
    return `[Attachment: ${name} (${formatFileSize(attachment.size)}) — unsupported file type]`;
  }

  let base64Data: string;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const response = await fetchFn(attachment.url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    base64Data = buffer.toString('base64');
  } catch (err) {
    console.error(`[attachmentProcessor] Failed to fetch ${name}:`, err);
    return `[Attachment: ${name} — description unavailable]`;
  }

  try {
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
