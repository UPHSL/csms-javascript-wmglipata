/**
 * T15 – System Hardening and Regression Tests
 *
 * Five integration / unit tests covering the five required hardening categories:
 *
 *   Category 1 – Invalid / Malformed Input
 *   Category 2 – Rejected Mutation Protects Persistence
 *   Category 3 – Read-Only Request Safety
 *   Category 4 – Cross-Feature Regression (Deactivation ↔ Dashboard / SR eligibility)
 *   Category 5 – Repeatability / Boundary Condition (recent-list deterministic limit)
 *
 * All tests use a shared, isolated SQLite fixture (the same file-backed csms.db used
 * by every other test suite).  Each test cleans up only the rows it inserts, so
 * the suite remains order-independent and leaves no permanent side-effects.
 */

import test from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { ResidentRepository } from '../src/repositories/ResidentRepository.js';
import { ServiceRequestRepository } from '../src/repositories/ServiceRequestRepository.js';
import { DashboardService } from '../src/services/DashboardService.js';

// ---------------------------------------------------------------------------
// Shared app instance for all HTTP-layer tests in this file
// ---------------------------------------------------------------------------
const app = createApp();

// ---------------------------------------------------------------------------
// Category 1 – Invalid / Malformed Input
//
// Requirement: Non-numeric route identifiers must never crash the server.
//   The application must return a 4xx status (404) without exposing raw
//   database exceptions, stack traces, or internal error messages.
// ---------------------------------------------------------------------------
test('T15-Cat1 – Malformed route identifiers are handled safely (no crash, 404)', async (t) => {

  await t.test('1a. GET /residents/abc/edit returns 404, not a 500 or crash', async () => {
    const res = await request(app).get('/residents/abc/edit');
    assert.strictEqual(
      res.status,
      404,
      'Expected 404 for non-numeric resident ID in GET /residents/:id/edit'
    );
    // The response body must not contain a raw stack trace keyword
    assert.doesNotMatch(
      res.text,
      /at Object\.|Error:/,
      'Response must not expose a stack trace'
    );
  });

  await t.test('1b. GET /service-requests/abc returns 404, not a 500 or crash', async () => {
    const res = await request(app).get('/service-requests/abc');
    assert.strictEqual(
      res.status,
      404,
      'Expected 404 for non-numeric service request ID in GET /service-requests/:id'
    );
    assert.doesNotMatch(
      res.text,
      /at Object\.|Error:/,
      'Response must not expose a stack trace'
    );
  });

  await t.test('1c. POST /residents/xyz/deactivate returns 404, not a 500 or redirect', async () => {
    const res = await request(app).post('/residents/xyz/deactivate');
    assert.strictEqual(
      res.status,
      404,
      'Expected 404 for non-numeric resident ID in POST /residents/:id/deactivate'
    );
  });

  await t.test('1d. POST /service-requests/xyz/start returns 404, not a 500 or redirect', async () => {
    const res = await request(app).post('/service-requests/xyz/start');
    assert.strictEqual(
      res.status,
      404,
      'Expected 404 for non-numeric service request ID in POST /service-requests/:id/start'
    );
  });
});

