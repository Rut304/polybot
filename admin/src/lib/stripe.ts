import Stripe from 'stripe';

// Use a placeholder if missing to prevent build-time crashes (Vercel build optimization)
const apiKey = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder_for_build';

export const stripe = new Stripe(apiKey, {
  typescript: true,
});
