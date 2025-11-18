<#
Automated emulator setup script for Windows (PowerShell)

This script will:
 - Ensure `ANDROID_SDK_ROOT` is set
 - Ensure the Android command-line tools are present (download + install if missing)
 - Use `sdkmanager` to install platform-tools, emulator, and a system image
 - Create an AVD named `GolfRecorder_AVD` if one does not already exist
 - Start the emulator and wait for it to be ready

Run this script from the `mobile` folder with PowerShell (run as user):
  cd "c:\VSCode Apps\Golfrecorder\mobile"
  .\scripts\start-android-emulator.ps1

Note: this will download large files. It requires the host to have internet access.
#>

# Strict mode
[CmdletBinding()]
param(
  [switch]$NoSnapshotLoad
)
Set-StrictMode -Version Latest

# Default SDK path (used in this repo); override by setting ANDROID_SDK_ROOT env var
$defaultSdk = "C:\Users\john\AppData\Local\Android\Sdk"
if (-not $env:ANDROID_SDK_ROOT) { $env:ANDROID_SDK_ROOT = $defaultSdk }

$SdkRoot = $env:ANDROID_SDK_ROOT
Write-Output "Using Android SDK: $SdkRoot"

function Assert-JavaAvailable {
  if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
    Write-Error 'Java runtime not found. Install a JDK and set JAVA_HOME (e.g., `setx JAVA_HOME "C:\\Program Files\\Amazon Corretto\\jdk17.0.9"`), then restart PowerShell.'
    exit 1
  }
}

Assert-JavaAvailable

# Add emulator and platform-tools to PATH for the current session
$toolsPaths = @(
  "$SdkRoot\emulator",
  "$SdkRoot\platform-tools"
)
foreach ($p in $toolsPaths) {
  if (Test-Path $p -PathType Container) {
    if (-not ($env:PATH -split ';' | Where-Object { $_ -eq $p })) {
      Write-Output "Adding $p to PATH"
      $env:PATH += ";$p"
    }
  }
}

function Install-CommandLineTools {
  $zipUrl = "https://dl.google.com/android/repository/commandlinetools-win-9477386_latest.zip" # latest Windows as of 2025-11; you can update
  $targetDir = Join-Path $SdkRoot "cmdline-tools\latest"
  if (Test-Path (Join-Path $targetDir 'bin\sdkmanager.bat')) {
    Write-Output "Command-line tools already installed at $targetDir"
    return $true
  }
  Write-Output "Downloading Android command-line tools from $zipUrl"
  $tmpZip = Join-Path $env:TEMP "cmdline-tools.zip"
  Invoke-WebRequest -Uri $zipUrl -OutFile $tmpZip -UseBasicParsing
  if (-not (Test-Path $tmpZip)) { Write-Error "Failed to download command-line tools"; return $false }
  Expand-Archive -Path $tmpZip -DestinationPath (Join-Path $SdkRoot 'cmdline-tools') -Force
  # The zip will extract into cmdline-tools\bin/ ... but we want cmdline-tools\latest
  # Move extracted directory to latest
  $extracted = Get-ChildItem -Path (Join-Path $SdkRoot 'cmdline-tools') -Directory | Where-Object { $_.Name -ne 'latest' }
  if ($extracted) {
    Move-Item -Path $extracted[0].FullName -Destination $targetDir -Force
  }
  Remove-Item $tmpZip -Force
  if (Test-Path (Join-Path $targetDir 'bin\sdkmanager.bat')) { Write-Output 'Command-line tools installed'; return $true }
  Write-Error 'Command-line tools not found after download'; return $false
}

# Path to emulator binary
$emulator = Join-Path $SdkRoot 'emulator\emulator.exe'

# Ensure sdkmanager is available
if (-not (Test-Path (Join-Path $SdkRoot 'cmdline-tools\latest\bin\sdkmanager.bat'))) {
  Write-Output "sdkmanager not found - downloading Android command-line tools now."
  Install-CommandLineTools | Out-Null
}

# Path to sdkmanager
$sdkmanager = Join-Path $SdkRoot 'cmdline-tools\latest\bin\sdkmanager.bat'
if (-not (Test-Path $sdkmanager)) {
  Write-Error 'sdkmanager not found. Please install Android Studio or the command-line tools manually.'
  exit 1
}

