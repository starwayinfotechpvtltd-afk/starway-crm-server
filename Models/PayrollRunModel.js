import mongoose from "mongoose";

const { Schema, model } = mongoose;

const PayrollRunSchema = new Schema({
  month: { type: Number, required: true }, // 1 to 12
  year: { type: Number, required: true }, // e.g. 2026
  payrollPeriodLabel: { type: String, required: true }, // "August 2026"
  cycleStartDate: { type: Date, required: true },
  cycleEndDate: { type: Date, required: true },
  currency: { type: String, default: "INR" },
  
  // Status Cycle: draft -> calculated -> under_review -> approved -> locked -> paid
  status: {
    type: String,
    enum: ["draft", "calculated", "under_review", "approved", "locked", "paid"],
    default: "draft",
  },

  summary: {
    totalGross: { type: Number, default: 0 },
    totalDeductions: { type: Number, default: 0 },
    totalEmployerContributions: { type: Number, default: 0 },
    totalNetPay: { type: Number, default: 0 },
    employeeCount: { type: Number, default: 0 },
  },

  // Proactive Warning & Exception Detector
  exceptions: [
    {
      employeeId: { type: Schema.Types.ObjectId, ref: "User" },
      employeeName: String,
      type: {
        type: String,
        enum: ["missing_bank", "negative_net", "no_structure", "unpaid_leaves", "pending_reimbursement", "custom_warning"],
      },
      message: String,
      severity: { type: String, enum: ["warning", "danger", "info"], default: "warning" },
    },
  ],

  // Employee Payroll Items Breakdown
  employeeRecords: [
    {
      userId: { type: Schema.Types.ObjectId, ref: "User" },
      employeeIdCode: String,
      username: String,
      email: String,
      designation: String,
      role: String,
      teamId: { type: Schema.Types.ObjectId, ref: "Team", default: null },
      teamName: { type: String, default: "" },
      salaryStructureId: { type: Schema.Types.ObjectId, ref: "SalaryStructure" },
      salaryStructureName: String,
      baseSalary: { type: Number, default: 0 },
      
      // Breakdown Arrays
      earnings: [
        {
          code: String,
          name: String,
          amount: Number,
          type: String,
        },
      ],
      deductions: [
        {
          code: String,
          name: String,
          amount: Number,
          type: String,
        },
      ],
      employerContributions: [
        {
          code: String,
          name: String,
          amount: Number,
        },
      ],
      
      // Attendance & Variable inputs for this run
      workingDays: { type: Number, default: 30 },
      presentDays: { type: Number, default: 30 },
      unpaidLeaveDays: { type: Number, default: 0 },
      unpaidLeaveDeductionAmount: { type: Number, default: 0 },
      overtimeHours: { type: Number, default: 0 },
      overtimePay: { type: Number, default: 0 },
      bonusAmount: { type: Number, default: 0 },
      commissionAmount: { type: Number, default: 0 },
      reimbursementAmount: { type: Number, default: 0 },
      loanDeductionAmount: { type: Number, default: 0 },
      
      // One-off monthly adjustments applied by HR during payroll review
      monthlyAdjustments: [
        {
          title: String,
          amount: Number,
          type: { type: String, enum: ["earning", "deduction"], default: "earning" },
        },
      ],

      grossPay: { type: Number, default: 0 },
      totalDeductions: { type: Number, default: 0 },
      netPay: { type: Number, default: 0 },

      bankDetails: {
        bankName: String,
        accountNumber: String,
        ifscRouting: String,
        accountHolderName: String,
      },
      paymentStatus: {
        type: String,
        enum: ["pending", "processed", "paid", "failed"],
        default: "pending",
      },
      paymentDate: { type: Date, default: null },

      // Payslip Selective Sending Tracking
      isSent: { type: Boolean, default: false },
      sentAt: { type: Date, default: null },
      sentBy: { type: Schema.Types.ObjectId, ref: "User", default: null },

      notes: { type: String, default: "" },
    },
  ],

  calculatedAt: { type: Date, default: null },
  calculatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  approvedAt: { type: Date, default: null },
  approvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  lockedAt: { type: Date, default: null },
  lockedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  paidAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});

export default model("PayrollRun", PayrollRunSchema);
