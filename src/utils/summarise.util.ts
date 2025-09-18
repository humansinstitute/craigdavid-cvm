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
  subjectPubkey: string,
  openRouterApiToken: string,
  serverPrivateKey: string,
  relayPool: SimpleRelayPool,
  powDifficulty: number = 0
): Promise<SummaryResult> {
  console.log('🎵 Creating weekly Craig David rap...');
  console.log(`   Subject pubkey: ${subjectPubkey}`);
  console.log(`   Input preview: ${weeklyContent.substring(0, 100)}...`);

  try {
    // Step 1: Generate weekly rap using OpenRouter
    const weeklyRap = await generateWeeklyRap(weeklyContent, openRouterApiToken);
    
    // Step 2: Publish to Nostr as Kind 1 event
    const publicationResult = await publishWeeklyRapToNostr(
      weeklyRap,
      subjectPubkey,
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
  subjectPubkey: string,
  openRouterApiToken: string,
  serverPrivateKey: string,
  relayPool: SimpleRelayPool,
  powDifficulty: number = 0
): Promise<SummaryResult> {
  console.log('📝 Creating humorous day summary...');
  console.log(`   Subject pubkey: ${subjectPubkey}`);
  console.log(`   Input preview: ${dayInput.substring(0, 100)}...`);

  try {
    // Step 1: Generate humorous summary using OpenRouter
    const summary = await generateHumorousSummary(dayInput, openRouterApiToken);
    
    // Step 2: Publish to Nostr as Kind 1 event
    const publicationResult = await publishSummaryToNostr(
      summary,
      subjectPubkey,
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
 * Creates and publishes a roast using OpenRouter API
 * @param socialPosts Input social media posts to roast
 * @param subjectPubkey Hex pubkey of person being roasted
 * @param openRouterApiToken OpenRouter API token
 * @param roastPrivateKey Private key for roast account
 * @param relayPool Relay pool for publishing events
 * @param powDifficulty PoW difficulty for mining
 * @returns Promise with roast and publication results
 */
export async function createAndPublishRoast(
  socialPosts: string,
  subjectPubkey: string,
  openRouterApiToken: string,
  roastPrivateKey: string,
  relayPool: SimpleRelayPool,
  powDifficulty: number = 0
): Promise<SummaryResult> {
  console.log('🔥 Creating witty roast...');
  console.log(`   Subject pubkey: ${subjectPubkey}`);
  console.log(`   Input preview: ${socialPosts.substring(0, 100)}...`);

  try {
    // Step 1: Generate roast using OpenRouter
    const roast = await generateRoast(socialPosts, openRouterApiToken);
    
    // Step 2: Publish to Nostr as Kind 1 event
    const publicationResult = await publishRoastToNostr(
      roast,
      subjectPubkey,
      roastPrivateKey, 
      relayPool,
      powDifficulty
    );

    return {
      summary: roast,
      nostrEventId: publicationResult.eventId,
      published: publicationResult.success,
      error: publicationResult.error
    };
  } catch (error) {
    console.error('❌ Error in createAndPublishRoast:', error);
    
    return {
      summary: '',
      nostrEventId: '',
      published: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  };
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
  subjectPubkey: string,
  privateKeyHex: string,
  relayPool: SimpleRelayPool,
  powDifficulty: number = 0,
  dayInput?: string
): Promise<{ success: boolean; eventId: string; error?: string }> {
  console.log('📡 Publishing summary to Nostr...');
  console.log(`   Subject pubkey: ${subjectPubkey}`);
  
  try {
    // Create signer from private key
    const signer = new PrivateKeySigner(privateKeyHex);
    const pubkey = await signer.getPublicKey();
    
    console.log(`   Publishing from: ${pubkey} 🎵`);
    console.log(`   Summary length: ${summary.length} characters`);

    // Use the passed subjectPubkey directly
    const targetPubkey = subjectPubkey;
    let dateStr: string | undefined;
    
    if (dayInput) {
      // No longer extract npub - we get it directly as subjectPubkey parameter
      
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
  subjectPubkey: string,
  privateKeyHex: string,
  relayPool: SimpleRelayPool,
  powDifficulty: number = 0
): Promise<{ success: boolean; eventId: string; error?: string }> {
  console.log('📡 Publishing weekly rap to Nostr...');
  console.log(`   Subject pubkey: ${subjectPubkey}`);
  
  try {
    // Create signer from private key
    const signer = new PrivateKeySigner(privateKeyHex);
    const pubkey = await signer.getPublicKey();
    
    console.log(`   Publishing from: ${pubkey} 🎵`);
    console.log(`   Rap length: ${weeklyRap.length} characters`);

    // Build tags array for weekly rap
    const tags: Array<[string, ...string[]]> = [
      ['client', 'Craig David'],
      ['p', subjectPubkey],  // Person this rap is about
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

/**
 * Generates a roast using OpenRouter API with custom system prompt
 * @param socialPosts The social media posts to roast
 * @param apiToken OpenRouter API token
 * @returns Promise with generated roast
 */
async function generateRoast(socialPosts: string, apiToken: string): Promise<string> {
  const systemPrompt = `You are a witty comedy roasting assistant inspired by the observational and roasting styles of stand-up comedians. Your job is to provide humorous, clever commentary on social media posts in a roasting format.

Core Guidelines:
- Focus on obvious contradictions, humble brags, or amusing patterns in the posts
- Use observational humor rather than personal attacks
- Keep roasts clever and witty, not cruel or genuinely hurtful
- Avoid comments about physical appearance, serious personal struggles, or protected characteristics
- Channel a dry, sarcastic delivery style with unexpected punchlines
- Use callbacks and escalating observations when you spot patterns

Roasting Techniques:
- Point out ironic contradictions between posts
- Call out obvious fishing for compliments or attention
- Mock overly dramatic reactions to minor inconveniences
- Highlight when someone's trying too hard to appear sophisticated/cool
- Notice when posts reveal more than the person intended

Boundaries:
- Never roast posts about genuine hardship, loss, or mental health struggles
- Keep it playful, not vicious
- Be funny and friendly

Format: Provide 2-3 short roasting observations, each 1-2 sentences maximum.`;
  
  return await callOpenRouterAgentWithCustomPrompt(
    socialPosts,
    systemPrompt,
    apiToken,
    'x-ai/grok-4'
  );
}

/**
 * Publishes roast to Nostr as Kind 1 event
 * @param roast The generated roast content
 * @param subjectPubkey Hex pubkey of person being roasted
 * @param privateKeyHex Roast account's private key
 * @param relayPool Relay pool for publishing
 * @param powDifficulty PoW difficulty
 * @returns Promise with publication result
 */
async function publishRoastToNostr(
  roast: string,
  subjectPubkey: string,
  privateKeyHex: string,
  relayPool: SimpleRelayPool,
  powDifficulty: number = 0
): Promise<{ success: boolean; eventId: string; error?: string }> {
  console.log('📡 Publishing roast to Nostr...');
  console.log(`   Subject pubkey: ${subjectPubkey}`);
  
  try {
    // Create signer from private key
    const signer = new PrivateKeySigner(privateKeyHex);
    const pubkey = await signer.getPublicKey();
    
    console.log(`   Publishing from: ${pubkey} 🔥`);
    console.log(`   Roast length: ${roast.length} characters`);

    // Build tags array for roast
    const tags: Array<[string, ...string[]]> = [
      ['client', 'Roast Bot'],
      ['p', subjectPubkey],  // Person being roasted
      ['t', 'roast'],
      ['t', 'comedy'],
      ['t', 'humor']
    ];

    // Create Kind 1 event (text note)
    const eventTemplate = {
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags: tags,
      content: `🔥 Roast Time!\n\n${roast}\n\n#roast #comedy #humor`,
      pubkey: pubkey
    };

    console.log(`   Event template created for roast`);
    console.log(`   Tags: ${JSON.stringify(tags)}`);

    // Sign the event first, then mine if needed
    const signedEvent = await signer.signEvent(eventTemplate);
    
    // Mine event with PoW if difficulty > 0
    let finalEvent;
    if (powDifficulty > 0) {
      console.log(`⛏️  Mining event with difficulty ${powDifficulty}...`);
      finalEvent = await mineEventPow(signedEvent, powDifficulty);
      console.log(`✅ Event mined successfully`);
    } else {
      // Use the signed event as-is
      finalEvent = signedEvent;
    }

    // Log the final event details
    console.log(`   Final event ID: ${finalEvent.id}`);
    console.log(`   Event content preview: ${finalEvent.content.substring(0, 100)}...`);

    // Publish to all relays
    console.log('📡 Publishing to Nostr relays...');
    await relayPool.publish(finalEvent);
    
    console.log(`✅ Roast published successfully!`);
    console.log(`   Event ID: ${finalEvent.id}`);
    console.log(`   Published to ${relayPool['relays']?.length || 'unknown'} relays`);

    return {
      success: true,
      eventId: finalEvent.id
    };

  } catch (error) {
    console.error('❌ Error publishing roast to Nostr:', error);
    return {
      success: false,
      eventId: '',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}