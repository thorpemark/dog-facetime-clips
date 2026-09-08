import { useRef, useState } from 'react'
import type { ClipSourcePhoto } from '../types/clipStudio'
import type { DualFraming } from '../utils/focalPoint'
import { sourcePhotoDisplayUrl } from '../utils/clipStudioStore'
import { PhotoFocalEditor } from './PhotoFocalEditor'

interface StudioGenerationStillPanelProps {
  dogId: string
  dogName: string
  photo: ClipSourcePhoto | null | undefined
  onAttach: (file: File) => Promise<void>
  onSaveFraming: (framing: DualFraming) => void
}

export function StudioGenerationStillPanel({
  dogId,
  dogName,
  photo,
  onAttach,
  onSaveFraming,
}: StudioGenerationStillPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [framingOpen, setFramingOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const url = photo ? sourcePhotoDisplayUrl(photo) : ''

  return (
    <section className="studio-generation" aria-labelledby={`generation-still-${dogId}`}>
      <h2 id={`generation-still-${dogId}`}>Generation still</h2>
      <p className="studio-generation-lead">
        The framed photo used as the <strong>video source</strong> for Grok Imagine
        (and new clip slots). New slots start at the whole image — no crop.
        Home / demo picker cards stay on the mode avatar — this does not change the
        tab face.
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
            <span className="photo-add-label">Add generation still</span>
          </button>
        )}
        <div className="studio-generation-copy">
          <p>
            New intents and empty clip variants copy this still at{' '}
            <strong>full frame</strong> (whole photo, portrait and landscape).
            Frame only if you want a tighter crop.
          </p>
          <div className="studio-generation-actions">
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              {photo ? 'Replace generation still' : 'Choose photo'}
            </button>
            {url && (
              <button type="button" className="btn-text" onClick={() => setFramingOpen(true)}>
                Frame
              </button>
            )}
          </div>
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
