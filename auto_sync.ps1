param (
    [int]$PollIntervalSeconds = 5,
    [string]$Branch = "main"
)

$RepoDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $RepoDir

$LogFile = Join-Path $RepoDir "auto_sync.log"

function Write-SyncLog ($Message) {
    $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    $logEntry = "[] $Message"
    Write-Host $logEntry
    $logEntry | Out-File -FilePath $LogFile -Append -Encoding utf8
}

Write-SyncLog "Auto-sync watcher started for $RepoDir on branch $Branch (interval: ${PollIntervalSeconds}s)"

while ($true) {
    try {
        $status = git status --porcelain 2>$null
        if ($status) {
            Write-SyncLog "Detected changes:"
            $status | ForEach-Object { Write-SyncLog "  $_" }

            # Short wait for file write/lock completion
            Start-Sleep -Seconds 2

            git add -A
            $staged = git status --porcelain 2>$null
            if ($staged) {
                $commitMsg = "Auto-update: " + (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
                git commit -m $commitMsg
                Write-SyncLog "Committed: $commitMsg"

                $pushOutput = git push origin $Branch 2>&1
                Write-SyncLog "Push result: $pushOutput"
            }
        }
    } catch {
        Write-SyncLog "Error during sync: $_"
    }

    Start-Sleep -Seconds $PollIntervalSeconds
}
