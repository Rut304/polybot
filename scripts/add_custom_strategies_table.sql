-- Create custom strategies table for Strategy Builder
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS polybot_custom_strategies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    conditions JSONB NOT NULL DEFAULT '[]',
    actions JSONB NOT NULL DEFAULT '[]',
    is_active BOOLEAN DEFAULT false,
    last_triggered_at TIMESTAMPTZ,
    trigger_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE polybot_custom_strategies ENABLE ROW LEVEL SECURITY;

-- RLS Policies - users can only see/edit their own strategies
DROP POLICY IF EXISTS "Users can view own strategies" ON polybot_custom_strategies;
CREATE POLICY "Users can view own strategies" ON polybot_custom_strategies 
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own strategies" ON polybot_custom_strategies;
CREATE POLICY "Users can create own strategies" ON polybot_custom_strategies 
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own strategies" ON polybot_custom_strategies;
CREATE POLICY "Users can update own strategies" ON polybot_custom_strategies 
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own strategies" ON polybot_custom_strategies;
CREATE POLICY "Users can delete own strategies" ON polybot_custom_strategies 
    FOR DELETE USING (auth.uid() = user_id);

-- Service role access for admin operations
DROP POLICY IF EXISTS "Service role strategies access" ON polybot_custom_strategies;
CREATE POLICY "Service role strategies access" ON polybot_custom_strategies 
    FOR ALL USING (auth.role() = 'service_role');

-- Index for faster user queries
CREATE INDEX IF NOT EXISTS idx_custom_strategies_user_id ON polybot_custom_strategies(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_strategies_is_active ON polybot_custom_strategies(is_active) WHERE is_active = true;

-- Verify
SELECT 'Custom strategies table created!' as status;
