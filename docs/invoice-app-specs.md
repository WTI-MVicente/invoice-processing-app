# Invoice Processing Application - Technical Specifications

## Executive Summary

This application processes vendor invoices (PDF and HTML formats) to extract structured data for the Accounts Receivable (AR) team at Waterfield Technologies. The primary user is the manager who processes invoices from multiple vendors (initially Genesys and Five9) with different formats and structures.

## Business Context

- **Primary User**: Manager at Waterfield Technologies overseeing distributed development team
- **Primary Use Case**: Transform vendor invoices into standardized data packages for AR team
- **Current Pain Point**: Manual, error-prone, inconsistent processing across different vendors
- **Success Criteria**: Consistent, efficient invoice processing with reduced manual effort and errors

## Technical Stack

### Frontend
- **Framework**: React with Material UI components
- **Styling**: Company branding style guide (to be provided in MD format)
- **Key Features**: Split-screen interface, real-time editing, batch processing

### Backend
- **Runtime**: Node.js
- **Database**: PostgreSQL (cost-effective option on AWS RDS)
- **Storage**: AWS S3 for invoice files
- **Infrastructure**: AWS (EC2, RDS, S3)
- **IaC**: Terraform

### External Services
- **AI Processing**: Claude API (Sonnet 4.5)
  - User's personal account for coding/development
  - Dedicated API key for invoice processing (cost tracking)
  - Default model settings (no customization needed)

### Authentication
- Simple user management (no roles initially)
- Email/password based authentication
- Future expansion for 2FA, roles, etc.

## Data Schema

### Invoices Table
```sql
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
    file_type VARCHAR(10) NOT NULL, -- 'PDF' or 'HTML'
    original_filename VARCHAR(255),
    processing_status VARCHAR(50) DEFAULT 'pending', -- pending, processing, processed, approved, rejected, error
    confidence_score DECIMAL(3,2), -- 0.00 to 1.00
    processed_at TIMESTAMP,
    approved_at TIMESTAMP,
    is_duplicate BOOLEAN DEFAULT false,
    duplicate_of UUID REFERENCES invoices(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(invoice_number, vendor_id)
);

CREATE INDEX idx_invoices_vendor ON invoices(vendor_id);
CREATE INDEX idx_invoices_customer ON invoices(customer_id);
CREATE INDEX idx_invoices_status ON invoices(processing_status);
CREATE INDEX idx_invoices_date ON invoices(invoice_date);
CREATE INDEX idx_invoices_duplicate ON invoices(is_duplicate, duplicate_of);
```

### Line Items Table
```sql
CREATE TABLE line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    line_number INTEGER,
    description TEXT,
    category VARCHAR(255), -- Use vendor's original category names
    charge_type VARCHAR(100), -- Recurring, One-Time, Usage, Taxes, Fees, Credits
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

CREATE INDEX idx_line_items_invoice ON line_items(invoice_id);
CREATE INDEX idx_line_items_category ON line_items(category);
CREATE INDEX idx_line_items_charge_type ON line_items(charge_type);
```

### Vendors Table
```sql
CREATE TABLE vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(255),
    extraction_prompt_id UUID REFERENCES extraction_prompts(id),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Customers Table
```sql
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    normalized_name VARCHAR(255) NOT NULL UNIQUE, -- lowercase, trimmed for matching
    account_numbers TEXT[], -- Array of known account numbers
    aliases TEXT[], -- Array of name variations
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_customers_normalized ON customers(normalized_name);
```

### Extraction Prompts Table
```sql
CREATE TABLE extraction_prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID REFERENCES vendors(id),
    prompt_name VARCHAR(255) NOT NULL,
    prompt_text TEXT NOT NULL,
    is_template BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    version INTEGER DEFAULT 1,
    parent_prompt_id UUID REFERENCES extraction_prompts(id), -- For versioning
    invoice_type VARCHAR(100), -- NULL for default, or specific type
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    test_results JSONB, -- Store test results when testing prompts
    UNIQUE(vendor_id, prompt_name, version)
);

