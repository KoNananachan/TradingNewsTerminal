import { prisma } from './prisma.js';

const categories = [
  { slug: 'earnings', name: 'Earnings', color: '#ff8c00', icon: '📊' },
  { slug: 'macro', name: 'Macro', color: '#2196f3', icon: '🌍' },
  { slug: 'geopolitics', name: 'Geopolitics', color: '#ff1744', icon: '🏛️' },
  { slug: 'tech', name: 'Technology', color: '#9c27b0', icon: '💻' },
  { slug: 'crypto', name: 'Crypto', color: '#ff9800', icon: '₿' },
  { slug: 'energy', name: 'Energy', color: '#4caf50', icon: '⚡' },
  { slug: 'healthcare', name: 'Healthcare', color: '#00bcd4', icon: '🏥' },
  { slug: 'ipo-ma', name: 'IPO & M&A', color: '#e91e63', icon: '🤝' },
  { slug: 'regulation', name: 'Regulation', color: '#795548', icon: '⚖️' },
  { slug: 'commodities', name: 'Commodities', color: '#ffc107', icon: '🛢️' },
];

const defaultStocks = [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'MSFT', name: 'Microsoft Corp.' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.' },
  { symbol: 'NVDA', name: 'NVIDIA Corp.' },
  { symbol: 'TSLA', name: 'Tesla Inc.' },
  { symbol: 'META', name: 'Meta Platforms Inc.' },
  { symbol: 'SPY', name: 'S&P 500 ETF' },
  { symbol: 'QQQ', name: 'Nasdaq 100 ETF' },
  { symbol: 'BTC-USD', name: 'Bitcoin USD' },
];

export async function seedDatabase() {
  const catCount = await prisma.newsCategory.count();
  const stockCount = await prisma.trackedStock.count();

  if (catCount > 0 && stockCount > 0) return;

  console.log('[Seed] Seeding database...');

  for (const cat of categories) {
    await prisma.newsCategory.upsert({
      where: { slug: cat.slug },
      update: cat,
      create: cat,
    });
  }
  console.log(`[Seed] ${categories.length} categories`);

  for (const stock of defaultStocks) {
    await prisma.trackedStock.upsert({
      where: { symbol: stock.symbol },
      update: stock,
      create: { ...stock, source: 'default' },
    });
  }
  console.log(`[Seed] ${defaultStocks.length} tracked stocks`);
}
