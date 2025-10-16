#!/bin/bash

# Script to set environment variables in App Runner service after CDK deployment
# Usage: ./scripts/set-apprunner-env.sh <environment> <anthropic-api-key> <jwt-secret>

set -e

ENVIRONMENT=${1:-dev}
ANTHROPIC_API_KEY=${2}
JWT_SECRET=${3}

if [ -z "$ANTHROPIC_API_KEY" ] || [ -z "$JWT_SECRET" ]; then
  echo "❌ Usage: $0 <environment> <anthropic-api-key> <jwt-secret>"
  echo "Example: $0 dev sk-ant-your-key your-jwt-secret"
  exit 1
fi

echo "🔧 Setting environment variables for App Runner service..."

# Get App Runner service ARN from CDK outputs
SERVICE_NAME="invoice-processing-${ENVIRONMENT}"
SERVICE_ARN=$(aws apprunner list-services --query "ServiceSummaryList[?ServiceName=='$SERVICE_NAME'].ServiceArn" --output text)

if [ -z "$SERVICE_ARN" ]; then
  echo "❌ App Runner service not found: $SERVICE_NAME"
  exit 1
fi

echo "📋 Found service: $SERVICE_ARN"

# Get current service configuration
echo "📥 Getting current service configuration..."
aws apprunner describe-service --service-arn "$SERVICE_ARN" --query "Service.SourceConfiguration.CodeRepository.CodeConfiguration.CodeConfigurationValues" > /tmp/current-config.json

# Update with new environment variables
echo "🔧 Updating environment variables..."
cat > /tmp/env-vars.json << EOF
{
  "Runtime": "NODEJS_18",
  "BuildCommand": "cd backend && npm ci --only=production && mkdir -p uploads",
  "StartCommand": "cd backend && npm start",
  "Port": "5001",
  "RuntimeEnvironmentVariables": {
    "NODE_ENV": "production",
    "PORT": "5001",
    "ANTHROPIC_API_KEY": "$ANTHROPIC_API_KEY",
    "JWT_SECRET": "$JWT_SECRET"
  }
}
EOF

# Note: AWS CLI doesn't support updating environment variables directly
# Environment variables need to be set through AWS Console or terraform/CDK updates

echo "⚠️  Manual Step Required:"
echo "📝 Please add these environment variables in the AWS App Runner console:"
echo "   - ANTHROPIC_API_KEY: $ANTHROPIC_API_KEY"
echo "   - JWT_SECRET: $JWT_SECRET"
echo ""
echo "🌐 AWS Console: https://console.aws.amazon.com/apprunner/home"
echo "🔗 Service: $SERVICE_NAME"
echo ""
echo "✅ Other environment variables are automatically set by CDK:"
echo "   - NODE_ENV=production"
echo "   - PORT=5001"
echo "   - DATABASE_SECRET_ARN=<from CDK>"
echo "   - DATABASE_ENDPOINT=<from CDK>"
echo "   - S3_BUCKET_FILES=<from CDK>"
echo "   - S3_BUCKET_EXPORTS=<from CDK>"
echo "   - CDK_CLOUDFRONT_DOMAIN=<from CDK>"
echo "   - AWS_REGION=<from CDK>"