import { prisma } from '../config/prismaClient.js';

/**
 * Generate report data based on report type
 * @param {Object} reportRequest - The report request object
 * @param {Object} property - The property object
 * @returns {Promise<Object>} Report data with URL
 */
export async function generateReport(reportRequest, property) {
  const { reportType, parameters, propertyId, unitId } = reportRequest;
  const { fromDate, toDate } = parameters;

  // Build report data structure (bank statement style)
  const reportData = {
    property: {
      name: property.name,
      address: property.address,
      city: property.city,
      state: property.state,
      zipCode: property.zipCode,
    },
    reportType,
    dateRange: {
      from: fromDate,
      to: toDate,
    },
    generatedAt: new Date().toISOString(),
    sections: [],
  };

  if (reportType === 'MAINTENANCE_HISTORY') {
    // Fetch service requests
    const serviceRequests = await prisma.serviceRequest.findMany({
      where: {
        propertyId,
        ...(unitId && { unitId }),
        createdAt: {
          gte: new Date(fromDate),
          lte: new Date(toDate),
        },
      },
      include: {
        unit: { select: { unitNumber: true } },
        requestedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Fetch jobs
    const jobs = await prisma.job.findMany({
      where: {
        propertyId,
        ...(unitId && { unitId }),
        createdAt: {
          gte: new Date(fromDate),
          lte: new Date(toDate),
        },
      },
      include: {
        unit: { select: { unitNumber: true } },
        assignedTo: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    reportData.sections.push({
      title: 'Service Requests',
      count: serviceRequests.length,
      items: serviceRequests.map(sr => ({
        date: sr.createdAt,
        unit: sr.unit?.unitNumber || 'Property-wide',
        title: sr.title,
        category: sr.category,
        status: sr.status,
        priority: sr.priority,
        requestedBy: `${sr.requestedBy.firstName} ${sr.requestedBy.lastName}`,
      })),
    });

    reportData.sections.push({
      title: 'Maintenance Jobs',
      count: jobs.length,
      items: jobs.map(job => ({
        date: job.createdAt,
        unit: job.unit?.unitNumber || 'Property-wide',
        title: job.title,
        status: job.status,
        priority: job.priority,
        assignedTo: job.assignedTo ? `${job.assignedTo.firstName} ${job.assignedTo.lastName}` : 'Unassigned',
        estimatedCost: job.estimatedCost,
        actualCost: job.actualCost,
        completedDate: job.completedDate,
      })),
    });

    // Calculate summary
    const totalCosts = jobs.reduce((sum, job) => sum + (job.actualCost || job.estimatedCost || 0), 0);
    reportData.summary = {
      totalServiceRequests: serviceRequests.length,
      totalJobs: jobs.length,
      totalCosts,
      completedJobs: jobs.filter(j => j.status === 'COMPLETED').length,
    };

  } else if (reportType === 'UNIT_LEDGER') {
    // Fetch unit information if unitId provided
    if (unitId) {
      const unit = await prisma.unit.findUnique({
        where: { id: unitId },
        include: {
          tenants: {
            where: { isActive: true },
            include: {
              tenant: { select: { firstName: true, lastName: true, email: true } },
            },
          },
        },
      });

      if (unit) {
        reportData.unit = {
          unitNumber: unit.unitNumber,
          bedrooms: unit.bedrooms,
          bathrooms: unit.bathrooms,
          area: unit.area,
          rentAmount: unit.rentAmount,
          status: unit.status,
        };

        reportData.sections.push({
          title: 'Current Tenant Information',
          count: unit.tenants.length,
          items: unit.tenants.map(ut => ({
            name: `${ut.tenant.firstName} ${ut.tenant.lastName}`,
            email: ut.tenant.email,
            leaseStart: ut.leaseStart,
            leaseEnd: ut.leaseEnd,
            rentAmount: ut.rentAmount,
            depositAmount: ut.depositAmount,
          })),
        });
      }
    }

    // Fetch service requests with costs
    const serviceRequests = await prisma.serviceRequest.findMany({
      where: {
        propertyId,
        ...(unitId && { unitId }),
        createdAt: {
          gte: new Date(fromDate),
          lte: new Date(toDate),
        },
      },
      include: {
        jobs: {
          select: {
            actualCost: true,
            estimatedCost: true,
            status: true,
            title: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalCosts = serviceRequests.reduce((sum, sr) => {
      const jobCosts = sr.jobs.reduce((jSum, job) => jSum + (job.actualCost || job.estimatedCost || 0), 0);
      return sum + jobCosts;
    }, 0);

    reportData.sections.push({
      title: 'Maintenance Costs',
      count: serviceRequests.length,
      summary: {
        totalCosts,
        requestCount: serviceRequests.length,
        averageCost: serviceRequests.length > 0 ? totalCosts / serviceRequests.length : 0,
      },
      items: serviceRequests.map(sr => ({
        date: sr.createdAt,
        title: sr.title,
        category: sr.category,
        status: sr.status,
        costs: sr.jobs.reduce((sum, job) => sum + (job.actualCost || job.estimatedCost || 0), 0),
        jobCount: sr.jobs.length,
      })),
    });

    reportData.summary = {
      totalMaintenanceCosts: totalCosts,
      totalRequests: serviceRequests.length,
      averageCostPerRequest: serviceRequests.length > 0 ? totalCosts / serviceRequests.length : 0,
    };

  } else if (reportType === 'MAINTENANCE_SUMMARY') {
    // Aggregated maintenance summary with key metrics
    const jobs = await prisma.job.findMany({
      where: {
        propertyId,
        ...(unitId && { unitId }),
        createdAt: { gte: new Date(fromDate), lte: new Date(toDate) },
      },
      include: {
        unit: { select: { unitNumber: true } },
        assignedTo: { select: { firstName: true, lastName: true } },
      },
    });

    const serviceRequests = await prisma.serviceRequest.findMany({
      where: {
        propertyId,
        ...(unitId && { unitId }),
        createdAt: { gte: new Date(fromDate), lte: new Date(toDate) },
      },
    });

    const statusBreakdown = jobs.reduce((acc, job) => {
      acc[job.status] = (acc[job.status] || 0) + 1;
      return acc;
    }, {});

    const priorityBreakdown = jobs.reduce((acc, job) => {
      acc[job.priority] = (acc[job.priority] || 0) + 1;
      return acc;
    }, {});

    const totalCosts = jobs.reduce((sum, job) => sum + (job.actualCost || job.estimatedCost || 0), 0);
    const completedJobs = jobs.filter(j => j.status === 'COMPLETED');
    const avgCompletionTime = completedJobs.length > 0
      ? completedJobs.reduce((sum, job) => {
          if (job.completedDate && job.createdAt) {
            const days = (new Date(job.completedDate) - new Date(job.createdAt)) / (1000 * 60 * 60 * 24);
            return sum + days;
          }
          return sum;
        }, 0) / completedJobs.length
      : 0;

    reportData.sections.push({
      title: 'Overview',
      summary: {
        totalJobs: jobs.length,
        totalServiceRequests: serviceRequests.length,
        completedJobs: completedJobs.length,
        completionRate: jobs.length > 0 ? (completedJobs.length / jobs.length * 100).toFixed(1) + '%' : '0%',
        totalCosts,
        averageCompletionTime: avgCompletionTime.toFixed(1) + ' days',
      },
    });

    reportData.sections.push({
      title: 'Status Breakdown',
      items: Object.entries(statusBreakdown).map(([status, count]) => ({
        status,
        count,
        percentage: ((count / jobs.length) * 100).toFixed(1) + '%',
      })),
    });

    reportData.sections.push({
      title: 'Priority Breakdown',
      items: Object.entries(priorityBreakdown).map(([priority, count]) => ({
        priority,
        count,
        percentage: ((count / jobs.length) * 100).toFixed(1) + '%',
      })),
    });

    reportData.summary = {
      totalJobs: jobs.length,
      totalCosts,
      completedJobs: completedJobs.length,
      completionRate: jobs.length > 0 ? (completedJobs.length / jobs.length * 100).toFixed(1) + '%' : '0%',
    };

  } else if (reportType === 'FINANCIAL_SUMMARY') {
    // Financial summary with costs, budgets, and trends
    const jobs = await prisma.job.findMany({
      where: {
        propertyId,
        ...(unitId && { unitId }),
        createdAt: { gte: new Date(fromDate), lte: new Date(toDate) },
      },
      include: {
        unit: { select: { unitNumber: true } },
      },
    });

    const totalEstimated = jobs.reduce((sum, job) => sum + (job.estimatedCost || 0), 0);
    const totalActual = jobs.reduce((sum, job) => sum + (job.actualCost || 0), 0);
    const variance = totalActual - totalEstimated;
    const completedJobs = jobs.filter(j => j.status === 'COMPLETED');
    const completedCosts = completedJobs.reduce((sum, job) => sum + (job.actualCost || job.estimatedCost || 0), 0);

    // Group by month
    const monthlyBreakdown = jobs.reduce((acc, job) => {
      const month = new Date(job.createdAt).toISOString().substring(0, 7);
      if (!acc[month]) acc[month] = { estimated: 0, actual: 0, count: 0 };
      acc[month].estimated += job.estimatedCost || 0;
      acc[month].actual += job.actualCost || 0;
      acc[month].count += 1;
      return acc;
    }, {});

    reportData.sections.push({
      title: 'Financial Overview',
      summary: {
        totalEstimated,
        totalActual,
        variance,
        variancePercentage: totalEstimated > 0 ? ((variance / totalEstimated) * 100).toFixed(1) + '%' : '0%',
        completedCosts,
        averageJobCost: jobs.length > 0 ? (totalActual / jobs.length).toFixed(2) : 0,
      },
    });

    reportData.sections.push({
      title: 'Monthly Breakdown',
      items: Object.entries(monthlyBreakdown).map(([month, data]) => ({
        month,
        estimated: data.estimated,
        actual: data.actual,
        variance: data.actual - data.estimated,
        jobCount: data.count,
      })),
    });

    reportData.summary = {
      totalEstimated,
      totalActual,
      variance,
      completedCosts,
    };

  } else if (reportType === 'INSPECTION_TRENDS') {
    // Inspection trends and patterns
    const inspections = await prisma.inspection.findMany({
      where: {
        propertyId,
        ...(unitId && { unitId }),
        scheduledDate: { gte: new Date(fromDate), lte: new Date(toDate) },
      },
      include: {
        unit: { select: { unitNumber: true } },
        assignedTo: { select: { firstName: true, lastName: true } },
      },
      orderBy: { scheduledDate: 'asc' },
    });

    const statusBreakdown = inspections.reduce((acc, insp) => {
      acc[insp.status] = (acc[insp.status] || 0) + 1;
      return acc;
    }, {});

    const typeBreakdown = inspections.reduce((acc, insp) => {
      acc[insp.type] = (acc[insp.type] || 0) + 1;
      return acc;
    }, {});

    // Monthly trend
    const monthlyTrend = inspections.reduce((acc, insp) => {
      const month = new Date(insp.scheduledDate).toISOString().substring(0, 7);
      acc[month] = (acc[month] || 0) + 1;
      return acc;
    }, {});

    const completedInspections = inspections.filter(i => i.status === 'COMPLETED');
    const avgCompletionRate = inspections.length > 0
      ? (completedInspections.length / inspections.length * 100).toFixed(1) + '%'
      : '0%';

    reportData.sections.push({
      title: 'Inspection Overview',
      summary: {
        totalInspections: inspections.length,
        completedInspections: completedInspections.length,
        completionRate: avgCompletionRate,
      },
    });

    reportData.sections.push({
      title: 'Status Breakdown',
      items: Object.entries(statusBreakdown).map(([status, count]) => ({
        status,
        count,
        percentage: ((count / inspections.length) * 100).toFixed(1) + '%',
      })),
    });

    reportData.sections.push({
      title: 'Type Breakdown',
      items: Object.entries(typeBreakdown).map(([type, count]) => ({
        type,
        count,
        percentage: ((count / inspections.length) * 100).toFixed(1) + '%',
      })),
    });

    reportData.sections.push({
      title: 'Monthly Trend',
      items: Object.entries(monthlyTrend).map(([month, count]) => ({
        month,
        count,
      })),
    });

    reportData.summary = {
      totalInspections: inspections.length,
      completedInspections: completedInspections.length,
      completionRate: avgCompletionRate,
    };

  } else if (reportType === 'JOB_COMPLETION_TIMELINE') {
    // Job completion timeline and performance metrics
    const jobs = await prisma.job.findMany({
      where: {
        propertyId,
        ...(unitId && { unitId }),
        createdAt: { gte: new Date(fromDate), lte: new Date(toDate) },
      },
      include: {
        unit: { select: { unitNumber: true } },
        assignedTo: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const timeline = jobs.map(job => ({
      date: job.createdAt,
      completedDate: job.completedDate,
      title: job.title,
      status: job.status,
      priority: job.priority,
      assignedTo: job.assignedTo ? `${job.assignedTo.firstName} ${job.assignedTo.lastName}` : 'Unassigned',
      duration: job.completedDate && job.createdAt
        ? Math.round((new Date(job.completedDate) - new Date(job.createdAt)) / (1000 * 60 * 60 * 24)) + ' days'
        : 'In progress',
    }));

    const completedJobs = jobs.filter(j => j.status === 'COMPLETED');
    const avgCompletionTime = completedJobs.length > 0
      ? completedJobs.reduce((sum, job) => {
          if (job.completedDate && job.createdAt) {
            return sum + (new Date(job.completedDate) - new Date(job.createdAt)) / (1000 * 60 * 60 * 24);
          }
          return sum;
        }, 0) / completedJobs.length
      : 0;

    reportData.sections.push({
      title: 'Completion Timeline',
      items: timeline,
    });

    reportData.summary = {
      totalJobs: jobs.length,
      completedJobs: completedJobs.length,
      averageCompletionTime: avgCompletionTime.toFixed(1) + ' days',
      onTimeCompletionRate: 'N/A', // Would need due dates to calculate
    };

  } else if (reportType === 'ASSET_CONDITION_HISTORY') {
    // Asset condition history from inspections and recommendations
    const inspections = await prisma.inspection.findMany({
      where: {
        propertyId,
        ...(unitId && { unitId }),
        scheduledDate: { gte: new Date(fromDate), lte: new Date(toDate) },
        status: 'COMPLETED',
      },
      include: {
        unit: { select: { unitNumber: true } },
        issues: {
          include: {
            room: { select: { name: true } },
          },
        },
      },
      orderBy: { scheduledDate: 'desc' },
    });

    const recommendations = await prisma.recommendation.findMany({
      where: {
        propertyId,
        ...(unitId && { unitId }),
        createdAt: { gte: new Date(fromDate), lte: new Date(toDate) },
      },
      include: {
        report: {
          include: {
            inspection: {
              include: {
                unit: { select: { unitNumber: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    reportData.sections.push({
      title: 'Inspection Findings',
      items: inspections.flatMap(insp =>
        insp.issues.map(issue => ({
          date: insp.scheduledDate,
          inspectionType: insp.type,
          unit: insp.unit?.unitNumber || 'Property-wide',
          room: issue.room?.name || 'General',
          issue: issue.title,
          severity: issue.severity,
          status: issue.status,
        }))
      ),
    });

    reportData.sections.push({
      title: 'Recommendations',
      items: recommendations.map(rec => ({
        date: rec.createdAt,
        title: rec.title,
        description: rec.description,
        priority: rec.priority,
        status: rec.status,
        estimatedCost: rec.estimatedCost,
      })),
    });

    reportData.summary = {
      totalInspections: inspections.length,
      totalIssues: inspections.reduce((sum, insp) => sum + (insp.issues?.length || 0), 0),
      totalRecommendations: recommendations.length,
      criticalIssues: inspections.reduce((sum, insp) =>
        sum + (insp.issues?.filter(i => i.severity === 'CRITICAL').length || 0), 0
      ),
    };

  } else if (reportType === 'PLANNED_VS_EXECUTED') {
    // Compare planned maintenance (from Plans) vs executed jobs
    const plans = await prisma.maintenancePlan.findMany({
      where: {
        propertyId,
        ...(unitId && { unitId }),
      },
      include: {
        unit: { select: { unitNumber: true } },
      },
    });

    const jobs = await prisma.job.findMany({
      where: {
        propertyId,
        ...(unitId && { unitId }),
        createdAt: { gte: new Date(fromDate), lte: new Date(toDate) },
      },
      include: {
        unit: { select: { unitNumber: true } },
        maintenancePlan: { select: { id: true, title: true } },
      },
    });

    const planJobs = jobs.filter(j => j.maintenancePlanId);
    const adHocJobs = jobs.filter(j => !j.maintenancePlanId);

    reportData.sections.push({
      title: 'Planned Maintenance',
      summary: {
        totalPlans: plans.length,
        plannedJobs: planJobs.length,
        adHocJobs: adHocJobs.length,
        executionRate: plans.length > 0 ? ((planJobs.length / plans.length) * 100).toFixed(1) + '%' : '0%',
      },
      items: plans.map(plan => ({
        title: plan.title,
        frequency: plan.frequency,
        nextDueDate: plan.nextDueDate,
        unit: plan.unit?.unitNumber || 'Property-wide',
        relatedJobs: jobs.filter(j => j.maintenancePlanId === plan.id).length,
      })),
    });

    reportData.sections.push({
      title: 'Execution Summary',
      items: planJobs.map(job => ({
        date: job.createdAt,
        title: job.title,
        plan: job.maintenancePlan?.title || 'N/A',
        status: job.status,
        unit: job.unit?.unitNumber || 'Property-wide',
      })),
    });

    reportData.summary = {
      totalPlans: plans.length,
      plannedJobs: planJobs.length,
      adHocJobs: adHocJobs.length,
      executionRate: plans.length > 0 ? ((planJobs.length / plans.length) * 100).toFixed(1) + '%' : '0%',
    };

  } else if (reportType === 'TENANT_ISSUE_HISTORY') {
    // Tenant issue history from service requests
    const serviceRequests = await prisma.serviceRequest.findMany({
      where: {
        propertyId,
        ...(unitId && { unitId }),
        createdAt: { gte: new Date(fromDate), lte: new Date(toDate) },
      },
      include: {
        unit: { select: { unitNumber: true } },
        requestedBy: { select: { firstName: true, lastName: true, email: true } },
        jobs: {
          select: {
            status: true,
            actualCost: true,
            estimatedCost: true,
            completedDate: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const categoryBreakdown = serviceRequests.reduce((acc, sr) => {
      acc[sr.category] = (acc[sr.category] || 0) + 1;
      return acc;
    }, {});

    const statusBreakdown = serviceRequests.reduce((acc, sr) => {
      acc[sr.status] = (acc[sr.status] || 0) + 1;
      return acc;
    }, {});

    reportData.sections.push({
      title: 'Service Requests',
      items: serviceRequests.map(sr => ({
        date: sr.createdAt,
        unit: sr.unit?.unitNumber || 'Property-wide',
        tenant: `${sr.requestedBy.firstName} ${sr.requestedBy.lastName}`,
        title: sr.title,
        category: sr.category,
        status: sr.status,
        priority: sr.priority,
        resolvedDate: sr.jobs.find(j => j.status === 'COMPLETED')?.completedDate || null,
        totalCost: sr.jobs.reduce((sum, job) => sum + (job.actualCost || job.estimatedCost || 0), 0),
      })),
    });

    reportData.sections.push({
      title: 'Category Breakdown',
      items: Object.entries(categoryBreakdown).map(([category, count]) => ({
        category,
        count,
        percentage: ((count / serviceRequests.length) * 100).toFixed(1) + '%',
      })),
    });

    reportData.sections.push({
      title: 'Status Breakdown',
      items: Object.entries(statusBreakdown).map(([status, count]) => ({
        status,
        count,
        percentage: ((count / serviceRequests.length) * 100).toFixed(1) + '%',
      })),
    });

    const resolvedRequests = serviceRequests.filter(sr => sr.status === 'RESOLVED' || sr.status === 'COMPLETED');
    const totalCosts = serviceRequests.reduce((sum, sr) =>
      sum + sr.jobs.reduce((jSum, job) => jSum + (job.actualCost || job.estimatedCost || 0), 0), 0
    );

    reportData.summary = {
      totalRequests: serviceRequests.length,
      resolvedRequests: resolvedRequests.length,
      resolutionRate: serviceRequests.length > 0
        ? ((resolvedRequests.length / serviceRequests.length) * 100).toFixed(1) + '%'
        : '0%',
      totalCosts,
      averageCostPerRequest: serviceRequests.length > 0 ? (totalCosts / serviceRequests.length).toFixed(2) : 0,
    };
  }

  // In production, this would generate a PDF and upload to S3/storage
  // For now, we return a data URL that can be fetched
  return {
    url: `/api/reports/${reportRequest.id}/data`,
    data: reportData,
  };
}
