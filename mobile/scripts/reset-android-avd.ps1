<#
Helper script to remove stale snapshots and restart the AVD in a cold state.
#>

param(
  [string]$AvdName = 'GolfRecorder_AVD',
  [switch]$StartAfterCleanup
)

Set-StrictMode -Version Latest

$userHome = (Get-Item $HOME).FullName
$avdRoot = Join-Path $userHome '.android\avd'
$avdDir = Join-Path $avdRoot "$AvdName.avd"

if (-not (Test-Path $avdDir)) {
  Write-Error "AVD '$AvdName' not found under $avdRoot. Run the emulator helper script first."
  exit 1
}

Write-Output "Cleaning snapshot cache for $AvdName..."

$patterns = @('snapshot_*', 'cache.img', 'cache.img.lock', 'cache.img.lock.*', 'cache.img.lock')
foreach ($pattern in $patterns) {
  Get-ChildItem -Path $avdDir -Filter $pattern -File -ErrorAction SilentlyContinue | Remove-Item -Force
}

# Remove temporary lock files and misc snapshots
Get-ChildItem -Path $avdDir -Include '*.lock', 'snapshots.img', 'userdata-qemu.img.lock' -File -ErrorAction SilentlyContinue | Remove-Item -Force

Write-Output "Snapshot cache removed. You can now start the emulator with a cold boot."

if ($StartAfterCleanup) {
  $emulator = Join-Path $env:ANDROID_SDK_ROOT 'emulator\emulator.exe'
  if (-not (Test-Path $emulator)) {
    Write-Error 'emulator binary not found. Ensure $ANDROID_SDK_ROOT is set and the emulator component is installed.'
    exit 1
  }
  Write-Output "Starting emulator $AvdName with -no-snapshot-load"
  Start-Process -NoNewWindow -FilePath $emulator -ArgumentList '-avd', $AvdName, '-no-snapshot-load'
}
