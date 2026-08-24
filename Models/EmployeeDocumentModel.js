import mongoose from "mongoose";

const { Schema, model } = mongoose;

const EmployeeDocumentSchema = new Schema({
  employeeId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  title: { type: String, required: true }, // e.g. "Signed Employment Agreement", "Passport Copy"
  category: {
    type: String,
    enum: [
      "employment_contract",
      "offer_letter",
      "id_proof",
      "tax_document",
      "bank_document",
      "certificate",
      "experience_letter",
      "other",
    ],
    default: "other",
  },
  fileUrl: { type: String, required: true },
  fileType: { type: String, default: "application/pdf" },
  fileSize: { type: String, default: "" },
  expiryDate: { type: Date, default: null },
  notes: { type: String, default: "" },
  accessPermissions: {
    type: String,
    enum: ["hr_only", "employee_and_hr", "admin_only"],
    default: "employee_and_hr",
  },
  uploadedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  createdAt: { type: Date, default: Date.now },
});

export default model("EmployeeDocument", EmployeeDocumentSchema);
