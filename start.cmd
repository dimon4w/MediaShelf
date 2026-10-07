@echo off
rem MediaShell for Windows: installs, builds on first run and starts the server.
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js not found. Install Node.js 24 LTS from https://nodejs.org and run this file again.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing dependencies...
  call npm install --no-audit --no-fund || goto :failed
)

if not exist dist\index.html (
  echo Building MediaShell...
  call npm run build || goto :failed
)

echo Starting MediaShell. Open http://localhost:4175 in your browser. Close this window to stop.
node --env-file-if-exists=.env server/main.ts
goto :eof

:failed
echo Something went wrong. See the messages above.
pause
exit /b 1
