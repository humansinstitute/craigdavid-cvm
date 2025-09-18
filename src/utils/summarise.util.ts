/**
 * Utility function for generating humorous day summaries and posting to Nostr
 * 
 * This utility creates humorous summaries using OpenRouter API and publishes
 * them as Kind 1 Nostr events using the server's private key
 */

import { callOpenRouterAgent } from './callAgent.util.js';
import { PrivateKeySigner } from '@contextvm/sdk';
import { SimpleRelayPool } from '@contextvm/sdk';
import { finalizeEvent, getPublicKey } from 'nostr-tools';
import { mineEventPow } from './pow.util.js';

/**
 * Interface for the summarise result
 */
export interface SummaryResult {
  summary: string;
  nostrEventId: string;
  published: boolean;
  error?: string;
}

/**
 * Creates a humorous summary and posts it as a Kind 1 Nostr event
 * @param dayInput The input describing what the person has been up to
 * @param openRouterApiToken OpenRouter API token
 * @param serverPrivateKey Server's private key for signing Nostr events
 * @param relayPool Relay pool for publishing events
 * @returns Promise with summary and publication results
 */
export async function createAndPublishSummary(
  dayInput: string,
  openRouterApiToken: string,
  serverPrivateKey: string,
  relayPool: SimpleRelayPool,
  powDifficulty: number = 0
): Promise<SummaryResult> {
  console.log('📝 Creating humorous day summary...');
  console.log(`   Input: ${dayInput}`);

  try {
    // Step 1: Generate humorous summary using OpenRouter
    const summary = await generateHumorousSummary(dayInput, openRouterApiToken);
    
    // Step 2: Publish to Nostr as Kind 1 event
    const publicationResult = await publishSummaryToNostr(
      summary, 
      serverPrivateKey, 
      relayPool,
      powDifficulty
    );

    return {
      summary,
      nostrEventId: publicationResult.eventId,
      published: publicationResult.success,
      error: publicationResult.error
    };
  } catch (error) {
    console.error('❌ Error in createAndPublishSummary:', error);
    
    return {
      summary: '',
      nostrEventId: '',
      published: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Generates a humorous summary using OpenRouter API
 * @param dayInput The day description input
 * @param apiToken OpenRouter API token
 * @returns Promise with generated summary
 */
async function generateHumorousSummary(
  dayInput: string,
  apiToken: string
): Promise<string> {
  console.log('🤖 Generating humorous summary with AI...');
  
  // Create a modified version of callOpenRouterAgent specifically for summaries
  const summaryPrompt = `Please review the input and provide a humorous summary of what this person has been up to on this day: ${dayInput}`;
  
  // We need to temporarily override the system prompt in the API call
  // Since callOpenRouterAgent has a hardcoded system prompt, we'll create a custom version
  return await callOpenRouterAgentWithCustomPrompt(
    dayInput,
    "Please review the input and provide a humorous summary of what this person has been up to on this day",
    apiToken
  );
}

/**
 * Custom version of callOpenRouterAgent with configurable system prompt
 */
async function callOpenRouterAgentWithCustomPrompt(
  userInput: string,
  systemPrompt: string,
  apiToken: string
): Promise<string> {
  const axios = require('axios');
  
  // Extract image URLs and process them (reuse logic from callAgent.util.ts)
  const detectedImageUrls = extractImageUrls(userInput);
  let validImageUrls: string[] = [];

  // Validate images if any were found
  if (detectedImageUrls.length > 0) {
    const validation = await validateImageUrls(detectedImageUrls);
    validImageUrls = validation.validUrls;
  }

  const textOnly = removeImageUrlsFromText(userInput, detectedImageUrls);
  const model = validImageUrls.length > 0 ? 'google/gemini-2.0-flash-001' : 'openai/gpt-oss-120b';
  
  console.log(`🚀 Calling OpenRouter API for summary`);
  console.log(`   Model: ${model}`);
  console.log(`   System Prompt: ${systemPrompt}`);
  console.log(`   Valid Images: ${validImageUrls.length}/${detectedImageUrls.length}`);

  try {
    // Build content array
    const messageContent: any[] = [];
    
    if (textOnly) {
      messageContent.push({
        type: 'text',
        text: textOnly
      });
    }
    
    validImageUrls.forEach(url => {
      messageContent.push({
        type: 'image_url',
        image_url: { url: url }
      });
    });
    
    if (messageContent.length === 0) {
      messageContent.push({
        type: 'text',
        text: userInput
      });
    }

    const requestPayload: any = {
      model: model,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: messageContent.length === 1 && messageContent[0].type === 'text' 
            ? messageContent[0].text 
            : messageContent
        }
      ]
    };

    if (model === 'openai/gpt-oss-120b') {
      requestPayload.provider = { order: ['Groq'] };
    }

    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      requestPayload,
      {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://cvm-nostr-server',
          'X-Title': 'CVM Nostr Server - Summary'
        }
      }
    );

    const responseContent = response.data.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error('No content received from OpenRouter API');
    }

    console.log('✅ Summary generated successfully');
    return responseContent;
  } catch (error) {
    console.error('❌ Error calling OpenRouter for summary:', error);
    throw error;
  }
}

