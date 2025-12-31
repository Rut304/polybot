# External Monitoring Setup Guide

This document covers setting up external monitoring for PolyBot using free services.

---

## 1. Uptime Robot (Recommended - Free)

### Setup Steps

1. **Create Account**: Go to [UptimeRobot.com](https://uptimerobot.com) and sign up (free tier: 50 monitors)

2. **Add Bot Health Monitor**:
   - Click "Add New Monitor"
   - Type: **HTTP(s)**
   - Friendly Name: `PolyBot Health`
   - URL: `https://polyparlay.p3ww4fvp9w2se.us-east-1.cs.amazonlightsail.com/health`
   - Monitoring Interval: **5 minutes** (free tier)
   - Alert Contacts: Your email

3. **Add Bot Status Monitor**:
   - Type: **HTTP(s)**
   - Friendly Name: `PolyBot Status`
   - URL: `https://polyparlay.p3ww4fvp9w2se.us-east-1.cs.amazonlightsail.com/status`
   - Monitoring Interval: **5 minutes**
   - Expected Response: Contains `"status":"running"`

4. **Add Admin Dashboard Monitor**:
   - Type: **HTTP(s)**
   - Friendly Name: `PolyParlay Dashboard`
   - URL: `https://polyparlay.io`
   - Monitoring Interval: **5 minutes**

### Expected Responses

**`/health` endpoint:**
```json
{
  "status": "ok",
  "version": "1.1.25",
  "build": "100",
  "timestamp": "2025-01-01T00:00:00Z"
}
```

**`/status` endpoint:**
```json
{
  "status": "running",
  "uptime_seconds": 3600,
  "version": "1.1.25",
  "strategies_active": 5,
  "last_trade": "2025-01-01T00:00:00Z"
}
```

---

## 2. Better Uptime (Alternative - Free)

1. Go to [BetterUptime.com](https://betteruptime.com)
2. Add monitors for same URLs as above
3. Free tier includes:
   - 10 monitors
   - 3-minute checks
   - Email/SMS alerts
   - Status page

---

## 3. Slack/Discord Alerts

### Uptime Robot → Slack

1. In Uptime Robot, go to **My Settings** → **Alert Contacts**
2. Click **Add Alert Contact**
3. Type: **Slack**
4. Enter your Slack Webhook URL
5. Add this contact to your monitors

### Uptime Robot → Discord

1. Create a Discord webhook in your channel settings
2. In Uptime Robot, add alert contact type: **Webhook**
3. URL: Your Discord webhook URL
4. Add POST body:
```json
{
  "content": "🚨 *monitorFriendlyName* is *alertTypeFriendlyName*!"
}
```

---

## 4. Heartbeat Database Monitoring

PolyBot writes heartbeats to Supabase every 60 seconds. You can set up a Supabase Edge Function to alert if heartbeats stop:

### Supabase Edge Function (Optional)

```typescript
// supabase/functions/check-heartbeat/index.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async () => {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  
  const { data, error } = await supabase
    .from('polybot_heartbeat')
    .select('updated_at')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data || data.updated_at < fiveMinutesAgo) {
    // Send alert - bot hasn't sent heartbeat in 5 minutes
    await fetch(Deno.env.get('SLACK_WEBHOOK_URL')!, {
      method: 'POST',
      body: JSON.stringify({
        text: '🚨 PolyBot heartbeat missing! Last seen: ' + (data?.updated_at || 'never')
      })
    });
    
    return new Response('ALERT: Bot down', { status: 503 });
  }

  return new Response('OK: Bot healthy', { status: 200 });
});
```

Schedule via Supabase cron or external scheduler.

---

## 5. AWS CloudWatch (If Using Lightsail)

PolyBot on Lightsail can use CloudWatch for monitoring:

1. **Enable Container Monitoring**:
   ```bash
   aws lightsail update-container-service \
     --service-name polyparlay \
     --is-disabled false \
     --region us-east-1
   ```

2. **Create CloudWatch Alarm**:
   ```bash
   aws cloudwatch put-metric-alarm \
     --alarm-name "PolyBot-HealthCheck" \
     --metric-name "HealthCheckStatus" \
     --namespace "AWS/Lightsail" \
     --statistic Average \
     --period 300 \
     --threshold 1 \
     --comparison-operator LessThanThreshold \
     --dimensions Name=ServiceName,Value=polyparlay \
     --evaluation-periods 2 \
     --alarm-actions arn:aws:sns:us-east-1:ACCOUNT:alerts
   ```

---

## 6. Auto-Restart Configuration

### Lightsail Container Auto-Restart

Lightsail automatically restarts failed containers. To verify:

1. Check deployment health endpoint in container config
2. Ensure `/health` returns 200 OK
3. Container restarts if health check fails 3 times

### Systemd (For EC2/VPS)

If running on EC2 or a VPS, use systemd:

```ini
# /etc/systemd/system/polybot.service
[Unit]
Description=PolyBot Trading Bot
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/polybot
ExecStart=/usr/bin/python3 -m src.bot_runner
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable:
```bash
sudo systemctl enable polybot
sudo systemctl start polybot
```

---

## 7. Monitoring Dashboard Checklist

| Service | URL | Expected Status |
|---------|-----|-----------------|
| Bot Health | `/health` | 200 OK |
| Bot Status | `/status` | `"status":"running"` |
| Admin UI | polyparlay.io | 200 OK |
| Supabase Heartbeat | polybot_heartbeat table | Updated < 5 min ago |

---

## Quick Setup (5 Minutes)

1. Go to [uptimerobot.com](https://uptimerobot.com)
2. Sign up (free)
3. Add these 3 monitors:
   - `https://polyparlay.p3ww4fvp9w2se.us-east-1.cs.amazonlightsail.com/health`
   - `https://polyparlay.p3ww4fvp9w2se.us-east-1.cs.amazonlightsail.com/status`
   - `https://polyparlay.io`
4. Add your email as alert contact
5. Done! You'll get emails if anything goes down.

---

*Last updated: January 2025*
