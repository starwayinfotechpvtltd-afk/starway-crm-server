import mongoose from "mongoose";

const { Schema, model } = mongoose;

const BoardSchema = new Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    color: { type: String, default: "#6366f1" },
  },
  { timestamps: true }
);

export default model("Board", BoardSchema);