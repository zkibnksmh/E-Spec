# Development Mock Identity

Development Mock Identity provides simulated backend-only principals for local development and automated tests. It is not production authentication and does not represent real employees.

## Enable

From `backend` on macOS/Linux:

```bash
E_SPEC_ENV=test E_SPEC_ENABLE_DEV_IDENTITY=true npm start
```

From `backend` in Windows PowerShell:

```powershell
$env:E_SPEC_ENV = "test"
$env:E_SPEC_ENABLE_DEV_IDENTITY = "true"
npm start
```

The feature is enabled only when `E_SPEC_ENV` is exactly `development` or `test`, `E_SPEC_ENABLE_DEV_IDENTITY` is exactly `true`, and `NODE_ENV` is not `production`. All other configurations fail closed.

## Test Identities

| Header alias | User ID | Role |
| --- | --- | --- |
| `requestor` | `DEV-REQ-001` | `Requestor` |
| `manager` | `DEV-MGR-001` | `Manager` |
| `head-engineering` | `DEV-HE-001` | `HeadEngineering` |

All simulated identities are scoped to test plant `7201` and department `7301`.

## Profile Request

```bash
curl -H "X-ESpec-Dev-Identity: requestor" http://localhost:3001/api/auth/me
```

The client can select only a predefined alias. It cannot define user IDs, roles, email addresses, or organizational scope.

## Future Providers

Future OIDC/SSO providers should resolve their trusted identity into the same canonical principal shape attached to `req.user`. Business routes must depend on this normalized principal, not on development headers or provider-specific claims.

## Authorization Foundation

Authentication establishes `req.user`; authorization decides whether that principal may perform a specific operation. Existing business routes are intentionally not protected yet.

Available reusable middleware:

```js
const { requireAuthenticated } = require("../src/auth/middlewares/authentication.middleware");
const {
  requireRoles,
  requirePlantAccess,
  requireDepartmentAccess,
} = require("../src/auth/middlewares/authorization.middleware");
const { ROLES } = require("../src/auth/constants/roles");

router.post(
  "/example",
  requireAuthenticated,
  requireRoles([ROLES.REQUESTOR]),
  requirePlantAccess((req) => req.body.plant),
  requireDepartmentAccess((req) => req.body.department),
  handler
);
```

For an existing specification, target plant and department must come from a server-loaded specification, not client input. Plant access never implies department access, and roles have no hierarchy.

Draft ownership is not enforced yet because specifications are not linked to canonical users. Future approval authorization must require the exact user assigned to the current pending approval step, validate sequence and actual resource scope, and execute the decision transactionally. A matching role alone is not sufficient.
