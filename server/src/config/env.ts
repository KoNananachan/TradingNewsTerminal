import dotenv from 'dotenv';
import { z } from 'zod';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '..', '..', '..', '.env') });

const envSchema = z.object({
  DATABASE_URL: z.string().default('file:./prisma/prod.db'),
  PORT: z.coerce.number().default(8080),
  WS_PORT: z.coerce.number().default(3002),
  SCRAPE_INTERVAL_MINUTES: z.coerce.number().default(10),

  // News data source
  NEWS_API_URL: z.string().default(''),

  // AI / LLM provider (any OpenAI-compatible endpoint)
  // Supports: AI_API_KEY or GEMINI_API_KEY (backward compat)
  AI_API_KEY: z.string().default(''),
  GEMINI_API_KEY: z.string().default(''),
  AI_BASE_URL: z.string().default(''),
  GEMINI_BASE_URL: z.string().default('https://generativelanguage.googleapis.com/v1beta'),
  AI_MODEL: z.string().default(''),
  GEMINI_MODEL: z.string().default('gemini-2.0-flash'),

  // CORS — comma-separated allowed origins for production
  ALLOWED_ORIGINS: z.string().default(''),

  // GCS backup (optional)
  GCS_BUCKET: z.string().default(''),
  GCS_BACKUP_INTERVAL_MINUTES: z.coerce.number().default(5),
  FMP_API_KEY: z.string().default(''),

  // Auth & Billing
  GOOGLE_CLIENT_ID: z.string().default(''),
  RESEND_API_KEY: z.string().default(''),
  RESEND_FROM_EMAIL: z.string().default('noreply@example.com'),
  STRIPE_SECRET_KEY: z.string().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().default(''),
  STRIPE_PRICE_ID: z.string().default(''),

  // Encryption key for sensitive credentials (Alpaca API keys)
  // Use a 64-char hex string or any passphrase
  ENCRYPTION_KEY: z.string().default(''),
});

// Parse raw env, then resolve aliases (AI_* takes priority over GEMINI_*)
const rawEnv = envSchema.parse(process.env);

// Resolved config — use AI_* if set, fallback to GEMINI_* for backward compatibility
export const env = {
  ...rawEnv,
  // Canonical AI config (consumers should use these)
  AI_API_KEY: rawEnv.AI_API_KEY || rawEnv.GEMINI_API_KEY,
  AI_BASE_URL: rawEnv.AI_BASE_URL || rawEnv.GEMINI_BASE_URL,
  AI_MODEL: rawEnv.AI_MODEL || rawEnv.GEMINI_MODEL,
};
