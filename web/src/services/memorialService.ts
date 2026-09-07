import { getSupabase, isSupabaseConfigured } from '../lib/supabase'
import { generateEditToken, generateId, generateShareId } from '../lib/ids'
import {
  getPendingClaims,
  removePendingClaim,
} from '../lib/pendingMemorials'
import type {
  CallTarget,
  CallTargetKind,
  CreateMemorialInput,
  MediaAsset,
  Memorial,
  MemorialSummary,
} from '../types/memorial'
import {
  DEFAULT_FOCAL_X,
  DEFAULT_FOCAL_Y,
  DEFAULT_FOCAL_ZOOM,
  type DualFraming,
  type FocalFrame,
  defaultDualFramingForImage,
  focalFrameFromValues,
  hasStoredLandscapeFraming,
} from '../utils/focalPoint'

const DEMO_STORE_KEY = 'memorial-call-demo-store'

interface DemoStore {
  memorials: Memorial[]
}

function readDemoStore(): DemoStore {
  try {
    const raw = localStorage.getItem(DEMO_STORE_KEY)
    if (raw) return JSON.parse(raw) as DemoStore
  } catch {
    /* ignore */
  }
  return { memorials: [] }
}

function writeDemoStore(store: DemoStore): void {
  localStorage.setItem(DEMO_STORE_KEY, JSON.stringify(store))
}

function mapRpcMemorialSummary(data: Record<string, unknown>): MemorialSummary {
  return {
    id: data.id as string,
    title: data.title as string,
    note: (data.note as string) ?? '',
    shareId: data.share_id as string,
    editToken: data.edit_token as string,
    createdAt: data.created_at as string,
  }
}

function mapRpcMemorial(data: Record<string, unknown>): Memorial {
  const targets = (data.targets as Record<string, unknown>[] | undefined) ?? []
  return {
    id: data.id as string,
    title: data.title as string,
    note: (data.note as string) ?? '',
    shareId: data.share_id as string,
    editToken: data.edit_token as string | undefined,
    createdAt: data.created_at as string,
    targets: targets.map(mapRpcTarget),
  }
}

function mapRpcTarget(t: Record<string, unknown>): CallTarget {
  const media = (t.media as Record<string, unknown>[] | undefined) ?? []
  return {
    id: t.id as string,
    kind: t.kind as CallTargetKind,
    displayName: t.display_name as string,
    sortOrder: (t.sort_order as number) ?? 0,
    media: media.map(mapRpcMedia),
  }
}

function parseRpcJson(data: unknown): Record<string, unknown> {
  if (typeof data === 'string') {
    return JSON.parse(data) as Record<string, unknown>
  }
  return (data ?? {}) as Record<string, unknown>
}

function parseRpcJsonArray(data: unknown): Record<string, unknown>[] {
  if (data === null || data === undefined) return []
  if (typeof data === 'string') {
    const parsed = JSON.parse(data) as unknown
    return Array.isArray(parsed) ? (parsed as Record<string, unknown>[]) : []
  }
  return Array.isArray(data) ? (data as Record<string, unknown>[]) : []
}

function formatRpcError(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message || fallback
  if (err && typeof err === 'object' && 'message' in err) {
    const message = String((err as { message: unknown }).message)
    return message || fallback
  }
  return fallback
}

function memorialPhotoPublicUrl(storagePath: string): string {
  if (!storagePath || storagePath.startsWith('demo/')) return ''
  const supabase = getSupabase()
  if (!supabase) return ''
  const { data } = supabase.storage.from('memorial-photos').getPublicUrl(storagePath)
  return data.publicUrl
}

function portraitFramingFromRecord(m: Record<string, unknown>): FocalFrame {
  return focalFrameFromValues(
    m.focal_x ?? m.focalX,
    m.focal_y ?? m.focalY,
    m.focal_zoom ?? m.focalZoom,
    m.focal_crop_w ?? m.focalCropW ?? m.cropWidth,
    m.focal_crop_h ?? m.focalCropH ?? m.cropHeight,
    m.focal_rotation_deg ?? m.focalRotationDeg,
  )
}

