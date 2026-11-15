@echo off
REM J-DAWGS DESKTOP - the third button. Double-click this file and your desktop
REM fills with one icon for everything, like a phone home screen.
REM If Windows asks "Do you want to allow this app to make changes?" click YES.
REM Written by Midas for J-Dawgs Industries, 2026-11-15.
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo.
  echo  A Windows permission box is about to appear. Click YES on it.
  echo  If you clicked No by mistake, just double-click this file again.
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
if exist "%~dp0jdawgs-desktop.ps1" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0jdawgs-desktop.ps1"
  exit /b
)
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -Uri 'https://jdawgsindustries.com/laptop-kit/jdawgs-desktop.ps1' -OutFile \"$env:TEMP\jdawgs-desktop.ps1\" -UseBasicParsing -TimeoutSec 60; if ((Get-Item \"$env:TEMP\jdawgs-desktop.ps1\").Length -lt 3000) { exit 3 } } catch { exit 3 }"
if %errorlevel% neq 0 (
  echo.
  echo  The desktop file could not download. Check the Wi-Fi is on, then double-click this file again.
  echo  If it keeps failing, photo this screen and send it to Midas.
  pause
  exit /b
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%TEMP%\jdawgs-desktop.ps1"
