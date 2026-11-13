# 1 Developer Information

- **Name:** Wilmar G. Lipata
- **GitHub Username:** wmglipata
- **Technology Stack:** JavaScript / Node.js 24 / Express.js 5 / EJS / SQLite (node:sqlite) / Node.js built-in test runner / Supertest
- **T16 Branch:** feature/t16-final-release
- **Final Release Version:** 1.0.0

---

# 2 My Final Release Implementation

For the final release I bumped the version to `1.0.0` in a single place — the `applicationConfig` object inside `src/config/application.js` — so there is exactly one source of truth for the version across the entire application. The `/health` endpoint already imported `applicationConfig`, so it began reporting `1.0.0` automatically without any changes to its own controller or route. To surface the version in the UI without duplicating the string in every view, I imported `applicationConfig` in `src/app.js` and assigned `app.locals.appVersion = applicationConfig.version` once during app creation; Express then makes `appVersion` available to every EJS template automatically, so the three main view files only needed a small footer element added using `<%= appVersion %>`. I also updated the two version assertions in `test/application.test.js` from `0.1.0` to `1.0.0` to keep them accurate — this is not weakening but correcting them to track the real current version. Finally, I wrote `test/finalRelease.test.js`, a 13-phase integration test that exercises resident registration, service request submission, the full Pending→In Progress→Completed lifecycle, resident deactivation, SR eligibility blocking, dashboard aggregate accuracy, and automated `/health` and UI version verification, all using real SQLite persistence with clean setup and teardown.

---

# 3 Files I Changed

| File | Purpose |
|---|---|
| `src/config/application.js` | Bumped `version` from `"0.1.0"` to `"1.0.0"` — the single source of truth for the release version. |
| `src/app.js` | Imported `applicationConfig` and added `app.locals.appVersion = applicationConfig.version` so all EJS views receive the version without any per-route boilerplate. |
| `src/views/dashboard/index.ejs` | Added a footer `<footer>` element rendering `CSMS v<%= appVersion %>`. |
| `src/views/residents/index.ejs` | Added the same footer element. |
| `src/views/service-requests/index.ejs` | Added the same footer element. |
| `test/application.test.js` | Updated the two version assertions (`0.1.0` → `1.0.0`) in the home-page display test and the `/health` payload test so they remain accurate against the new release version. |
| `test/finalRelease.test.js` | New file — the T16 final release integration test (see Section 4). |
| `src/views/index.ejs` | *(T16 follow-up)* Added a `.home-nav` navigation block with links to `/dashboard`, `/residents`, and `/service-requests` so the home page is no longer a dead end. |
| `public/css/style.css` | *(T16 follow-up)* Added `.home-nav` styles to match the project's existing plain-CSS conventions. |
| `test/application.test.js` | *(T16 follow-up)* Added four new tests: home page contains links to all three module routes; each of the three linked routes returns HTTP 200. No existing assertions were modified. |
| `src/views/dashboard/index.ejs` | *(T17)* Changed the CSMS brand `<span>` to `<a href="/">` so clicking the brand navigates to the home page. |
| `src/views/residents/index.ejs` | *(T17)* Same brand link fix. |
| `src/views/residents/register.ejs` | *(T17)* Same brand link fix. |
| `src/views/residents/edit.ejs` | *(T17)* Same brand link fix. |
| `src/views/service-requests/index.ejs` | *(T17)* Same brand link fix. |
| `src/views/service-requests/new.ejs` | *(T17)* Same brand link fix. |
| `src/views/service-requests/show.ejs` | *(T17)* Same brand link fix. |
| `test/navBrandLink.test.js` | *(T17)* New file — 8-subtest suite asserting `<a href="/">CSMS</a>` is present on every navbar page (Dashboard, Residents list, Register, Edit, Service Requests list, New, and Detail) and that `GET /` returns HTTP 200. Uses an isolated fixture resident + SR with cleanup. |

---

# 4 My Final Examination Test

**Test Name:**  
"Active resident registers, submits a service request, and completes the full lifecycle while deactivation blocks further submissions and the dashboard reflects every persisted state change accurately."

