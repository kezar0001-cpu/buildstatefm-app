import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { prisma } from '../src/config/prismaClient.js';

describe('Service Request Detail API - GET /:id', () => {
  let manager, owner, tenant, otherTenant, property, unit, serviceRequest;

  before(async () => {
    // Create test users
    const { default: bcrypt } = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash('password123', 10);

    manager = await prisma.user.create({
      data: {
        email: `manager-sr-${Date.now()}@test.com`,
        passwordHash: hashedPassword,
        firstName: 'Test',
        lastName: 'Manager',
        role: 'PROPERTY_MANAGER',
      },
    });

    owner = await prisma.user.create({
      data: {
        email: `owner-sr-${Date.now()}@test.com`,
        passwordHash: hashedPassword,
        firstName: 'Test',
        lastName: 'Owner',
        role: 'OWNER',
      },
    });

    tenant = await prisma.user.create({
      data: {
        email: `tenant-sr-${Date.now()}@test.com`,
        passwordHash: hashedPassword,
        firstName: 'John',
        lastName: 'Doe',
        role: 'TENANT',
      },
    });

    otherTenant = await prisma.user.create({
      data: {
        email: `other-tenant-sr-${Date.now()}@test.com`,
        passwordHash: hashedPassword,
        firstName: 'Jane',
        lastName: 'Smith',
        role: 'TENANT',
      },
    });

    // Create property
    property = await prisma.property.create({
      data: {
        name: 'Test Property',
        address: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345',
        propertyType: 'APARTMENT',
        managerId: manager.id,
      },
    });

    // Add owner to property
    await prisma.propertyOwner.create({
      data: {
        propertyId: property.id,
        ownerId: owner.id,
        ownershipPercentage: 100,
      },
    });

    // Create unit
    unit = await prisma.unit.create({
      data: {
        unitNumber: '101',
        propertyId: property.id,
        status: 'OCCUPIED',
      },
    });

    // Create service request
    serviceRequest = await prisma.serviceRequest.create({
      data: {
        title: 'Leaky Faucet',
        description: 'The kitchen faucet has been leaking for 3 days. Water is dripping constantly.',
        category: 'PLUMBING',
        priority: 'HIGH',
        status: 'SUBMITTED',
        propertyId: property.id,
        unitId: unit.id,
        requestedById: tenant.id,
        photos: [
          'https://example.com/photo1.jpg',
          'https://example.com/photo2.jpg',
        ],
      },
    });
  });

  after(async () => {
    // Cleanup
    await prisma.serviceRequest.deleteMany({
      where: { propertyId: property.id },
    });
    await prisma.unit.deleteMany({
      where: { propertyId: property.id },
    });
    await prisma.propertyOwner.deleteMany({
      where: { propertyId: property.id },
    });
    await prisma.property.deleteMany({
      where: { id: property.id },
    });
    await prisma.user.deleteMany({
      where: {
        id: { in: [manager.id, owner.id, tenant.id, otherTenant.id] },
      },
    });
  });

  describe('Successful Retrieval', () => {
    it('should return service request with all details', async () => {
      const request = await prisma.serviceRequest.findUnique({
        where: { id: serviceRequest.id },
        include: {
          property: {
            select: {
              id: true,
              name: true,
              address: true,
              city: true,
              state: true,
            },
          },
          unit: {
            select: {
              id: true,
              unitNumber: true,
            },
          },
          requestedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          jobs: true,
        },
      });

      assert.strictEqual(request.id, serviceRequest.id);
      assert.strictEqual(request.title, 'Leaky Faucet');
      assert.strictEqual(request.description.includes('leaking'), true);
      assert.strictEqual(request.category, 'PLUMBING');
      assert.strictEqual(request.priority, 'HIGH');
      assert.strictEqual(request.status, 'SUBMITTED');
      assert.strictEqual(request.photos.length, 2);
    });

    it('should include property details', async () => {
      const request = await prisma.serviceRequest.findUnique({
        where: { id: serviceRequest.id },
        include: {
          property: {
            select: {
              id: true,
              name: true,
              address: true,
              city: true,
              state: true,
            },
          },
        },
      });

      assert.strictEqual(request.property.name, 'Test Property');
      assert.strictEqual(request.property.address, '123 Test St');
      assert.strictEqual(request.property.city, 'Test City');
      assert.strictEqual(request.property.state, 'TS');
    });

    it('should include unit details', async () => {
      const request = await prisma.serviceRequest.findUnique({
        where: { id: serviceRequest.id },
        include: {
          unit: {
            select: {
              id: true,
              unitNumber: true,
            },
          },
        },
      });

      assert.strictEqual(request.unit.unitNumber, '101');
    });

    it('should include requester details', async () => {
      const request = await prisma.serviceRequest.findUnique({
        where: { id: serviceRequest.id },
        include: {
          requestedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      assert.strictEqual(request.requestedBy.firstName, 'John');
      assert.strictEqual(request.requestedBy.lastName, 'Doe');
      assert.ok(request.requestedBy.email.includes('tenant-sr'));
    });

    it('should include converted jobs when they exist', async () => {
      // Create a job from the service request
      const job = await prisma.job.create({
        data: {
          title: 'Fix Leaky Faucet',
          description: 'Repair kitchen faucet',
          priority: 'HIGH',
          status: 'OPEN',
          property: {
            connect: { id: property.id },
          },
          unit: {
            connect: { id: unit.id },
          },
          serviceRequest: {
            connect: { id: serviceRequest.id },
          },
          User_Job_createdByIdToUser: {
            connect: { id: manager.id },
          },
        },
      });

      const request = await prisma.serviceRequest.findUnique({
        where: { id: serviceRequest.id },
        include: {
          jobs: {
            select: {
              id: true,
              title: true,
              status: true,
              priority: true,
              createdAt: true,
            },
          },
        },
      });

      assert.strictEqual(request.jobs.length, 1);
      assert.strictEqual(request.jobs[0].title, 'Fix Leaky Faucet');
      assert.strictEqual(request.jobs[0].status, 'OPEN');

      // Cleanup
      await prisma.job.delete({ where: { id: job.id } });
    });
  });

  describe('Error Handling', () => {
    it('should return null for non-existent request', async () => {
      const request = await prisma.serviceRequest.findUnique({
        where: { id: 'non-existent-id' },
      });

      assert.strictEqual(request, null);
    });

    it('should handle requests without unit', async () => {
      const requestWithoutUnit = await prisma.serviceRequest.create({
        data: {
          title: 'General Property Issue',
          description: 'Issue affects entire property',
          category: 'GENERAL',
          priority: 'MEDIUM',
          status: 'SUBMITTED',
          propertyId: property.id,
          unitId: null,
          requestedById: tenant.id,
        },
      });

      const request = await prisma.serviceRequest.findUnique({
        where: { id: requestWithoutUnit.id },
        include: {
          unit: true,
        },
      });

      assert.strictEqual(request.unit, null);

      // Cleanup
      await prisma.serviceRequest.delete({ where: { id: requestWithoutUnit.id } });
    });

    it('should handle requests without photos', async () => {
      const requestWithoutPhotos = await prisma.serviceRequest.create({
        data: {
          title: 'No Photos Request',
          description: 'Request without photos',
          category: 'GENERAL',
          priority: 'LOW',
          status: 'SUBMITTED',
          propertyId: property.id,
          unitId: unit.id,
          requestedById: tenant.id,
          photos: [],
        },
      });

      const request = await prisma.serviceRequest.findUnique({
        where: { id: requestWithoutPhotos.id },
      });

      assert.strictEqual(request.photos.length, 0);

      // Cleanup
      await prisma.serviceRequest.delete({ where: { id: requestWithoutPhotos.id } });
    });
  });

  describe('Access Control', () => {
    it('should allow property manager to access request', async () => {
      // Simulate access control check
      const request = await prisma.serviceRequest.findUnique({
        where: { id: serviceRequest.id },
        include: {
          property: {
            select: {
              managerId: true,
            },
          },
        },
      });

      const hasAccess = request.property.managerId === manager.id;
      assert.strictEqual(hasAccess, true);
    });

    it('should allow property owner to access request', async () => {
      // Simulate access control check
      const request = await prisma.serviceRequest.findUnique({
        where: { id: serviceRequest.id },
        include: {
          property: {
            include: {
              owners: {
                select: {
                  ownerId: true,
                },
              },
            },
          },
        },
      });

      const hasAccess = request.property.owners.some(o => o.ownerId === owner.id);
      assert.strictEqual(hasAccess, true);
    });

    it('should allow tenant to access their own request', async () => {
      // Simulate access control check
      const request = await prisma.serviceRequest.findUnique({
        where: { id: serviceRequest.id },
      });

      const hasAccess = request.requestedById === tenant.id;
      assert.strictEqual(hasAccess, true);
    });

    it('should deny access to other tenants', async () => {
      // Simulate access control check
      const request = await prisma.serviceRequest.findUnique({
        where: { id: serviceRequest.id },
      });

      const hasAccess = request.requestedById === otherTenant.id;
      assert.strictEqual(hasAccess, false);
    });
  });

  describe('Review History', () => {
    it('should include review notes when present', async () => {
      // Update request with review
      const updated = await prisma.serviceRequest.update({
        where: { id: serviceRequest.id },
        data: {
          status: 'APPROVED',
          reviewNotes: 'Approved - urgent repair needed',
          reviewedAt: new Date(),
        },
      });

      assert.strictEqual(updated.reviewNotes, 'Approved - urgent repair needed');
      assert.ok(updated.reviewedAt instanceof Date);

      // Reset for other tests
      await prisma.serviceRequest.update({
        where: { id: serviceRequest.id },
        data: {
          status: 'SUBMITTED',
          reviewNotes: null,
          reviewedAt: null,
        },
      });
    });

    it('should handle requests without review', async () => {
      const request = await prisma.serviceRequest.findUnique({
        where: { id: serviceRequest.id },
      });

      assert.strictEqual(request.reviewNotes, null);
      assert.strictEqual(request.reviewedAt, null);
    });
  });

  describe('Data Integrity', () => {
    it('should maintain timestamps', async () => {
      const request = await prisma.serviceRequest.findUnique({
        where: { id: serviceRequest.id },
      });

      assert.ok(request.createdAt instanceof Date);
      assert.ok(request.updatedAt instanceof Date);
    });

    it('should preserve photo URLs', async () => {
      const request = await prisma.serviceRequest.findUnique({
        where: { id: serviceRequest.id },
      });

      assert.strictEqual(request.photos.length, 2);
      assert.ok(request.photos[0].includes('example.com'));
      assert.ok(request.photos[1].includes('example.com'));
    });

    it('should maintain category and priority', async () => {
      const request = await prisma.serviceRequest.findUnique({
        where: { id: serviceRequest.id },
      });

      assert.strictEqual(request.category, 'PLUMBING');
      assert.strictEqual(request.priority, 'HIGH');
    });
  });
});
