# ProMove Sprint Backlog

This backlog translates the PRD into implementation epics and a practical sprint order.

## Assumptions

- Team size assumed: 3 to 5 engineers
- Sprint length: 2 weeks
- Goal: reach a secure beta before adding advanced integrations
- Estimates below are directional and should be refined during grooming

## Epic List

### E1. Platform Setup

Scope:

- `Client` and `Server` setup
- TypeScript, linting, formatting
- CI pipeline
- Env management
- Shared constants and contracts strategy

Primary stories:

- Create `Client` and `Server` root apps
- Define folder conventions for frontend and backend domains
- Set up shared enums, permission maps, and API contract typing approach
- Add Docker Compose for local dependencies
- Add base health checks and error handling

Estimated sprints: 1

### E2. Identity and Security

Scope:

- Registration
- Email verification
- Login and logout
- Refresh tokens
- Password reset
- Optional 2FA hooks

Primary stories:

- User schema and role profile schemas
- Auth controller and token service
- Refresh token rotation and revocation
- Email verification templates
- Login rate limiting
- Audit logging for auth events

Estimated sprints: 1 to 2

### E3. RBAC, Scope, and State Guards

Scope:

- Permission catalog
- Route protection
- Resource ownership checks
- Workflow state checks

Primary stories:

- Build centralized permission map
- Implement `requireAuth`, `requireRole`, `requireScope`, `requireState`
- Add test matrix for cross-role access
- Expose frontend permission helpers

Estimated sprints: 1

### E4. Student Project Core

Scope:

- Student profile
- Institution linking
- Projects
- Teams
- Portfolio basics

Primary stories:

- Create project and team schemas
- Project CRUD and team invite flow
- Student dashboard
- Public profile and portfolio endpoint
- Institution verification request flow

Estimated sprints: 1 to 2

### E5. Jira-Style Work Management

Scope:

- Boards
- Tickets
- Comments
- Attachments
- Sprints
- Burndown and velocity

Primary stories:

- Board and ticket schemas
- Status transition guards
- Ticket comments and activity feed
- Sprint planner and story point tracking
- Burndown API and UI widgets

Estimated sprints: 2

### E6. File and Asset System

Scope:

- Presigned uploads
- Asset confirmation
- File metadata
- Secure downloads

Primary stories:

- S3 upload URL service
- MIME and signature validation
- Asset metadata collection
- Download URL issuance
- Upload attachment support for projects and tickets

Estimated sprints: 1

### E7. Institution Operations

Scope:

- School rosters
- College records
- Event management
- Certificates
- Hackathons

Primary stories:

- Bulk student upload
- Approval queue for verification
- Event creation and registration
- Certificate PDF generation
- Hackathon judging rubric and result publishing

Estimated sprints: 2

### E8. Leaderboards and Achievements

Scope:

- Global and institution leaderboards
- Hackathon scores
- Daily challenge entries
- EdTech score imports
- Badges

Primary stories:

- Leaderboard entry aggregation
- Rank calculation jobs
- Badge award rules
- Student leaderboard widgets
- Admin score weight configuration

Estimated sprints: 1 to 2

### E9. Investor Pipeline

Scope:

- Project discovery
- Showcase pages
- Pitch requests
- Investor review workflow
- Meeting scheduling

Primary stories:

- Investor browse and filter APIs
- Pitch request lifecycle
- Feedback on decline
- Meeting slot booking
- Investor decision notes and portfolio watchlist

Estimated sprints: 1 to 2

### E10. Mentor Marketplace

Scope:

- Mentorship requests
- Bids
- Contract lifecycle
- Mentor ratings

Primary stories:

- Mentorship request posting
- Mentor browse and match filters
- Bid submission and comparison
- Contract activation on acceptance
- Review and rating flow

Estimated sprints: 1 to 2

### E11. Payments and Escrow

Scope:

- Stripe Connect onboarding
- Escrow initiation
- Milestone release
- Disputes
- Revenue reporting

Primary stories:

- Connected account onboarding
- Payment intent and escrow records
- Milestone release endpoint
- Webhook handling
- Admin dispute console

