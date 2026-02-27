import dotenv from 'dotenv';
import { z } from 'zod';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '..', '..', '..', '.env') });

const envSchema = z.object({
  DATABASE_URL: z.string().default('file:./prisma/prod.db'),
  GEMINI_API_KEY: z.string().default('your-api-key-here'),
  GEMINI_BASE_URL: z.string().default('https://api.apiplus.org/v1'),
  GEMINI_MODEL: z.string().default('gemini-2.0-flash'),
  PORT: z.coerce.number().default(8080),
  WS_PORT: z.coerce.number().default(3002),
  SCRAPE_INTERVAL_MINUTES: z.coerce.number().default(10),
});

export const env = envSchema.parse(process.env);