CREATE INDEX idx_prompts_vendor ON extraction_prompts(vendor_id);
CREATE INDEX idx_prompts_active ON extraction_prompts(is_active);
```

### Processing Batches Table
```sql
CREATE TABLE processing_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id),
    folder_path VARCHAR(1024),
    total_files INTEGER,
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
```

### Batch Files Table
```sql
CREATE TABLE batch_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES processing_batches(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES invoices(id),
    filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(1024) NOT NULL,
    file_type VARCHAR(10) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, processing, processed, failed, skipped
    error_message TEXT,
    processing_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP
);

CREATE INDEX idx_batch_files_batch ON batch_files(batch_id);
CREATE INDEX idx_batch_files_status ON batch_files(status);
```

## Core Workflows

### 1. Invoice Import Workflow

#### Step 1: Batch Initialization
1. User selects vendor from dropdown
2. User points to folder containing invoice files
3. System scans folder for PDF and HTML files
4. System displays preview list of detected files
5. User confirms or deselects files to process
6. System creates processing batch record

#### Step 2: File Processing
For each file in batch:
1. Upload file to S3 bucket (organized by vendor/date)
2. Detect file type (PDF/HTML)
3. Extract text content:
   - PDF: Use Claude's PDF processing capability
   - HTML: Parse and extract text content
4. Detect vendor from content (validation check)
5. If vendor mismatch: Flag error and stop
6. Retrieve vendor-specific extraction prompt
7. Send to Claude API with prompt + content
8. Parse Claude's JSON response
9. Create invoice and line items records (status: 'processing')
10. Calculate confidence score
11. Validate data (see Validation Rules)
12. Update status to 'processed' or 'error'
13. Continue to next file

#### Step 3: Review & Approval
1. Display processed invoices in review interface
2. Split-screen view: PDF/HTML on left, extracted tables on right
3. User can edit individual cells (auto-save)
4. User can approve individual invoices or batch approve
5. User can reject and flag for reprocessing with optional prompt adjustment
6. Track processing status changes

### 2. Prompt Management Workflow

#### Create/Edit Vendor Prompt
1. Navigate to Vendor Prompts section
2. Select vendor or create new vendor
3. Choose to create from template or from scratch
4. Enter/edit prompt text
5. Optionally: Test prompt against sample invoice
6. View extraction results
7. Compare with expected results
8. Iterate on prompt if needed
9. Save prompt (creates new version)
10. Set as active prompt for vendor

#### Prompt Versioning
- Each save creates new version
- Only one prompt can be active per vendor/invoice type
- Can rollback to previous version
- View version history with timestamps

### 3. Export Workflow

#### Manual Export
1. User navigates to Export section
2. Optionally filters invoices (date range, vendor, status, etc.)
3. Selects invoices to export (or exports all approved)
4. Clicks "Generate AR Package"
5. System creates:
   - CSV file(s) with invoice header data
   - CSV file(s) with line items data
   - Excel file(s) with headers and line items in separate sheets
   - Folder containing all related invoice PDFs/HTML files
   - Packages everything into ZIP file
6. User downloads ZIP file

#### Export Data Structure
**Invoice Headers CSV:**
```
invoice_number,vendor_name,customer_name,invoice_date,due_date,service_period_start,service_period_end,currency,amount_due,total_recurring,total_one_time,total_usage,total_taxes,total_fees,purchase_order_number,payment_terms,line_item_count
```

**Line Items CSV:**
```
invoice_number,line_number,description,category,charge_type,service_period_start,service_period_end,quantity,unit_of_measure,unit_price,subtotal,tax_amount,fee_amount,total_amount,sku,product_code
```

**Excel Structure:**
- Sheet 1: Invoice Headers
- Sheet 2: Line Items
- Both sheets contain same data as CSVs

**File Organization in ZIP:**
```
AR_Export_[timestamp].zip
├── invoices_headers.csv
├── line_items.csv
├── invoices_data.xlsx
└── invoice_files/
    ├── [vendor1]/
    │   ├── INV001.pdf
    │   └── INV002.html
    └── [vendor2]/
        └── INV003.pdf
