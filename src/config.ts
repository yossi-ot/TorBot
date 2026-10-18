import 'dotenv/config';

export const config = {
  port: parseInt(process.env.PORT || '3000'),
  databaseUrl: process.env.DATABASE_URL || 'postgresql://localhost:5432/torbot',
  whatsapp: {
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || '',
    // International-format number (no "+") behind every shared-platform
    // tenant's entry link, e.g. "972501234567". Set once a shared number exists.
    sharedNumber: process.env.SHARED_WA_NUMBER || '',
    // Credentials for that same shared number, used to send on behalf of
    // every tenant that has no WABA of its own (whatsappPhoneNumberId is empty).
    sharedPhoneNumberId: process.env.SHARED_WA_PHONE_NUMBER_ID || '',
    sharedAccessToken: process.env.SHARED_WA_ACCESS_TOKEN || '',
  },
  meta: {
    appId: process.env.META_APP_ID || '',
    appSecret: process.env.META_APP_SECRET || '',
    configId: process.env.META_CONFIG_ID || '',
  },
  dialog360: {
    /** Partner API key for Hub integrations (optional, only needed for Direct Integration onboarding flow). */
    partnerApiKey: process.env.DIALOG360_PARTNER_API_KEY || '',
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
  },
  dashboard: {
    jwtSecret: process.env.JWT_SECRET || 'torbot-dev-secret-change-in-production',
  },
};
