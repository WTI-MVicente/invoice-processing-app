# AWS App Runner Deployment Plan - Invoice Processing App

## Project Overview
Deployment strategy for migrating the Invoice Processing Application from local development environment to AWS production infrastructure using AWS App Runner for simplified container orchestration.

**Target Architecture**: Hybrid development approach with local dev environment and AWS production deployment.

## Architecture Overview

### Production Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   CloudFront    │    │   App Runner    │    │   RDS PgSQL     │
│   + S3 Static   │───▶│   (Express API) │───▶│   (Database)    │
│   (React App)   │    │   Auto-scaling  │    │   Multi-AZ      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   S3 Buckets    │
                       │   - Files       │
                       │   - Exports     │
                       └─────────────────┘
```

### Development Architecture (Unchanged)
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Dev     │    │   Express API   │    │   PostgreSQL    │
│   localhost:3000│───▶│   localhost:5001│───▶│   Local DB      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   Local Files   │
                       │   ./uploads/    │
                       └─────────────────┘
```

## AWS Services Required

### Core Infrastructure
- **AWS App Runner**: Container-based API hosting with auto-scaling
- **Amazon RDS**: PostgreSQL database with automated backups
- **Amazon S3**: File storage for invoices and exports
- **Amazon CloudFront**: CDN for React frontend
- **Route 53**: DNS management for custom domain
- **AWS Certificate Manager**: SSL certificates

### Security & Monitoring
- **AWS IAM**: Service roles and access management
- **VPC Security Groups**: Network security rules
- **AWS CloudWatch**: Logging and monitoring
- **AWS Systems Manager**: Parameter Store for secrets

## Deployment Strategy: Option 1 - Hybrid Environment

### Development Environment (Local)
- **Frontend**: React dev server (`npm start`) on localhost:3000
- **Backend**: Express server (`npm run dev`) on localhost:5001  
- **Database**: Local PostgreSQL instance
- **File Storage**: Local filesystem (`./uploads/`)
- **AI Processing**: Direct Claude API calls
- **Cost**: $0 (no AWS resources used in development)

### Production Environment (AWS)
- **Frontend**: S3 + CloudFront static hosting
- **Backend**: App Runner containerized Express API
- **Database**: RDS PostgreSQL (t3.micro)
- **File Storage**: S3 buckets with proper IAM policies
- **AI Processing**: Claude API via AWS environment
- **Estimated Cost**: $30-80/month

## CDK Infrastructure as Code Implementation

### Benefits of CDK Approach
- **Type Safety**: TypeScript infrastructure prevents configuration errors
- **IDE Support**: IntelliSense, autocomplete, and refactoring
- **Reusable Components**: Create custom constructs for common patterns
- **Version Control**: Infrastructure changes tracked in Git
- **Testing**: Unit test infrastructure code before deployment
- **Environment Management**: Same code for dev/staging/prod with different parameters

## Implementation Phases

### Phase 1: Infrastructure as Code Setup (Week 1)

#### 1.1 CDK Project Setup
```bash
# Create CDK infrastructure project
mkdir infrastructure
cd infrastructure
npm init -y
npm install -g aws-cdk
cdk init app --language typescript

# Install required CDK constructs
npm install @aws-cdk/aws-s3 @aws-cdk/aws-rds @aws-cdk/aws-apprunner
npm install @aws-cdk/aws-cloudfront @aws-cdk/aws-route53
```

#### 1.2 CDK Stack Architecture
```typescript
// infrastructure/lib/invoice-processing-stack.ts
export class InvoiceProcessingStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    // Network Stack
    const vpc = new ec2.Vpc(this, 'InvoiceVPC', { ... });
    
    // Database Stack  
    const database = new rds.DatabaseInstance(this, 'PostgresDB', { ... });
    
    // Storage Stack
    const filesBucket = new s3.Bucket(this, 'InvoiceFiles', { ... });
    const frontendBucket = new s3.Bucket(this, 'Frontend', { ... });
    
    // Application Stack
    const appRunner = new apprunner.Service(this, 'ApiService', { ... });
    
    // CDN Stack
    const distribution = new cloudfront.Distribution(this, 'CDN', { ... });
  }
}
```

