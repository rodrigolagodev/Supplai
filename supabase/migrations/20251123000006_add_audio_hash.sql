-- Add audio_hash column for idempotency
-- Allows deduplication of identical audio uploads

ALTER TABLE order_audio_files
ADD COLUMN audio_hash TEXT CHECK (char_length(audio_hash) = 64);

-- Create unique index to enforce one hash per order
CREATE UNIQUE INDEX idx_order_audio_files_hash_unique
ON order_audio_files(order_id, audio_hash)
WHERE audio_hash IS NOT NULL;

-- Create index for hash lookups
CREATE INDEX idx_order_audio_files_hash
ON order_audio_files(audio_hash)
WHERE audio_hash IS NOT NULL;

COMMENT ON COLUMN order_audio_files.audio_hash IS 'SHA-256 hash of audio blob for deduplication';
