# Starts Envi when you sign in to Windows and restarts it if it stops.
# Run once from PowerShell:  powershell -ExecutionPolicy Bypass -File scripts\install-service.ps1
# It runs as YOUR user, because the Claude and Codex logins live in your profile.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$node = (Get-Command node).Source
New-Item -ItemType Directory -Force (Join-Path $root 'logs') | Out-Null
$cmd  = "/c `"`"$node`" `"$root\server\index.js`" >> `"$root\logs\envi.log`" 2>&1`""
$action   = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument $cmd -WorkingDirectory $root
$trigger  = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
            -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
Register-ScheduledTask -TaskName 'Lanuk Envi' -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName 'Lanuk Envi'
Write-Host "Envi is installed and running at http://127.0.0.1:4777"
Write-Host "To remove it:  Unregister-ScheduledTask -TaskName 'Lanuk Envi' -Confirm:`$false"
