const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function runMigrations() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Starting database migrations...');
    
    // Read and execute batch processing tables migration
    const createTablesSQL = await fs.readFile(
      path.join(__dirname, '../migrations/create-batch-processing-tables.sql'),
      'utf-8'
    );
    
    console.log('📝 Creating batch processing tables...');
    await client.query(createTablesSQL);
    console.log('✅ Batch processing tables created successfully');
    
    // Read and execute batch_id column addition
    const addBatchIdSQL = await fs.readFile(
      path.join(__dirname, '../migrations/add-batch-id-to-invoices.sql'),
      'utf-8'
    );
    
    console.log('📝 Adding batch_id column to invoices table...');
    await client.query(addBatchIdSQL);
    console.log('✅ Added batch_id column successfully');
    
    console.log('🎉 All migrations completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    
    // If tables already exist, that's okay
    if (error.message.includes('already exists')) {
      console.log('ℹ️  Tables already exist, continuing...');
    } else {
      throw error;
    }
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migrations
runMigrations()
  .then(() => {
    console.log('✨ Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration script failed:', error);
    process.exit(1);
  });