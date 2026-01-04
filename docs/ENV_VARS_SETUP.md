# PolyBot Environment Variables Setup Guide

This guide explains where to get each environment variable and how to set them up.

## 📧 Email System (Resend)

### RESEND_API_KEY

**Where to get it:** <https://resend.com>

1. Sign up for Resend (free tier: 3,000 emails/month)
2. Go to **API Keys** in the dashboard
3. Create a new API key
4. Copy the key (starts with `re_`)

```bash
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxx
```

### FROM_EMAIL

**Requirements:** Must verify your domain in Resend first.

1. In Resend dashboard, go to **Domains**
2. Add `polyparlay.io`
3. Add the DNS records (MX, TXT) to your domain registrar
4. Once verified:

```bash
FROM_EMAIL="PolyBot <noreply@polyparlay.io>"
SUPPORT_EMAIL="support@polyparlay.io"
```

### DNS Records for Email (Route 53)

Add these to your polyparlay.io DNS in AWS Route 53:

| Type | Name | Value |
|------|------|-------|
| MX | @ | 10 feedback-smtp.us-east-1.amazonses.com |
| TXT | @ | v=spf1 include:amazonses.com ~all |
| TXT | resend._domainkey | (Resend will provide this DKIM key) |

---

## 🔐 Supabase Webhook Secret

### SUPABASE_WEBHOOK_SECRET

**Generate yourself:** This is a secret you create to authenticate Supabase webhooks.

```bash
# Generate a random secret
openssl rand -hex 32
# Example output: 8a7b4c2d1e9f0g3h5i6j7k8l9m0n1o2p3q4r5s6t7u8v9w0x1y2z3a4b5c6d7e8f
```

```bash
SUPABASE_WEBHOOK_SECRET=8a7b4c2d1e9f0g3h5i6j7k8l9m0n1o2p3q4r5s6t7u8v9w0x1y2z3a4b5c6d7e8f
```

### Configure in Supabase

1. Go to your Supabase project → **Database** → **Webhooks**
2. Create a new webhook:
   - **Name:** `auth-webhook`
   - **Table:** `auth.users`
   - **Events:** INSERT, UPDATE, DELETE
   - **HTTP URL:** `https://app.polyparlay.io/api/webhooks/auth`
   - **HTTP Headers:**

     ```json
     { "Authorization": "Bearer YOUR_WEBHOOK_SECRET" }
     ```

---

## 🔑 Complete .env.local Template

```bash
# ========================
# Supabase Configuration
# ========================
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxxxx
SUPABASE_SERVICE_ROLE_KEY=eyJxxxxx
SUPABASE_WEBHOOK_SECRET=your_generated_secret

# ========================
# Email (Resend)
# ========================
RESEND_API_KEY=re_xxxxx
FROM_EMAIL="PolyBot <noreply@polyparlay.io>"
SUPPORT_EMAIL="support@polyparlay.io"

# ========================
# Stripe (Payments)
# ========================
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# ========================
# AWS Configuration (for Secrets Manager & Lightsail)
# NOTE: Use AMAZON_ prefix, NOT AWS_ prefix!
# ========================
AMAZON_ACCESS_KEY_ID=AKIA...
AMAZON_SECRET_ACCESS_KEY=xxxxx
AWS_REGION=us-east-1
AWS_LIGHTSAIL_SERVICE_NAME=polybot

# ========================
# GitHub (for deployments)
# ========================
GITHUB_TOKEN=ghp_xxxxx

# ========================
# Trading APIs (optional - users add their own)
# ========================
# Admin fallback credentials only
ALPACA_API_KEY=xxxxx
ALPACA_API_SECRET=xxxxx
ALPACA_BASE_URL=https://paper-api.alpaca.markets

# ========================
# Bot Configuration
# ========================
BOT_API_URL=http://localhost:8000
```

---

## 🌐 Domain & DNS Setup (AWS Route 53)

Your domain `polyparlay.io` should have these records:

| Type | Name | Value |
|------|------|-------|
| A | @ | Vercel IP (76.76.19.19) |
| A | app | Vercel IP |
| CNAME | www | cname.vercel-dns.com |
| MX | @ | 10 feedback-smtp.us-east-1.amazonses.com |
| TXT | @ | v=spf1 include:amazonses.com ~all |
| TXT | _dmarc | v=DMARC1; p=quarantine; rua=mailto:admin@polyparlay.io |

---

## ⚡ Quick Setup Script

Run this to generate secrets locally:

```bash
# Generate webhook secret
echo "SUPABASE_WEBHOOK_SECRET=$(openssl rand -hex 32)"

# Generate JWT secret (if needed)
echo "JWT_SECRET=$(openssl rand -base64 32)"
```

---

## 🔗 Service Links

| Service | Dashboard URL |
|---------|--------------|
| Supabase | <https://supabase.com/dashboard> |
| Resend | <https://resend.com/emails> |
| Stripe | <https://dashboard.stripe.com> |
| AWS | <https://console.aws.amazon.com> |
| Vercel | <https://vercel.com/dashboard> |
| Route 53 | <https://console.aws.amazon.com/route53> |

---

## ✅ Verification Checklist

After setup, verify each service:

- [ ] **Resend**: Send test email via dashboard
- [ ] **Supabase Webhook**: Create test user, check logs
- [ ] **Stripe**: Test mode payment
- [ ] **Domain**: `dig polyparlay.io` shows correct records
- [ ] **SSL**: `https://polyparlay.io` works
