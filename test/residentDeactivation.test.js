import assert from 'node:assert';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { Resident } from '../src/models/Resident.js';
import { ResidentRepository } from '../src/repositories/ResidentRepository.js';
import { ResidentDeactivationService } from '../src/services/ResidentDeactivationService.js';
import { ResidentQueryService } from '../src/services/ResidentQueryService.js';

describe('T07 - Resident Deactivation Service', () => {
  let db;
  let repository;
  let deactivationService;
  let queryService;

  beforeEach(() => {
    // Setup a fresh in-memory database for clean, isolated tests
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
      )
    `);
    repository = new ResidentRepository(db);
    deactivationService = new ResidentDeactivationService(repository);
    queryService = new ResidentQueryService(repository);
  });

  afterEach(() => {
    db.close();
  });

  // Helper to insert a baseline resident
  const insertResident = (overrides = {}) => {
    const resident = new Resident({
      firstName: 'Juan',
      lastName: 'Dela Cruz',
      address: '123 Rizal St',
      contactNumber: '09171234567',
      email: 'juan@example.com',
      status: 'Active',
      ...overrides
    });
    return repository.save(resident);
  };

  it('Test 1 - Active Resident Can Be Deactivated', () => {
    const original = insertResident();
    const result = deactivationService.deactivateResident(original.id);
    
    assert.strictEqual(result.success, true);
    assert.ok(result.resident);
    assert.strictEqual(result.resident.status, 'Inactive');
  });

  it('Test 2 - Resident Status Becomes Inactive in Persistence', () => {
    const original = insertResident();
    deactivationService.deactivateResident(original.id);
    
    // Fetch directly from repository to prove actual persistence change
    const retrieved = repository.findById(original.id);
    assert.strictEqual(retrieved.status, 'Inactive');
  });

  it('Test 3 - Resident ID Is Preserved', () => {
    const original = insertResident();
    const result = deactivationService.deactivateResident(original.id);
    
    assert.strictEqual(result.resident.id, original.id, 'The ID must not change during deactivation');
  });

  it('Test 4 - Resident Information Is Preserved', () => {
    const original = insertResident();
    deactivationService.deactivateResident(original.id);
    
    const retrieved = repository.findById(original.id);
    
    assert.strictEqual(retrieved.firstName, 'Juan');
    assert.strictEqual(retrieved.lastName, 'Dela Cruz');
    assert.strictEqual(retrieved.address, '123 Rizal St');
    assert.strictEqual(retrieved.contactNumber, '09171234567', 'Leading zero must be preserved');
    assert.strictEqual(retrieved.email, 'juan@example.com');
  });

  it('Test 5 - Deactivated Resident Remains Persisted and Retrievable', () => {
    const original = insertResident();
    deactivationService.deactivateResident(original.id);
    
    // Proves soft deactivation, not physical DELETE
    const retrieved = repository.findById(original.id);
    assert.ok(retrieved, 'Resident must still exist in the database');
    assert.strictEqual(retrieved.status, 'Inactive');
  });

  it('Test 6 - Deactivated Resident Remains Available Through T05', () => {
    const original = insertResident({ firstName: 'UniqueName' });
    deactivationService.deactivateResident(original.id);
    
    const searchResults = queryService.searchResidents('UniqueName');
    
    assert.strictEqual(searchResults.length, 1);
    assert.strictEqual(searchResults[0].status, 'Inactive');
  });

  it('Test 7 - Already-Inactive Resident Is Handled Safely', () => {
    const original = insertResident({ status: 'Inactive' });
    const result = deactivationService.deactivateResident(original.id);
    
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.alreadyInactive, true);
    assert.strictEqual(result.resident.status, 'Inactive');
  });

  it('Test 8 - Nonexistent Resident Is Handled Safely', () => {
    const result = deactivationService.deactivateResident(9999);
    
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.notFound, true);
    assert.strictEqual(result.resident, null);
  });

  it('Test 9 - Nonexistent Deactivation Does Not Create or Delete Records', () => {
    insertResident();
    const countBefore = repository.list().length;
    
    deactivationService.deactivateResident(9999);
    
    const countAfter = repository.list().length;
    assert.strictEqual(countAfter, countBefore, 'Deactivation must not accidentally insert or delete records');
  });

  it('Test 10 - Deactivating One Resident Does Not Affect Another', () => {
    const targetResident = insertResident();
    const otherResident = insertResident({ firstName: 'Maria', email: 'maria@example.com' });
    
    deactivationService.deactivateResident(targetResident.id);
    
    const retrievedTarget = repository.findById(targetResident.id);
    const retrievedOther = repository.findById(otherResident.id);
    
    assert.strictEqual(retrievedTarget.status, 'Inactive');
    assert.strictEqual(retrievedOther.status, 'Active', 'Other residents must remain unchanged');
    assert.strictEqual(retrievedOther.firstName, 'Maria');
  });
});