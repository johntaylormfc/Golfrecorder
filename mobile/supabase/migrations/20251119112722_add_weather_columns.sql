ALTER TABLE IF EXISTS rounds ADD COLUMN IF NOT EXISTS weather_data jsonb;
ALTER TABLE IF EXISTS rounds ADD COLUMN IF NOT EXISTS weather_fetched_at timestamptz;
