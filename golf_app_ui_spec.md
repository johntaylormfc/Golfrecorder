# Golf Shot Tracking App – UI / Product Spec

## Overview

**Purpose:** Mobile app for a single golfer to record shots during a round, store them in Supabase, and generate an AI-powered round summary at the end.

**Key Integrations:**
- **Supabase**: persistence (profiles, courses, rounds, shots, etc.).
- **golfcourseapi.com**: course / tee / hole details via backend (Supabase Edge Functions or another server).
- **LLM (e.g. GPT-4.x)**: generates round summaries using the prompt in `round_summary_prompt.md`.

Core fields are always visible. Additional performance details live behind an **“Advanced”** section on the shot-entry screen.

---

## Entities

### Player Profile

Stored in `profiles`.

- `display_name`
- `handicap_index` (optional)
- `handedness` (`right` | `left`)
- `uses_advanced_entry` (boolean, default false)

### Course Data

Partly loaded from `golfcourseapi.com` and cached in Supabase.

- `courses`: basic course info.
- `course_tees`: tee sets per course (name, rating, slope).
- `course_holes`: per-hole data (par, stroke index, lengths).

### Round & Shots

- `rounds`: one per played round.
- `round_holes`: per-hole aggregates for that round (score, putts, FIR, GIR, etc.).
- `shots`: detailed shot-by-shot records.

---

## Screens & Flows

### 1. Onboarding / Profile

**Screen:** “Welcome” / “Set up your profile”

Fields:
- Name / nickname (text input)
- Handedness (toggle buttons: Right / Left)
- Handicap index (optional numeric input)
- “Use advanced shot details by default?” (switch)

Actions:
- Save to `profiles`.
- Navigate to “Start a Round”.

---

### 2. Start a Round – Course & Tee Selection

**Screen:** “Start a Round”

Sections:

1. **Course Search**
   - Search input for name.
   - “Near me” button (uses GPS).
   - Backend calls `golfcourseapi.com` via a secured function, returning:
     - Course name, location
     - Tees
     - Hole data (par, yardages, stroke index)
   - Results displayed as a list of cards:
     - Course name
     - City / region
     - Distance from current location (if available)

2. **Tee Selection**
   - Once a course is selected:
     - Show list of tees (from `course_tees`):
       - Tee name (White/Blue/etc.)
       - Rating / slope if available
   - User chooses one tee set.

3. **Start Round Button**
   - On tap:
     - Create `rounds` entry in Supabase with:
       - `user_id`, `course_id`, `tee_id`, `started_at`, `status = in_progress`.
     - Preload course data for quick access.
     - Navigate to “Play Hole 1”.

---

### 3. Round In-Progress – Play Screen

**Screen:** “Play Hole X”

Header:
- Course name
- Hole number (e.g. “Hole 5”)
- Par
- Stroke index
- Tee yardage for this hole

Main content:
- **Current score chip:**
  - Example: “+3 thru 5”
- **Hole card:**
  - “Hole 5 – Par 4 – 380 yards”
  - List of shots logged on this hole so far:
    - “1: Driver – Fairway – 145 yds left”
    - “2: 7i – Green – 20 ft”
    - “3: Putt – Holed”
- Primary CTA: **“Add shot”** (opens shot entry).

Footer:
- Buttons:
  - “Next hole” (only active when the hole is marked complete – either by a shot with `holed = true` or explicit confirmation).
  - “End round” (with confirmation dialog).

---

### 4. Shot Entry – Core Fields (Always Visible)

**Interaction:** Tapping “Add shot” opens a modal/bottom sheet.

Display:
- Title: “Shot 2 – Hole 5” (shot number auto-calculated).

Core fields (fast to enter, minimal typing):

1. **Shot Category** (auto-derived but editable)
   - Default logic:
     - Shot 1 on par 4/5 → `tee`
     - On green → `putt`
     - < ~50m and not on green → `around_green`
     - Else → `approach`
   - UI: segmented control: [Tee] [Approach] [Around green] [Putt]

2. **Start Lie**
   - Options as chips:
     - Tee, Fairway, First cut, Rough (light/heavy), Bunker (F/G), Fringe, Green, Recovery

3. **Club**
   - Scrollable chip list:
     - D, 3W, 5W, H, 4I–9I, PW, GW, SW, LW, Putter

4. **Start Distance to Hole**
   - Numeric input with +/- stepper.
   - Defaults:
     - Tee shots: hole yardage.
     - Other shots: previous `end_distance_to_hole`.

5. **End Lie**
   - Same options as Start Lie.

6. **End Distance to Hole**
   - For non-putts: numeric input in same unit as start distance.
   - For putts: label as “Next putt distance (ft/m)”.
   - If holed, set distance to 0.

7. **Result Zone**
   - Quick classification:
     - Fairway, Left rough, Right rough, Green, Bunker, Penalty, OB, Recovery.
   - Can be partly inferred from `end_lie` and penalty, but user override is allowed.

