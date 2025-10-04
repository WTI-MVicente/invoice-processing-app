const express = require('express');
const path = require('path');
const { query, transaction } = require('../config/database');
const { uploadSingle, uploadMultiple, getFileType, readFileContent, deleteFile } = require('../middleware/upload');
const claudeService = require('../services/claudeService');

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

    const invoicesQuery = `
      SELECT 
        i.*,
        v.name as vendor_name,
        v.display_name as vendor_display_name,
        c.name as customer_name,
        COUNT(li.id) as line_item_count
      FROM invoices i
      LEFT JOIN vendors v ON i.vendor_id = v.id
      LEFT JOIN customers c ON i.customer_id = c.id
      LEFT JOIN line_items li ON i.id = li.invoice_id
      ${whereClause}
      GROUP BY i.id, v.name, v.display_name, c.name
      ORDER BY i.created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    params.push(parseInt(limit), parseInt(offset));

    const result = await query(invoicesQuery, params);

    res.json({
      invoices: result.rows,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: result.rows.length
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

    // Get vendor's extraction prompt
    let extractionPrompt = 'Use the default extraction prompt.'; // Default fallback
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
        c.name as customer_name
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

module.exports = router;