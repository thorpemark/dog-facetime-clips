import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from './AuthContext'
import {
  downloadStudioMediaBlob,
  fetchRemoteStudioLibrary,
  listRemoteStudioBlobKeys,
  mapPool,
  readLastSyncedUserId,
  saveStudioLibraryPreservingAttachments,
  studioMediaPath,
  uploadStudioMediaBlob,
  writeLastSyncedUserId,
} from '../services/studioLibraryService'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'
import {
  getStudioBlob,
  listStudioBlobKeys,
  putStudioBlob,
} from '../utils/clipStudioMedia'
import { createSeedStudioState } from '../data/clipStudioSeed'
import {
  adoptLocalStudioBlobs,
  collectStudioBlobKeys,
  countLocalVideoBlobKeys,
  countUserAttachedVideos,
  isDifferentAccountLocalLibrary,
  isStudioMediaBlobKey,
  isStudioVideoBlobKey,
  mergeStudioLibraries,
  stampCloudMediaPaths,
} from '../utils/studioLibraryMerge'
import {
  getStudioState,
  hydrateStudioMedia,
  replaceStudioState,
  setStudioCloudSyncHandler,
} from '../utils/clipStudioStore'
import type { ClipStudioState } from '../types/clipStudio'

export type StudioSyncPhase =
  | 'local'
  | 'signing-in'
  | 'syncing'
  | 'ready'
  | 'error'

export interface StudioSyncStatus {
  phase: StudioSyncPhase
  message: string
  done: number
  total: number
  error: string | null
  lastSyncedAt: string | null
  userVideoCount: number
  uploadedVideos: number
  cloudVideos: number
}

interface StudioSyncContextValue extends StudioSyncStatus {
  syncNow: () => Promise<void>
  cloudAvailable: boolean
}

const defaultStatus: StudioSyncStatus = {
  phase: 'local',
  message: '',
  done: 0,
  total: 0,
  error: null,
  lastSyncedAt: null,
  userVideoCount: 0,
  uploadedVideos: 0,
  cloudVideos: 0,
}

const StudioSyncContext = createContext<StudioSyncContextValue | null>(null)

function snapshotStatus(partial: Partial<StudioSyncStatus>): StudioSyncStatus {
  const state = getStudioState()
  return {
    ...defaultStatus,
    userVideoCount: countUserAttachedVideos(state),
    cloudVideos: countUserAttachedVideos(state),
    ...partial,
  }
}

function readyMessage(uploadedVideos: number, cloudVideos: number): string {
  if (uploadedVideos > 0) {
    return `Uploaded ${uploadedVideos} video${uploadedVideos === 1 ? '' : 's'} to this account.`
  }
  if (cloudVideos > 0) {
    return `Studio library is synced — ${cloudVideos} video${cloudVideos === 1 ? '' : 's'} in the cloud.`
  }
  return 'Library JSON is synced. No attached videos in this browser to upload.'
}

async function hydrateWithCloud(userId: string | null): Promise<void> {
  await hydrateStudioMedia(async (key) => {
    const local = await getStudioBlob(key)
    if (local) return local
    if (!userId) return null
    const remote = await downloadStudioMediaBlob(userId, key)
    if (remote) await putStudioBlob(key, remote)
    return remote
  })
}

function uniqueKeys(keys: Iterable<string>): string[] {
  return [...new Set(keys)]
}

