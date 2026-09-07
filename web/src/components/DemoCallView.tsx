import { useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { callModeForName, modePhotoUrl } from '../data/callModes'
import { MemorialCallProvider } from '../context/MemorialCallContext'
import type { DogProfile } from '../types'
import { MemorialCallFlow } from './MemorialCallFlow'
import { ModePicker } from './ModePicker'

export function DemoCallView() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const requested = params.get('dog')?.trim()
  const mode = callModeForName(requested)

  const profile = useMemo<DogProfile>(() => {
    const dogName = mode?.dogName ?? requested ?? 'Murphy'
    return {
      dogName,
      ownerName: 'Mark',
      memorialNote: `Clip-library demo for ${dogName} — placeholder or attached reaction videos.`,
      targetKind: mode?.kind,
      avatarUrl: mode ? modePhotoUrl(mode) : undefined,
      photoUrls: [],
    }
  }, [mode, requested])

  if (!requested) {
    return (
      <div className="screen picker-screen">
        <div className="picker-content">
          <header className="picker-header">
            <Link to="/" className="btn-text back-btn">
              ← Home
            </Link>
            <h1>Sample call</h1>
            <p className="memorial-note">
              Clip demo stays on reaction videos. These stills are the Murphy /
              Riley / Both avatars and Studio seed photos.
            </p>
          </header>
          <ModePicker
            onSelect={(picked) =>
              navigate(`/demo?dog=${encodeURIComponent(picked.dogName)}`)
            }
          />
        </div>
      </div>
    )
  }

  return (
    <MemorialCallProvider initialProfile={profile}>
      <MemorialCallFlow showBack onBack={() => navigate('/demo')} />
    </MemorialCallProvider>
  )
}
