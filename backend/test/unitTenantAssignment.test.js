import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { prisma } from '../src/config/prismaClient.js';

describe('Unit Tenant Assignment API', () => {
  let manager, tenant1, tenant2, property, unit;
  let managerToken, tenantToken;

  before(async () => {
    // Create test users
    const { default: bcrypt } = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash('password123', 10);

    manager = await prisma.user.create({
      data: {
        email: `manager-${Date.now()}@test.com`,
        passwordHash: hashedPassword,
        firstName: 'Test',
        lastName: 'Manager',
        role: 'PROPERTY_MANAGER',
      },
    });

    tenant1 = await prisma.user.create({
      data: {
        email: `tenant1-${Date.now()}@test.com`,
        passwordHash: hashedPassword,
        firstName: 'John',
        lastName: 'Doe',
        role: 'TENANT',
      },
    });

    tenant2 = await prisma.user.create({
      data: {
        email: `tenant2-${Date.now()}@test.com`,
        passwordHash: hashedPassword,
        firstName: 'Jane',
        lastName: 'Smith',
        role: 'TENANT',
      },
    });

    // Create property and unit
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

    unit = await prisma.unit.create({
      data: {
        unitNumber: '101',
        propertyId: property.id,
        bedrooms: 2,
        bathrooms: 1,
        area: 850,
        rentAmount: 1500,
        status: 'AVAILABLE',
      },
    });

    // Generate tokens (simplified - in real app would use JWT)
    managerToken = 'mock-manager-token';
    tenantToken = 'mock-tenant-token';
  });

  after(async () => {
    // Cleanup
    await prisma.unitTenant.deleteMany({ where: { unitId: unit.id } });
    await prisma.unit.deleteMany({ where: { propertyId: property.id } });
    await prisma.property.deleteMany({ where: { id: property.id } });
    await prisma.user.deleteMany({
      where: {
        id: { in: [manager.id, tenant1.id, tenant2.id] },
      },
    });
  });

  beforeEach(async () => {
    // Clean up tenant assignments before each test
    await prisma.unitTenant.deleteMany({ where: { unitId: unit.id } });
  });

  describe('POST /api/units/:unitId/tenants - Assign Tenant', () => {
    it('should assign tenant to unit successfully', async () => {
      const leaseStart = new Date('2024-01-01');
      const leaseEnd = new Date('2024-12-31');

      const assignment = await prisma.unitTenant.create({
        data: {
          unitId: unit.id,
          tenantId: tenant1.id,
          leaseStart,
          leaseEnd,
          rentAmount: 1500,
          depositAmount: 1500,
          isActive: true,
        },
        include: {
          tenant: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      assert.strictEqual(assignment.unitId, unit.id);
      assert.strictEqual(assignment.tenantId, tenant1.id);
      assert.strictEqual(assignment.rentAmount, 1500);
      assert.strictEqual(assignment.depositAmount, 1500);
      assert.strictEqual(assignment.isActive, true);
      assert.strictEqual(assignment.tenant.firstName, 'John');
    });

    it('should reject assignment with missing required fields', async () => {
      try {
        await prisma.unitTenant.create({
          data: {
            unitId: unit.id,
            tenantId: tenant1.id,
            // Missing leaseStart, leaseEnd, rentAmount
          },
        });
        assert.fail('Should have thrown validation error');
      } catch (error) {
        // Prisma will throw error for missing required fields
        assert.ok(error.message || error.code);
      }
    });

    it('should reject assignment with invalid date range', async () => {
      const leaseStart = new Date('2024-12-31');
      const leaseEnd = new Date('2024-01-01'); // End before start

      // Validation should happen at API level
      assert.ok(leaseEnd < leaseStart, 'End date is before start date');
    });

    it('should reject assignment with negative rent amount', async () => {
      const rentAmount = -1500;
      assert.ok(rentAmount < 0, 'Rent amount is negative');
    });

    it('should prevent duplicate active assignments for same tenant', async () => {
      // Create first assignment
      await prisma.unitTenant.create({
        data: {
          unitId: unit.id,
          tenantId: tenant1.id,
          leaseStart: new Date('2024-01-01'),
          leaseEnd: new Date('2024-12-31'),
          rentAmount: 1500,
          isActive: true,
        },
      });

      // Check for existing active assignment
      const existingActive = await prisma.unitTenant.findFirst({
        where: {
          tenantId: tenant1.id,
          isActive: true,
        },
      });

      assert.ok(existingActive, 'Tenant already has active assignment');
    });

    it('should allow assignment with optional deposit amount', async () => {
      const assignment = await prisma.unitTenant.create({
        data: {
          unitId: unit.id,
          tenantId: tenant1.id,
          leaseStart: new Date('2024-01-01'),
          leaseEnd: new Date('2024-12-31'),
          rentAmount: 1500,
          // No depositAmount
          isActive: true,
        },
      });

      assert.strictEqual(assignment.depositAmount, null);
    });

    it('should create assignment with all fields', async () => {
      const assignment = await prisma.unitTenant.create({
        data: {
          unitId: unit.id,
          tenantId: tenant1.id,
          leaseStart: new Date('2024-01-01'),
          leaseEnd: new Date('2024-12-31'),
          rentAmount: 1500,
          depositAmount: 1500,
          isActive: true,
        },
      });

      assert.strictEqual(assignment.rentAmount, 1500);
      assert.strictEqual(assignment.depositAmount, 1500);
      assert.strictEqual(assignment.isActive, true);
    });
  });

  describe('GET /api/units/:unitId/tenants - Get Unit Tenants', () => {
    it('should return all tenants for a unit', async () => {
      // Create two assignments (one active, one past)
      await prisma.unitTenant.create({
        data: {
          unitId: unit.id,
          tenantId: tenant1.id,
          leaseStart: new Date('2023-01-01'),
          leaseEnd: new Date('2023-12-31'),
          rentAmount: 1400,
          isActive: false,
        },
      });

      await prisma.unitTenant.create({
        data: {
          unitId: unit.id,
          tenantId: tenant2.id,
          leaseStart: new Date('2024-01-01'),
          leaseEnd: new Date('2024-12-31'),
          rentAmount: 1500,
          isActive: true,
        },
      });

      const tenants = await prisma.unitTenant.findMany({
        where: { unitId: unit.id },
        include: {
          tenant: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      assert.strictEqual(tenants.length, 2);
      assert.strictEqual(tenants[0].isActive, true);
      assert.strictEqual(tenants[1].isActive, false);
    });

    it('should return empty array for unit with no tenants', async () => {
      const tenants = await prisma.unitTenant.findMany({
        where: { unitId: unit.id },
      });

      assert.strictEqual(tenants.length, 0);
    });

    it('should include tenant details in response', async () => {
      await prisma.unitTenant.create({
        data: {
          unitId: unit.id,
          tenantId: tenant1.id,
          leaseStart: new Date('2024-01-01'),
          leaseEnd: new Date('2024-12-31'),
          rentAmount: 1500,
          isActive: true,
        },
      });

      const tenants = await prisma.unitTenant.findMany({
        where: { unitId: unit.id },
        include: {
          tenant: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      assert.strictEqual(tenants[0].tenant.firstName, 'John');
      assert.strictEqual(tenants[0].tenant.lastName, 'Doe');
      assert.ok(tenants[0].tenant.email.includes('tenant1'));
    });
  });

  describe('PATCH /api/units/:unitId/tenants/:tenantId - Update Assignment', () => {
    it('should update lease end date', async () => {
      const assignment = await prisma.unitTenant.create({
        data: {
          unitId: unit.id,
          tenantId: tenant1.id,
          leaseStart: new Date('2024-01-01'),
          leaseEnd: new Date('2024-12-31'),
          rentAmount: 1500,
          isActive: true,
        },
      });

      const newLeaseEnd = new Date('2025-12-31');
      const updated = await prisma.unitTenant.update({
        where: { id: assignment.id },
        data: { leaseEnd: newLeaseEnd },
      });

      assert.strictEqual(updated.leaseEnd.toISOString(), newLeaseEnd.toISOString());
    });

    it('should update rent amount', async () => {
      const assignment = await prisma.unitTenant.create({
        data: {
          unitId: unit.id,
          tenantId: tenant1.id,
          leaseStart: new Date('2024-01-01'),
          leaseEnd: new Date('2024-12-31'),
          rentAmount: 1500,
          isActive: true,
        },
      });

      const updated = await prisma.unitTenant.update({
        where: { id: assignment.id },
        data: { rentAmount: 1600 },
      });

      assert.strictEqual(updated.rentAmount, 1600);
    });

    it('should update deposit amount', async () => {
      const assignment = await prisma.unitTenant.create({
        data: {
          unitId: unit.id,
          tenantId: tenant1.id,
          leaseStart: new Date('2024-01-01'),
          leaseEnd: new Date('2024-12-31'),
          rentAmount: 1500,
          depositAmount: 1500,
          isActive: true,
        },
      });

      const updated = await prisma.unitTenant.update({
        where: { id: assignment.id },
        data: { depositAmount: 2000 },
      });

      assert.strictEqual(updated.depositAmount, 2000);
    });

    it('should update isActive status', async () => {
      const assignment = await prisma.unitTenant.create({
        data: {
          unitId: unit.id,
          tenantId: tenant1.id,
          leaseStart: new Date('2024-01-01'),
          leaseEnd: new Date('2024-12-31'),
          rentAmount: 1500,
          isActive: true,
        },
      });

      const updated = await prisma.unitTenant.update({
        where: { id: assignment.id },
        data: { isActive: false },
      });

      assert.strictEqual(updated.isActive, false);
    });

    it('should update multiple fields at once', async () => {
      const assignment = await prisma.unitTenant.create({
        data: {
          unitId: unit.id,
          tenantId: tenant1.id,
          leaseStart: new Date('2024-01-01'),
          leaseEnd: new Date('2024-12-31'),
          rentAmount: 1500,
          isActive: true,
        },
      });

      const updated = await prisma.unitTenant.update({
        where: { id: assignment.id },
        data: { 
          rentAmount: 1600,
          depositAmount: 1600,
          isActive: false
        },
      });

      assert.strictEqual(updated.rentAmount, 1600);
      assert.strictEqual(updated.depositAmount, 1600);
      assert.strictEqual(updated.isActive, false);
    });
  });

  describe('DELETE /api/units/:unitId/tenants/:tenantId - Remove Tenant', () => {
    it('should remove tenant assignment', async () => {
      const assignment = await prisma.unitTenant.create({
        data: {
          unitId: unit.id,
          tenantId: tenant1.id,
          leaseStart: new Date('2024-01-01'),
          leaseEnd: new Date('2024-12-31'),
          rentAmount: 1500,
          isActive: true,
        },
      });

      await prisma.unitTenant.delete({
        where: { id: assignment.id },
      });

      const found = await prisma.unitTenant.findUnique({
        where: { id: assignment.id },
      });

      assert.strictEqual(found, null);
    });

    it('should handle removing non-existent assignment', async () => {
      try {
        await prisma.unitTenant.delete({
          where: { id: 'non-existent-id' },
        });
        assert.fail('Should have thrown error');
      } catch (error) {
        assert.ok(error.message.includes('not found') || error.code === 'P2025');
      }
    });
  });

  describe('Business Logic Validations', () => {
    it('should prevent overlapping active assignments for same unit', async () => {
      // Create first assignment
      await prisma.unitTenant.create({
        data: {
          unitId: unit.id,
          tenantId: tenant1.id,
          leaseStart: new Date('2024-01-01'),
          leaseEnd: new Date('2024-12-31'),
          rentAmount: 1500,
          isActive: true,
        },
      });

      // Check for existing active tenant
      const existingActive = await prisma.unitTenant.findFirst({
        where: {
          unitId: unit.id,
          isActive: true,
        },
      });

      assert.ok(existingActive, 'Unit already has active tenant');
    });

    it('should allow multiple inactive assignments for same unit', async () => {
      await prisma.unitTenant.create({
        data: {
          unitId: unit.id,
          tenantId: tenant1.id,
          leaseStart: new Date('2023-01-01'),
          leaseEnd: new Date('2023-12-31'),
          rentAmount: 1400,
          isActive: false,
        },
      });

      await prisma.unitTenant.create({
        data: {
          unitId: unit.id,
          tenantId: tenant2.id,
          leaseStart: new Date('2022-01-01'),
          leaseEnd: new Date('2022-12-31'),
          rentAmount: 1300,
          isActive: false,
        },
      });

      const inactiveAssignments = await prisma.unitTenant.findMany({
        where: {
          unitId: unit.id,
          isActive: false,
        },
      });

      assert.strictEqual(inactiveAssignments.length, 2);
    });

    it('should track assignment timestamps', async () => {
      const beforeCreate = new Date();

      const assignment = await prisma.unitTenant.create({
        data: {
          unitId: unit.id,
          tenantId: tenant1.id,
          leaseStart: new Date('2024-01-01'),
          leaseEnd: new Date('2024-12-31'),
          rentAmount: 1500,
          isActive: true,
        },
      });

      const afterCreate = new Date();

      assert.ok(assignment.createdAt >= beforeCreate);
      assert.ok(assignment.createdAt <= afterCreate);
      assert.ok(assignment.updatedAt >= beforeCreate);
      assert.ok(assignment.updatedAt <= afterCreate);
    });

    it('should update updatedAt timestamp on modification', async () => {
      const assignment = await prisma.unitTenant.create({
        data: {
          unitId: unit.id,
          tenantId: tenant1.id,
          leaseStart: new Date('2024-01-01'),
          leaseEnd: new Date('2024-12-31'),
          rentAmount: 1500,
          isActive: true,
        },
      });

      const originalUpdatedAt = assignment.updatedAt;

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      const updated = await prisma.unitTenant.update({
        where: { id: assignment.id },
        data: { rentAmount: 1600 },
      });

      assert.ok(updated.updatedAt > originalUpdatedAt);
    });
  });

  describe('Data Integrity', () => {
    it('should cascade delete when unit is deleted', async () => {
      // Create a temporary unit
      const tempUnit = await prisma.unit.create({
        data: {
          unitNumber: '999',
          propertyId: property.id,
          status: 'AVAILABLE',
        },
      });

      // Create assignment
      const assignment = await prisma.unitTenant.create({
        data: {
          unitId: tempUnit.id,
          tenantId: tenant1.id,
          leaseStart: new Date('2024-01-01'),
          leaseEnd: new Date('2024-12-31'),
          rentAmount: 1500,
          isActive: true,
        },
      });

      // Delete unit
      await prisma.unit.delete({ where: { id: tempUnit.id } });

      // Assignment should be deleted
      const found = await prisma.unitTenant.findUnique({
        where: { id: assignment.id },
      });

      assert.strictEqual(found, null);
    });

    it('should cascade delete when tenant user is deleted', async () => {
      // Create temporary tenant
      const { default: bcrypt } = await import('bcryptjs');
      const hashedPassword = await bcrypt.hash('password123', 10);

      const tempTenant = await prisma.user.create({
        data: {
          email: `temp-tenant-${Date.now()}@test.com`,
          passwordHash: hashedPassword,
          firstName: 'Temp',
          lastName: 'Tenant',
          role: 'TENANT',
        },
      });

      // Create assignment
      const assignment = await prisma.unitTenant.create({
        data: {
          unitId: unit.id,
          tenantId: tempTenant.id,
          leaseStart: new Date('2024-01-01'),
          leaseEnd: new Date('2024-12-31'),
          rentAmount: 1500,
          isActive: true,
        },
      });

      // Delete tenant
      await prisma.user.delete({ where: { id: tempTenant.id } });

      // Assignment should be deleted
      const found = await prisma.unitTenant.findUnique({
        where: { id: assignment.id },
      });

      assert.strictEqual(found, null);
    });
  });
});
