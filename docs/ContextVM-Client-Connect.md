# Connecting to Craig David - ContextVM Client Guide

This guide explains how to create a TypeScript client that connects to the Craig David ContextVM server and uses the `funny_agent` tool for AI-powered responses with multimodal support.

## Overview

Craig David is a specialized ContextVM server that provides:
- **Single Tool**: `funny_agent` - AI responses with text and image support
- **Multimodal Support**: Automatically switches between GPT (text-only) and Gemini 2.0 Flash (with images)
- **Whitelisting**: Access control via approved public keys
- **Nostr Network**: Communicates over decentralized Nostr relays

## Prerequisites

```bash
npm install @modelcontextprotocol/sdk @contextvm/sdk
```

## Server Information

- **Server Name**: Craig David
- **Public Key**: `ce6ba07d0f2bba5eac5cc17dee0c7bf05761a410a70814c173e9a7e8f9ec4606`
- **Available Tool**: `funny_agent`
- **Whitelisting**: Enabled (requires approved public key)

## Client Implementation

Create a new file named `craig-david-client.ts`:

```typescript
import { Client } from "@modelcontextprotocol/sdk/client";
import { NostrClientTransport } from "@contextvm/sdk";
import { PrivateKeySigner } from "@contextvm/sdk";
import { SimpleRelayPool } from "@contextvm/sdk";

// --- Configuration ---
// Craig David server public key
const CRAIG_DAVID_PUBKEY = "ce6ba07d0f2bba5eac5cc17dee0c7bf05761a410a70814c173e9a7e8f9ec4606";

// Your client private key (must be whitelisted by server)
const CLIENT_PRIVATE_KEY_HEX = 
  process.env.CLIENT_PRIVATE_KEY || "your-32-byte-client-private-key-in-hex";

// Nostr relays to connect through
const RELAYS = [
  "wss://relay.contextvm.org",
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.nostr.band"
];

// --- Craig David Client ---
class CraigDavidClient {
  private mcpClient: Client;
  private transport: NostrClientTransport;
  private connected: boolean = false;

  constructor() {
    this.mcpClient = new Client();
  }

  /**
   * Connect to Craig David server
   */
  async connect(): Promise<void> {
    console.log("🎵 Connecting to Craig David...");
    
    // Setup cryptographic signer
    const signer = new PrivateKeySigner(CLIENT_PRIVATE_KEY_HEX);
    const clientPubkey = await signer.getPublicKey();
    console.log(`   Client Public Key: ${clientPubkey}`);
    
    // Setup relay pool
    const relayPool = new SimpleRelayPool(RELAYS);
    console.log(`   Connecting through ${RELAYS.length} relays...`);

    // Configure Nostr transport
    this.transport = new NostrClientTransport({
      signer,
      relayHandler: relayPool,
      serverPubkey: CRAIG_DAVID_PUBKEY,
    });

    // Connect to the server
    await this.mcpClient.connect(this.transport);
    this.connected = true;
    
    console.log("✅ Connected to Craig David!");
  }

  /**
   * List available tools (should show funny_agent)
   */
  async listTools(): Promise<any> {
    if (!this.connected) throw new Error("Not connected to Craig David");
    
    console.log("📋 Listing available tools...");
    const tools = await this.mcpClient.listTools();
    console.log("Available tools:", tools.tools?.map(t => t.name).join(", "));
    return tools;
  }

  /**
   * Ask Craig David a question (text-only)
   * @param question The question to ask
   */
  async askQuestion(question: string): Promise<string> {
    if (!this.connected) throw new Error("Not connected to Craig David");
    
    console.log(`🤡 Asking Craig David: "${question}"`);
    
    const result = await this.mcpClient.callTool({
      name: "funny_agent",
      arguments: { question }
    });
    
    const response = result.content?.[0]?.text || "No response received";
    console.log(`🎤 Craig David says: ${response}`);
    
    return response;
  }

  /**
   * Ask Craig David about an image
   * @param question The question about the image
   * @param imageUrl URL of the image to analyze
   */
  async askAboutImage(question: string, imageUrl: string): Promise<string> {
    if (!this.connected) throw new Error("Not connected to Craig David");
    
    const combinedInput = `${question} ${imageUrl}`;
    console.log(`🖼️  Asking Craig David about image: "${question}"`);
    console.log(`   Image URL: ${imageUrl}`);
    
    const result = await this.mcpClient.callTool({
      name: "funny_agent",
      arguments: { question: combinedInput }
    });
    
    const response = result.content?.[0]?.text || "No response received";
    console.log(`🎤 Craig David says: ${response}`);
    
    return response;
  }

  /**
   * Close connection to Craig David
   */
  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.mcpClient.close();
      this.connected = false;
      console.log("👋 Disconnected from Craig David");
    }
  }
}

// --- Example Usage ---
async function main() {
  const craig = new CraigDavidClient();
  
  try {
    // Connect to Craig David
    await craig.connect();
    
    // List available tools
    await craig.listTools();
    
    // Ask a text question
    await craig.askQuestion("What's the best way to fill up my garage?");
    
    // Ask about an image (if you have one)
    // await craig.askAboutImage(
    //   "What's happening in this image?", 
    //   "https://example.com/your-image.jpg"
    // );
    
    // Disconnect
    await craig.disconnect();
    
  } catch (error) {
    console.error("❌ Error:", error);
    await craig.disconnect();
    process.exit(1);
  }
}

// --- Quick Helper Functions ---

/**
 * Simple function to ask Craig David a question
 */
export async function askCraigDavid(question: string): Promise<string> {
  const craig = new CraigDavidClient();
  await craig.connect();
  const response = await craig.askQuestion(question);
  await craig.disconnect();
  return response;
}

/**
 * Simple function to ask Craig David about an image
 */
export async function askCraigDavidAboutImage(question: string, imageUrl: string): Promise<string> {
  const craig = new CraigDavidClient();
  await craig.connect();
  const response = await craig.askAboutImage(question, imageUrl);
  await craig.disconnect();
  return response;
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}
```

