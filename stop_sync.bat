@echo off
echo Stopping auto_sync.ps1 processes...
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*auto_sync.ps1*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force; Write-Host ('Stopped process PID ' + $_.ProcessId) }"
echo All auto-sync processes stopped.
pause
