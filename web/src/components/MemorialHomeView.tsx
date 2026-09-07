import { Link } from 'react-router-dom'
import { useMemorialCall } from '../context/MemorialCallContext'

export function MemorialHomeView({
  showBack,
  onBack,
}: {
  showBack?: boolean
  onBack?: () => void
}) {
  const { profile, beginIncomingCall, speechSupported } = useMemorialCall()

  return (
    <div className="screen home-screen">
      <div className="home-content">
        {showBack && onBack && (
          <button type="button" className="btn-text back-btn home-back" onClick={onBack}>
            ← Choose dog
          </button>
        )}

        <div className="home-hero">
          <span className="paw-icon large">🐾</span>
          <h1>{profile.dogName}</h1>
          {profile.memorialNote && (
            <p className="memorial-note">{profile.memorialNote}</p>
          )}
        </div>

        {!speechSupported && (
          <p className="speech-hint">
            Speech recognition isn&apos;t available in this browser. Use the
            debug panel during a call to trigger reactions, or type phrases
            below.
          </p>
        )}

        <button
          type="button"
          className="btn-call"
          onClick={beginIncomingCall}
        >
          <span className="btn-icon">📹</span>
          Start Memorial Call
        </button>

        <Link to="/catalog" className="btn-text">
          Reaction catalog
        </Link>
      </div>
    </div>
  )
}
