import prisma from '../src/config/prismaClient.js';

async function migratePendingApprovalInspections() {
  try {
    const result = await prisma.inspection.updateMany({
      where: { status: 'PENDING_APPROVAL' },
      data: { status: 'COMPLETED' },
    });

    console.log(`Updated ${result.count} inspections from PENDING_APPROVAL to COMPLETED.`);
  } catch (error) {
    console.error('Failed to migrate inspections:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migratePendingApprovalInspections();
