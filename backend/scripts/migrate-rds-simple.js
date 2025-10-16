#!/usr/bin/env node

/**
 * Simple RDS Database Migration Script
 * Uses direct database credentials to run schema and migrations
 */

const fs = require('fs').promises;
const path = require('path');
const { Pool } = require('pg');

// Database configuration (from Secrets Manager)
const dbConfig = {
  host: 'invoiceprocessing-dev-postgresdb113281d2-jhep9rqfyvcl.cvdm9yyy7eha.us-east-1.rds.amazonaws.com',
  port: 5432,
  database: 'invoice_processing',
  user: 'postgres',
  password: "O)^B%TVWmq5aEF'P{![3QLjl#4KL:<XN",
  ssl: {
    rejectUnauthorized: false
  },
  max: 5,
  connectionTimeoutMillis: 10000
};

async function connectToDatabase() {
  try {
    console.log('🔗 Connecting to RDS PostgreSQL database...');
    console.log(`📍 Host: ${dbConfig.host}`);
    console.log(`🗄️  Database: ${dbConfig.database}`);
    
    const pool = new Pool(dbConfig);
    
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
    
    // Handle CREATE EXTENSION separately 
    if (sql.includes('CREATE EXTENSION')) {
      const extensionMatch = sql.match(/CREATE EXTENSION IF NOT EXISTS "(.*?)"/);
      if (extensionMatch) {
        try {
          await pool.query(`CREATE EXTENSION IF NOT EXISTS "${extensionMatch[1]}"`);
          console.log(`✅ Extension ${extensionMatch[1]} enabled`);
        } catch (error) {
          if (!error.message.includes('already exists')) {
            console.log(`⚠️  Extension ${extensionMatch[1]}: ${error.message}`);
          }
        }
      }
    }
    
    // Split SQL into individual statements
    const statements = sql
      .replace(/CREATE EXTENSION IF NOT EXISTS.*?;/g, '') // Remove extension statements
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await pool.query(statement);
        } catch (error) {
          if (error.message.includes('already exists') || error.message.includes('duplicate key')) {
            console.log(`⚠️  Skipping existing object: ${error.message.split(':')[0]}`);
          } else {
            throw error;
          }
        }
      }
    }
    
    console.log(`✅ Successfully executed ${path.basename(filePath)}`);
  } catch (error) {
    console.error(`❌ Error running ${path.basename(filePath)}:`, error.message);
    throw error;
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
    // Connect to database
    pool = await connectToDatabase();
    
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
        } else {
          console.error(`❌ Migration error in ${migrationFile}:`, error.message);
        }
      }
    }
    
    // Insert demo user if it doesn't exist
    console.log('👤 Setting up demo user...');
    try {
      await pool.query(`
        INSERT INTO users (email, password_hash, name, is_active, created_at) 
        VALUES ('demo@waterfield.tech', '$2b$10$rRGVgzW1Y8/6v/jx6f5C6ux8jQXtM5A.kFzZzLJ4zPc2z4kZxmEDu', 'Demo User', true, CURRENT_TIMESTAMP)
        ON CONFLICT (email) DO NOTHING
      `);
      console.log('✅ Demo user configured');
    } catch (error) {
      console.log('⚠️  Demo user setup:', error.message);
    }
    
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
    let vendorCount = { rows: [{ count: 0 }] };
    try {
      vendorCount = await pool.query('SELECT COUNT(*) FROM vendors');
    } catch (error) {
      console.log('⚠️  Vendors table not accessible');
    }
    
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
    console.error('Stack trace:', error.stack);
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