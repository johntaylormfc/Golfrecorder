import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.3.3/mod.js";

serve(async (req) => {
  try {
    const dbUrl = Deno.env.get("SUPABASE_DB_URL");
    if (!dbUrl) {
      return new Response("Missing SUPABASE_DB_URL", { status: 500 });
    }

    const sql = postgres(dbUrl);

    try {
      await sql`
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
  v_fir boolean := false;
  v_gir boolean := false;
  v_gross_score int;
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

  -- Score: v_gross_score = last_shot_num + penalty_total (approximation)
  IF last_shot_num IS NULL THEN
    v_gross_score := NULL;
  ELSE
    v_gross_score := last_shot_num + COALESCE(penalty_total, 0);
  END IF;

  -- FIR: For par 4/5, true if tee shot ended in fairway
  IF rh_par >= 4 THEN
    IF EXISTS (SELECT 1 FROM shots s JOIN round_holes rh ON rh.round_id = p_round_id AND rh.hole_number = p_hole_number WHERE s.round_id = p_round_id AND s.hole_number = p_hole_number AND s.shot_number = 1 AND s.end_lie = 'fairway') THEN
      v_fir := true;
    END IF;
  END IF;

  -- GIR: If reaching green within par-2 strokes
  IF rh_par = 3 THEN
    v_gir := EXISTS (SELECT 1 FROM shots WHERE round_id = p_round_id AND hole_number = p_hole_number AND shot_number = 1 AND end_lie = 'green');
  ELSIF rh_par = 4 THEN
    v_gir := EXISTS (SELECT 1 FROM shots WHERE round_id = p_round_id AND hole_number = p_hole_number AND shot_number <= 2 AND end_lie = 'green');
  ELSIF rh_par = 5 THEN
    v_gir := EXISTS (SELECT 1 FROM shots WHERE round_id = p_round_id AND hole_number = p_hole_number AND shot_number <= 3 AND end_lie = 'green');
  END IF;

  -- Update the round_holes row
  UPDATE round_holes SET
    putts = putts_count,
    penalties = COALESCE(penalty_total, 0),
    gross_score = v_gross_score,
    fir = v_fir,
    gir = v_gir,
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
      `;
      return new Response("Migration executed successfully", { status: 200 });
    } finally {
      await sql.end();
    }
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
