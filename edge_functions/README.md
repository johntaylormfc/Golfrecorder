# Edge Functions – GolfRecorder

This directory documents the Edge Functions the app will use. Implementations are expected to run in Supabase Edge Functions or a small Node TypeScript serverless function environment.

## Goals
- Keep the GolfCourseAPI key server-side to avoid leaks.
- Cache course/tee/hole data in Supabase.
- Call the LLM to generate an AI round summary and store the result in Supabase.

## Endpoints

1. GET /edge-functions/courses/search?q=...&near=lat,lng
   - Purpose: Search courses via golfcourseapi and/or return cached courses.
   - Flow:
     - Query golfcourseapi with the provided params.
     - Upsert course data (courses, course_tees, course_holes) into Supabase.
     - Return paginated results to the mobile client.

2. GET /edge-functions/courses/:course_id
   - Purpose: Return cached course/tee/hole details for a course.
   - Flow:
     - Query Supabase for course, course_tees, course_holes.
     - If not found and a `refresh=true` query param was included, fetch and cache from golfcourseapi.

3. POST /edge-functions/rounds/:round_id/generate_summary
   - Purpose: Fetch full round + shots, build JSON for the LLM, call the LLM with `round_summary_prompt.md` system message, store the response as `ai_summary_markdown` on the `rounds` table.
   - Flow:
     - Authenticate the user via Supabase auth headers.
     - Fetch round, round_holes, shots for that round; ensure the round belongs to the current user.
     - Map to the JSON shape defined in `round_summary_prompt.md`.
     - Call the LLM (e.g., via OpenAI API or another LLM provider). The model choice (e.g., GPT-4.x) should be configurable via environment variables.
     - Store AI markdown in `rounds.ai_summary_markdown` and return it to the client.

Security notes
- Use Supabase JWT (RLS) to validate that the request is from the owner.
- Rate-limit LLM calls to prevent accidental costs.
- Sanitize JSON and ensure no PII is exposed unintentionally.

Implementation hints
- Use a `GOLF_API_KEY` (stored as secret) to call golfcourseapi.
- Use `SUPABASE_SERVICE_ROLE_KEY` for server-side database writes if needed.
- Supply the LLM API key and model identifier as environment variables.

