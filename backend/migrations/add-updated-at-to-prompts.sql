-- Migration: Add updated_at column to extraction_prompts table
-- This column is referenced in the API but was missing from the original schema

ALTER TABLE extraction_prompts 
ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Create trigger to automatically update the updated_at column
CREATE TRIGGER update_extraction_prompts_updated_at 
    BEFORE UPDATE ON extraction_prompts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update any existing records to set initial updated_at value
UPDATE extraction_prompts 
SET updated_at = created_at 
WHERE updated_at IS NULL;

-- Verify the column was added
SELECT 'Migration completed successfully!' as message;
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'extraction_prompts' 
AND column_name = 'updated_at';