// ---------------------------------------------------------------------------
// Category 2 – Rejected Mutation Protects Persistence
//
// Requirement: When a state-changing operation is rejected (e.g. validation
//   failure on a resident update), the target record in the database must be
//   byte-for-byte identical to what it was before the rejected request.
// ---------------------------------------------------------------------------
test('T15-Cat2 – Rejected resident update leaves the database record completely unchanged', async (t) => {
  const repo = new ResidentRepository();

  // Insert a known, stable resident for this test
  const original = repo.save({
    firstName: 'Hardening',
    lastName:  'Cat2Resident',
    address:   '2 Test Lane',
    contactNumber: '09111111111',
    email:     'cat2@hardening.test',
    status:    'Active'
  });
  const targetId = original.id;

  await t.test('2a. POST /residents/:id/edit with blank firstName is rejected (200 re-render)', async () => {
    const res = await request(app).post(`/residents/${targetId}/edit`).send({
      firstName: '',             // intentionally invalid
      lastName:  'Cat2Resident',
      address:   '2 Test Lane',
      contactNumber: '09111111111',
      email:     'cat2@hardening.test'
    });
    // The controller must re-render the form, not redirect
    assert.strictEqual(res.status, 200, 'Invalid update should re-render (200), not redirect');
  });

  await t.test('2b. The persisted record is completely unchanged after the rejected update', async () => {
    const after = repo.findById(targetId);

    // Every field must equal the originally saved values
    assert.strictEqual(after.firstName,     original.firstName,     'firstName must be unchanged');
    assert.strictEqual(after.lastName,      original.lastName,      'lastName must be unchanged');
    assert.strictEqual(after.address,       original.address,       'address must be unchanged');
    assert.strictEqual(after.contactNumber, original.contactNumber, 'contactNumber must be unchanged');
    assert.strictEqual(after.email,         original.email,         'email must be unchanged');
    assert.strictEqual(after.status,        original.status,        'status must be unchanged');
  });

  // Cleanup
  repo.db.prepare('DELETE FROM residents WHERE id = ?').run(targetId);
});

// ---------------------------------------------------------------------------
// Category 3 – Read-Only Request Safety
//
// Requirement: High-frequency GET operations (dashboard, listings, search
//   filters) must leave both the residents and service_requests tables
//   completely unmodified.  Aggregate metrics must be identical before and
//   after a burst of GET requests.
// ---------------------------------------------------------------------------
test('T15-Cat3 – GET /dashboard and GET /service-requests execute with zero database mutations', async (t) => {
  const residentRepo = new ResidentRepository();
  const srRepo       = new ServiceRequestRepository();

  // Snapshot aggregate counts before any reads
  const residentsBefore = residentRepo.getMetrics();
  const srBefore        = srRepo.getMetrics();

  await t.test('3a. Ten consecutive GET /dashboard calls do not alter any metric', async () => {
    for (let i = 0; i < 10; i++) {
      const res = await request(app).get('/dashboard');
      assert.strictEqual(res.status, 200, `GET /dashboard call #${i + 1} must return 200`);
    }

    const residentsAfter = residentRepo.getMetrics();
    const srAfter        = srRepo.getMetrics();

    assert.deepStrictEqual(
      residentsAfter,
      residentsBefore,
      'Resident aggregate metrics must be identical after 10 GET /dashboard requests'
    );
    assert.deepStrictEqual(
      srAfter,
      srBefore,
      'Service-request aggregate metrics must be identical after 10 GET /dashboard requests'
    );
  });

  await t.test('3b. GET /service-requests with search and status filters does not mutate the database', async () => {
    const before = srRepo.getMetrics();

    await request(app).get('/service-requests?search=anything&status=Pending');
    await request(app).get('/service-requests?search=&status=Completed');
    await request(app).get('/service-requests?search=xyz');

    const after = srRepo.getMetrics();
    assert.deepStrictEqual(
      after,
      before,
      'Service-request metrics must be unchanged after filtered GET /service-requests requests'
    );
  });
});

