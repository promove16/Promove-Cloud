# ProMove QA and Manual Testing Plan

Date: 2026-03-29
Repository: ProMove
Prepared from repo analysis of `README.md`, `docs/`, `Client/`, `Server/`, `postman/`, `scripts/manual-tests/`, `temp/`, route files, and active integration tests.

## 1. Objective

This document is the manual QA runbook for the active ProMove application. It is designed as a step-by-step execution checklist so a tester can:

- set up the environment
- create or seed usable accounts and data
- execute role-based functional testing in the correct order
- capture blockers, bugs, and evidence
- fall back to Postman/API checks when the UI is blocked

## 2. Current Repo Validation Snapshot

- [ ] Backend automated baseline is green.
  Verified on 2026-03-29 with `cd Server && npm test`
  Result: 3 suites passed, 20 tests passed.
- [ ] Frontend production build baseline is green.
  Verified on 2026-03-29 with `cd Client && npm run build`
  Result: TypeScript check and Vite production build both passed.
- [ ] Manual testing should still be executed in two tracks:
  Track A: full browser/manual regression for the mounted UI routes.
  Track B: API-first validation using Postman and smoke scripts for flows that are not fully surfaced in the UI.

## 3. Active Scope and Source of Truth

Use only the mounted application for QA scope.

- Active backend source of truth: `Server/src/app.ts`
- Active frontend route tree: `Client/src/pages/index.tsx`
- Active frontend implementation: `Client/src/features/*`, `Client/src/components/*`, `Client/src/hooks/*`
- Transitional but still mounted student pages: `Client/src/app/pages/*`
- Canonical API request assets: `postman/collections/ProMove Backend API/*`
- Canonical Postman environment: `postman/environments/ProMove Local Backend.environment.yaml`
- When Postman assets disagree with the current code, treat the mounted backend routes and current frontend route tree as the source of truth.
- Current public UI signup is student-only. Non-student onboarding exists through API or seed/admin-assisted setup, not through the current signup page.

Do not spend QA time on legacy-only backend modules under:

- `Server/src/modules/board`
- `Server/src/modules/project`
- `Server/src/modules/sprint`
- `Server/src/modules/student`
- `Server/src/modules/team`
- `Server/src/modules/ticket`
- `Server/src/modules/upload`

## 4. Roles and Core Business Areas

The active product surface is organized around these roles:

- Student
- School
- College
- Mentor
- Investor
- Recruiter
- Admin

The main business areas to cover are:

- authentication and session lifecycle
- institution token and verification flows
- user profile and social enrichment
- score and score history
- problem bank and workspace execution
- chat and notifications
- patent workflow
- startup launch and cap table
- school and college oversight
- mentor sessions and feedback
- investor discovery and deal progression
- recruiter talent, jobs, drives, and onboarding
- admin approvals, governance, analytics, and capacity
- events and rankings

## 5. Environment Prerequisites

- [ ] Node.js 20+
- [ ] npm installed
- [ ] MongoDB reachable by the server
- [ ] Upstash Redis REST credentials configured
- [ ] Upstash Redis TCP host configured if BullMQ direct mode is needed
- [ ] Cloudinary credentials configured for file upload testing
- [ ] AWS SES credentials configured for email-related flows
- [ ] Chrome or Edge for browser testing
- [ ] Postman installed for API-first fallback testing

## 6. Local Environment Setup

- [ ] Copy `.env.example` to `Server/.env`
- [ ] Fill required backend variables:
  `MONGODB_URI`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `UPSTASH_REDIS_HOST`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CLIENT_URL`, `CLOUDINARY_*`, `AWS_*`, `FROM_EMAIL`
- [ ] Optional: configure `UPSTASH_REDIS_PASSWORD` if BullMQ will use direct Redis TCP mode
- [ ] Create `Client/.env.local`
  Suggested value: `VITE_API_BASE_URL=http://localhost:5000/api`
- [ ] Install backend dependencies:
  `cd Server && npm install`
- [ ] Install frontend dependencies:
  `cd Client && npm install`
- [ ] Start backend:
  `cd Server && npm run dev`
- [ ] Start frontend:
  `cd Client && npm run dev`
- [ ] Alternate local container setup:
  `docker compose up --build`

Expected local URLs:

