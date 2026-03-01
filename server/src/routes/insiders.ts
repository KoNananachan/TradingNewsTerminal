import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

interface ClusterBuy {
  symbol: string;
  buyers: Array<{ ownerName: string; tradeDate: string; shares: number; totalValue: number | null }>;
  count: number;
}

function detectClusterBuys(
  trades: Array<{
    symbol: string;
    ownerName: string;
    tradeDate: Date;
    transactionType: string;
    shares: number;
    totalValue: number | null;
  }>,
): ClusterBuy[] {
  // Group purchases by symbol
  const purchasesBySymbol = new Map<string, typeof trades>();

  for (const trade of trades) {
    if (trade.transactionType !== 'P') continue;
    const group = purchasesBySymbol.get(trade.symbol);
    if (group) {
      group.push(trade);
    } else {
      purchasesBySymbol.set(trade.symbol, [trade]);
    }
  }

  const clusterBuys: ClusterBuy[] = [];

  for (const [symbol, purchases] of purchasesBySymbol) {
    if (purchases.length < 2) continue;

    // Check if 2+ distinct executives bought within 7 days of each other
    const uniqueOwners = new Set(purchases.map(p => p.ownerName));
    if (uniqueOwners.size < 2) continue;

    // Sort by trade date
    const sorted = [...purchases].sort((a, b) => a.tradeDate.getTime() - b.tradeDate.getTime());

    // Check 7-day window
    const sevenDays = 7 * 24 * 60 * 60_000;
    let isCluster = false;

    for (let i = 0; i < sorted.length - 1; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        if (sorted[j].tradeDate.getTime() - sorted[i].tradeDate.getTime() <= sevenDays) {
          if (sorted[i].ownerName !== sorted[j].ownerName) {
            isCluster = true;
            break;
          }
        }
      }
      if (isCluster) break;
    }

    if (isCluster) {
      clusterBuys.push({
        symbol,
        buyers: sorted.map(p => ({
          ownerName: p.ownerName,
          tradeDate: p.tradeDate.toISOString().slice(0, 10),
          shares: p.shares,
          totalValue: p.totalValue,
        })),
        count: uniqueOwners.size,
      });
    }
  }

  return clusterBuys;
}

// GET /api/insiders - list insider trades
router.get('/', async (req, res) => {
  try {
    const symbolsParam = (req.query.symbols as string) || '';
    const days = Math.min(90, Math.max(1, parseInt(req.query.days as string) || 30));

    const since = new Date(Date.now() - days * 24 * 60 * 60_000);

    const where: any = {
      filingDate: { gte: since },
    };

    if (symbolsParam) {
      const symbols = symbolsParam
        .split(',')
        .map(s => s.trim().toUpperCase())
        .filter(Boolean);
      if (symbols.length > 0) {
        where.symbol = { in: symbols };
      }
    }

    const trades = await prisma.insiderTrade.findMany({
      where,
      orderBy: { filingDate: 'desc' },
      take: 100,
    });

    // Detect cluster buys
    const clusterBuys = detectClusterBuys(trades);

    // Create a set of symbols with cluster buys for flagging
    const clusterBuySymbols = new Set(clusterBuys.map(cb => cb.symbol));

    const result = trades.map(trade => ({
      ...trade,
      isClusterBuy: clusterBuySymbols.has(trade.symbol),
    }));

    res.json({
      trades: result,
      clusterBuys,
    });
  } catch (err) {
    console.error('[Insiders] Error fetching insider trades:', err);
    res.status(500).json({ error: 'Failed to fetch insider trades' });
  }
});

export default router;
