# Mobile App (Expo + TypeScript)

This is the planned React Native + Expo client for GolfRecorder.

## Environment variables (dev / runtime)
- `EXPO_PUBLIC_SUPABASE_URL` – Supabase URL (public, used on client for Supabase JS client)
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` – Supabase anon key
- `GOLF_API_EDGE_URL` – The base URL for the course search edge functions (e.g., https://<project>.supabase.co/functions/v1)
- `EXPO_APP_API_URL` – If you host an API or Edge Functions, use that URL here for uploads/generation.
- For local development: use `.env` file; do NOT commit keys to source control.

## Project structure (recommended)
- `src/screens` – screens such as `ProfileScreen`, `StartRoundScreen`, `PlayRoundScreen`, `RoundSummaryScreen`, `RoundsHistoryScreen`.
- `src/components` – common UI components (ShotList, ShotItem, ShotEntryModal, HoleCard).
- `src/services` – wrapper around Supabase client and API calls.
- `src/types.ts` – shared types (see `mobile/src/types.ts`).

## Key libraries
- `expo` / `react-native` / `typescript`
- `@supabase/supabase-js` – client SDK
- `react-navigation` – navigation stack
- `react-native-modal` – for the `ShotEntryModal`

## Flows to implement first (MVP)
1. Onboarding/profile creation
2. Course search via `GOLF_API_EDGE_URL` and tee selection
3. Create round and play hole screen
4. Add shot UI and store shots in Supabase
5. End round; show stats; call `POST /rounds/:id/generate_summary` edge function to generate and show AI summary

