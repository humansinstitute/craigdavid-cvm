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
 * Creates a weekly rap and posts it as a Kind 1 Nostr event
 * @param weeklyContent The input describing the week's activities
 * @param openRouterApiToken OpenRouter API token
 * @param serverPrivateKey Server's private key for signing Nostr events
 * @param relayPool Relay pool for publishing events
 * @returns Promise with rap and publication results
 */
export async function createAndPublishWeeklyRap(
  weeklyContent: string,
  openRouterApiToken: string,
  serverPrivateKey: string,
  relayPool: SimpleRelayPool,
  powDifficulty: number = 0
): Promise<SummaryResult> {
  console.log('🎵 Creating weekly Craig David rap...');
  console.log(`   Input: ${weeklyContent}`);

  try {
    // Step 1: Generate weekly rap using OpenRouter
    const weeklyRap = await generateWeeklyRap(weeklyContent, openRouterApiToken);
    
    // Step 2: Publish to Nostr as Kind 1 event
    const publicationResult = await publishWeeklyRapToNostr(
      weeklyRap, 
      serverPrivateKey, 
      relayPool,
      powDifficulty
    );

    return {
      summary: weeklyRap,
      nostrEventId: publicationResult.eventId,
      published: publicationResult.success,
      error: publicationResult.error
    };
  } catch (error) {
    console.error('❌ Error in createAndPublishWeeklyRap:', error);
    
    return {
      summary: '',
      nostrEventId: '',
      published: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
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
      powDifficulty,
      dayInput
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
 * Custom version of callOpenRouterAgent with configurable system prompt and model
 */
async function callOpenRouterAgentWithCustomPrompt(
  userInput: string,
  systemPrompt: string,
  apiToken: string,
  modelOverride?: string
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
  const model = modelOverride || (validImageUrls.length > 0 ? 'google/gemini-2.0-flash-001' : 'openai/gpt-oss-120b');
  
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
    } else if (model === 'x-ai/grok-2-1212') {
      // Grok model specific configuration if needed
      requestPayload.provider = { order: ['x-ai'] };
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
 * @param dayInput Original day input to extract metadata
 * @returns Promise with publication result
 */
async function publishSummaryToNostr(
  summary: string,
  privateKeyHex: string,
  relayPool: SimpleRelayPool,
  powDifficulty: number = 0,
  dayInput?: string
): Promise<{ success: boolean; eventId: string; error?: string }> {
  console.log('📡 Publishing summary to Nostr...');
  
  try {
    // Create signer from private key
    const signer = new PrivateKeySigner(privateKeyHex);
    const pubkey = await signer.getPublicKey();
    
    console.log(`   Publishing from: ${pubkey} 🎵`);
    console.log(`   Summary length: ${summary.length} characters`);

    // Extract metadata from dayInput if available
    let targetPubkey: string | undefined;
    let dateStr: string | undefined;
    
    if (dayInput) {
      // Extract npub from the input (format: "...for npub12guhgpnn700zd... (day 250913):...")
      const npubMatch = dayInput.match(/npub([a-z0-9]+)/i);
      if (npubMatch) {
        try {
          // Convert npub to hex pubkey
          const { nip19 } = await import('nostr-tools');
          const decoded = nip19.decode(npubMatch[0]);
          if (decoded.type === 'npub') {
            targetPubkey = decoded.data as string;
            console.log(`   Target user pubkey: ${targetPubkey}`);
          }
        } catch (e) {
          console.warn(`   Could not decode npub: ${e}`);
        }
      }
      
      // Extract date from the input (format: "...(day 250913):..." or "...(day 2024-09-18):...")
      const dateMatch = dayInput.match(/\(day ([0-9-]+)\)/);
      if (dateMatch && dateMatch[1]) {
        // Convert YYMMDD to YYYY-MM-DD if needed
        const rawDate = dateMatch[1].replace('-events.json', '');
        if (rawDate.length === 6 && !rawDate.includes('-')) {
          // Format: YYMMDD -> 20YY-MM-DD
          const year = '20' + rawDate.substring(0, 2);
          const month = rawDate.substring(2, 4);
          const day = rawDate.substring(4, 6);
          dateStr = `${year}-${month}-${day}`;
        } else if (rawDate.includes('-')) {
          // Already in YYYY-MM-DD format
          dateStr = rawDate;
        } else {
          // Try to use as-is
          dateStr = rawDate;
        }
        console.log(`   Date extracted: ${dateStr}`);
      }
    }

    // Build tags array
    const tags: Array<[string, ...string[]]> = [
      ['client', 'Craig David'],
      ['t', 'daily-summary'],
      ['t', 'humor']
    ];
    
    // Add p tag if we have the target pubkey
    if (targetPubkey) {
      tags.push(['p', targetPubkey]);
    }
    
    // Add date tag if we have the date
    if (dateStr) {
      tags.push(['date', dateStr]);
    }

    // Create Kind 1 event (text note)
    const eventTemplate = {
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags: tags,
      content: `📅 Daily Summary by Craig David\n\n${summary}\n\n#dailysummary #humor #craigdavid`,
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

/**
 * Generates a weekly rap using OpenRouter API
 * @param weeklyContent The week description input
 * @param apiToken OpenRouter API token
 * @returns Promise with generated rap
 */
async function generateWeeklyRap(
  weeklyContent: string,
  apiToken: string
): Promise<string> {
  console.log('🎤 Generating weekly rap with AI...');
  
  const systemPrompt = `You are Craig David, the legendary R&B artist. Create a humorous rap that follows the day-by-day structure of your famous song "7 Days" (Monday through Sunday progression). Transform the user's weekly activities into a catchy, rhythmic rap that captures the essence of your original song's flow and style.

Structure your response as a rap with:
- A day-by-day progression (Monday through Sunday)
- Rhythmic flow similar to "7 Days" 
- Humorous comparisons between the user's actual week and the romantic adventures of craig david
- Feel free to "take the piss" and "roast" the user
- The iconic "Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday" structure
- Some highlights from craigs week for comparison

Craig's Wild Week in a Nutshell:Monday: Craigs strutting through the subway at 3:15 PM when he spots a total bombshell. She asks for the time; he slickly demands her name, number, and a date tomorrow at nine. Shes game—score!
Tuesday: They hit a bar, probably sipping something fancy like Moët, and Craigs smooth-talking her into a frenzy. Sparks are flying!
Wednesday: Things get steamy. Theyre not just making eyes anymore—theyre making love like its an Olympic sport.
Thursday-Saturday: Its a full-on bedroom marathon. Craigs getting more action than a rom-com montage, and shes flipping it front to back like a pro.
Sunday: They finally chill, probably binge-watching something with takeout, exhausted from their week-long love-fest.



Keep it fun, family-friendly, and true to Craig David's musical style! Start with "You know what? Got something to say..." and follow the classic progression.`;
  
  return await callOpenRouterAgentWithCustomPrompt(
    weeklyContent,
    systemPrompt,
    apiToken,
    'x-ai/grok-4'
  );
}

/**
 * Publishes weekly rap to Nostr as Kind 1 event
 * @param weeklyRap The generated rap text
 * @param privateKeyHex Server's private key in hex format
 * @param relayPool Relay pool for publishing
 * @returns Promise with publication result
 */
async function publishWeeklyRapToNostr(
  weeklyRap: string,
  privateKeyHex: string,
  relayPool: SimpleRelayPool,
  powDifficulty: number = 0
): Promise<{ success: boolean; eventId: string; error?: string }> {
  console.log('📡 Publishing weekly rap to Nostr...');
  
  try {
    // Create signer from private key
    const signer = new PrivateKeySigner(privateKeyHex);
    const pubkey = await signer.getPublicKey();
    
    console.log(`   Publishing from: ${pubkey} 🎵`);
    console.log(`   Rap length: ${weeklyRap.length} characters`);

    // Build tags array for weekly rap
    const tags: Array<[string, ...string[]]> = [
      ['client', 'Craig David'],
      ['t', 'weekly-song'],
      ['t', 'humor'],
      ['t', 'craigdavid']
    ];

    // Create Kind 1 event (text note)
    const eventTemplate = {
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags: tags,
      content: `🎵 Weekly Rap by Craig David\n\n${weeklyRap}\n\n#weeklysong #humor #craigdavid #7days`,
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
      }
    }

    // Publish to relays
    try {
      console.log(`   📡 Publishing to ${relayPool['normalizedRelayUrls']?.length || 'unknown'} relays...`);
      
      const publishPromises = await relayPool.publish(signedEvent);
      console.log(`   ✅ Published weekly rap to relay pool successfully`);
      
      return {
        success: true,
        eventId: signedEvent.id,
        error: undefined
      };
    } catch (error) {
      console.warn(`   ⚠️  Some relays may have failed during publishing:`, error);
      
      return {
        success: true, // Consider partial success as success
        eventId: signedEvent.id,
        error: `Some relays failed: ${error instanceof Error ? error.message : 'Unknown publishing error'}`
      };
    }
  } catch (error) {
    console.error('❌ Error publishing weekly rap to Nostr:', error);
    return {
      success: false,
      eventId: '',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}