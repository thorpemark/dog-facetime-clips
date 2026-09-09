import { describe, expect, it } from 'vitest'
import type { ClipResultVideo } from '../types/clipStudio'
import {
  basenameFromPath,
  blobKeyTail,
  displayNameForClipVideo,
  originalUploadFileName,
} from './clipVideoName'

const user = (patch: Partial<ClipResultVideo> = {}): ClipResultVideo => ({
  origin: 'user',
  ...patch,
})

describe('originalUploadFileName', () => {
  it('captures File.name', () => {
    expect(originalUploadFileName({ name: 'murphy-howl-strong.mp4' })).toBe(
      'murphy-howl-strong.mp4',
    )
  })

  it('uses the basename when a path-like name is given', () => {
    expect(originalUploadFileName({ name: 'C:\\Downloads\\riley-hug.mp4' })).toBe(
      'riley-hug.mp4',
    )
  })

  it('returns undefined for a blank name', () => {
    expect(originalUploadFileName({ name: '  ' })).toBeUndefined()
  })
})

describe('basenameFromPath / blobKeyTail', () => {
  it('takes the last path segment', () => {
    expect(basenameFromPath('clips/reactions/howl/howl_01.mp4')).toBe('howl_01.mp4')
    expect(
      basenameFromPath('abc-user/video__murphy-idle-1'),
    ).toBe('video__murphy-idle-1')
  })

  it('takes the blob key tail', () => {
    expect(blobKeyTail('video:murphy-idle-1')).toBe('murphy-idle-1')
    expect(blobKeyTail('video:')).toBeUndefined()
  })
})

describe('displayNameForClipVideo', () => {
  it('prefers originalName over fileName', () => {
    expect(
      displayNameForClipVideo(
        user({ originalName: 'murphy-howl-strong.mp4', fileName: 'stale.mp4' }),
      ),
    ).toBe('murphy-howl-strong.mp4')
  })

  it('uses fileName when originalName is missing', () => {
    expect(displayNameForClipVideo(user({ fileName: 'riley-come.mp4' }))).toBe(
      'riley-come.mp4',
    )
  })

  it('falls back to public path basename', () => {
    expect(
      displayNameForClipVideo(user({ path: 'clips/reactions/hug/hug_02.mp4' })),
    ).toBe('hug_02.mp4')
  })

  it('falls back to blob key tail before storage path basename', () => {
    expect(
      displayNameForClipVideo(
        user({
          blobKey: 'video:murphy-idle-1',
          storagePath: 'user-id/video__murphy-idle-1',
        }),
      ),
    ).toBe('murphy-idle-1')
  })

  it('falls back to storage path basename when there is no blob key', () => {
    expect(
      displayNameForClipVideo(
        user({ storagePath: 'user-id/video__thanksgiving-1' }),
      ),
    ).toBe('video__thanksgiving-1')
  })

  it('uses Attached video when a user clip has no stored name', () => {
    expect(displayNameForClipVideo(user({ objectUrl: 'blob:video' }))).toBe(
      'Attached video',
    )
  })

  it('does not label demo placeholders', () => {
    expect(
      displayNameForClipVideo({
        origin: 'placeholder',
        path: 'clips/idle/idle_01.mp4',
        fileName: 'idle_01.mp4',
      }),
    ).toBeNull()
  })

  it('treats a blobKey as attached even if origin was never stamped user', () => {
    expect(
      displayNameForClipVideo({
        origin: 'placeholder',
        blobKey: 'video:unknown-slot',
      }),
    ).toBe('unknown-slot')
  })

  it('returns null when there is no video', () => {
    expect(displayNameForClipVideo(null)).toBeNull()
  })
})
