import express from "express";
import {
  getProjectTasks,
  createTask,
  updateTask,
  markTaskComplete,
  deleteTask,
  getProjectCompletions,
} from "../Controllers/TaskController.js";
import { verifyToken } from "../Middlewares/AuthMiddleware.js"; // adjust path

const router = express.Router();

// All task routes require authentication
router.use(verifyToken);


router.post("/:projectId", verifyToken, createTask);
router.put("/:projectId/:taskId", verifyToken, updateTask);
router.post("/:projectId/:taskId/complete", verifyToken, markTaskComplete);
router.delete("/:projectId/:taskId", verifyToken, deleteTask);
router.get("/:projectId/completions", verifyToken, getProjectCompletions);
router.get("/:projectId", verifyToken, getProjectTasks);
export default router;

// ─────────────────────────────────────────────────────────────────────────────
// In your main app.js / server.js, register this router:
//
//   import taskRoutes from "./Routes/taskRoutes.js";
//   app.use("/api/tasks", taskRoutes);
// ─────────────────────────────────────────────────────────────────────────────