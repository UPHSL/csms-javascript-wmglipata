import test from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { ResidentRepository } from '../src/repositories/ResidentRepository.js';
import { ServiceRequestRepository } from '../src/repositories/ServiceRequestRepository.js';

test('T14 - CSMS Dashboard and Aggregate Reporting', async (t) => {
  const app = createApp();
  const residentRepo = new ResidentRepository();
  const srRepo = new ServiceRequestRepository();
  
  // Clear the database safely for isolated dashboard testing
  residentRepo.db.prepare('DELETE FROM service_requests').run();
  residentRepo.db.prepare('DELETE FROM residents').run();

  await t.test('Test 2 - Empty Dashboard Displays Zero Counts', async () => {
    const res = await request(app).get('/dashboard');
    assert.strictEqual(res.status, 200);
    // Residents
    assert.match(res.text, /Total[\s\S]*?0/);
    assert.match(res.text, /Active[\s\S]*?0/);
    assert.match(res.text, /Inactive[\s\S]*?0/);
    // Service Requests
    assert.match(res.text, /Open Requests[\s\S]*?0/);
    assert.match(res.text, /No Service Requests available/);
  });

  let activeRes1, activeRes2, inactiveRes;
  let sr1, sr2, sr3, sr4, sr5, sr6;

  await t.test('Setup - Seed Dashboard Data', () => {
    activeRes1 = residentRepo.save({ firstName: 'A1', lastName: 'L1', address: '123', contactNumber: '0912', email: 'a@a.com', status: 'Active' });
    activeRes2 = residentRepo.save({ firstName: 'A2', lastName: 'L2', address: '123', contactNumber: '0912', email: 'b@b.com', status: 'Active' });
    inactiveRes = residentRepo.save({ firstName: 'I1', lastName: 'L3', address: '123', contactNumber: '0912', email: 'c@c.com', status: 'Inactive' });

    sr1 = srRepo.save({ residentId: activeRes1.id, serviceType: 'T1', description: 'D1', dateRequested: '2026-10-01', status: 'Pending' });
    sr2 = srRepo.save({ residentId: activeRes1.id, serviceType: 'T2', description: 'D2', dateRequested: '2026-10-02', status: 'In Progress' });
    sr3 = srRepo.save({ residentId: activeRes2.id, serviceType: 'T3', description: 'D3', dateRequested: '2026-10-03', status: 'Completed' });
    sr4 = srRepo.save({ residentId: activeRes2.id, serviceType: 'T4', description: 'D4', dateRequested: '2026-10-04', status: 'Cancelled' });
    sr5 = srRepo.save({ residentId: activeRes1.id, serviceType: 'T5', description: 'D5', dateRequested: '2026-10-05', status: 'Pending' });
    sr6 = srRepo.save({ residentId: activeRes2.id, serviceType: 'T6', description: 'D6', dateRequested: '2026-10-05', status: 'Completed' }); 
  });

  await t.test('Test 1 - Dashboard Loads Successfully', async () => {
    const res = await request(app).get('/dashboard');
    assert.strictEqual(res.status, 200);
    assert.match(res.text, /CSMS Dashboard/);
  });

  await t.test('Test 3 & 4 - Resident Counts are Correct (Total = Active + Inactive)', async () => {
    const res = await request(app).get('/dashboard');
    assert.match(res.text, /Total[\s\S]*?3/);
    assert.match(res.text, /Active[\s\S]*?2/);
    assert.match(res.text, /Inactive[\s\S]*?1/);
  });

  await t.test('Test 5, 6, & 7 - Service Request Counts are Correct and Reconcile', async () => {
    const res = await request(app).get('/dashboard');
    assert.match(res.text, /Total[\s\S]*?6/);
    assert.match(res.text, /Pending[\s\S]*?2/);
    assert.match(res.text, /In Progress[\s\S]*?1/);
    assert.match(res.text, /Completed[\s\S]*?2/);
    assert.match(res.text, /Cancelled[\s\S]*?1/);
  });

  await t.test('Test 8 - Open Request Count Is Correct (Pending + In Progress)', async () => {
    const res = await request(app).get('/dashboard');
    assert.match(res.text, /Open Requests[\s\S]*?3/);
  });

  await t.test('Test 9 - Resident Deactivation Is Reflected', async () => {
    residentRepo.db.prepare("UPDATE residents SET status = 'Inactive' WHERE id = ?").run(activeRes2.id);
    const res = await request(app).get('/dashboard');
    assert.match(res.text, /Total[\s\S]*?3/); 
    assert.match(res.text, /Active[\s\S]*?1/); 
    assert.match(res.text, /Inactive[\s\S]*?2/); 
  });

  await t.test('Test 10 - Service Request Transition Is Reflected', async () => {
    srRepo.updateStatus(sr1.id, 'In Progress');
    const res = await request(app).get('/dashboard');
    assert.match(res.text, /Pending[\s\S]*?1/); 
    assert.match(res.text, /In Progress[\s\S]*?2/); 
  });

  await t.test('Test 11 - Terminal Transition Updates Open Count', async () => {
    srRepo.updateStatus(sr2.id, 'Completed');
    const res = await request(app).get('/dashboard');
    assert.match(res.text, /In Progress[\s\S]*?1/); 
    assert.match(res.text, /Completed[\s\S]*?3/); 
    assert.match(res.text, /Open Requests[\s\S]*?2/);
  });

  await t.test('Test 12 & 14 - Recent Requests Limit is 5 and Includes Terminal States', async () => {
    const res = await request(app).get('/dashboard');
    assert.doesNotMatch(res.text, new RegExp(`>\\s*${sr1.id}\\s*</td>[\\s\\S]*?T1`));
    assert.match(res.text, new RegExp(`>\\s*${sr6.id}\\s*</td>[\\s\\S]*?Completed`));
    assert.match(res.text, new RegExp(`>\\s*${sr4.id}\\s*</td>[\\s\\S]*?Cancelled`));
  });

  await t.test('Test 13 - Recent Requests Use Correct Ordering (date DESC, id DESC)', async () => {
    const res = await request(app).get('/dashboard');
    const match6 = res.text.match(new RegExp(`>\\s*${sr6.id}\\s*</td>`));
    const match5 = res.text.match(new RegExp(`>\\s*${sr5.id}\\s*</td>`));
    const match4 = res.text.match(new RegExp(`>\\s*${sr4.id}\\s*</td>`));
    
    assert.ok(match6 && match5 && match4, 'Could not find all required IDs in the HTML');
    assert.ok(match6.index < match5.index, 'SR6 should appear before SR5 due to ID tie-breaker');
    assert.ok(match5.index < match4.index, 'SR5 should appear before SR4 due to Date');
  });

  await t.test('Test 15 - Dashboard GET Does Not Modify Persistence', async () => {
    const beforeMetrics = srRepo.getMetrics();
    await request(app).get('/dashboard');
    await request(app).get('/dashboard');
    const afterMetrics = srRepo.getMetrics();
    assert.deepStrictEqual(beforeMetrics, afterMetrics);
  });
});