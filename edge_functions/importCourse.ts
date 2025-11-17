/*
Edge function to search or fetch course details from golfcourseapi and cache in Supabase.

Flow:
- Accept q= query or external id
- Call golfcourseapi.com with server-side key (GOLF_API_KEY)
- Upsert into `courses`, `course_tees`, `course_holes`
- Return fetched/cached course data

This is pseudo code / sample implementation for Supabase Edge Functions / Node.
*/

import { serve } from 'std/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const GOLF_API_KEY = process.env.GOLF_API_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const params = url.searchParams;
    const q = params.get('q');
    const near = params.get('near');
    const externalId = params.get('external_id');

    if (!GOLF_API_KEY) return new Response('Server misconfigured', { status: 500 });

    // Option 1: if externalId present, fetch by ID
    if (externalId) {
      // call golfcourseapi.com/course/{externalId}
      const apiUrl = `https://api.golfcourseapi.com/v1/courses/${encodeURIComponent(externalId)}`;
      const apiRes = await fetch(apiUrl, { headers: { 'x-api-key': GOLF_API_KEY } });
      if (!apiRes.ok) return new Response('Course not found', { status: 404 });
      const course = await apiRes.json();
      // Map fields from API to our schema (flexible; depends on API)
      const courseUpsert = {
        external_id: course.id ?? course.external_id ?? externalId,
        name: course.name ?? course.title ?? 'Unnamed course',
        city: course.city ?? null,
        region: course.region ?? null,
        country: course.country ?? null,
        latitude: course.latitude ?? null,
        longitude: course.longitude ?? null,
        metadata: course,
      };
      const { data: cdata, error: cErr } = await supabase.from('courses').upsert(courseUpsert, { onConflict: 'external_id' }).select().single();
      if (cErr) return new Response(JSON.stringify(cErr), { status: 500 });

      // Upsert tees and holes if present
      if (Array.isArray(course.tees)) {
        for (const tee of course.tees) {
          const teeUpsert = {
            course_id: cdata.id,
            tee_name: tee.name ?? tee.title,
            tee_color: tee.color ?? null,
            rating: tee.rating ?? null,
            slope: tee.slope ?? null,
            yardages: tee.yardages ?? null,
            metadata: tee,
          };
          const { data: tdata } = await supabase.from('course_tees').upsert(teeUpsert, { onConflict: ['course_id', 'tee_name'] });
        }
      }

      if (Array.isArray(course.holes)) {
        for (const hole of course.holes) {
          const holeUpsert = {
            course_id: cdata.id,
            hole_number: hole.hole_number ?? hole.number,
            par: hole.par ?? 4,
            stroke_index: hole.stroke_index ?? null,
            default_yardage: hole.yardage ?? null,
            metadata: hole,
          };
          await supabase.from('course_holes').upsert(holeUpsert, { onConflict: ['course_id', 'hole_number'] });
        }
      }

      return new Response(JSON.stringify({ course: cdata }), { status: 200 });
    }

    // Option 2: search by name (q) / near coords
    // e.g., https://api.golfcourseapi.com/coursess?search=...

    // Search courses by name
    if (q) {
      const apiUrl = `https://api.golfcourseapi.com/v1/courses?search=${encodeURIComponent(q)}`;
      const apiRes = await fetch(apiUrl, { headers: { 'x-api-key': GOLF_API_KEY } });
      if (!apiRes.ok) return new Response('Golf API request failed', { status: 502 });
      const searchResults = await apiRes.json();

      // Upsert results into courses table and return a simplified list to the client
      const upserted = [];
      for (const course of (searchResults.data ?? searchResults.courses ?? [])) {
        const courseUpsert = {
          external_id: course.id,
          name: course.name ?? course.title ?? 'Unnamed course',
          city: course.city ?? null,
          region: course.region ?? null,
          country: course.country ?? null,
          latitude: course.latitude ?? null,
          longitude: course.longitude ?? null,
          metadata: course,
        };
        const { data: cdata, error: cErr } = await supabase.from('courses').upsert(courseUpsert, { onConflict: 'external_id' }).select();
        if (cErr) continue;
        upserted.push(cdata);
      }
      return new Response(JSON.stringify({ results: upserted }), { status: 200 });
    }
    // const res = await fetch(apiUrl, { headers: { 'x-api-key': GOLF_API_KEY } });

    // on success, upsert into courses table
    // for each tee, upsert course_tees, for each hole, upsert course_holes

    return new Response(JSON.stringify({ status: 'ok' }), { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response('Internal Server Error', { status: 500 });
  }
});
