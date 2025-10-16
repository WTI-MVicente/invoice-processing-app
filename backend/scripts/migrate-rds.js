#!/usr/bin/env node

/**
 * RDS Database Migration Script
 * Runs database schema and migrations on AWS RDS PostgreSQL
 */

const fs = require('fs').promises;
const path = require('path');
const { Pool } = require('pg');
const AWS = require('aws-sdk');

// Configure AWS SDK
AWS.config.update({ 
  region: 'us-east-1',
  // Use credentials from AWS CLI profile
});

// Configure credentials from environment or profile
const credentials = new AWS.SharedIniFileCredentials({ profile: 'PowerUserAccess-324532610217' });
AWS.config.credentials = credentials;

const secretsManager = new AWS.SecretsManager();

// Database configuration
const SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:324532610217:secret:invoice-processing-db-credentials-dev-IKmvds';

async function getDatabaseCredentials() {
  try {
    console.log('🔐 Retrieving database credentials from Secrets Manager...');
    const secret = await secretsManager.getSecretValue({ SecretId: SECRET_ARN }).promise();
    const credentials = JSON.parse(secret.SecretString);
    
    return {
      host: credentials.host,
      port: credentials.port,
      database: credentials.dbname,
      user: credentials.username,
      password: credentials.password,
      ssl: {
        rejectUnauthorized: false
      }
    };
  } catch (error) {
    console.error('❌ Failed to retrieve database credentials:', error.message);
    throw error;
  }
}

async function connectToDatabase(config) {
  try {
    console.log('🔗 Connecting to RDS PostgreSQL database...');
    console.log(`📍 Host: ${config.host}`);
    console.log(`🗄️  Database: ${config.database}`);
    
    const pool = new Pool(config);
    
    // Test connection
    const client = await pool.connect();
    const result = await client.query('SELECT NOW(), version()');
    console.log('✅ Database connection successful');
    console.log(`📅 Database time: ${result.rows[0].now}`);
    console.log(`🔧 PostgreSQL version: ${result.rows[0].version.split(' ')[1]}`);
    client.release();
    
    return pool;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    throw error;
  }
}

async function runSqlFile(pool, filePath) {
  try {
    console.log(`📄 Running SQL file: ${path.basename(filePath)}`);
    const sql = await fs.readFile(filePath, 'utf8');
    
    // Split SQL into individual statements (simple approach)
    const statements = sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    for (const statement of statements) {
      if (statement.trim()) {
        await pool.query(statement);
      }
    }
    
    console.log(`✅ Successfully executed ${path.basename(filePath)}`);
  } catch (error) {
    console.error(`❌ Error running ${path.basename(filePath)}:`, error.message);
    // Don't throw error for migration files that might have already been run
    if (!error.message.includes('already exists')) {
      throw error;
    } else {
      console.log(`⚠️  ${path.basename(filePath)} - Some objects already exist, continuing...`);
    }
  }
}

async function checkIfTableExists(pool, tableName) {
  try {
    const result = await pool.query(
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1)",
      [tableName]
    );
    return result.rows[0].exists;
  } catch (error) {
    console.error(`Error checking table ${tableName}:`, error.message);
    return false;
  }
}

async function runMigrations() {
  let pool;
  
  try {
    // Get database credentials
    const dbConfig = await getDatabaseCredentials();
    
    // Connect to database
    pool = await connectToDatabase(dbConfig);
    
    // Check if schema already exists
    const tablesExist = await checkIfTableExists(pool, 'users');
    
    if (!tablesExist) {
      console.log('🏗️  Running initial schema setup...');
      await runSqlFile(pool, path.join(__dirname, '..', '..', 'database', 'schema.sql'));
    } else {
      console.log('✅ Base schema already exists, skipping initial setup');
    }
    
    // Run migrations in order
    const migrationFiles = [
      'add-updated-at-to-prompts.sql',
      'add-batch-id-to-invoices.sql', 
      'create-batch-processing-tables.sql',
      'add-export-system-tables.sql',
      'enhance-export-analytics.sql',
      'update-export-template-fields.sql'
    ];
    
    console.log('🚀 Running database migrations...');
    for (const migrationFile of migrationFiles) {
      const migrationPath = path.join(__dirname, '..', 'migrations', migrationFile);
      
      try {
        await fs.access(migrationPath);
        await runSqlFile(pool, migrationPath);
      } catch (error) {
        if (error.code === 'ENOENT') {
          console.log(`⚠️  Migration file not found: ${migrationFile}, skipping...`);
        } else if (error.message && !error.message.includes('already exists')) {
          throw error;
        }
      }
    }
    
    // Insert demo user if it doesn't exist
    console.log('👤 Setting up demo user...');
    await pool.query(`
      INSERT INTO users (email, password_hash, name, is_active, created_at) 
      VALUES ('demo@waterfield.tech', '$2b$10$rRGVgzW1Y8/6v/jx6f5C6ux8jQXtM5A.kFzZzLJ4zPc2z4kZxmEDu', 'Demo User', true, CURRENT_TIMESTAMP)
      ON CONFLICT (email) DO NOTHING
    `);
    
    // Verify tables were created
    console.log('🔍 Verifying database schema...');
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('📋 Created tables:');
    tables.rows.forEach(row => {
      console.log(`   ✅ ${row.table_name}`);
    });
    
    // Check record counts
    const userCount = await pool.query('SELECT COUNT(*) FROM users');
    const vendorCount = await pool.query('SELECT COUNT(*) FROM vendors');
    
    console.log('');
    console.log('🎉 Database migration completed successfully!');
    console.log('');
    console.log('📊 Database Summary:');
    console.log(`   🗄️  Database: ${dbConfig.database}`);
    console.log(`   📍 Host: ${dbConfig.host}`);
    console.log(`   📋 Tables: ${tables.rows.length}`);
    console.log(`   👤 Users: ${userCount.rows[0].count}`);
    console.log(`   🏢 Vendors: ${vendorCount.rows[0].count}`);
    console.log('');
    console.log('✨ RDS PostgreSQL is ready for App Runner connection!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

// Run migrations
if (require.main === module) {
  runMigrations();
}