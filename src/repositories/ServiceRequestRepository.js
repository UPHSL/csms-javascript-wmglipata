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
  
}