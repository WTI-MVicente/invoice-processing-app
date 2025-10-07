const express = require('express');
const { query, transaction } = require('../config/database');

const router = express.Router();

// Authentication middleware (will be added to server.js)
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

// GET /api/vendors - Get all vendors
router.get('/', authenticateToken, async (req, res) => {
  try {
    const vendorsQuery = `
      SELECT 
        v.id,
        v.name,
        v.display_name,
        v.active,
        v.extraction_prompt_id,
        v.created_at,
        v.updated_at,
        ep.prompt_name as active_prompt_name,
        COUNT(i.id) as invoice_count
      FROM vendors v
      LEFT JOIN extraction_prompts ep ON v.extraction_prompt_id = ep.id
      LEFT JOIN invoices i ON v.id = i.vendor_id
      GROUP BY v.id, v.name, v.display_name, v.active, v.extraction_prompt_id, v.created_at, v.updated_at, ep.prompt_name
      ORDER BY v.name ASC
    `;

    const result = await query(vendorsQuery);
    
    res.json({
      vendors: result.rows.map(row => ({
        id: row.id,
        name: row.name,
        display_name: row.display_name || row.name,
        active: row.active,
        extraction_prompt_id: row.extraction_prompt_id,
        created_at: row.created_at,
        updated_at: row.updated_at,
        active_prompt_name: row.active_prompt_name || 'No prompt assigned',
        active_prompt_id: row.extraction_prompt_id,
        invoice_count: parseInt(row.invoice_count) || 0
      }))
    });

  } catch (error) {
    console.error('❌ Error fetching vendors:', error);
    res.status(500).json({ error: 'Failed to fetch vendors' });
  }
});

// GET /api/vendors/:id - Get single vendor
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const vendorQuery = `
      SELECT 
        v.*,
        ep.prompt_name as active_prompt_name,
        ep.id as active_prompt_id
      FROM vendors v
      LEFT JOIN extraction_prompts ep ON v.extraction_prompt_id = ep.id
      WHERE v.id = $1
    `;

    const result = await query(vendorQuery, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    const vendor = result.rows[0];
    res.json({
      vendor: {
        id: vendor.id,
        name: vendor.name,
        display_name: vendor.display_name || vendor.name,
        active: vendor.active,
        created_at: vendor.created_at,
        updated_at: vendor.updated_at,
        active_prompt_name: vendor.active_prompt_name || 'No prompt assigned',
        active_prompt_id: vendor.active_prompt_id
      }
    });

  } catch (error) {
    console.error('❌ Error fetching vendor:', error);
    res.status(500).json({ error: 'Failed to fetch vendor' });
  }
});

// POST /api/vendors - Create new vendor
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, display_name, active = true } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Vendor name is required' });
    }

    const normalizedName = name.toLowerCase().trim();

    // Check if vendor already exists
    const existingVendor = await query(
      'SELECT id FROM vendors WHERE LOWER(name) = $1',
      [normalizedName]
    );

    if (existingVendor.rows.length > 0) {
      return res.status(409).json({ error: 'Vendor with this name already exists' });
    }

    const insertQuery = `
      INSERT INTO vendors (name, display_name, active)
      VALUES ($1, $2, $3)
      RETURNING id, name, display_name, active, created_at, updated_at
    `;

    const result = await query(insertQuery, [
      normalizedName,
      display_name || name,
      active
    ]);

    const vendor = result.rows[0];

    console.log(`✅ Created vendor: ${vendor.name}`);

    res.status(201).json({
      message: 'Vendor created successfully',
      vendor: {
        id: vendor.id,
        name: vendor.name,
        display_name: vendor.display_name,
        active: vendor.active,
        created_at: vendor.created_at,
        updated_at: vendor.updated_at,
        active_prompt_name: 'No prompt assigned',
        invoice_count: 0
      }
    });

  } catch (error) {
    console.error('❌ Error creating vendor:', error);
    res.status(500).json({ error: 'Failed to create vendor' });
  }
});

// PUT /api/vendors/:id - Update vendor
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, display_name, active, extraction_prompt_id } = req.body;

    // Check if vendor exists
    const existingVendor = await query('SELECT * FROM vendors WHERE id = $1', [id]);
    if (existingVendor.rows.length === 0) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount}`);
      values.push(name.toLowerCase().trim());
      paramCount++;
    }

    if (display_name !== undefined) {
      updates.push(`display_name = $${paramCount}`);
      values.push(display_name);
      paramCount++;
    }

    if (active !== undefined) {
      updates.push(`active = $${paramCount}`);
      values.push(active);
      paramCount++;
    }

    if (extraction_prompt_id !== undefined) {
      updates.push(`extraction_prompt_id = $${paramCount}`);
      values.push(extraction_prompt_id || null);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    values.push(id); // for WHERE clause
    const updateQuery = `
      UPDATE vendors 
      SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount}
      RETURNING id, name, display_name, active, created_at, updated_at
    `;

    const result = await query(updateQuery, values);
    const vendor = result.rows[0];

    console.log(`✅ Updated vendor: ${vendor.name}`);

    res.json({
      message: 'Vendor updated successfully',
      vendor: {
        id: vendor.id,
        name: vendor.name,
        display_name: vendor.display_name,
        active: vendor.active,
        created_at: vendor.created_at,
        updated_at: vendor.updated_at
      }
    });

  } catch (error) {
    console.error('❌ Error updating vendor:', error);
    res.status(500).json({ error: 'Failed to update vendor' });
  }
});

// DELETE /api/vendors/:id - Delete vendor
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if vendor has invoices
    const invoiceCheck = await query(
      'SELECT COUNT(*) as count FROM invoices WHERE vendor_id = $1',
      [id]
    );

    const invoiceCount = parseInt(invoiceCheck.rows[0].count);
    
    if (invoiceCount > 0) {
      return res.status(409).json({ 
        error: `Cannot delete vendor. ${invoiceCount} invoices are associated with this vendor.`,
        canDelete: false,
        invoiceCount
      });
    }

    // Delete vendor
    const deleteQuery = 'DELETE FROM vendors WHERE id = $1 RETURNING name';
    const result = await query(deleteQuery, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    console.log(`🗑️ Deleted vendor: ${result.rows[0].name}`);

    res.json({ 
      message: 'Vendor deleted successfully',
      vendor_name: result.rows[0].name
    });

  } catch (error) {
    console.error('❌ Error deleting vendor:', error);
    res.status(500).json({ error: 'Failed to delete vendor' });
  }
});

module.exports = router;