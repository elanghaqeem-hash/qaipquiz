param (
    [int]$PollIntervalSeconds = 10,
    [string]$Branch = "",
    [switch]$AllowProtectedBranch
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

$currentBranch = (git branch --show-current 2>$null).Trim()
if (-not $currentBranch) {
    Write-SyncLog "ERROR: Tidak dapat menentukan branch Git aktif."
    exit 1
}

if (-not $Branch) {
    $Branch = $currentBranch
}

if ($Branch -ne $currentBranch) {
    Write-SyncLog "ERROR: Branch target '$Branch' berbeda dengan branch aktif '$currentBranch'. Pindah branch secara manual terlebih dahulu."
    exit 1
}

$protectedBranches = @("main", "master")
if (($protectedBranches -contains $Branch) -and -not $AllowProtectedBranch) {
    Write-SyncLog "BLOCKED: Auto-sync langsung ke '$Branch' dinonaktifkan untuk keamanan."
    Write-SyncLog "Gunakan branch kerja (contoh: git switch -c work/quiz-update), lalu jalankan kembali auto-sync dan merge melalui Pull Request."
    Write-SyncLog "Jika benar-benar diperlukan, jalankan manual dengan -AllowProtectedBranch setelah melakukan review perubahan."
    exit 2
}

Write-SyncLog "Auto-sync started in $ScriptDir on branch $Branch (poll interval: ${PollIntervalSeconds}s)"

$blockedPatterns = @(
    '^\.env($|\.)',
    '^data[\\/]db\.json$',
    '^data[\\/]users\.json$',
    '\.(pem|key|p12|pfx)$'
)

while ($true) {
    try {
        $status = git status --porcelain 2>$null
        if ($status) {
            Write-SyncLog "Changes detected:"
            $status | ForEach-Object { Write-SyncLog "  $_" }

            Start-Sleep -Seconds 2
            git add -A

            $stagedFiles = @(git diff --cached --name-only 2>$null)
            $blockedFiles = @()
            foreach ($file in $stagedFiles) {
                foreach ($pattern in $blockedPatterns) {
                    if ($file -match $pattern) {
                        $blockedFiles += $file
                        break
                    }
                }
            }

            if ($blockedFiles.Count -gt 0) {
                Write-SyncLog "BLOCKED: File sensitif/runtime terdeteksi pada staging area:"
                $blockedFiles | Sort-Object -Unique | ForEach-Object { Write-SyncLog "  $_" }
                git reset -- $blockedFiles 2>$null
                Write-SyncLog "File tersebut dikeluarkan dari staging. Review .gitignore sebelum melanjutkan."
            }

            $staged = git diff --cached --name-only 2>$null
            if ($staged) {
                $now = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
                $commitMsg = "Auto-update: $now"
                git commit -m $commitMsg
                if ($LASTEXITCODE -ne 0) {
                    Write-SyncLog "Commit gagal; push dibatalkan."
                } else {
                    Write-SyncLog "Committed: $commitMsg"
                    $pushResult = git push origin $Branch 2>&1
                    Write-SyncLog "Push result:`n$pushResult"
                }
            }
        }
    } catch {
        Write-SyncLog "Error: $_"
    }

    Start-Sleep -Seconds $PollIntervalSeconds
}