# Install platform-tools (if missing), emulator, and at least one system image
Write-Output "Ensuring required SDK components are installed..."
& $sdkmanager --install "platform-tools" "emulator" "platforms;android-33" --sdk_root=$SdkRoot --no_https --verbose

$systemImageCandidates = @(
  @{ Id = 'system-images;android-36.1;google_apis_playstore;x86_64'; Path = 'system-images\android-36.1\google_apis_playstore\x86_64'; Device = 'pixel_4' },
  @{ Id = 'system-images;android-36.1;google_apis;x86_64'; Path = 'system-images\android-36.1\google_apis\x86_64'; Device = 'pixel_4' },
  @{ Id = 'system-images;android-33;google_apis;x86_64'; Path = 'system-images\android-33\google_apis\x86_64'; Device = 'pixel_4' },
  @{ Id = 'system-images;android-31;google_apis;x86_64'; Path = 'system-images\android-31\google_apis\x86_64'; Device = 'pixel_4' }
)

$installedSystemImage = $null
foreach ($candidate in $systemImageCandidates) {
  Write-Output "Installing system image $($candidate.Id)"
  & $sdkmanager --install $candidate.Id --sdk_root=$SdkRoot --no_https --verbose | Out-String | Write-Output
  if (Test-Path (Join-Path $SdkRoot $candidate.Path)) {
    $installedSystemImage = $candidate
    break
  }
}

if (-not $installedSystemImage) {
  Write-Error "Failed to install any compatible system image. Check SDK availability and rerun the script."
  exit 1
}

# Accept licenses if present
Write-Output "Accepting SDK licenses..."
[System.Console]::WriteLine('Accepting licenses now. Press Ctrl-C to cancel if needed.')
$licenseAnswers = (1..30) | ForEach-Object { 'y' }
$licenseAnswers | & $sdkmanager --licenses --sdk_root=$SdkRoot

# Ensure avdmanager exists (comes with cmdline-tools or tools)
$avdmanager = Join-Path $SdkRoot 'cmdline-tools\latest\bin\avdmanager.bat'
if (-not (Test-Path $avdmanager)) {
  $avdmanager = Join-Path $SdkRoot 'tools\bin\avdmanager.bat'
}

if (-not (Test-Path $avdmanager)) {
  # avdmanager may live in tools\bin if installed with Android Studio; try to find it.
  $found = Get-ChildItem -Path $SdkRoot -Filter 'avdmanager.bat' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($found) { $avdmanager = $found.FullName }
}

if (-not (Test-Path $avdmanager)) {
  Write-Error 'avdmanager not found. Please install Android Studio or the full SDK tools.'
  exit 1
}

# Create AVD (if not exists)
$avdName = 'GolfRecorder_AVD'
# List AVDs
$existing = & $emulator -list-avds 2>$null
if ($existing -and $existing -match $avdName) {
  Write-Output "AVD $avdName already exists"
} else {
  Write-Output "Creating AVD: $avdName"
  & $avdmanager create avd -n $avdName -k $installedSystemImage.Id --force --device $installedSystemImage.Device --sdcard 512M
}

# Start emulator
Write-Output "Starting emulator $avdName with swiftshader_indirect." 
$emulatorArgs = @("-avd", $avdName, "-gpu", "swiftshader_indirect")
if ($NoSnapshotLoad.IsPresent) {
  Write-Output "Adding -no-snapshot-load to emulator args."
  $emulatorArgs += "-no-snapshot-load"
}
Start-Process -NoNewWindow -FilePath $emulator -ArgumentList $emulatorArgs

# Wait for boot
Write-Output "Waiting for emulator to boot..."
while ($null -eq (adb devices | Select-String 'device')) {
  Start-Sleep -Seconds 2
}
& adb wait-for-device | Out-Null

# Now wait for the system boot property
while ($true) {
  $bootProp = adb -s emulator-5554 shell getprop sys.boot_completed 2>$null
  if ($bootProp) {
    if ($bootProp.Trim() -eq '1') { break }
  }
  Start-Sleep -Seconds 2
}

Write-Output "Emulator is ready. Run 'npx expo start --android' or press 'a' in the Metro bundler to open the app." 