// ---------------------------------------------------------------------------
// Category 4 – Cross-Feature Regression
//
// Requirement: Deactivating a resident must (a) correctly update the
//   dashboard active/inactive aggregate counts, and (b) prevent that
//   resident from submitting new service requests.
// ---------------------------------------------------------------------------
test('T15-Cat4 – Resident deactivation updates dashboard metrics and blocks new SR submissions', async (t) => {
  const residentRepo = new ResidentRepository();
  const srRepo       = new ServiceRequestRepository();

  // Insert a fresh active resident for this cross-feature test
  const resident = residentRepo.save({
    firstName: 'CrossFeature',
    lastName:  'Cat4Resident',
    address:   '4 Integration Blvd',
    contactNumber: '09444444444',
    email:     'cat4@hardening.test',
    status:    'Active'
  });
  const residentId = resident.id;

  // Capture baseline dashboard metrics immediately after insertion
  const dashService    = new DashboardService(residentRepo, srRepo);
  const beforeSummary  = dashService.getDashboardSummary();
  const activesBefore  = beforeSummary.residents.active;
  const inactivesBefore = beforeSummary.residents.inactive;

  await t.test('4a. The newly-inserted resident is reflected as Active before deactivation', async () => {
    const res = await request(app).get('/dashboard');
    assert.strictEqual(res.status, 200);
    // We only assert the service-layer metrics directly to avoid regex fragility
    assert.ok(
      activesBefore >= 1,
      'There must be at least 1 active resident after inserting our test resident'
    );
  });

  await t.test('4b. POST /residents/:id/deactivate succeeds and redirects to /residents', async () => {
    const res = await request(app).post(`/residents/${residentId}/deactivate`);
    assert.strictEqual(res.status, 302, 'Deactivation of an active resident must redirect (302)');
    assert.strictEqual(res.headers.location, '/residents');
  });

  await t.test('4c. Dashboard active count decreases and inactive count increases by exactly 1', async () => {
    const afterSummary   = dashService.getDashboardSummary();
    const activesAfter   = afterSummary.residents.active;
    const inactivesAfter = afterSummary.residents.inactive;

    assert.strictEqual(
      activesAfter,
      activesBefore - 1,
      'Active resident count must decrease by exactly 1 after deactivation'
    );
    assert.strictEqual(
      inactivesAfter,
      inactivesBefore + 1,
      'Inactive resident count must increase by exactly 1 after deactivation'
    );
  });

  await t.test('4d. Deactivated resident cannot submit a new service request', async () => {
    const res = await request(app).post('/service-requests/new').send({
      residentId:    residentId,
      serviceType:   'Plumbing',
      description:   'Leaky tap',
      dateRequested: '2026-11-13'
    });
    // The submission must be rejected — form re-renders (200) with an Inactive error
    assert.strictEqual(res.status, 200, 'Inactive resident SR submission must be rejected (200 re-render)');
    assert.match(
      res.text,
      /Inactive/i,
      'Response must mention that the resident is inactive'
    );
  });

  // Cleanup: remove the resident and any SRs that may have slipped through
  srRepo.db.prepare('DELETE FROM service_requests WHERE resident_id = ?').run(residentId);
  residentRepo.db.prepare('DELETE FROM residents WHERE id = ?').run(residentId);
});

