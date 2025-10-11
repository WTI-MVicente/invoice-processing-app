-- Add batch_id column to invoices table for easier querying
-- This migration adds batch tracking directly to invoices table

-- Add batch_id column
ALTER TABLE invoices 
ADD COLUMN batch_id UUID REFERENCES processing_batches(id);

-- Add index for performance
CREATE INDEX idx_invoices_batch ON invoices(batch_id);

-- Add comment for documentation
COMMENT ON COLUMN invoices.batch_id IS 'References the batch this invoice was processed in (optional for single uploads)';