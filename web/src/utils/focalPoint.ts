import type { CSSProperties } from 'react'

export const DEFAULT_FOCAL_X = 0.5
export const DEFAULT_FOCAL_Y = 0.5
export const DEFAULT_FOCAL_ZOOM = 1
export const DEFAULT_FOCAL_ROTATION_DEG = 0

/** Fine rotation range for straightening photos in the crop editor. */
export const MIN_FOCAL_ROTATION_DEG = -15
export const MAX_FOCAL_ROTATION_DEG = 15
export const FOCAL_ROTATION_STEP = 0.5

/** Portrait phone call viewport aspect (width / height). */
export const PORTRAIT_CALL_ASPECT = 9 / 16

/** Landscape phone / desktop call viewport aspect (width / height). */
export const LANDSCAPE_CALL_ASPECT = 16 / 9

export const MIN_FOCAL_ZOOM = 1
export const MAX_FOCAL_ZOOM = 4

/** Minimum normalized crop dimension (fraction of image width/height). */
export const MIN_CROP_DIMENSION = 0.08

/** Normalized step for arrow nudge controls in the focal editor. */
export const FOCAL_NUDGE_STEP = 0.025

export type DisplayOrientation = 'portrait' | 'landscape'

export interface FocalPoint {
  focalX: number
  focalY: number
}

export interface FocalFrame extends FocalPoint {
  /** 1 = default cover; >1 zooms out toward full image (legacy / derived). */
  focalZoom: number
  /** Normalized crop width as a fraction of image width (optional; overrides zoom-derived size). */
  cropWidth?: number
  /** Normalized crop height as a fraction of image height (optional; overrides zoom-derived size). */
  cropHeight?: number
  /** Fine rotation in degrees for straightening (default 0). */
  focalRotationDeg?: number
}

export interface DualFraming {
  portrait: FocalFrame
  landscape: FocalFrame
}

export interface PhotoSource {
  url: string
  portraitFraming: FocalFrame
  landscapeFraming: FocalFrame
  /** True when landscape framing was explicitly saved (not a runtime default). */
  landscapeStored?: boolean
}

export interface ImageBounds {
  left: number
  top: number
  width: number
  height: number
}

export interface FrameRect {
  left: number
  top: number
  width: number
  height: number
}

export type CropResizeHandle =
  | 'nw'
  | 'n'
  | 'ne'
  | 'e'
  | 'se'
  | 's'
  | 'sw'
  | 'w'

export function viewportAspectForOrientation(
  orientation: DisplayOrientation,
): number {
  return orientation === 'landscape'
    ? LANDSCAPE_CALL_ASPECT
    : PORTRAIT_CALL_ASPECT
}

export function orientationFromViewport(
  width: number,
  height: number,
): DisplayOrientation {
  return height >= width ? 'portrait' : 'landscape'
}

export function getDisplayOrientation(): DisplayOrientation {
  if (typeof window === 'undefined') return 'portrait'
  return orientationFromViewport(window.innerWidth, window.innerHeight)
}

export function normalizeFocal(value: unknown, fallback = 0.5): number {
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num)) return fallback
  return Math.min(1, Math.max(0, num))
}

export function normalizeFocalZoom(value: unknown, fallback = DEFAULT_FOCAL_ZOOM): number {
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num)) return fallback
  return Math.min(MAX_FOCAL_ZOOM, Math.max(MIN_FOCAL_ZOOM, num))
}

export function normalizeCropDimension(value: unknown, fallback = MIN_CROP_DIMENSION): number {
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num)) return fallback
  return Math.min(1, Math.max(MIN_CROP_DIMENSION, num))
}

export function normalizeFocalRotationDeg(
  value: unknown,
  fallback = DEFAULT_FOCAL_ROTATION_DEG,
): number {
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num)) return fallback
  return Math.min(
    MAX_FOCAL_ROTATION_DEG,
    Math.max(MIN_FOCAL_ROTATION_DEG, num),
  )
}