```

## Validation Rules

### Header Validation
1. **Required Fields**: 
   - invoice_number must be present and non-empty
   - customer_name must be present and non-empty
   - Flag as error if missing

2. **Date Logic**:
   - due_date must be after invoice_date (if both present)
   - service_period_end must be after service_period_start (if both present)
   - Flag as warning if invalid

3. **Duplicate Detection**:
   - Check for existing invoice with same (invoice_number + vendor_id)
   - If found: Set is_duplicate=true, reference original via duplicate_of
   - Create new record anyway (keep both versions)
   - Flag for review

4. **Amount Calculations**:
   - Sum of line item totals should equal invoice total_amount
   - Allow 1% tolerance for rounding differences
   - Flag as warning if mismatch exceeds tolerance

### Line Item Validation
1. **Calculations**:
   - quantity × unit_price should equal subtotal (within rounding tolerance)
   - subtotal + tax_amount + fee_amount should equal total_amount
   - Flag as warning if mismatch

2. **Data Types**:
   - Dates must be valid dates
   - Numbers must be valid numeric values
   - Flag as error if invalid type

### Processing Validation
1. **Vendor Detection**:
   - Extract vendor name from invoice content
   - Compare with expected vendor for batch
   - Stop processing if mismatch
   - Display error message to user

2. **File Integrity**:
   - Verify file can be read/parsed
   - Check for corrupted files
   - Flag as error if unreadable

## User Interface Requirements

### Layout & Branding
- Material UI components throughout
- Apply Waterfield Technologies branding (style guide to be provided)
- Responsive design (primarily desktop-focused)
- Clean, professional interface

### Main Navigation
```
- Dashboard (optional/future)
- Import Invoices
- Review & Approve
- Vendors
- Customers  
- Prompts
- Export
- Settings (optional/future)
```

### Import Invoices Screen

**Components:**
1. Vendor selection dropdown
2. Folder path input (with browse button)
3. File list preview with:
   - Filename
   - File type (PDF/HTML)
   - File size
   - Checkbox to include/exclude
4. "Start Processing" button
5. Progress indicator during processing:
   - Files processed count
   - Current file being processed
   - Errors encountered
   - Ability to cancel batch
6. Results summary after completion:
   - Total files processed
   - Successful extractions
   - Errors
   - Duplicates detected

### Review & Approve Screen

**Split-Screen Layout:**

**Left Panel (60% width):**
- PDF/HTML viewer displaying invoice
- Navigation: Previous/Next invoice buttons
- Zoom controls for PDF
- Scroll through document

**Right Panel (40% width):**
- Invoice header section (collapsible):
  - Editable fields in table format
  - Field name | Value
  - Validation indicators (✓ or ⚠)
  
- Line items section:
  - Editable data table
  - Columns: All line item fields
  - Inline editing (click to edit)
  - Add/delete row functionality
  
- Totals section:
  - Summary calculations
  - Validation status indicators
  
- Actions:
  - "Approve" button
  - "Reject & Reprocess" button
  - "Save" button (auto-saves, but explicit option too)
  - Confidence score display

**Filtering & Navigation:**
- Filter by: Vendor, Status, Date Range, Confidence Score
- Batch select for bulk approval
- Invoice list sidebar (collapsible)
- Status indicators (color-coded)

### Vendors Screen

**Vendor List:**
- Table showing:
  - Vendor name
  - Active status
  - Number of invoices processed
  - Last invoice date
  - Active prompt
  - Actions (Edit, View Prompts, Deactivate)

**Add/Edit Vendor Form:**
- Vendor name
- Display name
- Active checkbox
- Associated prompt selector
- Save/Cancel buttons

### Customers Screen

**Customer List:**
- Table showing:
  - Customer name
  - Known account numbers
  - Aliases
  - Number of invoices
  - Actions (Edit, View Invoices)

**Add/Edit Customer Form:**
- Customer name
- Account numbers (multi-input)
- Aliases (multi-input)
- Active checkbox
- Save/Cancel buttons

### Prompts Screen

**Prompt List:**
- Grouped by vendor
- Shows:
  - Prompt name
  - Version
  - Active status
  - Last tested date
  - Actions (Edit, Test, Set Active, View History)

**Create/Edit Prompt Form:**
- Vendor selection
- Prompt name
- Invoice type (optional)
- Large text area for prompt
- "Create from Template" option
- "Load Previous Version" option
- Save button (creates new version)

**Test Prompt Interface:**
- Upload sample invoice
- Click "Test" button
- Display extraction results side-by-side:
  - Left: Sample invoice
  - Right: Extracted JSON data formatted as tables
- Compare with expected results
- Iterate and re-test
- Save when satisfied

**Version History:**
- List of all versions with:
  - Version number
  - Created date
  - Created by
  - Test results (if available)
  - Actions (View, Set Active, Rollback)

### Export Screen

**Filter Section:**
- Date range picker
- Vendor multi-select
- Customer multi-select
- Status filter (only approved by default)

**Invoice Selection:**
- Data table with:
  - Checkbox column
  - Invoice number
  - Vendor
  - Customer
  - Date
  - Amount
  - Status
- "Select All" / "Deselect All"
- Show count of selected invoices

**Export Options:**
- Format selection: CSV, Excel, or Both
- "Generate AR Package" button
- Progress indicator during generation
- Download link when complete

## Claude API Integration

### Prompt Structure

**Base Template Prompt:**
```
You are an invoice data extraction specialist. Extract the following information from the provided invoice and return it as a JSON object.

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
- category (string - use the vendor's original category name)
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
3. Preserve vendor's original category names - do not normalize or rename them
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
  "confidence_notes": "Optional: note any fields you're uncertain about"
}

