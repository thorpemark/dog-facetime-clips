import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { callModeForName, modePhotoUrl } from '../data/callModes'
import { MemorialCallProvider } from '../context/MemorialCallContext'
import type { DogProfile } from '../types'
import { identityStillForDog } from '../utils/callIdentity'
import { getStudioBlob } from '../utils/clipStudioMedia'
import {
  findDog,
  getStudioState,
  hydrateStudioMedia,
  subscribeStudio,
} from '../utils/clipStudioStore'
import { MemorialCallFlow } from './MemorialCallFlow'
import { ModePicker } from './ModePicker'

export function DemoCallView() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const requested = params.get('dog')?.trim()
  const mode = callModeForName(requested)
  const [studioTick, setStudioTick] = useState(0)

  useEffect(() => {
    const unsub = subscribeStudio(() => setStudioTick((tick) => tick + 1))
    void hydrateStudioMedia(getStudioBlob).then(() => {
      setStudioTick((tick) => tick + 1)
    })
    return unsub
  }, [])

  const profile = useMemo<DogProfile>(() => {
    void studioTick
    const dogName = mode?.dogName ?? requested ?? 'Murphy'
    const dog = findDog(getStudioState(), dogName)
    const still = identityStillForDog(dogName, dog)
    return {
      dogName,
      ownerName: 'Mark',
      memorialNote: `Clip-library demo for ${dogName} — placeholder or attached reaction videos.`,
      targetKind: mode?.kind,
      avatarUrl: still?.url ?? (mode ? modePhotoUrl(mode) : undefined),
      photoUrls: [],
    }
  }, [mode, requested, studioTick])

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
