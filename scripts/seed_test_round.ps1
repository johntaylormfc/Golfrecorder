<#
Seed a small test round, round_holes and shots into the remote Supabase DB using the Service Role key.

Usage: Set environment variables or supply an `Auth.txt` file with `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, etc. Example:
$env:SUPABASE_SERVICE_ROLE_KEY = '...'
$env:SUPABASE_URL = 'https://<project>.supabase.co'

Then run:
.

#>
param(
    [string]$EnvFilePath = '.\\Auth.txt'
)

# Load env file if present
if (Test-Path $EnvFilePath) {
    Get-Content $EnvFilePath | ForEach-Object {
        if ($_ -match "^\s*\$env:([^\s=]+)\s*=\s*'(.*)'") {
            $name = $matches[1]; $value = $matches[2]; $env:$name = $value
        }
    }
}

if (-not $env:SUPABASE_URL -or -not $env:SUPABASE_SERVICE_ROLE_KEY) {
    Write-Error "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment or via Auth.txt before running"
    exit 1
}
$url = $env:SUPABASE_URL.TrimEnd('/')
$service = $env:SUPABASE_SERVICE_ROLE_KEY

# Create or find a profile
$profileBody = @{ id = (New-Guid).Guid; display_name = 'Dev Tester'; handedness = 'right'; handicap_index = 18 } | ConvertTo-Json
$profileRes = curl -s -X POST "$url/rest/v1/profiles" -H "apikey: $service" -H "Authorization: Bearer $service" -H "Content-Type: application/json" -d $profileBody -w "\nHTTP:%{http_code}"
Write-Output "Profile creation: $profileRes"
$profile = $profileBody | ConvertFrom-Json

# Create a course
$courseBody = @{ external_id = 'dev-course-1'; name = 'Dev Course'; city = 'DevVille'; country = 'Local'; metadata = @{} } | ConvertTo-Json
$courseRes = curl -s -X POST "$url/rest/v1/courses" -H "apikey: $service" -H "Authorization: Bearer $service" -H "Content-Type: application/json" -d $courseBody -w "\nHTTP:%{http_code}"
Write-Output "Course creation: $courseRes"

# Insert a tee
$teeBody = @{ course_id = 'dev-course-1'; tee_name = 'Blue'; tee_color = 'blue'; yardages = @{ total=6500 } } | ConvertTo-Json
$teeRes = curl -s -X POST "$url/rest/v1/course_tees" -H "apikey: $service" -H "Authorization: Bearer $service" -H "Content-Type: application/json" -d $teeBody -w "\nHTTP:%{http_code}"
Write-Output "Tee creation: $teeRes"

# Create a round
$roundGuid = (New-Guid).Guid
$roundBody = @{ id = $roundGuid; user_id = $profile.id; course_id = 'dev-course-1'; tee_id = 'Blue'; holes_played = 18; started_at = (Get-Date).ToString('s') } | ConvertTo-Json
$roundRes = curl -s -X POST "$url/rest/v1/rounds" -H "apikey: $service" -H "Authorization: Bearer $service" -H "Content-Type: application/json" -d $roundBody -w "\nHTTP:%{http_code}"
Write-Output "Round creation: $roundRes"

# Create round holes (par 4 for 1..18)
$holes = for ($i=1; $i -le 18; $i++) { @{ round_id = $roundGuid; hole_number = $i; par = 4 } }
$holesBody = $holes | ConvertTo-Json
$holeRes = curl -s -X POST "$url/rest/v1/round_holes" -H "apikey: $service" -H "Authorization: Bearer $service" -H "Content-Type: application/json" -d $holesBody -w "\nHTTP:%{http_code}"
Write-Output "Round holes: $holeRes"

# Insert a single shot (hole 1 tee shot)
$shotBody = @{ round_id = $roundGuid; round_hole_number = 1; shot_number = 1; club = 'Driver'; distance = 270; x = 0; y = 0 } | ConvertTo-Json
$shotRes = curl -s -X POST "$url/rest/v1/shots" -H "apikey: $service" -H "Authorization: Bearer $service" -H "Content-Type: application/json" -d $shotBody -w "\nHTTP:%{http_code}"
Write-Output "Shot insert response: $shotRes"

Write-Output "Round seeded with id: $roundGuid"
Write-Output "You can now call generateSummary for this round by passing the appropriate user JWT (or use the service role in a test)."
