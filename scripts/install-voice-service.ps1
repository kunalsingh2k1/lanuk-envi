# Starts Voice Studio (the local voice behind Envi's spoken replies) when you sign in to Windows and
# restarts it if it stops. Run once from PowerShell:
#   powershell -ExecutionPolicy Bypass -File scripts\install-voice-service.ps1
# It runs as YOUR user. Voice Studio listens on 127.0.0.1:8880 only; never open that port to the internet.
# To remove it:  Unregister-ScheduledTask -TaskName 'Lanuk Voice Studio' -Confirm:$false
$ErrorActionPreference = 'Stop'
$root = 'C:\AI TOOLS\voice-studio'
if (-not (Test-Path (Join-Path $root 'studio.py'))) { throw "Voice Studio is not installed at $root" }
$python = (Get-Command python).Source
$log = 'C:\AI TOOLS\voice-studio-run.log'
$cmd = "/c `"`"$python`" studio.py start --prod >> `"$log`" 2>&1`""
$action   = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument $cmd -WorkingDirectory $root
$trigger  = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
            -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
Register-ScheduledTask -TaskName 'Lanuk Voice Studio' -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName 'Lanuk Voice Studio'
Write-Host "Voice Studio is installed and starting at http://127.0.0.1:8880"