- API: `http://localhost:5000`
- Client: `http://localhost:5173`

## 7. Seed Data and Test Accounts

Two account sources exist in the repo.

### Source A: server seed script

- [ ] Run `cd Server && npm run seed:users`
- [ ] Seeded emails:
  `student@test.com`, `school@test.com`, `college@test.com`, `mentor@test.com`, `investor@test.com`, `recruiter@test.com`, `admin@test.com`
- [ ] Seeded password for all above users:
  `Password123!`

### Source B: Postman local environment placeholders

The Postman environment includes example role accounts such as:

- `pm.school@pic.test`
- `pm.college@pic.test`
- `pm.student@pic.test`
- `pm.college.student@pic.test`
- `pm.investor@pic.test`
- `pm.recruiter@pic.test`
- `pm.mentor@pic.test`
- `pm.admin@pic.test`

Password placeholder in the environment:

- `Worker1234!`

Important note:

- [ ] The Postman environment variables are placeholders and not guaranteed to exist in MongoDB.
- [ ] Use the server seed script, direct registration, or admin/institution onboarding flows to create real data before testing.

## 8. Reusable Test Assets

- [ ] Postman request folders:
  `postman/collections/ProMove Backend API/`
- [ ] Postman environment:
  `postman/environments/ProMove Local Backend.environment.yaml`
- [ ] Exported generated collections:
  `temp/ProMove.postman_collection.json`
  `temp/ProMove.render.postman_collection.json`
  `temp/ProMove.localhost.postman_collection.json`
- [ ] Exported generated environments:
  `temp/ProMove.postman_environment.json`
  `temp/ProMove.render.postman_environment.json`
  `temp/ProMove.localhost.postman_environment.json`
- [ ] Manual smoke scripts:
  `scripts/manual-tests/test_auth.js`
  `scripts/manual-tests/test_auth2.js`
  `scripts/manual-tests/test_auth3.js`
  `scripts/manual-tests/test_auth4.js`
  `scripts/manual-tests/test_problems.js`
- [ ] Server-side local problem workflow script:
  `Server/scripts/manual/test-local.ts`
- [ ] Roster import sample:
  `temp/student-roster-import.csv`
- [ ] Automated backend references:
  `Server/tests/integration/auth.test.ts`
  `Server/tests/integration/investments.test.ts`
  `Server/tests/integration/scoreEngine.test.ts`

## 9. Recommended Execution Order

Run manual QA in this order so each later role has usable data:

1. Environment smoke and blocker check
2. Authentication and session handling
3. School and college onboarding setup
4. Student registration and student foundation flows
5. Student execution flows
6. Mentor flows
7. Investor flows
8. Recruiter flows
9. College event and placement flows
10. Admin approvals and governance
11. Shared notifications, chat, uploads, and regression checks

## 10. Global Evidence Rules

- [ ] Capture screenshot or screen recording for every failed case
- [ ] Save API response body for every 4xx or 5xx result
- [ ] Note user role, account email, environment, browser, and time
- [ ] Record created IDs when flows are chained:
  `studentId`, `workspaceId`, `startupId`, `patentId`, `dealId`, `jobId`, `driveId`, `eventId`, `notificationId`
- [ ] For every issue, record:
  summary, exact step, expected result, actual result, evidence path, severity

## 11. Phase 0 - Smoke and Blockers

- [ ] `ENV-01` API health check
  Path: `/api/health`
  Expected: HTTP 200 with `success: true`
- [ ] `ENV-02` Backend boot
  Expected: MongoDB connects, problem bank seed runs if empty, server listens on port 5000
- [ ] `ENV-03` Worker startup
  Expected: score worker, notification worker, institution verify worker start outside test mode
- [ ] `ENV-04` Frontend compile check
  Expected: `npm run build` succeeds
  Verified on 2026-03-29: passed
- [ ] `ENV-05` Frontend route smoke
  Expected: `/login` loads, protected routes redirect correctly, no blank screen

## 12. Phase 1 - Authentication and Session Lifecycle

- [ ] `AUTH-01` Student signup with valid institution token
  UI path: `/signup`
  API fallback: `POST /api/auth/register`
  Expected: account created in pending institution approval state
- [ ] `AUTH-02` Student signup without institution token
  Expected: validation error