export function focalRotationCssValue(rotationDeg?: number): string {
  const deg = normalizeFocalRotationDeg(rotationDeg ?? DEFAULT_FOCAL_ROTATION_DEG)
  return `${deg}deg`
}

export function hasExplicitCropSize(focal: FocalFrame): boolean {
  return focal.cropWidth != null && focal.cropHeight != null
}

export function focalPointFromValues(
  focalX?: unknown,
  focalY?: unknown,
): FocalPoint {
  return {
    focalX: normalizeFocal(focalX, DEFAULT_FOCAL_X),
    focalY: normalizeFocal(focalY, DEFAULT_FOCAL_Y),
  }
}

export function focalFrameFromValues(
  focalX?: unknown,
  focalY?: unknown,
  focalZoom?: unknown,
  cropWidth?: unknown,
  cropHeight?: unknown,
  focalRotationDeg?: unknown,
): FocalFrame {
  const hasCrop =
    cropWidth != null &&
    cropHeight != null &&
    Number.isFinite(Number(cropWidth)) &&
    Number.isFinite(Number(cropHeight))
  const rotation = normalizeFocalRotationDeg(focalRotationDeg)

  return {
    ...focalPointFromValues(focalX, focalY),
    focalZoom: normalizeFocalZoom(focalZoom, DEFAULT_FOCAL_ZOOM),
    ...(hasCrop
      ? {
          cropWidth: normalizeCropDimension(cropWidth),
          cropHeight: normalizeCropDimension(cropHeight),
        }
      : {}),
    ...(rotation !== DEFAULT_FOCAL_ROTATION_DEG
      ? { focalRotationDeg: rotation }
      : {}),
  }
}

export function resolveFramingForOrientation(
  source: PhotoSource,
  orientation: DisplayOrientation,
  imageAspect: number,
  preferWideFrame = false,
): FocalFrame {
  if (orientation === 'portrait') {
    return source.portraitFraming
  }
  if (source.landscapeStored) {
    return source.landscapeFraming
  }
  return defaultDualFramingForImage(imageAspect, preferWideFrame).landscape
}

export function focalForOrientation(
  source: PhotoSource,
  orientation: DisplayOrientation,
  imageAspect = 1,
  preferWideFrame = false,
): FocalFrame {
  return resolveFramingForOrientation(
    source,
    orientation,
    imageAspect,
    preferWideFrame,
  )
}

export function photoSourceFromFraming(
  url: string,
  framing: DualFraming,
  landscapeStored = true,
): PhotoSource {
  return {
    url,
    portraitFraming: framing.portrait,
    landscapeFraming: framing.landscape,
    landscapeStored,
  }
}

export function photoSourceFromUrl(url: string): PhotoSource {
  const portrait = focalFrameFromValues()
  const landscape = focalFrameFromValues()
  return photoSourceFromFraming(url, { portrait, landscape }, false)
}

export function photoSourcesFromUrls(urls: string[]): PhotoSource[] {
  return urls.map((url) => photoSourceFromUrl(url))
}

export function defaultDualFramingForImage(
  imageAspect: number,
  preferWideFrame = false,
): DualFraming {
  return {
    portrait: defaultFocalFrameForImage(
      imageAspect,
      PORTRAIT_CALL_ASPECT,
      preferWideFrame,
    ),
    landscape: defaultFocalFrameForImage(
      imageAspect,
      LANDSCAPE_CALL_ASPECT,
      preferWideFrame,
    ),
  }
}

export function dualFramingFromPortraitLegacy(
  portrait: FocalFrame,
  imageAspect: number,
  preferWideFrame = false,
): DualFraming {
  return {
    portrait,
    landscape: defaultFocalFrameForImage(
      imageAspect,
      LANDSCAPE_CALL_ASPECT,
      preferWideFrame,
    ),
  }
}

