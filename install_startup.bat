@echo off
echo Installing Quiz Auto-Sync to Windows Startup...
powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut(\"$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\QuizAutoSync.lnk\"); $s.TargetPath = 'wscript.exe'; $s.Arguments = '\""%~dp0start_sync_background.vbs\""'; $s.WorkingDirectory = '%~dp0'; $s.Save(); Write-Host 'Shortcut created in Startup successfully!'"
pause
