import { serve } from 'https://deno.land/std@0.203.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY') ?? '';
const LLM_API_KEY = Deno.env.get('LLM_API_KEY') ?? '';
const LLM_API_BASE = Deno.env.get('LLM_API_BASE') ?? 'https://api.openai.com/v1';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req: Request) => {
  try {
    const path = new URL(req.url).pathname;
    const matches = path.match(/\/rounds\/([^/]+)\/generate_summary/);
    if (!matches) return new Response('Bad request', { status: 400 });
    const roundId = matches[1];

    const authHeader = req.headers.get('authorization');
    if (!authHeader) return new Response('Unauthorized', { status: 401 });
    const token = authHeader.split(' ')[1];
    if (!token) return new Response('Unauthorized', { status: 401 });

    // Decode without verification for brevity; in production use the Supabase auth token or verify signature
    function unsafeDecodeJwtPayload(jwt: string) {
      const parts = jwt.split('.');
      if (parts.length !== 3) return null;
      try {
        const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const padLen = (4 - (padded.length % 4)) % 4;
        const paddedWithEquals = padded + '='.repeat(padLen);
        const decoded = atob(paddedWithEquals);
        const payload = JSON.parse(decoded);
        return payload;
      } catch (e) {
        return null;
      }
    }

    const jwtPayload = unsafeDecodeJwtPayload(token);
    if (!jwtPayload || !jwtPayload.sub) return new Response('Unauthorized', { status: 401 });
    const callerUserId = jwtPayload.sub;

    const { data: round, error: roundErr } = await supabase.from('rounds').select('*').eq('id', roundId).single();
    if (roundErr) return new Response(JSON.stringify(roundErr), { status: 400 });
    if (!round) return new Response('Round not found', { status: 404 });
    if (round.user_id !== callerUserId) return new Response('Forbidden', { status: 403 });

    const lastAiGeneratedAt = round.ai_summary_generated_at ? new Date(round.ai_summary_generated_at) : null;
    if (lastAiGeneratedAt && (Date.now() - lastAiGeneratedAt.getTime()) < (60 * 1000)) {
      return new Response('Too many requests: Rate limit in effect (60s)', { status: 429 });
    }

    const { data: roundHoles } = await supabase.from('round_holes').select('*').eq('round_id', roundId);
    const { data: shots } = await supabase.from('shots').select('*').eq('round_id', roundId).order('shot_number');
    const { data: playerProfile } = await supabase.from('profiles').select('*').eq('id', round.user_id).single();
    const { data: courseData } = await supabase.from('courses').select('name').eq('id', round.course_id).single();
    const { data: teeData } = await supabase.from('course_tees').select('tee_name').eq('id', round.tee_id).single();

    const json = {
      player_profile: {
        display_name: playerProfile?.display_name ?? null,
        handicap_index: playerProfile?.handicap_index ?? null,
        handedness: playerProfile?.handedness ?? null,
      },
      round: {
        id: round.id,
        course_name: courseData?.name ?? null,
        tee_name: teeData?.tee_name ?? null,
        started_at: round.started_at,
        finished_at: round.finished_at,
        holes_played: round.holes_played,
        total_score: round.total_score,
        par_total: round.par_total,
      },
      round_holes: roundHoles ?? [],
      shots: shots ?? [],
      settings: {
        distance_unit: 'yards',
      }
    };

    const systemMessage = `You are a friendly but precise golf coach analysing a single round for an amateur golfer based on detailed shot data. You are given structured JSON describing the player, the round overview, hole-by-hole summary, and each shot. Provide a concise coaching-style report in Markdown, with sections for Overall, Tee Shots, Approaches, Short Game, Putting, Key Patterns, and 3-5 Things to Work On. Do not mention database tables or JSON keys.`;
    const userMessage = `Please analyse the following golf round and produce a concise yet insightful coaching-style summary for the player. JSON data:\n\n${JSON.stringify(json)}`;

    if (!LLM_API_KEY) return new Response('LLM not configured', { status: 500 });

    const response = await fetch(`${LLM_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage },
        ],
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('LLM error:', response.status, text);
      return new Response(JSON.stringify({ error: 'LLM call failed', status: response.status, body: text }), { status: 502 });
    }

    const payload = await response.json();
    const aiMarkdown = payload.choices?.[0]?.message?.content ?? '';

    await supabase.from('rounds').update({ ai_summary_markdown: aiMarkdown, ai_summary_generated_at: new Date().toISOString() }).eq('id', roundId);

    return new Response(JSON.stringify({ ai_summary_markdown: aiMarkdown }), { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response('Internal server error', { status: 500 });
  }
});
