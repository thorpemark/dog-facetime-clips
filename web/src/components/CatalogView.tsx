import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  normalizeClipWeights,
  type ReactionBucket,
} from '../data/reactionCatalog'
import { useClipStudio } from '../hooks/useClipStudio'
import { sourcePhotoDisplayUrl } from '../utils/clipStudioStore'
import { publicAssetUrl } from '../lib/urls'
import { dogLibraryToBuckets } from '../utils/clipStudioCatalog'
import {
  MATCH_CONFIDENCE_THRESHOLD,
  matchTranscript,
  rankTranscriptMatches,
} from '../utils/matchTranscript'

function percentLabel(percent: number): string {
  return `${percent.toFixed(0)}%`
}

function BucketRow({ bucket }: { bucket: ReactionBucket }) {
  const weighted = normalizeClipWeights(bucket.clips)

  return (
    <article className="catalog-card">
      <header className="catalog-card-header">
        <div>
          <h2>{bucket.description ?? bucket.id}</h2>
          <p className="catalog-id">
            <code>{bucket.id}</code>
            <span>priority {bucket.priority}</span>
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
                <td>{clip.weight}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  )
}

export function CatalogView() {
  const { state, dispatch, activeDog } = useClipStudio()
  const [ownerName, setOwnerName] = useState('Mark')
  const [phrase, setPhrase] = useState('come here Murph')

  const dogName = activeDog?.name ?? 'Murphy'
  const catalog = useMemo(
    () => (activeDog ? dogLibraryToBuckets(activeDog) : []),
    [activeDog],
  )

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

  return (
    <div className="screen catalog-screen">
      <div className="catalog-page">
        <header className="catalog-hero">
          <div className="studio-nav">
            <Link to="/" className="btn-text catalog-back">
              ← Home
            </Link>
            <Link to="/studio" className="btn-text">
              Clip Studio
            </Link>
            <Link
              to={`/demo?dog=${encodeURIComponent(dogName)}`}
              className="btn-text catalog-demo"
            >
              Try a sample call →
            </Link>
          </div>
          <h1>Reaction catalog</h1>
          <p>
            Read-only overview of the per-dog library. Edit intents, phrases,
            weights, photos, and videos in <strong>Clip Studio</strong>.
          </p>
        </header>

        <div className="studio-dog-tabs" role="tablist" aria-label="Dogs">
          {state.dogs.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={item.id === activeDog?.id}
              className={`studio-dog-tab ${item.id === activeDog?.id ? 'active' : ''}`}
              onClick={() => dispatch({ type: 'selectDog', dogId: item.id })}
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
        </div>

        <section className="catalog-tester" aria-label="Try a phrase">
          <h2>Try a phrase</h2>
          <div className="catalog-tester-grid">
            <label>
              Dog
              <input value={dogName} readOnly />
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
            <p
              className={
                match.method === 'fallback'
                  ? 'catalog-match-miss'
                  : 'catalog-match-hit'
              }
            >
              {match.method === 'fallback' ? (
                <>
                  No recognized phrase (threshold {MATCH_CONFIDENCE_THRESHOLD}) —
                  play <strong>{match.bucketId}</strong> head-tilt.
                </>
              ) : (
                <>
                  Match: <strong>{match.bucketId}</strong> · {match.method} · score{' '}
                  {match.score.toFixed(2)}
                  {match.matchedPhrase ? ` · “${match.matchedPhrase}”` : ''}
                </>
              )}
            </p>
          ) : (
            <p className="catalog-match-miss">
              Type a phrase to test matching.
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
            {catalog.length} intents for {dogName} · edit in Clip Studio
          </p>
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
            <BucketRow key={bucket.id} bucket={bucket} />
          ))}
        </div>
      </div>
    </div>
  )
}
