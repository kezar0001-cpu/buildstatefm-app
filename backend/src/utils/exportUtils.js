/**
 * Export utilities for generating CSV and other export formats
 */

/**
 * Convert array of objects to CSV string
 * @param {Array<Object>} data - Array of objects to convert
 * @param {Array<string>} headers - Column headers (optional, will use object keys if not provided)
 * @returns {string} CSV string
 */
export function arrayToCSV(data, headers = null) {
  if (!data || data.length === 0) {
    return '';
  }

  // Determine headers from first object if not provided
  const csvHeaders = headers || Object.keys(data[0]);

  // Escape CSV values (handle commas, quotes, newlines)
  const escapeCSVValue = (value) => {
    if (value === null || value === undefined) {
      return '';
    }
    const stringValue = String(value);
    // If value contains comma, quote, or newline, wrap in quotes and escape quotes
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  // Build CSV rows
  const rows = [
    // Header row
    csvHeaders.map(escapeCSVValue).join(','),
    // Data rows
    ...data.map((row) =>
      csvHeaders.map((header) => {
        const value = row[header];
        // Handle nested objects/arrays
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          return escapeCSVValue(JSON.stringify(value));
        }
        if (Array.isArray(value)) {
          return escapeCSVValue(value.join('; '));
        }
        return escapeCSVValue(value);
      }).join(',')
    ),
  ];

  return rows.join('\n');
}

/**
 * Generate CSV export for jobs
 * @param {Array<Object>} jobs - Array of job objects
 * @returns {string} CSV string
 */
export function exportJobsToCSV(jobs) {
  const headers = [
    'ID',
    'Title',
    'Description',
    'Status',
    'Priority',
    'Property Name',
    'Property Address',
    'Unit Number',
    'Assigned To',
    'Scheduled Date',
    'Created Date',
    'Completed Date',
    'Estimated Cost',
    'Actual Cost',
  ];

  const csvData = jobs.map((job) => ({
    'ID': job.id,
    'Title': job.title,
    'Description': job.description || '',
    'Status': job.status,
    'Priority': job.priority,
    'Property Name': job.property?.name || '',
    'Property Address': job.property?.address || '',
    'Unit Number': job.unit?.unitNumber || '',
    'Assigned To': job.assignedTo ? `${job.assignedTo.firstName} ${job.assignedTo.lastName}` : '',
    'Scheduled Date': job.scheduledDate ? new Date(job.scheduledDate).toISOString() : '',
    'Created Date': job.createdAt ? new Date(job.createdAt).toISOString() : '',
    'Completed Date': job.completedDate ? new Date(job.completedDate).toISOString() : '',
    'Estimated Cost': job.estimatedCost || '',
    'Actual Cost': job.actualCost || '',
  }));

  return arrayToCSV(csvData, headers);
}

/**
 * Generate CSV export for properties
 * @param {Array<Object>} properties - Array of property objects
 * @returns {string} CSV string
 */
export function exportPropertiesToCSV(properties) {
  const headers = [
    'ID',
    'Name',
    'Address',
    'City',
    'State',
    'Zip Code',
    'Property Type',
    'Status',
    'Units Count',
    'Manager',
    'Created Date',
  ];

  const csvData = properties.map((property) => ({
    'ID': property.id,
    'Name': property.name,
    'Address': property.address || '',
    'City': property.city || '',
    'State': property.state || '',
    'Zip Code': property.zipCode || '',
    'Property Type': property.propertyType || '',
    'Status': property.status,
    'Units Count': property._count?.units || 0,
    'Manager': property.manager ? `${property.manager.firstName} ${property.manager.lastName}` : '',
    'Created Date': property.createdAt ? new Date(property.createdAt).toISOString() : '',
  }));

  return arrayToCSV(csvData, headers);
}

/**
 * Generate CSV export for inspections
 * @param {Array<Object>} inspections - Array of inspection objects
 * @returns {string} CSV string
 */
export function exportInspectionsToCSV(inspections) {
  const headers = [
    'ID',
    'Title',
    'Type',
    'Status',
    'Property Name',
    'Property Address',
    'Assigned Technician',
    'Scheduled Date',
    'Completed Date',
    'Created Date',
  ];

  const csvData = inspections.map((inspection) => ({
    'ID': inspection.id,
    'Title': inspection.title,
    'Type': inspection.type,
    'Status': inspection.status,
    'Property Name': inspection.property?.name || '',
    'Property Address': inspection.property?.address || '',
    'Assigned Technician': inspection.assignedTo ? `${inspection.assignedTo.firstName} ${inspection.assignedTo.lastName}` : '',
    'Scheduled Date': inspection.scheduledDate ? new Date(inspection.scheduledDate).toISOString() : '',
    'Completed Date': inspection.completedDate ? new Date(inspection.completedDate).toISOString() : '',
    'Created Date': inspection.createdAt ? new Date(inspection.createdAt).toISOString() : '',
  }));

  return arrayToCSV(csvData, headers);
}

/**
 * Generate CSV export for service requests
 * @param {Array<Object>} serviceRequests - Array of service request objects
 * @returns {string} CSV string
 */
export function exportServiceRequestsToCSV(serviceRequests) {
  const headers = [
    'ID',
    'Title',
    'Description',
    'Category',
    'Priority',
    'Status',
    'Property Name',
    'Unit Number',
    'Requested By',
    'Created Date',
    'Approved Date',
    'Rejected Date',
  ];

  const csvData = serviceRequests.map((request) => ({
    'ID': request.id,
    'Title': request.title,
    'Description': request.description || '',
    'Category': request.category,
    'Priority': request.priority,
    'Status': request.status,
    'Property Name': request.property?.name || '',
    'Unit Number': request.unit?.unitNumber || '',
    'Requested By': request.requestedBy ? `${request.requestedBy.firstName} ${request.requestedBy.lastName}` : '',
    'Created Date': request.createdAt ? new Date(request.createdAt).toISOString() : '',
    'Approved Date': request.approvedAt ? new Date(request.approvedAt).toISOString() : '',
    'Rejected Date': request.rejectedAt ? new Date(request.rejectedAt).toISOString() : '',
  }));

  return arrayToCSV(csvData, headers);
}

/**
 * Set CSV download headers on Express response
 * @param {Object} res - Express response object
 * @param {string} filename - Filename for download
 */
export function setCSVHeaders(res, filename) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  // Add BOM for Excel compatibility
  res.write('\ufeff');
}

