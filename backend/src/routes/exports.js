const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const exportService = require('../services/exportService');

// GET /api/exports/templates - List all export templates
router.get('/templates', authenticateToken, async (req, res) => {
  try {
    const { include_admin = false } = req.query;
    
    let templatesQuery;
    let queryParams;
    
    // For admin users, optionally include all templates for management
    if (include_admin === 'true' && req.user?.role === 'admin') {
      templatesQuery = `
        SELECT 
          id,
          name,
          description,
          user_id,
          is_public,
          invoice_fields,
          line_item_fields,
          created_at,
          updated_at,
          (SELECT COUNT(*) FROM export_logs WHERE template_id = et.id) as usage_count
        FROM export_templates et
        ORDER BY is_public DESC, usage_count DESC, name ASC
      `;
      queryParams = [];
    } else {
      // Regular users see only public templates and their own
      templatesQuery = `
        SELECT 
          id,
          name,
          description,
          user_id,
          is_public,
          invoice_fields,
          line_item_fields,
          created_at,
          updated_at,
          (SELECT COUNT(*) FROM export_logs WHERE template_id = et.id) as usage_count
        FROM export_templates et
        WHERE is_public = true OR user_id = $1
        ORDER BY is_public DESC, usage_count DESC, name ASC
      `;
      queryParams = [req.user?.id];
    }
    
    const result = await query(templatesQuery, queryParams);
    
    res.json({
      success: true,
      templates: result.rows,
      isAdmin: req.user?.role === 'admin'
    });
  } catch (error) {
    console.error('Failed to fetch export templates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch export templates'
    });
  }
});

