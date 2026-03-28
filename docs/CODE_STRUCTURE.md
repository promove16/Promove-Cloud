# ProMove Code Structure

This document is a navigation index for the repo. It focuses on the active TypeScript/React implementation, plus the docs, test assets, and legacy areas that still matter when working in the tree.

## Repo-Level Map
- `README.md`: top-level project summary and quick entry point.
- `Dockerfile`: multi-stage build that produces the single-image runtime with server plus built client.
- `docker-compose.yml`: local two-service setup for `Server/` and `Client/`.
- `.env.example`: backend environment template and required runtime secrets.
- `.gitignore`: ignores generated, backup, and working directories such as `temp/`, `docs/`, `postman/`, and `.postman/`.
- `ProMove.code-workspace`: VS Code workspace definition.
- `Client/`: React + Vite frontend package.
- `Server/`: Express + TypeScript backend package.
- `docs/`: written product, architecture, and reference material.
- `postman/`: source Postman collection and environment definitions.
- `scripts/manual-tests/`: ad hoc API smoke scripts.
- `temp/`: generated exports, Newman output, backups, and scratch artifacts.
- `.github/workflows/`: CI definitions for client and server checks.

## Backend Source Map

### `Server/src/` bootstrap and runtime
- `server.ts`: bootstraps Mongo, seeds initial data, starts Socket.IO, and launches workers.
- `app.ts`: builds the Express app, mounts routers, exposes health checks, and serves the built client when present.

### `Server/src/config/`
- `env.ts`: validates environment variables and normalizes secrets.
- `db.ts`: MongoDB connection lifecycle with retry logic and connection logging.
- `redis.ts`: Upstash Redis client used for caching and ephemeral state.
- `bullmq.ts`: queue abstraction with local fallback behavior when Redis credentials are incomplete.
- `socket.ts`: Socket.IO server setup and namespace registration.
- `logger.ts`: Winston logger and HTTP log stream.

### `Server/src/middleware/`
- `authenticate.ts`: verifies JWT access tokens and attaches the current user.
- `authorize.ts`: role-based access control middleware.
- `connectionGuard.ts`: scoped access checks for institution-linked resources.
- `relevanceGuard.ts`: recruiter contact and relevance gating.
- `rateLimiter.ts`: API rate limiting helpers.
- `errorHandler.ts`: central API error normalization and response shaping.

### `Server/src/services/`
- `cloudinaryService.ts`: uploads files and assets to Cloudinary.
- `complianceReport.ts`: generates compliance reports as PDFs and stores them.
- `emailService.ts`: sends transactional email notifications.
- `scoreEngine.ts`: computes and applies innovation score changes.

### `Server/src/jobs/`
- `notificationWorker.ts`: consumes notification jobs and persists/dispatches them.
- `scoreRecalcWorker.ts`: recalculates score-related state from queue jobs.

### `Server/src/workers/`
- `institutionVerifyWorker.ts`: resolves institution token verification and links students to institutions.

### `Server/src/sockets/`
- `auth.ts`: socket auth helpers.
- `chatSocket.ts`: workspace chat namespace and membership handling.
- `mentorSocket.ts`: mentor activity namespace.
- `notificationSocket.ts`: notification delivery namespace.
- `scoreSocket.ts`: score update namespace.

### `Server/src/types/`
- `api.types.ts`: shared API envelope and response types.
- `express.d.ts`: Express request typing augmentation.
- `roles.types.ts`: canonical role enum and role list.

### `Server/src/utils/`
- `ApiError.ts`: structured error type used across services and controllers.
- `ApiResponse.ts`: standard success response wrapper.
- `asyncHandler.ts`: async route wrapper.
- `redisJson.ts`: JSON parsing helpers for Redis payloads.
- `sanitizeText.ts`: input text sanitation helpers.
- `emailService.js`, `pagination.js`, `projectAccess.js`, `slugify.js`, `tokenUtils.js`, `validate.js`: legacy utility helpers retained in-tree.

### `Server/src/modules/auth/`
- `auth.controller.ts`: register, login, refresh, logout, and institution-token submission endpoints.
- `auth.routes.ts`: auth route wiring.
- `auth.schema.ts`: Zod schemas for auth payloads.
- `auth.service.ts`: auth workflow, token issuance, and registration logic.

