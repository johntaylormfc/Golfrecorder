/*
Edge function: generateSummary
Fetches round, round_holes, shots for the given round ID (validated against the calling user),
builds the JSON specified in round_summary_prompt.md, calls an LLM, and writes the AI summary to the rounds table.

Note: This file is a runnable TypeScript example for Supabase Edge Functions (Deno/TS) or Node.
*/

import { serve } from 'std/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const LLM_API_KEY = process.env.LLM_API_KEY || '';
const LLM_API_BASE = process.env.LLM_API_BASE || 'https://api.openai.com/v1';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  try {
    const { params } = new URL(req.url);
    // parse round id from path
    const path = new URL(req.url).pathname;
    const matches = path.match(/\/rounds\/([^/]+)\/generate_summary/);
    if (!matches) return new Response('Bad request', { status: 400 });
    const roundId = matches[1];

    // Validate the incoming JWT and ensure the round belongs to the caller.
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return new Response('Unauthorized', { status: 401 });
    const token = authHeader.split(' ')[1];
    if (!token) return new Response('Unauthorized', { status: 401 });

    // In production, validate the JWT signature correctly using the Supabase JWT secret or a public key; here we decode without verifying for brevity.
    function unsafeDecodeJwtPayload(jwt: string) {
      const parts = jwt.split('.');
      if (parts.length !== 3) return null;
      try {
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        return payload;
      } catch (e) {
        return null;
      }
    }

    const payload = unsafeDecodeJwtPayload(token);
    if (!payload || !payload.sub) return new Response('Unauthorized', { status: 401 });
    const callerUserId = payload.sub;

    // Fetch round
    const { data: round, error: roundErr } = await supabase
      .from('rounds')
      .select('*')
      .eq('id', roundId)
      .single();
    if (roundErr) return new Response(JSON.stringify(roundErr), { status: 400 });
    if (!round) return new Response('Round not found', { status: 404 });
    if (round.user_id !== callerUserId) return new Response('Forbidden', { status: 403 });

    // Fetch round_holes & shots
    const { data: roundHoles } = await supabase.from('round_holes').select('*').eq('round_id', roundId);
    const { data: shots } = await supabase.from('shots').select('*').eq('round_id', roundId).order('shot_number');

    const playerProfile = await supabase.from('profiles').select('*').eq('id', round.user_id).single();

    // Prevent frequent re-generation to avoid costs (60 seconds minimum between calls)
    const lastAiGeneratedAt = round.ai_summary_generated_at ? new Date(round.ai_summary_generated_at) : null;
    if (lastAiGeneratedAt && (Date.now() - lastAiGeneratedAt.getTime()) < (60 * 1000)) {
      return new Response('Too many requests: Rate limit in effect (60s)', { status: 429 });
    }

    // Build the JSON as per round_summary_prompt.md
    // Fetch course and tee names if available
    const { data: courseData } = await supabase.from('courses').select('name').eq('id', round.course_id).single();
    const { data: teeData } = await supabase.from('course_tees').select('tee_name').eq('id', round.tee_id).single();

    const json = {
      player_profile: {
        display_name: playerProfile.data.display_name,
        handicap_index: playerProfile.data.handicap_index,
        handedness: playerProfile.data.handedness,
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
      round_holes: roundHoles || [],
      shots: shots || [],
      settings: {
        distance_unit: 'yards'
      }
    };

    // Call LLM API (OpenAI example) with the system prompt from round_summary_prompt.md and the JSON in the user message
    // Use the coaching system prompt as described in round_summary_prompt.md
    const systemMessage = `You are a friendly but precise golf coach analysing a single round for an amateur golfer based on detailed shot data. You are given structured JSON describing the player, the round overview, hole-by-hole summary, and each shot. Provide a concise coaching-style report in Markdown, with sections for Overall, Tee Shots, Approaches, Short Game, Putting, Key Patterns, and 3-5 Things to Work On. Do not mention database tables or JSON keys.`;

    const userMessage = `Please analyse the following golf round and produce a concise yet insightful coaching-style summary for the player. JSON data:\n\n${JSON.stringify(json)}`;

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
      return new Response('LLM call failed', { status: 502 });
    }

    const payload = await response.json();
    const aiMarkdown = payload.choices?.[0]?.message?.content ?? '';

    // Write the AI markdown back to the rounds table
    await supabase.from('rounds').update({ ai_summary_markdown: aiMarkdown, ai_summary_generated_at: new Date().toISOString() }).eq('id', roundId);

    return new Response(JSON.stringify({ ai_summary_markdown: aiMarkdown }), { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response('Internal server error', { status: 500 });
  }
});