- [ ] `AUTH-03` Student signup with invalid token
  Expected: invalid token error
- [ ] `AUTH-04` Student signup with expired token
  Expected: expired token error
- [ ] `AUTH-05` Student signup with token from wrong institution/email match conflict
  Expected: mismatch error
- [ ] `AUTH-06` Non-student registration request for school, college, mentor, investor, or recruiter
  API fallback: `POST /api/auth/register-request`
  Expected: account created as pending admin approval, no active session
- [ ] `AUTH-06A` Admin access setup
  Current repo behavior: admin is not part of public registration request schema
  Expected: use seed data or direct database setup for admin-account testing
- [ ] `AUTH-07` Login with valid credentials
  UI path: `/login`
  API fallback: `POST /api/auth/login`
  Expected: access token issued, refresh cookie set, redirect to role dashboard
- [ ] `AUTH-08` Login with wrong password
  Expected: unauthorized error
- [ ] `AUTH-09` Login while admin approval is still pending
  Expected: `ADMIN_APPROVAL_PENDING` or matching UI error state
- [ ] `AUTH-09A` Login while institution approval is still pending for a student
  Expected: `INSTITUTION_APPROVAL_PENDING` or matching UI error state
- [ ] `AUTH-10` Refresh token rotation
  API: `POST /api/auth/refresh`
  Expected: new access token, session remains valid
- [ ] `AUTH-11` Logout
  API: `POST /api/auth/logout`
  Expected: session cleared and protected routes redirect to login
- [ ] `AUTH-12` Unauthorized access without token
  Expected: 401
- [ ] `AUTH-13` Role-based access control
  Example: student hitting admin route
  Expected: 403
- [ ] `AUTH-14` Rate limiter on repeated login failures
  Expected: 429 after repeated invalid attempts

## 13. Phase 2 - Institution Setup Before Student Testing

### School setup

- [ ] `SCH-SET-01` Create a school user through `POST /api/auth/register-request` or the seed script
- [ ] `SCH-SET-02` Login as school user
- [ ] `SCH-SET-03` Create student access token
  API: `POST /api/school/student-access-tokens`
- [ ] `SCH-SET-04` Create manual roster entry
  API: `POST /api/school/student-roster/manual`
- [ ] `SCH-SET-05` Import roster via CSV if enabled in UI
- [ ] `SCH-SET-06` Create temporary student credentials
  API: `POST /api/school/student-temp-credentials`
- [ ] `SCH-SET-07` Verify that domain restrictions are enforced on temp credentials

### College setup

- [ ] `COL-SET-01` Create a college user through `POST /api/auth/register-request` or the seed script
- [ ] `COL-SET-02` Login as college user
- [ ] `COL-SET-03` Create student access token
  API: `POST /api/college/student-access-tokens`
- [ ] `COL-SET-04` Create manual roster entry
- [ ] `COL-SET-05` Import roster via CSV if enabled in UI
- [ ] `COL-SET-06` Create temporary student credentials
  API: `POST /api/college/student-temp-credentials`
- [ ] `COL-SET-07` Validate email-domain guard for temp credentials

## 14. Phase 3 - Student Foundation Flows

- [ ] `STU-01` Login as approved student
- [ ] `STU-02` Verify redirect to `/dashboard/student`
- [ ] `STU-03` Open student dashboard and confirm workspace, mentor session, and deal summaries load
- [ ] `STU-04` Open profile page `/dashboard/profile`
- [ ] `STU-05` Update profile details
  API: `PATCH /api/users/me`
- [ ] `STU-06` Trigger social enrichment from GitHub/LinkedIn links
  API: `POST /api/users/me/social-enrich`
- [ ] `STU-07` Verify score summary loads
  API: `GET /api/score/me`
- [ ] `STU-08` Verify score history loads
  API: `GET /api/score/history/:userId`

## 15. Phase 4 - Student Execution Flows

### Problem bank

- [ ] `PB-01` Open `/problem-bank`
- [ ] `PB-02` List problems
- [ ] `PB-03` Search problems
- [ ] `PB-04` Filter problems by category
- [ ] `PB-05` Open problem detail
- [ ] `PB-06` Claim a problem
  Expected: workspace/project context created or linked
- [ ] `PB-07` Attempt to claim same problem twice
  Expected: blocked
