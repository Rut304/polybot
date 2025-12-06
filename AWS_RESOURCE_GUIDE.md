# AWS Resource Allocation Guide

## Account: 250935838858 | Region: us-east-1

This document maps AWS resources to their respective projects. **DO NOT modify resources belonging to other projects.**

---

## 🎬 Video Automation

| Resource Type | Resource Name/ARN | Notes |
|--------------|-------------------|-------|
| **ECR Repository** | `amazon-video-renderer` | Docker images for video rendering |
| **ECS Task Definition** | `video-renderer` | Task definition for video jobs |
| **ECS Service** | *(none - uses one-off tasks)* | Runs as scheduled/triggered tasks |
| **Secrets Manager** | `app/config` | General app configuration |
| **ECS Cluster** | `video-render-cluster` | **SHARED** with all projects |

---

## 🎰 PolyParlay

| Resource Type | Resource Name/ARN | Notes |
|--------------|-------------------|-------|
| **ECR Repository** | `polyparlay` | Docker images for PolyParlay app |
| **ECS Task Definitions** | `polyparlay-app`, `admin-ui` | App and admin UI tasks |
| **ECS Service** | `polyparlay-service` | Running 24/7 in cluster |
| **Secrets Manager** | `polyparlay/production` | Production config |
| | `polyparlay/supabase-url` | Supabase connection |
| | `polyparlay/supabase-key` | Supabase API key |
| | `polyparlay/privy-app-id` | Privy authentication |
| | `polyparlay/privy-secret` | Privy secret |
| **ECS Cluster** | `video-render-cluster` | **SHARED** with all projects |
| **Supabase Tables** | `users`, `bets`, `predictions`, etc. | No `polybot_` prefix |

---

## 🤖 PolyBot

| Resource Type | Resource Name/ARN | Notes |
|--------------|-------------------|-------|
| **Lightsail Instance** | `polybot` | Ubuntu 22.04, 1GB RAM ($5/month) |
| **Docker Container** | `polybot` | Runs inside Lightsail instance |
| **Secrets Storage** | Supabase `polybot_secrets` | API keys stored in database |
| **Supabase Tables** | `polybot_*` prefix | `polybot_opportunities`, `polybot_trades`, `polybot_status`, `polybot_simulated_trades`, `polybot_simulation_stats`, `polybot_market_pairs`, `polybot_secrets` |

**Note:** PolyBot was migrated from ECS Fargate to Lightsail in December 2025 for cost savings ($5/month vs $50+/month).

---

## 🔗 Shared Resources

| Resource | Used By | Notes |
|----------|---------|-------|
| **ECS Cluster: `video-render-cluster`** | Video Automation, PolyParlay | Single cluster, multiple services |
| **IAM Role: `ecsTaskExecutionRole`** | Video Automation, PolyParlay | Standard ECS execution role |
| **VPC/Subnets** | All 3 projects | Default VPC networking |
| **Supabase Project** | PolyParlay + PolyBot | Same Supabase instance, different table prefixes |
| **Lightsail Instance: `polybot`** | PolyBot only | Dedicated instance for trading bot |

**Note:** PolyBot uses **Lightsail** instead of ECS for cost efficiency ($5/month vs $50+/month).

---

## ⚠️ Critical Rules

1. **ECR Repos are project-specific** - Never push to another project's repo
2. **Secrets are namespaced** - Use `projectname/` prefix (e.g., `polybot/`, `polyparlay/`)
3. **Supabase tables are prefixed** - PolyBot uses `polybot_*`, PolyParlay has no prefix
4. **Task definitions are project-specific** - Create new ones, don't modify others
5. **PolyBot runs on Lightsail** - Not ECS! See LIGHTSAIL_DEPLOYMENT.md

---

## 📋 Resource Naming Convention

```
ECR:        {project-name}
Secrets:    {project-name}/{secret-name}
Task Def:   {project-name}-task or {project-name}-app
Service:    {project-name}-service
Supabase:   {project_name}_{table} (with underscore for SQL)
CloudWatch: /ecs/{project-name}
```

---

## 🔐 Secrets Quick Reference

### Video Automation

- `app/config`

### PolyParlay  

- `polyparlay/production`
- `polyparlay/supabase-url`
- `polyparlay/supabase-key`
- `polyparlay/privy-app-id`
- `polyparlay/privy-secret`

### PolyBot

- `polybot/polymarket-api-key`
- `polybot/polymarket-secret`
- `polybot/kalshi-api-key`
- `polybot/kalshi-private-key`
- `polybot/supabase-url`
- `polybot/supabase-key`

---

*Last Updated: December 2025*
