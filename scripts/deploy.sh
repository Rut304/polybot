#!/bin/bash
# =============================================================================
# PolyBot Deployment Script - THE ONLY WAY TO DEPLOY
# =============================================================================
#
# ⚠️  CRITICAL: ALWAYS USE THIS SCRIPT FOR DEPLOYMENTS!
#
# NEVER run manual AWS CLI deployments like:
#   aws lightsail create-container-service-deployment --cli-input-json ...
#
# Manual deployments have caused production outages by:
#   1. Deploying with EMPTY environment variables
#   2. Using wrong Supabase keys (anon vs service_role)
#   3. Missing required secrets
#
# This script:
#   ✓ Reads secrets from .env (source of truth)
#   ✓ Validates all required variables exist
#   ✓ Only uses SUPABASE_SERVICE_ROLE_KEY (never anon key)
#   ✓ Creates backups before deployment
#   ✓ Tracks version numbers automatically
#
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SERVICE_NAME="polyparlay"

# CRITICAL: Always use the same region - read from .aws-region file
REGION_FILE="$PROJECT_ROOT/.aws-region"
if [ -f "$REGION_FILE" ]; then
    REGION=$(cat "$REGION_FILE" | tr -d '[:space:]')
else
    REGION="us-east-1"
    echo "$REGION" > "$REGION_FILE"
fi

# Verify the service exists in the specified region BEFORE proceeding
echo -e "${YELLOW}Verifying service exists in $REGION...${NC}"
SERVICE_CHECK=$(aws lightsail get-container-services --service-name "$SERVICE_NAME" --region "$REGION" 2>&1)
if echo "$SERVICE_CHECK" | grep -q "NotFoundException\|does not exist"; then
    echo -e "${RED}ERROR: Service '$SERVICE_NAME' not found in region '$REGION'!${NC}"
    echo "  Available services:"
    aws lightsail get-container-services --query 'containerServices[*].{name:containerServiceName,region:location.regionName}' --output table
    echo ""
    echo "  If moving regions, update $REGION_FILE with the correct region."
    exit 1
fi
echo -e "  ✓ Service verified in ${GREEN}$REGION${NC}"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  PolyBot Deployment Script${NC}"
echo -e "${GREEN}========================================${NC}"

# Step 1: Pre-flight checks
echo -e "\n${YELLOW}[1/7] Pre-flight checks...${NC}"

# Check required files exist
for file in VERSION BUILD Dockerfile requirements.txt; do
    if [ ! -f "$PROJECT_ROOT/$file" ]; then
        echo -e "${RED}ERROR: Missing required file: $file${NC}"
        exit 1
    fi
done
echo "  ✓ All required files present"

# Check src directory
if [ ! -d "$PROJECT_ROOT/src" ]; then
    echo -e "${RED}ERROR: src directory not found${NC}"
    exit 1
fi
echo "  ✓ src directory exists"

# Step 2: Get current version info
echo -e "\n${YELLOW}[2/7] Version info...${NC}"
VERSION=$(cat "$PROJECT_ROOT/VERSION")
BUILD=$(cat "$PROJECT_ROOT/BUILD")
echo "  Version: $VERSION"
echo "  Build: $BUILD"

# Step 3: Increment build number
echo -e "\n${YELLOW}[3/7] Incrementing build number...${NC}"
NEW_BUILD=$((BUILD + 1))
echo "$NEW_BUILD" > "$PROJECT_ROOT/BUILD"
echo "  New build: $NEW_BUILD"

# Step 4: Build Docker image
echo -e "\n${YELLOW}[4/7] Building Docker image (linux/amd64)...${NC}"
IMAGE_TAG="polybot:v${VERSION}-b${NEW_BUILD}"
cd "$PROJECT_ROOT"

# Verify Dockerfile copies VERSION and BUILD
if ! grep -q "COPY VERSION" Dockerfile; then
    echo -e "${RED}ERROR: Dockerfile doesn't copy VERSION file${NC}"
    exit 1
fi
if ! grep -q "COPY BUILD" Dockerfile; then
    echo -e "${RED}ERROR: Dockerfile doesn't copy BUILD file${NC}"
    exit 1
fi
echo "  ✓ Dockerfile includes VERSION and BUILD files"

# IMPORTANT: Use --no-cache to prevent stale dependency layers
# This ensures all pip packages are freshly installed each build
docker buildx build --platform linux/amd64 --no-cache -t "$IMAGE_TAG" --load .
echo "  ✓ Docker image built: $IMAGE_TAG"

