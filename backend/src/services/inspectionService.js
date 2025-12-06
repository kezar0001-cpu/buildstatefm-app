import prisma from '../config/prismaClient.js';
import { notifyInspectionCompleted, notifyInspectionReminder, notifyInspectionApproved, notifyInspectionRejected, sendNotification } from '../utils/notificationService.js';
import { generateAndUploadInspectionPDF } from './pdfService.js';
import { uploadToS3, getS3Url, isUsingS3 } from './s3Service.js';
import path from 'path';
import fs from 'fs/promises';

/**
 * Parse inspection findings and extract high-priority issues
 */
export function parseHighPriorityFindings(findingsText) {
  if (!findingsText || typeof findingsText !== 'string') {
    return [];
  }

  const findings = [];
  const lines = findingsText.split('\n').filter(line => line.trim());

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Check for explicit priority markers
    const urgentMatch = trimmedLine.match(/^(?:[?URGENT]?:?\s*)(.*)/i);
    const highMatch = trimmedLine.match(/^(?:[?HIGH]?:?\s*)(.*)/i);

    if (urgentMatch) {
      findings.push({
        priority: 'URGENT',
        description: urgentMatch[1].trim() || trimmedLine,
      });
    } else if (highMatch) {
      findings.push({
        priority: 'HIGH',
        description: highMatch[1].trim() || trimmedLine,
      });
    } else {
      // Check for implicit high-priority keywords
      const lowerLine = trimmedLine.toLowerCase();
      const criticalKeywords = ['critical', 'urgent', 'immediate', 'safety hazard', 'emergency', 'severe', 'dangerous'];

      if (criticalKeywords.some(keyword => lowerLine.includes(keyword))) {
        findings.push({
          priority: 'HIGH',
          description: trimmedLine,
        });
      }
    }
  }

  return findings;
}

export async function logAudit(inspectionId, userId, action, changes = null) {
  try {
    await prisma.inspectionAuditLog.create({
      data: {
        id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        inspectionId,
        userId: userId || null,
        action,
        changes,
      },
    });
  } catch (error) {
    console.error('Failed to persist inspection audit log', error);
  }
}

export const baseInspectionInclude = {
  property: {
    select: {
      id: true,
      name: true,
      address: true,
      city: true,
      state: true,
      manager: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  },
  unit: {
    select: {
      id: true,
      unitNumber: true,
    },
  },
  assignedTo: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  },
  completedBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  },
  InspectionAttachment: {
    orderBy: { uploadedAt: 'desc' },
    select: {
      id: true,
      fileUrl: true,
      fileName: true,
      fileType: true,
      size: true,
      annotations: true,
      uploadedAt: true,
      uploadedById: true,
      User: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  },
  InspectionReminder: {
    orderBy: { reminderDate: 'asc' },
  },
  report: true,
  InspectionRoom: {
    select: {
      id: true,
      name: true,
      roomType: true,
      order: true,
      InspectionChecklistItem: {
        select: {
          id: true,
          description: true,
          status: true,
          order: true,
        },
        orderBy: { order: 'asc' },
      },
    },
    orderBy: { order: 'asc' },
  },
};

