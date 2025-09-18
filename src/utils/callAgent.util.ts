/**
 * Utility function to call OpenRouter API for responses with image support
 * 
 * This utility interfaces with OpenRouter API to generate responses
 * using multimodal models that support both text and images
 */

import axios from 'axios';

// Interface for the OpenRouter API response
interface OpenRouterAPIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Content types for multimodal messages
interface TextContent {
  type: 'text';
  text: string;
}

interface ImageContent {
  type: 'image_url';
  image_url: {
    url: string;
  };
}

type MessageContent = TextContent | ImageContent;

/**
 * Extracts image URLs from text input
 * @param text The input text that may contain URLs
 * @returns Array of found image URLs
 */
function extractImageUrls(text: string): string[] {
  // Match URLs that end with common image extensions or are from common image hosts
  const imageUrlRegex = /https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif|webp|bmp)\b|https?:\/\/(?:imgur\.com|i\.imgur\.com|cdn\.discordapp\.com|media\.discordapp\.net)[^\s]+/gi;
  return text.match(imageUrlRegex) || [];
}

/**
 * Validates image URLs by attempting to access them
 * @param imageUrls Array of image URLs to validate
 * @returns Promise resolving to array of valid URLs and validation results
 */
async function validateImageUrls(imageUrls: string[]): Promise<{
  validUrls: string[];
  results: Array<{ url: string; valid: boolean; error?: string }>;
}> {
  const results: Array<{ url: string; valid: boolean; error?: string }> = [];
  const validUrls: string[] = [];

  console.log(`🔍 Validating ${imageUrls.length} image URLs...`);

  for (let i = 0; i < imageUrls.length; i++) {
    const url = imageUrls[i];
    console.log(`   Checking image ${i + 1}/${imageUrls.length}: ${url}`);
    
    try {
      // Quick HEAD request to check if URL is accessible
      const response = await axios.head(url, {
        timeout: 5000, // 5 second timeout
        headers: {
          'User-Agent': 'CVM-Nostr-Server/1.0'
        }
      });
      
      // Check if response indicates an image
      const contentType = response.headers['content-type'];
      const isImage = contentType && contentType.startsWith('image/');
      
      if (response.status >= 200 && response.status < 300 && isImage) {
        validUrls.push(url);
        results.push({ url, valid: true });
        console.log(`   ✅ Valid: ${url}`);
      } else {
        results.push({ 
          url, 
          valid: false, 
          error: `Invalid response: ${response.status} - ${contentType || 'no content-type'}` 
        });
        console.log(`   ❌ Invalid: ${url} (${response.status}, ${contentType})`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      results.push({ url, valid: false, error: errorMsg });
      console.log(`   ❌ Failed: ${url} (${errorMsg})`);
    }
  }

  console.log(`✅ Validation complete: ${validUrls.length}/${imageUrls.length} images accessible`);
  return { validUrls, results };
}

/**
 * Removes image URLs from text to avoid duplication
 * @param text The input text
 * @param imageUrls Array of image URLs to remove
 * @returns Clean text without image URLs
 */
function removeImageUrlsFromText(text: string, imageUrls: string[]): string {
  let cleanText = text;
  imageUrls.forEach(url => {
    cleanText = cleanText.replace(url, '').trim();
  });
  return cleanText.replace(/\s+/g, ' ').trim();
}

/**
 * Calls the OpenRouter API for responses with image support
 * @param userInput The user's question or input string (may contain image URLs)
 * @param apiToken The OpenRouter API token for authentication
 * @returns Promise with the API response content
 */
export async function callOpenRouterAgent(
  userInput: string,
  apiToken: string
): Promise<string> {
  // Extract image URLs from the input
  const detectedImageUrls = extractImageUrls(userInput);
  let validImageUrls: string[] = [];
  let imageValidationResults: Array<{ url: string; valid: boolean; error?: string }> = [];

  // Validate images if any were found
  if (detectedImageUrls.length > 0) {
    const validation = await validateImageUrls(detectedImageUrls);
    validImageUrls = validation.validUrls;
    imageValidationResults = validation.results;
  }

  const textOnly = removeImageUrlsFromText(userInput, detectedImageUrls);
  
  // Choose model based on whether valid images are present
  const model = validImageUrls.length > 0 ? 'google/gemini-2.0-flash-001' : 'openai/gpt-oss-120b';
  
  // Log the request for debugging
  console.log('🚀 Calling OpenRouter API');
  console.log(`   URL: https://openrouter.ai/api/v1/chat/completions`);
  console.log(`   User Input: ${userInput}`);
  console.log(`   Text Only: ${textOnly}`);
  console.log(`   Image URLs Detected: ${detectedImageUrls.length}`);
  console.log(`   Valid Images: ${validImageUrls.length}`);
  
  if (detectedImageUrls.length > 0) {
    imageValidationResults.forEach((result, index) => {
      const status = result.valid ? '✅' : '❌';
      const error = result.error ? ` (${result.error})` : '';
      console.log(`   Image ${index + 1}: ${status} ${result.url}${error}`);
    });
  }
  
  console.log(`   API Token: ${apiToken.substring(0, 10)}...`);
  console.log(`   Model: ${model}`);

  try {
    // Build content array
    const messageContent: MessageContent[] = [];
    
    // Add text content first (recommended by OpenRouter)
    if (textOnly) {
      messageContent.push({
        type: 'text',
        text: textOnly
      });
    }
    
    // Add only valid image content
    validImageUrls.forEach(url => {
      messageContent.push({
        type: 'image_url',
        image_url: {
          url: url
        }
      });
    });
    
    // If no text and no valid images, use the original input as text
    if (messageContent.length === 0) {
      messageContent.push({
        type: 'text',
        text: userInput
      });
    }

    // If we had images but none were valid, add a note to the text
    if (detectedImageUrls.length > 0 && validImageUrls.length === 0) {
      const failedImagesNote = `\n\nNote: ${detectedImageUrls.length} image(s) were detected but couldn't be accessed. Processing text-only.`;
      if (messageContent[0]?.type === 'text') {
        messageContent[0].text += failedImagesNote;
      } else {
        messageContent.unshift({
          type: 'text',
          text: textOnly + failedImagesNote
        });
      }
    }

    // Build the request payload
    const requestPayload: any = {
      model: model,
      messages: [
        {
          role: 'system',
          content: 'Please provide a summary of this users day for the given input.'
        },
        {
          role: 'user',
          content: messageContent.length === 1 && messageContent[0].type === 'text' 
            ? messageContent[0].text  // Simple text format for non-multimodal
            : messageContent          // Array format for multimodal
        }
      ]
    };

    // Add provider preference for supported models
    if (model === 'openai/gpt-oss-120b') {
      requestPayload.provider = {
        order: ['Groq']
      };
    }

    // Make the API request to Open Router
    const response = await axios.post<OpenRouterAPIResponse>(
      'https://openrouter.ai/api/v1/chat/completions',
      requestPayload,
      {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://cvm-nostr-server',
          'X-Title': 'CVM Nostr Server'
        }
      }
    );

    // Log the response for debugging
    console.log('✅ OpenRouter API Response received');
    console.log(`   Model: ${response.data.model}`);
    console.log(`   Finish Reason: ${response.data.choices[0]?.finish_reason}`);
    console.log(`   Response: ${response.data.choices[0]?.message?.content}`);
    console.log(`   Usage: ${JSON.stringify(response.data.usage)}`);
    
    // Log image processing summary
    if (detectedImageUrls.length > 0) {
      console.log(`📸 Image Processing Summary:`);
      console.log(`   Detected: ${detectedImageUrls.length}, Valid: ${validImageUrls.length}, Failed: ${detectedImageUrls.length - validImageUrls.length}`);
    }
    
    console.log('📝 Full response structure:', JSON.stringify(response.data, null, 2));

    // Extract and return the content from the response
    const responseContent = response.data.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error('No content received from OpenRouter API');
    }

    return responseContent;
  } catch (error) {
    console.error('❌ Error calling OpenRouter API:', error);
    
    // Log more details if it's an axios error
    if (axios.isAxiosError(error)) {
      console.error('   Status:', error.response?.status);
      console.error('   Status Text:', error.response?.statusText);
      console.error('   Response Data:', JSON.stringify(error.response?.data, null, 2));
      console.error('   Request URL:', error.config?.url);
      console.error('   Request Method:', error.config?.method);
    }

    // Re-throw the error for the caller to handle
    throw error;
  }
}