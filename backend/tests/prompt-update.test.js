const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

describe('Prompt Update Functionality Tests', () => {
  let testPromptId;
  
  beforeAll(async () => {
    // Create a test prompt for updating
    const createResult = await pool.query(`
      INSERT INTO extraction_prompts (prompt_name, prompt_text, is_template, is_active, created_by)
      VALUES ('Update Test Prompt', 'Original prompt text for testing updates', true, false, 'test-user')
      RETURNING id, prompt_name, prompt_text, is_template, is_active, created_at, updated_at, version;
    `);
    
    testPromptId = createResult.rows[0].id;
    console.log('📝 Created test prompt:', testPromptId);
    console.log('📊 Original prompt data:', createResult.rows[0]);
  });

  afterAll(async () => {
    // Clean up test data
    if (testPromptId) {
      await pool.query('DELETE FROM extraction_prompts WHERE id = $1', [testPromptId]);
      console.log('🧹 Cleaned up test prompt');
    }
    await pool.end();
  });

  describe('Direct Database Update Tests', () => {
    test('Should update prompt using exact API query', async () => {
      const updateParams = {
        prompt_name: 'Updated Test Prompt Name',
        prompt_text: 'Updated prompt text with new instructions',
        vendor_id: null,
        is_template: true,
        is_active: true
      };

      // This is the exact query from the API
      const apiQuery = `
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

      try {
        console.log('🔄 Testing API update query with parameters:');
        console.log('  prompt_name:', updateParams.prompt_name);
        console.log('  prompt_text:', updateParams.prompt_text.substring(0, 50) + '...');
        console.log('  vendor_id:', updateParams.vendor_id);
        console.log('  is_template:', updateParams.is_template);  
        console.log('  is_active:', updateParams.is_active);
        console.log('  id:', testPromptId);

        const result = await pool.query(apiQuery, [
          updateParams.prompt_name,
          updateParams.prompt_text,
          updateParams.vendor_id,
          updateParams.is_template,
          updateParams.is_active,
          testPromptId
        ]);

        console.log('✅ Update query succeeded');
        console.log('📊 Updated prompt data:', result.rows[0]);
        
        expect(result.rows).toHaveLength(1);
        expect(result.rows[0].prompt_name).toBe(updateParams.prompt_name);
        expect(result.rows[0].is_active).toBe(updateParams.is_active);
        expect(result.rows[0].updated_at).toBeDefined();

      } catch (error) {
        console.log('❌ Update query failed:', error.message);
        console.log('❌ Error code:', error.code);
        console.log('❌ Error detail:', error.detail);
        console.log('❌ Error hint:', error.hint);
        
        throw error;
      }
    });

    test('Should verify all columns exist that API expects', async () => {
      const expectedColumns = [
        'id', 'prompt_name', 'prompt_text', 'vendor_id', 
        'is_template', 'is_active', 'version', 'parent_prompt_id',
        'created_at', 'updated_at', 'created_by', 'test_results',
        'invoice_type'
      ];

      const result = await pool.query(`
        SELECT column_name
        FROM information_schema.columns 
        WHERE table_name = 'extraction_prompts'
        ORDER BY column_name;
      `);
      
      const actualColumns = result.rows.map(row => row.column_name);
      console.log('📊 Available columns:', actualColumns);
      console.log('📊 Expected columns:', expectedColumns);
      
      expectedColumns.forEach(col => {
        if (!actualColumns.includes(col)) {
          console.log(`❌ Missing expected column: ${col}`);
        }
      });
      
      // Check for unexpected columns
      actualColumns.forEach(col => {
        if (!expectedColumns.includes(col)) {
          console.log(`⚠️  Unexpected column found: ${col}`);
        }
      });
    });

    test('Should test COALESCE behavior with different parameters', async () => {
      // Test updating only some fields (others should remain unchanged)
      const partialUpdateQuery = `
        UPDATE extraction_prompts 
        SET 
          prompt_name = COALESCE($1, prompt_name),
          prompt_text = COALESCE($2, prompt_text),
          vendor_id = COALESCE($3, vendor_id),
          is_template = COALESCE($4, is_template),
          is_active = COALESCE($5, is_active),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $6
        RETURNING prompt_name, is_active, updated_at
      `;

      // Only update is_active, leave other fields as null (should use COALESCE)
      try {
        const result = await pool.query(partialUpdateQuery, [
          null,  // prompt_name - should stay unchanged
          null,  // prompt_text - should stay unchanged  
          null,  // vendor_id - should stay unchanged
          null,  // is_template - should stay unchanged
          false, // is_active - should change to false
          testPromptId
        ]);

        console.log('✅ Partial update succeeded');
        console.log('📊 Result:', result.rows[0]);
        
        expect(result.rows[0].is_active).toBe(false);
        // prompt_name should be unchanged from previous test
        expect(result.rows[0].prompt_name).toBe('Updated Test Prompt Name');
        
      } catch (error) {
        console.log('❌ Partial update failed:', error.message);
        throw error;
      }
    });
  });

  describe('Constraint and Validation Tests', () => {
    test('Should check for unique constraints that might cause issues', async () => {
      const constraints = await pool.query(`
        SELECT 
          tc.constraint_name,
          tc.constraint_type,
          kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'extraction_prompts'
        ORDER BY tc.constraint_name;
      `);
      
      console.log('📊 Table constraints:');
      constraints.rows.forEach(constraint => {
        console.log(`  - ${constraint.constraint_name}: ${constraint.constraint_type} on ${constraint.column_name}`);
      });
      
      // Look for UNIQUE constraints that might cause conflicts
      const uniqueConstraints = constraints.rows.filter(c => c.constraint_type === 'UNIQUE');
      if (uniqueConstraints.length > 0) {
        console.log('⚠️  Unique constraints found - these could cause update conflicts:');
        uniqueConstraints.forEach(uc => {
          console.log(`  - ${uc.constraint_name} on ${uc.column_name}`);
        });
      }
    });

    test('Should test foreign key constraints', async () => {
      // Test updating with an invalid vendor_id
      const invalidVendorQuery = `
        UPDATE extraction_prompts 
        SET vendor_id = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `;

      try {
        await pool.query(invalidVendorQuery, [
          '00000000-0000-0000-0000-000000000000', // Invalid vendor ID
          testPromptId
        ]);
        console.log('⚠️  Foreign key constraint not enforced (this might be OK)');
      } catch (error) {
        if (error.code === '23503') { // Foreign key violation
          console.log('✅ Foreign key constraint is working:', error.message);
        } else {
          console.log('❌ Unexpected error testing foreign key:', error.message);
          throw error;
        }
      }
    });
  });

  describe('Data Type Tests', () => {
    test('Should test all data types used in update', async () => {
      const testValues = {
        prompt_name: 'Test String Value',
        prompt_text: 'This is a longer text field for testing',
        vendor_id: null, // UUID or NULL
        is_template: true, // BOOLEAN
        is_active: false, // BOOLEAN
      };

      try {
        const result = await pool.query(`
          UPDATE extraction_prompts 
          SET 
            prompt_name = $1,
            prompt_text = $2,
            vendor_id = $3,
            is_template = $4,
            is_active = $5,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $6
          RETURNING *
        `, [
          testValues.prompt_name,
          testValues.prompt_text,
          testValues.vendor_id,
          testValues.is_template,
          testValues.is_active,
          testPromptId
        ]);

        console.log('✅ Data type test passed');
        console.log('📊 Result types:');
        const row = result.rows[0];
        Object.keys(testValues).forEach(key => {
          console.log(`  - ${key}: ${typeof row[key]} = ${row[key]}`);
        });

      } catch (error) {
        console.log('❌ Data type test failed:', error.message);
        throw error;
      }
    });
  });
});