## Environment Setup

Create a `.env` file with your client private key:

```bash
# Your client private key (32-byte hex string)
CLIENT_PRIVATE_KEY=your-private-key-here
```

## Getting Whitelisted

Craig David uses whitelisting for access control. To connect, your client's public key must be approved:

1. **Generate your key pair** (if you don't have one):
   ```bash
   node -e "
   const { generateSecretKey, getPublicKey } = require('nostr-tools');
   const secretKey = generateSecretKey();
   const pubkey = getPublicKey(secretKey);
   console.log('Private Key:', Buffer.from(secretKey).toString('hex'));
   console.log('Public Key:', pubkey);
   "
   ```

2. **Request whitelisting**: Contact the server administrator with your public key

3. **Current approved keys**:
   - `94215f42a96335c87fcb9e881a0bbb62b9a795519e109cf5f9d2ef617681f622`
   - `npub104gg3tgtepj7ssjw24f02vaxhleadeca6k96fhd3hj5mk4vp9xxsvc4jet`

## Usage Examples

### Basic Text Question
```typescript
import { askCraigDavid } from "./craig-david-client";

const response = await askCraigDavid("Why did the chicken cross the road?");
console.log(response);
```

### Image Analysis
```typescript
import { askCraigDavidAboutImage } from "./craig-david-client";

const response = await askCraigDavidAboutImage(
  "What's in this image?",
  "https://example.com/photo.jpg"
);
console.log(response);
```

### Advanced Usage
```typescript
const craig = new CraigDavidClient();
await craig.connect();

// Multiple questions in one session
await craig.askQuestion("Tell me a joke");
await craig.askQuestion("What's the meaning of life?");
await craig.askAboutImage("Describe this", "https://imgur.com/abc123.jpg");

await craig.disconnect();
```

## Running the Client

1. **Install dependencies**:
   ```bash
   npm install @modelcontextprotocol/sdk @contextvm/sdk nostr-tools
   ```

2. **Set up environment**:
   ```bash
   echo "CLIENT_PRIVATE_KEY=your-private-key-here" > .env
   ```

3. **Run the client**:
   ```bash
   npx tsx craig-david-client.ts
   ```

## Supported Image Formats

Craig David automatically detects and processes images from URLs with these formats:
- **Extensions**: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.bmp`
- **Hosts**: `imgur.com`, `i.imgur.com`, `cdn.discordapp.com`, `media.discordapp.net`

## Model Selection

Craig David automatically chooses the best model:
- **Text-only**: `openai/gpt-oss-120b` via Groq (fast & efficient)
- **With images**: `google/gemini-2.0-flash-001` (multimodal support)

## Troubleshooting

### Connection Issues
- **Check whitelisting**: Ensure your public key is approved
- **Verify server**: Confirm Craig David server is running
- **Relay connectivity**: Try different Nostr relays

### Image Processing Errors
- **URL accessibility**: Ensure image URLs are publicly accessible
- **Supported formats**: Use supported image formats/hosts
- **File size**: Large images may fail to process

### Authentication Errors
```
Unauthorized message from [your-pubkey]
```
This means your public key is not whitelisted. Contact the server administrator.

## API Reference

### CraigDavidClient Methods

| Method | Description | Parameters | Returns |
|--------|-------------|------------|---------|
| `connect()` | Connect to Craig David | None | `Promise<void>` |
| `listTools()` | List available tools | None | `Promise<any>` |
| `askQuestion(question)` | Ask text question | `question: string` | `Promise<string>` |
| `askAboutImage(question, imageUrl)` | Ask about image | `question: string, imageUrl: string` | `Promise<string>` |
| `disconnect()` | Close connection | None | `Promise<void>` |

### Quick Helper Functions

| Function | Description | Parameters | Returns |
|----------|-------------|------------|---------|
| `askCraigDavid(question)` | One-shot text question | `question: string` | `Promise<string>` |
| `askCraigDavidAboutImage(question, url)` | One-shot image question | `question: string, url: string` | `Promise<string>` |

## Contributing

Craig David is open to improvements! Feel free to suggest enhancements to the multimodal capabilities or client libraries.

---

**Craig David** - *Filling up your garage with beats and AI-powered laughs!* 🎵🤖