### `Server/src/modules/user/`
- `user.controller.ts`: current-user endpoints and profile operations.
- `user.model.ts`: main user schema and embedded profile structures.
- `user.routes.ts`: user route wiring.
- `user.service.ts`: profile read/update, enrichment, and user-state logic.
- `user.types.ts`: user DTO and profile types.

### `Server/src/modules/innovationScore/`
- `score.controller.ts`: score read and score-history endpoints.
- `score.model.ts`: score event persistence model.
- `score.routes.ts`: score route wiring.
- `score.types.ts`: score DTO definitions.

### `Server/src/modules/problemBank/`
- `problem.controller.ts`: list/get/claim problem endpoints.
- `problem.model.ts`: problem bank schema.
- `problem.routes.ts`: problem route wiring.
- `problem.service.ts`: problem seed, listing, and claim logic.
- `problem.types.ts`: problem DTO definitions.

### `Server/src/modules/workspace/`
- `workspace.controller.ts`: workspace CRUD, progress, invites, tasks, uploads, and chat access.
- `workspace.model.ts`: workspace schema with tasks, uploads, milestones, and updates.
- `workspace.routes.ts`: workspace route wiring.
- `workspace.service.ts`: workspace business logic and validation.
- `workspace.types.ts`: workspace DTO and stage types.

### `Server/src/modules/chat/`
- `chat.controller.ts`: workspace chat fetch/send endpoints.
- `chat.model.ts`: chat message persistence model.
- `chat.routes.ts`: chat route wiring.
- `chat.types.ts`: chat DTO definitions.

### `Server/src/modules/patent/`
- `patent.controller.ts`: patent submission and retrieval endpoints.
- `patent.model.ts`: patent submission schema.
- `patent.routes.ts`: patent route wiring.
- `patent.service.ts`: patent submission and review support.
- `patent.types.ts`: patent DTO definitions.

### `Server/src/modules/startup/`
- `startup.controller.ts`: startup create, update, launch, and pitch upload endpoints.
- `startup.model.ts`: startup schema and launch flags.
- `startup.routes.ts`: startup route wiring.
- `startup.service.ts`: startup lifecycle business logic.
- `startup.types.ts`: startup DTO definitions.

### `Server/src/modules/deal/`
- `deal.controller.ts`: deal listing, detail, stage transition, and cap-table endpoints.
- `deal.model.ts`: deal schema and current-stage persistence.
- `deal.routes.ts`: deal route wiring plus startup-investment route aliasing.
- `deal.service.ts`: investment creation, stage transitions, portfolio, authority, and cap-table logic.
- `deal.types.ts`: deal and investment DTO definitions.
- `investment.model.ts`: investment schema and indexes.
- `investment.service.ts`: investment-specific service helpers and stage orchestration.
- `investment.types.ts`: investment DTO and stage types.

### `Server/src/modules/investor/`
- `investor.controller.ts`: investor dashboard, discovery, deal stage, and portfolio endpoints.
- `investor.routes.ts`: investor route wiring.
- `investor.service.ts`: investor-facing business logic and access checks.
- `investor.types.ts`: investor DTO definitions.

### `Server/src/modules/marketplace/`
- `marketplace.controller.ts`: public profile list/detail endpoints.
- `marketplace.routes.ts`: marketplace route wiring.
- `marketplace.service.ts`: role-scoped public profile discovery and access checks.

### `Server/src/modules/notification/`
- `notification.controller.ts`: notification list/read endpoints.
- `notification.model.ts`: notification persistence model.
- `notification.routes.ts`: notification route wiring.
- `notification.service.ts`: notification creation and query helpers.
- `notification.types.ts`: notification DTO definitions.

### `Server/src/modules/recruiter/`
- `recruiter.controller.ts`: recruiter dashboard, talent, jobs, drives, and onboarding endpoints.
- `recruiter.routes.ts`: recruiter route wiring.
- `recruiter.service.ts`: recruiter-facing orchestration and shared helpers.
- `recruiter.job.service.ts`: job posting and application logic.
- `recruiter.drive.service.ts`: campus drive creation, registration, scoring, and close flows.
- `recruiter.talent.service.ts`: talent pipeline and discovery logic.
- `recruiter.mappers.ts`: converts domain data into recruiter DTOs.
- `recruiter.schemas.ts`: Zod validation schemas for recruiter payloads.
- `recruiter.types.ts`: recruiter DTO definitions.
- `jobPost.model.ts`: recruiter job schema.
- `campusDrive.model.ts`: recruiter drive schema.
- `relevanceBridge.model.ts`: recruiter contact gate and relevance bridge model.

