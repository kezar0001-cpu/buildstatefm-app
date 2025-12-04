# Direct migration runner - finds Node.js and runs migration
$ErrorActionPreference = "Stop"

Write-Host "=== Finding Node.js ===" -ForegroundColor Cyan

# Common Node.js installation paths
$searchPaths = @(
    "C:\Program Files\nodejs",
    "C:\Program Files (x86)\nodejs", 
    "$env:LOCALAPPDATA\Programs\nodejs",
    "$env:APPDATA\npm",
    "$env:USERPROFILE\AppData\Roaming\npm"
)

$nodeExe = $null
$npmExe = $null

foreach ($basePath in $searchPaths) {
    if (Test-Path $basePath) {
        $nodePath = Join-Path $basePath "node.exe"
        $npmPath = Join-Path $basePath "npm.cmd"
        
        if (Test-Path $nodePath) {
            $nodeExe = $nodePath
            Write-Host "Found Node.js: $nodeExe" -ForegroundColor Green
        }
        if (Test-Path $npmPath) {
            $npmExe = $npmPath
            Write-Host "Found npm: $npmExe" -ForegroundColor Green
        }
    }
}

# Also check current PATH
try {
    $nodeInPath = Get-Command node -ErrorAction SilentlyContinue
    if ($nodeInPath) {
        $nodeExe = $nodeInPath.Source
        Write-Host "Found Node.js in PATH: $nodeExe" -ForegroundColor Green
    }
} catch {}

if (-not $nodeExe) {
    Write-Host "ERROR: Node.js not found!" -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/" -ForegroundColor Yellow
    Write-Host "Or add Node.js to your system PATH" -ForegroundColor Yellow
    exit 1
}

# Set working directory
Set-Location $PSScriptRoot

# Load .env file
$envFile = Join-Path $PSScriptRoot ".env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]*)\s*=\s*(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            if ($value -match '^["''](.*)["'']$') {
                $value = $matches[1]
            }
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
    Write-Host "Loaded .env file" -ForegroundColor Green
}

# Check for Prisma in node_modules
$prismaPath = Join-Path $PSScriptRoot "node_modules\.bin\prisma.cmd"
if (-not (Test-Path $prismaPath)) {
    $prismaPath = Join-Path $PSScriptRoot "node_modules\.bin\prisma"
}

if (-not (Test-Path $prismaPath)) {
    Write-Host "ERROR: Prisma not found in node_modules" -ForegroundColor Red
    Write-Host "Please run: npm install" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n=== Running Migration ===" -ForegroundColor Cyan
Write-Host "Using Node.js: $nodeExe" -ForegroundColor Gray
Write-Host "Using Prisma: $prismaPath" -ForegroundColor Gray
Write-Host ""

# Run migration using node directly
$nodeDir = Split-Path $nodeExe
$env:Path = "$nodeDir;$env:Path"

& $nodeExe $prismaPath migrate dev --name add_recommendation_archiving

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n=== Migration Completed Successfully! ===" -ForegroundColor Green
} else {
    Write-Host "`n=== Migration Failed ===" -ForegroundColor Red
    exit $LASTEXITCODE
}

