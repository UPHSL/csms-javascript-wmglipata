import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { ResidentRepository } from '../src/repositories/ResidentRepository.js';
import { Resident } from '../src/models/Resident.js';

describe('ResidentRepository Persistence Tests', () => {
  let db;
  let repository;
  let dbPath;

  // This runs before every single test to create a fresh database
  beforeEach(() => {
    // Generate a unique temporary file path
    const tempDir = os.tmpdir();
    dbPath = path.join(tempDir, `test-csms-${Date.now()}.db`);
    
    // Open the temporary database
    db = new DatabaseSync(dbPath);

    // Initialize the test table
    db.exec(`
      CREATE TABLE residents (
        id INTEGER PRIMARY KEY,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        address TEXT NOT NULL,
        contact_number TEXT NOT NULL,
        email TEXT NOT NULL,
        status TEXT NOT NULL
      );
    `);

    // Inject our test database into the repository
    repository = new ResidentRepository(db);
  });

  // This runs after every single test to clean up
  afterEach(() => {
    db.close();
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  it('Test 1: Persist a Resident - should store a valid Resident successfully', () => {
    const resident = new Resident({ firstName: 'Juan', lastName: 'Dela Cruz', address: '123 Rizal St', contactNumber: '09171234567', email: 'juan@example.com' });
    const savedResident = repository.save(resident);
    assert.ok(savedResident, 'Repository should return the saved resident object');
  });

  it('Test 2: Resident Receives an Identifier - should assign a usable identifier after saving', () => {
    const resident = new Resident({ firstName: 'Maria', lastName: 'Santos', address: '456 Mabini St', contactNumber: '09181234567', email: 'maria@example.com' });
    assert.strictEqual(resident.id, null, 'ID should be null before saving');
    
    const savedResident = repository.save(resident);
    assert.notStrictEqual(savedResident.id, null, 'ID should not be null after saving');
    assert.strictEqual(typeof savedResident.id, 'number', 'SQLite should generate a numeric ID');
  });

  it('Test 3: Retrieve Resident by Identifier - should return the correct Resident using findById', () => {
    const resident = new Resident({ firstName: 'Carlos', lastName: 'Garcia', address: '789 Luna St', contactNumber: '09191234567', email: 'carlos@example.com' });
    const savedResident = repository.save(resident);
    const retrievedResident = repository.findById(savedResident.id);
    
    assert.notStrictEqual(retrievedResident, null, 'Should find a resident');
    assert.strictEqual(retrievedResident.id, savedResident.id, 'Retrieved ID should match saved ID');
  });

  it('Test 4: Preserve Resident Information - should keep all data intact, including leading zeroes', () => {
    const resident = new Resident({ firstName: 'Ana', lastName: 'Reyes', address: '101 Bonifacio St', contactNumber: '09170000000', email: 'ana@example.com' });
    const savedResident = repository.save(resident);
    const retrievedResident = repository.findById(savedResident.id);
    
    assert.strictEqual(retrievedResident.firstName, 'Ana');
    assert.strictEqual(retrievedResident.lastName, 'Reyes');
    assert.strictEqual(retrievedResident.address, '101 Bonifacio St');
    assert.strictEqual(retrievedResident.email, 'ana@example.com');
    assert.strictEqual(retrievedResident.status, 'Active');
    assert.strictEqual(retrievedResident.contactNumber, '09170000000', 'Contact number must retain leading zero as a string');
  });

  it('Test 5: Preserve Active Status - should keep status as Active after retrieval', () => {
    const resident = new Resident({ firstName: 'Luis', lastName: 'Alvarez', address: '222 Taft Ave', contactNumber: '09201234567', email: 'luis@example.com' });
    const savedResident = repository.save(resident);
    const retrievedResident = repository.findById(savedResident.id);
    assert.strictEqual(retrievedResident.status, 'Active', 'Status must remain Active');
  });

  it('Test 6: Missing Resident - should return null for a non-existent ID safely', () => {
    const retrievedResident = repository.findById(999999);
    assert.strictEqual(retrievedResident, null, 'Should return null for missing IDs, not crash');
  });

  it('Test 7: Verify Real Persistence - should retrieve data using a completely new repository instance', () => {
    const resident = new Resident({ firstName: 'Elena', lastName: 'Gomez', address: '333 Roxas Blvd', contactNumber: '09211234567', email: 'elena@example.com' });
    const savedResident = repository.save(resident);
    
    const newRepositoryInstance = new ResidentRepository(db);
    const retrievedResident = newRepositoryInstance.findById(savedResident.id);
    
    assert.notStrictEqual(retrievedResident, null, 'New repository instance should find the resident in the database');
    assert.strictEqual(retrievedResident.firstName, 'Elena', 'Data must persist across repository instances');
  });

  it('Test 8 (Student-Designed): Handle Special Characters - should safely store and retrieve strings with apostrophes and hyphens', () => {
    const resident = new Resident({ firstName: "D'Artagnan", lastName: "O'Connor", address: "Blk-4, St. Jude's Ave.", contactNumber: "09331234567", email: "dartagnan@example.com" });
    
    const savedResident = repository.save(resident);
    const retrievedResident = repository.findById(savedResident.id);
    
    assert.strictEqual(retrievedResident.firstName, "D'Artagnan", "First name with apostrophe must be preserved");
    assert.strictEqual(retrievedResident.lastName, "O'Connor", "Last name with apostrophe must be preserved");
    assert.strictEqual(retrievedResident.address, "Blk-4, St. Jude's Ave.", "Address with hyphens and punctuation must be preserved");
  });

});