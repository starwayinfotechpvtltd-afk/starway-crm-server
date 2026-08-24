import express from 'express';
import { verifyToken, isHR } from '../Middlewares/AuthMiddleware.js';
import {
  getConfig, updateConfig, clockIn, clockOut, startBreak, endBreak,
  getTodayStatus, getMyAttendance, getAllAttendance, getTodayBoard, manualOverride,
  setSaturdayOverride, deleteSaturdayOverride
} from '../Controllers/attendanceController.js';

const router = express.Router();
router.get('/config', verifyToken, getConfig);
router.put('/config', verifyToken, isHR, updateConfig);
router.post('/clock-in', verifyToken, clockIn);
router.post('/clock-out', verifyToken, clockOut);
router.post('/break/start', verifyToken, startBreak);
router.post('/break/end', verifyToken, endBreak);
router.get('/today', verifyToken, getTodayStatus);
router.get('/my', verifyToken, getMyAttendance);
router.get('/all', verifyToken, isHR, getAllAttendance);
router.get('/today-board', verifyToken, isHR, getTodayBoard);
router.put('/:id/override', verifyToken, isHR, manualOverride);
router.post('/saturday-override', verifyToken, isHR, setSaturdayOverride);
router.delete('/saturday-override/:date', verifyToken, isHR, deleteSaturdayOverride);

export default router;
