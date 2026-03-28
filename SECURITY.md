# Security Policy

## Scope

This repository contains the ProMove monorepo:

- `Client/` - React + Vite frontend
- `Server/` - Express + TypeScript API
- `postman/` and `temp/` - API collection assets and generated test artifacts

This document describes how to report security issues and summarizes the main security controls currently implemented in the codebase.

## Supported Versions

Security fixes should be applied against the current active codebase on the default working branch.

| Version | Supported |
| --- | --- |
| Current active branch / latest repo state | Yes |
| Archived, legacy, generated, or scratch files under `temp/`, old JS modules, and backup exports | No |

Legacy and transitional code still exists in the repo. When evaluating risk, treat the active runtime as:

- Backend mounted from `Server/src/app.ts`
- Frontend routed from `Client/src/pages/index.tsx`

## Reporting A Vulnerability

Please do not open a public GitHub issue for a suspected security vulnerability.

Instead:

1. Contact the project owner or repository maintainer through a private channel.
2. Include a clear description of the issue, affected area, impact, and reproduction steps.
3. Include whether the issue requires authentication, a specific role, seeded data, or special environment variables.
4. If possible, include a minimal proof of concept, affected endpoints, and expected vs actual behavior.

Recommended report template:

```text
Title:
Summary:
Affected component:
Impact:
Attack prerequisites:
Steps to reproduce:
Proof of concept:
Suggested remediation:
```

If a private reporting channel is not yet configured for your deployment, contact the repository owner directly and avoid public disclosure until a fix is available.

## Response Expectations

Target response expectations for maintainers:

- Initial acknowledgment: within 3 business days
- Triage decision: within 7 business days
- Fix timeline: depends on severity and deployment impact

Suggested severity guide:

- Critical: remote code execution, auth bypass, tenant-wide data exposure, secret compromise
- High: privilege escalation, access control bypass, sensitive PII exposure, unsafe file handling
- Medium: partial data leakage, CSRF-like state change gaps, weak validation with practical abuse path
- Low: hardening gaps, verbose errors, missing headers, low-impact disclosure

## Security Controls Currently In Place

### Backend platform controls

The Express application in [Server/src/app.ts](/C:/Charan%20Works/Other%20Projects/ProMove/Server/src/app.ts) currently applies:

- `helmet()` for baseline HTTP hardening headers
- CORS restricted to `CLIENT_URL` with credentials enabled
- JSON and URL-encoded body size limits of `10kb`
- `cookie-parser` for refresh-token cookie handling
- request logging through Morgan + Winston
- centralized error handling through [Server/src/middleware/errorHandler.ts](/C:/Charan%20Works/Other%20Projects/ProMove/Server/src/middleware/errorHandler.ts)
- API-wide rate limiting via [Server/src/middleware/rateLimiter.ts](/C:/Charan%20Works/Other%20Projects/ProMove/Server/src/middleware/rateLimiter.ts)

### Authentication and session controls

The auth flow uses:

- JWT access tokens
- JWT refresh tokens
- refresh-token session tracking in Redis
- `bcrypt` password hashing with cost factor `12`
- `httpOnly` refresh-token cookies
- `sameSite: 'strict'` refresh-token cookies
- `secure: true` cookies in production

Relevant files:

- [Server/src/modules/auth/auth.service.ts](/C:/Charan%20Works/Other%20Projects/ProMove/Server/src/modules/auth/auth.service.ts)
- [Server/src/modules/auth/auth.controller.ts](/C:/Charan%20Works/Other%20Projects/ProMove/Server/src/modules/auth/auth.controller.ts)
- [Server/src/middleware/authenticate.ts](/C:/Charan%20Works/Other%20Projects/ProMove/Server/src/middleware/authenticate.ts)

### Authorization and access control

Role and relationship checks are enforced through:

- role-based authorization middleware
- connection guards between allowed role pairs
- route-level protected frontend navigation
- ownership checks in service-layer business logic

Relevant files:

- [Server/src/middleware/authorize.ts](/C:/Charan%20Works/Other%20Projects/ProMove/Server/src/middleware/authorize.ts)
- [Server/src/middleware/connectionGuard.ts](/C:/Charan%20Works/Other%20Projects/ProMove/Server/src/middleware/connectionGuard.ts)
- [Client/src/pages/index.tsx](/C:/Charan%20Works/Other%20Projects/ProMove/Client/src/pages/index.tsx)
- [Client/src/hooks/useProtectedRoute.ts](/C:/Charan%20Works/Other%20Projects/ProMove/Client/src/hooks/useProtectedRoute.ts)

### Input validation and safer error behavior

The repo already uses:

- Zod validation for environment variables and several request payloads
- structured API errors instead of raw thrown values
- duplicate-key handling for common unique-index failures
- production-safe generic `500` responses for unexpected failures

