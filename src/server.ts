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
import { createAndPublishSummary } from "./utils/summarise.util.js";

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
              }
            },
            required: ["dayInput"]
          }
        }
      ]
    };
  });

  // Handler for executing tools
  // This is called when a client wants to execute a specific tool
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    // Extract the tool name and arguments from the request
    const { name, arguments: args } = request.params;
    
    console.log(`\n🔧 Tool called: ${name}`);
    console.log(`   Arguments: ${JSON.stringify(args)}`);

    // Route to the appropriate tool handler based on the tool name
    switch (name) {
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
        
        // Check if API token is available
        if (!OPEN_ROUTER_KEY) {
          throw new Error("OPEN_ROUTER_KEY not configured. Please set it in .env file");
        }
        
        console.log(`📝 Craig David summarising day: ${dayInput}`);
        
        try {
          // Create and publish summary
          const publishingKey = CRAIG_DAVID_KEY || SERVER_PRIVATE_KEY_HEX;
          const result = await createAndPublishSummary(
            dayInput,
            OPEN_ROUTER_KEY,
            publishingKey,
            relayPool,
            POW_DIFFICULTY
          );
          
          if (result.published) {
            const responseText = `${result.summary}\n\n🎵 Summary published to Nostr!\nEvent ID: ${result.nostrEventId}`;
            
            return {
              content: [
                {
                  type: "text",
                  text: responseText
                }
              ]
            };
          } else {
            const responseText = `${result.summary}\n\n⚠️ Summary generated but failed to publish to Nostr: ${result.error}`;
            
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
    console.log(`   Available Tools: funny_agent (multimodal), summarise (+ Nostr)`);
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