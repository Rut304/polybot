#!/bin/bash

# Script to create a readonly user via Supabase
# This requires the SUPABASE_SERVICE_ROLE_KEY to be set

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables"
    echo ""
    echo "You can get these from your Supabase Dashboard:"
    echo "1. Go to Settings > API"
    echo "2. Copy the Project URL for SUPABASE_URL"
    echo "3. Copy the service_role key for SUPABASE_SERVICE_ROLE_KEY"
    echo ""
    echo "Then run:"
    echo "  export SUPABASE_URL='your-url'"
    echo "  export SUPABASE_SERVICE_ROLE_KEY='your-key'"
    echo "  ./scripts/create_readonly_user.sh"
    exit 1
fi

EMAIL="readonly@polybot.local"
PASSWORD="readonly"

echo "Creating readonly user..."

# Create the user via Supabase Auth Admin API
RESPONSE=$(curl -s -X POST "$SUPABASE_URL/auth/v1/admin/users" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"password\": \"$PASSWORD\",
    \"email_confirm\": true,
    \"user_metadata\": {
      \"role\": \"readonly\"
    }
  }")

# Extract user ID
USER_ID=$(echo $RESPONSE | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//')

if [ -z "$USER_ID" ]; then
    echo "Error creating user:"
    echo $RESPONSE
    exit 1
fi

echo "User created with ID: $USER_ID"

# Create user profile entry
echo "Creating user profile..."
curl -s -X POST "$SUPABASE_URL/rest/v1/polybot_user_profiles" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d "{
    \"id\": \"$USER_ID\",
    \"username\": \"readonly\",
    \"role\": \"readonly\"
  }"

echo ""
echo "✅ Readonly user created successfully!"
echo ""
echo "Login credentials:"
echo "  Email: $EMAIL"
echo "  Password: $PASSWORD"
echo ""
echo "Note: You can also login with just 'readonly' as the email"
echo "if your Supabase is configured to allow it."
