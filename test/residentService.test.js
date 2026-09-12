import assert from 'node:assert';
import { describe, it, beforeEach } from 'node:test';
import { ResidentService } from '../src/services/ResidentService.js';
import { ResidentRepository } from '../src/repositories/ResidentRepository.js';

describe('T04 - Resident Registration Service', () => {
  let service;
  let repository;
  
  const validResidentData = {
    firstName: 'Juan',
    lastName: 'Dela Cruz',
    address: '123 Rizal St, Imus',
    contactNumber: '09171234567',
    email: 'juan@example.com'
  };

  beforeEach(() => {
    repository = new ResidentRepository();
    service = new ResidentService(undefined, repository);
  });

  it('Test 1 - Register a Valid Resident', () => {
    const result = service.register(validResidentData);
    assert.strictEqual(result.success, true, 'Registration should succeed for valid data');
  });

  it('Test 2 - Registered Resident Receives an Identifier', () => {
    const result = service.register(validResidentData);
    assert.ok(result.resident.id, 'Successfully registered resident must have a generated ID');
  });

  it('Test 3 - Registered Resident Is Persisted', () => {
    const result = service.register(validResidentData);
    const savedId = result.resident.id;
    
    const retrievedResident = repository.findById(savedId);
    assert.ok(retrievedResident, 'The resident must exist in the persistence layer');
    assert.strictEqual(retrievedResident.id, savedId, 'Retrieved ID must match generated ID');
  });

  it('Test 4 - Registered Resident Information Is Preserved', () => {
    const result = service.register(validResidentData);
    const retrievedResident = repository.findById(result.resident.id);
    
    assert.strictEqual(retrievedResident.firstName, validResidentData.firstName);
    assert.strictEqual(retrievedResident.lastName, validResidentData.lastName);
    assert.strictEqual(retrievedResident.address, validResidentData.address);
    assert.strictEqual(retrievedResident.contactNumber, validResidentData.contactNumber, 'Contact number must preserve leading zeros');
    assert.strictEqual(retrievedResident.email, validResidentData.email);
  });

  it('Test 5 - Default Active Status Is Preserved', () => {
    const result = service.register(validResidentData);
    const retrievedResident = repository.findById(result.resident.id);
    
    assert.strictEqual(retrievedResident.status, 'Active', 'Default status must remain Active after persistence');
  });

  it('Test 6 - Invalid Resident Registration Fails', () => {
    const invalidData = { ...validResidentData, firstName: '' }; // Missing required first name
    const result = service.register(invalidData);
    
    assert.strictEqual(result.success, false, 'Registration should fail for invalid data');
  });

  it('Test 7 - Invalid Resident Is Not Persisted', () => {
    const invalidData = { ...validResidentData, contactNumber: '123' }; // Invalid contact format
    const result = service.register(invalidData);
    
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.resident, undefined, 'No resident object should be returned on failure');
  });

  it('Test 8 - Validation Failure Can Be Identified', () => {
    const invalidData = { ...validResidentData, email: 'invalid-email' };
    const result = service.register(invalidData);
    
    assert.strictEqual(result.success, false);
    assert.ok(result.errors, 'Result must include validation errors');
    assert.ok(result.errors.includes('email'), 'Errors should identify the specific validation failure (email)');
  });
});