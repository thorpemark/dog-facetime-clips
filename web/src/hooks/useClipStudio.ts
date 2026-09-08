import { useCallback, useEffect, useState } from 'react'
import { fullImageDualFraming, type DualFraming } from '../utils/focalPoint'
import type { ClipSlot, ClipSourcePhoto, ClipStudioState } from '../types/clipStudio'
import { generateId } from '../lib/ids'
import {
  compressImageFile,
  deleteStudioBlob,
  getStudioBlob,
  putStudioBlob,
} from '../utils/clipStudioMedia'
import {
  countGenerationStillTargets,
  dispatchStudio,
  findDog,
  getStudioState,
  hydrateStudioMedia,
  isSlotOwnedPhotoBlobKey,
  subscribeStudio,
} from '../utils/clipStudioStore'

const DEFAULT_FRAMING: DualFraming = {
  portrait: { focalX: 0.5, focalY: 0.5, focalZoom: 1 },
  landscape: { focalX: 0.5, focalY: 0.5, focalZoom: 1 },
}

export function useClipStudio() {
  const [state, setState] = useState<ClipStudioState>(() => getStudioState())

  useEffect(() => {
    return subscribeStudio(() => setState(structuredClone(getStudioState())))
  }, [])

  useEffect(() => {
    let cancelled = false
    void hydrateStudioMedia(getStudioBlob).then(() => {
      if (cancelled) return
    })
    return () => {
      cancelled = true
    }
  }, [])

  const dispatch = useCallback((action: Parameters<typeof dispatchStudio>[0]) => {
    return dispatchStudio(action)
  }, [])

  const activeDog = findDog(state)

  const attachPhoto = useCallback(
    async (dogId: string, intentId: string, slot: ClipSlot, file: File) => {
      const blob = await compressImageFile(file)
      const blobKey = `photo:${slot.id}`
      await putStudioBlob(blobKey, blob)
      if (
        isSlotOwnedPhotoBlobKey(slot.id, slot.sourcePhoto?.blobKey) &&
        slot.sourcePhoto?.url?.startsWith('blob:')
      ) {
        URL.revokeObjectURL(slot.sourcePhoto.url)
      }
      const url = URL.createObjectURL(blob)
      dispatchStudio({
        type: 'updateSlot',
        dogId,
        intentId,
        slotId: slot.id,
        patch: {
          sourcePhoto: {
            id: slot.sourcePhoto?.id ?? generateId(),
            url,
            blobKey,
            framing: slot.sourcePhoto?.framing ?? DEFAULT_FRAMING,
          },
          status: slot.status === 'needs_redo' ? 'needs_redo' : 'photo_ready',
        },
      })
    },
    [],
  )

  const attachGenerationPhoto = useCallback(async (dogId: string, file: File) => {
    const blob = await compressImageFile(file)
    const id = generateId()
    const blobKey = `photo:generation:${dogId}:${id}`
    await putStudioBlob(blobKey, blob)
    const url = URL.createObjectURL(blob)
    dispatchStudio({
      type: 'setGenerationPhoto',
      dogId,
      photo: {
        id,
        url,
        blobKey,
        framing: fullImageDualFraming(),
      },
      fillEmptySlots: true,
    })
  }, [])

  const saveGenerationFraming = useCallback((dogId: string, framing: DualFraming) => {
    const dog = findDog(getStudioState(), dogId)
    if (!dog?.generationPhoto) return
    dispatchStudio({
      type: 'setGenerationPhoto',
      dogId,
      photo: { ...dog.generationPhoto, framing },
      fillEmptySlots: false,
    })
  }, [])

  const promoteSlotAsGeneration = useCallback(async (dogId: string, photo: ClipSourcePhoto) => {
    const id = generateId()
    let blobKey = photo.blobKey
    let url = photo.url
    if (photo.blobKey) {
      const blob = await getStudioBlob(photo.blobKey)
      if (blob) {
        blobKey = `photo:generation:${dogId}:${id}`
        await putStudioBlob(blobKey, blob)
        url = URL.createObjectURL(blob)
      }
    }
    dispatchStudio({
      type: 'setGenerationPhoto',
      dogId,
      photo: {
        id,
        url,
        blobKey,
        publicPath: photo.publicPath,
        framing: fullImageDualFraming(),
      },
      fillEmptySlots: true,
    })
  }, [])

  const saveFraming = useCallback(
    (
      dogId: string,
      intentId: string,
      slot: ClipSlot,
      framing: DualFraming,
      fallbackPhoto?: ClipSourcePhoto | null,
    ) => {
      const base = slot.sourcePhoto ?? fallbackPhoto
      if (!base) return
      dispatchStudio({
        type: 'updateSlot',
        dogId,
        intentId,
        slotId: slot.id,
        patch: {
          sourcePhoto: { ...base, framing },
          status: slot.status === 'needs_redo' ? 'needs_redo' : 'photo_ready',
        },
      })
    },
    [],
  )

  const attachVideo = useCallback(
    async (dogId: string, intentId: string, slot: ClipSlot, file: File) => {
      const blobKey = `video:${slot.id}`
      await putStudioBlob(blobKey, file)
      if (slot.resultVideo?.objectUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(slot.resultVideo.objectUrl)
      }
      const objectUrl = URL.createObjectURL(file)
      dispatchStudio({
        type: 'updateSlot',
        dogId,
        intentId,
        slotId: slot.id,
        patch: {
          resultVideo: {
            objectUrl,
            blobKey,
            fileName: file.name,
            origin: 'user',
          },
          status: 'video_attached',
        },
      })
      if (intentId === 'idle') {
        const dog = findDog(getStudioState(), dogId)
        if (dog && !dog.preferredIdleSlotId) {
          dispatchStudio({ type: 'setPreferredIdle', dogId, slotId: slot.id })
        }
      }
    },
    [],
  )

  const clearPhoto = useCallback(
    async (dogId: string, intentId: string, slot: ClipSlot) => {
      if (isSlotOwnedPhotoBlobKey(slot.id, slot.sourcePhoto?.blobKey) && slot.sourcePhoto?.blobKey) {
        await deleteStudioBlob(slot.sourcePhoto.blobKey)
      }
      if (
        isSlotOwnedPhotoBlobKey(slot.id, slot.sourcePhoto?.blobKey) &&
        slot.sourcePhoto?.url?.startsWith('blob:')
      ) {
        URL.revokeObjectURL(slot.sourcePhoto.url)
      }
      dispatchStudio({
        type: 'updateSlot',
        dogId,
        intentId,
        slotId: slot.id,
        patch: {
          sourcePhoto: null,
          status: slot.status === 'needs_redo' ? 'needs_redo' : 'empty',
        },
      })
    },
    [],
  )

  const applyGenerationStillToSlots = useCallback((dogId: string) => {
    const dog = findDog(getStudioState(), dogId)
    if (!dog?.generationPhoto) return 0
    const count = countGenerationStillTargets(dog)
    dispatchStudio({ type: 'applyGenerationStill', dogId })
    return count
  }, [])

  const markNeedsRedo = useCallback((dogId: string, intentId: string, slotId: string) => {
    dispatchStudio({
      type: 'updateSlot',
      dogId,
      intentId,
      slotId,
      patch: { status: 'needs_redo' },
    })
  }, [])

  return {
    state,
    dispatch,
    activeDog,
    attachPhoto,
    attachGenerationPhoto,
    saveGenerationFraming,
    promoteSlotAsGeneration,
    applyGenerationStillToSlots,
    saveFraming,
    attachVideo,
    clearPhoto,
    markNeedsRedo,
  }
}
