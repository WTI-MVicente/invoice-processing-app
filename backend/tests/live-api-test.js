const fetch = require('node-fetch');

// This test calls the actual running API server
describe('Live API Endpoint Tests', () => {
  let authToken;
  let testPromptId;
  
  beforeAll(async () => {
    // Get authentication token
    try {
      const loginResponse = await fetch('http://localhost:5001/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: 'demo@waterfield.tech',
          password: 'waterfield2025'
        })
      });
      
      if (loginResponse.ok) {
        const loginData = await loginResponse.json();
        authToken = loginData.token;
        console.log('✅ Got auth token');
      } else {
        console.log('❌ Failed to get auth token:', await loginResponse.text());
      }
    } catch (error) {
      console.log('❌ Login request failed:', error.message);
    }
  });

  test('Should test GET prompts endpoint', async () => {
    if (!authToken) {
      console.log('⚠️  Skipping test - no auth token');
      return;
    }

    try {
      const response = await fetch('http://localhost:5001/api/prompts', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ GET prompts successful');
        console.log('📊 Found', data.prompts.length, 'prompts');
        
        if (data.prompts.length > 0) {
          testPromptId = data.prompts[0].id;
          console.log('📝 Will use prompt for testing:', testPromptId);
        }
      } else {
        console.log('❌ GET prompts failed:', response.status, await response.text());
      }
    } catch (error) {
      console.log('❌ GET request failed:', error.message);
    }
  });

  test('Should test PUT prompt update endpoint', async () => {
    if (!authToken || !testPromptId) {
      console.log('⚠️  Skipping test - no auth token or prompt ID');
      return;
    }

    try {
      const updateData = {
        prompt_name: 'Live API Test Update',
        prompt_text: 'Updated via live API test',
        vendor_id: null,
        is_template: true,
        is_active: false
      };

      console.log('🔄 Testing PUT update with data:', updateData);

      const response = await fetch(`http://localhost:5001/api/prompts/${testPromptId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      console.log('📊 Response status:', response.status);
      const responseText = await response.text();
      console.log('📊 Response body:', responseText);

      if (response.ok) {
        console.log('✅ PUT update successful');
        const data = JSON.parse(responseText);
        console.log('📊 Updated prompt:', data.prompt.prompt_name);
      } else {
        console.log('❌ PUT update failed');
        console.log('❌ Response:', responseText);
      }
    } catch (error) {
      console.log('❌ PUT request failed:', error.message);
      console.log('❌ Error stack:', error.stack);
    }
  });

  test('Should test POST create prompt endpoint', async () => {
    if (!authToken) {
      console.log('⚠️  Skipping test - no auth token');
      return;
    }

    try {
      const createData = {
        prompt_name: 'Live API Test Create',
        prompt_text: 'Created via live API test',
        vendor_id: null,
        is_template: true,
        is_active: false
      };

      console.log('🔄 Testing POST create with data:', createData);

      const response = await fetch('http://localhost:5001/api/prompts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(createData)
      });

      console.log('📊 Create response status:', response.status);
      const responseText = await response.text();
      console.log('📊 Create response body:', responseText);

      if (response.ok) {
        console.log('✅ POST create successful');
        const data = JSON.parse(responseText);
        console.log('📊 Created prompt:', data.prompt.id);
        
        // Clean up - delete the created prompt
        const deleteResponse = await fetch(`http://localhost:5001/api/prompts/${data.prompt.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
        console.log('🧹 Cleanup delete status:', deleteResponse.status);
      } else {
        console.log('❌ POST create failed');
      }
    } catch (error) {
      console.log('❌ POST request failed:', error.message);
    }
  });
});