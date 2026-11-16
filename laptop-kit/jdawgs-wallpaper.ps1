# J-DAWGS WALLPAPER - puts the J-Dawgs Industries brand picture on the desktop background
# Written by Midas for J-Dawgs Industries, 2026-11-15. Joshua asked for the picture
# "on the front of my computer" - this is that picture, as the desktop wallpaper.
$ErrorActionPreference = 'Continue'
$KIT = 'https://jdawgsindustries.com/laptop-kit'
$WpDir = Join-Path $env:USERPROFILE 'Pictures\J-Dawgs'
New-Item -ItemType Directory -Force -Path $WpDir | Out-Null
$done = @(); $skipped = @()

function Get-Kit($name, $dest, $minBytes) {
  try {
    Invoke-WebRequest -Uri "$KIT/$name" -OutFile $dest -UseBasicParsing -TimeoutSec 60
    if ((Test-Path $dest) -and ((Get-Item $dest).Length -ge $minBytes)) { return $true }
  } catch {}
  return $false
}

Write-Host ''
Write-Host '  J-DAWGS WALLPAPER - putting your picture on the front of the computer...' -ForegroundColor Cyan
Write-Host ''

# 1. The brand picture
$img = Join-Path $WpDir 'jdawgs-wallpaper.jpg'
if (Get-Kit 'jdawgs-brand.jpg' $img 50000) {
  $done += 'Brand picture saved to Pictures\J-Dawgs'
} else { $skipped += 'Brand picture (download failed - check Wi-Fi and run me again)' }

# 2. Set it as the desktop wallpaper (Fill style) and refresh the desktop right now
if (Test-Path $img) {
  try {
    $desk = 'HKCU:\Control Panel\Desktop'
    Set-ItemProperty -Path $desk -Name Wallpaper -Value $img
    Set-ItemProperty -Path $desk -Name WallpaperStyle -Value '10'
    Set-ItemProperty -Path $desk -Name TileWallpaper -Value '0'
    Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class Wp { [DllImport("user32.dll", CharSet=CharSet.Auto)] public static extern int SystemParametersInfo(int a, int b, string c, int d); }' -ErrorAction SilentlyContinue
    [void][Wp]::SystemParametersInfo(0x0014, 0, $img, 0x01 -bor 0x02)
    $done += 'Desktop wallpaper SET: the J-Dawgs Industries storefront picture'
  } catch { $skipped += 'Wallpaper (Windows would not set it - tell Midas)' }
}

Write-Host ''
Write-Host '  ============ WALLPAPER REPORT ============' -ForegroundColor Cyan
foreach ($d in $done) { Write-Host "  DONE: $d" -ForegroundColor Green }
foreach ($s in $skipped) { Write-Host "  NOT DONE: $s" -ForegroundColor Yellow }
Write-Host ''
Write-Host '  Look at your desktop - the storefront picture should be behind your icons now.'
Write-Host '  Photo it and send it to Midas so he can see it landed.'
Write-Host ''
pause
