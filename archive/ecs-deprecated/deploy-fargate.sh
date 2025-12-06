#!/bin/bash
# PolyBot Fargate Deployment Script
# Deploys the bot to AWS ECS Fargate for 24/7 operation

set -e

# Configuration
AWS_REGION="${AWS_REGION:-us-east-1}"
ECR_REPO="polybot"
ECS_CLUSTER="video-render-cluster"
ECS_SERVICE="polybot-service"
TASK_FAMILY="polybot-task"

echo "=========================================="
echo "PolyBot Fargate Deployment"
echo "=========================================="

# Get AWS Account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "AWS Account: $AWS_ACCOUNT_ID"
echo "Region: $AWS_REGION"
echo "Cluster: $ECS_CLUSTER"

# Login to ECR
echo ""
echo "Step 1: Logging into ECR..."
aws ecr get-login-password --region $AWS_REGION | \
    docker login --username AWS --password-stdin \
    $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Create ECR repository if it doesn't exist
echo ""
echo "Step 2: Ensuring ECR repository exists..."
aws ecr describe-repositories --repository-names $ECR_REPO --region $AWS_REGION 2>/dev/null || \
    aws ecr create-repository --repository-name $ECR_REPO --region $AWS_REGION

# Build Docker image
echo ""
echo "Step 3: Building Docker image..."
docker build -t $ECR_REPO:latest .

# Tag and push to ECR
echo ""
echo "Step 4: Pushing to ECR..."
docker tag $ECR_REPO:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO:latest
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO:latest

# Create CloudWatch log group if it doesn't exist
echo ""
echo "Step 5: Ensuring CloudWatch log group exists..."
aws logs create-log-group --log-group-name /ecs/polybot --region $AWS_REGION 2>/dev/null || true

# Substitute variables in task definition
echo ""
echo "Step 6: Registering task definition..."
sed "s/\${AWS_ACCOUNT_ID}/$AWS_ACCOUNT_ID/g" infra/ecs-task-definition.json > /tmp/task-def.json
aws ecs register-task-definition --cli-input-json file:///tmp/task-def.json --region $AWS_REGION

# Get the latest task definition ARN
TASK_DEF_ARN=$(aws ecs describe-task-definition --task-definition $TASK_FAMILY \
    --query 'taskDefinition.taskDefinitionArn' --output text --region $AWS_REGION)
echo "Task Definition: $TASK_DEF_ARN"

# Check if service exists
SERVICE_EXISTS=$(aws ecs describe-services --cluster $ECS_CLUSTER --services $ECS_SERVICE \
    --query 'services[0].status' --output text --region $AWS_REGION 2>/dev/null || echo "MISSING")

if [ "$SERVICE_EXISTS" == "ACTIVE" ]; then
    echo ""
    echo "Step 7: Updating existing service..."
    aws ecs update-service \
        --cluster $ECS_CLUSTER \
        --service $ECS_SERVICE \
        --task-definition $TASK_DEF_ARN \
        --force-new-deployment \
        --region $AWS_REGION
else
    echo ""
    echo "Step 7: Creating new service..."
    
    # Get default VPC and subnets
    VPC_ID=$(aws ec2 describe-vpcs --filters "Name=isDefault,Values=true" \
        --query 'Vpcs[0].VpcId' --output text --region $AWS_REGION)
    
    SUBNETS=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" \
        --query 'Subnets[*].SubnetId' --output text --region $AWS_REGION | tr '\t' ',')
    
    # Get or create security group
    SG_ID=$(aws ec2 describe-security-groups --filters "Name=group-name,Values=polybot-sg" \
        --query 'SecurityGroups[0].GroupId' --output text --region $AWS_REGION 2>/dev/null || echo "")
    
    if [ -z "$SG_ID" ] || [ "$SG_ID" == "None" ]; then
        SG_ID=$(aws ec2 create-security-group \
            --group-name polybot-sg \
            --description "Security group for PolyBot" \
            --vpc-id $VPC_ID \
            --query 'GroupId' --output text --region $AWS_REGION)
        
        # Allow outbound traffic
        aws ec2 authorize-security-group-egress \
            --group-id $SG_ID \
            --protocol all \
            --cidr 0.0.0.0/0 \
            --region $AWS_REGION 2>/dev/null || true
    fi
    
    aws ecs create-service \
        --cluster $ECS_CLUSTER \
        --service-name $ECS_SERVICE \
        --task-definition $TASK_DEF_ARN \
        --desired-count 1 \
        --launch-type FARGATE \
        --network-configuration "awsvpcConfiguration={subnets=[$SUBNETS],securityGroups=[$SG_ID],assignPublicIp=ENABLED}" \
        --region $AWS_REGION
fi

echo ""
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo ""
echo "Monitor with:"
echo "  aws ecs describe-services --cluster $ECS_CLUSTER --services $ECS_SERVICE --region $AWS_REGION"
echo ""
echo "View logs:"
echo "  aws logs tail /ecs/polybot --follow --region $AWS_REGION"
echo ""
echo "Stop service:"
echo "  aws ecs update-service --cluster $ECS_CLUSTER --service $ECS_SERVICE --desired-count 0 --region $AWS_REGION"
