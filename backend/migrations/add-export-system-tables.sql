-- Migration: Add Export System Tables
-- Description: Create tables for export templates and export logging
-- Date: 2024-10-13

-- Export templates storage
CREATE TABLE export_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    user_id UUID, -- NULL for global templates
    is_public BOOLEAN DEFAULT false,
    invoice_fields JSONB NOT NULL, -- Invoice-level field configuration
    line_item_fields JSONB NOT NULL, -- Line item field configuration
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for performance
CREATE INDEX idx_export_templates_public ON export_templates(is_public);
CREATE INDEX idx_export_templates_user_id ON export_templates(user_id);

-- Template usage tracking and analytics
CREATE TABLE export_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES export_templates(id) ON DELETE SET NULL,
    user_id UUID,
    export_format VARCHAR(10) NOT NULL, -- 'csv', 'xlsx'
    invoice_count INTEGER NOT NULL DEFAULT 0,
    line_item_count INTEGER NOT NULL DEFAULT 0,
    file_size BIGINT,
    filters_applied JSONB,
    processing_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for analytics and performance
CREATE INDEX idx_export_logs_template_id ON export_logs(template_id);
CREATE INDEX idx_export_logs_user_id ON export_logs(user_id);
CREATE INDEX idx_export_logs_created_at ON export_logs(created_at);
CREATE INDEX idx_export_logs_format ON export_logs(export_format);

-- Insert default/built-in export templates
INSERT INTO export_templates (name, description, is_public, user_id, invoice_fields, line_item_fields) VALUES 
(
    'Complete Invoice Export',
    'Full invoice and line item details for comprehensive reporting',
    true,
    NULL,
    '[
        {"key": "invoice_number", "label": "Invoice #", "type": "string", "width": 15, "required": true},
        {"key": "vendor_name", "label": "Vendor Name", "type": "string", "width": 25},
        {"key": "customer_name", "label": "Customer Name", "type": "string", "width": 25},
        {"key": "invoice_date", "label": "Invoice Date", "type": "date", "width": 12},
        {"key": "due_date", "label": "Due Date", "type": "date", "width": 12},
        {"key": "total_amount", "label": "Total Amount", "type": "currency", "width": 12},
        {"key": "tax_amount", "label": "Tax Amount", "type": "currency", "width": 12},
        {"key": "processing_status", "label": "Status", "type": "string", "width": 12},
        {"key": "confidence_score", "label": "AI Confidence", "type": "percentage", "width": 12},
        {"key": "purchase_order_number", "label": "PO Number", "type": "string", "width": 20}
    ]',
    '[
        {"key": "invoice_number", "label": "Invoice #", "type": "string", "width": 15, "required": true},
        {"key": "line_number", "label": "Line #", "type": "number", "width": 8},
        {"key": "description", "label": "Description", "type": "string", "width": 40},
        {"key": "quantity", "label": "Quantity", "type": "number", "width": 10},
        {"key": "unit_price", "label": "Unit Price", "type": "currency", "width": 12},
        {"key": "line_total", "label": "Line Total", "type": "currency", "width": 12},
        {"key": "product_code", "label": "Product Code", "type": "string", "width": 15},
        {"key": "category", "label": "Category", "type": "string", "width": 20}
    ]'
),
(
    'Financial Summary Export',
    'Key financial data for accounting and analysis',
    true,
    NULL,
    '[
        {"key": "invoice_number", "label": "Invoice #", "type": "string", "width": 15, "required": true},
        {"key": "vendor_name", "label": "Vendor", "type": "string", "width": 25},
        {"key": "invoice_date", "label": "Date", "type": "date", "width": 12},
        {"key": "total_amount", "label": "Total", "type": "currency", "width": 12},
        {"key": "tax_amount", "label": "Tax", "type": "currency", "width": 12},
        {"key": "processing_status", "label": "Status", "type": "string", "width": 12}
    ]',
    '[
        {"key": "invoice_number", "label": "Invoice #", "type": "string", "width": 15, "required": true},
        {"key": "description", "label": "Description", "type": "string", "width": 30},
        {"key": "line_total", "label": "Amount", "type": "currency", "width": 12}
    ]'
),
(
    'Audit Trail Export',
    'Complete audit trail with all available fields',
    true,
    NULL,
    '[
        {"key": "invoice_number", "label": "Invoice #", "type": "string", "width": 15, "required": true},
        {"key": "vendor_name", "label": "Vendor Name", "type": "string", "width": 25},
        {"key": "customer_name", "label": "Customer Name", "type": "string", "width": 25},
        {"key": "invoice_date", "label": "Invoice Date", "type": "date", "width": 12},
        {"key": "due_date", "label": "Due Date", "type": "date", "width": 12},
        {"key": "total_amount", "label": "Total Amount", "type": "currency", "width": 12},
        {"key": "tax_amount", "label": "Tax Amount", "type": "currency", "width": 12},
        {"key": "processing_status", "label": "Status", "type": "string", "width": 12},
        {"key": "confidence_score", "label": "AI Confidence", "type": "percentage", "width": 12},
        {"key": "purchase_order_number", "label": "PO Number", "type": "string", "width": 20},
        {"key": "created_at", "label": "Created At", "type": "datetime", "width": 18},
        {"key": "updated_at", "label": "Updated At", "type": "datetime", "width": 18},
        {"key": "batch_name", "label": "Batch", "type": "string", "width": 20}
    ]',
    '[
        {"key": "invoice_number", "label": "Invoice #", "type": "string", "width": 15, "required": true},
        {"key": "line_number", "label": "Line #", "type": "number", "width": 8},
        {"key": "description", "label": "Description", "type": "string", "width": 40},
        {"key": "quantity", "label": "Quantity", "type": "number", "width": 10},
        {"key": "unit_price", "label": "Unit Price", "type": "currency", "width": 12},
        {"key": "line_total", "label": "Line Total", "type": "currency", "width": 12},
        {"key": "product_code", "label": "Product Code", "type": "string", "width": 15},
        {"key": "category", "label": "Category", "type": "string", "width": 20},
        {"key": "notes", "label": "Notes", "type": "string", "width": 30}
    ]'
);

-- Comments for documentation
COMMENT ON TABLE export_templates IS 'Storage for user-defined and system export field templates';
COMMENT ON TABLE export_logs IS 'Audit trail and analytics for export operations';
COMMENT ON COLUMN export_templates.invoice_fields IS 'JSONB array of invoice field configurations';
COMMENT ON COLUMN export_templates.line_item_fields IS 'JSONB array of line item field configurations';
COMMENT ON COLUMN export_logs.filters_applied IS 'JSONB object containing filters used during export';