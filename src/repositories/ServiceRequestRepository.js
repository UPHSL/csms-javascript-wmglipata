import { db as defaultDatabase } from '../database/db.js';
import { ServiceRequest } from '../models/ServiceRequest.js';

export class ServiceRequestRepository {
  constructor(db = defaultDatabase) {
    this.db = db;
  }

  save(serviceRequest) {
    const insertSQL = `
      INSERT INTO service_requests (resident_id, service_type, description, date_requested, status)
      VALUES (?, ?, ?, ?, ?)
    `;
    
    const stmt = this.db.prepare(insertSQL);
    
    const result = stmt.run(
      serviceRequest.residentId,
      serviceRequest.serviceType,
      serviceRequest.description,
      serviceRequest.dateRequested,
      serviceRequest.status
    );

    // Capture the database-generated ID and attach it to the domain model
    serviceRequest.id = result.lastInsertRowid;
    
    return serviceRequest;
  }

  findById(id) {
    const selectSQL = `SELECT * FROM service_requests WHERE id = ?`;
    const stmt = this.db.prepare(selectSQL);
    const row = stmt.get(id);

    if (!row) {
      return null;
    }

    // Map the database snake_case columns back to our camelCase domain model
    return new ServiceRequest({
      id: row.id,
      residentId: row.resident_id,
      serviceType: row.service_type,
      description: row.description,
      dateRequested: row.date_requested,
      status: row.status
    });
  }

  updateStatus(id, newStatus) {
    const updateSQL = `UPDATE service_requests SET status = ? WHERE id = ?`;
    this.db.prepare(updateSQL).run(newStatus, id);
    return this.findById(id);
  }

  query(searchTerm = '', statusFilter = '') {
    let sql = `SELECT * FROM service_requests WHERE 1=1`;
    const params = [];

    // Partial, case-insensitive text search across two fields
    if (searchTerm) {
      sql += ` AND (service_type LIKE ? OR description LIKE ?)`;
      params.push(`%${searchTerm}%`, `%${searchTerm}%`);
    }

    // Exact match status filter
    if (statusFilter) {
      sql += ` AND status = ?`;
      params.push(statusFilter);
    }

    // Required deterministic ordering
    sql += ` ORDER BY date_requested DESC, id DESC`;

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params);

    // Map database rows back to domain models
    return rows.map(row => new ServiceRequest({
      id: row.id,
      residentId: row.resident_id,
      serviceType: row.service_type,
      description: row.description,
      dateRequested: row.date_requested,
      status: row.status
    }));
  }
  
}