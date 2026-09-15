Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
psScript = scriptDir & "\auto_sync.ps1"
cmd = "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -NoProfile -Command ""& '" & psScript & "'"""
WshShell.Run cmd, 0, False
