<#
Creates a test user using the Supabase admin API and returns a JWT access token for the user.

Usage: dot-source this script from PowerShell or run directly after editing the `EnvFilePath` var or setting environment variables.

This script requires these environment variables to be present:
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY (service role)
- SUPABASE_ANON_KEY (project anon key) [not strictly required if service role is used]

#>

param(
    [string]$EnvFilePath = '.\\Auth.txt'
)

# Try to import env variables from file if it exists
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

$service = $env:SUPABASE_SERVICE_ROLE_KEY
$url = $env:SUPABASE_URL.TrimEnd('/')

$email = "devuser+$(Get-Random -Maximum 99999)@example.com"
$password = "TestP@ssw0rd!"

# Create a confirmed user (admin endpoint)
$body = @{ email = $email; password = $password; email_confirm = $true } | ConvertTo-Json
$create = curl -s -X POST "$url/auth/v1/admin/users" -H "apikey: $service" -H "Authorization: Bearer $service" -H "Content-Type: application/json" -d $body -w "\nHTTP:%{http_code}"
Write-Output "Create response: $create"

# Now sign-in to get a token
$form = "grant_type=password&email=$($email)&password=$($password)"
$tokenResp = curl -s -X POST "$url/auth/v1/token" -H "apikey: $service" -H "Content-Type: application/x-www-form-urlencoded" -d $form -w "\nHTTP:%{http_code}"
Write-Output "Token response: $tokenResp"

# Helpful export lines (copy/paste)
Write-Output "If successful, you can export this as an env var for local testing:"
$o = $tokenResp | ConvertFrom-Json -ErrorAction SilentlyContinue
if ($o -and $o.access_token) { Write-Output "export ACCESS_TOKEN=$($o.access_token)" } else { Write-Output "No token returned; check the responses above" }
