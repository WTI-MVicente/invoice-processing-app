#!/bin/bash

# Script to generate environment variables for App Runner service
# Run this after CDK deployment to get the correct values from AWS outputs

set -e

ENVIRONMENT=${1:-dev}
STACK_NAME="InvoiceProcessing-${ENVIRONMENT}"

echo "🔧 Generating App Runner environment variables for ${ENVIRONMENT}..."
echo ""

# Get CDK outputs using AWS CLI query
echo "📋 Fetching CDK stack outputs..."
DATABASE_ENDPOINT=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --query "Stacks[0].Outputs[?OutputKey=='DatabaseEndpoint'].OutputValue" --output text)
DATABASE_SECRET_ARN=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --query "Stacks[0].Outputs[?OutputKey=='DatabaseSecretArn'].OutputValue" --output text)
S3_BUCKET_FILES=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --query "Stacks[0].Outputs[?OutputKey=='FilesBucketName'].OutputValue" --output text)
S3_BUCKET_EXPORTS=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --query "Stacks[0].Outputs[?OutputKey=='ExportsBucketName'].OutputValue" --output text)
CDK_CLOUDFRONT_DOMAIN=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDomain'].OutputValue" --output text)

echo ""
echo "✅ Values retrieved successfully!"
echo ""
echo "📝 Copy these environment variables to your App Runner service:"
echo ""
echo "# Core Settings"
echo "NODE_ENV=production"
echo "PORT=5001"
echo ""
echo "# Database Configuration"
echo "DATABASE_SECRET_ARN=${DATABASE_SECRET_ARN}"
echo "DATABASE_ENDPOINT=${DATABASE_ENDPOINT}"
echo ""
echo "# S3 Storage Configuration"
echo "S3_BUCKET_FILES=${S3_BUCKET_FILES}"
echo "S3_BUCKET_EXPORTS=${S3_BUCKET_EXPORTS}"
echo ""
echo "# CloudFront Configuration"
echo "CDK_CLOUDFRONT_DOMAIN=${CDK_CLOUDFRONT_DOMAIN}"
echo ""
echo "# AWS Region"
echo "AWS_REGION=us-east-1"
echo ""
echo "# Manual Configuration Required (DO NOT store in Git)"
echo "ANTHROPIC_API_KEY=your-anthropic-api-key-here"
echo "JWT_SECRET=your-jwt-secret-here"
echo ""
echo "🌐 App Runner Console: https://console.aws.amazon.com/apprunner/home"
echo "📚 Setup Guide: docs/app-runner-manual-setup.md"
echo ""
echo "✨ After setting up App Runner, test the health endpoint:"
echo "   curl https://your-app-runner-url/api/health"