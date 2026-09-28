import assert from 'node:assert';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { Resident } from '../src/models/Resident.js';
import { ResidentRepository } from '../src/repositories/ResidentRepository.js';
import { ResidentUpdateService } from '../src/services/ResidentUpdateService.js';
import { ResidentQueryService } from '../src/services/ResidentQueryService.js';

describe('T06 - Resident Update Service', () => {
  let db;
  let repository;
  let updateService;
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
    updateService = new ResidentUpdateService(undefined, repository);
    queryService = new ResidentQueryService(repository);
  });

  afterEach(() => {
    db.close();
  });

  // Helper to insert a baseline resident before updating
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

  it('Test 1 - Valid Resident Update Succeeds', () => {
    const original = insertResident();
    const proposed = { ...original, firstName: 'Miguel' };
    
    const result = updateService.updateResident(original.id, proposed);
    
    assert.strictEqual(result.success, true);
    assert.ok(result.resident);
    assert.deepStrictEqual(result.errors, []);
    assert.strictEqual(result.notFound, false);
  });

  it('Test 2 - Resident ID Is Preserved', () => {
    const original = insertResident();
    const proposed = { ...original, firstName: 'Miguel', id: 999 }; // Attempting to sneak in a new ID
    
    const result = updateService.updateResident(original.id, proposed);
    
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.resident.id, original.id, 'The ID must not change during an update');
  });

  it('Test 3 - Permitted Resident Information Is Persisted', () => {
    const original = insertResident();
    const proposed = {
      firstName: 'Juan Miguel',
      lastName: 'Santos',
      address: '456 New Blvd',
      contactNumber: '09981234567',
      email: 'miguel@example.com'
    };
    
    updateService.updateResident(original.id, proposed);
    
    // Fetch directly from DB to prove it saved
    const retrieved = repository.findById(original.id);
    
    assert.strictEqual(retrieved.firstName, 'Juan Miguel');
    assert.strictEqual(retrieved.lastName, 'Santos');
    assert.strictEqual(retrieved.address, '456 New Blvd');
    assert.strictEqual(retrieved.contactNumber, '09981234567');
    assert.strictEqual(retrieved.email, 'miguel@example.com');
  });

  it('Test 4 - Resident Status Is Preserved', () => {
    // Save an Inactive resident
    const original = insertResident({ status: 'Inactive' });
    
    // Attempt an update and even maliciously try to pass status: 'Active'
    const proposed = { ...original, firstName: 'Miguel', status: 'Active' };
    
    const result = updateService.updateResident(original.id, proposed);
    
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.resident.status, 'Inactive', 'Status must not be changed by the T06 general update');
  });

  it('Test 5 - Invalid Update Fails', () => {
    const original = insertResident();
    const proposed = { ...original, firstName: '' }; // Invalid: empty first name
    
    const result = updateService.updateResident(original.id, proposed);
    
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.resident, null);
    assert.ok(result.errors.includes('firstName'));
  });

  it('Test 6 - Invalid Update Does Not Modify Persisted Information', () => {
    const original = insertResident();
    const proposed = { ...original, firstName: 'ValidName', contactNumber: 'ABC' }; // Invalid contact
    
    updateService.updateResident(original.id, proposed);
    
    const retrieved = repository.findById(original.id);
    
    // It should not partially save 'ValidName'
    assert.strictEqual(retrieved.firstName, 'Juan');
    assert.strictEqual(retrieved.contactNumber, '09171234567');
  });

  it('Test 7 - Updating a Nonexistent Resident Is Handled Safely', () => {
    const proposed = {
      firstName: 'Miguel',
      lastName: 'Santos',
      address: '456 New Blvd',
      contactNumber: '09981234567',
      email: 'miguel@example.com'
    };
    
    const result = updateService.updateResident(9999, proposed);
    
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.notFound, true);
    assert.strictEqual(result.resident, null);
  });

  it('Test 8 - Nonexistent Update Does Not Create a Resident', () => {
    const countBefore = repository.list().length;
    
    const proposed = {
      firstName: 'Miguel',
      lastName: 'Santos',
      address: '456 New Blvd',
      contactNumber: '09981234567',
      email: 'miguel@example.com'
    };
    
    updateService.updateResident(9999, proposed);
    
    const countAfter = repository.list().length;
    assert.strictEqual(countAfter, countBefore, 'An update must never act as an insert/upsert');
  });

  it('Test 9 - Updated Resident Is Visible Through T05 Querying', () => {
    const original = insertResident();
    const proposed = { ...original, firstName: 'Miguelito' };
    
    updateService.updateResident(original.id, proposed);
    
    const searchResults = queryService.searchResidents('Miguelito');
    
    assert.strictEqual(searchResults.length, 1);
    assert.strictEqual(searchResults[0].id, original.id);
    assert.strictEqual(searchResults[0].firstName, 'Miguelito');
  });

  it('Test 10 - Updated Information and Contact Number Are Preserved', () => {
    const original = insertResident();
    const proposed = { ...original, contactNumber: '09181234567' };
    
    const result = updateService.updateResident(original.id, proposed);
    
    assert.strictEqual(result.resident.contactNumber, '09181234567', 'Leading zero must remain intact');
    
    const retrieved = repository.findById(original.id);
    assert.strictEqual(retrieved.contactNumber, '09181234567');
  });
});