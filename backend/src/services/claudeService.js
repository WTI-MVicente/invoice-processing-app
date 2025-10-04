const Anthropic = require('@anthropic-ai/sdk');

class ClaudeService {
  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    this.model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';
  }

  /**
   * Extract invoice data from document content using Claude
   * @param {string} documentContent - The text content of the invoice
   * @param {string} vendorPrompt - Vendor-specific extraction prompt
   * @param {string} documentType - 'pdf' or 'html'
   * @returns {Promise<Object>} Extracted invoice data
   */
  async extractInvoiceData(documentContent, vendorPrompt, documentType = 'pdf') {
    try {
      console.log(`🤖 Processing ${documentType.toUpperCase()} document with Claude...`);
      
      const messages = [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `${vendorPrompt}\n\nDocument content:\n${documentContent}`
            }
          ]
        }
      ];

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        messages: messages
      });

      const responseText = response.content[0].text;
      
      // Parse JSON response from Claude
      const extractedData = this.parseClaudeResponse(responseText);
      
      // Calculate confidence score
      const confidenceScore = this.calculateConfidenceScore(extractedData);
      
      return {
        ...extractedData,
        confidence_score: confidenceScore,
        processing_time_ms: Date.now() - Date.now(), // Will be set by caller
        claude_response_length: responseText.length
      };

    } catch (error) {
      console.error('❌ Claude API error:', error);
      throw new Error(`Invoice processing failed: ${error.message}`);
    }
  }

  /**
   * Parse Claude's JSON response and clean it up
   * @param {string} responseText - Raw response from Claude
   * @returns {Object} Parsed invoice data
   */
  parseClaudeResponse(responseText) {
    try {
      console.log('🔍 Raw Claude response (first 1000 chars):', responseText.substring(0, 1000));
      
      // Remove any markdown formatting and explanatory text that Claude might add
      let cleanedResponse = responseText
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();

      // Find the JSON object - look for the first { and last }
      const firstBrace = cleanedResponse.indexOf('{');
      const lastBrace = cleanedResponse.lastIndexOf('}');
      
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleanedResponse = cleanedResponse.substring(firstBrace, lastBrace + 1);
      }

      console.log('🔍 Cleaned response (first 500 chars):', cleanedResponse.substring(0, 500));

      const parsed = JSON.parse(cleanedResponse);
      
      // Validate required structure
      if (!parsed.invoice_header || !parsed.line_items) {
        console.error('❌ Missing required structure. Got keys:', Object.keys(parsed));
        throw new Error('Invalid response structure from Claude');
      }

      return parsed;
    } catch (error) {
      console.error('❌ Failed to parse Claude response. Full response:', responseText);
      console.error('❌ Parse error:', error.message);
      throw new Error('Failed to parse Claude response as JSON');
    }
  }

  /**
   * Calculate confidence score based on extracted data completeness
   * @param {Object} extractedData - The extracted invoice data
   * @returns {number} Confidence score between 0 and 1
   */
  calculateConfidenceScore(extractedData) {
    let score = 1.0;
    const header = extractedData.invoice_header;
    
    // Deduct for missing required fields
    if (!header.invoice_number) score -= 0.3;
    if (!header.customer_name) score -= 0.3;
    
    // Deduct for missing important fields
    if (!header.invoice_date) score -= 0.1;
    if (!header.total_amount) score -= 0.1;
    
    // Deduct for empty line items
    if (!extractedData.line_items || extractedData.line_items.length === 0) {
      score -= 0.2;
    }
    
    // Check for confidence notes from Claude
    if (extractedData.confidence_notes && 
        extractedData.confidence_notes.toLowerCase().includes('uncertain')) {
      score -= 0.1;
    }
    
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Test Claude API connection
   * @returns {Promise<boolean>} True if connection successful
   */
  async testConnection() {
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 50,
        messages: [
          {
            role: 'user',
            content: 'Respond with "Claude API connection successful"'
          }
        ]
      });
      
      const responseText = response.content[0].text;
      return responseText.includes('successful');
    } catch (error) {
      console.error('❌ Claude API connection test failed:', error);
      return false;
    }
  }
}

module.exports = new ClaudeService();