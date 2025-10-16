# Invoice Processing Infrastructure - AWS CDK

This directory contains the AWS CDK Infrastructure as Code for the Invoice Processing Application.

## 🏗️ Architecture Overview

### Technology Stack
- **AWS CDK v2** with TypeScript for Infrastructure as Code
- **App Runner** for containerized Express.js API hosting
- **RDS PostgreSQL** for database with automated backups
- **S3 + CloudFront** for file storage and CDN distribution
- **Secrets Manager** for secure credential management
- **Systems Manager** for configuration parameter storage

### Environment Support
- **Development**: Cost-optimized with single-AZ RDS and minimal resources
- **Production**: Multi-AZ RDS, enhanced monitoring, and global CDN distribution

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- AWS CLI configured with appropriate permissions
- AWS CDK v2 installed globally: `npm install -g aws-cdk`

### Initial Setup
```bash
# Install dependencies
npm install

# Bootstrap CDK in your AWS account (one-time setup)
cdk bootstrap

# Build TypeScript
npm run build
```

### Deployment Commands

#### Development Environment
```bash
# Deploy to development
npm run deploy:dev

# Preview changes before deployment
npm run diff

# Synthesize CloudFormation templates
npm run synth
```

#### Production Environment
```bash
# Deploy to production
npm run deploy:prod

# Preview production changes
npm run diff:prod

# Synthesize production templates
npm run synth:prod
```

#### Frontend Deployment
```bash
# Deploy frontend to existing infrastructure
npm run deploy:frontend dev
npm run deploy:frontend prod
```

#### Advanced Deployment
```bash
# Deploy infrastructure only
npm run deploy:script infrastructure dev
npm run deploy:script infrastructure prod

# Deploy frontend only
npm run deploy:script frontend dev
npm run deploy:script frontend prod

# Deploy everything
npm run deploy:script all dev
npm run deploy:script all prod
```

## 📁 Project Structure

```
infrastructure/
├── bin/
│   └── infrastructure.ts          # CDK app entry point
├── lib/
│   └── invoice-processing-stack.ts # Main infrastructure stack
├── config/
│   └── environments.ts            # Environment-specific configurations
├── scripts/
│   └── deploy.ts                  # Advanced deployment scripts
├── test/
│   └── *.test.ts                  # Infrastructure unit tests
└── cdk.json                       # CDK configuration
```

## 🛠️ Configuration

### Environment Variables
The CDK app uses context variables for environment selection:

```bash
# Deploy specific environment
cdk deploy --context environment=dev
cdk deploy --context environment=prod
```

### Environment Configuration
Environment-specific settings are defined in `config/environments.ts`:

- **Database**: Instance class, storage, backup retention
- **App Runner**: CPU, memory, auto-scaling configuration
- **S3**: Versioning, lifecycle rules, encryption settings
- **CloudFront**: Price class, caching behaviors, compression

## 🔧 Infrastructure Components

### Networking
- **VPC**: Multi-AZ with public, private, and isolated subnets
- **NAT Gateway**: Single NAT gateway for cost optimization
- **Security Groups**: Restrictive rules for database access

### Database
- **RDS PostgreSQL 15**: Configurable instance class and storage
- **Automated Backups**: Configurable retention period
- **Security**: Isolated subnet with restricted access
- **Credentials**: Auto-generated secrets in Secrets Manager

### Storage
- **Files Bucket**: Invoice PDFs and documents
- **Exports Bucket**: Generated export files with lifecycle policies
- **Frontend Bucket**: React application hosting with website configuration
- **Encryption**: S3 managed encryption enabled
- **Lifecycle**: Automatic transition to IA and Glacier storage classes

### Application Hosting
- **App Runner**: Auto-scaling containerized Express.js API
- **GitHub Integration**: Automatic deployments from main branch
- **Environment Variables**: Injected database and S3 configuration
- **IAM Roles**: Least privilege access to required AWS services

### Content Delivery
- **CloudFront**: Global CDN with multiple origins
- **Caching**: Optimized policies for static and dynamic content
- **SSL/TLS**: Automatic HTTPS redirection
- **SPA Support**: React Router support with error page configuration

