import prisma from '../config/prismaClient.js';
import { sendEmail } from './email.js';
import emailTemplates from './emailTemplates.js';
import logger from './logger.js';
import { emitNotificationToUser } from '../websocket.js';

/**
 * Unified notification service that creates in-app notifications
 * and sends email notifications based on user preferences
 */

/**
 * Send a notification to a user
 * @param {string} userId - User ID to send notification to
 * @param {string} type - Notification type (from NotificationType enum)
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {object} options - Additional options
 * @param {string} options.entityType - Type of entity (e.g., 'job', 'inspection')
 * @param {string} options.entityId - ID of the entity
 * @param {boolean} options.sendEmail - Whether to send email (default: true)
 * @param {object} options.emailData - Data for email template
 */
export async function sendNotification(userId, type, title, message, options = {}) {
  try {
    // Create in-app notification
    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        entityType: options.entityType || null,
        entityId: options.entityId || null,
      },
    });

    logger.info(`Created notification for user ${userId}: ${type}`);

    // Emit real-time notification via WebSocket
    try {
      emitNotificationToUser(userId, notification);
    } catch (wsError) {
      // Log WebSocket error but don't fail the notification
      logger.error(`Failed to emit WebSocket notification: ${wsError.message}`);
    }

    // Send email if requested and user exists
    if (options.sendEmail !== false) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true, firstName: true, lastName: true },
        });

        if (user && user.email) {
          // Get email template based on notification type
          const templateKey = getTemplateKeyFromType(type);
          if (templateKey && emailTemplates[templateKey]) {
            const emailContent = emailTemplates[templateKey](options.emailData || {});

            // Prepare metadata for email tracking
            const emailMetadata = {
              userId,
              notificationType: type,
              entityType: options.entityType,
              entityId: options.entityId,
            };

            await sendEmail(user.email, emailContent.subject, emailContent.html, emailMetadata);
            logger.info(`Sent email notification to ${user.email}: ${type}`, {
              userId,
              notificationType: type,
              entityType: options.entityType,
              entityId: options.entityId,
            });
          }
        }
      } catch (emailError) {
        // Log email error but don't fail the notification
        logger.error(`Failed to send email notification: ${emailError.message}`, {
          userId,
          notificationType: type,
          entityType: options.entityType,
          entityId: options.entityId,
          error: emailError.message,
        });
      }
    }

    return notification;
  } catch (error) {
    logger.error(`Failed to send notification: ${error.message}`);
    throw error;
  }
}

/**
 * Send notification when a job is assigned to a technician
 */
export async function notifyJobAssigned(job, technician, property) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  
  return sendNotification(
    technician.id,
    'JOB_ASSIGNED',
    'New Job Assigned',
    `You have been assigned to: ${job.title}`,
    {
      entityType: 'job',
      entityId: job.id,
      emailData: {
        technicianName: `${technician.firstName} ${technician.lastName}`,
        jobTitle: job.title,
        propertyName: property.name,
        priority: job.priority,
        scheduledDate: job.scheduledDate ? new Date(job.scheduledDate).toLocaleDateString() : null,
        description: job.description,
        jobUrl: `${frontendUrl}/technician/jobs/${job.id}`,
      },
    }
  );
}

/**
 * Send notification when a job is completed
 */
export async function notifyJobCompleted(job, technician, property, manager) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  
  return sendNotification(
    manager.id,
    'JOB_COMPLETED',
    'Job Completed',
    `${technician.firstName} ${technician.lastName} completed: ${job.title}`,
    {
      entityType: 'job',
      entityId: job.id,
      emailData: {
        managerName: `${manager.firstName} ${manager.lastName}`,
        jobTitle: job.title,
        propertyName: property.name,
        technicianName: `${technician.firstName} ${technician.lastName}`,
        completedDate: new Date(job.completedDate).toLocaleDateString(),
        actualCost: job.actualCost,
        notes: job.notes,
        jobUrl: `${frontendUrl}/jobs/${job.id}`,
      },
    }
  );
}

/**
 * Send notification when a job is started
 */
