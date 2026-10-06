import dotenv from 'dotenv';
dotenv.config();

function required(name: string, fallback = ''): string {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export const env = {
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  databaseUrl: required('DATABASE_URL'),
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  openaiApiKey: process.env.OPENAI_API_KEY ?? '',
  openaiModel: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
  ollamaApiKey: process.env.OLLAMA_API_KEY ?? '',
  ollamaModel: process.env.OLLAMA_MODEL ?? 'gpt-oss:20b',
  ollamaBaseUrl: (process.env.OLLAMA_BASE_URL ?? 'https://ollama.com').replace(/\/$/, ''),
  whatsappVerifyToken: process.env.WHATSAPP_VERIFY_TOKEN ?? 'afiyaref-verify-token',
  whatsappAccessToken: process.env.WHATSAPP_ACCESS_TOKEN ?? '',
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? '',
  whatsappApiVersion: process.env.WHATSAPP_API_VERSION ?? 'v21.0',
  whatsappAppSecret: process.env.WHATSAPP_APP_SECRET ?? '',
  whatsappDryRun: process.env.WHATSAPP_DRY_RUN === '1',
  adminApiKey: process.env.ADMIN_API_KEY ?? '',
  termiiApiKey: process.env.TERMII_API_KEY ?? '',
  termiiSender: process.env.TERMII_SENDER ?? 'AfiyaRef',
};
