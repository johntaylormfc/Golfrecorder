# PowerShell deployment script for GolfRecorder Supabase resources
# Usage: Run in PowerShell as:
#   $env:SUPABASE_PROJECT_REF = '<project-ref>'
#   $env:SUPABASE_ACCESS_TOKEN = '<token from supabase account>'
#   $env:SUPABASE_SERVICE_ROLE_KEY = '<service role key>'
#   $env:GOLF_API_KEY = '<golf api key>'
#   $env:LLM_API_KEY = '<llm api key>'
#   pwsh ./deploy/deploy-supabase.ps1

$ErrorActionPreference = 'Stop'

Write-Output "Starting or validating Supabase CLI..."

# Check for supabase CLI
try {
    $supabaseVersion = supabase --version 2>$null
} catch {
    Write-Output "Supabase CLI not found. Installing globally via npm..."
    npm install -g supabase
}

Write-Output "Supabase CLI version:"
supabase --version

if (-not ($env:SUPABASE_PROJECT_REF) -or -not ($env:SUPABASE_ACCESS_TOKEN)) {
    Write-Error "Missing SUPABASE_PROJECT_REF or SUPABASE_ACCESS_TOKEN environment variables. Set them and re-run."
    exit 1
}

Write-Output "Logging into Supabase CLI using provided token..."
supabase login --token $env:SUPABASE_ACCESS_TOKEN

Write-Output "Linking to project: $env:SUPABASE_PROJECT_REF"
supabase link --project-ref $env:SUPABASE_PROJECT_REF

# Run the SQL file using psql via `supabase db shell` (safe option)
Write-Output "Applying SQL schema from supabase_schema.sql..."

# Option 1: If user has local psql and a connection string
if ($env:SUPABASE_DB_URL) {
    Write-Output "Using SUPABASE_DB_URL to run psql..."
    $sqlFile = Join-Path -Path $PSScriptRoot -ChildPath "..\supabase_schema.sql"
    psql $env:SUPABASE_DB_URL -f $sqlFile
} else {
    Write-Output "No SUPABASE_DB_URL found; attempting to run the SQL via the Supabase CLI query"
    $sql = Get-Content -Path (Join-Path -Path $PSScriptRoot -ChildPath "..\supabase_schema.sql") -Raw
    supabase db query --sql $sql
}

Write-Output "Deploying Edge Functions..."
cd (Join-Path -Path $PSScriptRoot -ChildPath "..\edge_functions")

# If not already, initialize npm package.json for each function folder as needed.

# Deploy importCourse (if file exists)
if (Test-Path "./importCourse.ts") {
    Write-Output "Deploying importCourse function..."
    supabase functions deploy importCourse --project-ref $env:SUPABASE_PROJECT_REF
}
if (Test-Path "./generateSummary.ts") {
    Write-Output "Deploying generateSummary function..."
    supabase functions deploy generateSummary --project-ref $env:SUPABASE_PROJECT_REF
}

Write-Output "Set secrets for functions (GOLF_API_KEY, SUPABASE_SERVICE_ROLE_KEY, LLM API keys) ..."

# Set secrets for the functions
if ($env:GOLF_API_KEY) {
    supabase secrets set GOLF_API_KEY=$env:GOLF_API_KEY --project-ref $env:SUPABASE_PROJECT_REF
}
if ($env:SUPABASE_SERVICE_ROLE_KEY) {
    supabase secrets set SUPABASE_SERVICE_ROLE_KEY=$env:SUPABASE_SERVICE_ROLE_KEY --project-ref $env:SUPABASE_PROJECT_REF
}
if ($env:LLM_API_KEY) {
    supabase secrets set LLM_API_KEY=$env:LLM_API_KEY --project-ref $env:SUPABASE_PROJECT_REF
}

Write-Output "Deployment finished (check the Supabase dashboard for function logs and SQL console)"
