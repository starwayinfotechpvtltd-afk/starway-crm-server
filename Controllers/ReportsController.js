import Project from "../Models/ProjectModel.js";
import { Task, TaskCompletion } from "../Models/Tasksmodel.js";
import UserModel from "../Models/UserModel.js";

export const getDeveloperDashboardData = async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;

        // 1. Determine which projects this user is allowed to see
        let projectQuery = {};
        if (userRole !== "admin" && userRole !== "hr" && userRole !== "manager") {
            const user = await UserModel.findById(userId).select("username").lean();
            const username = user?.username || "";

            projectQuery = {
                $or: [
                    { createdBy: username },
                    { "assignedDeveloper.id": userId },
                    { "assignedDeveloper.username": new RegExp(`^${username}$`, "i") }
                ]
            };
        }

        // 2. Fetch Projects
        const projects = await Project.find(projectQuery).lean();
        const projectIds = projects.map(p => p._id);

        // 3. Fetch Tasks & Completions
        const [tasks, completions] = await Promise.all([
            Task.find({ projectId: { $in: projectIds } }).lean(),
            TaskCompletion.find({ projectId: { $in: projectIds } }).lean()
        ]);

        // ---------------------------------------------------------
        // 4. MANUALLY FETCH AND ATTACH AVATARS
        // ---------------------------------------------------------
        const uniqueUserIds = new Set();
        tasks.forEach(t => {
            if (t.assignedTo?.id) uniqueUserIds.add(t.assignedTo.id.toString());
            if (t.createdBy?.id) uniqueUserIds.add(t.createdBy.id.toString());
        });
        completions.forEach(c => {
            if (c.completedBy?.id) uniqueUserIds.add(c.completedBy.id.toString());
        });

        // Fetch all those users from DB and map their avatars
        const users = await UserModel.find({ _id: { $in: Array.from(uniqueUserIds) } })
                                     .select("avatar").lean();
        
        const avatarMap = {};
        users.forEach(u => {
            avatarMap[u._id.toString()] = u.avatar;
        });

        // 5. Map the project name & inject avatars to the tasks
        const projectMap = {};
        projects.forEach(p => {
            projectMap[p._id.toString()] = p.projectName || "Unknown";
        });

        const formattedTasks = tasks.map(t => {
            if (t.assignedTo?.id && avatarMap[t.assignedTo.id.toString()]) {
                t.assignedTo.avatar = avatarMap[t.assignedTo.id.toString()];
            }
            if (t.createdBy?.id && avatarMap[t.createdBy.id.toString()]) {
                t.createdBy.avatar = avatarMap[t.createdBy.id.toString()];
            }
            return {
                ...t,
                projectName: projectMap[t.projectId?.toString()] || "Unknown"
            };
        });

        const formattedCompletions = completions.map(c => {
            if (c.completedBy?.id && avatarMap[c.completedBy.id.toString()]) {
                c.completedBy.avatar = avatarMap[c.completedBy.id.toString()];
            }
            return c;
        });
        // ---------------------------------------------------------

        // 6. Send payload back
        res.status(200).json({
            projects,
            tasks: formattedTasks,
            completions: formattedCompletions
        });

    } catch (error) {
        console.error("Dashboard Data error:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};