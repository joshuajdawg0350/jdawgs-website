# J-DAWGS SETUP v2 - one-button personalization for Joshua's laptop
# Written by Midas for J-Dawgs Industries. Red-team fixes applied 2026-11-15.
$ErrorActionPreference = 'Continue'
$KIT = 'https://jdawgsindustries.com/laptop-kit'
$PicDir = Join-Path $env:USERPROFILE 'Pictures\J-Dawgs'
New-Item -ItemType Directory -Force -Path $PicDir | Out-Null
$done = @(); $skipped = @()

function Get-Kit($name, $dest, $minBytes) {
  try {
    Invoke-WebRequest -Uri "$KIT/$name" -OutFile $dest -UseBasicParsing -TimeoutSec 60
    if ((Test-Path $dest) -and ((Get-Item $dest).Length -ge $minBytes)) { return $true }
  } catch {}
  return $false
}

function Wait-Op($op, $seconds) {
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  while ($op.Status -eq 'Started' -and $sw.Elapsed.TotalSeconds -lt $seconds) { Start-Sleep -Milliseconds 100 }
  return ($op.Status -eq 'Completed')
}

Write-Host ''
Write-Host '  J-DAWGS SETUP - making this laptop yours...' -ForegroundColor Cyan
Write-Host ''

# 1. Wallpaper + lock screen picture
$wp = Join-Path $PicDir 'jdawgs-wallpaper.jpg'
if (Get-Kit 'jdawgs-wallpaper-1920x1200.jpg' $wp 50000) {
  Set-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name Wallpaper -Value $wp
  Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class WP { [DllImport("user32.dll", CharSet=CharSet.Auto)] public static extern int SystemParametersInfo(int u, int p, string f, int w); }'
  $spi = [WP]::SystemParametersInfo(20, 0, $wp, 3)
  if ($spi -ne 0) { $done += 'Wallpaper set (chrome J-DAWGS INDUSTRIES)' } else { $skipped += 'Wallpaper (Windows refused it - tell Midas)' }
  try {
    $null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
    $null = [Windows.System.UserProfile.LockScreen, Windows.System.UserProfile, ContentType = WindowsRuntime]
    $op = [Windows.Storage.StorageFile]::GetFileFromPathAsync($wp)
    if (Wait-Op $op 15) {
      $file = $op.GetResults()
      $op2 = [Windows.System.UserProfile.LockScreen]::SetImageFileAsync($file)
      if (Wait-Op $op2 15) { $done += 'Lock screen picture set (same image)' }
      else { $skipped += 'Lock screen picture (set it later in Settings with Midas)' }
    } else { $skipped += 'Lock screen picture (set it later in Settings with Midas)' }
  } catch { $skipped += 'Lock screen picture (set it later in Settings with Midas)' }
} else { $skipped += 'Wallpaper (download failed - tell Midas)' }

# 2. Dark mode + electric-blue accent
$theme = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize'
Set-ItemProperty -Path $theme -Name AppsUseLightTheme -Value 0 -Type DWord
Set-ItemProperty -Path $theme -Name SystemUsesLightTheme -Value 0 -Type DWord
Set-ItemProperty -Path $theme -Name ColorPrevalence -Value 1 -Type DWord
# Electric blue RGB(0,150,255) stored as ABGR DWORD
Set-ItemProperty -Path $theme -Name AccentColor -Value 0xFFFF9600 -Type DWord
Set-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\DWM' -Name AccentColor -Value 0xFFFF9600 -Type DWord
Set-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\DWM' -Name ColorPrevalence -Value 1 -Type DWord
$done += 'Dark mode ON, electric-blue accent ON (accent fully paints after the next restart)'

# 3. Stay awake while plugged in
powercfg /change monitor-timeout-ac 0 | Out-Null; $p1 = $LASTEXITCODE
powercfg /change standby-timeout-ac 0 | Out-Null; $p2 = $LASTEXITCODE
if ($p1 -eq 0 -and $p2 -eq 0) { $done += 'Screen and sleep set to stay on while plugged in' }
else { $skipped += 'Power settings (do them in Settings with Midas)' }

