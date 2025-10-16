const AWS = require('aws-sdk');

/**
 * Storage configuration for environment-based file handling
 * Development: Local filesystem storage
 * Production: AWS S3 storage with CDK-generated bucket names
 */

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

// Storage configuration per environment
const storageConfig = {
  development: {
    type: 'local',
    uploadPath: './uploads',
    baseUrl: 'http://localhost:5001/uploads'
  },
  production: {
    type: 's3',
    region: process.env.AWS_REGION || 'us-east-1',
    filesBucket: process.env.S3_BUCKET_FILES,
    exportsBucket: process.env.S3_BUCKET_EXPORTS,
    baseUrl: `https://${process.env.CDK_CLOUDFRONT_DOMAIN}/files`
  }
};

// Get current environment config
const getCurrentConfig = () => {
  if (isProduction) {
    // Validate required environment variables for production
    const requiredVars = ['S3_BUCKET_FILES', 'S3_BUCKET_EXPORTS', 'CDK_CLOUDFRONT_DOMAIN'];
    const missing = requiredVars.filter(varName => !process.env[varName]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables for production: ${missing.join(', ')}`);
    }
    
    return storageConfig.production;
  }
  
  return storageConfig.development;
};

// Initialize AWS S3 client for production
const getS3Client = () => {
  if (!isProduction) {
    return null;
  }
  
  return new AWS.S3({
    region: process.env.AWS_REGION || 'us-east-1',
    // Credentials will be automatically provided by App Runner IAM role
  });
};

module.exports = {
  isProduction,
  isDevelopment,
  storageConfig,
  getCurrentConfig,
  getS3Client
};