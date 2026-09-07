/**
 * Load a video from a list of URLs; skip missing/broken files.
 * Returns a cancel function.
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

  const onCanPlay = () => {
    if (cancelled || !waiting) return
    waiting = false
    video.removeEventListener('canplay', onCanPlay)
    video.removeEventListener('error', onError)
    options.onReady()
  }

  const onError = () => {
    if (cancelled || !waiting) return
    waiting = false
    tryNext()
  }

  const tryNext = () => {
    if (cancelled) return
    if (index >= urls.length) {
      video.removeEventListener('canplay', onCanPlay)
      video.removeEventListener('error', onError)
      options.onFail()
      return
    }
    const url = urls[index]
    index += 1
    waiting = true
    video.loop = options.loop
    video.src = url
    video.load()
  }

  video.addEventListener('canplay', onCanPlay)
  video.addEventListener('error', onError)
  tryNext()

  return () => {
    cancelled = true
    waiting = false
    video.removeEventListener('canplay', onCanPlay)
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
