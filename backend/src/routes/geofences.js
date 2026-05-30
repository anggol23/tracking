import express from 'express';
import { getAllGeofences, createGeofence, deleteGeofence } from '../controllers/geofenceController.js';
import { authenticateUser, authorizeRole } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateUser); // Require authentication

router.get('/', getAllGeofences);
router.post('/', authorizeRole('admin'), createGeofence);
router.delete('/:id', authorizeRole('admin'), deleteGeofence);

export default router;
