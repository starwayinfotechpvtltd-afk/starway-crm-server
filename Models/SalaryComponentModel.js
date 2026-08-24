import mongoose from "mongoose";

const { Schema, model } = mongoose;

const SalaryComponentSchema = new Schema({
  name: { type: String, required: true }, // e.g. "Housing Allowance", "Income Tax"
  code: { type: String, required: true, unique: true }, // e.g. "HRA", "TDS", "BASIC"
  type: {
    type: String,
    enum: ["earning", "deduction", "employer_contribution", "reimbursement"],
    required: true,
  },
  calculationType: {
    type: String,
    enum: [
      "fixed_amount",
      "percentage",
      "formula",
      "per_day",
      "per_hour",
      "variable",
      "manual_entry",
    ],
    default: "fixed_amount",
  },
  calculationBase: {
    type: String,
    enum: [
      "basic_salary",
      "gross_salary",
      "net_salary",
      "working_days",
      "hours_worked",
      "custom_component",
      "custom_formula",
      "none",
    ],
    default: "none",
  },
  baseComponentCode: { type: String, default: "" }, // if calculationBase is another component
  value: { type: Number, default: 0 }, // e.g. 40 (for 40%) or 5000 (for ₹5000)
  formulaExpression: { type: String, default: "" }, // e.g. "BASIC * 0.40"
  description: { type: String, default: "" },
  isTaxable: { type: Boolean, default: true },
  isRecurring: { type: Boolean, default: true },
  enteredDuringPayroll: { type: Boolean, default: false }, // for variable items like commissions/bonuses
  status: { type: String, enum: ["active", "archived"], default: "active" },
  createdAt: { type: Date, default: Date.now },
});

export default model("SalaryComponent", SalaryComponentSchema);
