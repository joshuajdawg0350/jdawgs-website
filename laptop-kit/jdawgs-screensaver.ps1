# J-DAWGS SCREENSAVER - puts the J-Dawgs Industries brand picture on the laptop screen saver
# Written by Midas for J-Dawgs Industries, 2026-11-15.
$ErrorActionPreference = 'Continue'
$KIT = 'https://jdawgsindustries.com/laptop-kit'
$SsDir = Join-Path $env:USERPROFILE 'Pictures\J-Dawgs\Screensaver'
New-Item -ItemType Directory -Force -Path $SsDir | Out-Null
$done = @(); $skipped = @()

function Get-Kit($name, $dest, $minBytes) {
  try {
    Invoke-WebRequest -Uri "$KIT/$name" -OutFile $dest -UseBasicParsing -TimeoutSec 60
    if ((Test-Path $dest) -and ((Get-Item $dest).Length -ge $minBytes)) { return $true }
  } catch {}
  return $false
}

Write-Host ''
Write-Host '  J-DAWGS SCREENSAVER - putting your picture on the screen saver...' -ForegroundColor Cyan
Write-Host ''

# 1. The brand picture, alone in its own folder (so the Photos screen saver shows only it)
$img = Join-Path $SsDir 'jdawgs-brand.jpg'
if (Get-Kit 'jdawgs-brand.jpg' $img 50000) {
  $done += 'Brand picture saved to Pictures\J-Dawgs\Screensaver'
} else { $skipped += 'Brand picture (download failed - check Wi-Fi and run me again)' }

# 2. Point the Windows Photos screen saver at that folder and switch it on (5 minutes idle)
$scr = Join-Path $env:WINDIR 'System32\PhotoScreensaver.scr'
if (Test-Path $scr) {
  $desk = 'HKCU:\Control Panel\Desktop'
  Set-ItemProperty -Path $desk -Name 'SCRNSAVE.EXE' -Value $scr
  Set-ItemProperty -Path $desk -Name ScreenSaveActive -Value '1'
  Set-ItemProperty -Path $desk -Name ScreenSaveTimeOut -Value '300'
  Set-ItemProperty -Path $desk -Name ScreenSaverIsSecure -Value '0'
  # Best-effort: tell the Photos screen saver which folder to read (harmless if a key is ignored)
  try {
    $pk = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Screensavers\Photos'
    New-Item -Path $pk -Force | Out-Null
    Set-ItemProperty -Path $pk -Name FolderPath -Value $SsDir -ErrorAction SilentlyContinue
  } catch {}
  try {
    $pk2 = 'HKCU:\Software\Microsoft\Windows Photo Viewer\Screensaver'
    New-Item -Path $pk2 -Force | Out-Null
    Set-ItemProperty -Path $pk2 -Name FolderPath -Value $SsDir -ErrorAction SilentlyContinue
  } catch {}
  $done += 'Screen saver ON: Photos, starts after 5 minutes sitting still'
} else { $skipped += 'Screen saver (Photos screen saver not found on this Windows - tell Midas)' }

Write-Host ''
Write-Host '  ============ SCREEN SAVER REPORT ============' -ForegroundColor Cyan
foreach ($d in $done) { Write-Host "  DONE: $d" -ForegroundColor Green }
foreach ($s in $skipped) { Write-Host "  NOT DONE: $s" -ForegroundColor Yellow }
Write-Host ''
Write-Host '  TO SEE IT NOW: Settings > Personalization > Lock screen >'
Write-Host '  Screen saver settings > tap Preview.'
Write-Host '  If Preview shows other pictures instead of the J-Dawgs storefront,'
Write-Host '  photo that screen and send it to Midas - one more setting to point.'
Write-Host ''
pause
