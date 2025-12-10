// backend/src/config/redisClient.js
import { createClient as createRedisClientDefault } from 'redis';

const DEFAULT_REDIS_URL = process.env.REDIS_URL || process.env.REDIS_TLS_URL || process.env.REDIS_HOST;

const noopClient = {
  isOpen: false,
  async connect() {},
  async get() { return null; },
  async set() {},
  async setEx() {},
  async del() {},
};

function getNoopClient() {
  return noopClient;
}

let redisClient = null;
let connectionFailed = false;
let connectPromise = null;
let createRedisClient = (...args) => createRedisClientDefault(...args);

function initialiseRedis() {
  if (redisClient) {
    return redisClient;
  }

  if (process.env.REDIS_DISABLED === 'true') {
    if (process.env.NODE_ENV !== 'test') {
      console.info('[Redis] Disabled via REDIS_DISABLED environment variable');
    }
    redisClient = getNoopClient();
    return redisClient;
  }

  const url = DEFAULT_REDIS_URL ? DEFAULT_REDIS_URL : undefined;

  // If no Redis URL is configured, use noop client instead of trying localhost
  if (!url) {
    if (process.env.NODE_ENV !== 'test') {
      console.info('[Redis] No Redis URL configured, using noop client. Set REDIS_URL to enable Redis caching.');
    }
    redisClient = getNoopClient();
    return redisClient;
  }

  // Skip localhost URLs in production - they won't work on cloud platforms
  const isLocalhost = url.includes('localhost') || url.includes('127.0.0.1');
  const isProduction = process.env.NODE_ENV === 'production';
  if (isLocalhost && isProduction) {
    console.warn('[Redis] Localhost URL detected in production environment. Using noop client instead.');
    console.warn('[Redis] To enable Redis, set REDIS_URL to a remote Redis instance (e.g., Redis Cloud, Upstash).');
    redisClient = getNoopClient();
    return redisClient;
  }

  try {
    // Upstash and other cloud Redis providers require TLS
    // Detect if URL uses rediss:// (TLS) or contains upstash
    const requiresTls = url.startsWith('rediss://') || url.includes('upstash');
    
    redisClient = createRedisClient({
      url,
      socket: {
        // Enable TLS for cloud Redis providers (Upstash, Redis Cloud, etc.)
        tls: requiresTls ? true : undefined,
        reconnectStrategy: (retries) => {
          // Stop reconnecting after 5 attempts
          if (retries > 5) {
            console.error('[Redis] Max reconnection attempts reached, falling back to noop client');
            connectionFailed = true;
            return false; // Stop reconnecting
          }
          return Math.min(retries * 50, 1000);
        },
      },
    });
    
    if (requiresTls) {
      console.log('[Redis] TLS enabled for secure connection');
    }

    redisClient.on('error', (error) => {
      if (process.env.NODE_ENV !== 'test' && !connectionFailed) {
        console.error('[Redis] Connection error:', error.message);
      }
    });

    redisClient.on('ready', () => {
      if (process.env.NODE_ENV !== 'test') {
        console.info('[Redis] Connected');
      }
      connectionFailed = false;
    });
  } catch (error) {
    console.error('[Redis] Failed to initialise client:', error.message);
    redisClient = getNoopClient();
  }

  return redisClient;
}

async function ensureConnected() {
  const client = initialiseRedis();

  if (!client || client === noopClient || typeof client.connect !== 'function') {
    return client;
  }

  if (connectionFailed) {
    return redisClient;
  }

  if (client.isOpen) {
    return client;
  }

  if (!connectPromise) {
    connectPromise = client
      .connect()
      .then(() => {
        if (process.env.NODE_ENV !== 'test') {
          console.info('[Redis] Connection established successfully');
        }
      })
      .catch((error) => {
        if (process.env.NODE_ENV !== 'test') {
          console.error('[Redis] Connection failed:', error.message);
          console.info('[Redis] Falling back to noop client (caching disabled)');
        }
        connectionFailed = true;
        redisClient = getNoopClient();
        return redisClient;
      })
      .finally(() => {
        connectPromise = null;
      });
  }

  try {
    await connectPromise;
  } catch (_error) {
    // connectPromise handles logging and fallback on failure
  }

  return redisClient;
}

export function getRedisClient() {
  const client = initialiseRedis();
  // Kick off connection in the background so callers get the live client instance
  ensureConnected().catch(() => {});
  return client;
}

export async function getConnectedRedisClient() {
  return ensureConnected();
}

export async function redisGet(key) {
  const client = await ensureConnected();
  if (!client?.isOpen) return null;
  try {
    return await client.get(key);
  } catch (error) {
    console.warn('[Redis] Failed to get key', key, error.message);
    return null;
  }
}

export async function redisSet(key, value, ttlSeconds = 300) {
  const client = await ensureConnected();
  if (!client?.isOpen) return;
  try {
    const payload = typeof value === 'string' ? value : JSON.stringify(value);
    await client.set(key, payload, {
      EX: ttlSeconds,
    });
  } catch (error) {
    console.warn('[Redis] Failed to set key', key, error.message);
  }
}

export async function redisDel(key) {
  const client = await ensureConnected();
  if (!client?.isOpen) return;
  try {
    await client.del(key);
  } catch (error) {
    console.warn('[Redis] Failed to delete key', key, error.message);
  }
}

export async function redisDelPattern(pattern) {
  const client = await ensureConnected();
  if (!client?.isOpen) return;

  try {
    if (typeof client.scanIterator === 'function') {
      const deletions = [];
      for await (const key of client.scanIterator({ MATCH: pattern })) {
        deletions.push(client.del(key));
      }
      if (deletions.length) {
        await Promise.allSettled(deletions);
      }
      return;
    }

    if (typeof client.keys === 'function') {
      const keys = await client.keys(pattern);
      if (Array.isArray(keys) && keys.length) {
        await client.del(keys);
      }
    }
  } catch (error) {
    console.warn('[Redis] Failed to delete keys for pattern', pattern, error.message);
  }
}

export default {
  get: redisGet,
  set: redisSet,
  del: redisDel,
  delPattern: redisDelPattern,
};

export function __setRedisClientFactoryForTests(factory) {
  createRedisClient = factory;
  redisClient = null;
  connectionFailed = false;
  connectPromise = null;
}

export function __resetRedisClientForTests() {
  createRedisClient = (...args) => createRedisClientDefault(...args);
  redisClient = null;
  connectionFailed = false;
  connectPromise = null;
}
