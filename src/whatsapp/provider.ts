/**
 * WhatsApp provider abstraction.
 * Supports Meta Cloud API direct and 360dialog as a BSP wrapper.
 * Switching providers per tenant is a credentials change, not a code change.
 */

export type ProviderName = 'meta' | 'dialog360';

export type ProviderCredentials =
  | { kind: 'meta'; phoneNumberId: string; accessToken: string }
  | { kind: 'dialog360'; apiKey: string };

export interface SendTextOptions {
  credentials: ProviderCredentials;
  to: string;
  text: string;
}

export interface SendTemplateOptions {
  credentials: ProviderCredentials;
  to: string;
  templateName: string;
  languageCode: string;
  parameters: string[];
}

export interface IncomingMessage {
  /** Identifies which tenant this message belongs to (phone_number_id from Meta passthrough). */
  channelId: string;
  from: string;
  text: string;
  contactName: string;
  messageId: string;
}

export interface WhatsAppProvider {
  readonly name: ProviderName;
  sendText(opts: SendTextOptions): Promise<void>;
  sendTemplate(opts: SendTemplateOptions): Promise<void>;
  /** Extract incoming messages from a webhook payload. Returns [] for non-message events. */
  parseIncoming(body: unknown): IncomingMessage[];
}