export async function notifyJobStarted(job, property, manager) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  
  return sendNotification(
    manager.id,
    'JOB_ASSIGNED', // Reuse JOB_ASSIGNED type for status updates
    'Job Started',
    `Work has started on: ${job.title}`,
    {
      entityType: 'job',
      entityId: job.id,
      emailData: {
        managerName: `${manager.firstName} ${manager.lastName}`,
        jobTitle: job.title,
        propertyName: property.name,
        jobUrl: `${frontendUrl}/jobs/${job.id}`,
      },
    }
  );
}

/**
 * Send notification when a job is reassigned
 */
export async function notifyJobReassigned(job, previousTechnician, newTechnician, property) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  
  // Notify previous technician
  const prevNotification = sendNotification(
    previousTechnician.id,
    'JOB_ASSIGNED',
    'Job Reassigned',
    `You have been unassigned from: ${job.title}`,
    {
      entityType: 'job',
      entityId: job.id,
      emailData: {
        technicianName: `${previousTechnician.firstName} ${previousTechnician.lastName}`,
        jobTitle: job.title,
        propertyName: property.name,
        jobUrl: `${frontendUrl}/jobs/${job.id}`,
      },
    }
  );
  
  // Notify new technician
  const newNotification = notifyJobAssigned(job, newTechnician, property);
  
  return Promise.all([prevNotification, newNotification]);
}

/**
 * Send inspection reminder
 */
export async function notifyInspectionReminder(inspection, technician, property) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const scheduledDate = new Date(inspection.scheduledDate);
  const now = new Date();
  const hoursUntil = Math.round((scheduledDate - now) / (1000 * 60 * 60));
  
  let timeUntil;
  if (hoursUntil < 24) {
    timeUntil = `${hoursUntil} hours`;
  } else {
    timeUntil = `${Math.round(hoursUntil / 24)} days`;
  }
  
  return sendNotification(
    technician.id,
    'INSPECTION_REMINDER',
    'Inspection Reminder',
    `Upcoming inspection: ${inspection.title} at ${property.name}`,
    {
      entityType: 'inspection',
      entityId: inspection.id,
      emailData: {
        technicianName: `${technician.firstName} ${technician.lastName}`,
        inspectionTitle: inspection.title,
        propertyName: property.name,
        inspectionType: inspection.type,
        scheduledDate: scheduledDate.toLocaleDateString(),
        timeUntil,
        inspectionUrl: `${frontendUrl}/inspections/${inspection.id}`,
      },
    }
  );
}

/**
 * Send overdue inspection notification
 */
export async function notifyInspectionOverdue(inspection, technician, property) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const scheduledDate = new Date(inspection.scheduledDate);
  const now = new Date();
  const daysOverdue = Math.round((now - scheduledDate) / (1000 * 60 * 60 * 24));

  return sendNotification(
    technician.id,
    'INSPECTION_OVERDUE',
    'Inspection Overdue',
    `Overdue inspection: ${inspection.title} at ${property.name}`,
    {
      entityType: 'inspection',
      entityId: inspection.id,
      emailData: {
        technicianName: `${technician.firstName} ${technician.lastName}`,
        inspectionTitle: inspection.title,
        propertyName: property.name,
        inspectionType: inspection.type,
        scheduledDate: scheduledDate.toLocaleDateString(),
        daysOverdue,
        inspectionUrl: `${frontendUrl}/inspections/${inspection.id}`,
        unitNumber: inspection.unit?.unitNumber,
      },
    }
  );
}

/**
 * Send service request update notification
 */
export async function notifyServiceRequestUpdate(serviceRequest, tenant, property) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  return sendNotification(
    tenant.id,
    'SERVICE_REQUEST_UPDATE',
    'Service Request Update',
    `Your service request has been updated: ${serviceRequest.status}`,
    {
      entityType: 'serviceRequest',
      entityId: serviceRequest.id,
      emailData: {
        tenantName: `${tenant.firstName} ${tenant.lastName}`,
        requestTitle: serviceRequest.title,
        status: serviceRequest.status,
        category: serviceRequest.category,
        reviewNotes: serviceRequest.reviewNotes,
        jobCreated: serviceRequest.status === 'CONVERTED_TO_JOB',
        requestUrl: `${frontendUrl}/tenant/dashboard`,
      },
    }
  );
}

