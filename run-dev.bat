@echo off
chcp 65001 >nul
title KoBar Dev
cd /d "%~dp0"

echo [KoBar] Cleaning up stale KoBar processes...
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { ($_.Name -match 'node|electron') -and ($_.CommandLine -match 'KoBar|kobar') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
timeout /t 2 >nul

REM Free up port 5173 if a previous dev session left it occupied
for /f "tokens=5" %%p in ('netstat -ano ^| findstr :5173 ^| findstr LISTENING') do (
    echo [KoBar] Port 5173 is busy - PID %%p. Killing it...
    taskkill /f /pid %%p >nul 2>&1
)
timeout /t 1 >nul

if not exist node_modules (
    echo [KoBar] First run: installing dependencies...
    call npm install --no-audit --no-fund
    if errorlevel 1 (
        echo [KoBar] Dependency install FAILED. Check network and retry.
        pause
        exit /b 1
    )
)

echo [KoBar] Starting dev mode (Vite + Electron)...
echo [KoBar] Booting takes about 6-10 seconds (Vite server, then TS build, then Electron window).
echo [KoBar] Do NOT press Ctrl+C while it is booting - that stops all processes.
echo [KoBar] To exit the app, just close this window.
call npm run dev

echo.
echo [KoBar] App closed.
pause
