const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

async function runExportMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' 
      ? { rejectUnauthorized: false } 
      : false
  });

  try {
    console.log('🚀 Starting export system migration...');
    
    // Read the export migration file
    const migrationPath = path.join(__dirname, '../migrations/add-export-system-tables.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Export migration file loaded');
    
    // Check if tables already exist
    const checkQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('export_templates', 'export_logs');
    `;
    
    const existingTables = await pool.query(checkQuery);
    
    if (existingTables.rows.length > 0) {
      console.log('ℹ️ Export tables already exist. Skipping migration.');
      return;
    }
    
    // Execute the migration
    await pool.query(migrationSql);
    
    console.log('✅ Export system migration completed successfully!');
    console.log('📊 Export tables and default templates have been created');
    
  } catch (error) {
    console.error('❌ Export migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  runExportMigration();
}

module.exports = { runExportMigration };