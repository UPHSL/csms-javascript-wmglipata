import { ResidentRepository } from '../repositories/ResidentRepository.js';

export class ResidentDeactivationService {
  constructor(repository = new ResidentRepository()) {
    this.repository = repository;
  }

  deactivateResident(id) {
    // 1. Retrieve the existing Resident
    const existingResident = this.repository.findById(id);

    // 2. Safe handling for nonexistent Resident
    if (!existingResident) {
      return {
        success: false,
        resident: null,
        notFound: true,
        alreadyInactive: false
      };
    }

    // 3. Safe handling for already-Inactive Resident
    // T07 Requirement: Repeated operations are safe and idempotent.
    if (existingResident.status === 'Inactive') {
      return {
        success: true, 
        resident: existingResident,
        notFound: false,
        alreadyInactive: true
      };
    }

    // 4. Change an Active Resident to Inactive in persistence
    this.repository.deactivate(id);

    // 5. Retrieve and return the final persisted Resident state
    const deactivatedResident = this.repository.findById(id);

    return {
      success: true,
      resident: deactivatedResident,
      notFound: false,
      alreadyInactive: false
    };
  }
}