Relevant files:

- [Server/src/config/env.ts](/C:/Charan%20Works/Other%20Projects/ProMove/Server/src/config/env.ts)
- [Server/src/middleware/errorHandler.ts](/C:/Charan%20Works/Other%20Projects/ProMove/Server/src/middleware/errorHandler.ts)
- [Server/src/utils/ApiError.ts](/C:/Charan%20Works/Other%20Projects/ProMove/Server/src/utils/ApiError.ts)

### Upload handling

Workspace uploads currently enforce:

- in-memory Multer handling
- file-type validation
- explicit upload errors
- file-size enforcement through centralized error handling

Relevant files:

- [Server/src/modules/workspace/workspace.routes.ts](/C:/Charan%20Works/Other%20Projects/ProMove/Server/src/modules/workspace/workspace.routes.ts)
- [Server/src/middleware/errorHandler.ts](/C:/Charan%20Works/Other%20Projects/ProMove/Server/src/middleware/errorHandler.ts)

### Public profile and marketplace data exposure

Marketplace browsing is intentionally constrained to a curated public profile shape rather than raw user documents.

Relevant file:

- [Server/src/modules/marketplace/marketplace.service.ts](/C:/Charan%20Works/Other%20Projects/ProMove/Server/src/modules/marketplace/marketplace.service.ts)

## Deployment Requirements

Before using this project outside local development:

1. Set strong, unique values for `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`.
2. Use production-grade MongoDB and Redis credentials.
3. Set `CLIENT_URL` to the exact deployed frontend origin.
4. Run the API only behind HTTPS in production so secure cookies are protected in transit.
5. Keep `NODE_ENV=production` in production deployments.
6. Review log retention and avoid shipping logs that may contain operationally sensitive metadata.
7. Rotate cloud and mail credentials if they were ever committed or shared insecurely.
8. Keep dependency versions current and routinely audit both `Client/` and `Server/`.

## Secrets and Configuration Handling

Environment variables are validated at startup in [Server/src/config/env.ts](/C:/Charan%20Works/Other%20Projects/ProMove/Server/src/config/env.ts). Required secrets include:

- MongoDB connection string
- Upstash Redis credentials
- JWT secrets
- Cloudinary credentials
- AWS credentials
- outbound email sender identity

Recommended practices:

- never commit real `.env` files
- use different secrets for local, test, staging, and production
- rotate secrets after team changes or suspected exposure
- prefer secret managers over plaintext files in hosted deployments

## Logging and Monitoring

The repo logs application activity through Winston and HTTP request activity through Morgan.

Relevant files:

- [Server/src/config/logger.ts](/C:/Charan%20Works/Other%20Projects/ProMove/Server/src/config/logger.ts)
- [Server/src/app.ts](/C:/Charan%20Works/Other%20Projects/ProMove/Server/src/app.ts)

Recommended operational practices:

- monitor repeated `401`, `403`, `404`, and `429` patterns
- alert on repeated login failures or rapid token refresh failures
- review file-upload errors for abuse attempts
- monitor Redis, queue, and Mongo connection failures as potential availability/security events

## Current Security Limitations And Review Items

The following items should be reviewed before a production launch:

- CSRF posture should be reviewed carefully because cookie-backed refresh flows are enabled with credentials.
- File upload validation should be reviewed beyond MIME/type checks if stricter content inspection is required.
- CORS currently allows a single configured client origin; multi-origin deployments need explicit review.
- The repo contains legacy and transitional code paths that should not be assumed production-ready just because they exist in the tree.
- Generated artifacts in `temp/` may contain test data, exported collections, or reports and should not be treated as secure storage.
- Frontend route protection improves UX but is not a security boundary; backend authorization remains the enforcement layer.

## Safe Development Practices For Contributors

- Do not commit secrets, tokens, production dumps, or private certificates.
- Do not paste real access tokens into Postman exports committed to the repo.
- Keep generated Newman reports and scratch artifacts sanitized before sharing.
- Validate any new public profile fields before exposing them through marketplace or discovery APIs.
- Prefer private disclosure for auth, role, verification, payment/deal, hiring, and student data issues.

## Security Testing Suggestions

Useful checks for future hardening:

- auth bypass and role-escalation tests
- refresh-token replay and logout invalidation tests
- rate-limit verification on auth and high-volume endpoints
- input-validation fuzzing for JSON payloads and object IDs
- upload abuse tests for file size, type spoofing, and malformed payloads
- IDOR checks across student, institution, recruiter, mentor, investor, and admin flows
- marketplace/public profile exposure review

## Disclosure Notes

This repository does not currently advertise a formal bug bounty program. Responsible disclosure is still encouraged, and maintainers should prioritize private handling of vulnerabilities until remediation guidance is ready.
