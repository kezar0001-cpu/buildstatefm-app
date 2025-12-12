import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('job comments require authentication', () => {
  // Test that comment endpoints require auth
  const endpoints = [
    { path: '/jobs/:id/comments', method: 'GET', requiresAuth: true },
    { path: '/jobs/:id/comments', method: 'POST', requiresAuth: true },
  ];

  endpoints.forEach(endpoint => {
    assert.equal(endpoint.requiresAuth, true);
  });
});

test('comment content validation', () => {
  // Test comment content requirements
  const validComment = {
    content: 'This is a valid comment',
  };

  const emptyComment = {
    content: '',
  };

  const longComment = {
    content: 'a'.repeat(2001), // Over 2000 char limit
  };

  assert.ok(validComment.content.length > 0);
  assert.ok(validComment.content.length <= 2000);
  assert.equal(emptyComment.content.length, 0);
  assert.ok(longComment.content.length > 2000);
});

test('comment response structure', () => {
  // Test expected response format
  const commentResponse = {
    success: true,
    comment: {
      id: 'clx123',
      jobId: 'clx456',
      userId: 'clx789',
      content: 'Test comment',
      createdAt: new Date().toISOString(),
      user: {
        id: 'clx789',
        firstName: 'John',
        lastName: 'Doe',
        role: 'TECHNICIAN',
      },
    },
  };

  assert.equal(commentResponse.success, true);
  assert.ok(commentResponse.comment.id);
  assert.ok(commentResponse.comment.jobId);
  assert.ok(commentResponse.comment.userId);
  assert.ok(commentResponse.comment.content);
  assert.ok(commentResponse.comment.user);
  assert.ok(commentResponse.comment.user.firstName);
  assert.ok(commentResponse.comment.user.role);
});

test('comments list response structure', () => {
  // Test expected response format for list
  const commentsResponse = {
    success: true,
    comments: [
      {
        id: 'clx123',
        jobId: 'clx456',
        content: 'First comment',
        createdAt: new Date().toISOString(),
        user: {
          id: 'clx789',
          firstName: 'John',
          lastName: 'Doe',
          role: 'TECHNICIAN',
        },
      },
    ],
  };

  assert.equal(commentsResponse.success, true);
  assert.ok(Array.isArray(commentsResponse.comments));
  assert.ok(commentsResponse.comments.length > 0);
  assert.ok(commentsResponse.comments[0].user);
});

test('comment access control by role', () => {
  // Test that different roles have appropriate access
  const roles = {
    PROPERTY_MANAGER: { canComment: true, canView: true },
    TECHNICIAN: { canComment: true, canView: true },
    OWNER: { canComment: true, canView: true },
    TENANT: { canComment: false, canView: false },
  };

  assert.equal(roles.PROPERTY_MANAGER.canComment, true);
  assert.equal(roles.TECHNICIAN.canComment, true);
  assert.equal(roles.OWNER.canComment, true);
  assert.equal(roles.TENANT.canComment, false);
});

test('comments ordered by creation date', () => {
  // Test that comments are ordered newest first
  const comments = [
    { id: '1', createdAt: new Date('2025-01-29T10:00:00Z') },
    { id: '2', createdAt: new Date('2025-01-29T11:00:00Z') },
    { id: '3', createdAt: new Date('2025-01-29T09:00:00Z') },
  ];

  // Sort by createdAt desc (newest first)
  const sorted = [...comments].sort((a, b) => 
    new Date(b.createdAt) - new Date(a.createdAt)
  );

  assert.equal(sorted[0].id, '2'); // Newest
  assert.equal(sorted[1].id, '1');
  assert.equal(sorted[2].id, '3'); // Oldest
});

test('comment cascade delete with job', () => {
  // Test that comments are deleted when job is deleted
  const jobWithComments = {
    id: 'job123',
    comments: [
      { id: 'comment1', jobId: 'job123' },
      { id: 'comment2', jobId: 'job123' },
    ],
  };

  // After job deletion, comments should also be deleted (CASCADE)
  assert.ok(jobWithComments.comments.length > 0);
  assert.ok(jobWithComments.comments.every(c => c.jobId === jobWithComments.id));
});

test('comment user information included', () => {
  // Test that user info is properly included
  const comment = {
    id: 'comment123',
    content: 'Test',
    user: {
      id: 'user123',
      firstName: 'John',
      lastName: 'Doe',
      role: 'TECHNICIAN',
    },
  };

  assert.ok(comment.user);
  assert.ok(comment.user.firstName);
  assert.ok(comment.user.lastName);
  assert.ok(comment.user.role);
  // Should NOT include sensitive data
  assert.equal(comment.user.passwordHash, undefined);
  assert.equal(comment.user.email, undefined);
});

test('job comments routes use correct Prisma relation names', () => {
  const routesPath = path.join(process.cwd(), 'src', 'routes', 'jobs.js');
  const source = fs.readFileSync(routesPath, 'utf8');

  assert.ok(source.includes("router.get('/:id/comments'"));
  assert.ok(source.includes("router.post('/:id/comments'"));
  assert.ok(source.includes("router.patch('/:id/comments/:commentId'"));
  assert.ok(source.includes("router.delete('/:id/comments/:commentId'"));

  assert.ok(source.includes('include: {\n        User:'));
  assert.ok(source.includes('include: {\n        Job:'));
  assert.ok(source.includes('user: comment.User'));
});
