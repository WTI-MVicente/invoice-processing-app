-- Migration: Update Export Template Fields
-- Description: Fix field names and add new comprehensive fields to default templates
-- Date: 2024-10-13

-- Update Financial Summary Export template to use correct field names
UPDATE export_templates 
SET invoice_fields = '[
    {"key": "invoice_number", "label": "Invoice #", "type": "string", "width": 15, "required": true},
    {"key": "vendor_name", "label": "Vendor", "type": "string", "width": 25},
    {"key": "invoice_date", "label": "Date", "type": "date", "width": 12},
    {"key": "total_amount", "label": "Total", "type": "currency", "width": 12},
    {"key": "total_taxes", "label": "Tax", "type": "currency", "width": 12},
    {"key": "subtotal", "label": "Subtotal", "type": "currency", "width": 12},
    {"key": "total_fees", "label": "Fees", "type": "currency", "width": 12},
    {"key": "processing_status", "label": "Status", "type": "string", "width": 12}
]'
WHERE name = 'Financial Summary Export';

-- Update Audit Trail Export template with correct field names and add new fields
UPDATE export_templates 
SET invoice_fields = '[
    {"key": "invoice_number", "label": "Invoice #", "type": "string", "width": 15, "required": true},
    {"key": "vendor_name", "label": "Vendor Name", "type": "string", "width": 25},
    {"key": "customer_name", "label": "Customer Name", "type": "string", "width": 25},
    {"key": "invoice_date", "label": "Invoice Date", "type": "date", "width": 12},
    {"key": "due_date", "label": "Due Date", "type": "date", "width": 12},
    {"key": "issue_date", "label": "Issue Date", "type": "date", "width": 12},
    {"key": "total_amount", "label": "Total Amount", "type": "currency", "width": 12},
    {"key": "total_taxes", "label": "Tax Amount", "type": "currency", "width": 12},
    {"key": "subtotal", "label": "Subtotal", "type": "currency", "width": 12},
    {"key": "total_fees", "label": "Fees", "type": "currency", "width": 12},
    {"key": "processing_status", "label": "Status", "type": "string", "width": 12},
    {"key": "confidence_score", "label": "AI Confidence", "type": "percentage", "width": 12},
    {"key": "purchase_order_number", "label": "PO Number", "type": "string", "width": 20},
    {"key": "payment_terms", "label": "Payment Terms", "type": "string", "width": 15},
    {"key": "contact_email", "label": "Contact Email", "type": "string", "width": 25},
    {"key": "original_filename", "label": "Original File", "type": "string", "width": 30},
    {"key": "created_at", "label": "Created At", "type": "datetime", "width": 18},
    {"key": "updated_at", "label": "Updated At", "type": "datetime", "width": 18},
    {"key": "batch_name", "label": "Batch", "type": "string", "width": 20}
]',
line_item_fields = '[
    {"key": "invoice_number", "label": "Invoice #", "type": "string", "width": 15, "required": true},
    {"key": "line_number", "label": "Line #", "type": "number", "width": 8},
    {"key": "description", "label": "Description", "type": "string", "width": 40},
    {"key": "category", "label": "Category", "type": "string", "width": 20},
    {"key": "charge_type", "label": "Charge Type", "type": "string", "width": 15},
    {"key": "quantity", "label": "Quantity", "type": "number", "width": 10},
    {"key": "unit_of_measure", "label": "Unit", "type": "string", "width": 10},
    {"key": "unit_price", "label": "Unit Price", "type": "currency", "width": 12},
    {"key": "subtotal", "label": "Subtotal", "type": "currency", "width": 12},
    {"key": "tax_amount", "label": "Tax", "type": "currency", "width": 12},
    {"key": "fee_amount", "label": "Fees", "type": "currency", "width": 12},
    {"key": "total_amount", "label": "Line Total", "type": "currency", "width": 12},
    {"key": "sku", "label": "SKU", "type": "string", "width": 15},
    {"key": "product_code", "label": "Product Code", "type": "string", "width": 15},
    {"key": "service_period_start", "label": "Service Start", "type": "date", "width": 12},
    {"key": "service_period_end", "label": "Service End", "type": "date", "width": 12}
]'
WHERE name = 'Audit Trail Export';