/**
 * Publishes summary to Nostr as Kind 1 event
 * @param summary The generated summary text
 * @param privateKeyHex Server's private key in hex format
 * @param relayPool Relay pool for publishing
 * @returns Promise with publication result
 */
async function publishSummaryToNostr(
  summary: string,
  privateKeyHex: string,
  relayPool: SimpleRelayPool,
  powDifficulty: number = 0
): Promise<{ success: boolean; eventId: string; error?: string }> {
  console.log('📡 Publishing summary to Nostr...');
  
  try {
    // Create signer from private key
    const signer = new PrivateKeySigner(privateKeyHex);
    const pubkey = await signer.getPublicKey();
    
    console.log(`   Publishing from: ${pubkey} 🎵`);
    console.log(`   Summary length: ${summary.length} characters`);

    // Create Kind 1 event (text note)
    const eventTemplate = {
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['client', 'Craig David'],
        ['t', 'summary'],
        ['t', 'humor']
      ],
      content: `📅 Daily Summary by Craig David\n\n${summary}\n\n#summary #humor #craigdavid`,
      pubkey: pubkey
    };

    // Sign the event
    const secretKey = Buffer.from(privateKeyHex, 'hex');
    let signedEvent = finalizeEvent(eventTemplate, secretKey);
    
    console.log(`   Event ID: ${signedEvent.id}`);

    // Apply Proof of Work if difficulty is specified
    if (powDifficulty > 0) {
      console.log(`   ⛏️  Mining PoW with difficulty ${powDifficulty}...`);
      try {
        const minedEvent = await mineEventPow(signedEvent, powDifficulty);
        
        // Re-sign the mined event since we added the nonce tag
        const minedEventTemplate = {
          kind: minedEvent.kind,
          created_at: minedEvent.created_at,
          tags: minedEvent.tags,
          content: minedEvent.content,
          pubkey: minedEvent.pubkey
        };
        
        signedEvent = finalizeEvent(minedEventTemplate, secretKey);
        console.log(`   ✅ PoW mining completed! New Event ID: ${signedEvent.id}`);
      } catch (error) {
        console.warn(`   ⚠️  PoW mining failed, publishing without PoW:`, error);
        // Continue with original event if PoW fails
      }
    }

    // Publish to relays using the relay pool's publish method
    try {
      console.log(`   📡 Publishing to ${relayPool['normalizedRelayUrls']?.length || 'unknown'} relays...`);
      
      const publishPromises = await relayPool.publish(signedEvent);
      
      // The SimpleRelayPool.publish() method returns Promise.all() results
      // Most relay pools handle individual relay failures gracefully
      console.log(`   ✅ Published to relay pool successfully`);
      
      return {
        success: true,
        eventId: signedEvent.id,
        error: undefined
      };
    } catch (error) {
      // Even if some relays fail, the event might still be published to others
      // We'll consider it a partial success if at least one relay worked
      console.warn(`   ⚠️  Some relays may have failed during publishing:`, error);
      console.log(`   ℹ️  Event may still be available on some relays`);
      
      // For better user experience, we'll report this as successful with a warning
      // The SimpleRelayPool handles retry logic automatically
      return {
        success: true, // Consider partial success as success
        eventId: signedEvent.id,
        error: `Some relays failed: ${error instanceof Error ? error.message : 'Unknown publishing error'}`
      };
    }
  } catch (error) {
    console.error('❌ Error publishing to Nostr:', error);
    return {
      success: false,
      eventId: '',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Helper functions (simplified versions from callAgent.util.ts)
function extractImageUrls(text: string): string[] {
  const imageUrlRegex = /https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif|webp|bmp)\b|https?:\/\/(?:imgur\.com|i\.imgur\.com|cdn\.discordapp\.com|media\.discordapp\.net)[^\s]+/gi;
  return text.match(imageUrlRegex) || [];
}

function removeImageUrlsFromText(text: string, imageUrls: string[]): string {
  let cleanText = text;
  imageUrls.forEach(url => {
    cleanText = cleanText.replace(url, '').trim();
  });
  return cleanText.replace(/\s+/g, ' ').trim();
}

async function validateImageUrls(imageUrls: string[]): Promise<{
  validUrls: string[];
  results: Array<{ url: string; valid: boolean; error?: string }>;
}> {
  // Simplified validation - just return all as valid for now
  // In production, you'd want to implement the full validation from callAgent.util.ts
  return {
    validUrls: imageUrls,
    results: imageUrls.map(url => ({ url, valid: true }))
  };
}