import mongoose from "mongoose";

const { Schema, model } = mongoose;

const ReimbursementSchema = new Schema({
  employeeId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  category: {
    type: String,
    enum: [
      "Travel",
      "Food & Meals",
      "Accommodation",
      "Fuel / Transport",
      "Internet / Mobile",
      "Medical",
      "Equipment",
      "Client Entertainment",
      "Other",
    ],
    default: "Other",
  },
  amount: { type: Number, required: true },
  claimDate: { type: Date, default: Date.now },
  description: { type: String, required: true },
  receiptUrl: { type: String, default: "" },
  status: {
    type: String,
    enum: ["pending", "manager_approved", "hr_approved", "rejected", "processed_in_payroll"],
    default: "pending",
  },
  approvedAmount: { type: Number, default: 0 },
  rejectionReason: { type: String, default: "" },
  approvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  payrollRunId: { type: Schema.Types.ObjectId, ref: "PayrollRun", default: null },
  createdAt: { type: Date, default: Date.now },
});

export default model("Reimbursement", ReimbursementSchema);
