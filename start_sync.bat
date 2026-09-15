@echo off
cd /d "%~dp0"
echo Starting Git Auto-Sync for Quiz...
powershell -ExecutionPolicy Bypass -File "%~dp0auto_sync.ps1"
pause
