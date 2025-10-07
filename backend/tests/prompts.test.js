const request = require('supertest');
const { Pool } = require('pg');
require('dotenv').config();

// Test database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

describe('Prompts Management System Tests', () => {
  let authToken;
  let app;

  beforeAll(async () => {
    // Import app after environment is set up
    app = require('../src/server');
    
    // Get auth token for testing
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'demo@waterfield.tech',
        password: 'waterfield2025'
      });
    
    if (loginResponse.status === 200) {
      authToken = loginResponse.body.token;
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('Database Schema Validation', () => {
    test('Should check if extraction_prompts table exists', async () => {
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'extraction_prompts'
        );
      `);
      
      console.log('📊 Table exists:', result.rows[0].exists);
      expect(result.rows[0].exists).toBe(true);
    });

    test('Should verify extraction_prompts table columns', async () => {
      const result = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'extraction_prompts'
        ORDER BY ordinal_position;
      `);
      
      console.log('📊 Table columns:');
      result.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
      });
      
      const columnNames = result.rows.map(row => row.column_name);
      console.log('📊 Available columns:', columnNames);
      
      // Check for expected columns
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('prompt_name');
      expect(columnNames).toContain('prompt_text');
      expect(columnNames).toContain('created_at');
      
      // Check if updated_at exists (this is what's causing the error)
      const hasUpdatedAt = columnNames.includes('updated_at');
      console.log('📊 Has updated_at column:', hasUpdatedAt);
    });

    test('Should check table constraints and indexes', async () => {
      const constraints = await pool.query(`
        SELECT constraint_name, constraint_type
        FROM information_schema.table_constraints
        WHERE table_name = 'extraction_prompts';
      `);
      
      console.log('📊 Table constraints:');
      constraints.rows.forEach(constraint => {
        console.log(`  - ${constraint.constraint_name}: ${constraint.constraint_type}`);
      });
    });
  });

  describe('API Endpoints Testing', () => {
    test('Should test authentication requirement', async () => {
      const response = await request(app)
        .get('/api/prompts');
      
      console.log('🔐 Unauthenticated request status:', response.status);
      expect(response.status).toBe(403); // Should require auth
    });

    test('Should get prompts with authentication', async () => {
      if (!authToken) {
        console.log('⚠️ No auth token available, skipping authenticated tests');
        return;
      }

      const response = await request(app)
        .get('/api/prompts')
        .set('Authorization', `Bearer ${authToken}`);
      
      console.log('📝 GET /api/prompts status:', response.status);
      console.log('📝 Response body:', response.body);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('prompts');
      expect(Array.isArray(response.body.prompts)).toBe(true);
    });

    test('Should test prompt creation endpoint', async () => {
      if (!authToken) {
        console.log('⚠️ No auth token available, skipping authenticated tests');
        return;
      }

      const testPrompt = {
        prompt_name: 'Test Prompt',
        prompt_text: 'You are an invoice data extraction specialist. Extract the following information...',
        vendor_id: null,
        is_active: false,
        is_template: true
      };

      const response = await request(app)
        .post('/api/prompts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testPrompt);
      
      console.log('📝 POST /api/prompts status:', response.status);
      console.log('📝 Response body:', response.body);
      
      if (response.status !== 201) {
        console.log('❌ Creation failed. Error details:', response.body);
      }
    });
  });

  describe('Database Query Analysis', () => {
    test('Should analyze the UPDATE query that fails', async () => {
      // Let's see what happens when we try the exact update query
      const testQuery = `
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
        // This should fail if updated_at doesn't exist
        const result = await pool.query(testQuery, [
          'Test Name', 
          'Test Text', 
          null, 
          true, 
          false, 
          '00000000-0000-0000-0000-000000000000'
        ]);
        console.log('✅ UPDATE query succeeded');
      } catch (error) {
        console.log('❌ UPDATE query failed:', error.message);
        console.log('❌ Error code:', error.code);
        console.log('❌ Error position:', error.position);
      }
    });

    test('Should test UPDATE query without updated_at', async () => {
      // Test the query without the problematic column
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
        const result = await pool.query(fixedQuery, [
          'Test Name', 
          'Test Text', 
          null, 
          true, 
          false, 
          '00000000-0000-0000-0000-000000000000'
        ]);
        console.log('✅ Fixed UPDATE query structure is valid');
      } catch (error) {
        console.log('❌ Fixed UPDATE query failed:', error.message);
      }
    });
  });
});