**Modules Covered:**  
1. `ResidentRegistrationService` — registers the resident  
2. `ResidentDeactivationService` — deactivates the resident  
3. `ServiceRequestSubmissionService` — submits requests and enforces eligibility  
4. `ServiceRequestStatusService` — drives the Pending→In Progress→Completed state machine  
5. `DashboardService` + `ResidentRepository` + `ServiceRequestRepository` (SQLite persistence) — aggregate counts verified at each stage  
6. `/health` endpoint — version assertion against `applicationConfig.version`  
7. Dashboard, Residents, and Service Requests HTML pages — `v1.0.0` footer assertion

**Starting State:**  
No pre-existing test fixture. The test registers its own resident from scratch using `ResidentRegistrationService`, then immediately queries `findById` on the repository to confirm the row was persisted before proceeding.

**Operations Performed:**  
1. Register a valid Active resident and assert all fields persisted correctly.  
2. Assert the dashboard active count includes the new resident.  
3. Submit a service request for the Active resident and assert it persists with `Pending` status.  
4. Transition the SR Pending → In Progress; verify persisted status.  
5. Transition In Progress → Completed; verify persisted status.  
6. Attempt to cancel the Completed SR (rejected — Completed is terminal); assert persisted status is still `Completed`.  
7. Deactivate the resident; assert persisted status is `Inactive`.  
8. Attempt to submit a new SR for the Inactive resident; assert failure, assert SR count is unchanged.  
9. Assert dashboard final aggregates are internally consistent (active + inactive = total; all SR buckets sum to total).  
10. Assert `/health` returns HTTP 200 with `version: "1.0.0"` matching `applicationConfig.version` exactly, and no leaked internals.  
11. Assert Dashboard, Residents, and Service Requests HTML each contain `v1.0.0`.

**Expected Final State:**  
- Resident persists as `Inactive`.  
- The original SR persists as `Completed`.  
- No additional SR row was created by the rejected Inactive submission.  
- Dashboard active count is one lower and inactive count is one higher compared to pre-test state.  
- All rows inserted by this test are deleted in the cleanup block.

**Why Meaningful:**  
This test is meaningful because it validates the complete CSMS business contract in a single, traceable narrative: a resident goes from registration through the full service lifecycle and into deactivation, with every assertion reading from actual SQLite rows rather than return values. The rejected operation (Inactive resident submitting a SR) proves the service-layer guard works and leaves persistence in a provably clean state. The final dashboard consistency checks confirm that all five modules stay synchronized with one another, which is the highest-value regression guarantee for a release.

---

# 5 My Final Technical Decision

**Decision:**  
Define `version: "1.0.0"` only in `src/config/application.js` (`applicationConfig`), and deliver it to the EJS views through `app.locals.appVersion` set once in `createApp()`.

**Alternative Considered:**  
Reading the version at runtime from `package.json` using `fs.readFileSync` and `JSON.parse` inside `createApp()` or the health controller. This would have made `package.json` the canonical source and eliminated duplication between it and `applicationConfig`.

**Reason:**  
I chose to stay with `applicationConfig` as the single source because that file already existed as the authoritative configuration module that both `/health` and the home controller imported. Introducing a `package.json` file read would have added an I/O operation on every app startup, required a `try/catch` for error resilience, and would have been inconsistent with the existing architecture where application identity lives in `config/application.js`. Keeping the version in `applicationConfig` meant zero changes to the health controller and zero risk of breaking the health or home route tests; the only change needed was to bump the string from `"0.1.0"` to `"1.0.0"`. Using `app.locals` to propagate it to views avoids repeating the import in every controller that renders a view.

---

# 6 Problem or Verification Issue Encountered

**Problem 1 (original T16):**  
When adding `v<%= appVersion %>` to the EJS footer, I needed to confirm that `appVersion` would actually be defined in every rendered template and would not silently render as `vundefined` for any page.

**Cause / Investigation:**  
Express's `app.locals` object is merged into the template locals for every render call, so any property set on it before the first request is handled is automatically available to all views. However, the assignment `app.locals.appVersion = applicationConfig.version` needed to happen inside `createApp()` before any routes were registered, otherwise requests that arrived before the assignment would not have the variable. I inspected the `createApp()` function flow and confirmed the assignment executes synchronously during app initialization, before any route handler can fire. I also verified via HTTP that the Dashboard, Residents, and Service Requests pages each returned the string `v1.0.0` in their HTML, confirming no template received an undefined value.

