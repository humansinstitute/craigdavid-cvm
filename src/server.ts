/**
 * MCP Server Implementation using NostrServerTransport
 * 
 * This server demonstrates how to create an MCP (Model Context Protocol) server
 * that communicates over the Nostr network. It listens for incoming requests
 * from clients and provides tools that can be called remotely.
 * 
 * The server uses:
 * - NostrServerTransport: For network communication over Nostr relays
 * - PrivateKeySigner: For cryptographic signing of messages
 * - SimpleRelayPool: To manage connections to multiple Nostr relays
 * - MCP SDK: To handle the Model Context Protocol implementation
 */

// Load environment variables from .env file
import * as dotenv from 'dotenv';
dotenv.config();

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { NostrServerTransport } from "@contextvm/sdk";
import { PrivateKeySigner } from "@contextvm/sdk";
import { SimpleRelayPool } from "@contextvm/sdk";
import { generateSecretKey, getPublicKey } from "nostr-tools";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { callOpenRouterAgent } from "./utils/callAgent.util.js";
import { createAndPublishSummary, createAndPublishWeeklyRap, createAndPublishRoast } from "./utils/summarise.util.js";
import { createMontage } from "./utils/montage.util.js";

// ==================== Configuration Section ====================
/**
 * Server Configuration
 * 
 * SERVER_PRIVATE_KEY: The server's private key for Nostr identity.
 * - In production, this should be stored securely in .env file
 * - This key identifies the server on the Nostr network
 * - Format: 32-byte hex string (64 characters)
 * 
 * For demo purposes, we'll generate a new key if not provided
 */
// Debug: Check if .env is loaded
console.log("🔍 Checking for SERVER_PRIVATE_KEY in environment...");

const SERVER_PRIVATE_KEY_HEX = (() => {
  const envKey = process.env.SERVER_PRIVATE_KEY;
  
  if (envKey && envKey.trim().length > 0) {
    // Validate the key format (should be 64 hex characters)
    const cleanKey = envKey.trim();
    if (!/^[0-9a-fA-F]{64}$/.test(cleanKey)) {
      console.error("❌ Invalid SERVER_PRIVATE_KEY format in .env file!");
      console.error("   Expected: 64 hexadecimal characters");
      console.error("   Got:", cleanKey.length, "characters");
      process.exit(1);
    }
    console.log("✅ Using private key from .env file");
    return cleanKey;
  } else {
    // Generate a new private key for demo purposes
    const secretKey = generateSecretKey();
    // Convert Uint8Array to hex string
    const hexKey = Buffer.from(secretKey).toString('hex');
    console.log("⚠️  No SERVER_PRIVATE_KEY found in environment!");
    console.log("   Generated new server private key (save this for persistent identity):");
    console.log(`   Private Key: ${hexKey}`);
    console.log("\n💡 To use a persistent key, create a .env file with:");
    console.log(`   SERVER_PRIVATE_KEY=${hexKey}`);
    return hexKey;
  }
})();

/**
 * Nostr Relay Configuration
 * 
 * These are the Nostr relay servers that will be used for communication.
 * - Multiple relays provide redundancy and better network coverage
 * - Public relays are free to use but may have rate limits
 * - You can add your own relay servers to this list
 */
const RELAYS = [
  "wss://relay.contextvm.org",
  "wss://relay.damus.io",     // Popular public relay
  "wss://nos.lol",             // Alternative public relay
  "wss://relay.nostr.band",    // Analytics-focused relay
];

/**
 * OpenRouter API Configuration
 * 
 * API token for calling the OpenRouter API for funny responses
 * This should be stored in the .env file as OPEN_ROUTER_KEY
 */
const OPEN_ROUTER_KEY = process.env.OPEN_ROUTER_KEY;

if (!OPEN_ROUTER_KEY) {
  console.warn("⚠️  OPEN_ROUTER_KEY not found in environment!");
  console.warn("   The funny_agent tool will not work without it.");
  console.warn("   Add OPEN_ROUTER_KEY=your_token to .env file");
}

/**
 * Proof of Work Configuration
 * 
 * POW_DIFFICULTY sets the number of leading zero bits required for Nostr events
 * Higher values = more computational work but better spam resistance
 * Default: 0 (disabled), Recommended: 16-20 for production
 */
