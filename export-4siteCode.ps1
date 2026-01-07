<#
export-apfs.ps1
Creates a portable zip for moving the project to another machine.
- Includes: src/, backend/ (or server/), package.json, configs, etc.
- Excludes: node_modules, dist, .angular, .git, logs, .env, coverage, caches
#>

param(
  [string]$ProjectRoot = (Get-Location).Path,
  [string]$OutDir = "exports",
  [string]$ZipNamePrefix = "apfs-export"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# --- helpers ---
function Ensure-Dir($path) {
  if (!(Test-Path $path)) { New-Item -ItemType Directory -Path $path | Out-Null }
}

# Timestamped name
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
Ensure-Dir (Join-Path $ProjectRoot $OutDir)

$zipPath = Join-Path (Join-Path $ProjectRoot $OutDir) ("{0}-{1}.zip" -f $ZipNamePrefix, $stamp)


# If your backend folder is named differently, add it here
$includeIfExists = @(
  "src",
  "server",
  "api",
  "public",
  "angular.json",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "tsconfig.app.json",
  "tsconfig.spec.json",
  "vite.config.*",
  "proxy.conf*.json",
  "proxy.conf*.js",
  "proxy.conf*.cjs",
  "proxy.config.*",
  ".browserslistrc",
  ".editorconfig",
  ".eslint*",
  ".prettier*",
  "README*",
  "LICENSE*",
  "Dockerfile*",
  "docker-compose*.yml",
  "docker-compose*.yaml"
)

# Expand globs and only keep existing
$itemsToZip = @()
foreach ($p in $includeIfExists) {
  $matches = Get-ChildItem -Path (Join-Path $ProjectRoot $p) -Force -ErrorAction SilentlyContinue
  if ($matches) { $itemsToZip += $matches }
}

if ($itemsToZip.Count -eq 0) {
  throw "No include targets found. Run this script from the repo root."
}

# Exclusions (anywhere in path)
$excludePatterns = @(
  "\node_modules\",
  "\dist\",
  "\build\",
  "\out\",
  "\.angular\",
  "\.cache\",
  "\.vite\",
  "\.nx\",
  "\.turbo\",
  "\coverage\",
  "\.git\",
  "\.vscode\",
  "\.idea\",
  "\.DS_Store",
  "\Thumbs.db",
  "\npm-debug.log",
  "\yarn-error.log",
  "\pnpm-debug.log",
  "\.env",
  "\.env.",
  "\logs\"
)

# Create a temp staging folder so Compress-Archive is deterministic
$temp = Join-Path $env:TEMP ("apfs_export_stage_{0}" -f $stamp)
if (Test-Path $temp) { Remove-Item $temp -Recurse -Force }
New-Item -ItemType Directory -Path $temp | Out-Null

Write-Host "Staging files..." -ForegroundColor Cyan

# Copy included items to staging, filtering out exclusions during copy
foreach ($item in $itemsToZip) {
  $srcPath = $item.FullName
  $destPath = Join-Path $temp ($item.Name)

  # Copy directories / files
  if ($item.PSIsContainer) {
    robocopy $srcPath $destPath /E /NFL /NDL /NJH /NJS /NC /NS | Out-Null
  }
  else {
    Copy-Item $srcPath $destPath -Force
  }
}

# Remove excluded paths from staging
Write-Host "Pruning exclusions..." -ForegroundColor Cyan
$all = Get-ChildItem -Path $temp -Recurse -Force -ErrorAction SilentlyContinue
foreach ($f in $all) {
  $full = $f.FullName
  foreach ($pat in $excludePatterns) {
    if ($full -match [regex]::Escape($pat).Replace("\\\\", "\").Replace("\", "\\")) {
      try {
        if ($f.PSIsContainer) { Remove-Item $full -Recurse -Force -ErrorAction SilentlyContinue }
        else { Remove-Item $full -Force -ErrorAction SilentlyContinue }
      }
      catch {}
      break
    }
  }
}

Write-Host "Creating zip: $zipPath" -ForegroundColor Green
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

Compress-Archive -Path (Join-Path $temp "*") -DestinationPath $zipPath -Force

# Cleanup
Remove-Item $temp -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "Done." -ForegroundColor Green
Write-Host "Zip created at: $zipPath"
