# PowerShell script to run Prisma migration
# This script handles PATH issues and loads .env properly

$ErrorActionPreference = "Stop"

# Change to script directory
Set-Location $PSScriptRoot

# Try to find node/npm
$nodePath = Get-Command node -ErrorAction SilentlyContinue
$npmPath = Get-Command npm -ErrorAction SilentlyContinue

if (-not $nodePath) {
    # Try common Node.js installation paths
    $commonPaths = @(
        "$env:ProgramFiles\nodejs\node.exe",
        "$env:ProgramFiles (x86)\nodejs\node.exe",
        "$env:LOCALAPPDATA\Programs\nodejs\node.exe",
        "$env:USERPROFILE\AppData\Roaming\npm\node.exe"
    )
    
    foreach ($path in $commonPaths) {
        if (Test-Path $path) {
            $env:PATH = "$(Split-Path $path);$env:PATH"
            break
        }
    }
}

# Verify node is available
try {
    $nodeVersion = node --version 2>&1
    Write-Host "Using Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Node.js not found. Please install Node.js or restart your terminal." -ForegroundColor Red
    exit 1
}

# Load .env file if it exists
$envFile = Join-Path $PSScriptRoot ".env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]*)\s*=\s*(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            # Remove surrounding quotes if present
            if ($value -match '^["''](.*)["'']$') {
                $value = $matches[1]
            }
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
    Write-Host "Loaded .env file" -ForegroundColor Green
}

# Verify DATABASE_URL
if (-not $env:DATABASE_URL) {
    Write-Host "ERROR: DATABASE_URL not found in .env file or environment" -ForegroundColor Red
    exit 1
}

Write-Host "Running Prisma migration..." -ForegroundColor Yellow
npx prisma migrate dev --name add_recommendation_archiving

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nMigration completed successfully!" -ForegroundColor Green
} else {
    Write-Host "`nMigration failed. Check the error above." -ForegroundColor Red
    exit $LASTEXITCODE
}