#### 1.3 Environment Configuration
```typescript
// infrastructure/config/environments.ts
export const environments = {
  dev: {
    dbInstanceClass: 'db.t3.micro',
    appRunnerCpu: 1,
    appRunnerMemory: 2,
    domain: 'dev.invoice-processing.com'
  },
  prod: {
    dbInstanceClass: 'db.t3.small', 
    appRunnerCpu: 2,
    appRunnerMemory: 4,
    domain: 'invoice-processing.com'
  }
};
```

#### 1.4 One-Command Deployment
```bash
# Deploy all infrastructure
cdk deploy --all --profile waterfield-prod

# Outputs will include:
# - RDS connection string
# - S3 bucket names  
# - App Runner service URL
# - CloudFront distribution domain
```

### Phase 2: Application Code & CDK Integration (Week 2)

#### 2.1 CDK Infrastructure Generation
```bash
# Generate all AWS resources with CDK
cd infrastructure
npm run build
cdk synth                    # Preview CloudFormation templates
cdk deploy --all            # Deploy infrastructure

# CDK automatically creates:
# - S3 buckets with proper policies
# - RDS PostgreSQL with security groups  
# - App Runner service with IAM roles
# - CloudFront distribution with caching
# - Route 53 hosted zone (if domain provided)
```

#### 2.2 Environment-Based Configuration (Auto-Generated)
```javascript
// backend/src/config/storage.js - CDK will inject these values
const config = {
  development: {
    storage: 'local',
    uploadPath: './uploads',
    baseUrl: 'http://localhost:5001/uploads'
  },
  production: {
    storage: 's3',
    bucket: process.env.S3_BUCKET_FILES,        // From CDK output
    region: process.env.AWS_REGION,             // From CDK output
    baseUrl: `https://${process.env.CDK_CLOUDFRONT_DOMAIN}/files`
  }
};
```

#### 2.3 CDK-Generated Environment Variables
```typescript
// CDK automatically sets these in App Runner
new apprunner.Service(this, 'ApiService', {
  source: apprunner.Source.fromGitHub({
    repositoryUrl: 'https://github.com/WTI-MVicente/invoice-processing-app',
    branch: 'main'
  }),
  environmentVariables: {
    NODE_ENV: 'production',
    DATABASE_URL: database.instanceEndpoint.socketAddress,
    S3_BUCKET_FILES: filesBucket.bucketName,
    S3_BUCKET_EXPORTS: exportsBucket.bucketName,
    AWS_REGION: Stack.of(this).region,
    CDK_CLOUDFRONT_DOMAIN: distribution.distributionDomainName
  }
});
```

#### 2.4 File Service Abstraction (Same Logic)
```javascript
// backend/src/services/fileService.js - No changes needed
class FileService {
  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production';
  }
  
  async saveFile(file, filename) {
    return this.isProduction ? 
      this.saveToS3(file, filename) : 
      this.saveToLocal(file, filename);
  }
  
  async getFileUrl(filename) {
    return this.isProduction ?
      `https://${process.env.CDK_CLOUDFRONT_DOMAIN}/files/${filename}` :
      `http://localhost:5001/uploads/${filename}`;
  }
}
```

#### 2.5 Docker Configuration (CDK Compatible)
```dockerfile
# Dockerfile - Same as before, CDK handles App Runner integration
FROM node:18-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --only=production
COPY backend/ ./
EXPOSE 5001
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5001/api/health || exit 1
CMD ["npm", "start"]
```

#### 2.6 CDK App Runner Integration (Auto-Configured)
```typescript
// CDK handles App Runner configuration automatically
const appRunnerService = new apprunner.Service(this, 'ApiService', {
  source: apprunner.Source.fromGitHub({
    repositoryUrl: 'https://github.com/WTI-MVicente/invoice-processing-app',
    branch: 'main',
    configurationSource: apprunner.ConfigurationSourceType.API
  }),
  cpu: apprunner.Cpu.ONE_VCPU,
  memory: apprunner.Memory.TWO_GB,
  autoScaling: {
    minSize: 1,
    maxSize: 10,
    maxConcurrency: 100
  }
});
```

### Phase 3: Frontend Deployment (Week 2)

#### 3.1 Build Configuration
```json
// frontend/package.json - Add build scripts
{
  "scripts": {
    "build:prod": "REACT_APP_API_URL=https://api.yourapp.com npm run build",
    "deploy:prod": "aws s3 sync build/ s3://invoice-processing-frontend-prod"
  }
}
```

#### 3.2 Environment Variables
```javascript
// frontend/src/config/api.js
const config = {
  development: {
    apiUrl: 'http://localhost:5001/api'
  },
  production: {
    apiUrl: process.env.REACT_APP_API_URL || 'https://api.yourapp.com/api'
  }
};
```

### Phase 4: Deployment & Testing (Week 3)

#### 4.1 Backend Deployment
1. Push code to GitHub repository
2. Create App Runner service from GitHub source
3. Configure environment variables in App Runner
4. Set up custom domain and SSL certificate
5. Configure health checks and auto-scaling

#### 4.2 Frontend Deployment
1. Build React application for production
2. Upload build artifacts to S3
3. Configure CloudFront distribution
4. Set up custom domain and SSL
5. Configure caching policies

#### 4.3 Database Migration
```bash
# Export from local development
pg_dump invoice_processing > backup.sql