function landscapeFramingFromRecord(m: Record<string, unknown>): FocalFrame | null {
  if (
    !hasStoredLandscapeFraming(
      m.landscape_focal_x ?? m.landscapeFocalX,
      m.landscape_focal_y ?? m.landscapeFocalY,
      m.landscape_focal_zoom ?? m.landscapeFocalZoom,
      m.landscape_focal_crop_w ?? m.landscapeCropW ?? m.landscapeCropWidth,
      m.landscape_focal_crop_h ?? m.landscapeCropH ?? m.landscapeCropHeight,
      m.landscape_focal_rotation_deg ?? m.landscapeFocalRotationDeg,
    )
  ) {
    return null
  }

  return focalFrameFromValues(
    m.landscape_focal_x ?? m.landscapeFocalX,
    m.landscape_focal_y ?? m.landscapeFocalY,
    m.landscape_focal_zoom ?? m.landscapeFocalZoom,
    m.landscape_focal_crop_w ?? m.landscapeCropW ?? m.landscapeCropWidth,
    m.landscape_focal_crop_h ?? m.landscapeCropH ?? m.landscapeCropHeight,
    m.landscape_focal_rotation_deg ?? m.landscapeFocalRotationDeg,
  )
}

export function dualFramingFromMediaAsset(
  asset: MediaAsset,
  imageAspect?: number,
  preferWideFrame = false,
): DualFraming {
  const portrait = focalFrameFromValues(
    asset.focalX,
    asset.focalY,
    asset.focalZoom,
    asset.cropWidth,
    asset.cropHeight,
    asset.focalRotationDeg,
  )

  const hasLandscape =
    asset.landscapeFocalX != null ||
    asset.landscapeFocalY != null ||
    asset.landscapeFocalZoom != null ||
    asset.landscapeCropWidth != null ||
    asset.landscapeCropHeight != null ||
    asset.landscapeFocalRotationDeg != null

  const landscape = hasLandscape
    ? focalFrameFromValues(
        asset.landscapeFocalX,
        asset.landscapeFocalY,
        asset.landscapeFocalZoom,
        asset.landscapeCropWidth,
        asset.landscapeCropHeight,
        asset.landscapeFocalRotationDeg,
      )
    : imageAspect != null
      ? defaultDualFramingForImage(imageAspect, preferWideFrame).landscape
      : focalFrameFromValues()

  return { portrait, landscape }
}

function applyDualFramingToAsset(asset: MediaAsset, framing: DualFraming): void {
  asset.focalX = framing.portrait.focalX
  asset.focalY = framing.portrait.focalY
  asset.focalZoom = framing.portrait.focalZoom
  asset.cropWidth = framing.portrait.cropWidth
  asset.cropHeight = framing.portrait.cropHeight
  asset.focalRotationDeg = framing.portrait.focalRotationDeg
  asset.landscapeFocalX = framing.landscape.focalX
  asset.landscapeFocalY = framing.landscape.focalY
  asset.landscapeFocalZoom = framing.landscape.focalZoom
  asset.landscapeCropWidth = framing.landscape.cropWidth
  asset.landscapeCropHeight = framing.landscape.cropHeight
  asset.landscapeFocalRotationDeg = framing.landscape.focalRotationDeg
}

