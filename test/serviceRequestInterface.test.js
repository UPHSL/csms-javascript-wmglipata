import test from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { ResidentRepository } from '../src/repositories/ResidentRepository.js';

test('T13 - Service Request Management Interface', async (t) => {
  const app = createApp();
  let activeResidentId;
  let inactiveResidentId;
  let pendingSrId;
  let inProgressSrId;

  await t.test('0. Setup - Seed Data Safely', async () => {
    const repo = new ResidentRepository();
    const activeRes = repo.save({ 
      firstName: 'Active', lastName: 'User', address: '123', contactNumber: '09123456789', email: 'a@test.com', status: 'Active' 
    });
    activeResidentId = activeRes.id;

    const inactiveRes = repo.save({ 
      firstName: 'Inactive', lastName: 'User', address: '456', contactNumber: '09123456780', email: 'i@test.com', status: 'Inactive' 
    });
    inactiveResidentId = inactiveRes.id;
  });

  await t.test('1. GET /service-requests loads the management page', async () => {
    const res = await request(app).get('/service-requests');
    assert.strictEqual(res.status, 200);
    assert.match(res.text, /Service Request Management/);
  });

  await t.test('2. GET /service-requests/new is accessible and lacks manual status/ID fields', async () => {
    const res = await request(app).get('/service-requests/new');
    assert.strictEqual(res.status, 200);
    assert.match(res.text, /residentId/);
    assert.doesNotMatch(res.text, /<input[^>]*name="status"/);
  });

  await t.test('3. POST /service-requests/new persists a valid Pending request', async () => {
    const res = await request(app).post('/service-requests/new').send({
      residentId: activeResidentId, serviceType: 'Plumbing13', description: 'Leaky pipe', dateRequested: '2026-11-13'
    });
    assert.strictEqual(res.status, 302, 'Should redirect to /service-requests on success');
  });

  await t.test('4. GET /service-requests displays persisted requests', async () => {
    const res = await request(app).get('/service-requests');
    assert.strictEqual(res.status, 200);
    assert.match(res.text, /Plumbing13/);
    
    const regex = new RegExp(`<td>(\\d+)<\\/td>\\s*<td>${activeResidentId}<\\/td>\\s*<td>Plumbing13<\\/td>`);
    const idMatch = res.text.match(regex);
    pendingSrId = idMatch ? parseInt(idMatch[1], 10) : 1;
  });

  await t.test('5. Ordering is preserved (dateRequested DESC, id DESC)', async () => {
    await request(app).post('/service-requests/new').send({
      residentId: activeResidentId, serviceType: 'Electrical13', description: 'Rewiring', dateRequested: '2026-11-14'
    });
    const res = await request(app).get('/service-requests');
    const electricalIndex = res.text.indexOf('Electrical13');
    const plumbingIndex = res.text.indexOf('Plumbing13');
    assert.ok(electricalIndex < plumbingIndex, 'Electrical should be sorted above Plumbing');
  });

  await t.test('6. Text search uses T11 behavior', async () => {
    const res = await request(app).get('/service-requests?search=Plumbing13');
    assert.match(res.text, /Plumbing13/);
    assert.doesNotMatch(res.text, /<td>Electrical13<\/td>/);
  });

  await t.test('7. Status filter uses T11 behavior', async () => {
    const res = await request(app).get('/service-requests?status=Pending');
    assert.match(res.text, /Plumbing13/);
  });

  await t.test('8. Combined text and status filter works', async () => {
    const res = await request(app).get('/service-requests?search=Plumbing13&status=Pending');
    assert.match(res.text, /Plumbing13/);
    const resEmpty = await request(app).get('/service-requests?search=Electrical13&status=Completed');
    assert.doesNotMatch(resEmpty.text, /<td>Electrical13<\/td>/);
  });

  await t.test('9. Invalid submission shows validation feedback safely', async () => {
    const res = await request(app).post('/service-requests/new').send({
      residentId: activeResidentId, serviceType: '', description: 'Leaky pipe', dateRequested: '2026-11-13'
    });
    assert.strictEqual(res.status, 200);
    assert.match(res.text, /Submission Failed/);
  });

  await t.test('10. Missing Resident submission is rejected', async () => {
    const res = await request(app).post('/service-requests/new').send({
      residentId: 999999, serviceType: 'Test', description: 'Test', dateRequested: '2026-11-13'
    });
    assert.strictEqual(res.status, 200);
    assert.match(res.text, /not found/i);
  });

  await t.test('11. Inactive Resident submission is rejected', async () => {
    const res = await request(app).post('/service-requests/new').send({
      residentId: inactiveResidentId, serviceType: 'Test', description: 'Test', dateRequested: '2026-11-13'
    });
    assert.strictEqual(res.status, 200);
    assert.match(res.text, /Inactive/i);
  });

  await t.test('12. Existing Service Request Details can be viewed', async () => {
    const res = await request(app).get(`/service-requests/${pendingSrId}`);
    assert.strictEqual(res.status, 200);
    assert.match(res.text, /Plumbing13/);
  });

  await t.test('13. Missing Service Request View is handled safely', async () => {
    const res = await request(app).get('/service-requests/999999');
    assert.strictEqual(res.status, 404);
  });

  await t.test('14. Pending Request can Start Processing', async () => {
    const res = await request(app).post(`/service-requests/${pendingSrId}/start`);
    assert.strictEqual(res.status, 302);
    
    const viewRes = await request(app).get(`/service-requests/${pendingSrId}`);
    assert.match(viewRes.text, /In Progress/);
    inProgressSrId = pendingSrId;
  });

  await t.test('15. Pending Request can be Cancelled', async () => {
    await request(app).post('/service-requests/new').send({
      residentId: activeResidentId, serviceType: 'CancelMeNow', description: 'Test', dateRequested: '2026-11-13'
    });
    
    const listRes = await request(app).get('/service-requests');
    // More robust regex to capture the ID
    const match = listRes.text.match(/<td>\s*(\d+)\s*<\/td>\s*<td>\s*\d+\s*<\/td>\s*<td>CancelMeNow<\/td>/);
    const cancelId = match ? parseInt(match[1], 10) : null;
    assert.ok(cancelId, 'Could not find the new Service Request ID');

    await request(app).post(`/service-requests/${cancelId}/cancel`); 
    const viewRes = await request(app).get(`/service-requests/${cancelId}`);
    assert.match(viewRes.text, /Cancelled/);
  });

  await t.test('16. In-Progress Request can be Completed', async () => {
    await request(app).post(`/service-requests/${inProgressSrId}/complete`);
    const viewRes = await request(app).get(`/service-requests/${inProgressSrId}`);
    assert.match(viewRes.text, /Completed/);
  });

  await t.test('17. In-Progress Request can be Cancelled', async () => {
    await request(app).post('/service-requests/new').send({
      residentId: activeResidentId, serviceType: 'StartThenCancel', description: 'Test', dateRequested: '2026-11-13'
    });
    
    const listRes = await request(app).get('/service-requests');
    const match = listRes.text.match(/<td>\s*(\d+)\s*<\/td>\s*<td>\s*\d+\s*<\/td>\s*<td>StartThenCancel<\/td>/);
    const cancelId = match ? parseInt(match[1], 10) : null;
    assert.ok(cancelId, 'Could not find the new Service Request ID');

    await request(app).post(`/service-requests/${cancelId}/start`); 
    await request(app).post(`/service-requests/${cancelId}/cancel`); 
    
    const viewRes = await request(app).get(`/service-requests/${cancelId}`);
    assert.match(viewRes.text, /Cancelled/);
  });

  await t.test('18. Invalid direct transition is rejected', async () => {
    const res = await request(app).post(`/service-requests/${inProgressSrId}/start`);
    assert.strictEqual(res.status, 302);
    // Should still be Completed because it was completed in test 16
    const viewRes = await request(app).get(`/service-requests/${inProgressSrId}`);
    assert.match(viewRes.text, /Completed/);
  });

  await t.test('19. Completed and Cancelled requests remain visible', async () => {
    const res = await request(app).get('/service-requests');
    assert.match(res.text, /Completed/);
    assert.match(res.text, /Cancelled/);
  });

  await t.test('20. GET requests do not change state', async () => {
    const res = await request(app).get(`/service-requests/${inProgressSrId}`);
    assert.strictEqual(res.status, 200);
  });
});