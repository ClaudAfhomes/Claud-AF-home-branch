$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$artifactDirectory = Join-Path $projectRoot "artifacts"
$archivePath = Join-Path $artifactDirectory "afhomes-platform-source.zip"

$excludedNames = @(
  ".git",
  ".env",
  ".env.local",
  ".env.test",
  ".mcp.json",
  "artifacts",
  "dist",
  "dist-ssr",
  "node_modules",
  "oracleJdk-26",
  "playwright-report",
  "test-results"
)

$archiveItems = Get-ChildItem -LiteralPath $projectRoot -Force |
  Where-Object { $excludedNames -notcontains $_.Name -and $_.Extension -ne ".zip" }

if ($archiveItems.Count -eq 0) {
  throw "No source files were found to package."
}

New-Item -ItemType Directory -Path $artifactDirectory -Force | Out-Null
if (Test-Path -LiteralPath $archivePath) {
  Remove-Item -LiteralPath $archivePath -Force
}

Compress-Archive -LiteralPath $archiveItems.FullName -DestinationPath $archivePath -CompressionLevel Optimal

$archive = Get-Item -LiteralPath $archivePath
$sizeMb = [math]::Round($archive.Length / 1MB, 2)
Write-Host "Created $archivePath ($sizeMb MB)"

if ($archive.Length -ge 500MB) {
  throw "The source archive is $sizeMb MB, which exceeds the 500 MB limit."
}
