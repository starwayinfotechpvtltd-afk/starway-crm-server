import bcryptjs from "bcryptjs";
import mongoose from "mongoose";

const { Schema, model } = mongoose;

const UserSchema = new Schema({
  // Basic Auth & Identifiers
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ["caller", "developer", "admin", "manager", "team_lead", "hr"],
    default: "caller",
  },
  avatar: { 
    type: String, 
    default: "https://media.istockphoto.com/id/2151669184/vector/vector-flat-illustration-in-grayscale-avatar-user-profile-person-icon-gender-neutral.jpg?s=612x612&w=0&k=20&c=UEa7oHoOL30ynvmJzSCIPrwwopJdfqzBs0q69ezQoM8=" 
  },

  // 1. Personal Information
  employeeId: { type: String, default: "" }, // e.g. "EMP-001"
  firstName: { type: String, default: "" },
  middleName: { type: String, default: "" },
  lastName: { type: String, default: "" },
  dob: { type: Date, default: null },
  gender: { type: String, enum: ["male", "female", "other", ""], default: "" },
  personalEmail: { type: String, default: "" },
  phone: { type: String, default: "" },
  address: {
    street: { type: String, default: "" },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    country: { type: String, default: "" },
    postalCode: { type: String, default: "" },
  },
  emergencyContact: {
    name: { type: String, default: "" },
    relationship: { type: String, default: "" },
    phone: { type: String, default: "" },
  },

  // 2. Employment Information
  designation: { type: String, default: "" },
  department: { type: String, default: "General" },
  employmentType: {
    type: String,
    enum: ["full_time", "part_time", "contractor", "intern", "temporary", "freelance"],
    default: "full_time",
  },
  employmentStatus: {
    type: String,
    enum: ["active", "probation", "on_leave", "resigned", "terminated"],
    default: "active",
  },
  joiningDate: { type: Date, default: Date.now },
  probationPeriod: { type: String, default: "3 months" },
  confirmationDate: { type: Date, default: null },
  lastWorkingDate: { type: Date, default: null },
  terminationReason: { type: String, default: "" },
  terminationNotes: { type: String, default: "" },
  location: { type: String, default: "Main Office" },

  // Reporting Hierarchy & Teams
  reportingTo: { type: Schema.Types.ObjectId, ref: "User", default: null },
  teamId: { type: Schema.Types.ObjectId, ref: "Team", default: null },
  shiftId: { type: Schema.Types.ObjectId, ref: "Shift", default: null },

  // 3. Payroll & Bank Details
  salaryStructureId: { type: Schema.Types.ObjectId, ref: "SalaryStructure", default: null },
  baseSalary: { type: Number, default: 0 },
  payFrequency: {
    type: String,
    enum: ["monthly", "semi_monthly", "bi_weekly", "weekly"],
    default: "monthly",
  },
  paymentMethod: {
    type: String,
    enum: ["bank_transfer", "cash", "cheque", "direct_deposit"],
    default: "bank_transfer",
  },
  bankDetails: {
    bankName: { type: String, default: "" },
    accountNumber: { type: String, default: "" },
    ifscRouting: { type: String, default: "" },
    accountHolderName: { type: String, default: "" },
  },
  taxId: { type: String, default: "" }, // PAN / SSN / Tax Number
  customSalaryAllowances: [
    {
      name: String,
      amount: Number,
      isPercentage: Boolean,
    },
  ],
  customSalaryDeductions: [
    {
      name: String,
      amount: Number,
      isPercentage: Boolean,
    },
  ],

  // 4. Leave Balance & Enhanced Leave Records
  leaveBalance: { type: Number, default: 12 },
  leaveRecords: [
    {
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
      duration: { type: String, enum: ["full_day", "half_day"], default: "full_day" },
      daysCount: { type: Number, default: 1 },
      finalApprovedDays: { type: Number, default: 1 },
      type: { type: String, enum: ["full", "half"], default: "full" }, // backward-compatibility
      leaveType: {
        type: String,
        enum: ["paid", "unpaid", "sick", "annual", "casual", "maternity", "other"],
        default: "paid",
      },
      note: { type: String, default: "" },
      status: {
        type: String,
        enum: ["pending", "approved", "rejected", "negotiated"],
        default: "pending",
      },
      rejectionReason: { type: String, default: "" },
      negotiationNotes: { type: String, default: "" },
      approvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
      createdAt: { type: Date, default: Date.now },
    },
  ],

  // 5. User Exceptions for Attendance
  customWorkHours: { type: Number, default: null },
  customBreakTime: { type: Number, default: null },
});

// Hash password pre-save
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next;
  try {
    const salting = await bcryptjs.genSalt(10);
    this.password = await bcryptjs.hash(this.password, salting);
    next();
  } catch (error) {
    next(error);
  }
});

// Password compare method
UserSchema.methods.comparePassword = async function (password) {
  return await bcryptjs.compare(password, this.password);
};

export default model("User", UserSchema);