[VENDOR-SPECIFIC INSTRUCTIONS WILL BE INSERTED HERE]
```

**Vendor-Specific Additions (Examples):**

*For Genesys:*
```
**Genesys-Specific Notes:**
- Look for the "Bill To" section for the billing entity (Waterfield/WTI Holdings)
- Look for "End User" section for the actual customer name
- Line items are typically grouped into sections: Core Services, Telco Usage, Taxes/Fees
- Journey Management charges are recurring
- BYOT (Bring Your Own Trunk) charges are usage-based
- AudioHook Monitor charges are usage-based
```

*For Five9:*
```
**Five9-Specific Notes:**
- Customer name may be in the "Sold to address" or "Ship To" section
- Watch for prorated charges which have shorter service periods
- Service period is shown per line item in "Service Period" column
- Categories include: One Time, Recurring, Usage, SaaS Usage
- Pay attention to the detailed tax breakdown section at the bottom
```

### API Call Flow

1. **Prepare Request:**
   ```javascript
   const messages = [
     {
       role: "user",
       content: [
         {
           type: "document",
           source: {
             type: "base64",
             media_type: "application/pdf", // or "text/html"
             data: base64EncodedContent
           }
         },
         {
           type: "text",
           text: vendorPromptText
         }
       ]
     }
   ];
   ```

2. **Send Request:**
   ```javascript
   const response = await anthropic.messages.create({
     model: "claude-sonnet-4-20250514",
     max_tokens: 4096,
     messages: messages
   });
   ```

3. **Parse Response:**
   - Extract text from response.content[0].text
   - Remove any markdown formatting (```json, etc.)
   - Parse as JSON
   - Validate structure
   - Calculate confidence score based on completeness

