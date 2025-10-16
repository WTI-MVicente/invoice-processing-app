# Manual App Runner Setup Guide

## Overview
Since AWS CDK cannot automate GitHub connections for App Runner, this service must be created manually via the AWS console.

## Prerequisites
✅ CDK infrastructure deployed successfully
✅ GitHub repository available: https://github.com/WTI-MVicente/invoice-processing-app

## Step-by-Step Setup

### 1. Create GitHub Connection
1. Go to AWS App Runner console: https://console.aws.amazon.com/apprunner/home
2. Click "Settings" in left navigation
3. Click "Create connection"
4. Select "GitHub" as provider
5. Name: `invoice-processing-github`
6. Install GitHub App and authorize repository access
7. Note the connection ARN for later

### 2. Create App Runner Service

#### Basic Configuration
- **Service name**: `invoice-processing-dev`
- **Source**: GitHub repository
- **Connection**: Select the connection created in step 1
- **Repository**: `WTI-MVicente/invoice-processing-app`
- **Branch**: `main`
- **Deployment trigger**: Automatic (on push)

#### Build Configuration
- **Configuration source**: Repository (uses apprunner.yaml)
- **Runtime**: Node.js 18
- **Build command**: `cd backend && npm ci --only=production`
- **Start command**: `cd backend && npm start`
- **Port**: `5001`

#### Service Configuration
- **CPU**: 1 vCPU
- **Memory**: 2 GB
- **Auto-scaling**: 
  - Min size: 1
  - Max size: 25
  - Max concurrency: 100

#### Environment Variables
Set these environment variables in the App Runner service:

```bash
# Core Settings
NODE_ENV=production
PORT=5001

# Database (from CDK outputs)
DATABASE_SECRET_ARN=arn:aws:secretsmanager:us-east-1:324532610217:secret:invoice-processing-db-credentials-dev-IKmvds
DATABASE_ENDPOINT=invoiceprocessing-dev-postgresdb113281d2-jhep9rqfyvcl.cvdm9yyy7eha.us-east-1.rds.amazonaws.com

# S3 Storage (from CDK outputs)
S3_BUCKET_FILES=invoice-processing-files-dev-324532610217
S3_BUCKET_EXPORTS=invoice-processing-exports-dev-324532610217

# CloudFront (from CDK outputs)
CDK_CLOUDFRONT_DOMAIN=dremjibnzbwfm.cloudfront.net

# AWS Region
AWS_REGION=us-east-1

# API Keys (set these manually - DO NOT store in Git)
ANTHROPIC_API_KEY=your-anthropic-api-key-here
JWT_SECRET=your-jwt-secret-here
```

#### IAM Configuration
- **Instance role**: Create new role or use existing `AppRunnerInstanceRole` (if created via CDK)
- **Access role**: Let App Runner create automatically

### 3. Security & Networking
- **VPC**: No VPC required (App Runner will access RDS via internet)
- **Security groups**: Default configuration
- **Health check**: `/api/health` (configured in backend)

### 4. Monitoring & Observability  
- **CloudWatch logs**: Enable
- **X-Ray tracing**: Optional
- **Tags**: 
  - Environment: `dev`
  - Project: `invoice-processing`
  - Stack: `InvoiceProcessing-dev`

## Verification Steps

### 1. Service Health
1. Wait for App Runner deployment to complete (~5-10 minutes)
2. Check service URL is accessible
3. Test health endpoint: `https://your-app-runner-url.us-east-1.awsapprunner.com/api/health`

### 2. Database Connectivity
Test database connection from App Runner logs:
```
✅ Database initialization completed
```

### 3. S3 Integration
Verify S3 bucket permissions in CloudWatch logs:
```
📁 File Service initialized for PRODUCTION
☁️ File uploaded to S3
```

### 4. Environment Variables
Check all environment variables are loaded:
```
🌍 Environment Configuration:
📊 Environment: PRODUCTION
🗄️  Database: RDS
📁 Storage: S3
```

## Troubleshooting

### Common Issues
1. **Build Fails**: Check that `apprunner.yaml` is in repository root
2. **Database Connection**: Verify RDS security groups allow App Runner access
3. **S3 Access Denied**: Ensure IAM role has S3 permissions
4. **Environment Variables**: Double-check all values match CDK outputs

### Debug Commands
```bash
# Check App Runner service status
aws apprunner describe-service --service-arn your-service-arn

# View CloudWatch logs
aws logs tail /aws/apprunner/invoice-processing-dev/service

# Test API health
curl https://your-app-runner-url/api/health
```

## Expected Result
- ✅ App Runner service running and healthy
- ✅ Express API accessible at App Runner URL  
- ✅ Database connection established
- ✅ S3 file operations working
- ✅ Environment-based configuration active

## Next Steps
After App Runner service is created and verified:
1. Update environment configuration with App Runner URL
2. Deploy React frontend to S3 + CloudFront
3. Run database migration scripts
4. Complete end-to-end testing