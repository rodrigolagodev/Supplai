-- Add UPDATE and DELETE policies for storage.objects to support upsert operations
-- This fixes RLS violations when syncing audio files with upsert=true

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Authenticated users can update audio" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete audio" ON storage.objects;

-- Policy to allow authenticated users to update files in 'orders' bucket
CREATE POLICY "Authenticated users can update audio"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'orders' );

-- Policy to allow authenticated users to delete files in 'orders' bucket
CREATE POLICY "Authenticated users can delete audio"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'orders' );
