import { db as defaultDatabase } from '../database/db.js';
import { Resident } from '../models/Resident.js';

export class ResidentRepository {
  
  // This allows tests to inject a temporary database!
  constructor(db = defaultDatabase) {
    this.db = db;
  }

  save(resident) {
    const insertSQL = `
      INSERT INTO residents (first_name, last_name, address, contact_number, email, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    // Notice the change to this.db
    const stmt = this.db.prepare(insertSQL);
    
    const result = stmt.run(
      resident.firstName,
      resident.lastName,
      resident.address,
      resident.contactNumber,
      resident.email,
      resident.status
    );

    resident.id = result.lastInsertRowid;
    
    return resident;
  }

  findById(residentId) {
    const selectSQL = `SELECT * FROM residents WHERE id = ?`;
    const stmt = this.db.prepare(selectSQL);
    const row = stmt.get(residentId);

    if (!row) {
      return null;
    }

    // Pass an object to match your T01 constructor
    return new Resident({
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      address: row.address,
      contactNumber: row.contact_number,
      email: row.email,
      status: row.status
    });
}}