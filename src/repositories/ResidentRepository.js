import { db as defaultDatabase } from '../database/db.js';
import { Resident } from '../models/Resident.js';

export class ResidentRepository {
  
  constructor(db = defaultDatabase) {
    this.db = db;
  }

  save(resident) {
    const insertSQL = `
      INSERT INTO residents (first_name, last_name, address, contact_number, email, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
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

    return new Resident({
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      address: row.address,
      contactNumber: row.contact_number,
      email: row.email,
      status: row.status
    });
  }

  list() {
    // Orders by last name, then first name, then id. COLLATE NOCASE ensures case-insensitive sorting.
    const selectSQL = `
      SELECT * FROM residents 
      ORDER BY last_name COLLATE NOCASE ASC, 
               first_name COLLATE NOCASE ASC, 
               id ASC
    `;
    const stmt = this.db.prepare(selectSQL);
    const rows = stmt.all();

    // Map all database rows back into Resident domain objects
    return rows.map(row => new Resident({
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      address: row.address,
      contactNumber: row.contact_number,
      email: row.email,
      status: row.status
    }));
  }

  search(searchTerm) {
    // Uses parameterized query (?) to prevent SQL injection and LIKE for partial matching
    const searchSQL = `
      SELECT * FROM residents 
      WHERE first_name LIKE ? OR last_name LIKE ?
      ORDER BY last_name COLLATE NOCASE ASC, 
               first_name COLLATE NOCASE ASC, 
               id ASC
    `;
    const stmt = this.db.prepare(searchSQL);
    
    // Wrap the search term in % wildcards so it matches anywhere in the name
    const param = `%${searchTerm}%`;
    const rows = stmt.all(param, param);

    return rows.map(row => new Resident({
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      address: row.address,
      contactNumber: row.contact_number,
      email: row.email,
      status: row.status
    }));
  }
}