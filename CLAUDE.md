# Claude Code Memory - Invoice Processing App

## Project Overview
AI-powered invoice processing application for Waterfield Technologies built with Node.js, React, and Claude API integration.

## Architecture
- **Backend**: Node.js + Express + PostgreSQL (Port 5001)
- **Frontend**: React 18 + Material-UI (Port 3000)
- **AI**: Claude API for document data extraction
- **Database**: PostgreSQL with comprehensive schema
- **Authentication**: JWT-based with auto-demo user

## Key Features Implemented

### 🔧 PDF Processing & AI Integration
- **PDF Parsing**: Uses `pdf-parse@1.1.1` library for text extraction
- **Claude Integration**: Structured data extraction with confidence scoring
- **Temperature Control**: Set to 0.1 for consistent AI responses
- **Error Handling**: Robust JSON parsing with fallback strategies
- **File Support**: PDF and HTML document processing

### 🎛️ User Interface & Navigation
- **Split-Screen Review**: PDF viewer + extracted data editor
- **Navigation System**: Back/Next buttons with auto-advance on approve
- **Smart Status**: Auto-switches to pending reviews when available
- **Responsive Dialogs**: 95vw width for optimal document viewing
- **Clear View**: Filter reset functionality

### 📊 Data Management
- **Review & Approve Page**: Workflow-focused invoice processing with batch filtering
- **Invoices Page**: Complete data management with view/delete and batch tracking
- **Prompts Page**: AI prompt management with real-time testing
- **Statistics Cards**: Total, Pending, Approved, Rejected counts
- **Vendor Management**: Full CRUD operations
- **Permanent Deletion**: Removes database records and files

### 🚀 Batch Processing System
- **Multi-File Import**: Drag-and-drop interface with folder selection support
- **Real-Time Monitoring**: Live progress tracking with file-level status updates
- **Batch Management**: Complete history view with filtering and status tracking
- **Performance Optimized**: 80% reduction in API calls through smart polling
- **Error Recovery**: Comprehensive error handling with rate limiting protection
- **Database Transactions**: Incremental commits for immediate UI feedback

## Technical Implementation

### Database Schema
```sql
-- Core tables
invoices (id UUID PRIMARY KEY)
line_items (invoice_id references invoices)
vendors (id UUID PRIMARY KEY)
customers (customer accounts)

-- Batch processing tables
processing_batches (id UUID PRIMARY KEY)
batch_files (batch_id references processing_batches, invoice_id references invoices)
```

### API Endpoints Structure
```
/api/auth/*        - Authentication endpoints
/api/vendors/*     - Vendor management
/api/invoices/*    - Invoice CRUD operations with batch filtering
/api/invoices/:id/file - PDF/HTML file serving
/api/batches/*     - Batch processing CRUD operations
/api/batches/:id/progress - Real-time batch progress tracking
/api/batches/:id/process - Start batch processing workflow
/api/batches/names - Batch filtering support
/api/prompts/*     - Prompts CRUD operations
/api/prompts/:id/test-upload - File upload for testing
/api/prompts/:id/test-run - Claude AI prompt testing
```

### File Structure
```
backend/
├── src/
│   ├── routes/invoices.js      # Main invoice API with batch integration
│   ├── routes/batches.js       # Complete batch processing API
│   ├── routes/prompts.js       # Prompts management API
│   ├── services/claudeService.js # AI integration  
│   ├── services/batchProcessingService.js # Batch workflow engine
│   ├── middleware/upload.js    # File processing
│   ├── middleware/auth.js      # JWT authentication
│   └── server.js              # Express setup with rate limiting
├── migrations/                 # Database migration scripts
└── scripts/                   # Database setup utilities
frontend/
├── src/
│   ├── pages/ReviewPage.js     # Review workflow with batch filtering
│   ├── pages/InvoicesPage.js   # Data management with batch tracking
│   ├── pages/ImportInvoicesPage.js # Multi-step batch import workflow
│   ├── pages/BatchesPage.js    # Batch management dashboard
│   ├── pages/PromptsPage.js    # Prompts management with 2x2 testing UI
│   ├── components/InvoiceReviewDialog.js # Split-screen UI
│   ├── components/BatchMonitor.js # Real-time progress tracking
│   └── App.js                 # Routes with batch navigation
```

