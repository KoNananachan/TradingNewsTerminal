import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

const trades = await p.insiderTrade.findMany({ orderBy: { id: 'asc' } });
console.log('Total trades before dedup:', trades.length);

const seen = new Map<string, number>();
const toDelete: number[] = [];

for (const t of trades) {
  const key = `${t.symbol}|${t.ownerName}|${t.tradeDate.toISOString().slice(0, 10)}|${t.shares}|${t.transactionType}`;
  if (seen.has(key)) {
    toDelete.push(t.id);
  } else {
    seen.set(key, t.id);
  }
}

if (toDelete.length > 0) {
  const result = await p.insiderTrade.deleteMany({ where: { id: { in: toDelete } } });
  console.log('Deleted', result.count, 'duplicate trades');
} else {
  console.log('No duplicates found');
}

const remaining = await p.insiderTrade.count();
console.log('Total trades after dedup:', remaining);

await p.$disconnect();
