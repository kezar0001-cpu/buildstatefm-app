import crypto from 'crypto';

/**
 * Constant-time string comparison to prevent timing attacks.
 * Uses crypto.timingSafeEqual for secure comparison.
 * 
 * @param {string} a - First string to compare
 * @param {string} b - Second string to compare
 * @returns {boolean} True if strings are equal
 */
export function constantTimeCompare(a, b) {
  if (!a || !b) {
    return false;
  }
  
  // Convert strings to buffers
  const aBuffer = Buffer.from(a, 'utf8');
  const bBuffer = Buffer.from(b, 'utf8');
  
  // If lengths differ, they're not equal
  if (aBuffer.length !== bBuffer.length) {
    return false;
  }
  
  // Use timing-safe comparison
  try {
    return crypto.timingSafeEqual(aBuffer, bBuffer);
  } catch (error) {
    // Fallback to regular comparison if timingSafeEqual fails
    return a === b;
  }
}

/**
 * Generate a cryptographically secure random token.
 * 
 * @param {number} length - Length of token in bytes (default: 32)
 * @returns {string} Hex-encoded random token
 */
export function generateSecureToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash a token using SHA-256.
 * Useful for storing tokens in a way that can be verified but not reversed.
 * 
 * @param {string} token - Token to hash
 * @returns {string} Hex-encoded hash
 */
export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export default {
  constantTimeCompare,
  generateSecureToken,
  hashToken,
};

