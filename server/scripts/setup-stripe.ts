/**
 * Stripe Setup Script
 *
 * Creates the Pro subscription product + price in your Stripe account
 * and writes the values to .env automatically.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_test_xxx npx tsx server/scripts/setup-stripe.ts
 *
 * Or set STRIPE_SECRET_KEY in .env first, then:
 *   npx tsx server/scripts/setup-stripe.ts
 */

import Stripe from 'stripe';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '..', '..', '.env');

// Load .env manually
const envContent = fs.readFileSync(envPath, 'utf-8');
const envLines = envContent.split('\n');
function getEnvValue(key: string): string {
  for (const line of envLines) {
    const match = line.match(new RegExp(`^${key}=(.*)$`));
    if (match) return match[1].trim();
  }
  return '';
}

const secretKey = process.env.STRIPE_SECRET_KEY || getEnvValue('STRIPE_SECRET_KEY');

if (!secretKey || !secretKey.startsWith('sk_')) {
  console.error('\n❌ STRIPE_SECRET_KEY not found or invalid.');
  console.error('\nTo get your key:');
  console.error('  1. Go to https://dashboard.stripe.com/test/apikeys');
  console.error('  2. Copy the "Secret key" (starts with sk_test_)');
  console.error('  3. Run: STRIPE_SECRET_KEY=sk_test_xxx npx tsx server/scripts/setup-stripe.ts\n');
  process.exit(1);
}

const stripe = new Stripe(secretKey);

async function main() {
  console.log('\n🔧 Setting up Stripe for TradingNewsTerminal...\n');

  // 1. Create Product
  console.log('Creating product...');
  const product = await stripe.products.create({
    name: 'TradingNewsTerminal Pro',
    description: 'Full access to AI-powered trading intelligence — all ticker recommendations, impact analysis, AI Chat, AI Insights, and priority data access.',
  });
  console.log(`  ✅ Product created: ${product.id}`);

  // 2. Create Price ($20/month)
  console.log('Creating $20/month price...');
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: 2000, // $20.00 in cents
    currency: 'usd',
    recurring: { interval: 'month' },
  });
  console.log(`  ✅ Price created: ${price.id}`);

  // 3. Enable Customer Portal
  console.log('Configuring customer portal...');
  try {
    await stripe.billingPortal.configurations.create({
      business_profile: {
        headline: 'Manage your TradingNewsTerminal Pro subscription',
      },
      features: {
        subscription_cancel: { enabled: true, mode: 'at_period_end' },
        payment_method_update: { enabled: true },
      },
    });
    console.log('  ✅ Customer Portal configured');
  } catch (err: any) {
    // Portal config might already exist
    console.log(`  ⚠️  Customer Portal: ${err.message}`);
  }

  // 4. Update .env
  console.log('\nUpdating .env...');
  let updated = envContent;

  function setEnv(key: string, value: string) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(updated)) {
      updated = updated.replace(regex, `${key}=${value}`);
    } else {
      updated += `\n${key}=${value}`;
    }
  }

  setEnv('STRIPE_SECRET_KEY', secretKey);
  setEnv('STRIPE_PRICE_ID', price.id);

  fs.writeFileSync(envPath, updated);
  console.log('  ✅ .env updated with STRIPE_SECRET_KEY and STRIPE_PRICE_ID');

  // 5. Webhook instructions
  console.log('\n📋 Remaining manual steps:');
  console.log('');
  console.log('  For local testing (optional):');
  console.log('    Install Stripe CLI → stripe listen --forward-to localhost:3001/api/billing/webhook');
  console.log('');
  console.log('  For production:');
  console.log('    1. Go to https://dashboard.stripe.com/test/webhooks');
  console.log('    2. Add endpoint: https://YOUR_DOMAIN/api/billing/webhook');
  console.log('    3. Select events: checkout.session.completed, invoice.paid,');
  console.log('       customer.subscription.updated, customer.subscription.deleted');
  console.log('    4. Copy the webhook signing secret → STRIPE_WEBHOOK_SECRET in .env');
  console.log('');
  console.log('  ✅ Done! Restart your server for changes to take effect.\n');
}

main().catch((err) => {
  console.error('❌ Setup failed:', err.message);
  process.exit(1);
});
