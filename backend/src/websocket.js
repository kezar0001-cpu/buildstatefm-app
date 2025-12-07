import { Server } from 'socket.io';
import logger from './utils/logger.js';
import { verifyAccessToken } from './utils/jwt.js';
import prisma from './config/prismaClient.js';

let io = null;

/**
 * Initialize Socket.IO server
 * @param {http.Server} server - HTTP server instance (must be the same instance used by Express)
 */
export function initWebsocket(server) {
  if (!server) {
    throw new Error('HTTP server instance is required to initialize Socket.IO');
  }

  // Build CORS origin list - start with required origins
  const corsOrigins = [
    'https://buildstate.com.au',
    'http://localhost:3000',
    'http://localhost:5173',
  ];

  // Add environment-based origins
  if (process.env.FRONTEND_URL) {
    corsOrigins.push(process.env.FRONTEND_URL.trim());
  }
  if (process.env.CORS_ORIGINS) {
    process.env.CORS_ORIGINS.split(',')
      .map((s) => s && s.trim())
      .filter(Boolean)
      .forEach((origin) => corsOrigins.push(origin));
  }

  // Add common Vercel patterns
  corsOrigins.push('https://agentfm.vercel.app');
  const dynamicOriginMatchers = [/https:\/\/.+\.vercel\.app$/];

  io = new Server(server, {
    path: '/api/socket.io',
    cors: {
      origin: (origin, callback) => {
        // No origin (same-origin requests, Postman, etc.)
        if (!origin) {
          logger.debug('WebSocket CORS: No origin header, allowing connection');
          return callback(null, true);
        }

        // Check static allowlist
        if (corsOrigins.includes(origin)) {
          logger.debug(`WebSocket CORS: Origin ${origin} found in allowlist`);
          return callback(null, true);
        }

        // Check dynamic matchers (e.g., *.vercel.app)
        if (dynamicOriginMatchers.some((regex) => regex.test(origin))) {
          logger.debug(`WebSocket CORS: Origin ${origin} matched dynamic pattern`);
          return callback(null, true);
        }

        // Reject origin
        logger.warn(`WebSocket CORS: Blocked origin: ${origin}`);
        return callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        logger.warn('WebSocket connection attempt without token');
        return next(new Error('Authentication token required'));
      }

      // Verify the JWT token
      const decoded = verifyAccessToken(token);

      if (!decoded || !decoded.id) {
        logger.warn('WebSocket connection attempt with invalid token');
        return next(new Error('Invalid authentication token'));
      }

      // Verify user exists and is active
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, role: true, isActive: true },
      });

      if (!user) {
        logger.warn(`WebSocket connection attempt for non-existent user: ${decoded.id}`);
        return next(new Error('User not found'));
      }

      if (!user.isActive) {
        logger.warn(`WebSocket connection attempt for inactive user: ${decoded.id}`);
        return next(new Error('Account is inactive'));
      }

      // Attach user info to socket
      socket.userId = user.id;
      socket.userRole = user.role;

      logger.info(`User ${user.id} authenticated for WebSocket connection`);
      next();
    } catch (error) {
      logger.error(`WebSocket authentication error: ${error.message}`);
      next(new Error('Authentication failed'));
    }
  });

  // Connection event handler
  io.on('connection', (socket) => {
    logger.info(`WebSocket client connected: ${socket.id} (User: ${socket.userId})`);

    // Join user-specific room for targeted notifications
    socket.join(`user:${socket.userId}`);
    logger.debug(`Socket ${socket.id} joined room: user:${socket.userId}`);

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      logger.info(`WebSocket client disconnected: ${socket.id} (User: ${socket.userId}, Reason: ${reason})`);
    });

    // Handle errors
    socket.on('error', (error) => {
      logger.error(`WebSocket error for socket ${socket.id}: ${error.message}`);
    });

    // Optionally handle ping-pong for connection health
    socket.on('ping', () => {
      socket.emit('pong');
    });
  });

  logger.info('✅ WebSocket server initialized successfully at /api/socket.io');
  return io;
}

/**
 * Get the Socket.IO instance
 * @returns {Server|null} Socket.IO server instance
 */
export function getIO() {
  if (!io) {
    logger.warn('Socket.IO not initialized. Call initWebsocket first.');
  }
  return io;
}

/**
 * Emit a notification to a specific user
 * @param {string} userId - User ID to send notification to
 * @param {object} notification - Notification object to send
 */
export function emitNotificationToUser(userId, notification) {
  if (!io) {
    logger.warn('Cannot emit notification: Socket.IO not initialized');
    return;
  }

  try {
    // Emit to user-specific room
    io.to(`user:${userId}`).emit('notification:new', notification);
    logger.debug(`Emitted notification to user ${userId}:`, {
      id: notification.id,
      type: notification.type,
      title: notification.title,
    });
  } catch (error) {
    logger.error(`Failed to emit notification to user ${userId}: ${error.message}`);
  }
}

/**
 * Emit a notification count update to a specific user
 * @param {string} userId - User ID to send count update to
 * @param {number} count - New unread notification count
 */
export function emitNotificationCountToUser(userId, count) {
  if (!io) {
    logger.warn('Cannot emit notification count: Socket.IO not initialized');
    return;
  }

  try {
    // Emit to user-specific room
    io.to(`user:${userId}`).emit('notification:count', { count });
    logger.debug(`Emitted notification count to user ${userId}: ${count}`);
  } catch (error) {
    logger.error(`Failed to emit notification count to user ${userId}: ${error.message}`);
  }
}

// Export for backward compatibility
export const initializeWebSocket = initWebsocket;

export default {
  initWebsocket,
  initializeWebSocket: initWebsocket,
  getIO,
  emitNotificationToUser,
  emitNotificationCountToUser,
};
