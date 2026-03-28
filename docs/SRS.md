# ProMove Software Requirements Specification

## 1. Introduction

### 1.1 Purpose
This document defines the current software requirements for ProMove, a role-based innovation cloud platform. It reflects the implementation that exists in this repository today, not just the original product vision.

The specification is intended for developers, testers, maintainers, and reviewers who need a single reference for:
- the system boundary
- the active frontend and backend modules
- the major user roles and their workflows
- the runtime, data, and integration dependencies
- the legacy code that still exists in the repo but is not part of the mounted application

### 1.2 Scope
ProMove is a monorepo containing:
- a React + Vite frontend
- an Express + TypeScript backend
- MongoDB persistence
- Upstash Redis caching/session support
- BullMQ-based background jobs with local fallback behavior
- Socket.IO realtime channels
- Cloudinary, AWS SES, and PDF generation integrations

The current product covers:
- student innovation workflows
- school and college verification workflows
- mentor guidance and sessions
- investor discovery and deal flow
- recruiter talent, jobs, and drive workflows
- administrative review and analytics
- marketplace-style public profile discovery

### 1.3 Definitions
- `RBAC`: role-based access control.
- `Scoped access`: access limited by institution, participant, or ownership boundaries.
- `State guard`: access controlled by workflow state, not only user role.
- `Active code`: code mounted by the running application.
- `Legacy code`: code still present in the repo but not mounted by the current application.

### 1.4 References
- `README.md`
- `docs/ARCHITECTURE_DIAGRAMS.md`
- `docs/CODE_STRUCTURE.md`
- `Server/src/app.ts`
- `Server/src/server.ts`
- `Client/src/pages/index.tsx`

## 2. Product Overview

### 2.1 Product Perspective
ProMove is a single platform for multiple actor types that all share a common user identity system. The backend is domain-modular, and the frontend is role-driven.

The current implementation uses a layered architecture:
- React SPA for presentation
- Express REST API for application logic
- MongoDB for durable domain data
- Redis for cache, queues, refresh/session state, and transient coordination
- Socket.IO for live updates

### 2.2 Stakeholders and Roles
The active system supports these user roles:
- Student
- School
- College
- Mentor
- Investor
- Recruiter
- Admin

Primary role responsibilities are:
- Student: workspaces, startups, patents, marketplace, event participation, profile growth
- School: student tokens, student verification, compliance, leaderboard oversight
- College: student tokens, student verification, placement, events, compliance
- Mentor: student guidance, sessions, feedback
- Investor: startup discovery, express interest, deal progression, portfolio tracking
- Recruiter: talent discovery, jobs, campus drives, messaging, shortlist/hire flows
- Admin: user and access control, patent and award review, deal approval, analytics, milestone verification

### 2.3 Operating Environment
The system is designed to run in these environments:
- Local development with `Client/` on Vite and `Server/` on Express
- Local two-container development through `docker-compose.yml`
- Production-style single image build through the root `Dockerfile`
- Browser-based access for the SPA

Runtime dependencies include:
- Node.js 20+
- MongoDB
- Upstash Redis
- Cloudinary
- AWS SES or Nodemailer-compatible email delivery
- JWT signing secrets/keys

### 2.4 Assumptions and Dependencies
Assumptions:
- Users authenticate through JWT-backed login and refresh flows.
- Institution verification is required for certain discovery and trust-sensitive workflows.
- Background jobs may run locally without Redis TCP access, but production behavior expects Redis-backed queues.

Dependencies:
- The server will not boot without required environment variables.
- The client expects the API base URL to be reachable.
- File uploads rely on Cloudinary.
- Notification and score workflows rely on Redis and/or BullMQ worker support.

## 3. Functional Requirements

### 3.1 Authentication and Account Lifecycle
FR-1. The system shall allow a user to register with email, password, display name, and role.

FR-2. The system shall support login with email, password, and role selection.