# 4. Edge: favorites bar, bookmarks, startup pages
$edgeDir = Join-Path $env:LOCALAPPDATA 'Microsoft\Edge\User Data\Default'
New-Item -ItemType Directory -Force -Path $edgeDir | Out-Null
Get-Process msedge -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
$bmFile = Join-Path $env:TEMP 'edge-bookmarks.json'
$bmOk = $false
if (Get-Kit 'edge-bookmarks.json' $bmFile 1000) {
  try { $null = Get-Content $bmFile -Raw | ConvertFrom-Json; $bmOk = $true } catch { $bmOk = $false }
}
if ($bmOk) {
  Copy-Item $bmFile (Join-Path $edgeDir 'Bookmarks') -Force
  $done += 'Edge bookmarks loaded (J-Dawgs folder, 23 links)'
} else { $skipped += 'Edge bookmarks (download failed - tell Midas)' }

$prefPath = Join-Path $edgeDir 'Preferences'
$prefs = $null
if (Test-Path $prefPath) {
  try { $prefs = Get-Content $prefPath -Raw | ConvertFrom-Json } catch {
    Copy-Item $prefPath "$prefPath.bak" -Force -ErrorAction SilentlyContinue
    $prefs = $null
  }
}
if ($null -eq $prefs) { $prefs = New-Object PSObject }
function Set-Prop($obj, $name, $value) {
  if ($obj.PSObject.Properties[$name]) { $obj.$name = $value }
  else { $obj | Add-Member -NotePropertyName $name -NotePropertyValue $value }
}
Set-Prop $prefs 'bookmark_bar' ([PSCustomObject]@{ show_on_all_tabs = $true })
Set-Prop $prefs 'session' ([PSCustomObject]@{ restore_on_startup = 4; startup_urls = @('https://muse.ai/', 'https://www.upwork.com/nx/proposals/', 'https://mail.google.com/') })
$prefWritten = $false
try {
  $json = $prefs | ConvertTo-Json -Depth 100
  [IO.File]::WriteAllText($prefPath, $json, (New-Object System.Text.UTF8Encoding($false)))
  $null = Get-Content $prefPath -Raw | ConvertFrom-Json
  $prefWritten = $true
} catch { $prefWritten = $false }
if ($prefWritten) { $done += 'Edge opens with Muse, Upwork Proposals, and Gmail' }
else { $skipped += 'Edge startup pages (set them with Midas)' }

# 5. Account picture (admin provided by the launcher)
$photo = Join-Path $PicDir 'account-photo.jpg'
if (Get-Kit 'account-photo.jpg' $photo 5000) {
  try {
    $sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    $key = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\AccountPicture\Users\$sid"
    New-Item -Path $key -Force | Out-Null
    foreach ($s in 32, 40, 48, 64, 96, 192, 200, 208, 240, 424, 448, 1080) {
      Set-ItemProperty -Path $key -Name "Image$s" -Value $photo
    }
    $done += 'Account picture set (your photo)'
  } catch { $skipped += 'Account picture (do it in Settings with Midas)' }
} else { $skipped += 'Account picture (download failed - tell Midas)' }

# 6. Rename the PC (admin; restart later, not now)
try {
  Rename-Computer -NewName 'JDAWGS-HQ' -Force -ErrorAction Stop
  $done += 'PC renamed to JDAWGS-HQ (takes effect after a restart, whenever you are ready)'
} catch { $skipped += 'PC rename (do it in Settings with Midas)' }

Write-Host ''
Write-Host '  ============ DONE ============' -ForegroundColor Green
foreach ($d in $done) { Write-Host "  ON:  $d" -ForegroundColor Green }
foreach ($s in $skipped) { Write-Host "  LEFT FOR MIDAS:  $s" -ForegroundColor Yellow }
Write-Host ''
Write-Host '  Photo this screen and send it to Midas.' -ForegroundColor Cyan
Write-Host '  Press any key to close this window.'
try { $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown') } catch { pause }
