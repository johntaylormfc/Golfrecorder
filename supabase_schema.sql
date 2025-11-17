-- Supabase schema for GolfRecorder

-- Enable UUID extension if not present (superuser required)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Profiles (extend Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  handicap_index numeric(5,2),
  handedness text NOT NULL CHECK (handedness IN ('right','left')) DEFAULT 'right',
  uses_advanced_entry boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Courses
CREATE TABLE IF NOT EXISTS courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text, -- id from golfcourseapi
  name text NOT NULL,
  city text,
  region text,
  country text,
  latitude numeric,
  longitude numeric,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Course tees (per course)
CREATE TABLE IF NOT EXISTS course_tees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid REFERENCES courses(id) ON DELETE CASCADE,
  tee_name text NOT NULL,
  tee_color text,
  rating numeric,
  slope numeric,
  yardages jsonb, -- {"hole_1": 380, "hole_2": 445, ...}
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Course holes (basic per-hole properties - yardages optional if stored by tee)
CREATE TABLE IF NOT EXISTS course_holes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid REFERENCES courses(id) ON DELETE CASCADE,
  hole_number int NOT NULL CHECK (hole_number >= 1 AND hole_number <= 18),
  par int NOT NULL CHECK (par >= 3 AND par <= 5),
  stroke_index int,
  default_yardage int,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (course_id, hole_number)
);

-- Rounds
CREATE TABLE IF NOT EXISTS rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id uuid REFERENCES courses(id),
  tee_id uuid REFERENCES course_tees(id),
  started_at timestamptz,
  finished_at timestamptz,
  holes_played int DEFAULT 18,
  total_score int,
  par_total int,
  status text NOT NULL DEFAULT 'in_progress', -- in_progress | completed | abandoned
  ai_summary_markdown text,
  ai_summary_generated_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Round holes (aggregates for each hole played in a given round)
CREATE TABLE IF NOT EXISTS round_holes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid REFERENCES rounds(id) ON DELETE CASCADE,
  hole_number int NOT NULL CHECK (hole_number >= 1 AND hole_number <= 18),
  par int NOT NULL,
  gross_score int,
  putts int,
  fir boolean,
  gir boolean,
  penalties int DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (round_id, hole_number)
);

-- Shots (detailed per-shot record)
CREATE TABLE IF NOT EXISTS shots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid REFERENCES rounds(id) ON DELETE CASCADE,
  round_hole_id uuid REFERENCES round_holes(id) ON DELETE SET NULL,
  hole_number int NOT NULL CHECK (hole_number >= 1 AND hole_number <= 18),
  shot_number int NOT NULL CHECK (shot_number >= 1),
  shot_category text NOT NULL CHECK (shot_category IN ('tee','approach','around_green','putt')),
  timestamp timestamptz DEFAULT now(),

  -- Core fields
  start_lie text,
  start_distance_to_hole int,
  club text,
  intended_shot_type text,
  end_lie text,
  end_distance_to_hole int,
  result_zone text,
  penalty_strokes int DEFAULT 0,
  penalty_type text,
  holed boolean DEFAULT false,

  -- Advanced fields (nullable)
  contact_quality text,
  shot_shape text,
  trajectory text,
  distance_error text,
  lateral_error text,
  difficulty_rating int,
  decision_quality text,
  mental_tag text,
  putt_break text,
  putt_slope text,
  putt_miss_side text,
  green_surface text,
  wind_strength text,
  wind_direction_relative text,
  lie_severity text,

  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (round_id, hole_number, shot_number)
);

-- Indexes to speed up common queries
CREATE INDEX IF NOT EXISTS idx_shots_round_id ON shots (round_id);
CREATE INDEX IF NOT EXISTS idx_rounds_user_id ON rounds (user_id);
CREATE INDEX IF NOT EXISTS idx_round_holes_round_id ON round_holes (round_id);
CREATE INDEX IF NOT EXISTS idx_courses_external_id ON courses (external_id);

-- Row-Level Security (RLS) policies

-- Enable RLS where necessary
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE round_holes ENABLE ROW LEVEL SECURITY;
ALTER TABLE shots ENABLE ROW LEVEL SECURITY;

-- Policy: users can select/insert/update their own profile record (profile id = auth.uid())
CREATE POLICY "profiles_select_update_owner" ON profiles
  FOR ALL USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Policy: only authenticated users can insert new profiles linked to their auth.id
CREATE POLICY "profiles_insert_authenticated" ON profiles
  FOR INSERT USING (auth.role() = 'authenticated') WITH CHECK (id = auth.uid());

-- RLS for rounds: only owner can read/write their rounds
CREATE POLICY "rounds_owner_policy" ON rounds
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- round_holes: allow access only for rows belonging to user's round
CREATE POLICY "round_holes_round_owner" ON round_holes
  FOR ALL USING (EXISTS (SELECT 1 FROM rounds r WHERE r.id = round_holes.round_id AND r.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM rounds r WHERE r.id = round_holes.round_id AND r.user_id = auth.uid()));

-- shots: allow access only for rows belonging to user's round
CREATE POLICY "shots_round_owner" ON shots
  FOR ALL USING (EXISTS (SELECT 1 FROM rounds r WHERE r.id = shots.round_id AND r.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM rounds r WHERE r.id = shots.round_id AND r.user_id = auth.uid()));