FR-3. The system shall issue an access token and refresh token pair for authenticated sessions.

FR-4. The system shall refresh expired access tokens using a refresh endpoint and clear the session on refresh failure.

FR-5. The system shall support logout and session invalidation.

FR-6. The system shall support role-specific registration data, including institution profiles for school and college accounts.

FR-7. The system shall support institution-token submission for student verification flows.

### 3.2 Student, Workspace, Startup, and Patent Workflows
FR-8. The system shall allow students to create and manage workspaces.

FR-9. The system shall allow workspace owners to invite members, track tasks, uploads, and progress updates.

FR-10. The system shall allow students to claim problems from the problem bank.

FR-11. The system shall allow students to submit patents and view patent history.

FR-12. The system shall allow students to create startup profiles, patch startup metadata, and upload pitch decks.

FR-13. The system shall allow students to launch a startup to investors, mentors, recruiters, or combined audiences depending on workflow selection.

FR-14. The system shall expose a cap table view for startup ownership/investment tracking.

### 3.3 School and College Workflows
FR-15. The system shall allow schools and colleges to create student access tokens.

FR-16. The system shall allow schools and colleges to list pending student verifications.

FR-17. The system shall allow schools and colleges to approve or reject pending student verifications.

FR-18. The system shall allow schools and colleges to view student leaderboards and individual student journeys.

FR-19. The system shall allow schools and colleges to access investor directories appropriate to their connection scope.

FR-20. The system shall allow schools and colleges to generate compliance reports.

FR-21. The system shall allow colleges to create events, list events, submit event scores, and compute event rankings.

FR-22. The system shall allow colleges to view placement tracking data for their student cohort.

FR-23. The system shall allow recruiter access to college placement status updates from the recruiter workflow.

### 3.4 Investor Workflows
FR-24. The system shall allow investors to browse startups using filters such as score, category, stage, and acceptance flags.

FR-25. The system shall allow investors to open detailed startup profiles.

FR-26. The system shall allow investors to express interest in a startup using the current deal creation contract.

FR-27. The system shall allow investors to progress deal stages sequentially.

FR-28. The system shall require admin verification before a deal can move from stage 3 to stage 4.

FR-29. The system shall allow investors to view investor-specific deals grouped by stage.

FR-30. The system shall allow investors to browse institution cards and portfolio data.

### 3.5 Recruiter Workflows
FR-31. The system shall allow recruiters to view dashboards, talent pipelines, and discoverable student profiles.

FR-32. The system shall allow recruiters to shortlist students and send messages when contact is permitted.

FR-33. The system shall allow recruiters to create, update, delete, and list jobs.

FR-34. The system shall allow recruiters to create campus drives and manage registrations.

FR-35. The system shall allow recruiters to submit drive scores when the drive type supports scoring.

FR-36. The system shall allow recruiters to mark students as hired in onboarding flows.

FR-37. The system shall allow recruiters to review onboarding progress and college connections.

### 3.6 Mentor Workflows
FR-38. The system shall allow mentors to view dashboards and student feeds.

FR-39. The system shall allow mentors to inspect student profiles and linked workspaces where access is authorized.

FR-40. The system shall allow mentors to create, update, delete, and list sessions.

FR-41. The system shall allow mentors to submit feedback for students.

### 3.7 Admin Workflows
FR-42. The system shall allow admins to list users, change roles, and activate or deactivate access.

FR-43. The system shall allow admins to approve or reject patents and awards.

FR-44. The system shall allow admins to approve deal stage transitions at the verification step.

FR-45. The system shall allow admins to verify milestones and update score records accordingly.

FR-46. The system shall allow admins to view analytics and capacity dashboards.

### 3.8 Notifications, Chat, and Realtime Updates
FR-47. The system shall provide notifications for relevant workflow events.

FR-48. The system shall provide workspace chat history and live messaging.

