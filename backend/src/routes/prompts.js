const express = require('express');
const { query, transaction } = require('../config/database');
const claudeService = require('../services/claudeService');
const { uploadSingle, readFileContent, deleteFile } = require('../middleware/upload');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Temporary file storage for test sessions (in production, use Redis or similar)
const tempTestFiles = new Map();

// Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.sendStatus(401);
  }

  const jwt = require('jsonwebtoken');
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// GET /api/prompts - List all prompts with filtering
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { vendor_id, is_active, is_template, limit = 50, offset = 0 } = req.query;
    
    let whereClause = [];
    let params = [];
    let paramCount = 0;

    if (vendor_id) {
      paramCount++;
      whereClause.push(`vendor_id = $${paramCount}`);
      params.push(vendor_id);
    }

    if (is_active !== undefined) {
      paramCount++;
      whereClause.push(`is_active = $${paramCount}`);
      params.push(is_active === 'true');
    }

    if (is_template !== undefined) {
      paramCount++;
      whereClause.push(`is_template = $${paramCount}`);
      params.push(is_template === 'true');
    }

    const whereSQL = whereClause.length > 0 ? `WHERE ${whereClause.join(' AND ')}` : '';
    
    paramCount++;
    params.push(parseInt(limit));
    paramCount++;
    params.push(parseInt(offset));

    const sql = `
      SELECT 
        p.*,
        v.name as vendor_name,
        v.display_name as vendor_display_name,
        (SELECT COUNT(*) FROM extraction_prompts cp WHERE cp.parent_prompt_id = p.id) as child_count
      FROM extraction_prompts p
      LEFT JOIN vendors v ON p.vendor_id = v.id
      ${whereSQL}
      ORDER BY p.created_at DESC
      LIMIT $${paramCount - 1} OFFSET $${paramCount}
    `;

    const result = await query(sql, params);

    // Get total count for pagination
    const countSQL = `SELECT COUNT(*) FROM extraction_prompts p ${whereSQL}`;
    const countResult = await query(countSQL, params.slice(0, -2));
    
    res.json({
      prompts: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    console.error('❌ Error fetching prompts:', error);
    res.status(500).json({ error: 'Failed to fetch prompts' });
  }
});

// GET /api/prompts/:id - Get specific prompt
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const sql = `
      SELECT 
        p.*,
        v.name as vendor_name,
        v.display_name as vendor_display_name,
        parent.prompt_name as parent_prompt_name,
        parent.version as parent_version
      FROM extraction_prompts p
      LEFT JOIN vendors v ON p.vendor_id = v.id
      LEFT JOIN extraction_prompts parent ON p.parent_prompt_id = parent.id
      WHERE p.id = $1
    `;

    const result = await query(sql, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Prompt not found' });
    }

    res.json({ prompt: result.rows[0] });

  } catch (error) {
    console.error('❌ Error fetching prompt:', error);
    res.status(500).json({ error: 'Failed to fetch prompt' });
  }
});

// GET /api/prompts/vendor/:vendorId - Get vendor-specific prompts
router.get('/vendor/:vendorId', authenticateToken, async (req, res) => {
  try {
    const { vendorId } = req.params;

    const sql = `
      SELECT 
        p.*,
        v.name as vendor_name,
        v.display_name as vendor_display_name
      FROM extraction_prompts p
      JOIN vendors v ON p.vendor_id = v.id
      WHERE p.vendor_id = $1
      ORDER BY p.is_active DESC, p.version DESC, p.created_at DESC
    `;

    const result = await query(sql, [vendorId]);

    res.json({ prompts: result.rows });

  } catch (error) {
    console.error('❌ Error fetching vendor prompts:', error);
    res.status(500).json({ error: 'Failed to fetch vendor prompts' });
  }
});

