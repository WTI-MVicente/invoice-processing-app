import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as apprunner from 'aws-cdk-lib/aws-apprunner';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { EnvironmentConfig } from '../config/environments';

export interface InvoiceProcessingStackProps extends cdk.StackProps {
  readonly config: EnvironmentConfig;
}

export class InvoiceProcessingStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly database: rds.DatabaseInstance;
  public readonly filesBucket: s3.Bucket;
  public readonly exportsBucket: s3.Bucket;
  public readonly frontendBucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;
  public readonly appRunnerService: apprunner.Service;

  constructor(scope: Construct, id: string, props: InvoiceProcessingStackProps) {
    super(scope, id, props);

    const { config } = props;

    // Create VPC for database and networking
    this.vpc = new ec2.Vpc(this, 'InvoiceVPC', {
      maxAzs: 2,
      natGateways: 1, // Cost optimization - use 1 NAT gateway
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 24,
          name: 'isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    // Create database credentials secret
    const dbCredentials = new secretsmanager.Secret(this, 'DatabaseCredentials', {
      secretName: `invoice-processing-db-credentials-${config.environment}`,
      description: `Database credentials for Invoice Processing ${config.environment}`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'postgres' }),
        generateStringKey: 'password',
        excludeCharacters: '"@/\\',
        passwordLength: 32,
      },
    });

    // Create RDS PostgreSQL instance
    this.database = new rds.DatabaseInstance(this, 'PostgresDB', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15,
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        config.database.instanceClass.split('.')[2] as ec2.InstanceSize
      ),
      credentials: rds.Credentials.fromSecret(dbCredentials),
      vpc: this.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      databaseName: 'invoice_processing',
      allocatedStorage: config.database.allocatedStorage,
      maxAllocatedStorage: config.database.maxAllocatedStorage,
      multiAz: config.database.multiAz,
      backupRetention: cdk.Duration.days(config.database.backupRetention),
      deletionProtection: config.database.deletionProtection,
      removalPolicy: config.environment === 'prod' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,
      securityGroups: [this.createDatabaseSecurityGroup()],
    });

    // Create S3 buckets
    this.filesBucket = this.createS3Bucket('InvoiceFiles', 'files', config);
    this.exportsBucket = this.createS3Bucket('InvoiceExports', 'exports', config);
    this.frontendBucket = this.createS3Bucket('Frontend', 'frontend', config, true);

    // Create CloudFront distribution for frontend
    this.distribution = new cloudfront.Distribution(this, 'CDN', {
      defaultBehavior: {
        origin: new origins.S3Origin(this.frontendBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        compress: config.cdn.compression,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      additionalBehaviors: {
        '/files/*': {
          origin: new origins.S3Origin(this.filesBucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          compress: true,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
        '/exports/*': {
          origin: new origins.S3Origin(this.exportsBucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          compress: true,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED, // Exports are one-time downloads
        },
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html', // SPA routing support
        },
      ],
      priceClass: config.cdn.priceClass as cloudfront.PriceClass,
    });

    // Create App Runner service
    this.appRunnerService = this.createAppRunnerService(config);

    // Create SSM parameters for application configuration
    this.createSSMParameters(config);

    // Output important values
    this.createOutputs();
  }

  private createDatabaseSecurityGroup(): ec2.SecurityGroup {
    const dbSecurityGroup = new ec2.SecurityGroup(this, 'DatabaseSG', {
      vpc: this.vpc,
      description: 'Security group for RDS PostgreSQL instance',
      allowAllOutbound: false,
    });

    // Allow inbound PostgreSQL connections from App Runner (via VPC connector)
    dbSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(this.vpc.vpcCidrBlock),
      ec2.Port.tcp(5432),
      'PostgreSQL access from VPC'
    );

    return dbSecurityGroup;
  }

  private createS3Bucket(
    id: string, 
    purpose: string, 
    config: EnvironmentConfig, 
    isWebsite: boolean = false
  ): s3.Bucket {
    const bucketProps: s3.BucketProps = {
      bucketName: `invoice-processing-${purpose}-${config.environment}-${this.account}`,
      versioned: config.storage.versioning,
      encryption: config.storage.encryption 
        ? s3.BucketEncryption.S3_MANAGED 
        : s3.BucketEncryption.UNENCRYPTED,
      blockPublicAccess: isWebsite 
        ? s3.BlockPublicAccess.BLOCK_ACLS
        : s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: config.environment === 'prod' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: config.environment !== 'prod',
    };

    if (isWebsite) {
      bucketProps.websiteIndexDocument = 'index.html';
      bucketProps.websiteErrorDocument = 'index.html';
    }

    const bucket = new s3.Bucket(this, id, bucketProps);

    // Add lifecycle rules for non-frontend buckets
    if (!isWebsite && config.storage.lifecycleRules) {
      bucket.addLifecycleRule({
        id: `${purpose}-lifecycle`,
        enabled: true,
        transitions: [
          {
            storageClass: s3.StorageClass.INFREQUENT_ACCESS,
            transitionAfter: cdk.Duration.days(30),
          },
          {
            storageClass: s3.StorageClass.GLACIER,
            transitionAfter: cdk.Duration.days(90),
          },
        ],
        expiration: purpose === 'exports' 
          ? cdk.Duration.days(365) // Auto-delete old exports
          : undefined,
      });
    }

    return bucket;
  }

  private createAppRunnerService(config: EnvironmentConfig): apprunner.Service {
    // Create App Runner instance role
    const instanceRole = new iam.Role(this, 'AppRunnerInstanceRole', {
      assumedBy: new iam.ServicePrincipal('tasks.apprunner.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMReadOnlyAccess'),
      ],
    });

    // Grant S3 permissions
    this.filesBucket.grantReadWrite(instanceRole);
    this.exportsBucket.grantReadWrite(instanceRole);

    // Grant Secrets Manager access
    instanceRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['secretsmanager:GetSecretValue'],
      resources: [this.database.secret!.secretArn],
    }));

    // Create App Runner access role (for ECR access if needed)
    const accessRole = new iam.Role(this, 'AppRunnerAccessRole', {
      assumedBy: new iam.ServicePrincipal('build.apprunner.amazonaws.com'),
    });

    return new apprunner.Service(this, 'ApiService', {
      source: apprunner.Source.fromGitHub({
        repositoryUrl: 'https://github.com/WTI-MVicente/invoice-processing-app',
        branch: 'main',
        configurationSource: apprunner.ConfigurationSourceType.API,
      }),
      cpu: apprunner.Cpu.of(`${config.appRunner.cpu} vCPU`),
      memory: apprunner.Memory.of(`${config.appRunner.memory} GB`),
      environmentVariables: {
        NODE_ENV: 'production',
        PORT: '5001',
        AWS_REGION: this.region,
        S3_BUCKET_FILES: this.filesBucket.bucketName,
        S3_BUCKET_EXPORTS: this.exportsBucket.bucketName,
        CDK_CLOUDFRONT_DOMAIN: this.distribution.distributionDomainName,
        DATABASE_SECRET_ARN: this.database.secret!.secretArn,
        // Add other environment variables as needed
        JWT_SECRET: 'waterfield-invoice-secret-2024', // TODO: Move to Secrets Manager
      },
      accessRole: accessRole,
      instanceRole: instanceRole,
      autoScaling: {
        minSize: config.appRunner.autoScaling.minSize,
        maxSize: config.appRunner.autoScaling.maxSize,
        maxConcurrency: config.appRunner.autoScaling.maxConcurrency,
      },
    });
  }

  private createSSMParameters(config: EnvironmentConfig): void {
    // Store configuration in SSM Parameter Store for easy access
    new ssm.StringParameter(this, 'DatabaseEndpoint', {
      parameterName: `/invoice-processing/${config.environment}/database/endpoint`,
      stringValue: this.database.instanceEndpoint.hostname,
    });

    new ssm.StringParameter(this, 'FilesBucketName', {
      parameterName: `/invoice-processing/${config.environment}/s3/files-bucket`,
      stringValue: this.filesBucket.bucketName,
    });

    new ssm.StringParameter(this, 'ExportsBucketName', {
      parameterName: `/invoice-processing/${config.environment}/s3/exports-bucket`,
      stringValue: this.exportsBucket.bucketName,
    });

    new ssm.StringParameter(this, 'FrontendBucketName', {
      parameterName: `/invoice-processing/${config.environment}/s3/frontend-bucket`,
      stringValue: this.frontendBucket.bucketName,
    });

    new ssm.StringParameter(this, 'CloudFrontDomain', {
      parameterName: `/invoice-processing/${config.environment}/cloudfront/domain`,
      stringValue: this.distribution.distributionDomainName,
    });

    new ssm.StringParameter(this, 'AppRunnerServiceUrl', {
      parameterName: `/invoice-processing/${config.environment}/apprunner/service-url`,
      stringValue: `https://${this.appRunnerService.serviceUrl}`,
    });
  }

  private createOutputs(): void {
    new cdk.CfnOutput(this, 'DatabaseEndpoint', {
      value: this.database.instanceEndpoint.hostname,
      description: 'RDS PostgreSQL endpoint',
      exportName: `${this.stackName}-database-endpoint`,
    });

    new cdk.CfnOutput(this, 'DatabaseSecretArn', {
      value: this.database.secret!.secretArn,
      description: 'Database credentials secret ARN',
      exportName: `${this.stackName}-database-secret-arn`,
    });

    new cdk.CfnOutput(this, 'FilesBucketName', {
      value: this.filesBucket.bucketName,
      description: 'S3 bucket for invoice files',
      exportName: `${this.stackName}-files-bucket`,
    });

    new cdk.CfnOutput(this, 'ExportsBucketName', {
      value: this.exportsBucket.bucketName,
      description: 'S3 bucket for exports',
      exportName: `${this.stackName}-exports-bucket`,
    });

    new cdk.CfnOutput(this, 'FrontendBucketName', {
      value: this.frontendBucket.bucketName,
      description: 'S3 bucket for frontend hosting',
      exportName: `${this.stackName}-frontend-bucket`,
    });

    new cdk.CfnOutput(this, 'CloudFrontDomain', {
      value: this.distribution.distributionDomainName,
      description: 'CloudFront distribution domain',
      exportName: `${this.stackName}-cloudfront-domain`,
    });

    new cdk.CfnOutput(this, 'CloudFrontDistributionId', {
      value: this.distribution.distributionId,
      description: 'CloudFront distribution ID for cache invalidation',
      exportName: `${this.stackName}-cloudfront-distribution-id`,
    });

    new cdk.CfnOutput(this, 'AppRunnerServiceUrl', {
      value: `https://${this.appRunnerService.serviceUrl}`,
      description: 'App Runner service URL',
      exportName: `${this.stackName}-apprunner-service-url`,
    });
  }
}