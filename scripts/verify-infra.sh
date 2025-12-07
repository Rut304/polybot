#!/bin/bash
# PolyBot Infrastructure Verification Script
# Run this BEFORE any deployment or infrastructure changes

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
EXPECTED_REGION="us-east-1"
SERVICE_NAME="polyparlay"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  PolyBot Infrastructure Verification${NC}"
echo -e "${GREEN}========================================${NC}"

ERRORS=0

# Check 1: Verify .aws-region file
echo -e "\n${YELLOW}[1/5] Checking region configuration...${NC}"
REGION_FILE="$PROJECT_ROOT/.aws-region"
if [ -f "$REGION_FILE" ]; then
    CONFIGURED_REGION=$(cat "$REGION_FILE" | tr -d '[:space:]')
    if [ "$CONFIGURED_REGION" == "$EXPECTED_REGION" ]; then
        echo -e "  ✓ Region file: ${GREEN}$CONFIGURED_REGION${NC}"
    else
        echo -e "  ${RED}✗ Region mismatch! File says '$CONFIGURED_REGION', expected '$EXPECTED_REGION'${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "  ${RED}✗ .aws-region file missing!${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check 2: Verify only ONE service exists
echo -e "\n${YELLOW}[2/5] Checking for duplicate services...${NC}"
ALL_SERVICES=$(aws lightsail get-container-services --query 'containerServices[?containerServiceName==`polyparlay`].location.regionName' --output text 2>/dev/null || echo "ERROR")
SERVICE_COUNT=$(echo "$ALL_SERVICES" | wc -w | tr -d ' ')

if [ "$SERVICE_COUNT" == "1" ]; then
    echo -e "  ✓ Single service found in: ${GREEN}$ALL_SERVICES${NC}"
elif [ "$SERVICE_COUNT" == "0" ] || [ "$ALL_SERVICES" == "ERROR" ]; then
    echo -e "  ${RED}✗ No service found! May need to check AWS credentials.${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "  ${RED}✗ DANGER: Multiple services found in regions: $ALL_SERVICES${NC}"
    echo -e "  ${RED}  This can cause confusion and double billing!${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check 3: Verify service is in correct region
echo -e "\n${YELLOW}[3/5] Verifying service region...${NC}"
SERVICE_INFO=$(aws lightsail get-container-services --service-name "$SERVICE_NAME" --region "$EXPECTED_REGION" --query 'containerServices[0].{state:state,region:location.regionName}' --output json 2>/dev/null || echo '{"error": true}')

if echo "$SERVICE_INFO" | grep -q '"error"'; then
    echo -e "  ${RED}✗ Service not found in $EXPECTED_REGION${NC}"
    ERRORS=$((ERRORS + 1))
else
    STATE=$(echo "$SERVICE_INFO" | grep -o '"state": "[^"]*"' | cut -d'"' -f4)
    REGION=$(echo "$SERVICE_INFO" | grep -o '"region": "[^"]*"' | cut -d'"' -f4)
    echo -e "  ✓ Service in ${GREEN}$REGION${NC}, state: ${GREEN}$STATE${NC}"
fi

# Check 4: Verify current deployment
echo -e "\n${YELLOW}[4/5] Checking current deployment...${NC}"
DEPLOY_INFO=$(aws lightsail get-container-services --service-name "$SERVICE_NAME" --region "$EXPECTED_REGION" --query 'containerServices[0].{version:currentDeployment.version,image:currentDeployment.containers.polybot.image}' --output json 2>/dev/null || echo '{}')

VERSION=$(echo "$DEPLOY_INFO" | grep -o '"version": [0-9]*' | grep -o '[0-9]*' || echo "unknown")
IMAGE=$(echo "$DEPLOY_INFO" | grep -o '"image": "[^"]*"' | cut -d'"' -f4 || echo "unknown")
echo -e "  ✓ Current version: ${GREEN}v$VERSION${NC}"
echo -e "  ✓ Current image: ${GREEN}$IMAGE${NC}"

# Check 5: Verify health endpoint
echo -e "\n${YELLOW}[5/5] Checking service health...${NC}"
SERVICE_URL=$(aws lightsail get-container-services --service-name "$SERVICE_NAME" --region "$EXPECTED_REGION" --query 'containerServices[0].url' --output text 2>/dev/null)

if [ -n "$SERVICE_URL" ] && [ "$SERVICE_URL" != "None" ]; then
    HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${SERVICE_URL}health" --max-time 10 2>/dev/null || echo "000")
    if [ "$HEALTH_STATUS" == "200" ]; then
        echo -e "  ✓ Health check: ${GREEN}OK (HTTP $HEALTH_STATUS)${NC}"
    else
        echo -e "  ${YELLOW}⚠ Health check returned HTTP $HEALTH_STATUS${NC}"
    fi
    echo -e "  ✓ URL: ${GREEN}$SERVICE_URL${NC}"
else
    echo -e "  ${YELLOW}⚠ No public URL available (service may be deploying)${NC}"
fi

# Summary
echo -e "\n${GREEN}========================================${NC}"
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}  ✓ All checks passed!${NC}"
    echo -e "${GREEN}========================================${NC}"
    exit 0
else
    echo -e "${RED}  ✗ $ERRORS error(s) found!${NC}"
    echo -e "${RED}  Fix issues before deploying.${NC}"
    echo -e "${RED}========================================${NC}"
    exit 1
fi
