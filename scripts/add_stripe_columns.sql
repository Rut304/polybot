-- Add Stripe columns to polybot_profiles table
-- These are required for subscription management

-- Add stripe_customer_id column (Stripe customer ID like "cus_xxx")
ALTER TABLE polybot_profiles 
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Add stripe_subscription_id column (Stripe subscription ID like "sub_xxx")
ALTER TABLE polybot_profiles 
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer 
ON polybot_profiles(stripe_customer_id);

-- Verify columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'polybot_profiles' 
AND column_name LIKE 'stripe%';
