# J-DAWGS CLEANUP v1 - one-button junk removal for Joshua's laptop
# Removes ONLY the games and promo apps on the allowlist below.
# Written by Midas for J-Dawgs Industries, 2026-11-15.
$ErrorActionPreference = 'Continue'
$removed  = @()
$notHere  = @()
$forMidas = @()

# ---------------------------------------------------------------------------
# HARD NEVER-REMOVE GUARD. If a package name matches ANY pattern here, it is
# NEVER removed, no matter what any allowlist pattern says. Checked before
# every single removal.
# ---------------------------------------------------------------------------
$ProtectedPatterns = @(
  'Microsoft.WindowsStore',          # Microsoft Store - needed to get apps back
  'Microsoft.MicrosoftEdge*',        # Microsoft Edge browser (+ Edge components)
  '*WebView*',                       # Edge WebView2 runtime - the kit and sites need it
  'Microsoft.SecHealthUI',           # Windows Security app
  '*SecHealth*',
  '*WindowsDefender*',               # Windows Defender antivirus pieces
  '*Office*',                        # Microsoft Office / Microsoft 365 apps
  'Microsoft.WindowsTerminal',       # kept on purpose
  '*CareCenter*',                    # Acer Care Center
  'Microsoft.NET*',                  # .NET runtimes other apps depend on
  'Microsoft.VCLibs*',               # Visual C++ runtime libraries
  'Microsoft.UI.Xaml*'               # Windows UI libraries other apps depend on
)
function Test-Protected($name) {
  foreach ($p in $ProtectedPatterns) { if ($name -like $p) { return $true } }
  return $false
}

Write-Host ''
Write-Host '  J-DAWGS CLEANUP - taking the junk games and clutter off...' -ForegroundColor Cyan
Write-Host '  This only removes games and promo apps. Your files, photos,'
Write-Host '  Edge, Office, and virus protection are never touched.'
Write-Host ''

# ---------------------------------------------------------------------------
# Appx removal, one allowlist target at a time. Every failure is caught so
# one stubborn app never stops the rest.
# ---------------------------------------------------------------------------
function Remove-Target($patterns, $plain) {
  $found = @()
  foreach ($pat in $patterns) {
    try { $found += @(Get-AppxPackage -Name $pat -ErrorAction SilentlyContinue) } catch {}
  }
  $found = @($found | Sort-Object -Property PackageFullName -Unique)
  if ($found.Count -eq 0) { $script:notHere += $plain; return }
  $goneCount = 0
  foreach ($pkg in $found) {
    if (Test-Protected $pkg.Name) {
      $script:forMidas += "$plain - kept on purpose (protected, never removed)"
      continue
    }
    if ($pkg.NonRemovable) {
      $script:forMidas += "$plain - Windows will not let this one be removed"
      continue
    }
    try {
      Remove-AppxPackage -Package $pkg.PackageFullName -ErrorAction Stop
      $still = $null
      try { $still = Get-AppxPackage -Name $pkg.Name -ErrorAction SilentlyContinue } catch {}
      if ($still) { $script:forMidas += "$plain - tried to remove it but it is still there" }
      else { $goneCount++ }
    } catch {
      $script:forMidas += "$plain - could not remove it (Windows said: $($_.Exception.Message))"
    }
  }
  if ($goneCount -gt 0) {
    if ($goneCount -gt 1) { $script:removed += "$plain ($goneCount pieces)" }
    else { $script:removed += $plain }
  }
}

Remove-Target @('Microsoft.MicrosoftSolitaireCollection') 'Solitaire (card games)'
Remove-Target @('Microsoft.GamingApp','Microsoft.XboxGameOverlay','Microsoft.XboxGamingOverlay','Microsoft.XboxIdentityProvider','Microsoft.XboxSpeechToTextOverlay') 'Xbox app and game overlays'
Remove-Target @('*WhatsApp*') 'WhatsApp'
Remove-Target @('king.com.*') 'Candy Crush games'
Remove-Target @('*TikTok*') 'TikTok'
Remove-Target @('SpotifyAB.SpotifyMusic') 'Spotify (leftover stub)'
Remove-Target @('*Facebook*') 'Facebook app'
Remove-Target @('*Instagram*') 'Instagram app'
Remove-Target @('*Planet9*') 'Acer Planet9 (game promo)'
Remove-Target @('*Dropbox*') 'Dropbox promo'

# ---------------------------------------------------------------------------
# Forge of Empires + Booking.com: these are usually just Start-menu web
# shortcuts, sometimes an Appx, rarely a real install. Check all three.
# ---------------------------------------------------------------------------
function Get-UninstallEntries {
  $roots = @(
    'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*'
  )
  $entries = @()
  foreach ($r in $roots) {
    try { $entries += @(Get-ItemProperty $r -ErrorAction SilentlyContinue) } catch {}
  }
  return $entries
}
$uninstallEntries = Get-UninstallEntries

