const AWS = require('aws-sdk');

/**
 * Environment-based configuration for Invoice Processing App
 * Handles local development vs AWS production environments
 */

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

// Environment configurations
const environments = {
  development: {
    // Database
    database: {
      type: 'local',
      connectionString: process.env.DATABASE_URL || 'postgresql://waterfield_user:waterfield2025@localhost:5432/invoice_processing',
      ssl: false,
      pool: {
        min: 2,
        max: 10,
        idleTimeoutMillis: 30000
      }
    },
    
    // File Storage
    storage: {
      type: 'local',
      uploadPath: './uploads',
      baseUrl: 'http://localhost:5001/uploads'
    },
    
    // API Configuration
    api: {
      baseUrl: 'http://localhost:5001',
      cors: {
        origin: 'http://localhost:3000',
        credentials: true
      }
    }
  },
  
  production: {
    // Database - Uses RDS with Secrets Manager
    database: {
      type: 'rds',
      secretArn: process.env.DATABASE_SECRET_ARN,
      endpoint: process.env.DATABASE_ENDPOINT,
      ssl: {
        rejectUnauthorized: false // AWS RDS uses SSL with AWS certificates
      },
      pool: {
        min: 2,
        max: 20,
        idleTimeoutMillis: 30000,
        acquireTimeoutMillis: 60000
      }
    },
    
    // Storage - Uses S3 with CloudFront
    storage: {
      type: 's3',
      region: process.env.AWS_REGION || 'us-east-1',
      filesBucket: process.env.S3_BUCKET_FILES,
      exportsBucket: process.env.S3_BUCKET_EXPORTS,
      baseUrl: `https://${process.env.CDK_CLOUDFRONT_DOMAIN}/files`
    },
    
    // API Configuration
    api: {
      baseUrl: process.env.APP_RUNNER_URL,
      cors: {
        origin: `https://${process.env.CDK_CLOUDFRONT_DOMAIN}`,
        credentials: true
      }
    }
  }
};

// Get current environment configuration
const getCurrentEnvironment = () => {
  return isProduction ? environments.production : environments.development;
};

// Validate required environment variables for production
const validateProductionEnvironment = () => {
  if (!isProduction) return true;
  
  const requiredVars = [
    'DATABASE_SECRET_ARN',
    'DATABASE_ENDPOINT', 
    'S3_BUCKET_FILES',
    'S3_BUCKET_EXPORTS',
    'CDK_CLOUDFRONT_DOMAIN',
    'AWS_REGION'
  ];
  
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables for production:', missing);
    return false;
  }
  
  console.log('✅ All required production environment variables are set');
  return true;
};

// Get database credentials from AWS Secrets Manager (production only)
const getDatabaseCredentials = async () => {
  if (!isProduction) {
    return null;
  }
  
  const config = getCurrentEnvironment();
  if (!config.database.secretArn) {
    throw new Error('DATABASE_SECRET_ARN is required for production database connection');
  }
  
  const secretsManager = new AWS.SecretsManager({
    region: process.env.AWS_REGION || 'us-east-1'
  });
  
  try {
    console.log('🔐 Retrieving database credentials from Secrets Manager...');
    const secret = await secretsManager.getSecretValue({
      SecretId: config.database.secretArn
    }).promise();
    
    const credentials = JSON.parse(secret.SecretString);
    console.log('✅ Database credentials retrieved successfully');
    return credentials;
  } catch (error) {
    console.error('❌ Failed to retrieve database credentials:', error.message);
    throw new Error('Unable to connect to production database - credentials unavailable');
  }
};

// Build production database connection string
const getProductionConnectionString = async () => {
  const credentials = await getDatabaseCredentials();
  const config = getCurrentEnvironment();
  
  if (!config.database.endpoint) {
    throw new Error('DATABASE_ENDPOINT is required for production database connection');
  }
  
  return `postgresql://${credentials.username}:${credentials.password}@${config.database.endpoint}:5432/invoice_processing`;
};

// Get S3 client for production
const getS3Client = () => {
  if (!isProduction) {
    return null;
  }
  
  return new AWS.S3({
    region: process.env.AWS_REGION || 'us-east-1'
    // IAM role credentials will be provided automatically by App Runner
  });
};

// Environment info logging
const logEnvironmentInfo = () => {
  const config = getCurrentEnvironment();
  
  console.log('\n🌍 Environment Configuration:');
  console.log(`📊 Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
  console.log(`🗄️  Database: ${config.database.type.toUpperCase()}`);
  console.log(`📁 Storage: ${config.storage.type.toUpperCase()}`);
  
  if (isProduction) {
    console.log(`🌐 API: ${config.api.baseUrl || 'App Runner URL'}`);
    console.log(`📡 CDN: https://${process.env.CDK_CLOUDFRONT_DOMAIN}`);
    console.log(`🪣 Files Bucket: ${process.env.S3_BUCKET_FILES}`);
    console.log(`📤 Exports Bucket: ${process.env.S3_BUCKET_EXPORTS}`);
  } else {
    console.log(`🌐 API: ${config.api.baseUrl}`);
    console.log(`📁 Upload Path: ${config.storage.uploadPath}`);
  }
  console.log('');
};

module.exports = {
  isProduction,
  isDevelopment,
  environments,
  getCurrentEnvironment,
  validateProductionEnvironment,
  getDatabaseCredentials,
  getProductionConnectionString,
  getS3Client,
  logEnvironmentInfo
};