- [ ] `PB-08` Attempt to exceed workspace/problem claim limit
  Expected: blocked on fourth claim based on current smoke scripts

### Workspace and chat

- [ ] `WS-01` Open `/product-workspace/:projectId?`
- [ ] `WS-02` List my workspaces
- [ ] `WS-03` Create workspace manually if UI path is available
- [ ] `WS-04` Open workspace detail
- [ ] `WS-05` Patch workspace metadata
- [ ] `WS-06` Add task
- [ ] `WS-07` Update task status/details
- [ ] `WS-08` Delete task
- [ ] `WS-09` Add progress update
- [ ] `WS-10` Upload workspace asset
- [ ] `WS-11` Remove uploaded asset
- [ ] `WS-12` Invite member by email
- [ ] `WS-13` Remove member
- [ ] `WS-14` View workspace chat history
- [ ] `WS-15` Send chat message or attachment if enabled
- [ ] `WS-16` Confirm realtime chat updates if sockets are active

### Patent support

- [ ] `PAT-01` Open `/patent-support/:innovationId?`
- [ ] `PAT-02` Submit patent
  API: `POST /api/patents/submit`
- [ ] `PAT-03` Validate required fields and error messaging
- [ ] `PAT-04` View my submitted patents
  API: `GET /api/patents/mine`

### Startup launch and cap table

- [ ] `SU-01` Open `/startup-launch/:startupId?`
- [ ] `SU-02` Create startup
- [ ] `SU-03` Update startup details
- [ ] `SU-04` Upload pitch deck
  API: `POST /api/startup/:id/upload-pitch`
- [ ] `SU-05` Launch startup to investors
- [ ] `SU-06` Launch startup to mentors
- [ ] `SU-07` Launch startup to recruiters if exposed by the current UI/API path
- [ ] `SU-08` Open `/startup-launch/cap-table`
- [ ] `SU-09` Verify founder sees full cap table when startup has deals
- [ ] `SU-10` Verify no cap table data appears before a startup exists

### Leadership and marketplace

- [ ] `LD-01` Open `/leadership-profile`
- [ ] `LD-02` Confirm workspaces, score history, and startup snapshot appear
- [ ] `LD-03` Trigger launch-to-recruiters flow if exposed
- [ ] `MK-01` Open `/marketplace`
- [ ] `MK-02` Browse mentors, investors, recruiters
- [ ] `MK-03` Search marketplace profiles
- [ ] `MK-04` Open public profile drawer/detail
- [ ] `MK-05` View public jobs if surfaced to students
- [ ] `MK-06` Apply to a recruiter job from the student side if surfaced

## 16. Phase 5 - School Workflows

- [ ] `SCH-01` Open `/dashboard/school`
- [ ] `SCH-02` Verify dashboard metrics load
- [ ] `SCH-03` Create student access token
- [ ] `SCH-04` View student access tokens list
- [ ] `SCH-05` View roster list
- [ ] `SCH-06` Add roster entry manually
- [ ] `SCH-07` Import roster using CSV if available in UI
- [ ] `SCH-08` Create temporary student credentials
- [ ] `SCH-09` View pending verifications
- [ ] `SCH-10` Approve pending student
- [ ] `SCH-11` Reject pending student
- [ ] `SCH-12` Open `/dashboard/school/students`
- [ ] `SCH-13` Search leaderboard
- [ ] `SCH-14` Open student journey drawer `/dashboard/school/students/:id`
- [ ] `SCH-15` Open `/dashboard/school/investors`
- [ ] `SCH-16` Search and inspect investor directory
- [ ] `SCH-17` Open `/dashboard/school/mentors`
- [ ] `SCH-18` Search and inspect mentor directory
- [ ] `SCH-19` Open `/dashboard/school/compliance`
- [ ] `SCH-20` Generate compliance report
- [ ] `SCH-21` Retrieve latest compliance report
- [ ] `SCH-22` Validate generated report artifact downloads or opens

## 17. Phase 6 - College Workflows

