# PowerShell script to run Prisma migration with DATABASE_URL from .env
# Usage: .\run-migration.ps1
#
# IMPORTANT: On Windows, node_modules/.bin/prisma is a .cmd batch file, not JavaScript.
# DO NOT attempt to run it through node.exe like: node.exe $prismaPath migrate dev
# This will fail because node.exe expects a .js file, not a .cmd batch script.
#
# Correct approaches:
#   1. Use npx (recommended) - npx prisma migrate dev
#   2. Call the .cmd shim directly - & node_modules/.bin/prisma migrate dev
#   3. Target the JS entry point - node node_modules/prisma/build/index.js migrate dev

# Try to load .env file if it exists
$envFile = Join-Path $PSScriptRoot ".env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]*)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
    Write-Host "Loaded environment variables from .env"
} else {
    Write-Host "No .env file found. Using system environment variables."
}

# Check if DATABASE_URL is set
if (-not $env:DATABASE_URL) {
    Write-Host "ERROR: DATABASE_URL is not set!" -ForegroundColor Red
    Write-Host "Please create a .env file in the backend directory with:" -ForegroundColor Yellow
    Write-Host "DATABASE_URL=your_actual_database_url_here" -ForegroundColor Yellow
    exit 1
}

Write-Host "Running Prisma migration..."

# Use npx to run Prisma CLI - this handles the Windows .cmd shim correctly
# npx automatically resolves and executes the correct binary for the platform
npx prisma migrate dev --name add_recommendation_archiving

