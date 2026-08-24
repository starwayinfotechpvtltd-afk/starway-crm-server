// import express from "express";
// import dotenv from "dotenv";
// import jwt from "jsonwebtoken";
// import multer from "multer";
// import { v2 as cloudinary } from "cloudinary";

// // FILES IMPORTS
// import UserModel from "../Models/UserModel.js";
// import { verifyToken, isAdmin } from "../Middlewares/AuthMiddleware.js";

// dotenv.config();

// // --- CLOUDINARY & MULTER CONFIG ---
// cloudinary.config({
//   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//   api_key: process.env.CLOUDINARY_API_KEY,
//   api_secret: process.env.CLOUDINARY_API_SECRET,
// });

// // Store file in memory to stream directly to Cloudinary
// const storage = multer.memoryStorage();
// const upload = multer({ storage });
// // ----------------------------------

// const router = express.Router();

// // login
// router.post("/login", async (req, res) => {
//   const { email, password } = req.body;

//   try {
//     const user = await UserModel.findOne({ email });
//     if (!user) return res.status(404).json({ message: "User Not Found" });

//     const isMatch = await user.comparePassword(password);

//     if (!isMatch) return res.status(400).json({ message: "Invalid Credentials" });

//     const payload = {
//       user: {
//         id: user._id,
//         role: user.role,
//       },
//     };

//     // User ko token diya hai yaha
//     jwt.sign(
//       payload,
//       process.env.JWT_SECRET_KEY,
//       { expiresIn: "2h" },
//       (err, token) => {
//         if (err) throw err;
//         res.json({
//           token,
//           role: user.role,
//           userId: user._id,        
//           username: user.username, 
//           avatar: user.avatar // Send avatar on login as well
//         });
//       }
//     );
//   } catch (error) {
//     console.log(error);
//     res.status(500).json({ message: "Internal Server Error" });
//   }
// });

// // Register
// router.post("/register", async (req, res) => {
//   const { username, email, password, role } = req.body;

//   try {
//     let user = await UserModel.findOne({ email });
//     if (user) return res.status(400).json({ message: "User Already Exists" });

//     user = new UserModel({ username, email, password, role });
//     await user.save();
//     res.json({ message: "User Registered Successfully" });
//   } catch (error) {
//     console.log(error);
//     res.status(500).json({ message: "Internal Server Error" });
//   }
// });

// // Pakdo Sare Users Ko
// router.get("/users", verifyToken, isAdmin, async (req, res) => {
//   try {
//     const users = await UserModel.find(
//       {},
//       "username email role joiningDate leaveBalance leaveRecords avatar"
//     );
//     res.json(users);
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: "Internal Server Error" });
//   }
// });

// // User ko kick kar do
// router.delete("/users/:id", verifyToken, isAdmin, async (req, res) => {
//   try {
//     const user = await UserModel.findByIdAndDelete(req.params.id);
//     if (!user) return res.status(404).json({ message: "User not found" });

//     res.json({ message: "User deleted successfully" });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: "Internal Server Error" });
//   }
// });

// // user update
// router.put("/users/:id", verifyToken, isAdmin, async (req, res) => {
//   const { username, role, joiningDate } = req.body;

//   try {
//     const user = await UserModel.findById(req.params.id);
//     if (!user) return res.status(404).json({ message: "User not found" });

//     user.username = username || user.username;
//     user.role = role || user.role;
//     user.joiningDate = joiningDate || user.joiningDate;

//     await user.save();
//     res.json({ message: "User updated successfully", user });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: "Internal Server Error" });
//   }
// });

// // get only users with manager and admin role
// router.get("/admins-managers", verifyToken, async (req, res) => {
//   try {
//     const users = await UserModel.find({
//       role: { $in: ["admin", "manager"] },
//     }).select("username email avatar");
//     res.json(users);
//   } catch (error) {
//     res.status(500).json({ error: "Failed to fetch users" });
//   }
// });

// // get only users with developer role
// router.get("/developers", verifyToken, async (req, res) => {
//   try {
//     const developers = await UserModel.find({ role: "developer" }).select(
//       "username email avatar"
//     );
//     res.json(developers);
//   } catch (error) {
//     res.status(500).json({ error: "Failed to fetch developers" });
//   }
// });

// // get only users with caller role
// router.get("/callers", verifyToken, async (req, res) => {
//   try {
//     const callers = await UserModel.find({ role: "caller" }).select(
//       "username email avatar"
//     );
//     res.json(callers);
//   } catch (error) {
//     res.status(500).json({ error: "Failed to fetch callers" });
//   }
// });