/** Normalized width/height of the minimum cover crop for a viewport aspect at zoom = 1. */
export function coverCropSize(
  imageAspect: number,
  viewportAspect: number = PORTRAIT_CALL_ASPECT,
): { width: number; height: number } {
  const aspect = imageAspect > 0 ? imageAspect : 1
  if (aspect >= viewportAspect) {
    return { width: viewportAspect / aspect, height: 1 }
  }
  return { width: 1, height: aspect / viewportAspect }
}

export function maxFocalZoom(_imageAspect: number): number {
  return MAX_FOCAL_ZOOM
}

export function isLandscapeImage(imageAspect: number): boolean {
  return imageAspect > 1.05
}

export function focalZoomProgress(focalZoom: number, _imageAspect: number): number {
  const maxZoom = maxFocalZoom(_imageAspect)
  if (maxZoom <= MIN_FOCAL_ZOOM) return 0
  const zoom = normalizeFocalZoom(focalZoom)
  return Math.min(1, Math.max(0, (zoom - MIN_FOCAL_ZOOM) / (maxZoom - MIN_FOCAL_ZOOM)))
}

export function visibleAspectAtZoom(
  focalZoom: number,
  imageAspect: number,
  viewportAspect: number = PORTRAIT_CALL_ASPECT,
): number {
  const aspect = imageAspect > 0 ? imageAspect : 1
  const t = focalZoomProgress(focalZoom, aspect)
  const ratio = aspect / viewportAspect
  return viewportAspect * Math.pow(ratio, t)
}

export function maxFrameForVisibleAspect(
  visibleAspect: number,
  imageAspect: number,
): { width: number; height: number } {
  const aspect = imageAspect > 0 ? imageAspect : 1
  const frameAspect = visibleAspect / aspect
  if (frameAspect >= 1) {
    return { width: 1, height: 1 / frameAspect }
  }
  return { width: frameAspect, height: 1 }
}

export function frameSizeFromZoom(
  focalZoom: number,
  imageAspect: number,
  viewportAspect: number = PORTRAIT_CALL_ASPECT,
): { width: number; height: number } {
  const aspect = imageAspect > 0 ? imageAspect : 1
  const base = coverCropSize(aspect, viewportAspect)
  const t = focalZoomProgress(focalZoom, aspect)
  const target = maxFrameForVisibleAspect(
    visibleAspectAtZoom(focalZoom, aspect, viewportAspect),
    aspect,
  )
  return {
    width: Math.min(1, base.width + t * (target.width - base.width)),
    height: Math.min(1, base.height + t * (target.height - base.height)),
  }
}

export function frameSizeFromFocal(
  focal: FocalFrame,
  imageAspect: number,
  viewportAspect: number = PORTRAIT_CALL_ASPECT,
): { width: number; height: number } {
  if (hasExplicitCropSize(focal)) {
    return {
      width: normalizeCropDimension(focal.cropWidth),
      height: normalizeCropDimension(focal.cropHeight),
    }
  }
  return frameSizeFromZoom(focal.focalZoom, imageAspect, viewportAspect)
}

export function focalZoomFromCropSize(
  cropWidth: number,
  cropHeight: number,
  imageAspect: number,
  viewportAspect: number = PORTRAIT_CALL_ASPECT,
): number {
  const aspect = imageAspect > 0 ? imageAspect : 1
  const width = normalizeCropDimension(cropWidth)
  const height = normalizeCropDimension(cropHeight)
  const displayAspect =
    height > 0 ? (width / height) * aspect : viewportAspect
  const ratio = displayAspect / viewportAspect
  if (ratio <= 1) return MIN_FOCAL_ZOOM

  const maxRatio = aspect / viewportAspect
  if (maxRatio <= 1) return MIN_FOCAL_ZOOM

  const t = Math.log(ratio) / Math.log(maxRatio)
  return normalizeFocalZoom(
    MIN_FOCAL_ZOOM + t * (MAX_FOCAL_ZOOM - MIN_FOCAL_ZOOM),
  )
}

