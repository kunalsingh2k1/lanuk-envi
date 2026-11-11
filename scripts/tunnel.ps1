# Puts Envi online at https://<hostname> through a Cloudflare Tunnel.
# BEFORE running this: in Cloudflare Zero Trust > Access > Applications, add a self-hosted app
# for the hostname with a policy that allows only your email. Otherwise the page is public.
#
# Usage (PowerShell as Administrator):
#   cloudflared tunnel login                  # once; opens the browser, pick your domain
#   .\scripts\tunnel.ps1 -Hostname envi.yourdomain.com
param([Parameter(Mandatory)][string]$Hostname, [int]$Port = 4777, [string]$Name = 'lanuk-envi')
$ErrorActionPreference = 'Stop'
$cf = Join-Path $env:USERPROFILE '.cloudflared'
if (-not (Test-Path (Join-Path $cf 'cert.pem'))) { throw "Run 'cloudflared tunnel login' first." }
$confirm = Read-Host "Is a Cloudflare Access app already protecting $Hostname? Type YES to continue"
if ($confirm -ne 'YES') { throw 'Stopped. Add the Access app first, then run this again.' }
if (-not (cloudflared tunnel list 2>$null | Select-String "\s$Name\s")) { cloudflared tunnel create $Name }
$id = ((cloudflared tunnel list | Select-String "\s$Name\s") -split '\s+')[0]
@"
tunnel: $id
credentials-file: $cf\$id.json
ingress:
  - hostname: $Hostname
    service: http://127.0.0.1:$Port
  - service: http_status:404
"@ | Set-Content -Encoding utf8 (Join-Path $cf 'config.yml')
cloudflared tunnel route dns $Name $Hostname
cloudflared service install
Write-Host "Done. Open https://$Hostname - you should see the Cloudflare login first."
