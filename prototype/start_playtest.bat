@echo off
REM ===== Realm of Rolls - one-click playtest server (ASCII only on purpose) =====
setlocal
cd /d "%~dp0"
title Realm of Rolls - Playtest (close window to stop)

REM --- find Python ---
set "PY="
where py >nul 2>nul && set "PY=py"
if not defined PY ( where python >nul 2>nul && set "PY=python" )
if not defined PY (
  echo [ERROR] Python 3 not found. Install it from python.org then run again.
  echo.
  pause
  exit /b 1
)

REM --- download cloudflared once ---
if not exist "cloudflared.exe" (
  echo [SETUP] Downloading cloudflared ^(one-time, ~30MB^)...
  curl -L -o cloudflared.exe "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
  if not exist "cloudflared.exe" (
    echo [SETUP] curl failed, trying PowerShell...
    powershell -NoProfile -Command "Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile 'cloudflared.exe'"
  )
)
if not exist "cloudflared.exe" (
  echo [ERROR] Could not download cloudflared. Check your internet and try again.
  echo.
  pause
  exit /b 1
)

echo.
echo ==============================================
echo   Realm of Rolls - Playtest Server
echo   A public link will appear below in a moment.
echo   CLOSE THIS WINDOW to stop the server.
echo ==============================================
echo.

%PY% "_serve.py"

REM python exited -> Job Object closed -> cloudflared already killed. nothing left running.
