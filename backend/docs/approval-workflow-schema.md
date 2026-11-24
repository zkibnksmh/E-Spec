# Approval Workflow Schema Foundation

Task 05G adds schema and status constants only. Submission, approval decision, inbox, notification, SSO, and login APIs are not implemented.

## Canonical statuses

`src/workflow/constants/statuses.js` keeps the domains separate:

- Specification: `Draft`, `In Approval`, `Revision Required`, `Approved`, `Rejected`.
- Approval step: `Pending`, `Approved`, `Returned`, `Rejected`, `Cancelled`.
- Approval cycle: `Active`, `Completed`, `Returned`, `Rejected`.

`Submitted` is not a persistent document status. A successful submit creates an active cycle and transitions the document directly to `In Approval`; the cycle `submittedat` records that action.

## Relationships

- One `specifications` row has many `specification_approval_cycles` rows.
- Each cycle has a unique `(specificationid, cycleno)`.
- One partial unique index permits at most one `Active` cycle per specification.
- Each `specification_approval_steps` row belongs to both its specification and its cycle.
- The composite cycle/specification foreign key prevents a step from using a cycle from another specification.
- Steps are unique by `(approvalcycleid, stepno)`, so a new cycle can start again at step 1 without altering historical steps.
- `specification_approval_step_events` records immutable approval decisions and carries assigned actor identity, actual actor identity, display/role snapshots, status transition, comments, and timestamp.

`specifications.submittedat` remains unchanged and will represent the most recent successful submission or resubmission. Every cycle retains its own `submittedat`; cycle 1 is the authoritative initial submission time.

## Identity fields

Stable identity fields use `varchar(255)` because current development IDs and future enterprise identifiers are string-compatible:

- `submittedbyuserid`
- `assignedapproveruserid`
- `actionbyuserid`
- `changedbyuserid`
- `actoruserid`

Existing name columns remain display snapshots and do not replace the stable identifiers.

## Migration

Migration artifact: `migrations/20261121_05g_approval_workflow_schema.sql`.

It is additive and transactional. It refuses to run if legacy `specification_approval_steps` rows exist, because those rows lack a cycle ID and cannot be placed into a cycle safely without inventing historical data. Operators must explicitly map and validate legacy records before a tailored migration can be approved.

`test/apply-approval-workflow-schema-test-migration.js` is deliberately limited to the approved test target. It requires `E_SPEC_ENV=test`, validates the configured test host, and verifies database name and database user before executing the SQL. It is not a production migration runner.

Approval events are append-only by application contract: business logic must insert new events and must not update or delete prior event rows.
