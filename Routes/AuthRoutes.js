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
          avatar: user.avatar 
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
  const { username, email, password, role } = req.body;

  try {
    let user = await UserModel.findOne({ email });
    if (user) return res.status(400).json({ message: "User Already Exists" });

    user = new UserModel({ username, email, password, role });
    await user.save();
    res.json({ message: "User Registered Successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Get All Users
router.get("/users", verifyToken, isAdmin, async (req, res) => {
  try {
    const users = await UserModel.find(
      {},
      "username email role joiningDate leaveBalance leaveRecords avatar customWorkHours customBreakTime"
    );
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
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Update User
router.put("/users/:id", verifyToken, isAdmin, async (req, res) => {
  const { username, role, joiningDate } = req.body;
  try {
    const user = await UserModel.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.username = username || user.username;
    user.role = role || user.role;
    user.joiningDate = joiningDate || user.joiningDate;

    await user.save();
    res.json({ message: "User updated successfully", user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Get Admins & Managers
router.get("/admins-managers", verifyToken, async (req, res) => {
  try {
    const users = await UserModel.find({
      role: { $in: ["admin", "manager"] },
    }).select("username email avatar");
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// Get Developers
router.get("/developers", verifyToken, async (req, res) => {
  try {
    const developers = await UserModel.find({ role: "developer" }).select(
      "username email avatar"
    );
    res.json(developers);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch developers" });
  }
});

// Get Callers
router.get("/callers", verifyToken, async (req, res) => {
  try {
    const callers = await UserModel.find({ role: "caller" }).select(
      "username email avatar"
    );
    res.json(callers);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch callers" });
  }
});

// Get Current Logged In User
router.get("/user", verifyToken, async (req, res) => {
  try {
    const user = await UserModel.findById(req.user.id).select("username avatar");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
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