# Import to RDS (via secure tunnel)
psql -h rds-endpoint -U username -d invoice_processing < backup.sql
```

## Environment Variables

### Development (.env.local)
```bash
NODE_ENV=development
DATABASE_URL=postgresql://waterfield_user:waterfield2025@localhost:5432/invoice_processing
ANTHROPIC_API_KEY=sk-ant-your-key
JWT_SECRET=waterfield-invoice-secret-2024
PORT=5001
```

### Production (App Runner)
```bash
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@rds-endpoint:5432/invoice_processing
ANTHROPIC_API_KEY=sk-ant-your-production-key
JWT_SECRET=production-jwt-secret
AWS_REGION=us-east-1
S3_BUCKET_FILES=invoice-processing-files-prod
S3_BUCKET_EXPORTS=invoice-processing-exports-prod
PORT=5001
```

## Security Considerations

### Data Protection
- All S3 buckets configured with encryption at rest
- RDS encryption enabled with AWS KMS
- SSL/TLS encryption for all data in transit
- Secure environment variable management

### Access Control
- IAM roles with least privilege principles
- VPC security groups limiting network access
- App Runner service roles for S3 and RDS access
- Secrets Manager for sensitive configuration

### Monitoring & Logging
- CloudWatch integration for application logs
- Database performance monitoring
- S3 access logging and monitoring
- App Runner request/response logging

## Cost Estimation

### Monthly AWS Costs (Production)
| Service | Configuration | Estimated Cost |
|---------|---------------|----------------|
| App Runner | 1 vCPU, 2GB RAM | $15-40/month |
| RDS PostgreSQL | db.t3.micro | $12-15/month |
| S3 Storage | 10GB + requests | $3-8/month |
| CloudFront | CDN + data transfer | $2-5/month |
| **Total** | | **$32-68/month** |

### Development Costs
- **Local Development**: $0 (no AWS resources)
- **Testing/Staging**: Optional separate environment (+$20-30/month)

## Migration Timeline

### Week 1: CDK Infrastructure Development
- Day 1-2: CDK project setup and stack architecture design
- Day 3-4: Implement database, storage, and networking stacks
- Day 5-7: Create App Runner and CloudFront CDK constructs

### Week 2: Application Integration & CDK Testing
- Day 1-3: Integrate application code with CDK-generated resources
- Day 4-5: Create environment-based configuration and file service abstraction
- Day 6-7: CDK synthesis testing and infrastructure validation

### Week 3: CDK Deployment & Production Go-Live
- Day 1-3: Execute `cdk deploy --all` for complete infrastructure
- Day 4-5: Database migration and frontend build deployment
- Day 6-7: DNS configuration, SSL setup, and production testing

## Rollback Plan

### Emergency Rollback
1. **DNS Failover**: Point domain back to previous hosting
2. **Database Restore**: RDS automated backup restoration
3. **Code Rollback**: App Runner deployment history
4. **S3 Versioning**: Restore previous frontend build

### Data Backup Strategy
- **Database**: Automated RDS backups + manual snapshots
- **Files**: S3 versioning + cross-region replication
- **Code**: GitHub repository with tagged releases
- **Configuration**: Infrastructure as Code (Terraform/CDK)

## Post-Deployment Checklist

### Performance Verification
- [ ] API response times under 500ms
- [ ] Frontend load times under 3 seconds  
- [ ] File uploads working correctly
- [ ] Database queries performing well
- [ ] Claude API integration functioning

### Security Verification
- [ ] SSL certificates properly configured
- [ ] Security groups restricting access
- [ ] IAM roles with minimal permissions
- [ ] Environment variables secured
- [ ] No hardcoded secrets in code

### Monitoring Setup
- [ ] CloudWatch alarms configured
- [ ] Log aggregation working
- [ ] Performance monitoring active
- [ ] Backup verification completed
- [ ] Disaster recovery tested

## Development Workflow (Post-CDK Migration)

### Daily Development (Unchanged)
1. Continue using local development environment exactly as before
2. Code changes tested locally first with `npm run dev`
3. Commit to feature branches in GitHub
4. CDK handles all production deployments

### Local Development (Zero Impact)
```bash
# Start development servers (identical to current)
npm run dev                    # Backend on localhost:5001
cd frontend && npm start       # Frontend on localhost:3000

