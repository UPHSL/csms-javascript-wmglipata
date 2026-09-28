export class ServiceRequestValidator {
  validate(serviceRequest) {
    const errors = [];

    // Rule 1: ID must be unassigned before submission
    if (serviceRequest.id !== null && serviceRequest.id !== undefined) {
      errors.push('id');
    }

    // Rule 2: Resident ID must be structurally valid (positive number)
    if (!serviceRequest.residentId || typeof serviceRequest.residentId !== 'number' || serviceRequest.residentId <= 0) {
      errors.push('residentId');
    }

    // Rule 3: Service Type is required and not whitespace-only
    if (!serviceRequest.serviceType || serviceRequest.serviceType.trim() === '') {
      errors.push('serviceType');
    }

    // Rule 4: Description is required and not whitespace-only
    if (!serviceRequest.description || serviceRequest.description.trim() === '') {
      errors.push('description');
    }

    // Rule 5: Date Requested must be present and follow a valid format (YYYY-MM-DD for this project)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!serviceRequest.dateRequested || !dateRegex.test(serviceRequest.dateRequested)) {
      errors.push('dateRequested');
    }

    // Rule 6: New Service Request must begin as Pending
    if (serviceRequest.status !== 'Pending') {
      errors.push('status');
    }

    return errors;
  }
}