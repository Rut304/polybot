-- Phase 5: Multi-Tenancy & Security Migration
-- Created at: 2025-12-16
-- Description: Adds user_id to core tables, enables RLS, and creates key vault.

-- 1. Enable UUID extension (dependency)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create User Key Vault (Secrets Management)
CREATE TABLE IF NOT EXISTS polybot_key_vault (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    key_name TEXT NOT NULL,
    encrypted_value TEXT NOT NULL,
    key_id UUID DEFAULT uuid_generate_v4(),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, key_name)
);

-- 3. Add user_id to Opportunities
ALTER TABLE polybot_opportunities 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Default existing rows (optional: set to a known admin UUID if desired, otherwise NULL until backfilled)
-- UPDATE polybot_opportunities SET user_id = '...' WHERE user_id IS NULL;

-- 4. Add user_id to Trades
ALTER TABLE polybot_trades 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 5. Add user_id to Status
ALTER TABLE polybot_status 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Drop the singleton check constraint if exists (we now allow 1 row per user)
ALTER TABLE polybot_status DROP CONSTRAINT IF EXISTS polybot_status_id_check;
-- Add constraint: Unique per user (ensure one status row per user)
ALTER TABLE polybot_status ADD CONSTRAINT unique_status_user UNIQUE (user_id);

-- 6. Add user_id to Config
-- Create table if it was missing from schema dump
CREATE TABLE IF NOT EXISTS polybot_config (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    -- ... (dynamic columns usually added by Supabase or ORM)
);
ALTER TABLE polybot_config ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE polybot_config ADD CONSTRAINT unique_config_user UNIQUE (user_id);

-- 6.1 Add user_id to Bot Logs
ALTER TABLE polybot_bot_logs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 7. ENABLE ROW LEVEL SECURITY
ALTER TABLE polybot_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE polybot_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE polybot_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE polybot_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE polybot_key_vault ENABLE ROW LEVEL SECURITY;
ALTER TABLE polybot_bot_logs ENABLE ROW LEVEL SECURITY;

-- 8. CREATE RLS POLICIES
-- Grant full access to service_role (implicit, but for clarity)
-- Note: Supabase service_role bypasses RLS by default.

-- Users can VIEW their own data
CREATE POLICY "Users can view own opportunities" ON polybot_opportunities FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view own trades" ON polybot_trades FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view own status" ON polybot_status FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view own config" ON polybot_config FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view own keys" ON polybot_key_vault FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view own logs" ON polybot_bot_logs FOR SELECT USING (auth.uid() = user_id);

-- Users can INSERT their own data (though mostly backend inserts)
CREATE POLICY "Users can insert own opportunities" ON polybot_opportunities FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can insert own status" ON polybot_status FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can insert own config" ON polybot_config FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can insert own keys" ON polybot_key_vault FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can insert own logs" ON polybot_bot_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can UPDATE their own data
CREATE POLICY "Users can update own config" ON polybot_config FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can update own status" ON polybot_status FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can update own keys" ON polybot_key_vault FOR UPDATE USING (auth.uid() = user_id);

-- 9. Create User Profiles (for Subscription & billing)
CREATE TABLE IF NOT EXISTS polybot_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    subscription_tier TEXT DEFAULT 'free', -- free, pro, whale
    subscription_status TEXT DEFAULT 'active',
    stripe_customer_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE polybot_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON polybot_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON polybot_profiles FOR UPDATE USING (auth.uid() = id);

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.polybot_profiles (id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name');
  
  -- Also initialize default config for new user
  INSERT INTO public.polybot_config (user_id) VALUES (new.id);
  
  -- Initialize status for new user
  INSERT INTO public.polybot_status (user_id, is_running) VALUES (new.id, false);
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind trigger to auth.users (requires superuser access)
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
