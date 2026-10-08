import { ServiceRequestRepository } from '../repositories/ServiceRequestRepository.js';

export class ServiceRequestStatusService {
  constructor(serviceRequestRepo = new ServiceRequestRepository()) {
    this.serviceRequestRepo = serviceRequestRepo;
    
    this.validTransitions = {
      'Pending': ['In Progress', 'Cancelled'],
      'In Progress': ['Completed', 'Cancelled'],
      'Completed': [], 
      'Cancelled': []  
    };
    
    this.supportedStatuses = ['Pending', 'In Progress', 'Completed', 'Cancelled'];
  }

  updateStatus(id, requestedStatus) {
    const request = this.serviceRequestRepo.findById(id);

    if (!request) {
      throw new Error('NOT_FOUND');
    }

    const currentStatus = request.status;

    if (!this.supportedStatuses.includes(requestedStatus)) {
      throw new Error('UNSUPPORTED_STATUS');
    }

    if (currentStatus === requestedStatus) {
      throw new Error('INVALID_TRANSITION');
    }

    const allowedNext = this.validTransitions[currentStatus] || [];
    if (!allowedNext.includes(requestedStatus)) {
      throw new Error('INVALID_TRANSITION');
    }

    return this.serviceRequestRepo.updateStatus(id, requestedStatus);
  }
}