const POW_DIFFICULTY = parseInt(process.env.POW_DIFFICULTY || '0');

if (POW_DIFFICULTY > 0) {
  console.log(`⛏️  Proof of Work enabled with difficulty ${POW_DIFFICULTY} bits`);
  if (POW_DIFFICULTY > 24) {
    console.warn("   ⚠️  High PoW difficulty may cause long mining times");
  }
} else {
  console.log("⛏️  Proof of Work disabled (POW_DIFFICULTY=0)");
}

/**
 * Craig David Publishing Configuration
 * 
 * CRAIG_DAVID contains the private key for the Craig David persona
 * This key will be used to sign and publish summary events
 */
const CRAIG_DAVID_KEY = process.env.CRAIG_DAVID;

if (!CRAIG_DAVID_KEY) {
  console.warn("⚠️  CRAIG_DAVID private key not found in environment!");
  console.warn("   Summary events will be published from server key instead.");
  console.warn("   Add CRAIG_DAVID=private_key_hex to .env file");
} else {
  // Validate the key format (should be 64 hex characters)
  if (!/^[0-9a-fA-F]{64}$/.test(CRAIG_DAVID_KEY.trim())) {
    console.error("❌ Invalid CRAIG_DAVID key format in .env file!");
    console.error("   Expected: 64 hexadecimal characters");
    console.error("   Got:", CRAIG_DAVID_KEY.length, "characters");
    process.exit(1);
  }
  
  // Get Craig David's public key for display
  const craigDavidSecretKey = Buffer.from(CRAIG_DAVID_KEY, 'hex');
  const craigDavidPubkey = getPublicKey(craigDavidSecretKey);
  console.log(`🎵 Craig David key configured: ${craigDavidPubkey}`);
}

/**
 * Roast Account Configuration
 * 
 * ROAST_PRIV contains the private key for the roasting account
 * This key will be used to sign and publish roast events
 */
const ROAST_PRIV = process.env.ROAST_PRIV;

if (!ROAST_PRIV) {
  console.warn("⚠️  ROAST_PRIV private key not found in environment!");
  console.warn("   Roast events will be published from server key instead.");
  console.warn("   Add ROAST_PRIV=private_key_hex to .env file");
} else {
  // Validate the key format (should be 64 hex characters)
  if (!/^[0-9a-fA-F]{64}$/.test(ROAST_PRIV.trim())) {
    console.error("❌ Invalid ROAST_PRIV key format in .env file!");
    console.error("   Expected: 64 hexadecimal characters");
    console.error("   Got:", ROAST_PRIV.length, "characters");
    process.exit(1);
  }
  
  // Get Roast account's public key for display
  const roastSecretKey = Buffer.from(ROAST_PRIV, 'hex');
  const roastPubkey = getPublicKey(roastSecretKey);
  console.log(`🔥 Roast account key configured: ${roastPubkey}`);
}

/**
 * Whitelisting Configuration
 * 
 * APPROVED_KEY contains comma-separated public keys that are allowed to access the server
 * Format: "key1,key2,key3" or just "key1"
 * If not provided, any client can connect
 */
const APPROVED_KEY = process.env.APPROVED_KEY;
const allowedPublicKeys = APPROVED_KEY 
  ? APPROVED_KEY.split(',').map(key => key.trim()).filter(key => key.length > 0)
  : undefined;

if (allowedPublicKeys && allowedPublicKeys.length > 0) {
  console.log("🔒 Whitelisting enabled");
  console.log(`   Approved keys (${allowedPublicKeys.length}):`);
  allowedPublicKeys.forEach((key, index) => {
    const displayKey = key.length > 16 ? `${key.substring(0, 16)}...` : key;
    console.log(`   ${index + 1}. ${displayKey}`);
  });
} else {
  console.log("🌐 Open access - no whitelisting configured");
  console.log("   Add APPROVED_KEY=key1,key2 to .env file for whitelisting");
}