/**
 * Send trial expiring notification
 */
export async function notifyTrialExpiring(user, daysRemaining) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  
  return sendNotification(
    user.id,
    'SUBSCRIPTION_EXPIRING',
    'Trial Expiring Soon',
    `Your trial expires in ${daysRemaining} days`,
    {
      emailData: {
        userName: `${user.firstName} ${user.lastName}`,
        daysRemaining,
        upgradeUrl: `${frontendUrl}/subscriptions`,
      },
    }
  );
}

/**
 * Send welcome email to new user
 */
export async function sendWelcomeEmail(user) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  try {
    const emailContent = emailTemplates.welcomeEmail({
      userName: `${user.firstName} ${user.lastName}`,
      dashboardUrl: `${frontendUrl}/dashboard`,
    });

    const emailMetadata = {
      userId: user.id,
      emailType: 'welcome',
    };

    await sendEmail(user.email, emailContent.subject, emailContent.html, emailMetadata);
    logger.info(`Sent welcome email to ${user.email}`, emailMetadata);
  } catch (error) {
    logger.error(`Failed to send welcome email: ${error.message}`, {
      userId: user.id,
      error: error.message,
    });
  }
}

/**
 * Send notification when an inspection is completed
 */
export async function notifyInspectionCompleted(inspection, technician, property, manager, followUpJobs = []) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  return sendNotification(
    manager.id,
    'INSPECTION_COMPLETED',
    'Inspection Completed',
    `${technician.firstName} ${technician.lastName} completed inspection: ${inspection.title}`,
    {
      entityType: 'inspection',
      entityId: inspection.id,
      emailData: {
        managerName: `${manager.firstName} ${manager.lastName}`,
        inspectionTitle: inspection.title,
        propertyName: property.name,
        inspectionType: inspection.type,
        technicianName: `${technician.firstName} ${technician.lastName}`,
        completedDate: new Date(inspection.completedDate).toLocaleDateString(),
        findings: inspection.findings,
        notes: inspection.notes,
        followUpJobs: followUpJobs.map(job => ({
          title: job.title,
          description: job.description,
          priority: job.priority,
        })),
        inspectionUrl: `${frontendUrl}/inspections/${inspection.id}`,
      },
    }
  );
}

/**
 * Send notification to Owner when Property Manager adds cost estimate
 */
export async function notifyOwnerCostEstimateReady(serviceRequest, owner, manager, property) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  return sendNotification(
    owner.id,
    'SERVICE_REQUEST_UPDATE',
    'Cost Estimate Ready for Approval',
    `${manager.firstName} ${manager.lastName} has added a cost estimate of $${serviceRequest.managerEstimatedCost} for "${serviceRequest.title}"`,
    {
      entityType: 'serviceRequest',
      entityId: serviceRequest.id,
      emailData: {
        ownerName: `${owner.firstName} ${owner.lastName}`,
        requestTitle: serviceRequest.title,
        propertyName: property.name,
        managerName: `${manager.firstName} ${manager.lastName}`,
        estimatedCost: serviceRequest.managerEstimatedCost,
        costBreakdown: serviceRequest.costBreakdownNotes,
        requestUrl: `${frontendUrl}/owner/dashboard`,
      },
    }
  );
}

/**
 * Send notification to Property Manager when Owner approves service request
 */
export async function notifyManagerOwnerApproved(serviceRequest, manager, owner, property) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  return sendNotification(
    manager.id,
    'SERVICE_REQUEST_UPDATE',
    'Service Request Approved by Owner',
    `${owner.firstName} ${owner.lastName} approved the service request "${serviceRequest.title}" with a budget of $${serviceRequest.approvedBudget}`,
    {
      entityType: 'serviceRequest',
      entityId: serviceRequest.id,
      emailData: {
        managerName: `${manager.firstName} ${manager.lastName}`,
        ownerName: `${owner.firstName} ${owner.lastName}`,
        requestTitle: serviceRequest.title,
        propertyName: property.name,
        approvedBudget: serviceRequest.approvedBudget,
        requestUrl: `${frontendUrl}/service-requests/${serviceRequest.id}`,
      },
    }
  );
}

/**
 * Send notification to Property Manager when Owner rejects service request
 */