export function defaultFocalFrameForImage(
  imageAspect: number,
  viewportAspect: number = PORTRAIT_CALL_ASPECT,
  preferWideFrame = false,
): FocalFrame {
  if (!preferWideFrame || !isLandscapeImage(imageAspect)) {
    const cover = coverCropSize(imageAspect, viewportAspect)
    return focalFrameFromCenter(
      DEFAULT_FOCAL_X,
      DEFAULT_FOCAL_Y,
      cover.width,
      cover.height,
      imageAspect,
      viewportAspect,
    )
  }

  const maxZoom = maxFocalZoom(imageAspect)
  const suggestedZoom = Math.min(maxZoom, 1.5)
  const size = frameSizeFromZoom(
    Math.max(DEFAULT_FOCAL_ZOOM, suggestedZoom),
    imageAspect,
    viewportAspect,
  )
  return focalFrameFromCenter(
    DEFAULT_FOCAL_X,
    DEFAULT_FOCAL_Y,
    size.width,
    size.height,
    imageAspect,
    viewportAspect,
  )
}

export function displayAspectFromFocal(
  focal: FocalFrame,
  imageAspect: number,
  viewportAspect: number = PORTRAIT_CALL_ASPECT,
): number {
  const frame = frameSizeFromFocal(focal, imageAspect, viewportAspect)
  const aspect = imageAspect > 0 ? imageAspect : 1
  if (frame.height <= 0) return viewportAspect
  return (frame.width / frame.height) * aspect
}

export function clampFocalCenter(
  focalX: number,
  focalY: number,
  frameWidth: number,
  frameHeight: number,
): FocalPoint {
  const halfW = frameWidth / 2
  const halfH = frameHeight / 2
  return {
    focalX: normalizeFocal(Math.min(1 - halfW, Math.max(halfW, focalX))),
    focalY: normalizeFocal(Math.min(1 - halfH, Math.max(halfH, focalY))),
  }
}

export function clampCropRect(
  left: number,
  top: number,
  width: number,
  height: number,
): FrameRect {
  let w = normalizeCropDimension(width)
  let h = normalizeCropDimension(height)
  let l = left
  let t = top

  if (l < 0) l = 0
  if (t < 0) t = 0
  if (l + w > 1) l = Math.max(0, 1 - w)
  if (t + h > 1) t = Math.max(0, 1 - h)

  if (l + w > 1) w = Math.max(MIN_CROP_DIMENSION, 1 - l)
  if (t + h > 1) h = Math.max(MIN_CROP_DIMENSION, 1 - t)

  return { left: l, top: t, width: w, height: h }
}

export function focalFrameFromCenter(
  focalX: number,
  focalY: number,
  cropWidth: number,
  cropHeight: number,
  imageAspect: number,
  viewportAspect: number = PORTRAIT_CALL_ASPECT,
  focalRotationDeg: number = DEFAULT_FOCAL_ROTATION_DEG,
): FocalFrame {
  const width = normalizeCropDimension(cropWidth)
  const height = normalizeCropDimension(cropHeight)
  const center = clampFocalCenter(focalX, focalY, width, height)
  const rotation = normalizeFocalRotationDeg(focalRotationDeg)
  return {
    ...center,
    cropWidth: width,
    cropHeight: height,
    focalZoom: focalZoomFromCropSize(
      width,
      height,
      imageAspect,
      viewportAspect,
    ),
    ...(rotation !== DEFAULT_FOCAL_ROTATION_DEG
      ? { focalRotationDeg: rotation }
      : {}),
  }
}

export function nudgeFocalCenter(
  focal: FocalFrame,
  deltaX: number,
  deltaY: number,
  imageAspect: number,
  viewportAspect: number = PORTRAIT_CALL_ASPECT,
  step = FOCAL_NUDGE_STEP,
): FocalFrame {
  const size = frameSizeFromFocal(focal, imageAspect, viewportAspect)
  return focalFrameFromCenter(
    focal.focalX + deltaX * step,
    focal.focalY + deltaY * step,
    size.width,
    size.height,
    imageAspect,
    viewportAspect,
    focal.focalRotationDeg ?? DEFAULT_FOCAL_ROTATION_DEG,
  )
}