- [ ] `COL-01` Open `/dashboard/college`
- [ ] `COL-02` Verify dashboard metrics load
- [ ] `COL-03` Create student access token
- [ ] `COL-04` View student access tokens list
- [ ] `COL-05` View roster list
- [ ] `COL-06` Add roster entry manually
- [ ] `COL-07` Import roster if available
- [ ] `COL-08` Create temporary student credentials
- [ ] `COL-09` View pending verifications
- [ ] `COL-10` Approve pending student
- [ ] `COL-11` Reject pending student
- [ ] `COL-12` Open `/dashboard/college/students`
- [ ] `COL-13` Search leaderboard
- [ ] `COL-14` Open student journey drawer `/dashboard/college/students/:id`
- [ ] `COL-15` Open `/dashboard/college/recruiters`
- [ ] `COL-16` Search recruiter directory
- [ ] `COL-17` Open `/dashboard/college/investors`
- [ ] `COL-18` Search investor directory
- [ ] `COL-19` Open `/dashboard/college/mentors`
- [ ] `COL-20` Search mentor directory
- [ ] `COL-21` Open `/dashboard/college/placement`
- [ ] `COL-22` Verify placement KPI cards load
- [ ] `COL-23` Search/filter placement rows
- [ ] `COL-24` Update placement status
- [ ] `COL-25` Open `/dashboard/college/events`
- [ ] `COL-26` Create event
- [ ] `COL-27` List events
- [ ] `COL-28` Open rankings for event
- [ ] `COL-29` Add participant submission score
- [ ] `COL-30` Compute rankings
- [ ] `COL-31` Validate rankings order and timestamps
- [ ] `COL-32` Open `/dashboard/college/compliance`
- [ ] `COL-33` Generate compliance report
- [ ] `COL-34` Retrieve latest compliance report

## 18. Phase 7 - Mentor Workflows

- [ ] `MEN-01` Open `/dashboard/mentor`
- [ ] `MEN-02` Verify dashboard metrics and recent activities load
- [ ] `MEN-03` Open `/dashboard/mentor/students`
- [ ] `MEN-04` Search students or startups
- [ ] `MEN-05` Toggle watch/unwatch if surfaced
- [ ] `MEN-06` Schedule session from student feed
- [ ] `MEN-07` Open student profile `/dashboard/mentor/students/:id`
- [ ] `MEN-08` Verify linked student profile data loads
- [ ] `MEN-09` Verify linked student workspace view loads when authorized
- [ ] `MEN-10` Submit mentor feedback
- [ ] `MEN-11` Open `/dashboard/mentor/sessions`
- [ ] `MEN-12` Create session
- [ ] `MEN-13` View session list
- [ ] `MEN-14` Open session detail
- [ ] `MEN-15` Update session time, link, notes, or status
- [ ] `MEN-16` Delete session

## 19. Phase 8 - Investor Workflows

- [ ] `INV-01` Open `/dashboard/investor`
- [ ] `INV-02` Verify dashboard summary loads
- [ ] `INV-03` Verify investor deal list loads
- [ ] `INV-04` Open `/dashboard/investor/startups`
- [ ] `INV-05` Search startups or founders
- [ ] `INV-06` Filter startups by category, stage, score, or launch flags if available
- [ ] `INV-07` Open startup detail drawer
- [ ] `INV-08` Express penny interest
- [ ] `INV-09` Express sole interest
- [ ] `INV-10` Reject penny investor choosing director role
- [ ] `INV-11` Reject investment amount below 20000 INR
- [ ] `INV-12` Reject investment when shares are insufficient
- [ ] `INV-13` Reject second sole investor for the same startup
- [ ] `INV-14` Reject penny flow that breaks collective equity cap
- [ ] `INV-15` Verify deal appears in investor deals
- [ ] `INV-16` Advance deal to stage 2
- [ ] `INV-17` Submit stage 3 approval request
- [ ] `INV-18` Confirm stage 4 remains blocked until admin approval
- [ ] `INV-19` After admin approval, advance deal to stage 4
- [ ] `INV-20` Open `/dashboard/investor/institutions`
- [ ] `INV-21` Search institution cards
- [ ] `INV-22` Validate school and college institution views
- [ ] `INV-23` Open `/dashboard/investor/portfolio`
- [ ] `INV-24` Verify portfolio list
- [ ] `INV-25` Verify portfolio authority output
- [ ] `INV-26` Verify sole director has veto authority
- [ ] `INV-27` Verify penny investor does not have veto authority
- [ ] `INV-28` Verify penny investor sees only limited cap table visibility

