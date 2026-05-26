/** Shared HTTP retry helper for both Meta and 360dialog providers. */

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000];

function isRetryable(status: number): boolean {
  return status >= 500 || status === 429;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export interface PostOptions {
  url: string;
  headers: Record<string, string>;
  body: string;
  /** Label used in logs (e.g. "Meta text", "360dialog template"). */
  label: string;
}

export async function postWithRetry(opts: PostOptions): Promise<void> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(opts.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...opts.headers },
        body: opts.body,
      });

      if (response.ok) return;

      const errorText = await response.text();
      lastError = new Error(`${opts.label} API error ${response.status}: ${errorText}`);

      if (!isRetryable(response.status)) {
        console.error(`${opts.label} failed (non-retryable): ${lastError.message}`);
        throw lastError;
      }

      console.warn(`${opts.label} attempt ${attempt + 1}/${MAX_RETRIES} failed (${response.status}), retrying...`);
    } catch (err) {
      if (err instanceof TypeError) {
        lastError = new Error(`${opts.label} network error: ${err.message}`);
        console.warn(`${opts.label} attempt ${attempt + 1}/${MAX_RETRIES} network error, retrying...`);
      } else {
        throw err;
      }
    }

    if (attempt < MAX_RETRIES - 1) {
      await sleep(RETRY_DELAYS[attempt]);
    }
  }

  console.error(`${opts.label} failed after ${MAX_RETRIES} attempts: ${lastError?.message}`);
  throw lastError || new Error(`${opts.label} failed after retries`);
}
