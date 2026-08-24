import Event from "../Models/EventModel.js";
import { Task } from "../Models/Tasksmodel.js";
import Project from "../Models/ProjectModel.js";
import Lead from "../Models/Lead.js";
import User from "../Models/UserModel.js";
import Attendance from "../Models/Attendance.js";
import Shift from "../Models/ShiftModel.js";

// Helper to determine color based on priority
const getPriorityColor = (priority) => {
  switch (priority?.toLowerCase()) {
    case "critical": return "#DC2626"; // Red
    case "high": return "#D97706";     // Amber
    case "medium": return "#2563EB";   // Blue
    case "low": return "#059669";      // Emerald
    default: return "#2563EB";
  }
};

const fmtMins = (m) => {
  if (!m) return "0m";
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h > 0 && rem > 0) return `${h}h ${rem}m`;
  if (h > 0) return `${h}h`;
  return `${rem}m`;
};

/**
 * GET /api/events
 * Aggregates role-based calendar events across all operational channels:
 * - Tasks & Deadlines
 * - Projects & Milestones
 * - Sales Callbacks & Pipeline
 * - Daily Attendance Records & Logs
 * - Shift Schedules
 * - Employee Leaves & Time-off
 * - Company Events & Meetings
 */
export const getEvents = async (req, res) => {
  const userId = req.user.id ? req.user.id.toString() : "";
  const userRole = req.user.role || "developer";
  const userDept = req.user.department || "General";
  const username = req.user.username;

  const { type, channel, filterUserId, department, role, priority, search } = req.query;
  const activeChannel = channel || type || "all";

  try {
    const combinedEvents = [];

    // Resolve target user if filterUserId is provided
    let targetUser = null;
    if (filterUserId && filterUserId !== "all") {
      try {
        targetUser = await User.findById(filterUserId).select("username email role department designation leaveRecords customWorkHours");
      } catch (err) {
        console.warn("Invalid filterUserId:", filterUserId);
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 1. Company & Custom Events
    // ──────────────────────────────────────────────────────────────────────────
    if (activeChannel === "all" || activeChannel === "event") {
      let eventQuery = {};
      if (["admin", "hr", "manager"].includes(userRole)) {
        if (targetUser) {
          eventQuery = {
            $or: [
              { user: targetUser._id },
              { targetRole: "all" },
              { targetRole: targetUser.role },
              { targetDepartment: "all" },
              { targetDepartment: targetUser.department },
            ],
          };
        } else {
          eventQuery = {};
        }
      } else {
        eventQuery = {
          $or: [
            { user: userId },
            { targetRole: "all" },
            { targetRole: userRole },
            { targetDepartment: "all" },
            { targetDepartment: userDept },
          ],
        };
      }

      if (department && department !== "all") {
        eventQuery.targetDepartment = { $in: [department, "all"] };
      }
      if (priority && priority !== "all") {
        eventQuery.priority = priority;
      }

      const events = await Event.find(eventQuery).populate("user", "username email department");
      events.forEach((ev) => {
        combinedEvents.push({
          _id: ev._id,
          id: `event_${ev._id}`,
          title: `[${(ev.eventType || "event").toUpperCase()}] ${ev.title}`,
          description: ev.description || "",
          start: ev.start,
          end: ev.end,
          eventType: ev.eventType || "event",
          channel: "event",
          priority: ev.priority,
          color: ev.color || (ev.eventType === "milestone" ? "#F59E0B" : ev.eventType === "meeting" ? "#2563EB" : "#10B981"),
          targetRole: ev.targetRole,
          targetDepartment: ev.targetDepartment,
          createdByName: ev.user?.username || "Admin",
          isCustomEvent: true,
          canDelete: ev.user?._id?.toString() === userId || ["admin", "manager"].includes(userRole),
        });
      });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 2. Developer & Engineering Tasks
    // ──────────────────────────────────────────────────────────────────────────
    if (activeChannel === "all" || activeChannel === "task") {
      let taskQuery = {};
      if (targetUser) {
        taskQuery = {
          $or: [
            { "assignedTo.id": targetUser._id.toString() },
            { "assignedTo.username": targetUser.username },
            { "createdBy.id": targetUser._id.toString() },
            { "createdBy.username": targetUser.username },
          ],
        };
      } else if (userRole === "developer") {
        taskQuery = {
          $or: [
            { "assignedTo.id": userId },
            { "assignedTo.username": username },
          ],
        };
      } else if (userRole === "team_lead") {
        taskQuery = {
          $or: [
            { "createdBy.id": userId },
            { "createdBy.username": username },
            { "assignedTo.id": userId },
            { "assignedTo.username": username },
          ],
        };
      } else if (["admin", "hr", "manager"].includes(userRole)) {
        taskQuery = {};
      } else {
        taskQuery = { "assignedTo.id": userId };
      }

      if (priority && priority !== "all") {
        taskQuery.priority = priority;
      }

      const tasks = await Task.find(taskQuery).populate("projectId", "projectName clientName status");
      tasks.forEach((t) => {
        const dDate = t.deadline || t.createdAt;
        combinedEvents.push({
          _id: t._id,
          id: `task_${t._id}`,
          title: `[Task] ${t.title} (${t.projectId?.projectName || "General"})`,
          description: t.description || "",
          start: dDate,
          end: dDate,
          eventType: "task",
          channel: "task",
          status: t.status,
          priority: t.priority,
          color: getPriorityColor(t.priority),
          assignedTo: t.assignedTo,
          projectName: t.projectId?.projectName || "General",
          clientName: t.projectId?.clientName || "",
          projectId: t.projectId?._id,
          links: t.links || [],
        });
      });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 3. Projects & Deliverable Milestones
    // ──────────────────────────────────────────────────────────────────────────
    if (activeChannel === "all" || activeChannel === "project") {
      let projectQuery = {};
      if (targetUser) {
        projectQuery = {
          $or: [
            { "assignedDeveloper.id": targetUser._id.toString() },
            { "assignedDeveloper.username": targetUser.username },
            { createdBy: targetUser.username },
          ],
        };
      } else if (userRole === "developer") {
        projectQuery = {
          $or: [
            { "assignedDeveloper.id": userId },
            { "assignedDeveloper.username": username },
          ],
        };
      } else if (userRole === "caller") {
        projectQuery = { createdBy: username };
      } else if (userRole === "team_lead") {
        const teamMembers = await User.find({ teamLeadId: userId }).select("_id username");
        const memberIds = [userId, ...teamMembers.map((m) => m._id.toString())];
        const memberNames = [username, ...teamMembers.map((m) => m.username)];
        projectQuery = {
          $or: [
            { "assignedDeveloper.id": { $in: memberIds } },
            { "assignedDeveloper.username": { $in: memberNames } },
            { createdBy: { $in: memberNames } },
          ],
        };
      } else if (["admin", "hr", "manager"].includes(userRole)) {
        projectQuery = {};
      }

      const projects = await Project.find(projectQuery);
      projects.forEach((p) => {
        const pDate = p.createdDate || p.createdAt;
        combinedEvents.push({
          _id: p._id,
          id: `proj_${p._id}`,
          title: `[Project] ${p.projectName} (${p.clientName})`,
          description: p.projectDetails || "",
          start: pDate,
          end: pDate,
          eventType: "project",
          channel: "project",
          status: p.status || "Active",
          color: "#4F46E5", // Indigo
          amount: userRole === "developer" ? undefined : p.amount,
          clientName: p.clientName,
          clientNumber: p.clientNumber,
          clientEmail: p.clientEmail,
          serviceType: p.serviceType || [],
          assignedDeveloper: p.assignedDeveloper || [],
        });
      });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 4. Sales Callbacks & Follow-ups (ONLY FOR CALLERS, MANAGERS, ADMINS)
    // ──────────────────────────────────────────────────────────────────────────
    if (userRole !== "developer" && (activeChannel === "all" || activeChannel === "lead")) {
      let leadQuery = {};
      if (targetUser) {
        leadQuery = {
          $or: [
            { leadOwner: targetUser.username },
            { userId: targetUser._id },
            { assignedTo: targetUser._id },
          ],
        };
      } else if (userRole === "caller") {
        leadQuery = {
          $or: [
            { leadOwner: username },
            { userId: userId },
            { assignedTo: userId },
          ],
        };
      } else if (["admin", "manager", "team_lead"].includes(userRole)) {
        leadQuery = {};
      }

      if (leadQuery) {
        const leads = await Lead.find(leadQuery);
        leads.forEach((l) => {
          const cbDate = l.followUpDate || l.createdAt;
          if (cbDate) {
            combinedEvents.push({
              _id: l._id,
              id: `lead_${l._id}`,
              title: `[Callback] ${l.leadName} (${l.leadType || "Lead"})`,
              description: l.note || "",
              start: cbDate,
              end: cbDate,
              eventType: "lead_callback",
              channel: "lead",
              status: l.status,
              leadType: l.leadType,
              color: l.leadType === "Hot Lead" ? "#DC2626" : l.leadType === "Callback" ? "#D97706" : "#059669",
              leadName: l.leadName,
              phoneNumber: l.phoneNumber,
              country: l.country,
              pitchedAmount: l.pitchedAmount || 0,
              currencySymbol: l.currencySymbol || "$",
              leadOwner: l.leadOwner,
            });
          }
        });
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 5. Daily Attendance Records & Live Logs
    // ──────────────────────────────────────────────────────────────────────────
    if (activeChannel === "all" || activeChannel === "attendance") {
      let attQuery = {};
      if (targetUser) {
        attQuery.user = targetUser._id;
      } else if (!["admin", "hr", "manager"].includes(userRole)) {
        attQuery.user = userId;
      }

      const attendances = await Attendance.find(attQuery)
        .populate("user", "username email role department designation")
        .sort({ clockIn: -1 })
        .limit(200);

      attendances.forEach((att) => {
        const staff = att.user?.username || "Employee";
        const workStr = fmtMins(att.totalWorkMinutes);
        const breakStr = fmtMins(att.totalBreakMinutes);
        const isLive = att.status === "active" || att.status === "on_break";
        const comp = att.shiftComplianceStatus || "on_time";

        combinedEvents.push({
          _id: att._id,
          id: `att_${att._id}`,
          title: `[Attendance] ${staff} (${isLive ? "🟢 Live" : workStr})`,
          description: `Clock In: ${new Date(att.clockIn).toLocaleTimeString()} | Total Work: ${workStr} | Break: ${breakStr}`,
          start: att.clockIn,
          end: att.clockOut || att.clockIn,
          eventType: "attendance",
          channel: "attendance",
          status: att.status,
          complianceStatus: comp,
          color: isLive ? "#059669" : comp === "late" ? "#D97706" : "#2563EB",
          staffName: staff,
          department: att.user?.department,
          designation: att.user?.designation,
          totalWorkMinutes: att.totalWorkMinutes,
          totalBreakMinutes: att.totalBreakMinutes,
          shiftName: att.shiftName,
          clockIn: att.clockIn,
          clockOut: att.clockOut,
        });
      });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 6. Shift Schedules & Active Rotas
    // ──────────────────────────────────────────────────────────────────────────
    if (activeChannel === "all" || activeChannel === "shift") {
      let shiftQuery = { isActive: true };
      const shifts = await Shift.find(shiftQuery).populate("assignedUsers", "username role department designation");

      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const DAYS_MAP = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

      shifts.forEach((s) => {
        let assigned = s.assignedUsers || [];
        if (targetUser) {
          assigned = assigned.filter((u) => u._id?.toString() === targetUser._id?.toString());
        } else if (!["admin", "hr", "manager"].includes(userRole)) {
          assigned = assigned.filter((u) => u._id?.toString() === userId.toString());
        }

        const [sHour, sMin] = (s.startTime || "09:00").split(":").map(Number);
        const [eHour, eMin] = (s.endTime || "18:00").split(":").map(Number);

        assigned.forEach((u) => {
          for (let d = 1; d <= daysInMonth; d++) {
            const currentDay = new Date(year, month, d);
            const dayName = DAYS_MAP[currentDay.getDay()];

            if ((s.workDays || []).includes(dayName)) {
              const startDt = new Date(year, month, d, sHour, sMin, 0);
              let endDt = new Date(year, month, d, eHour, eMin, 0);
              if (s.isNightShift || s.endTime < s.startTime) {
                endDt = new Date(year, month, d + 1, eHour, eMin, 0);
              }

              combinedEvents.push({
                id: `shift_${s._id}_${u._id}_${d}`,
                title: `[Shift] ${u.username} (${s.startTime} - ${s.endTime})`,
                description: `${s.name} - Break Allowance: ${s.allowedBreakMinutes || 60} mins`,
                start: startDt,
                end: endDt,
                eventType: "shift",
                channel: "shift",
                color: s.color || "#0284C7",
                staffName: u.username,
                shiftName: s.name,
                shiftTimes: `${s.startTime} - ${s.endTime}`,
                allowedBreakMinutes: s.allowedBreakMinutes,
                isNightShift: s.isNightShift,
              });
            }
          }
        });
      });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 7. Employee Leaves & Time-off
    // ──────────────────────────────────────────────────────────────────────────
    if (activeChannel === "all" || activeChannel === "leave") {
      let usersWithLeaves = [];
      if (targetUser) {
        usersWithLeaves = [targetUser];
      } else if (["admin", "hr", "manager"].includes(userRole)) {
        usersWithLeaves = await User.find({ "leaveRecords.0": { $exists: true } }).select("username department role leaveRecords");
      } else if (userRole === "team_lead") {
        const teamMembers = await User.find({ teamLeadId: userId }).select("_id");
        const memberIds = [userId, ...teamMembers.map((m) => m._id)];
        usersWithLeaves = await User.find({ _id: { $in: memberIds }, "leaveRecords.0": { $exists: true } }).select("username department role leaveRecords");
      } else {
        const selfUser = await User.findById(userId).select("username department role leaveRecords");
        if (selfUser) usersWithLeaves = [selfUser];
      }

      usersWithLeaves.forEach((u) => {
        (u.leaveRecords || []).forEach((rec) => {
          if (rec.startDate && rec.endDate) {
            combinedEvents.push({
              _id: rec._id,
              id: `leave_${rec._id || Math.random()}`,
              title: `[Leave] ${u.username} (${rec.duration || rec.type} - ${rec.leaveType || "paid"})`,
              description: rec.note || "Authorized Leave Request",
              start: rec.startDate,
              end: rec.endDate,
              eventType: "leave",
              channel: "leave",
              color: "#9333EA", // Purple
              staffName: u.username,
              department: u.department,
              leaveType: rec.leaveType || rec.type,
              status: rec.status || "approved",
              finalApprovedDays: rec.finalApprovedDays || rec.daysCount,
              note: rec.note,
            });
          }
        });
      });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Global Multi-Criteria Filtering (Search, Role, Department, Priority)
    // ──────────────────────────────────────────────────────────────────────────
    let filteredEvents = combinedEvents;

    if (role && role !== "all") {
      filteredEvents = filteredEvents.filter((ev) => {
        return (
          ev.targetRole === role ||
          ev.targetRole === "all" ||
          ev.staffName === targetUser?.username ||
          ev.assignedTo?.role === role
        );
      });
    }

    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      filteredEvents = filteredEvents.filter((ev) => {
        return (
          (ev.title || "").toLowerCase().includes(q) ||
          (ev.description || "").toLowerCase().includes(q) ||
          (ev.staffName || "").toLowerCase().includes(q) ||
          (ev.projectName || "").toLowerCase().includes(q) ||
          (ev.clientName || "").toLowerCase().includes(q) ||
          (ev.leadName || "").toLowerCase().includes(q)
        );
      });
    }

    res.status(200).json(filteredEvents);
  } catch (error) {
    console.error("Error fetching aggregated events:", error);
    res.status(500).json({ message: "Error fetching events", error: error.message });
  }
};

/**
 * POST /api/events
 * Create a new custom or company calendar event
 */
export const createEvent = async (req, res) => {
  const {
    title,
    description,
    start,
    end,
    eventType = "event",
    targetRole = "all",
    targetDepartment = "all",
    priority = "medium",
    color,
  } = req.body;

  const userId = req.user.id;

  try {
    const newEvent = new Event({
      title,
      description,
      start,
      end,
      eventType,
      targetRole,
      targetDepartment,
      priority,
      color: color || (eventType === "milestone" ? "#F59E0B" : eventType === "meeting" ? "#2563EB" : "#10B981"),
      user: userId,
    });

    const savedEvent = await newEvent.save();
    res.status(201).json(savedEvent);
  } catch (error) {
    console.error("Error in createEvent:", error);
    res.status(500).json({ message: "Error creating event", error: error.message });
  }
};

/**
 * PUT /api/events/:id
 * Update an existing calendar event
 */
export const updateEvent = async (req, res) => {
  const { id } = req.params;
  const { title, description, start, end, eventType, targetRole, targetDepartment, priority, color } = req.body;
  const userId = req.user.id;
  const userRole = req.user.role;

  try {
    let query = { _id: id };
    if (!["admin", "manager"].includes(userRole)) {
      query.user = userId;
    }

    const event = await Event.findOne(query);
    if (!event) {
      return res.status(404).json({ message: "Event not found or unauthorized to edit" });
    }

    if (title) event.title = title;
    if (description !== undefined) event.description = description;
    if (start) event.start = start;
    if (end) event.end = end;
    if (eventType) event.eventType = eventType;
    if (targetRole) event.targetRole = targetRole;
    if (targetDepartment) event.targetDepartment = targetDepartment;
    if (priority) event.priority = priority;
    if (color) event.color = color;

    const updatedEvent = await event.save();
    res.status(200).json(updatedEvent);
  } catch (error) {
    res.status(500).json({ message: "Error updating event", error: error.message });
  }
};

/**
 * DELETE /api/events/:id
 * Delete an event
 */
export const deleteEvent = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;

  try {
    let query = { _id: id };
    if (!["admin", "manager"].includes(userRole)) {
      query.user = userId;
    }

    const event = await Event.findOne(query);
    if (!event) {
      return res.status(404).json({ message: "Event not found or unauthorized to delete" });
    }

    await event.deleteOne();
    res.status(200).json({ message: "Event deleted successfully" });
  } catch (error) {
    console.error("Error deleting event:", error);
    res.status(500).json({ message: "Error deleting event", error: error.message });
  }
};
