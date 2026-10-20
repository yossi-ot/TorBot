import { eq } from 'drizzle-orm';
import { metaProvider } from './providers/meta.js';
import { dialog360Provider } from './providers/dialog360.js';
import { db, schema } from '../db/index.js';
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

/** The one tenant whose WABA physically hosts every no-own-number tenant. */
export async function getSharedNumberOwner() {
  const [owner] = await db.select().from(schema.tenants)
    .where(eq(schema.tenants.isSharedNumberOwner, true));
  return owner;
}

/** Build credentials object from a tenant row. */
export async function credentialsFromTenant(tenant: {
  whatsappProvider: string | null;
  whatsappPhoneNumberId: string;
  whatsappAccessToken: string;
  dialog360ApiKey: string | null;
}): Promise<{ provider: ProviderName; credentials: ProviderCredentials }> {
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
  // send through the shared-number owner's credentials instead.
  if (!tenant.whatsappPhoneNumberId) {
    const owner = await getSharedNumberOwner();
    if (!owner) {
      throw new Error('Tenant has no WhatsApp number and no shared platform number owner is configured');
    }
    return {
      provider: 'meta',
      credentials: {
        kind: 'meta',
        phoneNumberId: owner.whatsappPhoneNumberId,
        accessToken: owner.whatsappAccessToken,
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
