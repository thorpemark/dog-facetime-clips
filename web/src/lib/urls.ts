/** Full URL path including Vite base — for share/edit links and `<a href>`, not React Router. */
export function appPath(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${base}${normalized}`
}

/** Public file under `web/public/` (honors GitHub Pages `/dog-facetime-clips/`). */
export function publicAssetUrl(relativePath: string): string {
  const prefix = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`
  return `${prefix}${relativePath.replace(/^\//, '')}`
}

export function shareUrl(shareId: string): string {
  const origin = window.location.origin
  return `${origin}${appPath(`/m/${shareId}`)}`
}

export function editUrl(editToken: string): string {
  const origin = window.location.origin
  return `${origin}${appPath(`/edit/${editToken}`)}`
}
