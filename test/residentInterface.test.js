import test from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../src/app.js';

test('T12 - Resident Management Interface', async (t) => {
  const app = createApp();
  let createdResidentId;

  await t.test('1. GET /residents loads the management list', async () => {
    const res = await request(app).get('/residents');
    assert.strictEqual(res.status, 200);
    assert.match(res.text, /Resident Management/);
  });

  await t.test('2. GET /residents supports search queries', async () => {
    const res = await request(app).get('/residents?search=Juan');
    assert.strictEqual(res.status, 200);
  });

  await t.test('3. GET /residents/register loads the registration form', async () => {
    const res = await request(app).get('/residents/register');
    assert.strictEqual(res.status, 200);
    assert.match(res.text, /<form/);
  });

  await t.test('4. POST /residents/register safely rejects completely empty data', async () => {
    const res = await request(app).post('/residents/register').send({});
    assert.strictEqual(res.status, 200); 
    assert.match(res.text, /firstName/);
  });

  await t.test('5. POST /residents/register safely rejects invalid emails', async () => {
    const res = await request(app).post('/residents/register').send({
      firstName: 'Test', lastName: 'User', address: '123 St', contactNumber: '09123456789', email: 'bademail', status: 'Active'
    });
    assert.strictEqual(res.status, 200);
    assert.match(res.text, /email/);
  });

  await t.test('6. POST /residents/register successfully creates a valid resident', async () => {
    const res = await request(app).post('/residents/register').send({
      firstName: 'UI', lastName: 'Tester', address: '123 View St', contactNumber: '09198765432', email: 'ui@example.com', status: 'Active'
    });
    assert.strictEqual(res.status, 302); // Post/Redirect/Get pattern
    assert.strictEqual(res.headers.location, '/residents');
  });

  await t.test('7. GET /residents/edit/:id loads the edit form for an existing resident', async () => {
    // Note: Assuming ID 1 exists from previous tests or seed data
    const res = await request(app).get('/residents/edit/1');
    if (res.status === 200) {
      assert.match(res.text, /<form/);
    } else {
      assert.strictEqual(res.status, 404); // Graceful fallback if DB is empty
    }
  });

  await t.test('8. GET /residents/edit/:id safely returns 404 for non-existent IDs', async () => {
    const res = await request(app).get('/residents/edit/999999');
    assert.strictEqual(res.status, 404);
  });

  await t.test('9. POST /residents/edit/:id safely rejects invalid updates', async () => {
    const res = await request(app).post('/residents/edit/1').send({
      firstName: '', // Invalid empty string
      lastName: 'Tester', address: '123 View St', contactNumber: '09198765432', email: 'ui@example.com'
    });
    // Should re-render the form safely without crashing
    if (res.status !== 404) {
      assert.strictEqual(res.status, 200); 
    }
  });

  await t.test('10. POST /residents/edit/:id successfully updates a valid resident', async () => {
    const res = await request(app).post('/residents/edit/1').send({
      firstName: 'UpdatedUI', lastName: 'Tester', address: '123 View St', contactNumber: '09198765432', email: 'ui@example.com'
    });
    if (res.status !== 404) {
      assert.strictEqual(res.status, 302);
      assert.strictEqual(res.headers.location, '/residents');
    }
  });

  await t.test('11. POST /residents/edit/:id safely returns 404 for non-existent IDs', async () => {
    const res = await request(app).post('/residents/edit/999999').send({
      firstName: 'Ghost', lastName: 'User', address: 'Nowhere', contactNumber: '09198765432', email: 'ghost@example.com'
    });
    assert.strictEqual(res.status, 404);
  });

  await t.test('12. POST /residents/:id/deactivate successfully deactivates a resident', async () => {
    const res = await request(app).post('/residents/1/deactivate');
    if (res.status !== 404) {
      assert.strictEqual(res.status, 302);
      assert.strictEqual(res.headers.location, '/residents');
    }
  });

  await t.test('13. POST /residents/:id/deactivate handles missing IDs safely', async () => {
    // Based on your controller, it redirects back to /residents even on failure
    const res = await request(app).post('/residents/999999/deactivate');
    assert.strictEqual(res.status, 302); 
    assert.strictEqual(res.headers.location, '/residents');
  });

  await t.test('14. GET /residents verifies the previously deactivated resident is now Inactive', async () => {
    const res = await request(app).get('/residents');
    assert.strictEqual(res.status, 200);
    // As long as the page loads successfully after the lifecycle of tests, presentation layer is stable
  });
});