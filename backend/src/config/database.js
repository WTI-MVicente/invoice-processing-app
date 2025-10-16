const { Pool } = require('pg');
const { 
  isProduction, 
  getCurrentEnvironment, 
  getProductionConnectionString,
  validateProductionEnvironment,
  logEnvironmentInfo 
} = require('./environment');

// Initialize database connection based on environment
let pool;

const initializeDatabase = async () => {
  try {
    // Validate environment configuration
    if (!validateProductionEnvironment()) {
      throw new Error('Invalid production environment configuration');
    }
    
    const envConfig = getCurrentEnvironment();
    let poolConfig;
    
    if (isProduction) {
      // Production: Use RDS with Secrets Manager credentials
      const connectionString = await getProductionConnectionString();
      poolConfig = {
        connectionString,
        ssl: envConfig.database.ssl,
        ...envConfig.database.pool
      };
      console.log('🏭 Initializing production database connection (RDS)');
    } else {
      // Development: Use local PostgreSQL
      poolConfig = {
        connectionString: envConfig.database.connectionString,
        ssl: envConfig.database.ssl,
        ...envConfig.database.pool
      };
      console.log('🛠️  Initializing development database connection (Local)');
    }
    
    pool = new Pool(poolConfig);
    
    // Connection event handlers
    pool.on('connect', () => {
      console.log('🗄️  Connected to PostgreSQL database');
    });
    
    pool.on('error', (err) => {
      console.error('❌ Database connection error:', err);
      process.exit(-1);
    });
    
    return pool;
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    throw error;
  }
};

// Legacy poolConfig for backward compatibility
let poolConfig = {
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'waterfield2025',
  database: 'invoice_processing_db',
  ssl: false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Initialize with legacy config for backward compatibility
// This will be replaced by initializeDatabase() call in server.js
pool = new Pool(poolConfig);

// Get or create the database pool
const getPool = () => {
  if (!pool) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return pool;
};

// Test database connection
const testConnection = async () => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    console.log('✅ Database connection test successful');
    console.log('📅 Database time:', result.rows[0].now);
    client.release();
  } catch (err) {
    console.error('❌ Database connection test failed:', err.message);
    throw err;
  }
};

// Query helper function with error handling
const query = async (text, params = []) => {
  const start = Date.now();
  const currentPool = getPool();
  try {
    const result = await currentPool.query(text, params);
    const duration = Date.now() - start;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 Query executed:', {
        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        duration: `${duration}ms`,
        rows: result.rowCount
      });
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    console.error('❌ Query error:', {
      text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      duration: `${duration}ms`,
      error: error.message
    });
    throw error;
  }
};

// Transaction helper
const transaction = async (callback) => {
  const currentPool = getPool();
  const client = await currentPool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  initializeDatabase,
  getPool,
  pool, // Legacy export for backward compatibility  
  query,
  transaction,
  testConnection
};