import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const r = await p.insiderTrade.deleteMany();
console.log('Deleted', r.count, 'old insider trades');
await p.$disconnect();
