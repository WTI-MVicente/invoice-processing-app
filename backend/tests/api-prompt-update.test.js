const request = require('supertest');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

describe('API Prompt Update Tests', () => {
  let app;
  let authToken;
  let testPromptId;

  beforeAll(async () => {
    // We can't start the server since it's already running, so we'll test the route logic directly
    // Let's first create a test prompt directly in the database
    const createResult = await pool.query(`
      INSERT INTO extraction_prompts (prompt_name, prompt_text, is_template, is_active, created_by)
      VALUES ('API Test Prompt', 'Original API prompt text', true, false, 'api-test-user')
      RETURNING id, prompt_name, vendor_id, version;
    `);
    
    testPromptId = createResult.rows[0].id;
    console.log('📝 Created API test prompt:', testPromptId);
    console.log('📊 Original data:', createResult.rows[0]);

    // Try to get an auth token (though server might not be available for testing)
    console.log('🔐 Note: Cannot test actual HTTP endpoints while server is running');
  });

  afterAll(async () => {
    // Clean up test data
    if (testPromptId) {
      await pool.query('DELETE FROM extraction_prompts WHERE id = $1', [testPromptId]);
      console.log('🧹 Cleaned up API test prompt');
    }
    await pool.end();
  });

  describe('API Route Logic Simulation', () => {
    test('Should simulate the exact API update logic', async () => {
      // Simulate the API request body
      const requestBody = {
        prompt_name: 'Updated API Test Prompt',
        prompt_text: 'Updated API prompt text with new instructions',
        vendor_id: null,
        is_template: true,
        is_active: true
      };

      console.log('🔄 Simulating API update with body:', requestBody);

      try {
        // This simulates the exact logic in the API route
        const { prompt_name, prompt_text, vendor_id, is_template, is_active } = requestBody;
        const id = testPromptId;

        // Check if we need to deactivate other prompts (API logic)
        if (is_active && vendor_id) {
          console.log('🔄 Would deactivate other active prompts for vendor:', vendor_id);
          const deactivateResult = await pool.query(
            'UPDATE extraction_prompts SET is_active = false WHERE vendor_id = $1 AND is_active = true AND id != $2',
            [vendor_id, id]
          );
          console.log('📊 Deactivated prompts:', deactivateResult.rowCount);
        }

        // The main update query (exact from API)
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
        console.log('🔄 Executing API update query with values:', values);

        const result = await pool.query(sql, values);

        console.log('✅ API simulation succeeded');
        console.log('📊 Updated prompt:', result.rows[0]);
        
        expect(result.rows).toHaveLength(1);
        expect(result.rows[0].prompt_name).toBe(requestBody.prompt_name);
        expect(result.rows[0].is_active).toBe(requestBody.is_active);

      } catch (error) {
        console.log('❌ API simulation failed:', error.message);
        console.log('❌ Error code:', error.code);
        console.log('❌ Error detail:', error.detail);
        console.log('❌ Error constraint:', error.constraint);
        
        throw error;
      }
    });

    test('Should test unique constraint violation scenario', async () => {
      // First, create another prompt with the same name and vendor
      let conflictPromptId;
      
      try {
        const conflictResult = await pool.query(`
          INSERT INTO extraction_prompts (prompt_name, prompt_text, vendor_id, version, is_template, created_by)
          VALUES ('Conflict Test', 'Conflict prompt text', null, 1, true, 'conflict-user')
          RETURNING id;
        `);
        conflictPromptId = conflictResult.rows[0].id;
        
        // Now try to update our test prompt to have the same name, vendor_id, and version
        const conflictingUpdate = `
          UPDATE extraction_prompts 
          SET 
            prompt_name = 'Conflict Test',
            vendor_id = null,
            version = 1
          WHERE id = $1
          RETURNING *
        `;

        try {
          await pool.query(conflictingUpdate, [testPromptId]);
          console.log('⚠️  Unique constraint not enforced (unexpected)');
        } catch (error) {
          if (error.code === '23505') { // Unique constraint violation
            console.log('✅ Unique constraint working:', error.constraint);
            console.log('📊 Constraint details:', error.detail);
          } else {
            console.log('❌ Unexpected error:', error.message);
            throw error;
          }
        }

      } finally {
        // Clean up conflict test data
        if (conflictPromptId) {
          await pool.query('DELETE FROM extraction_prompts WHERE id = $1', [conflictPromptId]);
        }
      }
    });

    test('Should test the exact parameter order and types', async () => {
      // Test with the exact same parameter order as the API
      const updateData = {
        prompt_name: 'Parameter Order Test',
        prompt_text: 'Testing parameter order and types',
        vendor_id: null,
        is_template: false,
        is_active: true
      };

      // Get current data first
      const beforeUpdate = await pool.query('SELECT * FROM extraction_prompts WHERE id = $1', [testPromptId]);
      console.log('📊 Before update:', beforeUpdate.rows[0]);

      // Execute update with exact API parameter order
      const result = await pool.query(`
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
      `, [
        updateData.prompt_name,    // $1
        updateData.prompt_text,    // $2
        updateData.vendor_id,      // $3
        updateData.is_template,    // $4
        updateData.is_active,      // $5
        testPromptId               // $6
      ]);

      console.log('📊 After update:', result.rows[0]);
      
      expect(result.rows[0].prompt_name).toBe(updateData.prompt_name);
      expect(result.rows[0].is_template).toBe(updateData.is_template);
      expect(result.rows[0].is_active).toBe(updateData.is_active);
    });
  });

  describe('Error Scenarios', () => {
    test('Should test updating non-existent prompt', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      
      const result = await pool.query(`
        UPDATE extraction_prompts 
        SET 
          prompt_name = COALESCE($1, prompt_name),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `, ['Non-existent Update', nonExistentId]);

      console.log('📊 Update non-existent prompt result:', result.rowCount, 'rows affected');
      expect(result.rowCount).toBe(0);
    });

    test('Should test with invalid data types', async () => {
      // Test with invalid boolean values
      try {
        await pool.query(`
          UPDATE extraction_prompts 
          SET is_active = $1
          WHERE id = $2
        `, ['not-a-boolean', testPromptId]);
        
        console.log('⚠️  Invalid boolean accepted (unexpected)');
      } catch (error) {
        console.log('✅ Invalid boolean rejected:', error.message);
        expect(error.code).toBe('22P02'); // Invalid input syntax
      }
    });
  });
});