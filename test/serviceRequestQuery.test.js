import assert from 'node:assert';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { ServiceRequest } from '../src/models/ServiceRequest.js';
import { ServiceRequestRepository } from '../src/repositories/ServiceRequestRepository.js';
import { ServiceRequestQueryService } from '../src/services/ServiceRequestQueryService.js';

describe('T11 - Search and View Service Requests', () => {
  let db;
  let repo;
  let queryService;

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
    queryService = new ServiceRequestQueryService(repo);
  });

  afterEach(() => {
    db.close();
  });

  const seedRequest = (type, desc, date, status = 'Pending') => {
    return repo.save(new ServiceRequest({ residentId: 1, serviceType: type, description: desc, dateRequested: date, status }));
  };

  it('Test 1 - List All Persisted Service Requests', () => {
    seedRequest('Type A', 'Desc A', '2026-10-01');
    seedRequest('Type B', 'Desc B', '2026-10-02');
    const results = queryService.listServiceRequests();
    assert.strictEqual(results.length, 2);
  });

  it('Test 2 - Empty Listing Returns an Empty Collection', () => {
    const results = queryService.listServiceRequests();
    assert.deepStrictEqual(results, []);
  });

  it('Test 3 - Listing Uses Required Ordering', () => {
    // Insert out of order
    const req1 = seedRequest('A', 'A', '2026-09-15'); // ID 1
    const req2 = seedRequest('B', 'B', '2026-09-18'); // ID 2
    const req3 = seedRequest('C', 'C', '2026-09-18'); // ID 3
    const req4 = seedRequest('D', 'D', '2026-09-10'); // ID 4

    const results = queryService.listServiceRequests();
    
    // Required order: dateRequested DESC, then id DESC
    assert.strictEqual(results[0].id, 3); // 2026-09-18
    assert.strictEqual(results[1].id, 2); // 2026-09-18
    assert.strictEqual(results[2].id, 1); // 2026-09-15
    assert.strictEqual(results[3].id, 4); // 2026-09-10
  });

  it('Test 4 - View Existing Service Request by ID', () => {
    const req = seedRequest('Type A', 'Desc A', '2026-10-01');
    const result = queryService.viewServiceRequest(req.id);
    assert.strictEqual(result.id, req.id);
    assert.strictEqual(result.serviceType, 'Type A');
  });

  it('Test 5 - Viewing an Unknown ID Is Handled Safely', () => {
    const result = queryService.viewServiceRequest(999);
    assert.strictEqual(result, null);
  });

  it('Test 6 - Partial Service-Type Search Is Case-Insensitive', () => {
    seedRequest('Barangay Clearance', 'Test', '2026-10-01');
    const results = queryService.searchServiceRequests('cLeAr');
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].serviceType, 'Barangay Clearance');
  });

  it('Test 7 - Partial Description Search Is Case-Insensitive', () => {
    seedRequest('Test', 'Needs employment support', '2026-10-01');
    const results = queryService.searchServiceRequests('EMPloYment');
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].description, 'Needs employment support');
  });

  it('Test 8 - Blank Search Returns All Service Requests', () => {
    seedRequest('Type A', 'Desc A', '2026-10-01');
    seedRequest('Type B', 'Desc B', '2026-10-02');
    const listResults = queryService.listServiceRequests();
    const searchResults = queryService.searchServiceRequests('   '); // Whitespace only
    assert.strictEqual(searchResults.length, 2);
    assert.deepStrictEqual(searchResults, listResults);
  });

  it('Test 9 - No Text Match Returns an Empty Collection', () => {
    seedRequest('Type A', 'Desc A', '2026-10-01');
    const results = queryService.searchServiceRequests('Zebra');
    assert.deepStrictEqual(results, []);
  });

  it('Test 10 - Status Filter Returns Only Matching Status', () => {
    seedRequest('Type A', 'Desc A', '2026-10-01', 'Pending');
    seedRequest('Type B', 'Desc B', '2026-10-01', 'Completed');
    const results = queryService.searchServiceRequests('', 'Pending');
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].status, 'Pending');
  });

  it('Test 11 - Unfiltered Query Includes All Statuses', () => {
    seedRequest('A', 'A', '2026-10-01', 'Pending');
    seedRequest('B', 'B', '2026-10-01', 'In Progress');
    seedRequest('C', 'C', '2026-10-01', 'Completed');
    seedRequest('D', 'D', '2026-10-01', 'Cancelled');
    const results = queryService.listServiceRequests();
    assert.strictEqual(results.length, 4);
  });

  it('Test 12 - Combined Text Search and Status Filter', () => {
    seedRequest('Clearance', 'For work', '2026-10-01', 'Pending'); // Matches both
    seedRequest('Clearance', 'For school', '2026-10-01', 'Completed'); // Text matches, status fails
    seedRequest('Assistance', 'Food', '2026-10-01', 'Pending'); // Text fails, status matches
    seedRequest('Permit', 'Building', '2026-10-01', 'Completed'); // Both fail

    const results = queryService.searchServiceRequests('Clearance', 'Pending');
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].description, 'For work');
  });

  it('Test 13 - Matching Service Request Is Not Duplicated', () => {
    // Both serviceType and description contain "assistance"
    seedRequest('Community Assistance', 'Medical assistance requested', '2026-10-01');
    const results = queryService.searchServiceRequests('assistance');
    assert.strictEqual(results.length, 1); // Should appear exactly once
  });

  it('Test 14 - Query Result Preserves Complete Service Request Information', () => {
    const req = seedRequest('Type A', 'Desc A', '2026-10-01', 'Completed');
    const result = queryService.viewServiceRequest(req.id);
    
    assert.strictEqual(result.id, req.id);
    assert.strictEqual(result.residentId, 1);
    assert.strictEqual(result.serviceType, 'Type A');
    assert.strictEqual(result.description, 'Desc A');
    assert.strictEqual(result.dateRequested, '2026-10-01');
    assert.strictEqual(result.status, 'Completed');
  });
});