/**
 * Backwards-compatible facade. New code should import getProvider/credentialsFromTenant
 * from './index.js' directly. These wrappers exist so existing call sites
 * (router.ts, reminders.ts) keep working without immediate rewrites.
 */
import { getProvider } from './index.js';
import type { ProviderName, ProviderCredentials } from './provider.js';

interface SendArgs {
  provider: ProviderName;
  credentials: ProviderCredentials;
  to: string;
  text: string;
}

export async function sendWhatsAppMessage(args: SendArgs): Promise<void> {
  await getProvider(args.provider).sendText({
    credentials: args.credentials,
    to: args.to,
    text: args.text,
  });
}

interface SendTemplateArgs {
  provider: ProviderName;
  credentials: ProviderCredentials;
  to: string;
  templateName: string;
  languageCode: string;
  parameters: string[];
}

export async function sendTemplateMessage(args: SendTemplateArgs): Promise<void> {
  await getProvider(args.provider).sendTemplate({
    credentials: args.credentials,
    to: args.to,
    templateName: args.templateName,
    languageCode: args.languageCode,
    parameters: args.parameters,
  });
}
