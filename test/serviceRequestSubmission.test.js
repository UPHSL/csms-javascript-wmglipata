import assert from 'node:assert';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { Resident } from '../src/models/Resident.js';
import { ServiceRequest } from '../src/models/ServiceRequest.js';
import { ResidentRepository } from '../src/repositories/ResidentRepository.js';
import { ServiceRequestRepository } from '../src/repositories/ServiceRequestRepository.js';
import { ServiceRequestValidator } from '../src/services/ServiceRequestValidator.js';
import { ServiceRequestSubmissionService } from '../src/services/ServiceRequestSubmissionService.js';

describe('T09 - Validate and Submit Service Requests', () => {
  let db;
  let residentRepo;
  let serviceRequestRepo;
  let submissionService;
  let activeResident;
  let inactiveResident;

  beforeEach(() => {
    // 1. Setup in-memory DB for isolated tests
    db = new DatabaseSync(':memory:');
    db.exec(`
      CREATE TABLE residents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        address TEXT NOT NULL,
        contact_number TEXT NOT NULL,
        email TEXT NOT NULL,
        status TEXT NOT NULL
      );
      CREATE TABLE service_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        resident_id INTEGER NOT NULL,
        service_type TEXT NOT NULL,
        description TEXT NOT NULL,
        date_requested TEXT NOT NULL,
        status TEXT NOT NULL
      );
    `);

    residentRepo = new ResidentRepository(db);
    serviceRequestRepo = new ServiceRequestRepository(db);
    submissionService = new ServiceRequestSubmissionService(
      new ServiceRequestValidator(),
      residentRepo,
      serviceRequestRepo
    );

    // 2. Insert test residents
    activeResident = residentRepo.save(new Resident({
      firstName: 'Active',
      lastName: 'Resident',
      address: '123 Main St',
      contactNumber: '09171234567',
      email: 'active@example.com',
      status: 'Active'
    }));

    inactiveResident = residentRepo.save(new Resident({
      firstName: 'Inactive',
      lastName: 'Resident',
      address: '456 Old St',
      contactNumber: '09181234567',
      email: 'inactive@example.com',
      status: 'Inactive'
    }));
  });

  afterEach(() => {
    db.close();
  });

  // Helper to count service requests in DB
  const getRequestCount = () => {
    return db.prepare('SELECT COUNT(*) as count FROM service_requests').get().count;
  };

  it('Test 1 - Valid Service Request Submission Succeeds', () => {
    const request = new ServiceRequest({
      residentId: activeResident.id,
      serviceType: 'Barangay Clearance',
      description: 'For employment',
      dateRequested: '2026-09-28'
    });

    const result = submissionService.submit(request);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.errors.length, 0);
  });

  it('Test 2 - Submitted Service Request Receives a Generated ID', () => {
    const request = new ServiceRequest({ residentId: activeResident.id, serviceType: 'Clearance', description: 'Test', dateRequested: '2026-09-28' });
    assert.strictEqual(request.id, null);

    const result = submissionService.submit(request);
    assert.ok(result.serviceRequest.id > 0, 'Persistence must generate an ID');
  });

  it('Test 3 - Submitted Service Request Is Persisted and Retrievable', () => {
    const request = new ServiceRequest({ residentId: activeResident.id, serviceType: 'Clearance', description: 'Test', dateRequested: '2026-09-28' });
    const result = submissionService.submit(request);
    
    const retrieved = serviceRequestRepo.findById(result.serviceRequest.id);
    assert.ok(retrieved, 'Should be retrievable from persistence');
  });

  it('Test 4 - Submitted Service Request Information Is Preserved', () => {
    const request = new ServiceRequest({ residentId: activeResident.id, serviceType: 'Permit Request', description: 'House renovation', dateRequested: '2026-09-28' });
    const result = submissionService.submit(request);
    const retrieved = serviceRequestRepo.findById(result.serviceRequest.id);

    assert.strictEqual(retrieved.residentId, activeResident.id);
    assert.strictEqual(retrieved.serviceType, 'Permit Request');
    assert.strictEqual(retrieved.description, 'House renovation');
    assert.strictEqual(retrieved.dateRequested, '2026-09-28');
  });

  it('Test 5 - Submitted Service Request Status Is Pending', () => {
    const request = new ServiceRequest({ residentId: activeResident.id, serviceType: 'Test', description: 'Test', dateRequested: '2026-09-28' });
    const result = submissionService.submit(request);
    
    const retrieved = serviceRequestRepo.findById(result.serviceRequest.id);
    assert.strictEqual(retrieved.status, 'Pending');
  });

  it('Test 6 - Blank Service Type Fails Validation', () => {
    const request = new ServiceRequest({ residentId: activeResident.id, serviceType: '   ', description: 'Test', dateRequested: '2026-09-28' });
    const result = submissionService.submit(request);
    
    assert.strictEqual(result.success, false);
    assert.ok(result.errors.includes('serviceType'));
  });

  it('Test 7 - Blank Description Fails Validation', () => {
    const request = new ServiceRequest({ residentId: activeResident.id, serviceType: 'Clearance', description: '', dateRequested: '2026-09-28' });
    const result = submissionService.submit(request);
    
    assert.strictEqual(result.success, false);
    assert.ok(result.errors.includes('description'));
  });

  it('Test 8 - Invalid Request Does Not Reach Persistence', () => {
    const request = new ServiceRequest({ residentId: activeResident.id, serviceType: '', description: '', dateRequested: '2026-09-28' });
    const countBefore = getRequestCount();
    
    submissionService.submit(request);
    const countAfter = getRequestCount();
    
    assert.strictEqual(countAfter, countBefore, 'Count should remain unchanged');
  });

  it('Test 9 - Nonexistent Resident Prevents Submission', () => {
    const request = new ServiceRequest({ residentId: 9999, serviceType: 'Clearance', description: 'Test', dateRequested: '2026-09-28' });
    const result = submissionService.submit(request);
    
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.residentNotFound, true);
    assert.strictEqual(getRequestCount(), 0);
  });

  it('Test 10 - Inactive Resident Cannot Submit a New Service Request', () => {
    const request = new ServiceRequest({ residentId: inactiveResident.id, serviceType: 'Clearance', description: 'Test', dateRequested: '2026-09-28' });
    const result = submissionService.submit(request);
    
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.residentInactive, true);
    assert.strictEqual(getRequestCount(), 0);
  });

  it('Test 11 - Non-Pending Initial Status Is Rejected', () => {
    const request = new ServiceRequest({ residentId: activeResident.id, serviceType: 'Clearance', description: 'Test', dateRequested: '2026-09-28', status: 'Completed' });
    const result = submissionService.submit(request);
    
    assert.strictEqual(result.success, false);
    assert.ok(result.errors.includes('status'));
  });

  it('Test 12 - Service Request Persists Across Repository Access', () => {
    const request = new ServiceRequest({ residentId: activeResident.id, serviceType: 'Clearance', description: 'Test', dateRequested: '2026-09-28' });
    const result = submissionService.submit(request);
    
    // Create a totally new repository instance pointing to the same DB
    const newRepoInstance = new ServiceRequestRepository(db);
    const retrieved = newRepoInstance.findById(result.serviceRequest.id);
    
    assert.ok(retrieved);
  });

  it('Test 13 - Submission Does Not Modify the Resident', () => {
    const request = new ServiceRequest({ residentId: activeResident.id, serviceType: 'Clearance', description: 'Test', dateRequested: '2026-09-28' });
    submissionService.submit(request);
    
    const retrievedResident = residentRepo.findById(activeResident.id);
    assert.strictEqual(retrievedResident.status, 'Active');
    assert.strictEqual(retrievedResident.firstName, 'Active');
  });

  it('Test 14 - Invalid Date Format Is Rejected', () => {
    const request = new ServiceRequest({ residentId: activeResident.id, serviceType: 'Clearance', description: 'Test', dateRequested: 'InvalidDate' });
    const result = submissionService.submit(request);
    
    assert.strictEqual(result.success, false);
    assert.ok(result.errors.includes('dateRequested'));
    assert.strictEqual(getRequestCount(), 0);
  });
});