Note:

- `Client/src/features/investor/DealDetail.tsx` exists but no direct route is wired in `Client/src/pages/index.tsx`.
- If UI navigation does not expose all stage-transition screens, use Postman requests in folder `08 Investor - *` to complete the flow.

## 20. Phase 9 - Recruiter Workflows

- [ ] `REC-01` Open `/dashboard/recruiter`
- [ ] `REC-02` Verify dashboard overview loads
- [ ] `REC-03` Create recruiter job from dashboard
- [ ] `REC-04` Validate job form field validation
- [ ] `REC-05` Create campus drive from dashboard
- [ ] `REC-06` Validate drive form field validation
- [ ] `REC-07` Search recruiter-side candidate list
- [ ] `REC-08` Shortlist a student
- [ ] `REC-09` Remove shortlisted student
- [ ] `REC-10` Open `/dashboard/recruiter/talent`
- [ ] `REC-11` Verify talent pipeline
- [ ] `REC-12` Verify talent search
- [ ] `REC-13` Verify talent discover
- [ ] `REC-14` Open student talent profile
- [ ] `REC-15` Run message eligibility check
- [ ] `REC-16` Send message to eligible student
- [ ] `REC-17` Confirm blocked contact when relevance rules are not met
- [ ] `REC-18` Open `/dashboard/recruiter/colleges`
- [ ] `REC-19` View connected colleges
- [ ] `REC-20` Inspect college placement status data
- [ ] `REC-21` Open `/dashboard/recruiter/drives`
- [ ] `REC-22` List active drives
- [ ] `REC-23` Edit or recreate drive as supported
- [ ] `REC-24` Submit drive score for a participant
- [ ] `REC-25` Close drive
- [ ] `REC-26` Open `/dashboard/recruiter/onboarding`
- [ ] `REC-27` Verify onboarding list
- [ ] `REC-28` Mark student as hired
- [ ] `REC-29` Confirm placement or onboarding status updates appear downstream
- [ ] `REC-30` API-only validation: student applies to public job
  Endpoint: `POST /api/recruiter/jobs/:jobId/apply`
- [ ] `REC-31` API-only validation: student registers for drive
  Endpoint: `POST /api/recruiter/drives/:driveId/register`

## 21. Phase 10 - Admin Workflows

- [ ] `ADM-01` Open `/dashboard/admin`
- [ ] `ADM-02` Verify analytics summary loads
- [ ] `ADM-03` Verify capacity summary loads
- [ ] `ADM-04` Open `/dashboard/admin/users`
- [ ] `ADM-05` Search users by name or email
- [ ] `ADM-06` Change user role
- [ ] `ADM-07` Activate or deactivate user access
- [ ] `ADM-08` View pending registration requests
- [ ] `ADM-09` Approve registration request
- [ ] `ADM-10` Reject registration request with reason
- [ ] `ADM-11` Verify approved user can now log in
- [ ] `ADM-12` Verify rejected user remains blocked
- [ ] `ADM-13` Open `/dashboard/admin/patents`
- [ ] `ADM-14` Approve patent
- [ ] `ADM-15` Reject patent with reason
- [ ] `ADM-16` Open `/dashboard/admin/awards`
- [ ] `ADM-17` Approve award
- [ ] `ADM-18` Reject award with reason
- [ ] `ADM-19` Open `/dashboard/admin/deals`
- [ ] `ADM-20` View deal list
- [ ] `ADM-21` Open deal detail
- [ ] `ADM-22` Approve pending stage-3 deal
- [ ] `ADM-23` Update investor role if exposed
- [ ] `ADM-24` View startup cap table as admin
- [ ] `ADM-25` Reset sole investor if exposed
- [ ] `ADM-26` Verify milestone
- [ ] `ADM-27` Open `/dashboard/admin/analytics`
- [ ] `ADM-28` Verify charts and summary cards load
- [ ] `ADM-29` Open `/dashboard/admin/capacity`
- [ ] `ADM-30` Verify capacity metrics and export behavior

## 22. Phase 11 - Notifications, Chat, Realtime, Uploads, and Reporting

- [ ] `NTF-01` List notifications
  API: `GET /api/notifications`
