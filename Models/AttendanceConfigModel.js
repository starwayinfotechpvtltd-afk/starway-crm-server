import mongoose from 'mongoose';

const officeSchema = new mongoose.Schema({
  name: {
    type: String,
    default: 'Main Office',
  },
  latitude: {
    type: Number,
    required: true,
  },
  longitude: {
    type: Number,
    required: true,
  },
  radiusMeters: {
    type: Number,
    default: 100,
  },
  isDefault: {
    type: Boolean,
    default: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  }
});

const saturdayOverrideSchema = new mongoose.Schema({
  date: { type: String, required: true }, // YYYY-MM-DD
  isWorking: { type: Boolean, required: true }, // true = Shifted Working Day, false = Declared Holiday / Off
  note: { type: String, default: '' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

const attendanceConfigSchema = new mongoose.Schema({
  offices: [officeSchema],
  blockClockInOnFail: {
    type: Boolean,
    default: true,
  },
  workingSaturdayOverrides: [saturdayOverrideSchema],
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }
}, { timestamps: true });

export default mongoose.model('AttendanceConfig', attendanceConfigSchema);
