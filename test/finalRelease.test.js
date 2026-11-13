/**
 * T16 – Final Release Integration Test
 *
 * Name: "Active resident registers, submits a service request, and completes
 *        the full lifecycle while deactivation blocks further submissions
 *        and the dashboard reflects every persisted state change accurately."
 *
 * Modules crossed (5):
 *   1. ResidentRegistrationService  – registers a new resident via service layer
 *   2. ResidentDeactivationService  – deactivates the same resident
 *   3. ServiceRequestSubmissionService – submits and rejects requests against eligibility rules
 *   4. ServiceRequestStatusService  – drives the full Pending→In Progress→Completed workflow
 *   5. DashboardService + ResidentRepository + ServiceRequestRepository (SQLite persistence)
 *      – aggregate counts verified before and after every mutation
 *
 * Test design:
 *   - Starts from a known, clean state (private resident + SR fixture, not shared state)
 *   - Every database INSERT in this file is cleaned up in the same test block
 *   - Assertions verify the FINAL PERSISTED STATE, not just return values
 *   - One rejected business operation (SR submission by an Inactive resident) is asserted
 *     to have left persistence completely uncorrupted
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { applicationConfig } from '../src/config/application.js';
import { ResidentRepository } from '../src/repositories/ResidentRepository.js';
import { ServiceRequestRepository } from '../src/repositories/ServiceRequestRepository.js';
import { ResidentRegistrationService } from '../src/services/ResidentRegistrationService.js';
import { ResidentDeactivationService } from '../src/services/ResidentDeactivationService.js';
import { ServiceRequestSubmissionService } from '../src/services/ServiceRequestSubmissionService.js';
import { ServiceRequestStatusService } from '../src/services/ServiceRequestStatusService.js';
import { DashboardService } from '../src/services/DashboardService.js';

const app = createApp();

// ---------------------------------------------------------------------------
// T16 Integration Test
// ---------------------------------------------------------------------------
test(
  'Active resident registers, submits a service request, and completes ' +
  'the full lifecycle while deactivation blocks further submissions ' +
  'and the dashboard reflects every persisted state change accurately.',
  async (t) => {
    // --- Shared fixtures ---
    const residentRepo    = new ResidentRepository();
    const srRepo          = new ServiceRequestRepository();
    const registrar       = new ResidentRegistrationService();
    const deactivator     = new ResidentDeactivationService();
    const srSubmitter     = new ServiceRequestSubmissionService();
    const statusService   = new ServiceRequestStatusService();
    const dashService     = new DashboardService(residentRepo, srRepo);

    let residentId   = null;
    let srId         = null;

    // -----------------------------------------------------------------------
    // Phase 1: Register a new resident and verify persistence
    // -----------------------------------------------------------------------
    await t.test('Phase 1 – Registration persists a valid Active resident', () => {
      const result = registrar.register({
        firstName:     'T16',
        lastName:      'FinalResident',
        address:       '16 Release Road',
        contactNumber: '09160000001',
        email:         't16final@csms.test',
        status:        'Active'
      });

      assert.ok(result.success, 'Registration must succeed for valid data');
      assert.ok(result.resident.id > 0, 'Persisted resident must have a generated ID');
      residentId = result.resident.id;

      // Verify directly from repository (not from the return value)
      const persisted = residentRepo.findById(residentId);
      assert.ok(persisted !== null,                           'Resident must exist in persistence');
      assert.equal(persisted.firstName,     'T16',            'firstName preserved');
      assert.equal(persisted.lastName,      'FinalResident',  'lastName preserved');
      assert.equal(persisted.status,        'Active',         'Status must be Active');
    });

    // -----------------------------------------------------------------------
    // Phase 2: Dashboard reflects the new resident in aggregate counts
    // -----------------------------------------------------------------------
    await t.test('Phase 2 – Dashboard aggregate includes the newly registered resident', () => {
      const summary = dashService.getDashboardSummary();
      assert.ok(summary.residents.active >= 1,
        'Active resident count must be at least 1 after registration');
      assert.ok(summary.residents.total >= 1,
        'Total resident count must be at least 1 after registration');
    });

    // -----------------------------------------------------------------------
    // Phase 3: Active resident submits a Service Request; verifies persistence
    // -----------------------------------------------------------------------
    await t.test('Phase 3 – Active resident can submit a Service Request', () => {
      const result = srSubmitter.submit({
        residentId:    residentId,
        serviceType:   'T16RoadRepair',
        description:   'Pothole on Release Road near house 16',
        dateRequested: '2026-11-13',
        status:        'Pending'
      });

      assert.ok(result.success,                           'SR submission must succeed for Active resident');
      assert.ok(result.serviceRequest.id > 0,            'SR must receive a generated ID');
      srId = result.serviceRequest.id;

      // Verify directly from repository
      const persisted = srRepo.findById(srId);
      assert.ok(persisted !== null,                       'SR must exist in persistence');
      assert.equal(persisted.status,        'Pending',   'New SR must be Pending');
      assert.equal(persisted.residentId,    residentId,  'SR must link to the correct resident');
      assert.equal(persisted.serviceType,   'T16RoadRepair', 'Service type preserved');
    });

    // -----------------------------------------------------------------------
    // Phase 4: Drive the full status workflow Pending → In Progress → Completed
    // -----------------------------------------------------------------------
    await t.test('Phase 4a – Pending SR can transition to In Progress', () => {
      const updated = statusService.updateStatus(srId, 'In Progress');
      assert.equal(updated.status, 'In Progress', 'Status must be In Progress after transition');

      // Verify persisted state
      const persisted = srRepo.findById(srId);
      assert.equal(persisted.status, 'In Progress', 'Persisted status must be In Progress');
    });

    await t.test('Phase 4b – In Progress SR can transition to Completed', () => {
      const updated = statusService.updateStatus(srId, 'Completed');
      assert.equal(updated.status, 'Completed', 'Status must be Completed after transition');

      // Verify persisted state
      const persisted = srRepo.findById(srId);
      assert.equal(persisted.status, 'Completed', 'Persisted status must be Completed');
    });

    await t.test('Phase 4c – Completed is terminal; re-transition is rejected', () => {
      assert.throws(
        () => statusService.updateStatus(srId, 'Cancelled'),
        (err) => err.message === 'INVALID_TRANSITION',
        'Transitioning away from Completed must throw INVALID_TRANSITION'
      );

      // CRITICAL: persistence must be untouched after the rejected transition
      const persisted = srRepo.findById(srId);
      assert.equal(persisted.status, 'Completed',
        'Persisted status must remain Completed after rejected transition — persistence is NOT corrupted');
    });

    // -----------------------------------------------------------------------
    // Phase 5: Deactivate the resident
    // -----------------------------------------------------------------------
    await t.test('Phase 5 – Resident can be deactivated; persisted status becomes Inactive', () => {
      const result = deactivator.deactivateResident(residentId);
      assert.ok(result.success,                           'Deactivation must succeed');
      assert.ok(!result.alreadyInactive,                  'Resident was Active, not already Inactive');

      // Verify directly from repository
      const persisted = residentRepo.findById(residentId);
      assert.equal(persisted.status, 'Inactive',          'Persisted status must be Inactive');
    });

    // -----------------------------------------------------------------------
    // Phase 6: Deactivated resident cannot submit a new SR (rejected business op)
    //          Persistence must be entirely uncorrupted
    // -----------------------------------------------------------------------
    await t.test('Phase 6 – Deactivated resident is blocked from submitting a new SR', () => {
      const srCountBefore = srRepo.getMetrics().total;

      const result = srSubmitter.submit({
        residentId:    residentId,
        serviceType:   'T16BlockedRequest',
        description:   'This request must be rejected',
        dateRequested: '2026-11-13',
        status:        'Pending'
      });

      assert.ok(!result.success,                 'Submission by Inactive resident must fail');
      assert.ok(result.residentInactive,         'Result must indicate the resident is inactive');
      assert.equal(result.serviceRequest, null,  'No SR object must be returned on rejection');

      // Verify persistence was NOT touched
      const srCountAfter = srRepo.getMetrics().total;
      assert.equal(srCountAfter, srCountBefore,
        'SR count must be identical before and after the rejected submission — persistence is NOT corrupted');
    });

    // -----------------------------------------------------------------------
    // Phase 7: Dashboard final aggregate reflects all mutations correctly
    // -----------------------------------------------------------------------
    await t.test('Phase 7 – Dashboard final state matches all persisted mutations', () => {
      const summary = dashService.getDashboardSummary();

      // The resident we registered is now Inactive
      assert.ok(summary.residents.inactive >= 1,
        'Inactive resident count must be at least 1 after deactivation');

      // The SR we submitted is Completed, contributing to completed count
      assert.ok(summary.serviceRequests.completed >= 1,
        'Completed SR count must be at least 1 after the status workflow');

      // Dashboard total must be consistent
      assert.equal(
        summary.residents.active + summary.residents.inactive,
        summary.residents.total,
        'active + inactive must equal total residents'
      );
      assert.equal(
        summary.serviceRequests.pending +
        summary.serviceRequests.inProgress +
        summary.serviceRequests.completed +
        summary.serviceRequests.cancelled,
        summary.serviceRequests.total,
        'All SR status buckets must sum to the SR total'
      );
    });

    // -----------------------------------------------------------------------
    // Phase 8: /health endpoint reports the correct application version
    // -----------------------------------------------------------------------
    await t.test('Phase 8 – /health reports the version from the single source (applicationConfig)', async () => {
      const res = await request(app).get('/health');

      assert.equal(res.statusCode, 200,
        '/health must return HTTP 200');
      assert.equal(res.body.status, 'ok',
        '/health status field must be "ok"');
      assert.equal(res.body.version, applicationConfig.version,
        '/health version must equal applicationConfig.version — no hardcoded literal');
      assert.equal(res.body.version, '1.0.0',
        '/health version must be "1.0.0" for this release');

      // Security: no leaked internals
      assert.equal(res.body.env,        undefined, '/health must not expose env');
      assert.equal(res.body.dbPath,     undefined, '/health must not expose dbPath');
      assert.equal(res.body.stackTrace, undefined, '/health must not expose stackTrace');
    });

    // -----------------------------------------------------------------------
    // Phase 9: UI pages render v1.0.0 (derived from app.locals, not hardcoded)
    // -----------------------------------------------------------------------
    await t.test('Phase 9a – Dashboard HTML contains the release version', async () => {
      const res = await request(app).get('/dashboard');
      assert.equal(res.statusCode, 200, 'GET /dashboard must return 200');
      assert.match(res.text, /v1\.0\.0/, 'Dashboard HTML must display v1.0.0');
    });

    await t.test('Phase 9b – Resident Management HTML contains the release version', async () => {
      const res = await request(app).get('/residents');
      assert.equal(res.statusCode, 200, 'GET /residents must return 200');
      assert.match(res.text, /v1\.0\.0/, 'Residents HTML must display v1.0.0');
    });

    await t.test('Phase 9c – Service Request Management HTML contains the release version', async () => {
      const res = await request(app).get('/service-requests');
      assert.equal(res.statusCode, 200, 'GET /service-requests must return 200');
      assert.match(res.text, /v1\.0\.0/, 'Service Requests HTML must display v1.0.0');
    });

    // -----------------------------------------------------------------------
    // Cleanup: remove every row this test inserted
    // -----------------------------------------------------------------------
    if (srId !== null) {
      srRepo.db.prepare('DELETE FROM service_requests WHERE id = ?').run(srId);
    }
    if (residentId !== null) {
      residentRepo.db.prepare('DELETE FROM residents WHERE id = ?').run(residentId);
    }
  }
);
