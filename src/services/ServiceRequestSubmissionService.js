import { ServiceRequestValidator } from './ServiceRequestValidator.js';
import { ResidentRepository } from '../repositories/ResidentRepository.js';
import { ServiceRequestRepository } from '../repositories/ServiceRequestRepository.js';

export class ServiceRequestSubmissionService {
  constructor(
    validator = new ServiceRequestValidator(),
    residentRepo = new ResidentRepository(),
    serviceRequestRepo = new ServiceRequestRepository()
  ) {
    this.validator = validator;
    this.residentRepo = residentRepo;
    this.serviceRequestRepo = serviceRequestRepo;
  }

  submit(serviceRequest) {
    // 1. Validate the intrinsic Service Request information
    const errors = this.validator.validate(serviceRequest);
    if (errors.length > 0) {
      return {
        success: false,
        serviceRequest: null,
        errors: errors,
        residentNotFound: false,
        residentInactive: false
      };
    }

    // 2. Retrieve the Resident to verify existence
    const resident = this.residentRepo.findById(serviceRequest.residentId);
    if (!resident) {
      return {
        success: false,
        serviceRequest: null,
        errors: [],
        residentNotFound: true,
        residentInactive: false
      };
    }

    // 3. Prevent Inactive Residents from submitting new requests
    if (resident.status === 'Inactive') {
      return {
        success: false,
        serviceRequest: null,
        errors: [],
        residentNotFound: false,
        residentInactive: true
      };
    }

    // 4. Persist the valid Service Request (status is already Pending via Domain Model)
    const persistedRequest = this.serviceRequestRepo.save(serviceRequest);

    // 5. Return successful result
    return {
      success: true,
      serviceRequest: persistedRequest,
      errors: [],
      residentNotFound: false,
      residentInactive: false
    };
  }
}