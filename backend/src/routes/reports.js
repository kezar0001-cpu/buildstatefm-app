import express from 'express';
import { z } from 'zod';
import { prisma } from '../config/prismaClient.js';
import { requireAuth, requirePropertyManagerSubscription } from '../middleware/auth.js';
import { generateReport } from '../utils/reportGenerator.js';
import { sendError, ErrorCodes } from '../utils/errorHandler.js';

const router = express.Router();
router.use(requireAuth);

const reportSchema = z.object({
  reportType: z.enum([
    'MAINTENANCE_HISTORY',
    'UNIT_LEDGER',
    'MAINTENANCE_SUMMARY',
    'FINANCIAL_SUMMARY',
    'INSPECTION_TRENDS',
    'JOB_COMPLETION_TIMELINE',
    'ASSET_CONDITION_HISTORY',
    'PLANNED_VS_EXECUTED',
    'TENANT_ISSUE_HISTORY',
  ]),
  propertyId: z.string().min(1),
  unitId: z.string().optional().nullable(),
  fromDate: z.string().datetime(),
  toDate: z.string().datetime(),
});

// POST /api/reports - Create and generate a new report
// Reports are accessible to Property Managers and Owners
router.post('/', requireAuth, async (req, res) => {
  try {
    // Only Property Managers and Owners can create reports
    if (!['PROPERTY_MANAGER', 'OWNER'].includes(req.user.role)) {
      return sendError(res, 403, 'Only Property Managers and Owners can create reports', ErrorCodes.ACC_ACCESS_DENIED);
    }

    const payload = reportSchema.parse(req.body);

    // Verify user has access to the property
    const property = await prisma.property.findUnique({
      where: { id: payload.propertyId },
      include: {
        owners: { select: { ownerId: true } },
      },
    });

    if (!property) {
      return sendError(res, 404, 'Property not found', ErrorCodes.RES_PROPERTY_NOT_FOUND);
    }

    const hasAccess =
      req.user.role === 'PROPERTY_MANAGER' && property.managerId === req.user.id ||
      req.user.role === 'OWNER' && property.owners.some(o => o.ownerId === req.user.id);

    if (!hasAccess) {
      return sendError(res, 403, 'Access denied', ErrorCodes.ACC_ACCESS_DENIED);
    }

    // If unitId is provided, verify it belongs to the property
    if (payload.unitId) {
      const unit = await prisma.unit.findFirst({
        where: {
          id: payload.unitId,
          propertyId: payload.propertyId,
        },
      });

      if (!unit) {
        return sendError(res, 400, 'Unit does not belong to this property', ErrorCodes.VAL_VALIDATION_ERROR);
      }
    }

    // Create report request
    const reportRequest = await prisma.reportRequest.create({
      data: {
        reportType: payload.reportType,
        parameters: {
          fromDate: payload.fromDate,
          toDate: payload.toDate,
        },
        propertyId: payload.propertyId,
        unitId: payload.unitId,
        requestedById: req.user.id,
        status: 'PROCESSING',
      },
    });

    // Generate report immediately
    try {
      const reportData = await generateReport(reportRequest, property);
      
      // Update report with generated data
      const completedReport = await prisma.reportRequest.update({
        where: { id: reportRequest.id },
        data: {
          status: 'COMPLETED',
          fileUrl: reportData.url,
        },
        include: {
          property: { select: { id: true, name: true, address: true } },
          unit: { select: { id: true, unitNumber: true } },
        },
      });

      res.status(201).json({ success: true, report: completedReport });
    } catch (genError) {
      // Mark report as failed
      await prisma.reportRequest.update({
        where: { id: reportRequest.id },
        data: { status: 'FAILED' },
      });
      throw genError;
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, 400, 'Validation error', ErrorCodes.VAL_VALIDATION_ERROR, error.issues);
    }
    console.error('Failed to create report request:', error);
    return sendError(res, 500, 'Failed to generate report', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// GET /api/reports - Get all report requests
// Reports are only accessible to Property Managers and Owners
router.get('/', async (req, res) => {
  try {
    // Only Property Managers and Owners can view reports
    if (!['PROPERTY_MANAGER', 'OWNER'].includes(req.user.role)) {
      return sendError(res, 403, 'Only Property Managers and Owners can view reports', ErrorCodes.ACC_ACCESS_DENIED);
    }

    // Build where clause based on user role
    const where = {};
    
    if (req.user.role === 'PROPERTY_MANAGER') {
      // Property managers see reports for their properties
      where.property = {
        managerId: req.user.id,
      };
    } else if (req.user.role === 'OWNER') {
      // Owners see reports for properties they own
      where.property = {
        owners: {
          some: {
            ownerId: req.user.id,
          },
        },
      };
    }
    
    const reports = await prisma.reportRequest.findMany({
      where,
      include: {
        property: { select: { id: true, name: true, address: true } },
        unit: { select: { id: true, unitNumber: true } },
        requestedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    res.json({ success: true, reports });
  } catch (error) {
    console.error('Failed to fetch report requests:', error);
    return sendError(res, 500, 'Failed to fetch reports', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// GET /api/reports/:id - Get a single report
router.get('/:id', async (req, res) => {
  try {
    // Only Property Managers and Owners can view reports
    if (!['PROPERTY_MANAGER', 'OWNER'].includes(req.user.role)) {
      return sendError(res, 403, 'Only Property Managers and Owners can view reports', ErrorCodes.ACC_ACCESS_DENIED);
    }

    const report = await prisma.reportRequest.findUnique({
      where: { id: req.params.id },
      include: {
        property: { select: { id: true, name: true, address: true } },
        unit: { select: { id: true, unitNumber: true } },
        requestedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    if (!report) {
      return sendError(res, 404, 'Report not found', ErrorCodes.RES_REPORT_NOT_FOUND);
    }

    // Get property with owners for access check
    const property = await prisma.property.findUnique({
      where: { id: report.propertyId },
      include: {
        owners: { select: { ownerId: true } },
      },
    });

    if (!property) {
      return sendError(res, 404, 'Property not found', ErrorCodes.RES_PROPERTY_NOT_FOUND);
    }

    // Check access
    const hasAccess =
      req.user.role === 'PROPERTY_MANAGER' && property.managerId === req.user.id ||
      req.user.role === 'OWNER' && property.owners.some(o => o.ownerId === req.user.id) ||
      report.requestedById === req.user.id;

    if (!hasAccess) {
      return sendError(res, 403, 'Access denied', ErrorCodes.ACC_ACCESS_DENIED);
    }

    res.json({ success: true, report });
  } catch (error) {
    console.error('Failed to fetch report:', error);
    return sendError(res, 500, 'Failed to fetch report', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// GET /api/reports/:id/data - Get report data (for viewing)
router.get('/:id/data', async (req, res) => {
  try {
    const report = await prisma.reportRequest.findUnique({
      where: { id: req.params.id },
      include: {
        property: { select: { id: true, name: true, address: true, managerId: true } },
        unit: { select: { id: true, unitNumber: true } },
      },
    });

    if (!report) {
      return sendError(res, 404, 'Report not found', ErrorCodes.RES_REPORT_NOT_FOUND);
    }

    // Get property with owners for access check
    const property = await prisma.property.findUnique({
      where: { id: report.propertyId },
      include: {
        owners: { select: { ownerId: true } },
      },
    });

    if (!property) {
      return sendError(res, 404, 'Property not found', ErrorCodes.RES_PROPERTY_NOT_FOUND);
    }

    // Check access
    const hasAccess =
      req.user.role === 'PROPERTY_MANAGER' && property.managerId === req.user.id ||
      req.user.role === 'OWNER' && property.owners.some(o => o.ownerId === req.user.id) ||
      report.requestedById === req.user.id;

    if (!hasAccess) {
      return sendError(res, 403, 'Access denied', ErrorCodes.ACC_ACCESS_DENIED);
    }

    if (report.status !== 'COMPLETED') {
      return sendError(res, 425, 'Report is not ready yet.');
    }

    // Regenerate report data (in production, this would be cached/stored)
    const reportData = await generateReport(report, property);
    
    res.json({ success: true, data: reportData.data });
  } catch (error) {
    console.error('Failed to fetch report data:', error);
    return sendError(res, 500, 'Failed to fetch report data', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

// GET /api/reports/:id/download - Download a completed report
router.get('/:id/download', async (req, res) => {
  try {
    const report = await prisma.reportRequest.findUnique({
      where: { id: req.params.id },
      include: {
        property: {
          include: {
            owners: {
              select: { ownerId: true },
            },
          },
        },
      },
    });

    if (!report) {
      return sendError(res, 404, 'Report not found', ErrorCodes.RES_REPORT_NOT_FOUND);
    }

    // Check access
    const property = await prisma.property.findUnique({
      where: { id: report.propertyId },
      include: {
        owners: { select: { ownerId: true } },
      },
    });

    if (!property) {
      return sendError(res, 404, 'Property not found', ErrorCodes.RES_PROPERTY_NOT_FOUND);
    }

    const hasAccess =
      req.user.role === 'PROPERTY_MANAGER' && property.managerId === req.user.id ||
      req.user.role === 'OWNER' && property.owners.some(o => o.ownerId === req.user.id) ||
      report.requestedById === req.user.id;

    if (!hasAccess) {
      return sendError(res, 403, 'Access denied', ErrorCodes.ACC_ACCESS_DENIED);
    }

    if (report.status !== 'COMPLETED') {
      return sendError(res, 425, 'Report is not ready yet.');
    }

    if (!report.fileUrl) {
      return sendError(res, 500, 'Report file is missing.', ErrorCodes.ERR_INTERNAL_SERVER);
    }

    // Return the file URL for download
    res.json({ success: true, url: report.fileUrl });
  } catch (error) {
    console.error('Failed to download report:', error);
    return sendError(res, 500, 'Failed to download report', ErrorCodes.ERR_INTERNAL_SERVER);
  }
});

export default router;
