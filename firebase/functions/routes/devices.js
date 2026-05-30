import express from 'express';
import {
  getAllDevices,
  createDevice,
  updateDevice,
  deleteDevice,
  regenerateToken,
} from '../controllers/deviceController.js';
import { authenticateUser, authorizeRole } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateUser); // All device routes require authentication

router.get('/', getAllDevices);
router.post('/', authorizeRole('admin'), createDevice);
router.put('/:id', authorizeRole('admin'), updateDevice);
router.delete('/:id', authorizeRole('admin'), deleteDevice);
router.post('/:id/token/regenerate', authorizeRole('admin'), regenerateToken);

export default router;
