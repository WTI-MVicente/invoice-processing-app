/**
 * API Configuration for Invoice Processing Frontend
 * Handles environment-based API URL configuration
 */

// Environment detection
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

// API Configuration
const config = {
  development: {
    apiUrl: 'http://localhost:5001/api',
    baseUrl: 'http://localhost:5001'
  },
  production: {
    // App Runner URL will be set via environment variable
    apiUrl: process.env.REACT_APP_API_URL || 'https://your-app-runner-url/api',
    baseUrl: process.env.REACT_APP_API_URL?.replace('/api', '') || 'https://your-app-runner-url'
  }
};

// Get current configuration
const getCurrentConfig = () => {
  if (isDevelopment) {
    return config.development;
  }
  return config.production;
};

// Export configuration
const { apiUrl, baseUrl } = getCurrentConfig();

// Helper function to create full API URLs
export const createApiUrl = (endpoint) => {
  // Remove leading slash if present
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${apiUrl}/${cleanEndpoint}`;
};

// Helper function to create file URLs (for PDF/HTML serving)
export const createFileUrl = (endpoint, params = {}) => {
  // Remove leading slash if present
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  const url = new URL(`${baseUrl}/${cleanEndpoint}`);
  
  // Add query parameters
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      url.searchParams.append(key, value);
    }
  });
  
  return url.toString();
};

// Environment info
export const getEnvironmentInfo = () => {
  return {
    environment: isProduction ? 'production' : 'development',
    apiUrl,
    baseUrl,
    isDevelopment,
    isProduction
  };
};

export default {
  apiUrl,
  baseUrl,
  createApiUrl,
  createFileUrl,
  getEnvironmentInfo
};