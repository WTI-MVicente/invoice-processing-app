const XLSX = require('xlsx');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const archiver = require('archiver');
const fs = require('fs');
const path = require('path');
const { query } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class ExportService {
  constructor() {
    this.tempDir = path.join(__dirname, '../../temp');
    this.ensureTempDirectory();
  }

  ensureTempDirectory() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Generate dual export (invoices + line items) based on template and format
   */
  async generateExport(filters = {}, template, format = 'xlsx') {
    const startTime = Date.now();
    
    try {
      console.log(`🚀 Starting ${format.toUpperCase()} export with template: ${template.name}`);
      
      // Get estimated count for performance decision
      const estimatedCount = await this.getEstimatedInvoiceCount(filters);
      console.log(`📊 Estimated invoice count: ${estimatedCount}`);
      
      // Choose processing strategy based on dataset size
      const useStreamingApproach = estimatedCount > 1000;
      
      let exportResult;
      if (useStreamingApproach) {
        console.log('📊 Large dataset detected - using streaming approach');
        exportResult = await this.generateStreamingExport(filters, template, format);
      } else {
        console.log('📊 Standard dataset - using memory approach');
        exportResult = await this.generateStandardExport(filters, template, format);
      }

      // Log export activity
      const processingTime = Date.now() - startTime;
      await this.logExportActivity(template, format, exportResult.invoiceCount, exportResult.lineItemCount, exportResult.fileSize, filters, processingTime);

      return {
        ...exportResult,
        processingTime
      };

    } catch (error) {
      console.error('❌ Export generation failed:', error);
      throw error;
    }
  }

  /**
   * Standard export for smaller datasets (< 1000 invoices)
   */
  async generateStandardExport(filters, template, format) {
    // Build and execute queries
    const invoiceData = await this.buildInvoiceQuery(filters, template.invoice_fields);
    const invoiceIds = invoiceData.map(invoice => invoice.id);
    const lineItemData = await this.buildLineItemQuery(invoiceIds, template.line_item_fields);

    console.log(`📊 Found ${invoiceData.length} invoices, ${lineItemData.length} line items`);

    // Generate export based on format
    let exportResult;
    if (format === 'xlsx') {
      exportResult = await this.generateXLSXWorkbook(invoiceData, lineItemData, template);
    } else if (format === 'csv') {
      exportResult = await this.generateDualCSV(invoiceData, lineItemData, template);
    } else {
      throw new Error(`Unsupported export format: ${format}`);
    }

    return {
      ...exportResult,
      invoiceCount: invoiceData.length,
      lineItemCount: lineItemData.length
    };
  }

  /**
   * Streaming export for large datasets (>= 1000 invoices)
   */
  async generateStreamingExport(filters, template, format) {
    const chunkSize = 500; // Process in chunks of 500 invoices
    let totalInvoices = 0;
    let totalLineItems = 0;
    
    // Get total count first
    const totalCount = await this.getActualInvoiceCount(filters);
    console.log(`📊 Processing ${totalCount} invoices in chunks of ${chunkSize}`);
    
    if (format === 'xlsx') {
      return await this.generateStreamingXLSX(filters, template, chunkSize, totalCount);
    } else if (format === 'csv') {
      return await this.generateStreamingCSV(filters, template, chunkSize, totalCount);
    } else {
      throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Get estimated invoice count for performance decisions
   */
  async getEstimatedInvoiceCount(filters) {
    try {
      const countQuery = `
        SELECT COUNT(DISTINCT i.id) as count
        FROM invoices i
        LEFT JOIN vendors v ON i.vendor_id = v.id
        LEFT JOIN customers c ON i.customer_id = c.id
        LEFT JOIN batch_files bf ON i.id = bf.invoice_id
        LEFT JOIN processing_batches pb ON bf.batch_id = pb.id
        ${this.buildWhereClause(filters)}
      `;
      
      const { whereClause, params } = this.buildFilterParams(filters);
      const result = await query(countQuery.replace('${this.buildWhereClause(filters)}', whereClause), params);
      
      return parseInt(result.rows[0].count) || 0;
    } catch (error) {
      console.warn('Failed to get estimated count, defaulting to standard approach:', error);
      return 0;
    }
  }

  /**
   * Get actual invoice count
   */
  async getActualInvoiceCount(filters) {
    return await this.getEstimatedInvoiceCount(filters);
  }

  /**
   * Build filter parameters for reuse
   */
  buildFilterParams(filters) {
    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (filters.vendor_id) {
      whereClause += ` AND i.vendor_id = $${paramCount}`;
      params.push(filters.vendor_id);
      paramCount++;
    }

    if (filters.customer_id) {
      whereClause += ` AND i.customer_id = $${paramCount}`;
      params.push(filters.customer_id);
      paramCount++;
    }

    if (filters.status) {
      whereClause += ` AND i.processing_status = $${paramCount}`;
      params.push(filters.status);
      paramCount++;
    }

    if (filters.batch_name) {
      whereClause += ` AND pb.name = $${paramCount}`;
      params.push(filters.batch_name);
      paramCount++;
    }

    if (filters.search) {
      whereClause += ` AND (
        i.invoice_number ILIKE $${paramCount} OR 
        COALESCE(c.name, i.customer_name) ILIKE $${paramCount} OR 
        i.purchase_order_number ILIKE $${paramCount}
      )`;
      params.push(`%${filters.search}%`);
      paramCount++;
    }

    if (filters.start_date) {
      whereClause += ` AND i.invoice_date >= $${paramCount}`;
      params.push(filters.start_date);
      paramCount++;
    }

    if (filters.end_date) {
      whereClause += ` AND i.invoice_date <= $${paramCount}`;
      params.push(filters.end_date);
      paramCount++;
    }

    return { whereClause, params };
  }

  /**
   * Build invoice query with filters and field selection
   */
  async buildInvoiceQuery(filters, invoiceFields) {
    const fieldKeys = invoiceFields.map(field => field.key);
    
    // Base query - reuse existing filter logic from invoices route
    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramCount = 1;

    // Apply filters (reusing logic from routes/invoices.js)
    if (filters.vendor_id) {
      whereClause += ` AND i.vendor_id = $${paramCount}`;
      params.push(filters.vendor_id);
      paramCount++;
    }

    if (filters.customer_id) {
      whereClause += ` AND i.customer_id = $${paramCount}`;
      params.push(filters.customer_id);
      paramCount++;
    }

    if (filters.status) {
      whereClause += ` AND i.processing_status = $${paramCount}`;
      params.push(filters.status);
      paramCount++;
    }

    if (filters.batch_name) {
      whereClause += ` AND pb.name = $${paramCount}`;
      params.push(filters.batch_name);
      paramCount++;
    }

    if (filters.search) {
      whereClause += ` AND (
        i.invoice_number ILIKE $${paramCount} OR 
        COALESCE(c.name, i.customer_name) ILIKE $${paramCount} OR 
        i.purchase_order_number ILIKE $${paramCount}
      )`;
      params.push(`%${filters.search}%`);
      paramCount++;
    }

    if (filters.start_date) {
      whereClause += ` AND i.invoice_date >= $${paramCount}`;
      params.push(filters.start_date);
      paramCount++;
    }

    if (filters.end_date) {
      whereClause += ` AND i.invoice_date <= $${paramCount}`;
      params.push(filters.end_date);
      paramCount++;
    }

    // Build SELECT clause based on requested fields
    const selectFields = this.buildSelectFields(fieldKeys, 'invoice');

    const invoiceQuery = `
      SELECT ${selectFields}
      FROM invoices i
      LEFT JOIN vendors v ON i.vendor_id = v.id
      LEFT JOIN customers c ON i.customer_id = c.id
      LEFT JOIN batch_files bf ON i.id = bf.invoice_id
      LEFT JOIN processing_batches pb ON bf.batch_id = pb.id
      ${whereClause}
      GROUP BY i.id, v.name, v.display_name, c.name, i.customer_name, pb.id, pb.created_at, pb.name
      ORDER BY i.created_at DESC
    `;

    const result = await query(invoiceQuery, params);
    return result.rows;
  }

  /**
   * Build line item query for given invoice IDs
   */
  async buildLineItemQuery(invoiceIds, lineItemFields) {
    if (invoiceIds.length === 0) {
      return [];
    }

    const fieldKeys = lineItemFields.map(field => field.key);
    const selectFields = this.buildSelectFields(fieldKeys, 'line_item');

    // Create parameter placeholders for invoice IDs
    const placeholders = invoiceIds.map((_, index) => `$${index + 1}`).join(',');

    const lineItemQuery = `
      SELECT ${selectFields}
      FROM line_items li
      LEFT JOIN invoices i ON li.invoice_id = i.id
      WHERE li.invoice_id IN (${placeholders})
      ORDER BY i.invoice_number, li.line_number
    `;

    const result = await query(lineItemQuery, invoiceIds);
    return result.rows;
  }

  /**
   * Build SELECT fields clause based on field configuration and data type
   */
  buildSelectFields(fieldKeys, dataType) {
    const fieldMappings = {
      invoice: {
        'invoice_number': 'i.invoice_number',
        'vendor_name': 'COALESCE(v.display_name, v.name)',
        'vendor_id': 'i.vendor_id',
        'customer_name': 'COALESCE(c.name, i.customer_name)',
        'customer_id': 'i.customer_id',
        'invoice_date': 'i.invoice_date',
        'due_date': 'i.due_date',
        'total_amount': 'i.total_amount',
        'tax_amount': 'i.tax_amount',
        'processing_status': 'i.processing_status',
        'confidence_score': 'i.confidence_score',
        'purchase_order_number': 'i.purchase_order_number',
        'created_at': 'i.created_at',
        'updated_at': 'i.updated_at',
        'batch_name': 'pb.name as batch_name',
        'id': 'i.id'
      },
      line_item: {
        'invoice_number': 'i.invoice_number',
        'line_number': 'li.line_number',
        'description': 'li.description',
        'quantity': 'li.quantity',
        'unit_price': 'li.unit_price',
        'line_total': 'li.line_total',
        'product_code': 'li.product_code',
        'category': 'li.category',
        'notes': 'li.notes',
        'invoice_id': 'li.invoice_id',
        'id': 'li.id'
      }
    };

    const mappings = fieldMappings[dataType];
    const selectedFields = fieldKeys
      .filter(key => mappings[key])
      .map(key => mappings[key]);

    return selectedFields.length > 0 ? selectedFields.join(', ') : '*';
  }

  /**
   * Generate XLSX workbook with invoices and line items sheets
   */
  async generateXLSXWorkbook(invoiceData, lineItemData, template) {
    try {
      // Create workbook
      const workbook = XLSX.utils.book_new();

      // Create Invoices worksheet
      const invoiceHeaders = template.invoice_fields.map(field => field.label);
      const invoiceRows = invoiceData.map(invoice => 
        template.invoice_fields.map(field => this.formatFieldValue(invoice[field.key], field.type))
      );
      
      const invoiceWS = XLSX.utils.aoa_to_sheet([invoiceHeaders, ...invoiceRows]);
      
      // Set column widths
      invoiceWS['!cols'] = template.invoice_fields.map(field => ({ width: field.width || 15 }));
      
      XLSX.utils.book_append_sheet(workbook, invoiceWS, 'Invoices');

      // Create Line Items worksheet
      const lineItemHeaders = template.line_item_fields.map(field => field.label);
      const lineItemRows = lineItemData.map(lineItem => 
        template.line_item_fields.map(field => this.formatFieldValue(lineItem[field.key], field.type))
      );
      
      const lineItemWS = XLSX.utils.aoa_to_sheet([lineItemHeaders, ...lineItemRows]);
      
      // Set column widths
      lineItemWS['!cols'] = template.line_item_fields.map(field => ({ width: field.width || 15 }));
      
      XLSX.utils.book_append_sheet(workbook, lineItemWS, 'Line Items');

      // Generate filename and write file
      const filename = `export_${template.name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.xlsx`;
      const filepath = path.join(this.tempDir, filename);
      
      XLSX.writeFile(workbook, filepath);

      const stats = fs.statSync(filepath);
      
      return {
        filename,
        filepath,
        fileSize: stats.size,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      };

    } catch (error) {
      console.error('❌ XLSX generation failed:', error);
      throw new Error(`XLSX generation failed: ${error.message}`);
    }
  }

  /**
   * Generate dual CSV files and ZIP them
   */
  async generateDualCSV(invoiceData, lineItemData, template) {
    try {
      const timestamp = Date.now();
      const baseFilename = `export_${template.name.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}`;
      
      // Generate invoices CSV
      const invoicesFilename = `${baseFilename}_invoices.csv`;
      const invoicesPath = path.join(this.tempDir, invoicesFilename);
      
      const invoiceCsvWriter = createCsvWriter({
        path: invoicesPath,
        header: template.invoice_fields.map(field => ({
          id: field.key,
          title: field.label
        }))
      });

      const formattedInvoiceData = invoiceData.map(invoice => {
        const row = {};
        template.invoice_fields.forEach(field => {
          row[field.key] = this.formatFieldValue(invoice[field.key], field.type);
        });
        return row;
      });

      await invoiceCsvWriter.writeRecords(formattedInvoiceData);

      // Generate line items CSV
      const lineItemsFilename = `${baseFilename}_line_items.csv`;
      const lineItemsPath = path.join(this.tempDir, lineItemsFilename);
      
      const lineItemCsvWriter = createCsvWriter({
        path: lineItemsPath,
        header: template.line_item_fields.map(field => ({
          id: field.key,
          title: field.label
        }))
      });

      const formattedLineItemData = lineItemData.map(lineItem => {
        const row = {};
        template.line_item_fields.forEach(field => {
          row[field.key] = this.formatFieldValue(lineItem[field.key], field.type);
        });
        return row;
      });

      await lineItemCsvWriter.writeRecords(formattedLineItemData);

      // Create ZIP archive
      const zipFilename = `${baseFilename}.zip`;
      const zipPath = path.join(this.tempDir, zipFilename);
      
      await this.createZipArchive([
        { path: invoicesPath, name: 'invoices.csv' },
        { path: lineItemsPath, name: 'line_items.csv' }
      ], zipPath);

      // Clean up individual CSV files
      fs.unlinkSync(invoicesPath);
      fs.unlinkSync(lineItemsPath);

      const stats = fs.statSync(zipPath);
      
      return {
        filename: zipFilename,
        filepath: zipPath,
        fileSize: stats.size,
        contentType: 'application/zip'
      };

    } catch (error) {
      console.error('❌ CSV generation failed:', error);
      throw new Error(`CSV generation failed: ${error.message}`);
    }
  }

  /**
   * Create ZIP archive from multiple files
   */
  createZipArchive(files, outputPath) {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outputPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', resolve);
      archive.on('error', reject);

      archive.pipe(output);

      files.forEach(file => {
        archive.file(file.path, { name: file.name });
      });

      archive.finalize();
    });
  }

  /**
   * Format field value based on type
   */
  formatFieldValue(value, type) {
    if (value == null) return '';

    switch (type) {
      case 'currency':
        return typeof value === 'number' ? value.toFixed(2) : value;
      case 'number':
        return typeof value === 'number' ? value : parseFloat(value) || 0;
      case 'percentage':
        return typeof value === 'number' ? (value * 100).toFixed(1) + '%' : value;
      case 'date':
        return value instanceof Date ? value.toISOString().split('T')[0] : value;
      case 'datetime':
        return value instanceof Date ? value.toISOString() : value;
      default:
        return String(value);
    }
  }

  /**
   * Log export activity for analytics and auditing
   */
  async logExportActivity(template, format, invoiceCount, lineItemCount, fileSize, filters, processingTime, success = true, errorMessage = null) {
    try {
      const logQuery = `
        INSERT INTO export_logs 
        (template_id, export_format, invoice_count, line_item_count, file_size, filters_applied, processing_time_ms, success, error_message, user_agent, ip_address)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `;
      
      // Extract additional context (would be passed from route handler)
      const userAgent = this.currentRequest?.get('user-agent') || 'Unknown';
      const ipAddress = this.currentRequest?.ip || 'Unknown';
      
      await query(logQuery, [
        template.id,
        format,
        invoiceCount,
        lineItemCount,
        fileSize,
        JSON.stringify({
          ...filters,
          fieldCounts: {
            invoiceFields: template.invoice_fields?.length || 0,
            lineItemFields: template.line_item_fields?.length || 0
          }
        }),
        processingTime,
        success,
        errorMessage,
        userAgent,
        ipAddress
      ]);
      
      const statusText = success ? 'completed' : 'failed';
      console.log(`📝 Export activity logged (${statusText}): ${invoiceCount} invoices, ${lineItemCount} line items, ${processingTime}ms`);
      
      // Update template usage analytics
      if (success) {
        await this.updateTemplateAnalytics(template.id);
      }
      
    } catch (error) {
      console.error('⚠️ Failed to log export activity:', error);
      // Don't throw - logging failure shouldn't break export
    }
  }

  /**
   * Update template usage analytics
   */
  async updateTemplateAnalytics(templateId) {
    try {
      const analyticsQuery = `
        UPDATE export_templates 
        SET 
          last_used_at = CURRENT_TIMESTAMP,
          usage_count = COALESCE(usage_count, 0) + 1
        WHERE id = $1
      `;
      
      await query(analyticsQuery, [templateId]);
    } catch (error) {
      console.error('⚠️ Failed to update template analytics:', error);
    }
  }

  /**
   * Set current request context for logging
   */
  setRequestContext(req) {
    this.currentRequest = req;
  }

  /**
   * Clean up temporary files older than 1 hour
   */
  cleanupTempFiles() {
    try {
      const files = fs.readdirSync(this.tempDir);
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      
      files.forEach(file => {
        const filePath = path.join(this.tempDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtimeMs < oneHourAgo) {
          fs.unlinkSync(filePath);
          console.log(`🧹 Cleaned up old temp file: ${file}`);
        }
      });
    } catch (error) {
      console.error('⚠️ Temp file cleanup failed:', error);
    }
  }

  /**
   * Validate export data integrity
   */
  validateExportData(invoiceData, lineItemData) {
    const invoiceIds = new Set(invoiceData.map(inv => inv.id));
    const lineItemInvoiceIds = new Set(lineItemData.map(li => li.invoice_id));
    
    // Check for orphaned line items
    const orphanedLineItems = [...lineItemInvoiceIds].filter(id => !invoiceIds.has(id));
    if (orphanedLineItems.length > 0) {
      console.warn(`⚠️ Found ${orphanedLineItems.length} orphaned line items`);
    }
    
    return {
      isValid: orphanedLineItems.length === 0,
      orphanedLineItems,
      invoiceCount: invoiceData.length,
      lineItemCount: lineItemData.length
    };
  }
}

module.exports = new ExportService();