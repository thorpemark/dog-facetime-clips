import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { CallTarget, Memorial } from '../types/memorial'
import {
  getMemorialByShareId,
  memorialToCallProfile,
} from '../services/memorialService'
import { MemorialCallProvider } from '../context/MemorialCallContext'
import { MemorialCallFlow } from './MemorialCallFlow'

function targetLabel(target: CallTarget): string {
  if (target.kind === 'together') return target.displayName || 'Together'
  return target.displayName
}

function targetEmoji(target: CallTarget): string {
  if (target.kind === 'together') return '🐾🐾'
  return '🐾'
}

export function ShareMemorialView() {
  const { shareId } = useParams<{ shareId: string }>()
  const navigate = useNavigate()
  const [memorial, setMemorial] = useState<Memorial | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTarget, setSelectedTarget] = useState<CallTarget | null>(null)
  const [ownerName, setOwnerName] = useState('')

  const load = useCallback(async () => {
    if (!shareId) return
    setLoading(true)
    try {
      const data = await getMemorialByShareId(shareId)
      if (!data) {
        setError('Memorial not found.')
        return
      }
      if (data.targets.length === 0) {
        setError('This memorial has no photos yet.')
        return
      }
      const callable = data.targets.filter((t) => t.media.length > 0)
      if (callable.length === 0) {
        setError('This memorial has no photos yet.')
        return
      }
      setMemorial({ ...data, targets: callable })
      if (callable.length === 1) {
        setSelectedTarget(callable[0])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [shareId])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="screen form-screen">
        <div className="form-content centered">
          <p>Loading memorial…</p>
        </div>
      </div>
    )
  }

  if (error || !memorial) {
    return (
      <div className="screen form-screen">
        <div className="form-content centered">
          <p className="form-error">{error ?? 'Not found'}</p>
          <button type="button" className="btn-text" onClick={() => navigate('/')}>
            Go home
          </button>
        </div>
      </div>
    )
  }

  if (!selectedTarget) {
    return (
      <div className="screen picker-screen">
        <div className="picker-content">
          <header className="picker-header">
            <button type="button" className="btn-text back-btn" onClick={() => navigate('/')}>
              ← Home
            </button>
            <h1>{memorial.title}</h1>
            {memorial.note && <p className="memorial-note">{memorial.note}</p>}
          </header>

          <p className="picker-prompt">Who would you like to call?</p>

          <div className="picker-grid">
            {memorial.targets.map((target) => {
              const thumb = target.media[0]
              return (
              <button
                key={target.id}
                type="button"
                className="picker-card"
                onClick={() => setSelectedTarget(target)}
              >
                {thumb ? (
                  <span className="mode-picker-thumb">
                    <img
                      src={thumb.publicUrl}
                      alt=""
                      style={{
                        objectPosition: `${(thumb.focalX ?? 0.5) * 100}% ${(thumb.focalY ?? 0.5) * 100}%`,
                      }}
                    />
                  </span>
                ) : (
                  <span className="picker-emoji">{targetEmoji(target)}</span>
                )}
                <span className="picker-name">{targetLabel(target)}</span>
                <span className="picker-meta">
                  {target.media.length} photo{target.media.length !== 1 ? 's' : ''}
                </span>
              </button>
              )
            })}
          </div>

          <label className="owner-name-input">
            Your name (optional — helps reactions)
            <input
              type="text"
              placeholder="e.g. Alex"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
            />
          </label>
        </div>
      </div>
    )
  }

  const callProfile = memorialToCallProfile(
    memorial,
    selectedTarget,
    ownerName.trim() || 'Family',
  )

  return (
    <MemorialCallProvider initialProfile={callProfile}>
      <MemorialCallFlow
        showBack={memorial.targets.length > 1}
        onBack={() => setSelectedTarget(null)}
      />
    </MemorialCallProvider>
  )
}