-- Add a new comprehensive template with all major fields (skip if already exists)
INSERT INTO export_templates (name, description, is_public, user_id, invoice_fields, line_item_fields)
SELECT 
    'Comprehensive Export',
    'Complete export with all major invoice and line item fields',
    true,
    NULL,
    '[
        {"key": "invoice_number", "label": "Invoice #", "type": "string", "width": 15, "required": true},
        {"key": "vendor_name", "label": "Vendor Name", "type": "string", "width": 25},
        {"key": "customer_name", "label": "Customer Name", "type": "string", "width": 25},
        {"key": "customer_account_number", "label": "Account #", "type": "string", "width": 15},
        {"key": "invoice_date", "label": "Invoice Date", "type": "date", "width": 12},
        {"key": "due_date", "label": "Due Date", "type": "date", "width": 12},
        {"key": "issue_date", "label": "Issue Date", "type": "date", "width": 12},
        {"key": "service_period_start", "label": "Service Start", "type": "date", "width": 12},
        {"key": "service_period_end", "label": "Service End", "type": "date", "width": 12},
        {"key": "currency", "label": "Currency", "type": "string", "width": 8},
        {"key": "total_amount", "label": "Total Amount", "type": "currency", "width": 12},
        {"key": "subtotal", "label": "Subtotal", "type": "currency", "width": 12},
        {"key": "total_taxes", "label": "Total Taxes", "type": "currency", "width": 12},
        {"key": "total_fees", "label": "Total Fees", "type": "currency", "width": 12},
        {"key": "total_recurring", "label": "Recurring", "type": "currency", "width": 12},
        {"key": "total_one_time", "label": "One-Time", "type": "currency", "width": 12},
        {"key": "total_usage", "label": "Usage", "type": "currency", "width": 12},
        {"key": "purchase_order_number", "label": "PO Number", "type": "string", "width": 20},
        {"key": "payment_terms", "label": "Payment Terms", "type": "string", "width": 15},
        {"key": "contact_email", "label": "Contact Email", "type": "string", "width": 25},
        {"key": "contact_phone", "label": "Contact Phone", "type": "string", "width": 15},
        {"key": "processing_status", "label": "Status", "type": "string", "width": 12},
        {"key": "confidence_score", "label": "AI Confidence", "type": "percentage", "width": 12},
        {"key": "original_filename", "label": "Original File", "type": "string", "width": 30},
        {"key": "batch_name", "label": "Batch", "type": "string", "width": 20}
    ]',
    '[
        {"key": "invoice_number", "label": "Invoice #", "type": "string", "width": 15, "required": true},
        {"key": "line_number", "label": "Line #", "type": "number", "width": 8},
        {"key": "description", "label": "Description", "type": "string", "width": 40},
        {"key": "category", "label": "Category", "type": "string", "width": 20},
        {"key": "charge_type", "label": "Charge Type", "type": "string", "width": 15},
        {"key": "sku", "label": "SKU", "type": "string", "width": 15},
        {"key": "product_code", "label": "Product Code", "type": "string", "width": 15},
        {"key": "service_period_start", "label": "Service Start", "type": "date", "width": 12},
        {"key": "service_period_end", "label": "Service End", "type": "date", "width": 12},
        {"key": "quantity", "label": "Quantity", "type": "number", "width": 10},
        {"key": "unit_of_measure", "label": "Unit", "type": "string", "width": 10},
        {"key": "unit_price", "label": "Unit Price", "type": "currency", "width": 12},
        {"key": "subtotal", "label": "Subtotal", "type": "currency", "width": 12},
        {"key": "tax_amount", "label": "Tax Amount", "type": "currency", "width": 12},
        {"key": "fee_amount", "label": "Fee Amount", "type": "currency", "width": 12},
        {"key": "total_amount", "label": "Line Total", "type": "currency", "width": 12}
    ]'
WHERE NOT EXISTS (
    SELECT 1 FROM export_templates WHERE name = 'Comprehensive Export' AND user_id IS NULL
);