function Clean-WebPromo($appxPattern, $namePattern, $plain) {
  $didSomething = $false

  # 1. Appx package
  $pkgs = @()
  try { $pkgs = @(Get-AppxPackage -Name $appxPattern -ErrorAction SilentlyContinue) } catch {}
  foreach ($pkg in $pkgs) {
    if (Test-Protected $pkg.Name) { continue }
    try {
      Remove-AppxPackage -Package $pkg.PackageFullName -ErrorAction Stop
      $script:removed += $plain
      $didSomething = $true
    } catch {
      $script:forMidas += "$plain - could not remove it (Windows said: $($_.Exception.Message))"
      $didSomething = $true
    }
  }

  # 2. Start Menu shortcuts (.lnk and .url), this user + all users
  $menuDirs = @(
    (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'),
    'C:\ProgramData\Microsoft\Windows\Start Menu\Programs'
  )
  foreach ($dir in $menuDirs) {
    if (-not (Test-Path $dir)) { continue }
    $links = @()
    try {
      $links = @(Get-ChildItem -Path $dir -Recurse -Include *.lnk, *.url -ErrorAction SilentlyContinue |
                 Where-Object { $_.Name -like $namePattern })
    } catch {}
    foreach ($lnk in $links) {
      try {
        Remove-Item $lnk.FullName -Force -ErrorAction Stop
        $script:removed += "$plain (Start menu shortcut)"
        $didSomething = $true
      } catch {
        $script:forMidas += "$plain (Start menu shortcut) - could not delete it"
        $didSomething = $true
      }
    }
  }

  # 3. Real installed program (registry uninstall list)
  $inst = @($uninstallEntries | Where-Object { $_.DisplayName -like $namePattern })
  foreach ($entry in $inst) {
    $didSomething = $true
    $quiet = $entry.QuietUninstallString
    $isMsi = ($entry.UninstallString -like '*msiexec*') -and ($entry.PSChildName -match '^\{[0-9A-Fa-f\-]+\}$')
    try {
      if ($quiet) {
        # Split "path to exe" and its arguments
        if ($quiet -match '^\s*"([^"]+)"\s*(.*)$') { $exe = $Matches[1]; $argline = $Matches[2] }
        elseif ($quiet -match '^\s*(\S+)\s*(.*)$') { $exe = $Matches[1]; $argline = $Matches[2] }
        else { throw 'could not read the uninstall command' }
        $p = Start-Process -FilePath $exe -ArgumentList $argline -PassThru -ErrorAction Stop
        if (-not $p.WaitForExit(120000)) {
          try { $p.Kill() } catch {}
          $script:forMidas += "$plain - its uninstaller took too long, so it was stopped; Midas will finish it by hand"
        } else { $script:removed += "$plain (installed program)" }
      } elseif ($isMsi) {
        $p = Start-Process -FilePath 'msiexec.exe' -ArgumentList "/x $($entry.PSChildName) /quiet /norestart" -PassThru -ErrorAction Stop
        if (-not $p.WaitForExit(120000)) {
          try { $p.Kill() } catch {}
          $script:forMidas += "$plain - its uninstaller took too long, so it was stopped; Midas will finish it by hand"
        } else { $script:removed += "$plain (installed program)" }
      } else {
        $script:forMidas += "$plain - found in the installed-programs list, but it has no quiet uninstaller; left for Midas so no surprise windows pop up mid-cleanup"
      }
    } catch {
      $script:forMidas += "$plain - could not uninstall it (Windows said: $($_.Exception.Message))"
    }
  }

  if (-not $didSomething) { $script:notHere += $plain }
}

Clean-WebPromo '*Forge*'   '*Forge*'   'Forge of Empires (game)'
Clean-WebPromo '*Booking*' '*Booking*' 'Booking.com'

# ---------------------------------------------------------------------------
# McAfee LiveSafe: DETECT ONLY. Never run its uninstaller from here -
# removing antivirus wrong can leave Windows unprotected. Midas does it
# by hand so Windows Defender stays on.
# ---------------------------------------------------------------------------
$mcafee = @($uninstallEntries | Where-Object { $_.DisplayName -like '*McAfee*' })
if ($mcafee.Count -gt 0) {
  $forMidas += 'McAfee LiveSafe (trial virus protection) - found on this laptop, left in place on purpose; Midas will remove it the safe way'
}

# ---------------------------------------------------------------------------
# Final report - three plain lists, then wait for a keypress for the photo.
# ---------------------------------------------------------------------------
Write-Host ''
Write-Host '  ============ DONE ============' -ForegroundColor Green
Write-Host ''
Write-Host '  REMOVED:' -ForegroundColor Green
if ($removed.Count -eq 0) { Write-Host '  - (nothing - everything was already gone)' -ForegroundColor Green }
foreach ($r in $removed) { Write-Host "  - $r" -ForegroundColor Green }
Write-Host ''
Write-Host '  NOT ON THIS LAPTOP:' -ForegroundColor Gray
if ($notHere.Count -eq 0) { Write-Host '  - (none - everything on the junk list was here)' -ForegroundColor Gray }
foreach ($n in $notHere) { Write-Host "  - $n" -ForegroundColor Gray }
Write-Host ''
Write-Host '  LEFT FOR MIDAS:' -ForegroundColor Yellow
if ($forMidas.Count -eq 0) { Write-Host '  - (nothing - the cleanup finished clean)' -ForegroundColor Yellow }
foreach ($f in $forMidas) { Write-Host "  - $f" -ForegroundColor Yellow }
Write-Host ''
Write-Host '  Photo this screen and send it to Midas.' -ForegroundColor Cyan
Write-Host '  Press any key to close this window.'
try { $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown') } catch { pause }
