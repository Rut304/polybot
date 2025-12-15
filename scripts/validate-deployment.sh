#!/bin/bash
# =============================================================================
# DEPLOYMENT VALIDATOR
# =============================================================================
# This script validates that a deployment JSON file has all required secrets
# before allowing a deployment. Use this to prevent empty-env deployments.
#
# Usage: ./scripts/validate-deployment.sh [deployment.json]
#
# NEVER deploy manually! Always use: ./scripts/deploy.sh
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Required environment variables that MUST exist in any deployment
REQUIRED_VARS=(
    "SUPABASE_URL"
    "SUPABASE_SERVICE_ROLE_KEY"
    "POLYMARKET_API_KEY"
    "POLYMARKET_SECRET"
    "KALSHI_API_KEY"
)

# If a JSON file is provided, validate it
if [ -n "$1" ]; then
    JSON_FILE="$1"
    
    if [ ! -f "$JSON_FILE" ]; then
        echo -e "${RED}ERROR: File not found: $JSON_FILE${NC}"
        exit 1
    fi
    
    echo -e "${YELLOW}Validating deployment JSON: $JSON_FILE${NC}"
    
    # Check if environment object exists and is not empty
    ENV_COUNT=$(jq '.containers.polybot.environment | length' "$JSON_FILE" 2>/dev/null || echo "0")
    
    if [ "$ENV_COUNT" -eq 0 ]; then
        echo -e "${RED}╔═══════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${RED}║  CRITICAL ERROR: EMPTY ENVIRONMENT VARIABLES!                 ║${NC}"
        echo -e "${RED}║                                                               ║${NC}"
        echo -e "${RED}║  This deployment JSON has NO environment variables.           ║${NC}"
        echo -e "${RED}║  Deploying this would break the production bot!               ║${NC}"
        echo -e "${RED}║                                                               ║${NC}"
        echo -e "${RED}║  ALWAYS use: ./scripts/deploy.sh                              ║${NC}"
        echo -e "${RED}╚═══════════════════════════════════════════════════════════════╝${NC}"
        exit 1
    fi
    
    echo "  Found $ENV_COUNT environment variables"
    
    # Check each required variable
    MISSING=()
    for var in "${REQUIRED_VARS[@]}"; do
        VALUE=$(jq -r ".containers.polybot.environment.${var} // empty" "$JSON_FILE")
        if [ -z "$VALUE" ]; then
            MISSING+=("$var")
        else
            # Mask the value for display
            MASKED="${VALUE:0:8}..."
            echo -e "  ✓ $var = $MASKED"
        fi
    done
    
    if [ ${#MISSING[@]} -gt 0 ]; then
        echo -e "${RED}╔═══════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${RED}║  ERROR: Missing required environment variables!               ║${NC}"
        echo -e "${RED}╚═══════════════════════════════════════════════════════════════╝${NC}"
        for var in "${MISSING[@]}"; do
            echo -e "  ${RED}✗ Missing: $var${NC}"
        done
        echo ""
        echo -e "${YELLOW}ALWAYS use: ./scripts/deploy.sh${NC}"
        exit 1
    fi
    
    # Check for deprecated SUPABASE_KEY (should NOT be present)
    ANON_KEY=$(jq -r '.containers.polybot.environment.SUPABASE_KEY // empty' "$JSON_FILE")
    if [ -n "$ANON_KEY" ]; then
        echo -e "${YELLOW}⚠ WARNING: SUPABASE_KEY (anon key) is deprecated${NC}"
        echo -e "  Use only SUPABASE_SERVICE_ROLE_KEY for database access"
    fi
    
    echo -e "${GREEN}✓ Deployment JSON validated successfully${NC}"
    exit 0
fi

# If no JSON file, validate current Lightsail deployment
echo -e "${YELLOW}Checking current Lightsail deployment...${NC}"

REGION="us-east-1"
SERVICE="polyparlay"

DEPLOYMENT=$(aws lightsail get-container-services --service-name "$SERVICE" --region "$REGION" \
    --query 'containerServices[0].currentDeployment' --output json 2>/dev/null)

if [ -z "$DEPLOYMENT" ] || [ "$DEPLOYMENT" = "null" ]; then
    echo -e "${RED}ERROR: Could not fetch current deployment${NC}"
    exit 1
fi

VERSION=$(echo "$DEPLOYMENT" | jq -r '.version')
STATE=$(echo "$DEPLOYMENT" | jq -r '.state')
ENV_COUNT=$(echo "$DEPLOYMENT" | jq '.containers.polybot.environment | length')

echo "  Version: $VERSION"
echo "  State: $STATE"
echo "  Env Vars: $ENV_COUNT"

# Check required vars in current deployment
MISSING=()
for var in "${REQUIRED_VARS[@]}"; do
    VALUE=$(echo "$DEPLOYMENT" | jq -r ".containers.polybot.environment.${var} // empty")
    if [ -z "$VALUE" ]; then
        MISSING+=("$var")
    else
        echo -e "  ✓ $var configured"
    fi
done

if [ ${#MISSING[@]} -gt 0 ]; then
    echo -e "${RED}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║  WARNING: Current deployment missing required variables!      ║${NC}"
    echo -e "${RED}╚═══════════════════════════════════════════════════════════════╝${NC}"
    for var in "${MISSING[@]}"; do
        echo -e "  ${RED}✗ Missing: $var${NC}"
    done
    echo ""
    echo -e "${YELLOW}Run ./scripts/deploy.sh to fix${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Current deployment looks healthy${NC}"
