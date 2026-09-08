import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { StudioSlotEditor } from './StudioSlotEditor'
import { useClipStudio } from '../hooks/useClipStudio'
import {
  createDogLibrary,
  createEmptyClipSlot,
  createEmptyIntent,
} from '../data/clipStudioSeed'
import { slugifyIntent } from '../utils/clipStudioMedia'
import { attachedIdleSlots, chosenIdleSlot } from '../utils/callIdentity'
import { resetStudioToSeed, sourcePhotoDisplayUrl } from '../utils/clipStudioStore'
import { publicAssetUrl } from '../lib/urls'
import { defaultPersonality } from '../utils/dogPersonality'
import { StudioPersonalityPanel } from './StudioPersonalityPanel'
import { StudioGenerationStillPanel } from './StudioGenerationStillPanel'

export function StudioView() {
  const {
    state,
    dispatch,
    activeDog,
    attachPhoto,
    attachGenerationPhoto,
    saveGenerationFraming,
    promoteSlotAsGeneration,
    saveFraming,
    attachVideo,
    clearPhoto,
    markNeedsRedo,
  } = useClipStudio()

  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    idle: true,
    hug: true,
    howl: true,
  })
  const [newIntentName, setNewIntentName] = useState('')
  const [newDogName, setNewDogName] = useState('')
  const [phraseDrafts, setPhraseDrafts] = useState<Record<string, string>>({})
  const [personalityDraft, setPersonalityDraft] = useState<string | null>(null)

  const dog = activeDog
  const previewHref = dog ? `/demo?dog=${encodeURIComponent(dog.name)}` : '/demo'
  const callIdleSlotId = dog ? chosenIdleSlot(dog)?.id : undefined
  const idleChoices = dog ? attachedIdleSlots(dog) : []

  const intentSummary = useMemo(() => {
    if (!dog) return ''
    const slots = dog.intents.reduce((sum, intent) => sum + intent.clipSlots.length, 0)
    return `${dog.intents.length} intents · ${slots} clip slots`
  }, [dog])

  if (!dog) {
    return (
      <div className="screen catalog-screen">
        <div className="catalog-page">
          <p>No dogs in the studio yet.</p>
        </div>
      </div>
    )
  }

  const personalityText =
    personalityDraft ??
    `${dog.personality.breed}\n${dog.personality.notes.join('\n')}`

  return (
    <div className="screen catalog-screen studio-screen">
      <div className="catalog-page studio-page">
        <header className="catalog-hero">
          <div className="studio-nav">
            <Link to="/" className="btn-text catalog-back">
              ← Home
            </Link>
            <Link to="/catalog" className="btn-text">
              Catalog table
            </Link>
            <Link to={previewHref} className="btn-text">
              Preview call
            </Link>
          </div>
          <h1>Clip Studio</h1>
          <p>
            Manage reaction videos per dog. Add intents, phrases, and clip
            variants without changing code. Generation happens outside the app:
            frame a source photo, Suggest prompt, Copy, paste into Grok Imagine
            (6s · 9:16, or Pika), then attach the MP4.
          </p>
          <p className="catalog-note">
            Demo persistence is local to this browser (localStorage + IndexedDB).
            {intentSummary ? ` ${intentSummary}.` : ''}
          </p>
        </header>

        <div className="studio-dog-tabs" role="tablist" aria-label="Dogs">
          {state.dogs.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={item.id === dog.id}
              className={`studio-dog-tab ${item.id === dog.id ? 'active' : ''}`}
              onClick={() => {
                setPersonalityDraft(null)
                dispatch({ type: 'selectDog', dogId: item.id })
              }}
            >
              {(item.defaultPhoto || item.avatarPath) && (
                <img
                  className="studio-dog-avatar"
                  src={
                    item.defaultPhoto
                      ? sourcePhotoDisplayUrl(item.defaultPhoto)
                      : publicAssetUrl(item.avatarPath ?? '')
                  }
                  alt=""
                />
              )}
              {item.name}
            </button>
          ))}
          <form
            className="studio-add-dog"
            onSubmit={(event) => {
              event.preventDefault()
              const name = newDogName.trim()
              if (!name) return
              const created = createDogLibrary(name, defaultPersonality())
              dispatch({ type: 'addDog', dog: created })
              setNewDogName('')
              setPersonalityDraft(null)
            }}
          >
            <input
              value={newDogName}
              onChange={(event) => setNewDogName(event.target.value)}
              placeholder="New dog name"
              aria-label="New dog name"
            />
            <button type="submit" className="btn-secondary">
              Add dog
            </button>
          </form>
        </div>

        <StudioPersonalityPanel
          dogId={dog.id}
          dogName={dog.name}
          personality={dog.personality}
          notesDraft={personalityText}
          onNotesDraftChange={setPersonalityDraft}
          onNotesCommit={(breed, notes) => {
            dispatch({
              type: 'updateDog',
              dogId: dog.id,
              patch: { personality: { ...dog.personality, breed, notes } },
            })
            setPersonalityDraft(null)
          }}
          onTraitsChange={(patch) =>
            dispatch({
              type: 'updateDog',
              dogId: dog.id,
              patch: { personality: { ...dog.personality, ...patch } },
            })
          }
        />

        <StudioGenerationStillPanel
          dogId={dog.id}
          dogName={dog.name}
          photo={dog.generationPhoto}
          onAttach={(file) => attachGenerationPhoto(dog.id, file)}
          onSaveFraming={(framing) => saveGenerationFraming(dog.id, framing)}
        />

        <form
          className="studio-add-intent"
          onSubmit={(event) => {
            event.preventDefault()
            const description = newIntentName.trim()
            if (!description) return
            let id = slugifyIntent(description)
            const used = new Set(dog.intents.map((intent) => intent.id))
            if (used.has(id)) {
              let n = 2
              while (used.has(`${id}-${n}`)) n += 1
              id = `${id}-${n}`
            }
            dispatch({
              type: 'addIntent',
              dogId: dog.id,
              intent: createEmptyIntent(dog, description, id),
            })
            setNewIntentName('')
            setExpanded((current) => ({ ...current, [id]: true }))
          }}
        >
          <input
            value={newIntentName}
            onChange={(event) => setNewIntentName(event.target.value)}
            placeholder="New intent (e.g. belly rub)"
            aria-label="New intent name"
          />
          <button type="submit" className="btn-secondary">
            Add intent
          </button>
        </form>

        <div className="studio-intent-list">
          {dog.intents.map((intent) => {
            const open = Boolean(expanded[intent.id])
            const phraseDraft = phraseDrafts[intent.id] ?? ''
            return (
              <section key={intent.id} className="studio-intent">
                <button
                  type="button"
                  className="studio-intent-toggle"
                  aria-expanded={open}
                  onClick={() =>
                    setExpanded((current) => ({
                      ...current,
                      [intent.id]: !current[intent.id],
                    }))
                  }
                >
                  <span>
                    <strong>{intent.description}</strong>
                    <code>{intent.id}</code>
                  </span>
                  <span className="studio-intent-meta">
                    {intent.clipSlots.length} clips · pri {intent.priority}
                    <span className="studio-chevron">{open ? '▾' : '▸'}</span>
                  </span>
                </button>

                {open && (
                  <div className="studio-intent-body">
                    {intent.id === 'idle' && (
                      <div className="studio-idle-picker">
                        <p className="studio-idle-note">
                          Looping FaceTime hold — first frame after Accept and
                          the return after every reaction. Pick an attached
                          idle MP4 below, or tap <strong>Use as call idle</strong>{' '}
                          on a slot. Until one is attached, the call shows this
                          dog’s still (never the colored placeholder).
                        </p>
                        <label className="studio-field">
                          Call idle loop
                          <select
                            value={callIdleSlotId ?? ''}
                            disabled={idleChoices.length === 0}
                            onChange={(event) =>
                              dispatch({
                                type: 'setPreferredIdle',
                                dogId: dog.id,
                                slotId: event.target.value || null,
                              })
                            }
                          >
                            {idleChoices.length === 0 ? (
                              <option value="">
                                No attached idle yet — using still
                              </option>
                            ) : (
                              idleChoices.map((slot) => (
                                <option key={slot.id} value={slot.id}>
                                  {slot.label || slot.id}
                                  {slot.id === callIdleSlotId ? ' (current)' : ''}
                                </option>
                              ))
                            )}
                          </select>
                        </label>
                      </div>
                    )}
                    <div className="studio-intent-fields">
                      <label className="studio-field">
                        Description
                        <input
                          value={intent.description}
                          onChange={(event) =>
                            dispatch({
                              type: 'updateIntent',
                              dogId: dog.id,
                              intentId: intent.id,
                              patch: { description: event.target.value },
                            })
                          }
                        />
                      </label>
                      <label className="studio-field studio-priority">
                        Priority
                        <input
                          type="number"
                          min={0}
                          max={20}
                          value={intent.priority}
                          onChange={(event) => {
                            const next = Number(event.target.value)
                            if (Number.isNaN(next)) return
                            dispatch({
                              type: 'updateIntent',
                              dogId: dog.id,
                              intentId: intent.id,
                              patch: { priority: next },
                            })
                          }}
                        />
                      </label>
                    </div>

                    <label className="studio-field">
                      Semantic hints
                      <textarea
                        rows={3}
                        value={intent.semanticHints}
                        onChange={(event) =>
                          dispatch({
                            type: 'updateIntent',
                            dogId: dog.id,
                            intentId: intent.id,
                            patch: { semanticHints: event.target.value },
                          })
                        }
                      />
                    </label>

                    <div className="studio-phrases">
                      <h3>Phrases</h3>
                      <ul>
                        {intent.phrases.map((phrase) => (
                          <li key={phrase}>
                            <code>{phrase}</code>
                            <button
                              type="button"
                              className="btn-text"
                              aria-label={`Remove phrase ${phrase}`}
                              onClick={() =>
                                dispatch({
                                  type: 'removePhrase',
                                  dogId: dog.id,
                                  intentId: intent.id,
                                  phrase,
                                })
                              }
                            >
                              ✕
                            </button>
                          </li>
                        ))}
                      </ul>
                      <form
                        className="studio-add-phrase"
                        onSubmit={(event) => {
                          event.preventDefault()
                          const phrase = phraseDraft.trim()
                          if (!phrase) return
                          dispatch({
                            type: 'addPhrase',
                            dogId: dog.id,
                            intentId: intent.id,
                            phrase,
                          })
                          setPhraseDrafts((current) => ({
                            ...current,
                            [intent.id]: '',
                          }))
                        }}
                      >
                        <input
                          value={phraseDraft}
                          onChange={(event) =>
                            setPhraseDrafts((current) => ({
                              ...current,
                              [intent.id]: event.target.value,
                            }))
                          }
                          placeholder="Add phrase"
                          aria-label={`Add phrase to ${intent.id}`}
                        />
                        <button type="submit" className="btn-secondary">
                          Add phrase
                        </button>
                      </form>
                    </div>

                    <div className="studio-slots">
                      {intent.clipSlots.map((slot) => (
                        <StudioSlotEditor
                          key={slot.id}
                          dog={dog}
                          intent={intent}
                          slot={slot}
                          onPatch={(patch) =>
                            dispatch({
                              type: 'updateSlot',
                              dogId: dog.id,
                              intentId: intent.id,
                              slotId: slot.id,
                              patch,
                            })
                          }
                          onAttachPhoto={(file) =>
                            attachPhoto(dog.id, intent.id, slot, file)
                          }
                          onSaveFraming={(framing, fallbackPhoto) =>
                            saveFraming(dog.id, intent.id, slot, framing, fallbackPhoto)
                          }
                          onAttachVideo={(file) =>
                            attachVideo(dog.id, intent.id, slot, file)
                          }
                          onClearPhoto={() => clearPhoto(dog.id, intent.id, slot)}
                          onNeedsRedo={() =>
                            markNeedsRedo(dog.id, intent.id, slot.id)
                          }
                          onRemove={() =>
                            dispatch({
                              type: 'removeSlot',
                              dogId: dog.id,
                              intentId: intent.id,
                              slotId: slot.id,
                            })
                          }
                          isCallIdle={intent.id === 'idle' && slot.id === callIdleSlotId}
                          onUseAsCallIdle={
                            intent.id === 'idle'
                              ? () =>
                                  dispatch({
                                    type: 'setPreferredIdle',
                                    dogId: dog.id,
                                    slotId: slot.id,
                                  })
                              : undefined
                          }
                          onUseAsGenerationStill={
                            slot.sourcePhoto
                              ? () => void promoteSlotAsGeneration(dog.id, slot.sourcePhoto!)
                              : undefined
                          }
                        />
                      ))}
                    </div>

                    <div className="studio-intent-footer">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() =>
                          dispatch({
                            type: 'addSlot',
                            dogId: dog.id,
                            intentId: intent.id,
                            slot: createEmptyClipSlot(
                              dog,
                              intent,
                              intent.clipSlots.length + 1,
                            ),
                          })
                        }
                      >
                        Add clip variant
                      </button>
                      <button
                        type="button"
                        className="btn-text danger"
                        onClick={() =>
                          dispatch({
                            type: 'removeIntent',
                            dogId: dog.id,
                            intentId: intent.id,
                          })
                        }
                      >
                        Remove intent
                      </button>
                    </div>
                  </div>
                )}
              </section>
            )
          })}
        </div>

        <div className="studio-footer">
          <button
            type="button"
            className="btn-text danger"
            onClick={() => {
                if (
                window.confirm(
                  'Reset all studio dogs in this browser to the baked Murphy / Riley / Both seed?',
                )
              ) {
                resetStudioToSeed()
              }
            }}
          >
            Reset studio seed (this browser)
          </button>
        </div>
      </div>
    </div>
  )
}
