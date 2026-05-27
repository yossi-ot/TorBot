/**
 * Per-request cost tracking. Any AI helper (normalizer, agent, micro
 * interpreters) records its token usage to the active bucket; the router
 * wraps a single inbound-message handling in withCostTracking() and reads
 * the total at the end so the user-facing reply can show '💰 X אגורות'.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

export interface CostBucket {
  inputTokens: number;
  outputTokens: number;
  calls: number;
}

const storage = new AsyncLocalStorage<CostBucket>();

// Haiku 4.5 pricing
const PRICE_INPUT_USD_PER_MTOK = 1.0;
const PRICE_OUTPUT_USD_PER_MTOK = 5.0;
const USD_TO_ILS = 3.7;

export async function withCostTracking<T>(fn: () => Promise<T>): Promise<{ result: T; bucket: CostBucket }> {
  const bucket: CostBucket = { inputTokens: 0, outputTokens: 0, calls: 0 };
  const result = await storage.run(bucket, fn);
  return { result, bucket };
}

export function recordAiUsage(inputTokens: number, outputTokens: number): void {
  const bucket = storage.getStore();
  if (!bucket) return;
  bucket.inputTokens += inputTokens;
  bucket.outputTokens += outputTokens;
  bucket.calls += 1;
}

export function bucketCostAgorot(bucket: CostBucket): number {
  const usd = (bucket.inputTokens / 1_000_000) * PRICE_INPUT_USD_PER_MTOK
            + (bucket.outputTokens / 1_000_000) * PRICE_OUTPUT_USD_PER_MTOK;
  return Math.round(usd * USD_TO_ILS * 100 * 100) / 100; // agorot, 2 decimals
}
