import { Router } from 'express';
import { ResidentController } from '../controllers/ResidentController.js';

const router = Router();
const controller = new ResidentController();

router.get('/', (req, res) => controller.list(req, res));
router.get('/register', (req, res) => controller.showRegister(req, res));
router.post('/register', (req, res) => controller.register(req, res));
router.get('/:id/edit', (req, res) => controller.showEdit(req, res));
router.post('/:id/edit', (req, res) => controller.update(req, res));
router.post('/:id/deactivate', (req, res) => controller.deactivate(req, res));

export default router;