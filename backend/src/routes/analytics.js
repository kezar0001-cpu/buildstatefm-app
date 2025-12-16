import { Router } from 'express';
import prisma from '../config/prismaClient.js';
import { asyncHandler } from '../utils/errorHandler.js';
import { z } from 'zod';
import { requireAdmin } from '../middleware/auth.js';
import { redisRateLimiter } from '../middleware/redisRateLimiter.js';

const router = Router();

const pageViewSchema = z.object({
  path: z.string(),
  referrer: z.string().optional(),
  userAgent: z.string().optional(),
  ipAddress: z.string().optional(),
  sessionId: z.string()
});

// Public endpoint for tracking pageviews
router.post('/pageview', 
  redisRateLimiter({ windowMs: 60 * 1000, max: 30 }),
  asyncHandler(async (req, res) => {
    const data = pageViewSchema.safeParse(req.body);
    if (!data.success) {
      return res.status(400).json({ success: false, error: 'Invalid data' });
    }

    await prisma.pageView.create({
      data: {
        ...data.data,
        timestamp: new Date()
      }
    });

    res.json({ success: true });
  })
);

// Admin endpoint for traffic analytics
router.get('/admin/traffic', 
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { period = '7d' } = req.query;
    const days = period === '30d' ? 30 : period === '90d' ? 90 : 7;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [
      totalVisits,
      uniqueVisitors,
      topPages,
      topReferrers
    ] = await Promise.all([
      prisma.pageView.count({ where: { timestamp: { gte: startDate } } }),
      prisma.pageView.count({
        distinct: ['sessionId'],
        where: { timestamp: { gte: startDate } }
      }),
      prisma.pageView.groupBy({
        by: ['path'],
        _count: { path: true },
        where: { timestamp: { gte: startDate } },
        orderBy: { _count: { path: 'desc' } },
        take: 10
      }),
      prisma.pageView.groupBy({
        by: ['referrer'],
        _count: { referrer: true },
        where: { 
          timestamp: { gte: startDate },
          referrer: { not: null }
        },
        orderBy: { _count: { referrer: 'desc' } },
        take: 10
      })
    ]);

    res.json({
      success: true,
      data: {
        totalVisits,
        uniqueVisitors,
        topPages,
        topReferrers,
        period,
        startDate: startDate.toISOString()
      }
    });
  })
);

export default router;
