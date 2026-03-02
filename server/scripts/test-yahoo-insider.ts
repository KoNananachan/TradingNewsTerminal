import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

import { ensureCrumb } from '../src/services/stocks/yahoo-finance.js';

async function main() {
  const auth = await ensureCrumb();
  if (!auth) { console.log('No crumb'); return; }

  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/MSFT?modules=insiderTransactions,insiderHolders&crumb=${encodeURIComponent(auth.crumb)}`;
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Cookie': auth.cookie },
  });
  const data = await resp.json() as any;
  const txns = data?.quoteSummary?.result?.[0]?.insiderTransactions?.transactions || [];
  console.log(`Total transactions: ${txns.length}\n`);
  for (const t of txns.slice(0, 5)) {
    console.log(JSON.stringify(t, null, 2));
    console.log('---');
  }
}
main();
