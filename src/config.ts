import 'dotenv/config';

export const config = {
  port: parseInt(process.env.PORT || '3000'),
  whatsapp: {
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
  },
  dashboard: {
    password: process.env.DASHBOARD_PASSWORD || 'admin123',
    jwtSecret: process.env.JWT_SECRET || 'torbot-dev-secret-change-in-production',
  },
};
