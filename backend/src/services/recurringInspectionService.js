import { PrismaClient } from '@prisma/client';
import cron from 'node-cron';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

// Helper function to calculate next due date
function calculateNextDueDate(frequency, interval, currentDate, dayOfMonth, dayOfWeek) {
  const date = new Date(currentDate);

  switch (frequency) {
    case 'DAILY':
      date.setDate(date.getDate() + interval);
      break;
    case 'WEEKLY':
      date.setDate(date.getDate() + (interval * 7));
      if (dayOfWeek !== null && dayOfWeek !== undefined) {
        // Adjust to the specified day of week
        const currentDay = date.getDay();
        const daysToAdd = (dayOfWeek - currentDay + 7) % 7;
        date.setDate(date.getDate() + daysToAdd);
      }
      break;
    case 'MONTHLY':
      date.setMonth(date.getMonth() + interval);
      if (dayOfMonth) {
        date.setDate(Math.min(dayOfMonth, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
      }
      break;
    case 'QUARTERLY':
      date.setMonth(date.getMonth() + (interval * 3));
      break;
    case 'YEARLY':
      date.setFullYear(date.getFullYear() + interval);
      break;
  }

  return date;
}

// Function to generate inspections from recurring schedules
export async function generateRecurringInspections() {
  console.log('[Recurring Inspections] Starting generation process...');

  try {
    const now = new Date();
    const lookAheadDays = 7; // Generate inspections for the next 7 days
    const lookAheadDate = new Date(now);
    lookAheadDate.setDate(lookAheadDate.getDate() + lookAheadDays);

    // Find all active recurring inspections that are due
    const dueRecurringInspections = await prisma.recurringInspection.findMany({
      where: {
        isActive: true,
        nextDueDate: {
          lte: lookAheadDate
        },
        OR: [
          { endDate: null },
          { endDate: { gte: now } }
        ]
      },
      include: {
        template: {
          include: {
            rooms: {
              include: {
                checklistItems: {
                  orderBy: { order: 'asc' }
                }
              },
              orderBy: { order: 'asc' }
            }
          }
        }
      }
    });

    console.log(`[Recurring Inspections] Found ${dueRecurringInspections.length} recurring inspections due`);

    let generatedCount = 0;

    for (const recurring of dueRecurringInspections) {
      try {
        // Check if an inspection already exists for this scheduled date
        const existingInspection = await prisma.inspection.findFirst({
          where: {
            recurringInspectionId: recurring.id,
            scheduledDate: recurring.nextDueDate
          }
        });

        if (!existingInspection) {
          // Create the inspection
          const inspectionData = {
            title: recurring.title,
            type: recurring.type,
            propertyId: recurring.propertyId,
            unitId: recurring.unitId,
            assignedToId: recurring.assignedToId,
            scheduledDate: recurring.nextDueDate,
            status: 'SCHEDULED',
            templateId: recurring.templateId,
            recurringInspectionId: recurring.id
          };

          const inspection = await prisma.inspection.create({
            data: inspectionData
          });

          // If there's a template, copy rooms and checklist items
          if (recurring.template && recurring.template.rooms) {
            for (const templateRoom of recurring.template.rooms) {
              const room = await prisma.inspectionRoom.create({
                data: {
                  id: randomUUID(),
                  inspectionId: inspection.id,
                  name: templateRoom.name,
                  roomType: templateRoom.roomType,
                  order: templateRoom.order,
                  updatedAt: new Date(),
                }
              });

              // Copy checklist items
              if (templateRoom.checklistItems) {
                for (const templateItem of templateRoom.checklistItems) {
                  await prisma.inspectionChecklistItem.create({
                    data: {
                      roomId: room.id,
                      description: templateItem.description,
                      order: templateItem.order,
                      status: 'PENDING'
                    }
                  });
                }
              }
            }
          }

          console.log(`[Recurring Inspections] Created inspection ${inspection.id} from recurring ${recurring.id}`);
          generatedCount++;
        }

        // Calculate and update next due date
        const newNextDueDate = calculateNextDueDate(
          recurring.frequency,
          recurring.interval,
          recurring.nextDueDate,
          recurring.dayOfMonth,
          recurring.dayOfWeek
        );

        // Check if next due date exceeds end date
        if (recurring.endDate && newNextDueDate > recurring.endDate) {
          // Mark as inactive if end date is reached
          await prisma.recurringInspection.update({
            where: { id: recurring.id },
            data: {
              isActive: false,
              nextDueDate: newNextDueDate,
              lastGeneratedDate: now
            }
          });
          console.log(`[Recurring Inspections] Deactivated recurring inspection ${recurring.id} - end date reached`);
        } else {
          await prisma.recurringInspection.update({
            where: { id: recurring.id },
            data: {
              nextDueDate: newNextDueDate,
              lastGeneratedDate: now
            }
          });
        }
      } catch (error) {
        console.error(`[Recurring Inspections] Error processing recurring inspection ${recurring.id}:`, error);
      }
    }

    console.log(`[Recurring Inspections] Generation complete. Created ${generatedCount} inspections`);
    return { success: true, generatedCount };
  } catch (error) {
    console.error('[Recurring Inspections] Error in generation process:', error);
    return { success: false, error: error.message };
  }
}

// Schedule the cron job to run daily at 2 AM
export function startRecurringInspectionCron() {
  console.log('[Recurring Inspections] Starting cron job - runs daily at 2:00 AM');

  // Run at 2:00 AM every day
  cron.schedule('0 2 * * *', async () => {
    console.log('[Recurring Inspections] Cron job triggered');
    await generateRecurringInspections();
  });

  // Also run immediately on startup
  setTimeout(async () => {
    console.log('[Recurring Inspections] Running initial generation on startup');
    await generateRecurringInspections();
  }, 5000); // Wait 5 seconds after startup
}

// Manual trigger endpoint (can be called via API)
export async function triggerRecurringInspectionGeneration() {
  console.log('[Recurring Inspections] Manual trigger requested');
  return await generateRecurringInspections();
}

export default {
  startRecurringInspectionCron,
  triggerRecurringInspectionGeneration,
  generateRecurringInspections
};
