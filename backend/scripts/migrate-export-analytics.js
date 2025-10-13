const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

async function runExportAnalyticsMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' 
      ? { rejectUnauthorized: false } 
      : false
  });

  try {
    console.log('🚀 Starting export analytics enhancement migration...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '../migrations/enhance-export-analytics.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Export analytics migration file loaded');
    
    // Check if migration already applied
    const checkQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'export_logs' 
      AND column_name = 'success';
    `;
    
    const existingColumns = await pool.query(checkQuery);
    
    if (existingColumns.rows.length > 0) {
      console.log('ℹ️ Export analytics enhancement already applied. Skipping migration.');
      return;
    }
    
    // Execute the migration
    await pool.query(migrationSql);
    
    console.log('✅ Export analytics enhancement migration completed successfully!');
    console.log('📊 Added: success tracking, error logging, user analytics, template usage metrics');
    console.log('📈 Created: export_analytics view for dashboard insights');
    
  } catch (error) {
    console.error('❌ Export analytics migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  runExportAnalyticsMigration();
}

module.exports = { runExportAnalyticsMigration };