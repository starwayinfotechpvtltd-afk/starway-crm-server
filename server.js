import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import ReportRoutes from "./Routes/ReportRoutes.js"; 

// DB
import connectDB from "./Config/Mongodb.js";

// Routes
import AuthRoutes from "./Routes/AuthRoutes.js";
import DashboardRoutes from "./Routes/DashboardRoutes.js";
import taskRoutes from "./Routes/taskRoutes.js";
import leadRoutes from "./Routes/leadRoutes.js";
import projectRoutes from "./Routes/projectRoutes.js";
import EventRoutes from "./Routes/EventRoutes.js";
import serviceTypeRoutes from "./Routes/serviceTypeRoutes.js";
import DocumentRoutes from "./Routes/DocumentRoutes.js";
import tasksRoutes from "./Routes/Tasksroutes.js";
import TeamRoutes from "./Routes/TeamRoutes.js";
import scheduledTaskRoutes from "./Routes/scheduledTaskRoutes.js";
import DepartmentRoutes from "./Routes/DepartmentRoutes.js";
import PayrollEngineRoutes from "./Routes/PayrollEngineRoutes.js";
import attendanceRoutes from './Routes/attendanceRoutes.js';
import shiftRoutes from './Routes/shiftRoutes.js';


const app = express();
const PORT = process.env.PORT;

// ================= PATH =================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadPath = path.join(__dirname, "uploads");

// ================= START LOG =================
console.log("Starting Application...");

// ================= CREATE UPLOADS FOLDER =================
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
  console.log("📁 uploads folder created");
}

// ================= TRUST PROXY =================
app.set("trust proxy", 1);

// ================= BASIC SECURITY HEADERS =================
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  next();
});

// ================= CORS =================
app.use(
  cors({
    origin: process.env.CLIENT_URL?.split(",") || "*",
    credentials: true,
  })
);

// ================= BODY PARSER =================
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ================= REQUEST LOGGER =================
app.use((req, res, next) => {
  console.log(`${req.method} ${req.originalUrl}`);
  next();
});

// ================= STATIC =================
app.use("/uploads", express.static(uploadPath));

// ================= MULTER =================
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadPath),

  filename: (_, file, cb) => {
    const uniqueName =
      Date.now() + "-" + Math.round(Math.random() * 1e9) + path.extname(file.originalname);

    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = /jpg|jpeg|png|pdf|doc|docx|xlsx/;
  const ext = path.extname(file.originalname).toLowerCase().replace(".", "");

  if (allowed.test(ext)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type"));
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter,
});

// ================= HEALTH CHECK =================
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "API Running",
  });
});

// ================= ROUTES =================
app.use("/api/auth", AuthRoutes);
app.use("/api/dashboard", DashboardRoutes);
app.use("/api", taskRoutes);
app.use("/api/leads", leadRoutes);
app.use("/api/reports", ReportRoutes); 
app.use("/api/newproject", projectRoutes);
app.use("/api", EventRoutes);
app.use("/api", serviceTypeRoutes);
app.use("/api/docs", DocumentRoutes);
app.use("/api/tasks", tasksRoutes);
app.use("/api/teams", TeamRoutes);
app.use("/api/scheduled-tasks", scheduledTaskRoutes);
app.use("/api/departments", DepartmentRoutes);
app.use("/api/payroll-engine", PayrollEngineRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/shifts', shiftRoutes);

// ================= FILE UPLOAD =================
app.post("/api/upload", upload.array("images", 10), (req, res) => {
  try {
    const files =
      req.files?.map((file) => ({
        filename: file.filename,
        originalname: file.originalname,
        path: `/uploads/${file.filename}`,
      })) || [];

    res.status(200).json({
      success: true,
      files,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Upload failed",
    });
  }
});

// ================= 404 =================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// ================= GLOBAL ERROR =================
app.use((err, req, res, next) => {
  console.error("❌ Error:", err.message);

  res.status(500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

// ================= SERVER START =================
const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Startup Failed:", error.message);
    process.exit(1);
  }
};

startServer();

// ================= PROCESS ERRORS =================
process.on("unhandledRejection", (err) => {
  console.error("❌ Unhandled Rejection:", err.message);
});

process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err.message);
  process.exit(1);
});