# Local database remains the same
psql -d invoice_processing -U waterfield_user
```

### Production Deployment (CDK Managed)
```bash
# Backend deployment (automatic via CDK)
git push origin main          # App Runner auto-deploys

# Frontend deployment (CDK script)
cd infrastructure
npm run deploy:frontend       # CDK handles S3 upload + CloudFront invalidation

# Full infrastructure updates
cd infrastructure
cdk deploy --all             # Update any infrastructure changes
```

### CDK Development Commands
```bash
# Preview changes before deployment
cdk diff

# Deploy specific stacks
cdk deploy DatabaseStack
cdk deploy StorageStack

# Destroy environment (for testing)
cdk destroy --all

# Generate CloudFormation templates
cdk synth > infrastructure.yaml
```

## Troubleshooting Guide

### Common Issues
1. **App Runner Build Failures**: Check Dockerfile and build commands
2. **Database Connection Issues**: Verify RDS security groups and credentials
3. **S3 Access Denied**: Check IAM roles and bucket policies
4. **CloudFront Caching**: Configure cache invalidation for updates
5. **Environment Variables**: Verify App Runner configuration

### Debugging Steps
1. Check App Runner logs in CloudWatch
2. Verify environment variable configuration
3. Test database connectivity from App Runner
4. Validate S3 bucket permissions
5. Monitor CloudWatch metrics for performance issues

## Future Enhancements

### Scalability Improvements
- **Auto Scaling**: Configure App Runner instance scaling
- **Database**: Read replicas for improved performance  
- **CDN**: Enhanced CloudFront caching strategies
- **Load Balancing**: Multiple App Runner instances

### CI/CD Pipeline
- **GitHub Actions**: Automated testing and deployment
- **Staging Environment**: Pre-production testing
- **Database Migrations**: Automated schema updates
- **Rollback Automation**: One-click deployment rollbacks

### Monitoring & Analytics
- **APM Integration**: Application performance monitoring
- **User Analytics**: Frontend usage tracking
- **Cost Optimization**: AWS Cost Explorer integration
- **Security Monitoring**: AWS GuardDuty integration

---

**Status**: Ready for Implementation  
**Estimated Timeline**: 3 weeks  
**Estimated Cost**: $30-70/month  
**Development Impact**: None (local development unchanged)