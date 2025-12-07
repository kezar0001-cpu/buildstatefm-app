/**
 * Integration tests for Properties Workflow
 * 
 * Tests the complete property lifecycle:
 * - Property creation with units and images
 * - Unit creation and management
 * - Image uploads
 * - Data persistence
 * - Response format consistency
 */

const request = require('supertest');
const { PrismaClient } = require('@prisma/client');
const app = require('../../src/app');

const prisma = new PrismaClient();

describe('Properties Workflow Integration Tests', () => {
  let authToken;
  let testUserId;
  let testPropertyId;
  let testUnitId;

  beforeAll(async () => {
    // Setup: Create test user and get auth token
    // This would typically use your auth setup
    // For now, we'll assume auth is handled via middleware
    
    // Create test property manager user
    const testUser = await prisma.user.create({
      data: {
        email: `test-property-manager-${Date.now()}@test.com`,
        passwordHash: 'hashed-password',
        firstName: 'Test',
        lastName: 'Manager',
        role: 'PROPERTY_MANAGER',
        isActive: true,
      },
    });
    testUserId = testUser.id;

    // Get auth token (implementation depends on your auth system)
    // authToken = await getAuthToken(testUser);
  });

  afterAll(async () => {
    // Cleanup: Delete test data
    if (testUnitId) {
      await prisma.unit.deleteMany({ where: { id: testUnitId } });
    }
    if (testPropertyId) {
      await prisma.property.deleteMany({ where: { id: testPropertyId } });
    }
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } });
    }
    await prisma.$disconnect();
  });

  describe('Property Creation Workflow', () => {
    test('should create property with basic info', async () => {
      const propertyData = {
        name: 'Test Property',
        address: '123 Test St',
        city: 'Test City',
        state: 'CA',
        zipCode: '12345',
        country: 'USA',
        propertyType: 'Residential',
        status: 'ACTIVE',
        totalArea: 2500, // Integer value
      };

      const response = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${authToken}`)
        .send(propertyData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('property');
      expect(response.body.property).toHaveProperty('id');
      expect(response.body.property.name).toBe(propertyData.name);
      expect(response.body.property.totalArea).toBe(2500); // Should be integer
      
      testPropertyId = response.body.property.id;
    });

    test('should create property with units', async () => {
      const propertyData = {
        name: 'Test Property with Units',
        address: '456 Test Ave',
        city: 'Test City',
        country: 'USA',
        propertyType: 'Residential',
        units: [
          {
            unitNumber: '101',
            bedrooms: 2,
            bathrooms: 1.5,
            area: 850, // Integer value
            rentAmount: 1200,
          },
          {
            unitNumber: '102',
            bedrooms: 1,
            bathrooms: 1,
            area: 600, // Integer value
            rentAmount: 900,
          },
        ],
      };

      const response = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${authToken}`)
        .send(propertyData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.property).toHaveProperty('id');
      
      // Verify units were created
      const property = await prisma.property.findUnique({
        where: { id: response.body.property.id },
        include: { units: true },
      });

      expect(property.units).toHaveLength(2);
      expect(property.units[0].area).toBe(850); // Should be integer
      expect(property.units[1].area).toBe(600); // Should be integer
    });

    test('should convert float area values to integers', async () => {
      const propertyData = {
        name: 'Test Property Float Area',
        address: '789 Test Blvd',
        city: 'Test City',
        country: 'USA',
        propertyType: 'Residential',
        totalArea: 2500.7, // Float value
        units: [
          {
            unitNumber: '201',
            area: 850.9, // Float value
          },
        ],
      };

      const response = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${authToken}`)
        .send(propertyData)
        .expect(201);

      const property = await prisma.property.findUnique({
        where: { id: response.body.property.id },
        include: { units: true },
      });

      expect(property.totalArea).toBe(2501); // Should be rounded to integer
      expect(property.units[0].area).toBe(851); // Should be rounded to integer
    });
  });

  describe('Unit Creation Workflow', () => {
    beforeEach(async () => {
      // Create a test property for unit tests
      const property = await prisma.property.create({
        data: {
          name: 'Unit Test Property',
          address: '999 Test St',
          city: 'Test City',
          country: 'USA',
          propertyType: 'Residential',
          managerId: testUserId,
        },
      });
      testPropertyId = property.id;
    });

    test('should create unit with integer area', async () => {
      const unitData = {
        propertyId: testPropertyId,
        unitNumber: '301',
        bedrooms: 2,
        bathrooms: 1.5,
        area: 900, // Integer value
        rentAmount: 1500,
      };

      const response = await request(app)
        .post('/api/units')
        .set('Authorization', `Bearer ${authToken}`)
        .send(unitData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('unit');
      expect(response.body.unit.area).toBe(900); // Should be integer
      
      testUnitId = response.body.unit.id;
    });

    test('should convert float area to integer on unit creation', async () => {
      const unitData = {
        propertyId: testPropertyId,
        unitNumber: '302',
        area: 750.8, // Float value
      };

      const response = await request(app)
        .post('/api/units')
        .set('Authorization', `Bearer ${authToken}`)
        .send(unitData)
        .expect(201);

      const unit = await prisma.unit.findUnique({
        where: { id: response.body.unit.id },
      });

      expect(unit.area).toBe(751); // Should be rounded to integer
    });

    test('should update unit with integer area', async () => {
      // Create unit first
      const unit = await prisma.unit.create({
        data: {
          propertyId: testPropertyId,
          unitNumber: '303',
          area: 800,
        },
      });

      const updateData = {
        area: 850.6, // Float value
      };

      const response = await request(app)
        .patch(`/api/units/${unit.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      
      const updatedUnit = await prisma.unit.findUnique({
        where: { id: unit.id },
      });

      expect(updatedUnit.area).toBe(851); // Should be rounded to integer
    });
  });

  describe('Response Format Consistency', () => {
    test('property endpoints should return success wrapper', async () => {
      const property = await prisma.property.create({
        data: {
          name: 'Response Test Property',
          address: '111 Test St',
          city: 'Test City',
          country: 'USA',
          propertyType: 'Residential',
          managerId: testUserId,
        },
      });

      const response = await request(app)
        .get(`/api/properties/${property.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('property');
    });

    test('unit endpoints should return success wrapper', async () => {
      const property = await prisma.property.create({
        data: {
          name: 'Unit Response Test',
          address: '222 Test St',
          city: 'Test City',
          country: 'USA',
          propertyType: 'Residential',
          managerId: testUserId,
        },
      });

      const unit = await prisma.unit.create({
        data: {
          propertyId: property.id,
          unitNumber: '401',
        },
      });

      const response = await request(app)
        .get(`/api/units/${unit.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('unit');
    });
  });

  describe('Database Schema Validation', () => {
    test('UnitImage.updatedAt should auto-update', async () => {
      const property = await prisma.property.create({
        data: {
          name: 'Schema Test Property',
          address: '333 Test St',
          city: 'Test City',
          country: 'USA',
          propertyType: 'Residential',
          managerId: testUserId,
        },
      });

      const unit = await prisma.unit.create({
        data: {
          propertyId: property.id,
          unitNumber: '501',
        },
      });

      const image = await prisma.unitImage.create({
        data: {
          id: `test-image-${Date.now()}`,
          unitId: unit.id,
          imageUrl: 'https://example.com/image.jpg',
        },
      });

      const initialUpdatedAt = image.updatedAt;

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Update the image
      await prisma.unitImage.update({
        where: { id: image.id },
        data: { caption: 'Updated caption' },
      });

      const updatedImage = await prisma.unitImage.findUnique({
        where: { id: image.id },
      });

      expect(updatedImage.updatedAt.getTime()).toBeGreaterThan(initialUpdatedAt.getTime());
    });

    test('UnitOwner.updatedAt should auto-update', async () => {
      const property = await prisma.property.create({
        data: {
          name: 'Owner Test Property',
          address: '444 Test St',
          city: 'Test City',
          country: 'USA',
          propertyType: 'Residential',
          managerId: testUserId,
        },
      });

      const unit = await prisma.unit.create({
        data: {
          propertyId: property.id,
          unitNumber: '601',
        },
      });

      const owner = await prisma.unitOwner.create({
        data: {
          id: `test-owner-${Date.now()}`,
          unitId: unit.id,
          ownerId: testUserId,
        },
      });

      const initialUpdatedAt = owner.updatedAt;

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Update the owner
      await prisma.unitOwner.update({
        where: { id: owner.id },
        data: { ownershipPercentage: 50.0 },
      });

      const updatedOwner = await prisma.unitOwner.findUnique({
        where: { id: owner.id },
      });

      expect(updatedOwner.updatedAt.getTime()).toBeGreaterThan(initialUpdatedAt.getTime());
    });
  });
});