export async function completeInspection(inspectionId, userId, userRole, payload) {
  const before = await prisma.inspection.findUnique({
    where: { id: inspectionId },
    include: {
      property: {
        include: { manager: true }
      },
      assignedTo: true,
      completedBy: true,
      InspectionRoom: {
        include: {
          InspectionChecklistItem: true,
        },
      },
    },
  });

  if (!before) {
    throw new Error('Inspection not found');
  }

  const findingsText = payload.findings ?? before.findings ?? '';
  const highPriorityFindings = parseHighPriorityFindings(findingsText);

  // Collect failed checklist items for creating recommendations
  const failedChecklistItems = [];
  if (before.InspectionRoom && before.InspectionRoom.length > 0) {
    for (const room of before.InspectionRoom) {
      if (room.InspectionChecklistItem && room.InspectionChecklistItem.length > 0) {
        const failedItems = room.InspectionChecklistItem.filter(item => item.status === 'FAILED');
        failedItems.forEach(item => {
          failedChecklistItems.push({
            roomName: room.name,
            description: item.description,
            item: item,
          });
        });
      }
    }
  }

  if (payload.previewOnly) {
    const previewJobs = highPriorityFindings.map((finding, index) => ({
      title: `${before.title} - Follow-Up ${index + 1}`,
      description: finding.description,
      priority: finding.priority,
      propertyId: before.propertyId,
      unitId: before.unitId,
      inspectionId: before.id,
    }));

    const previewRecommendations = failedChecklistItems.map((failedItem, index) => ({
      title: `${before.title} - ${failedItem.roomName}: ${failedItem.description.substring(0, 50)}`,
      description: `Failed inspection item in ${failedItem.roomName}: ${failedItem.description}`,
      propertyId: before.propertyId,
      priority: 'MEDIUM',
    }));

    return {
      preview: true,
      followUpJobs: previewJobs,
      totalJobsToCreate: previewJobs.length,
      recommendationsToCreate: previewRecommendations,
      totalRecommendations: previewRecommendations.length,
    };
  }

  // Technicians mark as PENDING_APPROVAL, Property Managers can directly mark as COMPLETED
  const newStatus = userRole === 'TECHNICIAN' ? 'PENDING_APPROVAL' : 'COMPLETED';

  const result = await prisma.$transaction(async (tx) => {
    const inspection = await tx.inspection.update({
      where: { id: inspectionId },
      data: {
        status: newStatus,
        completedDate: new Date(),
        completedById: userId,
        findings: payload.findings ?? before.findings,
        notes: payload.notes ?? before.notes,
        tags: payload.tags ?? before.tags,
        ...(newStatus === 'COMPLETED' && userRole !== 'TECHNICIAN' ? {
          approvedById: userId,
          approvedAt: new Date()
        } : {})
      },
      include: baseInspectionInclude,
    });

    await tx.inspectionAuditLog.create({
      data: {
        inspectionId,
        userId,
        action: 'COMPLETED',
        changes: { before, after: inspection },
      }
    });

    const createdJobs = [];
    if (payload.autoCreateJobs && highPriorityFindings.length > 0) {
      for (const [index, finding] of highPriorityFindings.entries()) {
        const job = await tx.job.create({
          data: {
            title: `${inspection.title} - Follow-Up ${index + 1}`,
            description: finding.description,
            priority: finding.priority,
            propertyId: inspection.propertyId,
            unitId: inspection.unitId,
            inspectionId: inspection.id,
            status: 'OPEN',
          },
        });
        createdJobs.push(job);

        await tx.inspectionAuditLog.create({
          data: {
            inspectionId,
            userId,
            action: 'JOB_CREATED',
            changes: { jobId: job.id, priority: finding.priority },
          }
        });
      }
    }

    // Create recommendations for failed checklist items
    const createdRecommendations = [];
    if (failedChecklistItems.length > 0) {
      // Find the report for this inspection to link recommendations
      const report = await tx.report.findFirst({
        where: { inspectionId: inspection.id },
        select: { id: true },
      });

      for (const failedItem of failedChecklistItems) {
        const recommendation = await tx.recommendation.create({
          data: {
            title: `${inspection.title} - ${failedItem.roomName}: ${failedItem.description.substring(0, 100)}`,
            description: `Failed inspection item in ${failedItem.roomName}: ${failedItem.description}`,
            propertyId: inspection.propertyId,
            reportId: report?.id || null,
            priority: 'MEDIUM',
            status: 'SUBMITTED',
            createdById: userId,
          },
        });
        createdRecommendations.push(recommendation);

        await tx.inspectionAuditLog.create({
          data: {
            inspectionId,
            userId,
            action: 'RECOMMENDATION_CREATED',
            changes: { recommendationId: recommendation.id, checklistItemId: failedItem.item.id },
          }
        });
      }
    }

    return { inspection, createdJobs, createdRecommendations };
  });

  // Notifications (outside transaction to avoid holding lock)
  try {
    const propertyManager = before.property?.manager;
    const completedByUser = userId === before.completedById
      ? before.completedBy
      : await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, firstName: true, lastName: true, email: true },
        });

    if (propertyManager && completedByUser) {
      await notifyInspectionCompleted(
        result.inspection,
        completedByUser,
        before.property,
        propertyManager,
        result.createdJobs
      );
    }

    // Notify property owners about created recommendations
    if (result.createdRecommendations && result.createdRecommendations.length > 0) {
      const property = await prisma.property.findUnique({
        where: { id: before.propertyId },
        include: {
          owners: {
            include: {
              owner: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const activeOwners = property?.owners?.filter(po => !po.endDate || new Date(po.endDate) > new Date()) || [];

      for (const recommendation of result.createdRecommendations) {
        const ownerNotifications = activeOwners.map((propertyOwner) => {
          const owner = propertyOwner.owner;
          return sendNotification(
            owner.id,
            'SERVICE_REQUEST_UPDATE',
            'New Inspection Recommendation',
            `A new recommendation has been created from inspection: "${before.title}"`,
            {
              entityType: 'recommendation',
              entityId: recommendation.id,
              sendEmail: true,
              emailData: {
                ownerName: `${owner.firstName} ${owner.lastName}`,
                managerName: completedByUser ? `${completedByUser.firstName} ${completedByUser.lastName}` : 'System',
                recommendationTitle: recommendation.title,
                propertyName: property.name,
                description: recommendation.description,
                priority: recommendation.priority,
                recommendationUrl: `${frontendUrl}/recommendations`,
              },
            }
          );
        });

        await Promise.allSettled(ownerNotifications);
      }
    }
  } catch (notificationError) {
    console.error('Failed to send notification', notificationError);
  }

  return {
    ...result.inspection,
    followUpJobsCreated: result.createdJobs.length,
    followUpJobs: result.createdJobs,
    recommendationsCreated: result.createdRecommendations?.length || 0,
    recommendations: result.createdRecommendations || [],
  };
}

export async function approveInspection(inspectionId, userId) {
  const inspection = await prisma.inspection.findUnique({
    where: { id: inspectionId },
    include: baseInspectionInclude
  });

  if (!inspection) throw new Error('Inspection not found');
  if (inspection.status !== 'PENDING_APPROVAL') throw new Error('Inspection is not pending approval');

  const updated = await prisma.inspection.update({
    where: { id: inspectionId },
    data: {
      status: 'COMPLETED',
      approvedById: userId,
      approvedAt: new Date(),
      rejectionReason: null,
      rejectedById: null,
      rejectedAt: null
    },
    include: baseInspectionInclude
  });

  await logAudit(inspectionId, userId, 'APPROVED', { before: inspection, after: updated });

  if (inspection.assignedToId) {
    await notifyInspectionApproved(inspection.assignedToId, updated);
  }

  return updated;
}

export async function rejectInspection(inspectionId, userId, reason, reassignToId) {
  const inspection = await prisma.inspection.findUnique({
    where: { id: inspectionId },
    include: baseInspectionInclude
  });

  if (!inspection) throw new Error('Inspection not found');
  if (inspection.status !== 'PENDING_APPROVAL') throw new Error('Inspection is not pending approval');

  const updateData = {
    status: 'IN_PROGRESS',
    rejectionReason: reason,
    rejectedById: userId,
    rejectedAt: new Date(),
    approvedById: null,
    approvedAt: null
  };

  if (reassignToId) {
    updateData.assignedToId = reassignToId;
  }

  const updated = await prisma.inspection.update({
    where: { id: inspectionId },
    data: updateData,
    include: baseInspectionInclude
  });

  await logAudit(inspectionId, userId, 'REJECTED', {
    before: inspection,
    after: updated,
    reason,
    reassignedTo: reassignToId
  });

  const notifyUserId = reassignToId || inspection.assignedToId;
  if (notifyUserId) {
    await notifyInspectionRejected(notifyUserId, updated, reason);
  }

  return updated;
}

export async function uploadSignature(inspectionId, userId, fileBuffer, mimeType) {
  const inspection = await prisma.inspection.findUnique({ where: { id: inspectionId } });
  if (!inspection) throw new Error('Inspection not found');
  if (!['MOVE_IN', 'MOVE_OUT'].includes(inspection.type)) {
    throw new Error('Signatures are only allowed for move-in and move-out inspections');
  }

  let signatureUrl;
  if (isUsingS3()) {
    const filename = `signature-${inspectionId}-${Date.now()}.png`;
    const s3Key = await uploadToS3('inspections/signatures', fileBuffer, filename, mimeType);
    signatureUrl = getS3Url(s3Key);
  } else {
    const uploadsDir = path.join(process.cwd(), 'uploads', 'inspections', 'signatures');
    await fs.mkdir(uploadsDir, { recursive: true });
    const filename = `signature-${inspectionId}-${Date.now()}.png`;
    const filePath = path.join(uploadsDir, filename);
    await fs.writeFile(filePath, fileBuffer);
    signatureUrl = `/uploads/inspections/signatures/${filename}`;
  }

  const updated = await prisma.inspection.update({
    where: { id: inspectionId },
    data: { tenantSignature: signatureUrl },
    include: baseInspectionInclude,
  });

  await logAudit(inspectionId, userId, 'SIGNATURE_ADDED', { signatureUrl });
  return updated;
}

export async function getTemplate(type) {
  // Placeholder for fetching templates from DB if they exist, 
  // otherwise returning default hardcoded ones to serve the API
  // Ideally these should be in the DB as InspectionTemplate records
  
  // Check if default templates exist in DB
  const template = await prisma.inspectionTemplate.findFirst({
    where: { type, isDefault: true, isActive: true },
    include: {
      InspectionTemplateRoom: {
        include: { InspectionTemplateChecklistItem: true },
        orderBy: { order: 'asc' }
      }
    }
  });

  if (template) return template;

  // Fallback to defaults (mirrors frontend structure but in backend) 
  // This allows us to migrate frontend hardcoded lists to here later
  return null; 
}
