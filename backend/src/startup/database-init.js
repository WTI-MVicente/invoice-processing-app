/**
 * Database Initialization for Production
 * Runs automatically on App Runner startup
 */

const fs = require('fs').promises;
const path = require('path');
const { Pool } = require('pg');
const { 
  getDatabaseCredentials, 
  getProductionConnectionString, 
  isProduction 
} = require('../config/environment');

let migrationPool = null;

async function initializeProductionDatabase() {
  if (!isProduction) {
    console.log('🛠️  Development mode - skipping production database initialization');
    return true;
  }

  try {
    console.log('🚀 Starting production database initialization...');
    
    // Get production database connection
    const connectionString = await getProductionConnectionString();
    migrationPool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 3
    });

    // Test connection
    const client = await migrationPool.connect();
    await client.query('SELECT NOW()');
    client.release();
    console.log('✅ Database connection established');

    // Check if tables exist
    const tablesResult = await migrationPool.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'users'
    `);

    if (parseInt(tablesResult.rows[0].count) === 0) {
      console.log('🏗️  Running initial database setup...');
      await runMigrations();
    } else {
      console.log('✅ Database schema already exists');
    }

    // Ensure demo user exists
    await setupDemoUser();

    console.log('🎉 Database initialization completed successfully');
    return true;

  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    return false;
  } finally {
    if (migrationPool) {
      await migrationPool.end();
      migrationPool = null;
    }
  }
}

async function runMigrations() {
  try {
    // Create extension
    await migrationPool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    
    // Run main schema
    const schemaPath = path.join(__dirname, '..', '..', '..', 'database', 'schema.sql');
    const schema = await fs.readFile(schemaPath, 'utf8');
    
    // Split and execute statements
    const statements = schema
      .replace(/CREATE EXTENSION.*?;/g, '') // Skip extension statements
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await migrationPool.query(statement);
        } catch (error) {
          if (!error.message.includes('already exists')) {
            console.error(`❌ Migration error:`, error.message);
          }
        }
      }
    }

    console.log('✅ Schema migration completed');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  }
}

async function setupDemoUser() {
  try {
    await migrationPool.query(`
      INSERT INTO users (email, password_hash, name, is_active, created_at) 
      VALUES ('demo@waterfield.tech', '$2b$10$rRGVgzW1Y8/6v/jx6f5C6ux8jQXtM5A.kFzZzLJ4zPc2z4kZxmEDu', 'Demo User', true, CURRENT_TIMESTAMP)
      ON CONFLICT (email) DO NOTHING
    `);
    console.log('👤 Demo user configured');
  } catch (error) {
    console.log('⚠️  Demo user setup:', error.message);
  }
}

module.exports = {
  initializeProductionDatabase
};