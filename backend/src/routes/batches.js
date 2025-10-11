const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { authenticateToken } = require('../middleware/auth');
const batchProcessingService = require('../services/batchProcessingService');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Configure multer for batch file uploads
const batchStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const vendorName = req.body.vendor_name || 'unknown';
    const uploadPath = path.join(__dirname, '../../uploads/batches', vendorName);
    
    // Create directory if it doesn't exist
    fs.mkdir(uploadPath, { recursive: true })
      .then(() => cb(null, uploadPath))
      .catch(err => cb(err));
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}_${timestamp}${ext}`);
  }
});

const upload = multer({
  storage: batchStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.html'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${ext}. Only PDF and HTML files are allowed.`));
    }
  }
});

// GET /api/batches - Get all processing batches with pagination
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, vendor_id, status } = req.query;
    const offset = (page - 1) * limit;
    
    let whereClause = '';
    const queryParams = [];
    
    if (vendor_id) {
      whereClause += ' WHERE pb.vendor_id = $' + (queryParams.length + 1);
      queryParams.push(vendor_id);
    }
    
    if (status) {
      const condition = vendor_id ? ' AND ' : ' WHERE ';
      whereClause += condition + 'pb.status = $' + (queryParams.length + 1);
      queryParams.push(status);
    }
    
    const batchesQuery = `
      SELECT 
        pb.*,
        v.name as vendor_name,
        v.display_name as vendor_display_name,
        COUNT(bf.id) as total_file_count,
        COUNT(CASE WHEN bf.status = 'processed' THEN 1 END) as processed_count,
        COUNT(CASE WHEN bf.status = 'failed' THEN 1 END) as failed_count
      FROM processing_batches pb
      LEFT JOIN vendors v ON pb.vendor_id = v.id
      LEFT JOIN batch_files bf ON pb.id = bf.batch_id
      ${whereClause}
      GROUP BY pb.id, v.name, v.display_name
      ORDER BY pb.created_at DESC
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `;
    
    queryParams.push(limit, offset);
    
    const countQuery = `
      SELECT COUNT(DISTINCT pb.id) as total
      FROM processing_batches pb
      LEFT JOIN vendors v ON pb.vendor_id = v.id
      ${whereClause}
    `;
    
    const [batchesResult, countResult] = await Promise.all([
      pool.query(batchesQuery, queryParams),
      pool.query(countQuery, queryParams.slice(0, -2)) // Remove limit and offset for count
    ]);
    
    res.json({
      batches: batchesResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        pages: Math.ceil(countResult.rows[0].total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching batches:', error);
    res.status(500).json({ error: 'Failed to fetch batches' });
  }
});

// GET /api/batches/names - Get unique batch names for filtering
router.get('/names', authenticateToken, async (req, res) => {
  try {
    // Get completed batches with generated names
    const batchQuery = `
      SELECT DISTINCT 
        CONCAT('Batch-', EXTRACT(YEAR FROM pb.created_at), '-', EXTRACT(MONTH FROM pb.created_at), '-', EXTRACT(DAY FROM pb.created_at), '-', RIGHT(pb.id::text, 8)) as name
      FROM processing_batches pb
      WHERE pb.status IN ('completed', 'partial', 'processing')
      ORDER BY name DESC
    `;
    
    const batchResult = await pool.query(batchQuery);
    
    // Always include "Single Upload" option for regular invoices
    const batchNames = [{ name: 'Single Upload' }, ...batchResult.rows];
    
    res.json({
      batches: batchNames
    });
  } catch (error) {
    console.error('Error fetching batch names:', error);
    res.status(500).json({ error: 'Failed to fetch batch names' });
  }
});

// GET /api/batches/:id - Get specific batch with files
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get batch info
    const batchQuery = `
      SELECT 
        pb.*,
        v.name as vendor_name,
        v.display_name as vendor_display_name
      FROM processing_batches pb
      LEFT JOIN vendors v ON pb.vendor_id = v.id
      WHERE pb.id = $1
    `;
    
    // Get batch files
    const filesQuery = `
      SELECT 
        bf.*,
        i.invoice_number,
        i.customer_name,
        i.total_amount
      FROM batch_files bf
      LEFT JOIN invoices i ON bf.invoice_id = i.id
      WHERE bf.batch_id = $1
      ORDER BY bf.created_at ASC
    `;
    
    const [batchResult, filesResult] = await Promise.all([
      pool.query(batchQuery, [id]),
      pool.query(filesQuery, [id])
    ]);
    
    if (batchResult.rows.length === 0) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    
    res.json({
      batch: batchResult.rows[0],
      files: filesResult.rows
    });
  } catch (error) {
    console.error('Error fetching batch:', error);
    res.status(500).json({ error: 'Failed to fetch batch' });
  }
});

