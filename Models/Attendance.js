import mongoose from "mongoose";

const { Schema, model } = mongoose;

const BreakSchema = new Schema({
  start: { type: Date, required: true },
  end: { type: Date }
});

const AttendanceSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  date: { type: String, required: true }, // Format: YYYY-MM-DD
  clockIn: { type: Date, required: true },
  clockOut: { type: Date },
  breaks: [BreakSchema],
  totalWorkTime: { type: Number, default: 0 }, 
  totalBreakTime: { type: Number, default: 0 }, 
  requiredWorkHours: { type: Number, default: 480 }, // Snapshotted per day
  allottedBreakTime: { type: Number, default: 60 },  // Snapshotted per day
  clockInLocation: { lat: Number, lng: Number, verified: Boolean },
  clockOutLocation: { lat: Number, lng: Number, verified: Boolean }
}, { timestamps: true });

export default model("Attendance", AttendanceSchema);