// ---------------------------------------------------------------------------
// Category 5 – Repeatability / Boundary Condition
//
// Requirement: The dashboard "recent requests" list must always return
//   exactly 5 records when 6 or more service requests exist.  The ordering
//   must be deterministic (date_requested DESC, id DESC) so the oldest
//   record is always excluded from the list.
// ---------------------------------------------------------------------------
test('T15-Cat5 – Recent requests list is capped at exactly 5 and ordered deterministically', async (t) => {
  const residentRepo = new ResidentRepository();
  const srRepo       = new ServiceRequestRepository();
  const dashService  = new DashboardService(residentRepo, srRepo);

  // Insert a dedicated resident to own all 6 test SRs
  const owner = residentRepo.save({
    firstName: 'Boundary',
    lastName:  'Cat5Resident',
    address:   '5 Limit St',
    contactNumber: '09555555555',
    email:     'cat5@hardening.test',
    status:    'Active'
  });
  const ownerId = owner.id;

  // Insert 6 SRs with distinct dates so ordering is deterministic.
  // Dates are in 2027 to ensure these records appear at the top of the global
  // recent list, above any rows left by earlier test suites (which use 2026 dates).
  // sr1 has the oldest date and must be the one excluded from the top-5 list.
  const sr1 = srRepo.save({ residentId: ownerId, serviceType: 'TypeA', description: 'D1', dateRequested: '2027-01-01', status: 'Pending' });
  const sr2 = srRepo.save({ residentId: ownerId, serviceType: 'TypeB', description: 'D2', dateRequested: '2027-02-01', status: 'Pending' });
  const sr3 = srRepo.save({ residentId: ownerId, serviceType: 'TypeC', description: 'D3', dateRequested: '2027-03-01', status: 'Pending' });
  const sr4 = srRepo.save({ residentId: ownerId, serviceType: 'TypeD', description: 'D4', dateRequested: '2027-04-01', status: 'Pending' });
  const sr5 = srRepo.save({ residentId: ownerId, serviceType: 'TypeE', description: 'D5', dateRequested: '2027-05-01', status: 'Pending' });
  const sr6 = srRepo.save({ residentId: ownerId, serviceType: 'TypeF', description: 'D6', dateRequested: '2027-06-01', status: 'Pending' });

  await t.test('5a. findRecent(5) returns exactly 5 records when 6+ exist', async () => {
    const recent = srRepo.findRecent(5);
    assert.strictEqual(
      recent.length,
      5,
      'findRecent(5) must return exactly 5 records regardless of how many exist in the DB'
    );
  });

  await t.test('5b. The oldest record (sr1) is excluded and sr6 is first in the recent list', async () => {
    // Because sr1–sr6 use 2027 dates, they are more recent than any rows left
    // by other test suites (which use 2026 dates).  The top-5 slots are therefore
    // occupied exclusively by sr2–sr6, and sr6 (2027-06-01, the latest date)
    // must occupy position 0.
    const recent = srRepo.findRecent(5);
    const ids = recent.map(r => r.id);

    assert.ok(
      !ids.includes(sr1.id),
      `sr1 (oldest, id=${sr1.id}) must NOT appear in the 5-record recent list`
    );
    assert.strictEqual(
      ids[0],
      sr6.id,
      `sr6 (most recent, id=${sr6.id}) must be first in the recent list`
    );
  });

  await t.test('5c. Calling getDashboardSummary() twice returns the same recent list (repeatability)', async () => {
    const summary1 = dashService.getDashboardSummary();
    const summary2 = dashService.getDashboardSummary();

    // IDs must be identical and in the same order across both calls
    const ids1 = summary1.recentRequests.map(r => r.id);
    const ids2 = summary2.recentRequests.map(r => r.id);

    assert.deepStrictEqual(
      ids1,
      ids2,
      'Two consecutive getDashboardSummary() calls must return identical recent-request ID sequences'
    );
    assert.strictEqual(ids1.length, 5, 'Each call must still cap at 5 records');
  });

  await t.test('5d. Same-date tie is broken by id DESC (higher id appears first)', async () => {
    // Insert two SRs with the same date — the one with the higher id must appear first
    const tieA = srRepo.save({ residentId: ownerId, serviceType: 'TieA', description: 'TieA', dateRequested: '2027-12-01', status: 'Pending' });
    const tieB = srRepo.save({ residentId: ownerId, serviceType: 'TieB', description: 'TieB', dateRequested: '2027-12-01', status: 'Pending' });

    const recent = srRepo.findRecent(5);
    const ids    = recent.map(r => r.id);

    const posA = ids.indexOf(tieA.id);
    const posB = ids.indexOf(tieB.id);

    // tieB has a higher id, so it must appear before tieA when dates are equal
    assert.ok(posB < posA, `tieB (id=${tieB.id}) must appear before tieA (id=${tieA.id}) due to id DESC tie-breaking`);

    // Cleanup tie rows
    srRepo.db.prepare('DELETE FROM service_requests WHERE id = ? OR id = ?').run(tieA.id, tieB.id);
  });

  // Cleanup the 6 boundary SRs and owner resident
  srRepo.db.prepare('DELETE FROM service_requests WHERE id IN (?,?,?,?,?,?)').run(sr1.id, sr2.id, sr3.id, sr4.id, sr5.id, sr6.id);
  residentRepo.db.prepare('DELETE FROM residents WHERE id = ?').run(ownerId);
});
