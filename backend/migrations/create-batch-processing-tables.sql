-- Create batch processing tables
-- This migration creates the core batch processing infrastructure

-- Processing Batches Table
CREATE TABLE processing_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id),
    folder_path VARCHAR(1024),
    total_files INTEGER DEFAULT 0,
    processed_files INTEGER DEFAULT 0,
    failed_files INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed, partial
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_batches_vendor ON processing_batches(vendor_id);
CREATE INDEX idx_batches_status ON processing_batches(status);

-- Batch Files Table
CREATE TABLE batch_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES processing_batches(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES invoices(id),
    filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(1024) NOT NULL,
    file_type VARCHAR(10) NOT NULL, -- 'PDF' or 'HTML'
    status VARCHAR(50) DEFAULT 'pending', -- pending, processing, processed, failed, skipped
    error_message TEXT,
    processing_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP
);

CREATE INDEX idx_batch_files_batch ON batch_files(batch_id);
CREATE INDEX idx_batch_files_status ON batch_files(status);

-- Add comments for documentation
COMMENT ON TABLE processing_batches IS 'Tracks batch processing operations for multiple invoice files';
COMMENT ON TABLE batch_files IS 'Individual files within a processing batch';
COMMENT ON COLUMN processing_batches.status IS 'pending, processing, completed, failed, partial';
COMMENT ON COLUMN batch_files.status IS 'pending, processing, processed, failed, skipped';