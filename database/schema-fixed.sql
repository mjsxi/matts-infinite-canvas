-- Fixed Database schema for server-side authentication
-- Run this in your Supabase SQL editor

-- First, let's see what we're working with
-- Check the current structure of canvas_items
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'canvas_items' 
AND column_name = 'user_id';

-- Create users table (this part should work fine)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on username for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop the old foreign key constraint if it exists (in case someone tried before)
ALTER TABLE canvas_items DROP CONSTRAINT IF EXISTS fk_canvas_items_user_id;

-- Option 1: Keep user_id as text and create a mapping approach
-- Add a new column for the UUID reference while keeping the old one
ALTER TABLE canvas_items ADD COLUMN IF NOT EXISTS user_uuid UUID;

-- Create a trigger function to automatically link text user_ids to UUIDs
-- This will try to find a matching username and link it
CREATE OR REPLACE FUNCTION link_user_ids()
RETURNS TRIGGER AS $$
BEGIN
    -- If user_uuid is not set but user_id is, try to find matching user
    IF NEW.user_uuid IS NULL AND NEW.user_id IS NOT NULL THEN
        SELECT id INTO NEW.user_uuid 
        FROM users 
        WHERE username = NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically link users
DROP TRIGGER IF EXISTS trigger_link_user_ids ON canvas_items;
CREATE TRIGGER trigger_link_user_ids
    BEFORE INSERT OR UPDATE ON canvas_items
    FOR EACH ROW
    EXECUTE FUNCTION link_user_ids();

-- Add foreign key constraint for the UUID column
ALTER TABLE canvas_items 
ADD CONSTRAINT fk_canvas_items_user_uuid 
FOREIGN KEY (user_uuid) REFERENCES users(id) ON DELETE SET NULL;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies for users table
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;

-- Note: We'll use simpler RLS policies since we're handling auth server-side
CREATE POLICY "Enable all access for authenticated users" ON users
    FOR ALL USING (true);

-- Optional: Create a helper function to get user UUID from text user_id
CREATE OR REPLACE FUNCTION get_user_uuid(text_user_id text)
RETURNS UUID AS $$
BEGIN
    RETURN (SELECT id FROM users WHERE username = text_user_id LIMIT 1);
END;
$$ LANGUAGE plpgsql;

-- Create a view that shows canvas items with user information
CREATE OR REPLACE VIEW canvas_items_with_users AS
SELECT 
    ci.*,
    u.username,
    u.role as user_role
FROM canvas_items ci
LEFT JOIN users u ON ci.user_uuid = u.id;

-- Grant permissions on the view
GRANT SELECT ON canvas_items_with_users TO anon;
GRANT SELECT ON canvas_items_with_users TO authenticated;