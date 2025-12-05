# AWS Cost Analysis - December 4, 2025

## 🚨 ALERT: High Daily Costs Detected

### Current Daily Spending (Last 24 Hours)

| Service | Daily Cost | Monthly Est. | Notes |
|---------|------------|--------------|-------|
| **ECS (Fargate)** | **$54.84** | **$1,645** | ⚠️ MAIN COST DRIVER |
| ECR | $2.04 | $61 | Image storage |
| VPC | $2.23 | $67 | NAT Gateway likely |
| ELB | $1.08 | $32 | Load balancer |
| Secrets Manager | $0.22 | $7 | Secret storage |
| Lightsail | $0.23 | $7 | Legacy resource? |
| S3 | $0.02 | $0.50 | Minimal |
| **TOTAL** | **~$60.66** | **~$1,820** | |

---

## 🏗️ Architecture: What Goes Where

### Vercel (FREE) - Frontend Only

| ✅ Can Handle | ❌ Cannot Handle |
|--------------|-----------------|
| Admin UI dashboard | Long-running processes |
| Static pages | WebSocket connections |
| API routes (read data) | Continuous scanning |
| User authentication | Trade execution |
| Serverless functions (<60s) | 24/7 monitoring |

### Backend Compute Options Comparison

| Option | Monthly Cost | Pros | Cons |
|--------|-------------|------|------|
| **ECS Fargate** (current) | $75-150 | Serverless, auto-scaling | Most expensive |
| **Lightsail Container** | $7-25 | Simple, predictable | Limited scaling |
| **EC2 t4g.nano** (ARM) | $3-4 | Cheapest AWS | Manual management |
| **EC2 t3.micro** | $8-10 | Free tier eligible | x86, slightly more |
| **Lambda + EventBridge** | $5-15 | Pay per use | Cold starts, complexity |
| **Railway.app** | $5-20 | Easy deploys | Not AWS |
| **Fly.io** | $0-10 | Free tier, global | Not AWS |
| **Render** | $7-25 | Simple | Not AWS |

---

## ECS Analysis

### Current Running Services

#### us-east-1 (video-render-cluster)

| Service | Running | CPU | Memory | Est. Daily Cost |
|---------|---------|-----|--------|-----------------|
| polybot-service | 1 task | 0.25 vCPU | 512 MB | ~$2.50 |
| polyparlay-service | 0 tasks | - | - | $0 |

#### us-east-2 (video-render-cluster)

| Service | Running | CPU | Memory | Est. Daily Cost |
|---------|---------|-----|--------|-----------------|
| admin-ui | 1 task | 1 vCPU | 2 GB | ~$25 |
| video-render-cluster | 1 task | 1 vCPU | 2 GB | ~$25 |

### 🔍 Root Cause: Over-provisioned Tasks

The **admin-ui** and **video-render-cluster** services are using:

- 1 vCPU + 2GB RAM each = ~$50/day combined
- These are likely development/test services left running

---

## 💡 Cost Optimization Recommendations

### Immediate Actions (Save ~$45/day = $1,350/month)

#### 1. Stop Unused Services

```bash
# Stop video-render-cluster if not needed
aws ecs update-service --cluster video-render-cluster --service video-render-cluster --desired-count 0 --region us-east-2

# Consider stopping admin-ui if you're using Vercel instead
aws ecs update-service --cluster video-render-cluster --service admin-ui --desired-count 0 --region us-east-2
```

#### 2. Right-size polybot-service

Current: 0.25 vCPU, 512 MB ($2.50/day)

- This is already minimal, keep as-is

#### 3. Move Admin UI to Vercel (FREE)

- You already have Vercel configured
- Vercel is free for hobby tier
- Push admin/ changes to GitHub → Auto-deploy

### Medium-term Actions

#### 4. Use ECS Spot Capacity (Save 70%)

- For non-critical workloads
- polybot can restart if interrupted

#### 5. Remove NAT Gateway ($2.23/day)

- If all services can use public subnets
- Or use VPC endpoints for AWS services

#### 6. Clean up ECR Images ($2.04/day)

```bash
# Delete old/unused images
aws ecr list-images --repository-name polybot --filter tagStatus=UNTAGGED
```

---

## Recommended Architecture

### Production (Minimal Cost ~$5/day = $150/month)

| Component | Solution | Cost |
|-----------|----------|------|
| Admin UI | Vercel (free tier) | $0 |
| PolyBot Backend | ECS Fargate (0.25 vCPU) | $2.50/day |
| Database | Supabase (free tier) | $0 |
| Secrets | AWS Secrets Manager | $0.20/day |
| DNS/CDN | CloudFlare (free) | $0 |

### Total: ~$3-5/day instead of $60/day

---

## Action Items

- [ ] Stop admin-ui on ECS (use Vercel instead)
- [ ] Stop video-render-cluster if unused
- [ ] Commit and push code changes
- [ ] Deploy to Vercel for admin UI
- [ ] Update polybot-service with new task definition
