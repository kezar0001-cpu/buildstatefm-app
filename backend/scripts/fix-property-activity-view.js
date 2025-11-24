import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixPropertyActivityView() {
  console.log('Fixing PropertyActivity view to include propertyId column...');

  try {
    // Drop the existing view if it exists
    await prisma.$executeRawUnsafe(`DROP VIEW IF EXISTS "PropertyActivity";`);
    console.log('Dropped existing PropertyActivity view');

    // Recreate the view with propertyId column
    await prisma.$executeRawUnsafe(`
CREATE OR REPLACE VIEW "PropertyActivity" AS
SELECT
  'job'::text AS type,
  j."id"::text AS id,
  j."propertyId" AS "propertyId",
  j."title" AS title,
  j."status"::text AS status,
  j."priority"::text AS priority,
  j."updatedAt" AS date,
  assign."firstName" AS assigned_first_name,
  assign."lastName" AS assigned_last_name,
  NULL::text AS requested_first_name,
  NULL::text AS requested_last_name,
  NULL::text AS unit_number
FROM "Job" j
LEFT JOIN "User" assign ON assign."id" = j."assignedToId"

UNION ALL

SELECT
  'inspection'::text AS type,
  i."id"::text AS id,
  i."propertyId" AS "propertyId",
  i."title" AS title,
  i."status"::text AS status,
  NULL::text AS priority,
  i."updatedAt" AS date,
  NULL::text AS assigned_first_name,
  NULL::text AS assigned_last_name,
  NULL::text AS requested_first_name,
  NULL::text AS requested_last_name,
  NULL::text AS unit_number
FROM "Inspection" i

UNION ALL

SELECT
  'service_request'::text AS type,
  sr."id"::text AS id,
  sr."propertyId" AS "propertyId",
  sr."title" AS title,
  sr."status"::text AS status,
  sr."priority"::text AS priority,
  sr."updatedAt" AS date,
  NULL::text AS assigned_first_name,
  NULL::text AS assigned_last_name,
  requester."firstName" AS requested_first_name,
  requester."lastName" AS requested_last_name,
  NULL::text AS unit_number
FROM "ServiceRequest" sr
LEFT JOIN "User" requester ON requester."id" = sr."requestedById"

UNION ALL

SELECT
  'unit'::text AS type,
  u."id"::text AS id,
  u."propertyId" AS "propertyId",
  u."unitNumber" AS title,
  u."status"::text AS status,
  NULL::text AS priority,
  u."updatedAt" AS date,
  NULL::text AS assigned_first_name,
  NULL::text AS assigned_last_name,
  NULL::text AS requested_first_name,
  NULL::text AS requested_last_name,
  u."unitNumber" AS unit_number
FROM "Unit" u;
    `);

    console.log('✅ PropertyActivity view recreated successfully with propertyId column');

    // Verify the view was created correctly
    const result = await prisma.$queryRawUnsafe(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'PropertyActivity'
      ORDER BY ordinal_position;
    `);

    console.log('View columns:', result.map(r => r.column_name).join(', '));

    const hasPropertyId = result.some(r => r.column_name === 'propertyId');
    if (hasPropertyId) {
      console.log('✅ Verified: propertyId column exists in PropertyActivity view');
    } else {
      console.error('❌ Error: propertyId column not found in PropertyActivity view');
      process.exit(1);
    }

  } catch (error) {
    console.error('Error fixing PropertyActivity view:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixPropertyActivityView()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to fix PropertyActivity view:', error);
    process.exit(1);
  });
