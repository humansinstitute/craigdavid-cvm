/**
 * Proof of Work utility for NIP-13 mining on Nostr events
 * 
 * This utility implements NIP-13 proof-of-work mining for Nostr events.
 * It uses worker threads to prevent blocking the main thread during mining.
 */

import { getEventHash } from 'nostr-tools';
import type { NostrEvent } from 'nostr-tools';

/**
 * Interface for raw Nostr event data
 */
interface RawNostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig?: string;
}

/**
 * Mines a Nostr event for NIP-13 proof-of-work.
 * @param event - The signed event to mine (either NostrEvent or raw event data)
 * @param difficulty - Required leading zero bits (default: 20)
 * @returns Promise resolving to the mined event with nonce tag
 */
export async function mineEventPow(
  event: NostrEvent | RawNostrEvent, 
  difficulty: number = 20
): Promise<RawNostrEvent> {
  // Extract raw event data
  const serialized: RawNostrEvent = typeof (event as any).rawEvent === 'function'
    ? (event as any).rawEvent()
    : event as RawNostrEvent;

  // For now, do synchronous mining to avoid worker module issues
  // TODO: Implement proper worker thread support later
  console.log(`⛏️  Starting synchronous PoW mining with difficulty ${difficulty}...`);
  const startTime = Date.now();
  
  let nonce = 0;
  let mined = { ...serialized };

  while (true) {
    // Add nonce tag with difficulty
    mined.tags = [
      ...(serialized.tags || []),
      ['nonce', nonce.toString(), difficulty.toString()]
    ];
    
    // Calculate new hash
    mined.id = getEventHash(mined);
    
    // Check if hash meets difficulty requirement
    if (hashMatchesDifficulty(mined.id, difficulty)) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      console.log(`✅ PoW mining completed!`);
      console.log(`   Difficulty: ${difficulty} bits`);
      console.log(`   Nonce: ${nonce}`);
      console.log(`   Hash: ${mined.id}`);
      console.log(`   Duration: ${duration}ms (${Math.round(duration / 1000)}s)`);
      console.log(`   Hash rate: ~${Math.round(nonce / (duration / 1000))} hashes/sec`);
      break;
    }
    
    nonce++;
    
    // Log progress every 50000 attempts
    if (nonce % 50000 === 0) {
      const elapsed = Date.now() - startTime;
      const rate = Math.round(nonce / (elapsed / 1000));
      console.log(`   Mining progress: ${nonce} attempts, ~${rate} h/s, ${Math.round(elapsed / 1000)}s elapsed`);
    }

    // Timeout after 2 minutes
    if (Date.now() - startTime > 120000) {
      throw new Error(`PoW mining timed out after 2 minutes for difficulty ${difficulty}`);
    }
  }

  return mined;
}

/**
 * Checks if a hash meets the required difficulty (leading zero bits)
 * @param hash - The hash to check (hex string)
 * @param difficulty - Required leading zero bits
 * @returns true if hash meets difficulty requirement
 */
export function hashMatchesDifficulty(hash: string, difficulty: number): boolean {
  const requiredHexZeros = Math.floor(difficulty / 4);
  
  // Check if hash starts with required hex zeros
  if (!hash.startsWith('0'.repeat(requiredHexZeros))) {
    return false;
  }
  
  // If difficulty is a multiple of 4, we're done
  if (difficulty % 4 === 0) {
    return true;
  }
  
  // Check remaining bits in the next hex digit
  const nibble = parseInt(hash[requiredHexZeros], 16);
  const remainingBits = difficulty % 4;
  return (nibble >> (4 - remainingBits)) === 0;
}

/**
 * Calculates the actual difficulty of an event's hash
 * @param hash - The event hash (hex string)
 * @returns Number of leading zero bits in the hash
 */
export function calculateHashDifficulty(hash: string): number {
  let difficulty = 0;
  
  for (let i = 0; i < hash.length; i++) {
    const digit = parseInt(hash[i], 16);
    
    if (digit === 0) {
      difficulty += 4;
    } else {
      // Count leading zeros in this hex digit
      for (let bit = 3; bit >= 0; bit--) {
        if ((digit >> bit) & 1) {
          break;
        }
        difficulty++;
      }
      break;
    }
  }
  
  return difficulty;
}

