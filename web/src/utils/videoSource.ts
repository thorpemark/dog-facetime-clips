/**
 * Load a video from a list of URLs; skip missing/broken files.
 * Returns a cancel function.
 *
 * Reloading the same cached URL after a reaction may not fire `canplay`
 * again — listen for `loadeddata`, clear src before reassign, and finish
 * synchronously when readyState already has data.
 */
export function loadVideoWithFallback(
  video: HTMLVideoElement,
  urls: string[],
  options: {
    loop: boolean
    onReady: () => void
    onFail: () => void
  },
): () => void {
  let index = 0
  let cancelled = false
  let waiting = false
  let settled = false

  const finishReady = () => {
    if (cancelled || settled || !waiting) return
    waiting = false
    settled = true
    video.removeEventListener('canplay', onCanPlay)
    video.removeEventListener('loadeddata', onCanPlay)
    video.removeEventListener('error', onError)
    options.onReady()
  }

  const onCanPlay = () => finishReady()

  const onError = () => {
    if (cancelled || settled || !waiting) return
    waiting = false
    tryNext()
  }

  const tryNext = () => {
    if (cancelled || settled) return
    if (index >= urls.length) {
      video.removeEventListener('canplay', onCanPlay)
      video.removeEventListener('loadeddata', onCanPlay)
      video.removeEventListener('error', onError)
      options.onFail()
      return
    }
    const url = urls[index]
    index += 1
    waiting = true
    video.loop = options.loop
    video.pause()
    video.removeAttribute('src')
    video.src = url
    video.load()
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      finishReady()
    }
  }

  video.addEventListener('canplay', onCanPlay)
  video.addEventListener('loadeddata', onCanPlay)
  video.addEventListener('error', onError)
  tryNext()

  return () => {
    cancelled = true
    waiting = false
    video.removeEventListener('canplay', onCanPlay)
    video.removeEventListener('loadeddata', onCanPlay)
    video.removeEventListener('error', onError)
  }
}

export function uniqueUrls(paths: Array<string | undefined>): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const path of paths) {
    if (!path || seen.has(path)) continue
    seen.add(path)
    out.push(path)
  }
  return out
}
