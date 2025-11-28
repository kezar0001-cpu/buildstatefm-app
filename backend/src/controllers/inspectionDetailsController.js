import prisma from '../config/prismaClient.js';
import { sendError, ErrorCodes } from '../utils/errorHandler.js';
import { logAudit } from '../services/inspectionService.js';

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
      include: { checklistItems: true, issues: true, photos: true },
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
        checklistItems: { orderBy: { order: 'asc' } },
        issues: { include: { photos: true } },
        photos: { orderBy: { order: 'asc' } },
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
      include: { checklistItems: true, issues: true, photos: true },
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

export const addChecklistItem = async (req, res) => {
  try {
    const { description, status, notes } = req.body;
    const roomId = req.params.roomId;

    const itemCount = await prisma.inspectionChecklistItem.count({ where: { roomId } });

    const item = await prisma.inspectionChecklistItem.create({
      data: {
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
      include: { room: true, checklistItem: true, photos: true },
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
        room: true,
        checklistItem: true,
        photos: { orderBy: { order: 'asc' } },
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
      include: { room: true, checklistItem: true, photos: true },
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
        inspectionId,
        roomId,
        issueId,
        url,
        caption,
        order: photoCount,
        uploadedById: req.user.id,
      },
      include: {
        uploadedBy: { select: { id: true, firstName: true, lastName: true } },
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
        room: true,
        issue: true,
        uploadedBy: { select: { id: true, firstName: true, lastName: true } },
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
