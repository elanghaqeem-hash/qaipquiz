@echo off
echo Removing Quiz Auto-Sync from Windows Startup...
powershell -NoProfile -Command "Remove-Item \"$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\QuizAutoSync.lnk\" -ErrorAction SilentlyContinue; Write-Host 'Removed from Startup.'"
pause
