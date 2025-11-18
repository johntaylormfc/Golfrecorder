-- Migration: Add clubs table for user's golf bag

-- Create clubs table
CREATE TABLE IF NOT EXISTS clubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  club_type text NOT NULL,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, club_type)
);

-- Enable RLS
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;

-- RLS policy: only owner can read/write their clubs
DROP POLICY IF EXISTS "clubs_owner_policy" ON clubs;
CREATE POLICY "clubs_owner_policy" ON clubs
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Add update timestamp trigger
DROP TRIGGER IF EXISTS set_timestamp_clubs ON clubs;
CREATE TRIGGER set_timestamp_clubs
BEFORE UPDATE ON clubs FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
