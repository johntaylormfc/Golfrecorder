import { serve } from 'https://deno.land/std@0.203.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY') ?? '';
const GOLF_API_KEY = Deno.env.get('GOLF_API_KEY') ?? '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req: Request) => {
	try {
		const url = new URL(req.url);
		const params = url.searchParams;
		const q = params.get('q');
		const near = params.get('near');
		const externalId = params.get('external_id');

		if (!GOLF_API_KEY) return new Response('Server misconfigured', { status: 500 });

		if (externalId) {
			const apiUrl = `https://api.golfcourseapi.com/v1/courses/${encodeURIComponent(externalId)}`;
			const apiRes = await fetch(apiUrl, { headers: { 'x-api-key': GOLF_API_KEY } });
			if (!apiRes.ok) return new Response('Course not found', { status: 404 });
			const course = await apiRes.json();

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
					await supabase.from('course_tees').upsert(teeUpsert, { onConflict: ['course_id', 'tee_name'] });
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

		if (q) {
			const apiUrl = `https://api.golfcourseapi.com/v1/courses?search=${encodeURIComponent(q)}`;
			const apiRes = await fetch(apiUrl, { headers: { 'x-api-key': GOLF_API_KEY } });
			if (!apiRes.ok) return new Response('Golf API request failed', { status: 502 });
			const searchResults = await apiRes.json();

			const upserted = [] as any[];
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

		return new Response('Bad request: need q or external_id', { status: 400 });
	} catch (err) {
		console.error(err);
		return new Response('Internal Server Error', { status: 500 });
	}
});
