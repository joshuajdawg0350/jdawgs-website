@echo off
REM J-DAWGS SETUP - the one button. Double-click this file and everything comes on.
REM If Windows asks "Do you want to allow this app to make changes?" click YES.
REM Written by Midas for J-Dawgs Industries, 2026-11-15.
net session >nul 2>&1
if %errorlevel% neq 0 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri 'https://jdawgsindustries.com/laptop-kit/jdawgs-setup.ps1' -OutFile \"$env:TEMP\jdawgs-setup.ps1\" -UseBasicParsing; & \"$env:TEMP\jdawgs-setup.ps1\""
