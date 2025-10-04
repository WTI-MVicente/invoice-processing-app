# Invoice Processing Application

AI-powered invoice processing application for Waterfield Technologies, built with Node.js, React, and Claude API.

## 🎯 Overview

This application processes vendor invoices (PDF and HTML) using Claude AI to extract structured data for the Accounts Receivable team. Features include automated data extraction, review workflows, vendor management, and export capabilities.

## 🏗️ Architecture

- **Frontend**: React 18 + Material-UI with Waterfield Tech branding
- **Backend**: Node.js + Express + PostgreSQL
- **AI Processing**: Claude API (Sonnet 4.5) for invoice data extraction
- **Storage**: Local development / AWS S3 for production
- **Database**: PostgreSQL with comprehensive schema

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 12+
- npm or yarn

### 1. Install Dependencies

```bash
# Install root dependencies
npm run install:all

# Or manually:
npm install
cd backend && npm install
cd ../frontend && npm install
```

### 2. Database Setup

```bash
# Create database
createdb invoice_processing_db

# Copy environment file
cp backend/.env.example backend/.env

# Update DATABASE_URL in backend/.env:
DATABASE_URL=postgresql://username:password@localhost:5432/invoice_processing_db

# Run database migration
cd backend && npm run db:migrate
```

### 3. Environment Configuration

Edit `backend/.env` with your settings:

```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/invoice_processing_db

# Claude API
ANTHROPIC_API_KEY=sk-ant-your-api-key-here

# JWT Secrets (generate secure ones)
JWT_SECRET=your-super-secure-jwt-secret
SESSION_SECRET=your-super-secure-session-secret

# Other settings (defaults work for development)
PORT=5000
NODE_ENV=development
```

### 4. Start Development Servers

```bash
# Start both frontend and backend
npm run dev

# Or start individually:
npm run dev:backend  # Backend on http://localhost:5000
npm run dev:frontend # Frontend on http://localhost:3000
```

### 5. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **Health Check**: http://localhost:5000/api/health

## 📁 Project Structure

```
invoice-processing-app/
├── backend/                 # Node.js API server
│   ├── src/
│   │   ├── config/         # Database, auth configuration
│   │   ├── models/         # Database models
│   │   ├── routes/         # API endpoints
│   │   ├── services/       # Business logic (Claude, S3, etc.)
│   │   ├── middleware/     # Auth, validation middleware
│   │   └── server.js       # Express server setup
│   ├── scripts/
│   │   └── migrate.js      # Database migration script
│   └── uploads/            # Local file storage (development)
├── frontend/               # React application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Route components
│   │   ├── contexts/       # React contexts (Auth, etc.)
│   │   ├── theme/          # Material-UI theme & branding
│   │   └── utils/          # Helper functions
│   └── public/
├── database/
│   └── schema.sql          # Complete database schema
├── docs/                   # Project documentation
│   ├── invoice-app-specs.md
│   ├── waterfield-tech-branding-guide.md
│   └── invoice-mockup-branded.tsx
└── README.md
```

## 🎨 Branding & Design

The application implements Waterfield Technologies' brand guidelines:

- **Colors**: Primary Blue (#1B4B8C), Accent Blue (#2E7CE4)
- **Typography**: Inter font family
- **Design System**: Glassmorphism effects with backdrop blur
- **Components**: Material-UI with custom styling

## 🗄️ Database Schema

Key tables:
- `invoices` - Main invoice records with extracted data
- `line_items` - Individual invoice line items
- `vendors` - Vendor configuration and prompts
- `customers` - Customer records with aliases
- `extraction_prompts` - Claude AI prompts with versioning
- `processing_batches` - Batch processing tracking

## 🔧 Development Workflow

### Current Status: ✅ Phase 1 Complete

**✅ Completed:**
- Project structure and dependencies
- Database schema design
- React application with routing
- Material-UI theme with Waterfield branding
- Authentication context
- Basic layout and navigation

**🚧 Next Steps (Phase 2):**
- Authentication API endpoints
- Claude API integration
- File upload handling
- Invoice processing workflow

### Available Scripts

```bash
# Development
npm run dev                 # Start both servers
npm run dev:backend        # Backend only
npm run dev:frontend       # Frontend only

# Database
npm run db:migrate         # Run database migration

# Production
npm run build              # Build frontend
npm start                  # Start production server
```

## 🔐 Authentication

Currently implements JWT-based authentication:
- Simple email/password login
- Token storage in localStorage
- Route protection with React contexts
- Session management with 8-hour timeout

## 📋 API Endpoints (Planned)

```
Authentication:
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me

Vendors:
GET    /api/vendors
POST   /api/vendors
PUT    /api/vendors/:id

Invoices:
GET    /api/invoices
POST   /api/invoices
PUT    /api/invoices/:id
POST   /api/invoices/:id/approve

Prompts:
GET    /api/prompts
POST   /api/prompts
POST   /api/prompts/:id/test

Export:
POST   /api/export/generate
GET    /api/export/:id/download
```

## 🧪 Testing

```bash
cd backend
npm test                   # Run backend tests

cd frontend
npm test                   # Run frontend tests
```

## 🚀 Deployment

### Local Development
- Uses local PostgreSQL
- File storage in `backend/uploads/`
- No AWS dependencies

### Production (AWS)
- EC2 for hosting
- RDS PostgreSQL
- S3 for file storage
- Terraform for infrastructure

## 🤝 Contributing

1. Follow the established code structure
2. Maintain Waterfield Tech branding consistency
3. Test all changes thoroughly
4. Update documentation as needed

## 📞 Support

For questions or issues:
1. Check the technical specifications in `docs/`
2. Review the branding guide for UI/UX questions
3. Consult the database schema for data questions

---

**Waterfield Technologies Invoice Processing System v1.0**
*Powered by Claude AI*