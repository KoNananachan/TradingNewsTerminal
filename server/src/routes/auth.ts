import { Router } from 'express';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Brute-force protection: track failed verify attempts per IP
const verifyAttempts = new Map<string, { count: number; resetAt: number }>();
const VERIFY_MAX_ATTEMPTS = 5;
const VERIFY_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function isVerifyBlocked(ip: string): boolean {
  const entry = verifyAttempts.get(ip);
  if (!entry) return false;
  if (Date.now() > entry.resetAt) {
    verifyAttempts.delete(ip);
    return false;
  }
  return entry.count >= VERIFY_MAX_ATTEMPTS;
}

function recordVerifyAttempt(ip: string) {
  const entry = verifyAttempts.get(ip);
  if (!entry || Date.now() > entry.resetAt) {
    verifyAttempts.set(ip, { count: 1, resetAt: Date.now() + VERIFY_WINDOW_MS });
  } else {
    entry.count++;
  }
}

function clearVerifyAttempts(ip: string) {
  verifyAttempts.delete(ip);
}
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  maxAge: SESSION_MAX_AGE_MS,
  path: '/',
};

async function createSession(userId: number) {
  const token = crypto.randomUUID();
  await prisma.authSession.create({
    data: {
      token,
      userId,
      expiresAt: new Date(Date.now() + SESSION_MAX_AGE_MS),
    },
  });
  return token;
}

// POST /api/auth/google — Google OAuth login
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential || !env.GOOGLE_CLIENT_ID) {
      return res.status(400).json({ error: 'Missing credential or Google not configured' });
    }

    const client = new OAuth2Client(env.GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.email) {
      return res.status(400).json({ error: 'Invalid Google token' });
    }

    const user = await prisma.user.upsert({
      where: { googleId: payload.sub },
      update: {
        name: payload.name ?? undefined,
        avatarUrl: payload.picture ?? undefined,
      },
      create: {
        email: payload.email,
        name: payload.name ?? null,
        avatarUrl: payload.picture ?? null,
        googleId: payload.sub,
      },
    });

    const token = await createSession(user.id);
    res.cookie('session', token, COOKIE_OPTIONS);
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      plan: user.plan,
      planExpiresAt: user.planExpiresAt,
    });
  } catch (err: any) {
    console.error('[Auth] Google login error:', err?.message);
    res.status(500).json({ error: 'Google login failed' });
  }
});

// POST /api/auth/email/send — Send verification code
router.post('/email/send', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email required' });
    }

    const code = String(crypto.randomInt(100000, 999999));

    await prisma.verificationCode.create({
      data: {
        email: email.toLowerCase(),
        code,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min
      },
    });

    // Send via Resend API
    if (env.RESEND_API_KEY) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: env.RESEND_FROM_EMAIL,
          to: email,
          subject: 'TradingNewsTerminal - Verification Code',
          html: `<p>Your verification code is: <strong>${code}</strong></p><p>This code expires in 10 minutes.</p>`,
        }),
      });
    } else {
      console.log(`[Auth] Email code for ${email}: ${code} (Resend not configured)`);
    }

    res.json({ ok: true });
  } catch (err: any) {
    console.error('[Auth] Email send error:', err?.message);
    res.status(500).json({ error: 'Failed to send code' });
  }
});

// POST /api/auth/email/verify — Verify code and login
router.post('/email/verify', async (req, res) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    if (isVerifyBlocked(ip)) {
      return res.status(429).json({ error: 'Too many verification attempts, please try again later' });
    }

    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: 'Email and code required' });
    }

    const record = await prisma.verificationCode.findFirst({
      where: {
        email: email.toLowerCase(),
        code,
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      recordVerifyAttempt(ip);
      return res.status(400).json({ error: 'Invalid or expired code' });
    }

    clearVerifyAttempts(ip);
    await prisma.verificationCode.update({
      where: { id: record.id },
      data: { used: true },
    });

    const user = await prisma.user.upsert({
      where: { email: email.toLowerCase() },
      update: {},
      create: { email: email.toLowerCase() },
    });

    const token = await createSession(user.id);
    res.cookie('session', token, COOKIE_OPTIONS);
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      plan: user.plan,
      planExpiresAt: user.planExpiresAt,
    });
  } catch (err: any) {
    console.error('[Auth] Email verify error:', err?.message);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// GET /api/auth/me — Current user info
router.get('/me', (req, res) => {
  if (!req.user) {
    return res.json({ user: null });
  }
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      avatarUrl: req.user.avatarUrl,
      plan: req.user.plan,
      planExpiresAt: req.user.planExpiresAt,
      hasAlpaca: !!req.user.alpacaApiKey,
      alpacaPaper: req.user.alpacaPaper,
    },
  });
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  const token = req.cookies?.session;
  if (token) {
    await prisma.authSession.deleteMany({ where: { token } }).catch(() => {});
  }
  res.clearCookie('session', { path: '/' });
  res.json({ ok: true });
});

// GET /api/auth/me/export — Export all user data (GDPR data portability)
router.get('/me/export', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;

    const [user, sessions, trades] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          plan: true,
          planExpiresAt: true,
          alpacaPaper: true,
          createdAt: true,
          updatedAt: true,
          // Exclude encrypted credentials
        },
      }),
      prisma.authSession.findMany({
        where: { userId },
        select: { id: true, createdAt: true, expiresAt: true },
      }),
      prisma.tradeOrder.findMany({
        where: { walletAddress: req.user!.email },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    res.json({
      exportedAt: new Date().toISOString(),
      user,
      sessions: sessions.map((s) => ({
        id: s.id,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
      })),
      trades,
    });
  } catch (err: any) {
    console.error('[Auth] Data export error:', err?.message);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

// DELETE /api/auth/me — Delete account and all associated data (GDPR right to erasure)
router.delete('/me', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;

    // Delete all user data in a transaction
    await prisma.$transaction([
      prisma.authSession.deleteMany({ where: { userId } }),
      prisma.user.delete({ where: { id: userId } }),
    ]);

    res.clearCookie('session', { path: '/' });
    res.json({ ok: true, message: 'Account deleted' });
  } catch (err: any) {
    console.error('[Auth] Account deletion error:', err?.message);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

export default router;
