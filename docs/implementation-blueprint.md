# ProMove Implementation Blueprint

## 1. Product Summary

ProMove is a student-first innovation platform that connects 7 roles in one workflow:

`Student -> School/College verification -> Team/Project execution -> Mentor support -> Investor pitching -> HR hiring -> Admin governance`

The merged PRD defines a large product. The safest way to build it is to treat the platform as a set of bounded domains that share a common identity, authorization, file, notification, and analytics foundation.

## 2. Delivery Strategy

Build from the core spine outward:

1. Identity and authorization
2. Student project system
3. Institution workflows
4. Engagement systems
5. Transaction systems
6. Hiring workflows
7. Real-time and admin tooling

This is the lowest-risk order because almost every later feature depends on verified identity, scoped authorization, project ownership, and stable asset management.

## 3. Recommended Build Shape

### 3.1 Repo Structure

Use a simple two-folder structure:

```text
promove/
  Client/               # React + Vite + Tailwind + RTK Query
    src/
      components/
      features/
      hooks/
      layouts/
      pages/
      routes/
      services/
      store/
      utils/
  Server/               # Node.js + Express + Mongoose
    src/
      config/
      controllers/
      domains/
      jobs/
      middleware/
      models/
      routes/
      services/
      utils/
  docs/
```

Shared permission maps, enums, and API contract types should live in `Server/src` as the backend source of truth and be copied into `Client/src` only where the frontend needs them.

### 3.2 Tech Decisions

These are inferred implementation choices based on the PRD and are recommended for maintainability:

- Frontend: React, Vite, TypeScript, React Router, Redux Toolkit, RTK Query, Tailwind, Radix UI
- Backend: Node.js, Express, TypeScript, Mongoose
- Database: MongoDB
- Auth: JWT access token + refresh token rotation + RS256 keys
- Storage: AWS S3 for files, CloudFront or Cloudinary for delivery
- Real-time: Socket.IO
- Payments: Stripe Connect
- Email: SendGrid
- Monitoring: Sentry + Prometheus/Grafana
- Background jobs: BullMQ with Redis

### 3.3 Core Shared Layers

The following foundations must be centralized early:

- `auth`: login, refresh, email verification, password reset, session handling
- `rbac`: role permission map, scoped resource checks, state guards
- `audit`: security and governance event logging
- `files`: upload URL issuance, metadata records, validation policy
- `notifications`: in-app + email + websocket event fanout
- `config`: feature flags, environment settings, score weights, policy versions

## 4. Domain Breakdown

### 4.1 Platform Foundation

- Users and profiles
- Institutions
- Permission engine
- File asset registry
- Notification center
- Audit logs

### 4.2 Student Core

- Student onboarding and verification
- Public portfolio
- Team management
- Projects and showcase pages
- Jira-style board, tickets, sprints, milestones, comments

### 4.3 Institution Core

- School roster verification
- College academic records
- Events and workshops
- Hackathons and judging
- Institution leaderboards

### 4.4 Mentor System

- Mentor discovery
- Mentorship requests
- Bid comparison
- Contracts
- Milestone approvals
- Ratings and reviews

### 4.5 Investor System

- Project discovery
- Pitch requests
- Accept/decline workflow
- Meeting slot management
- Decision logging
- Portfolio watchlists

### 4.6 HR System

- Campus hiring
- Direct hiring
- Eligibility filtering
- Interview scheduling
- Offer generation
- Funnel analytics

### 4.7 Marketplace and Payments

- Project listings
- Asset bundles
- Buyer enquiries
- Negotiation threads
- Sale completion
- Mentor escrow
- Platform fees and disputes

### 4.8 Admin and Governance

- User moderation
- Policy management
- Feature flags
- Impersonation with audit
- GDPR purge
- Analytics and system health

## 5. MVP Boundary

The PRD is feature-complete, but the build should launch in slices.

### P0 Launch-Critical

- Authentication, email verification, refresh flow
- 7-role RBAC with scope and state guards
- Student onboarding and institution linking
- Student dashboard
- Project CRUD
- Team management
- Jira board with tickets, comments, status transitions
- Basic portfolio and asset upload
- School and college verification workflows
- Basic events and hackathons
- Basic investor pitch pipeline
- Basic mentor request and bid acceptance
- Campus and direct hiring skeleton
- Admin user management and audit log viewer

### P1 Revenue / Adoption

- Stripe escrow and milestone release
- Marketplace negotiation and sale closure
- Interview round pipelines
- PDF certificate and offer generation
- Real-time notifications
- Leaderboard engine with badges
- Analytics dashboards

### P2 Post-Launch

- Jira Cloud integration
- AI matching and anomaly detection
- LMS or EdTech integrations
- Marketplace escrow
- Mobile app

