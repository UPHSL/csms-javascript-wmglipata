import { ServiceRequestRepository } from '../repositories/ServiceRequestRepository.js';

export class ServiceRequestQueryService {
  constructor(serviceRequestRepo = new ServiceRequestRepository()) {
    this.serviceRequestRepo = serviceRequestRepo;
    this.supportedStatuses = ['Pending', 'In Progress', 'Completed', 'Cancelled'];
  }

  listServiceRequests() {
    return this.serviceRequestRepo.query();
  }

  viewServiceRequest(id) {
    // Reuse the existing T09 findById behavior safely
    const request = this.serviceRequestRepo.findById(id);
    return request || null; 
  }

  searchServiceRequests(searchTerm = '', statusFilter = '') {
    // Normalize inputs: ignore leading/trailing whitespace
    const normalizedSearch = searchTerm ? searchTerm.trim() : '';
    const normalizedStatus = statusFilter ? statusFilter.trim() : '';

    // Reject unsupported non-empty status filters
    if (normalizedStatus && !this.supportedStatuses.includes(normalizedStatus)) {
      throw new Error('UNSUPPORTED_STATUS_FILTER');
    }

    // A blank text search automatically acts as a normal listing/filtered query
    return this.serviceRequestRepo.query(normalizedSearch, normalizedStatus);
  }
}