import { useRef, useState } from 'react'
import type { ClipSourcePhoto } from '../types/clipStudio'
import type { DualFraming } from '../utils/focalPoint'
import { sourcePhotoDisplayUrl } from '../utils/clipStudioStore'
import { PhotoFocalEditor } from './PhotoFocalEditor'

interface StudioGenerationStillPanelProps {
  dogId: string
  dogName: string
  photo: ClipSourcePhoto | null | undefined
  applyTargetCount?: number
  onAttach: (file: File) => Promise<void>
  onSaveFraming: (framing: DualFraming) => void
  onApplyToAllSlots?: () => number
}

export function StudioGenerationStillPanel({
  dogId,
  dogName,
  photo,
  applyTargetCount = 0,
  onAttach,
  onSaveFraming,
  onApplyToAllSlots,
}: StudioGenerationStillPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [framingOpen, setFramingOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [applyNote, setApplyNote] = useState<string | null>(null)
  const url = photo ? sourcePhotoDisplayUrl(photo) : ''

  return (
    <section className="studio-generation" aria-labelledby={`generation-still-${dogId}`}>
      <h2 id={`generation-still-${dogId}`}>Generation still</h2>
      <p className="studio-generation-lead">
        {dogName}’s <strong>clip source portrait</strong> — the same still you
        already used to generate videos you like. Set it once. New intents copy
        it at full frame (whole image, portrait and landscape). Setting it also
        fills empty slots and replaces seed/avatar photos. This is not the
        tab / demo picker avatar.
      </p>
      <div className="studio-generation-row">
        {url ? (
          <button
            type="button"
            className="studio-generation-thumb-btn"
            onClick={() => setFramingOpen(true)}
            aria-label={`Frame generation still for ${dogName}`}
          >
            <img src={url} alt="" />
            <span className="photo-focus-badge custom">⊕</span>
          </button>
        ) : (
          <button
            type="button"
            className="photo-add studio-generation-add"
            onClick={() => fileRef.current?.click()}
          >
            <span>+</span>
            <span className="photo-add-label">Add {dogName}’s portrait</span>
          </button>
        )}
        <div className="studio-generation-copy">
          <p>
            {url
              ? `New clip slots for ${dogName} inherit this portrait at full frame. Seed/default photos are replaced when you set it or tap Apply. Attached videos stay put. Custom unique slot photos are kept.`
              : `Upload the portrait you used for ${dogName}’s keepers, or tap “Use this photo as generation still” on a slot that already has it. Tab avatars stay on the mode cards.`}
          </p>
          <div className="studio-generation-actions">
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              {photo ? 'Replace generation still' : 'Choose portrait'}
            </button>
            {url && (
              <button type="button" className="btn-text" onClick={() => setFramingOpen(true)}>
                Frame
              </button>
            )}
            {url && onApplyToAllSlots && (
              <button
                type="button"
                className="btn-secondary"
                disabled={busy || applyTargetCount === 0}
                onClick={() => {
                  const ok = window.confirm(
                    `Apply ${dogName}’s generation still at full frame (portrait and landscape) to ${applyTargetCount} clip slot${applyTargetCount === 1 ? '' : 's'}? ` +
                      'Seed/default/missing photos are replaced. Attached videos stay. Custom unique slot photos are kept.',
                  )
                  if (!ok) return
                  const updated = onApplyToAllSlots()
                  setApplyNote(
                    updated > 0
                      ? `Applied full-frame generation still to ${updated} clip slot${updated === 1 ? '' : 's'}.`
                      : 'No seed/default slots left to update.',
                  )
                }}
              >
                Apply generation still to all clip slots (full frame)
              </button>
            )}
          </div>
          {applyNote && <p className="studio-generation-apply-note">{applyNote}</p>}
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (!file) return
          setBusy(true)
          void onAttach(file).finally(() => {
            setBusy(false)
          })
        }}
      />
      {framingOpen && url && (
        <PhotoFocalEditor
          imageUrl={url}
          initialFraming={photo?.framing}
          preferWideFrame={dogName.toLowerCase() === 'both'}
          onSave={(framing) => {
            onSaveFraming(framing)
            setFramingOpen(false)
          }}
          onClose={() => setFramingOpen(false)}
        />
      )}
    </section>
  )
}
