import mongoose from 'mongoose';

const breakSchema = new mongoose.Schema({
  start: {
    type: Date,
    required: true,
  },
  end: {
    type: Date,
  },
  durationMinutes: {
    type: Number,
  }
});

const attendanceSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  date: {
    type: String,
    required: true,
  },
  clockIn: {
    type: Date,
    required: true,
  },
  clockOut: {
    type: Date,
  },
  breaks: [breakSchema],
  totalWorkMinutes: {
    type: Number,
    default: 0,
  },
  totalBreakMinutes: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ['active', 'on_break', 'clocked_out'],
    default: 'active',
  },
  shiftId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shift',
  },
  shiftName: {
    type: String,
  },
  shiftStart: {
    type: String,
  },
  shiftEnd: {
    type: String,
  },
  shiftComplianceStatus: {
    type: String,
    enum: ['on_time', 'late', 'early_departure', 'unassigned', 'absent'],
    default: 'unassigned',
  },
  lateMinutes: {
    type: Number,
    default: 0,
  },
  earlyDepartureMinutes: {
    type: Number,
    default: 0,
  },
  allowedBreakMinutes: {
    type: Number,
    default: 60,
  },
  excessBreakMinutes: {
    type: Number,
    default: 0,
  },
  isExcessBreak: {
    type: Boolean,
    default: false,
  },
  targetWorkMinutes: {
    type: Number,
    default: 480,
  },
  underWorkMinutes: {
    type: Number,
    default: 0,
  },
  isUnderWorkHours: {
    type: Boolean,
    default: false,
  },
  clockInLocation: {
    lat: Number,
    lng: Number,
    accuracyMeters: Number,
    verified: Boolean,
  },
  clockOutLocation: {
    lat: Number,
    lng: Number,
    accuracyMeters: Number,
    verified: Boolean,
  },
  manualOverride: {
    type: Boolean,
    default: false,
  },
  overrideNotes: {
    type: String,
    default: '',
  },
  overrideBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }
}, { timestamps: true });

export default mongoose.model('Attendance', attendanceSchema);