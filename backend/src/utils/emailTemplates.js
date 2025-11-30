/**
 * Email templates for various notification types
 */

export const emailTemplates = {
  jobAssigned: (data) => ({
    subject: `New Job Assigned: ${data.jobTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; }
          .content { background-color: #f9fafb; padding: 20px; }
          .button { display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>New Job Assigned</h1>
          </div>
          <div class="content">
            <p>Hello ${data.technicianName},</p>
            <p>You have been assigned a new job:</p>
            <h2>${data.jobTitle}</h2>
            <p><strong>Property:</strong> ${data.propertyName}</p>
            <p><strong>Priority:</strong> ${data.priority}</p>
            <p><strong>Scheduled Date:</strong> ${data.scheduledDate || 'Not scheduled'}</p>
            <p><strong>Description:</strong></p>
            <p>${data.description}</p>
            <a href="${data.jobUrl}" class="button">View Job Details</a>
          </div>
          <div class="footer">
            <p>AgentFM - Facilities Management Platform</p>
            <p>This is an automated message, please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  inspectionReminder: (data) => ({
    subject: `Inspection Reminder: ${data.inspectionTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #f59e0b; color: white; padding: 20px; text-align: center; }
          .content { background-color: #f9fafb; padding: 20px; }
          .button { display: inline-block; padding: 12px 24px; background-color: #f59e0b; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Inspection Reminder</h1>
          </div>
          <div class="content">
            <p>Hello ${data.technicianName},</p>
            <p>This is a reminder for your upcoming inspection:</p>
            <h2>${data.inspectionTitle}</h2>
            <p><strong>Property:</strong> ${data.propertyName}</p>
            <p><strong>Type:</strong> ${data.inspectionType}</p>
            <p><strong>Scheduled Date:</strong> ${data.scheduledDate}</p>
            <p><strong>Time Until Inspection:</strong> ${data.timeUntil}</p>
            <a href="${data.inspectionUrl}" class="button">View Inspection Details</a>
          </div>
          <div class="footer">
            <p>AgentFM - Facilities Management Platform</p>
            <p>This is an automated message, please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  serviceRequestUpdate: (data) => ({
    subject: `Service Request Update: ${data.requestTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #10b981; color: white; padding: 20px; text-align: center; }
          .content { background-color: #f9fafb; padding: 20px; }
          .status { display: inline-block; padding: 6px 12px; background-color: #10b981; color: white; border-radius: 4px; font-weight: bold; }
          .button { display: inline-block; padding: 12px 24px; background-color: #10b981; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Service Request Update</h1>
          </div>
          <div class="content">
            <p>Hello ${data.tenantName},</p>
            <p>Your service request has been updated:</p>
            <h2>${data.requestTitle}</h2>
            <p><strong>Status:</strong> <span class="status">${data.status}</span></p>
            <p><strong>Category:</strong> ${data.category}</p>
            ${data.reviewNotes ? `<p><strong>Notes:</strong> ${data.reviewNotes}</p>` : ''}
            ${data.jobCreated ? '<p>A maintenance job has been created to address your request.</p>' : ''}
            <a href="${data.requestUrl}" class="button">View Request Details</a>
          </div>
          <div class="footer">
            <p>AgentFM - Facilities Management Platform</p>
            <p>This is an automated message, please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  trialExpiring: (data) => ({
    subject: 'Your AgentFM Trial is Expiring Soon',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #ef4444; color: white; padding: 20px; text-align: center; }
          .content { background-color: #f9fafb; padding: 20px; }
          .button { display: inline-block; padding: 12px 24px; background-color: #ef4444; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Trial Expiring Soon</h1>
          </div>
          <div class="content">
            <p>Hello ${data.userName},</p>
            <p>Your AgentFM trial period is expiring in <strong>${data.daysRemaining} days</strong>.</p>
            <p>To continue using AgentFM without interruption, please upgrade to a paid plan.</p>
            <h3>Why Upgrade?</h3>
            <ul>
              <li>Unlimited properties and units</li>
              <li>Advanced analytics and reporting</li>
              <li>Priority support</li>
              <li>Custom integrations</li>
            </ul>
            <a href="${data.upgradeUrl}" class="button">Upgrade Now</a>
          </div>
          <div class="footer">
            <p>AgentFM - Facilities Management Platform</p>
            <p>This is an automated message, please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  welcomeEmail: (data) => ({
    subject: 'Welcome to AgentFM!',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; }
          .content { background-color: #f9fafb; padding: 20px; }
          .button { display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to AgentFM!</h1>
          </div>
          <div class="content">
            <p>Hello ${data.userName},</p>
            <p>Thank you for signing up for AgentFM! We're excited to help you manage your facilities more efficiently.</p>
            <h3>Getting Started:</h3>
            <ol>
              <li>Complete your profile</li>
              <li>Add your first property</li>
              <li>Invite team members</li>
              <li>Schedule your first inspection</li>
            </ol>
            <p>Your trial period includes full access to all features for 14 days.</p>
            <a href="${data.dashboardUrl}" class="button">Go to Dashboard</a>
          </div>
          <div class="footer">
            <p>AgentFM - Facilities Management Platform</p>
            <p>Need help? Contact us at support@agentfm.com</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  jobCompleted: (data) => ({
    subject: `Job Completed: ${data.jobTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #10b981; color: white; padding: 20px; text-align: center; }
          .content { background-color: #f9fafb; padding: 20px; }
          .button { display: inline-block; padding: 12px 24px; background-color: #10b981; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Job Completed</h1>
          </div>
          <div class="content">
            <p>Hello ${data.managerName},</p>
            <p>A job has been marked as completed:</p>
            <h2>${data.jobTitle}</h2>
            <p><strong>Property:</strong> ${data.propertyName}</p>
            <p><strong>Completed By:</strong> ${data.technicianName}</p>
            <p><strong>Completed Date:</strong> ${data.completedDate}</p>
            ${data.actualCost ? `<p><strong>Actual Cost:</strong> $${data.actualCost}</p>` : ''}
            ${data.notes ? `<p><strong>Notes:</strong> ${data.notes}</p>` : ''}
            <a href="${data.jobUrl}" class="button">View Job Details</a>
          </div>
          <div class="footer">
            <p>AgentFM - Facilities Management Platform</p>
            <p>This is an automated message, please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  inspectionCompleted: (data) => ({
    subject: `Inspection Completed: ${data.inspectionTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #7c3aed; color: white; padding: 20px; text-align: center; }
          .content { background-color: #f9fafb; padding: 20px; }
          .findings-box { background-color: white; padding: 15px; border-left: 4px solid #7c3aed; margin: 15px 0; }
          .job-item { background-color: white; padding: 12px; margin: 8px 0; border-radius: 4px; border-left: 4px solid #dc2626; }
          .priority-high { color: #dc2626; font-weight: bold; }
          .priority-urgent { color: #991b1b; font-weight: bold; }
          .button { display: inline-block; padding: 12px 24px; background-color: #7c3aed; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Inspection Completed</h1>
          </div>
          <div class="content">
            <p>Hello ${data.managerName},</p>
            <p>An inspection has been completed and requires your attention:</p>
            <h2>${data.inspectionTitle}</h2>
            <p><strong>Property:</strong> ${data.propertyName}</p>
            <p><strong>Type:</strong> ${data.inspectionType}</p>
            <p><strong>Completed By:</strong> ${data.technicianName}</p>
            <p><strong>Completed Date:</strong> ${data.completedDate}</p>

            ${data.findings ? `
              <div class="findings-box">
                <h3 style="margin-top: 0;">Findings Summary</h3>
                <p>${data.findings}</p>
              </div>
            ` : ''}

            ${data.notes ? `
              <p><strong>Additional Notes:</strong></p>
              <p>${data.notes}</p>
            ` : ''}

            ${data.followUpJobs && data.followUpJobs.length > 0 ? `
              <h3>Follow-Up Jobs Created</h3>
              <p>${data.followUpJobs.length} high-priority job(s) have been automatically created:</p>
              ${data.followUpJobs.map(job => `
                <div class="job-item">
                  <strong>${job.title}</strong>
                  <br/>
                  <span class="priority-${job.priority.toLowerCase()}">${job.priority}</span>
                  ${job.description ? `<br/>${job.description}` : ''}
                </div>
              `).join('')}
            ` : ''}

            <a href="${data.inspectionUrl}" class="button">View Inspection Report</a>
          </div>
          <div class="footer">
            <p>AgentFM - Facilities Management Platform</p>
            <p>This is an automated message, please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  inspectionOverdue: (data) => ({
    subject: `Overdue Inspection: ${data.inspectionTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #dc2626; color: white; padding: 20px; text-align: center; }
          .content { background-color: #f9fafb; padding: 20px; }
          .alert-box { background-color: #fee2e2; border-left: 4px solid #dc2626; padding: 15px; margin: 15px 0; }
          .button { display: inline-block; padding: 12px 24px; background-color: #dc2626; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚠️ Inspection Overdue</h1>
          </div>
          <div class="content">
            <p>Hello ${data.technicianName},</p>
            <div class="alert-box">
              <p><strong>This inspection is now overdue and requires immediate attention.</strong></p>
            </div>
            <h2>${data.inspectionTitle}</h2>
            <p><strong>Property:</strong> ${data.propertyName}</p>
            ${data.unitNumber ? `<p><strong>Unit:</strong> ${data.unitNumber}</p>` : ''}
            <p><strong>Type:</strong> ${data.inspectionType}</p>
            <p><strong>Scheduled Date:</strong> ${data.scheduledDate}</p>
            <p><strong>Days Overdue:</strong> <span style="color: #dc2626; font-weight: bold;">${data.daysOverdue}</span></p>
            <p>Please complete this inspection as soon as possible or contact your manager to reschedule.</p>
            <a href="${data.inspectionUrl}" class="button">Complete Inspection Now</a>
          </div>
          <div class="footer">
            <p>AgentFM - Facilities Management Platform</p>
            <p>This is an automated message, please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  overdueInspectionDigest: (data) => ({
    subject: `Daily Digest: ${data.inspectionCount} Overdue Inspection${data.inspectionCount > 1 ? 's' : ''}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 700px; margin: 0 auto; padding: 20px; }
          .header { background-color: #dc2626; color: white; padding: 20px; text-align: center; }
          .content { background-color: #f9fafb; padding: 20px; }
          .inspection-item { background-color: white; padding: 15px; margin: 12px 0; border-radius: 6px; border-left: 4px solid #dc2626; }
          .overdue-badge { background-color: #dc2626; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
          .stats-box { background-color: #fee2e2; padding: 15px; border-radius: 6px; margin: 20px 0; }
          .button { display: inline-block; padding: 12px 24px; background-color: #dc2626; color: white; text-decoration: none; border-radius: 4px; margin: 10px 5px; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📋 Overdue Inspections Digest</h1>
          </div>
          <div class="content">
            <p>Hello ${data.managerName},</p>
            <div class="stats-box">
              <p style="margin: 0; font-size: 18px;"><strong>${data.inspectionCount}</strong> inspection${data.inspectionCount > 1 ? 's are' : ' is'} currently overdue and require${data.inspectionCount === 1 ? 's' : ''} immediate attention.</p>
            </div>

            <h3>Overdue Inspections:</h3>
            ${data.inspections.map(inspection => `
              <div class="inspection-item">
                <h4 style="margin-top: 0;">${inspection.title}</h4>
                <p style="margin: 5px 0;"><strong>Property:</strong> ${inspection.property.name}</p>
                ${inspection.unit ? `<p style="margin: 5px 0;"><strong>Unit:</strong> ${inspection.unit.unitNumber}</p>` : ''}
                <p style="margin: 5px 0;"><strong>Type:</strong> ${inspection.type}</p>
                <p style="margin: 5px 0;"><strong>Scheduled:</strong> ${new Date(inspection.scheduledDate).toLocaleDateString()}</p>
                <p style="margin: 5px 0;">
                  <span class="overdue-badge">${Math.round((new Date() - new Date(inspection.scheduledDate)) / (1000 * 60 * 60 * 24))} days overdue</span>
                </p>
                ${inspection.assignedTo ? `<p style="margin: 5px 0;"><strong>Assigned to:</strong> ${inspection.assignedTo.firstName} ${inspection.assignedTo.lastName}</p>` : '<p style="margin: 5px 0; color: #dc2626;"><strong>Not assigned to anyone</strong></p>'}
                <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/inspections/${inspection.id}" class="button" style="font-size: 14px; padding: 8px 16px;">View Details</a>
              </div>
            `).join('')}

            <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #e5e7eb;">
              <h3>Recommended Actions:</h3>
              <ul>
                <li>Review each overdue inspection and take appropriate action</li>
                <li>Reassign inspections if technicians are unavailable</li>
                <li>Reschedule inspections if necessary</li>
                <li>Contact technicians to understand delays</li>
              </ul>
              <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/inspections?status=overdue" class="button">View All Overdue Inspections</a>
            </div>
          </div>
          <div class="footer">
            <p>AgentFM - Facilities Management Platform</p>
            <p>This is an automated daily digest. You will continue to receive this email until all inspections are completed or rescheduled.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),
};

export default emailTemplates;
