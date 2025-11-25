# MONOREPO.md
Buildstate FM  
Monorepo Structure, Conventions, and Governance

This document provides an authoritative description of the Buildstate FM monorepo. It defines how the repository is organised, how components interact, and the required practices for both human developers and AI agents operating in this project.

This file reflects your actual repository layout, including the unique documentation-driven workflow you have built.

## 1. Overview
The Buildstate FM repository is a documentation-heavy monorepo containing:
- A backend application
- A frontend application
- A comprehensive collection of technical documentation
- Bug logs, fix logs, feature summaries, RBAC redesign analysis, debugging notes, deployment scripts, and verification checklists
- Agent-operation instructions and environment configuration files

## 2. Monorepo Structure (Actual)
AGENTFM-APP/
- backend/
- frontend/
- docs/
- node_modules/
- .devcontainer/
- .vercel/
- .gitignore
- .vercelignore
- Many fix logs, debug summaries, deployment scripts, and design documents
- render.yaml
- settings.json
- test-db-connection.js
- verify-build.sh

## 3. Philosophy
Documentation-FIRST  
AI-Friendly  
Separation of Concerns  
Developer Transparency  

## 4. Backend Standards
Located in backend/.  
Includes API routing, Prisma models, AWS S3 integration, auth, Redis, Stripe, error handling.

## 5. Frontend Standards
Located in frontend/.  
React + Vite app, React Query, S3 uploads, UI features, admin dashboards.

## 6. Documentation Governance
Every bug, fix, design change, and deployment issue requires its own .md log.  
Never delete old logs.  
Use descriptive filenames.  
Cross-link where needed.

## 7. Agent Interaction Rules
Agents must:
- Respect existing structure  
- Log every fix  
- Update docs when changing behaviour  
- Avoid structural changes unless instructed  

Agents must not:
- Merge or delete logs  
- Change deployments without approval  
- Modify AWS S3 config without direction  

## 8. Environment Management
Backend uses Prisma, Redis, Stripe, AWS S3 env vars.  
Frontend uses VITE_ variables for public config.  
All new env vars must be documented.

## 9. Testing Requirements
Backend: Jest, Supertest, Prisma test DB, AWS/Stripe mocks.  
Frontend: React Testing Library, MSW.

## 10. Deployment
Frontend: Vercel  
Backend: Render (render.yaml)  
Scripts: deploy-hotfix.sh, DEPLOY_NOW.sh, verify-build.sh

## 11. Phase-Based Development
PHASE_1_COMPLETE.md  
PHASE_2_COMPLETE.md  
PHASE_3_COMPLETE.md  
PHASE_4_IMPLEMENTATION.md  
PHASE_VERIFICATION_COMPLETE.md  

## 12. Future Expandability
Supports extending to microservices, mobile apps, workers, automation.

## 13. Final Notes
This MONOREPO.md is aligned with the real repository and its documentation-driven workflow.
