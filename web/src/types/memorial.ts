export type CallTargetKind = 'dog_a' | 'dog_b' | 'together'

export interface MediaAsset {
  id: string
  publicUrl: string
  storagePath: string
  reactionTag: string | null
  sortOrder: number
  /** Normalized horizontal focal point for portrait cover crop (0–1). */
  focalX: number
  /** Normalized vertical focal point for portrait cover crop (0–1). */
  focalY: number
  /** Zoom-out factor for portrait cover crop (1 = default cover). */
  focalZoom: number
  /** Normalized crop width (fraction of image width); optional legacy zoom fallback when absent. */
  cropWidth?: number
  /** Normalized crop height (fraction of image height); optional legacy zoom fallback when absent. */
  cropHeight?: number
  /** Fine rotation in degrees for portrait framing (default 0). */
  focalRotationDeg?: number
  /** Landscape / desktop widescreen framing (nullable until saved). */
  landscapeFocalX?: number
  landscapeFocalY?: number
  landscapeFocalZoom?: number
  landscapeCropWidth?: number
  landscapeCropHeight?: number
  landscapeFocalRotationDeg?: number
}

export interface CallTarget {
  id: string
  kind: CallTargetKind
  displayName: string
  sortOrder: number
  media: MediaAsset[]
}

export interface Memorial {
  id: string
  title: string
  note: string
  shareId: string
  editToken?: string
  createdAt: string
  targets: CallTarget[]
}

export interface CreateMemorialInput {
  title: string
  note?: string
}

export interface MemorialSummary {
  id: string
  title: string
  note: string
  shareId: string
  editToken: string
  createdAt: string
}

export interface CallSessionProfile {
  dogName: string
  ownerName: string
  memorialNote: string
  memorialTitle: string
  targetKind: CallTargetKind
  /** Incoming / home avatar (usually the first still). */
  avatarUrl?: string
  photoUrls: string[]
  /** Per-photo framing aligned with photoUrls. */
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
  /** Future: per-reaction video clip URLs keyed by rule id */
  reactionMedia?: Record<string, string>
}

export type MotionPreset = 'idle' | 'perk' | 'excited' | 'calm'

export interface MediaPlaybackSource {
  type: 'photo' | 'video'
  url: string
}