## Configuration

### Environment Variables (.env)
```env
DATABASE_URL=postgresql://waterfield_user:waterfield2025@localhost:5432/invoice_processing
ANTHROPIC_API_KEY=sk-ant-your-key
JWT_SECRET=waterfield-invoice-secret-2024
PORT=5001
NODE_ENV=development
```

### Development Commands
```bash
# Start both servers
npm run dev

# Windows restart script
restart-servers.bat

# Database setup
npm run db:migrate
```

## Recent Major Updates

### PDF Processing Fix (Critical)
- **Issue**: PDFs weren't being read properly, Claude returned hardcoded data
- **Solution**: Implemented `pdf-parse` with proper Buffer handling
- **Result**: Real document extraction instead of placeholder data

### Navigation Enhancement
- **Back/Next Buttons**: Navigate between pending invoices
- **Auto-Advance**: Automatically goes to next pending after approval
- **Smart Filtering**: Auto-switches status when pending items exist

### UI/UX Improvements  
- **Dialog Sizing**: Increased iframe width from ~1200px to ~2000px
- **Panel Proportions**: 67%-75% document viewer, 25%-33% data panel
- **Button Consistency**: Unified outlined button styling
- **Icon Alignment**: Matched page headers with navigation menu

## Development Workflow

### Current Branch: feature/batch-processing
Complete batch processing system implementation - ready for merge.

### Pull Request: #5 - 🚀 Complete Batch Processing System Implementation
Advanced multi-file invoice processing with real-time monitoring and comprehensive management capabilities.

### Completed: Batch Processing System ✅
- **Multi-File Import**: Drag-and-drop interface with folder selection
- **Real-Time Monitoring**: Live progress tracking with file-level details  
- **Batch Management**: Complete dashboard with filtering and status tracking
- **Performance Optimized**: 80% API call reduction through smart polling
- **Error Recovery**: Comprehensive error handling and rate limiting protection
- **Database Integration**: Purpose-built schema with transaction integrity

### Completed: Prompts Management System ✅
- **Enhanced 2x2 Test Interface**: Intuitive layout with document comparison
- **Full CRUD Operations**: Create, edit, delete, and version prompts  
- **Real-time Testing**: Upload documents and test extraction immediately
- **Claude Integration**: Direct API testing with structured results
- **Smart UX Flow**: Step-by-step workflow with visual progress indicators
- **File Processing**: PDF/HTML upload with text extraction display

### Common Development Tasks

**Start Development:**
```bash
cd C:\_w_claude-code\invoice-processing-app
restart-servers.bat  # or npm run dev
```

**Database Access:**
```bash
psql -d invoice_processing -U waterfield_user
Password: waterfield2025
```

**Test Invoice Upload:**
- Frontend: http://localhost:3000
- Login: demo@waterfield.tech / waterfield2025
- Use files from backend/uploads/ for testing

## Key Code Patterns

### Claude AI Integration
```javascript
// claudeService.js
const response = await anthropic.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  temperature: 0.1,  // Consistency
  max_tokens: 4000,
  messages: [{ role: 'user', content: prompt }]
});
```

### PDF Processing
```javascript
// upload.js  
const dataBuffer = await fs.readFile(filePath);
const pdfData = await pdf(dataBuffer);
const rawText = pdfData.text;
```

### Dialog Configuration
```javascript
// For wide document viewing
<Dialog 
  maxWidth={false}
  fullWidth
  PaperProps={{
    sx: { 
      width: '95vw', 
      height: '90vh',
      maxWidth: 'none'
    }
  }}
>
```

## Troubleshooting

### Common Issues
1. **PDF not displaying**: Check file path and authentication token
2. **Claude returning hardcoded data**: Verify PDF text extraction
3. **Database connection**: Ensure PostgreSQL is running
4. **Port conflicts**: Check if ports 3000/5001 are available

### Debug Commands
```bash
# Check server logs
# Backend logs show in terminal
# Frontend: Open browser dev tools

# Database queries
\dt  # List tables in psql
SELECT * FROM invoices LIMIT 5;
```

