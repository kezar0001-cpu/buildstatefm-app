import puppeteer from 'puppeteer';
import { uploadToS3, getS3Url, isUsingS3 } from './s3Service.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Generate HTML template for inspection report
 */
function generateInspectionReportHTML(inspection, property, unit, assignedTo, completedBy) {
  // Normalize data structure - handle both Prisma model names and aliased names
  const normalizedInspection = {
    ...inspection,
    rooms: inspection.rooms || inspection.InspectionRoom || [],
    inspectionIssues: inspection.inspectionIssues || inspection.InspectionIssue || [],
    inspectionPhotos: inspection.inspectionPhotos || inspection.InspectionPhoto || [],
  };

  // Normalize room data
  normalizedInspection.rooms = normalizedInspection.rooms.map((room) => ({
    ...room,
    checklistItems: room.checklistItems || room.InspectionChecklistItem || [],
    photos: room.photos || room.InspectionPhoto || [],
  }));

  // Use normalized inspection for the rest of the function
  inspection = normalizedInspection;

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatDateTime = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      SCHEDULED: '#6B7280',
      IN_PROGRESS: '#3B82F6',
      COMPLETED: '#10B981',
      CANCELLED: '#EF4444',
    };
    return colors[status] || '#6B7280';
  };

  const getSeverityColor = (severity) => {
    const colors = {
      LOW: '#10B981',
      MEDIUM: '#F59E0B',
      HIGH: '#EF4444',
      CRITICAL: '#DC2626',
    };
    return colors[severity] || '#6B7280';
  };

  const generateIssuePhotosHTML = (photos) => {
    if (!photos?.length) return '';
    return `
      <div class="issue-photos">
        ${photos.map((photo) => `
          <img src="${photo.url || photo.imageUrl}" alt="Issue photo" class="issue-photo" />
        `).join('')}
      </div>
    `;
  };

  const generateRoomPhotosHTML = (photos) => {
    if (!photos?.length) return '';
    return `
      <div class="room-photos">
        <h4>Room Photos</h4>
        <div class="room-photos-grid">
          ${photos.map((photo) => `
            <div class="room-photo-card">
              <img src="${photo.url || photo.imageUrl}" alt="${photo.caption || 'Room photo'}" />
              ${photo.caption ? `<p class="photo-caption">${photo.caption}</p>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  };

  const roomsHTML = inspection.rooms?.length
    ? inspection.rooms
        .map(
          (room) => `
      <div class="room-section">
        <h3 class="room-title">${room.name} ${room.type ? `(${room.type})` : ''}</h3>
        ${
          room.notes
            ? `<p class="room-notes"><strong>Notes:</strong> ${room.notes}</p>`
            : ''
        }

        ${
          room.checklistItems?.length
            ? `
        <div class="checklist">
          <h4>Issues Found (${room.checklistItems.length})</h4>
          <ul class="checklist-items">
            ${room.checklistItems
              .map(
                (item) => `
              <li class="checklist-item ${item.status || ''}">
                <div class="checklist-item-content">
                  <div class="checklist-item-header">
                    <span class="checkbox ${item.status === 'PASSED' ? 'checked' : item.status === 'FAILED' ? 'failed' : ''}">
                      ${item.status === 'PASSED' ? '✓' : item.status === 'FAILED' ? '✗' : '○'}
                    </span>
                    <span class="item-name">${item.description || item.item || item.title || 'Issue'}</span>
                    ${item.severity ? `<span class="item-severity severity-${item.severity.toLowerCase()}">${item.severity}</span>` : ''}
                  </div>
                  ${item.notes ? `<p class="item-notes">${item.notes}</p>` : ''}
                  ${generateIssuePhotosHTML(item.photos)}
                </div>
              </li>
            `
              )
              .join('')}
          </ul>
        </div>
        `
            : ''
        }

        ${generateRoomPhotosHTML(room.photos)}
      </div>
    `
        )
        .join('')
    : '<p class="no-data">No room-by-room details recorded.</p>';

  const issuesHTML = inspection.inspectionIssues?.length
    ? inspection.inspectionIssues
        .map(
          (issue) => `
      <div class="issue-card">
        <div class="issue-header">
          <h4 class="issue-title">${issue.title}</h4>
          <span class="severity-badge" style="background-color: ${getSeverityColor(issue.severity)}">
            ${issue.severity}
          </span>
        </div>
        <p class="issue-description">${issue.description || 'No description provided'}</p>
        ${issue.location ? `<p class="issue-location"><strong>Location:</strong> ${issue.location}</p>` : ''}
        ${issue.recommendedAction ? `<p class="issue-action"><strong>Recommended Action:</strong> ${issue.recommendedAction}</p>` : ''}
      </div>
    `
        )
        .join('')
    : '<p class="no-data">No issues reported.</p>';

  const photosHTML = inspection.inspectionPhotos?.length
    ? `
    <div class="photos-grid">
      ${inspection.inspectionPhotos
        .map(
          (photo) => `
        <div class="photo-card">
          <img src="${photo.url}" alt="${photo.caption || 'Inspection photo'}" />
          ${photo.caption ? `<p class="photo-caption">${photo.caption}</p>` : ''}
          ${photo.location ? `<p class="photo-location">${photo.location}</p>` : ''}
        </div>
      `
        )
        .join('')}
    </div>
  `
    : '<p class="no-data">No photos attached.</p>';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Inspection Report - ${inspection.title}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 12px;
      line-height: 1.6;
      color: #1f2937;
      background: #ffffff;
    }

    .container {
      max-width: 900px;
      margin: 0 auto;
      padding: 40px 30px;
    }

    .header {
      text-align: center;
      margin-bottom: 40px;
      padding-bottom: 30px;
      border-bottom: 3px solid #3b82f6;
    }

    .logo {
      font-size: 32px;
      font-weight: 700;
      color: #3b82f6;
      margin-bottom: 10px;
    }

    .report-title {
      font-size: 24px;
      font-weight: 600;
      color: #111827;
      margin: 15px 0;
    }

    .report-subtitle {
      font-size: 14px;
      color: #6b7280;
    }

    .info-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
      margin-bottom: 40px;
    }

    .info-card {
      background: #f9fafb;
      padding: 20px;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
    }

    .info-label {
      font-size: 11px;
      font-weight: 600;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 5px;
    }

    .info-value {
      font-size: 14px;
      color: #111827;
      font-weight: 500;
    }

    .status-badge {
      display: inline-block;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      color: white;
    }

    .section {
      margin-bottom: 40px;
    }

    .section-title {
      font-size: 18px;
      font-weight: 600;
      color: #111827;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #e5e7eb;
    }

    .room-section {
      background: #f9fafb;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      border-left: 4px solid #3b82f6;
    }

    .room-title {
      font-size: 16px;
      font-weight: 600;
      color: #111827;
      margin-bottom: 10px;
    }

    .room-notes {
      font-size: 12px;
      color: #4b5563;
      margin-bottom: 15px;
      font-style: italic;
    }

    .checklist {
      margin-top: 15px;
    }

    .checklist h4 {
      font-size: 14px;
      font-weight: 600;
      color: #374151;
      margin-bottom: 10px;
    }

    .checklist-items {
      list-style: none;
    }

    .checklist-item {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 8px 0;
      border-bottom: 1px solid #e5e7eb;
    }

    .checklist-item:last-child {
      border-bottom: none;
    }

    .checkbox {
      width: 20px;
      height: 20px;
      border: 2px solid #d1d5db;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-size: 14px;
      font-weight: 700;
    }

    .checkbox.checked {
      background-color: #10b981;
      border-color: #10b981;
      color: white;
    }

    .checkbox.failed {
      background-color: #ef4444;
      border-color: #ef4444;
      color: white;
    }

    .item-name {
      flex: 1;
      font-size: 13px;
      color: #111827;
    }

    .item-notes {
      font-size: 11px;
      color: #6b7280;
      font-style: italic;
    }

    .issue-card {
      background: #fef2f2;
      border-left: 4px solid #ef4444;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 15px;
    }

    .issue-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }

    .issue-title {
      font-size: 15px;
      font-weight: 600;
      color: #111827;
    }

    .severity-badge {
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      color: white;
      text-transform: uppercase;
    }

    .issue-description {
      font-size: 13px;
      color: #4b5563;
      margin-bottom: 10px;
    }

    .issue-location, .issue-action {
      font-size: 12px;
      color: #6b7280;
      margin-top: 5px;
    }

    .photos-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
      margin-top: 20px;
    }

    .photo-card {
      background: #f9fafb;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid #e5e7eb;
    }

    .photo-card img {
      width: 100%;
      height: 250px;
      object-fit: cover;
    }

    .photo-caption {
      padding: 10px;
      font-size: 12px;
      color: #111827;
      font-weight: 500;
    }

    .photo-location {
      padding: 0 10px 10px;
      font-size: 11px;
      color: #6b7280;
    }

    .checklist-item-content {
      width: 100%;
    }

    .checklist-item-header {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .item-severity {
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      color: white;
    }

    .item-severity.severity-critical {
      background-color: #DC2626;
    }

    .item-severity.severity-high {
      background-color: #EF4444;
    }

    .item-severity.severity-medium {
      background-color: #F59E0B;
    }

    .item-severity.severity-low {
      background-color: #10B981;
    }

    .issue-photos {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 10px;
      padding-left: 30px;
    }

    .issue-photo {
      width: 120px;
      height: 90px;
      object-fit: cover;
      border-radius: 6px;
      border: 1px solid #e5e7eb;
    }

    .room-photos {
      margin-top: 20px;
      padding-top: 15px;
      border-top: 1px dashed #e5e7eb;
    }

    .room-photos h4 {
      font-size: 13px;
      font-weight: 600;
      color: #374151;
      margin-bottom: 10px;
    }

    .room-photos-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }

    .room-photo-card {
      background: white;
      border-radius: 6px;
      overflow: hidden;
      border: 1px solid #e5e7eb;
    }

    .room-photo-card img {
      width: 100%;
      height: 120px;
      object-fit: cover;
    }

    .signature-section {
      margin-top: 50px;
      padding-top: 30px;
      border-top: 2px solid #e5e7eb;
    }

    .signature-box {
      display: inline-block;
      margin-top: 15px;
    }

    .signature-box img {
      max-width: 300px;
      height: auto;
      border: 1px solid #d1d5db;
      border-radius: 4px;
      padding: 10px;
      background: white;
    }

    .signature-label {
      font-size: 12px;
      color: #6b7280;
      margin-top: 10px;
    }

    .no-data {
      color: #9ca3af;
      font-style: italic;
      font-size: 13px;
    }

    .footer {
      margin-top: 60px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #9ca3af;
      font-size: 11px;
    }

    @media print {
      body {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }

      .page-break {
        page-break-before: always;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div class="logo">BuildState FM</div>
      <h1 class="report-title">Inspection Report</h1>
      <p class="report-subtitle">${inspection.title}</p>
    </div>

    <!-- Inspection Information -->
    <div class="info-grid">
      <div class="info-card">
        <div class="info-label">Property</div>
        <div class="info-value">${property?.name || 'N/A'}</div>
        ${property?.address ? `<div style="font-size: 11px; color: #6b7280; margin-top: 5px;">${property.address}</div>` : ''}
      </div>

      <div class="info-card">
        <div class="info-label">Unit</div>
        <div class="info-value">${unit ? `${unit.unitNumber || unit.name || 'N/A'}` : 'N/A'}</div>
      </div>

      <div class="info-card">
        <div class="info-label">Inspection Type</div>
        <div class="info-value">${inspection.type.replace(/_/g, ' ')}</div>
      </div>

      <div class="info-card">
        <div class="info-label">Status</div>
        <div class="info-value">
          <span class="status-badge" style="background-color: ${getStatusColor(inspection.status)}">
            ${inspection.status}
          </span>
        </div>
      </div>

      <div class="info-card">
        <div class="info-label">Scheduled Date</div>
        <div class="info-value">${formatDate(inspection.scheduledDate)}</div>
      </div>

      <div class="info-card">
        <div class="info-label">Completed Date</div>
        <div class="info-value">${formatDateTime(inspection.completedDate)}</div>
      </div>

      <div class="info-card">
        <div class="info-label">Assigned To</div>
        <div class="info-value">${assignedTo ? `${assignedTo.firstName} ${assignedTo.lastName}` : 'Unassigned'}</div>
      </div>

      <div class="info-card">
        <div class="info-label">Completed By</div>
        <div class="info-value">${completedBy ? `${completedBy.firstName} ${completedBy.lastName}` : 'N/A'}</div>
      </div>
    </div>

    <!-- Notes -->
    ${
      inspection.notes
        ? `
    <div class="section">
      <h2 class="section-title">Notes</h2>
      <div class="info-card">
        <p style="white-space: pre-wrap;">${inspection.notes}</p>
      </div>
    </div>
    `
        : ''
    }

    <!-- Findings -->
    ${
      inspection.findings
        ? `
    <div class="section">
      <h2 class="section-title">Findings</h2>
      <div class="info-card">
        <p style="white-space: pre-wrap;">${inspection.findings}</p>
      </div>
    </div>
    `
        : ''
    }

    <!-- Room-by-Room Inspection -->
    <div class="section">
      <h2 class="section-title">Room-by-Room Inspection</h2>
      ${roomsHTML}
    </div>

    <!-- Issues -->
    <div class="section">
      <h2 class="section-title">Issues Identified</h2>
      ${issuesHTML}
    </div>

    <!-- Photos -->
    ${
      inspection.inspectionPhotos?.length
        ? `
    <div class="section page-break">
      <h2 class="section-title">Inspection Photos</h2>
      ${photosHTML}
    </div>
    `
        : ''
    }

    <!-- Tenant Signature -->
    ${
      inspection.tenantSignature && (inspection.type === 'MOVE_IN' || inspection.type === 'MOVE_OUT')
        ? `
    <div class="signature-section">
      <h2 class="section-title">Tenant Signature</h2>
      <div class="signature-box">
        <img src="${inspection.tenantSignature}" alt="Tenant Signature" />
        <div class="signature-label">Signed on ${formatDateTime(inspection.completedDate)}</div>
      </div>
    </div>
    `
        : ''
    }

    <!-- Footer -->
    <div class="footer">
      <p>Generated on ${formatDateTime(new Date())} | BuildState FM - Property Management System</p>
      <p>Report ID: ${inspection.id}</p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Generate PDF from inspection data
 */
export async function generateInspectionPDF(inspectionData) {
  let browser = null;

  try {
    // Generate HTML from inspection data
    const html = generateInspectionReportHTML(
      inspectionData.inspection,
      inspectionData.property,
      inspectionData.unit,
      inspectionData.assignedTo,
      inspectionData.completedBy
    );

    // Launch Puppeteer
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
      // Try to use system Chrome if available
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px',
      },
    });

    await browser.close();

    return pdfBuffer;
  } catch (error) {
    if (browser) {
      await browser.close();
    }
    throw error;
  }
}

/**
 * Generate and upload inspection PDF to S3
 */
export async function generateAndUploadInspectionPDF(inspectionData) {
  try {
    // Generate PDF
    const pdfBuffer = await generateInspectionPDF(inspectionData);

    // Generate filename
    const filename = `inspection-report-${inspectionData.inspection.id}-${Date.now()}.pdf`;

    // Upload to S3 or save locally
    if (isUsingS3()) {
      const s3Key = await uploadToS3('inspections/reports', pdfBuffer, filename, 'application/pdf');
      const url = getS3Url(s3Key);
      return { url, key: s3Key };
    } else {
      // Save locally
      const uploadsDir = path.join(process.cwd(), 'uploads', 'inspections', 'reports');
      await fs.mkdir(uploadsDir, { recursive: true });
      const filePath = path.join(uploadsDir, filename);
      await fs.writeFile(filePath, pdfBuffer);
      return { url: `/uploads/inspections/reports/${filename}`, path: filePath };
    }
  } catch (error) {
    console.error('Error generating inspection PDF:', error);
    throw new Error('Failed to generate inspection PDF: ' + error.message);
  }
}

export default {
  generateInspectionPDF,
  generateAndUploadInspectionPDF,
  generateInspectionReportHTML,
};
