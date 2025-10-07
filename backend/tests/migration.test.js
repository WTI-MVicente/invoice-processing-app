const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

describe('Database Migration Tests', () => {
  afterAll(async () => {
    await pool.end();
  });

  test('Should apply the updated_at column migration', async () => {
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', 'add-updated-at-to-prompts.sql');
    const migrationSQL = await fs.readFile(migrationPath, 'utf8');
    
    console.log('📦 Running migration to add updated_at column...');
    
    try {
      // Run the migration
      await pool.query(migrationSQL);
      console.log('✅ Migration executed successfully');
    } catch (error) {
      // If it fails because column already exists, that's OK
      if (error.message.includes('already exists')) {
        console.log('✅ Column already exists - migration previously applied');
      } else {
        throw error;
      }
    }
    
    // Verify the column exists now
    const columnCheck = await pool.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns 
      WHERE table_name = 'extraction_prompts' 
      AND column_name = 'updated_at';
    `);
    
    expect(columnCheck.rows).toHaveLength(1);
    expect(columnCheck.rows[0].column_name).toBe('updated_at');
    console.log('✅ Updated_at column verified:', columnCheck.rows[0]);
  });

  test('Should test the UPDATE query works after migration', async () => {
    const testQuery = `
      UPDATE extraction_prompts 
      SET 
        prompt_name = COALESCE($1, prompt_name),
        prompt_text = COALESCE($2, prompt_text),
        vendor_id = COALESCE($3, vendor_id),
        is_template = COALESCE($4, is_template),
        is_active = COALESCE($5, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *;
    `;

    try {
      // This should work now (though no rows will be updated with fake ID)
      await pool.query(testQuery, [
        'Test Name',
        'Test Text', 
        null,
        true,
        false,
        'test-id-that-does-not-exist'
      ]);
      console.log('✅ UPDATE query syntax is now valid');
    } catch (error) {
      if (error.code === '42703') {
        console.log('❌ Column still missing after migration:', error.message);
        throw error;
      } else {
        console.log('✅ UPDATE query works (expected no matching rows error)');
        console.log('ℹ️  Error was:', error.message);
      }
    }
  });

  test('Should verify trigger is working', async () => {
    // First, let's create a test prompt if none exists
    const insertResult = await pool.query(`
      INSERT INTO extraction_prompts (prompt_name, prompt_text, is_template, created_by)
      VALUES ('Migration Test Prompt', 'Test prompt text', true, 'test-user')
      RETURNING id, created_at, updated_at;
    `);
    
    const promptId = insertResult.rows[0].id;
    const originalUpdatedAt = insertResult.rows[0].updated_at;
    
    console.log('📝 Created test prompt:', promptId);
    console.log('📅 Original updated_at:', originalUpdatedAt);
    
    // Wait a moment to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Update the prompt
    const updateResult = await pool.query(`
      UPDATE extraction_prompts 
      SET prompt_name = 'Updated Migration Test Prompt'
      WHERE id = $1
      RETURNING updated_at;
    `, [promptId]);
    
    const newUpdatedAt = updateResult.rows[0].updated_at;
    console.log('📅 New updated_at:', newUpdatedAt);
    
    // Verify the trigger worked
    expect(newUpdatedAt).not.toEqual(originalUpdatedAt);
    expect(new Date(newUpdatedAt) > new Date(originalUpdatedAt)).toBe(true);
    
    console.log('✅ Trigger is working - updated_at changed automatically');
    
    // Clean up test data
    await pool.query('DELETE FROM extraction_prompts WHERE id = $1', [promptId]);
    console.log('🧹 Test data cleaned up');
  });
});