export function focalFrameFromCenterAndZoom(
  focalX: number,
  focalY: number,
  focalZoom: number,
  imageAspect: number,
  viewportAspect: number = PORTRAIT_CALL_ASPECT,
  focalRotationDeg: number = DEFAULT_FOCAL_ROTATION_DEG,
): FocalFrame {
  const zoom = normalizeFocalZoom(focalZoom)
  const maxZoom = maxFocalZoom(imageAspect)
  const clampedZoom = Math.min(maxZoom, zoom)
  const frame = frameSizeFromZoom(clampedZoom, imageAspect, viewportAspect)
  return focalFrameFromCenter(
    focalX,
    focalY,
    frame.width,
    frame.height,
    imageAspect,
    viewportAspect,
    focalRotationDeg,
  )
}

export function resizeCropRect(
  startRect: FrameRect,
  handle: CropResizeHandle,
  pointerX: number,
  pointerY: number,
): FrameRect {
  const min = MIN_CROP_DIMENSION
  let left = startRect.left
  let top = startRect.top
  let right = startRect.left + startRect.width
  let bottom = startRect.top + startRect.height

  switch (handle) {
    case 'nw':
      left = Math.min(pointerX, right - min)
      top = Math.min(pointerY, bottom - min)
      break
    case 'n':
      top = Math.min(pointerY, bottom - min)
      break
    case 'ne':
      right = Math.max(pointerX, left + min)
      top = Math.min(pointerY, bottom - min)
      break
    case 'e':
      right = Math.max(pointerX, left + min)
      break
    case 'se':
      right = Math.max(pointerX, left + min)
      bottom = Math.max(pointerY, top + min)
      break
    case 's':
      bottom = Math.max(pointerY, top + min)
      break
    case 'sw':
      left = Math.min(pointerX, right - min)
      bottom = Math.max(pointerY, top + min)
      break
    case 'w':
      left = Math.min(pointerX, right - min)
      break
  }

  return clampCropRect(left, top, right - left, bottom - top)
}

export function focalFrameFromNormalizedRect(
  rect: FrameRect,
  imageAspect: number,
  viewportAspect: number = PORTRAIT_CALL_ASPECT,
  focalRotationDeg: number = DEFAULT_FOCAL_ROTATION_DEG,
): FocalFrame {
  const clamped = clampCropRect(rect.left, rect.top, rect.width, rect.height)
  return focalFrameFromCenter(
    clamped.left + clamped.width / 2,
    clamped.top + clamped.height / 2,
    clamped.width,
    clamped.height,
    imageAspect,
    viewportAspect,
    focalRotationDeg,
  )
}

export function normalizedFrameRectFromFocal(
  focal: FocalFrame,
  imageAspect: number,
  viewportAspect: number = PORTRAIT_CALL_ASPECT,
): FrameRect {
  const frame = frameSizeFromFocal(focal, imageAspect, viewportAspect)
  return {
    left: focal.focalX - frame.width / 2,
    top: focal.focalY - frame.height / 2,
    width: frame.width,
    height: frame.height,
  }
}

export function frameRectFromFocal(
  focal: FocalFrame,
  bounds: ImageBounds,
  imageAspect: number,
  viewportAspect: number = PORTRAIT_CALL_ASPECT,
): FrameRect {
  const frame = normalizedFrameRectFromFocal(focal, imageAspect, viewportAspect)
  return {
    left: bounds.left + frame.left * bounds.width,
    top: bounds.top + frame.top * bounds.height,
    width: frame.width * bounds.width,
    height: frame.height * bounds.height,
  }
}

export function focalFrameFromFrameRect(
  rect: FrameRect,
  bounds: ImageBounds,
  imageAspect: number,
  viewportAspect: number = PORTRAIT_CALL_ASPECT,
): FocalFrame {
  const normalized = {
    left: (rect.left - bounds.left) / bounds.width,
    top: (rect.top - bounds.top) / bounds.height,
    width: rect.width / bounds.width,
    height: rect.height / bounds.height,
  }
  return focalFrameFromNormalizedRect(normalized, imageAspect, viewportAspect)
}

