import { useAuth } from '../context/AuthContext'
import { useStudioSync } from '../context/StudioSyncContext'
import { SignInPanel } from './SignInPanel'

export function StudioSyncPanel() {
  const { user, loading, authAvailable, signOut } = useAuth()
  const { phase, message, done, total, error, userVideoCount, syncNow, cloudAvailable } =
    useStudioSync()

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
            {phase === 'syncing' && total > 0
              ? `${message} (${done}/${total})`
              : message || 'Ready.'}
            {phase === 'ready' && userVideoCount > 0
              ? ` ${userVideoCount} attached video${userVideoCount === 1 ? '' : 's'} in this library.`
              : null}
          </p>
          {error && <p className="form-error">{error}</p>}
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
            upload finishes, then sign in with the <strong>same account</strong> on
            your phone (Chrome, not Keep’s in-app browser). This browser’s library
            is uploaded and merged — attached MP4s are kept.
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
