param (
    [int]$PollIntervalSeconds = 5,
    [string]$Branch = "main"
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $ScriptDir) {
    $ScriptDir = (Get-Location).Path
}
Set-Location $ScriptDir

$LogFile = Join-Path $ScriptDir "auto_sync.log"

function Write-SyncLog {
    param([string]$Message)
    $ts = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    $logEntry = "[$ts] $Message"
    Write-Host $logEntry
    try {
        $logEntry | Out-File -FilePath $LogFile -Append -Encoding utf8
    } catch {}
}

Write-SyncLog "Auto-sync started in $ScriptDir on branch $Branch (poll interval: ${PollIntervalSeconds}s)"

while ($true) {
    try {
        $status = git status --porcelain 2>$null
        if ($status) {
            Write-SyncLog "Changes detected:"
            $status | ForEach-Object { Write-SyncLog "  $_" }

            # Brief pause to let file writes complete
            Start-Sleep -Seconds 2

            git add -A
            $staged = git status --porcelain 2>$null
            if ($staged) {
                $now = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
                $commitMsg = "Auto-update: $now"
                git commit -m $commitMsg
                Write-SyncLog "Committed: $commitMsg"

                $pushResult = git push origin $Branch 2>&1
                Write-SyncLog "Push result:`n$pushResult"
            }
        }
    } catch {
        Write-SyncLog "Error: $_"
    }

    Start-Sleep -Seconds $PollIntervalSeconds
}
