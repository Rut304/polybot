# PolyBot Infrastructure Configuration

# =====================================

# This file documents our production infrastructure

# NEVER change these values without understanding the impact

## AWS Lightsail Container Service

SERVICE_NAME=polyparlay
AWS_REGION=us-east-1
SERVICE_URL=<https://polyparlay.p3ww4fvp9w2se.us-east-1.cs.amazonlightsail.com/>

## Supabase Database

SUPABASE_PROJECT_REF=ytaltvltxkkfczlvjgad
SUPABASE_URL=<https://ytaltvltxkkfczlvjgad.supabase.co>
SUPABASE_REGION=us-east-1

## Critical Notes

# 1. ALWAYS specify --region us-east-1 in AWS CLI commands

# 2. NEVER create a new container service - always update the existing one

# 3. The .aws-region file in project root is the source of truth for region

# 4. Use scripts/deploy.sh for all deployments - it has safeguards

## Verification Commands

# Check service status

# aws lightsail get-container-services --service-name polyparlay --region us-east-1

#

# Check logs

# aws lightsail get-container-log --service-name polyparlay --container-name polybot --region us-east-1

#

# Check all services (should only be ONE)

# aws lightsail get-container-services --query 'containerServices[*].{name:containerServiceName,region:location.regionName}'

## Cost Information

# Nano instance: ~$7/month

# Data transfer: First 500GB free

# Estimated monthly cost: $7-15

## Disaster Recovery

# 1. Docker images are stored locally and can be rebuilt from source

# 2. All code is in Git (main branch)

# 3. Database is Supabase (managed, automatic backups)

# 4. Environment variables are documented in Supabase secrets table

## History

# - 2024-12: Service created in us-east-1

# - 2025-12-07: Added region safeguards after accidental duplicate creation
