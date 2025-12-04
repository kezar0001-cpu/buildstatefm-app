// Try to load .env file if it exists, but also use process.env (for environment variables)
import { config } from 'dotenv';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try loading .env from backend or root directory
const backendEnv = join(__dirname, '.env');
const rootEnv = join(__dirname, '..', '.env');

if (existsSync(backendEnv)) {
  config({ path: backendEnv });
} else if (existsSync(rootEnv)) {
  config({ path: rootEnv });
} else {
  // No .env file, rely on environment variables
  config(); // This will try to load from default locations
}

// Use DATABASE_URL from environment (set via .env or system environment)
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required. Please set it in your .env file or environment variables.');
}

export default {
  datasource: {
    url: databaseUrl,
  },
};

