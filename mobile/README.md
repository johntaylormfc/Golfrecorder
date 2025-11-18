# Mobile App (Expo + TypeScript)

This is the planned React Native + Expo client for GolfRecorder.

## Environment variables (dev / runtime)
- `EXPO_PUBLIC_SUPABASE_URL` – Supabase URL (public, used on client for Supabase JS client)
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` – Supabase anon key
- `GOLF_API_EDGE_URL` – The base URL for the course search edge functions (e.g., https://<project>.supabase.co/functions/v1)
- `EXPO_APP_API_URL` – If you host an API or Edge Functions, use that URL here for uploads/generation.
- For local development: use `.env` file; do NOT commit keys to source control.
- After checking out: run `npm install` in this folder to install dependencies, including `react-native-markdown-display`.

## Project structure (recommended)
- `src/screens` – screens such as `ProfileScreen`, `StartRoundScreen`, `PlayRoundScreen`, `RoundSummaryScreen`, `RoundsHistoryScreen`.
- `src/components` – common UI components (ShotList, ShotItem, ShotEntryModal, HoleCard).
- `src/services` – wrapper around Supabase client and API calls.
- `src/types.ts` – shared types (see `mobile/src/types.ts`).

## Quick Android emulator setup (Windows)

If you don't have an AVD (emulator), a helper script is included to help install needed tools and start an emulator.

From PowerShell in the `mobile` folder run:

```powershell
cd "c:\VSCode Apps\Golfrecorder\mobile"
.\scripts\start-android-emulator.ps1
```

The script will install command-line tools, the emulator, a system image (Android 31 x86_64), create an AVD `GolfRecorder_AVD`, and start it.
It requires a JDK on the `PATH` (or `JAVA_HOME`) so `sdkmanager` and `avdmanager` can run—install a JDK such as Corretto/AdoptOpenJDK and set `JAVA_HOME` before running it.
Example PowerShell commands (adjust the versioned folder to whatever you installed):
```powershell
setx JAVA_HOME "C:\Program Files\Amazon Corretto\jdk17.0.17_10"
$env:JAVA_HOME = "C:\Program Files\Amazon Corretto\jdk17.0.17_10"
$env:PATH += ";$env:JAVA_HOME\bin"
java -version
```
Restart PowerShell after `setx` so the variable persists, then rerun the helper script.
It will wait for the emulator to boot before returning.

Note: the script downloads large files (several hundred MB) and may take several minutes depending on your connection.

### Resetting the GolfRecorder AVD

If the emulator becomes stuck (`adb` reports `device offline` or the helper script fails to boot because a snapshot is corrupt), run the cleanup helper to delete the cached snapshot images and start a cold boot:

```powershell
cd "c:\VSCode Apps\Golfrecorder\mobile"
.\scripts\reset-android-avd.ps1 -StartAfterCleanup
```

The script removes snapshot/cache files from `%USERPROFILE%\.android\avd\GolfRecorder_AVD.avd` and then launches the emulator with `-no-snapshot-load` so the device boots from the base image. Run it again without `-StartAfterCleanup` if you only need to scrub the snapshot before manually starting the emulator in Android Studio or the command line.

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

