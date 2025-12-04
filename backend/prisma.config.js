// Prisma 7 config - Load .env file
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from backend directory
const envPath = join(__dirname, '.env');
const result = config({ path: envPath });

// Get DATABASE_URL and remove quotes if present
let databaseUrl = process.env.DATABASE_URL;
if (databaseUrl) {
  // Remove surrounding quotes if present
  databaseUrl = databaseUrl.replace(/^["']|["']$/g, '').trim();
}

if (!databaseUrl) {
  throw new Error(
    `DATABASE_URL not found.\n` +
    `Looked for .env at: ${envPath}\n` +
    `Please ensure DATABASE_URL is set in your .env file.`
  );
}

export default {
  datasource: {
    url: databaseUrl,
  },
};

