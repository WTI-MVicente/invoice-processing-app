const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');
const { query, transaction } = require('../config/database');
const { uploadSingle, uploadMultiple, getFileType, readFileContent, deleteFile } = require('../middleware/upload');
const claudeService = require('../services/claudeService');
const fileService = require('../services/fileService');

const router = express.Router();

// Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token is required' });
  }

  const jwt = require('jsonwebtoken');
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

// GET /api/invoices - Get all invoices with filtering
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      vendor_id, 
      customer_id, 
      status, 
      batch_name,
      search,
      start_date, 
      end_date, 
      limit = 50, 
      offset = 0 
    } = req.query;

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (vendor_id) {
      whereClause += ` AND i.vendor_id = $${paramCount}`;
      params.push(vendor_id);
      paramCount++;
    }

    if (customer_id) {
      whereClause += ` AND i.customer_id = $${paramCount}`;
      params.push(customer_id);
      paramCount++;
    }

    if (status) {
      whereClause += ` AND i.processing_status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (batch_name) {
      if (batch_name === 'Single Upload') {
        whereClause += ` AND pb.id IS NULL`;
      } else {
        whereClause += ` AND CONCAT('Batch-', EXTRACT(YEAR FROM pb.created_at), '-', EXTRACT(MONTH FROM pb.created_at), '-', EXTRACT(DAY FROM pb.created_at), '-', RIGHT(pb.id::text, 8)) = $${paramCount}`;
        params.push(batch_name);
        paramCount++;
      }
    }

    if (start_date) {
      whereClause += ` AND i.invoice_date >= $${paramCount}`;
      params.push(start_date);
      paramCount++;
    }

    if (end_date) {
      whereClause += ` AND i.invoice_date <= $${paramCount}`;
      params.push(end_date);
      paramCount++;
    }

    if (search) {
      // Search across invoice_number, customer_name, and purchase_order_number
      whereClause += ` AND (
        i.invoice_number ILIKE $${paramCount} OR 
        COALESCE(c.name, i.customer_name) ILIKE $${paramCount} OR 
        i.purchase_order_number ILIKE $${paramCount}
      )`;
      params.push(`%${search}%`);
      paramCount++;
    }

    const invoicesQuery = `
      SELECT 
        i.*,
        v.name as vendor_name,
        v.display_name as vendor_display_name,
        COALESCE(c.name, i.customer_name) as customer_name,
        COUNT(li.id) as line_item_count,
        pb.id as batch_id,
        pb.created_at as batch_created_at,
        CASE 
          WHEN pb.id IS NOT NULL THEN CONCAT('Batch-', EXTRACT(YEAR FROM pb.created_at), '-', EXTRACT(MONTH FROM pb.created_at), '-', EXTRACT(DAY FROM pb.created_at), '-', RIGHT(pb.id::text, 8))
          ELSE 'Single Upload'
        END as batch_name
      FROM invoices i
      LEFT JOIN vendors v ON i.vendor_id = v.id
      LEFT JOIN customers c ON i.customer_id = c.id
      LEFT JOIN line_items li ON i.id = li.invoice_id
      LEFT JOIN batch_files bf ON i.id = bf.invoice_id
      LEFT JOIN processing_batches pb ON bf.batch_id = pb.id
      ${whereClause}
      GROUP BY i.id, v.name, v.display_name, c.name, i.customer_name, pb.id, pb.created_at
      ORDER BY i.created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    params.push(parseInt(limit), parseInt(offset));

    const result = await query(invoicesQuery, params);
    
    // Get total count for pagination (without LIMIT/OFFSET)
    const countQuery = `
      SELECT COUNT(DISTINCT i.id) as total
      FROM invoices i
      LEFT JOIN vendors v ON i.vendor_id = v.id
      LEFT JOIN customers c ON i.customer_id = c.id
      LEFT JOIN line_items li ON i.id = li.invoice_id
      LEFT JOIN batch_files bf ON i.id = bf.invoice_id
      LEFT JOIN processing_batches pb ON bf.batch_id = pb.id
      ${whereClause}
    `;
    
    const countResult = await query(countQuery, params.slice(0, -2)); // Remove limit and offset params

    res.json({
      invoices: result.rows,
      total: parseInt(countResult.rows[0].total),
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: parseInt(countResult.rows[0].total)
      }
    });

  } catch (error) {
    console.error('❌ Error fetching invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// POST /api/invoices/upload - Upload and process single invoice
router.post('/upload', authenticateToken, uploadSingle('invoice'), async (req, res) => {
  let filePath = null;
  
  try {
    const { vendor_id } = req.body;
    
    if (!vendor_id) {
      await deleteFile(req.file.path);
      return res.status(400).json({ error: 'vendor_id is required' });
    }

    filePath = req.file.path;
    const fileType = getFileType(req.file.filename);
    
    console.log(`📊 Processing invoice: ${req.file.originalname} for vendor ${vendor_id}`);

    // Verify vendor exists
    const vendorResult = await query('SELECT * FROM vendors WHERE id = $1 AND active = true', [vendor_id]);
    if (vendorResult.rows.length === 0) {
      await deleteFile(filePath);
      return res.status(404).json({ error: 'Vendor not found or inactive' });
    }

    const vendor = vendorResult.rows[0];

    // Get vendor's extraction prompt or use structured default
    let extractionPrompt = `I need you to extract structured data from this invoice document. Please analyze the following invoice and return the information in the exact JSON format specified.

CRITICAL INSTRUCTIONS:
1. Return ONLY valid JSON - no other text before or after
2. Extract the EXACT invoice number from the document - do not make up numbers
3. Use actual text from the document for all descriptions and fields
4. Be thorough - missing data reduces accuracy
5. For numbers, use only digits with decimals (no $ symbols or commas)

REQUIRED JSON FORMAT:
{
  "invoice_header": {
    "invoice_number": "exact number from document",
    "customer_name": "actual customer name from document", 
    "invoice_date": "YYYY-MM-DD",
    "due_date": "YYYY-MM-DD",
    "issue_date": "YYYY-MM-DD",
    "service_period_start": "YYYY-MM-DD",
    "service_period_end": "YYYY-MM-DD",
    "currency": "USD",
    "amount_due": 0.00,
    "total_amount": 0.00,
    "subtotal": 0.00,
    "total_taxes": 0.00,
    "total_fees": 0.00,
    "purchase_order_number": "string",
    "payment_terms": "string",
    "customer_account_number": "string",
    "contact_email": "string",
    "contact_phone": "string"
  },
  "line_items": [
    {
      "line_number": 1,
      "description": "exact text from invoice",
      "category": "string",
      "charge_type": "recurring|one_time|usage",
      "quantity": 1,
      "unit_price": 0.00,
      "total_amount": 0.00
    }
  ]
}`;

    if (vendor.extraction_prompt_id) {
      const promptResult = await query(
        'SELECT prompt_text FROM extraction_prompts WHERE id = $1 AND is_active = true',
        [vendor.extraction_prompt_id]
      );
      if (promptResult.rows.length > 0) {
        extractionPrompt = promptResult.rows[0].prompt_text;
      }
    }

    // Read file content
    const documentContent = await readFileContent(filePath);
    
    // Process with Claude
    const startTime = Date.now();
    const extractedData = await claudeService.extractInvoiceData(
      documentContent, 
      extractionPrompt, 
      fileType.toLowerCase()
    );
    const processingTime = Date.now() - startTime;

    // Store invoice in database
    const invoiceId = await transaction(async (client) => {
      // Insert invoice header
      const invoiceQuery = `
        INSERT INTO invoices (
          invoice_number, vendor_id, customer_name, invoice_date, due_date, issue_date,
          service_period_start, service_period_end, currency, amount_due, total_amount,
          subtotal, total_taxes, total_fees, total_recurring, total_one_time, total_usage,
          purchase_order_number, payment_terms, customer_account_number, contact_email,
          contact_phone, file_path, file_type, original_filename, processing_status,
          confidence_score, processed_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
          $18, $19, $20, $21, $22, $23, $24, $25, 'processed', $26, CURRENT_TIMESTAMP
        ) RETURNING id
      `;

      const header = extractedData.invoice_header;
      const invoiceResult = await client.query(invoiceQuery, [
        header.invoice_number,
        vendor_id,
        header.customer_name,
        header.invoice_date,
        header.due_date,
        header.issue_date,
        header.service_period_start,
        header.service_period_end,
        header.currency || 'USD',
        header.amount_due,
        header.total_amount,
        header.subtotal,
        header.total_taxes,
        header.total_fees,
        header.total_recurring,
        header.total_one_time,
        header.total_usage,
        header.purchase_order_number,
        header.payment_terms,
        header.customer_account_number,
        header.contact_email,
        header.contact_phone,
        req.file.path,
        fileType,
        req.file.originalname,
        extractedData.confidence_score
      ]);

      const invoiceId = invoiceResult.rows[0].id;

      // Insert line items
      if (extractedData.line_items && extractedData.line_items.length > 0) {
        for (const lineItem of extractedData.line_items) {
          const lineItemQuery = `
            INSERT INTO line_items (
              invoice_id, line_number, description, category, charge_type,
              service_period_start, service_period_end, quantity, unit_of_measure,
              unit_price, subtotal, tax_amount, fee_amount, total_amount, sku, product_code
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          `;

          await client.query(lineItemQuery, [
            invoiceId,
            lineItem.line_number,
            lineItem.description,
            lineItem.category,
            lineItem.charge_type,
            lineItem.service_period_start,
            lineItem.service_period_end,
            lineItem.quantity,
            lineItem.unit_of_measure,
            lineItem.unit_price,
            lineItem.subtotal,
            lineItem.tax_amount,
            lineItem.fee_amount,
            lineItem.total_amount,
            lineItem.sku,
            lineItem.product_code
          ]);
        }
      }

      return invoiceId;
    });

    console.log(`✅ Invoice processed successfully in ${processingTime}ms`);

    res.status(201).json({
      message: 'Invoice processed successfully',
      invoice: {
        id: invoiceId,
        invoice_number: extractedData.invoice_header.invoice_number,
        customer_name: extractedData.invoice_header.customer_name,
        total_amount: extractedData.invoice_header.total_amount,
        line_items_count: extractedData.line_items?.length || 0,
        confidence_score: extractedData.confidence_score,
        processing_time_ms: processingTime,
        file_type: fileType,
        vendor_name: vendor.display_name
      }
    });

  } catch (error) {
    console.error('❌ Invoice processing error:', error);
    
    // Clean up uploaded file on error
    if (filePath) {
      await deleteFile(filePath);
    }

    if (error.message.includes('Claude')) {
      res.status(502).json({ 
        error: 'AI processing failed. Please check the document format and try again.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    } else if (error.message.includes('duplicate key')) {
      res.status(409).json({ 
        error: 'Invoice with this number already exists for this vendor' 
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to process invoice',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
});

// GET /api/invoices/:id - Get single invoice with line items
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Get invoice with vendor and customer info
    const invoiceQuery = `
      SELECT 
        i.*,
        v.name as vendor_name,
        v.display_name as vendor_display_name,
        COALESCE(c.name, i.customer_name) as customer_name
      FROM invoices i
      LEFT JOIN vendors v ON i.vendor_id = v.id
      LEFT JOIN customers c ON i.customer_id = c.id
      WHERE i.id = $1
    `;

    const invoiceResult = await query(invoiceQuery, [id]);
    
    if (invoiceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const invoice = invoiceResult.rows[0];

    // Get line items
    const lineItemsQuery = `
      SELECT * FROM line_items 
      WHERE invoice_id = $1 
      ORDER BY line_number ASC, created_at ASC
    `;

    const lineItemsResult = await query(lineItemsQuery, [id]);

    res.json({
      invoice: {
        ...invoice,
        line_items: lineItemsResult.rows
      }
    });

  } catch (error) {
    console.error('❌ Error fetching invoice:', error);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

// PUT /api/invoices/:id/approve - Approve invoice
router.put('/:id/approve', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'UPDATE invoices SET processing_status = $1, approved_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING invoice_number',
      ['approved', id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    console.log(`✅ Invoice approved: ${result.rows[0].invoice_number}`);

    res.json({ 
      message: 'Invoice approved successfully',
      invoice_number: result.rows[0].invoice_number
    });

  } catch (error) {
    console.error('❌ Error approving invoice:', error);
    res.status(500).json({ error: 'Failed to approve invoice' });
  }
});

// PUT /api/invoices/:id/reject - Reject invoice
router.put('/:id/reject', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const result = await query(
      'UPDATE invoices SET processing_status = $1 WHERE id = $2 RETURNING invoice_number',
      ['rejected', id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    console.log(`❌ Invoice rejected: ${result.rows[0].invoice_number}`);

    res.json({ 
      message: 'Invoice rejected',
      invoice_number: result.rows[0].invoice_number,
      reason: reason || 'No reason provided'
    });

  } catch (error) {
    console.error('❌ Error rejecting invoice:', error);
    res.status(500).json({ error: 'Failed to reject invoice' });
  }
});

// GET /api/invoices/:id/file - Serve uploaded document file
router.get('/:id/file', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🔍 File request for invoice ID: ${id}`);
    
    // Check authentication (header or query parameter for iframe requests)
    const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
    if (!token) {
      return res.status(401).json({ error: 'Authentication token required' });
    }
    
    try {
      jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Get invoice file path
    const invoiceResult = await query(
      'SELECT file_path, file_type, original_filename FROM invoices WHERE id = $1',
      [id]
    );

    if (invoiceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const invoice = invoiceResult.rows[0];
    console.log(`📁 Invoice file path: ${invoice.file_path}`);
    
    if (!invoice.file_path) {
      console.log('❌ No file path found in database');
      return res.status(404).json({ error: 'Invoice file not found' });
    }

    // Extract filename from file_path (works for both local paths and S3 keys)
    const filename = path.basename(invoice.file_path);
    
    // Check if file exists using file service
    const fileExists = await fileService.fileExists(filename, 'invoices');
    if (!fileExists) {
      console.log(`❌ File does not exist: ${invoice.file_path}`);
      return res.status(404).json({ error: 'Invoice file no longer exists' });
    }
    console.log(`✅ File exists, serving: ${invoice.original_filename}`);

    // Get environment info
    const { environment } = fileService.getInfo();
    
    if (environment === 'production') {
      // Production: Redirect to CloudFront URL
      const fileUrl = fileService.getFileUrl(filename, 'invoices');
      console.log(`🌐 Redirecting to CloudFront: ${fileUrl}`);
      return res.redirect(fileUrl);
    } else {
      // Development: Serve file directly
      const filePath = invoice.file_path;
      
      // Set appropriate content type and allow iframe embedding
      if (invoice.file_type === 'PDF') {
        res.setHeader('Content-Type', 'application/pdf');
      } else if (invoice.file_type === 'HTML') {
        res.setHeader('Content-Type', 'text/html');
      }
      
      // Allow iframe embedding from frontend
      res.setHeader('X-Frame-Options', 'ALLOWALL');
      res.setHeader('Content-Security-Policy', 'frame-ancestors http://localhost:3000');
      res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');

      // Set filename for download
      res.setHeader('Content-Disposition', `inline; filename="${invoice.original_filename}"`);
      
      // Serve the file
      res.sendFile(path.resolve(filePath), (err) => {
        if (err) {
          console.error('❌ Error serving file:', err);
          res.status(500).json({ error: 'Failed to serve file' });
        }
      });
    }

  } catch (error) {
    console.error('❌ Error serving invoice file:', error);
    res.status(500).json({ error: 'Failed to serve invoice file' });
  }
});

// PUT /api/invoices/:id/update - Update invoice data after review
router.put('/:id/update', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { invoice_header, line_items } = req.body;

    const updatedInvoice = await transaction(async (client) => {
      // Update invoice header
      const updateInvoiceQuery = `
        UPDATE invoices SET 
          invoice_number = $1,
          customer_name = $2,
          invoice_date = $3,
          due_date = $4,
          issue_date = $5,
          currency = $6,
          amount_due = $7,
          total_amount = $8,
          subtotal = $9,
          total_taxes = $10,
          total_fees = $11,
          purchase_order_number = $12,
          payment_terms = $13,
          customer_account_number = $14,
          contact_email = $15,
          contact_phone = $16,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $17
        RETURNING *
      `;

      const invoiceResult = await client.query(updateInvoiceQuery, [
        invoice_header.invoice_number,
        invoice_header.customer_name,
        invoice_header.invoice_date,
        invoice_header.due_date,
        invoice_header.issue_date,
        invoice_header.currency || 'USD',
        invoice_header.amount_due,
        invoice_header.total_amount,
        invoice_header.subtotal,
        invoice_header.total_taxes,
        invoice_header.total_fees,
        invoice_header.purchase_order_number,
        invoice_header.payment_terms,
        invoice_header.customer_account_number,
        invoice_header.contact_email,
        invoice_header.contact_phone,
        id
      ]);

      if (invoiceResult.rows.length === 0) {
        throw new Error('Invoice not found');
      }

      // Delete existing line items
      await client.query('DELETE FROM line_items WHERE invoice_id = $1', [id]);

      // Insert updated line items
      if (line_items && line_items.length > 0) {
        for (const lineItem of line_items) {
          const lineItemQuery = `
            INSERT INTO line_items (
              invoice_id, line_number, description, category, charge_type,
              quantity, unit_of_measure, unit_price, subtotal, tax_amount, 
              fee_amount, total_amount, sku, product_code
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          `;

          await client.query(lineItemQuery, [
            id,
            lineItem.line_number || 1,
            lineItem.description,
            lineItem.category,
            lineItem.charge_type || 'one_time',
            lineItem.quantity || 1,
            lineItem.unit_of_measure,
            lineItem.unit_price,
            lineItem.subtotal,
            lineItem.tax_amount,
            lineItem.fee_amount,
            lineItem.total_amount,
            lineItem.sku,
            lineItem.product_code
          ]);
        }
      }

      return invoiceResult.rows[0];
    });

    console.log(`✅ Invoice updated: ${updatedInvoice.invoice_number}`);

    res.json({
      message: 'Invoice updated successfully',
      invoice: updatedInvoice
    });

  } catch (error) {
    console.error('❌ Error updating invoice:', error);
    if (error.message === 'Invoice not found') {
      res.status(404).json({ error: 'Invoice not found' });
    } else {
      res.status(500).json({ error: 'Failed to update invoice' });
    }
  }
});

// DELETE /api/invoices/:id - Permanently delete invoice and all related data
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🗑️ Permanently deleting invoice ID: ${id}`);

    // Get invoice file path before deletion
    const invoiceResult = await query(
      'SELECT file_path, invoice_number, original_filename FROM invoices WHERE id = $1',
      [id]
    );

    if (invoiceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const invoice = invoiceResult.rows[0];
    const filePath = invoice.file_path;

    // Delete from database (handle all foreign key dependencies)
    await transaction(async (client) => {
      // Delete line items first
      await client.query('DELETE FROM line_items WHERE invoice_id = $1', [id]);
      
      // Clear batch_files references (set invoice_id to NULL instead of deleting)
      await client.query('UPDATE batch_files SET invoice_id = NULL WHERE invoice_id = $1', [id]);
      
      // Delete invoice
      await client.query('DELETE FROM invoices WHERE id = $1', [id]);
      
      console.log(`🗄️ Deleted invoice ${invoice.invoice_number} from database`);
    });

    // Delete file from filesystem
    if (filePath) {
      try {
        await deleteFile(filePath);
        console.log(`📁 Deleted file: ${invoice.original_filename}`);
      } catch (fileError) {
        console.warn(`⚠️ Could not delete file ${filePath}:`, fileError.message);
        // Don't fail the request if file deletion fails
      }
    }

    res.json({ 
      message: 'Invoice permanently deleted',
      deleted_invoice: {
        id,
        invoice_number: invoice.invoice_number,
        original_filename: invoice.original_filename
      }
    });

  } catch (error) {
    console.error('❌ Error permanently deleting invoice:', error);
    
    // Provide more specific error information
    let errorMessage = 'Failed to delete invoice';
    if (error.code === '23503') {
      errorMessage = 'Cannot delete invoice: it is referenced by other records';
    } else if (error.code === '23505') {
      errorMessage = 'Cannot delete invoice: duplicate key constraint';
    }
    
    res.status(500).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;