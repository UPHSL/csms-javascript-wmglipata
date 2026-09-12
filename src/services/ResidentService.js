import { Resident } from '../models/Resident.js';
import { ResidentValidator } from './ResidentValidator.js';
import { ResidentRepository } from '../repositories/ResidentRepository.js';

export class ResidentService {
  constructor(
    validator = new ResidentValidator(),
    repository = new ResidentRepository()
  ) {
    this.validator = validator;
    this.repository = repository;
  }

  register(residentData) {
    const resident = new Resident(residentData);

    // Get the array of errors directly from your validator
    const errors = this.validator.validate(resident);

    // Reject if the array has any items (meaning it is invalid)
    if (errors.length > 0) {
      return {
        success: false,
        errors: errors
      };
    }

    const savedResident = this.repository.save(resident);

    return {
      success: true,
      resident: savedResident
    };
  }
}