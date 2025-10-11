const fs = require('fs').promises;
const path = require('path');
const pdf = require('pdf-parse');
const { Pool } = require('pg');
const claudeService = require('./claudeService');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

class BatchProcessingService {
  constructor() {
    this.activeProcesses = new Map(); // Track active batch processes
  }

  /**
   * Update batch progress in database using separate connection
   * @param {string} batchId - Batch UUID
   * @param {number} processedCount - Number of processed files
   * @param {number} failedCount - Number of failed files
   */
  async updateBatchProgress(batchId, processedCount, failedCount) {
    const client = await pool.connect();
    try {
      await client.query(`
        UPDATE processing_batches 
        SET processed_files = $1, failed_files = $2
        WHERE id = $3
      `, [processedCount, failedCount, batchId]);
    } catch (updateError) {
      console.warn('Failed to update batch progress:', updateError.message);
      // Don't fail the main process if progress update fails
    } finally {
      client.release();
    }
  }

  /**
   * Process a batch of invoice files
   * @param {string} batchId - UUID of the batch to process
   * @returns {Promise<Object>} Processing results
   */
  async processBatch(batchId) {
    const client = await pool.connect();
    
    try {
      console.log(`Starting batch processing for batch ${batchId}`);
      
      // Check if batch is already being processed
      if (this.activeProcesses.has(batchId)) {
        throw new Error('Batch is already being processed');
      }
      
      this.activeProcesses.set(batchId, { 
        status: 'processing', 
        startedAt: new Date(),
        processedCount: 0,
        failedCount: 0 
      });
      
      await client.query('BEGIN');
      
      // Get batch information
      const batchResult = await client.query(`
        SELECT pb.*, v.name as vendor_name, ep.prompt_text
        FROM processing_batches pb
        JOIN vendors v ON pb.vendor_id = v.id
        LEFT JOIN extraction_prompts ep ON v.extraction_prompt_id = ep.id AND ep.is_active = true
        WHERE pb.id = $1
      `, [batchId]);
      
      if (batchResult.rows.length === 0) {
        throw new Error('Batch not found');
      }
      
      const batch = batchResult.rows[0];
      
      if (batch.status !== 'processing') {
        throw new Error('Batch is not in processing status');
      }
      
      // Get pending files in batch
      const filesResult = await client.query(`
        SELECT * FROM batch_files 
        WHERE batch_id = $1 AND status = 'pending'
        ORDER BY created_at ASC
      `, [batchId]);
      
      const filesToProcess = filesResult.rows;
      console.log(`Found ${filesToProcess.length} files to process in batch ${batchId}`);
      
      let processedCount = 0;
      let failedCount = 0;
      const results = [];
      
      // Process each file sequentially
      for (const file of filesToProcess) {
        try {
          console.log(`Processing file: ${file.filename}`);
          
          // Update file status to processing (commit immediately)
          await client.query(`
            UPDATE batch_files 
            SET status = 'processing', processed_at = CURRENT_TIMESTAMP
            WHERE id = $1
          `, [file.id]);
          await client.query('COMMIT');
          await client.query('BEGIN');
          
          const processingStartTime = Date.now();
          
          // Process the file
          const result = await this.processFile(file, batch, client);
          
          const processingTime = Date.now() - processingStartTime;
          
          // Update file status and link to invoice (commit immediately)
          await client.query(`
            UPDATE batch_files 
            SET status = 'processed', invoice_id = $1, processing_time_ms = $2
            WHERE id = $3
          `, [result.invoiceId, processingTime, file.id]);
          await client.query('COMMIT');
          await client.query('BEGIN');
          
          processedCount++;
          results.push({ 
            fileId: file.id, 
            filename: file.filename, 
            status: 'processed',
            invoiceId: result.invoiceId,
            processingTime 
          });
          
          // Update active process tracking
          const activeProcess = this.activeProcesses.get(batchId);
          if (activeProcess) {
            activeProcess.processedCount = processedCount;
          }
          
          // Update batch progress in database immediately (separate connection)
          this.updateBatchProgress(batchId, processedCount, failedCount);
          
          console.log(`Successfully processed ${file.filename}`);
          
        } catch (error) {
          console.error(`Error processing file ${file.filename}:`, error);
          
          // Update file status to failed (commit immediately)
          await client.query(`
            UPDATE batch_files 
            SET status = 'failed', error_message = $1
            WHERE id = $2
          `, [error.message, file.id]);
          await client.query('COMMIT');
          await client.query('BEGIN');
          
          failedCount++;
          results.push({ 
            fileId: file.id, 
            filename: file.filename, 
            status: 'failed',
            error: error.message 
          });
          
          // Update active process tracking
          const activeProcess = this.activeProcesses.get(batchId);
          if (activeProcess) {
            activeProcess.failedCount = failedCount;
          }
          
          // Update batch progress in database immediately (separate connection)
          this.updateBatchProgress(batchId, processedCount, failedCount);
        }
      }
      
      // Update batch completion status
      let batchStatus = 'completed';
      if (failedCount > 0 && processedCount === 0) {
        batchStatus = 'failed';
      } else if (failedCount > 0) {
        batchStatus = 'partial';
      }
      
      await client.query(`
        UPDATE processing_batches 
        SET status = $1, processed_files = $2, failed_files = $3, completed_at = CURRENT_TIMESTAMP
        WHERE id = $4
      `, [batchStatus, processedCount, failedCount, batchId]);
      
      await client.query('COMMIT');
      
      console.log(`Batch ${batchId} processing completed. Processed: ${processedCount}, Failed: ${failedCount}`);
      
      // Remove from active processes
      this.activeProcesses.delete(batchId);
      
      return {
        batchId,
        status: batchStatus,
        processedCount,
        failedCount,
        results
      };
      
    } catch (error) {
      await client.query('ROLLBACK');
      
      // Update batch status to failed
      try {
        await client.query(`
          UPDATE processing_batches 
          SET status = 'failed', error_message = $1, completed_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [error.message, batchId]);
      } catch (updateError) {
        console.error('Error updating batch status:', updateError);
      }
      
      // Remove from active processes
      this.activeProcesses.delete(batchId);
      
      console.error(`Batch processing failed for batch ${batchId}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Process a single file within a batch
   * @param {Object} file - Batch file record
   * @param {Object} batch - Batch information including vendor and prompt
   * @param {Object} client - Database client
   * @returns {Promise<Object>} Processing result
   */
  async processFile(file, batch, client) {
    try {
      // Extract text content from file
      const textContent = await this.extractTextFromFile(file.file_path, file.file_type);
      
      if (!textContent || textContent.trim().length === 0) {
        throw new Error('No text content could be extracted from file');
      }
      
      // Get extraction prompt for vendor
      let prompt = batch.prompt_text;
      if (!prompt) {
        // Use default prompt if no vendor-specific prompt exists
        prompt = this.getDefaultExtractionPrompt();
      }
      
      // Call Claude API for data extraction
      const extractedData = await claudeService.extractInvoiceData(textContent, prompt);
      
      if (!extractedData || !extractedData.invoice_header) {
        throw new Error('Claude API returned invalid data structure');
      }
      
      // Validate extracted data
      const validationResults = this.validateExtractedData(extractedData);
      
      // Calculate confidence score
      const confidenceScore = this.calculateConfidenceScore(extractedData, validationResults);
      
      // Create invoice record
      const invoiceData = {
        ...extractedData.invoice_header,
        vendor_id: batch.vendor_id,
        file_path: file.file_path,
        file_type: file.file_type,
        original_filename: file.filename,
        processing_status: 'processed',
        confidence_score: confidenceScore,
        processed_at: new Date(),
        line_item_count: extractedData.line_items ? extractedData.line_items.length : 0
      };
      
      // Insert invoice
      const invoiceResult = await this.insertInvoice(invoiceData, client);
      const invoiceId = invoiceResult.id;
      
      // Insert line items
      if (extractedData.line_items && extractedData.line_items.length > 0) {
        await this.insertLineItems(invoiceId, extractedData.line_items, client);
      }
      
      return {
        invoiceId,
        confidenceScore,
        lineItemCount: extractedData.line_items ? extractedData.line_items.length : 0
      };
      
    } catch (error) {
      console.error(`Error processing file ${file.filename}:`, error);
      throw error;
    }
  }

  /**
   * Extract text content from PDF or HTML file
   * @param {string} filePath - Path to the file
   * @param {string} fileType - 'PDF' or 'HTML'
   * @returns {Promise<string>} Extracted text content
   */
  async extractTextFromFile(filePath, fileType) {
    try {
      if (fileType.toLowerCase() === 'pdf') {
        const dataBuffer = await fs.readFile(filePath);
        const pdfData = await pdf(dataBuffer);
        return pdfData.text;
      } else if (fileType.toLowerCase() === 'html') {
        const htmlContent = await fs.readFile(filePath, 'utf-8');
        // Basic HTML text extraction (remove tags)
        return htmlContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      } else {
        throw new Error(`Unsupported file type: ${fileType}`);
      }
    } catch (error) {
      throw new Error(`Failed to extract text from file: ${error.message}`);
    }
  }

  /**
   * Insert invoice record into database
   * @param {Object} invoiceData - Invoice data to insert
   * @param {Object} client - Database client
   * @returns {Promise<Object>} Inserted invoice record
   */
  async insertInvoice(invoiceData, client) {
    const fields = [
      'invoice_number', 'vendor_id', 'customer_name', 'invoice_date', 'due_date',
      'issue_date', 'service_period_start', 'service_period_end', 'currency',
      'amount_due', 'total_amount', 'subtotal', 'total_taxes', 'total_fees',
      'total_recurring', 'total_one_time', 'total_usage', 'purchase_order_number',
      'payment_terms', 'customer_account_number', 'contact_email', 'contact_phone',
      'file_path', 'file_type', 'original_filename', 'processing_status',
      'confidence_score', 'processed_at', 'line_item_count'
    ];
    
    const values = fields.map(field => invoiceData[field] || null);
    const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
    
    const query = `
      INSERT INTO invoices (${fields.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `;
    
    const result = await client.query(query, values);
    return result.rows[0];
  }

  /**
   * Insert line items for an invoice
   * @param {string} invoiceId - Invoice UUID
   * @param {Array} lineItems - Array of line item data
   * @param {Object} client - Database client
   */
  async insertLineItems(invoiceId, lineItems, client) {
    const fields = [
      'invoice_id', 'line_number', 'description', 'category', 'charge_type',
      'service_period_start', 'service_period_end', 'quantity', 'unit_of_measure',
      'unit_price', 'subtotal', 'tax_amount', 'fee_amount', 'total_amount',
      'sku', 'product_code'
    ];
    
    for (const item of lineItems) {
      const values = [invoiceId, ...fields.slice(1).map(field => item[field] || null)];
      const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
      
      const query = `
        INSERT INTO line_items (${fields.join(', ')})
        VALUES (${placeholders})
      `;
      
      await client.query(query, values);
    }
  }

  /**
   * Validate extracted invoice data
   * @param {Object} extractedData - Data extracted by Claude
   * @returns {Object} Validation results
   */
  validateExtractedData(extractedData) {
    const results = {
      errors: [],
      warnings: [],
      dateErrors: 0,
      amountMismatch: false
    };
    
    const header = extractedData.invoice_header;
    
    // Required field validation
    if (!header.invoice_number) {
      results.errors.push('Invoice number is missing');
    }
    
    if (!header.customer_name) {
      results.errors.push('Customer name is missing');
    }
    
    // Date validation
    if (header.due_date && header.invoice_date) {
      const dueDate = new Date(header.due_date);
      const invoiceDate = new Date(header.invoice_date);
      if (dueDate < invoiceDate) {
        results.warnings.push('Due date is before invoice date');
        results.dateErrors++;
      }
    }
    
    // Amount validation (basic)
    if (extractedData.line_items && extractedData.line_items.length > 0) {
      const lineItemTotal = extractedData.line_items.reduce((sum, item) => {
        return sum + (parseFloat(item.total_amount) || 0);
      }, 0);
      
      const invoiceTotal = parseFloat(header.total_amount) || 0;
      const tolerance = Math.abs(lineItemTotal * 0.01); // 1% tolerance
      
      if (Math.abs(lineItemTotal - invoiceTotal) > tolerance) {
        results.warnings.push('Line item total does not match invoice total');
        results.amountMismatch = true;
      }
    }
    
    return results;
  }

  /**
   * Calculate confidence score for extracted data
   * @param {Object} extractedData - Extracted invoice data
   * @param {Object} validationResults - Validation results
   * @returns {number} Confidence score between 0 and 1
   */
  calculateConfidenceScore(extractedData, validationResults) {
    let score = 1.0;
    const header = extractedData.invoice_header;
    
    // Deduct for missing required fields
    if (!header.invoice_number) score -= 0.3;
    if (!header.customer_name) score -= 0.3;
    
    // Deduct for missing important fields
    if (!header.invoice_date) score -= 0.1;
    if (!header.total_amount) score -= 0.1;
    
    // Deduct for validation errors
    if (validationResults.dateErrors > 0) score -= 0.05 * validationResults.dateErrors;
    if (validationResults.amountMismatch) score -= 0.1;
    
    // Deduct for empty line items
    if (!extractedData.line_items || extractedData.line_items.length === 0) {
      score -= 0.2;
    }
    
    // Claude's confidence notes
    if (extractedData.confidence_notes && 
        extractedData.confidence_notes.toLowerCase().includes('uncertain')) {
      score -= 0.1;
    }
    
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Get default extraction prompt when no vendor-specific prompt exists
   * @returns {string} Default prompt text
   */
  getDefaultExtractionPrompt() {
    return `You are an invoice data extraction specialist. Extract the following information from the provided invoice and return it as a JSON object.

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
6. The customer_name should be the end customer, not the billing entity
7. Extract ALL line items, including taxes, fees, and credits

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
}`;
  }

  /**
   * Get active batch processes status
   * @returns {Map} Map of active processes
   */
  getActiveProcesses() {
    return this.activeProcesses;
  }

  /**
   * Check if a batch is currently being processed
   * @param {string} batchId - Batch UUID
   * @returns {boolean} True if batch is being processed
   */
  isBatchProcessing(batchId) {
    return this.activeProcesses.has(batchId);
  }
}

// Export singleton instance
module.exports = new BatchProcessingService();