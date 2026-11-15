@echo off
REM J-DAWGS SETUP - the one button. Double-click this file and everything comes on.
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
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -Uri 'https://jdawgsindustries.com/laptop-kit/jdawgs-setup.ps1' -OutFile \"$env:TEMP\jdawgs-setup.ps1\" -UseBasicParsing -TimeoutSec 60 } catch { exit 3 }"
if %errorlevel% neq 0 (
  echo.
  echo  The setup file could not download. Check the Wi-Fi is on, then double-click this file again.
  echo  If it keeps failing, photo this screen and send it to Midas.
  pause
  exit /b
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%TEMP%\jdawgs-setup.ps1"
