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
};