export function computeContainBounds(
  containerWidth: number,
  containerHeight: number,
  imageWidth: number,
  imageHeight: number,
): ImageBounds {
  const containerRatio = containerWidth / containerHeight
  const imageRatio = imageWidth / imageHeight

  if (imageRatio > containerRatio) {
    const width = containerWidth
    const height = containerWidth / imageRatio
    return {
      left: 0,
      top: (containerHeight - height) / 2,
      width,
      height,
    }
  }

  const height = containerHeight
  const width = containerHeight * imageRatio
  return {
    left: (containerWidth - width) / 2,
    top: 0,
    width,
    height,
  }
}

export function focalPositionStyle(focal: FocalPoint): string {
  return `${focal.focalX * 100}% ${focal.focalY * 100}%`
}

export function backgroundPositionStyle(focal: FocalPoint): string {
  return focalPositionStyle(focal)
}

export function objectPositionStyle(focal: FocalPoint): string {
  return focalPositionStyle(focal)
}

export function transformOriginStyle(focal: FocalPoint): string {
  return `${focal.focalX * 100}% ${focal.focalY * 100}%`
}

export function hasCustomFocalFrame(
  focal: FocalFrame,
  imageAspect: number,
  viewportAspect: number = PORTRAIT_CALL_ASPECT,
  preferWideFrame = false,
): boolean {
  const defaults = defaultFocalFrameForImage(
    imageAspect,
    viewportAspect,
    preferWideFrame,
  )
  return (
    focal.focalX !== defaults.focalX ||
    focal.focalY !== defaults.focalY ||
    focal.focalZoom !== defaults.focalZoom ||
    (focal.cropWidth != null && focal.cropWidth !== defaults.cropWidth) ||
    (focal.cropHeight != null && focal.cropHeight !== defaults.cropHeight) ||
    normalizeFocalRotationDeg(focal.focalRotationDeg) !== DEFAULT_FOCAL_ROTATION_DEG
  )
}

export function hasCustomDualFraming(
  framing: DualFraming,
  imageAspect: number,
  preferWideFrame = false,
): boolean {
  return (
    hasCustomFocalFrame(
      framing.portrait,
      imageAspect,
      PORTRAIT_CALL_ASPECT,
      preferWideFrame,
    ) ||
    hasCustomFocalFrame(
      framing.landscape,
      imageAspect,
      LANDSCAPE_CALL_ASPECT,
      preferWideFrame,
    )
  )
}

export function hasStoredLandscapeFraming(
  landscapeFocalX?: unknown,
  landscapeFocalY?: unknown,
  landscapeFocalZoom?: unknown,
  landscapeCropWidth?: unknown,
  landscapeCropHeight?: unknown,
  landscapeFocalRotationDeg?: unknown,
): boolean {
  return (
    (landscapeFocalX != null &&
      normalizeFocal(landscapeFocalX) !== DEFAULT_FOCAL_X) ||
    (landscapeFocalY != null &&
      normalizeFocal(landscapeFocalY) !== DEFAULT_FOCAL_Y) ||
    (landscapeFocalZoom != null &&
      normalizeFocalZoom(landscapeFocalZoom) !== DEFAULT_FOCAL_ZOOM) ||
    (landscapeCropWidth != null && Number.isFinite(Number(landscapeCropWidth))) ||
    (landscapeCropHeight != null && Number.isFinite(Number(landscapeCropHeight))) ||
    (landscapeFocalRotationDeg != null &&
      normalizeFocalRotationDeg(landscapeFocalRotationDeg) !==
        DEFAULT_FOCAL_ROTATION_DEG)
  )
}

/**
 * Viewport band on the call screen for a given viewport aspect.
 * Wider-than-viewport content gets vertical letterboxing; narrower content gets
 * horizontal pillarboxing so portrait photos can fit on landscape calls.
 */
