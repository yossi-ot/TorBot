const BASE_URL = 'https://graph.facebook.com/v21.0';

interface SendMessageOptions {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  text: string;
}

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // ms

/** Check if an error is retryable (network errors or 5xx) */
function isRetryable(status: number): boolean {
  return status >= 500 || status === 429;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function sendWhatsAppMessage(opts: SendMessageOptions): Promise<void> {
  const url = `${BASE_URL}/${opts.phoneNumberId}/messages`;
  const body = JSON.stringify({
    messaging_product: 'whatsapp',
    to: opts.to,
    type: 'text',
    text: { body: opts.text },
  });

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${opts.accessToken}`,
          'Content-Type': 'application/json',
        },
        body,
      });

      if (response.ok) return;

      const errorText = await response.text();
      lastError = new Error(`WhatsApp API error ${response.status}: ${errorText}`);

      // Don't retry client errors (4xx) except 429 (rate limit)
      if (!isRetryable(response.status)) {
        console.error(`WhatsApp send failed (non-retryable): ${lastError.message}`);
        throw lastError;
      }

      console.warn(`WhatsApp send attempt ${attempt + 1}/${MAX_RETRIES} failed (${response.status}), retrying...`);
    } catch (err) {
      // Network error (fetch itself failed) - retryable
      if (err instanceof TypeError) {
        lastError = new Error(`WhatsApp network error: ${err.message}`);
        console.warn(`WhatsApp send attempt ${attempt + 1}/${MAX_RETRIES} network error, retrying...`);
      } else if (err instanceof Error && !isRetryable(0)) {
        // Re-throw non-retryable errors from above
        throw err;
      }
    }

    if (attempt < MAX_RETRIES - 1) {
      await sleep(RETRY_DELAYS[attempt]);
    }
  }

  console.error(`WhatsApp send failed after ${MAX_RETRIES} attempts: ${lastError?.message}`);
  throw lastError || new Error('WhatsApp send failed after retries');
}

/** Send a template message (for reminders - must be pre-approved by Meta) */
export async function sendTemplateMessage(opts: {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  templateName: string;
  languageCode: string;
  parameters: string[];
}): Promise<void> {
  const url = `${BASE_URL}/${opts.phoneNumberId}/messages`;
  const body = JSON.stringify({
    messaging_product: 'whatsapp',
    to: opts.to,
    type: 'template',
    template: {
      name: opts.templateName,
      language: { code: opts.languageCode },
      components: opts.parameters.length > 0 ? [{
        type: 'body',
        parameters: opts.parameters.map(p => ({ type: 'text', text: p })),
      }] : undefined,
    },
  });

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${opts.accessToken}`,
          'Content-Type': 'application/json',
        },
        body,
      });

      if (response.ok) return;

      const errorText = await response.text();
      lastError = new Error(`WhatsApp template API error ${response.status}: ${errorText}`);

      if (!isRetryable(response.status)) {
        console.error(`WhatsApp template send failed (non-retryable): ${lastError.message}`);
        throw lastError;
      }

      console.warn(`WhatsApp template send attempt ${attempt + 1}/${MAX_RETRIES} failed (${response.status}), retrying...`);
    } catch (err) {
      if (err instanceof TypeError) {
        lastError = new Error(`WhatsApp network error: ${err.message}`);
        console.warn(`WhatsApp template send attempt ${attempt + 1}/${MAX_RETRIES} network error, retrying...`);
      } else if (err instanceof Error && !isRetryable(0)) {
        throw err;
      }
    }

    if (attempt < MAX_RETRIES - 1) {
      await sleep(RETRY_DELAYS[attempt]);
    }
  }

  console.error(`WhatsApp template send failed after ${MAX_RETRIES} attempts: ${lastError?.message}`);
  throw lastError || new Error('WhatsApp template send failed after retries');
}
