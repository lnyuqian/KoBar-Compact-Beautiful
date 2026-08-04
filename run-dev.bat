@echo off
chcp 65001 >nul
title KoBar Dev
cd /d "D:\opencode-ai\01-inprogress\KoBar"

echo [KoBar] Cleaning up stale KoBar processes...
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { ($_.Name -match 'node|electron') -and ($_.CommandLine -match 'KoBar|kobar') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
timeout /t 2 >nul

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
echo [KoBar] Keep this window open while using the app. Close it to exit.
call npm run dev

echo.
echo [KoBar] App closed.
pause