-- Courses, course_tees, course_holes: public read access so clients can view cached course data
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "courses_public_read" ON courses FOR SELECT USING (true);
CREATE POLICY "course_tees_public_read" ON course_tees FOR SELECT USING (true);
CREATE POLICY "course_holes_public_read" ON course_holes FOR SELECT USING (true);

-- For course insert/update by a server or admin role, additional policies should be created as needed.

-- Trigger to auto-update `updated_at`
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_rounds
BEFORE UPDATE ON rounds FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_course_tees
BEFORE UPDATE ON course_tees FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_course_holes
BEFORE UPDATE ON course_holes FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_courses
BEFORE UPDATE ON courses FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_round_holes
BEFORE UPDATE ON round_holes FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_shots
BEFORE UPDATE ON shots FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- Function to recompute `round_holes` aggregate and update `rounds` totals
CREATE OR REPLACE FUNCTION refresh_round_hole_aggregates(p_round_id uuid, p_hole_number int)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  r_round rounds%ROWTYPE;
  rh_id uuid;
  rh_par int;
  putts_count int;
  penalty_total int;
  last_shot_num int;
  fir boolean := false;
  gir boolean := false;
  gross_score int;
BEGIN
  SELECT * INTO r_round FROM rounds WHERE id = p_round_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Ensure round_holes row exists
  SELECT id, par INTO rh_id, rh_par FROM round_holes WHERE round_id = p_round_id AND hole_number = p_hole_number;
  IF NOT FOUND THEN
    -- If we don't know par, try to look up from course_holes
    SELECT par INTO rh_par FROM course_holes WHERE course_id = r_round.course_id AND hole_number = p_hole_number LIMIT 1;
    INSERT INTO round_holes (round_id, hole_number, par) VALUES (p_round_id, p_hole_number, COALESCE(rh_par, 4)) ON CONFLICT (round_id, hole_number) DO NOTHING;
    SELECT id, par INTO rh_id, rh_par FROM round_holes WHERE round_id = p_round_id AND hole_number = p_hole_number;
  END IF;

  -- Compute stats: putts, penalties, last shot number
  SELECT COUNT(*) FILTER (WHERE shot_category = 'putt') INTO putts_count FROM shots WHERE round_id = p_round_id AND hole_number = p_hole_number;
  SELECT COALESCE(SUM(penalty_strokes),0) INTO penalty_total FROM shots WHERE round_id = p_round_id AND hole_number = p_hole_number;
  SELECT MAX(shot_number) INTO last_shot_num FROM shots WHERE round_id = p_round_id AND hole_number = p_hole_number;

  -- Score: gross_score = last_shot_num + penalty_total (approximation)
  IF last_shot_num IS NULL THEN
    gross_score := NULL;
  ELSE
    gross_score := last_shot_num + COALESCE(penalty_total, 0);
  END IF;

  -- FIR: For par 4/5, true if tee shot ended in fairway
  IF rh_par >= 4 THEN
    IF EXISTS (SELECT 1 FROM shots s JOIN round_holes rh ON rh.round_id = p_round_id AND rh.hole_number = p_hole_number WHERE s.round_id = p_round_id AND s.hole_number = p_hole_number AND s.shot_number = 1 AND s.end_lie = 'fairway') THEN
      fir := true;
    END IF;
  END IF;

  -- GIR: If reaching green within par-2 strokes
  IF rh_par = 3 THEN
    gir := EXISTS (SELECT 1 FROM shots WHERE round_id = p_round_id AND hole_number = p_hole_number AND shot_number = 1 AND end_lie = 'green');
  ELSIF rh_par = 4 THEN
    gir := EXISTS (SELECT 1 FROM shots WHERE round_id = p_round_id AND hole_number = p_hole_number AND shot_number <= 2 AND end_lie = 'green');
  ELSIF rh_par = 5 THEN
    gir := EXISTS (SELECT 1 FROM shots WHERE round_id = p_round_id AND hole_number = p_hole_number AND shot_number <= 3 AND end_lie = 'green');
  END IF;

  -- Update the round_holes row
  UPDATE round_holes SET
    putts = putts_count,
    penalties = COALESCE(penalty_total, 0),
    gross_score = gross_score,
    fir = fir,
    gir = gir,
    updated_at = now()
  WHERE id = rh_id;

  -- Update round totals: par_total and total_score
  UPDATE rounds SET
    par_total = (SELECT COALESCE(SUM(par), 0) FROM round_holes WHERE round_id = p_round_id),
    total_score = (SELECT COALESCE(SUM(gross_score), 0) FROM round_holes WHERE round_id = p_round_id),
    updated_at = now()
  WHERE id = p_round_id;
END;
$$;

-- Trigger that refreshes aggregates on shot changes
CREATE OR REPLACE FUNCTION shots_after_change_refresh() RETURNS TRIGGER AS $$
BEGIN
  PERFORM refresh_round_hole_aggregates(NEW.round_id, NEW.hole_number);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'refresh failed: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER shots_after_insert_update
AFTER INSERT OR UPDATE ON shots FOR EACH ROW EXECUTE FUNCTION shots_after_change_refresh();

-- End of schema
