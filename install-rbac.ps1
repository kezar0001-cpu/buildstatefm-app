# Buildstate FM RBAC Installation Script for Windows
# Run this in PowerShell

Write-Host "=============================================="
Write-Host "  Buildstate FM RBAC System Installation (Windows)"
Write-Host "=============================================="
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Host "Error: Not in the agentfm-app root directory" -ForegroundColor Red
    Write-Host "Please run this script from the root of your agentfm-app repository"
    exit 1
}

Write-Host "Found package.json - you're in the right place!" -ForegroundColor Green
Write-Host ""

# Check if backend directory exists
if (-not (Test-Path "backend")) {
    Write-Host "Error: backend directory not found" -ForegroundColor Red
    exit 1
}

Write-Host "Found backend directory" -ForegroundColor Green
Write-Host ""

# Create necessary directories if they don't exist
Write-Host "Creating necessary directories..."

New-Item -ItemType Directory -Force -Path "backend\scripts" | Out-Null
New-Item -ItemType Directory -Force -Path "backend\src\utils" | Out-Null
New-Item -ItemType Directory -Force -Path "backend\middleware" | Out-Null

Write-Host "Directories ready" -ForegroundColor Green
Write-Host ""

# Backup existing schema.prisma
Write-Host "Backing up existing schema.prisma..."

if (Test-Path "backend\prisma\schema.prisma") {
    Copy-Item "backend\prisma\schema.prisma" "backend\prisma\schema.prisma.backup"
    Write-Host "Backup created: backend\prisma\schema.prisma.backup" -ForegroundColor Green
} else {
    Write-Host "No existing schema.prisma found - this is a fresh install" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Looking for rbac-files.tar.gz..."

# Check if the tar file exists
if (-not (Test-Path "rbac-files.tar.gz")) {
    Write-Host "Error: rbac-files.tar.gz not found" -ForegroundColor Red
    Write-Host "Please download it and place it in the current directory"
    Write-Host "Then run this script again"
    exit 1
}

Write-Host "Found rbac-files.tar.gz" -ForegroundColor Green
Write-Host ""

# Extract files
Write-Host "Extracting files..."

# Create temp directory
New-Item -ItemType Directory -Force -Path ".rbac-temp" | Out-Null

# Extract using tar (available in Windows 10+)
tar -xzf rbac-files.tar.gz -C .rbac-temp

Write-Host "Files extracted" -ForegroundColor Green
Write-Host ""

# Move files to correct locations
Write-Host "Copying files to correct locations..."

# Copy schema.prisma
if (Test-Path ".rbac-temp\schema.prisma") {
    Copy-Item ".rbac-temp\schema.prisma" "backend\prisma\schema.prisma"
    Write-Host "schema.prisma copied" -ForegroundColor Green
} else {
    Write-Host "schema.prisma not found in archive" -ForegroundColor Red
    exit 1
}

# Copy roleAuth.js
if (Test-Path ".rbac-temp\roleAuth.js") {
    Copy-Item ".rbac-temp\roleAuth.js" "backend\middleware\roleAuth.js"
    Write-Host "roleAuth.js copied" -ForegroundColor Green
} else {
    Write-Host "roleAuth.js not found in archive" -ForegroundColor Red
    exit 1
}

# Copy roleManager.js
if (Test-Path ".rbac-temp\roleManager.js") {
    Copy-Item ".rbac-temp\roleManager.js" "backend\src\utils\roleManager.js"
    Write-Host "roleManager.js copied" -ForegroundColor Green
} else {
    Write-Host "roleManager.js not found in archive" -ForegroundColor Red
    exit 1
}

# Copy migrate-roles.js
if (Test-Path ".rbac-temp\migrate-roles.js") {
    Copy-Item ".rbac-temp\migrate-roles.js" "backend\scripts\migrate-roles.js"
    Write-Host "migrate-roles.js copied" -ForegroundColor Green
} else {
    Write-Host "migrate-roles.js not found in archive" -ForegroundColor Red
    exit 1
}

# Copy documentation files
if (Test-Path ".rbac-temp\MIGRATION_GUIDE.md") {
    Copy-Item ".rbac-temp\MIGRATION_GUIDE.md" "backend\MIGRATION_GUIDE.md"
    Write-Host "MIGRATION_GUIDE.md copied" -ForegroundColor Green
}

if (Test-Path ".rbac-temp\RBAC_GUIDE.md") {
    Copy-Item ".rbac-temp\RBAC_GUIDE.md" "backend\RBAC_GUIDE.md"
    Write-Host "RBAC_GUIDE.md copied" -ForegroundColor Green
}

if (Test-Path ".rbac-temp\PHASE_1_COMPLETE.md") {
    Copy-Item ".rbac-temp\PHASE_1_COMPLETE.md" "PHASE_1_COMPLETE.md"
    Write-Host "PHASE_1_COMPLETE.md copied" -ForegroundColor Green
}

if (Test-Path ".rbac-temp\EXECUTIVE_SUMMARY.md") {
    Copy-Item ".rbac-temp\EXECUTIVE_SUMMARY.md" "EXECUTIVE_SUMMARY.md"
    Write-Host "EXECUTIVE_SUMMARY.md copied" -ForegroundColor Green
}

# Clean up temp directory
Remove-Item -Recurse -Force ".rbac-temp"

Write-Host ""
Write-Host "Cleaning up temporary files..."
Write-Host "Cleanup complete" -ForegroundColor Green
Write-Host ""

Write-Host "=============================================="
Write-Host "  Files Successfully Installed!"
Write-Host "=============================================="
Write-Host ""
Write-Host "Files have been copied to:"
Write-Host "   backend\prisma\schema.prisma"
Write-Host "   backend\middleware\roleAuth.js"
Write-Host "   backend\src\utils\roleManager.js"
Write-Host "   backend\scripts\migrate-roles.js"
Write-Host "   backend\MIGRATION_GUIDE.md"
Write-Host "   backend\RBAC_GUIDE.md"
Write-Host ""
Write-Host "NEXT STEPS:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Review the changes:"
Write-Host "   git status"
Write-Host ""
Write-Host "2. Install dependencies (if needed):"
Write-Host "   cd backend"
Write-Host "   npm install"
Write-Host ""
Write-Host "3. Generate Prisma client:"
Write-Host "   npx prisma generate"
Write-Host ""
Write-Host "4. Create database migration:"
Write-Host "   npx prisma migrate dev --name add_rbac_system"
Write-Host ""
Write-Host "5. Migrate existing data:"
Write-Host "   node scripts/migrate-roles.js"
Write-Host ""
Write-Host "6. Go back to root and commit:"
Write-Host "   cd .."
Write-Host "   git add ."
Write-Host "   git commit -m 'feat: add RBAC system with 5 user roles'"
Write-Host "   git push origin feature/add-rbac-system"
Write-Host ""
Write-Host "For detailed instructions, read:"
Write-Host "   EXECUTIVE_SUMMARY.md"
Write-Host "   backend\MIGRATION_GUIDE.md"
Write-Host ""
Write-Host "=============================================="