FR-49. The system shall push live score, notification, chat, and mentor activity updates over Socket.IO namespaces.

### 3.9 Public Profiles and Marketplace
FR-50. The system shall provide a marketplace directory for mentor, investor, and recruiter profiles.

FR-51. The system shall allow authorized users to view public profile details for connected marketplace roles.

### 3.10 Legacy and Non-Mounted Modules
FR-52. The repository shall retain older JS project-management modules for historical reference without treating them as part of the active mounted API.

FR-53. The documentation shall clearly identify legacy code so that maintainers do not confuse archival modules with the current runtime surface.

## 4. External Interface Requirements

### 4.1 User Interface Requirements
- The frontend shall provide a role-based SPA.
- The frontend shall redirect authenticated users to the appropriate dashboard.
- The frontend shall protect routes by role and session state.
- The frontend shall support responsive desktop and mobile rendering.

### 4.2 API Requirements
- The backend shall expose REST endpoints under `/api/*`.
- Request and response payloads shall be JSON unless the route is explicitly multipart or file-based.
- The backend shall return a stable `success`/`data` response envelope for successful requests.
- The backend shall return normalized error objects for failed requests.

### 4.3 Realtime Interface Requirements
- The server shall expose Socket.IO namespaces for score, chat, notifications, and mentor activity.
- The client shall subscribe to those namespaces where the active feature needs live updates.

### 4.4 External Service Interfaces
- MongoDB shall persist durable domain records.
- Upstash Redis shall support cache, refresh/session state, rate limit support, and queue fallback support.
- Cloudinary shall store uploaded pitch decks and workspace files.
- AWS SES or equivalent email delivery shall support invites and notifications.

## 5. Data Requirements

### 5.1 Core Data Entities
The current system relies on these major data entities:
- `User`
- `Startup`
- `Workspace`
- `Problem`
- `Patent`
- `Investment` / deal records
- `Event`
- `ChatMessage`
- `Notification`
- `MentorSession`
- `PlacementRecord`
- `StudentAccessToken`
- `ComplianceReport`
- `AdminAward`
- `AdminAuditLog`
- `ScoreEvent`
- `JobPost`
- `CampusDrive`
- `RelevanceBridge`

### 5.2 Data Relationships
- A user can have one or more role-specific behaviors, but role permissions are enforced through the auth layer.
- A student can be linked to an institution through a verification flow.
- A startup can have founder users and may be linked to investor deals.
- A workspace can contain tasks, uploads, progress updates, and a chat history.
- An event can contain participants and rankings.
- A placement record connects a student, a college, and a recruiter.

### 5.3 Data Retention and State
- Persistent data is stored in MongoDB.
- Transient data such as refresh/session pointers, cache entries, and queue coordination data may be stored in Redis.
- Derived or cached data must be treated as disposable and reconstructable from source records.

## 6. Security and RBAC Requirements

### 6.1 Authentication
- The system shall require JWT-based authentication for protected routes.
- The system shall support token refresh.
- The system shall clear stale sessions on invalid refresh or repeated unauthorized access.

### 6.2 Authorization
- The system shall apply role-based authorization at the API layer.
- The system shall apply scoped access checks for institution-linked and participant-linked resources.
- The system shall apply state-based guards for workflow transitions such as deal stage progression and verification approval.

### 6.3 Role Enforcement
- Students shall not be able to access admin, recruiter, or institution-only protected actions unless explicitly allowed.
- School and college actions shall be limited to the correct institution role.
- Investors and recruiters shall be limited to their respective talent and deal surfaces.
- Admin actions shall be limited to admin users.

### 6.4 Security Controls
- The server shall use Helmet and CORS restrictions.
- File uploads shall be validated and routed through the approved upload path.
- Sensitive environment values shall not be hard-coded into source files.
- Rate limiting shall be applied on API routes when enabled.

## 7. Non-Functional Requirements

