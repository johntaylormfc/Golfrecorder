-- Migration: Add weather data to rounds table

-- Add weather columns to rounds table
ALTER TABLE rounds 
ADD COLUMN IF NOT EXISTS weather_data jsonb,
ADD COLUMN IF NOT EXISTS weather_fetched_at timestamptz;

-- Add comment explaining the weather_data structure
COMMENT ON COLUMN rounds.weather_data IS 'Weather conditions during the round. JSON structure: {temperature: number, humidity: number, wind_speed: number, wind_direction: number, wind_gust?: number, description: string, visibility: number, pressure: number, uv_index?: number, feels_like: number}';

-- Add index for weather queries (optional, for future analytics)
CREATE INDEX IF NOT EXISTS idx_rounds_weather_fetched ON rounds (weather_fetched_at) WHERE weather_data IS NOT NULL;