function mapRpcMedia(m: Record<string, unknown>): MediaAsset {
  const storagePath = String(m.storage_path ?? m.storagePath ?? '')
  const storedUrl = (m.public_url ?? m.publicUrl) as string | undefined
  const publicUrl =
    storagePath && !storagePath.startsWith('demo/')
      ? memorialPhotoPublicUrl(storagePath)
      : (storedUrl ?? '')
  const portrait = portraitFramingFromRecord(m)
  const landscape = landscapeFramingFromRecord(m)

  return {
    id: String(m.id ?? ''),
    publicUrl,
    storagePath,
    reactionTag: (m.reaction_tag ?? m.reactionTag ?? null) as string | null,
    sortOrder: Number(m.sort_order ?? m.sortOrder ?? 0),
    focalX: portrait.focalX,
    focalY: portrait.focalY,
    focalZoom: portrait.focalZoom,
    cropWidth: portrait.cropWidth,
    cropHeight: portrait.cropHeight,
    focalRotationDeg: portrait.focalRotationDeg,
    landscapeFocalX: landscape?.focalX,
    landscapeFocalY: landscape?.focalY,
    landscapeFocalZoom: landscape?.focalZoom,
    landscapeCropWidth: landscape?.cropWidth,
    landscapeCropHeight: landscape?.cropHeight,
    landscapeFocalRotationDeg: landscape?.focalRotationDeg,
  }
}

export function isDemoMode(): boolean {
  return !isSupabaseConfigured
}

function formatUploadError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  const lower = message.toLowerCase()

  if (lower.includes('row-level security')) {
    return 'Photo could not be saved. The app registers photos via a secure RPC — if this persists, confirm register_media_asset is deployed and re-run web/supabase/migration.sql.'
  }
  if (lower.includes('invalid edit token or target')) {
    return 'Could not find this dog profile. Refresh the page and try again.'
  }
  if (lower.includes('storage path must start with edit token folder')) {
    return 'Upload path was invalid. Refresh the page and try again.'
  }
  if (lower.includes('payload too large') || lower.includes('entity too large')) {
    return 'Photo is too large (max 10 MB).'
  }
  if (lower.includes('mime') || lower.includes('not allowed')) {
    return 'Unsupported image type. Use JPEG, PNG, or WebP.'
  }

  return message || 'Upload failed'
}

function formatDeleteError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  const lower = message.toLowerCase()

  if (lower.includes('row-level security')) {
    return 'Photo could not be removed. The app deletes via a secure RPC — if this persists, confirm delete_media_asset is deployed.'
  }
  if (lower.includes('invalid edit token or media')) {
    return 'Photo not found. Refresh the page and try again.'
  }

  return message || 'Delete failed'
}

// ─── Demo implementations ─────────────────────────────────────────────────

function demoCreateMemorial(input: CreateMemorialInput): Memorial {
  const store = readDemoStore()
  const memorial: Memorial = {
    id: generateId(),
    title: input.title.trim(),
    note: input.note?.trim() ?? '',
    shareId: generateShareId(),
    editToken: generateEditToken(),
    createdAt: new Date().toISOString(),
    targets: [],
  }
  store.memorials.push(memorial)
  writeDemoStore(store)
  return memorial
}

function demoGetByShareId(shareId: string): Memorial | null {
  const store = readDemoStore()
  return store.memorials.find((m) => m.shareId === shareId) ?? null
}

function demoGetByEditToken(editToken: string): Memorial | null {
  const store = readDemoStore()
  return store.memorials.find((m) => m.editToken === editToken) ?? null
}

function demoUpdateMemorial(
  editToken: string,
  title: string,
  note: string,
): Memorial {
  const store = readDemoStore()
  const memorial = store.memorials.find((m) => m.editToken === editToken)
  if (!memorial) throw new Error('Memorial not found')
  memorial.title = title.trim()
  memorial.note = note
  writeDemoStore(store)
  return memorial
}

