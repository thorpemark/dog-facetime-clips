import { useAuth } from '../context/AuthContext'
import { useStudioSync } from '../context/StudioSyncContext'
import { SignInPanel } from './SignInPanel'

export function StudioSyncPanel() {
  const { user, loading, authAvailable, signOut } = useAuth()
  const {
    phase,
    message,
    done,
    total,
    error,
    userVideoCount,
    uploadedVideos,
    cloudVideos,
    syncNow,
    cloudAvailable,
  } = useStudioSync()

  if (!cloudAvailable || !authAvailable) {
    return (
      <section className="studio-sync" aria-label="Studio sync">
        <h2>Sync Studio across devices</h2>
        <p>
          This GitHub Pages build has no Supabase keys, so the library stays in{' '}
          <strong>this browser</strong> (localStorage + IndexedDB). Sample Call on
          another phone will show the colored placeholder clips until you add{' '}
          <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> and
          sign in.
        </p>
      </section>
    )
  }

  const statusText =
    phase === 'syncing' && total > 0 ? `${message} (${done}/${total})` : message || 'Ready.'

  return (
    <section className="studio-sync" aria-label="Studio sync">
      <h2>Sync Studio across devices</h2>
      {loading ? (
        <p>Checking sign-in…</p>
      ) : user ? (
        <>
          <p>
            Signed in as <strong>{user.email ?? 'your account'}</strong>. Same Google
            / email on PC and iPhone shares dogs, generation stills, call idle, and
            attached MP4s. Do <strong>not</strong> tap Reset seed — that only clears
            this browser and leaves the cloud library alone.
          </p>
          <p className="studio-sync-status" data-phase={phase}>
            {statusText}
          </p>
          {phase !== 'syncing' && (
            <p className="studio-sync-counts">
              {uploadedVideos > 0
                ? `Uploaded ${uploadedVideos} video${uploadedVideos === 1 ? '' : 's'} this pass.`
                : null}{' '}
              {cloudVideos > 0
                ? `${cloudVideos} attached video${cloudVideos === 1 ? '' : 's'} in the cloud library.`
                : userVideoCount > 0
                  ? `${userVideoCount} attached video${userVideoCount === 1 ? '' : 's'} in this browser — they still need to upload.`
                  : 'No attached videos in the cloud yet.'}
            </p>
          )}
          {error && <p className="form-error">{error}</p>}
          {phase === 'ready' && cloudVideos === 0 && userVideoCount === 0 && (
            <p className="studio-sync-warn">
              JSON sync without MP4s is not enough. On the PC that already has
              Murphy’s videos, stay signed in and tap <strong>Sync now</strong> until
              this banner says how many videos uploaded.
            </p>
          )}
          <div className="studio-sync-actions">
            <button
              type="button"
              className="btn-secondary"
              disabled={phase === 'syncing'}
              onClick={() => void syncNow()}
            >
              {phase === 'syncing' ? 'Syncing…' : 'Sync now'}
            </button>
            <button type="button" className="btn-text" onClick={() => void signOut()}>
              Sign out
            </button>
          </div>
        </>
      ) : (
        <>
          <p>
            Sign in on the computer that already has Murphy’s videos, wait until
            the banner says how many videos uploaded, then sign in with the{' '}
            <strong>same account</strong> on your phone (Chrome, not Keep’s in-app
            browser). This browser’s library is uploaded and merged — attached MP4s
            are kept.
          </p>
          <SignInPanel
            compact
            redirectTo="/studio"
            lead="Sign in to sync this Studio (videos, stills, idle pick) across your devices."
          />
        </>
      )}
    </section>
  )
}

export function StudioSyncCallNote() {
  const { user } = useAuth()
  const { phase, message, cloudAvailable } = useStudioSync()
  if (!cloudAvailable || !user) return null
  if (phase !== 'syncing' && phase !== 'error') return null
  return (
    <p className="studio-sync-call-note" role="status">
      {phase === 'error' ? message : `${message} Sample Call uses this account’s library.`}
    </p>
  )
}