4. **Error Handling:**
   - Catch API errors (rate limits, timeouts, etc.)
   - Catch JSON parsing errors
   - Log error details
   - Set invoice status to 'error'
   - Store error message
   - Do not retry automatically (user must manually reprocess)

### Confidence Score Calculation

```javascript
function calculateConfidenceScore(extractedData, validationResults) {
  let score = 1.0;
  
  // Deduct for missing required fields
  if (!extractedData.invoice_header.invoice_number) score -= 0.3;
  if (!extractedData.invoice_header.customer_name) score -= 0.3;
  
  // Deduct for missing important fields
  if (!extractedData.invoice_header.invoice_date) score -= 0.1;
  if (!extractedData.invoice_header.total_amount) score -= 0.1;
  
  // Deduct for validation errors
  if (validationResults.dateErrors > 0) score -= 0.05 * validationResults.dateErrors;
  if (validationResults.amountMismatch) score -= 0.1;
  
  // Deduct for empty line items
  if (extractedData.line_items.length === 0) score -= 0.2;
  
  // Claude's confidence notes
  if (extractedData.confidence_notes && extractedData.confidence_notes.includes('uncertain')) {
    score -= 0.1;
  }
  
  return Math.max(0, Math.min(1, score));
}
```

## File Storage Structure (S3)

```
invoice-processing-bucket/
├── invoices/
│   ├── genesys/
│   │   ├── 2025/
│   │   │   ├── 06/
│   │   │   │   ├── IN8100-25013310.pdf
│   │   │   │   └── IN8100-25013311.pdf
│   │   │   └── 07/
│   │   └── 2024/
│   └── five9/
│       ├── 2024/
│       │   └── 10/
│       │       ├── INV01208704.html
│       │       └── INV01208705.html
│       └── 2025/
└── exports/
    ├── AR_Export_20250605_143022.zip
    └── AR_Export_20250606_091533.zip
```

## AWS Infrastructure (Terraform)

### Resources Required

1. **VPC & Networking**
   - VPC with public and private subnets
   - Internet Gateway
   - NAT Gateway
   - Security Groups

2. **Compute (EC2)**
   - Instance type: t3.small or t3.medium (cost-effective)
   - Auto-scaling group (optional for future)
   - Load balancer (Application Load Balancer)

3. **Database (RDS)**
   - PostgreSQL (smallest instance initially)
   - Automated backups
   - Multi-AZ for production (optional)

4. **Storage (S3)**
   - Bucket for invoice files
   - Bucket for exports
   - Lifecycle policies for cost optimization

5. **IAM**
   - Roles for EC2 to access S3 and RDS
   - Policies for least-privilege access

6. **CloudWatch**
   - Basic logging and monitoring
   - Alarms for critical errors (optional)

### Cost Optimization
- Use Reserved Instances for EC2 (if long-term)
- Enable S3 Intelligent-Tiering
- Minimize data transfer costs
- Use smallest viable instance sizes
- Enable auto-shutdown for dev/test environments

## Security Considerations

### Data Protection
1. All data at rest encrypted (S3, RDS)
2. SSL/TLS for data in transit
3. Secure password hashing (bcrypt)
4. Session management with secure cookies

### Access Control
1. Simple email/password authentication initially
2. Session timeout: 8 hours
3. User table with hashed passwords
4. Future: Add 2FA, SSO, etc.

### Audit Logging
- Log all invoice status changes
- Log user login/logout
- Log failed authentication attempts
- Store logs in CloudWatch

## Performance Considerations

### Expected Load
- Typical batch: 50 invoices per month per vendor
- Max batch: 300 invoices (rare, during initialization)
- Concurrent users: 1 (initially)
- Invoice file sizes: 50KB - 2MB typical

