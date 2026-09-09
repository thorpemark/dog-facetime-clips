-- Clip Studio library sync (dog-facetime-clips)
-- Reuses the Dog_memorial_facetime project so Google auth is shared with the stills app.
-- Run in Supabase SQL Editor after the memorial migrations, or apply via CLI.
-- Signed-in users store one library JSON row plus private photo/video blobs.
-- Anon / GitHub Pages without secrets stays on localStorage + IndexedDB.

-- ─── Table ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.studio_libraries (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  library jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.studio_libraries IS
  'Per-user Clip Studio library JSON (dogs, intents, idle pick, blob keys). Media lives in storage bucket studio-media.';

ALTER TABLE public.studio_libraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_libraries FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.studio_libraries FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.studio_libraries TO authenticated;

DROP POLICY IF EXISTS studio_libraries_select_own ON public.studio_libraries;
CREATE POLICY studio_libraries_select_own
  ON public.studio_libraries
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS studio_libraries_insert_own ON public.studio_libraries;
CREATE POLICY studio_libraries_insert_own
  ON public.studio_libraries
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS studio_libraries_update_own ON public.studio_libraries;
CREATE POLICY studio_libraries_update_own
  ON public.studio_libraries
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS studio_libraries_delete_own ON public.studio_libraries;
CREATE POLICY studio_libraries_delete_own
  ON public.studio_libraries
  FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

ALTER TABLE public.studio_libraries REPLICA IDENTITY FULL;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.studio_libraries;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- ─── Private media bucket ─────────────────────────────────────────────────
-- Path: {auth.uid()}/{blobKey with ':' → '__'}  e.g. <uid>/video__<slotId>
-- Upsert needs INSERT + SELECT + UPDATE. Users may only touch their folder.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'studio-media',
  'studio-media',
  false,
  52428800,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif',
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'application/octet-stream'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS studio_media_select_own ON storage.objects;
CREATE POLICY studio_media_select_own
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'studio-media'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );

DROP POLICY IF EXISTS studio_media_insert_own ON storage.objects;
CREATE POLICY studio_media_insert_own
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'studio-media'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );

DROP POLICY IF EXISTS studio_media_update_own ON storage.objects;
CREATE POLICY studio_media_update_own
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'studio-media'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  )
  WITH CHECK (
    bucket_id = 'studio-media'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );

DROP POLICY IF EXISTS studio_media_delete_own ON storage.objects;
CREATE POLICY studio_media_delete_own
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'studio-media'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );
