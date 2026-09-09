import type { ClipStudioState } from '../types/clipStudio'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'
import { toPersistedStudioState } from '../utils/clipStudioStore'

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

export async function uploadStudioMediaBlob(
  userId: string,
  blobKey: string,
  blob: Blob,
): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) return
  const contentType = blob.type || 'application/octet-stream'
  const { error } = await supabase.storage
    .from(STUDIO_MEDIA_BUCKET)
    .upload(studioMediaPath(userId, blobKey), blob, {
      contentType,
      upsert: true,
    })
  if (error) throw error
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
  const { data, error } = await supabase.storage
    .from(STUDIO_MEDIA_BUCKET)
    .list(userId, { limit: 1000, offset: 0 })
  if (error || !data) return new Set()
  return new Set(
    data
      .filter((item) => item.name && item.id)
      .map((item) => decodeStudioBlobKey(item.name)),
  )
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
