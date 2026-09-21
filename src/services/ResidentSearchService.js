import { ResidentRepository } from '../repositories/ResidentRepository.js';

export class ResidentSearchService {
  constructor(repository = new ResidentRepository()) {
    this.repository = repository;
  }

  listResidents() {
    // Satisfies Rules 1, 2, and 3: Returns all records directly from persistence
    return this.repository.list();
  }

  searchResidents(searchTerm) {
    // Satisfies Rule 7: Normalize by removing leading and trailing whitespace
    const trimmedTerm = (searchTerm || '').trim();

    // Satisfies Rule 8: A blank search falls back to listing all residents
    if (trimmedTerm === '') {
      return this.listResidents();
    }

    // Satisfies Rules 4, 5, 6, 9, 10, and 11: The repository handles the SQL matching
    return this.repository.search(trimmedTerm);
  }
}