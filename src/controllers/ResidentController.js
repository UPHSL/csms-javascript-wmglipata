import { ResidentQueryService } from '../services/ResidentQueryService.js';
import { ResidentRegistrationService } from '../services/ResidentRegistrationService.js';
import { ResidentUpdateService } from '../services/ResidentUpdateService.js';
import { ResidentDeactivationService } from '../services/ResidentDeactivationService.js';
import { ResidentRepository } from '../repositories/ResidentRepository.js';
import { ResidentValidator } from '../services/ResidentValidator.js'; // <-- 1. Add this import

export class ResidentController {
  constructor() {
    const validator = new ResidentValidator();
    const repo = new ResidentRepository();

    this.queryService = new ResidentQueryService(repo);
    this.registrationService = new ResidentRegistrationService(validator, repo);
    
    // Assuming updateService uses the same signature
    this.updateService = new ResidentUpdateService(validator, repo); 
    
    this.deactivationService = new ResidentDeactivationService(repo);
  }

  list(req, res) {
    const search = req.query.search ? req.query.search.trim() : '';
    const residents = search 
      ? this.queryService.searchResidents(search)  // changed
      : this.queryService.listResidents();         // changed
    
    // Assuming EJS or standard Express view engine
    res.render('residents/index', { residents, search });
  }

  showRegister(req, res) {
    res.render('residents/register', { errors: [], formData: {} });
  }

  register(req, res) {
    try {
      const result = this.registrationService.register(req.body);
      
      // If your T04 returns a flag object
      if (result && result.success === false) {
        return res.render('residents/register', { errors: result.errors || ['Validation failed'], formData: req.body });
      }
      
      res.redirect('/residents');
    } catch (error) {
      // If your T04 throws an Error
      // (Handle both single error messages and arrays of validation errors)
      const errorMessages = error.errors || [error.message];
      res.render('residents/register', { errors: errorMessages, formData: req.body });
    }
  }

  showEdit(req, res) {
    const resident = this.queryService.findById(req.params.id);
    if (!resident) {
      return res.status(404).send('Resident not found.');
    }
    res.render('residents/edit', { resident, errors: [] });
  }

  update(req, res) {
    const id = parseInt(req.params.id, 10);
    try {
      // 1. Call the correct method name: updateResident
      const result = this.updateService.updateResident(id, req.body);
      
      // 2. Handle the specific "not found" case your service returns
      if (result && result.notFound) {
        return res.status(404).send('Resident not found.');
      }
      
      // 3. Handle validation failures
      if (result && result.success === false) {
        // Fetch the original resident so we don't lose the ID/Status on the form
        const resident = this.queryService.findById(id);
        const displayData = { ...resident, ...req.body };
        return res.render('residents/edit', { resident: displayData, errors: result.errors });
      }
      
      // 4. Success! PRG pattern back to the list
      res.redirect('/residents');
    } catch (error) {
      // Catch any unexpected exceptions
      const resident = this.queryService.findById(id);
      if (!resident) return res.status(404).send('Resident not found.');
      
      const errorMessages = error.errors || [error.message];
      const displayData = { ...resident, ...req.body };
      res.render('residents/edit', { resident: displayData, errors: errorMessages });
    }
  }

  deactivate(req, res) {
    const id = parseInt(req.params.id, 10);
    try {
      // Change .deactivate() to match your service's method name
      this.deactivationService.deactivateResident(id); 
      res.redirect('/residents');
    } catch (error) {
      // Safely redirect back to the list if something goes wrong
      res.redirect('/residents'); 
    }
  }
}