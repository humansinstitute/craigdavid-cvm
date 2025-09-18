# ContextVM MCP Server Demo

A Model Context Protocol (MCP) server that communicates over the Nostr network using the ContextVM specification.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file with your server private key (optional):
```bash
cp .env.example .env
# Edit .env and add your private key
```

## Running the Server

### Standard Server
```bash
npm run dev:server
```

### Debug Server (with extensive logging)
```bash
npm run dev:debug
```

The debug server will show:
- All incoming Nostr events
- MCP message processing
- Transport layer events
- Detailed error information

## Testing the Server

Run the test client with the server's public key:

```bash
# Start the server first and copy its public key
npm run dev:debug

# In another terminal, run the test client
npm run test:client <server-public-key>
```

## Debugging Connection Issues

If the server isn't responding to clients:

1. **Check the debug output** - Run `npm run dev:debug` to see detailed logs

2. **Verify the event kind** - ContextVM uses kind `25910` for all messages

3. **Check message format** - The `content` field must contain stringified JSON-RPC messages

4. **Verify relay connectivity** - Ensure both client and server are connected to the same relays

5. **Check public key addressing** - Messages must use proper `p` tags for addressing

6. **Monitor Nostr events** - The debug server logs all incoming events

## Common Issues

### Server generates new key on restart
- Ensure `.env` file exists with `SERVER_PRIVATE_KEY=<your-64-hex-chars>`
- Check there are no quotes around the key
- Verify the key is exactly 64 hexadecimal characters

### Client can't connect
- Verify server is running (`npm run dev:debug`)
- Check server public key is copied correctly
- Ensure both use the same relays
- Look for error messages in debug output

### No response to requests
- Check debug logs for incoming events
- Verify MCP handlers are being called
- Look for serialization errors in console

## Architecture

The server implements:
- **Transport Layer**: NostrServerTransport for Nostr communication
- **Protocol Layer**: MCP server for handling requests/responses
- **Tools**: Echo and debug_info tools for testing

Key specifications:
- Event Kind: `25910` (ephemeral ContextVM events)
- Message Format: Stringified JSON-RPC in content field
- Tags: `p` for addressing, `e` for correlation

## Environment Variables

- `SERVER_PRIVATE_KEY`: 64-character hex string for server identity

## Dependencies

- `@modelcontextprotocol/sdk`: MCP protocol implementation
- `@contextvm/sdk`: ContextVM Nostr transport
- `nostr-tools`: Nostr cryptographic utilities
- `dotenv`: Environment variable management