- [ ] `NTF-02` Mark one notification as read
  API: `PATCH /api/notifications/:id/read`
- [ ] `NTF-03` Mark all notifications as read
  API: `PATCH /api/notifications/read-all`
- [ ] `CHAT-01` Verify chat history endpoint
  API: `GET /api/chat/workspace/:workspaceId` or workspace chat route path used by the UI
- [ ] `CHAT-02` Verify workspace chat panel shows historical messages
- [ ] `CHAT-03` Verify live message update on second client if possible
- [ ] `RTC-01` Verify score socket connection if active
- [ ] `RTC-02` Verify notification socket update if active
- [ ] `RTC-03` Verify mentor socket update if active
- [ ] `UP-01` Verify workspace file upload reaches Cloudinary-backed flow
- [ ] `UP-02` Verify startup pitch upload reaches Cloudinary-backed flow
- [ ] `PDF-01` Verify school compliance report is generated and accessible
- [ ] `PDF-02` Verify college compliance report is generated and accessible
- [ ] `MAIL-01` Verify institution invite or temp credential email side effect if email is configured

## 23. Phase 12 - Negative, Security, and Regression Cases

- [ ] `NEG-01` Missing auth token on protected route returns 401
- [ ] `NEG-02` Wrong role on protected route returns 403
- [ ] `NEG-03` Expired refresh token returns 401
- [ ] `NEG-04` Repeated invalid login eventually rate-limits
- [ ] `NEG-05` Student cannot access admin user list
- [ ] `NEG-06` Student cannot approve patents or deals
- [ ] `NEG-07` Investor cannot skip directly to stage 4 before admin approval
- [ ] `NEG-08` Student cannot create temp credentials for another user
- [ ] `NEG-09` Institution temp credentials reject wrong email domain
- [ ] `NEG-10` Duplicate problem claim is blocked
- [ ] `NEG-11` Fourth workspace/problem claim is blocked if limit remains active
- [ ] `NEG-12` Second sole investor is blocked
- [ ] `NEG-13` Penny investor cannot request director authority
- [ ] `NEG-14` Low-value investment under 20000 INR is blocked
- [ ] `NEG-15` Investment exceeding share pool is blocked
- [ ] `NEG-16` Penny collective equity cap is enforced
- [ ] `NEG-17` Unauthorized recruiter contact is blocked by relevance guard
- [ ] `NEG-18` Invalid or missing upload file is rejected cleanly
- [ ] `NEG-19` Unknown route returns normalized 404 error
- [ ] `NEG-20` API error envelope remains stable for validation and auth failures

## 24. Known Risks and Follow-Ups

- [ ] Frontend build is currently blocked by missing `Client/src/features/auth/LoginPage.tsx`
- [ ] Student flows still depend on transitional `Client/src/app/pages/*` screens and should be regression-tested carefully after auth is fixed
- [ ] Settings pages are placeholder content and should not be treated as completed functionality
- [ ] Some investor and advanced flow components exist without direct route wiring; use Postman where UI navigation does not expose the action
- [ ] Generated files in `temp/` are useful references but not canonical source

## 25. Exit Criteria

Manual QA for a release candidate should be treated as complete only when:

- [ ] all Phase 0 blocker checks are complete
- [ ] auth/session tests pass
- [ ] at least one end-to-end student -> mentor -> investor -> admin -> recruiter chain has been exercised
- [ ] school and college verification flows pass
- [ ] event creation, scoring, and ranking pass
- [ ] patent moderation and deal approval pass
- [ ] notifications, uploads, and compliance report generation pass
- [ ] all critical and high-severity defects are either fixed or explicitly accepted

## 26. Suggested Daily QA Run Subset

Use this smaller pass for quick regression after code changes:

- [ ] health check
- [ ] login
- [ ] refresh
- [ ] school token creation
- [ ] student signup with token
- [ ] problem claim
- [ ] workspace add task
- [ ] patent submit
- [ ] startup create and launch
- [ ] investor express interest
- [ ] admin approve deal stage
- [ ] recruiter shortlist or job flow
- [ ] college event ranking
- [ ] notification read

## 27. Tester Sign-Off Template

Tester:

Date:

Environment:

Build/commit:

Browsers used:

Blockers:

Critical issues:

High issues:

Medium issues:

Low issues:

Overall status:
