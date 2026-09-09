import type { ClipResultVideo } from '../types/clipStudio'

const FALLBACK_ATTACHED_NAME = 'Attached video'

function firstNonEmpty(...values: Array<string | null | undefined>): string | undefined {
  for (const value of values) {
    const trimmed = value?.trim()
    if (trimmed) return trimmed
  }
  return undefined
}

/** Last path segment, ignoring trailing slashes and Windows separators. */
export function basenameFromPath(path?: string | null): string | undefined {
  if (!path) return undefined
  const trimmed = path.replace(/\\/g, '/').replace(/\/+$/, '').trim()
  if (!trimmed) return undefined
  const part = trimmed.split('/').pop()?.trim()
  return part || undefined
}

/** Tail after the last colon — `video:murphy-idle-1` → `murphy-idle-1`. */
export function blobKeyTail(blobKey?: string | null): string | undefined {
  if (!blobKey) return undefined
  const trimmed = blobKey.trim()
  if (!trimmed) return undefined
  const colon = trimmed.lastIndexOf(':')
  const tail = colon >= 0 ? trimmed.slice(colon + 1) : trimmed
  return tail.trim() || undefined
}

function isUserAttachedVideo(video: ClipResultVideo): boolean {
  if (video.origin === 'user') return true
  return Boolean(video.blobKey || video.storagePath)
}

/** Original File.name captured on attach/replace, ignoring empty / path-like values. */
export function originalUploadFileName(file: Pick<File, 'name'>): string | undefined {
  return basenameFromPath(file.name) ?? firstNonEmpty(file.name)
}

/**
 * Label shown under a Studio slot video.
 * Prefers the original upload name; older attachments fall back to blob key,
 * storage/path basename, or “Attached video”. Demo placeholders return null.
 */
export function displayNameForClipVideo(
  video: ClipResultVideo | null | undefined,
): string | null {
  if (!video || !isUserAttachedVideo(video)) return null
  const named = firstNonEmpty(video.originalName, video.fileName)
  if (named) return named
  const fromPublicPath = basenameFromPath(video.path)
  if (fromPublicPath) return fromPublicPath
  const fromBlob = blobKeyTail(video.blobKey)
  if (fromBlob) return fromBlob
  const fromStorage = basenameFromPath(video.storagePath)
  if (fromStorage) return fromStorage
  return FALLBACK_ATTACHED_NAME
}
