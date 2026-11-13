import assert from 'node:assert';
import { describe, it } from 'node:test';
import { ServiceRequest } from '../src/models/ServiceRequest.js';

describe('T08 - Service Request Domain Model', () => {
  
  it('Test 1 - Service Request Can Be Created', () => {
    const request = new ServiceRequest({
      residentId: 25,
      serviceType: 'Barangay Clearance',
      description: 'Request for employment requirement',
      dateRequested: '2026-09-28'
    });
    
    assert.ok(request, 'Service Request should be successfully constructed');
  });

  it('Test 2 - Service Request Information Is Accessible', () => {
    const request = new ServiceRequest({
      residentId: 25,
      serviceType: 'Barangay Clearance',
      description: 'Request for employment requirement',
      dateRequested: '2026-09-28'
    });
    
    assert.strictEqual(request.residentId, 25);
    assert.strictEqual(request.serviceType, 'Barangay Clearance');
    assert.strictEqual(request.description, 'Request for employment requirement');
    assert.strictEqual(request.dateRequested, '2026-09-28');
  });

  it('Test 3 - Resident ID Is Preserved', () => {
    const request = new ServiceRequest({ residentId: 25 });
    
    assert.strictEqual(request.residentId, 25, 'The domain model must preserve the exact supplied Resident ID');
  });

  it('Test 4 - New Service Request Has an Unassigned ID', () => {
    const request = new ServiceRequest({ residentId: 25 });
    
    assert.strictEqual(request.id, null, 'A new Service Request ID must be unassigned (null) before persistence');
  });

  it('Test 5 - New Service Request Defaults to Pending', () => {
    const request = new ServiceRequest({ residentId: 25 });
    
    assert.strictEqual(request.status, 'Pending', 'Status must default to Pending if not explicitly provided');
  });

  it('Test 6 - Service Request Information Is Independent Between Objects', () => {
    const request1 = new ServiceRequest({
      residentId: 25,
      serviceType: 'Barangay Clearance',
      description: 'First request'
    });
    
    const request2 = new ServiceRequest({
      residentId: 99,
      serviceType: 'Certificate Request',
      description: 'Second request'
    });
    
    // Proving they don't share or overwrite memory
    assert.strictEqual(request1.residentId, 25);
    assert.strictEqual(request2.residentId, 99);
    assert.strictEqual(request1.serviceType, 'Barangay Clearance');
    assert.strictEqual(request2.serviceType, 'Certificate Request');
  });
});