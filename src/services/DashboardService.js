import { ResidentRepository } from '../repositories/ResidentRepository.js';
import { ServiceRequestRepository } from '../repositories/ServiceRequestRepository.js';

export class DashboardService {
  constructor(
    residentRepo = new ResidentRepository(), 
    serviceRequestRepo = new ServiceRequestRepository()
  ) {
    this.residentRepo = residentRepo;
    this.serviceRequestRepo = serviceRequestRepo;
  }

  getDashboardSummary() {
    // 1. Fetch aggregate metrics
    const residentMetrics = this.residentRepo.getMetrics();
    const srMetrics = this.serviceRequestRepo.getMetrics();
    
    // 2. Fetch the 5 most recent requests
    const recentRequests = this.serviceRequestRepo.findRecent(5);

    // 3. Calculate derived metrics (Open = Pending + In Progress)
    const openRequests = srMetrics.pending + srMetrics.inProgress;

    // 4. Return composed summary
    return {
      residents: residentMetrics,
      serviceRequests: {
        total: srMetrics.total,
        pending: srMetrics.pending,
        inProgress: srMetrics.inProgress,
        completed: srMetrics.completed,
        cancelled: srMetrics.cancelled,
        open: openRequests
      },
      recentRequests: recentRequests
    };
  }
}