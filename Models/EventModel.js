import mongoose from "mongoose";

const { Schema, model } = mongoose;

const EventSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    eventType: {
      type: String,
      enum: ["event", "meeting", "milestone", "shift", "announcement"],
      default: "event",
    },
    targetRole: {
      type: String,
      enum: ["all", "developer", "caller", "team_lead", "hr", "manager", "admin"],
      default: "all",
    },
    targetDepartment: {
      type: String,
      default: "all",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },
    color: { type: String, default: "#2563EB" },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export default model("Event", EventSchema);
