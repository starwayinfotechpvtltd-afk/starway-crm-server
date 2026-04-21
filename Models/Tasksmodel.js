//  this ooe is for the projects tasks


import mongoose from "mongoose";

const TaskSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },

    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    links: [{ type: String }],

    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Critical"],
      default: "Medium",
    },

    status: {
      type: String,
      enum: ["Todo", "In Progress", "Done"],
      default: "Todo",
    },

    deadline: { type: Date, default: null },

    // Who created this task
    createdBy: {
      id: { type: String, required: true },
      username: { type: String, required: true },
    },

    // Who the task is assigned to (single developer)
    assignedTo: {
      id: { type: String, required: true },
      username: { type: String, required: true },
    },

    // Populated when the task is marked complete
    completedAt: { type: Date, default: null },
    completedBy: {
      id: { type: String, default: null },
      username: { type: String, default: null },
    },
  },
  { timestamps: true }
);

// ── Completion history (separate collection) 
const TaskCompletionSchema = new mongoose.Schema(
  {
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      required: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    taskTitle: { type: String, required: true },
    completedBy: {
      id: { type: String, required: true },
      username: { type: String, required: true },
    },
    assignedBy: {
      id: { type: String },
      username: { type: String },
    },
    completedAt: { type: Date, default: Date.now },
    priority: { type: String },
    deadline: { type: Date },
  },
  { timestamps: true }
);

export const Task = mongoose.model("Task", TaskSchema);
export const TaskCompletion = mongoose.model(
  "TaskCompletion",
  TaskCompletionSchema
);