export function StudioSyncProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const [status, setStatus] = useState<StudioSyncStatus>(() =>
    snapshotStatus({
      phase: isSupabaseConfigured ? 'signing-in' : 'local',
      message: isSupabaseConfigured ? '' : 'This browser only until you sign in.',
    }),
  )
  const syncingRef = useRef(false)
  const lastRemoteUpdatedAt = useRef<string | null>(null)
  const pushTimer = useRef<number | null>(null)
  const userIdRef = useRef<string | null>(null)
  const lastPullAt = useRef(0)
  const ignorePullUntil = useRef(0)

  useEffect(() => {
    userIdRef.current = user?.id ?? null
  }, [user?.id])

  const runSync = useCallback(async (reason: 'signin' | 'manual' | 'pull') => {
    const userId = userIdRef.current
    if (!userId || !isSupabaseConfigured) {
      setStatus(
        snapshotStatus({
          phase: 'local',
          message: 'Demo mode — library stays in this browser.',
        }),
      )
      return
    }
    if (reason === 'pull') {
      if (Date.now() < ignorePullUntil.current) return
      if (Date.now() - lastPullAt.current < 8000) return
    }
    if (syncingRef.current && reason !== 'manual') return
    lastPullAt.current = Date.now()
    syncingRef.current = true
    setStatus(
      snapshotStatus({
        phase: 'syncing',
        message:
          reason === 'pull'
            ? 'Checking cloud library…'
            : 'Syncing Clip Studio across devices…',
        done: 0,
        total: 0,
        error: null,
      }),
    )

    try {
      const lastUser = readLastSyncedUserId()
      const switchedAccount = isDifferentAccountLocalLibrary(lastUser, userId)
      const localKeys = new Set(await listStudioBlobKeys())
      const remote = await fetchRemoteStudioLibrary(userId)
      lastRemoteUpdatedAt.current = remote?.updatedAt ?? null

      let local = getStudioState()
      if (!switchedAccount) {
        local = adoptLocalStudioBlobs(local, localKeys)
      }

      let next: ClipStudioState
      if (switchedAccount) {
        next = remote?.library
          ? mergeStudioLibraries(createSeedStudioState(), remote.library)
          : createSeedStudioState()
      } else {
        next = mergeStudioLibraries(local, remote?.library ?? null)
        if (
          countUserAttachedVideos(next) < countUserAttachedVideos(local) &&
          countLocalVideoBlobKeys(localKeys) > 0
        ) {
          next = local
        }
      }

      replaceStudioState(next, { syncCloud: false })

      const neededKeys = collectStudioBlobKeys(next)
      const remoteKeys = await listRemoteStudioBlobKeys(userId)
      const toUpload = uniqueKeys([
        ...neededKeys.filter((key) => localKeys.has(key) && !remoteKeys.has(key)),
        ...[...localKeys].filter(
          (key) => isStudioMediaBlobKey(key) && !remoteKeys.has(key),
        ),
      ])
      const toDownload = neededKeys.filter((key) => !localKeys.has(key))
      const total = toUpload.length + toDownload.length
      let done = 0
      const uploadedKeys = new Set(remoteKeys)
      const failed: string[] = []
      let uploadedVideos = 0

      if (toUpload.length > 0) {
        const videoUploads = toUpload.filter(isStudioVideoBlobKey).length
        setStatus(
          snapshotStatus({
            phase: 'syncing',
            message:
              videoUploads > 0
                ? `Uploading ${videoUploads} video${videoUploads === 1 ? '' : 's'} from this browser…`
                : `Uploading ${toUpload.length} photo${toUpload.length === 1 ? '' : 's'}/video${toUpload.length === 1 ? '' : 's'} from this browser…`,
            done,
            total,
          }),
        )
        await mapPool(toUpload, 2, async (key) => {
          try {
            const blob = await getStudioBlob(key)
            if (!blob) {
              failed.push(`${key} is missing from this browser’s IndexedDB`)
            } else {
              await uploadStudioMediaBlob(userId, key, blob)
              uploadedKeys.add(key)
              if (isStudioVideoBlobKey(key)) uploadedVideos += 1
            }
          } catch (err) {
            failed.push(err instanceof Error ? err.message : String(err))
          }
          done += 1
          setStatus(
            snapshotStatus({
              phase: 'syncing',
              message: `Uploading media ${done}/${toUpload.length} from this browser…`,
              done,
              total,
              uploadedVideos,
            }),
          )
        })
      }

      if (toDownload.length > 0) {
        setStatus(
          snapshotStatus({
            phase: 'syncing',
            message: `Downloading ${toDownload.length} clip${toDownload.length === 1 ? '' : 's'} to this device…`,
            done,
            total,
            uploadedVideos,
          }),
        )
        await mapPool(toDownload, 2, async (key) => {
          const blob = await downloadStudioMediaBlob(userId, key)
          if (blob) await putStudioBlob(key, blob)
          else if (uploadedKeys.has(key) || remoteKeys.has(key)) {
            failed.push(`${key} is in the library JSON but missing from studio-media`)
          }
          done += 1
          setStatus(
            snapshotStatus({
              phase: 'syncing',
              message: `Downloading ${done}/${total} to this device…`,
              done,
              total,
              uploadedVideos,
            }),
          )
        })
      }

      const stamped = stampCloudMediaPaths(
        getStudioState(),
        (blobKey) => studioMediaPath(userId, blobKey),
        uploadedKeys,
      )
      replaceStudioState(stamped, { syncCloud: false })
      await hydrateWithCloud(userId)

      const saved = await saveStudioLibraryPreservingAttachments(userId, getStudioState())
      if (saved.wrote) {
        replaceStudioState(saved.library, { syncCloud: false })
      }
      lastRemoteUpdatedAt.current = saved.savedAt
      writeLastSyncedUserId(userId)
      ignorePullUntil.current = Date.now() + 2500

      const cloudVideos = countUserAttachedVideos(getStudioState())
      const localVideoBlobs = countLocalVideoBlobKeys(localKeys)
      const mediaFailed = failed.length > 0
      const uploadedNoneWithLocalVideos =
        localVideoBlobs > 0 &&
        [...localKeys].filter(isStudioVideoBlobKey).every((key) => !uploadedKeys.has(key)) &&
        uploadedVideos === 0 &&
        !remoteKeys.size

      if (mediaFailed || uploadedNoneWithLocalVideos) {
        const error =
          failed[0] ??
          'This browser has attached MP4s in IndexedDB, but none uploaded to studio-media. Tap Sync now on the PC that has Murphy’s videos.'
        setStatus(
          snapshotStatus({
            phase: 'error',
            message: error,
            error,
            done: total,
            total,
            uploadedVideos,
            cloudVideos,
            lastSyncedAt: saved.savedAt,
          }),
        )
        return
      }

      setStatus(
        snapshotStatus({
          phase: 'ready',
          message: readyMessage(uploadedVideos, cloudVideos),
          done: total,
          total,
          uploadedVideos,
          cloudVideos,
          lastSyncedAt: saved.savedAt,
        }),
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not sync Studio library'
      setStatus(
        snapshotStatus({
          phase: 'error',
          message,
          error: message,
        }),
      )
    } finally {
      syncingRef.current = false
    }
  }, [])

  const pushLocal = useCallback((state: ClipStudioState) => {
    const userId = userIdRef.current
    if (!userId || !isSupabaseConfigured) return
    if (pushTimer.current) window.clearTimeout(pushTimer.current)
    pushTimer.current = window.setTimeout(() => {
      void (async () => {
        if (syncingRef.current) return
        try {
          const localKeys = new Set(await listStudioBlobKeys())
          const adopted = adoptLocalStudioBlobs(state, localKeys)
          const keys = uniqueKeys([
            ...collectStudioBlobKeys(adopted),
            ...[...localKeys].filter(isStudioMediaBlobKey),
          ])
          const remoteKeys = await listRemoteStudioBlobKeys(userId)
          const toUpload = keys.filter((key) => localKeys.has(key) && !remoteKeys.has(key))
          const uploadedKeys = new Set(remoteKeys)
          const failed: string[] = []
          let uploadedVideos = 0
          await mapPool(toUpload, 2, async (key) => {
            try {
              const blob = await getStudioBlob(key)
              if (!blob) {
                failed.push(`${key} is missing from this browser’s IndexedDB`)
                return
              }
              await uploadStudioMediaBlob(userId, key, blob)
              uploadedKeys.add(key)
              if (isStudioVideoBlobKey(key)) uploadedVideos += 1
            } catch (err) {
              failed.push(err instanceof Error ? err.message : String(err))
            }
          })
          const stamped = stampCloudMediaPaths(
            adopted,
            (blobKey) => studioMediaPath(userId, blobKey),
            uploadedKeys,
          )
          replaceStudioState(stamped, { syncCloud: false })
          const saved = await saveStudioLibraryPreservingAttachments(userId, stamped)
          lastRemoteUpdatedAt.current = saved.savedAt
          ignorePullUntil.current = Date.now() + 2500
          const cloudVideos = countUserAttachedVideos(getStudioState())
          if (failed.length > 0) {
            setStatus(
              snapshotStatus({
                phase: 'error',
                message: failed[0],
                error: failed[0],
                lastSyncedAt: saved.savedAt,
                uploadedVideos,
                cloudVideos,
              }),
            )
            return
          }
          setStatus((current) =>
            snapshotStatus({
              ...current,
              phase: 'ready',
              message: readyMessage(uploadedVideos, cloudVideos),
              lastSyncedAt: saved.savedAt,
              error: null,
              uploadedVideos,
              cloudVideos,
            }),
          )
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Could not save Studio to the cloud'
          setStatus(
            snapshotStatus({
              phase: 'error',
              message,
              error: message,
            }),
          )
        }
      })()
    }, 1600)
  }, [])

  useEffect(() => {
    setStudioCloudSyncHandler(user ? pushLocal : null)
    return () => setStudioCloudSyncHandler(null)
  }, [user, pushLocal])

  useEffect(() => {
    if (loading) return
    if (!isSupabaseConfigured) {
      setStatus(
        snapshotStatus({
          phase: 'local',
          message: 'Demo mode — library stays in this browser.',
        }),
      )
      void hydrateWithCloud(null)
      return
    }
    if (!user) {
      setStatus(
        snapshotStatus({
          phase: 'local',
          message: 'Sign in to sync this Studio across phones and computers.',
        }),
      )
      void hydrateWithCloud(null)
      return
    }
    void runSync('signin')
  }, [user, loading, runSync])

  useEffect(() => {
    if (!user || !isSupabaseConfigured) return
    const supabase = getSupabase()
    if (!supabase) return

    const channel = supabase
      .channel(`studio-library-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'studio_libraries',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as { updated_at?: string } | null
          const updatedAt = row?.updated_at
          if (updatedAt && updatedAt === lastRemoteUpdatedAt.current) return
          void runSync('pull')
        },
      )
      .subscribe()

    const onVisible = () => {
      if (document.visibilityState === 'visible') void runSync('pull')
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      void supabase.removeChannel(channel)
    }
  }, [user, runSync])

  const syncNow = useCallback(async () => {
    await runSync('manual')
  }, [runSync])

  const value = useMemo<StudioSyncContextValue>(
    () => ({
      ...status,
      syncNow,
      cloudAvailable: isSupabaseConfigured,
    }),
    [status, syncNow],
  )

  return <StudioSyncContext.Provider value={value}>{children}</StudioSyncContext.Provider>
}

export function useStudioSync(): StudioSyncContextValue {
  const ctx = useContext(StudioSyncContext)
  if (!ctx) throw new Error('useStudioSync must be used within StudioSyncProvider')
  return ctx
}
