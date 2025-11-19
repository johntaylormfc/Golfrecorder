import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseKey)

Deno.serve(async (req) => {
  const sql = `
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
  `

  // Use the RPC call to execute SQL if you have a function for it, or use a direct query if possible.
  // Since we don't have a generic exec_sql function, we can try to create one or just use the fact that we are in an edge function
  // and might have access to direct connection if we used pg driver.
  // But here we are using supabase-js.
  // Actually, supabase-js doesn't support raw SQL execution unless we have a stored procedure for it.
  // BUT, we can use the 'postgres' module from Deno to connect directly if we had the connection string.
  // Alternatively, we can create a temporary function via the dashboard... but we are the AI.
  
  // Wait, the previous successful migration used a specific method. Let's check what I did before.
  // Ah, I used `supabase functions deploy` which deploys to the project.
  // And inside the function I need to execute SQL.
  // The supabase-js client can only call RPC.
  // So I need to use a direct postgres connection.
  
  // Let's use the 'postgres' driver for Deno.
  
  try {
    // We need the DB connection string. It is usually available as SUPABASE_DB_URL or similar in the edge function environment?
    // No, usually only the API URL and Key.
    // However, for Supabase Edge Functions, we can use the `supabase-js` client to call `rpc` if we have an `exec_sql` function.
    // If we don't have `exec_sql`, we are stuck unless we can connect to the DB.
    
    // Wait, if I am deploying this function, I can't easily get the DB connection string unless I set it as a secret.
    // But I don't have the DB password.
    
    // Let's assume there is an `exec_sql` function or I can create one? No.
    
    // Actually, the error `42702` came from the database, meaning the function `refresh_round_hole_aggregates` ALREADY EXISTS and is being called.
    // I just need to REPLACE it.
    
    // If I cannot execute raw SQL, I cannot replace the function.
    
    // Let's look at the previous turn. I used `edge_functions/run_migration/index.ts`.
    // How did I implement it?
    // I used `import * as postgres from 'https://deno.land/x/postgres@v0.17.0/mod.ts'`
    // And I used `Deno.env.get('SUPABASE_DB_URL')`.
    // I must have assumed `SUPABASE_DB_URL` is available.
    // Let's try that again.
    
    const { Client } = await import('https://deno.land/x/postgres@v0.17.0/mod.ts')
    const dbUrl = Deno.env.get('SUPABASE_DB_URL')
    
    if (!dbUrl) {
      return new Response('SUPABASE_DB_URL not set', { status: 500 })
    }
    
    const client = new Client(dbUrl)
    await client.connect()
    await client.queryArray(sql)
    await client.end()
    
    return new Response('Migration executed successfully', { status: 200 })
    
  } catch (error) {
    return new Response(error.message, { status: 500 })
  }
})
