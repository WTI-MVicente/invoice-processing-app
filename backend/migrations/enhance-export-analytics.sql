-- Migration: Enhance Export Analytics
-- Description: Add additional fields to export tables for better analytics and template management
-- Date: 2024-10-13

-- Add analytics columns to export_logs table
ALTER TABLE export_logs 
ADD COLUMN success BOOLEAN DEFAULT true,
ADD COLUMN error_message TEXT,
ADD COLUMN user_agent TEXT,
ADD COLUMN ip_address INET;

-- Add analytics columns to export_templates table  
ALTER TABLE export_templates
ADD COLUMN usage_count INTEGER DEFAULT 0,
ADD COLUMN last_used_at TIMESTAMP;

-- Update existing export_logs to mark as successful (backward compatibility)
UPDATE export_logs SET success = true WHERE success IS NULL;

-- Create indexes for improved analytics performance
CREATE INDEX idx_export_logs_success ON export_logs(success);
CREATE INDEX idx_export_logs_template_success ON export_logs(template_id, success);
CREATE INDEX idx_export_templates_usage_count ON export_templates(usage_count DESC);
CREATE INDEX idx_export_templates_last_used ON export_templates(last_used_at DESC);

-- Update usage counts for existing templates based on export_logs
UPDATE export_templates 
SET usage_count = (
  SELECT COUNT(*) 
  FROM export_logs 
  WHERE template_id = export_templates.id AND success = true
),
last_used_at = (
  SELECT MAX(created_at) 
  FROM export_logs 
  WHERE template_id = export_templates.id AND success = true
);

-- Add comments for documentation
COMMENT ON COLUMN export_logs.success IS 'Whether the export completed successfully';
COMMENT ON COLUMN export_logs.error_message IS 'Error message if export failed';
COMMENT ON COLUMN export_logs.user_agent IS 'Browser/client user agent for analytics';
COMMENT ON COLUMN export_logs.ip_address IS 'Client IP address for security and analytics';

COMMENT ON COLUMN export_templates.usage_count IS 'Number of times this template has been successfully used';
COMMENT ON COLUMN export_templates.last_used_at IS 'Timestamp of most recent successful use';

-- Create view for export analytics dashboard
CREATE OR REPLACE VIEW export_analytics AS
SELECT 
  et.id as template_id,
  et.name as template_name,
  et.is_public,
  et.usage_count,
  et.last_used_at,
  COUNT(el.id) as total_exports,
  COUNT(CASE WHEN el.success = true THEN 1 END) as successful_exports,
  COUNT(CASE WHEN el.success = false THEN 1 END) as failed_exports,
  ROUND(
    COUNT(CASE WHEN el.success = true THEN 1 END)::numeric / 
    NULLIF(COUNT(el.id), 0) * 100, 2
  ) as success_rate,
  AVG(CASE WHEN el.success = true THEN el.processing_time_ms END) as avg_processing_time,
  SUM(CASE WHEN el.success = true THEN el.invoice_count ELSE 0 END) as total_invoices_exported,
  SUM(CASE WHEN el.success = true THEN el.line_item_count ELSE 0 END) as total_line_items_exported,
  SUM(CASE WHEN el.success = true THEN el.file_size ELSE 0 END) as total_file_size
FROM export_templates et
LEFT JOIN export_logs el ON et.id = el.template_id
WHERE el.created_at >= CURRENT_DATE - INTERVAL '30 days' OR el.id IS NULL
GROUP BY et.id, et.name, et.is_public, et.usage_count, et.last_used_at
ORDER BY et.usage_count DESC, et.name;

COMMENT ON VIEW export_analytics IS 'Export analytics for the last 30 days with template performance metrics';