/**
 * Status Transition Validation Utilities
 * 
 * Provides validation for status transitions across different entity types
 * to ensure only valid state changes are allowed.
 */

import { sendError, ErrorCodes } from './errorHandler.js';

/**
 * Service Request Status Transition Matrix
 * Maps current status to allowed next statuses
 */
const SERVICE_REQUEST_TRANSITIONS = {
  SUBMITTED: ['UNDER_REVIEW', 'REJECTED'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED', 'PENDING_OWNER_APPROVAL'],
  PENDING_MANAGER_REVIEW: ['PENDING_OWNER_APPROVAL', 'REJECTED'],
  PENDING_OWNER_APPROVAL: ['APPROVED_BY_OWNER', 'REJECTED_BY_OWNER'],
  APPROVED: ['CONVERTED_TO_JOB', 'REJECTED'],
  APPROVED_BY_OWNER: ['CONVERTED_TO_JOB', 'REJECTED'],
  REJECTED: [], // Terminal state
  REJECTED_BY_OWNER: ['PENDING_MANAGER_REVIEW'], // Can be resubmitted
  CONVERTED_TO_JOB: ['COMPLETED'],
  COMPLETED: [], // Terminal state
};

/**
 * Inspection Status Transition Matrix
 */
const INSPECTION_TRANSITIONS = {
  SCHEDULED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['PENDING_APPROVAL', 'CANCELLED'],
  PENDING_APPROVAL: ['COMPLETED', 'IN_PROGRESS'], // Can be rejected back to IN_PROGRESS
  COMPLETED: [], // Terminal state
  CANCELLED: [], // Terminal state
};

/**
 * Job Status Transition Matrix
 */
const JOB_TRANSITIONS = {
  OPEN: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [], // Terminal state
  CANCELLED: [], // Terminal state
};

/**
 * Validate a status transition for a service request
 * @param {string} currentStatus - Current status
 * @param {string} newStatus - Desired new status
 * @returns {boolean} - True if transition is valid
 */
export function isValidServiceRequestTransition(currentStatus, newStatus) {
  const allowedTransitions = SERVICE_REQUEST_TRANSITIONS[currentStatus] || [];
  return allowedTransitions.includes(newStatus);
}

/**
 * Validate a status transition for an inspection
 * @param {string} currentStatus - Current status
 * @param {string} newStatus - Desired new status
 * @returns {boolean} - True if transition is valid
 */
export function isValidInspectionTransition(currentStatus, newStatus) {
  const allowedTransitions = INSPECTION_TRANSITIONS[currentStatus] || [];
  return allowedTransitions.includes(newStatus);
}

/**
 * Validate a status transition for a job
 * @param {string} currentStatus - Current status
 * @param {string} newStatus - Desired new status
 * @returns {boolean} - True if transition is valid
 */
export function isValidJobTransition(currentStatus, newStatus) {
  const allowedTransitions = JOB_TRANSITIONS[currentStatus] || [];
  return allowedTransitions.includes(newStatus);
}

/**
 * Get allowed transitions for a service request status
 * @param {string} currentStatus - Current status
 * @returns {string[]} - Array of allowed next statuses
 */
export function getAllowedServiceRequestTransitions(currentStatus) {
  return SERVICE_REQUEST_TRANSITIONS[currentStatus] || [];
}

/**
 * Get allowed transitions for an inspection status
 * @param {string} currentStatus - Current status
 * @returns {string[]} - Array of allowed next statuses
 */
export function getAllowedInspectionTransitions(currentStatus) {
  return INSPECTION_TRANSITIONS[currentStatus] || [];
}

/**
 * Get allowed transitions for a job status
 * @param {string} currentStatus - Current status
 * @returns {string[]} - Array of allowed next statuses
 */
export function getAllowedJobTransitions(currentStatus) {
  return JOB_TRANSITIONS[currentStatus] || [];
}

/**
 * Get error message for invalid status transition
 * @param {string} currentStatus - Current status
 * @param {string} newStatus - Desired new status
 * @returns {string} - Error message
 */
export function getTransitionErrorMessage(currentStatus, newStatus) {
  const allowed = getAllowedJobTransitions(currentStatus);
  return `Invalid status transition from ${currentStatus} to ${newStatus}. Allowed transitions: ${allowed.join(', ') || 'none'}`;
}

/**
 * Middleware to validate service request status transition
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next function
 */
export function validateServiceRequestTransition(req, res, next) {
  const { currentStatus, newStatus } = req.body;
  
  if (!newStatus) {
    // No status change requested, allow through
    return next();
  }
  
  if (currentStatus && !isValidServiceRequestTransition(currentStatus, newStatus)) {
    const allowed = getAllowedServiceRequestTransitions(currentStatus);
    return sendError(
      res,
      400,
      `Invalid status transition from ${currentStatus} to ${newStatus}. Allowed transitions: ${allowed.join(', ') || 'none'}`,
      ErrorCodes.BIZ_INVALID_STATUS_TRANSITION
    );
  }
  
  next();
}

/**
 * Middleware to validate inspection status transition
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next function
 */
export function validateInspectionTransition(req, res, next) {
  const { currentStatus, newStatus } = req.body;
  
  if (!newStatus) {
    // No status change requested, allow through
    return next();
  }
  
  if (currentStatus && !isValidInspectionTransition(currentStatus, newStatus)) {
    const allowed = getAllowedInspectionTransitions(currentStatus);
    return sendError(
      res,
      400,
      `Invalid status transition from ${currentStatus} to ${newStatus}. Allowed transitions: ${allowed.join(', ') || 'none'}`,
      ErrorCodes.BIZ_INVALID_STATUS_TRANSITION
    );
  }
  
  next();
}

/**
 * Middleware to validate job status transition
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next function
 */
export function validateJobTransition(req, res, next) {
  const { currentStatus, newStatus } = req.body;
  
  if (!newStatus) {
    // No status change requested, allow through
    return next();
  }
  
  if (currentStatus && !isValidJobTransition(currentStatus, newStatus)) {
    const allowed = getAllowedJobTransitions(currentStatus);
    return sendError(
      res,
      400,
      `Invalid status transition from ${currentStatus} to ${newStatus}. Allowed transitions: ${allowed.join(', ') || 'none'}`,
      ErrorCodes.BIZ_INVALID_STATUS_TRANSITION
    );
  }
  
  next();
}

