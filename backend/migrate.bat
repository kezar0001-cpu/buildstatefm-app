@echo off
REM Batch script to run Prisma migration
cd /d "%~dp0"
call npm run prisma:migrate:deploy 2>nul
if errorlevel 1 (
    echo Running migration with npx...
    where node >nul 2>&1
    if errorlevel 1 (
        echo ERROR: Node.js not found in PATH
        echo Please restart your terminal or add Node.js to PATH
        pause
        exit /b 1
    )
    npx prisma migrate dev --name add_recommendation_archiving
) else (
    echo Migration completed successfully!
)