// // fetches the username and avatar of the user
// router.get("/user", verifyToken, async (req, res) => {
//   try {
//     const user = await UserModel.findById(req.user.id).select("username avatar");
//     if (!user) return res.status(404).json({ message: "User not found" });
//     res.json(user);
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: "Internal Server Error" });
//   }
// });

// // --- NEW ROUTE: Upload/Update Avatar ---
// router.put("/user/avatar", verifyToken, upload.single("image"), async (req, res) => {
//   try {
//     const { imageUrl } = req.body;
//     let finalUrl = "";

//     // If user uploaded a File
//     if (req.file) {
//       const b64 = Buffer.from(req.file.buffer).toString("base64");
//       let dataURI = "data:" + req.file.mimetype + ";base64," + b64;
//       const result = await cloudinary.uploader.upload(dataURI, { folder: "user_avatars" });
//       finalUrl = result.secure_url;
//     } 
//     // If user provided a URL string
//     else if (imageUrl) {
//       // Upload the external URL directly to Cloudinary
//       const result = await cloudinary.uploader.upload(imageUrl, { folder: "user_avatars" });
//       finalUrl = result.secure_url;
//     }

//     if (!finalUrl) {
//       return res.status(400).json({ message: "No image file or URL provided" });
//     }

//     // Update user in DB
//     const user = await UserModel.findByIdAndUpdate(
//       req.user.id,
//       { avatar: finalUrl },
//       { new: true }
//     ).select("username avatar");

//     res.json({ message: "Avatar updated successfully", avatar: user.avatar });
//   } catch (error) {
//     console.error("Avatar Upload Error:", error);
//     res.status(500).json({ message: "Failed to upload avatar" });
//   }
// });

// // get leave history of a user
// router.get(
//   "/users/:id/leave-history",
//   verifyToken,
//   isAdmin,
//   async (req, res) => {
//     try {
//       const user = await UserModel.findById(req.params.id).select(
//         "leaveRecords leaveBalance"
//       );
//       if (!user) return res.status(404).json({ message: "User not found" });

//       res.json({
//         leaveRecords: user.leaveRecords,
//         leaveBalance: user.leaveBalance,
//       });
//     } catch (error) {
//       console.error(error);
//       res.status(500).json({ message: "Internal Server Error" });
//     }
//   }
// );

// // add leave record function
// router.post(
//   "/users/:id/leave-records",
//   verifyToken,
//   isAdmin,
//   async (req, res) => {
//     const { startDate, endDate, type, note } = req.body;

//     if (!startDate || !endDate || !note) {
//       return res.status(400).json({
//         message: "All fields (startDate, endDate, note) are required.",
//       });
//     }

//     try {
//       const user = await UserModel.findById(req.params.id);
//       if (!user) return res.status(404).json({ message: "User not found" });

//       const leaveDuration =
//         (new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24) + 1;
//       const leaveDays = type === "half" ? leaveDuration * 0.5 : leaveDuration;

//       user.leaveRecords.push({ startDate, endDate, type, note });
//       user.leaveBalance -= leaveDays;

//       await user.save();

//       res.json({ message: "Leave record added successfully", user });
//     } catch (error) {
//       console.error(error);
//       res.status(500).json({ message: "Internal Server Error" });
//     }
//   }
// );

// // Update leave balance function
// router.put(
//   "/users/:id/leave-balance",
//   verifyToken,
//   isAdmin,
//   async (req, res) => {
//     const { leaveBalance } = req.body;

//     if (typeof leaveBalance !== "number" || isNaN(leaveBalance)) {
//       return res
//         .status(400)
//         .json({ message: "Leave balance must be a valid number." });
//     }

//     try {
//       const user = await UserModel.findById(req.params.id);
//       if (!user) return res.status(404).json({ message: "User not found" });

//       user.leaveBalance = leaveBalance;
//       await user.save();

//       res.json({ message: "Leave balance updated successfully", user });
//     } catch (error) {
//       console.error(error);
//       res.status(500).json({ message: "Internal Server Error" });
//     }
//   }
// );

// // delete leave record function
// router.delete(
//   "/users/:userId/leave-records/:recordId",
//   verifyToken,
//   isAdmin,
//   async (req, res) => {
//     const { userId, recordId } = req.params;

//     try {
//       const user = await UserModel.findById(userId);
//       if (!user) {
//         return res.status(404).json({ message: "User not found" });
//       }

//       const recordIndex = user.leaveRecords.findIndex(
//         (record) => record._id.toString() === recordId
//       );

//       if (recordIndex === -1) {
//         return res.status(404).json({ message: "Leave record not found" });
//       }

//       user.leaveRecords.splice(recordIndex, 1);
//       await user.save();