// POST /api/prompts - Create new prompt
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      prompt_name,
      prompt_text,
      vendor_id,
      is_template = false,
      is_active = false,
      parent_prompt_id = null
    } = req.body;

    // Validation
    if (!prompt_name || !prompt_text) {
      return res.status(400).json({ error: 'prompt_name and prompt_text are required' });
    }

    // If setting as active, deactivate other prompts for the same vendor
    if (is_active && vendor_id) {
      await query(
        'UPDATE extraction_prompts SET is_active = false WHERE vendor_id = $1 AND is_active = true',
        [vendor_id]
      );
    }

    // Determine version number
    let version = 1;
    if (parent_prompt_id) {
      const versionResult = await query(
        'SELECT COALESCE(MAX(version), 0) + 1 as next_version FROM extraction_prompts WHERE parent_prompt_id = $1 OR id = $1',
        [parent_prompt_id]
      );
      version = versionResult.rows[0].next_version;
    }

    const sql = `
      INSERT INTO extraction_prompts (
        prompt_name, prompt_text, vendor_id, is_template, 
        is_active, version, parent_prompt_id, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const values = [
      prompt_name,
      prompt_text,
      vendor_id,
      is_template,
      is_active,
      version,
      parent_prompt_id,
      req.user.email || 'system'
    ];

    const result = await query(sql, values);

    console.log(`✅ Created prompt: ${prompt_name} v${version}`);
    
    res.status(201).json({
      message: 'Prompt created successfully',
      prompt: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Error creating prompt:', error);
    if (error.message.includes('duplicate key')) {
      res.status(409).json({ error: 'A prompt with this name and version already exists for this vendor' });
    } else {
      res.status(500).json({ error: 'Failed to create prompt' });
    }
  }
});

// PUT /api/prompts/:id - Update prompt
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      prompt_name,
      prompt_text,
      vendor_id,
      is_template,
      is_active
    } = req.body;

    // Get current prompt
    const currentResult = await query('SELECT * FROM extraction_prompts WHERE id = $1', [id]);
    if (currentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Prompt not found' });
    }

    const currentPrompt = currentResult.rows[0];

    // If setting as active, deactivate other prompts for the same vendor
    if (is_active && vendor_id) {
      await query(
        'UPDATE extraction_prompts SET is_active = false WHERE vendor_id = $1 AND is_active = true AND id != $2',
        [vendor_id, id]
      );
    }

    const sql = `
      UPDATE extraction_prompts 
      SET 
        prompt_name = COALESCE($1, prompt_name),
        prompt_text = COALESCE($2, prompt_text),
        vendor_id = COALESCE($3, vendor_id),
        is_template = COALESCE($4, is_template),
        is_active = COALESCE($5, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *
    `;

    const values = [prompt_name, prompt_text, vendor_id, is_template, is_active, id];
    const result = await query(sql, values);

    console.log(`✅ Updated prompt: ${result.rows[0].prompt_name}`);

    res.json({
      message: 'Prompt updated successfully',
      prompt: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Error updating prompt:', error);
    res.status(500).json({ error: 'Failed to update prompt' });
  }
});

// POST /api/prompts/:id/activate - Activate a specific prompt version
router.post('/:id/activate', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Get prompt details
    const promptResult = await query('SELECT * FROM extraction_prompts WHERE id = $1', [id]);
    if (promptResult.rows.length === 0) {
      return res.status(404).json({ error: 'Prompt not found' });
    }

    const prompt = promptResult.rows[0];

    // Deactivate other prompts for the same vendor
    if (prompt.vendor_id) {
      await query(
        'UPDATE extraction_prompts SET is_active = false WHERE vendor_id = $1 AND is_active = true',
        [prompt.vendor_id]
      );
    }

    // Activate this prompt
    await query('UPDATE extraction_prompts SET is_active = true WHERE id = $1', [id]);

    console.log(`✅ Activated prompt: ${prompt.prompt_name} v${prompt.version}`);

    res.json({
      message: 'Prompt activated successfully',
      prompt_id: id
    });

  } catch (error) {
    console.error('❌ Error activating prompt:', error);
    res.status(500).json({ error: 'Failed to activate prompt' });
  }
});

// GET /api/prompts/:id/history - Get version history
router.get('/:id/history', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Get the prompt to find its family tree
    const promptResult = await query('SELECT * FROM extraction_prompts WHERE id = $1', [id]);
    if (promptResult.rows.length === 0) {
      return res.status(404).json({ error: 'Prompt not found' });
    }

    const prompt = promptResult.rows[0];
    const rootId = prompt.parent_prompt_id || id;

    // Get all versions in the family tree
    const sql = `
      SELECT 
        p.*,
        v.name as vendor_name,
        v.display_name as vendor_display_name
      FROM extraction_prompts p
      LEFT JOIN vendors v ON p.vendor_id = v.id
      WHERE p.id = $1 OR p.parent_prompt_id = $1
      ORDER BY p.version ASC
    `;

    const result = await query(sql, [rootId]);

    res.json({ versions: result.rows });

  } catch (error) {
    console.error('❌ Error fetching prompt history:', error);
    res.status(500).json({ error: 'Failed to fetch prompt history' });
  }
});

// POST /api/prompts/:id/test - Test prompt with sample document
router.post('/:id/test', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { document_content, document_type = 'pdf' } = req.body;

    if (!document_content) {
      return res.status(400).json({ error: 'document_content is required' });
    }

    // Get prompt
    const promptResult = await query('SELECT * FROM extraction_prompts WHERE id = $1', [id]);
    if (promptResult.rows.length === 0) {
      return res.status(404).json({ error: 'Prompt not found' });
    }

    const prompt = promptResult.rows[0];

    // Test with Claude API
    console.log(`🧪 Testing prompt: ${prompt.prompt_name} v${prompt.version}`);
    
    const extractedData = await claudeService.extractInvoiceData(
      document_content,
      prompt.prompt_text,
      document_type
    );

    // Store test result
    const testResult = {
      tested_at: new Date().toISOString(),
      document_type,
      success: true,
      extracted_data: extractedData,
      document_length: document_content.length
    };

    await query(
      'UPDATE extraction_prompts SET test_results = COALESCE(test_results, \'[]\'::jsonb) || $1::jsonb WHERE id = $2',
      [JSON.stringify([testResult]), id]
    );

    res.json({
      message: 'Prompt tested successfully',
      test_result: testResult,
      extracted_data: extractedData
    });

  } catch (error) {
    console.error('❌ Error testing prompt:', error);
    
    // Store failed test result
    const failedResult = {
      tested_at: new Date().toISOString(),
      document_type: req.body.document_type || 'pdf',
      success: false,
      error: error.message,
      document_length: req.body.document_content?.length || 0
    };

    try {
      await query(
        'UPDATE extraction_prompts SET test_results = COALESCE(test_results, \'[]\'::jsonb) || $1::jsonb WHERE id = $2',
        [JSON.stringify([failedResult]), id]
      );
    } catch (updateError) {
      console.error('Failed to store test failure:', updateError);
    }

    res.status(500).json({ 
      error: 'Failed to test prompt',
      details: error.message,
      test_result: failedResult
    });
  }
});

// DELETE /api/prompts/:id - Delete prompt
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if prompt exists and get details
    const promptResult = await query('SELECT * FROM extraction_prompts WHERE id = $1', [id]);
    if (promptResult.rows.length === 0) {
      return res.status(404).json({ error: 'Prompt not found' });
    }

    const prompt = promptResult.rows[0];

    // Check if prompt is currently active
    if (prompt.is_active) {
      return res.status(400).json({ 
        error: 'Cannot delete active prompt. Please activate another prompt first.' 
      });
    }

    // Check if prompt has children (other versions)
    const childrenResult = await query(
      'SELECT COUNT(*) FROM extraction_prompts WHERE parent_prompt_id = $1',
      [id]
    );

    if (parseInt(childrenResult.rows[0].count) > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete prompt with version history. Please delete child versions first.' 
      });
    }

    // Delete the prompt
    await query('DELETE FROM extraction_prompts WHERE id = $1', [id]);

    console.log(`🗑️ Deleted prompt: ${prompt.prompt_name} v${prompt.version}`);

    res.json({
      message: 'Prompt deleted successfully',
      deleted_prompt: {
        id: prompt.id,
        prompt_name: prompt.prompt_name,
        version: prompt.version
      }
    });

  } catch (error) {
    console.error('❌ Error deleting prompt:', error);
    res.status(500).json({ error: 'Failed to delete prompt' });
  }
});

// POST /api/prompts/:id/test-upload - Upload file for prompt testing
router.post('/:id/test-upload', authenticateToken, uploadSingle('testFile'), async (req, res) => {
  let filePath = null;
  
  try {
    const { id } = req.params;
    
    // Verify prompt exists
    const promptResult = await query('SELECT * FROM extraction_prompts WHERE id = $1', [id]);
    if (promptResult.rows.length === 0) {
      return res.status(404).json({ error: 'Prompt not found' });
    }

    filePath = req.file.path;
    const originalName = req.file.originalname;
    const contentType = req.file.mimetype;
    
    console.log(`📊 Processing test file: ${originalName} for prompt ${id}`);

    // Extract content from uploaded file
    const extractedContent = await readFileContent(filePath);
    
    // Generate temp file ID
    const tempFileId = uuidv4();
    
    // Store temporary file data
    tempTestFiles.set(tempFileId, {
      filePath: filePath,
      originalName: originalName,
      contentType: contentType,
      extractedContent: extractedContent,
      createdAt: Date.now(),
      promptId: id
    });
    
    // Clean up old temp files (older than 1 hour)
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    for (const [tempId, tempData] of tempTestFiles.entries()) {
      if (tempData.createdAt < oneHourAgo) {
        try {
          await deleteFile(tempData.filePath);
          tempTestFiles.delete(tempId);
          console.log(`🧹 Cleaned up old temp file: ${tempId}`);
        } catch (err) {
          console.warn(`⚠️ Failed to clean up temp file: ${tempId}`, err.message);
        }
      }
    }
    
    console.log(`✅ Test file uploaded successfully: ${tempFileId}`);
    
    res.status(200).json({
      message: 'Test file uploaded successfully',
      tempFileId: tempFileId,
      extractedContent: extractedContent,
      originalName: originalName,
      contentType: contentType
    });

  } catch (error) {
    console.error('❌ Error uploading test file:', error);
    
    // Clean up uploaded file on error
    if (filePath) {
      await deleteFile(filePath);
    }

    res.status(500).json({ 
      error: 'Failed to upload test file',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/prompts/test-file/:tempFileId - Serve temporary test file
router.get('/test-file/:tempFileId', async (req, res) => {
  try {
    const { tempFileId } = req.params;
    
    // Check authentication (header or query parameter for iframe requests)
    const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
    if (!token) {
      return res.status(401).json({ error: 'Authentication token required' });
    }
    
    try {
      const jwt = require('jsonwebtoken');
      jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Get temp file data
    const tempData = tempTestFiles.get(tempFileId);
    if (!tempData) {
      return res.status(404).json({ error: 'Test file not found or expired' });
    }

    // Check if file exists
    if (!fs.existsSync(tempData.filePath)) {
      console.log(`❌ Test file does not exist on disk: ${tempData.filePath}`);
      tempTestFiles.delete(tempFileId); // Clean up stale reference
      return res.status(404).json({ error: 'Test file no longer exists' });
    }

    console.log(`✅ Serving test file: ${tempData.originalName}`);

    // Set appropriate content type and allow iframe embedding
    if (tempData.contentType === 'application/pdf') {
      res.setHeader('Content-Type', 'application/pdf');
    } else if (tempData.contentType.includes('html')) {
      res.setHeader('Content-Type', 'text/html');
    }
    
    // Allow iframe embedding from frontend
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    res.setHeader('Content-Security-Policy', 'frame-ancestors http://localhost:3000');
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');

    // Set filename for display
    res.setHeader('Content-Disposition', `inline; filename="${tempData.originalName}"`);
    
    // Serve the file
    res.sendFile(path.resolve(tempData.filePath), (err) => {
      if (err) {
        console.error('❌ Error serving test file:', err);
        res.status(500).json({ error: 'Failed to serve test file' });
      }
    });

  } catch (error) {
    console.error('❌ Error serving test file:', error);
    res.status(500).json({ error: 'Failed to serve test file' });
  }
});

// POST /api/prompts/:id/test-run - Run prompt test with uploaded file
router.post('/:id/test-run', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { tempFileId, promptText, document_type = 'pdf' } = req.body;

    if (!tempFileId || !promptText) {
      return res.status(400).json({ error: 'tempFileId and promptText are required' });
    }

    // Get temp file data
    const tempData = tempTestFiles.get(tempFileId);
    if (!tempData) {
      return res.status(404).json({ error: 'Test file not found or expired' });
    }

    // Verify prompt exists
    const promptResult = await query('SELECT * FROM extraction_prompts WHERE id = $1', [id]);
    if (promptResult.rows.length === 0) {
      return res.status(404).json({ error: 'Prompt not found' });
    }

    const prompt = promptResult.rows[0];

    console.log(`🧪 Running test with prompt: ${prompt.prompt_name} using file: ${tempData.originalName}`);
    
    // Test with Claude API using extracted content and custom prompt
    const startTime = Date.now();
    const extractedData = await claudeService.extractInvoiceData(
      tempData.extractedContent,
      promptText,
      document_type
    );
    const processingTime = Date.now() - startTime;

    // Store test result (optional - for history)
    const testResult = {
      tested_at: new Date().toISOString(),
      document_type,
      success: true,
      extracted_data: extractedData,
      document_length: tempData.extractedContent.length,
      processing_time_ms: processingTime,
      custom_prompt_used: promptText !== prompt.prompt_text
    };

    console.log(`✅ Test completed successfully in ${processingTime}ms`);

    res.json({
      message: 'Prompt test completed successfully',
      success: true,
      test_result: testResult,
      extracted_data: extractedData,
      processing_time_ms: processingTime
    });

  } catch (error) {
    console.error('❌ Error running prompt test:', error);
    
    // Store failed test result
    const failedResult = {
      tested_at: new Date().toISOString(),
      document_type: req.body.document_type || 'pdf',
      success: false,
      error: error.message,
      document_length: 0
    };

    res.status(500).json({ 
      error: 'Failed to run prompt test',
      success: false,
      details: error.message,
      test_result: failedResult
    });
  }
});

// DELETE /api/prompts/test-cleanup/:tempFileId - Clean up temporary test file
router.delete('/test-cleanup/:tempFileId', authenticateToken, async (req, res) => {
  try {
    const { tempFileId } = req.params;

    const tempData = tempTestFiles.get(tempFileId);
    if (!tempData) {
      return res.status(404).json({ error: 'Test file not found' });
    }

    // Delete file from filesystem
    try {
      await deleteFile(tempData.filePath);
      console.log(`🗑️ Deleted temp file: ${tempData.originalName}`);
    } catch (fileError) {
      console.warn(`⚠️ Could not delete temp file ${tempData.filePath}:`, fileError.message);
    }

    // Remove from memory
    tempTestFiles.delete(tempFileId);

    res.json({ 
      message: 'Test file cleaned up successfully',
      tempFileId: tempFileId
    });

  } catch (error) {
    console.error('❌ Error cleaning up test file:', error);
    res.status(500).json({ error: 'Failed to clean up test file' });
  }
});

module.exports = router;