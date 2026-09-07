import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  normalizeClipWeights,
  type ReactionBucket,
} from '../data/reactionCatalog'
import {
  clearWeightOverrides,
  getEffectiveCatalog,
  readWeightOverrides,
  setClipWeightOverride,
  type WeightOverrides,
} from '../utils/catalogOverrides'
import {
  MATCH_CONFIDENCE_THRESHOLD,
  matchTranscript,
  rankTranscriptMatches,
} from '../utils/matchTranscript'

function percentLabel(percent: number): string {
  return `${percent.toFixed(0)}%`
}

function BucketRow({
  bucket,
  overrides,
  onWeightChange,
}: {
  bucket: ReactionBucket
  overrides: WeightOverrides
  onWeightChange: (bucketId: string, path: string, weight: number) => void
}) {
  const weighted = normalizeClipWeights(bucket.clips)
  const hasOverride = Boolean(overrides[bucket.id] && Object.keys(overrides[bucket.id]).length)

  return (
    <article className="catalog-card">
      <header className="catalog-card-header">
        <div>
          <h2>{bucket.description ?? bucket.id}</h2>
          <p className="catalog-id">
            <code>{bucket.id}</code>
            <span>priority {bucket.priority}</span>
            {hasOverride && <span className="catalog-override-tag">local weights</span>}
          </p>
        </div>
      </header>

      <p className="catalog-hints">{bucket.semanticHints}</p>

      <div className="catalog-section">
        <h3>Example phrases</h3>
        <ul className="catalog-phrases">
          {bucket.phrases.map((phrase) => (
            <li key={phrase}>
              <code>{phrase}</code>
            </li>
          ))}
        </ul>
      </div>

      <div className="catalog-section">
        <h3>Clips (weight %)</h3>
        <table className="catalog-clips">
          <thead>
            <tr>
              <th>Clip</th>
              <th>Chance</th>
              <th>Weight</th>
            </tr>
          </thead>
          <tbody>
            {weighted.map((clip) => (
              <tr key={clip.path}>
                <td>
                  <div className="catalog-clip-name">{clip.label ?? clip.path}</div>
                  <code className="catalog-path">{clip.path}</code>
                </td>
                <td>
                  <div
                    className="catalog-chance-bar"
                    title={percentLabel(clip.percent)}
                  >
                    <span style={{ width: `${Math.max(clip.percent, 2)}%` }} />
                    {percentLabel(clip.percent)}
                  </div>
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    step={5}
                    className="catalog-weight-input"
                    value={clip.weight}
                    aria-label={`Weight for ${clip.label ?? clip.path}`}
                    onChange={(event) => {
                      const next = Number(event.target.value)
                      if (Number.isNaN(next)) return
                      onWeightChange(bucket.id, clip.path, next)
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  )
}

export function CatalogView() {
  const [dogName, setDogName] = useState('Murphy')
  const [ownerName, setOwnerName] = useState('Mark')
  const [phrase, setPhrase] = useState('come here Murph')
  const [overrides, setOverrides] = useState<WeightOverrides>(() => readWeightOverrides())

  const catalog = useMemo(() => getEffectiveCatalog(overrides), [overrides])

  const match = useMemo(
    () =>
      matchTranscript(phrase, {
        dogName,
        ownerName,
        catalog,
      }),
    [catalog, dogName, ownerName, phrase],
  )

  const ranked = useMemo(
    () =>
      rankTranscriptMatches(phrase, {
        dogName,
        ownerName,
        catalog,
      }).slice(0, 4),
    [catalog, dogName, ownerName, phrase],
  )

  const onWeightChange = (bucketId: string, path: string, weight: number) => {
    setOverrides(setClipWeightOverride(bucketId, path, weight))
  }

  const resetWeights = () => {
    clearWeightOverrides()
    setOverrides({})
  }

  const hasAnyOverride = Object.keys(overrides).length > 0

  return (
    <div className="screen catalog-screen">
      <div className="catalog-page">
        <header className="catalog-hero">
          <Link to="/" className="btn-text catalog-back">
            ← Home
          </Link>
          <h1>Reaction catalog</h1>
          <p>
            Intent buckets map spoken meaning to weighted clip variants. Seed
            phrases are the keyword fallback; semantic hints power loose matching
            so “come here Murph” still fires <strong>come</strong>.
          </p>
          <p className="catalog-note">
            Source of truth is <code>web/src/data/reactionCatalog.ts</code>.
            Weight edits here stay in this browser only (localStorage) for demo
            tuning.
          </p>
        </header>

        <section className="catalog-tester" aria-label="Try a phrase">
          <h2>Try a phrase</h2>
          <div className="catalog-tester-grid">
            <label>
              Dog name
              <input
                value={dogName}
                onChange={(event) => setDogName(event.target.value)}
              />
            </label>
            <label>
              Owner name
              <input
                value={ownerName}
                onChange={(event) => setOwnerName(event.target.value)}
              />
            </label>
            <label className="catalog-tester-phrase">
              Transcript
              <input
                value={phrase}
                onChange={(event) => setPhrase(event.target.value)}
                placeholder='e.g. "want some chicken?"'
              />
            </label>
          </div>
          {match ? (
            <p className="catalog-match-hit">
              Match: <strong>{match.bucketId}</strong> · {match.method} · score{' '}
              {match.score.toFixed(2)}
              {match.matchedPhrase ? ` · “${match.matchedPhrase}”` : ''}
            </p>
          ) : (
            <p className="catalog-match-miss">
              No match (threshold {MATCH_CONFIDENCE_THRESHOLD}) — stay on idle.
            </p>
          )}
          <ul className="catalog-rank">
            {ranked.map((row) => (
              <li key={row.bucketId}>
                <code>{row.bucketId}</code>
                <span>{row.score.toFixed(2)}</span>
                <span className="catalog-rank-method">{row.method}</span>
              </li>
            ))}
          </ul>
        </section>

        <div className="catalog-toolbar">
          <p>
            {catalog.length} intents · weights normalize to probabilities
            {hasAnyOverride ? ' · local overrides on' : ''}
          </p>
          {hasAnyOverride && (
            <button type="button" className="btn-secondary" onClick={resetWeights}>
              Reset local weights
            </button>
          )}
        </div>

        <div className="catalog-table-wrap">
          <table className="catalog-overview">
            <thead>
              <tr>
                <th>Intent</th>
                <th>Example phrases</th>
                <th>Clips (weight %)</th>
                <th>Priority</th>
              </tr>
            </thead>
            <tbody>
              {catalog.map((bucket) => (
                <tr key={bucket.id}>
                  <td>
                    <strong>{bucket.description ?? bucket.id}</strong>
                    <div>
                      <code>{bucket.id}</code>
                    </div>
                  </td>
                  <td className="catalog-overview-phrases">
                    {bucket.phrases.join(', ')}
                  </td>
                  <td>
                    {normalizeClipWeights(bucket.clips).map((clip) => (
                      <div key={clip.path} className="catalog-overview-clip">
                        {clip.label ?? clip.path.split('/').pop()}{' '}
                        <span>{percentLabel(clip.percent)}</span>
                      </div>
                    ))}
                  </td>
                  <td>{bucket.priority}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="catalog-list">
          {catalog.map((bucket) => (
            <BucketRow
              key={bucket.id}
              bucket={bucket}
              overrides={overrides}
              onWeightChange={onWeightChange}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
