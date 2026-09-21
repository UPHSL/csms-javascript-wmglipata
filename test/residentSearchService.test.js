import assert from 'node:assert';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { Resident } from '../src/models/Resident.js';
import { ResidentRepository } from '../src/repositories/ResidentRepository.js';
import { ResidentSearchService } from '../src/services/ResidentSearchService.js';

describe('T05 - Resident Search and Listing Service', () => {
  let db;
  let repository;
  let service;

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
    service = new ResidentSearchService(repository);
  });

  afterEach(() => {
    db.close();
  });

  // Helper function to quickly insert test residents
  const insertResident = (firstName, lastName, status = 'Active') => {
    return repository.save(new Resident({
      firstName,
      lastName,
      address: '123 Test St',
      contactNumber: '09171234567',
      email: 'test@example.com',
      status
    }));
  };

  it('Test 1 - List All Persisted Residents', () => {
    insertResident('Juan', 'Dela Cruz');
    insertResident('Maria', 'Clara');
    
    const results = service.listResidents();
    assert.strictEqual(results.length, 2, 'Should return all persisted residents');
  });

  it('Test 2 - Empty Resident Listing', () => {
    const results = service.listResidents();
    assert.ok(Array.isArray(results), 'Should return a collection');
    assert.strictEqual(results.length, 0, 'Collection should be empty when no residents exist');
  });

  it('Test 3 - Resident Listing Uses Required Ordering', () => {
    // Insert out of alphabetical order
    insertResident('Ana', 'Santos');
    insertResident('Pedro', 'Cruz');
    insertResident('Maria', 'Andres');
    insertResident('Juan', 'Cruz');

    const results = service.listResidents();
    
    assert.strictEqual(results.length, 4);
    // Order should be: Andres, Maria -> Cruz, Juan -> Cruz, Pedro -> Santos, Ana
    assert.strictEqual(results[0].lastName, 'Andres');
    assert.strictEqual(results[1].firstName, 'Juan'); // Cruz, Juan comes before Cruz, Pedro
    assert.strictEqual(results[2].firstName, 'Pedro'); 
    assert.strictEqual(results[3].lastName, 'Santos');
  });

  it('Test 4 - Partial First Name Search Is Case-Insensitive', () => {
    insertResident('Juan', 'Dela Cruz');
    
    const results = service.searchResidents('jUa'); // Weird casing and partial
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].firstName, 'Juan');
  });

  it('Test 5 - Partial Last Name Search Is Case-Insensitive', () => {
    insertResident('Juan', 'Dela Cruz');
    
    const results = service.searchResidents('cRuZ');
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].lastName, 'Dela Cruz');
  });

  it('Test 6 - Blank Search Returns All Residents', () => {
    insertResident('Juan', 'Dela Cruz');
    insertResident('Maria', 'Clara');
    
    const results1 = service.searchResidents('');
    const results2 = service.searchResidents('   '); // Just spaces
    
    assert.strictEqual(results1.length, 2, 'Empty string should return all');
    assert.strictEqual(results2.length, 2, 'Whitespace string should return all');
  });

  it('Test 7 - Search With No Match Returns Empty Collection', () => {
    insertResident('Juan', 'Dela Cruz');
    
    const results = service.searchResidents('ZzzUnknownResident');
    assert.ok(Array.isArray(results));
    assert.strictEqual(results.length, 0);
  });

  it('Test 8 - Search Results Preserve Resident Information', () => {
    insertResident('Juan', 'Dela Cruz');
    
    const results = service.searchResidents('Juan');
    const resident = results[0];
    
    assert.ok(resident.id);
    assert.strictEqual(resident.firstName, 'Juan');
    assert.strictEqual(resident.lastName, 'Dela Cruz');
    assert.strictEqual(resident.address, '123 Test St');
    assert.strictEqual(resident.contactNumber, '09171234567', 'Must preserve leading zero');
    assert.strictEqual(resident.email, 'test@example.com');
    assert.strictEqual(resident.status, 'Active');
  });

  it('Test 9 - Active and Inactive Residents Are Included', () => {
    insertResident('Juan', 'Dela Cruz', 'Active');
    insertResident('Maria', 'Clara', 'Inactive');
    
    const results = service.listResidents();
    assert.strictEqual(results.length, 2);
    
    const statuses = results.map(r => r.status);
    assert.ok(statuses.includes('Active'));
    assert.ok(statuses.includes('Inactive'));
  });

  it('Test 10 - Matching Resident Is Not Duplicated', () => {
    // Create a resident where both first and last name match the search term
    insertResident('Cruz', 'Cruz');
    
    const results = service.searchResidents('Cruz');
    assert.strictEqual(results.length, 1, 'Resident should only appear once in results');
  });
});