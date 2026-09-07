import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MemorialCallProvider } from '../context/MemorialCallContext'
import type { DogProfile } from '../types'
import { MemorialCallFlow } from './MemorialCallFlow'

export function DemoCallView() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const dogName = params.get('dog')?.trim() || 'Murphy'

  const profile = useMemo<DogProfile>(
    () => ({
      dogName,
      ownerName: 'Mark',
      memorialNote: `Clip-library demo for ${dogName} — placeholder or attached reaction videos.`,
      photoUrls: [],
    }),
    [dogName],
  )

  return (
    <MemorialCallProvider initialProfile={profile}>
      <MemorialCallFlow showBack onBack={() => navigate('/studio')} />
    </MemorialCallProvider>
  )
}
