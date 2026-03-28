# ProMove Architecture Diagrams

This document captures the current implementation of ProMove as it exists in the repo today.

## Scope Notes

- Active backend is the TypeScript/Express application under `Server/src`.
- Active frontend is the React/Vite application under `Client/src`.
- Legacy JavaScript modules in `Server/src/modules/board`, `project`, `sprint`, `student`, `team`, `ticket`, and `upload` are archived code paths and are not part of the mounted API in `Server/src/app.ts`.
- The frontend also contains a transitional `src/app/*` tree alongside the active feature-based `src/features/*` tree.

## 1. System Context

This view shows the primary actors and the core platform services they touch.

```mermaid
flowchart LR
  Student[Student]
  School[School]
  College[College]
  Mentor[Mentor]
  Investor[Investor]
  Recruiter[Recruiter]
  Admin[Admin]

  Client[React + Vite Client]
  Server[Express + TypeScript API]
  Mongo[(MongoDB)]
  Redis[(Upstash Redis)]
  Cloudinary[(Cloudinary)]
  SES[(AWS SES / Nodemailer)]
  Socket[Socket.IO]

  Student --> Client
  School --> Client
  College --> Client
  Mentor --> Client
  Investor --> Client
  Recruiter --> Client
  Admin --> Client

  Client --> Server
  Server --> Mongo
  Server --> Redis
  Server --> Cloudinary
  Server --> SES
  Server <--> Socket
```

## 2. Container Diagram

This is the runtime decomposition used by the repo.

```mermaid
flowchart TB
  subgraph Browser["Browser / User Device"]
    UI["Client: React + Vite SPA"]
  end

  subgraph App["ProMove Application"]
    API["Server: Express API"]
    Workers["BullMQ Workers\nscore, notifications,\ninstitution verify"]
    Sockets["Socket.IO Namespaces\n/score /chat /notifications /mentor"]
  end

  subgraph Data["Data and Integrations"]
    DB[(MongoDB)]
    Cache[(Upstash Redis)]
    Media[(Cloudinary)]
    Mail[(AWS SES / Nodemailer)]
  end

  UI -->|REST /api| API
  UI -->|WebSocket| Sockets
  API --> DB
  API --> Cache
  API --> Media
  API --> Mail
  Workers --> Cache
  Workers --> DB
  Workers --> Sockets
```

## 3. Deployment Diagram

This reflects the current local compose setup and the root Docker image flow.

```mermaid
flowchart LR
  subgraph Local["Local Development"]
    LClient["Client container\nport 5173"]
    LServer["Server container\nport 5000"]
    LMongo[(MongoDB)]
    LRedis[(Redis / Upstash)]
  end

  subgraph Prod["Single Image Runtime"]
    RServer["Express server"]
    RPublic["Built React assets in /public"]
  end

  Browser["Browser"] --> LClient
  LClient --> LServer
  LServer --> LMongo
  LServer --> LRedis

  Browser --> RServer
  RServer --> RPublic
  RServer --> LMongo
  RServer --> LRedis
```

## 4. DFD Level 0

The level 0 view treats ProMove as a single platform with role-based inputs and shared platform outputs.

```mermaid
flowchart LR
  Student[Student]
  Institution[School / College]
  Investor[Investor]
  Recruiter[Recruiter]
  Mentor[Mentor]
  Admin[Admin]
  Platform[[ProMove Platform]]
  Data[(MongoDB + Redis)]
  Integrations[(Cloudinary + SES + Socket.IO)]

  Student --> Platform
  Institution --> Platform
  Investor --> Platform
  Recruiter --> Platform
  Mentor --> Platform
  Admin --> Platform

  Platform --> Data
  Platform --> Integrations
```

## 5. DFD Level 1

This breaks the platform into the active domain flows mounted in `app.ts`.

