-- Add banned column to user_roles table if it doesn't exist
ALTER TABLE user_roles 
ADD COLUMN IF NOT EXISTS banned BOOLEAN DEFAULT false;

-- Create index for banned lookups
CREATE INDEX IF NOT EXISTS idx_user_roles_banned ON user_roles(banned);
