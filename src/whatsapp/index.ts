import { metaProvider } from './providers/meta.js';
import { dialog360Provider } from './providers/dialog360.js';
import { config } from '../config.js';
import type {
  WhatsAppProvider,
  ProviderName,
  ProviderCredentials,
} from './provider.js';

const PROVIDERS: Record<ProviderName, WhatsAppProvider> = {
  meta: metaProvider,
  dialog360: dialog360Provider,
};

export function getProvider(name: ProviderName): WhatsAppProvider {
  const p = PROVIDERS[name];
  if (!p) throw new Error(`Unknown WhatsApp provider: ${name}`);
  return p;
}

/** Build credentials object from a tenant row. */
export function credentialsFromTenant(tenant: {
  whatsappProvider: string | null;
  whatsappPhoneNumberId: string;
  whatsappAccessToken: string;
  dialog360ApiKey: string | null;
}): { provider: ProviderName; credentials: ProviderCredentials } {
  const provider = (tenant.whatsappProvider as ProviderName) || 'meta';

  if (provider === 'dialog360') {
    if (!tenant.dialog360ApiKey) {
      throw new Error('Tenant configured for dialog360 but dialog360ApiKey is missing');
    }
    return {
      provider,
      credentials: { kind: 'dialog360', apiKey: tenant.dialog360ApiKey },
    };
  }

  // Tenants on the shared platform number have no WABA of their own -
  // send through the shared number's credentials instead.
  if (!tenant.whatsappPhoneNumberId) {
    if (!config.whatsapp.sharedPhoneNumberId || !config.whatsapp.sharedAccessToken) {
      throw new Error('Tenant has no WhatsApp number and no shared platform number is configured');
    }
    return {
      provider: 'meta',
      credentials: {
        kind: 'meta',
        phoneNumberId: config.whatsapp.sharedPhoneNumberId,
        accessToken: config.whatsapp.sharedAccessToken,
      },
    };
  }

  return {
    provider: 'meta',
    credentials: {
      kind: 'meta',
      phoneNumberId: tenant.whatsappPhoneNumberId,
      accessToken: tenant.whatsappAccessToken,
    },
  };
}

export type { WhatsAppProvider, ProviderName, ProviderCredentials } from './provider.js';
export type { IncomingMessage, SendTextOptions, SendTemplateOptions } from './provider.js';
