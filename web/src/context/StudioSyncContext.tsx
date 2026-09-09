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
  saveRemoteStudioLibrary,
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
  collectStudioBlobKeys,
  countUserAttachedVideos,
  isDifferentAccountLocalLibrary,
  mergeStudioLibraries,
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
}

const StudioSyncContext = createContext<StudioSyncContextValue | null>(null)

function snapshotStatus(partial: Partial<StudioSyncStatus>): StudioSyncStatus {
  const state = getStudioState()
  return {
    ...defaultStatus,
    userVideoCount: countUserAttachedVideos(state),
    ...partial,
  }
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
      const local = getStudioState()
      const remote = await fetchRemoteStudioLibrary(userId)
      lastRemoteUpdatedAt.current = remote?.updatedAt ?? null

      const lastUser = readLastSyncedUserId()
      const switchedAccount = isDifferentAccountLocalLibrary(lastUser, userId)
      let next: ClipStudioState
      if (switchedAccount) {
        next = remote?.library
          ? mergeStudioLibraries(createSeedStudioState(), remote.library)
          : createSeedStudioState()
      } else {
        next = mergeStudioLibraries(local, remote?.library ?? null)
      }

      replaceStudioState(next, { syncCloud: false })

      const neededKeys = collectStudioBlobKeys(next)
      const localKeys = new Set(await listStudioBlobKeys())
      const remoteKeys = await listRemoteStudioBlobKeys(userId)

      const toUpload = neededKeys.filter((key) => localKeys.has(key) && !remoteKeys.has(key))
      const toDownload = neededKeys.filter((key) => !localKeys.has(key))
      const total = toUpload.length + toDownload.length
      let done = 0

      if (toUpload.length > 0) {
        setStatus(
          snapshotStatus({
            phase: 'syncing',
            message: `Uploading ${toUpload.length} photo${toUpload.length === 1 ? '' : 's'}/video${toUpload.length === 1 ? '' : 's'} from this browser…`,
            done,
            total,
          }),
        )
        await mapPool(toUpload, 2, async (key) => {
          const blob = await getStudioBlob(key)
          if (blob) await uploadStudioMediaBlob(userId, key, blob)
          done += 1
          setStatus(
            snapshotStatus({
              phase: 'syncing',
              message: `Uploading ${done}/${total} from this browser…`,
              done,
              total,
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
          }),
        )
        await mapPool(toDownload, 2, async (key) => {
          const blob = await downloadStudioMediaBlob(userId, key)
          if (blob) await putStudioBlob(key, blob)
          done += 1
          setStatus(
            snapshotStatus({
              phase: 'syncing',
              message: `Downloading ${done}/${total} to this device…`,
              done,
              total,
            }),
          )
        })
      }

      await hydrateWithCloud(userId)

      const savedAt = await saveRemoteStudioLibrary(userId, getStudioState())
      lastRemoteUpdatedAt.current = savedAt
      writeLastSyncedUserId(userId)
      ignorePullUntil.current = Date.now() + 2500

      setStatus(
        snapshotStatus({
          phase: 'ready',
          message: 'Studio library is synced for this account.',
          done: total,
          total,
          lastSyncedAt: savedAt,
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
          const keys = collectStudioBlobKeys(state)
          const localKeys = new Set(await listStudioBlobKeys())
          const remoteKeys = await listRemoteStudioBlobKeys(userId)
          const toUpload = keys.filter((key) => localKeys.has(key) && !remoteKeys.has(key))
          await mapPool(toUpload, 2, async (key) => {
            const blob = await getStudioBlob(key)
            if (blob) await uploadStudioMediaBlob(userId, key, blob)
          })
          const savedAt = await saveRemoteStudioLibrary(userId, state)
          lastRemoteUpdatedAt.current = savedAt
          ignorePullUntil.current = Date.now() + 2500
          setStatus((current) =>
            snapshotStatus({
              ...current,
              phase: 'ready',
              message: 'Studio library is synced for this account.',
              lastSyncedAt: savedAt,
              error: null,
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
