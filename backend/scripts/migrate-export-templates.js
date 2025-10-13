const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

async function runExportTemplateMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' 
      ? { rejectUnauthorized: false } 
      : false
  });

  try {
    console.log('🚀 Starting export template field migration...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '../migrations/update-export-template-fields.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Template migration file loaded');
    
    // Execute the migration
    await pool.query(migrationSql);
    
    console.log('✅ Export template migration completed successfully!');
    console.log('🔄 Updated: Financial Summary Export with correct tax field');
    console.log('🔄 Updated: Audit Trail Export with comprehensive fields');
    console.log('➕ Added: New Comprehensive Export template');
    
    // Verify templates exist
    const result = await pool.query('SELECT name, description FROM export_templates WHERE is_public = true ORDER BY name');
    console.log('📋 Available templates:');
    result.rows.forEach(template => {
      console.log(`   • ${template.name}: ${template.description}`);
    });
    
  } catch (error) {
    console.error('❌ Template migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  runExportTemplateMigration();
}

module.exports = { runExportTemplateMigration };