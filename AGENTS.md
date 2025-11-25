# AGENTS.md

Buildstate FM\
Agent Configuration and Operating Standards

This document defines how AI agents should operate within the Buildstate
FM repository. It establishes the consistent rules, constraints, and
best practices that govern automated code generation, architectural
changes, refactoring, testing, and documentation maintenance.

## 1. Project Overview

Buildstate FM is a full stack property management platform built with: -
Frontend: React with Vite - Backend: Node.js with Express - Database:
PostgreSQL via Prisma ORM - Hosting: - Frontend: Vercel - Backend:
Render - Database: Neon - Storage: Amazon AWS S3 for all images,
documents, attachments, and media uploads - Other services: Stripe,
Redis caching, Firebase (optional notifications)

## 2. Agent Roles

### Code Generation Agent

Implements new features using existing architecture and conventions.

### Refactoring Agent

Improves code clarity, modularity, and stability.

### Documentation Agent

Maintains and updates all documentation.

### Testing Agent

Creates tests for backend, frontend, and integrations.

## 3. General Operating Principles

-   Ask clarifying questions before assumptions.
-   Maintain existing architecture.
-   Follow coding standards.
-   Avoid unnecessary dependencies.

## 4. File System Rules

### Backend

-   Routes in src/routes
-   Utils in src/utils
-   Prisma changes require migration
-   Standard response format

### Frontend

-   Use React Query
-   Modular components
-   State remains local unless necessary

### AWS S3 Usage

-   Use AWS SDK v3
-   No hardcoded credentials
-   All uploads validated
-   Use correct bucket and region variables

## 5. Security Requirements

-   No logging secrets
-   Validate input
-   Keep Stripe and auth secure

## 6. Testing Requirements

-   Unit tests
-   Integration tests
-   Mocks for AWS, Stripe, Prisma
-   React Testing Library for UI

## 7. Documentation Requirements

-   Update docs for all changes
-   Document env variables
-   Schema changes must be explained

## 8. Environment Variables

Examples: - DATABASE_URL - AWS_ACCESS_KEY_ID - AWS_SECRET_ACCESS_KEY -
AWS_REGION - AWS_S3_BUCKET - STRIPE_SECRET_KEY - JWT_SECRET

Rules: - Never output real keys - Always document new variables

## 9. Workflow Expectations

1.  Understand context\
2.  Review structure\
3.  Ask if needed\
4.  Plan\
5.  Generate modular code\
6.  Explain changes\
7.  Add tests\
8.  Update docs\
9.  Review env requirements\
10. Provide summary

## 10. Prohibited Actions

-   Breaking auth
-   Removing security checks
-   Introducing unapproved dependencies
-   Generating incomplete code

## 11. Quality Expectations

-   Production ready
-   Maintainable
-   Secure
-   Documented
-   Tested

## 12. Versioning

Semantic versioning rules apply.

## 13. Final Notes

All agents must strictly follow these operational standards.