## Performance Notes
- PDF processing adds ~2-3 seconds per document
- Claude API calls typically < 5 seconds
- Database queries optimized with indexes
- File serving uses proper caching headers
- **Batch Processing**: Optimized for high-volume operations
  - Reduced API polling from 60 to 12 calls/minute (80% improvement)
  - Smart completion detection prevents unnecessary requests
  - Real-time progress updates with incremental database commits
  - Rate limiting configured for development vs production environments

## Latest Implementation: Batch Processing System

### 🚀 Multi-File Import Workflow

**Design Philosophy**: Streamlined 3-step process for efficient batch processing

**Workflow Steps**:
1. **Vendor Selection**: Choose target vendor for batch processing
2. **File Selection**: Multi-file upload with drag-and-drop support
3. **Processing**: Real-time monitoring with collapsible UI for focus

**Key Features**:
- **Smart UI**: Steps 1 & 2 collapse during processing for focused experience
- **File Management**: Drag-and-drop, bulk selection, file preview
- **Progress Tracking**: Real-time updates with file-level status details
- **Error Handling**: Comprehensive error recovery and user feedback

### 🔧 Real-Time Monitoring System
- **BatchMonitor Component**: Reusable progress tracking widget
- **Smart Polling**: Optimized API calls with completion detection
- **Status Visualization**: Color-coded pills and progress indicators  
- **File Details**: Integrated table with processing status and timing
- **Auto-Refresh**: Intelligent start/stop based on batch completion

### 📊 Database Architecture
```sql
-- Batch processing tables
CREATE TABLE processing_batches (
  id UUID PRIMARY KEY,
  vendor_id UUID REFERENCES vendors(id),
  total_files INTEGER NOT NULL,
  processed_files INTEGER DEFAULT 0,
  failed_files INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending',
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE batch_files (
  id UUID PRIMARY KEY,
  batch_id UUID REFERENCES processing_batches(id),
  filename VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  invoice_id UUID REFERENCES invoices(id),
  processing_time_ms INTEGER,
  error_message TEXT,
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### ⚡ Performance Optimizations
- **API Efficiency**: Reduced polling from 60 to 12 calls/minute
- **Combined Endpoints**: Single call for progress + file details
- **Smart Rate Limiting**: Development vs production configurations
- **Memory Management**: Efficient file handling and cleanup
- **Transaction Integrity**: Incremental commits for real-time updates

---

**Status**: Complete Batch Processing System Implementation ✅  
**Pull Request**: #5 - Ready for merge

## Latest Enhancement: Comprehensive Search Functionality

### 🔍 Advanced Search System

**Implementation Date**: October 2024  
**Branch**: `feature/ui-improvements`  

**Search Capabilities**:
- **Multi-Field Search**: Searches across invoice numbers, customer names, and purchase order numbers
- **Real-Time Filtering**: 500ms debounced search with live results
- **Cross-Page Consistency**: Identical search experience on both Review & Approve and Invoices pages
- **Smart UX**: Loading indicators, result counts, and clear filter functionality

### 🎯 Technical Implementation

**Backend API Enhancement**:
```sql
-- Search query supports ILIKE pattern matching
WHERE (
  i.invoice_number ILIKE '%search_term%' OR 
  COALESCE(c.name, i.customer_name) ILIKE '%search_term%' OR 
  i.purchase_order_number ILIKE '%search_term%'
)
```

**Frontend Optimizations**:
- **Debounced Input**: Prevents API spam with 500ms delay
- **Separate State Management**: `searchInput` vs `filters.search` for smooth UX  
- **Loading Indicators**: Visual feedback during search operations
- **Results Feedback**: "Showing X results for 'term'" messaging

### 📊 Performance Benefits
- **80% Reduction**: API calls reduced from every keystroke to debounced requests
- **Smooth Loading**: LinearProgress bar instead of full-screen loading
- **Consistent UX**: No page flickering during search operations
- **Smart Filtering**: Disabled clear button when no filters active

### 🎨 UI/UX Enhancements
- **Unified Design**: "Clear Filters" button positioned above filters on both pages
- **Grid Optimization**: Proper spacing (md=2.4 × 5 = 12 columns) eliminates blank space
- **Visual Consistency**: Matching icons, button styles, and layouts across pages
- **Responsive Layout**: Works seamlessly across desktop and mobile viewports

---

**Status**: Comprehensive Search System Implementation ✅  
**Next**: Advanced Analytics & Reporting Dashboard 🚧