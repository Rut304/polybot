# PolyBot Lightsail Deployment Guide

## Overview

PolyBot runs on **AWS Lightsail** for cost-effective 24/7 operation. This guide covers deployment, monitoring, and management.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        AWS Lightsail                         │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Lightsail Instance                        │  │
│  │  • Ubuntu 22.04 LTS                                   │  │
│  │  • 1 GB RAM / 1 vCPU ($5/month)                       │  │
│  │  • Docker + Docker Compose                            │  │
│  │                                                        │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │            Docker Container                      │  │  │
│  │  │  • Python 3.11                                   │  │  │
│  │  │  • PolyBot trading bot                          │  │  │
│  │  │  • Auto-restarts on failure                     │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │         Supabase              │
              │  • polybot_* tables           │
              │  • Configuration              │
              │  • Trade history              │
              └───────────────────────────────┘
```

---

## Why Lightsail over ECS?

| Factor | Lightsail | ECS Fargate |
|--------|-----------|-------------|
| **Cost** | $5-10/month | $50-75/month |
| **Complexity** | Simple SSH access | Complex task definitions |
| **Scaling** | Manual | Auto-scaling |
| **Best For** | Single bot, simple needs | Multi-container, high availability |

**Decision:** PolyBot is a single Python process that doesn't need auto-scaling. Lightsail is 10x cheaper.

---

## Initial Setup (One-Time)

### 1. Create Lightsail Instance

```bash
# Via AWS Console:
# 1. Go to Lightsail Console
# 2. Create Instance → Linux/Unix → Ubuntu 22.04 LTS
# 3. Select $5/month plan (1 GB RAM, 1 vCPU)
# 4. Name: "polybot"
# 5. Create instance
```

### 2. Configure SSH Access

```bash
# Download the default Lightsail key or upload your own
# Connect via:
ssh -i ~/path/to/key.pem ubuntu@<LIGHTSAIL_IP>
```

### 3. Install Docker on Lightsail

```bash
# On the Lightsail instance:
sudo apt update
sudo apt install -y docker.io docker-compose

# Add user to docker group
sudo usermod -aG docker ubuntu
newgrp docker

# Verify
docker --version
docker-compose --version
```

### 4. Clone Repository

```bash
cd ~
git clone https://github.com/YOUR_USERNAME/polybot.git
cd polybot
```

### 5. Configure Environment

```bash
# Create .env file with Supabase credentials
cat > .env << 'EOF'
# Supabase (required)
SUPABASE_URL=https://your-project.supabase.co
# IMPORTANT: Use the SERVICE ROLE key, NOT the anon key!
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional: Override defaults
DRY_RUN=true
LOG_LEVEL=INFO
EOF
```

> ⚠️ **CRITICAL**: Use `SUPABASE_SERVICE_ROLE_KEY` (not `SUPABASE_KEY`). The anon key has RLS restrictions that will cause database writes to fail silently!

---

## Deployment Commands

### Build and Start

```bash
# SSH into Lightsail
ssh -i ~/path/to/key.pem ubuntu@<LIGHTSAIL_IP>

# Navigate to project
cd ~/polybot

# Pull latest changes
git pull origin main

# Build and start (detached)
docker-compose up -d --build

# View logs
docker-compose logs -f
```

### Stop Bot

```bash
docker-compose down
```

### Restart Bot

```bash
docker-compose restart
```

### View Status

```bash
docker-compose ps
docker stats
```

---

## Docker Compose Configuration

Create `docker-compose.yml` if not exists:

```yaml
version: '3.8'

services:
  polybot:
    build: .
    container_name: polybot
    restart: unless-stopped
    env_file:
      - .env
    volumes:
      - ./logs:/app/logs
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
```

---

## Monitoring

### Check Bot Health

```bash
# View recent logs
docker-compose logs --tail=100

# Check if container is running
docker ps | grep polybot