### Optimization Strategies
1. Process invoices sequentially (no parallel processing needed initially)
2. Implement resume capability for failed batches
3. Cache vendor prompts in memory
4. Use database indexes on frequently queried fields
5. Implement pagination for large data tables

### Processing Time Estimates
- Per invoice: 5-10 seconds (Claude API + database writes)
- Batch of 50: ~5-8 minutes
- Batch of 300: ~30-50 minutes

## Error Handling

### Types of Errors

1. **File Access Errors**
   - File not found
   - File corrupted/unreadable
   - Permission denied
   - Action: Log error, mark file as failed, continue batch

2. **API Errors**
   - Claude API timeout
   - Rate limit exceeded
   - Invalid response
   - Action: Log error, mark invoice as error, do not retry automatically

3. **Validation Errors**
   - Missing required fields
   - Invalid data types
   - Business rule violations
   - Action: Mark as warning or error, allow user to fix in review

4. **Database Errors**
   - Connection lost
   - Constraint violations
   - Query timeout
   - Action: Log error, rollback transaction, notify user

5. **Duplicate Detection**
   - Not technically an error
   - Action: Mark as duplicate, create new record, flag for review

### Error Recovery

**For Batch Processing:**
- Each successfully processed file is saved immediately
- If batch fails mid-process, user can resume from last successful file
- Batch status tracks: total, processed, failed
- User can choose to reprocess only failed files

**For Individual Invoices:**
- User can reject and reprocess individual invoices
- User can adjust prompt and reprocess
- User can manually edit extracted data
- Original file always preserved in S3

## Testing Strategy

### Unit Tests
- Test data extraction parsing
- Test validation rules
- Test confidence score calculation
- Test export file generation

### Integration Tests
- Test database operations
- Test S3 file operations
- Test Claude API integration (with mock responses)

### User Acceptance Testing
- Test full import workflow with sample invoices
- Test editing and approval workflow
- Test export generation
- Test prompt management
- Test vendor detection

## Future Enhancements (Out of Scope for Initial Version)

1. **Advanced Features**
   - Dynamics 365 integration
   - Automated email delivery of exports
   - Scheduled/automated exports
   - Cost center allocations
   - Markup calculations
   - Budget tracking and alerts

2. **Analytics & Reporting**
   - Dashboard with metrics
   - Trend analysis
   - Vendor comparison reports
   - Spend analysis

3. **User Management**
   - Role-based access control
   - Multi-user support
   - Activity audit trails
   - Two-factor authentication

4. **Performance**
   - Parallel processing of invoices
   - API response caching
   - Real-time progress updates via WebSockets

5. **Data Management**
   - Data archiving
   - Bulk delete functionality
   - Data retention policies
   - Export to external systems

## Development Approach

### Phase 1: Core Infrastructure (Week 1-2)
- Set up Terraform configuration
- Deploy AWS infrastructure
- Set up database schema
- Implement authentication
- Basic React app scaffold

### Phase 2: Import & Processing (Week 3-4)
- File upload and storage
- Claude API integration
- Data extraction and parsing
- Basic validation
- Processing batch management

### Phase 3: Review Interface (Week 5-6)
- Split-screen UI
- Invoice viewer
- Editable data tables
- Approval workflow
- Duplicate detection

### Phase 4: Vendor & Prompt Management (Week 7)
- Vendor CRUD operations
- Customer CRUD operations
- Prompt management UI
- Prompt testing functionality
- Version control

### Phase 5: Export Functionality (Week 8)
- CSV generation
- Excel generation
- ZIP packaging
- File organization

### Phase 6: Polish & Testing (Week 9-10)
- UI/UX refinements
- Branding application
- Comprehensive testing
- Bug fixes
- Documentation

## Success Metrics

1. **Efficiency**
   - Reduce invoice processing time by 70%
   - 95%+ accuracy in data extraction
   - Process 50 invoices in under 10 minutes

