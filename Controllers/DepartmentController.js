import Department from "../Models/DepartmentModel.js";
import User from "../Models/UserModel.js";

export const getDepartments = async (req, res) => {
  try {
    // Deduplicate any existing duplicate department records in DB
    const allDepts = await Department.find().sort({ createdAt: 1 }).lean();
    const seenNames = new Map();
    const duplicateIds = [];

    for (const dept of allDepts) {
      const normalizedName = dept.name.trim().toLowerCase();
      if (seenNames.has(normalizedName)) {
        duplicateIds.push(dept._id);
      } else {
        seenNames.set(normalizedName, dept);
      }
    }

    if (duplicateIds.length > 0) {
      await Department.deleteMany({ _id: { $in: duplicateIds } });
    }

    // Return only active, unique departments
    const departments = await Department.find({ isActive: true })
      .populate("headOfDepartment", "username email designation role")
      .sort({ name: 1 })
      .lean();

    // Attach staff count for each department
    const deptsWithCount = await Promise.all(
      departments.map(async (dept) => {
        const staffCount = await User.countDocuments({
          department: new RegExp(`^${dept.name.trim()}$`, "i"),
        });
        const tlCount = await User.countDocuments({
          department: new RegExp(`^${dept.name.trim()}$`, "i"),
          role: "team_lead",
        });
        return {
          ...dept,
          staffCount,
          tlCount,
        };
      })
    );

    res.status(200).json(deptsWithCount);
  } catch (error) {
    console.error("Error fetching departments:", error);
    res.status(500).json({ message: "Failed to fetch departments", error: error.message });
  }
};

export const createDepartment = async (req, res) => {
  try {
    const { name, code, description, headOfDepartment, color } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ message: "Department name is required" });
    }

    const trimmedName = name.trim();

    // Case-insensitive check
    const existing = await Department.findOne({
      name: { $regex: new RegExp(`^${trimmedName}$`, "i") },
    });

    if (existing) {
      return res.status(400).json({ message: `Department "${trimmedName}" already exists` });
    }

    const newDept = new Department({
      name: trimmedName,
      code: code ? code.trim().toUpperCase() : trimmedName.slice(0, 3).toUpperCase(),
      description: description?.trim() || "",
      headOfDepartment: headOfDepartment || null,
      color: color || "#2563EB",
    });

    await newDept.save();
    const populated = await Department.findById(newDept._id).populate(
      "headOfDepartment",
      "username email designation"
    );

    res.status(201).json(populated);
  } catch (error) {
    console.error("Error creating department:", error);
    res.status(500).json({ message: "Failed to create department", error: error.message });
  }
};

export const updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, description, headOfDepartment, color } = req.body;

    const dept = await Department.findById(id);
    if (!dept) {
      return res.status(404).json({ message: "Department not found" });
    }

    const oldName = dept.name;
    const trimmedName = name?.trim() || dept.name;

    // If changing name, verify uniqueness
    if (trimmedName.toLowerCase() !== oldName.toLowerCase()) {
      const existing = await Department.findOne({
        _id: { $ne: id },
        name: { $regex: new RegExp(`^${trimmedName}$`, "i") },
      });
      if (existing) {
        return res.status(400).json({ message: `Department "${trimmedName}" already exists` });
      }
    }

    dept.name = trimmedName;
    dept.code = code ? code.trim().toUpperCase() : dept.code;
    dept.description = description !== undefined ? description.trim() : dept.description;
    dept.headOfDepartment = headOfDepartment !== undefined ? headOfDepartment || null : dept.headOfDepartment;
    dept.color = color || dept.color;

    await dept.save();

    // If department name changed, migrate associated users
    if (oldName !== dept.name) {
      await User.updateMany(
        { department: oldName },
        { $set: { department: dept.name } }
      );
    }

    const populated = await Department.findById(dept._id).populate(
      "headOfDepartment",
      "username email designation"
    );

    res.status(200).json(populated);
  } catch (error) {
    console.error("Error updating department:", error);
    res.status(500).json({ message: "Failed to update department", error: error.message });
  }
};

export const deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const dept = await Department.findById(id);
    if (!dept) {
      return res.status(404).json({ message: "Department not found" });
    }

    // Reassign any assigned users to General
    await User.updateMany({ department: dept.name }, { $set: { department: "General" } });

    await Department.findByIdAndDelete(id);
    res.status(200).json({ message: "Department deleted successfully" });
  } catch (error) {
    console.error("Error deleting department:", error);
    res.status(500).json({ message: "Failed to delete department", error: error.message });
  }
};
