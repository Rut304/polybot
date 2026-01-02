-- Add GEMINI_API_KEY secret for AI Superforecasting strategy
-- Run this in Supabase SQL Editor

-- Add the AI services category and Gemini API key
INSERT INTO polybot_secrets (key_name, description, category) VALUES
('GEMINI_API_KEY', 'Google Gemini API key for AI Superforecasting (get free at aistudio.google.com)', 'ai_services')
ON CONFLICT (key_name) DO UPDATE SET 
  description = EXCLUDED.description,
  category = EXCLUDED.category;

-- Verify the secret was added
SELECT key_name, description, category, is_configured 
FROM polybot_secrets 
WHERE key_name = 'GEMINI_API_KEY';
