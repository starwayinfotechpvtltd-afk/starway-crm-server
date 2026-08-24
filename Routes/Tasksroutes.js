import express from "express";
import {
  getProjectTasks,
  createTask,
  updateTask,
  markTaskComplete,
  deleteTask,
  getProjectCompletions,
  getMyTasks,
  getAllTasks,
  bulkUpdateTaskStatus,
} from "../Controllers/TaskController.js";
import {
  getComments,
  createComment,
  deleteComment,
} from "../Controllers/Commentcontroller.js";
import { verifyToken } from "../Middlewares/AuthMiddleware.js";

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// ── Specific Named Routes (Must come BEFORE dynamic /:projectId) ──────────────
router.get("/developer/tasks", getMyTasks);
router.get("/my-tasks", getMyTasks);
router.get("/team-lead/tasks", getAllTasks);
router.get("/all", getAllTasks);
router.put("/bulk-status", bulkUpdateTaskStatus);

// ── Dynamic Project Task CRUD ────────────────────────────────────────────────
router.get("/:projectId/completions", getProjectCompletions);
router.get("/:projectId", getProjectTasks);
router.post("/:projectId", createTask);
router.put("/:projectId/:taskId", updateTask);
router.delete("/:projectId/:taskId", deleteTask);
router.post("/:projectId/:taskId/complete", markTaskComplete);

// ── Comment routes ────────────────────────────────────────────────────────────
router.get("/:projectId/:taskId/comments", getComments);
router.post("/:projectId/:taskId/comments", createComment);
router.delete("/:projectId/:taskId/comments/:commentId", deleteComment);

export default router;