### `Server/src/modules/mentor/`
- `mentor.controller.ts`: mentor dashboard, student, session, and feedback endpoints.
- `mentor.routes.ts`: mentor route wiring.
- `mentor.service.ts`: mentor workflow logic and student access control.
- `mentor.types.ts`: mentor DTO definitions.
- `mentor.validation.ts`: mentor payload validation.
- `mentorSession.model.ts`: mentor session persistence model.
- `mentorFeedback.model.ts`: mentor feedback persistence model.

### `Server/src/modules/school/`
- `school.controller.ts`: school dashboard, leaderboard, investors, compliance, and verification endpoints.
- `school.routes.ts`: school route wiring.
- `school.service.ts`: school-level dashboards, reports, tokens, and verification logic.
- `school.types.ts`: school DTO definitions.

### `Server/src/modules/college/`
- `college.controller.ts`: college dashboard, placement, events, compliance, and verification endpoints.
- `college.routes.ts`: college route wiring.
- `college.service.ts`: college-level dashboards, placement tracker, event access, and verification logic.
- `college.types.ts`: college DTO definitions.
- `placementRecord.model.ts`: placement tracker persistence model.

### `Server/src/modules/event/`
- `event.controller.ts`: event join, submission-score, ranking compute, and ranking read endpoints.
- `event.routes.ts`: event route wiring.
- `event.service.ts`: event creation, participant management, scoring, and ranking computation.
- `event.model.ts`: event schema with participants and rankings.
- `event.types.ts`: event DTO and participant/ranking view types.

### `Server/src/modules/admin/`
- `admin.controller.ts`: admin user, patent, award, deal, milestone, and analytics endpoints.
- `admin.routes.ts`: admin route wiring.
- `admin.service.ts`: admin review, audit, approvals, capacity, and analytics logic.
- `admin.types.ts`: admin DTO definitions.
- `admin.validation.ts`: admin payload validation.
- `adminAuditLog.model.ts`: admin audit trail persistence.
- `award.model.ts`: award submission persistence.

### `Server/src/modules/institution/`
- `institutionAccess.service.ts`: student access-token creation, verification queueing, and review workflows.
- `studentAccessToken.model.ts`: access-token persistence model.
- `complianceReport.model.ts`: institution compliance report model.

### Legacy backend modules not mounted by `app.ts`
- `Server/src/modules/board/*.js`: legacy board workflow.
- `Server/src/modules/project/*.js`: legacy project workflow.
- `Server/src/modules/sprint/*.js`: legacy sprint workflow.
- `Server/src/modules/student/*.js`: legacy student workflow.
- `Server/src/modules/team/*.js`: legacy team workflow.
- `Server/src/modules/ticket/*.js`: legacy ticket workflow.
- `Server/src/modules/upload/*.js`: legacy upload workflow.

## Frontend Source Map

### `Client/src/` boot and core wiring
- `main.tsx`: React bootstrap and `QueryClientProvider` setup.
- `app/App.tsx`: top-level app shell and `AuthProvider` wrapper.
- `pages/index.tsx`: active browser router and role-based route tree.
- `store/authStore.ts`: persisted auth state and session bootstrap.
- `api/axiosInstance.ts`: axios client, token injection, and refresh retry logic.
- `lib/socket.ts`: socket client factory for score, chat, notification, and mentor channels.
- `utils/roleRedirect.ts`: post-login route selection by role.

### `Client/src/api/`
- `admin.api.ts`: admin dashboard and moderation endpoints.
- `axiosInstance.ts`: shared axios client and refresh handling.
- `chat.api.ts`: workspace chat fetch helper.
- `college.api.ts`: college dashboard, placement, event, token, and verification endpoints.
- `deal.api.ts`: student and investor deal APIs.
- `event.api.ts`: event join, submission score, and ranking APIs.
- `investor.api.ts`: investor dashboard, discovery, interest, and portfolio APIs.
- `marketplace.api.ts`: public profile list/detail APIs.
- `mentor.api.ts`: mentor dashboard, sessions, feedback, and student profile APIs.
- `notification.api.ts`: notification list and read APIs.
- `patent.api.ts`: patent submit and history APIs.
- `problemBank.api.ts`: problem bank list/get/claim APIs.
- `recruiter.api.ts`: recruiter dashboard, talent, jobs, drives, and onboarding APIs.
- `school.api.ts`: school dashboard, investor directory, tokens, and verification APIs.
- `score.api.ts`: score summary and score history APIs.
- `startup.api.ts`: startup create, update, launch, upload, and cap table APIs.
- `student.api.ts`: student-facing profile/session/launch helpers.
- `user.api.ts`: current-user profile and enrichment APIs.
- `workspace.api.ts`: workspace CRUD, tasks, uploads, invites, members, and chat APIs.