function demoUpsertTarget(
  editToken: string,
  kind: CallTargetKind,
  displayName: string,
  sortOrder: number,
): CallTarget {
  const store = readDemoStore()
  const memorial = store.memorials.find((m) => m.editToken === editToken)
  if (!memorial) throw new Error('Memorial not found')

  const existing = memorial.targets.find((t) => t.kind === kind)
  if (existing) {
    existing.displayName = displayName.trim()
    existing.sortOrder = sortOrder
    writeDemoStore(store)
    return existing
  }

  const target: CallTarget = {
    id: generateId(),
    kind,
    displayName: displayName.trim(),
    sortOrder,
    media: [],
  }
  memorial.targets.push(target)
  memorial.targets.sort((a, b) => a.sortOrder - b.sortOrder)
  writeDemoStore(store)
  return target
}

async function demoAddPhoto(
  editToken: string,
  target: { kind: CallTargetKind; displayName: string; sortOrder: number },
  file: File,
  sortOrder: number,
): Promise<PhotoUploadResult> {
  const callTarget = demoUpsertTarget(
    editToken,
    target.kind,
    target.displayName,
    target.sortOrder,
  )

  const dataUrl = await fileToDataUrl(file)
  const asset: MediaAsset = {
    id: generateId(),
    publicUrl: dataUrl,
    storagePath: `demo/${callTarget.id}/${file.name}`,
    reactionTag: null,
    sortOrder,
    focalX: DEFAULT_FOCAL_X,
    focalY: DEFAULT_FOCAL_Y,
    focalZoom: DEFAULT_FOCAL_ZOOM,
  }
  callTarget.media.push(asset)
  callTarget.media.sort((a, b) => a.sortOrder - b.sortOrder)
  const store = readDemoStore()
  writeDemoStore(store)
  return { asset, targetId: callTarget.id }
}

function demoDeletePhoto(editToken: string, mediaId: string): void {
  const store = readDemoStore()
  const memorial = store.memorials.find((m) => m.editToken === editToken)
  if (!memorial) throw new Error('Memorial not found')
  for (const target of memorial.targets) {
    const idx = target.media.findIndex((m) => m.id === mediaId)
    if (idx >= 0) {
      target.media.splice(idx, 1)
      writeDemoStore(store)
      return
    }
  }
  throw new Error('Media not found')
}

function demoRegenerateShareId(editToken: string): string {
  const store = readDemoStore()
  const memorial = store.memorials.find((m) => m.editToken === editToken)
  if (!memorial) throw new Error('Memorial not found')
  memorial.shareId = generateShareId()
  writeDemoStore(store)
  return memorial.shareId
}