```mermaid
flowchart TB
  U[Users / Roles]

  subgraph F1["1. Identity and Access"]
    Auth["Auth, sessions, refresh tokens,\nRBAC, route guards"]
  end

  subgraph F2["2. Student Execution"]
    Problem["Problem bank"]
    Workspace["Workspace + tasks + uploads + chat"]
    Startup["Startup launch"]
    Patent["Patent submission"]
  end

  subgraph F3["3. Institution Oversight"]
    School["School dashboard\nstudent tokens + verifications"]
    College["College dashboard\nplacement + events + compliance"]
  end

  subgraph F4["4. Market and Transactions"]
    Investor["Investor dashboard\nstartups + deals + portfolio"]
    Recruiter["Recruiter dashboard\njobs + drives + onboarding"]
    Mentor["Mentor dashboard\nsessions + feedback"]
    Marketplace["Marketplace directory"]
  end

  subgraph F5["5. Operations"]
    Score["Score engine"]
    Notify["Notifications"]
    Jobs["BullMQ workers"]
    Admin["Admin review and governance"]
  end

  U --> Auth
  U --> Problem
  U --> Workspace
  U --> Startup
  U --> Patent
  U --> School
  U --> College
  U --> Investor
  U --> Recruiter
  U --> Mentor
  U --> Marketplace
  U --> Admin

  Auth --> Score
  Workspace --> Notify
  Startup --> Investor
  College --> Recruiter
  School --> Marketplace
  Investor --> Jobs
  Mentor --> Jobs
```

## 6. ER Diagram

This ER-style view focuses on the current persisted entities and their main relationships.

```mermaid
erDiagram
  USER {
    string _id
    string role
    string email
    string displayName
    string institutionId
    number innovationScore
  }

  STARTUP {
    string _id
    string name
    boolean launchedToInvestors
    number innovationScoreAtLaunch
  }

  WORKSPACE {
    string _id
    string ownerId
    string claimedProblemId
    string stage
  }

  PATENT {
    string _id
    string studentId
    string status
  }

  DEAL {
    string _id
    string startupId
    string studentId
    string investorId
    number stage
  }

  EVENT {
    string _id
    string institutionId
    string title
    string type
  }

  CHAT_MESSAGE {
    string _id
    string workspaceId
    string senderId
  }

  NOTIFICATION {
    string _id
    string userId
    string type
  }

  STUDENT_ACCESS_TOKEN {
    string _id
    string institutionId
    string token
  }

  COMPLIANCE_REPORT {
    string _id
    string institutionId
    string institutionType
  }

  MENTOR_SESSION {
    string _id
    string mentorId
    string studentId
  }

  PLACEMENT_RECORD {
    string _id
    string studentId
    string collegeId
    string recruiterId
    string status
  }

  USER ||--o{ STARTUP : founders
  USER ||--o{ WORKSPACE : owns
  USER ||--o{ PATENT : submits
  USER ||--o{ DEAL : investor_or_student
  USER ||--o{ EVENT : creates_or_joins
  USER ||--o{ CHAT_MESSAGE : sends
  USER ||--o{ NOTIFICATION : receives
  USER ||--o{ STUDENT_ACCESS_TOKEN : requests
  USER ||--o{ COMPLIANCE_REPORT : owns
  USER ||--o{ MENTOR_SESSION : participates
  USER ||--o{ PLACEMENT_RECORD : appears_in
  STARTUP ||--o{ DEAL : has
  WORKSPACE ||--o{ CHAT_MESSAGE : contains
  EVENT ||--o{ USER : participant_links
  COMPLIANCE_REPORT ||--o{ USER : belongs_to
```

## 7. Auth Sequence

```mermaid
sequenceDiagram
  participant User as User
  participant Client as React Client
  participant API as Express API
  participant DB as MongoDB
  participant Redis as Redis

  User->>Client: Enter credentials and role
  Client->>API: POST /api/auth/login
  API->>DB: Validate user and role
  API->>Redis: Store refresh/session state
  API-->>Client: Access token + user payload
  Client->>Client: Store auth state in Zustand
  Client->>API: Subsequent requests with Bearer token
  API-->>Client: 401 if expired
  Client->>API: POST /api/auth/refresh
  API->>Redis: Validate refresh token
  API-->>Client: New access token
```

