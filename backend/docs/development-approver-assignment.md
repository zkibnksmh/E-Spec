# Development Approver Assignment and Routing Foundation

Task 05H adds a development-only foundation for resolving approval roles into trusted development principals and for building ordered approval routes. It does not implement Submission, Approval Decision, Approval Inbox, workflow history, or notification APIs.

## Architecture

Three responsibilities are kept separate:

| Component | Responsibility | Current implementation | Future implementation |
|---|---|---|---|
| Approval pattern provider | Supplies ordered approval rules for a material group | `developmentApprovalPatternProvider` | Database-backed provider using `approval_patterns` and `approval_matrix_rules` |
| Approver assignment provider | Resolves an approval role and organizational scope into an exact user identity | `developmentApproverAssignmentProvider` | Enterprise provider backed by approved employee and organization data |
| Approval routing service | Combines ordered rules and resolved assignments into one route | `approvalRoutingService` | Same contract, different providers |

The future Submission service should depend on these contracts, not directly on development fixtures.

## Development identities

The provider reuses the Task 05C development identity provider and its environment guard. It does not duplicate the guard.

| Approval role | Alias | User ID | Employee ID |
|---|---|---|---|
| Manager | `manager` | `DEV-MGR-001` | `DEV-EMP-MGR-001` |
| HeadEngineering | `head-engineering` | `DEV-HE-001` | `DEV-EMP-HE-001` |

`Requestor` is never a valid approval role.

## Supported development organizational scope

Both development approvers are currently scoped to:

- Plant ID `7201`
- Department ID `7301`

Scope is validated with the existing Task 05D authorization policies (`hasPlantAccess` and `hasDepartmentAccess`). A mismatch fails closed. Missing, invalid, or unsupported Plant and Department identifiers are rejected.

Numeric identifiers are normalized to positive integers. Client-supplied `plantIds`, `departmentIds`, user IDs, or roles are ignored; they cannot broaden scope or override the resolved principal.

## Assignment contract

`resolveApproverAssignment` returns:

```javascript
{
  stepNo: 1,
  approverRole: "Manager",
  assignedApproverUserId: "DEV-MGR-001",
  assignedApproverEmployeeId: "DEV-EMP-MGR-001",
  assignedApproverDisplayName: "Development Manager",
  assignedApproverEmail: "dev.manager@example.test",
  plantId: 7201,
  departmentId: 7301,
  identitySource: "development"
}
```

The exact assigned user ID is preserved for later Task 05D-style authorization. Routing role and exact assigned user identity are intentionally separate concerns.

## Development routes

### SERVICE

| Step | Role | Assigned user |
|---|---|---|
| 1 | Manager | `DEV-MGR-001` |

### SERVICEPM

| Step | Role | Assigned user |
|---|---|---|
| 1 | Manager | `DEV-MGR-001` |
| 2 | HeadEngineering | `DEV-HE-001` |

### BEARING (Barang development simulation)

| Step | Role | Assigned user |
|---|---|---|
| 1 | Manager | `DEV-MGR-001` |
| 2 | HeadEngineering | `DEV-HE-001` |

This route is a development simulation pending approval-matrix business confirmation. It applies only when all three values match the tested combination: specification type `7101` (Barang), material category `7501` (`OPEX - BARANG TEKNIK`), and material group code `BEARING`. The Requestor is the submitter and is never an approval step. Any missing or mismatched combination still fails closed.

These are development test definitions only. They are not written to `approval_patterns` or `approval_matrix_rules`. `material_groups.approvalpatternno` is not modified, `SERVICEPM` is not created in master data, and production routing is unchanged.

## Fail-closed behavior

The development providers are unavailable unless all of the following are true:

- `E_SPEC_ENV` is exactly `development` or `test`.
- `E_SPEC_ENABLE_DEV_IDENTITY` is exactly `true`.
- `NODE_ENV` is not `production`.

Additional fail-closed rules:

- Unknown or Requestor approval roles are rejected.
- Missing or invalid organizational identifiers are rejected.
- Unsupported Plant or Department scope is rejected.
- Duplicate step numbers are rejected.
- Step numbers must be positive integers.
- Every step must be marked required.
- Routes must be non-empty and must not skip a required sequence step.
- An unresolved required step rejects the entire route; no partial route is returned.
- The assigned approver must not be the trusted Requestor for the same document.

## Separation of duties

`resolveApproverAssignment` receives a trusted server-side `requestorUserId`. If the resolved approver user ID matches the Requestor, assignment fails. Client payload values are never used to replace the Requestor or the approver.

This foundation does not implement approval decision authorization. Task 05D's exact-assigned-user principles remain the basis for that future work.

## Not production configuration

The development routes and assignments are deterministic test fixtures. They must not be treated as configured approval patterns, employee records, or organization data. No database writes, migrations, seeds, or production operations are part of Task 05H.

A future database-backed pattern provider will read ordered rules from the approval tables, and a future enterprise assignment provider will resolve real organization data. The routing service contract is designed so Submission business logic can switch providers without changing its own flow.
