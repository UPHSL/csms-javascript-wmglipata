# 1 Release

**Application:** Community Services Management System  
**Release:** v1.0.0  
**Release Type:** Final Course Release

---

# 2 Release Summary

CSMS v1.0.0 is the final course release of the Community Services Management System, a server-side JavaScript web application built with Express.js, EJS, and SQLite. The system manages community residents and their service requests through a layered MVC architecture.

This release consolidates all features delivered across the course — resident registration, editing, and deactivation; service request submission, search, and status lifecycle management; and a live dashboard with aggregate metrics. The version is defined once in `src/config/application.js`, consumed by `/health` and exposed to all EJS views through `app.locals`, with no hardcoded version literals anywhere else in the application code.

---

# 3 Resident Management Capabilities

- **Register** a new resident with first name, last name, address, contact number, email, and Active status. All fields are validated before persistence.
- **List** all residents ordered alphabetically by last name, then first name. Supports partial, case-insensitive name search.
- **Edit** a resident's editable fields (name, address, contact, email). Status and ID cannot be changed through this operation.
- **Deactivate** an Active resident with a soft delete (status set to Inactive; row is never removed). Deactivating an already-Inactive resident is a safe, idempotent no-op.
- Inactive residents remain fully visible in the list and are still accessible for editing.

---

# 4 Service Request Management Capabilities

- **Submit** a new service request on behalf of an Active resident. Inactive residents are blocked at the service layer.
- **List** all service requests with optional text search (service type or description) and status filter. Ordered by date requested descending, then ID descending.
- **View** a service request's full details.
- **Advance status** through the enforced lifecycle below.

**Status Workflow:**

```
Pending ──► In Progress ──► Completed (terminal)
   │               │
   └──► Cancelled ◄┘        Cancelled (terminal)
```

| Transition | Allowed |
|---|---|
| Pending → In Progress | Yes |
| Pending → Cancelled | Yes |
| In Progress → Completed | Yes |
| In Progress → Cancelled | Yes |
| Pending → Completed | No — must pass through In Progress |
| Completed → any | No — Completed is terminal |
| Cancelled → any | No — Cancelled is terminal |
| Same status → same status | No — rejected as invalid |

Invalid transitions throw an `INVALID_TRANSITION` error and leave the database unchanged.

---

# 5 Dashboard Capabilities

- Displays real-time aggregate counts for residents: Total, Active, Inactive.
- Displays real-time aggregate counts for service requests: Total, Pending, In Progress, Completed, Cancelled, and a derived **Open** count (Pending + In Progress).
- Shows the five most recent service requests ordered by date requested descending, then ID descending, with clickable detail links.
- All GET requests to the dashboard are strictly read-only; no mutations occur.

---

# 6 Quality and Hardening

- **Input validation** is enforced at the service layer. Malformed route identifiers (non-numeric IDs) return HTTP 404 with no stack trace exposed.
- **Rejected mutations protect persistence**: a failed resident update or SR submission leaves the target record byte-for-byte identical to its pre-request state.
- **Read-only safety**: repeated GET requests to `/dashboard` and `/service-requests` produce zero database mutations.
- **Cross-feature regression**: resident deactivation correctly updates dashboard aggregate counts and immediately blocks new service request submissions.
- **Deterministic recent list**: the five most recent requests are always ordered by `date_requested DESC, id DESC`; ties are broken by `id DESC`.
- **Security hardening**: `x-powered-by` header disabled; `/health` exposes no environment variables, file paths, DB connection strings, or stack traces.
- **Navigation completeness**: the home page (`/`) includes links to Dashboard, Resident Management, and Service Request Management so there are no dead-end pages in the application.

---

# 7 Final Verification

## Run 1

**Test Command:** `node --test --test-concurrency=1`

| Metric | Result |
|---|---|
| Tests | 209 |
| Pass | 209 |
| Fail | 0 |
| Skipped | 0 |

## Run 2

| Metric | Result |
|---|---|
| Tests | 209 |
| Pass | 209 |
| Fail | 0 |
| Skipped | 0 |

## Startup

The application started successfully on `http://127.0.0.1:3000` with the command `node src/server.js`.

## Home Page

`GET /` → HTTP 200. HTML contains `1.0.0`. Links to `/dashboard`, `/residents`, and `/service-requests` are present in the HTML; each of those targets returns HTTP 200.

## /health

```json
{
  "status": "ok",
  "application": "Community Services Management System",
  "version": "1.0.0"
}
```

HTTP 200 observed. No `env`, `dbPath`, or `stackTrace` fields present.

## Dashboard

`GET /dashboard` → HTTP 200. HTML contains `v1.0.0` in the footer. Navigation links to Resident Management and Service Request Management resolved with HTTP 200. Ten consecutive GET requests to `/dashboard` produced zero database mutations (confirmed by aggregate count comparison before and after). Verified via HTTP only; visual layout check by student pending.

## Resident Management

`GET /residents` → HTTP 200. HTML contains `v1.0.0` in the footer. `GET /residents/register` → HTTP 200. `POST /residents/register` with valid data → HTTP 302 redirect to `/residents`. Resident search returns filtered results without mutating data. Verified via HTTP only; visual layout check by student pending.

## Service Request Management

`GET /service-requests` → HTTP 200. HTML contains `v1.0.0` in the footer. `GET /service-requests/new` → HTTP 200. `POST /service-requests/new` with a valid Active resident → HTTP 302 redirect to `/service-requests`. Verified via HTTP only; visual layout check by student pending.

## Final Release Version

**v1.0.0** — confirmed in `/health` JSON response, Dashboard HTML, Resident Management HTML, and Service Request Management HTML. All three pages derive the version from `applicationConfig.version` via `app.locals.appVersion`; no hardcoded version literal appears elsewhere in app code.

---

# 8 Known Limitations

- The application uses a single shared SQLite file (`csms.db`) with WAL mode. It is not designed for multi-process or high-concurrency deployment.
- There is no authentication or authorization layer. The system is intended for a trusted local or lab environment.
- Pagination is not implemented; all residents and service requests are returned in a single listing.
- There is no data export capability.
- The EJS views do not use a shared layout file; the navigation bar and footer are duplicated across templates. The brand "CSMS" link in every navbar now points to `/` (the home page). This is a known structural limitation within the defined v1.0.0 scope.

No known release-blocking limitations remain within the defined CSMS v1.0.0 scope.
