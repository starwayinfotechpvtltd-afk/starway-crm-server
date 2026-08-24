import mongoose from "mongoose";

const { Schema, model } = mongoose;

const PayslipTemplateSchema = new Schema({
  name: { type: String, required: true },
  isDefault: { type: Boolean, default: false },
  theme: {
    type: String,
    enum: ["modern_blue", "corporate_classic", "minimal_clean", "executive_navy", "compact"],
    default: "modern_blue",
  },
  layoutType: {
    type: String,
    enum: ["two_column", "single_column", "compact_invoice"],
    default: "two_column",
  },
  
  // Header Branding & Logos
  header: {
    showLogo: { type: Boolean, default: true },
    logoUrl: { type: String, default: "https://crm.starwaywebdigital.com/assets/starwaylogo-CBhcSc4Y.png" },
    companyName: { type: String, default: "Starway Enterprise Inc." },
    addressLine: { type: String, default: "Level 4, Orion Tower, Innovation District" },
    taxRegistrationNumber: { type: String, default: "GSTIN / TAX ID: STAR-992014-A" },
    titleText: { type: String, default: "MONTHLY SALARY STATEMENT" },
    subtitleText: { type: String, default: "Confidential Payroll Statement" },
  },

  // Employee Information Visibility Fields
  employeeFields: {
    showEmployeeId: { type: Boolean, default: true },
    showDesignation: { type: Boolean, default: true },
    showDepartment: { type: Boolean, default: true },
    showJoiningDate: { type: Boolean, default: true },
    showBankDetails: { type: Boolean, default: true },
    showTaxId: { type: Boolean, default: true },
    showWorkingDays: { type: Boolean, default: true },
    showLeaveBalance: { type: Boolean, default: true },
  },

  // Section Options
  sections: {
    showEmployerContributions: { type: Boolean, default: true },
    showAttendanceSummary: { type: Boolean, default: true },
    showReimbursements: { type: Boolean, default: true },
    showQrCode: { type: Boolean, default: true },
    showSignatureBlock: { type: Boolean, default: true },
    showWatermark: { type: Boolean, default: false },
  },

  // Signatory & Digital Verification
  signatory: {
    name: { type: String, default: "HR & Finance Director" },
    designation: { type: String, default: "Authorized Officer" },
    signatureImageUrl: { type: String, default: "" },
    qrCodeData: { type: String, default: "https://starway.management/verify-payslip" },
    watermarkText: { type: String, default: "CONFIDENTIAL" },
  },

  // Footer & Disclaimer
  footerText: {
    type: String,
    default: "This is a computer-generated salary statement. Confidential document intended solely for the authorized employee.",
  },
  primaryColor: { type: String, default: "#1E40AF" },
  secondaryColor: { type: String, default: "#F5EFE6" },

  createdAt: { type: Date, default: Date.now },
});

export default model("PayslipTemplate", PayslipTemplateSchema);
