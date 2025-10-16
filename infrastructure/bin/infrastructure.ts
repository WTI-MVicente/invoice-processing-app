#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { InvoiceProcessingStack } from '../lib/invoice-processing-stack';
import { getEnvironmentConfig } from '../config/environments';

const app = new cdk.App();

// Get environment from context or default to 'dev'
const environmentName = app.node.tryGetContext('environment') || 'dev';
const config = getEnvironmentConfig(environmentName);

// Create stack with environment-specific configuration
new InvoiceProcessingStack(app, `InvoiceProcessing-${config.environment}`, {
  config: config,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: config.region,
  },
  description: `Invoice Processing Application - ${config.environment} environment`,
  tags: {
    Environment: config.environment,
    Application: 'InvoiceProcessing',
    ManagedBy: 'CDK',
  },
});

app.synth();