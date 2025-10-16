export interface EnvironmentConfig {
  readonly environment: string;
  readonly account?: string;
  readonly region: string;
  readonly domain?: string;
  readonly subdomain?: string;
  readonly certificateArn?: string;
  
  // Database configuration
  readonly database: {
    readonly instanceClass: string;
    readonly allocatedStorage: number;
    readonly maxAllocatedStorage: number;
    readonly multiAz: boolean;
    readonly backupRetention: number;
    readonly deletionProtection: boolean;
  };
  
  // App Runner configuration
  readonly appRunner: {
    readonly cpu: number;
    readonly memory: number;
    readonly autoScaling: {
      readonly minSize: number;
      readonly maxSize: number;
      readonly maxConcurrency: number;
    };
  };
  
  // S3 configuration
  readonly storage: {
    readonly versioning: boolean;
    readonly lifecycleRules: boolean;
    readonly encryption: boolean;
  };
  
  // CloudFront configuration
  readonly cdn: {
    readonly priceClass: string;
    readonly cacheBehaviors: boolean;
    readonly compression: boolean;
  };
}

export const environments: Record<string, EnvironmentConfig> = {
  dev: {
    environment: 'dev',
    region: 'us-east-1',
    subdomain: 'dev',
    
    database: {
      instanceClass: 'db.t3.micro',
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      multiAz: false,
      backupRetention: 3,
      deletionProtection: false
    },
    
    appRunner: {
      cpu: 1,
      memory: 2,
      autoScaling: {
        minSize: 1,
        maxSize: 3,
        maxConcurrency: 50
      }
    },
    
    storage: {
      versioning: true,
      lifecycleRules: false,
      encryption: true
    },
    
    cdn: {
      priceClass: 'PriceClass_100', // US and Europe only
      cacheBehaviors: true,
      compression: true
    }
  },
  
  prod: {
    environment: 'prod',
    region: 'us-east-1',
    // domain: 'invoice-processing.com', // Configure when ready
    
    database: {
      instanceClass: 'db.t3.small',
      allocatedStorage: 20,
      maxAllocatedStorage: 1000,
      multiAz: true,
      backupRetention: 7,
      deletionProtection: true
    },
    
    appRunner: {
      cpu: 2,
      memory: 4,
      autoScaling: {
        minSize: 1,
        maxSize: 10,
        maxConcurrency: 100
      }
    },
    
    storage: {
      versioning: true,
      lifecycleRules: true,
      encryption: true
    },
    
    cdn: {
      priceClass: 'PriceClass_All', // Global distribution
      cacheBehaviors: true,
      compression: true
    }
  }
};

export function getEnvironmentConfig(environmentName: string): EnvironmentConfig {
  const config = environments[environmentName];
  if (!config) {
    throw new Error(`Environment configuration not found for: ${environmentName}`);
  }
  return config;
}