# Development README – GolfRecorder (MVP tasks and steps)

## High level steps to get the app running

1. Set up Supabase project:
   - Create a new Supabase project and configure `auth`.
   - Run the SQL in `supabase_schema.sql` using the SQL editor (or `psql`/CLI).
   - Configure Row Level Security and policies as included in the SQL.

2. Create Edge Functions:
   - Deploy `edge_functions/importCourse.ts` and `edge_functions/generateSummary.ts` to your Supabase Edge Functions.
   - Provide environment variables in the Supabase dashboard:
     - `GOLF_API_KEY` (GolfCourse API key)
     - `SUPABASE_SERVICE_ROLE_KEY` (service role key) – only for Edge functions with server-side DB writes
     - `LLM_API_KEY` and `LLM_API_BASE` (for calling your LLM provider)

3. Mobile app (Expo) setup:
   - Ensure `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are available in `.env` (or using `expo config`).
   - Install dependencies:

```pwsh
# Run this in the `mobile` folder
npm install
# or
yarn install
```

   - Run Expo dev server:

```pwsh
npm start
# or
expo start
```

4. Test flows:
   - Onboarding -> create profile
   - Start round -> search course (via Edge function) -> select tee -> create round
   - Add shot -> verify shots inserted in Supabase
   - End round -> call generate summary -> verify `ai_summary_markdown` saved

## Notes
- Use environment variables for keys; do not check them in.
- Consider adding background tasks for course import and LLM request throttling to avoid accidental charges.
- Add observability and logging for Edge functions.

