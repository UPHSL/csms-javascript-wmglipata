import { Router } from 'express';
import { ServiceRequestController } from '../controllers/ServiceRequestController.js';

export const serviceRequestRoutes = Router();
const controller = new ServiceRequestController();

// Query and listing
serviceRequestRoutes.get('/', (req, res) => controller.index(req, res));

// Submission Form (Must come before /:id so Express doesn't think "new" is an ID)
serviceRequestRoutes.get('/new', (req, res) => controller.createForm(req, res));
serviceRequestRoutes.post('/new', (req, res) => controller.submit(req, res));

// View details
serviceRequestRoutes.get('/:id', (req, res) => controller.show(req, res));

// T10 Workflow Actions (Using POST to safely mutate state)
serviceRequestRoutes.post('/:id/start', (req, res) => controller.startProcessing(req, res));
serviceRequestRoutes.post('/:id/complete', (req, res) => controller.complete(req, res));
serviceRequestRoutes.post('/:id/cancel', (req, res) => controller.cancel(req, res));