function demoDeleteTarget(editToken: string, targetId: string): void {
  const store = readDemoStore()
  const memorial = store.memorials.find((m) => m.editToken === editToken)
  if (!memorial) throw new Error('Memorial not found')
  memorial.targets = memorial.targets.filter((t) => t.id !== targetId)
  writeDemoStore(store)
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ─── Public API ─────────────────────────────────────────────────────────────

export interface UploadPhotoTarget {
  kind: CallTargetKind
  displayName: string
  sortOrder: number
}

export interface PhotoUploadResult {
  asset: MediaAsset
  targetId: string
}

export async function createMemorial(
  input: CreateMemorialInput,
): Promise<Memorial> {
  if (isDemoMode()) return demoCreateMemorial(input)

  const supabase = getSupabase()!
  const { data, error } = await supabase.rpc('create_memorial', {
    p_title: input.title,
    p_note: input.note ?? '',
  })
  if (error) throw error
  return mapRpcMemorial(data as Record<string, unknown>)
}

export async function getMemorialByShareId(
  shareId: string,
): Promise<Memorial | null> {
  if (isDemoMode()) return demoGetByShareId(shareId)

  const supabase = getSupabase()!
  const { data, error } = await supabase.rpc('get_memorial_public', {
    p_share_id: shareId,
  })
  if (error) throw error
  if (!data) return null
  return mapRpcMemorial(data as Record<string, unknown>)
}

export async function getMemorialByEditToken(
  editToken: string,
): Promise<Memorial | null> {
  if (isDemoMode()) return demoGetByEditToken(editToken)

  const supabase = getSupabase()!
  const { data, error } = await supabase.rpc('get_memorial_for_edit', {
    p_edit_token: editToken,
  })
  if (error) throw error
  if (!data) return null
  return mapRpcMemorial(data as Record<string, unknown>)
}

export async function updateMemorial(
  editToken: string,
  title: string,
  note: string,
): Promise<Memorial> {
  if (isDemoMode()) return demoUpdateMemorial(editToken, title, note)

  const supabase = getSupabase()!
  const { data, error } = await supabase.rpc('update_memorial', {
    p_edit_token: editToken,
    p_title: title,
    p_note: note,
  })
  if (error) throw error
  const memorial = await getMemorialByEditToken(editToken)
  if (!memorial) throw new Error('Memorial not found')
  const updated = data as Record<string, unknown>
  memorial.title = updated.title as string
  memorial.note = updated.note as string
  return memorial
}

export async function upsertCallTarget(
  editToken: string,
  kind: CallTargetKind,
  displayName: string,
  sortOrder: number,
): Promise<CallTarget> {
  if (isDemoMode()) return demoUpsertTarget(editToken, kind, displayName, sortOrder)

  const supabase = getSupabase()!
  const { data, error } = await supabase.rpc('upsert_call_target', {
    p_edit_token: editToken,
    p_kind: kind,
    p_display_name: displayName,
    p_sort_order: sortOrder,
  })
  if (error) throw error
  const t = data as Record<string, unknown>
  return {
    id: t.id as string,
    kind: t.kind as CallTargetKind,
    displayName: t.display_name as string,
    sortOrder: (t.sort_order as number) ?? 0,
    media: [],
  }
}

export async function uploadPhoto(
  editToken: string,
  target: UploadPhotoTarget,
  file: File,
  mediaSortOrder: number,
  framing?: DualFraming,
): Promise<PhotoUploadResult> {
  if (isDemoMode()) return demoAddPhoto(editToken, target, file, mediaSortOrder)

  if (!editToken?.trim()) {
    throw new Error('Memorial is not ready yet. Save the memorial name and try again.')
  }

  // Ensure the call target row exists before storage upload + media registration.
  const callTarget = await upsertCallTarget(
    editToken,
    target.kind,
    target.displayName,
    target.sortOrder,
  )

  const supabase = getSupabase()!
  const ext = file.name.split('.').pop() ?? 'jpg'
  const filename = `${crypto.randomUUID()}.${ext}`
  const storagePath = `${editToken}/${callTarget.id}/${filename}`

  const { error: uploadError } = await supabase.storage
    .from('memorial-photos')
    .upload(storagePath, file, {
      contentType: file.type || 'image/jpeg',
      upsert: false,
    })
  if (uploadError) {
    throw new Error(formatUploadError(uploadError))
  }

  const { data: urlData } = supabase.storage
    .from('memorial-photos')
    .getPublicUrl(storagePath)

  // media_assets has RLS with no anon INSERT policies — register only via RPC.
  const { data, error } = await supabase.rpc('register_media_asset', {
    p_edit_token: editToken,
    p_target_id: callTarget.id,
    p_storage_path: storagePath,
    p_public_url: urlData.publicUrl,
    p_sort_order: mediaSortOrder,
    p_reaction_tag: null,
    p_focal_x: framing?.portrait.focalX ?? DEFAULT_FOCAL_X,
    p_focal_y: framing?.portrait.focalY ?? DEFAULT_FOCAL_Y,
    p_focal_zoom: framing?.portrait.focalZoom ?? DEFAULT_FOCAL_ZOOM,
    p_focal_crop_w: framing?.portrait.cropWidth ?? null,
    p_focal_crop_h: framing?.portrait.cropHeight ?? null,
    p_focal_rotation_deg: framing?.portrait.focalRotationDeg ?? 0,
    p_landscape_focal_x: framing?.landscape.focalX ?? null,
    p_landscape_focal_y: framing?.landscape.focalY ?? null,
    p_landscape_focal_zoom: framing?.landscape.focalZoom ?? null,
    p_landscape_focal_crop_w: framing?.landscape.cropWidth ?? null,
    p_landscape_focal_crop_h: framing?.landscape.cropHeight ?? null,
    p_landscape_focal_rotation_deg: framing?.landscape.focalRotationDeg ?? null,
  })
  if (error) {
    await supabase.storage.from('memorial-photos').remove([storagePath])
    throw new Error(formatUploadError(error))
  }

  const row = parseRpcJson(data)
  const asset = mapRpcMedia(row)
  asset.storagePath = storagePath
  asset.publicUrl = memorialPhotoPublicUrl(storagePath)

  if (!asset.id) {
    await supabase.storage.from('memorial-photos').remove([storagePath])
    throw new Error(
      'Photo uploaded but registration returned no media id. Re-run web/supabase/migration.sql and try again.',
    )
  }
  if (!asset.publicUrl) {
    throw new Error('Photo uploaded but public URL could not be resolved.')
  }

  return {
    asset,
    targetId: callTarget.id,
  }
}

function demoUpdateMediaFocalPoint(
  editToken: string,
  mediaId: string,
  framing: DualFraming,
): MediaAsset {
  const store = readDemoStore()
  const memorial = store.memorials.find((m) => m.editToken === editToken)
  if (!memorial) throw new Error('Memorial not found')

  for (const target of memorial.targets) {
    const asset = target.media.find((m) => m.id === mediaId)
    if (asset) {
      applyDualFramingToAsset(asset, framing)
      writeDemoStore(store)
      return asset
    }
  }
  throw new Error('Media not found')
}

export async function updateMediaFocalPoint(
  editToken: string,
  mediaId: string,
  framing: DualFraming,
): Promise<MediaAsset> {
  if (isDemoMode()) return demoUpdateMediaFocalPoint(editToken, mediaId, framing)

  const supabase = getSupabase()!
  const { data, error } = await supabase.rpc('update_media_focal_point', {
    p_edit_token: editToken,
    p_media_id: mediaId,
    p_focal_x: framing.portrait.focalX,
    p_focal_y: framing.portrait.focalY,
    p_focal_zoom: framing.portrait.focalZoom,
    p_focal_crop_w: framing.portrait.cropWidth ?? null,
    p_focal_crop_h: framing.portrait.cropHeight ?? null,
    p_focal_rotation_deg: framing.portrait.focalRotationDeg ?? 0,
    p_landscape_focal_x: framing.landscape.focalX,
    p_landscape_focal_y: framing.landscape.focalY,
    p_landscape_focal_zoom: framing.landscape.focalZoom,
    p_landscape_focal_crop_w: framing.landscape.cropWidth ?? null,
    p_landscape_focal_crop_h: framing.landscape.cropHeight ?? null,
    p_landscape_focal_rotation_deg: framing.landscape.focalRotationDeg ?? null,
  })
  if (error) throw new Error(formatRpcError(error, 'Failed to save focus point'))

  return mapRpcMedia(parseRpcJson(data))
}

export async function deletePhoto(
  editToken: string,
  mediaId: string,
  storagePath?: string,
): Promise<void> {
  if (isDemoMode()) {
    demoDeletePhoto(editToken, mediaId)
    return
  }

  const supabase = getSupabase()!
  let resolvedStoragePath = storagePath ?? null

  if (!resolvedStoragePath) {
    const memorial = await getMemorialByEditToken(editToken)
    if (!memorial) throw new Error('Memorial not found')

    for (const target of memorial.targets) {
      const asset = target.media.find((m) => m.id === mediaId)
      if (asset) {
        resolvedStoragePath = asset.storagePath
        break
      }
    }
  }

  // media_assets has RLS with no anon DELETE policies — remove only via RPC.
  const { error } = await supabase.rpc('delete_media_asset', {
    p_edit_token: editToken,
    p_media_id: mediaId,
  })
  if (error) {
    throw new Error(formatDeleteError(error))
  }

  if (resolvedStoragePath && !resolvedStoragePath.startsWith('demo/')) {
    const { error: storageError } = await supabase.storage
      .from('memorial-photos')
      .remove([resolvedStoragePath])
    if (storageError) {
      throw new Error(formatDeleteError(storageError))
    }
  }
}

export async function regenerateShareId(editToken: string): Promise<string> {
  if (isDemoMode()) return demoRegenerateShareId(editToken)

  const supabase = getSupabase()!
  const { data, error } = await supabase.rpc('regenerate_share_id', {
    p_edit_token: editToken,
  })
  if (error) throw error
  return (data as Record<string, unknown>).share_id as string
}

export async function deleteCallTarget(
  editToken: string,
  targetId: string,
): Promise<void> {
  if (isDemoMode()) {
    demoDeleteTarget(editToken, targetId)
    return
  }

  const supabase = getSupabase()!
  const { error } = await supabase.rpc('delete_call_target', {
    p_edit_token: editToken,
    p_target_id: targetId,
  })
  if (error) throw error
}

export async function listMyMemorials(): Promise<MemorialSummary[]> {
  if (isDemoMode()) return []

  const supabase = getSupabase()!
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession()
  if (sessionError) {
    throw new Error(formatRpcError(sessionError, 'Could not read sign-in session'))
  }
  if (!session) {
    throw new Error('Not signed in')
  }

  const { data, error } = await supabase.rpc('list_my_memorials')
  if (error) {
    throw new Error(formatRpcError(error, 'Failed to load memorials'))
  }

  return parseRpcJsonArray(data).map(mapRpcMemorialSummary)
}

export async function claimMemorial(editToken: string): Promise<MemorialSummary> {
  if (isDemoMode()) throw new Error('Sign-in requires Supabase')

  const supabase = getSupabase()!
  const { data, error } = await supabase.rpc('claim_memorial', {
    p_edit_token: editToken,
  })
  if (error) throw error
  return mapRpcMemorialSummary(data as Record<string, unknown>)
}

export async function claimPendingMemorials(): Promise<number> {
  const pending = getPendingClaims()
  if (pending.length === 0 || isDemoMode()) return 0

  let claimed = 0
  for (const item of pending) {
    try {
      await claimMemorial(item.editToken)
      removePendingClaim(item.editToken)
      claimed++
    } catch {
      /* skip invalid or already-claimed */
    }
  }
  return claimed
}

export function memorialToCallProfile(
  memorial: Memorial,
  target: CallTarget,
  ownerName = 'Family',
): import('../types/memorial').CallSessionProfile {
  const sortedMedia = [...target.media].sort((a, b) => a.sortOrder - b.sortOrder)
  const photoUrls = sortedMedia.map((m) => m.publicUrl)
  const photoFocalPoints = sortedMedia.map((m) => ({
    focalX: m.focalX,
    focalY: m.focalY,
    focalZoom: m.focalZoom,
    cropWidth: m.cropWidth,
    cropHeight: m.cropHeight,
    focalRotationDeg: m.focalRotationDeg,
    landscapeFocalX: m.landscapeFocalX,
    landscapeFocalY: m.landscapeFocalY,
    landscapeFocalZoom: m.landscapeFocalZoom,
    landscapeCropWidth: m.landscapeCropWidth,
    landscapeCropHeight: m.landscapeCropHeight,
    landscapeFocalRotationDeg: m.landscapeFocalRotationDeg,
  }))

  return {
    dogName: target.displayName,
    ownerName,
    memorialNote: memorial.note,
    memorialTitle: memorial.title,
    targetKind: target.kind,
    photoUrls,
    photoFocalPoints,
    avatarUrl: photoUrls[0],
  }
}
