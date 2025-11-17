# GolfRecorder — Development Onboarding

Date: 2025-11-17

This file documents the current repo status and the steps required to resume development on a new development machine.

## Quick summary (current status)
- Repo: https://github.com/johntaylormfc/Golfrecorder (default branch: `main`)
- DB schema and migrations are in `supabase/migrations` and were pushed to the Supabase project `ppgeznlkzkkttlkgvgfv`.
- Two Edge functions exist: `importCourse` and `generateSummary` under `supabase/functions/` and were deployed to the Supabase project.
- Secrets configured on the project: `GOLF_API_KEY`, `LLM_API_KEY`, `SERVICE_ROLE_KEY`, `SUPABASE_*` keys. Do not store or commit these secrets locally.
- `Auth.txt` is present for local dev secrets but is tracked in `.gitignore` and should never be committed.
- As of writing:
  - `importCourse` returned 502 on earlier tests — upstream GolfCourse API gives 401 (invalid API key). The function has been updated to emit better debug info (returns upstream response body/status).
  - `generateSummary` function is deployed and updated to return upstream LLM errors with more details. It requires a valid user JWT to call.

## Priority items to pick up
1. Confirm or rotate the `GOLF_API_KEY` in the Supabase project secrets and re-test `importCourse`.
2. Verify LLM credentials (LLM_API_KEY and LLM_API_BASE) — confirm produce-managed or self-hosted API endpoint works.
3. Re-deploy the Edge functions after running Docker or from CI (local `supabase functions serve` requires Docker).
4. Create sample test data (round, shots) or test via the app: run `generateSummary` and confirm `ai_summary_markdown` updates properly.

---
## Setup a new machine — recommended actions
Follow these steps to set up a new dev machine and resume development.

1. **Clone the repository**
   ```powershell
   git clone https://github.com/johntaylormfc/Golfrecorder.git
   cd Golfrecorder
   ```

2. **Install prerequisites**
   - Install Docker Desktop (Windows — required for `supabase functions serve` and `supabase db start`): https://www.docker.com/get-started
   - Install Node.js (v18+ recommended) and yarn or npm
   - Install Deno (v1.35+ recommended): https://deno.land/manual/getting_started/installation
   - Install the supabase CLI (recommended via npm/pnpm installed locally):
     ```powershell
     npx supabase --help
     ```
   - Install Expo (optional for mobile dev): `npm install -g expo-cli` or use `npx expo`.

3. **Local environment variables**
   - Create a `.env` or `Auth.txt` for local secrets (DO NOT COMMIT this file!).
   - We provide a `.env.example` in the repo as a template — copy it to `.env` and fill the values.
   - Required environment variables:
     - `SUPABASE_URL` (the Supabase project URL for the remote DB)
     - `SUPABASE_ANON_KEY` (client-side anon key)
     - `SERVICE_ROLE_KEY` / `SUPABASE_SERVICE_ROLE_KEY` (server-side role for writes & admin calls)
     - `GOLF_API_KEY`, `LLM_API_KEY`, `LLM_API_BASE`
     - `EXPO_*` environment variables if you run the mobile app locally

4. **Supabase project linking (CLI)**
   - Log in with `npx supabase login --token <PAT>` (or use `npx supabase login` and a PAT)
   - Link to the project or ensure the project-ref is `ppgeznlkzkkttlkgvgfv`.
     ```powershell
     npx supabase projects list
     npx supabase link --project-ref ppgeznlkzkkttlkgvgfv
     ```

5. **Prepare local DB (optional)**
   - If you want to run a local Postgres container matching the project: run Docker and start the Supabase local DB
     ```powershell
     npx supabase db start
     npx supabase db push
     ```
   - Or point your environment to the remote Supabase DB if you prefer.

6. **Edge functions — local serve**
   - Running `npx supabase functions serve --workdir supabase/functions` requires Docker.
   - Alternatively you can run functions directly with `deno run` for logic debugging (point at the remote DB and set env vars):
     ```powershell
     $env:SUPABASE_URL='https://ppgeznlkzkkttlkgvgfv.supabase.co'
     $env:SUPABASE_SERVICE_ROLE_KEY='<your-service-role>'
     $env:GOLF_API_KEY='<golf-key>'
     deno run --allow-env --allow-net --allow-read supabase/functions/importCourse/index.ts
     ```
   - Note: running Deno directly bypasses the Supabase Edge runtime (JWT verification/headers might differ) but is useful for quick local debugging.

7. **Deploying Edge functions**
   - If Docker is running, deploy the functions with:
     ```powershell
     npx supabase functions deploy importCourse --workdir ./supabase/functions/importCourse --project-ref ppgeznlkzkkttlkgvgfv
     npx supabase functions deploy generateSummary --workdir ./supabase/functions/generateSummary --project-ref ppgeznlkzkkttlkgvgfv
     ```

8. **Testing basic flows**
   - *Test importCourse*:
     - Use the project `SERVICE_ROLE_KEY` or a valid service JWT to call the function to avoid RLS issues
     - Example (PowerShell):
       ```powershell
       $token = '<service role token>'
       curl -X GET "https://ppgeznlkzkkttlkgvgfv.functions.supabase.co/importCourse?q=St%20Andrews" -H "Authorization: Bearer $token"
       ```
   - *Test generateSummary*:
     - Insert a test `round` with sample `round_holes` and `shots` into the DB or via the client app.
     - Use an authenticated user JWT in the Authorization header to call the function endpoint:
       ```powershell
       curl -X POST "https://ppgeznlkzkkttlkgvgfv.functions.supabase.co/rounds/<round_id>/generate_summary" -H "Authorization: Bearer <user_jwt>"
       ```
     - Confirm `rounds.ai_summary_markdown` is updated.

---
## Security and best practises
- Never store or commit secrets in the repo (e.g., `Auth.txt` is in `.gitignore`). If any secret was previously committed, rotate keys and remove from history (I can help with that).
- Use GitHub Secrets for CI (do not commit secrets to repo). Put `SUPABASE_SERVICE_ROLE_KEY`, `GOLF_API_KEY`, and `LLM_API_KEY` in GitHub secrets for CI deployments.
- Keep `.gitignore` updated and ensure any output files or test response files are ignored (e.g., `golf_res.json`, `out.json`).

---
## Useful commands
- Deploy DB migrations: `npx supabase db push --linked`
- List functions: `npx supabase functions list --project-ref <project-ref>`
- Deploy function: `npx supabase functions deploy importCourse --workdir ./supabase/functions/importCourse --project-ref <project-ref>`
- Serve functions locally: `npx supabase functions serve --workdir ./supabase/functions` (Docker required)

---
## Open tasks / known issues (as of 2025-11-17)
- `importCourse` – upstream Golf API returned 401 (invalid key). Replace with valid key and test again.
- `generateSummary` – requires a valid user JWT and a sample round to validate LLM output; LLM provider's API key must be valid.
- Local function serving requires Docker; if you cannot install Docker, run Deno directly or rely on CI-based deploys.

---
If you'd like, I can also generate a GitHub Actions CI workflow that builds and deploys the functions and runs TypeScript checks — this will allow you to skip Docker locally and still test via GitHub-hosted runners.

----
End of file
