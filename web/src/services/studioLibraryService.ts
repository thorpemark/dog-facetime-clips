import type { ClipStudioState } from '../types/clipStudio'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'
import { toPersistedStudioState } from '../utils/clipStudioStore'
import {
  mergeStudioLibraries,
  shouldWriteRemoteLibrary,
} from '../utils/studioLibraryMerge'

export const STUDIO_MEDIA_BUCKET = 'studio-media'
export const STUDIO_SYNC_USER_KEY = 'dog-facetime-clips.studio.sync-user'

export interface RemoteStudioLibrary {
  library: ClipStudioState
  updatedAt: string
}

export function encodeStudioBlobKey(blobKey: string): string {
  return blobKey.replace(/:/g, '__')
}

export function decodeStudioBlobKey(fileName: string): string {
  return fileName.replace(/__/g, ':')
}

export function studioMediaPath(userId: string, blobKey: string): string {
  return `${userId}/${encodeStudioBlobKey(blobKey)}`
}

export function inferStudioMediaContentType(blobKey: string, blob: Blob): string {
  const raw = (blob.type || '').split(';')[0].trim().toLowerCase()
  if (raw && raw !== 'application/octet-stream') return raw
  if (blobKey.startsWith('video:')) return 'video/mp4'
  if (blobKey.startsWith('photo:')) return 'image/jpeg'
  return raw || 'application/octet-stream'
}

export function formatStudioMediaUploadError(
  err: unknown,
  blobKey: string,
  size?: number,
): string {
  const message = err instanceof Error ? err.message : String(err)
  const lower = message.toLowerCase()
  const sizeHint =
    typeof size === 'number' && size > 0 ? ` (${Math.round(size / 1048576)} MB)` : ''
  if (
    lower.includes('row-level security') ||
    lower.includes('unauthorized') ||
    (lower.includes('not allowed') && lower.includes('policy'))
  ) {
    return `Could not upload ${blobKey}: storage permission denied. Re-run web/supabase/migration_studio_library.sql.`
  }
  if (
    lower.includes('payload too large') ||
    lower.includes('maximum allowed size') ||
    lower.includes('exceeded the maximum') ||
    lower.includes('413')
  ) {
    return `Could not upload ${blobKey}: file is too large${sizeHint} (max 100 MB).`
  }
  if (lower.includes('mime') || lower.includes('not allowed')) {
    return `Could not upload ${blobKey}: file type not allowed. Use an MP4 for videos (JPEG/PNG for stills).`
  }
  return `Could not upload ${blobKey}: ${message || 'upload failed'}`
}

export function readLastSyncedUserId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(STUDIO_SYNC_USER_KEY)
  } catch {
    return null
  }
}

export function writeLastSyncedUserId(userId: string | null): void {
  if (typeof window === 'undefined') return
  try {
    if (userId) window.localStorage.setItem(STUDIO_SYNC_USER_KEY, userId)
    else window.localStorage.removeItem(STUDIO_SYNC_USER_KEY)
  } catch {
    /* private mode */
  }
}

function asLibrary(value: unknown): ClipStudioState | null {
  if (!value || typeof value !== 'object') return null
  const parsed = value as ClipStudioState
  if (parsed.version !== 1 || !Array.isArray(parsed.dogs)) return null
  return parsed
}

export async function fetchRemoteStudioLibrary(
  userId: string,
): Promise<RemoteStudioLibrary | null> {
  const supabase = getSupabase()
  if (!supabase) return null
  const { data, error } = await supabase
    .from('studio_libraries')
    .select('library, updated_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const library = asLibrary(data.library)
  if (!library) return null
  return { library, updatedAt: String(data.updated_at ?? '') }
}

export async function saveRemoteStudioLibrary(
  userId: string,
  state: ClipStudioState,
): Promise<string> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Sign-in is not available in demo mode')
  const updatedAt = new Date().toISOString()
  const { error } = await supabase.from('studio_libraries').upsert(
    {
      user_id: userId,
      library: toPersistedStudioState(state),
      updated_at: updatedAt,
    },
    { onConflict: 'user_id' },
  )
  if (error) throw error
  return updatedAt
}

/** Re-fetch before upsert so a phone seed cannot overwrite PC-attached MP4s. */
export async function saveStudioLibraryPreservingAttachments(
  userId: string,
  local: ClipStudioState,
): Promise<{ savedAt: string; library: ClipStudioState; wrote: boolean }> {
  const remote = await fetchRemoteStudioLibrary(userId)
  const merged = mergeStudioLibraries(local, remote?.library ?? null)
  if (!shouldWriteRemoteLibrary(merged, remote?.library ?? null)) {
    return {
      savedAt: remote?.updatedAt ?? new Date().toISOString(),
      library: remote?.library ?? merged,
      wrote: false,
    }
  }
  const savedAt = await saveRemoteStudioLibrary(userId, merged)
  return { savedAt, library: merged, wrote: true }
}

export async function uploadStudioMediaBlob(
  userId: string,
  blobKey: string,
  blob: Blob,
): Promise<string> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Sign-in is not available in demo mode')
  const path = studioMediaPath(userId, blobKey)
  const primaryType = inferStudioMediaContentType(blobKey, blob)
  const tryUpload = async (contentType: string) =>
    supabase.storage.from(STUDIO_MEDIA_BUCKET).upload(path, blob, {
      contentType,
      upsert: true,
      cacheControl: '3600',
    })

  let { error } = await tryUpload(primaryType)
  if (error && primaryType !== 'application/octet-stream') {
    const retry = await tryUpload('application/octet-stream')
    error = retry.error
  }
  if (error) {
    throw new Error(formatStudioMediaUploadError(error, blobKey, blob.size))
  }
  return path
}

export async function downloadStudioMediaBlob(
  userId: string,
  blobKey: string,
): Promise<Blob | null> {
  const supabase = getSupabase()
  if (!supabase) return null
  const { data, error } = await supabase.storage
    .from(STUDIO_MEDIA_BUCKET)
    .download(studioMediaPath(userId, blobKey))
  if (error || !data) return null
  return data
}

export async function listRemoteStudioBlobKeys(userId: string): Promise<Set<string>> {
  const supabase = getSupabase()
  if (!supabase) return new Set()
  const keys = new Set<string>()
  const pageSize = 1000
  for (let offset = 0; offset < 10000; offset += pageSize) {
    const { data, error } = await supabase.storage
      .from(STUDIO_MEDIA_BUCKET)
      .list(userId, { limit: pageSize, offset })
    if (error) throw error
    if (!data || data.length === 0) break
    for (const item of data) {
      if (!item.name) continue
      if (item.id == null && item.metadata == null) continue
      keys.add(decodeStudioBlobKey(item.name))
    }
    if (data.length < pageSize) break
  }
  return keys
}

export async function mapPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return
  let cursor = 0
  const run = async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      await worker(items[index], index)
    }
  }
  const size = Math.min(Math.max(1, concurrency), items.length)
  await Promise.all(Array.from({ length: size }, () => run()))
}

export function isStudioCloudAvailable(): boolean {
  return isSupabaseConfigured
}
