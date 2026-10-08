import assert from 'node:assert';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { ServiceRequest } from '../src/models/ServiceRequest.js';
import { ServiceRequestRepository } from '../src/repositories/ServiceRequestRepository.js';
import { ServiceRequestStatusService } from '../src/services/ServiceRequestStatusService.js';

describe('T10 - Manage Service Request Status', () => {
  let db;
  let repo;
  let statusService;

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    db.exec(`
      CREATE TABLE service_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        resident_id INTEGER NOT NULL,
        service_type TEXT NOT NULL,
        description TEXT NOT NULL,
        date_requested TEXT NOT NULL,
        status TEXT NOT NULL
      );
    `);
    repo = new ServiceRequestRepository(db);
    statusService = new ServiceRequestStatusService(repo);
  });

  afterEach(() => {
    db.close();
  });

  const seedRequest = (status = 'Pending') => {
    return repo.save(new ServiceRequest({ residentId: 1, serviceType: 'Test', description: 'ACID test', dateRequested: '2026-10-01', status }));
  };

  it('Test 1 - Pending Can Move to In Progress', () => {
    const req = seedRequest('Pending');
    const result = statusService.updateStatus(req.id, 'In Progress');
    assert.strictEqual(result.status, 'In Progress');
  });

  it('Test 2 - Pending Can Move to Cancelled', () => {
    const req = seedRequest('Pending');
    const result = statusService.updateStatus(req.id, 'Cancelled');
    assert.strictEqual(result.status, 'Cancelled');
  });

  it('Test 3 - In Progress Can Move to Completed', () => {
    const req = seedRequest('In Progress');
    const result = statusService.updateStatus(req.id, 'Completed');
    assert.strictEqual(result.status, 'Completed');
  });

  it('Test 4 - In Progress Can Move to Cancelled', () => {
    const req = seedRequest('In Progress');
    const result = statusService.updateStatus(req.id, 'Cancelled');
    assert.strictEqual(result.status, 'Cancelled');
  });

  it('Test 5 - Pending Cannot Move Directly to Completed', () => {
    const req = seedRequest('Pending');
    assert.throws(() => statusService.updateStatus(req.id, 'Completed'), /INVALID_TRANSITION/);
    assert.strictEqual(repo.findById(req.id).status, 'Pending');
  });

  it('Test 6 - In Progress Cannot Return to Pending', () => {
    const req = seedRequest('In Progress');
    assert.throws(() => statusService.updateStatus(req.id, 'Pending'), /INVALID_TRANSITION/);
    assert.strictEqual(repo.findById(req.id).status, 'In Progress');
  });

  it('Test 7 - Completed Is Terminal', () => {
    const req = seedRequest('Completed');
    assert.throws(() => statusService.updateStatus(req.id, 'In Progress'), /INVALID_TRANSITION/);
    assert.strictEqual(repo.findById(req.id).status, 'Completed');
  });

  it('Test 8 - Cancelled Is Terminal', () => {
    const req = seedRequest('Cancelled');
    assert.throws(() => statusService.updateStatus(req.id, 'Pending'), /INVALID_TRANSITION/);
    assert.strictEqual(repo.findById(req.id).status, 'Cancelled');
  });

  it('Test 9 - Unsupported Status Is Rejected', () => {
    const req = seedRequest('Pending');
    assert.throws(() => statusService.updateStatus(req.id, 'Approved'), /UNSUPPORTED_STATUS/);
  });

  it('Test 10 - Nonexistent Service Request Is Handled Safely', () => {
    assert.throws(() => statusService.updateStatus(999, 'In Progress'), /NOT_FOUND/);
  });

  it('Test 11 - Successful Transition Preserves Service Request Information', () => {
    const req = seedRequest('Pending');
    const result = statusService.updateStatus(req.id, 'In Progress');
    assert.strictEqual(result.description, 'ACID test');
    assert.strictEqual(result.residentId, 1);
  });

  it('Test 12 - Invalid Transition Does Not Modify Persistence', () => {
    const req = seedRequest('Pending');
    assert.throws(() => statusService.updateStatus(req.id, 'Completed'), /INVALID_TRANSITION/);
    assert.strictEqual(repo.findById(req.id).status, 'Pending');
  });

  it('Test 13 - Same-Status Request Is Rejected', () => {
    const req = seedRequest('Pending');
    assert.throws(() => statusService.updateStatus(req.id, 'Pending'), /INVALID_TRANSITION/);
  });

  it('Test 14 - Student-Designed Test: Repeated Spam Clicks Are Handled Safely', () => {
    const req = seedRequest('Pending');
    
    // First click succeeds
    statusService.updateStatus(req.id, 'Cancelled');
    assert.strictEqual(repo.findById(req.id).status, 'Cancelled');
    
    // Subsequent simulated spam clicks throw errors and don't touch the DB
    assert.throws(() => statusService.updateStatus(req.id, 'Cancelled'), /INVALID_TRANSITION/);
    assert.throws(() => statusService.updateStatus(req.id, 'Cancelled'), /INVALID_TRANSITION/);
    assert.strictEqual(repo.findById(req.id).status, 'Cancelled');
  });
});