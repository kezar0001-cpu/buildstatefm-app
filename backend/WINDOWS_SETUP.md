# Windows Setup Guide

This guide covers Windows-specific setup instructions and common pitfalls when running the Buildstate FM backend on Windows.

## Prerequisites

- Node.js 18+ (ensure it's added to your PATH)
- PostgreSQL database
- PowerShell 5.1+ (included with Windows 10+)
- Git for Windows

## Running Prisma CLI on Windows

### ⚠️ Critical: Prisma Execution on Windows

On Windows, the Prisma CLI binary in `node_modules/.bin/prisma` is a **batch file (.cmd)**, not a JavaScript file. This causes a common problem if you try to execute it incorrectly.

#### ❌ INCORRECT - Will Fail

```powershell
# DO NOT DO THIS - This will fail!
$nodeExe = "node.exe"
$prismaPath = "node_modules/.bin/prisma.cmd"
& $nodeExe $prismaPath migrate dev
```

**Why this fails:** `node.exe` expects a JavaScript file as input, not a Windows batch file. Running `node.exe prisma.cmd` will throw an error before the migration starts.

#### ✅ CORRECT Approaches

**Option 1: Use npx (Recommended)**

```powershell
npx prisma generate
npx prisma migrate dev
npx prisma migrate deploy
```

This is the recommended approach because `npx` automatically resolves and executes the correct binary for your platform.

**Option 2: Call the .cmd shim directly**

```powershell
& node_modules/.bin/prisma migrate dev
```

Let PowerShell/Windows handle the .cmd file execution.

**Option 3: Target the JavaScript entry point directly**

```powershell
node node_modules/prisma/build/index.js migrate dev
```

This bypasses the .cmd shim entirely and runs the actual Prisma CLI JavaScript code.

## Setup Steps

### 1. Install Dependencies

```powershell
cd backend
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the `backend` directory:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
PORT=3000
JWT_SECRET=your-secret-min-32-chars
SESSION_SECRET=your-session-secret
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:3000
```

### 3. Generate Prisma Client

```powershell
npx prisma generate
```

### 4. Run Database Migrations

```powershell
npx prisma migrate dev --name init
```

Alternatively, use the provided PowerShell script:

```powershell
.\run-migration.ps1
```

This script automatically loads environment variables from `.env` and runs the migration.

### 5. Start the Development Server

```powershell
npm run dev
```

The backend should now be running on `http://localhost:3000`.

## Common Issues

### Issue: "Prisma CLI not found" or similar errors

**Solution:** Ensure you've run `npm install` in the backend directory and that `node_modules/.bin` is accessible.

### Issue: Migration fails with "node.exe" errors

**Solution:** You're likely trying to run the .cmd file through node.exe. Use `npx prisma` instead (see above).

### Issue: DATABASE_URL not found

**Solution:** Ensure your `.env` file is in the `backend` directory and contains a valid `DATABASE_URL`.

### Issue: PowerShell execution policy prevents running scripts

**Solution:** Run PowerShell as Administrator and execute:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

This allows you to run local scripts while still protecting against remote scripts.

## Running Tests

```powershell
npm test
```

## Additional Resources

- [Prisma Documentation](https://www.prisma.io/docs)
- [Node.js on Windows Best Practices](https://docs.microsoft.com/en-us/windows/dev-environment/javascript/nodejs-on-windows)
- [PowerShell Documentation](https://docs.microsoft.com/en-us/powershell/)

## Need Help?

If you encounter issues not covered here, check:
- The main [README.md](../README.md) in the project root
- The [backend README.md](./README.md) for general backend setup
- Existing GitHub issues in the project repository
