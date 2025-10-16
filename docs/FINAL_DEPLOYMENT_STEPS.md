# 🚀 Final Deployment Steps - Invoice Processing App

## Status: Phase 3 Complete - Ready for Final Phase

### ✅ Completed Infrastructure
- **CDK Stack**: All AWS resources deployed successfully
- **Frontend**: React app deployed to S3 + CloudFront ✅
- **Backend**: Environment-based configuration ready ✅  
- **Database**: RDS PostgreSQL instance available ✅

### 📋 Final Steps Required

## Step 1: Create App Runner Service (Manual)

### 1.1 Access AWS App Runner Console
🌐 **URL**: https://console.aws.amazon.com/apprunner/home?region=us-east-1

### 1.2 Create GitHub Connection
1. Go to "Settings" → "Create connection"
2. **Provider**: GitHub
3. **Connection name**: `invoice-processing-github`
4. Install GitHub App and authorize access to `WTI-MVicente/invoice-processing-app`

### 1.3 Create App Runner Service
**Basic Configuration:**
- **Service name**: `invoice-processing-dev`
- **Source**: Repository
- **Connection**: `invoice-processing-github`
- **Repository**: `WTI-MVicente/invoice-processing-app`
- **Branch**: `feature/aws-cdk-infrastructure` (current branch with all changes)
- **Automatic deployment**: Enabled

**Build Settings:**
- **Configuration source**: Repository (uses apprunner.yaml)
- **Runtime**: Node.js 18

**Service Settings:**
- **CPU**: 1 vCPU
- **Memory**: 2 GB
- **Auto-scaling**:
  - Min: 1 instance
  - Max: 25 instances
  - Concurrency: 100 requests per instance

### 1.4 Environment Variables (Copy-Paste Ready)
```bash
# Core Settings
NODE_ENV=production
PORT=5001

# Database Configuration (from CDK)
DATABASE_SECRET_ARN=arn:aws:secretsmanager:us-east-1:324532610217:secret:invoice-processing-db-credentials-dev-IKmvds
DATABASE_ENDPOINT=invoiceprocessing-dev-postgresdb113281d2-jhep9rqfyvcl.cvdm9yyy7eha.us-east-1.rds.amazonaws.com

# S3 Storage Configuration (from CDK)
S3_BUCKET_FILES=invoice-processing-files-dev-324532610217
S3_BUCKET_EXPORTS=invoice-processing-exports-dev-324532610217

# CloudFront Configuration (from CDK)
CDK_CLOUDFRONT_DOMAIN=dremjibnzbwfm.cloudfront.net

# AWS Region
AWS_REGION=us-east-1

# API Keys (REQUIRED - Set your actual values)
ANTHROPIC_API_KEY=your-anthropic-api-key-here
JWT_SECRET=your-jwt-secret-here
```

### 1.5 IAM Configuration
- **Instance role**: Let App Runner create automatically
- **Access role**: Let App Runner create automatically

## Step 2: Database Migration via App Runner

### 2.1 Test App Runner Health
Once App Runner is deployed (5-10 minutes):
1. Copy the App Runner service URL
2. Test: `https://your-app-runner-url/api/health`

### 2.2 Run Database Migration
The backend includes automatic database initialization:
1. App Runner will automatically run migrations on startup
2. Check CloudWatch logs for migration success:
   ```
   ✅ Database initialization completed
   📋 Created tables: users, vendors, invoices, etc.
   ```

### 2.3 Manual Migration (If Needed)
If automatic migration fails, create a one-time migration endpoint:
1. Add temporary route to backend
2. Hit the migration endpoint via App Runner URL
3. Remove route after successful migration

## Step 3: Frontend API Configuration

### 3.1 Update Frontend API URL
```bash
# Update frontend .env.production with actual App Runner URL
REACT_APP_API_URL=https://your-app-runner-url/api
```

### 3.2 Rebuild and Deploy Frontend
```bash
cd frontend
npm run build
aws s3 sync build/ s3://invoice-processing-frontend-dev-324532610217 --delete
aws cloudfront create-invalidation --distribution-id E2AIB4LRNHCJCP --paths "/*"
```

## Step 4: End-to-End Verification

### 4.1 Access Application
🌐 **Frontend URL**: https://dremjibnzbwfm.cloudfront.net

### 4.2 Test Core Features
1. **Login**: demo@waterfield.tech / waterfield2025
2. **Upload Invoice**: Test PDF processing
3. **Review Process**: Verify PDF display and data extraction  
4. **Export System**: Test XLSX/CSV export functionality
5. **File Storage**: Confirm S3 integration working

### 4.3 Verify AWS Integration
- ✅ **RDS**: Database queries working
- ✅ **S3**: File upload/download working
- ✅ **CloudFront**: Frontend serving correctly
- ✅ **Secrets Manager**: Database credentials accessed
- ✅ **App Runner**: API endpoints responding

## 🎯 Expected Final Architecture

```
Internet User
     ↓
CloudFront CDN (Frontend) 
     ↓
App Runner (Express API)
     ↓
RDS PostgreSQL + S3 Storage
     ↓
Secrets Manager (Credentials)
```

## 🔧 Troubleshooting

### App Runner Issues
- **Build Fails**: Check `apprunner.yaml` syntax
- **Environment Variables**: Verify all values are set correctly
- **Health Check**: Ensure `/api/health` endpoint responds

### Database Issues
- **Connection**: App Runner automatically has VPC access to RDS
- **Migration**: Check CloudWatch logs for SQL errors
- **Credentials**: Verify Secrets Manager permissions

### Frontend Issues
- **API Calls**: Update REACT_APP_API_URL to App Runner URL
- **CORS**: Backend automatically configures CORS for CloudFront domain

## 🎉 Success Criteria

### ✅ Deployment Complete When:
1. App Runner service shows "Running" status
2. Frontend accessible at CloudFront URL
3. Login and core features working end-to-end
4. Database tables populated correctly
5. File upload/download working with S3

### 📊 Cost Summary
- **Monthly AWS Cost**: ~$60-100
- **App Runner**: ~$25-45/month
- **RDS t3.micro**: ~$12-15/month  
- **S3 + CloudFront**: ~$5-10/month
- **Other services**: ~$10-30/month

---

**🚀 Ready for Production Deployment!**

Total estimated deployment time: **30-45 minutes**
- App Runner service creation: 10-15 minutes
- Database migration: 2-3 minutes  
- Frontend rebuild/deploy: 5-10 minutes
- End-to-end testing: 15-20 minutes