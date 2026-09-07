import { useRef, useState } from 'react'
import type { ClipSlot, DogLibrary, IntentBucket } from '../types/clipStudio'
import { GENERATOR_LABELS } from '../types/clipStudio'
import type { DualFraming } from '../utils/focalPoint'
import { playbackPathForSlot } from '../utils/clipStudioCatalog'
import { normalizeClipWeights } from '../data/reactionCatalog'
import { PhotoFocalEditor } from './PhotoFocalEditor'

const STATUS_LABEL: Record<ClipSlot['status'], string> = {
  empty: 'Needs photo',
  photo_ready: 'Photo ready',
  video_attached: 'Video attached',
  needs_redo: 'Needs redo',
}

interface StudioSlotEditorProps {
  dog: DogLibrary
  intent: IntentBucket
  slot: ClipSlot
  onPatch: (patch: Partial<ClipSlot>) => void
  onAttachPhoto: (file: File) => Promise<void>
  onSaveFraming: (framing: DualFraming) => void
  onAttachVideo: (file: File) => Promise<void>
  onClearPhoto: () => Promise<void>
  onNeedsRedo: () => void
  onRemove: () => void
}

export function StudioSlotEditor({
  dog,
  intent,
  slot,
  onPatch,
  onAttachPhoto,
  onSaveFraming,
  onAttachVideo,
  onClearPhoto,
  onNeedsRedo,
  onRemove,
}: StudioSlotEditorProps) {
  const photoRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLInputElement>(null)
  const [framingOpen, setFramingOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const previewVideo = playbackPathForSlot(slot)
  const chance = normalizeClipWeights(intent.clipSlots.map((item) => ({
    path: item.id,
    weight: item.weight,
  }))).find((item) => item.path === slot.id)?.percent ?? 0

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(slot.prompt)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  return (
    <article className={`studio-slot studio-slot--${slot.status}`}>
      <header className="studio-slot-header">
        <span className={`studio-status studio-status--${slot.status}`}>
          {STATUS_LABEL[slot.status]}
        </span>
        <input
          className="studio-slot-label"
          value={slot.label}
          aria-label="Clip variant label"
          onChange={(event) => onPatch({ label: event.target.value })}
        />
        <button type="button" className="btn-text studio-slot-remove" onClick={onRemove}>
          Remove
        </button>
      </header>

      <div className="studio-slot-media">
        <div className="studio-slot-photo">
          {slot.sourcePhoto?.url ? (
            <button
              type="button"
              className="studio-thumb-btn"
              onClick={() => setFramingOpen(true)}
              aria-label="Edit photo framing"
            >
              <img src={slot.sourcePhoto.url} alt="" />
              <span className="photo-focus-badge custom">⊕</span>
            </button>
          ) : (
            <button
              type="button"
              className="photo-add studio-photo-add"
              onClick={() => photoRef.current?.click()}
            >
              <span>+</span>
              <span className="photo-add-label">Add photo</span>
            </button>
          )}
          <input
            ref={photoRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (!file) return
              setBusy(true)
              void onAttachPhoto(file).finally(() => {
                setBusy(false)
                setFramingOpen(true)
              })
            }}
          />
          {slot.sourcePhoto && (
            <div className="studio-slot-photo-actions">
              <button type="button" className="btn-text" onClick={() => setFramingOpen(true)}>
                Frame
              </button>
              <button
                type="button"
                className="btn-text"
                onClick={() => photoRef.current?.click()}
              >
                Replace photo
              </button>
              <button type="button" className="btn-text danger" onClick={() => void onClearPhoto()}>
                Remove photo
              </button>
            </div>
          )}
        </div>

        <div className="studio-slot-video">
          {previewVideo ? (
            <video src={previewVideo} muted playsInline loop controls className="studio-video-preview" />
          ) : (
            <div className="studio-video-empty">No video yet — attach an MP4 after generating.</div>
          )}
          {slot.resultVideo?.origin === 'placeholder' && slot.status !== 'video_attached' && (
            <p className="studio-placeholder-note">Demo placeholder (colored clip)</p>
          )}
          <div className="studio-slot-video-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => videoRef.current?.click()}
              disabled={busy}
            >
              {slot.resultVideo?.origin === 'user' ? 'Replace video' : 'Attach MP4'}
            </button>
            {slot.resultVideo?.origin === 'user' && (
              <button type="button" className="btn-text" onClick={onNeedsRedo}>
                Mark needs redo
              </button>
            )}
          </div>
          <input
            ref={videoRef}
            type="file"
            accept="video/mp4,video/*"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (!file) return
              setBusy(true)
              void onAttachVideo(file).finally(() => setBusy(false))
            }}
          />
        </div>
      </div>

      <label className="studio-field">
        Prompt
        <textarea
          rows={5}
          value={slot.prompt}
          onChange={(event) => onPatch({ prompt: event.target.value })}
        />
      </label>
      <div className="studio-prompt-actions">
        <button type="button" className="btn-text" onClick={() => void copyPrompt()}>
          {copied ? 'Copied' : 'Copy prompt'}
        </button>
        <span className="studio-prompt-hint">
          Paste into Pika / Gemini / Grok, then attach the MP4 here.
        </span>
      </div>

      <div className="studio-slot-meta">
        <label className="studio-field">
          Weight
          <input
            type="number"
            min={0}
            step={5}
            value={slot.weight}
            onChange={(event) => {
              const next = Number(event.target.value)
              if (Number.isNaN(next)) return
              onPatch({ weight: Math.max(0, next) })
            }}
          />
          <span className="studio-chance">{chance.toFixed(0)}% chance in {intent.id}</span>
        </label>
        <label className="studio-field">
          Generator
          <select
            value={
              slot.generatorUsed &&
              (GENERATOR_LABELS as readonly string[]).includes(slot.generatorUsed)
                ? slot.generatorUsed
                : slot.generatorUsed
                  ? 'Other'
                  : ''
            }
            onChange={(event) => {
              const value = event.target.value
              if (value === 'Other') {
                onPatch({ generatorUsed: slot.generatorUsed && !(GENERATOR_LABELS as readonly string[]).includes(slot.generatorUsed) ? slot.generatorUsed : '' })
                return
              }
              onPatch({ generatorUsed: value || undefined })
            }}
          >
            <option value="">Not set</option>
            {GENERATOR_LABELS.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
            <option value="Other">Other</option>
          </select>
        </label>
        {slot.generatorUsed &&
          !(GENERATOR_LABELS as readonly string[]).includes(slot.generatorUsed) && (
            <label className="studio-field">
              Other generator
              <input
                value={slot.generatorUsed}
                onChange={(event) => onPatch({ generatorUsed: event.target.value || undefined })}
                placeholder="e.g. Runway"
              />
            </label>
          )}
      </div>

      <p className="studio-dog-hint">
        {dog.name} · {intent.description}
      </p>

      {framingOpen && slot.sourcePhoto?.url && (
        <PhotoFocalEditor
          imageUrl={slot.sourcePhoto.url}
          initialFraming={slot.sourcePhoto.framing}
          onSave={(framing) => {
            onSaveFraming(framing)
            setFramingOpen(false)
          }}
          onClose={() => setFramingOpen(false)}
        />
      )}
    </article>
  )
}