8. **Penalties**
   - Toggle: “Penalty on this shot?” [No/Yes].
   - If Yes:
     - `penalty_strokes`: 1 or 2.
     - `penalty_type`: OB / Lost ball / Water / Unplayable / Other.

9. **Holed?**
   - Checkbox / switch: “Ball holed on this shot”.
   - If checked:
     - The app treats the hole as complete (score can be aggregated).

Buttons at bottom:
- Secondary: **“Advanced details”** (expands panel).
- Primary: **“Save shot”** (validates required fields, closes modal, refreshes hole view).

---

### 5. Shot Entry – Advanced Panel (Optional)

When the user taps **“Advanced details”**, show additional optional fields grouped in sections.

#### 5.1 Strike & Shape

- **Contact Quality:**
  - Pure, Slightly thin, Slightly fat, Heavy, Topped, Shank.
- **Shot Shape:**
  - Straight, Intended draw, Intended fade, Push, Pull, Hook (overdraw), Slice (overslice).
- **Trajectory:**
  - Low, Normal, High.

#### 5.2 Error vs Target

- **Distance Error:**
  - Very short, Slightly short, On distance, Slightly long, Very long.
- **Lateral Error:**
  - Far left, Left, On line, Right, Far right.

#### 5.3 Difficulty & Decision

- **Difficulty Rating:** 1–5 slider.
- **Decision Quality:** Good / Aggressive but OK / Poor.
- **Mental Tag:** Calm / Rushed / Distracted / Nervous / Other.

#### 5.4 Putting Details

Visible only when `shot_category = putt`.

- **Start Distance:** pre-filled from core distance.
- **Break:** Left-to-right / Right-to-left / Straight.
- **Slope:** Uphill / Downhill / Flat.
- **Miss Side:** Short / Long / Low side / High side (only if not holed).
- **Green Surface:** Normal / Smooth / Bumpy / Very fast / Very slow.

#### 5.5 Conditions

- **Wind Strength:** Calm / Light / Moderate / Strong.
- **Wind Direction (relative):** Into / Down / Cross-left / Cross-right / Variable.
- **Lie Severity:** Perfect / OK / Poor.

Bottom button:
- **“Save shot”** (same behaviour as in core view).

---

### 6. Hole Summary View

When a hole is completed (holed shot recorded or user confirms completion):

**Mini “Hole Summary” card:**
- Hole X – Par N
- Gross score and relation to par (e.g. “5 (+1)”).
- Putts count.
- FIR (for par 4/5, boolean indicator).
- GIR (boolean indicator).
- Penalties on that hole.

Actions:
- “Edit shots” (reopens shot list / specific shot entry to correct errors).

On completion, the app updates `round_holes` and/or cached stats for the round.

---

### 7. End Round & Round Summary

**Trigger:** User taps “End round” (or automatically when hole 18 is completed and user confirms).

**Screen:** “Round Summary”

Header:
- Course name, tee name.
- Date/time.
- Overall score: “86 (+14) over 18 holes”.

**Stats Section:**
- **Tee shots:**
  - Fairways hit / possible.
  - Common miss side (left/right/other).
- **Approaches:**
  - GIR count and percentage.
  - Simple distance buckets (e.g. 0–100, 100–150, 150–200).
- **Short game:**
  - Up-and-down percentage.
  - Sand save percentage.
- **Putting:**
  - Putts per round and per hole.
  - 3-putt count and percentage.
  - Make percentages by distance bucket (if you compute them).

**AI Summary Section:**
- Button: **“Generate AI round summary”**.
  - Agent fetches `round`, `round_holes`, `shots` for that round from Supabase.
  - Agent builds JSON as described in `round_summary_prompt.md`.
  - Agent calls the LLM with:
    - System prompt = the coaching instructions.
    - User prompt = template with embedded JSON.
- Display the LLM’s Markdown output with headings such as:
  - Overall
  - Tee Shots
  - Approaches
  - Short Game
  - Putting
  - Key Patterns
  - 3–5 Things to Work On

Optionally:
- Store AI summary Markdown on `rounds.ai_summary_markdown` so it can be shown later without a new LLM call.

---

### 8. History – Past Rounds

**Screen:** “My Rounds”

- List of cards, each representing a past round:
  - Course name.
  - Date.
  - Score vs par.
  - Holes played (9/18).
  - Small stat snippet (e.g. FIR/GIR/putts).

Tap a card:
- Opens full **Round Summary** screen for that round:
  - Stats, hole list, shots (optionally).
  - Previously generated AI summary (or option to generate if none).

---

## Notes for the AI Agent

- Use the Supabase MCP server to:
  - Read/write profile, rounds, holes, shots, and AI summaries.
  - Cache courses and tees received from `golfcourseapi.com`.
- Use a secure backend or Edge Function to call `golfcourseapi.com`; do not expose the golf API key directly in the client.
- For the LLM:
  - Prefer a strong reasoning + writing model (e.g. GPT-4.x) for the round summary.
  - Use the prompt and JSON shape defined in `round_summary_prompt.md`.