### `Client/src/features/auth/`
- `LoginPage.tsx`: login screen and auth mutation wiring.
- `SignupPage.tsx`: multi-role registration flow.
- `RoleSelector.tsx`: role selection UI used by signup.
- `useAuth.ts`: auth mutation hooks and session bootstrap helpers.

### `Client/src/features/school/`
- `Dashboard.tsx`: school overview, tokens, and verification dashboard.
- `StudentLeaderboard.tsx`: school student ranking view.
- `StudentJourneyDrawer.tsx`: student detail drawer for school context.
- `InvestorDirectory.tsx`: school-visible investor list.
- `ComplianceReport.tsx`: school compliance report screen.

### `Client/src/features/college/`
- `Dashboard.tsx`: college overview and student/program summary dashboard.
- `StudentLeaderboard.tsx`: college student ranking view.
- `StudentJourneyDrawer.tsx`: college student detail drawer.
- `InvestorDirectory.tsx`: college-visible investor list.
- `RecruiterDirectory.tsx`: recruiter directory for college users.
- `PlacementTracker.tsx`: placement KPI tracker and table view.
- `PlacementStatusTable.tsx`: placement status table and search/filter UI.
- `HiringPartnersList.tsx`: hiring partner summary list.
- `EventManager.tsx`: event creation, ranking, and submission-score management.
- `ComplianceReport.tsx`: college compliance report screen.

### `Client/src/features/mentor/`
- `Dashboard.tsx`: mentor overview and activity feed.
- `StudentFeed.tsx`: mentor student discovery feed.
- `StudentProfileDrawer.tsx`: mentor student profile drawer.
- `Sessions.tsx`: mentor session scheduling and management.

### `Client/src/features/investor/`
- `Dashboard.tsx`: investor dashboard and deal overview.
- `StartupMarketplace.tsx`: startup discovery and interest initiation.
- `StartupDetailDrawer.tsx`: startup profile drawer and express-interest form.
- `DealDetail.tsx`: deal stage progression screen.
- `Institutions.tsx`: institution browsing for investors.
- `Portfolio.tsx`: investor portfolio and closed deals.

### `Client/src/features/recruiter/`
- `Dashboard.tsx`: recruiter dashboard, job creation, drive creation, and shortlisting.
- `TalentSearch.tsx`: recruiter search UI for talent discovery.
- `StudentProfileDrawer.tsx`: recruiter student profile drawer.
- `ActiveDrives.tsx`: active campus drive management.
- `CollegeConnect.tsx`: recruiter-to-college connection screen.
- `OnboardingTracker.tsx`: recruiter placement onboarding tracker.

### `Client/src/features/admin/`
- `Dashboard.tsx`: admin landing dashboard.
- `UserManagement.tsx`: user role and access management.
- `Patents.tsx`: patent moderation queue.
- `Awards.tsx`: award moderation queue.
- `Deals.tsx`: deal approval queue.
- `Analytics.tsx`: admin analytics screen.
- `Capacity.tsx`: admin capacity and export screen.

### `Client/src/features/profile/`
- `UserProfilePage.tsx`: self-service profile editing and enrichment.

### `Client/src/features/startup/`
- `CapTable.tsx`: startup cap table view for student founders.

### `Client/src/features/student/`
- `Marketplace.tsx`: student marketplace for mentors, investors, and recruiters.

### `Client/src/features/institution/`
- `InvestorDirectoryBase.tsx`: shared investor directory renderer.
- `LeaderboardPageBase.tsx`: shared leaderboard renderer for school/college screens.
- `MentorDirectory.tsx`: shared mentor directory view.
- `StudentJourneyDrawerBase.tsx`: shared student journey drawer used by institution screens.

### `Client/src/components/layouts/`
- `AuthLayout.tsx`: auth page layout shell.
- `DashboardLayout.tsx`: authenticated sidebar/topbar shell.

