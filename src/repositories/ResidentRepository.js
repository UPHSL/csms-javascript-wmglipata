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

update(resident) {
    // T06 Guide: Only update editable fields. Do NOT update status or id.
    const updateSQL = `
      UPDATE residents 
      SET first_name = ?, 
          last_name = ?, 
          address = ?, 
          contact_number = ?, 
          email = ?
      WHERE id = ?
    `;
    
    const stmt = this.db.prepare(updateSQL);
    
    stmt.run(
      resident.firstName,
      resident.lastName,
      resident.address,
      resident.contactNumber,
      resident.email,
      resident.id
    );
  }

deactivate(residentId) {
    // T07: Soft deactivation only. No DELETE statement.
    const deactivateSQL = `
      UPDATE residents 
      SET status = 'Inactive' 
      WHERE id = ?
    `;
    
    const stmt = this.db.prepare(deactivateSQL);
    stmt.run(residentId);
  }

  getMetrics() {
    const stmt = this.db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'Inactive' THEN 1 ELSE 0 END) as inactive
      FROM residents
    `);
    
    const result = stmt.get();
    
    // Fallback to 0 if the table is completely empty (SQLite SUM returns null on empty)
    return {
      total: result?.total || 0,
      active: result?.active || 0,
      inactive: result?.inactive || 0
    };
  }
  
}

