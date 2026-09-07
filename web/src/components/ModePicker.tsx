import { CALL_MODES, type CallMode } from '../data/callModes'
import { ModePhoto } from './ModePhoto'

export function ModePicker({
  title = 'Who would you like to call?',
  onSelect,
}: {
  title?: string
  onSelect: (mode: CallMode) => void
}) {
  return (
    <div className="mode-picker">
      <p className="picker-prompt">{title}</p>
      <div className="mode-picker-grid">
        {CALL_MODES.map((mode) => (
          <button
            key={mode.id}
            type="button"
            className="mode-picker-card"
            onClick={() => onSelect(mode)}
          >
            <span className="mode-picker-thumb">
              <ModePhoto mode={mode} />
            </span>
            <span className="mode-picker-copy">
              <span className="picker-name">{mode.name}</span>
              <span className="picker-meta">{mode.subtitle}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
