const fs = require('fs').promises;
const path = require('path');
const { 
  isProduction, 
  getCurrentEnvironment, 
  getS3Client 
} = require('../config/environment');

/**
 * File Service - Environment-based file handling
 * Development: Local filesystem storage
 * Production: AWS S3 storage with CloudFront URLs
 */

class FileService {
  constructor() {
    this.config = getCurrentEnvironment();
    this.s3Client = getS3Client();
    
    console.log(`📁 File Service initialized for ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
    
    if (!isProduction) {
      // Ensure uploads directory exists for local development
      this.ensureUploadDirectory();
    }
  }

  /**
   * Ensure upload directory exists (development only)
   */
  async ensureUploadDirectory() {
    try {
      await fs.access(this.config.storage.uploadPath);
    } catch (error) {
      await fs.mkdir(this.config.storage.uploadPath, { recursive: true });
      console.log('📁 Created uploads directory:', this.config.storage.uploadPath);
    }
  }

  /**
   * Save file - automatically chooses local or S3 based on environment
   * @param {Buffer|string} fileContent - File content or file path
   * @param {string} filename - Target filename
   * @param {string} subfolder - Optional subfolder (invoices, exports, etc.)
   * @returns {Promise<string>} - File path/key
   */
  async saveFile(fileContent, filename, subfolder = '') {
    if (isProduction) {
      return await this.saveToS3(fileContent, filename, subfolder);
    } else {
      return await this.saveToLocal(fileContent, filename, subfolder);
    }
  }

  /**
   * Get file URL - returns local URL or CloudFront URL
   * @param {string} filename - Filename or S3 key
   * @param {string} subfolder - Optional subfolder
   * @returns {string} - Accessible file URL
   */
  getFileUrl(filename, subfolder = '') {
    if (isProduction) {
      return this.getS3Url(filename, subfolder);
    } else {
      return this.getLocalUrl(filename, subfolder);
    }
  }

  /**
   * Delete file - removes from local storage or S3
   * @param {string} filename - Filename or S3 key
   * @param {string} subfolder - Optional subfolder
   * @returns {Promise<boolean>} - Success status
   */
  async deleteFile(filename, subfolder = '') {
    try {
      if (isProduction) {
        return await this.deleteFromS3(filename, subfolder);
      } else {
        return await this.deleteFromLocal(filename, subfolder);
      }
    } catch (error) {
      console.error('❌ Error deleting file:', error);
      return false;
    }
  }

  /**
   * Check if file exists
   * @param {string} filename - Filename or S3 key
   * @param {string} subfolder - Optional subfolder
   * @returns {Promise<boolean>} - File existence status
   */
  async fileExists(filename, subfolder = '') {
    try {
      if (isProduction) {
        return await this.s3FileExists(filename, subfolder);
      } else {
        return await this.localFileExists(filename, subfolder);
      }
    } catch (error) {
      return false;
    }
  }

  // ===================
  // LOCAL FILE METHODS
  // ===================

  /**
   * Save file to local filesystem
   */
  async saveToLocal(fileContent, filename, subfolder = '') {
    const targetDir = subfolder 
      ? path.join(this.config.storage.uploadPath, subfolder)
      : this.config.storage.uploadPath;
    
    // Ensure target directory exists
    await fs.mkdir(targetDir, { recursive: true });
    
    const filePath = path.join(targetDir, filename);
    
    if (Buffer.isBuffer(fileContent)) {
      await fs.writeFile(filePath, fileContent);
    } else if (typeof fileContent === 'string' && fileContent.startsWith('/')) {
      // Copy from source file
      await fs.copyFile(fileContent, filePath);
    } else {
      await fs.writeFile(filePath, fileContent);
    }
    
    console.log('💾 File saved locally:', filePath);
    return filePath;
  }

  /**
   * Get local file URL
   */
  getLocalUrl(filename, subfolder = '') {
    const urlPath = subfolder ? `${subfolder}/${filename}` : filename;
    return `${this.config.storage.baseUrl}/${urlPath}`;
  }

  /**
   * Delete file from local filesystem
   */
  async deleteFromLocal(filename, subfolder = '') {
    const filePath = subfolder
      ? path.join(this.config.storage.uploadPath, subfolder, filename)
      : path.join(this.config.storage.uploadPath, filename);
    
    try {
      await fs.unlink(filePath);
      console.log('🗑️  File deleted locally:', filePath);
      return true;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
      return false;
    }
  }

  /**
   * Check if local file exists
   */
  async localFileExists(filename, subfolder = '') {
    const filePath = subfolder
      ? path.join(this.config.storage.uploadPath, subfolder, filename)
      : path.join(this.config.storage.uploadPath, filename);
    
    try {
      await fs.access(filePath);
      return true;
    } catch (error) {
      return false;
    }
  }

  // ================
  // S3 FILE METHODS  
  // ================

  /**
   * Save file to S3
   */
  async saveToS3(fileContent, filename, subfolder = '') {
    if (!this.s3Client) {
      throw new Error('S3 client not initialized for production environment');
    }

    // Determine the appropriate bucket
    const bucket = subfolder === 'exports' 
      ? this.config.storage.exportsBucket 
      : this.config.storage.filesBucket;
    
    const s3Key = subfolder ? `${subfolder}/${filename}` : filename;
    
    // Prepare file content
    let body;
    if (Buffer.isBuffer(fileContent)) {
      body = fileContent;
    } else if (typeof fileContent === 'string' && fileContent.startsWith('/')) {
      // Read from source file
      body = await fs.readFile(fileContent);
    } else {
      body = Buffer.from(fileContent);
    }

    const uploadParams = {
      Bucket: bucket,
      Key: s3Key,
      Body: body,
      ContentType: this.getContentType(filename),
      ServerSideEncryption: 'AES256'
    };

    try {
      const result = await this.s3Client.upload(uploadParams).promise();
      console.log('☁️  File uploaded to S3:', result.Location);
      return s3Key;
    } catch (error) {
      console.error('❌ S3 upload failed:', error);
      throw new Error(`Failed to upload file to S3: ${error.message}`);
    }
  }

  /**
   * Get S3 file URL (via CloudFront)
   */
  getS3Url(filename, subfolder = '') {
    const path = subfolder ? `${subfolder}/${filename}` : filename;
    
    if (subfolder === 'exports') {
      return `https://${process.env.CDK_CLOUDFRONT_DOMAIN}/exports/${filename}`;
    } else {
      return `https://${process.env.CDK_CLOUDFRONT_DOMAIN}/files/${filename}`;
    }
  }

