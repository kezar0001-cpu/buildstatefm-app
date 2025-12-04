# PowerShell script to run Prisma migration with DATABASE_URL from .env
# Usage: .\run-migration.ps1

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
npx prisma migrate dev --name add_recommendation_archiving

