#!/bin/bash
# PolyBot Deployment Script
# This script ensures consistent, validated deployments to AWS Lightsail

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SERVICE_NAME="polyparlay"
REGION="us-east-1"

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

docker buildx build --platform linux/amd64 -t "$IMAGE_TAG" --load .
echo "  ✓ Docker image built: $IMAGE_TAG"

# Step 5: Push to Lightsail
echo -e "\n${YELLOW}[5/7] Pushing image to Lightsail...${NC}"
PUSH_RESULT=$(aws lightsail push-container-image \
    --service-name "$SERVICE_NAME" \
    --label "v${VERSION}-b${NEW_BUILD}" \
    --image "$IMAGE_TAG" \
    --region "$REGION" 2>&1)

# Extract the image reference
IMAGE_REF=$(echo "$PUSH_RESULT" | grep -o ":$SERVICE_NAME\.polybot\.[0-9]*" | head -1)
if [ -z "$IMAGE_REF" ]; then
    echo -e "${RED}ERROR: Failed to extract image reference from push${NC}"
    echo "$PUSH_RESULT"
    exit 1
fi
echo "  ✓ Image pushed: $IMAGE_REF"

# Step 6: Get current environment variables from running deployment
echo -e "\n${YELLOW}[6/7] Preparing deployment config...${NC}"

# Get current env vars
CURRENT_ENV=$(aws lightsail get-container-services \
    --service-name "$SERVICE_NAME" \
    --region "$REGION" \
    --query 'containerServices[0].currentDeployment.containers.polybot.environment' \
    --output json 2>/dev/null)

if [ "$CURRENT_ENV" == "null" ] || [ -z "$CURRENT_ENV" ] || [ "$CURRENT_ENV" == "{}" ]; then
    echo -e "${RED}WARNING: No environment variables found in current deployment!${NC}"
    echo "  Using default environment variables..."
    CURRENT_ENV='{
        "LOG_LEVEL": "INFO",
        "SIMULATION_MODE": "true"
    }'
fi

# Verify critical env vars
if ! echo "$CURRENT_ENV" | grep -q "SUPABASE_URL"; then
    echo -e "${RED}ERROR: SUPABASE_URL not found in environment!${NC}"
    echo "  Current env: $CURRENT_ENV"
    echo "  Please set environment variables manually in Lightsail console first."
    exit 1
fi
echo "  ✓ Environment variables validated"

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
