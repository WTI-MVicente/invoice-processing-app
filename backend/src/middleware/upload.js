const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Ensure uploads directory exists
const ensureUploadDir = async () => {
  const uploadDir = path.join(__dirname, '../../uploads');
  try {
    await fs.access(uploadDir);
  } catch (error) {
    await fs.mkdir(uploadDir, { recursive: true });
    console.log('📁 Created uploads directory');
  }
};

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      await ensureUploadDir();
      const uploadPath = path.join(__dirname, '../../uploads');
      cb(null, uploadPath);
    } catch (error) {
      cb(error, null);
    }
  },
  filename: (req, file, cb) => {
    // Create unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, extension);
    const cleanBaseName = baseName.replace(/[^a-zA-Z0-9]/g, '_');
    cb(null, `${cleanBaseName}_${uniqueSuffix}${extension}`);
  }
});

// File filter to only allow PDF and HTML files
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['application/pdf', 'text/html', 'application/octet-stream'];
  const allowedExtensions = ['.pdf', '.html', '.htm'];
  
  const extension = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(extension)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Only PDF and HTML files are allowed. Got: ${file.mimetype} with extension ${extension}`), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB default
    files: 10 // Maximum 10 files per request
  }
});

// Middleware for single file upload
const uploadSingle = (fieldName = 'invoice') => {
  return (req, res, next) => {
    const singleUpload = upload.single(fieldName);
    
    singleUpload(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ 
            error: 'File too large. Maximum size is 10MB.' 
          });
        }
        return res.status(400).json({ 
          error: `Upload error: ${err.message}` 
        });
      } else if (err) {
        return res.status(400).json({ 
          error: err.message 
        });
      }
      
      if (!req.file) {
        return res.status(400).json({ 
          error: 'No file uploaded' 
        });
      }
      
      console.log(`📄 File uploaded: ${req.file.originalname} -> ${req.file.filename}`);
      next();
    });
  };
};

// Middleware for multiple file upload
const uploadMultiple = (fieldName = 'invoices', maxCount = 10) => {
  return (req, res, next) => {
    const multipleUpload = upload.array(fieldName, maxCount);
    
    multipleUpload(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ 
            error: 'One or more files are too large. Maximum size is 10MB per file.' 
          });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({ 
            error: `Too many files. Maximum is ${maxCount} files.` 
          });
        }
        return res.status(400).json({ 
          error: `Upload error: ${err.message}` 
        });
      } else if (err) {
        return res.status(400).json({ 
          error: err.message 
        });
      }
      
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ 
          error: 'No files uploaded' 
        });
      }
      
      console.log(`📄 Files uploaded: ${req.files.length} files`);
      req.files.forEach(file => {
        console.log(`  - ${file.originalname} -> ${file.filename}`);
      });
      
      next();
    });
  };
};

// Helper function to get file type from extension
const getFileType = (filename) => {
  const extension = path.extname(filename).toLowerCase();
  if (extension === '.pdf') return 'PDF';
  if (extension === '.html' || extension === '.htm') return 'HTML';
  return 'UNKNOWN';
};

// Helper function to read uploaded file content using pdf-text-extract
const readFileContent = async (filePath) => {
  try {
    const extension = path.extname(filePath).toLowerCase();
    
    if (extension === '.pdf') {
      // Read PDF file and extract text using pdf-parse (following implementation guide)
      console.log('📖 Reading PDF content with pdf-parse...');
      const pdf = require('pdf-parse');
      
      // Read file as buffer
      const dataBuffer = await fs.readFile(filePath);
      
      // Parse PDF
      const pdfData = await pdf(dataBuffer);
      
      // Extract text content
      const textContent = pdfData.text;
      
      if (!textContent || textContent.trim().length === 0) {
        throw new Error('PDF appears to be empty or could not extract text');
      }
      
      console.log(`📄 Extracted ${textContent.length} characters from PDF (${pdfData.numpages} pages)`);
      return textContent.trim();
      
    } else if (extension === '.html' || extension === '.htm') {
      // Read HTML file as text
      console.log('📖 Reading HTML content...');
      const content = await fs.readFile(filePath, 'utf8');
      
      if (!content || content.trim().length === 0) {
        throw new Error('HTML file appears to be empty');
      }
      
      console.log(`📄 Read ${content.length} characters from HTML`);
      return content;
      
    } else {
      throw new Error(`Unsupported file type: ${extension}`);
    }
    
  } catch (error) {
    console.error('❌ Error reading file:', error);
    throw new Error(`Failed to read uploaded file: ${error.message}`);
  }
};

// Helper function to clean up uploaded file
const deleteFile = async (filePath) => {
  try {
    await fs.unlink(filePath);
    console.log(`🗑️ Deleted file: ${filePath}`);
  } catch (error) {
    console.error('❌ Error deleting file:', error);
  }
};

module.exports = {
  uploadSingle,
  uploadMultiple,
  getFileType,
  readFileContent,
  deleteFile,
  ensureUploadDir
};