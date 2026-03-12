import { Router, type Request, type Response } from 'express';
import Stripe from 'stripe';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';

const ALLOWED_BILLING_ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)
);

function getSafeOrigin(req: Request): string {
  const origin = req.headers.origin || '';
  if (ALLOWED_BILLING_ORIGINS.has(origin)) return origin;
  // In development, allow localhost
  if (process.env.NODE_ENV !== 'production' && /^http:\/\/localhost:\d+$/.test(origin)) return origin;
  // In production, always use the first configured origin (never fall back to localhost)
  const fallback = process.env.ALLOWED_ORIGINS?.split(',')[0]?.trim();
  if (!fallback) {
    console.error('[Billing] ALLOWED_ORIGINS not configured — cannot determine safe redirect URL');
  }
  return fallback || 'https://neuberg.ai';
}

const router = Router();

function getStripe(): Stripe | null {
  if (!env.STRIPE_SECRET_KEY) return null;
  return new Stripe(env.STRIPE_SECRET_KEY);
}

// POST /api/billing/checkout — Create Stripe Checkout session
router.post('/checkout', requireAuth, async (req, res) => {
  const stripe = getStripe();
  if (!stripe || !env.STRIPE_PRICE_ID) {
    return res.status(503).json({ error: 'Stripe not configured' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Create or reuse Stripe customer (use updateMany with condition to avoid race)
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: String(user.id) },
      });
      customerId = customer.id;
      const updated = await prisma.user.updateMany({
        where: { id: user.id, stripeCustomerId: null },
        data: { stripeCustomerId: customerId },
      });
      if (updated.count === 0) {
        // Another request already set the customer ID — re-read and use that
        const refreshed = await prisma.user.findUnique({ where: { id: user.id } });
        if (refreshed?.stripeCustomerId) {
          // Clean up the duplicate Stripe customer we just created
          await stripe.customers.del(customerId).catch(() => {});
          customerId = refreshed.stripeCustomerId;
        }
      }
    }

    const origin = getSafeOrigin(req);
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${origin}?billing=success`,
      cancel_url: `${origin}?billing=cancel`,
    });

    res.json({ url: session.url });
  } catch (err: any) {
    console.error('[Billing] Checkout error:', err?.message);
    res.status(500).json({ error: 'Failed to create checkout' });
  }
});

// POST /api/billing/sync — Check Stripe subscription status and update user plan
// Called after checkout redirect or anytime to sync state (works without webhooks)
router.post('/sync', requireAuth, async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(503).json({ error: 'Stripe not configured' });

  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user?.stripeCustomerId) {
      return res.json({ plan: 'free', synced: false });
    }

    // List active subscriptions for this customer
    const subs = await stripe.subscriptions.list({
      customer: user.stripeCustomerId,
      status: 'active',
      limit: 1,
    });

    if (subs.data.length > 0) {
      const sub = subs.data[0];
      const periodEnd = (sub as any).current_period_end
        ? new Date((sub as any).current_period_end * 1000 + 5 * 24 * 60 * 60 * 1000)
        : new Date(Date.now() + 35 * 24 * 60 * 60 * 1000);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          plan: 'pro',
          stripeSubscriptionId: sub.id,
          planExpiresAt: periodEnd,
        },
      });
      console.log('[Billing] Sync: user', user.id, 'upgraded to pro');
      return res.json({ plan: 'pro', synced: true });
    } else {
      // No active subscription — check for trialing
      const trialSubs = await stripe.subscriptions.list({
        customer: user.stripeCustomerId,
        status: 'trialing',
        limit: 1,
      });
      if (trialSubs.data.length > 0) {
        await prisma.user.update({
          where: { id: user.id },
          data: { plan: 'pro', stripeSubscriptionId: trialSubs.data[0].id },
        });
        return res.json({ plan: 'pro', synced: true });
      }

      // No active sub at all
      if (user.plan === 'pro') {
        await prisma.user.update({
          where: { id: user.id },
          data: { plan: 'free', stripeSubscriptionId: null, planExpiresAt: null },
        });
      }
      return res.json({ plan: 'free', synced: true });
    }
  } catch (err: any) {
    console.error('[Billing] Sync error:', err?.message);
    res.status(500).json({ error: 'Failed to sync billing status' });
  }
});

// POST /api/billing/portal — Stripe Customer Portal
router.post('/portal', requireAuth, async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(503).json({ error: 'Stripe not configured' });

  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user?.stripeCustomerId) {
      return res.status(400).json({ error: 'No billing account' });
    }

    const origin = getSafeOrigin(req);
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: origin as string,
    });

    res.json({ url: session.url });
  } catch (err: any) {
    console.error('[Billing] Portal error:', err?.message);
    res.status(500).json({ error: 'Failed to create portal' });
  }
});

/**
 * Webhook handler — exported separately because it needs raw body.
 * Must be mounted BEFORE express.json() in app.ts.
 */
export async function billingWebhookHandler(req: Request, res: Response) {
  const stripe = getStripe();
  if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).json({ error: 'Stripe webhooks not configured' });
  }

  const sig = req.headers['stripe-signature'];
  if (!sig) return res.status(400).json({ error: 'Missing signature' });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    console.error('[Billing] Webhook signature error:', err?.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.customer && session.subscription) {
          await prisma.user.updateMany({
            where: { stripeCustomerId: session.customer as string },
            data: {
              plan: 'pro',
              stripeSubscriptionId: session.subscription as string,
              planExpiresAt: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000), // 35 days buffer
            },
          });
          console.log('[Billing] Checkout completed for customer:', session.customer);
        }
        break;
      }
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.customer && (invoice as any).subscription) {
          await prisma.user.updateMany({
            where: { stripeCustomerId: invoice.customer as string },
            data: {
              plan: 'pro',
              planExpiresAt: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000),
            },
          });
          console.log('[Billing] Invoice paid for customer:', invoice.customer);
        }
        break;
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const active = ['active', 'trialing'].includes(sub.status);
        await prisma.user.updateMany({
          where: { stripeCustomerId: sub.customer as string },
          data: {
            plan: active ? 'pro' : 'free',
            planExpiresAt: active
              ? new Date(((sub as any).current_period_end ?? Math.floor(Date.now() / 1000) + 30 * 86400) * 1000 + 5 * 24 * 60 * 60 * 1000)
              : null,
          },
        });
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await prisma.user.updateMany({
          where: { stripeCustomerId: sub.customer as string },
          data: { plan: 'free', stripeSubscriptionId: null, planExpiresAt: null },
        });
        console.log('[Billing] Subscription cancelled for customer:', sub.customer);
        break;
      }
    }
  } catch (err: any) {
    console.error('[Billing] Webhook processing error:', err?.message);
  }

  res.json({ received: true });
}

export default router;
