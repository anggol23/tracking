import express from 'express';
import { getDeviceHistory, getRecentAlerts } from '../controllers/historyController.js';
import { authenticateUser } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateUser); // All history queries require authentication

router.get('/alerts/recent', getRecentAlerts);
router.get('/:deviceId', getDeviceHistory);

export default router;