//       res.json({ message: "Leave record deleted successfully", user });
//     } catch (error) {
//       console.error(error);
//       res.status(500).json({ message: "Internal Server Error" });
//     }
//   }
// );

// export default router;











import express from "express";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";

// FILES IMPORTS
import UserModel from "../Models/UserModel.js";
import AttendanceModel from "../Models/Attendance.js";
import RoleTimingModel from "../Models/RoleTimingModel.js";
import ShiftModel from "../Models/ShiftModel.js";
import { verifyToken, isAdmin } from "../Middlewares/AuthMiddleware.js";

dotenv.config();

// --- CLOUDINARY & MULTER CONFIG ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Store file in memory to stream directly to Cloudinary
const storage = multer.memoryStorage();
const upload = multer({ storage });
// ----------------------------------

const router = express.Router();

// ==========================================
// 1. ORIGINAL USER & AUTH ROUTES
// ==========================================

// Login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await UserModel.findOne({ email });
    if (!user) return res.status(404).json({ message: "User Not Found" });

    // Termination Check: Block terminated or resigned accounts immediately
    if (
      user.employmentStatus === "terminated" ||
      user.employmentStatus === "resigned" ||
      user.status === "terminated" ||
      user.status === "resigned"
    ) {
      return res.status(403).json({
        message: "Your employee account has been deactivated/terminated. Access revoked. Please contact HR.",
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(400).json({ message: "Invalid Credentials" });

    const payload = {
      user: {
        id: user._id,
        role: user.role,
      },
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET_KEY,
      { expiresIn: "10h" },
      (err, token) => {
        if (err) throw err;
        res.json({
          token,
          role: user.role,
          userId: user._id,        
          username: user.username, 
          avatar: user.avatar,
          employeeId: user.employeeId,
          designation: user.designation,
          employmentStatus: user.employmentStatus || "active",
        });
      }
    );
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Register
router.post("/register", async (req, res) => {
  const { 
    username, 
    email, 
    password, 
    role, 
    department, 
    designation, 
    phone, 
    reportingTo,
    employeeId,
    employmentType,
    baseSalary,
    salaryStructureId,
    bankDetails,
    taxId,
    shiftId
  } = req.body;

  try {
    let user = await UserModel.findOne({ email });
    if (user) return res.status(400).json({ message: "User Already Exists" });

    user = new UserModel({ 
      username, 
      email, 
      password, 
      role: role || "developer",
      department: department || "General",
      designation: designation || "",
      phone: phone || "",
      reportingTo: reportingTo || null,
      employeeId: employeeId || `EMP-${Math.floor(100 + Math.random() * 900)}`,
      employmentType: employmentType || "full_time",
      employmentStatus: "active",
      baseSalary: baseSalary || 0,
      salaryStructureId: salaryStructureId || null,
      bankDetails: bankDetails || {},
      taxId: taxId || "",
      shiftId: shiftId || null,
    });
    await user.save();

    // If shift assigned, add user to the ShiftModel assignedUsers array
    if (shiftId) {
      await ShiftModel.findByIdAndUpdate(shiftId, { $addToSet: { assignedUsers: user._id } });
    }

    res.json({ message: "User Registered Successfully", user: { id: user._id, username: user.username, role: user.role } });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Get All Users (Admin & HR)
router.get("/users", verifyToken, async (req, res) => {
  try {
    const users = await UserModel.find({})
      .select("-password")
      .populate("reportingTo", "username email designation")
      .populate("teamId", "teamName teamType")
      .populate("shiftId", "name startTime endTime isNightShift workDays color allowedBreakMinutes")
      .populate("salaryStructureId", "name code templateType");
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Delete User
router.delete("/users/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const user = await UserModel.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.shiftId) {
      await ShiftModel.findByIdAndUpdate(user.shiftId, { $pull: { assignedUsers: user._id } });
    }
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Update User (Basic)
router.put("/users/:id", verifyToken, async (req, res) => {
  const { 
    username, 
    role, 
    department, 
    designation, 
    phone, 
    reportingTo, 
    teamId, 
    shiftId,
    joiningDate, 
    leaveBalance, 
    password,
    employeeId,
    employmentType,
    employmentStatus,
    baseSalary,
    salaryStructureId,
    bankDetails,
    taxId
  } = req.body;

  try {
    const user = await UserModel.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (username !== undefined) user.username = username;
    if (role !== undefined) user.role = role;
    if (department !== undefined) user.department = department;
    if (designation !== undefined) user.designation = designation;
    if (phone !== undefined) user.phone = phone;
    if (reportingTo !== undefined) user.reportingTo = reportingTo || null;
    if (teamId !== undefined) user.teamId = teamId || null;
    if (joiningDate !== undefined) user.joiningDate = joiningDate ? new Date(joiningDate) : null;
    if (leaveBalance !== undefined) user.leaveBalance = Number(leaveBalance ?? 12);
    if (employeeId !== undefined) user.employeeId = employeeId;
    if (employmentType !== undefined) user.employmentType = employmentType;
    if (employmentStatus !== undefined) user.employmentStatus = employmentStatus;
    if (baseSalary !== undefined) user.baseSalary = Number(baseSalary || 0);
    if (salaryStructureId !== undefined) user.salaryStructureId = salaryStructureId || null;
    if (bankDetails !== undefined) user.bankDetails = bankDetails;
    if (taxId !== undefined) user.taxId = taxId;
    if (password && password.length >= 6) user.password = password;

    if (shiftId !== undefined) {
      const oldShift = user.shiftId?.toString();
      const newShift = shiftId ? shiftId.toString() : null;
      if (oldShift && oldShift !== newShift) {
        await ShiftModel.findByIdAndUpdate(oldShift, { $pull: { assignedUsers: user._id } });
      }
      if (newShift && oldShift !== newShift) {
        await ShiftModel.findByIdAndUpdate(newShift, { $addToSet: { assignedUsers: user._id } });
      }
      user.shiftId = newShift || null;
    }

    await user.save();
    res.json({ message: "User updated successfully", user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Complete 360° HR Profile Update
router.put("/users/:id/hr-profile", verifyToken, async (req, res) => {
  try {
    const user = await UserModel.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const allowedFields = [
      "username", "role", "designation", "department", "phone",
      "employeeId", "firstName", "middleName", "lastName", "dob", "gender",
      "personalEmail", "address", "emergencyContact",
      "employmentType", "employmentStatus", "joiningDate", "probationPeriod",
      "confirmationDate", "lastWorkingDate", "location", "reportingTo", "teamId", "shiftId",
      "salaryStructureId", "baseSalary", "payFrequency", "paymentMethod",
      "bankDetails", "taxId", "customSalaryAllowances", "customSalaryDeductions",
      "leaveBalance"
    ];

    const objectIdFields = ["reportingTo", "teamId", "shiftId", "salaryStructureId"];
    const dateFields = ["dob", "joiningDate", "confirmationDate", "lastWorkingDate"];

    allowedFields.forEach((f) => {
      if (req.body[f] !== undefined) {
        if (objectIdFields.includes(f)) {
          user[f] = req.body[f] ? req.body[f] : null;
        } else if (dateFields.includes(f)) {
          user[f] = req.body[f] ? new Date(req.body[f]) : null;
        } else if (f === "baseSalary") {
          user[f] = Number(req.body[f] || 0);
        } else if (f === "leaveBalance") {
          user[f] = Number(req.body[f] ?? 12);
        } else {
          user[f] = req.body[f];
        }
      }
    });

    if (req.body.shiftId !== undefined) {
      const oldShift = user.shiftId?.toString();
      const newShift = req.body.shiftId ? req.body.shiftId.toString() : null;
      if (oldShift && oldShift !== newShift) {
        await ShiftModel.findByIdAndUpdate(oldShift, { $pull: { assignedUsers: user._id } });
      }
      if (newShift && oldShift !== newShift) {
        await ShiftModel.findByIdAndUpdate(newShift, { $addToSet: { assignedUsers: user._id } });
      }
      user.shiftId = newShift || null;
    }

    if (req.body.password && req.body.password.length >= 6) {
      user.password = req.body.password;
    }

    await user.save();
    res.json({ message: "Employee HR profile updated successfully", user });
  } catch (error) {
    console.error("HR profile update error:", error);
    res.status(500).json({ message: error.message || "Failed to update HR profile" });
  }
});

// Employee Offboarding / Termination
router.put("/users/:id/terminate", verifyToken, async (req, res) => {
  const { reason, terminationDate, notes, exitType } = req.body;
  try {
    const user = await UserModel.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.shiftId) {
      await ShiftModel.findByIdAndUpdate(user.shiftId, { $pull: { assignedUsers: user._id } });
      user.shiftId = null;
    }

    user.employmentStatus = exitType || "terminated";
    user.status = "terminated";
    user.lastWorkingDate = terminationDate ? new Date(terminationDate) : new Date();
    user.terminationReason = reason || "Termination / Exit";
    user.terminationNotes = notes || "";

    await user.save();
    res.json({ message: `Employee ${user.username} has been offboarded and login access revoked.`, user });
  } catch (error) {
    console.error("Termination error:", error);
    res.status(500).json({ message: "Failed to offboard employee" });
  }
});

// Employee Reactivate
router.put("/users/:id/reactivate", verifyToken, async (req, res) => {
  try {
    const user = await UserModel.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.employmentStatus = "active";
    user.status = "active";
    user.terminationReason = "";
    user.terminationNotes = "";

    await user.save();
    res.json({ message: `Employee ${user.username} account has been reactivated.`, user });
  } catch (error) {
    console.error("Reactivate error:", error);
    res.status(500).json({ message: "Failed to reactivate employee" });
  }
});

// Update User Password (Admin/HR)
router.put("/users/:id/password", verifyToken, async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters long." });
  }
  try {
    const user = await UserModel.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.password = newPassword;
    await user.save();

    res.json({ message: `Password for ${user.username} updated successfully.` });
  } catch (error) {
    console.error("Error updating user password:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Get Admins & Managers
router.get("/admins-managers", verifyToken, async (req, res) => {
  try {
    const users = await UserModel.find({
      role: { $in: ["admin", "manager", "team_lead", "hr"] },
    }).select("username email avatar role designation department");
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// Get Team Leads
router.get("/team-leads", verifyToken, async (req, res) => {
  try {
    const teamLeads = await UserModel.find({
      role: { $in: ["team_lead", "manager", "admin"] },
    }).select("username email avatar role designation department");
    res.json(teamLeads);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch team leads" });
  }
});

// Get Developers
router.get("/developers", verifyToken, async (req, res) => {
  try {
    const developers = await UserModel.find({ 
      role: { $in: ["developer", "team_lead"] } 
    }).select("username email avatar role designation department");
    res.json(developers);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch developers" });
  }
});

// Get Callers
router.get("/callers", verifyToken, async (req, res) => {
  try {
    const callers = await UserModel.find({ role: "caller" }).select(
      "username email avatar role designation department"
    );
    res.json(callers);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch callers" });
  }
});

// Get Current Logged In User
router.get("/user", verifyToken, async (req, res) => {
  try {
    const user = await UserModel.findById(req.user.id)
      .select("username email avatar role department designation phone leaveBalance leaveRecords joiningDate employeeId employmentType employmentStatus baseSalary salaryStructureId bankDetails taxId")
      .populate("teamId", "teamName teamType")
      .populate("reportingTo", "username email designation")
      .populate("salaryStructureId", "name code templateType components");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Employee Self-Leave Request (Half-Day / Full-Day Support)
router.post("/leave-request", verifyToken, async (req, res) => {
  const { startDate, endDate, duration, note, leaveType } = req.body;
  if (!startDate || !endDate) {
    return res.status(400).json({ message: "Start date and end date are required." });
  }
  try {
    const user = await UserModel.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const dur = duration === "half_day" ? "half_day" : "full_day";
    const start = new Date(startDate);
    const end = new Date(endDate);
    const dayDiff = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1);
    const calculatedDays = dur === "half_day" ? 0.5 : dayDiff;

    user.leaveRecords.push({
      startDate: start,
      endDate: end,
      duration: dur,
      type: dur === "half_day" ? "half" : "full",
      daysCount: calculatedDays,
      finalApprovedDays: calculatedDays,
      leaveType: leaveType || "paid",
      note: note || "",
      status: "pending",
      createdAt: new Date(),
    });

    await user.save();
    res.json({ message: "Leave request submitted successfully", leaveRecords: user.leaveRecords });
  } catch (error) {
    console.error("Leave request error:", error);
    res.status(500).json({ message: "Failed to submit leave request" });
  }
});

// HR: Get all pending/approved/rejected/negotiated leave requests
router.get("/hr/all-leaves", verifyToken, async (req, res) => {
  try {
    const { userId, status, role, startDate, endDate, leaveType } = req.query;

    let userQuery = { "leaveRecords.0": { $exists: true } };
    if (userId) userQuery._id = userId;
    if (role && role !== "all") userQuery.role = role;

    const users = await UserModel.find(
      userQuery,
      "username firstName lastName email avatar department designation leaveRecords leaveBalance employeeId role"
    );
    
    const allLeaves = [];
    users.forEach(u => {
      const fullName = `${u.firstName || ''} ${u.lastName || ''}`.trim();
      u.leaveRecords.forEach(rec => {
        // Date overlap filtering if provided
        if (startDate && new Date(rec.endDate) < new Date(startDate)) return;
        if (endDate && new Date(rec.startDate) > new Date(endDate)) return;
        if (status && status !== "all" && rec.status !== status) return;
        if (leaveType && leaveType !== "all" && rec.leaveType !== leaveType) return;

        allLeaves.push({
          userId: u._id,
          username: u.username,
          fullName: fullName || u.username,
          firstName: u.firstName,
          lastName: u.lastName,
          email: u.email,
          avatar: u.avatar,
          employeeId: u.employeeId,
          role: u.role,
          department: u.department,
          designation: u.designation,
          leaveBalance: u.leaveBalance,
          recordId: rec._id,
          startDate: rec.startDate,
          endDate: rec.endDate,
          duration: rec.duration || (rec.type === "half" ? "half_day" : "full_day"),
          type: rec.type,
          daysCount: rec.daysCount || (rec.type === "half" ? 0.5 : 1),
          finalApprovedDays: rec.finalApprovedDays || (rec.type === "half" ? 0.5 : 1),
          leaveType: rec.leaveType || "paid",
          note: rec.note,
          status: rec.status || "approved",
          rejectionReason: rec.rejectionReason || "",
          negotiationNotes: rec.negotiationNotes || "",
          createdAt: rec.createdAt,
        });
      });
    });

    // Sort newest first
    allLeaves.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(allLeaves);
  } catch (error) {
    console.error("Fetch all leaves error:", error);
    res.status(500).json({ message: "Failed to fetch leaves" });
  }
});

// HR: Update leave status (with mandatory rejection reasons & negotiation)
router.put("/hr/leave-status/:userId/:recordId", verifyToken, async (req, res) => {
  const { status, rejectionReason, negotiationNotes, finalApprovedDays } = req.body; 
  // status: "approved" | "rejected" | "negotiated"

  if (status === "rejected" && (!rejectionReason || !rejectionReason.trim())) {
    return res.status(400).json({ message: "Rejection reason is mandatory when declining a leave request." });
  }

  try {
    const user = await UserModel.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const record = user.leaveRecords.id(req.params.recordId);
    if (!record) return res.status(404).json({ message: "Leave record not found" });

    const prevStatus = record.status;
    const prevDeducted = record.finalApprovedDays || (record.duration === "half_day" || record.type === "half" ? 0.5 : 1);

    record.status = status;
    record.approvedBy = req.user.id;
    if (rejectionReason) record.rejectionReason = rejectionReason.trim();
    if (negotiationNotes) record.negotiationNotes = negotiationNotes.trim();
    if (finalApprovedDays !== undefined && !isNaN(Number(finalApprovedDays))) {
      record.finalApprovedDays = Number(finalApprovedDays);
    }

    // Leave Balance Deductions & Restorations
    if ((status === "approved" || status === "negotiated") && prevStatus !== "approved" && prevStatus !== "negotiated") {
      const daysToDeduct = record.finalApprovedDays ?? (record.duration === "half_day" || record.type === "half" ? 0.5 : 1);
      user.leaveBalance = Math.max(0, (user.leaveBalance || 0) - daysToDeduct);
    } else if (status === "rejected" && (prevStatus === "approved" || prevStatus === "negotiated")) {
      user.leaveBalance = (user.leaveBalance || 0) + prevDeducted;
    }

    await user.save();
    res.json({ message: `Leave ${status} successfully`, record, leaveBalance: user.leaveBalance });
  } catch (error) {
    console.error("Update leave status error:", error);
    res.status(500).json({ message: "Failed to update leave status" });
  }
});

// Upload/Update Avatar
router.put("/user/avatar", verifyToken, upload.single("image"), async (req, res) => {
  try {
    const { imageUrl } = req.body;
    let finalUrl = "";

    if (req.file) {
      const b64 = Buffer.from(req.file.buffer).toString("base64");
      let dataURI = "data:" + req.file.mimetype + ";base64," + b64;
      const result = await cloudinary.uploader.upload(dataURI, { folder: "user_avatars" });
      finalUrl = result.secure_url;
    } else if (imageUrl) {
      const result = await cloudinary.uploader.upload(imageUrl, { folder: "user_avatars" });
      finalUrl = result.secure_url;
    }

    if (!finalUrl) return res.status(400).json({ message: "No image file or URL provided" });

    const user = await UserModel.findByIdAndUpdate(
      req.user.id,
      { avatar: finalUrl },
      { new: true }
    ).select("username avatar");

    res.json({ message: "Avatar updated successfully", avatar: user.avatar });
  } catch (error) {
    console.error("Avatar Upload Error:", error);
    res.status(500).json({ message: "Failed to upload avatar" });
  }
});

// Get Leave History
router.get("/users/:id/leave-history", verifyToken, isAdmin, async (req, res) => {
  try {
    const user = await UserModel.findById(req.params.id).select("leaveRecords leaveBalance");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({
      leaveRecords: user.leaveRecords,
      leaveBalance: user.leaveBalance,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Add Leave Record
router.post("/users/:id/leave-records", verifyToken, isAdmin, async (req, res) => {
  const { startDate, endDate, type, note } = req.body;

  if (!startDate || !endDate || !note) {
    return res.status(400).json({ message: "All fields (startDate, endDate, note) are required." });
  }

  try {
    const user = await UserModel.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const leaveDuration = (new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24) + 1;
    const leaveDays = type === "half" ? leaveDuration * 0.5 : leaveDuration;

    user.leaveRecords.push({ startDate, endDate, type, note });
    user.leaveBalance -= leaveDays;

    await user.save();
    res.json({ message: "Leave record added successfully", user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Update Leave Balance
router.put("/users/:id/leave-balance", verifyToken, isAdmin, async (req, res) => {
  const { leaveBalance } = req.body;
  if (typeof leaveBalance !== "number" || isNaN(leaveBalance)) {
    return res.status(400).json({ message: "Leave balance must be a valid number." });
  }

  try {
    const user = await UserModel.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.leaveBalance = leaveBalance;
    await user.save();
    res.json({ message: "Leave balance updated successfully", user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Delete Leave Record
router.delete("/users/:userId/leave-records/:recordId", verifyToken, isAdmin, async (req, res) => {
  const { userId, recordId } = req.params;
  try {
    const user = await UserModel.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const recordIndex = user.leaveRecords.findIndex((record) => record._id.toString() === recordId);
    if (recordIndex === -1) return res.status(404).json({ message: "Leave record not found" });

    user.leaveRecords.splice(recordIndex, 1);
    await user.save();
    res.json({ message: "Leave record deleted successfully", user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// ==========================================
// 2. NEW ADVANCED ATTENDANCE ROUTES
// ==========================================

// Helper: Get today's YYYY-MM-DD format
const getTodayDateString = () => new Date().toISOString().split("T")[0];

// Geolocation helper: Target 22.539493, 88.377259
const TARGET_LAT = 22.539493;
const TARGET_LNG = 88.377259;
const MAX_RADIUS_METERS = 100; // Strictly 100 meters

const calculateDistanceMeters = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

// Helper: Get user's active limits (User exceptions override Role defaults)
const getUserTimeLimits = async (user) => {
  let workLimits = user.customWorkHours || null;
  let breakLimits = user.customBreakTime || null;

  if (workLimits === null || breakLimits === null) {
    const roleDefaults = await RoleTimingModel.findOne({ role: user.role });
    if (workLimits === null) workLimits = roleDefaults ? roleDefaults.requiredWorkHours : 480;
    if (breakLimits === null) breakLimits = roleDefaults ? roleDefaults.allottedBreakTime : 60;
  }
  return { workLimits, breakLimits };
};

// 1. Get Today's Status & Limits
router.get("/attendance/today", verifyToken, async (req, res) => {
  try {
    const user = await UserModel.findById(req.user.id);
    const { workLimits, breakLimits } = await getUserTimeLimits(user);
    const today = getTodayDateString();
    
    let attendance = await AttendanceModel.findOne({ user: user._id, date: today });
    res.json({ attendance, workLimits, breakLimits });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// 2. Clock In
router.post("/attendance/clock-in", verifyToken, async (req, res) => {
  try {
    const { lat, lng } = req.body;
    if (lat !== undefined && lng !== undefined) {
      const distance = calculateDistanceMeters(Number(lat), Number(lng), TARGET_LAT, TARGET_LNG);
      if (distance > MAX_RADIUS_METERS) {
        return res.status(400).json({
          message: `Location out of range. You are ${Math.round(distance)} meters away from the required work location (Target: ${TARGET_LAT}, ${TARGET_LNG}).`
        });
      }
    }

    const today = getTodayDateString();
    let attendance = await AttendanceModel.findOne({ user: req.user.id, date: today });
    if (attendance) return res.status(400).json({ message: "Already Clocked In today." });

    const user = await UserModel.findById(req.user.id);
    const { workLimits, breakLimits } = await getUserTimeLimits(user);

    attendance = new AttendanceModel({
      user: req.user.id,
      date: today,
      clockIn: new Date(),
      requiredWorkHours: workLimits,
      allottedBreakTime: breakLimits,
      clockInLocation: lat !== undefined && lng !== undefined ? { lat, lng, verified: true } : undefined
    });
    
    await attendance.save();
    res.json(attendance);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// 3. Take Break
router.post("/attendance/break/start", verifyToken, async (req, res) => {
  try {
    const { lat, lng } = req.body;
    if (lat !== undefined && lng !== undefined) {
      const distance = calculateDistanceMeters(Number(lat), Number(lng), TARGET_LAT, TARGET_LNG);
      if (distance > MAX_RADIUS_METERS) {
        return res.status(400).json({
          message: `Location out of range. You are ${Math.round(distance)} meters away from the required work location.`
        });
      }
    }

    const today = getTodayDateString();
    const attendance = await AttendanceModel.findOne({ user: req.user.id, date: today });
    if (!attendance) return res.status(400).json({ message: "Not Clocked In." });
    if (attendance.clockOut) return res.status(400).json({ message: "Already Clocked Out for today." });

    const activeBreak = attendance.breaks.find(b => !b.end);
    if (activeBreak) return res.status(400).json({ message: "Already on a break." });

    attendance.breaks.push({ start: new Date() });
    await attendance.save();
    res.json(attendance);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// 4. End Break
router.post("/attendance/break/end", verifyToken, async (req, res) => {
  try {
    const { lat, lng } = req.body;
    if (lat !== undefined && lng !== undefined) {
      const distance = calculateDistanceMeters(Number(lat), Number(lng), TARGET_LAT, TARGET_LNG);
      if (distance > MAX_RADIUS_METERS) {
        return res.status(400).json({
          message: `Location out of range. You are ${Math.round(distance)} meters away from the required work location.`
        });
      }
    }

    const today = getTodayDateString();
    const attendance = await AttendanceModel.findOne({ user: req.user.id, date: today });
    
    if (!attendance) return res.status(400).json({ message: "Attendance record not found." });
    const activeBreak = attendance.breaks.find(b => !b.end);
    if (!activeBreak) return res.status(400).json({ message: "Not on a break." });

    activeBreak.end = new Date();
    await attendance.save();
    res.json(attendance);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// 5. Clock Out
router.post("/attendance/clock-out", verifyToken, async (req, res) => {
  try {
    const { lat, lng } = req.body;
    if (lat !== undefined && lng !== undefined) {
      const distance = calculateDistanceMeters(Number(lat), Number(lng), TARGET_LAT, TARGET_LNG);
      if (distance > MAX_RADIUS_METERS) {
        return res.status(400).json({
          message: `Location out of range. You are ${Math.round(distance)} meters away from the required work location.`
        });
      }
    }

    const today = getTodayDateString();
    const attendance = await AttendanceModel.findOne({ user: req.user.id, date: today });
    if (!attendance || attendance.clockOut) return res.status(400).json({ message: "Invalid action or already clocked out." });

    // End any ongoing break first
    const activeBreak = attendance.breaks.find(b => !b.end);
    if (activeBreak) activeBreak.end = new Date();

    attendance.clockOut = new Date();
    if (lat !== undefined && lng !== undefined) {
      attendance.clockOutLocation = { lat, lng, verified: true };
    }

    // Time Calculation
    let totalBreakTimeMs = 0;
    attendance.breaks.forEach(b => {
      if (b.end && b.start) {
        totalBreakTimeMs += (b.end.getTime() - b.start.getTime());
      }
    });

    const totalTimeMs = attendance.clockOut.getTime() - attendance.clockIn.getTime();
    const totalWorkTimeMs = Math.max(0, totalTimeMs - totalBreakTimeMs);

    attendance.totalBreakTime = totalBreakTimeMs;
    attendance.totalWorkTime = totalWorkTimeMs;

    await attendance.save();
    res.json(attendance);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// 6. Admin: Get Logs
router.get("/admin/attendance-logs", verifyToken, isAdmin, async (req, res) => {
  const { startDate, endDate, userId } = req.query;
  try {
    let query = {};
    if (startDate && endDate) query.date = { $gte: startDate, $lte: endDate };
    if (userId) query.user = userId;

    const logs = await AttendanceModel.find(query).populate("user", "username email role").sort({ date: -1 });
    res.json(logs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// 7. Admin: Set Role Timings
router.put("/admin/role-timings", verifyToken, isAdmin, async (req, res) => {
  const { role, requiredWorkHours, allottedBreakTime } = req.body;
  try {
    let roleTiming = await RoleTimingModel.findOneAndUpdate(
      { role },
      { requiredWorkHours, allottedBreakTime },
      { new: true, upsert: true }
    );
    res.json(roleTiming);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// 8. Admin: Set User Exceptions
router.put("/admin/user-exceptions/:userId", verifyToken, isAdmin, async (req, res) => {
  const { customWorkHours, customBreakTime } = req.body;
  try {
    const user = await UserModel.findByIdAndUpdate(
      req.params.userId,
      { customWorkHours, customBreakTime },
      { new: true }
    );
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// 9. Admin: Get Role Timings (To populate UI)
router.get("/admin/role-timings", verifyToken, isAdmin, async (req, res) => {
  try {
    const timings = await RoleTimingModel.find();
    res.json(timings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;