
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

  const isCreator = 
    project.createdBy === username || 
    project.createdBy?.toLowerCase() === username?.toLowerCase() ||
    project.createdBy === userId?.toString();

  const isAssigned = project.assignedDeveloper?.some((d) => {
    if (!d) return false;
    const devId = typeof d === "object" ? (d.id || d._id) : d;
    const devUser = typeof d === "object" ? d.username : "";
    return (
      devId?.toString() === userId?.toString() ||
      (devUser && devUser.toLowerCase() === username?.toLowerCase())
    );
  });

  const role = isCreator ? "creator" : isAssigned ? "developer" : null;
  return { project, role };
};

// ── Helper: check if task is within 2 hours of creation ───────────────────────
const isTaskWithin2Hours = (task) => {
  if (!task) return false;
  let createdTime = 0;
  if (task.createdAt) {
    createdTime = new Date(task.createdAt).getTime();
  } else if (task._id) {
    // Fallback: extract timestamp from MongoDB ObjectId
    createdTime = parseInt(task._id.toString().substring(0, 8), 16) * 1000;
  }
  if (!createdTime) return false;
  return (Date.now() - createdTime) <= 2 * 60 * 60 * 1000;
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

    const tasks = await Task.find({ projectId }).sort({ createdAt: -1 }).lean();

    // -- MANUALLY ATTACH AVATARS --
    const userIds = new Set();
    tasks.forEach(t => {
        if (t.assignedTo?.id) userIds.add(t.assignedTo.id.toString());
        if (t.createdBy?.id) userIds.add(t.createdBy.id.toString());
    });

    if (userIds.size > 0) {
        const users = await UserModel.find({ _id: { $in: Array.from(userIds) } }).select("avatar").lean();
        const avatarMap = {};
        users.forEach(u => avatarMap[u._id.toString()] = u.avatar);

        tasks.forEach(t => {
            if (t.assignedTo?.id && avatarMap[t.assignedTo.id.toString()]) {
                t.assignedTo.avatar = avatarMap[t.assignedTo.id.toString()];
            }
            if (t.createdBy?.id && avatarMap[t.createdBy.id.toString()]) {
                t.createdBy.avatar = avatarMap[t.createdBy.id.toString()];
            }
        });
    }

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

    const username = await getUserFromToken(userId);

    const { project, role } = await getProjectRoleWithUsername(projectId, userId, username);
    if (!project) return res.status(404).json({ message: "Project not found" });
    const isLeadOrAdmin = userRole === "admin" || userRole === "team_lead" || userRole === "manager";
    if (!isLeadOrAdmin && !role) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const { title, description, links, priority, deadline, assignedTo } = req.body;

    if (role === "developer" && !isLeadOrAdmin) {
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
    
    const isLeadOrAdmin = userRole === "admin" || userRole === "team_lead" || userRole === "manager";
    if (!isLeadOrAdmin && !role) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const task = await Task.findOne({ _id: taskId, projectId });
    if (!task) return res.status(404).json({ message: "Task not found" });

    const isCreatorOrAdmin = isLeadOrAdmin || role === "creator";
    const isAssigned = task.assignedTo?.id?.toString() === userId?.toString() || task.assignedTo?.username?.toLowerCase() === username?.toLowerCase();
    const isDevWithin2Hours = role === "developer" && isTaskWithin2Hours(task);
    const canEditFullTask = isCreatorOrAdmin || isDevWithin2Hours;

    // If they aren't admin/creator, aren't assigned, and aren't a dev within 2 hours
    if (!isCreatorOrAdmin && !isAssigned && !isDevWithin2Hours) {
      return res.status(403).json({ message: "Not authorized to edit this task" });
    }

    const { title, description, links, priority, deadline, status, assignedTo } = req.body;

    if (!canEditFullTask) {
      // Meaning they are only assigned but past the 2-hour window -> Can only change status
      if (status !== undefined) {
        task.status = status;
        if (status === "Done") {
          task.completedAt = task.completedAt || new Date();
          task.completedBy = { id: userId, username };
        } else {
          task.completedAt = null;
          task.completedBy = null;
        }
      }
    } else {
      // Admin, Creator, or Developer within 2 hours -> Full access
      if (title !== undefined) task.title = title;
      if (description !== undefined) task.description = description;
      if (links !== undefined) task.links = links;
      if (priority !== undefined) task.priority = priority;
      if (deadline !== undefined) task.deadline = deadline;
      if (assignedTo !== undefined) task.assignedTo = assignedTo;
      if (status !== undefined) {
        task.status = status;
        if (status === "Done") {
          task.completedAt = task.completedAt || new Date();
          task.completedBy = { id: userId, username };
        } else {
          task.completedAt = null;
          task.completedBy = null;
        }
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

    let role = null;

    if (userRole !== "admin") {
      const username = await getUserFromToken(userId);
      const projectData = await getProjectRoleWithUsername(projectId, userId, username);
      if (!projectData.project) return res.status(404).json({ message: "Project not found" });
      role = projectData.role;
    }

    // Find the task FIRST to check its creation time
    const task = await Task.findOne({ _id: taskId, projectId });
    if (!task) return res.status(404).json({ message: "Task not found" });

    // Permissions check
    if (userRole !== "admin" && role !== "creator") {
      if (role === "developer") {
        const isWithin2Hours = isTaskWithin2Hours(task);
        if (!isWithin2Hours) {
          return res.status(403).json({ 
            message: "Developers can only delete tasks within 2 hours of creation." 
          });
        }
      } else {
        return res.status(403).json({ message: "Not authorized to delete this task." });
      }
    }

    await task.deleteOne();
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

    const completions = await TaskCompletion.find({ projectId }).sort({ completedAt: -1 }).lean();

    // -- MANUALLY ATTACH AVATARS --
    const userIds = new Set();
    completions.forEach(c => {
        if (c.completedBy?.id) userIds.add(c.completedBy.id.toString());
    });

    if (userIds.size > 0) {
        const users = await UserModel.find({ _id: { $in: Array.from(userIds) } }).select("avatar").lean();
        const avatarMap = {};
        users.forEach(u => avatarMap[u._id.toString()] = u.avatar);

        completions.forEach(c => {
            if (c.completedBy?.id && avatarMap[c.completedBy.id.toString()]) {
                c.completedBy.avatar = avatarMap[c.completedBy.id.toString()];
            }
        });
    }

    res.status(200).json(completions);
  } catch (error) {
    console.error("getProjectCompletions error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// ── GET /api/tasks/developer/tasks ───────────────────────────────────────────
export const getMyTasks = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const user = await UserModel.findById(userId).select("username").lean();
    const username = user?.username || "";

    let query = {};
    if (userRole === "admin") {
      // Admins can see all tasks across the company when accessing developer hub
      query = {};
    } else {
      query = {
        $or: [
          { "assignedTo.id": userId },
          { "assignedTo.id": userId.toString() },
          { "assignedTo.username": username },
          { "assignedTo.username": new RegExp(`^${username}$`, "i") },
          { "createdBy.id": userId },
          { "createdBy.id": userId.toString() },
        ],
      };
    }

    const tasks = await Task.find(query)
      .populate("projectId", "projectName clientName status amount serviceType")
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json(tasks);
  } catch (error) {
    console.error("getMyTasks error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// ── PUT /api/tasks/bulk-status ──────────────────────────────────────────────
export const bulkUpdateTaskStatus = async (req, res) => {
  try {
    const { taskIds, status } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({ message: "taskIds array is required" });
    }

    const isLeadOrAdmin = userRole === "admin" || userRole === "team_lead" || userRole === "manager";
    const query = { _id: { $in: taskIds } };
    if (!isLeadOrAdmin) {
      // Developers can only bulk-update tasks assigned to them
      query["assignedTo.id"] = userId;
    }

    const updateFields = { status };
    if (status === "Done") {
      updateFields.completedAt = new Date();
      updateFields.completedBy = { id: userId, username: req.user.username || "Staff" };
    } else {
      updateFields.completedAt = null;
      updateFields.completedBy = null;
    }

    const result = await Task.updateMany(query, { $set: updateFields });

    res.json({
      message: `Successfully updated ${result.modifiedCount} task(s) to ${status}`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("bulkUpdateTaskStatus error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// ── GET /api/tasks/all ───────────────────────────────────────────────────────
export const getAllTasks = async (req, res) => {
  try {
    const tasks = await Task.find()
      .populate("projectId", "projectName clientName status amount serviceType")
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json(tasks);
  } catch (error) {
    console.error("getAllTasks error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};














