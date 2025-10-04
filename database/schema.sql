-- Invoice Processing Application Database Schema
-- Version: 1.0
-- Created for: Waterfield Technologies

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (for authentication)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vendors table
CREATE TABLE vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(255),
    extraction_prompt_id UUID,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Customers table
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    normalized_name VARCHAR(255) NOT NULL UNIQUE,
    account_numbers TEXT[],
    aliases TEXT[],
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Extraction prompts table
CREATE TABLE extraction_prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID REFERENCES vendors(id),
    prompt_name VARCHAR(255) NOT NULL,
    prompt_text TEXT NOT NULL,
    is_template BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    version INTEGER DEFAULT 1,
    parent_prompt_id UUID REFERENCES extraction_prompts(id),
    invoice_type VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    test_results JSONB,
    UNIQUE(vendor_id, prompt_name, version)
);

-- Processing batches table
CREATE TABLE processing_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id),
    folder_path VARCHAR(1024),
    total_files INTEGER,
    processed_files INTEGER DEFAULT 0,
    failed_files INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'pending',
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Invoices table (main entity)
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number VARCHAR(255) NOT NULL,
    vendor_id UUID NOT NULL REFERENCES vendors(id),
    customer_id UUID REFERENCES customers(id),
    invoice_date DATE NOT NULL,
    due_date DATE,
    issue_date DATE,
    service_period_start DATE,
    service_period_end DATE,
    currency VARCHAR(10) DEFAULT 'USD',
    amount_due DECIMAL(12,2),
    total_amount DECIMAL(12,2),
    subtotal DECIMAL(12,2),
    total_taxes DECIMAL(12,2),
    total_fees DECIMAL(12,2),
    total_recurring DECIMAL(12,2),
    total_one_time DECIMAL(12,2),
    total_usage DECIMAL(12,2),
    line_item_count INTEGER,
    purchase_order_number VARCHAR(255),
    payment_terms VARCHAR(255),
    customer_name VARCHAR(255) NOT NULL,
    customer_account_number VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    file_path VARCHAR(1024) NOT NULL,
    file_type VARCHAR(10) NOT NULL,
    original_filename VARCHAR(255),
    processing_status VARCHAR(50) DEFAULT 'pending',
    confidence_score DECIMAL(3,2),
    processed_at TIMESTAMP,
    approved_at TIMESTAMP,
    is_duplicate BOOLEAN DEFAULT false,
    duplicate_of UUID REFERENCES invoices(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(invoice_number, vendor_id)
);

-- Line items table
CREATE TABLE line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    line_number INTEGER,
    description TEXT,
    category VARCHAR(255),
    charge_type VARCHAR(100),
    service_period_start DATE,
    service_period_end DATE,
    quantity DECIMAL(12,4),
    unit_of_measure VARCHAR(50),
    unit_price DECIMAL(12,4),
    subtotal DECIMAL(12,2),
    tax_amount DECIMAL(12,2),
    fee_amount DECIMAL(12,2),
    total_amount DECIMAL(12,2),
    sku VARCHAR(255),
    product_code VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Batch files table
