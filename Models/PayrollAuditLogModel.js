import mongoose from "mongoose";

const { Schema, model } = mongoose;

const PayrollAuditLogSchema = new Schema({
  action: { type: String, required: true }, // e.g. "SALARY_STRUCTURE_UPDATED", "PAYROLL_LOCKED", "EMPLOYEE_TERMINATED"
  targetEntity: {
    type: String,
    enum: ["salary_component", "salary_structure", "payroll_config", "payroll_run", "employee", "reimbursement", "loan", "payslip_template", "leave"],
    required: true,
  },
  targetId: { type: String, default: "" },
  targetName: { type: String, default: "" },
  performedBy: {
    id: { type: Schema.Types.ObjectId, ref: "User" },
    username: String,
    role: String,
  },
  beforeState: { type: Schema.Types.Mixed, default: null },
  afterState: { type: Schema.Types.Mixed, default: null },
  description: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

export default model("PayrollAuditLog", PayrollAuditLogSchema);
