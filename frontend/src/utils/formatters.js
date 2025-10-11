/**
 * Number and currency formatting utilities for consistent display across the app
 */

/**
 * Format currency amounts with 2 decimal places and proper thousand separators
 * @param {number} amount - The amount to format
 * @param {string} currency - Currency code (default: USD)
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount, currency = 'USD') => {
  if (amount === null || amount === undefined) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

/**
 * Format regular numbers with thousand separators and specified decimal places
 * @param {number} value - The number to format
 * @param {number} decimals - Number of decimal places (default: 0)
 * @returns {string} Formatted number string
 */
export const formatNumber = (value, decimals = 0) => {
  if (value === null || value === undefined) return '0';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
};

/**
 * Format quantity values with 1 decimal place and thousand separators
 * @param {number} quantity - The quantity to format
 * @param {string} unit - Optional unit of measure
 * @returns {string} Formatted quantity string
 */
export const formatQuantity = (quantity, unit = '') => {
  if (quantity === null || quantity === undefined) return '0.0';
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(quantity);
  return unit ? `${formatted} ${unit}` : formatted;
};

/**
 * Format percentage values
 * @param {number} value - The value to format as percentage (0-1 range or 0-100 range)
 * @param {boolean} isDecimal - Whether the input is in decimal format (0.75) or percentage format (75)
 * @returns {string} Formatted percentage string
 */
export const formatPercentage = (value, isDecimal = true) => {
  if (value === null || value === undefined) return '0%';
  const percentage = isDecimal ? value * 100 : value;
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1
  }).format(percentage) + '%';
};