# View resource usage
docker stats polybot
```

### Database Health Check

The bot writes heartbeats to `polybot_status` table. Check in Supabase:

```sql
SELECT * FROM polybot_status ORDER BY updated_at DESC LIMIT 1;
```

If `last_heartbeat_at` is more than 5 minutes old, the bot may be down.

---

## Updating the Bot

### Manual Update

```bash
ssh -i ~/path/to/key.pem ubuntu@<LIGHTSAIL_IP>
cd ~/polybot
git pull origin main
docker-compose up -d --build
```

### Automated Updates (Optional)

Set up a cron job to auto-pull and rebuild:

```bash
# Edit crontab
crontab -e

# Add (checks every 15 minutes for updates)
*/15 * * * * cd ~/polybot && git pull origin main && docker-compose up -d --build >> ~/polybot-update.log 2>&1
```

---

## Troubleshooting

### Bot Not Starting

```bash
# Check container logs
docker-compose logs polybot

# Check if port conflicts
docker ps -a

# Rebuild from scratch
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Out of Memory

The $5 Lightsail plan has 1GB RAM. If the bot crashes due to OOM:

```bash
# Check memory usage
free -h

# Consider upgrading to $10 plan (2GB RAM)
# Or optimize the bot's memory usage
```

### SSH Connection Issues

```bash
# Ensure Lightsail firewall allows SSH (port 22)
# Check in Lightsail Console → Networking → IPv4 Firewall

# Verify your IP hasn't changed
curl ifconfig.me
```

---

## Cost Summary

| Resource | Monthly Cost |
|----------|--------------|
| Lightsail Instance (1GB) | $5.00 |
| Supabase (Free tier) | $0.00 |
| **Total** | **$5.00** |

Compare to ECS: ~$50-75/month

---

## ⚠️ CRITICAL: Deployment Rules

### ALWAYS use the deploy script

```bash
# THE ONLY WAY TO DEPLOY:
./scripts/deploy.sh
```

### NEVER run manual AWS CLI deployments

```bash
# ❌ NEVER DO THIS - it has caused production outages!
aws lightsail create-container-service-deployment --cli-input-json file://some-file.json
```

### Why?

Manual deployments have caused production outages by:
1. **Empty environment variables** - Forgetting to include secrets in the JSON
2. **Wrong Supabase key** - Using `SUPABASE_KEY` (anon) instead of `SUPABASE_SERVICE_ROLE_KEY`
3. **Missing required secrets** - Bot runs but can't write to database

### Validate a deployment

```bash
# Check current deployment health
./scripts/validate-deployment.sh

# Validate a deployment JSON before using it
./scripts/validate-deployment.sh /path/to/deployment.json
```

---

## Troubleshooting

### "DB not available for stats: db=True, is_connected=False"

**Cause**: The bot has Supabase URL but can't connect. Usually means:
1. Missing `SUPABASE_SERVICE_ROLE_KEY` environment variable
2. Using wrong key (anon key instead of service role key)

**Fix**:
```bash
# Check current deployment has the right key
aws lightsail get-container-services --service-name polyparlay --region us-east-1 \
    --query 'containerServices[0].currentDeployment.containers.polybot.environment' | grep SUPABASE

# If SUPABASE_SERVICE_ROLE_KEY is missing, redeploy:
./scripts/deploy.sh
```

### Bot running but no trades recorded

**Cause**: Same as above - database writes fail silently when using anon key

**Fix**: Ensure `.env` has `SUPABASE_SERVICE_ROLE_KEY` (from Supabase Dashboard > Settings > API > service_role key)

---

## Security Best Practices

1. **Never commit `.env` files** - Contains secrets
2. **Use Supabase for secrets** - Admin UI reads from `polybot_secrets` table
3. **Keep Lightsail firewall minimal** - Only allow SSH (port 22)
4. **Rotate API keys regularly** - Update via Admin UI

---

## Quick Reference

```bash
# SSH into Lightsail
ssh -i ~/path/to/key.pem ubuntu@<LIGHTSAIL_IP>

# Start bot
docker-compose up -d

# Stop bot
docker-compose down

# View logs
docker-compose logs -f

# Rebuild after code changes
git pull && docker-compose up -d --build

# Check status
docker ps
```

---

*Last Updated: December 2025*
