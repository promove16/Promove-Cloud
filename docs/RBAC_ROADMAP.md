# RBAC Roadmap

Status: future work only. This note is a planning artifact and does not change runtime behavior, schemas, or routes.

## Why This Exists

The current application still relies on a single user role model with role-specific guards and scoped access checks. That works for the present system, but it is too coarse for a fuller organization-aware permission model.

This roadmap breaks the future RBAC refactor into small phases so the codebase can move from role-first access control to organization membership and permissions without a big-bang migration.

## Phased Plan

### 1. Organization Model

Introduce an `Organization` concept as the primary container for shared access and ownership.

Planned responsibilities:
- store org identity and type
- define ownership and lifecycle state
- provide a stable parent for shared resources

### 2. Organization Membership Roles

Move user access from a single global role toward membership-driven access within an organization.

Planned membership concepts:
- owner
- admin
- manager
- member
- viewer

These should be independent from the global account type so a user can participate in more than one organization.

### 3. Permission Templates

Define reusable permission templates instead of hard-coding access rules in every module.

Planned template groups:
- read-only
- operational
- approval
- admin
- super-admin

Templates should be easy to assign to a membership and easy to audit later.

### 4. Partner Relationships

Model relationships between the platform and external partner organizations such as colleges, schools, and recruiters.

Planned relationship types:
- verified partner
- pending partner
- invited partner
- suspended partner

This will let the platform distinguish internal membership from external collaboration.

### 5. Marketplace Visibility vs Action Permissions

Separate what a user can see from what they can do.

Planned split:
- visibility permissions control discovery, listing, and profile surfacing
- action permissions control create, edit, approve, invite, and manage operations

This avoids overloading a single role check with both UI exposure and workflow authority.

### 6. Migration From Single-Role User To Org Membership

Plan a gradual migration rather than a hard cutover.

Suggested order:
1. add organization and membership records
2. backfill default memberships for existing users
3. keep legacy role checks as a compatibility layer
4. move new authorization checks to membership and permission templates
5. retire single-role assumptions once all mounted surfaces are migrated

## Guardrails

- Do not change schema shape in the current patch.
- Do not rewrite route authorization in this pass.
- Preserve existing role redirects and dashboard navigation until membership-based access is ready.
- Keep legacy role checks available while the migration runs.

## Success Criteria For The Future Refactor

- a user can belong to multiple organizations
- permissions are derived from membership, not only from account role
- partner organizations are modeled explicitly
- marketplace visibility is separated from action authority
- legacy role-based access can be phased out without breaking current flows
