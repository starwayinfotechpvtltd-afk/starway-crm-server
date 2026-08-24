import express from "express";
import {
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from "../Controllers/DepartmentController.js";
import { verifyToken, isAdmin, isHR } from "../Middlewares/AuthMiddleware.js";

const router = express.Router();

// Any authenticated user can read departments
router.get("/", verifyToken, getDepartments);

// Only Admin or HR can create, update, or delete departments
router.post("/", verifyToken, isHR, createDepartment);
router.put("/:id", verifyToken, isHR, updateDepartment);
router.delete("/:id", verifyToken, isHR, deleteDepartment);

export default router;
