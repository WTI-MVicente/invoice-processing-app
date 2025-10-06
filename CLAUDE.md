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
- **Review & Approve Page**: Workflow-focused invoice processing
- **Invoices Page**: Complete data management with view/delete
- **Statistics Cards**: Total, Pending, Approved, Rejected counts
- **Vendor Management**: Full CRUD operations
- **Permanent Deletion**: Removes database records and files

## Technical Implementation

### Database Schema
```sql
-- Key tables
invoices (id UUID PRIMARY KEY)
line_items (invoice_id references invoices)
vendors (id UUID PRIMARY KEY)
customers (customer accounts)
```

### API Endpoints Structure
```
/api/auth/*        - Authentication endpoints
/api/vendors/*     - Vendor management
/api/invoices/*    - Invoice CRUD operations
/api/invoices/:id/file - PDF/HTML file serving
```

### File Structure
```
backend/
├── src/
│   ├── routes/invoices.js      # Main invoice API
│   ├── services/claudeService.js # AI integration  
│   ├── middleware/upload.js    # File processing
│   └── server.js              # Express setup
frontend/
├── src/
│   ├── pages/ReviewPage.js     # Review workflow
│   ├── pages/InvoicesPage.js   # Data management
│   ├── components/InvoiceReviewDialog.js # Split-screen UI
│   └── App.js                 # Routes
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

### Current Branch: master
All invoice management features are complete and merged.

### Next Phase: Prompts Management
- Prompt editing interface
- Claude prompt testing
- Version control system
- Integration with existing Claude service

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

---

**Status**: Invoice Management System Complete ✅
**Next**: Prompts Management System 🚧