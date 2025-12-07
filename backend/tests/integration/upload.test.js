/**
 * Integration Tests for Upload System
 * 
 * Tests all upload workflows end-to-end:
 * - Single file upload
 * - Multi-file upload
 * - Document upload
 * - Inspection photo upload
 * - Response format validation
 * - S3 persistence
 * - Database persistence
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../server.js';
import { prisma } from '../../src/utils/prisma.js';
import { s3Client, bucketName } from '../../src/services/s3Service.js';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';

// Test user credentials (should be set up in test database)
const TEST_USER = {
  email: 'test@example.com',
  password: 'testpassword123',
};

let authToken;
let testPropertyId;
let testUnitId;
let testInspectionId;

beforeAll(async () => {
  // Setup: Create test user and get auth token
  // This would typically use your auth setup
  const loginResponse = await request(app)
    .post('/api/auth/login')
    .send(TEST_USER);
  
  authToken = loginResponse.body.token;
  
  // Create test property
  const propertyResponse = await request(app)
    .post('/api/properties')
    .set('Authorization', `Bearer ${authToken}`)
    .send({
      name: 'Test Property',
      address: '123 Test St',
      city: 'Test City',
      state: 'TS',
      propertyType: 'APARTMENT',
    });
  
  testPropertyId = propertyResponse.body.property.id;
  
  // Create test unit
  const unitResponse = await request(app)
    .post('/api/units')
    .set('Authorization', `Bearer ${authToken}`)
    .send({
      propertyId: testPropertyId,
      unitNumber: '101',
    });
  
  testUnitId = unitResponse.body.unit.id;
});

afterAll(async () => {
  // Cleanup: Delete test data
  if (testInspectionId) {
    await prisma.inspection.delete({ where: { id: testInspectionId } });
  }
  if (testUnitId) {
    await prisma.unit.delete({ where: { id: testUnitId } });
  }
  if (testPropertyId) {
    await prisma.property.delete({ where: { id: testPropertyId } });
  }
});

describe('Upload System Integration Tests', () => {
  
  describe('Single File Upload', () => {
    it('should upload a single image file and return standardized format', async () => {
      const response = await request(app)
        .post('/api/uploads/single')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', Buffer.from('fake image data'), 'test.jpg')
        .expect(201);
      
      // Verify response format
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('files');
      expect(Array.isArray(response.body.files)).toBe(true);
      expect(response.body.files.length).toBe(1);
      
      // Verify file metadata
      const file = response.body.files[0];
      expect(file).toHaveProperty('url');
      expect(file).toHaveProperty('key');
      expect(file).toHaveProperty('size');
      expect(file).toHaveProperty('type');
      expect(file).toHaveProperty('originalName');
      
      // Verify URL is valid
      expect(file.url).toMatch(/^https?:\/\//);
      
      // Cleanup: Delete from S3
      if (file.key) {
        await s3Client.send(new DeleteObjectCommand({
          Bucket: bucketName,
          Key: file.key,
        }));
      }
    });
    
    it('should return error for missing file', async () => {
      const response = await request(app)
        .post('/api/uploads/single')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('message');
    });
  });
  
  describe('Multiple File Upload', () => {
    it('should upload multiple files and return standardized format', async () => {
      const response = await request(app)
        .post('/api/uploads/multiple')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('files', Buffer.from('fake image 1'), 'test1.jpg')
        .attach('files', Buffer.from('fake image 2'), 'test2.jpg')
        .attach('files', Buffer.from('fake image 3'), 'test3.jpg')
        .expect(201);
      
      // Verify response format
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('files');
      expect(response.body.files.length).toBe(3);
      
      // Verify backward compatibility
      expect(response.body).toHaveProperty('urls');
      expect(response.body.urls.length).toBe(3);
      
      // Verify each file has complete metadata
      response.body.files.forEach((file, index) => {
        expect(file).toHaveProperty('url');
        expect(file).toHaveProperty('key');
        expect(file).toHaveProperty('size');
        expect(file).toHaveProperty('type');
        expect(file.url).toBe(response.body.urls[index]); // URLs match
      });
      
      // Cleanup: Delete from S3
      for (const file of response.body.files) {
        if (file.key) {
          await s3Client.send(new DeleteObjectCommand({
            Bucket: bucketName,
            Key: file.key,
          }));
        }
      }
    });
  });
  
  describe('Document Upload', () => {
    it('should upload documents and return standardized format', async () => {
      const response = await request(app)
        .post('/api/uploads/documents')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('files', Buffer.from('fake pdf data'), 'test.pdf')
        .expect(201);
      
      // Verify response format
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('files');
      expect(response.body.files.length).toBe(1);
      
      const file = response.body.files[0];
      expect(file.type).toMatch(/application\/pdf|application\/octet-stream/);
      
      // Cleanup
      if (file.key) {
        await s3Client.send(new DeleteObjectCommand({
          Bucket: bucketName,
          Key: file.key,
        }));
      }
    });
  });
  
  describe('Inspection Photo Upload', () => {
    beforeAll(async () => {
      // Create test inspection
      const inspection = await prisma.inspection.create({
        data: {
          title: 'Test Inspection',
          type: 'ROUTINE',
          scheduledDate: new Date(),
          propertyId: testPropertyId,
          unitId: testUnitId,
          status: 'IN_PROGRESS',
        },
      });
      testInspectionId = inspection.id;
    });
    
    it('should upload inspection photos to inspections/ folder', async () => {
      const response = await request(app)
        .post('/api/uploads/inspection-photos')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('photos', Buffer.from('fake photo'), 'inspection.jpg')
        .expect(201);
      
      // Verify response format
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('files');
      
      const file = response.body.files[0];
      
      // Verify S3 key contains 'inspections/' folder
      expect(file.key).toMatch(/^inspections\//);
      
      // Cleanup
      if (file.key) {
        await s3Client.send(new DeleteObjectCommand({
          Bucket: bucketName,
          Key: file.key,
        }));
      }
    });
  });
  
  describe('Property Image Database Persistence', () => {
    it('should save uploaded image to PropertyImage table', async () => {
      // Upload image
      const uploadResponse = await request(app)
        .post('/api/uploads/single')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', Buffer.from('fake image'), 'property.jpg')
        .expect(201);
      
      const imageUrl = uploadResponse.body.files[0].url;
      
      // Create PropertyImage record
      const imageRecord = await prisma.propertyImage.create({
        data: {
          propertyId: testPropertyId,
          imageUrl: imageUrl,
          isPrimary: false,
          displayOrder: 0,
        },
      });
      
      // Verify record exists
      const found = await prisma.propertyImage.findUnique({
        where: { id: imageRecord.id },
      });
      
      expect(found).toBeTruthy();
      expect(found.imageUrl).toBe(imageUrl);
      
      // Cleanup
      await prisma.propertyImage.delete({ where: { id: imageRecord.id } });
      if (uploadResponse.body.files[0].key) {
        await s3Client.send(new DeleteObjectCommand({
          Bucket: bucketName,
          Key: uploadResponse.body.files[0].key,
        }));
      }
    });
  });
  
  describe('Unit Image Database Persistence', () => {
    it('should save uploaded image to UnitImage table', async () => {
      // Upload image
      const uploadResponse = await request(app)
        .post('/api/uploads/single')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', Buffer.from('fake image'), 'unit.jpg')
        .expect(201);
      
      const imageUrl = uploadResponse.body.files[0].url;
      
      // Create UnitImage record
      const imageRecord = await prisma.unitImage.create({
        data: {
          unitId: testUnitId,
          imageUrl: imageUrl,
          isPrimary: false,
          displayOrder: 0,
        },
      });
      
      // Verify record exists
      const found = await prisma.unitImage.findUnique({
        where: { id: imageRecord.id },
      });
      
      expect(found).toBeTruthy();
      expect(found.imageUrl).toBe(imageUrl);
      
      // Cleanup
      await prisma.unitImage.delete({ where: { id: imageRecord.id } });
      if (uploadResponse.body.files[0].key) {
        await s3Client.send(new DeleteObjectCommand({
          Bucket: bucketName,
          Key: uploadResponse.body.files[0].key,
        }));
      }
    });
  });
  
  describe('File Deletion', () => {
    it('should delete file from S3 when requested', async () => {
      // Upload file
      const uploadResponse = await request(app)
        .post('/api/uploads/single')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', Buffer.from('fake image'), 'delete-test.jpg')
        .expect(201);
      
      const fileKey = uploadResponse.body.files[0].key;
      
      // Delete from S3
      await s3Client.send(new DeleteObjectCommand({
        Bucket: bucketName,
        Key: fileKey,
      }));
      
      // Verify file is deleted (should throw NotFound error)
      try {
        await s3Client.send(new HeadObjectCommand({
          Bucket: bucketName,
          Key: fileKey,
        }));
        fail('File should have been deleted');
      } catch (error) {
        expect(error.name).toBe('NotFound');
      }
    });
  });
  
  describe('Error Handling', () => {
    it('should return structured error for invalid file type', async () => {
      const response = await request(app)
        .post('/api/uploads/single')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', Buffer.from('not an image'), 'test.exe')
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('message');
    });
    
    it('should return structured error for file too large', async () => {
      // Create a file larger than 10MB
      const largeFile = Buffer.alloc(11 * 1024 * 1024); // 11MB
      
      const response = await request(app)
        .post('/api/uploads/single')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', largeFile, 'large.jpg')
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toHaveProperty('code');
    });
  });
  
  describe('Response Format Consistency', () => {
    it('should return same format for all upload endpoints', async () => {
      const endpoints = [
        { path: '/api/uploads/single', field: 'file' },
        { path: '/api/uploads/multiple', field: 'files' },
        { path: '/api/uploads/documents', field: 'files' },
        { path: '/api/uploads/inspection-photos', field: 'photos' },
      ];
      
      for (const endpoint of endpoints) {
        const response = await request(app)
          .post(endpoint.path)
          .set('Authorization', `Bearer ${authToken}`)
          .attach(endpoint.field, Buffer.from('test'), 'test.jpg')
          .expect(201);
        
        // All should have same structure
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('files');
        expect(Array.isArray(response.body.files)).toBe(true);
        
        if (response.body.files.length > 0) {
          const file = response.body.files[0];
          expect(file).toHaveProperty('url');
          expect(file).toHaveProperty('key');
          expect(file).toHaveProperty('size');
          expect(file).toHaveProperty('type');
        }
        
        // Cleanup
        if (response.body.files?.[0]?.key) {
          await s3Client.send(new DeleteObjectCommand({
            Bucket: bucketName,
            Key: response.body.files[0].key,
          }));
        }
      }
    });
  });
});