## 6. Recommended Architecture Rules

### 6.1 Backend

- Keep API versioned from day one: `/api/v1`
- Split routes and services by domain, not by role
- Keep all authorization server-side and centralized
- Enforce ownership and workflow state inside service layer, not only middleware
- Avoid cross-domain direct writes; use domain services or events

### 6.2 Frontend

- Route users by role after login
- Use role layouts with shared primitives
- Keep server state in RTK Query and local UI state in slices or component state
- Build domain feature folders, not giant dashboard pages
- Make notification center, uploader, and permission gates reusable

### 6.3 Data

- Use a single `users` collection plus role profile extensions
- Use append-only audit logs
- Store asset metadata separately from business entities
- Persist workflow statuses explicitly to support state guards and reporting

## 7. Non-Functional Requirements

### Security

- Argon2id password hashing
- RS256 JWT signing
- Refresh token rotation
- CSRF protection for mutating requests
- Rate limiting
- File signature validation
- Sanitized uploads
- GDPR delete workflows
- Audit logging for sensitive actions

### Reliability

- Idempotent webhook handlers for Stripe and email workflows
- Retryable background jobs
- S3 upload confirmation before asset activation
- Soft-delete where legal recovery is needed

### Performance

- Lazy-load role dashboards
- Paginate all large lists
- Precompute leaderboard aggregates
- Use indexes for role, institution, project, contract, pitch, and event lookups

## 8. Suggested Team Plan

If a small product team is available, split work like this:

- 1 frontend lead: shells, auth UX, dashboards, shared UI
- 1 backend lead: auth, RBAC, domain architecture, infrastructure
- 1 full-stack engineer: student core, institutions, events
- 1 full-stack engineer: mentor, investor, HR, marketplace
- 1 QA/security engineer part-time: test strategy, regression coverage, OWASP checks

If building solo, assume the roadmap will expand significantly and prioritize P0 and P1 only.

## 9. Delivery Roadmap

### Phase 0: Project Setup

- Initialize `Client` and `Server`, linting, formatting, TypeScript, env validation
- Stand up MongoDB, API skeleton, web shell, CI
- Define permission matrix, status enums, audit event catalog

Exit criteria:

- Web and API boot locally
- CI passes
- Shared types and permission config in place

### Phase 1: Identity and Access

- Registration, login, refresh, logout, password reset, email verification
- Base user model and role profile models
- Central RBAC middleware with scope and state guard hooks
- Role-based routing and dashboard shells

Exit criteria:

- All 7 roles can sign in
- Unauthorized access returns correct errors
- Audit logs capture sensitive auth actions

### Phase 2: Student Core

- Institution linking
- Project CRUD
- Team invites
- Board, tickets, comments, attachments
- Basic showcase and portfolio

Exit criteria:

- Students can complete an end-to-end project workflow
- Files upload safely to S3
- Project ownership and team scope checks are enforced

### Phase 3: Institutions

- School roster upload and verification queue
- College academic records and student directories
- Events, registrations, certificates
- Hackathons, judging, result publication

Exit criteria:

- Verified students unlock institution-only features
- Colleges can run hackathons and publish results

### Phase 4: Engagement and Discovery

- Leaderboards
- Badge awarding
- Investor browse and pitch workflows
- Mentor discovery and request posting

Exit criteria:

- Students can request mentor help and pitch investors
- Ranked views work globally and by institution

### Phase 5: Transactions and Hiring

- Mentor bids and contracts
- Stripe Connect onboarding and escrow
- Marketplace listings and enquiries
- Campus hiring and direct hiring
- Interviews and offer letters

Exit criteria:

- Mentor payments can be initiated and released in sandbox
- HR can complete a full hiring funnel

### Phase 6: Real-Time, Admin, Launch

- Socket.IO notifications
- Email templates and announcement system
- Super admin controls
- Analytics and monitoring
- Security hardening and load testing

Exit criteria:

- Admin can govern the platform safely
- Observability and launch checklist are complete

## 10. Highest-Risk Areas

These need early technical spikes before the main implementation:

- 3-layer authorization model
- Jira-style board state and sprint reporting
- Stripe Connect escrow flows
- File upload validation and asset lifecycle
- Leaderboard score computation rules
- Cross-role privacy boundaries for HR, investor, and institution views

## 11. Immediate Next Build Steps

The first implementation sprint should produce:

1. Monorepo scaffold and CI
2. Shared domain constants and permission matrix
3. User/profile schemas
4. Auth endpoints and refresh flow
5. Web auth screens and role-based app shell
6. Audit logging and error format standard

Once those are stable, the rest of the platform can be built as feature slices without reworking the foundation.
