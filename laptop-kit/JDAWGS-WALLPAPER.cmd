@echo off
REM J-DAWGS WALLPAPER - the fifth button. Double-click this file and the
REM J-Dawgs Industries brand picture becomes your desktop wallpaper.
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
if exist "%~dp0jdawgs-wallpaper.ps1" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0jdawgs-wallpaper.ps1"
  exit /b
)
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -Uri 'https://jdawgsindustries.com/laptop-kit/jdawgs-wallpaper.ps1' -OutFile \"$env:TEMP\jdawgs-wallpaper.ps1\" -UseBasicParsing -TimeoutSec 60; if ((Get-Item \"$env:TEMP\jdawgs-wallpaper.ps1\").Length -lt 1000) { exit 3 } } catch { exit 3 }"
if %errorlevel% neq 0 (
  echo.
  echo  The wallpaper file could not download. Check the Wi-Fi is on, then double-click this file again.
  echo  If it keeps failing, photo this screen and send it to Midas.
  pause
  exit /b
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%TEMP%\jdawgs-wallpaper.ps1"