# Step 5: Push to Lightsail
echo -e "\n${YELLOW}[5/7] Pushing image to Lightsail...${NC}"
# Sanitize version for Lightsail label (must satisfy regex: ^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$)
CLEAN_VERSION=$(echo "$VERSION" | tr '.' '-')
PUSH_RESULT=$(aws lightsail push-container-image \
    --service-name "$SERVICE_NAME" \
    --label "v${CLEAN_VERSION}-b${NEW_BUILD}" \
    --image "$IMAGE_TAG" \
    --region "$REGION" 2>&1)

# Extract the image reference
# Extract the image reference
# Try to extract from the "Refer to this image as" line first (standard AWS CLI output)
IMAGE_REF=$(echo "$PUSH_RESULT" | grep 'Refer to this image as' | cut -d'"' -f2)

# Fallback to regex if specific line missing (but use valid regex for new format)
if [ -z "$IMAGE_REF" ]; then
    IMAGE_REF=$(echo "$PUSH_RESULT" | grep -o ":$SERVICE_NAME\.[a-zA-Z0-9.-]*" | head -1)
fi

if [ -z "$IMAGE_REF" ]; then
    echo -e "${RED}ERROR: Failed to extract image reference from push${NC}"
    echo "$PUSH_RESULT"
    exit 1
fi
echo "  ✓ Image pushed: $IMAGE_REF"

# Step 6: Build environment variables from LOCAL .env (SOURCE OF TRUTH)
echo -e "\n${YELLOW}[6/7] Preparing deployment config...${NC}"

# ====================================================================================
# CRITICAL FIX: Always build environment from local .env file as SOURCE OF TRUTH
# This prevents secrets loss when a bad deployment corrupts the Lightsail environment
# ====================================================================================

ENV_FILE="$PROJECT_ROOT/.env"
SECRETS_BACKUP="$PROJECT_ROOT/.env.lightsail"

if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}ERROR: .env file not found at $ENV_FILE${NC}"
    echo "  The .env file is the source of truth for deployment secrets."
    echo "  Create it with: cp .env.example .env && edit with your secrets"
    exit 1
fi

echo "  Reading secrets from local .env file (source of truth)..."

# Required secrets that MUST exist
REQUIRED_SECRETS=(
    "SUPABASE_URL"
    "SUPABASE_SERVICE_ROLE_KEY"
    "POLYMARKET_API_KEY"
    "POLYMARKET_SECRET"
    "KALSHI_API_KEY"
    "IBKR_USERNAME"
    "IBKR_PASSWORD"

)

# Optional secrets to include if present
OPTIONAL_SECRETS=(
    "KALSHI_PRIVATE_KEY_PATH"
    "DISCORD_WEBHOOK"
    "IBKR_TRADING_MODE"

)