CREATE TABLE batch_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES processing_batches(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES invoices(id),
    filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(1024) NOT NULL,
    file_type VARCHAR(10) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    error_message TEXT,
    processing_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(is_active);

CREATE INDEX idx_vendors_name ON vendors(name);
CREATE INDEX idx_vendors_active ON vendors(active);

CREATE INDEX idx_customers_normalized ON customers(normalized_name);
CREATE INDEX idx_customers_active ON customers(active);

CREATE INDEX idx_prompts_vendor ON extraction_prompts(vendor_id);
CREATE INDEX idx_prompts_active ON extraction_prompts(is_active);
CREATE INDEX idx_prompts_template ON extraction_prompts(is_template);

CREATE INDEX idx_batches_vendor ON processing_batches(vendor_id);
CREATE INDEX idx_batches_status ON processing_batches(status);
CREATE INDEX idx_batches_created ON processing_batches(created_at);

CREATE INDEX idx_invoices_vendor ON invoices(vendor_id);
CREATE INDEX idx_invoices_customer ON invoices(customer_id);
CREATE INDEX idx_invoices_status ON invoices(processing_status);
CREATE INDEX idx_invoices_date ON invoices(invoice_date);
CREATE INDEX idx_invoices_duplicate ON invoices(is_duplicate, duplicate_of);
CREATE INDEX idx_invoices_number_vendor ON invoices(invoice_number, vendor_id);

CREATE INDEX idx_line_items_invoice ON line_items(invoice_id);
CREATE INDEX idx_line_items_category ON line_items(category);
CREATE INDEX idx_line_items_charge_type ON line_items(charge_type);

CREATE INDEX idx_batch_files_batch ON batch_files(batch_id);
CREATE INDEX idx_batch_files_status ON batch_files(status);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to all relevant tables
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vendors_updated_at 
    BEFORE UPDATE ON vendors 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at 
    BEFORE UPDATE ON customers 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at 
    BEFORE UPDATE ON invoices 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_line_items_updated_at 
    BEFORE UPDATE ON line_items 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default data
INSERT INTO vendors (name, display_name, active) VALUES 
    ('genesys', 'Genesys', true),
    ('five9', 'Five9', true);

-- Insert template prompts
INSERT INTO extraction_prompts (prompt_name, prompt_text, is_template, is_active, version, created_by)
VALUES (
    'Base Template',
    'You are an invoice data extraction specialist. Extract the following information from the provided invoice and return it as a JSON object.

**Required Invoice Header Fields:**
- invoice_number (string, required)
- invoice_date (YYYY-MM-DD format)
- due_date (YYYY-MM-DD format)
- issue_date (YYYY-MM-DD format)
- service_period_start (YYYY-MM-DD format)
- service_period_end (YYYY-MM-DD format)
- currency (e.g., "USD", "CAD")
- amount_due (decimal number)
- total_amount (decimal number)
- subtotal (decimal number)
- total_taxes (decimal number)
- total_fees (decimal number)
- total_recurring (decimal number)
- total_one_time (decimal number)
- total_usage (decimal number)
- purchase_order_number (string)
- payment_terms (string)
- customer_name (string, required)
- customer_account_number (string)
- contact_email (string)
- contact_phone (string)

**Line Items Array:**
For each line item, extract:
- line_number (integer)
- description (string)
- category (string - use the vendor''s original category name)
- charge_type (string - one of: Recurring, One-Time, Usage, Taxes, Fees, Credits)
- service_period_start (YYYY-MM-DD format)
- service_period_end (YYYY-MM-DD format)
- quantity (decimal number)
- unit_of_measure (string)
- unit_price (decimal number)
- subtotal (decimal number)
- tax_amount (decimal number)
- fee_amount (decimal number)
- total_amount (decimal number)
- sku (string)
- product_code (string)

**Important Instructions:**
1. Return ONLY valid JSON, no markdown formatting or code blocks
2. Use null for any fields that are not present in the invoice
3. Preserve vendor''s original category names - do not normalize or rename them
4. For dates, always use YYYY-MM-DD format
5. For decimal numbers, include up to 4 decimal places for quantities and prices, 2 decimal places for amounts
6. The customer_name should be the end customer, not the billing entity (Waterfield Technologies)
7. Look for "Ship To" or "End User" or "Sold To" sections to identify the customer
8. Extract ALL line items, including taxes, fees, and credits
9. Ensure line item totals are accurately captured

**Expected JSON Structure:**
{
  "invoice_header": {
    "invoice_number": "...",
    "invoice_date": "...",
    ...
  },
  "line_items": [
    {
      "line_number": 1,
      "description": "...",
      ...
    }
  ],
  "confidence_notes": "Optional: note any fields you''re uncertain about"
}',
    true,
    true,
    1,
    'system'
);

-- Create sample customer data
INSERT INTO customers (name, normalized_name, account_numbers, aliases) VALUES 
    ('Christian Healthcare Ministries', 'christian healthcare ministries', ARRAY['171896'], ARRAY['CHM', 'Christian Healthcare']);

-- Add foreign key constraint after both tables exist
ALTER TABLE vendors ADD CONSTRAINT fk_vendors_extraction_prompt 
    FOREIGN KEY (extraction_prompt_id) REFERENCES extraction_prompts(id);

-- Show summary
SELECT 'Database schema created successfully!' as message;
SELECT 'Tables created:' as info, count(*) as table_count FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
SELECT 'Indexes created:' as info, count(*) as index_count FROM pg_indexes WHERE schemaname = 'public';