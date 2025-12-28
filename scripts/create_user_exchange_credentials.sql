-- User Exchange Credentials Table
-- For multi-tenant OAuth token storage (IBKR, etc.)
-- 
-- Run with: psql $DATABASE_URL -f scripts/create_user_exchange_credentials.sql

CREATE TABLE IF NOT EXISTS user_exchange_credentials (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    exchange VARCHAR(50) NOT NULL,
    account_id VARCHAR(100),
    
    -- OAuth tokens (encrypted)
    access_token TEXT,
    refresh_token TEXT,
    token_expiry TIMESTAMPTZ,
    consumer_key VARCHAR(255),
    
    -- Account settings
    is_paper BOOLEAN DEFAULT TRUE,
    
    -- Metadata
    last_authenticated TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- One credential set per exchange per user
    UNIQUE(user_id, exchange)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_user_exchange_creds_user_id 
ON user_exchange_credentials(user_id);

CREATE INDEX IF NOT EXISTS idx_user_exchange_creds_exchange 
ON user_exchange_credentials(exchange);

-- Enable RLS
ALTER TABLE user_exchange_credentials ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own credentials
CREATE POLICY "Users can view own credentials"
ON user_exchange_credentials
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own credentials"
ON user_exchange_credentials
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own credentials"
ON user_exchange_credentials
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own credentials"
ON user_exchange_credentials
FOR DELETE
USING (auth.uid() = user_id);

-- Admin can view all (for debugging)
CREATE POLICY "Admins can view all credentials"
ON user_exchange_credentials
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE user_profiles.user_id = auth.uid() 
        AND user_profiles.role = 'admin'
    )
);

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_user_exchange_credentials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trigger_update_user_exchange_credentials 
ON user_exchange_credentials;

CREATE TRIGGER trigger_update_user_exchange_credentials
BEFORE UPDATE ON user_exchange_credentials
FOR EACH ROW
EXECUTE FUNCTION update_user_exchange_credentials_updated_at();

-- Grant permissions
GRANT ALL ON user_exchange_credentials TO authenticated;

-- Comment
COMMENT ON TABLE user_exchange_credentials IS 
'Stores OAuth tokens and credentials for exchanges like IBKR per user for multi-tenant support';
