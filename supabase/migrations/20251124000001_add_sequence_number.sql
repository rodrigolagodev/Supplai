-- Add sequence_number column to order_conversations
-- This ensures messages are ordered correctly and prevents race conditions

ALTER TABLE order_conversations 
ADD COLUMN sequence_number INTEGER NOT NULL DEFAULT 0;

-- Create index for efficient ordering queries
CREATE INDEX idx_order_conversations_sequence 
ON order_conversations(order_id, sequence_number);

-- Update existing records to have proper sequence numbers based on created_at
WITH numbered_messages AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY created_at) - 1 AS seq_num
  FROM order_conversations
)
UPDATE order_conversations oc
SET sequence_number = nm.seq_num
FROM numbered_messages nm
WHERE oc.id = nm.id;

COMMENT ON COLUMN order_conversations.sequence_number IS 'Sequential number for ordering messages within an order';
