-- Clip Studio media upload limits (dog-facetime-clips)
-- Apply after migration_studio_library.sql. Safe to re-run.
-- Grok Imagine 10s/15s 9:16 MP4s can exceed 50 MB; IndexedDB blobs may
-- arrive with empty or codec-suffixed Content-Type.

UPDATE storage.buckets
SET
  file_size_limit = 104857600,
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif',
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'video/x-m4v',
    'video/mpeg',
    'video/3gpp',
    'application/mp4',
    'application/octet-stream'
  ]
WHERE id = 'studio-media';