2. **User Satisfaction**
   - Consistent process across all vendors
   - Minimal manual data entry required
   - Easy to identify and correct errors
   - Simplified AR package delivery

3. **Technical**
   - 99% uptime
   - Sub-10-second response times
   - Zero data loss
   - Successful export generation every time

## Appendices

### A. Sample Data Structures

**Sample Invoice JSON from Claude:**
```json
{
  "invoice_header": {
    "invoice_number": "INV01208704",
    "invoice_date": "2024-10-01",
    "due_date": "2024-10-31",
    "service_period_start": "2024-10-01",
    "service_period_end": "2024-10-31",
    "currency": "USD",
    "amount_due": 47646.21,
    "total_amount": 47646.21,
    "subtotal": 44629.56,
    "total_taxes": 3012.76,
    "total_fees": 3.89,
    "total_recurring": 44249.06,
    "total_one_time": 2.50,
    "total_usage": 378.00,
    "purchase_order_number": null,
    "payment_terms": "Net 30",
    "customer_name": "Christian Healthcare Ministries",
    "customer_account_number": "171896",
    "contact_email": "Lenie.Manalili@waterfield.com",
    "contact_phone": "9186403562"
  },
  "line_items": [
    {
      "line_number": 1,
      "description": "Caller ID Display (CNAM) Activation",
      "category": "One Time Charges",
      "charge_type": "One-Time",
      "service_period_start": "2024-09-17",
      "service_period_end": "2024-09-17",
      "quantity": 1,
      "unit_of_measure": "Each",
      "unit_price": 2.50,
      "subtotal": 2.50,
      "tax_amount": 0.17,
      "fee_amount": 0.00,
      "total_amount": 2.67,
      "sku": null,
      "product_code": null
    }
  ],
  "confidence_notes": "All required fields extracted successfully. Customer name identified from Account Name field."
}
```

### B. Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname

# AWS
AWS_REGION=us-east-1
AWS_S3_BUCKET_INVOICES=invoice-processing-invoices
AWS_S3_BUCKET_EXPORTS=invoice-processing-exports

# Claude API
ANTHROPIC_API_KEY=sk-ant-xxxxx
ANTHROPIC_MODEL=claude-sonnet-4-20250514

# Application
NODE_ENV=production
PORT=3000
SESSION_SECRET=xxxxx
JWT_SECRET=xxxxx

# Frontend
REACT_APP_API_URL=https://api.yourapp.com
```

### C. API Endpoints (Backend)

```
# Authentication
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me

# Vendors
GET    /api/vendors
GET    /api/vendors/:id
POST   /api/vendors
PUT    /api/vendors/:id
DELETE /api/vendors/:id

# Customers
GET    /api/customers
GET    /api/customers/:id
POST   /api/customers
PUT    /api/customers/:id
DELETE /api/customers/:id

# Prompts
GET    /api/prompts
GET    /api/prompts/:id
GET    /api/prompts/vendor/:vendorId
POST   /api/prompts
PUT    /api/prompts/:id
POST   /api/prompts/:id/test
GET    /api/prompts/:id/history
POST   /api/prompts/:id/activate

# Invoices
GET    /api/invoices
GET    /api/invoices/:id
PUT    /api/invoices/:id
DELETE /api/invoices/:id
POST   /api/invoices/:id/approve
POST   /api/invoices/:id/reject
POST   /api/invoices/:id/reprocess

# Batches
GET    /api/batches
GET    /api/batches/:id
POST   /api/batches/init
POST   /api/batches/:id/process
POST   /api/batches/:id/resume
DELETE /api/batches/:id

# Export
POST   /api/export/generate
GET    /api/export/:id/download

# File Upload
POST   /api/files/upload
GET    /api/files/:id
```

---

## Document Version
- Version: 1.0
- Date: 2025-06-05
- Author: Software Analyst & Solutions Consultant (Claude)
- Status: Ready for Development