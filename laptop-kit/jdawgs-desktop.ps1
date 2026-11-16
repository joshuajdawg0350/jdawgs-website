# J-DAWGS DESKTOP v2 - one-button desktop icons for Joshua's laptop
# Puts one icon for everything on the desktop, like a phone home screen:
# the business, the work platforms, and the computer basics. One screen.
# v2 (2026-11-15): every icon is a J-Dawgs house tile (chrome on black,
# electric blue). The tiles are downloaded onto the laptop itself -
# Windows will not fetch icon pictures from the internet, which is why
# v1 showed plain Edge logos. Report lists fixed (v1 lost them).
# Written by Midas for J-Dawgs Industries, 2026-11-15.
# v2.1 (2026-11-15): alphabetical-order fix - the kit's old shortcuts are
# deleted first so Windows lays the new ones out A to Z (block below).
$ErrorActionPreference = 'Continue'
$Desktop = [Environment]::GetFolderPath('Desktop')
$IconDir = Join-Path $env:USERPROFILE 'J-Dawgs Icons'
$IconBase = 'https://jdawgsindustries.com/laptop-kit/icons/'
$script:done = @(); $script:skipped = @(); $script:failed = @()
try { New-Item -ItemType Directory -Force -Path $IconDir | Out-Null } catch {}

function Get-Icon($file) {
  $local = Join-Path $IconDir $file
  try {
    if ((Test-Path $local) -and (Get-Item $local).Length -gt 2000) { return $local }
    Invoke-WebRequest -Uri ($IconBase + $file) -OutFile $local -UseBasicParsing -TimeoutSec 60
    if ((Get-Item $local).Length -gt 2000) { return $local }
  } catch {}
  return $null
}

function New-WebShortcut($name, $url, $iconPath) {
  $path = Join-Path $Desktop ($name + '.url')
  $lines = @('[InternetShortcut]', "URL=$url")
  if ($iconPath) { $lines += "IconFile=$iconPath"; $lines += 'IconIndex=0' }
  [IO.File]::WriteAllText($path, ($lines -join "`r`n") + "`r`n", (New-Object System.Text.UTF8Encoding($false)))
}

function Add-Web($name, $url, $iconFile) {
  $iconPath = $null
  if ($iconFile) { $iconPath = Get-Icon $iconFile }
  try {
    New-WebShortcut $name $url $iconPath
    if ($iconFile -and -not $iconPath) { $script:failed += "$name (shortcut works, its J-Dawgs picture could not download)" }
    else { $script:done += "$name icon" }
  } catch { $script:failed += "$name (Windows refused it - tell Midas)" }
}

