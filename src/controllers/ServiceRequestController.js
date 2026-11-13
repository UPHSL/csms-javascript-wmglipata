import { ServiceRequestQueryService } from '../services/ServiceRequestQueryService.js';
import { ServiceRequestSubmissionService } from '../services/ServiceRequestSubmissionService.js';
import { ServiceRequestStatusService } from '../services/ServiceRequestStatusService.js';

export class ServiceRequestController {
  constructor() {
    this.queryService = new ServiceRequestQueryService();
    this.submissionService = new ServiceRequestSubmissionService();
    this.statusService = new ServiceRequestStatusService();
  }

  // GET /service-requests
  index(req, res) {
    try {
      const search = req.query.search || '';
      const status = req.query.status || '';
      
      const serviceRequests = this.queryService.searchServiceRequests(search, status);
      
      res.render('service-requests/index', { 
        serviceRequests, 
        searchQuery: search, 
        statusFilter: status 
      });
    } catch (error) {
      res.render('service-requests/index', { 
        serviceRequests: [], 
        searchQuery: req.query.search || '', 
        statusFilter: req.query.status || '' 
      });
    }
  }

  // GET /service-requests/new
  createForm(req, res) {
    res.render('service-requests/new', { formData: {}, errors: [] });
  }

  // POST /service-requests/new
  submit(req, res) {
    const payload = { ...req.body };
    if (payload.residentId) {
      payload.residentId = parseInt(payload.residentId, 10);
    }
    payload.status = 'Pending';

    try {
      const result = this.submissionService.submit(payload);
      
      if (result.success) {
        return res.redirect('/service-requests');
      }

      let errorMessages = [...(result.errors || [])];
      if (result.residentNotFound) errorMessages.push('Resident not found.');
      if (result.residentInactive) errorMessages.push('Inactive Residents cannot submit new Service Requests.');

      res.render('service-requests/new', { formData: req.body, errors: errorMessages });
    } catch (error) {
      res.render('service-requests/new', { formData: req.body, errors: [error.message] });
    }
  }

  // GET /service-requests/:id
  show(req, res) {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(404).send('Service Request not found.');
    }
    try {
      const serviceRequest = this.queryService.viewServiceRequest(id);
      if (!serviceRequest) {
        return res.status(404).send('Service Request not found.');
      }
      res.render('service-requests/show', { serviceRequest });
    } catch (error) {
      res.status(500).send('An error occurred while loading the service request.');
    }
  }

  // POST /service-requests/:id/start
  startProcessing(req, res) {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(404).send('Service Request not found.');
    }
    try {
      this.statusService.updateStatus(id, 'In Progress');
      res.redirect(`/service-requests/${id}`);
    } catch (error) {
      res.redirect(`/service-requests/${id}`);
    }
  }

  // POST /service-requests/:id/complete
  complete(req, res) {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(404).send('Service Request not found.');
    }
    try {
      this.statusService.updateStatus(id, 'Completed');
      res.redirect(`/service-requests/${id}`);
    } catch (error) {
      res.redirect(`/service-requests/${id}`);
    }
  }

  // POST /service-requests/:id/cancel
  cancel(req, res) {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(404).send('Service Request not found.');
    }
    try {
      this.statusService.updateStatus(id, 'Cancelled');
      res.redirect(`/service-requests/${id}`);
    } catch (error) {
      res.redirect(`/service-requests/${id}`);
    }
  }
}