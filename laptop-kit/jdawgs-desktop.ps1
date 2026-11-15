# J-DAWGS DESKTOP - one-button desktop icons for Joshua's laptop
# Puts one icon for everything on the desktop, like a phone home screen:
# the business, the work platforms, and the computer basics. One screen.
# Written by Midas for J-Dawgs Industries, 2026-11-15.
$ErrorActionPreference = 'Continue'
$Desktop = [Environment]::GetFolderPath('Desktop')
$done = @(); $skipped = @(); $failed = @()

function New-WebShortcut($name, $url, $iconUrl) {
  $path = Join-Path $Desktop ($name + '.url')
  $lines = @('[InternetShortcut]', "URL=$url")
  if ($iconUrl) { $lines += "IconFile=$iconUrl"; $lines += 'IconIndex=0' }
  [IO.File]::WriteAllText($path, ($lines -join "`r`n") + "`r`n", (New-Object System.Text.UTF8Encoding($false)))
}

function Add-Web($name, $url, $iconUrl) {
  try {
    New-WebShortcut $name $url $iconUrl
    $done += "$name icon"
  } catch { $failed += "$name (Windows refused it - tell Midas)" }
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

function Add-App($label, $patterns) {
  $app = Find-App $patterns
  if ($null -eq $app) { $skipped += "$label (that app is not on this laptop)"; return }
  try {
    $ws = New-Object -ComObject WScript.Shell
    $sc = $ws.CreateShortcut((Join-Path $Desktop ($label + '.lnk')))
    $sc.TargetPath = Join-Path $env:WINDIR 'explorer.exe'
    $sc.Arguments = 'shell:AppsFolder\' + $app.Aumid
    $sc.Save()
    $done += "$label icon"
  } catch { $failed += "$label (Windows refused it - tell Midas)" }
}

Write-Host ''
Write-Host '  J-DAWGS DESKTOP - putting your icons on the screen...' -ForegroundColor Cyan
Write-Host ''

# ---- BUSINESS (in this order, top of the screen) ----
Add-Web 'J-Dawgs Home' 'https://jdawgsindustries.com/' $null
Add-Web 'AI Tool Store' 'https://jdawgsindustries.com/ai-tool-store.html' $null
Add-Web 'Human Hands - Post a Job' 'https://jdawgsindustries.com/human-hands/board.html' $null
Add-Web 'Human Hands - Sign Up' 'https://jdawgsindustries.com/human-hands/work.html' $null
Add-Web 'Arcade' 'https://jdawgsindustries.com/games/' $null
Add-Web 'Trading Post' 'https://jdawgsindustries.com/trading-post.html' $null
Add-Web 'Agent Services' 'https://jdawgsindustries.com/agent-services.html' $null
Add-Web 'The Hydrant' 'https://the-hydrant.vercel.app/' $null
Add-Web 'Prompt Generator' 'https://jdawgsindustries.com/realism-generator/' $null
Add-Web 'Hustle City' 'https://jdawgsindustries.com/games/hc1-demo/' 'https://jdawgsindustries.com/laptop-kit/hustle-city.ico'
Add-Web 'Hustle City 2' 'https://jdawgsindustries.com/games/hc2-demo/' 'https://jdawgsindustries.com/laptop-kit/hustle-city-2.ico'
Add-Web 'Master Prompt Generator' 'https://github.com/joshuajdawg0350/master-prompt-generator' $null

# ---- WORK ----
Add-Web 'Muse' 'https://muse.ai/' $null
Add-Web 'Gmail' 'https://mail.google.com/' $null
Add-Web 'Upwork' 'https://www.upwork.com/' $null
Add-Web 'Freelancer' 'https://www.freelancer.com/' $null
Add-Web 'Guru' 'https://www.guru.com/' $null
Add-Web 'Fiverr' 'https://www.fiverr.com/' $null
Add-Web 'Stripe' 'https://dashboard.stripe.com/' $null
Add-Web 'Venmo' 'https://venmo.com/' $null
Add-Web 'YouTube Studio' 'https://studio.youtube.com/' $null
Add-Web 'Facebook' 'https://www.facebook.com/' $null
Add-Web 'Messenger' 'https://www.messenger.com/' $null
Add-Web 'Google Drive' 'https://drive.google.com/' $null

# ---- COMPUTER ----
Add-Web 'Settings' 'ms-settings:' $null
try {
  $ws = New-Object -ComObject WScript.Shell
  $sc = $ws.CreateShortcut((Join-Path $Desktop 'My Files.lnk'))
  $sc.TargetPath = Join-Path $env:WINDIR 'explorer.exe'
  $sc.Save()
  $done += 'My Files icon'
} catch { $failed += 'My Files (Windows refused it - tell Midas)' }
Add-Web 'Security' 'windowsdefender:' $null
Add-Web 'App Store' 'ms-windows-store:' $null
Add-App 'Photos' @('Photos', 'Microsoft Photos')
Add-App 'Word' @('Word')
Add-App 'Excel' @('Excel')
Add-App 'Acer Care' @('Acer Care*', 'Care Center*', 'AcerCare*')

# Nudge Windows to paint the new icons right away
try {
  Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class SHN { [DllImport("shell32.dll")] public static extern void SHChangeNotify(int e, uint f, IntPtr a, IntPtr b); }'
  [SHN]::SHChangeNotify(0x8000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)
} catch {}

Write-Host ''
Write-Host '  ============ DONE ============' -ForegroundColor Green
foreach ($d in $done) { Write-Host "  ON:  $d" -ForegroundColor Green }
foreach ($s in $skipped) { Write-Host "  SKIPPED:  $s" -ForegroundColor Yellow }
foreach ($f in $failed) { Write-Host "  LEFT FOR MIDAS:  $f" -ForegroundColor Red }
Write-Host ''
Write-Host '  Your desktop is now your home screen - one icon for everything.' -ForegroundColor Cyan
Write-Host '  Photo this screen and send it to Midas.' -ForegroundColor Cyan
Write-Host '  Press any key to close this window.'
try { $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown') } catch { pause }
