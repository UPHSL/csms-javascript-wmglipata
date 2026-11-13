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

  getMetrics() {
    const stmt = this.db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) as inProgress,
        SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'Cancelled' THEN 1 ELSE 0 END) as cancelled
      FROM service_requests
    `);
    
    const result = stmt.get();
    
    return {
      total: result?.total || 0,
      pending: result?.pending || 0,
      inProgress: result?.inProgress || 0,
      completed: result?.completed || 0,
      cancelled: result?.cancelled || 0
    };
  }

  findRecent(limit = 5) {
    // 1. Fixed the SQL ORDER BY to use date_requested
    const stmt = this.db.prepare(`
      SELECT * FROM service_requests 
      ORDER BY date_requested DESC, id DESC 
      LIMIT ?
    `);
    
    const rows = stmt.all(limit);
    
    // 2. Fixed the mapping to perfectly match your Domain Model constructor object pattern
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