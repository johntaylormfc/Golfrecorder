# Simple script to add a test course via Supabase REST API
# Run this after setting up your Supabase project

$url = "https://ppgeznlkzkkttlkgvgfv.supabase.co"
$anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwZ2V6bmxremtrdHRsa2d2Z2Z2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzNzM5MzMsImV4cCI6MjA3ODk0OTkzM30.xIhx2uZxqjHrx6Dn2c1dnKRDVapoRLEbgR4KrIUMXDs"

Write-Host "Adding test course..."

# Create a test course
$courseBody = @{
    name = "Pine Valley Golf Club"
    city = "Pine Valley"
    region = "New Jersey"
    country = "USA"
    external_id = "test-course-1"
    metadata = @{}
} | ConvertTo-Json

$headers = @{
    "apikey" = $anonKey
    "Authorization" = "Bearer $anonKey"
    "Content-Type" = "application/json"
    "Prefer" = "return=representation"
}

try {
    $courseResponse = Invoke-RestMethod -Uri "$url/rest/v1/courses" -Method Post -Headers $headers -Body $courseBody
    Write-Host "Course created successfully!" -ForegroundColor Green
    Write-Host "Course ID: $($courseResponse.id)"
    
    # Create tees for the course
    $tees = @(
        @{ course_id = $courseResponse.id; tee_name = "Black"; tee_color = "Black"; rating = 74.5; slope = 155 },
        @{ course_id = $courseResponse.id; tee_name = "Blue"; tee_color = "Blue"; rating = 72.0; slope = 145 },
        @{ course_id = $courseResponse.id; tee_name = "White"; tee_color = "White"; rating = 69.5; slope = 135 },
        @{ course_id = $courseResponse.id; tee_name = "Red"; tee_color = "Red"; rating = 67.0; slope = 125 }
    )
    
    foreach ($tee in $tees) {
        $teeBody = $tee | ConvertTo-Json
        $teeResponse = Invoke-RestMethod -Uri "$url/rest/v1/course_tees" -Method Post -Headers $headers -Body $teeBody
        Write-Host "Created tee: $($tee.tee_name)" -ForegroundColor Cyan
    }
    
    Write-Host "`nTest course and tees added successfully!" -ForegroundColor Green
    Write-Host "You can now search for 'Pine Valley' in the app."
    
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host "Response: $($_.Exception.Response)" -ForegroundColor Red
}
