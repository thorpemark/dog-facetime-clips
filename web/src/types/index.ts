export interface DogProfile {
  dogName: string
  ownerName: string
  memorialNote: string
  memorialTitle?: string
  targetKind?: 'dog_a' | 'dog_b' | 'together'
  /** Incoming / home avatar only — does not switch the call into Ken Burns photo mode. */
  avatarUrl?: string
  photoUrls?: string[]
  photoFocalPoints?: Array<{
    focalX: number
    focalY: number
    focalZoom?: number
    cropWidth?: number
    cropHeight?: number
    focalRotationDeg?: number
    landscapeFocalX?: number
    landscapeFocalY?: number
    landscapeFocalZoom?: number
    landscapeCropWidth?: number
    landscapeCropHeight?: number
    landscapeFocalRotationDeg?: number
  }>
}

export const DEFAULT_PROFILE: DogProfile = {
  dogName: 'Biscuit',
  ownerName: 'Alex',
  memorialNote: '',
  photoUrls: [],
}

export type CallPhase = 'home' | 'incoming' | 'active' | 'ended'

export type BehaviorState =
  | { type: 'idle' }
  | { type: 'listen' }
  | { type: 'react'; clipId: string }
  | { type: 'cooldown' }

export interface KeywordRule {
  id: string
  phrases: string[]
  clipFileName: string
  priority: number
  description?: string
}

export interface KeywordRulesConfig {
  version: number
  idleClip: string
  rules: KeywordRule[]
}
