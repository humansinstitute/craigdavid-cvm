/**
 * Utility function to trigger video montage creation
 * 
 * This utility interfaces with the dev.otherstuff.studio API to trigger
 * a video montage creation from files in a specified directory
 */

import axios from 'axios';

interface MontageResponse {
  success: boolean;
  message?: string;
  session_id?: string;
  [key: string]: any;
}

/**
 * Creates a video montage using the otherstuff.studio API
 * @param dir The directory path containing files to create montage from
 * @param prompt The prompt describing how to create the montage
 * @param pubkey The user's public key for authentication/identification
 * @returns Promise with the API response
 */
export async function createMontage(
  dir: string,
  prompt: string,
  pubkey: string
): Promise<string> {
  // Generate random 4-digit number for session name
  const randomId = Math.floor(1000 + Math.random() * 9000);
  const sessionName = `Short Video Montage ${randomId}`;

  // Log the request for debugging
  console.log('🎬 Creating video montage');
  console.log(`   Directory: ${dir}`);
  console.log(`   Prompt: ${prompt}`);
  console.log(`   Session Name: ${sessionName}`);
  console.log(`   User Pubkey: ${pubkey.substring(0, 10)}...`);

  // Resolve API base and token from environment
  // Defaults chosen to match known working Postman target
  const base = (process.env.TRIGGER_API_BASE || 'http://dev.otherstuff.studio:3000').replace(/\/$/, '');
  const token = process.env.TRIGGER_API_TOKEN;
  const endpoint = `${base}/api/triggers`; // Use plural path only
  
  if (!token) {
    throw new Error('Montage creation failed: missing TRIGGER_API_TOKEN env var');
  }

  let response: any = null;
  console.log(`   Using endpoint: ${endpoint}`);
  try {
    response = await axios.post<MontageResponse>(
      endpoint,
      {
        recipe_id: '24fff1dda53900e41493cdf2ff643854',
        prompt: prompt,
        session_name: sessionName,
        dir: dir
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000 // allow slower responses than Postman
      }
    );
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('❌ Montage request failed');
      console.error('   URL:', endpoint);
      console.error('   Status:', error.response?.status);
      console.error('   Status Text:', error.response?.statusText);
      if (error.response?.data) {
        console.error('   Response Data:', JSON.stringify(error.response.data));
      }
      // Common misconfigs surfaced clearly
      if (error.response?.status === 404) {
        console.error('   Hint: Ensure the path is /api/triggers (plural) and TRIGGER_API_BASE is correct.');
      }
      if (error.response?.status === 401 || error.response?.status === 403) {
        console.error('   Hint: Check TRIGGER_API_TOKEN value.');
      }
      throw new Error(`Montage creation failed: ${error.response?.data?.message || error.message}`);
    }
    throw error;
  }

  // Log the response for debugging
  console.log('✅ Montage trigger response received');
  console.log(`   Response:`, JSON.stringify(response.data, null, 2));

  // Format the response message
  let responseMessage = 'Video montage creation triggered successfully!';
  
  if (response.data.session_id) {
    responseMessage += `\nSession ID: ${response.data.session_id}`;
  }
  
  if (response.data.message) {
    responseMessage += `\n${response.data.message}`;
  }

  responseMessage += `\nSession Name: ${sessionName}`;
  responseMessage += `\nDirectory: ${dir}`;
  responseMessage += `\nRequested by: ${pubkey}`;

  return responseMessage;
}
