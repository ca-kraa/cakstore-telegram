import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '58421', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    botUsername: process.env.TELEGRAM_BOT_USERNAME || '',
    pollingTimeout: parseInt(process.env.POLLING_TIMEOUT || '30', 10),
  },
  auth: {
    apiKey: process.env.APP_API_KEY || 'cakstore_secret_dev_key_2026',
  },
  cakstore: {
    apiUrl: process.env.CAKSTORE_API_URL || '',
    apiKey: process.env.CAKSTORE_API_KEY || '',
  },
  clientDistPath: path.resolve(process.cwd(), 'dist/client'),
};
