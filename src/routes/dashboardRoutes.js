import { Router } from 'express';
import { DashboardController } from '../controllers/DashboardController.js';

const router = Router();
const controller = new DashboardController();

// Bind the controller method correctly
router.get('/', (req, res) => controller.index(req, res));

export { router as dashboardRoutes };