import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

// verify token
export const verifyToken = (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ message: "Access Denied" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    req.user = decoded.user;
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid Token" });
  }
};

// admin token
export const isAdmin = (req, res, next) => {
  if (req.user?.role !== "admin")
    return res.status(403).json({ message: "Admin Access Required" });
  next();
};

// HR or Admin token
export const isHR = (req, res, next) => {
  if (req.user?.role !== "admin" && req.user?.role !== "hr")
    return res.status(403).json({ message: "HR Access Required" });
  next();
};

// Team Lead or Admin token
export const isTeamLead = (req, res, next) => {
  if (req.user?.role !== "admin" && req.user?.role !== "team_lead" && req.user?.role !== "manager")
    return res.status(403).json({ message: "Team Lead or Admin Access Required" });
  next();
};

export default { verifyToken, isAdmin, isHR, isTeamLead };
