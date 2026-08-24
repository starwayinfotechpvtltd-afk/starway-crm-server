import mongoose from "mongoose";

const { Schema, model } = mongoose;

const TeamSchema = new Schema({
  teamName: { type: String, required: true, unique: true },
  teamType: {
    type: String,
    enum: ["development", "calling", "design", "qa", "management"],
    default: "development",
  },
  department: { type: String, default: "Engineering" },
  description: { type: String, default: "" },
  manager: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: false
  },
  teamLead: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: false
  },
  members: [
    { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User"
    }
  ],
  projects: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project"
    }
  ],
  createdAt: { type: Date, default: Date.now },
});

export default model("Team", TeamSchema);