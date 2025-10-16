#!/usr/bin/env node

/**
 * Deployment script for Invoice Processing Application
 * 
 * Usage:
 *   npm run deploy:dev    # Deploy to development
 *   npm run deploy:prod   # Deploy to production
 *   npm run deploy:all    # Deploy all environments
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface DeploymentOptions {
  environment: string;
  requireApproval?: boolean;
  hotswap?: boolean;
  verbose?: boolean;
}

class InfrastructureDeployer {
  private readonly rootDir: string;

  constructor() {
    this.rootDir = path.resolve(__dirname, '..');
  }

  async deploy(options: DeploymentOptions): Promise<void> {
    const { environment, requireApproval = true, hotswap = false, verbose = false } = options;

    console.log(`🚀 Deploying Invoice Processing Infrastructure to ${environment}...`);
    
    try {
      // Validate environment
      this.validateEnvironment(environment);
      
      // Build TypeScript
      console.log('📦 Building CDK application...');
      this.execCommand('npm run build');
      
      // Synthesize CloudFormation templates
      console.log('🔨 Synthesizing CloudFormation templates...');
      this.execCommand(`cdk synth --context environment=${environment}`);
      
      // Deploy infrastructure
      const deployCmd = this.buildDeployCommand(environment, requireApproval, hotswap, verbose);
      console.log(`⚡ Executing: ${deployCmd}`);
      this.execCommand(deployCmd);
      
      console.log(`✅ Successfully deployed to ${environment}!`);
      
      // Display outputs
      this.displayOutputs(environment);
      
    } catch (error) {
      console.error(`❌ Deployment failed:`, error);
      process.exit(1);
    }
  }

  async deployFrontend(environment: string): Promise<void> {
    console.log(`🌐 Deploying frontend to ${environment}...`);
    
    try {
      // Get stack outputs
      const outputs = this.getStackOutputs(environment);
      const frontendBucket = outputs.FrontendBucketName;
      const distributionId = outputs.CloudFrontDistributionId;
      
      if (!frontendBucket || !distributionId) {
        throw new Error('Frontend bucket or CloudFront distribution not found. Deploy infrastructure first.');
      }
      
      // Build React application
      console.log('📦 Building React application...');
      const frontendDir = path.resolve(this.rootDir, '..', 'frontend');
      this.execCommand(`cd "${frontendDir}" && npm run build`);
      
      // Upload to S3
      console.log(`📤 Uploading to S3 bucket: ${frontendBucket}`);
      this.execCommand(`aws s3 sync "${frontendDir}/build" s3://${frontendBucket} --delete`);
      
      // Invalidate CloudFront cache
      console.log(`🔄 Invalidating CloudFront cache: ${distributionId}`);
      this.execCommand(`aws cloudfront create-invalidation --distribution-id ${distributionId} --paths "/*"`);
      
      console.log(`✅ Frontend deployed successfully to ${environment}!`);
      
    } catch (error) {
      console.error(`❌ Frontend deployment failed:`, error);
      process.exit(1);
    }
  }

  private validateEnvironment(environment: string): void {
    const configPath = path.join(this.rootDir, 'config', 'environments.ts');
    if (!fs.existsSync(configPath)) {
      throw new Error('Environment configuration file not found');
    }
    
    const validEnvironments = ['dev', 'prod'];
    if (!validEnvironments.includes(environment)) {
      throw new Error(`Invalid environment: ${environment}. Valid options: ${validEnvironments.join(', ')}`);
    }
  }

  private buildDeployCommand(environment: string, requireApproval: boolean, hotswap: boolean, verbose: boolean): string {
    const parts = [
      'cdk deploy',
      `--context environment=${environment}`,
      '--all',
    ];
    
    if (!requireApproval) {
      parts.push('--require-approval never');
    }
    
    if (hotswap && environment === 'dev') {
      parts.push('--hotswap');
    }
    
    if (verbose) {
      parts.push('--verbose');
    }
    
    return parts.join(' ');
  }

  private execCommand(command: string): void {
    try {
      execSync(command, { 
        stdio: 'inherit', 
        cwd: this.rootDir,
        env: { ...process.env }
      });
    } catch (error) {
      throw new Error(`Command failed: ${command}`);
    }
  }

  private getStackOutputs(environment: string): Record<string, string> {
    try {
      const result = execSync(
        `aws cloudformation describe-stacks --stack-name InvoiceProcessing-${environment} --query "Stacks[0].Outputs" --output json`,
        { encoding: 'utf8', cwd: this.rootDir }
      );
      
      const outputs = JSON.parse(result);
      const outputMap: Record<string, string> = {};
      
      outputs.forEach((output: any) => {
        outputMap[output.OutputKey] = output.OutputValue;
      });
      
      return outputMap;
    } catch (error) {
      throw new Error(`Failed to get stack outputs for ${environment}`);
    }
  }

  private displayOutputs(environment: string): void {
    try {
      console.log('\n📋 Stack Outputs:');
      const outputs = this.getStackOutputs(environment);
      
      Object.entries(outputs).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
      
      console.log('\n🔗 Quick Links:');
      if (outputs.CloudFrontDomain) {
        console.log(`  Frontend: https://${outputs.CloudFrontDomain}`);
      }
      if (outputs.AppRunnerServiceUrl) {
        console.log(`  API: ${outputs.AppRunnerServiceUrl}`);
      }
      
    } catch (error) {
      console.log('\n⚠️  Could not retrieve stack outputs');
    }
  }
}

// CLI interface
async function main() {
  const deployer = new InfrastructureDeployer();
  const command = process.argv[2];
  const environment = process.argv[3];

  switch (command) {
    case 'infrastructure':
      if (!environment) {
        console.error('Usage: npm run deploy:script infrastructure <environment>');
        process.exit(1);
      }
      await deployer.deploy({
        environment,
        requireApproval: environment === 'prod',
        hotswap: environment === 'dev',
        verbose: false
      });
      break;
      
    case 'frontend':
      if (!environment) {
        console.error('Usage: npm run deploy:script frontend <environment>');
        process.exit(1);
      }
      await deployer.deployFrontend(environment);
      break;
      
    case 'all':
      if (!environment) {
        console.error('Usage: npm run deploy:script all <environment>');
        process.exit(1);
      }
      await deployer.deploy({
        environment,
        requireApproval: environment === 'prod',
        hotswap: environment === 'dev',
      });
      await deployer.deployFrontend(environment);
      break;
      
    default:
      console.log('Usage:');
      console.log('  npm run deploy:script infrastructure <env>  # Deploy infrastructure only');
      console.log('  npm run deploy:script frontend <env>       # Deploy frontend only');
      console.log('  npm run deploy:script all <env>            # Deploy everything');
      console.log('');
      console.log('Environments: dev, prod');
      process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { InfrastructureDeployer };