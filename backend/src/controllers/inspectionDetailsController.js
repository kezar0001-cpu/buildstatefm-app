import { randomUUID } from 'crypto';
import prisma from '../config/prismaClient.js';
import { sendError, ErrorCodes } from '../utils/errorHandler.js';
import { logAudit } from '../services/inspectionService.js';
import inspectionAIService from '../services/inspectionAIService.js';

// --- Rooms ---

export const addRoom = async (req, res) => {
  try {
    const { name, roomType, notes } = req.body;
    const inspectionId = req.params.id;

    const roomCount = await prisma.inspectionRoom.count({ where: { inspectionId } });

    const room = await prisma.inspectionRoom.create({
      data: {
        inspectionId,
        name,
        roomType,
        notes,
        order: roomCount,
      },
      include: { InspectionChecklistItem: true, InspectionIssue: true, InspectionPhoto: true },
    });

    await logAudit(inspectionId, req.user.id, 'ROOM_ADDED', { roomId: room.id, name });
    res.status(201).json({ room });
  } catch (error) {
    console.error('Failed to add room', error);
    sendError(res, 500, 'Failed to add room', ErrorCodes.ERR_INTERNAL_SERVER);
  }
};

export const getRooms = async (req, res) => {
  try {
    const rooms = await prisma.inspectionRoom.findMany({
      where: { inspectionId: req.params.id },
      orderBy: { order: 'asc' },
      include: {
        InspectionChecklistItem: { orderBy: { order: 'asc' } },
        InspectionIssue: { include: { InspectionPhoto: true } },
        InspectionPhoto: { orderBy: { order: 'asc' } },
      },
    });
    res.json({ rooms });
  } catch (error) {
    console.error('Failed to load rooms', error);
    sendError(res, 500, 'Failed to load rooms', ErrorCodes.ERR_INTERNAL_SERVER);
  }
};

export const updateRoom = async (req, res) => {
  try {
    const { name, roomType, notes, order } = req.body;
    const room = await prisma.inspectionRoom.update({
      where: { id: req.params.roomId },
      data: { name, roomType, notes, order },
      include: { InspectionChecklistItem: true, InspectionIssue: true, InspectionPhoto: true },
    });

    await logAudit(req.params.id, req.user.id, 'ROOM_UPDATED', { roomId: room.id });
    res.json({ room });
  } catch (error) {
    console.error('Failed to update room', error);
    sendError(res, 500, 'Failed to update room', ErrorCodes.ERR_INTERNAL_SERVER);
  }
};

export const deleteRoom = async (req, res) => {
  try {
    await prisma.inspectionRoom.delete({ where: { id: req.params.roomId } });
    await logAudit(req.params.id, req.user.id, 'ROOM_DELETED', { roomId: req.params.roomId });
    res.status(204).send();
  } catch (error) {
    console.error('Failed to delete room', error);
    sendError(res, 500, 'Failed to delete room', ErrorCodes.ERR_INTERNAL_SERVER);
  }
};

// --- Checklist Items ---

export const generateAIChecklist = async (req, res) => {
  try {
    const { id: inspectionId, roomId } = req.params;

    // Get inspection and room details
    const inspection = await prisma.inspection.findUnique({
      where: { id: inspectionId },
      select: { type: true }
    });

    const room = await prisma.inspectionRoom.findUnique({
      where: { id: roomId },
      select: { name: true, roomType: true, notes: true }
    });

    if (!inspection || !room) {
      return sendError(res, 404, 'Inspection or room not found', ErrorCodes.ERR_NOT_FOUND);
    }

    // Get existing count to determine starting order
    const existingCount = await prisma.inspectionChecklistItem.count({ where: { roomId } });

    // Generate AI checklist (reads description/notes to identify issues)
    const aiItems = await inspectionAIService.generateChecklist({
      roomType: room.roomType,
      roomName: room.name,
      notes: room.notes || '',
      inspectionType: inspection.type
    });

    // Create checklist items in database (append to existing if any)
    const createdItems = [];
    for (let i = 0; i < aiItems.length; i++) {
      const item = await prisma.inspectionChecklistItem.create({
        data: {
          id: randomUUID(),
          roomId,
          description: aiItems[i].description,
          status: 'PENDING',
          notes: aiItems[i].category ? `Category: ${aiItems[i].category}, Priority: ${aiItems[i].priority}` : '',
          order: existingCount + i,
        },
      });
      createdItems.push(item);
    }

    await logAudit(inspectionId, req.user.id, 'AI_CHECKLIST_GENERATED', {
      roomId,
      itemCount: createdItems.length,
      appended: existingCount > 0
    });

    res.status(201).json({
      success: true,
      items: createdItems,
      count: createdItems.length
    });
  } catch (error) {
    console.error('Failed to generate AI checklist', error);
    sendError(res, 500, error.message || 'Failed to generate AI checklist', ErrorCodes.ERR_INTERNAL_SERVER);
  }
};

export const addChecklistItem = async (req, res) => {
  try {
    const { description, status, notes } = req.body;
    const roomId = req.params.roomId;

    const itemCount = await prisma.inspectionChecklistItem.count({ where: { roomId } });

    const item = await prisma.inspectionChecklistItem.create({
      data: {
        id: randomUUID(),
        roomId,
        description,
        status: status || 'PENDING',
        notes,
        order: itemCount,
      },
    });

    await logAudit(req.params.id, req.user.id, 'CHECKLIST_ITEM_ADDED', { itemId: item.id });
    res.status(201).json({ item });
  } catch (error) {
    console.error('Failed to add checklist item', error);
    sendError(res, 500, 'Failed to add checklist item', ErrorCodes.ERR_INTERNAL_SERVER);
  }
};

export const updateChecklistItem = async (req, res) => {
  try {
    const { description, status, notes, order } = req.body;
    const item = await prisma.inspectionChecklistItem.update({
      where: { id: req.params.itemId },
      data: { description, status, notes, order },
    });

    await logAudit(req.params.id, req.user.id, 'CHECKLIST_ITEM_UPDATED', { itemId: item.id, status });
    res.json({ item });
  } catch (error) {
    console.error('Failed to update checklist item', error);
    sendError(res, 500, 'Failed to update checklist item', ErrorCodes.ERR_INTERNAL_SERVER);
  }
};

export const deleteChecklistItem = async (req, res) => {
  try {
    await prisma.inspectionChecklistItem.delete({ where: { id: req.params.itemId } });
    await logAudit(req.params.id, req.user.id, 'CHECKLIST_ITEM_DELETED', { itemId: req.params.itemId });
    res.status(204).send();
  } catch (error) {
    console.error('Failed to delete checklist item', error);
    sendError(res, 500, 'Failed to delete checklist item', ErrorCodes.ERR_INTERNAL_SERVER);
  }
};

// --- Issues ---

export const addIssue = async (req, res) => {
  try {
    const { roomId, checklistItemId, title, description, severity, status } = req.body;
    const inspectionId = req.params.id;

    const issue = await prisma.inspectionIssue.create({
      data: {
        inspectionId,
        roomId,
        checklistItemId,
        title,
        description,
        severity: severity || 'MEDIUM',
        status: status || 'OPEN',
      },
      include: { InspectionRoom: true, InspectionChecklistItem: true, InspectionPhoto: true },
    });

    await logAudit(inspectionId, req.user.id, 'ISSUE_ADDED', { issueId: issue.id, severity });
    res.status(201).json({ issue });
  } catch (error) {
    console.error('Failed to add issue', error);
    sendError(res, 500, 'Failed to add issue', ErrorCodes.ERR_INTERNAL_SERVER);
  }
};

