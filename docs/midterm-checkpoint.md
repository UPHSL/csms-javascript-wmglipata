# Midterm Checkpoint - T10

## Required Section 1 - Developer Information
* Name: Wilmar G. Lipata
* GitHub Username: wmglipata
* Primary Technology Stack: JavaScript / Express.js / SQLite
* T10 Branch: feature/t10-service-request-status

## Required Section 2 - My T10 Implementation
My status workflow is managed by the `ServiceRequestStatusService`, which acts as a strict state machine enforcing business rules through native error throwing. By throwing exceptions (e.g., `INVALID_TRANSITION`), the service acts as a hard stop, guaranteeing that an invalid request can never accidentally reach the database layer and compromise data consistency. If a transition is valid, it calls the `updateStatus()` repository method. This method uses a targeted `UPDATE` parameterized query to alter only the `status` column, ensuring strict isolation and preventing unrelated fields from being accidentally overwritten.

## Required Section 3 - My Transition Rules
* **Pending to In Progress:** Allowed. Begins the processing phase.
* **Pending to Cancelled:** Allowed. Cancels the request before processing starts.
* **In Progress to Completed:** Allowed. Finishes an active workflow.
* **In Progress to Cancelled:** Allowed. Halts an active workflow safely.
* **Pending to Completed is rejected** because a request must undergo processing before it can be considered finished.
* **Completed is terminal** because the lifecycle of the service request has officially reached a successful end and cannot be undone or restarted.
* **Cancelled is terminal** because the request was aborted, and reopening it is not supported in the current architecture.
* **Same-status requests are handled** by explicitly rejecting them as invalid transitions to ensure the operation represents a true state change, leaving persistence untouched.

## Required Section 4 - Files I Changed
* **File:** `src/repositories/ServiceRequestRepository.js`
  **Purpose:** Added the `updateStatus(id, newStatus)` method to execute a "sniper" SQL `UPDATE` specifically targeting the status column without overwriting the rest of the record.
* **File:** `src/services/ServiceRequestStatusService.js`
  **Purpose:** Created the service to act as the state machine, isolating transition rules and utilizing error-throwing for strict ACID consistency.
* **File:** `test/serviceRequestStatus.test.js`
  **Purpose:** Implemented the 13 required automated tests and 1 student-designed test verifying idempotency.

## Required Section 5 - Problem I Encountered
* **What happened:** Initially, handling invalid transitions using boolean flag objects felt unsafe because a higher-level controller could theoretically ignore the flag and proceed.
* **What caused it:** I needed a way to guarantee that execution halts immediately the moment a business rule is violated.
* **How I investigated it:** I researched backend architecture patterns related to ACID properties, specifically looking at how to guarantee Atomicity and Consistency.
* **How I resolved it:** I structured my service to throw strict Node.js `Error` objects (`NOT_FOUND`, `INVALID_TRANSITION`). This forcefully stops the execution thread before it can ever touch the `updateStatus` repository method.

## Required Section 6 - My Student-Designed Test
* **Test Name:** `Test 14 - Student-Designed Test: Repeated Spam Clicks Are Handled Safely`
* **What the Test Verifies:** It verifies that if a user spams an identical status change (e.g., clicking "Cancel" 3 times fast), only the first operation succeeds. The subsequent identical requests safely throw `INVALID_TRANSITION` exceptions without mutating the database again.
* **Why I Added This Test:** Testing idempotency is crucial for backend consistency. It proves the state machine protects terminal states even under duplicated concurrent stress.

## Required Section 7 - Tools and References Used
* Official Node.js Error throwing documentation
* Node.js native test runner `assert.throws` documentation
* Research on ACID properties (Atomicity, Consistency, Isolation, Durability)
* Gemini AI for assistance