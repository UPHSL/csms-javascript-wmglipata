import { ResidentValidator } from './ResidentValidator.js';
import { ResidentRepository } from '../repositories/ResidentRepository.js';

export class ResidentUpdateService {
  constructor(validator = new ResidentValidator(), repository = new ResidentRepository()) {
    this.validator = validator;
    this.repository = repository;
  }

  updateResident(id, proposedData) {
    // 1. Retrieve the existing Resident
    const existingResident = this.repository.findById(id);

    // 2. Safe handling for nonexistent Resident
    if (!existingResident) {
      return {
        success: false,
        resident: null,
        errors: [],
        notFound: true // Distinct result for missing resident
      };
    }

    // 3. Apply the proposed editable information
    // We intentionally ignore any id or status passed in proposedData
    existingResident.firstName = proposedData.firstName;
    existingResident.lastName = proposedData.lastName;
    existingResident.address = proposedData.address;
    existingResident.contactNumber = proposedData.contactNumber;
    existingResident.email = proposedData.email;

    // 4. Validate the updated candidate using T02 rules
    // Because we didn't touch existingResident.status, it validates using the existing status
    const errors = this.validator.validate(existingResident);

    // 5. Stop if validation fails (do NOT update persistence)
    if (errors.length > 0) {
      return {
        success: false,
        resident: null,
        errors: errors,
        notFound: false
      };
    }

    // 6. Persist valid updates
    this.repository.update(existingResident);

    // 7. Retrieve and return the freshly updated Resident from the database
    const updatedResident = this.repository.findById(id);

    return {
      success: true,
      resident: updatedResident,
      errors: [],
      notFound: false
    };
  }
}