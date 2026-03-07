import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { decrypt, isEncrypted } from '../lib/crypto.js';

export interface AuthUser {
  id: number;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  plan: string;
  planExpiresAt: Date | null;
  alpacaApiKey: string | null;
  alpacaSecretKey: string | null;
  alpacaPaper: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Global middleware: reads `session` cookie → looks up DB → attaches req.user
 */
export async function attachUser(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.session;
    if (!token) return next();

    const session = await prisma.authSession.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      // Expired session — clean up
      if (session) {
        await prisma.authSession.delete({ where: { id: session.id } }).catch(() => {});
      }
      return next();
    }

    // Decrypt Alpaca credentials if they exist and are encrypted
    let alpacaApiKey = session.user.alpacaApiKey;
    let alpacaSecretKey = session.user.alpacaSecretKey;
    try {
      if (alpacaApiKey && isEncrypted(alpacaApiKey)) alpacaApiKey = decrypt(alpacaApiKey);
      if (alpacaSecretKey && isEncrypted(alpacaSecretKey)) alpacaSecretKey = decrypt(alpacaSecretKey);
    } catch {
      // If decryption fails, treat as no credentials
      alpacaApiKey = null;
      alpacaSecretKey = null;
    }

    req.user = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      avatarUrl: session.user.avatarUrl,
      plan: session.user.plan,
      planExpiresAt: session.user.planExpiresAt,
      alpacaApiKey,
      alpacaSecretKey,
      alpacaPaper: session.user.alpacaPaper,
    };
  } catch (err) {
    console.error('[Auth] Session lookup failed:', (err as any)?.code || (err as any)?.message);
  }
  next();
}

/**
 * Route-level middleware: 401 if not logged in
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
}

/**
 * Route-level middleware: 401/403 if not logged in or not Pro
 */
export function requirePro(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const isPro = req.user.plan === 'pro' &&
    (!req.user.planExpiresAt || req.user.planExpiresAt > new Date());
  if (!isPro) {
    res.status(403).json({ error: 'Pro subscription required' });
    return;
  }
  next();
}
