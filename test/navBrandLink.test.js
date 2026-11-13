/**
 * T17 – Navbar Brand Link
 *
 * Asserts that the "CSMS" brand element in the shared navigation bar contains
 * an anchor element whose href is exactly "/" on every page that renders the
 * navbar.  Also verifies that GET "/" returns HTTP 200.
 *
 * Pages checked (read-only GET requests, no mutations):
 *   - GET /             – starter home page (no navbar, but must return 200)
 *   - GET /dashboard    – Dashboard
 *   - GET /residents    – Resident Management list
 *   - GET /residents/register – Register Resident form
 *   - GET /service-requests  – Service Request Management list
 *   - GET /service-requests/new – Submit Service Request form
 *
 * For the detail pages (/residents/:id/edit and /service-requests/:id) a
 * synthetic fixture is inserted and immediately removed so the test never
 * relies on pre-existing dev-database state.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { ResidentRepository } from '../src/repositories/ResidentRepository.js';
import { ServiceRequestRepository } from '../src/repositories/ServiceRequestRepository.js';

// Regex that matches <a href="/">…</a> containing the word CSMS.
// Accepts optional surrounding whitespace and additional attributes.
const BRAND_LINK_RE = /<a\s[^>]*href="\/"[^>]*>\s*CSMS\s*<\/a>/;

test('T17 – Navbar brand "CSMS" links to "/" on every page', async (t) => {
  const app = createApp();

  // -------------------------------------------------------------------------
  // Fixture setup: one resident + one service request so detail pages render
  // -------------------------------------------------------------------------
  const residentRepo = new ResidentRepository();
  const srRepo = new ServiceRequestRepository();

  let fixtureResidentId = null;
  let fixtureSrId = null;

  const fixtureResident = residentRepo.save({
    firstName:     'NavBrand',
    lastName:      'Fixture',
    address:       '1 Test Street',
    contactNumber: '09170000001',
    email:         'navbrand@csms.test',
    status:        'Active',
  });
  fixtureResidentId = fixtureResident.id;

  const fixtureSr = srRepo.save({
    residentId:    fixtureResidentId,
    serviceType:   'NavBrandFixture',
    description:   'Created for T17 nav brand link test',
    dateRequested: '2026-11-13',
    status:        'Pending',
  });
  fixtureSrId = fixtureSr.id;

  // -------------------------------------------------------------------------
  // Core pages
  // -------------------------------------------------------------------------

  await t.test('GET / returns HTTP 200', async () => {
    const res = await request(app).get('/');
    assert.equal(res.status, 200, 'Home page must return HTTP 200');
  });

  await t.test('GET /dashboard – brand link href is "/"', async () => {
    const res = await request(app).get('/dashboard');
    assert.equal(res.status, 200);
    assert.match(
      res.text,
      BRAND_LINK_RE,
      'Dashboard navbar must contain <a href="/">CSMS</a>',
    );
  });

  await t.test('GET /residents – brand link href is "/"', async () => {
    const res = await request(app).get('/residents');
    assert.equal(res.status, 200);
    assert.match(
      res.text,
      BRAND_LINK_RE,
      'Residents list navbar must contain <a href="/">CSMS</a>',
    );
  });

  await t.test('GET /residents/register – brand link href is "/"', async () => {
    const res = await request(app).get('/residents/register');
    assert.equal(res.status, 200);
    assert.match(
      res.text,
      BRAND_LINK_RE,
      'Register Resident navbar must contain <a href="/">CSMS</a>',
    );
  });

  await t.test('GET /residents/:id/edit (detail page) – brand link href is "/"', async () => {
    const res = await request(app).get(`/residents/${fixtureResidentId}/edit`);
    assert.equal(res.status, 200);
    assert.match(
      res.text,
      BRAND_LINK_RE,
      'Edit Resident navbar must contain <a href="/">CSMS</a>',
    );
  });

  await t.test('GET /service-requests – brand link href is "/"', async () => {
    const res = await request(app).get('/service-requests');
    assert.equal(res.status, 200);
    assert.match(
      res.text,
      BRAND_LINK_RE,
      'Service Requests list navbar must contain <a href="/">CSMS</a>',
    );
  });

  await t.test('GET /service-requests/new – brand link href is "/"', async () => {
    const res = await request(app).get('/service-requests/new');
    assert.equal(res.status, 200);
    assert.match(
      res.text,
      BRAND_LINK_RE,
      'New Service Request navbar must contain <a href="/">CSMS</a>',
    );
  });

  await t.test('GET /service-requests/:id (detail page) – brand link href is "/"', async () => {
    const res = await request(app).get(`/service-requests/${fixtureSrId}`);
    assert.equal(res.status, 200);
    assert.match(
      res.text,
      BRAND_LINK_RE,
      'Service Request detail navbar must contain <a href="/">CSMS</a>',
    );
  });

  // -------------------------------------------------------------------------
  // Cleanup: remove every row this test inserted
  // -------------------------------------------------------------------------
  if (fixtureSrId !== null) {
    srRepo.db.prepare('DELETE FROM service_requests WHERE id = ?').run(fixtureSrId);
  }
  if (fixtureResidentId !== null) {
    residentRepo.db.prepare('DELETE FROM residents WHERE id = ?').run(fixtureResidentId);
  }
});