export function photoViewportBandStyle(
  focal: FocalFrame,
  imageAspect: number,
  viewportAspect: number = PORTRAIT_CALL_ASPECT,
): CSSProperties {
  const displayAspect = displayAspectFromFocal(
    focal,
    imageAspect,
    viewportAspect,
  )

  if (displayAspect > viewportAspect) {
    const bandHeightPct = (viewportAspect / displayAspect) * 100
    const bandTopPct = (100 - bandHeightPct) / 2
    return {
      position: 'absolute',
      left: 0,
      width: '100%',
      top: `${bandTopPct}%`,
      height: `${bandHeightPct}%`,
      overflow: 'hidden',
    }
  }

  if (displayAspect < viewportAspect) {
    const bandWidthPct = (displayAspect / viewportAspect) * 100
    const bandLeftPct = (100 - bandWidthPct) / 2
    return {
      position: 'absolute',
      left: `${bandLeftPct}%`,
      width: `${bandWidthPct}%`,
      top: 0,
      height: '100%',
      overflow: 'hidden',
    }
  }

  return {
    position: 'absolute',
    left: 0,
    width: '100%',
    top: 0,
    height: '100%',
    overflow: 'hidden',
  }
}

/** Centered crop that includes the full source image (contain / pillarbox or letterbox). */
export function fitFullImageFraming(
  imageAspect: number,
  viewportAspect: number = PORTRAIT_CALL_ASPECT,
): FocalFrame {
  return focalFrameFromCenter(
    DEFAULT_FOCAL_X,
    DEFAULT_FOCAL_Y,
    1,
    1,
    imageAspect,
    viewportAspect,
  )
}

/** Whole photo in both FaceTime orientations — no inset crop, zoom, or pan. */
export function fullImageDualFraming(imageAspect = 1): DualFraming {
  const aspect = imageAspect > 0 ? imageAspect : 1
  return {
    portrait: fitFullImageFraming(aspect, PORTRAIT_CALL_ASPECT),
    landscape: fitFullImageFraming(aspect, LANDSCAPE_CALL_ASPECT),
  }
}

/** True when zooming out to the full image would change the visible framing. */
export function canFitFullImage(
  focal: FocalFrame,
  imageAspect: number,
  viewportAspect: number = PORTRAIT_CALL_ASPECT,
): boolean {
  const current = frameSizeFromFocal(focal, imageAspect, viewportAspect)
  return current.width < 0.999 || current.height < 0.999
}

export function photoLayerCoverStyle(
  focal: FocalFrame,
  imageAspect: number,
  viewportAspect: number = PORTRAIT_CALL_ASPECT,
): CSSProperties {
  return photoViewportBandStyle(focal, imageAspect, viewportAspect)
}

export function photoLayerMediaStyle(
  focal: FocalFrame,
  imageAspect: number,
): CSSProperties {
  const frame = frameSizeFromFocal(focal, imageAspect)
  const invW = 1 / frame.width
  const invH = 1 / frame.height
  const rotation = focalRotationCssValue(focal.focalRotationDeg)

  return {
    position: 'absolute',
    width: `${invW * 100}%`,
    height: `${invH * 100}%`,
    left: `${-(focal.focalX - frame.width / 2) * invW * 100}%`,
    top: `${-(focal.focalY - frame.height / 2) * invH * 100}%`,
    objectFit: 'cover',
    transformOrigin: transformOriginStyle(focal),
    '--focal-x': `${focal.focalX * 100}%`,
    '--focal-y': `${focal.focalY * 100}%`,
    '--focal-rotation': rotation,
  } as CSSProperties
}

export function editorImageRotationStyle(focal: FocalFrame): CSSProperties {
  const rotation = focalRotationCssValue(focal.focalRotationDeg)
  if (rotation === `${DEFAULT_FOCAL_ROTATION_DEG}deg`) {
    return {}
  }
  return {
    transform: `rotate(${rotation})`,
    transformOrigin: transformOriginStyle(focal),
  }
}