// POST /api/exports/templates - Create new export template
router.post('/templates', authenticateToken, async (req, res) => {
  try {
    const { name, description, invoice_fields, line_item_fields, is_public = false } = req.body;

    // Validation
    if (!name || !invoice_fields || !line_item_fields) {
      return res.status(400).json({
        success: false,
        error: 'Name, invoice_fields, and line_item_fields are required'
      });
    }

    // Validate field structures
    if (!Array.isArray(invoice_fields) || !Array.isArray(line_item_fields)) {
      return res.status(400).json({
        success: false,
        error: 'invoice_fields and line_item_fields must be arrays'
      });
    }

    // Ensure invoice_number is present in both field sets
    const hasInvoiceNumberInInvoices = invoice_fields.some(field => field.key === 'invoice_number');
    const hasInvoiceNumberInLineItems = line_item_fields.some(field => field.key === 'invoice_number');

    if (!hasInvoiceNumberInInvoices || !hasInvoiceNumberInLineItems) {
      return res.status(400).json({
        success: false,
        error: 'invoice_number field is required in both invoice and line item fields'
      });
    }

    const createQuery = `
      INSERT INTO export_templates 
      (name, description, user_id, is_public, invoice_fields, line_item_fields)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    
    const result = await query(createQuery, [
      name,
      description,
      req.user.id,
      is_public,
      JSON.stringify(invoice_fields),
      JSON.stringify(line_item_fields)
    ]);

    res.status(201).json({
      success: true,
      template: result.rows[0]
    });
  } catch (error) {
    console.error('Failed to create export template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create export template'
    });
  }
});

// PUT /api/exports/templates/:id - Update export template
router.put('/templates/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, invoice_fields, line_item_fields, is_public = false } = req.body;

    // Check if template exists and user has permission
    // Users can update templates they own OR public templates (system templates have user_id = NULL)
    const checkQuery = `
      SELECT * FROM export_templates 
      WHERE id = $1 AND (user_id = $2 OR (user_id IS NULL AND is_public = true))
    `;
    const existingTemplate = await query(checkQuery, [id, req.user.id]);

    if (existingTemplate.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Template not found or access denied'
      });
    }

    const updateQuery = `
      UPDATE export_templates 
      SET name = $1, description = $2, invoice_fields = $3, line_item_fields = $4, 
          is_public = $5, updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *
    `;
    
    const result = await query(updateQuery, [
      name,
      description,
      JSON.stringify(invoice_fields),
      JSON.stringify(line_item_fields),
      is_public,
      id
    ]);

    res.json({
      success: true,
      template: result.rows[0]
    });
  } catch (error) {
    console.error('Failed to update export template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update export template'
    });
  }
});

// DELETE /api/exports/templates/:id - Delete export template
router.delete('/templates/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if template exists and user has permission
    let checkQuery;
    let queryParams;
    
    if (req.user?.role === 'admin') {
      // Admins can delete any template
      checkQuery = `SELECT * FROM export_templates WHERE id = $1`;
      queryParams = [id];
    } else {
      // Regular users can only delete their own templates
      checkQuery = `SELECT * FROM export_templates WHERE id = $1 AND user_id = $2`;
      queryParams = [id, req.user.id];
    }
    
    const existingTemplate = await query(checkQuery, queryParams);

    if (existingTemplate.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Template not found or access denied'
      });
    }

    // Check if template is being used (prevent deletion of heavily used templates)
    const usageQuery = `SELECT COUNT(*) as usage_count FROM export_logs WHERE template_id = $1`;
    const usageResult = await query(usageQuery, [id]);
    const usageCount = parseInt(usageResult.rows[0].usage_count);

    if (usageCount > 50 && req.user?.role !== 'admin') {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete template with high usage. Contact admin for assistance.'
      });
    }

    const deleteQuery = `DELETE FROM export_templates WHERE id = $1`;
    await query(deleteQuery, [id]);

    res.json({
      success: true,
      message: 'Template deleted successfully'
    });
  } catch (error) {
    console.error('Failed to delete export template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete export template'
    });
  }
});

// GET /api/exports/fields - Get available field definitions
router.get('/fields', authenticateToken, async (req, res) => {
  try {
    const availableFields = {
      invoice: [
        // Core identification
        { key: 'invoice_number', label: 'Invoice #', type: 'string', width: 15, required: true },
        { key: 'vendor_id', label: 'Vendor ID', type: 'string', width: 20 },
        { key: 'vendor_name', label: 'Vendor Name', type: 'string', width: 25 },
        { key: 'customer_id', label: 'Customer ID', type: 'string', width: 20 },
        { key: 'customer_name', label: 'Customer Name', type: 'string', width: 25 },
        { key: 'customer_account_number', label: 'Account Number', type: 'string', width: 15 },
        
        // Dates
        { key: 'invoice_date', label: 'Invoice Date', type: 'date', width: 12 },
        { key: 'due_date', label: 'Due Date', type: 'date', width: 12 },
        { key: 'issue_date', label: 'Issue Date', type: 'date', width: 12 },
        { key: 'service_period_start', label: 'Service Start', type: 'date', width: 12 },
        { key: 'service_period_end', label: 'Service End', type: 'date', width: 12 },
        
        // Financial totals
        { key: 'currency', label: 'Currency', type: 'string', width: 8 },
        { key: 'amount_due', label: 'Amount Due', type: 'currency', width: 12 },
        { key: 'total_amount', label: 'Total Amount', type: 'currency', width: 12 },
        { key: 'subtotal', label: 'Subtotal', type: 'currency', width: 12 },
        { key: 'total_taxes', label: 'Total Taxes', type: 'currency', width: 12 },
        { key: 'total_fees', label: 'Total Fees', type: 'currency', width: 12 },
        { key: 'total_recurring', label: 'Recurring Charges', type: 'currency', width: 12 },
        { key: 'total_one_time', label: 'One-Time Charges', type: 'currency', width: 12 },
        { key: 'total_usage', label: 'Usage Charges', type: 'currency', width: 12 },
        
        // Order details
        { key: 'line_item_count', label: 'Line Items Count', type: 'number', width: 10 },
        { key: 'purchase_order_number', label: 'PO Number', type: 'string', width: 20 },
        { key: 'payment_terms', label: 'Payment Terms', type: 'string', width: 15 },
        { key: 'contact_email', label: 'Contact Email', type: 'string', width: 25 },
        { key: 'contact_phone', label: 'Contact Phone', type: 'string', width: 15 },
        
        // Processing details
        { key: 'processing_status', label: 'Status', type: 'string', width: 12 },
        { key: 'confidence_score', label: 'AI Confidence', type: 'percentage', width: 12 },
        { key: 'file_type', label: 'File Type', type: 'string', width: 10 },
        { key: 'original_filename', label: 'Original Filename', type: 'string', width: 30 },
        { key: 'processed_at', label: 'Processed At', type: 'datetime', width: 18 },
        { key: 'approved_at', label: 'Approved At', type: 'datetime', width: 18 },
        { key: 'is_duplicate', label: 'Is Duplicate', type: 'string', width: 12 },
        
        // Timestamps & batch
        { key: 'created_at', label: 'Created At', type: 'datetime', width: 18 },
        { key: 'updated_at', label: 'Updated At', type: 'datetime', width: 18 },
        { key: 'batch_name', label: 'Batch Name', type: 'string', width: 20 }
      ],
      line_item: [
        // Core identification
        { key: 'invoice_number', label: 'Invoice #', type: 'string', width: 15, required: true },
        { key: 'line_number', label: 'Line #', type: 'number', width: 8 },
        
        // Product details
        { key: 'description', label: 'Description', type: 'string', width: 40 },
        { key: 'category', label: 'Category', type: 'string', width: 20 },
        { key: 'charge_type', label: 'Charge Type', type: 'string', width: 15 },
        { key: 'sku', label: 'SKU', type: 'string', width: 15 },
        { key: 'product_code', label: 'Product Code', type: 'string', width: 15 },
        
        // Service periods
        { key: 'service_period_start', label: 'Service Start', type: 'date', width: 12 },
        { key: 'service_period_end', label: 'Service End', type: 'date', width: 12 },
        
        // Quantities and pricing
        { key: 'quantity', label: 'Quantity', type: 'number', width: 10 },
        { key: 'unit_of_measure', label: 'Unit of Measure', type: 'string', width: 10 },
        { key: 'unit_price', label: 'Unit Price', type: 'currency', width: 12 },
        
        // Financial amounts
        { key: 'subtotal', label: 'Subtotal', type: 'currency', width: 12 },
        { key: 'tax_amount', label: 'Tax Amount', type: 'currency', width: 12 },
        { key: 'fee_amount', label: 'Fee Amount', type: 'currency', width: 12 },
        { key: 'total_amount', label: 'Line Total', type: 'currency', width: 12 },
        
        // Timestamps
        { key: 'created_at', label: 'Created At', type: 'datetime', width: 18 },
        { key: 'updated_at', label: 'Updated At', type: 'datetime', width: 18 }
      ]
    };

    res.json({
      success: true,
      fields: availableFields
    });
  } catch (error) {
    console.error('Failed to fetch available fields:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch available fields'
    });
  }
});

// POST /api/exports/generate - Generate export file
router.post('/generate', authenticateToken, async (req, res) => {
  try {
    const { template_id, template, filters = {}, format = 'xlsx' } = req.body;

    // Validate inputs - either template_id or template object is required
    if (!template_id && !template) {
      return res.status(400).json({
        success: false,
        error: 'Either template_id or template object is required'
      });
    }

    if (!['xlsx', 'csv'].includes(format)) {
      return res.status(400).json({
        success: false,
        error: 'Format must be either "xlsx" or "csv"'
      });
    }

    let templateToUse;

    if (template && template.invoice_fields && template.line_item_fields) {
      // Use the template object directly (current field selections)
      templateToUse = template;
    } else if (template_id) {
      // Fetch template from database (backward compatibility)
      const templateQuery = `
        SELECT * FROM export_templates 
        WHERE id = $1 AND (is_public = true OR user_id = $2)
      `;
      const templateResult = await query(templateQuery, [template_id, req.user.id]);

      if (templateResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Template not found or access denied'
        });
      }

      templateToUse = templateResult.rows[0];
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid template data provided'
      });
    }

    // Clean up old temp files before generating new export
    exportService.cleanupTempFiles();

    // Generate export
    const exportResult = await exportService.generateExport(filters, templateToUse, format);

    // Set appropriate headers for file download
    res.setHeader('Content-Disposition', `attachment; filename="${exportResult.filename}"`);
    res.setHeader('Content-Type', exportResult.contentType);
    res.setHeader('Content-Length', exportResult.fileSize);

    // Stream file to response
    const fileStream = fs.createReadStream(exportResult.filepath);
    
    fileStream.on('end', () => {
      // Clean up the file after sending
      setTimeout(() => {
        try {
          fs.unlinkSync(exportResult.filepath);
        } catch (error) {
          console.warn('Failed to clean up export file:', error);
        }
      }, 5000); // 5 second delay to ensure download completes
    });

    fileStream.pipe(res);

  } catch (error) {
    console.error('Export generation failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Export generation failed'
    });
  }
});

// GET /api/exports/preview/:id - Preview template configuration
router.get('/preview/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const templateQuery = `
      SELECT * FROM export_templates 
      WHERE id = $1 AND (is_public = true OR user_id = $2)
    `;
    const result = await query(templateQuery, [id, req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Template not found or access denied'
      });
    }

    const template = result.rows[0];
    
    res.json({
      success: true,
      template: {
        ...template,
        preview: {
          invoice_field_count: template.invoice_fields.length,
          line_item_field_count: template.line_item_fields.length,
          estimated_columns_xlsx: template.invoice_fields.length + template.line_item_fields.length
        }
      }
    });
  } catch (error) {
    console.error('Failed to preview template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to preview template'
    });
  }
});

// POST /api/exports/validate - Validate template configuration
router.post('/validate', authenticateToken, async (req, res) => {
  try {
    const { invoice_fields, line_item_fields } = req.body;

    const validation = {
      success: true,
      errors: [],
      warnings: []
    };

    // Check if invoice_fields is valid
    if (!Array.isArray(invoice_fields)) {
      validation.errors.push('invoice_fields must be an array');
    } else {
      const hasInvoiceNumber = invoice_fields.some(field => field.key === 'invoice_number');
      if (!hasInvoiceNumber) {
        validation.errors.push('invoice_number field is required in invoice_fields');
      }
    }

    // Check if line_item_fields is valid
    if (!Array.isArray(line_item_fields)) {
      validation.errors.push('line_item_fields must be an array');
    } else {
      const hasInvoiceNumber = line_item_fields.some(field => field.key === 'invoice_number');
      if (!hasInvoiceNumber) {
        validation.errors.push('invoice_number field is required in line_item_fields');
      }
    }

    // Check for potential performance issues
    if (invoice_fields.length > 20) {
      validation.warnings.push('Large number of invoice fields may impact performance');
    }

    if (line_item_fields.length > 15) {
      validation.warnings.push('Large number of line item fields may impact performance');
    }

    validation.success = validation.errors.length === 0;

    res.json({
      success: true,
      validation
    });
  } catch (error) {
    console.error('Template validation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Template validation failed'
    });
  }
});

// GET /api/exports/recent - Get recent export history for user
router.get('/recent', authenticateToken, async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const recentQuery = `
      SELECT 
        el.*,
        et.name as template_name,
        et.description as template_description
      FROM export_logs el
      LEFT JOIN export_templates et ON el.template_id = et.id
      WHERE el.user_id = $1
      ORDER BY el.created_at DESC
      LIMIT $2
    `;

    const result = await query(recentQuery, [req.user.id, parseInt(limit)]);

    res.json({
      success: true,
      exports: result.rows
    });
  } catch (error) {
    console.error('Failed to fetch recent exports:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recent exports'
    });
  }
});

// GET /api/exports/stats - Export usage statistics (for future analytics)
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_exports,
        SUM(invoice_count) as total_invoices_exported,
        SUM(line_item_count) as total_line_items_exported,
        AVG(processing_time_ms) as avg_processing_time,
        export_format,
        DATE_TRUNC('day', created_at) as export_date
      FROM export_logs
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY export_format, DATE_TRUNC('day', created_at)
      ORDER BY export_date DESC
    `;

    const result = await query(statsQuery);

    res.json({
      success: true,
      stats: result.rows
    });
  } catch (error) {
    console.error('Failed to fetch export stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch export statistics'
    });
  }
});

module.exports = router;