import mongoose from "mongoose";

const { Schema, model } = mongoose;

const LoanAdvanceSchema = new Schema({
  employeeId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  title: { type: String, required: true }, // e.g. "Emergency Salary Advance", "Equipment Loan"
  totalAmount: { type: Number, required: true },
  monthlyInstallment: { type: Number, required: true },
  remainingBalance: { type: Number, required: true },
  totalInstallments: { type: Number, required: true },
  paidInstallments: { type: Number, default: 0 },
  startDate: { type: Date, default: Date.now },
  reason: { type: String, default: "" },
  status: {
    type: String,
    enum: ["active", "completed", "paused", "rejected"],
    default: "active",
  },
  approvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  createdAt: { type: Date, default: Date.now },
});

export default model("LoanAdvance", LoanAdvanceSchema);
