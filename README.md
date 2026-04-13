# ProMove

ProMove is a comprehensive **role-based innovation cloud platform** designed to bridge the gap between students, educational institutions, mentors, investors, and recruiters. The platform facilitates student innovation workflows, startup development, patent submissions, campus placements, mentorship programs, and investment deal flow management.

## About the Project

ProMove provides a unified ecosystem where:

- **Students** can build projects, submit patents, launch startups, join events, and grow their innovation scores
- **Schools & Colleges** can verify student identities, manage rosters, track placements, and run compliance reports
- **Mentors** can guide students through sessions and provide workspace feedback
- **Investors** can discover startups, express interest, and progress deals through staged approvals
- **Recruiters** can search talent, post jobs, manage campus drives, and track hiring outcomes
- **Admins** can control access, review patents/awards, verify deals, and monitor system analytics

## Tech Stack

### Frontend (Client)
- **React 18** with TypeScript
- **Vite 5** for fast development and builds
- **React Router 6** for navigation
- **TanStack Query** for server state management
- **Zustand** for client state management
- **Axios** for HTTP requests
- **Tailwind CSS** for styling
- **Socket.IO client** for real-time updates
- **Recharts** for data visualization
- **Lucide React** for icons

### Backend (Server)
- **Node.js** with Express 5
- **TypeScript** for type safety
- **MongoDB** with Mongoose for persistence
- **Upstash Redis** for caching, sessions, and queues
- **BullMQ** for background job processing
- **Socket.IO** for real-time communication
- **JWT** access/refresh token authentication
- **Cloudinary** for file uploads
- **AWS SES / Nodemailer** for emails
- **PDFKit** for document generation
- **Zod** for validation
- **Winston** for logging
- **ExcelJS** for spreadsheet exports

## Architecture

ProMove follows a **layered monorepo architecture**:

```
┌─────────────────────────────────────────────────────────────┐
│                        ProMove                              │
├─────────────────────────────────────────────────────────────┤
│  Client/                  │  Server/                        │
│  ─────────               │  ────────                        │
│  React SPA               │  Express API                     │
│  Vite build              │  MongoDB + Mongoose             │
│  Tailwind CSS            │  Upstash Redis                   │
│  Zustand + TanStack      │  BullMQ workers                  │
│  Socket.IO client        │  Socket.IO server                │
└─────────────────────────────────────────────────────────────┘
```

- **Client**: Role-based SPA with protected routes per user type
- **Server**: Domain-modular REST API with middleware-based auth
- **Database**: MongoDB for domain data, Redis for caching/queues
- **Real-time**: Socket.IO namespaces for notifications, chat, scores

## Project Structure

```
ProMove/
├── Client/                    # React frontend application
│   ├── src/
│   │   ├── api/             # API wrappers (auth, user, startup, etc.)
│   │   ├── components/      # UI components (layouts, messaging, workspace)
│   │   ├── features/         # Role-based pages (student, mentor, investor...)
│   │   ├── hooks/            # Custom hooks (auth, socket, notifications)
│   │   ├── store/            # Zustand state management
│   │   ├── types/            # TypeScript type definitions
│   │   ├── styles/           # CSS and Tailwind themes
│   │   └── utils/            # Utilities and helpers
│   └── package.json
│
├── Server/                   # Express backend application
│   ├── src/
│   │   ├── config/          # Environment, DB, Redis, Socket, Logger
│   │   ├── middleware/      # Auth, authorization, rate limiting
│   │   ├── modules/         # Domain modules (auth, user, startup, etc.)
│   │   ├── services/        # Business logic (email, score engine, storage)
│   │   ├── jobs/            # BullMQ workers
│   │   ├── sockets/         # Socket.IO handlers
│   │   ├── utils/           # Helpers and utilities
│   │   └── types/           # TypeScript types
│   └── package.json
│
├── docs/                    # Documentation (SRS, Architecture, etc.)
├── postman/                # API collections and environments
├── scripts/                # Development and testing scripts
└── docker-compose.yml      # Local development setup
```

## API Domains

The backend is organized into domain modules:

| Domain | Description |
|--------|-------------|
| `auth` | Registration, login, refresh tokens, logout |
| `user` | Profile management, social enrichment |
| `innovationScore` | Score tracking and history |
| `problemBank` | Problem listing and claiming |
| `workspace` | Project boards, tasks, milestones, chat |
| `patent` | Patent submission and tracking |
| `startup` | Startup creation and pitch deck uploads |
| `deal` | Investor deal flow and cap table |
| `investor` | Startup discovery, portfolio management |
| `marketplace` | Public profile discovery |
| `notification` | Real-time notifications |
| `recruiter` | Talent search, jobs, campus drives |
| `mentor` | Student guidance sessions |
| `school` | Student verification, compliance |
| `college` | Placement tracking, events |
| `event` | Event participation and scoring |
| `admin` | User management, analytics |