export async function notifyManagerOwnerRejected(serviceRequest, manager, owner, property, rejectionReason) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  return sendNotification(
    manager.id,
    'SERVICE_REQUEST_UPDATE',
    'Service Request Rejected by Owner',
    `${owner.firstName} ${owner.lastName} rejected the service request "${serviceRequest.title}"`,
    {
      entityType: 'serviceRequest',
      entityId: serviceRequest.id,
      emailData: {
        managerName: `${manager.firstName} ${manager.lastName}`,
        ownerName: `${owner.firstName} ${owner.lastName}`,
        requestTitle: serviceRequest.title,
        propertyName: property.name,
        rejectionReason: rejectionReason || 'No reason provided',
        requestUrl: `${frontendUrl}/service-requests/${serviceRequest.id}`,
      },
    }
  );
}

/**
 * Send notification to Owner when service request is converted to job
 */
export async function notifyOwnerJobCreated(serviceRequest, job, owner, property) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  return sendNotification(
    owner.id,
    'SERVICE_REQUEST_UPDATE',
    'Service Request Converted to Job',
    `Your service request "${serviceRequest.title}" has been converted to a job and work will begin soon`,
    {
      entityType: 'job',
      entityId: job.id,
      emailData: {
        ownerName: `${owner.firstName} ${owner.lastName}`,
        requestTitle: serviceRequest.title,
        jobTitle: job.title,
        propertyName: property.name,
        scheduledDate: job.scheduledDate ? new Date(job.scheduledDate).toLocaleDateString() : 'Not scheduled yet',
        estimatedCost: job.estimatedCost,
        jobUrl: `${frontendUrl}/jobs/${job.id}`,
      },
    }
  );
}

/**
 * Notify technician that their inspection was approved
 */
export async function notifyInspectionApproved(userId, inspection) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  return sendNotification(
    userId,
    'INSPECTION_APPROVED',
    'Inspection Approved',
    `Your inspection "${inspection.title}" has been approved by the property manager`,
    {
      entityType: 'inspection',
      entityId: inspection.id,
      emailData: {
        inspectionTitle: inspection.title,
        propertyName: inspection.property?.name || 'Unknown Property',
        inspectionUrl: `${frontendUrl}/inspections/${inspection.id}`,
      },
    }
  );
}

/**
 * Notify technician that their inspection was rejected
 */
export async function notifyInspectionRejected(userId, inspection, rejectionReason) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  return sendNotification(
    userId,
    'INSPECTION_REJECTED',
    'Inspection Rejected',
    `Your inspection "${inspection.title}" has been rejected. Reason: ${rejectionReason}`,
    {
      entityType: 'inspection',
      entityId: inspection.id,
      emailData: {
        inspectionTitle: inspection.title,
        propertyName: inspection.property?.name || 'Unknown Property',
        rejectionReason,
        inspectionUrl: `${frontendUrl}/inspections/${inspection.id}`,
      },
    }
  );
}

/**
 * Map notification type to email template key
 */
function getTemplateKeyFromType(type) {
  const mapping = {
    JOB_ASSIGNED: 'jobAssigned',
    JOB_COMPLETED: 'jobCompleted',
    INSPECTION_REMINDER: 'inspectionReminder',
    INSPECTION_COMPLETED: 'inspectionCompleted',
    INSPECTION_APPROVED: 'inspectionApproved',
    INSPECTION_REJECTED: 'inspectionRejected',
    SERVICE_REQUEST_UPDATE: 'serviceRequestUpdate',
    SUBSCRIPTION_EXPIRING: 'trialExpiring',
  };
  return mapping[type];
}

export default {
  sendNotification,
  notifyJobAssigned,
  notifyJobCompleted,
  notifyJobStarted,
  notifyJobReassigned,
  notifyInspectionReminder,
  notifyInspectionCompleted,
  notifyInspectionApproved,
  notifyInspectionRejected,
  notifyServiceRequestUpdate,
  notifyTrialExpiring,
  sendWelcomeEmail,
  // New approval workflow notifications
  notifyOwnerCostEstimateReady,
  notifyManagerOwnerApproved,
  notifyManagerOwnerRejected,
  notifyOwnerJobCreated,
};