  /**
   * Delete file from S3
   */
  async deleteFromS3(filename, subfolder = '') {
    if (!this.s3Client) {
      throw new Error('S3 client not initialized for production environment');
    }

    const bucket = subfolder === 'exports' 
      ? this.config.storage.exportsBucket 
      : this.config.storage.filesBucket;
    
    const s3Key = subfolder ? `${subfolder}/${filename}` : filename;

    try {
      await this.s3Client.deleteObject({
        Bucket: bucket,
        Key: s3Key
      }).promise();
      
      console.log('🗑️  File deleted from S3:', s3Key);
      return true;
    } catch (error) {
      console.error('❌ S3 deletion failed:', error);
      return false;
    }
  }

  /**
   * Check if S3 file exists
   */
  async s3FileExists(filename, subfolder = '') {
    if (!this.s3Client) {
      return false;
    }

    const bucket = subfolder === 'exports' 
      ? this.config.storage.exportsBucket 
      : this.config.storage.filesBucket;
    
    const s3Key = subfolder ? `${subfolder}/${filename}` : filename;

    try {
      await this.s3Client.headObject({
        Bucket: bucket,
        Key: s3Key
      }).promise();
      return true;
    } catch (error) {
      return false;
    }
  }

  // =============
  // HELPER METHODS
  // =============

  /**
   * Get content type based on file extension
   */
  getContentType(filename) {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.html': 'text/html',
      '.htm': 'text/html',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.csv': 'text/csv',
      '.zip': 'application/zip',
      '.json': 'application/json',
      '.txt': 'text/plain'
    };
    
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Generate unique filename with timestamp
   */
  generateUniqueFilename(originalFilename) {
    const timestamp = Date.now();
    const ext = path.extname(originalFilename);
    const name = path.basename(originalFilename, ext);
    return `${name}-${timestamp}${ext}`;
  }

  /**
   * Get environment info
   */
  getInfo() {
    return {
      environment: isProduction ? 'production' : 'development',
      storage: this.config.storage.type,
      baseUrl: this.config.storage.baseUrl,
      buckets: isProduction ? {
        files: this.config.storage.filesBucket,
        exports: this.config.storage.exportsBucket
      } : null
    };
  }
}

// Export singleton instance
module.exports = new FileService();