// POST /api/batches/init - Initialize new batch
router.post('/init', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { vendor_id, folder_path } = req.body;
    
    if (!vendor_id) {
      return res.status(400).json({ error: 'vendor_id is required' });
    }
    
    // Verify vendor exists
    const vendorResult = await client.query('SELECT * FROM vendors WHERE id = $1', [vendor_id]);
    if (vendorResult.rows.length === 0) {
      return res.status(404).json({ error: 'Vendor not found' });
    }
    
    // Create batch record
    const batchResult = await client.query(`
      INSERT INTO processing_batches (vendor_id, folder_path, total_files, status)
      VALUES ($1, $2, 0, 'pending')
      RETURNING *
    `, [vendor_id, folder_path]);
    
    await client.query('COMMIT');
    
    res.status(201).json({
      batch: batchResult.rows[0],
      message: 'Batch initialized successfully'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error initializing batch:', error);
    res.status(500).json({ error: 'Failed to initialize batch' });
  } finally {
    client.release();
  }
});

// POST /api/batches/:id/files - Add files to batch
router.post('/:id/files', authenticateToken, upload.array('files'), async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id: batchId } = req.params;
    const files = req.files;
    
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }
    
    // Verify batch exists and is in pending status
    const batchResult = await client.query(
      'SELECT * FROM processing_batches WHERE id = $1',
      [batchId]
    );
    
    if (batchResult.rows.length === 0) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    
    const batch = batchResult.rows[0];
    if (batch.status !== 'pending') {
      return res.status(400).json({ error: 'Cannot add files to batch that is not in pending status' });
    }
    
    // Add files to batch_files table
    const fileInserts = files.map(file => {
      const fileType = path.extname(file.originalname).toLowerCase() === '.pdf' ? 'PDF' : 'HTML';
      return client.query(`
        INSERT INTO batch_files (batch_id, filename, file_path, file_type, status)
        VALUES ($1, $2, $3, $4, 'pending')
        RETURNING *
      `, [batchId, file.originalname, file.path, fileType]);
    });
    
    const insertResults = await Promise.all(fileInserts);
    
    // Update batch total_files count
    await client.query(`
      UPDATE processing_batches 
      SET total_files = total_files + $1
      WHERE id = $2
    `, [files.length, batchId]);
    
    await client.query('COMMIT');
    
    res.status(201).json({
      message: `${files.length} files added to batch successfully`,
      files: insertResults.map(result => result.rows[0])
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error adding files to batch:', error);
    
    // Clean up uploaded files on error
    if (req.files) {
      req.files.forEach(file => {
        fs.unlink(file.path).catch(console.error);
      });
    }
    
    res.status(500).json({ error: 'Failed to add files to batch' });
  } finally {
    client.release();
  }
});