// ==================== Main Server Logic ====================
async function main() {
  console.log("🚀 Starting MCP Nostr Server...");
  console.log("=" .repeat(50));

  if (!process.env.NCTOOL_BASE_URL) {
    console.log("📌 NCTOOL_BASE_URL not set — using default: http://localhost:3041");
  }

  // -------------------- Step 1: Setup Cryptographic Signer --------------------
  /**
   * The PrivateKeySigner handles all cryptographic operations:
   * - Signs messages to prove they come from this server
   * - Decrypts messages sent to this server
   * - Manages the server's cryptographic identity
   */
  const signer = new PrivateKeySigner(SERVER_PRIVATE_KEY_HEX);
  
  // Get the public key that clients will use to connect to this server
  const serverPubkey = await signer.getPublicKey();
  console.log(`📍 Server Public Key (share with clients): ${serverPubkey}`);

  // -------------------- Step 2: Setup Relay Pool --------------------
  /**
   * SimpleRelayPool manages connections to multiple Nostr relays:
   * - Automatically handles connection failures and reconnections
   * - Broadcasts messages to all connected relays
   * - Receives messages from any connected relay
   * - Provides redundancy if some relays are down
   */
  console.log("\n📡 Connecting to Nostr relays:");
  const relayPool = new SimpleRelayPool(RELAYS);
  
  // Log each relay we're connecting to
  RELAYS.forEach(relay => {
    console.log(`   - ${relay}`);
  });

  // -------------------- Step 3: Create MCP Server Instance --------------------
  /**
   * The MCP Server handles the protocol-level operations:
   * - Tool registration and management
   * - Request/response handling
   * - Protocol compliance
   * - Error handling
   * 
   * We provide server info and capabilities
   */
  const server = new Server(
    {
      name: "craig-david",             // Server identifier
      version: "1.0.0",                // Server version
    }, 
    {
      // Server capabilities configuration
      capabilities: {
        tools: {},  // Enable tool support
      }
    }
  );

  // -------------------- Step 4: Register Server Request Handlers --------------------
  /**
   * Request handlers process incoming requests from clients.
   * We need to handle:
   * - tools/list: Returns available tools
   * - tools/call: Executes a specific tool
   */
  
  // Handler for listing available tools
  // This tells clients what tools this server provides
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    console.log("📋 Client requested tool list");
    
    return {
      tools: [
        {
          name: "cashu_access",
          description: "Redeem a Cashu token via NCTool using server pubkey; returns ACCESS_GRANTED/ACCESS_DENIED.",
          inputSchema: {
            type: "object",
            properties: {
              encodedToken: { type: "string", description: "Cashu token (cashuA...)" },
              minAmount: { type: "number", description: "Minimum sats required (default 256)" }
            },
            required: ["encodedToken"]
          }
        },
        {
          name: "funny_agent",
          description: "Generates responses using OpenRouter API with multimodal support (text + images). Uses Gemini 2.0 Flash for images, GPT via Groq for text-only.",
          inputSchema: {
            type: "object",
            properties: {
              question: {
                type: "string",
                description: "The question or input (may include image URLs). Supported formats: .jpg, .png, .gif, .webp, or imgur/discord links"
              }
            },
            required: ["question"]
          }
        },
        {
          name: "summarise",
          description: "Creates a humorous summary of someone's day and posts it as a Kind 1 Nostr event. Uses multimodal AI analysis with automatic Nostr publishing.",
          inputSchema: {
            type: "object",
            properties: {
              dayInput: {
                type: "string",
                description: "Description of what the person has been up to (may include image URLs). The AI will create a humorous summary and post it to Nostr."
              },
              pubkey: {
                type: "string",
                description: "The hex public key (64 chars) of the person whose day is being summarized. Used for the 'p' tag in the Nostr event."
              }
            },
            required: ["dayInput", "pubkey"]
          }
        },
        {
          name: "weekly_summary",
          description: "Creates a Craig David style '7 Days' rap summary of the week's activities and publishes it to Nostr.",
          inputSchema: {
            type: "object",
            properties: {
              weeklyInput: {
                type: "string",
                description: "Combined summary of the week's activities. The AI will create a Craig David style rap and post it to Nostr."
              },
              pubkey: {
                type: "string",
                description: "The hex public key (64 chars) of the person whose week is being summarized. Used for the 'p' tag in the Nostr event."
              }
            },
            required: ["weeklyInput", "pubkey"]
          }
        },
        {
          name: "roastNpub",
          description: "Creates a witty, observational roast of social media posts and publishes it to Nostr from a dedicated roast account.",
          inputSchema: {
            type: "object",
            properties: {
              socialPosts: {
                type: "string",
                description: "Collection of social media posts to roast. The AI will create witty, observational comedy roasts and post them to Nostr."
              },
              pubkey: {
                type: "string",
                description: "The hex public key (64 chars) of the person being roasted. Used for the 'p' tag in the Nostr event."
              }
            },
            required: ["socialPosts", "pubkey"]
          }
        },
        {
          name: "montage",
          description: "Creates a 30-second video montage from files in a directory using the otherstuff.studio API.",
          inputSchema: {
            type: "object",
            properties: {
              dir: {
                type: "string",
                description: "Directory path containing files to create montage from (e.g., ~/code/cdtest/cdtest)"
              },
              prompt: {
                type: "string",
                description: "Prompt describing how to create the montage (e.g., 'Please create a 30 second montage video as per your instructions from these files.')"
              },
              pubkey: {
                type: "string",
                description: "The hex public key (64 chars) of the user requesting the montage."
              }
            },
            required: ["dir", "prompt", "pubkey"]
          }
        }
      ]
    };
  });

  // Handler for executing tools
  // This is called when a client wants to execute a specific tool
  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    // Extract the tool name and arguments from the request
    const { name, arguments: args } = request.params;
    
    console.log(`\n🔧 Tool called: ${name}`);
    console.log(`   Arguments: ${JSON.stringify(args)}`);

    // Progress utilities (MCP progress notifications)
    const progressToken = (extra as any)?._meta?.progressToken;
    const canProgress = Boolean(progressToken) && typeof (extra as any)?.sendNotification === 'function';
    const sendProgress = async (progress: number, total?: number, message?: string) => {
      if (!canProgress) return;
      try {
        await (extra as any).sendNotification({
          method: "notifications/progress",
          params: {
            progress,
            ...(typeof total === 'number' ? { total } : {}),
            ...(message ? { message } : {}),
            progressToken,
          }
        });
      } catch (err) {
        // Swallow progress errors to avoid breaking the request
        console.warn('[progress] failed to send progress notification:', (err as any)?.message || err);
      }
    };
    const startHeartbeat = (label: string, intervalMs = Number(process.env.CVM_PROGRESS_HEARTBEAT_MS || 10000)) => {
      if (!canProgress || intervalMs <= 0) return () => {};
      const id = setInterval(() => {
        // Heartbeat message to keep clients aware and reset timeouts
        sendProgress(0, undefined, `${label} – still working...`);
      }, intervalMs);
      // Stop on abort
      (extra as any)?.signal?.addEventListener?.('abort', () => clearInterval(id));
      return () => clearInterval(id);
    };

    // Route to the appropriate tool handler based on the tool name
    switch (name) {
      case "cashu_access": {
        const NCTOOL_BASE_URL = process.env.NCTOOL_BASE_URL || 'http://localhost:3041';
        const DEFAULT_MIN = parseInt(process.env.MIN_AMOUNT_DEFAULT || '256', 10);

        if (!args || typeof args !== 'object') {
          throw new Error("Invalid arguments for cashu_access");
        }
        const encodedToken = (args as any).encodedToken as string;
        const minAmountArg = (args as any).minAmount as number | undefined;
        if (!encodedToken || typeof encodedToken !== 'string') {
          throw new Error("encodedToken is required and must be a string");
        }
        const threshold = Number.isFinite(minAmountArg) ? Math.max(1, Math.floor(minAmountArg!)) : DEFAULT_MIN;

        const start = Date.now();
        const correlationId = (globalThis.crypto as any)?.randomUUID?.() || Math.random().toString(36).slice(2);

        // Build URL using configured wallet npub (from .env) or fall back to server pubkey
        const configuredNpub = (process.env.CASHU_WALL || '').trim();
        let walletIdForPath: string;
        if (configuredNpub && configuredNpub.startsWith('npub') && configuredNpub.length >= 10) {
          walletIdForPath = configuredNpub;
        } else {
          const fallback = await signer.getPublicKey();
          walletIdForPath = fallback;
          console.warn('[cashu_access] CASHU_WALL not set or invalid; falling back to server pubkey for wallet path');
        }
        const base = NCTOOL_BASE_URL.replace(/\/$/, '');
        const url = `${base}/api/wallet/${walletIdForPath}/receive`;

        let amount = 0;
        let mintUrl: string | undefined;
        try {
          const controller = (AbortSignal as any)?.timeout
            ? undefined
            : new AbortController();
          const timeoutId = controller ? setTimeout(() => controller.abort(), 10_000) : undefined;

          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Req-Id': String(correlationId),
            },
            body: JSON.stringify({ encodedToken }),
            signal: (AbortSignal as any)?.timeout ? (AbortSignal as any).timeout(10_000) : controller!.signal,
          } as any);

          if (timeoutId) clearTimeout(timeoutId as any);

          if (!res.ok) {
            const errText = await safeText(res);
            logDecision('ACCESS_DENIED', correlationId, start, 0, threshold);
            return mcpText({ decision: 'ACCESS_DENIED', amount: 0, reason: `nctool_error: ${res.status} ${res.statusText} ${errText}` , mode: 'redeem' });
          }

          const data: any = await res.json();
          amount = Number(data?.totalAmount || 0);
          mintUrl = data?.mintUrl;
        } catch (e: any) {
          logDecision('ACCESS_DENIED', correlationId, start, 0, threshold);
          return mcpText({ decision: 'ACCESS_DENIED', amount: 0, reason: `nctool_error: ${e?.message || 'network'}`, mode: 'redeem' });
        }

        if (amount >= threshold) {
          logDecision('ACCESS_GRANTED', correlationId, start, amount, threshold);
          return mcpText({ decision: 'ACCESS_GRANTED', amount, reason: 'redeemed ok', mintUrl, mode: 'redeem' });
        }
        logDecision('ACCESS_DENIED', correlationId, start, amount, threshold);
        return mcpText({ decision: 'ACCESS_DENIED', amount, reason: `below min ${threshold}`, mintUrl, mode: 'redeem' });

        async function safeText(res: any) { try { return await res.text(); } catch { return ''; } }
        function mcpText(obj: any) { return { content: [{ type: 'text', text: JSON.stringify(obj) }] }; }
        function logDecision(outcome: 'ACCESS_GRANTED'|'ACCESS_DENIED', corrId: string, started: number, amt: number, thr: number) {
          const elapsedMs = Date.now() - started;
          console.log('[cashu_access]', JSON.stringify({ correlationId: corrId, mode: 'redeem', amount: amt, threshold: thr, outcome, elapsedMs }));
        }
      }
       case "funny_agent": {
        // Funny agent tool implementation
        // Calls the OpenRouter API to generate funny responses
        if (!args || typeof args !== 'object') {
          throw new Error("Invalid arguments for funny_agent tool");
        }
        
        const question = args.question as string;
        
        // Check if API token is available
        if (!OPEN_ROUTER_KEY) {
          throw new Error("OPEN_ROUTER_KEY not configured. Please set it in .env file");
        }
        
        console.log(`🤡 Craig David called with question: ${question}`);
        
        try {
          // Call the OpenRouter API
          const funnyResponse = await callOpenRouterAgent(
            question,
            OPEN_ROUTER_KEY
          );
          
          // Return the funny response
          return {
            content: [
              {
                type: "text",
                text: funnyResponse
              }
            ]
          };
        } catch (error) {
          console.error("❌ Failed to call OpenRouter API:", error);
          
          // Return a friendly error message
          return {
            content: [
              {
                type: "text",
                text: `Sorry, I couldn't get a funny response right now. Error: ${error instanceof Error ? error.message : 'Unknown error'}`
              }
            ]
          };
        }
      }

      case "summarise": {
        // Summarise tool implementation
        // Creates humorous day summaries and posts them to Nostr
        if (!args || typeof args !== 'object') {
          throw new Error("Invalid arguments for summarise tool");
        }
        
        const dayInput = args.dayInput as string;
        const subjectPubkey = args.pubkey as string;
        
        // Check if API token is available
        if (!OPEN_ROUTER_KEY) {
          throw new Error("OPEN_ROUTER_KEY not configured. Please set it in .env file");
        }
        
        console.log(`📝 Craig David summarising day for pubkey: ${subjectPubkey}`);
        console.log(`   Content preview: ${dayInput.substring(0, 100)}...`);
        
        try {
          await sendProgress(0, 3, 'Starting day summary');
          await sendProgress(1, 3, 'Generating AI summary');
          const stopBeat = startHeartbeat('summarise');
          // Create and publish summary
          const publishingKey = CRAIG_DAVID_KEY || SERVER_PRIVATE_KEY_HEX;
          const result = await createAndPublishSummary(
            dayInput,
            subjectPubkey,
            OPEN_ROUTER_KEY,
            publishingKey,
            relayPool,
            POW_DIFFICULTY
          );
          stopBeat();
          await sendProgress(2, 3, result.published ? 'Publishing to Nostr' : 'Generated; publishing may have failed');
          
          if (result.published) {
            const responseText = `${result.summary}\n\n🎵 Summary published to Nostr!\nEvent ID: ${result.nostrEventId}\nSubject Pubkey: ${subjectPubkey}`;
            await sendProgress(3, 3, 'Summary complete');
            
            return {
              content: [
                {
                  type: "text",
                  text: responseText
                }
              ]
            };
          } else {
            const responseText = `${result.summary}\n\n⚠️ Summary generated but failed to publish to Nostr: ${result.error}\nSubject Pubkey: ${subjectPubkey}`;
            await sendProgress(3, 3, 'Summary generated; publish failed');
            
            return {
              content: [
                {
                  type: "text",
                  text: responseText
                }
              ]
            };
          }
        } catch (error) {
          console.error("❌ Failed to create summary:", error);
          await sendProgress(3, 3, `Summary failed: ${(error as any)?.message || 'unknown error'}`);
          
          // Return a friendly error message
          return {
            content: [
              {
                type: "text",
                text: `Sorry, I couldn't create a summary right now. Error: ${error instanceof Error ? error.message : 'Unknown error'}`
              }
            ]
          };
        }
      }
      
      case "weekly_summary": {
        // Weekly summary tool implementation
        // Creates Craig David style rap summaries and posts them to Nostr
        if (!args || typeof args !== 'object') {
          throw new Error("Invalid arguments for weekly_summary tool");
        }
        
        const weeklyInput = args.weeklyInput as string;
        const subjectPubkey = args.pubkey as string;
        
        // Check if API token is available
        if (!OPEN_ROUTER_KEY) {
          throw new Error("OPEN_ROUTER_KEY not configured. Please set it in .env file");
        }
        
        console.log(`🎤 Craig David creating weekly rap for pubkey: ${subjectPubkey}`);
        console.log(`   Content preview: ${weeklyInput.substring(0, 100)}...`);
        
        try {
          await sendProgress(0, 4, 'Starting weekly summary');
          await sendProgress(1, 4, 'Generating rap with AI');
          const stopBeat = startHeartbeat('weekly_summary');
          // Create and publish weekly rap
          const publishingKey = CRAIG_DAVID_KEY || SERVER_PRIVATE_KEY_HEX;
          const result = await createAndPublishWeeklyRap(
            weeklyInput,
            subjectPubkey,
            OPEN_ROUTER_KEY,
            publishingKey,
            relayPool,
            POW_DIFFICULTY
          );
          stopBeat();
          await sendProgress(2, 4, result.published ? 'Publishing weekly rap to Nostr' : 'Generated; publishing may have failed');
          
          if (result.published) {
            const responseText = `${result.summary}\n\n🎵 Weekly rap published to Nostr!\nEvent ID: ${result.nostrEventId}`;
            await sendProgress(4, 4, 'Weekly summary complete');
            
            return {
              content: [
                {
                  type: "text",
                  text: responseText
                }
              ]
            };
          } else {
            const responseText = `${result.summary}\n\n⚠️ Rap generated but failed to publish to Nostr: ${result.error}`;
            await sendProgress(4, 4, 'Weekly summary generated; publish failed');
            
            return {
              content: [
                {
                  type: "text",
                  text: responseText
                }
              ]
            };
          }
        } catch (error) {
          console.error("❌ Failed to create weekly rap:", error);
          await sendProgress(4, 4, `Weekly summary failed: ${(error as any)?.message || 'unknown error'}`);
          
          // Return a friendly error message
          return {
            content: [
              {
                type: "text",
                text: `Sorry, I couldn't create a weekly rap right now. Error: ${error instanceof Error ? error.message : 'Unknown error'}`
              }
            ]
          };
        }
      }

      case "roastNpub": {
        // RoastNpub tool implementation
        // Creates witty roasts of social media posts and publishes them to Nostr
        if (!args || typeof args !== 'object') {
          throw new Error("Invalid arguments for roastNpub tool");
        }
        
        const socialPosts = args.socialPosts as string;
        const subjectPubkey = args.pubkey as string;
        
        // Check if API token is available
        if (!OPEN_ROUTER_KEY) {
          throw new Error("OPEN_ROUTER_KEY not configured. Please set it in .env file");
        }
        
        console.log(`🔥 Creating roast for pubkey: ${subjectPubkey}`);
        console.log(`   Content preview: ${socialPosts.substring(0, 100)}...`);
        
        try {
          // Create and publish roast
          const roastKey = ROAST_PRIV || SERVER_PRIVATE_KEY_HEX;
          const result = await createAndPublishRoast(
            socialPosts,
            subjectPubkey,
            OPEN_ROUTER_KEY,
            roastKey,
            relayPool,
            POW_DIFFICULTY
          );
          
          if (result.published) {
            const responseText = `${result.summary}\n\n🔥 Roast published to Nostr!\nEvent ID: ${result.nostrEventId}\nSubject Pubkey: ${subjectPubkey}`;
            
            return {
              content: [
                {
                  type: "text",
                  text: responseText
                }
              ]
            };
          } else {
            const responseText = `${result.summary}\n\n⚠️ Roast generated but failed to publish to Nostr: ${result.error}\nSubject Pubkey: ${subjectPubkey}`;
            
            return {
              content: [
                {
                  type: "text",
                  text: responseText
                }
              ]
            };
          }
        } catch (error) {
          console.error("❌ Failed to create roast:", error);
          
          // Return a friendly error message
          return {
            content: [
              {
                type: "text",
                text: `Sorry, I couldn't create a roast right now. Error: ${error instanceof Error ? error.message : 'Unknown error'}`
              }
            ]
          };
        }
      }

      case "montage": {
        // Montage creation tool implementation
        // Creates video montage using otherstuff.studio API
        if (!args || typeof args !== 'object') {
          throw new Error("Invalid arguments for montage tool");
        }
        
        const dir = args.dir as string;
        const prompt = args.prompt as string;
        const pubkey = args.pubkey as string;
        
        // Validate required arguments
        if (!dir || typeof dir !== 'string') {
          throw new Error("dir is required and must be a string");
        }
        if (!prompt || typeof prompt !== 'string') {
          throw new Error("prompt is required and must be a string");
        }
        if (!pubkey || typeof pubkey !== 'string') {
          throw new Error("pubkey is required and must be a string");
        }
        
        console.log(`🎬 Creating video montage for pubkey: ${pubkey}`);
        console.log(`   Directory: ${dir}`);
        console.log(`   Prompt preview: ${prompt.substring(0, 100)}...`);
        
        try {
          // Create the montage
          const result = await createMontage(dir, prompt, pubkey);
          
          console.log("✅ Montage creation triggered successfully");
          
          // Return success response
          return {
            content: [
              {
                type: "text",
                text: result
              }
            ]
          };
        } catch (error) {
          console.error("❌ Failed to create montage:", error);
          
          // Return a friendly error message
          return {
            content: [
              {
                type: "text",
                text: `Failed to create montage: ${error instanceof Error ? error.message : 'Unknown error'}`
              }
            ]
          };
        }
      }

      default:
        // Handle unknown tools
        throw new Error(`Unknown tool: ${name}`);
    }
  });

  // -------------------- Step 5: Configure Nostr Transport --------------------
  /**
   * NostrServerTransport bridges the MCP server with the Nostr network:
   * - Listens for incoming client connections
   * - Handles message encryption/decryption
   * - Routes requests to the MCP server
   * - Sends responses back to clients
   * 
   * Configuration options:
   * - signer: Handles cryptographic operations
   * - relayHandler: Manages relay connections
   * - isPublicServer: Whether to announce the server publicly
   * - serverInfo: Metadata about the server
   */
  const serverTransport = new NostrServerTransport({
    signer,                          // Cryptographic signer for this server
    relayHandler: relayPool,         // Relay pool for network communication
    isPublicServer: true,            // Announce this server publicly on Nostr
    allowedPublicKeys,               // Whitelist of allowed client public keys
    excludedCapabilities: [
      { method: "tools/list" },      // Allow any client to discover available tools
    ],
    serverInfo: {
      name: "Craig David",                  // Human-readable server name
      about: "A groovy multimodal MCP server on Nostr with AI responses and day summaries - filling up your garage with beats, laughs, and Nostr posts", // Server description
      website: "https://contextvm.org",     // Optional: Server website
    },
  });

  // -------------------- Step 6: Connect and Start Server --------------------
  /**
   * Connect the MCP server to the Nostr transport.
   * This starts the server listening for incoming requests.
   * The server will:
   * 1. Connect to all configured relays
   * 2. Announce itself on the network (if public)
   * 3. Start listening for incoming client connections
   * 4. Process requests and send responses
   */
  console.log("\n⏳ Starting server transport...");
  
  try {
    // Connect the server to the transport
    await server.connect(serverTransport);
    
    // Server is now running
    console.log("\n" + "=" .repeat(50));
    console.log("✅ Server is running and listening for requests!");
    console.log("\n📋 Server Details:");
    console.log(`   Server Public Key: ${serverPubkey}`);
    if (CRAIG_DAVID_KEY) {
      const craigDavidSecretKey = Buffer.from(CRAIG_DAVID_KEY, 'hex');
      const craigDavidPubkey = getPublicKey(craigDavidSecretKey);
      console.log(`   Craig David Public Key: ${craigDavidPubkey} (used for summaries)`);
    } else {
      console.log(`   Craig David Key: Not configured (using server key for summaries)`);
    }
    console.log(`   Name: Craig David`);
    console.log(`   Available Tools: funny_agent (multimodal), summarise (+ Nostr), weekly_summary (+ Nostr), roastNpub (+ Nostr)`);
    if (OPEN_ROUTER_KEY) {
      console.log(`   OpenRouter API: Connected (Gemini 2.0 Flash + GPT via Groq)`);
    } else {
      console.log(`   OpenRouter API: Not configured`);
    }
    
    // Display access control status
    if (allowedPublicKeys && allowedPublicKeys.length > 0) {
      console.log(`   Access Control: Whitelisted (${allowedPublicKeys.length} approved keys)`);
      console.log(`   Public Access: tools/list only (for discovery)`);
    } else {
      console.log(`   Access Control: Open (any client can connect)`);
    }
    
    console.log("\nShare the public key with clients to connect.");
    console.log("\nPress Ctrl+C to stop the server.");
  } catch (error) {
    console.error("❌ Failed to start server transport:", error);
    throw error;
  }

  // -------------------- Step 7: Handle Shutdown --------------------
  /**
   * Graceful shutdown handling
   * - Closes all relay connections
   * - Cleans up resources
   * - Ensures proper server termination
   */
  process.on('SIGINT', async () => {
    console.log("\n\n🛑 Shutting down server...");
    
    try {
      // Close transport and relay connections
      await serverTransport.close();
      console.log("✅ Server stopped gracefully");
    } catch (error) {
      console.error("❌ Error during shutdown:", error);
    }
    
    process.exit(0);
  });

  // Keep the server running
  // The server will continue to run until manually stopped
}

// ==================== Error Handling ====================
/**
 * Global error handler for the server
 * Catches any unhandled errors during startup or runtime
 */
main().catch((error) => {
  console.error("❌ Failed to start server:", error);
  console.error("\nPossible issues:");
  console.error("1. Invalid private key format");
  console.error("2. Network connection problems");
  console.error("3. Relay servers are unreachable");
  console.error("4. Missing dependencies");
  
  // Log the full error stack for debugging
  if (error.stack) {
    console.error("\nError stack:");
    console.error(error.stack);
  }
  
  process.exit(1);
});
