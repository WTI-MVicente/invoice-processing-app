const { Pool } = require('pg');
require('dotenv').config();

// Test database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

describe('Database Schema Tests', () => {

  afterAll(async () => {
    await pool.end();
  });

  describe('extraction_prompts table validation', () => {
    test('Should verify table exists', async () => {
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'extraction_prompts'
        );
      `);
      
      console.log('📊 extraction_prompts table exists:', result.rows[0].exists);
      expect(result.rows[0].exists).toBe(true);
    });

    test('Should show current table structure', async () => {
      const result = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'extraction_prompts'
        ORDER BY ordinal_position;
      `);
      
      console.log('📊 Current table columns:');
      result.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
      });
      
      const columnNames = result.rows.map(row => row.column_name);
      
      // Test critical columns
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('prompt_name'); 
      expect(columnNames).toContain('prompt_text');
      
      // Check for the problematic column
      const hasUpdatedAt = columnNames.includes('updated_at');
      console.log('❓ Has updated_at column:', hasUpdatedAt);
      
      if (!hasUpdatedAt) {
        console.log('⚠️  ISSUE FOUND: updated_at column is missing but referenced in API');
      }
      
      return { columnNames, hasUpdatedAt };
    });

    test('Should test the failing UPDATE query', async () => {
      // This is the exact query from the error
      const problematicQuery = `
        UPDATE extraction_prompts 
        SET 
          prompt_name = COALESCE($1, prompt_name),
          prompt_text = COALESCE($2, prompt_text), 
          vendor_id = COALESCE($3, vendor_id),
          is_active = COALESCE($4, is_active),
          is_template = COALESCE($5, is_template),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $6
        RETURNING *;
      `;

      try {
        await pool.query(problematicQuery, [
          'Test Name', 
          'Test Text', 
          null, 
          true, 
          false, 
          'test-id-that-does-not-exist'
        ]);
        console.log('✅ Problematic query succeeded (unexpected)');
      } catch (error) {
        console.log('❌ Problematic query failed as expected');
        console.log('❌ Error message:', error.message);
        console.log('❌ Error code:', error.code);
        
        expect(error.message).toContain('updated_at');
        expect(error.code).toBe('42703'); // column does not exist
      }
    });

    test('Should test fixed UPDATE query without updated_at', async () => {
      const fixedQuery = `
        UPDATE extraction_prompts 
        SET 
          prompt_name = COALESCE($1, prompt_name),
          prompt_text = COALESCE($2, prompt_text),
          vendor_id = COALESCE($3, vendor_id), 
          is_active = COALESCE($4, is_active),
          is_template = COALESCE($5, is_template)
        WHERE id = $6
        RETURNING *;
      `;

      try {
        await pool.query(fixedQuery, [
          'Test Name',
          'Test Text', 
          null,
          true,
          false,
          'test-id-that-does-not-exist'  
        ]);
        console.log('✅ Fixed query structure is valid (no syntax errors)');
      } catch (error) {
        if (error.code === '42703') {
          console.log('❌ Fixed query still has column issues:', error.message);
        } else {
          console.log('✅ Fixed query syntax is valid (expected no matching rows error)');
          console.log('ℹ️  Error was:', error.message);
        }
      }
    });
  });
});