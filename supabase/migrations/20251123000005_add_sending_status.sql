-- Synchronize database ENUMs with TypeScript types
-- This migration adds missing enum values to match the TypeScript definitions
-- Migration: 20251123000005

-- =============================================================================
-- 1. order_status - Add 'sending' and 'cancelled'
-- =============================================================================

-- Add 'sending' status (used during email dispatch)
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'sending' AFTER 'review';

-- Add 'cancelled' status (used when user cancels an order)
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'cancelled';

COMMENT ON TYPE order_status IS
'Order lifecycle: draft → review → sending → sent → archived. Can be cancelled at any stage.';

-- =============================================================================
-- 2. supplier_category - Add 'cleaning', 'packaging', 'other'
-- =============================================================================

-- Add cleaning supplies category
ALTER TYPE supplier_category ADD VALUE IF NOT EXISTS 'cleaning';

-- Add packaging materials category
ALTER TYPE supplier_category ADD VALUE IF NOT EXISTS 'packaging';

-- Add other/miscellaneous category
ALTER TYPE supplier_category ADD VALUE IF NOT EXISTS 'other';

COMMENT ON TYPE supplier_category IS
'Supplier categories for AI classification: produce, proteins, dairy, beverages, dry goods, cleaning, packaging, and other.';

-- =============================================================================
-- 3. contact_method - Add 'phone' and 'whatsapp'
-- =============================================================================

-- Add phone contact method
ALTER TYPE contact_method ADD VALUE IF NOT EXISTS 'phone';

-- Add WhatsApp contact method
ALTER TYPE contact_method ADD VALUE IF NOT EXISTS 'whatsapp';

COMMENT ON TYPE contact_method IS
'Preferred contact methods for sending orders: email (default), phone, or WhatsApp.';

-- =============================================================================
-- 4. Create supplier_order_status ENUM (currently just a CHECK constraint)
-- =============================================================================

-- Create a proper ENUM type for supplier order statuses
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'supplier_order_status') THEN
    CREATE TYPE supplier_order_status AS ENUM ('pending', 'sending', 'sent', 'failed', 'delivered');
  END IF;
END $$;

-- Migrate supplier_orders.status from text to enum
-- Need to drop trigger first to avoid operator errors
DROP TRIGGER IF EXISTS set_supplier_orders_updated_at ON supplier_orders;

-- Remove the old CHECK constraint (if it exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'supplier_orders_status_check'
    AND conrelid = 'supplier_orders'::regclass
  ) THEN
    ALTER TABLE supplier_orders DROP CONSTRAINT supplier_orders_status_check;
  END IF;
END $$;

-- Drop default, change type, then re-add default
ALTER TABLE supplier_orders ALTER COLUMN status DROP DEFAULT;

ALTER TABLE supplier_orders
  ALTER COLUMN status TYPE supplier_order_status
  USING status::supplier_order_status;

ALTER TABLE supplier_orders ALTER COLUMN status SET DEFAULT 'pending'::supplier_order_status;

-- Recreate the trigger
CREATE TRIGGER set_supplier_orders_updated_at
  BEFORE UPDATE ON supplier_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TYPE supplier_order_status IS
'Supplier order statuses: pending (not yet sent) → sending (dispatching email) → sent (delivered) or failed (error occurred). Can be marked as delivered later.';

-- =============================================================================
-- 5. Create processing_status ENUM (exists in TypeScript but not in DB)
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'processing_status') THEN
    CREATE TYPE processing_status AS ENUM ('pending', 'processing', 'completed', 'failed');
  END IF;
END $$;

COMMENT ON TYPE processing_status IS
'Generic processing status for async operations: pending → processing → completed or failed.';
