const DB_NAME = 'dog-facetime-clip-studio'
const DB_VERSION = 1
const STORE = 'media'

function canUseIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined'
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('indexedDB open failed'))
  })
}

export async function putStudioBlob(key: string, blob: Blob): Promise<void> {
  if (!canUseIndexedDb()) return
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('indexedDB write failed'))
    tx.objectStore(STORE).put(blob, key)
  })
  db.close()
}

export async function getStudioBlob(key: string): Promise<Blob | null> {
  if (!canUseIndexedDb()) return null
  const db = await openDb()
  const blob = await new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(key)
    req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null)
    req.onerror = () => reject(req.error ?? new Error('indexedDB read failed'))
  })
  db.close()
  return blob
}

export async function deleteStudioBlob(key: string): Promise<void> {
  if (!canUseIndexedDb()) return
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('indexedDB delete failed'))
    tx.objectStore(STORE).delete(key)
  })
  db.close()
}

export function compressImageFile(
  file: File,
  maxEdge = 1280,
  quality = 0.78,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxEdge / Math.max(image.width, image.height))
      const width = Math.max(1, Math.round(image.width * scale))
      const height = Math.max(1, Math.round(image.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(file)
        return
      }
      ctx.drawImage(image, 0, 0, width, height)
      canvas.toBlob(
        (blob) => resolve(blob ?? file),
        'image/jpeg',
        quality,
      )
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read image'))
    }
    image.src = url
  })
}

export function slugifyIntent(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'intent'
}
