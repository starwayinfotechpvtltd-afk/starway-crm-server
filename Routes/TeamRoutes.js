import express from "express";
import TeamModel from "../Models/TeamModel.js";
import UserModel from "../Models/UserModel.js";
import { verifyToken, isAdmin, isTeamLead } from "../Middlewares/AuthMiddleware.js";

const router = express.Router();

// Create a Team
router.post("/", verifyToken, isAdmin, async (req, res) => {
  const { teamName, teamType, department, description, managerId, teamLeadId, memberIds, projectIds } = req.body;
  try {
    const newTeam = new TeamModel({
      teamName,
      teamType: teamType || "development",
      department: department || "Engineering",
      description: description || "",
      manager: managerId || null,
      teamLead: teamLeadId || null,
      members: memberIds || [],
      projects: projectIds || [],
    });
    await newTeam.save();

    // Update members' teamId & reportingTo if teamLead exists
    if (memberIds && memberIds.length > 0) {
      await UserModel.updateMany(
        { _id: { $in: memberIds } },
        { 
          $set: { 
            teamId: newTeam._id,
            ...(teamLeadId ? { reportingTo: teamLeadId } : {})
          } 
        }
      );
    }

    const populatedTeam = await TeamModel.findById(newTeam._id)
      .populate("manager", "username email avatar designation role")
      .populate("teamLead", "username email avatar designation role")
      .populate("members", "username email avatar designation role department");

    res.status(201).json(populatedTeam);
  } catch (error) {
    console.error("Create team error:", error);
    res.status(500).json({ message: "Error creating team", error: error.message });
  }
});

// Get all teams (populated with names, roles, avatars)
router.get("/", verifyToken, async (req, res) => {
  try {
    const teams = await TeamModel.find()
      .populate("manager", "username email avatar designation role")
      .populate("teamLead", "username email avatar designation role")
      .populate("members", "username email avatar designation role department")
      .populate("projects", "projectName status clientName amount");
    res.json(teams);
  } catch (error) {
    res.status(500).json({ message: "Error fetching teams" });
  }
});

// Get Team for current logged-in user (TL or member)
router.get("/my-team", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    // Find team where user is teamLead, manager, or member
    let team = await TeamModel.findOne({
      $or: [
        { teamLead: userId },
        { manager: userId },
        { members: userId }
      ]
    })
      .populate("manager", "username email avatar designation role")
      .populate("teamLead", "username email avatar designation role")
      .populate("members", "username email avatar designation role department customWorkHours")
      .populate("projects", "projectName status clientName amount assignedDeveloper");

    if (!team) {
      return res.json({ team: null, message: "No team assigned" });
    }

    res.json({ team });
  } catch (error) {
    console.error("Get my team error:", error);
    res.status(500).json({ message: "Error fetching team details" });
  }
});

// Update Team (Edit Name, Manager, TeamLead, Members, Projects)
router.put("/:id", verifyToken, isAdmin, async (req, res) => {
  const { teamName, teamType, department, description, managerId, teamLeadId, memberIds, projectIds } = req.body;
  try {
    const updatedTeam = await TeamModel.findByIdAndUpdate(
      req.params.id,
      { 
        teamName, 
        teamType: teamType || "development",
        department: department || "Engineering",
        description: description || "",
        manager: managerId || null, 
        teamLead: teamLeadId || null, 
        members: memberIds || [],
        projects: projectIds || []
      },
      { new: true }
    )
      .populate("manager", "username email avatar designation role")
      .populate("teamLead", "username email avatar designation role")
      .populate("members", "username email avatar designation role department")
      .populate("projects", "projectName status clientName amount");

    if (memberIds && memberIds.length > 0) {
      await UserModel.updateMany(
        { _id: { $in: memberIds } },
        { 
          $set: { 
            teamId: req.params.id,
            ...(teamLeadId ? { reportingTo: teamLeadId } : {})
          } 
        }
      );
    }

    res.json(updatedTeam);
  } catch (error) {
    console.error("Update team error:", error);
    res.status(500).json({ message: "Update failed" });
  }
});

// Delete Team
router.delete("/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    await TeamModel.findByIdAndDelete(req.params.id);
    await UserModel.updateMany({ teamId: req.params.id }, { $set: { teamId: null } });
    res.json({ message: "Team deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Delete failed" });
  }
});

export default router;