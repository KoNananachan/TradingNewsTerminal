import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

const trades = await p.insiderTrade.findMany({ take: 50, orderBy: { tradeDate: 'desc' } });
console.log('Total:', trades.length);

const stats = { withTitle: 0, withPrice: 0, withValue: 0, types: {} as Record<string, number> };
for (const t of trades) {
  if (t.ownerTitle) stats.withTitle++;
  if (t.pricePerShare) stats.withPrice++;
  if (t.totalValue) stats.withValue++;
  stats.types[t.transactionType] = (stats.types[t.transactionType] || 0) + 1;
}
console.log('Stats:', JSON.stringify(stats));
console.log('\nAll trades:');
for (const t of trades) {
  console.log(`  ${t.symbol} | ${t.ownerName} | title=${t.ownerTitle || 'NONE'} | type=${t.transactionType} | shares=${t.shares} | price=${t.pricePerShare ?? 'NONE'} | value=${t.totalValue ?? 'NONE'} | ${t.tradeDate.toISOString().slice(0, 10)}`);
}

await p.$disconnect();