function Add-Run($name, $scriptUrl, $iconFile) {
  # A RUN tile (2026-11-15): not a web page - one click fetches the live
  # kit script from jdawgsindustries.com and runs it, the same fetch the
  # kit's .cmd buttons do, so the tile always runs the newest version.
  $iconPath = $null
  if ($iconFile) { $iconPath = Get-Icon $iconFile }
  try {
    $ws = New-Object -ComObject WScript.Shell
    $sc = $ws.CreateShortcut((Join-Path $Desktop ($name + '.lnk')))
    $sc.TargetPath = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
    $sc.Arguments = "-NoProfile -ExecutionPolicy Bypass -Command `"Invoke-Expression (Invoke-RestMethod -Uri '$scriptUrl' -TimeoutSec 60)`""
    if ($iconPath) { $sc.IconLocation = "$iconPath,0" }
    $sc.Save()
    if ($iconFile -and -not $iconPath) { $script:failed += "$name (shortcut works, its J-Dawgs picture could not download)" }
    else { $script:done += "$name icon" }
  } catch { $script:failed += "$name (Windows refused it - tell Midas)" }
}

function Find-App($patterns) {
  try {
    $shell = New-Object -ComObject Shell.Application
    $folder = $shell.Namespace('shell:AppsFolder')
    foreach ($item in $folder.Items()) {
      foreach ($p in $patterns) {
        $hit = $false
        if ($p.Contains('*')) { $hit = ($item.Name -like $p) } else { $hit = ($item.Name -eq $p) }
        if ($hit) { return @{ Name = $item.Name; Aumid = $item.Path } }
      }
    }
  } catch {}
  return $null
}

function Add-App($label, $patterns, $iconFile) {
  $app = Find-App $patterns
  if ($null -eq $app) { $script:skipped += "$label (that app is not on this laptop)"; return }
  $iconPath = $null
  if ($iconFile) { $iconPath = Get-Icon $iconFile }
  try {
    $ws = New-Object -ComObject WScript.Shell
    $sc = $ws.CreateShortcut((Join-Path $Desktop ($label + '.lnk')))
    $sc.TargetPath = Join-Path $env:WINDIR 'explorer.exe'
    $sc.Arguments = 'shell:AppsFolder\' + $app.Aumid
    if ($iconPath) { $sc.IconLocation = "$iconPath,0" }
    $sc.Save()
    if ($iconFile -and -not $iconPath) { $script:failed += "$label (shortcut works, its J-Dawgs picture could not download)" }
    else { $script:done += "$label icon" }
  } catch { $script:failed += "$label (Windows refused it - tell Midas)" }
}

Write-Host ''
Write-Host '  J-DAWGS DESKTOP - putting your icons on the screen...' -ForegroundColor Cyan
Write-Host ''

# ---- FIRST: CLEAR THE OLD KIT SHORTCUTS (order fix, 2026-11-15) ----
# Windows remembers where each desktop icon sits and puts an overwritten
# shortcut right back in its old slot - so re-running this script in A-Z
# order never re-sorted the screen (icons added in earlier runs, like
# Moltbook and Screensaver Setup, stayed parked wherever they first
# landed). Deleting the kit's own shortcuts first makes Windows hand out
# fresh grid slots in creation order, so creating them A to Z below
# fills the screen A to Z. Only the kit's own 35 names are touched -
# Recycle Bin, Microsoft Edge and anything Joshua put there himself
# stay exactly where they are.
$KitNames = @(
  'Acer Care','Agent Services','AI Tool Store','App Store','Arcade','Excel',
  'Facebook','Fiverr','Freelancer','Gmail','Google Drive','Guru',
  'Human Hands - Post a Job','Human Hands - Sign Up','Hustle City','Hustle City 2',
  'J-Dawgs Home','Master Prompt Generator','Messenger','Moltbook','Muse','My Files',
  'Photos','Prompt Generator','Screensaver Setup','Security','Settings','Stripe',
  'The Hydrant','Trading Post','Upwork','Venmo','Word','YouTube','YouTube Studio'
)
foreach ($kn in $KitNames) {
  foreach ($ext in '.url', '.lnk') {
    $old = Join-Path $Desktop ($kn + $ext)
    if (Test-Path $old) { try { Remove-Item $old -Force } catch {} }
  }
}

# ---- EVERYTHING, A TO Z BY NAME (Joshua's order, 2026-11-15) ----
Add-App 'Acer Care' @('Acer Care*', 'Care Center*', 'AcerCare*') 'acer-care.ico'
Add-Web 'Agent Services' 'https://jdawgsindustries.com/agent-services.html' 'agent-services.ico'
Add-Web 'AI Tool Store' 'https://jdawgsindustries.com/ai-tool-store.html' 'ai-tool-store.ico'
Add-Web 'App Store' 'ms-windows-store:' $null
Add-Web 'Arcade' 'https://jdawgsindustries.com/games/' 'arcade.ico'
Add-App 'Excel' @('Excel') 'excel.ico'
Add-Web 'Facebook' 'https://www.facebook.com/' 'facebook.ico'
Add-Web 'Fiverr' 'https://www.fiverr.com/' 'fiverr.ico'
Add-Web 'Freelancer' 'https://www.freelancer.com/' 'freelancer.ico'
Add-Web 'Gmail' 'https://mail.google.com/' 'gmail.ico'
Add-Web 'Google Drive' 'https://drive.google.com/' 'google-drive.ico'
Add-Web 'Guru' 'https://www.guru.com/' 'guru.ico'
Add-Web 'Human Hands - Post a Job' 'https://jdawgsindustries.com/human-hands/board.html' 'human-hands-post.ico'
Add-Web 'Human Hands - Sign Up' 'https://jdawgsindustries.com/human-hands/work.html' 'human-hands-signup.ico'
Add-Web 'Hustle City' 'https://jdawgsindustries.com/games/hc1-demo/' 'hustle-city.ico'
Add-Web 'Hustle City 2' 'https://jdawgsindustries.com/games/hc2-demo/' 'hustle-city-2.ico'
Add-Web 'J-Dawgs Home' 'https://jdawgsindustries.com/' 'jdawgs-home.ico'
Add-Web 'Master Prompt Generator' 'https://muse.ai/s/realism-master-template-generator-axv6xs4xvyxzvz2/1VLVxrDQBar56ZiooejOCYnsd_tCiEeW6eILPgcdkjQ' 'master-prompt.ico'
Add-Web 'Messenger' 'https://www.messenger.com/' 'messenger.ico'
Add-Web 'Moltbook' 'https://www.moltbook.com/u/jdawgsindustries' 'moltbook.ico'
Add-Web 'Muse' 'https://muse.ai/' 'claude.ico'
try {
  $ws = New-Object -ComObject WScript.Shell
  $sc = $ws.CreateShortcut((Join-Path $Desktop 'My Files.lnk'))
  $sc.TargetPath = Join-Path $env:WINDIR 'explorer.exe'
  $mfIcon = Get-Icon 'my-files.ico'
  if ($mfIcon) { $sc.IconLocation = "$mfIcon,0" }
  $sc.Save()
  if ($mfIcon) { $script:done += 'My Files icon' } else { $script:failed += 'My Files (shortcut works, its J-Dawgs picture could not download)' }
} catch { $script:failed += 'My Files (Windows refused it - tell Midas)' }
Add-App 'Photos' @('Photos', 'Microsoft Photos') 'photos.ico'
Add-Web 'Prompt Generator' 'https://jdawgsindustries.com/realism-generator/' 'prompt-generator.ico'
Add-Run 'Screensaver Setup' 'https://jdawgsindustries.com/laptop-kit/jdawgs-screensaver.ps1' 'screensaver.ico'
Add-Web 'Security' 'windowsdefender:' $null
Add-Web 'Settings' 'ms-settings:' $null
Add-Web 'Stripe' 'https://dashboard.stripe.com/' 'stripe.ico'
Add-Web 'The Hydrant' 'https://the-hydrant.vercel.app/' 'hydrant.ico'
Add-Web 'Trading Post' 'https://jdawgsindustries.com/trading-post.html' 'trading-post.ico'
Add-Web 'Upwork' 'https://www.upwork.com/' 'upwork.ico'
Add-Web 'Venmo' 'https://venmo.com/' 'venmo.ico'
Add-App 'Word' @('Word') 'word.ico'
Add-Web 'YouTube' 'https://www.youtube.com' 'youtube.ico'
Add-Web 'YouTube Studio' 'https://studio.youtube.com/' 'youtube-studio.ico'

# Nudge Windows to paint the new icons right away
try {
  Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class SHN { [DllImport("shell32.dll")] public static extern void SHChangeNotify(int e, uint f, IntPtr a, IntPtr b); }'
  [SHN]::SHChangeNotify(0x8000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)
} catch {}

Write-Host ''
Write-Host '  ============ DONE ============' -ForegroundColor Green
foreach ($d in $script:done) { Write-Host "  ON:  $d" -ForegroundColor Green }
foreach ($s in $script:skipped) { Write-Host "  SKIPPED:  $s" -ForegroundColor Yellow }
foreach ($f in $script:failed) { Write-Host "  LEFT FOR MIDAS:  $f" -ForegroundColor Red }
Write-Host ''
if ($script:failed.Count -eq 0) {
  Write-Host '  Your desktop is now your home screen - one icon for everything.' -ForegroundColor Cyan
} else {
  Write-Host '  Most icons are on. A few need Midas - photo this screen and send it.' -ForegroundColor Yellow
}
Write-Host '  Photo this screen and send it to Midas.' -ForegroundColor Cyan
Write-Host '  Press any key to close this window.'
try { $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown') } catch { pause }