### 7.1 Performance
- Common dashboard and list endpoints should respond within a practical interactive threshold for browser use.
- The client should load and switch role dashboards without full page reloads.

### 7.2 Reliability
- MongoDB connection attempts shall retry on startup.
- Background jobs shall degrade gracefully when Redis/BullMQ connectivity is unavailable.
- The system shall preserve important state across server restarts via persistent storage.

### 7.3 Maintainability
- Domain logic shall remain grouped by module.
- Shared DTOs and types shall be reused where possible.
- Transitional or legacy code shall be documented separately to reduce confusion.

### 7.4 Observability
- The server shall emit structured logs.
- HTTP requests shall be logged.
- Startup and worker failures shall be visible in the log stream.

### 7.5 Usability
- The UI shall remain role-aware and avoid showing unsupported actions by default.
- The UI shall expose clear labels for approvals, stage transitions, and verification states.

## 8. Deployment and Operations

### 8.1 Local Development
- Backend: `Server/` on port `5000`
- Frontend: `Client/` on port `5173`
- Local multi-container development: `docker-compose.yml`

### 8.2 Production Deployment
- The root `Dockerfile` builds the server and client in separate stages and packages them into one runtime image.
- The Express server can serve the built frontend from `public/`.

### 8.3 Runtime Operations
- The server shall initialize MongoDB before accepting traffic.
- The server shall seed the problem bank if it is empty.
- The server shall initialize Socket.IO and background workers outside test mode.
- The system shall use environment validation to fail fast on missing configuration.

### 8.4 Environment Dependencies
Required configuration includes:
- MongoDB URI
- Upstash Redis REST credentials
- BullMQ Redis host/password details where applicable
- JWT access and refresh secrets
- Client origin URL
- Cloudinary credentials
- AWS SES credentials

## 9. Testing and Acceptance Strategy

### 9.1 Automated Verification
The current project uses:
- backend Jest integration tests
- frontend TypeScript and build verification
- Postman request collections
- Newman execution reports
- manual smoke scripts in `scripts/manual-tests`

### 9.2 Acceptance Criteria
The system shall be considered functionally acceptable when:
- authentication and refresh flows succeed
- school and college token verification flows succeed
- investor express-interest and deal-stage transitions work end to end
- recruiter job, drive, shortlist, message, and hire flows work end to end
- mentor session and feedback flows work end to end
- event join, submission scoring, and ranking computation work end to end
- admin review and approval flows work end to end

### 9.3 Regression Coverage
The highest-priority regression areas are:
- role and token validation
- deal stage progression
- institution verification state
- pending verification workflows
- empty-ID and missing-state route handling
- notification and score side effects

## 10. Constraints

- The frontend is transitional: the active app uses `src/features` and `src/pages`, while `src/app/*` still exists as a partially live scaffold.
- The backend is also transitional in one area: legacy JS modules still exist under `Server/src/modules/{board,project,sprint,student,team,ticket,upload}` but are not mounted in `Server/src/app.ts`.
- The repository contains generated and scratch artifacts in `temp/`; these are not canonical source.
- Several docs and Postman resources are maintained as generated or derived assets rather than as hand-written source.
- External integrations depend on valid credentials and reachable services.

## 11. Future Extension Notes

The current implementation already covers the core innovation-cloud workflows. Likely future extensions include:
- deeper project-management functionality from the legacy JS modules
- richer institutional analytics and reporting
- more advanced mentorship and session lifecycle management
- tighter marketplace and public profile surfacing
- broader external integrations for hiring, events, and collaboration
- codebase cleanup to retire transitional frontend paths once fully replaced

## 12. Summary

ProMove is currently a role-based innovation platform with a mounted TypeScript backend and a React SPA frontend. The live system centers on user identity, institution verification, startup and deal flows, recruitment and mentorship workflows, event scoring, and administrative review. Legacy code remains in the repository, but the active product surface is defined by the mounted server modules and the feature-based client routes documented above.
