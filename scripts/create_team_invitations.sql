-- ============================================
-- TEAM INVITATIONS SCHEMA
-- December 27, 2025
-- ============================================
-- Allows users to invite others to their tenant
-- with role-based permissions

-- ============================================
-- STEP 1: Create Teams Table (Tenants)
-- ============================================

CREATE TABLE IF NOT EXISTS polybot_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Settings
    max_members INTEGER DEFAULT 5,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for owner lookup
CREATE INDEX IF NOT EXISTS idx_teams_owner ON polybot_teams(owner_id);

-- ============================================
-- STEP 2: Create Team Members Table
-- ============================================

CREATE TABLE IF NOT EXISTS polybot_team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES polybot_teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Role: 'owner', 'admin', 'member', 'viewer'
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    
    -- Timestamps
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint: one user per team
    UNIQUE(team_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_team_members_team ON polybot_team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON polybot_team_members(user_id);

-- ============================================
-- STEP 3: Create Invitations Table
-- ============================================

CREATE TABLE IF NOT EXISTS polybot_team_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES polybot_teams(id) ON DELETE CASCADE,
    
    -- Who sent the invite
    invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Who is invited (email - may not be a user yet)
    email TEXT NOT NULL,
    
    -- Role they'll have when they accept
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'viewer')),
    
    -- Invitation token (for email link)
    token UUID DEFAULT gen_random_uuid() UNIQUE,
    
    -- Status: 'pending', 'accepted', 'expired', 'revoked'
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
    
    -- Expiration (7 days by default)
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    accepted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_invitations_team ON polybot_team_invitations(team_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON polybot_team_invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON polybot_team_invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON polybot_team_invitations(status);

-- ============================================
-- STEP 4: Enable RLS
-- ============================================

ALTER TABLE polybot_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE polybot_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE polybot_team_invitations ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 5: RLS Policies - Teams
-- ============================================

-- Users can view teams they're a member of
DROP POLICY IF EXISTS "Users can view their teams" ON polybot_teams;
CREATE POLICY "Users can view their teams" ON polybot_teams
    FOR SELECT USING (
        id IN (
            SELECT team_id FROM polybot_team_members WHERE user_id = auth.uid()
        )
    );

-- Only team owners can update their team
DROP POLICY IF EXISTS "Owners can update teams" ON polybot_teams;
CREATE POLICY "Owners can update teams" ON polybot_teams
    FOR UPDATE USING (owner_id = auth.uid());

-- Users can create teams
DROP POLICY IF EXISTS "Users can create teams" ON polybot_teams;
CREATE POLICY "Users can create teams" ON polybot_teams
    FOR INSERT WITH CHECK (owner_id = auth.uid());

-- Service role full access
DROP POLICY IF EXISTS "Service role teams" ON polybot_teams;
CREATE POLICY "Service role teams" ON polybot_teams
    FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- STEP 6: RLS Policies - Team Members
-- ============================================

-- Users can view members of teams they belong to
DROP POLICY IF EXISTS "Users can view team members" ON polybot_team_members;
CREATE POLICY "Users can view team members" ON polybot_team_members
    FOR SELECT USING (
        team_id IN (
            SELECT team_id FROM polybot_team_members WHERE user_id = auth.uid()
        )
    );

-- Admins/owners can add members
DROP POLICY IF EXISTS "Admins can add members" ON polybot_team_members;
CREATE POLICY "Admins can add members" ON polybot_team_members
    FOR INSERT WITH CHECK (
        team_id IN (
            SELECT team_id FROM polybot_team_members 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- Admins/owners can remove members (but not owner)
DROP POLICY IF EXISTS "Admins can remove members" ON polybot_team_members;
CREATE POLICY "Admins can remove members" ON polybot_team_members
    FOR DELETE USING (
        role != 'owner' AND
        team_id IN (
            SELECT team_id FROM polybot_team_members 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- Service role full access
DROP POLICY IF EXISTS "Service role team_members" ON polybot_team_members;
CREATE POLICY "Service role team_members" ON polybot_team_members
    FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- STEP 7: RLS Policies - Invitations
-- ============================================

-- Users can view invitations for teams they admin
DROP POLICY IF EXISTS "Admins can view invitations" ON polybot_team_invitations;
CREATE POLICY "Admins can view invitations" ON polybot_team_invitations
    FOR SELECT USING (
        team_id IN (
            SELECT team_id FROM polybot_team_members 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
        OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
    );

-- Admins can create invitations
DROP POLICY IF EXISTS "Admins can create invitations" ON polybot_team_invitations;
CREATE POLICY "Admins can create invitations" ON polybot_team_invitations
    FOR INSERT WITH CHECK (
        team_id IN (
            SELECT team_id FROM polybot_team_members 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- Admins can revoke invitations
DROP POLICY IF EXISTS "Admins can update invitations" ON polybot_team_invitations;
CREATE POLICY "Admins can update invitations" ON polybot_team_invitations
    FOR UPDATE USING (
        team_id IN (
            SELECT team_id FROM polybot_team_members 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- Service role full access
DROP POLICY IF EXISTS "Service role invitations" ON polybot_team_invitations;
CREATE POLICY "Service role invitations" ON polybot_team_invitations
    FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- STEP 8: Auto-create team for new users
-- ============================================

-- Function to auto-create a personal team for new users
CREATE OR REPLACE FUNCTION create_personal_team()
RETURNS TRIGGER AS $$
BEGIN
    -- Create a personal team for the new user
    INSERT INTO polybot_teams (name, owner_id)
    VALUES (
        COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)) || '''s Team',
        NEW.id
    );
    
    -- Add user as owner of their team
    INSERT INTO polybot_team_members (team_id, user_id, role)
    SELECT id, NEW.id, 'owner'
    FROM polybot_teams
    WHERE owner_id = NEW.id
    LIMIT 1;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create team on signup
DROP TRIGGER IF EXISTS on_auth_user_created_team ON auth.users;
CREATE TRIGGER on_auth_user_created_team
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_personal_team();

-- ============================================
-- STEP 9: Helper Functions
-- ============================================

-- Function to accept an invitation
CREATE OR REPLACE FUNCTION accept_team_invitation(invitation_token UUID)
RETURNS JSONB AS $$
DECLARE
    v_invitation RECORD;
    v_user_id UUID;
    v_user_email TEXT;
BEGIN
    -- Get current user
    v_user_id := auth.uid();
    SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
    
    -- Find the invitation
    SELECT * INTO v_invitation
    FROM polybot_team_invitations
    WHERE token = invitation_token
    AND status = 'pending'
    AND expires_at > NOW();
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invitation not found or expired');
    END IF;
    
    -- Check email matches
    IF v_invitation.email != v_user_email THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invitation is for a different email address');
    END IF;
    
    -- Check if already a member
    IF EXISTS (
        SELECT 1 FROM polybot_team_members 
        WHERE team_id = v_invitation.team_id AND user_id = v_user_id
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'You are already a member of this team');
    END IF;
    
    -- Add user to team
    INSERT INTO polybot_team_members (team_id, user_id, role)
    VALUES (v_invitation.team_id, v_user_id, v_invitation.role);
    
    -- Update invitation status
    UPDATE polybot_team_invitations
    SET status = 'accepted', accepted_at = NOW()
    WHERE id = v_invitation.id;
    
    RETURN jsonb_build_object(
        'success', true, 
        'team_id', v_invitation.team_id,
        'role', v_invitation.role
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- VERIFICATION
-- ============================================

SELECT '✅ Team invitations schema created!' as status;
