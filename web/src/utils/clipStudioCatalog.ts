import type { ClipSlot, DogLibrary } from '../types/clipStudio'
import {
  REACTION_CATALOG,
  type ReactionBucket,
  type WeightedClip,
} from '../data/reactionCatalog'
import { findDog, getStudioState } from './clipStudioStore'

export function playbackPathForSlot(slot: ClipSlot): string | undefined {
  if (slot.resultVideo?.objectUrl) return slot.resultVideo.objectUrl
  if (slot.resultVideo?.path) return slot.resultVideo.path
  return undefined
}

export function dogLibraryToBuckets(dog: DogLibrary): ReactionBucket[] {
  return dog.intents.map((intent) => {
    const clips: WeightedClip[] = []
    for (const slot of intent.clipSlots) {
      const path = playbackPathForSlot(slot)
      if (!path || slot.weight <= 0) continue
      clips.push({
        path,
        weight: slot.weight,
        label: slot.label,
      })
    }

    return {
      id: intent.id,
      phrases: intent.phrases,
      semanticHints: intent.semanticHints,
      priority: intent.priority,
      description: intent.description,
      clips,
    }
  })
}

/** Per-dog studio catalog, falling back to the shared seed catalog. */
export function catalogForDogName(dogName?: string): ReactionBucket[] {
  const state = getStudioState()
  const dog = findDog(state, dogName)
  if (dog) return dogLibraryToBuckets(dog)
  return REACTION_CATALOG
}