## 8. Investor Deal Flow

```mermaid
sequenceDiagram
  participant Investor as Investor
  participant Client as Investor UI
  participant API as Investor API
  participant Deal as Deal Service
  participant Startup as Startup Store
  participant Admin as Admin Review

  Investor->>Client: Open startup detail
  Client->>API: POST /api/investor/express-interest/:startupId
  API->>Deal: createInvestorDealFromInterest
  Deal->>Startup: Validate launch state and terms
  Deal->>Deal: Create deal at stage 1
  Deal-->>Client: Deal detail and dealId

  Investor->>Client: Advance to stage 2
  Client->>API: PATCH /api/investor/deals/:dealId/stage
  API->>Deal: record fund transfer
  Deal-->>Client: Stage 2 result

  Investor->>Client: Submit stage 3 terms
  Client->>API: PATCH /api/investor/deals/:dealId/stage
  API->>Deal: validate equity and authority
  Deal->>Admin: mark admin approval required
  Deal-->>Client: Awaiting admin verification

  Admin->>Client: Approve deal stage
  Client->>API: PATCH /api/admin/deals/:dealId/approve-stage
  API->>Deal: approveDealStage
  Deal-->>Client: Approval complete

  Investor->>Client: Advance to portfolio
  Client->>API: PATCH /api/investor/deals/:dealId/stage
  API->>Deal: move to stage 4
```

## 9. Recruiter Hiring Sequence

```mermaid
sequenceDiagram
  participant Recruiter as Recruiter
  participant Client as Recruiter UI
  participant API as Recruiter API
  participant Talent as Talent Service
  participant Placement as Placement Records

  Recruiter->>Client: Search talent
  Client->>API: GET /api/recruiter/talent
  API->>Talent: listTalentPipeline
  Talent-->>Client: matched students

  Recruiter->>Client: Shortlist a student
  Client->>API: POST /api/recruiter/shortlist/:studentId
  API->>Talent: create relevance bridge

  Recruiter->>Client: Send message or create job
  Client->>API: POST /api/recruiter/message/:studentId
  Client->>API: POST /api/recruiter/jobs

  Recruiter->>Client: Mark student hired
  Client->>API: POST /api/recruiter/hired/:studentId
  API->>Placement: upsert placement record
  Placement-->>Client: updated status
```

## 10. Event Ranking Sequence

```mermaid
sequenceDiagram
  participant Student as Student
  participant StudentUI as Student UI
  participant CollegeUI as College UI
  participant API as Event API
  participant Event as Event Service
  participant Score as Score Engine
  participant DB as MongoDB

  Student->>StudentUI: Join event
  StudentUI->>API: POST /api/events/:eventId/join
  API->>Event: joinEvent
  Event->>DB: Add participant

  CollegeUI->>CollegeUI: Enter submission score
  CollegeUI->>API: PATCH /api/events/:eventId/participants/:studentId/submission-score
  API->>Event: addSubmissionScore
  Event->>DB: Update participant score

  CollegeUI->>API: POST /api/events/:eventId/compute-rankings
  API->>Event: computeEventRankings
  Event->>Score: Combine submission and innovation scores
  Event->>DB: Persist rankings and computed time
  Event-->>CollegeUI: Ranked leaderboard
```

## 11. Notes

- Active frontend source of truth is `Client/src/features`, `Client/src/api`, `Client/src/components`, and `Client/src/pages`.
- Active backend source of truth is `Server/src/app.ts`, `Server/src/server.ts`, `Server/src/modules`, `Server/src/config`, `Server/src/jobs`, `Server/src/workers`, and `Server/src/sockets`.
- `temp/`, exported Postman JSON, Newman outputs, and local audit artifacts are generated/derived and should not be treated as canonical architecture sources.
- The repo still contains older JS module families in the backend and a transitional page-based scaffold in the frontend. Those are important for historical context, but the diagrams above reflect the currently mounted implementation.
