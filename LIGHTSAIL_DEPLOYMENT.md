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
SUPABASE_KEY=your-anon-key

# Optional: Override defaults
DRY_RUN=true
LOG_LEVEL=INFO
EOF
```

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