**Resolution:**  
Placing the `app.locals.appVersion` assignment immediately after the view engine configuration block in `createApp()` — before any `app.use()` route registrations — guarantees the value is present for the lifetime of the application. The automated regression tests in Phase 9 of `finalRelease.test.js` assert the string `v1.0.0` in the HTML of all three main pages, so this is verified on every test run.

---

**Problem 2 (T16 follow-up):**  
The home page (`/`) had no navbar and no navigation links. Clicking the "CSMS" brand in the navbar of any main page returned the user to `/`, from which there was no way back to Dashboard, Resident Management, or Service Request Management without manually typing a URL — a navigation dead end.

**Cause:**  
The home page (`src/views/index.ejs`) is a standalone HTML page that predates the shared Tailwind-based layout used by the three module pages. It was never updated with navigation when the module pages were built out in earlier sprints.

**Resolution:**  
Added a small `.home-nav` link group directly inside the existing `.card` on `src/views/index.ejs`, pointing to `/dashboard`, `/residents`, and `/service-requests` — the same route paths used by the shared navbar. Plain CSS styles for `.home-nav` were appended to `public/css/style.css` to match the project's existing CSS conventions. Four new automated tests in `test/application.test.js` verify that the links are present in the HTML and that each linked route returns HTTP 200.

---

**Problem 3 (T16 follow-up — test data in dev database):**  
Earlier acceptance checks (from the original T16 round) created records directly in the shared dev database (`csms.db`) without cleanup. These records are now visible on the Dashboard.

**Records created:**  
- Residents: "HTTPTest Acceptance" (id 118, Active). Earlier UI test residents: "Active User" (id 116), "Inactive User" (id 117), "UI Tester" (id 115), and several others (ids 108–110).  
- Service Requests: "HTTPAcceptanceTest" (id 214, Completed, resident 118); "CancelMeNow" (id 212, Cancelled), "StartThenCancel" (id 213, Cancelled), "Plumbing13" (id 210, Completed), "Electrical13" (id 211, Pending) — all linked to resident 116.

**Git tracking status:**  
`csms.db` itself is **not tracked by Git** (not listed by `git ls-files`). Only the WAL-mode sidecar files `csms.db-shm` and `csms.db-wal` appear in the tracked file list as modified. The main database file is untracked and would not be committed. Resolution — whether to delete these records — is deferred to the developer.

---

# 7 Final Regression Results

**Test Command:** `node --test --test-concurrency=1`

| Run | Tests | Pass | Fail |
|---|---|---|---|
| Run 1 | 209 | 209 | 0 |
| Run 2 | 209 | 209 | 0 |

**Total Passing Tests:** 209

---

# 8 Tools and References Used

- **Kiro AI coding assistant, Gemini Ai, and Claude** — used to assist with code generation, test writing, documentation authoring, and HTTP acceptance check scripting throughout this ticket. All generated code was reviewed, understood, and verified against actual command output before being committed. AI assistance is disclosed in accordance with the academic integrity policy.
- Official Node.js documentation — `node:test`, `node:assert`, `node:sqlite`
- Express.js official documentation — `app.locals`, route configuration
- EJS documentation — template variable resolution
- Previous checkpoint documents (prelim, midterm) for carried-over architecture decisions

---

# 9 Final Release Declaration

All automated tests pass across two independent runs (209/209). The `/health` endpoint returns `version: "1.0.0"` derived from the single source (`applicationConfig`). The Dashboard, Resident Management, and Service Request Management pages each display `v1.0.0` in the footer. The home page (`/`) includes navigation links to all three module routes — no dead ends. The "CSMS" brand element in every navbar page is now an anchor linking to `/`, verified by T17 (`test/navBrandLink.test.js`). The integration test covers five modules with real SQLite persistence, a full status lifecycle, a rejected business operation with persistence integrity verification, and automated `/health` and UI version checks. No existing test was deleted, skipped, or weakened.

**CSMS v1.0.0 - READY FOR RELEASE**
git