### `Client/src/components/ui/`
- `Badge.tsx`: active badge wrapper.
- `Button.tsx`: active button wrapper.
- `Card.tsx`: active card wrapper.
- `Input.tsx`: active input wrapper.
- `Spinner.tsx`: active loading indicator.

### `Client/src/app/`
- `App.tsx`: app shell that wires router and auth context.
- `context/AuthContext.tsx`: login/signup/logout context bridge over the auth store.
- `components/DashboardLayout.tsx`: legacy dashboard shell still used by some mounted routes.
- `components/ProtectedRoute.tsx`: legacy route guard helper.
- `components/figma/ImageWithFallback.tsx`: image wrapper from the design scaffold.
- `components/ui/*.tsx`: expanded Radix-style UI kit for the legacy scaffold and shared UI needs.
- `pages/Dashboard.tsx`: legacy dashboard entry page.
- `pages/Homepage.tsx`: legacy marketing/homepage view.
- `pages/Login.tsx`: legacy login page.
- `pages/Signup.tsx`: legacy signup page.
- `pages/Marketplace.tsx`: legacy marketplace page.
- `pages/ProblemBank.tsx`: legacy problem bank page.
- `pages/ProductWorkspace.tsx`: legacy workspace page.
- `pages/PatentSupport.tsx`: legacy patent workflow page.
- `pages/StartupLaunch.tsx`: legacy startup launch page.
- `pages/LeadershipProfile.tsx`: legacy leadership profile page.
- `pages/StudentDashboard.tsx`: legacy student dashboard page.
- `pages/SchoolDashboard.tsx`: legacy school dashboard page.
- `pages/IdeaStudio.tsx`: legacy ideation page.
- `pages/InnovationPassport.tsx`: legacy innovation history page.
- `pages/dashboards/AdminDashboard.tsx`: legacy admin dashboard.
- `pages/dashboards/InvestorDashboard.tsx`: legacy investor dashboard.
- `pages/dashboards/MentorDashboard.tsx`: legacy mentor dashboard.
- `pages/dashboards/RecruiterDashboard.tsx`: legacy recruiter dashboard.
- `pages/dashboards/SchoolDashboard.tsx`: legacy school dashboard variant.
- `pages/dashboards/StudentDashboard.tsx`: legacy student dashboard variant.
- `routes.tsx`: legacy router tree that predates the current `src/pages/index.tsx` router.

### `Client/src/hooks/`
- `useInnovationScore.ts`: score polling and derived-score hook.
- `useNotifications.ts`: notification polling and live socket sync.
- `useProtectedRoute.ts`: role-aware route authorization helper.
- `useSocket.ts`: generic socket lifecycle helper.
- `useWorkspaceChat.ts`: workspace chat bootstrap and live message sync.

### `Client/src/types/`
- `auth.types.ts`: auth payload and response types.
- `college.types.ts`: college dashboard, event, placement, and verification DTOs.
- `deal.types.ts`: deal and investment DTOs.
- `investor.types.ts`: investor dashboard and discovery DTOs.
- `notification.types.ts`: notification DTOs.
- `patent.types.ts`: patent DTOs.
- `placement.types.ts`: placement DTOs.
- `problem.types.ts`: problem bank DTOs.
- `recruiter.types.ts`: recruiter dashboard, job, drive, and talent DTOs.
- `roles.types.ts`: shared role enum mirror for the client.
- `school.types.ts`: school dashboard and verification DTOs.
- `score.types.ts`: score DTOs.
- `startup.types.ts`: startup DTOs.
- `workspace.types.ts`: workspace DTOs.

### `Client/src/styles/`
- `fonts.css`: font declarations and typography tokens.
- `index.css`: global style entry.
- `tailwind.css`: Tailwind base/utilities layer.
- `theme.css`: color and visual theme variables.

## Docs, Scripts, Postman, And Testing Assets

### `docs/`
- `prd_extracted.txt`: extracted product requirement notes.
- `student-prd-extract.txt`: student-focused PRD extract.
- `docs/implementation-blueprint.md`: architecture and rollout blueprint.
- `docs/repo_analysis.md`: previous repository analysis reference.
- `docs/sprint-backlog.md`: planning backlog.
- `docs/ProMove.pdf`: exported product/spec document.
- `docs/ProMove_PRD_v2_Merged.docx`: merged PRD source.
- `docs/ProMove_MERN_Blueprint_v2.docx`: blueprint source.
- `docs/school_dashboard.png`: reference screenshot.
  Note: these files live under the nested `docs/docs/` directory in the current repo layout.

