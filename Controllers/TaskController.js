import { Task, TaskCompletion } from "../Models/Tasksmodel.js";
import Project from "../Models/ProjectModel.js";
import UserModel from "../Models/UserModel.js";

// ── Fetch the current user's username from DB (JWT doesn't carry it) ──────────
const getUserFromToken = async (userId) => {
  const user = await UserModel.findById(userId).select("username").lean();
  if (!user) throw new Error("User not found");
  return user.username;
};

// ── Helper: resolve project + role (needs username for creator check) ─────────
const getProjectRoleWithUsername = async (projectId, userId, username) => {
  const project = await Project.findById(projectId)
    .select("createdBy assignedDeveloper")
    .lean();
  if (!project) return { project: null, role: null };

  const isCreator = project.createdBy === username;
  const isAssigned = project.assignedDeveloper?.some(
    (d) => d.id?.toString() === userId?.toString()
  );

  const role = isCreator ? "creator" : isAssigned ? "developer" : null;
  return { project, role };
};

// ── GET /api/tasks/:projectId ─────────────────────────────────────────────────
export const getProjectTasks = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (userRole !== "admin") {
      const username = await getUserFromToken(userId);
      const { project, role } = await getProjectRoleWithUsername(projectId, userId, username);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!role) return res.status(403).json({ message: "Not authorized" });
    }

    const tasks = await Task.find({ projectId }).sort({ createdAt: -1 });
    res.status(200).json(tasks);
  } catch (error) {
    console.error("getProjectTasks error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// ── POST /api/tasks/:projectId ────────────────────────────────────────────────
export const createTask = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Always fetch username from DB — JWT payload does not carry it
    const username = await getUserFromToken(userId);

    const { project, role } = await getProjectRoleWithUsername(projectId, userId, username);
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (userRole !== "admin" && !role) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const { title, description, links, priority, deadline, assignedTo } = req.body;

    // Developers can only assign to themselves or other project developers
    if (role === "developer" && userRole !== "admin") {
      const projectDevIds = project.assignedDeveloper?.map((d) => d.id?.toString());
      if (assignedTo?.id && !projectDevIds?.includes(assignedTo.id?.toString())) {
        return res.status(403).json({
          message: "Developers can only assign tasks to themselves or other project developers",
        });
      }
    }

    const task = new Task({
      projectId,
      title,
      description,
      links: links || [],
      priority: priority || "Medium",
      deadline: deadline || null,
      createdBy: { id: userId, username },
      assignedTo: assignedTo || { id: userId, username },
    });

    const saved = await task.save();
    res.status(201).json(saved);
  } catch (error) {
    console.error("createTask error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// ── PUT /api/tasks/:projectId/:taskId ─────────────────────────────────────────
export const updateTask = async (req, res) => {
  try {
    const { projectId, taskId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const username = await getUserFromToken(userId);
    const { project, role } = await getProjectRoleWithUsername(projectId, userId, username);
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (userRole !== "admin" && !role) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const task = await Task.findOne({ _id: taskId, projectId });
    if (!task) return res.status(404).json({ message: "Task not found" });

    const isCreatorOrAdmin = userRole === "admin" || role === "creator";
    const isAssigned = task.assignedTo?.id?.toString() === userId?.toString();

    if (!isCreatorOrAdmin && !isAssigned) {
      return res.status(403).json({ message: "Not authorized to edit this task" });
    }

    const { title, description, links, priority, deadline, status, assignedTo } = req.body;

    if (!isCreatorOrAdmin) {
      // Developers can only update status on their own assigned tasks
      if (status) task.status = status;
    } else {
      if (title !== undefined) task.title = title;
      if (description !== undefined) task.description = description;
      if (links !== undefined) task.links = links;
      if (priority !== undefined) task.priority = priority;
      if (deadline !== undefined) task.deadline = deadline;
      if (status !== undefined) task.status = status;
      if (assignedTo !== undefined) task.assignedTo = assignedTo;

      // Creator/admin dragging to Done also logs completion
      if (status === "Done" && !task.completedAt) {
        task.completedAt = new Date();
        task.completedBy = { id: userId, username };
      }
    }

    const updated = await task.save();
    res.status(200).json(updated);
  } catch (error) {
    console.error("updateTask error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// ── POST /api/tasks/:projectId/:taskId/complete ───────────────────────────────
export const markTaskComplete = async (req, res) => {
  try {
    const { projectId, taskId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const username = await getUserFromToken(userId);

    const task = await Task.findOne({ _id: taskId, projectId });
    if (!task) return res.status(404).json({ message: "Task not found" });

    const isAssigned = task.assignedTo?.id?.toString() === userId?.toString();
    const isAdmin = userRole === "admin";

    if (!isAssigned && !isAdmin) {
      return res.status(403).json({ message: "Only the assigned developer can complete this task" });
    }

    if (task.status === "Done") {
      return res.status(400).json({ message: "Task is already completed" });
    }

    task.status = "Done";
    task.completedAt = new Date();
    task.completedBy = { id: userId, username };

    await task.save();

    // Write to completion history collection
    await TaskCompletion.create({
      taskId: task._id,
      projectId: task.projectId,
      taskTitle: task.title,
      completedBy: { id: userId, username },
      assignedBy: task.createdBy,
      completedAt: task.completedAt,
      priority: task.priority,
      deadline: task.deadline,
    });

    res.status(200).json({ message: "Task marked complete", task });
  } catch (error) {
    console.error("markTaskComplete error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// ── DELETE /api/tasks/:projectId/:taskId ──────────────────────────────────────
export const deleteTask = async (req, res) => {
  try {
    const { projectId, taskId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (userRole !== "admin") {
      const username = await getUserFromToken(userId);
      const { project, role } = await getProjectRoleWithUsername(projectId, userId, username);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (role !== "creator") {
        return res.status(403).json({ message: "Only the project creator can delete tasks" });
      }
    }

    const deleted = await Task.findOneAndDelete({ _id: taskId, projectId });
    if (!deleted) return res.status(404).json({ message: "Task not found" });

    res.status(200).json({ message: "Task deleted" });
  } catch (error) {
    console.error("deleteTask error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// ── GET /api/tasks/:projectId/completions ─────────────────────────────────────
export const getProjectCompletions = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (userRole !== "admin") {
      const username = await getUserFromToken(userId);
      const { project, role } = await getProjectRoleWithUsername(projectId, userId, username);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!role) return res.status(403).json({ message: "Not authorized" });
    }

    const completions = await TaskCompletion.find({ projectId }).sort({ completedAt: -1 });
    res.status(200).json(completions);
  } catch (error) {
    console.error("getProjectCompletions error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};