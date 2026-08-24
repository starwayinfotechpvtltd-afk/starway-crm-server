import mongoose from 'mongoose';

const shiftSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  startTime: {
    type: String, // '09:00'
    required: true,
  },
  endTime: {
    type: String, // '18:00'
    required: true,
  },
  isNightShift: {
    type: Boolean,
    default: false,
  },
  workDays: {
    type: [String],
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    default: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  },
  allowedLateMinutes: {
    type: Number,
    default: 15,
  },
  allowedBreakMinutes: {
    type: Number,
    default: 60,
  },
  saturdayRule: {
    type: String,
    enum: ['all', 'alternate_1_3_5', 'alternate_2_4', 'none', 'flexible'],
    default: 'flexible',
  },
  color: {
    type: String,
    default: '#2563EB',
  },
  assignedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  isActive: {
    type: Boolean,
    default: true,
  }
}, { timestamps: true });

shiftSchema.pre('save', function (next) {
  if (this.startTime && this.endTime) {
    this.isNightShift = this.endTime < this.startTime;
  }
  next();
});

export default mongoose.model('Shift', shiftSchema);