// POST /api/batches/:id/process - Start batch processing
router.post('/:id/process', authenticateToken, async (req, res) => {
  try {
    const { id: batchId } = req.params;
    
    // Verify batch exists and is in pending status
    const batchResult = await pool.query(
      'SELECT * FROM processing_batches WHERE id = $1',
      [batchId]
    );
    
    if (batchResult.rows.length === 0) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    
    const batch = batchResult.rows[0];
    if (batch.status !== 'pending') {
      return res.status(400).json({ error: 'Batch is not in pending status' });
    }
    
    // Update batch status to processing
    await pool.query(`
      UPDATE processing_batches 
      SET status = 'processing', started_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [batchId]);
    
    // Start batch processing asynchronously
    res.json({
      message: 'Batch processing started',
      batchId,
      status: 'processing'
    });
    
    // Trigger batch processing service (fire and forget)
    setImmediate(async () => {
      try {
        const result = await batchProcessingService.processBatch(batchId);
        console.log(`Batch processing completed for batch ${batchId}:`, result);
      } catch (error) {
        console.error(`Batch processing failed for batch ${batchId}:`, error);
      }
    });
  } catch (error) {
    console.error('Error starting batch processing:', error);
    res.status(500).json({ error: 'Failed to start batch processing' });
  }
});

// POST /api/batches/:id/resume - Resume failed batch processing
router.post('/:id/resume', authenticateToken, async (req, res) => {
  try {
    const { id: batchId } = req.params;
    
    // Verify batch exists
    const batchResult = await pool.query(
      'SELECT * FROM processing_batches WHERE id = $1',
      [batchId]
    );
    
    if (batchResult.rows.length === 0) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    
    const batch = batchResult.rows[0];
    if (!['failed', 'partial'].includes(batch.status)) {
      return res.status(400).json({ error: 'Batch cannot be resumed in current status' });
    }
    
    // Reset failed files to pending
    await pool.query(`
      UPDATE batch_files 
      SET status = 'pending', error_message = NULL
      WHERE batch_id = $1 AND status = 'failed'
    `, [batchId]);
    
    // Update batch status to processing
    await pool.query(`
      UPDATE processing_batches 
      SET status = 'processing', started_at = CURRENT_TIMESTAMP, error_message = NULL
      WHERE id = $1
    `, [batchId]);
    
    res.json({
      message: 'Batch processing resumed',
      batchId,
      status: 'processing'
    });
    
    // Trigger batch processing service (fire and forget)
    setImmediate(async () => {
      try {
        const result = await batchProcessingService.processBatch(batchId);
        console.log(`Batch processing resumed and completed for batch ${batchId}:`, result);
      } catch (error) {
        console.error(`Batch processing resume failed for batch ${batchId}:`, error);
      }
    });
  } catch (error) {
    console.error('Error resuming batch processing:', error);
    res.status(500).json({ error: 'Failed to resume batch processing' });
  }
});

// DELETE /api/batches/:id - Delete batch and associated files
router.delete('/:id', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id: batchId } = req.params;
    
    // Get batch files for cleanup
    const filesResult = await client.query(
      'SELECT file_path FROM batch_files WHERE batch_id = $1',
      [batchId]
    );
    
    // Delete batch (cascade will delete batch_files)
    const deleteResult = await client.query(
      'DELETE FROM processing_batches WHERE id = $1 RETURNING *',
      [batchId]
    );
    
    if (deleteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    
    await client.query('COMMIT');
    
    // Clean up files asynchronously (don't wait for this)
    setImmediate(async () => {
      for (const file of filesResult.rows) {
        try {
          await fs.unlink(file.file_path);
        } catch (error) {
          console.error(`Error deleting file ${file.file_path}:`, error);
        }
      }
    });
    
    res.json({ message: 'Batch deleted successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting batch:', error);
    res.status(500).json({ error: 'Failed to delete batch' });
  } finally {
    client.release();
  }
});

// GET /api/batches/:id/progress - Get batch processing progress (optionally with file details)
router.get('/:id/progress', authenticateToken, async (req, res) => {
  try {
    const { id: batchId } = req.params;
    const { includeFiles = 'false' } = req.query; // Optional query parameter
    
    const progressQuery = `
      SELECT 
        pb.status as batch_status,
        pb.total_files,
        pb.started_at,
        pb.completed_at,
        pb.error_message,
        COUNT(CASE WHEN bf.status = 'processed' THEN 1 END) as processed_files,
        COUNT(CASE WHEN bf.status = 'failed' THEN 1 END) as failed_files,
        COUNT(CASE WHEN bf.status = 'pending' THEN 1 END) as pending_files,
        COUNT(CASE WHEN bf.status = 'processing' THEN 1 END) as processing_files
      FROM processing_batches pb
      LEFT JOIN batch_files bf ON pb.id = bf.batch_id
      WHERE pb.id = $1
      GROUP BY pb.id, pb.status, pb.total_files, pb.started_at, pb.completed_at, pb.error_message
    `;
    
    const result = await pool.query(progressQuery, [batchId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    
    const progress = result.rows[0];
    const totalFiles = parseInt(progress.total_files);
    const processedFiles = parseInt(progress.processed_files);
    const failedFiles = parseInt(progress.failed_files);
    const pendingFiles = parseInt(progress.pending_files);
    const processingFiles = parseInt(progress.processing_files);
    
    const completionPercentage = totalFiles > 0 
      ? Math.round(((processedFiles + failedFiles) / totalFiles) * 100)
      : 0;
    
    const response = {
      batchId,
      status: progress.batch_status,
      totalFiles,
      processedFiles,
      failedFiles,
      pendingFiles,
      processingFiles,
      completionPercentage,
      startedAt: progress.started_at,
      completedAt: progress.completed_at,
      errorMessage: progress.error_message
    };
    
    // Optionally include file details to reduce API calls
    if (includeFiles === 'true') {
      const filesQuery = `
        SELECT 
          bf.id,
          bf.filename,
          bf.status,
          bf.invoice_id,
          bf.processed_at,
          bf.processing_time_ms,
          bf.error_message,
          i.invoice_number,
          i.customer_name
        FROM batch_files bf
        LEFT JOIN invoices i ON bf.invoice_id = i.id
        WHERE bf.batch_id = $1
        ORDER BY bf.created_at
      `;
      
      const filesResult = await pool.query(filesQuery, [batchId]);
      response.files = filesResult.rows;
    }
    
    res.json(response);
  } catch (error) {
    console.error('Error fetching batch progress:', error);
    res.status(500).json({ error: 'Failed to fetch batch progress' });
  }
});

module.exports = router;