# Draft Ownership and Identity Persistence

Task 05I adds trusted creator identity and owner-only update enforcement for authenticated development Requestors. Submission and Approval APIs are not implemented.

## Identity columns

`specifications` now stores two stable identity columns:

| Column | Meaning |
|---|---|
| `createdbyuserid` | Canonical `req.user.userId` of the Draft creator |
| `updatedbyuserid` | Canonical `req.user.userId` of the latest authenticated updater |

`createdby` and `updatedby` remain display-name snapshots from `req.user.displayName`. The business form field `requestor` is not a security identity and is never used for ownership.

Legacy rows have `createdbyuserid = NULL`. They are classified as legacy/unowned and cannot be updated through the Draft API. They are never assigned automatically to the first user who accesses them.

## Creation

`POST /api/specifications` now requires:

1. A valid development identity header.
2. A normalized authenticated principal.
3. The `Requestor` role.

Creator identity is taken only from `req.user`. Client-supplied `createdbyuserid`, `createdby`, or role values are ignored. Barang/Jasa payload validation and document-number immutability are unchanged.

## Ownership on update

`PUT /api/specifications/:id` requires the same authentication and role checks. Inside the transactional update path the repository locks the row and verifies:

- The specification exists.
- The status is still `Draft` (`409` otherwise).
- `createdbyuserid` is present and exactly matches `req.user.userId` (`403` otherwise).

`updatedbyuserid` and `updatedby` are written from `req.user`. The `documentno` column is never updated.

## Development identity header

Barang and Jasa read an optional local-only configuration value:

```javascript
window.ESPEC_CONFIG = {
  API_BASE_URL: "http://localhost:3001/api",
  DEV_IDENTITY: "requestor"
};
```

`frontend.local.js` is git-ignored. Tracked application code has no default identity and does not read identity from `formData`, query parameters, or `localStorage`. The header is added only when the configured alias is one of `requestor`, `manager`, or `head-engineering`. The backend development identity guard remains authoritative.

Development Mock Identity is not production authentication. It exists only when `E_SPEC_ENV` is `development` or `test`, `E_SPEC_ENABLE_DEV_IDENTITY=true`, and `NODE_ENV` is not `production`.

## Read access compatibility

`GET /api/specifications` and `GET /api/specifications/:id` remain unchanged and unauthenticated. Current Admin/dashboard callers continue to work. Client `userId` query parameters are ignored and grant no access.

This is a known remaining access-control gap: there is no defined Admin/read policy yet. Owner-scoped read authorization must not be added until that policy is defined. The new POST/PUT ownership rules are not weakened to preserve GET behavior.

## Migration

Migration artifact: `migrations/20261122_05i_draft_ownership.sql`.

It is additive and transactional:

- Adds `createdbyuserid` and `updatedbyuserid` as `varchar(255)`.
- Adds an index on `createdbyuserid` for future owner-scoped queries.
- Does not backfill, delete, or reassign legacy rows.

`test/apply-draft-ownership-schema-test-migration.js` applies it only to the approved test database after verifying `E_SPEC_ENV=test`, host, database name, and database user. It is not a production runner.

## Future work

- Define an approved Admin/read policy before restricting GET endpoints.
- Define an administrative ownership-reconciliation process if legacy Drafts must become editable.
- Replace development identity with SSO/OIDC identity mapping; `createdbyuserid` and `updatedbyuserid` are already string-compatible with enterprise identifiers.
