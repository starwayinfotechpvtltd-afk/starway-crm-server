import express from 'express';
import { verifyToken, isHR } from '../Middlewares/AuthMiddleware.js';
import {
  getAllShifts, getMyShift, createShift, updateShift, deleteShift,
  assignUsersToShift, removeUserFromShift, changeUserShift
} from '../Controllers/ShiftController.js';

const router = express.Router();

router.get('/my', verifyToken, getMyShift);
router.get('/', verifyToken, isHR, getAllShifts);
router.post('/', verifyToken, isHR, createShift);
router.put('/change-user', verifyToken, isHR, changeUserShift);
router.put('/:id', verifyToken, isHR, updateShift);
router.delete('/:id', verifyToken, isHR, deleteShift);
router.post('/:id/assign', verifyToken, isHR, assignUsersToShift);
router.delete('/:id/users/:userId', verifyToken, isHR, removeUserFromShift);

export default router;
