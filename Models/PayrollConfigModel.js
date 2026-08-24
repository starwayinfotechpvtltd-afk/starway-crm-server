import mongoose from "mongoose";

const { Schema, model } = mongoose;

const PayrollConfigSchema = new Schema({
  organizationName: { type: String, default: "Starway Enterprise Inc." },
  currency: { type: String, default: "INR" },
  currencySymbol: { type: String, default: "₹" },
  
  // 1. Pay Frequency & Period
  payFrequency: {
    type: String,
    enum: ["monthly", "semi_monthly", "bi_weekly", "weekly"],
    default: "monthly",
  },
  cycleStartDay: { type: Number, default: 1 },
  cycleEndDay: { type: Number, default: 31 },
  payDay: { type: String, default: "last_working_day" },
  
  // 2. Working Pattern & Schedule
  workingDaysPattern: {
    type: String,
    enum: ["monday_friday", "monday_saturday", "custom"],
    default: "monday_friday",
  },
  standardDailyHours: { type: Number, default: 8 },
  standardWeeklyHours: { type: Number, default: 40 },

  // 3. Realistic Unpaid Leave & Attendance Integration
  attendanceIntegration: {
    enabled: { type: Boolean, default: true },
    deductUnpaidLeaves: { type: Boolean, default: true },
    deductUnapprovedLeaves: { type: Boolean, default: true },
    unapprovedLeavePenaltyMultiplier: { type: Number, default: 1.0 },
    halfDayDeductionFactor: { type: Number, default: 0.5 },
    unpaidLeaveCalculationBasis: {
      type: String,
      enum: ["calendar_days", "fixed_26_days", "fixed_30_days", "actual_working_days"],
      default: "calendar_days",
    },
  },

  // 4. Overtime Policy
  overtime: {
    enabled: { type: Boolean, default: true },
    rateMultiplier: { type: Number, default: 1.5 },
    weekendMultiplier: { type: Number, default: 2.0 },
    holidayMultiplier: { type: Number, default: 2.5 },
    minOvertimeMinutes: { type: Number, default: 30 },
    requiresApproval: { type: Boolean, default: true },
  },

  // 5. Late Arrival / Penalty Rules
  lateArrivalPenalty: {
    enabled: { type: Boolean, default: false },
    graceMinutes: { type: Number, default: 15 },
    penaltyPerMinute: { type: Number, default: 5 },
    maxPenaltyPerMonth: { type: Number, default: 3000 },
  },

  // 6. Shift Allowances
  shiftAllowances: [
    {
      shiftName: String,
      startTime: String,
      endTime: String,
      allowanceAmount: Number,
    },
  ],

  // 7. Multi-Tier Commission Slabs with Milestone Bonuses
  commissionSlabs: [
    {
      tierName: { type: String, default: "Standard Tier" },
      minSales: { type: Number, default: 0 },
      maxSales: { type: Number, default: 100000 },
      percentage: { type: Number, default: 3 },
      bonusFixed: { type: Number, default: 0 },
    },
  ],

  // 8. Tax Regime & Statutory Defaults
  taxSettings: {
    taxRegime: { type: String, enum: ["new_regime", "old_regime"], default: "new_regime" },
    standardDeduction: { type: Number, default: 50000 },
    providentFundRate: { type: Number, default: 12 },
    gratuityApplicable: { type: Boolean, default: true },
    gratuityPercentage: { type: Number, default: 4.81 },
  },

  // 9. Reimbursement Categories
  reimbursementCategories: {
    type: [String],
    default: ["Travel", "Food & Meals", "Accommodation", "Fuel / Transport", "Internet / Mobile", "Medical", "Equipment", "Client Entertainment", "Other"],
  },

  // 10. Approval & Locking
  approvalWorkflow: {
    stages: { type: Number, default: 1 },
    autoLockAfterApproval: { type: Boolean, default: true },
  },

  updatedAt: { type: Date, default: Date.now },
});

export default model("PayrollConfig", PayrollConfigSchema);
