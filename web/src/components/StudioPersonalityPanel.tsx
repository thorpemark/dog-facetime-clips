import type {
  DogPersonality,
  EnergyLevel,
  EyeStyle,
  MouthStyle,
  TouchStyle,
  VocalStyle,
  VoiceSize,
} from '../types/clipStudio'
import {
  ENERGY_LEVELS,
  EYE_STYLES,
  MOUTH_STYLES,
  TOUCH_STYLES,
  VOCAL_STYLES,
  VOICE_SIZES,
} from '../types/clipStudio'
import {
  ENERGY_LABELS,
  EYE_LABELS,
  MOUTH_LABELS,
  TOUCH_LABELS,
  VOCAL_STYLE_LABELS,
  VOICE_SIZE_LABELS,
} from '../utils/dogPersonality'

interface StudioPersonalityPanelProps {
  dogId: string
  dogName: string
  personality: DogPersonality
  notesDraft: string
  onNotesDraftChange: (value: string) => void
  onNotesCommit: (breed: string, notes: string[]) => void
  onTraitsChange: (patch: Partial<DogPersonality>) => void
}

function RadioGroup<T extends string>({
  legend,
  name,
  value,
  options,
  labels,
  disabled,
  onChange,
}: {
  legend: string
  name: string
  value: T
  options: readonly T[]
  labels: Record<T, string>
  disabled?: boolean
  onChange: (value: T) => void
}) {
  return (
    <fieldset className={`studio-trait-group${disabled ? ' is-muted' : ''}`} disabled={disabled}>
      <legend>{legend}</legend>
      <div className="studio-trait-options" role="radiogroup" aria-label={legend}>
        {options.map((option) => {
          const id = `${name}-${option}`
          return (
            <label key={option} className="studio-trait-option" htmlFor={id}>
              <input
                id={id}
                type="radio"
                name={name}
                value={option}
                checked={value === option}
                disabled={disabled}
                onChange={() => onChange(option)}
              />
              <span>{labels[option]}</span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

export function StudioPersonalityPanel({
  dogId,
  dogName,
  personality,
  notesDraft,
  onNotesDraftChange,
  onNotesCommit,
  onTraitsChange,
}: StudioPersonalityPanelProps) {
  const voiceDisabled = personality.vocalStyle === 'silent'

  return (
    <section className="studio-personality">
      <h2>{dogName}</h2>
      <p className="studio-personality-lead">
        Radios drive Suggest SOUND / motion / personality. In Slot Notes, type “side eye” or a growl — Suggest expands them. Don’t paste the GAZE MECHANICS paragraph.
      </p>

      <div className="studio-trait-grid">
        <RadioGroup
          legend="Vocal style"
          name={`${dogId}-vocalStyle`}
          value={personality.vocalStyle}
          options={VOCAL_STYLES}
          labels={VOCAL_STYLE_LABELS}
          onChange={(vocalStyle: VocalStyle) => onTraitsChange({ vocalStyle })}
        />
        <RadioGroup
          legend="Voice size"
          name={`${dogId}-voiceSize`}
          value={personality.voiceSize}
          options={VOICE_SIZES}
          labels={VOICE_SIZE_LABELS}
          disabled={voiceDisabled}
          onChange={(voiceSize: VoiceSize) => onTraitsChange({ voiceSize })}
        />
        <RadioGroup
          legend="Energy"
          name={`${dogId}-energy`}
          value={personality.energy}
          options={ENERGY_LEVELS}
          labels={ENERGY_LABELS}
          onChange={(energy: EnergyLevel) => onTraitsChange({ energy })}
        />
        <RadioGroup
          legend="Eyes"
          name={`${dogId}-eyes`}
          value={personality.eyes}
          options={EYE_STYLES}
          labels={EYE_LABELS}
          onChange={(eyes: EyeStyle) => onTraitsChange({ eyes })}
        />
        <RadioGroup
          legend="Mouth"
          name={`${dogId}-mouth`}
          value={personality.mouth}
          options={MOUTH_STYLES}
          labels={MOUTH_LABELS}
          onChange={(mouth: MouthStyle) => onTraitsChange({ mouth })}
        />
        <RadioGroup
          legend="Touch"
          name={`${dogId}-touch`}
          value={personality.touch}
          options={TOUCH_STYLES}
          labels={TOUCH_LABELS}
          onChange={(touch: TouchStyle) => onTraitsChange({ touch })}
        />
      </div>

      <label className="studio-field">
        Breed + notes (first line = breed)
        <textarea
          rows={4}
          value={notesDraft}
          onChange={(event) => onNotesDraftChange(event.target.value)}
          onBlur={() => {
            const lines = notesDraft
              .split('\n')
              .map((line) => line.trim())
              .filter(Boolean)
            const breed = lines[0] ?? personality.breed
            const notes = lines.slice(1)
            onNotesCommit(breed, notes)
          }}
        />
      </label>
    </section>
  )
}