## User Roles

| Role | Core Features |
|------|---------------|
| **Student** | Workspace, patents, startups, marketplace, events, innovation score |
| **School** | Student verification, tokens, leaderboard, compliance |
| **College** | Student verification, placements, events, compliance |
| **Mentor** | Student feed, sessions, feedback |
| **Investor** | Startup discovery, deal stages, portfolio |
| **Recruiter** | Talent search, jobs, drives, hiring pipeline |
| **Admin** | User control, patent review, deal approval, analytics |

## Getting Started

### Prerequisites
- Node.js 20+
- MongoDB instance
- Upstash Redis account
- Cloudinary account (for uploads)
- AWS SES or SMTP for emails

### Installation

```bash
# Install root dependencies
npm install

# Install client and server
cd Client && npm install
cd ../Server && npm install
```

### Development

```bash
# Run both apps
npm run dev

# Or run separately
npm run dev:client   # Frontend on http://localhost:5173
npm run dev:server  # Backend on http://localhost:5000
```

### Docker

```bash
docker compose up --build
```

## Environment Variables

Required backend variables (see `.env.example`):
- `MONGODB_URI` - MongoDB connection string
- `UPSTASH_REDIS_*` - Redis credentials
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` - Token secrets
- `CLOUDINARY_*` - Cloudinary upload config
- `AWS_S3_*` - optional future S3 upload config
- `AWS_*` - AWS SES credentials

Frontend:
- `VITE_API_BASE_URL` - API base URL (default: `/api`)

## Documentation

- [Software Requirements Specification](docs/SRS.md)
- [Architecture Diagrams](docs/ARCHITECTURE_DIAGRAMS.md)
- [Code Structure](docs/CODE_STRUCTURE.md)
- [RBAC Roadmap](docs/RBAC_ROADMAP.md)

## License

See [LICENSE](LICENSE) and [COPYRIGHT.md](COPYRIGHT.md) for details.

## Vision

The platform is designed around a simple product idea: every user role should interact with the same trusted student identity graph, but through a role-specific workflow.

- Students build projects, claim problems, submit patents, launch startups, join events, and appear in marketplaces and hiring pipelines.
- Schools and colleges verify student identities, manage rosters, issue access tokens, review pending verifications, run compliance reporting, and host events.
- Mentors guide students through sessions and workspace access.
- Investors browse curated startups, express interest, and advance deals through staged approvals.
- Recruiters discover talent, post jobs, manage campus drives, shortlist candidates, and track hiring outcomes.
- Admins control access, review patents and awards, verify deal milestones, and monitor the system.

## Role Matrix

| Role | Core Responsibilities |
| --- | --- |
| Student | Workspace execution, startup creation, patent submission, marketplace participation, event joining, score growth |
| School | Student verification, student token management, leaderboard oversight, compliance reporting, investor directory access |
| College | Student verification, placement tracking, event management, recruiter/investor directories, compliance reporting |
| Mentor | Student feed, sessions, profile/workspace guidance, feedback |
| Investor | Startup discovery, express interest, deal stage progression, portfolio, institution browsing |
| Recruiter | Talent search, jobs, drives, messaging, shortlist/hire flows, onboarding tracker |
| Admin | User/role/access control, patent and award review, deal approvals, analytics |

## High-Level Architecture

The active application follows a layered architecture:

- React SPA on the client side.
- Express REST API on the server side.
- MongoDB for persistent business data.
- Upstash Redis for caching, sessions, queues, and transient state.
- BullMQ workers for asynchronous jobs.
- Socket.IO namespaces for live notifications, chat, mentor, and score updates.

The backend is modular by domain. The frontend is role-based and route-driven. Both sides rely on a shared auth model and common DTOs/types.

## Current Stack

### Frontend

- React 18
- Vite 5
- TypeScript
- React Router 6
- TanStack Query
- Zustand
- Axios
- Tailwind CSS
- Socket.IO client
- Radix-style UI primitives in `src/app/components/ui`

### Backend

- Node.js
- TypeScript
- Express 5
- MongoDB + Mongoose
- Upstash Redis
- BullMQ
- Socket.IO
- JWT access/refresh tokens
- Cloudinary uploads
- AWS SES / Nodemailer
- PDFKit
- Zod validation

## Monorepo Structure

- `Client/` - active frontend app
- `Server/` - active backend app
- `docs/` - product and engineering documentation source material
- `postman/` - canonical Postman request definitions and environments
- `.postman/` - Postman Cloud resource mapping
- `scripts/` - helper and smoke-test scripts
- `temp/` - generated artifacts, exports, Newman reports, backups, and scratch files
- `docker-compose.yml` - local two-container development setup
- `Dockerfile` - single-image production build that packages API and built frontend together

## Backend Domains

The active TypeScript API is mounted from `Server/src/app.ts` and booted in `Server/src/server.ts`.

Mounted domains:
- `auth` - registration, login, refresh, logout, institution-token submission
- `user` - profile read/update, social enrichment, recruiter launch, sessions
- `innovationScore` - score reads, score history, score event log
- `problemBank` - list, get, claim, seed
- `workspace` - project boards, tasks, milestones, uploads, invites, progress, chat
- `chat` - workspace chat history and messaging
- `patent` - patent submission and student patent history
- `startup` - startup create/update/launch/upload pitch deck
- `deal` - deal reads, cap table, investor deal state
- `investor` - dashboard, startup discovery, express interest, stage progression, institutions, portfolio
- `marketplace` - public profile browsing
- `notification` - notification list/read flows
- `recruiter` - talent search, jobs, drives, onboarding, messaging, shortlist/hire
- `mentor` - student feed, sessions, feedback
- `school` - student leaderboard, journeys, investors, compliance, tokens, verifications
- `college` - student leaderboard, journeys, investors, recruiters, placement, events, compliance, tokens, verifications
- `event` - join event, score submission, ranking computation, ranking retrieval
- `admin` - users, patents, awards, deals, milestone verification, analytics

Supporting but important:
- `institution` services handle access tokens, verification, and compliance helpers.
- `notification`, `startup`, `deal`, `recruiter`, `mentor`, `school`, and `college` each shape their own domain data.

Legacy backend code still present:
- Older JS modules exist under `Server/src/modules/board`, `project`, `sprint`, `student`, `team`, `ticket`, and `upload`.
- Older JS models and tests still live under `Server/src/models` and `Server/src/tests`.
- These legacy files are not mounted in `app.ts` and should be treated as archival or transitional code.

## Frontend Routes And Features

The active router is `Client/src/pages/index.tsx`.

### Public

- `/login`
- `/signup`

### Student

- `/dashboard/student`
- `/problem-bank`
- `/product-workspace/:projectId?`
- `/patent-support/:innovationId?`
- `/startup-launch/:startupId?`
- `/startup-launch/cap-table`
- `/leadership-profile`
- `/marketplace`

### School

- `/dashboard/school`
- `/dashboard/school/students`
- `/dashboard/school/students/:id`
- `/dashboard/school/investors`
- `/dashboard/school/mentors`
- `/dashboard/school/compliance`

### College

- `/dashboard/college`
- `/dashboard/college/students`
- `/dashboard/college/students/:id`
- `/dashboard/college/recruiters`
- `/dashboard/college/investors`
- `/dashboard/college/mentors`
- `/dashboard/college/placement`
- `/dashboard/college/events`
- `/dashboard/college/compliance`

### Mentor

- `/dashboard/mentor`
- `/dashboard/mentor/students`
- `/dashboard/mentor/students/:id`
- `/dashboard/mentor/sessions`

### Investor

- `/dashboard/investor`
- `/dashboard/investor/startups`
- `/dashboard/investor/institutions`
- `/dashboard/investor/portfolio`

### Recruiter

- `/dashboard/recruiter`
- `/dashboard/recruiter/talent`
- `/dashboard/recruiter/colleges`
- `/dashboard/recruiter/drives`
- `/dashboard/recruiter/onboarding`

### Admin

- `/dashboard/admin`
- `/dashboard/admin/users`
- `/dashboard/admin/patents`
- `/dashboard/admin/awards`
- `/dashboard/admin/deals`
- `/dashboard/admin/analytics`

## Frontend Structure

The active client is centered on `src/features` and `src/api`.

Important folders:
- `src/main.tsx` - React bootstrap
- `src/app/App.tsx` - app shell and router provider
- `src/pages/index.tsx` - active route tree
- `src/api/` - thin API wrappers grouped by backend domain
- `src/features/` - role/domain screens
- `src/components/` - active shared layouts and simple UI components
- `src/hooks/` - shared hooks for auth, sockets, notifications, workspace chat, and score data
- `src/store/` - Zustand auth store
- `src/types/` - shared DTOs and app types
- `src/styles/` - fonts, theme, Tailwind, and global CSS

Transitional frontend note:
- `src/features` and `src/components` are the active implementation path.
- `src/app/*` contains a legacy or alternate scaffold that is still partially used in a few student routes and shared UI primitives.
- The documentation treats `src/app/*` as transitional, not as the primary app architecture.

## Local Setup

### Start both apps from the repo root

```bash
npm run dev
```

This starts the backend from `Server/` and the frontend from `Client/` in one terminal session.
Install dependencies in both packages first:

```bash
cd Server
npm install

cd ../Client
npm install
```

### Backend

```bash
cd Server
npm install
npm run dev
```

### Frontend

```bash
cd Client
npm install
npm run dev
```

### Docker Compose

```bash
docker compose up --build
```

Local ports:
- API: `http://localhost:5000`
- Client: `http://localhost:5173`

## Environment Overview

Backend environment values are defined in `.env.example` and validated in `Server/src/config/env.ts`.

Important backend variables:
- `MONGODB_URI`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `UPSTASH_REDIS_HOST`
- `UPSTASH_REDIS_PASSWORD` optional for BullMQ TCP mode
- `BULLMQ_USE_REDIS` optional, defaults to `false` in development and `true` in production
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `CLIENT_URL`
- `CLOUDINARY_*`
- `AWS_*`
- `FROM_EMAIL`
- `RATE_LIMIT_ENABLED`

Frontend environment values:
- `VITE_API_BASE_URL` is used by `Client/src/api/axiosInstance.ts`
- If unset, the client defaults to `/api`

## Build, Test, And Run

### Root dev runner

```bash
npm run dev
```

Useful root shortcuts:
- `npm run dev` starts both Client and Server.
- `npm run dev:client` starts only the frontend.
- `npm run dev:server` starts only the backend.

### Client

```bash
cd Client
npm run build
npm run lint
npm run dev
```

### Server

```bash
cd Server
npm run build
npm run lint
npm test
npm run dev
```

### Useful server scripts

```bash
cd Server
npm run mock
npm run seed:users
npm run sync:indexes
npm run test:local
```

### API smoke and collection assets

- Canonical request definitions live in `postman/collections/ProMove Backend API/`
- Environment definitions live in `postman/environments/`
- Generated Newman exports and scratch collections live in `temp/`

## Deployment Model

There are two supported deployment styles:

- Separate dev containers through `docker-compose.yml`
- A single production image through the root `Dockerfile`

The root Dockerfile builds the server, builds the client, and copies the built frontend into the server runtime so Express can serve both API and static assets from one container.

## Testing Assets

The repository includes several layers of test assets:

- `Server/tests/` - active Jest integration tests
- `Server/src/tests/` - legacy JS tests for older modules
- `scripts/manual-tests/` - ad hoc Node smoke scripts
- `postman/collections/ProMove Backend API/` - canonical API request definitions
- `temp/newman-run-*.json` - Newman run outputs
- `temp/ProMove Backend API.postman_collection.json` - exported collection for local runs

Current test focus in the active backend:
- auth and verification flows
- investment and deal transitions
- score engine behavior

## Docs Map

- [docs/SRS.md](docs/SRS.md)
- [docs/ARCHITECTURE_DIAGRAMS.md](docs/ARCHITECTURE_DIAGRAMS.md)
- [docs/CODE_STRUCTURE.md](docs/CODE_STRUCTURE.md)
- [docs/RBAC_ROADMAP.md](docs/RBAC_ROADMAP.md)
- `docs/prd_extracted.txt`
- `docs/student-prd-extract.txt`
- `docs/docs/implementation-blueprint.md`
- `docs/docs/repo_analysis.md`
- `docs/docs/sprint-backlog.md`

## Canonical Vs Legacy

Use this distinction when reading the repository:

- Canonical source:
  - `Client/`
  - `Server/`
  - `postman/collections/.../*.request.yaml`
  - `postman/environments/ProMove Local Backend.environment.yaml`
  - root build/deploy files
- Transitional or legacy:
  - `Client/src/app/*`
  - `Server/src/modules/*.js` legacy subsystems
  - `Server/src/models/*.js`
  - `Server/src/tests/*.js`
- Generated or scratch:
  - `temp/*`
  - Newman exports
  - backup snapshots
  - audit binaries and PDFs

If you are unsure whether a file is still active, check whether it is mounted from `Server/src/app.ts` or imported from `Client/src/pages/index.tsx`.