# Build JSON environment from .env file
build_env_json() {
    local json="{"
    local first=true
    
    # Always include these deployment metadata
    json="$json\"BOT_VERSION\":\"$VERSION\""
    json="$json,\"BUILD_NUMBER\":\"$NEW_BUILD\""
    json="$json,\"LOG_LEVEL\":\"INFO\""
    json="$json,\"SIMULATION_MODE\":\"true\""
    
    # Read and add required secrets
    for key in "${REQUIRED_SECRETS[@]}"; do
        value=$(grep "^${key}=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d'=' -f2-)
        if [ -z "$value" ]; then
            echo -e "${RED}ERROR: Required secret $key not found in .env${NC}"
            return 1
        fi
        # Escape quotes in value
        value=$(echo "$value" | sed 's/"/\\"/g')
        json="$json,\"$key\":\"$value\""
    done
    
    # Read and add optional secrets if they exist
    for key in "${OPTIONAL_SECRETS[@]}"; do
        value=$(grep "^${key}=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d'=' -f2-)
        if [ -n "$value" ]; then
            value=$(echo "$value" | sed 's/"/\\"/g')
            json="$json,\"$key\":\"$value\""
        fi
    done
    
    json="$json}"
    echo "$json"
}

# Build the environment JSON
CURRENT_ENV=$(build_env_json)
if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to build environment from .env file${NC}"
    exit 1
fi

# Validate we got actual content
if [ -z "$CURRENT_ENV" ] || [ "$CURRENT_ENV" == "{}" ]; then
    echo -e "${RED}ERROR: Failed to build environment variables${NC}"
    exit 1
fi

# Create a backup of what we're deploying (for recovery)
echo "$CURRENT_ENV" | python3 -c "import sys,json; d=json.load(sys.stdin); print('\n'.join(f'{k}={v}' for k,v in d.items()))" > "$SECRETS_BACKUP" 2>/dev/null
echo "  ✓ Backup saved to .env.lightsail"

# Count secrets
SECRET_COUNT=$(echo "$CURRENT_ENV" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "?")
echo -e "  ${GREEN}✓ Environment built with $SECRET_COUNT variables from local .env${NC}"

# Final validation
if ! echo "$CURRENT_ENV" | grep -q "SUPABASE_URL"; then
    echo -e "${RED}FATAL: SUPABASE_URL missing after build - this should never happen${NC}"
    exit 1
fi
if ! echo "$CURRENT_ENV" | grep -q "SUPABASE_SERVICE_ROLE_KEY"; then
    echo -e "${RED}FATAL: SUPABASE_SERVICE_ROLE_KEY missing after build - this should never happen${NC}"
    exit 1
fi

echo "  ✓ All required secrets validated"

# Helper to read secret for sidecar container
read_secret() {
    grep "^$1=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d'=' -f2-
}

IBKR_USER=$(read_secret "IBKR_USERNAME")
IBKR_PASS=$(read_secret "IBKR_PASSWORD")
IBKR_MODE=$(read_secret "IBKR_TRADING_MODE")

# Create deployment config
DEPLOY_CONFIG=$(cat <<EOF
{
    "serviceName": "$SERVICE_NAME",
    "containers": {
        "polybot": {
            "image": "$IMAGE_REF",
            "command": [],
            "environment": $CURRENT_ENV,
            "ports": {
                "8080": "HTTP"
            }
        },
        "ib-gateway": {
            "image": "ghcr.io/extralabs/ib-gateway:latest",
            "environment": {
                "TWS_USERID": "$IBKR_USER",
                "TWS_PASSWORD": "$IBKR_PASS",
                "TRADING_MODE": "${IBKR_MODE:-paper}",
                "VNC_SERVER_PASSWORD": "password",
                "TWOFA_TIMEOUT_ACTION": "exit"
            },
            "ports": {
                "4001": "TCP",
                "4002": "TCP"
            }
        }
    },
    "publicEndpoint": {
        "containerName": "polybot",
        "containerPort": 8080,
        "healthCheck": {
            "healthyThreshold": 2,
            "unhealthyThreshold": 3,
            "timeoutSeconds": 10,
            "intervalSeconds": 30,
            "path": "/health",
            "successCodes": "200-499"
        }
    }
}
EOF
)

# Save config for reference
echo "$DEPLOY_CONFIG" > /tmp/polybot-deploy.json
echo "  ✓ Deployment config saved to /tmp/polybot-deploy.json"

# Step 7: Deploy
echo -e "\n${YELLOW}[7/7] Deploying to Lightsail...${NC}"
DEPLOY_RESULT=$(aws lightsail create-container-service-deployment \
    --cli-input-json file:///tmp/polybot-deploy.json \
    --region "$REGION" \
    --query 'containerService.nextDeployment.{version:version,state:state}' \
    --output json 2>&1)

echo "$DEPLOY_RESULT"

# Get deployment version
DEPLOY_VERSION=$(echo "$DEPLOY_RESULT" | grep -o '"version": [0-9]*' | grep -o '[0-9]*')

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}  Deployment initiated!${NC}"
echo -e "${GREEN}========================================${NC}"
echo "  Image: $IMAGE_REF"
echo "  Version: v$VERSION (Build #$NEW_BUILD)"
echo "  Lightsail version: v$DEPLOY_VERSION"
echo ""
echo -e "${YELLOW}Monitor deployment:${NC}"
echo "  aws lightsail get-container-services --service-name $SERVICE_NAME --region $REGION --query 'containerServices[0].{state:state,currentVersion:currentDeployment.version}'"
echo ""
echo -e "${YELLOW}Check bot status:${NC}"
echo "  curl -s https://polyparlay.p3ww4fvp9w2se.us-east-1.cs.amazonlightsail.com/status | jq"

# Commit the build number change
cd "$PROJECT_ROOT"
git add BUILD
git commit -m "Bump build to $NEW_BUILD for deployment v$DEPLOY_VERSION" --no-verify 2>/dev/null || true

echo -e "\n${GREEN}Done!${NC}"