export const getIssues = async (req, res) => {
  try {
    const issues = await prisma.inspectionIssue.findMany({
      where: { inspectionId: req.params.id },
      include: {
        InspectionRoom: true,
        InspectionChecklistItem: true,
        InspectionPhoto: { orderBy: { order: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ issues });
  } catch (error) {
    console.error('Failed to load issues', error);
    sendError(res, 500, 'Failed to load issues', ErrorCodes.ERR_INTERNAL_SERVER);
  }
};

export const updateIssue = async (req, res) => {
  try {
    const { title, description, severity, status } = req.body;
    const issue = await prisma.inspectionIssue.update({
      where: { id: req.params.issueId },
      data: { title, description, severity, status },
      include: { InspectionRoom: true, InspectionChecklistItem: true, InspectionPhoto: true },
    });

    await logAudit(req.params.id, req.user.id, 'ISSUE_UPDATED', { issueId: issue.id });
    res.json({ issue });
  } catch (error) {
    console.error('Failed to update issue', error);
    sendError(res, 500, 'Failed to update issue', ErrorCodes.ERR_INTERNAL_SERVER);
  }
};

export const deleteIssue = async (req, res) => {
  try {
    await prisma.inspectionIssue.delete({ where: { id: req.params.issueId } });
    await logAudit(req.params.id, req.user.id, 'ISSUE_DELETED', { issueId: req.params.issueId });
    res.status(204).send();
  } catch (error) {
    console.error('Failed to delete issue', error);
    sendError(res, 500, 'Failed to delete issue', ErrorCodes.ERR_INTERNAL_SERVER);
  }
};

// --- Photos ---

export const addPhoto = async (req, res) => {
  try {
    const { roomId, issueId, url, caption } = req.body;
    const inspectionId = req.params.id;

    let photoCount = 0;
    if (roomId) {
      photoCount = await prisma.inspectionPhoto.count({ where: { roomId } });
    } else if (issueId) {
      photoCount = await prisma.inspectionPhoto.count({ where: { issueId } });
    } else {
      photoCount = await prisma.inspectionPhoto.count({ where: { inspectionId, roomId: null, issueId: null } });
    }

    const photo = await prisma.inspectionPhoto.create({
      data: {
        id: randomUUID(),
        inspectionId,
        roomId,
        issueId,
        url,
        caption,
        order: photoCount,
        uploadedById: req.user.id,
      },
      include: {
        User: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await logAudit(inspectionId, req.user.id, 'PHOTO_ADDED', { photoId: photo.id });
    res.status(201).json({ photo });
  } catch (error) {
    console.error('Failed to add photo', error);
    sendError(res, 500, 'Failed to add photo', ErrorCodes.ERR_INTERNAL_SERVER);
  }
};

export const getPhotos = async (req, res) => {
  try {
    const photos = await prisma.inspectionPhoto.findMany({
      where: { inspectionId: req.params.id },
      orderBy: { order: 'asc' },
      include: {
        InspectionRoom: true,
        InspectionIssue: true,
        User: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    res.json({ photos });
  } catch (error) {
    console.error('Failed to load photos', error);
    sendError(res, 500, 'Failed to load photos', ErrorCodes.ERR_INTERNAL_SERVER);
  }
};

export const updatePhoto = async (req, res) => {
  try {
    const { caption, order } = req.body;
    const photo = await prisma.inspectionPhoto.update({
      where: { id: req.params.photoId },
      data: { caption, order },
    });
    res.json({ photo });
  } catch (error) {
    console.error('Failed to update photo', error);
    sendError(res, 500, 'Failed to update photo', ErrorCodes.ERR_INTERNAL_SERVER);
  }
};

export const deletePhoto = async (req, res) => {
  try {
    await prisma.inspectionPhoto.delete({ where: { id: req.params.photoId } });
    await logAudit(req.params.id, req.user.id, 'PHOTO_DELETED', { photoId: req.params.photoId });
    res.status(204).send();
  } catch (error) {
    console.error('Failed to delete photo', error);
    sendError(res, 500, 'Failed to delete photo', ErrorCodes.ERR_INTERNAL_SERVER);
  }
};

// --- Batched Queries ---

/**
 * Batched endpoint for inspection detail page
 * Combines inspection data, audit logs, and inspector options in a single optimized request
 */
export const getBatchedInspectionDetails = async (req, res) => {
  try {
    const inspectionId = req.params.id;

    // Execute all queries in parallel for maximum performance
    const [inspection, auditLogs, inspectors] = await Promise.all([
      // 1. Get full inspection data
      prisma.inspection.findUnique({
        where: { id: inspectionId },
        include: {
          property: true,
          unit: true,
          assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
          completedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          InspectionRoom: {
            orderBy: { order: 'asc' },
            include: {
              InspectionChecklistItem: { orderBy: { order: 'asc' } },
              InspectionIssue: {
                include: { InspectionPhoto: { orderBy: { order: 'asc' } } },
              },
              InspectionPhoto: { orderBy: { order: 'asc' } },
            },
          },
          InspectionIssue: {
            orderBy: { createdAt: 'desc' },
            include: {
              InspectionRoom: true,
              InspectionChecklistItem: true,
              InspectionPhoto: { orderBy: { order: 'asc' } },
            },
          },
          Job: {
            select: {
              id: true,
              title: true,
              description: true,
              status: true,
              priority: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
          },
          InspectionAttachment: {
            orderBy: { uploadedAt: 'desc' },
          },
        },
      }),

      // 2. Get audit logs
      prisma.inspectionAuditLog.findMany({
        where: { inspectionId },
        orderBy: { timestamp: 'desc' },
        include: {
          User: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
        take: 50, // Limit to recent 50 entries for performance
      }),

      // 3. Get inspector options (technicians)
      prisma.user.findMany({
        where: { role: 'TECHNICIAN', isActive: true },
        select: { id: true, firstName: true, lastName: true, email: true },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      }),
    ]);

    if (!inspection) {
      return sendError(res, 404, 'Inspection not found', ErrorCodes.RES_INSPECTION_NOT_FOUND);
    }

    // Return batched response
    res.json({
      inspection,
      auditLogs,
      inspectors,
      _meta: {
        batchedAt: new Date().toISOString(),
        queriesOptimized: 3,
      },
    });
  } catch (error) {
    console.error('Failed to load batched inspection details', error);
    sendError(res, 500, 'Failed to load inspection details', ErrorCodes.ERR_INTERNAL_SERVER);
  }
};