### `scripts/manual-tests/`
- `README.md`: how to run the ad hoc smoke scripts.
- `test_auth.js`, `test_auth2.js`, `test_auth3.js`, `test_auth4.js`: local auth smoke checks.
- `test_problems.js`: problem bank smoke check.

### `postman/collections/ProMove Backend API/`
- `00 System - Health.request.yaml`: health check.
- `01 Auth - *.request.yaml`: login, register, refresh, logout, and school/college token verification flows.
- `02 User - *.request.yaml`: profile and session endpoints.
- `03 Score - *.request.yaml`: score summary and history endpoints.
- `04 Problem - *.request.yaml`: problem bank endpoints.
- `05 Chat - *.request.yaml`, `05 Workspace - *.request.yaml`: chat and workspace workflows.
- `06 Patent - *.request.yaml`: patent submission and mine endpoints.
- `07 Deals - *.request.yaml`, `07 Marketplace - *.request.yaml`, `07 Notifications - *.request.yaml`, `07 Startup - *.request.yaml`: deal, marketplace, notification, and startup flows.
- `08 Investor - *.request.yaml`: investor dashboard, discovery, express interest, stage transitions, institutions, and portfolio.
- `09 Recruiter - *.request.yaml`: recruiter dashboard, talent, jobs, drives, onboarding, and messaging.
- `10 Mentor - *.request.yaml`: mentor sessions, student feed, and feedback.
- `11 School - *.request.yaml`: school dashboard, investors, tokens, verifications, and compliance.
- `12 College - *.request.yaml`: college dashboard, investors, recruiters, events, placement, tokens, verifications, and compliance.
- `13 Events - *.request.yaml`: join, score submission, compute rankings, and read rankings.
- `14 Admin - *.request.yaml`: users, patents, awards, deals, analytics, capacity, and milestone verification.

### `postman/environments/`
- `ProMove Local Backend.environment.yaml`: main local environment.
- `New Environment.environment.yaml`: generic secondary environment.
- `New Environment 1.environment.yaml`: generic secondary environment.

### `.postman/`
- `resources.yaml`: Postman Cloud resource mapping and local export references.

### `Server/tests/`
- `integration/auth.test.ts`: auth and rate-limit integration tests.
- `integration/investments.test.ts`: investor/deal flow integration tests.
- `integration/scoreEngine.test.ts`: score engine integration tests.
- `setup.ts`: test environment bootstrap and mocks.
- `jest.config.js`: Jest configuration.

### `temp/` generated assets
- `ProMove Backend API.postman_collection.json`: exported Postman collection used for Newman.
- `ProMove.postman_environment.json`: exported Postman environment used for Newman.
- `newman-run-latest.json` and related `newman-run-*.json`: generated Newman reports.
- `retest-*.json`: generated retest collections.
- `browser-test.*`, `student-role-*`, `root-artifacts/`, `student-audit-artifacts/`: local audit and browser-check artifacts.
- `js-with-ts-backup-*`, `safe-sync-backup-*`: backup snapshots.
- `fix_types.js`, `fix-script-types.js`, `generate_collection.js`: helper scripts used to patch or export generated artifacts.

## Legacy, Backup, And Generated Areas

- `Server/src/models/*.js`: older JS-era models that are still present but not part of the active TypeScript app.
- `Server/src/modules/board/*.js`, `project/*.js`, `sprint/*.js`, `student/*.js`, `team/*.js`, `ticket/*.js`, `upload/*.js`: legacy workflow modules kept for reference.
- `Server/src/tests/*.js`: legacy test files that are not part of the active Jest suite.
- `Client/src/app/*`: older app scaffold with a separate router, dashboard shell, pages, and large UI kit.
- `temp/`: derived and scratch content only, not canonical source.
- `docs/docs/`: rich reference docs and exports, useful for context but not authoritative runtime source.

## Canonical Source Notes
- Active backend source lives in `Server/src/` TypeScript modules mounted from `app.ts`.
- Active frontend source lives in `Client/src/pages`, `Client/src/features`, `Client/src/components`, `Client/src/hooks`, and `Client/src/api`.
- Generated JSON exports, backups, and Newman artifacts in `temp/` should be treated as derived outputs.
- The repo contains a real transition layer: the newer feature-based frontend and TypeScript backend are active, while legacy JS and older scaffold files remain in-tree for compatibility and reference.
