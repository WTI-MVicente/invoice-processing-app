const express = require('express');
const claudeService = require('../services/claudeService');

const router = express.Router();

// Test Claude API connection
router.get('/claude', async (req, res) => {
  try {
    console.log('🧪 Testing Claude API connection...');
    const isConnected = await claudeService.testConnection();
    
    if (isConnected) {
      res.json({
        status: 'success',
        message: 'Claude API connection successful',
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(502).json({
        status: 'error',
        message: 'Claude API connection failed',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('❌ Claude test error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Claude API test failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

// Test invoice processing with sample data
router.post('/claude/process', async (req, res) => {
  try {
    const { content, vendor_prompt = 'Extract basic invoice data from this content.' } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    console.log('🧪 Testing invoice processing with Claude...');
    
    const result = await claudeService.extractInvoiceData(content, vendor_prompt, 'test');
    
    res.json({
      status: 'success',
      message: 'Invoice processing test successful',
      result: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Claude processing test error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Invoice processing test failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;