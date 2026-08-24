import mongoose from "mongoose";

const { Schema, model } = mongoose;

const SalaryStructureSchema = new Schema({
  name: { type: String, required: true }, // e.g. "Full-Time Corporate", "Sales Executive", "Contractor"
  code: { type: String, required: true, unique: true }, // e.g. "STR-FT", "STR-SALES"
  description: { type: String, default: "" },
  templateType: {
    type: String,
    enum: ["standard", "sales", "contractor", "intern", "management", "hourly", "custom"],
    default: "standard",
  },
  components: [
    {
      componentId: { type: Schema.Types.ObjectId, ref: "SalaryComponent" },
      code: String,
      name: String,
      type: { type: String, enum: ["earning", "deduction", "employer_contribution", "reimbursement"] },
      calculationType: String,
      calculationBase: String,
      value: Number,
      formulaExpression: String,
      isMandatory: { type: Boolean, default: false },
    },
  ],
  version: { type: Number, default: 1 },
  effectiveFrom: { type: Date, default: Date.now },
  effectiveUntil: { type: Date, default: null },
  changeReason: { type: String, default: "Initial Creation" },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  status: { type: String, enum: ["active", "archived"], default: "active" },
  createdAt: { type: Date, default: Date.now },
});

export default model("SalaryStructure", SalaryStructureSchema);
