// backend/src/config/prismaClient.js
import { PrismaClient } from '@prisma/client';

// Single shared Prisma instance for the whole app
let prisma;

try {
  // Prisma 7: Use adapter for direct connection (config file handles migrations)
  prisma = new PrismaClient({
    log: ['error', 'warn'],
    errorFormat: 'pretty',
    // Connection URL from environment (Prisma 7 still supports this in client)
    // The prisma.config.js handles migrations, but client needs URL here
    ...(process.env.DATABASE_URL && {
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    }),
  });
} catch (error) {
  console.error('❌ Failed to initialize Prisma Client:', error.message);
  console.error('This usually means "prisma generate" needs to be run.');
  console.error('Attempting to continue with stub implementation...');

  // Create a stub Prisma client that will fail gracefully
  prisma = new Proxy({}, {
    get(target, prop) {
      if (prop in target) {
        return target[prop];
      }
      if (prop === '$connect') {
        return async () => {
          throw new Error('Prisma Client not properly initialized. Run: npx prisma generate');
        };
      }
      if (prop === '$disconnect') {
        return async () => {};
      }
      if (prop === '$queryRaw') {
        return async () => {
          throw new Error('Prisma Client not properly initialized. Run: npx prisma generate');
        };
      }
      return new Proxy({}, {
        get(innerTarget, innerProp) {
          if (innerProp in innerTarget) {
            return innerTarget[innerProp];
          }
          return () => {
            throw new Error('Prisma Client not properly initialized. Run: npx prisma generate');
          };
        }
      });
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    },
  });
}

export { prisma };
export default prisma;