## 📊 Cost Estimation

### Development Environment
- **RDS PostgreSQL (db.t3.micro)**: ~$12-15/month
- **App Runner (1 vCPU, 2GB)**: ~$15-25/month
- **S3 Storage + CloudFront**: ~$3-8/month
- **Total**: ~$30-48/month

### Production Environment
- **RDS PostgreSQL (db.t3.small, Multi-AZ)**: ~$25-35/month
- **App Runner (2 vCPU, 4GB)**: ~$30-50/month
- **S3 Storage + CloudFront**: ~$5-15/month
- **Total**: ~$60-100/month

## 🔒 Security Features

### Network Security
- VPC with isolated database subnets
- Security groups with minimal required access
- No direct internet access to database

### Data Security
- S3 encryption at rest
- RDS encryption at rest
- Secrets Manager for credential management
- IAM roles with least privilege principles

### Access Control
- App Runner instance role with specific S3 and database permissions
- CloudFormation stack policies
- Resource-based policies for S3 buckets

## 📋 Stack Outputs

After deployment, the following outputs are available:

```bash
# Get all stack outputs
aws cloudformation describe-stacks \
  --stack-name InvoiceProcessing-dev \
  --query "Stacks[0].Outputs"
```

**Key Outputs**:
- `DatabaseEndpoint`: RDS instance endpoint
- `DatabaseSecretArn`: Credentials secret ARN
- `FilesBucketName`: S3 bucket for invoice files
- `ExportsBucketName`: S3 bucket for exports
- `FrontendBucketName`: S3 bucket for frontend hosting
- `CloudFrontDomain`: CDN domain name
- `AppRunnerServiceUrl`: API service URL

## 🧪 Testing

```bash
# Run infrastructure unit tests
npm test

# Test stack synthesis
npm run synth

# Test with different environments
cdk synth --context environment=prod
```

## 🚨 Troubleshooting

### Common Issues

#### CDK Bootstrap Required
```bash
# Error: Need to perform AWS CDK bootstrap
cdk bootstrap aws://ACCOUNT-NUMBER/REGION
```

#### Insufficient Permissions
```bash
# Ensure your AWS credentials have sufficient permissions:
# - CloudFormation full access
# - IAM role creation
# - VPC and EC2 management
# - RDS and S3 management
# - App Runner and CloudFront management
```

#### Stack Rollback
```bash
# If deployment fails, check CloudFormation events:
aws cloudformation describe-stack-events --stack-name InvoiceProcessing-dev

# Force deletion of failed stack:
npm run destroy:dev
```

### Monitoring and Debugging

#### CloudWatch Logs
- App Runner service logs
- CloudFormation deployment logs
- Database performance insights (production)

#### AWS Console Resources
- **CloudFormation**: Stack status and events
- **App Runner**: Service status and logs
- **RDS**: Database performance and connections
- **S3**: Bucket contents and access patterns
- **CloudFront**: Cache hit ratios and performance

## 🔄 CI/CD Integration

### GitHub Actions (Future Enhancement)
```yaml
# Example GitHub Actions workflow
name: Deploy Infrastructure
on:
  push:
    branches: [main]
    paths: ['infrastructure/**']
  
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - name: Install dependencies
        run: cd infrastructure && npm ci
      - name: Deploy to dev
        run: cd infrastructure && npm run deploy:dev
      - name: Deploy to prod
        if: github.ref == 'refs/heads/main'
        run: cd infrastructure && npm run deploy:prod
```

## 📚 Additional Resources

- [AWS CDK v2 Documentation](https://docs.aws.amazon.com/cdk/v2/)
- [App Runner Documentation](https://docs.aws.amazon.com/apprunner/)
- [RDS PostgreSQL Best Practices](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_BestPractices.html)
- [CloudFront Caching Strategies](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cache-behavior-overview.html)

## 🤝 Contributing

1. Follow TypeScript best practices
2. Update environment configurations for new resources
3. Add unit tests for new infrastructure components
4. Document any new deployment procedures
5. Test changes in development environment first

---

**Infrastructure managed by AWS CDK v2 with TypeScript**  
**Application**: Invoice Processing System  
**Environments**: Development & Production