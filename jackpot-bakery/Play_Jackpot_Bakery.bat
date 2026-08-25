@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required for the source launcher.
  echo Install the current Node.js LTS release, then run this file again.
  pause
  exit /b 1
)
if not exist "node_modules\electron\dist\electron.exe" (
  echo Installing locked game dependencies...
  call npm ci
  if errorlevel 1 (
    echo Installation failed.
    pause
    exit /b 1
  )
)
call npm run generate:music
if errorlevel 1 (
  echo Music generation failed.
  pause
  exit /b 1
)
call npm start
