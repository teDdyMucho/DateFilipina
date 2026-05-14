#!/usr/bin/env pwsh
# ============================================================================
#  Deploys the agora-token Edge Function to Supabase.
#  Run from project root:  .\deploy-agora-fn.ps1
# ============================================================================

Set-Location $PSScriptRoot

$cliPath = ".\supabase-cli\supabase.exe"
if (-not (Test-Path $cliPath)) {
    Write-Host "Supabase CLI not found. Downloading..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Force -Path .\supabase-cli | Out-Null
    Invoke-WebRequest -Uri "https://github.com/supabase/cli/releases/latest/download/supabase_windows_amd64.tar.gz" -OutFile .\supabase-cli\supabase.tar.gz
    tar -xzf .\supabase-cli\supabase.tar.gz -C .\supabase-cli
    Remove-Item .\supabase-cli\supabase.tar.gz
}

# Hardcoded values for this project — change here if needed
$PROJECT_REF       = "aeqfwsfqshukqobvqahv"
$AGORA_APP_ID      = "de8a1297781249afb2ddd5ae52a0a519"
$AGORA_APP_CERT    = "b509fb6f68c24ae8b3f97ca1379b92ba"

# Get the access token from arg, env, or prompt
$token = $args[0]
if (-not $token) { $token = $env:SUPABASE_ACCESS_TOKEN }
if (-not $token) {
    Write-Host ""
    Write-Host "Need a Supabase Personal Access Token." -ForegroundColor Cyan
    Write-Host "Get one from: https://supabase.com/dashboard/account/tokens" -ForegroundColor Cyan
    Write-Host "Or: Dashboard -> avatar (top right) -> Account preferences -> Access Tokens" -ForegroundColor Cyan
    Write-Host ""
    $token = Read-Host "Paste your sbp_... token"
}

if (-not $token -or -not $token.StartsWith("sbp_")) {
    Write-Host "ERROR: token is empty or doesn't start with sbp_" -ForegroundColor Red
    exit 1
}

$env:SUPABASE_ACCESS_TOKEN = $token

Write-Host ""
Write-Host "Linking to project $PROJECT_REF..." -ForegroundColor Yellow
& $cliPath link --project-ref $PROJECT_REF
if ($LASTEXITCODE -ne 0) { Write-Host "Link failed." -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "Setting AGORA_APP_ID secret..." -ForegroundColor Yellow
& $cliPath secrets set AGORA_APP_ID=$AGORA_APP_ID
if ($LASTEXITCODE -ne 0) { Write-Host "Failed to set AGORA_APP_ID." -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "Setting AGORA_APP_CERTIFICATE secret..." -ForegroundColor Yellow
& $cliPath secrets set AGORA_APP_CERTIFICATE=$AGORA_APP_CERT
if ($LASTEXITCODE -ne 0) { Write-Host "Failed to set AGORA_APP_CERTIFICATE." -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "Deploying agora-token function..." -ForegroundColor Yellow
& $cliPath functions deploy agora-token --no-verify-jwt
if ($LASTEXITCODE -ne 0) { Write-Host "Deploy failed." -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "DONE! Function deployed at:" -ForegroundColor Green
Write-Host "  https://$PROJECT_REF.supabase.co/functions/v1/agora-token" -ForegroundColor Green
Write-Host ""
Write-Host "Test it with this command:" -ForegroundColor Cyan
Write-Host "  curl -X POST https://$PROJECT_REF.supabase.co/functions/v1/agora-token -H 'Content-Type: application/json' -d '{\"channel\":\"channel\"}'" -ForegroundColor Gray
