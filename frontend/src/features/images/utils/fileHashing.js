/**
 * File hashing utilities for detecting duplicate files
 * Uses Web Crypto API (crypto.subtle.digest) for client-side hashing
 */

/**
 * Compute SHA-256 hash of a file
 * @param {File} file - The file to hash
 * @returns {Promise<string>} - Hex string representation of the hash
 */
export async function computeFileHash(file) {
  try {
    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    // Compute SHA-256 hash using Web Crypto API
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);

    // Convert hash to hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');

    return hashHex;
  } catch (error) {
    console.error('[fileHashing] Failed to compute hash:', error);
    throw new Error(`Failed to compute file hash: ${error.message}`);
  }
}

/**
 * Compute hashes for multiple files in parallel
 * @param {File[]} files - Array of files to hash
 * @returns {Promise<Map<File, string>>} - Map of files to their hash values
 */
export async function computeFileHashes(files) {
  try {
    const hashPromises = files.map(async (file) => {
      const hash = await computeFileHash(file);
      return [file, hash];
    });

    const results = await Promise.all(hashPromises);
    return new Map(results);
  } catch (error) {
    console.error('[fileHashing] Failed to compute hashes:', error);
    throw error;
  }
}

/**
 * Find duplicate files based on their hashes
 * @param {Map<File, string>} fileHashMap - Map of files to their hashes
 * @param {string[]} existingHashes - Array of hashes already in the system
 * @returns {Object} - Object containing duplicates and unique files
 */
export function findDuplicates(fileHashMap, existingHashes = []) {
  const existingHashSet = new Set(existingHashes);
  const duplicates = [];
  const unique = [];

  fileHashMap.forEach((hash, file) => {
    if (existingHashSet.has(hash)) {
      duplicates.push({ file, hash });
    } else {
      unique.push({ file, hash });
      // Add to set to also detect duplicates within the current batch
      existingHashSet.add(hash);
    }
  });

  return { duplicates, unique };
}
