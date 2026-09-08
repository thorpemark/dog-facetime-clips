import { useEffect, useState } from 'react'
import { useMemorialCall } from '../context/MemorialCallContext'
import { IdentityAvatar } from './ModePhoto'

function CallActionButton({
  icon,
  label,
  color,
  onClick,
}: {
  icon: string
  label: string
  color: 'red' | 'green'
  onClick: () => void
}) {
  return (
    <button type="button" className="call-action" onClick={onClick}>
      <span className={`call-action-circle ${color}`}>{icon}</span>
      <span className="call-action-label">{label}</span>
    </button>
  )
}

export function IncomingCallView() {
  const { profile, acceptCall, declineCall } = useMemorialCall()
  const [pulse, setPulse] = useState(false)

  useEffect(() => {
    setPulse(true)
    const interval = window.setInterval(() => {
      if ('vibrate' in navigator) navigator.vibrate(200)
    }, 2000)
    return () => window.clearInterval(interval)
  }, [])

  return (
    <div className="screen incoming-screen">
      <div className="incoming-content">
        <div className={`incoming-avatar ${pulse ? 'pulse' : ''}`}>
          <IdentityAvatar dogName={profile.dogName} url={profile.avatarUrl} />
        </div>
        <p className="incoming-subtitle">Memorial Call</p>
        <h1 className="incoming-name">{profile.dogName}</h1>
        <p className="incoming-type">FaceTime Video</p>
      </div>

      <div className="incoming-actions">
        <CallActionButton
          icon="📞"
          label="Decline"
          color="red"
          onClick={declineCall}
        />
        <CallActionButton
          icon="📹"
          label="Accept"
          color="green"
          onClick={acceptCall}
        />
      </div>
    </div>
  )
}
