# Submission and Resubmission Workflow

`POST /api/specifications/:id/submit` submits an owner-controlled Draft. `POST /api/specifications/:id/resubmit` submits an owner-controlled specification in Revision Required after its most recent cycle was Returned.

Both endpoints require the existing authenticated Requestor identity. The server locks the specification row, verifies the persisted creator identity, validates persisted Plant, Department, Category, Group, and form metadata, resolves the development route from the persisted Material Group SAP code, and writes the cycle, steps, status update, and history in one transaction.

Development routing is available only when the existing development identity guard is enabled for development or test. It creates snapshots with nullable database pattern/rule references because the development providers do not represent seeded production pattern records. No production fallback routing is available.

Every successful submission creates an Active approval cycle and Pending ordered step snapshots. The first step is the actionable step by sequence; submission creates no approval decision events. Existing Returned cycles and their steps remain unchanged during resubmission.

Submission updates the specification to `In Approval`, records `submittedat`, records updater identity, and adds status history. Rollback removes all new workflow writes when validation or routing fails.

Draft owners can edit `Draft` and `Revision Required` specifications. `In Approval`, `Approved`, and `Rejected` remain non-editable.

Attachment support remains metadata-only. Attachment filenames and metadata are validated, but binary files are not uploaded or stored.

Manual development/test request:

```text
POST /api/specifications/:id/submit
X-ESpec-Dev-Identity: requestor
Content-Type: application/json

{"comment":"Submitting specification for approval"}
```

No approval decision, approval inbox, notification, or attachment upload API is implemented by this task.
