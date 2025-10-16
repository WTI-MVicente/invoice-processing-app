const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { initializeDatabase, testConnection } = require('./config/database');
const { 
  logEnvironmentInfo, 
  getCurrentEnvironment,
  isProduction 
} = require('./config/environment');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001;

// Get environment configuration
const envConfig = getCurrentEnvironment();

// Trust proxy for rate limiting (fixes X-Forwarded-For warnings)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Rate limiting - more permissive in development
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || (process.env.NODE_ENV === 'development' ? 1000 : 100), // 1000 for dev, 100 for prod
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for development if desired  
  skip: (req, res) => process.env.NODE_ENV === 'development' // Skip all rate limiting in development
});
app.use('/api', limiter);

// CORS configuration - use environment-based config
app.use(cors(envConfig.api.cors));

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static file serving for uploads (development only)
if (!isProduction) {
  app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/vendors', require('./routes/vendors'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/batches', require('./routes/batches'));
app.use('/api/test', require('./routes/test'));
// app.use('/api/customers', require('./routes/customers'));
app.use('/api/prompts', require('./routes/prompts'));
app.use('/api/exports', require('./routes/exports'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ 
      error: 'Invalid JSON payload' 
    });
  }
  
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ 
      error: 'File too large. Maximum size is 10MB.' 
    });
  }
  
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  
  // Log environment configuration
  logEnvironmentInfo();
  
  console.log(`🔗 Health check: ${envConfig.api.baseUrl}/api/health`);
  
  // Initialize database with environment-based configuration
  try {
    await initializeDatabase();
    await testConnection();
    console.log('✅ Database initialization completed');
    
    // Run production database setup if needed
    if (isProduction) {
      const { initializeProductionDatabase } = require('./startup/database-init');
      await initializeProductionDatabase();
    }
  } catch (error) {
    console.error('❌ Failed to initialize database on startup:', error.message);
    process.exit(1);
  }
});