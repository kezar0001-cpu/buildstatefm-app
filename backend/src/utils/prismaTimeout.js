/**
 * Prisma query timeout utilities.
 * Provides timeout handling for long-running database queries.
 */

/**
 * Execute a Prisma query with a timeout.
 * 
 * @param {Promise} queryPromise - The Prisma query promise
 * @param {number} timeoutMs - Timeout in milliseconds (default: 30000 = 30 seconds)
 * @param {string} errorMessage - Custom error message (optional)
 * @returns {Promise} The query result or throws timeout error
 * 
 * @example
 * const users = await withTimeout(
 *   prisma.user.findMany(),
 *   10000, // 10 second timeout
 *   'User query timed out'
 * );
 */
export async function withTimeout(queryPromise, timeoutMs = 30000, errorMessage = 'Database query timed out') {
  return Promise.race([
    queryPromise,
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(errorMessage));
      }, timeoutMs);
    }),
  ]);
}

/**
 * Create a Prisma client extension with automatic timeout handling.
 * This can be used to add timeout to all queries.
 * 
 * @param {number} defaultTimeoutMs - Default timeout in milliseconds
 * @returns {object} Prisma extension
 */
export function createTimeoutExtension(defaultTimeoutMs = 30000) {
  return {
    query: {
      $allOperations: async ({ operation, model, args, query }) => {
        return withTimeout(
          query(args),
          defaultTimeoutMs,
          `Query on ${model || 'unknown'}.${operation} timed out after ${defaultTimeoutMs}ms`
        );
      },
    },
  };
}

/**
 * Wrap a Prisma transaction with timeout.
 * 
 * @param {function} transactionFn - Transaction callback function
 * @param {number} timeoutMs - Timeout in milliseconds (default: 60000 = 60 seconds)
 * @returns {Promise} Transaction result
 */
export async function transactionWithTimeout(transactionFn, timeoutMs = 60000) {
  return withTimeout(
    transactionFn(),
    timeoutMs,
    `Transaction timed out after ${timeoutMs}ms`
  );
}

export default {
  withTimeout,
  createTimeoutExtension,
  transactionWithTimeout,
};