Estimated sprints: 1 to 2

### E12. Marketplace

Scope:

- Listings
- Enquiries
- Negotiations
- Sale state changes

Primary stories:

- Listing lifecycle
- Asset bundle visibility
- Enquiry threads
- Negotiation status updates
- Sale close flow and asset transfer

Estimated sprints: 1

### E13. HR Hiring

Scope:

- Campus drives
- Direct hiring
- Shortlisting
- Interview rounds
- Offer letters

Primary stories:

- Student search and eligibility filters
- College-approved drive flow
- Direct outreach flow
- Interview scheduling and outcomes
- Offer PDF generation

Estimated sprints: 2

### E14. Notifications and Realtime

Scope:

- In-app notifications
- Email notifications
- Socket updates

Primary stories:

- Notification schema and inbox API
- Socket event gateway
- Email trigger jobs
- Read/unread handling
- Event mappings for project, pitch, interview, and payment changes

Estimated sprints: 1

### E15. Admin and Governance

Scope:

- User moderation
- Policies
- Feature flags
- Analytics
- Audit review
- GDPR purge

Primary stories:

- Admin dashboard shell
- User suspend and impersonation
- Policy version management
- Feature flag CRUD
- Analytics summaries
- GDPR delete workflow

Estimated sprints: 1 to 2

## Suggested Sprint Sequence

### Sprint 1

- E1 Platform Setup
- E2 Identity and Security

Deliverable:

- Running web and API apps with auth skeleton

### Sprint 2

- Finish E2
- E3 RBAC, Scope, and State Guards

Deliverable:

- Secure multi-role access foundation

### Sprint 3

- E4 Student Project Core
- E6 File and Asset System

Deliverable:

- Students can create profiles, projects, teams, and upload assets

### Sprint 4

- E5 Jira-Style Work Management

Deliverable:

- Functional project board with tickets and sprint basics

### Sprint 5

- Finish E5
- Start E7 Institution Operations

Deliverable:

- Project execution flow plus student verification workflows

### Sprint 6

- Finish E7
- Start E8 Leaderboards and Achievements

Deliverable:

- School and college features with ranking foundations

### Sprint 7

- E9 Investor Pipeline
- E10 Mentor Marketplace

Deliverable:

- External engagement workflows open to students

### Sprint 8

- E11 Payments and Escrow
- E12 Marketplace

Deliverable:

- Revenue and transaction systems in sandbox mode

### Sprint 9

- E13 HR Hiring
- E14 Notifications and Realtime

Deliverable:

- Hiring funnels and live platform notifications

### Sprint 10

- E15 Admin and Governance
- Security hardening
- Observability
- Beta readiness checks

Deliverable:

- Controlled beta launch candidate

## Definition of Done

Every story should satisfy all of the following:

- Backend validation and authorization are enforced
- API contract documented
- Frontend happy path implemented
- Error states handled
- Audit logging added where required
- Automated tests included
- Monitoring hooks added for critical flows

## Test Plan by Level

### Unit

- Permission checks
- State transitions
- Score calculations
- Token services
- File validators

### Integration

- Auth flows
- Project and ticket workflows
- Pitch request lifecycle
- Mentor contract lifecycle
- Stripe webhook processing
- Hiring funnel transitions

### End-to-End

- Student registration to verified project creation
- School and college roster workflows
- Investor pitch booking
- Mentor bid acceptance and escrow
- HR campus drive to offer generation
- Admin suspension and audit review

## Major Dependencies

- AWS account for S3
- Stripe sandbox account
- SendGrid API access
- Email domain setup
- Redis for queues and socket scaling
- PDF generation strategy
- Finalized Figma or design token source

## Open Decisions

These should be resolved before implementation begins:

1. Package manager choice for `Client` and `Server`: `npm` or `pnpm`
2. TypeScript adoption across frontend and backend
3. Redis requirement from day one or introduced at notification phase
4. PDF generation library for certificates and offers
5. Search approach for student discovery: MongoDB only or external search later
6. Whether marketplace payments are beta-scope or post-launch
