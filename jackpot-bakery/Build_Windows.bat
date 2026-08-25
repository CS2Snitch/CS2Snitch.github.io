@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required to build Jackpot Bakery.
  echo Install the current Node.js LTS release, then run this file again.
  pause
  exit /b 1
)
echo Installing exact locked dependencies...
call npm ci
if errorlevel 1 goto :failed
echo Generating the original 48 kHz soundtrack...
call npm run generate:music
if errorlevel 1 goto :failed
echo Running automated tests...
call npm test
if errorlevel 1 goto :failed
echo Building 64-bit portable Windows game...
call npx electron-builder --win portable --x64
if errorlevel 1 goto :failed
echo Building the Steam depot folder...
call npx electron-builder --win dir --x64
if errorlevel 1 goto :failed
echo.
echo Build complete. Open the dist folder.
pause
exit /b 0

:failed
echo.
echo Build failed. Review the message above.
pause
exit /b 1
