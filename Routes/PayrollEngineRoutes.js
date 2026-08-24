import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import UserModel from "../Models/UserModel.js";
import SalaryComponentModel from "../Models/SalaryComponentModel.js";
import SalaryStructureModel from "../Models/SalaryStructureModel.js";
import PayrollConfigModel from "../Models/PayrollConfigModel.js";
import PayrollRunModel from "../Models/PayrollRunModel.js";
import PayslipTemplateModel from "../Models/PayslipTemplateModel.js";
import EmployeeDocumentModel from "../Models/EmployeeDocumentModel.js";
import ReimbursementModel from "../Models/ReimbursementModel.js";
import LoanAdvanceModel from "../Models/LoanAdvanceModel.js";
import PayrollAuditLogModel from "../Models/PayrollAuditLogModel.js";
import { verifyToken, isAdmin } from "../Middlewares/AuthMiddleware.js";

const router = express.Router();

// Setup local uploads storage for employee documents & reimbursement receipts
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const docUploadPath = path.join(__dirname, "../uploads/documents");
if (!fs.existsSync(docUploadPath)) {
  fs.mkdirSync(docUploadPath, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, docUploadPath),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e6) + ext;
    cb(null, unique);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
});

// Helper for audit logging
const createAuditLog = async (action, targetEntity, targetId, targetName, performedBy, beforeState, afterState, description) => {
  try {
    await PayrollAuditLogModel.create({
      action,
      targetEntity,
      targetId: String(targetId || ""),
      targetName: targetName || "",
      performedBy: {
        id: performedBy?.id || performedBy?._id,
        username: performedBy?.username || "Admin / HR",
        role: performedBy?.role || "hr",
      },
      beforeState,
      afterState,
      description,
    });
  } catch (err) {
    console.error("Audit log error:", err);
  }
};

// ============================================================================
// 1. SEED DEFAULT DATA IF NOT EXISTS
// ============================================================================
router.post("/seed-defaults", verifyToken, async (req, res) => {
  try {
    // 1. Config
    let config = await PayrollConfigModel.findOne();
    if (!config) {
      config = await PayrollConfigModel.create({
        organizationName: "Starway Enterprise",
        currency: "INR",
        currencySymbol: "₹",
        payFrequency: "monthly",
        cycleStartDay: 1,
        cycleEndDay: 31,
        payDay: "last_working_day",
        workingDaysPattern: "monday_friday",
        standardDailyHours: 8,
        standardWeeklyHours: 40,
        attendanceIntegration: { enabled: true, deductUnpaidLeaves: true, halfDayDeductionFactor: 0.5 },
        overtime: { enabled: true, rateMultiplier: 1.5, weekendMultiplier: 2.0, minOvertimeMinutes: 60, requiresApproval: true },
        commissionSlabs: [
          { minSales: 0, maxSales: 100000, percentage: 2 },
          { minSales: 100000, maxSales: 500000, percentage: 4 },
          { minSales: 500000, maxSales: 2000000, percentage: 6 },
        ],
      });
    }

    // 2. Default Components
    const countComp = await SalaryComponentModel.countDocuments();
    if (countComp === 0) {
      await SalaryComponentModel.insertMany([
        { name: "Basic Salary", code: "BASIC", type: "earning", calculationType: "fixed_amount", calculationBase: "none", value: 30000, isTaxable: true, isRecurring: true },
        { name: "House Rent Allowance (HRA)", code: "HRA", type: "earning", calculationType: "percentage", calculationBase: "basic_salary", value: 40, formulaExpression: "BASIC * 0.40", isTaxable: true, isRecurring: true },
        { name: "Transport Allowance", code: "TRANS", type: "earning", calculationType: "fixed_amount", calculationBase: "none", value: 3000, isTaxable: true, isRecurring: true },
        { name: "Special Allowance", code: "SPEC", type: "earning", calculationType: "fixed_amount", calculationBase: "none", value: 5000, isTaxable: true, isRecurring: true },
        { name: "Performance Bonus", code: "BONUS", type: "earning", calculationType: "variable", calculationBase: "none", value: 0, enteredDuringPayroll: true, isTaxable: true, isRecurring: false },
        { name: "Sales Commission", code: "COMM", type: "earning", calculationType: "variable", calculationBase: "none", value: 0, enteredDuringPayroll: true, isTaxable: true, isRecurring: false },
        { name: "Overtime Pay", code: "OT", type: "earning", calculationType: "formula", calculationBase: "hours_worked", value: 0, formulaExpression: "(BASIC / 160) * 1.5 * OT_HOURS", isTaxable: true, isRecurring: false },
        { name: "Income Tax (TDS)", code: "TDS", type: "deduction", calculationType: "percentage", calculationBase: "gross_salary", value: 5, formulaExpression: "GROSS * 0.05", isRecurring: true },
        { name: "Provident Fund (PF)", code: "PF", type: "deduction", calculationType: "percentage", calculationBase: "basic_salary", value: 12, formulaExpression: "BASIC * 0.12", isRecurring: true },
        { name: "Health Insurance", code: "INS", type: "deduction", calculationType: "fixed_amount", calculationBase: "none", value: 1500, isRecurring: true },
        { name: "Loan Repayment", code: "LOAN", type: "deduction", calculationType: "manual_entry", calculationBase: "none", value: 0, isRecurring: true },
        { name: "Employer PF Contribution", code: "EMPR_PF", type: "employer_contribution", calculationType: "percentage", calculationBase: "basic_salary", value: 12, isRecurring: true },
      ]);
    }

    // 3. Default Structures
    const countStruct = await SalaryStructureModel.countDocuments();
    if (countStruct === 0) {
      const allComp = await SalaryComponentModel.find();
      const compMap = {};
      allComp.forEach((c) => (compMap[c.code] = c));

      await SalaryStructureModel.insertMany([
        {
          name: "Full-Time Corporate Standard",
          code: "STR-FT-CORP",
          description: "Default standard structure for corporate staff (Basic + HRA + Transport + Special - TDS - PF)",
          templateType: "standard",
          components: [
            { componentId: compMap["BASIC"]?._id, code: "BASIC", name: "Basic Salary", type: "earning", calculationType: "fixed_amount", value: 35000, isMandatory: true },
            { componentId: compMap["HRA"]?._id, code: "HRA", name: "House Rent Allowance", type: "earning", calculationType: "percentage", calculationBase: "basic_salary", value: 40, isMandatory: true },
            { componentId: compMap["TRANS"]?._id, code: "TRANS", name: "Transport Allowance", type: "earning", calculationType: "fixed_amount", value: 3000 },
            { componentId: compMap["SPEC"]?._id, code: "SPEC", name: "Special Allowance", type: "earning", calculationType: "fixed_amount", value: 4000 },
            { componentId: compMap["TDS"]?._id, code: "TDS", name: "Income Tax", type: "deduction", calculationType: "percentage", calculationBase: "gross_salary", value: 5 },
            { componentId: compMap["PF"]?._id, code: "PF", name: "Provident Fund", type: "deduction", calculationType: "percentage", calculationBase: "basic_salary", value: 12 },
          ],
        },
        {
          name: "Sales Executive Structure",
          code: "STR-SALES",
          description: "Structure tailored for sales & calling teams with variable commission & bonus support",
          templateType: "sales",
          components: [
            { componentId: compMap["BASIC"]?._id, code: "BASIC", name: "Base Retainer", type: "earning", calculationType: "fixed_amount", value: 25000, isMandatory: true },
            { componentId: compMap["HRA"]?._id, code: "HRA", name: "House Rent Allowance", type: "earning", calculationType: "percentage", calculationBase: "basic_salary", value: 30 },
            { componentId: compMap["COMM"]?._id, code: "COMM", name: "Sales Commission", type: "earning", calculationType: "variable", value: 0 },
            { componentId: compMap["BONUS"]?._id, code: "BONUS", name: "Target Bonus", type: "earning", calculationType: "variable", value: 0 },
            { componentId: compMap["TDS"]?._id, code: "TDS", name: "TDS", type: "deduction", calculationType: "percentage", calculationBase: "gross_salary", value: 5 },
          ],
        },
        {
          name: "Contractor & Freelancer Plan",
          code: "STR-CONTRACT",
          description: "Fixed payment contractor structure with zero statutory PF deductions",
          templateType: "contractor",
          components: [
            { componentId: compMap["BASIC"]?._id, code: "BASIC", name: "Contract Retainer", type: "earning", calculationType: "fixed_amount", value: 50000, isMandatory: true },
            { componentId: compMap["TDS"]?._id, code: "TDS", name: "Contractor TDS (194J)", type: "deduction", calculationType: "percentage", calculationBase: "gross_salary", value: 10 },
          ],
        },
      ]);
    }

    // 4. Default Payslip Template
    const countPayslip = await PayslipTemplateModel.countDocuments();
    if (countPayslip === 0) {
      await PayslipTemplateModel.create({
        name: "Standard Modern Corporate",
        isDefault: true,
        theme: "modern_blue",
        header: {
          showLogo: true,
          logoUrl: "https://crm.starwaywebdigital.com/assets/starwaylogo-CBhcSc4Y.png",
          companyName: "Starway Enterprise Inc.",
          addressLine: "Level 4, Orion Tower, Innovation District, Tech Hub",
          taxRegistrationNumber: "TAX-IN-88920194A",
          titleText: "MONTHLY SALARY STATEMENT",
        },
        employeeFields: {
          showEmployeeId: true,
          showDesignation: true,
          showDepartment: true,
          showJoiningDate: true,
          showBankDetails: true,
          showTaxId: true,
          showWorkingDays: true,
          showLeaveBalance: true,
        },
        sections: {
          showEmployerContributions: true,
          showAttendanceSummary: true,
          showReimbursements: true,
          showQrCode: true,
          showSignatureBlock: true,
        },
        footerText: "This is a computer-generated salary slip. Confidential document for authorized personnel.",
        primaryColor: "#2563EB",
        secondaryColor: "#F5EFE6",
      });
    }

    res.json({ message: "Default Payroll Engine data seeded successfully!" });
  } catch (err) {
    console.error("Seed error:", err);
    res.status(500).json({ message: "Failed to seed default payroll data" });
  }
});

// ============================================================================
// 2. SALARY COMPONENTS CRUD
// ============================================================================
router.get("/components", verifyToken, async (req, res) => {
  try {
    const components = await SalaryComponentModel.find().sort({ type: 1, name: 1 });
    res.json(components);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch salary components" });
  }
});

router.post("/components", verifyToken, async (req, res) => {
  try {
    const newComp = await SalaryComponentModel.create(req.body);
    await createAuditLog("SALARY_COMPONENT_CREATED", "salary_component", newComp._id, newComp.name, req.user, null, newComp, `Created component ${newComp.name} (${newComp.code})`);
    res.status(201).json(newComp);
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: err.message || "Failed to create component" });
  }
});

router.put("/components/:id", verifyToken, async (req, res) => {
  try {
    const before = await SalaryComponentModel.findById(req.params.id);
    const updated = await SalaryComponentModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
    await createAuditLog("SALARY_COMPONENT_UPDATED", "salary_component", updated._id, updated.name, req.user, before, updated, `Updated component ${updated.name}`);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: "Failed to update component" });
  }
});

router.delete("/components/:id", verifyToken, async (req, res) => {
  try {
    const comp = await SalaryComponentModel.findByIdAndDelete(req.params.id);
    await createAuditLog("SALARY_COMPONENT_DELETED", "salary_component", req.params.id, comp?.name, req.user, comp, null, `Deleted component ${comp?.name}`);
    res.json({ message: "Component deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete component" });
  }
});

// ============================================================================
// 3. SALARY STRUCTURES CRUD & VERSIONING
// ============================================================================
router.get("/structures", verifyToken, async (req, res) => {
  try {
    const structures = await SalaryStructureModel.find().populate("components.componentId");
    res.json(structures);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch salary structures" });
  }
});

router.post("/structures", verifyToken, async (req, res) => {
  try {
    const structure = await SalaryStructureModel.create({
      ...req.body,
      createdBy: req.user.id,
      version: 1,
    });
    await createAuditLog("SALARY_STRUCTURE_CREATED", "salary_structure", structure._id, structure.name, req.user, null, structure, `Created salary structure ${structure.name}`);
    res.status(201).json(structure);
  } catch (err) {
    res.status(400).json({ message: err.message || "Failed to create salary structure" });
  }
});

router.put("/structures/:id", verifyToken, async (req, res) => {
  try {
    const before = await SalaryStructureModel.findById(req.params.id);
    const newVersion = (before.version || 1) + 1;

    const updated = await SalaryStructureModel.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        version: newVersion,
        effectiveFrom: new Date(),
      },
      { new: true }
    );
    await createAuditLog("SALARY_STRUCTURE_UPDATED", "salary_structure", updated._id, updated.name, req.user, before, updated, `Updated structure ${updated.name} to version ${newVersion}`);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: "Failed to update salary structure" });
  }
});

// ============================================================================
// 4. ORGANIZATION PAYROLL CONFIG
// ============================================================================
router.get("/config", verifyToken, async (req, res) => {
  try {
    let config = await PayrollConfigModel.findOne();
    if (!config) {
      config = await PayrollConfigModel.create({});
    }
    res.json(config);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch payroll config" });
  }
});

router.put("/config", verifyToken, async (req, res) => {
  try {
    let config = await PayrollConfigModel.findOne();
    const before = config;
    if (!config) {
      config = await PayrollConfigModel.create(req.body);
    } else {
      config = await PayrollConfigModel.findByIdAndUpdate(config._id, req.body, { new: true });
    }
    await createAuditLog("PAYROLL_CONFIG_UPDATED", "payroll_config", config._id, "Organization Rules", req.user, before, config, "Updated organization-wide payroll configuration");
    res.json(config);
  } catch (err) {
    res.status(400).json({ message: "Failed to update payroll config" });
  }
});

// ============================================================================
// 5. MONTHLY PAYROLL RUN ENGINE & CALCULATION
// ============================================================================
router.get("/runs", verifyToken, async (req, res) => {
  try {
    const runs = await PayrollRunModel.find().sort({ year: -1, month: -1 });
    res.json(runs);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch payroll runs" });
  }
});

router.get("/runs/:id", verifyToken, async (req, res) => {
  try {
    const run = await PayrollRunModel.findById(req.params.id);
    if (!run) return res.status(404).json({ message: "Payroll run not found" });
    res.json(run);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch payroll run details" });
  }
});

// Calculate Monthly Payroll
router.post("/runs/calculate", verifyToken, async (req, res) => {
  const { month, year, customInputs } = req.body; // e.g. month: 8, year: 2026
  if (!month || !year) return res.status(400).json({ message: "Month and Year are required." });

  try {
    const config = (await PayrollConfigModel.findOne()) || {};
    const structures = await SalaryStructureModel.find().populate("components.componentId");
    const structMap = {};
    structures.forEach((s) => (structMap[String(s._id)] = s));

    // Active Employees
    const employees = await UserModel.find({
      employmentStatus: { $in: ["active", "probation", "on_leave"] },
    });

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const periodLabel = `${monthNames[month - 1]} ${year}`;

    const cycleStart = new Date(year, month - 1, 1);
    const cycleEnd = new Date(year, month, 0); // last day of month
    const totalMonthDays = cycleEnd.getDate();

    let totalGross = 0;
    let totalDeductions = 0;
    let totalEmployerContributions = 0;
    let totalNetPay = 0;

    const employeeRecords = [];
    const exceptions = [];

    for (const emp of employees) {
      const empInput = (customInputs && customInputs[String(emp._id)]) || {};
      const struct = emp.salaryStructureId ? structMap[String(emp.salaryStructureId)] : null;

      const baseSalary = Number(emp.baseSalary || 0);

      // Check for exceptions
      if (!emp.bankDetails?.accountNumber) {
        exceptions.push({
          employeeId: emp._id,
          employeeName: emp.username,
          type: "missing_bank",
          message: `${emp.username} has missing bank account number.`,
          severity: "warning",
        });
      }

      if (!struct) {
        exceptions.push({
          employeeId: emp._id,
          employeeName: emp.username,
          type: "no_structure",
          message: `${emp.username} is not attached to any salary structure.`,
          severity: "info",
        });
      }

      // Calculate Leaves: Approved Unpaid, Unapproved / Rejected, and Pending
      let unpaidDays = 0;
      let unapprovedDays = 0;
      let pendingLeavesCount = 0;

      (emp.leaveRecords || []).forEach((l) => {
        const lDate = new Date(l.startDate);
        if (lDate.getMonth() + 1 === Number(month) && lDate.getFullYear() === Number(year)) {
          const days = Number(l.finalApprovedDays || (l.duration === "half_day" ? 0.5 : l.daysCount || 1));
          
          if (l.status === "approved" || l.status === "negotiated") {
            if (l.leaveType === "unpaid") {
              unpaidDays += days;
            }
          } else if (l.status === "rejected") {
            // Unapproved / Rejected Absence (Treated as Loss of Pay)
            unapprovedDays += days;
          } else if (l.status === "pending") {
            pendingLeavesCount++;
          }
        }
      });

      if (unpaidDays > 0) {
        exceptions.push({
          employeeId: emp._id,
          employeeName: emp.username,
          type: "unpaid_leaves",
          message: `${emp.username} has ${unpaidDays} approved unpaid leave day(s) deducted as LOP.`,
          severity: "info",
        });
      }

      if (unapprovedDays > 0) {
        exceptions.push({
          employeeId: emp._id,
          employeeName: emp.username,
          type: "custom_warning",
          message: `⚠️ ${emp.username} took ${unapprovedDays} unapproved/rejected leave day(s). Deducted as Unauthorized Loss of Pay (LOP).`,
          severity: "warning",
        });
      }

      if (pendingLeavesCount > 0) {
        exceptions.push({
          employeeId: emp._id,
          employeeName: emp.username,
          type: "custom_warning",
          message: `⏳ ${emp.username} has ${pendingLeavesCount} pending leave ticket(s) awaiting approval in this cycle.`,
          severity: "warning",
        });
      }

      const totalAbsentDays = unpaidDays + unapprovedDays;

      // Dynamic Component Evaluation Map
      const compValues = {
        BASIC: baseSalary,
        BASE: baseSalary,
        TOTAL_DAYS: totalMonthDays,
        UNPAID_DAYS: totalAbsentDays,
        PRESENT_DAYS: Math.max(0, totalMonthDays - totalAbsentDays),
      };

      // Calculate Earnings
      const earnings = [];
      let calculatedGross = 0;

      // 1. Process Structure Earnings
      if (struct && struct.components) {
        for (const c of struct.components) {
          if (c.type === "earning") {
            let amount = 0;
            const code = c.code || "EARN";

            if (code === "BASIC" && (!c.value || c.value === 0)) {
              amount = baseSalary;
            } else if (c.calculationType === "fixed_amount") {
              amount = Number(c.value || 0);
            } else if (c.calculationType === "percentage") {
              const base = c.calculationBase === "gross_salary" ? calculatedGross : (compValues[c.baseComponentCode] || baseSalary);
              amount = Math.round(base * ((c.value || 0) / 100));
            } else if (c.calculationType === "per_day") {
              amount = Math.round(Number(c.value || 0) * (totalMonthDays - unpaidDays));
            } else if (c.calculationType === "per_hour") {
              const hours = Number(empInput[`${code}_HOURS`] || empInput.hoursWorked || 160);
              amount = Math.round(Number(c.value || 0) * hours);
            } else if (c.calculationType === "variable" || c.calculationType === "manual_entry") {
              amount = Number(empInput[code] || empInput[c.name] || c.value || 0);
            } else if (c.calculationType === "formula" && c.formulaExpression) {
              try {
                // Safe formula evaluation for expressions like "BASIC * 0.40" or "(BASIC / 160) * 1.5 * 10"
                const otHours = Number(empInput.overtimeHours || 0);
                const expr = c.formulaExpression
                  .replace(/BASIC/g, String(baseSalary))
                  .replace(/GROSS/g, String(calculatedGross))
                  .replace(/OT_HOURS/g, String(otHours));
                amount = Math.round(eval(expr) || 0);
              } catch (e) {
                amount = Number(c.value || 0);
              }
            } else {
              amount = Number(c.value || 0);
            }

            if (amount > 0 || code === "BASIC") {
              earnings.push({
                code,
                name: c.name || code,
                amount,
                type: "earning",
              });
              compValues[code] = amount;
              calculatedGross += amount;
            }
          }
        }
      } else {
        earnings.push({ code: "BASIC", name: "Basic Salary", amount: baseSalary, type: "earning" });
        compValues["BASIC"] = baseSalary;
        calculatedGross += baseSalary;
      }

      // 2. Custom Employee Specific Allowances
      (emp.customSalaryAllowances || []).forEach((ca) => {
        const val = ca.isPercentage ? Math.round(baseSalary * (ca.amount / 100)) : Number(ca.amount || 0);
        if (val > 0) {
          earnings.push({ code: ca.name.toUpperCase().replace(/\s+/g, "_"), name: ca.name, amount: val, type: "earning" });
          calculatedGross += val;
        }
      });

      // 3. Variable Bonus & Commission & Overtime (If not already in structure)
      const bonus = Number(empInput.bonus || 0);
      const commission = Number(empInput.commission || 0);
      const overtimeHours = Number(empInput.overtimeHours || 0);
      const hourlyRate = baseSalary / 160;
      const overtimePay = Math.round(overtimeHours * hourlyRate * (config.overtime?.rateMultiplier || 1.5));

      if (bonus > 0 && !earnings.some((e) => e.code === "BONUS")) {
        earnings.push({ code: "BONUS", name: "Performance Bonus", amount: bonus, type: "earning" });
        calculatedGross += bonus;
      }
      if (commission > 0 && !earnings.some((e) => e.code === "COMM")) {
        earnings.push({ code: "COMM", name: "Sales Commission", amount: commission, type: "earning" });
        calculatedGross += commission;
      }
      if (overtimePay > 0 && !earnings.some((e) => e.code === "OT")) {
        earnings.push({ code: "OT", name: `Overtime (${overtimeHours} hrs)`, amount: overtimePay, type: "earning" });
        calculatedGross += overtimePay;
      }

      compValues["GROSS"] = calculatedGross;

      // Calculate Deductions
      const deductions = [];
      let calculatedDeductions = 0;

      // 1. Unpaid Leave & Loss of Pay Deductions
      const dailyRate = baseSalary / totalMonthDays;
      const unpaidLeaveDeduction = Math.round(dailyRate * unpaidDays);
      if (unpaidLeaveDeduction > 0) {
        deductions.push({
          code: "UNPAID_LEAVE",
          name: `Approved Unpaid Leave (${unpaidDays}d)`,
          amount: unpaidLeaveDeduction,
          type: "deduction",
        });
        calculatedDeductions += unpaidLeaveDeduction;
      }

      // Unapproved / Rejected Absence Deduction (Loss of Pay)
      const unapprovedPenalty = Number(config.attendanceIntegration?.unapprovedLeavePenaltyMultiplier || 1.0);
      const unapprovedLeaveDeduction = Math.round(dailyRate * unapprovedDays * unapprovedPenalty);
      if (unapprovedLeaveDeduction > 0) {
        deductions.push({
          code: "UNAPPROVED_ABSENCE",
          name: `Loss of Pay (Unapproved Absence - ${unapprovedDays}d)`,
          amount: unapprovedLeaveDeduction,
          type: "deduction",
        });
        calculatedDeductions += unapprovedLeaveDeduction;
      }

      // 2. Struct Deductions
      if (struct && struct.components) {
        for (const c of struct.components) {
          if (c.type === "deduction") {
            let amount = 0;
            const code = c.code || "DEDUCT";

            if (c.calculationType === "fixed_amount") {
              amount = Number(c.value || 0);
            } else if (c.calculationType === "percentage") {
              const base = c.calculationBase === "gross_salary" ? calculatedGross : (compValues[c.baseComponentCode] || baseSalary);
              amount = Math.round(base * ((c.value || 0) / 100));
            } else if (c.calculationType === "formula" && c.formulaExpression) {
              try {
                const expr = c.formulaExpression
                  .replace(/BASIC/g, String(baseSalary))
                  .replace(/GROSS/g, String(calculatedGross));
                amount = Math.round(eval(expr) || 0);
              } catch (e) {
                amount = Number(c.value || 0);
              }
            } else {
              amount = Number(c.value || 0);
            }

            if (amount > 0) {
              deductions.push({
                code,
                name: c.name || code,
                amount,
                type: "deduction",
              });
              calculatedDeductions += amount;
            }
          }
        }
      }

      // 3. Custom Employee Specific Deductions
      (emp.customSalaryDeductions || []).forEach((cd) => {
        const val = cd.isPercentage ? Math.round(calculatedGross * (cd.amount / 100)) : Number(cd.amount || 0);
        if (val > 0) {
          deductions.push({ code: cd.name.toUpperCase().replace(/\s+/g, "_"), name: cd.name, amount: val, type: "deduction" });
          calculatedDeductions += val;
        }
      });

      // 4. Active Loans & Advances
      const activeLoan = await LoanAdvanceModel.findOne({ employeeId: emp._id, status: "active" });
      let loanDeduction = 0;
      if (activeLoan && activeLoan.monthlyInstallment > 0) {
        loanDeduction = Math.min(activeLoan.monthlyInstallment, activeLoan.remainingBalance);
        deductions.push({
          code: "LOAN",
          name: `Loan: ${activeLoan.title}`,
          amount: loanDeduction,
          type: "deduction",
        });
        calculatedDeductions += loanDeduction;
      }

      // Employer Contributions
      const employerContributions = [];
      let totalEmpContrib = 0;
      if (struct && struct.components) {
        for (const c of struct.components) {
          if (c.type === "employer_contribution") {
            const base = c.calculationBase === "gross_salary" ? calculatedGross : baseSalary;
            const val = c.calculationType === "percentage" ? Math.round(base * ((c.value || 0) / 100)) : Number(c.value || 0);
            if (val > 0) {
              employerContributions.push({ code: c.code, name: c.name, amount: val });
              totalEmpContrib += val;
            }
          }
        }
      }

      // Net Pay Calculation
      const netPay = calculatedGross - calculatedDeductions;
      if (netPay < 0) {
        exceptions.push({
          employeeId: emp._id,
          employeeName: emp.username,
          type: "negative_net",
          message: `${emp.username} has negative net pay (₹${netPay}). Review deductions.`,
          severity: "danger",
        });
      }

      totalGross += calculatedGross;
      totalDeductions += calculatedDeductions;
      totalEmployerContributions += totalEmpContrib;
      totalNetPay += Math.max(0, netPay);

      employeeRecords.push({
        userId: emp._id,
        employeeIdCode: emp.employeeId || `EMP-${emp._id.toString().slice(-4)}`,
        username: emp.username,
        email: emp.email,
        designation: emp.designation || "Staff Member",
        role: emp.role,
        salaryStructureId: struct?._id || null,
        salaryStructureName: struct?.name || "Unassigned (No Payroll Attached)",
        baseSalary,
        earnings,
        deductions,
        employerContributions,
        workingDays: totalMonthDays,
        presentDays: Math.max(0, totalMonthDays - (unpaidDays + unapprovedDays)),
        unpaidLeaveDays: unpaidDays + unapprovedDays,
        unpaidLeaveDeductionAmount: unpaidLeaveDeduction + unapprovedLeaveDeduction,
        overtimeHours,
        overtimePay,
        bonusAmount: bonus,
        commissionAmount: commission,
        loanDeductionAmount: loanDeduction,
        grossPay: calculatedGross,
        totalDeductions: calculatedDeductions,
        netPay: Math.max(0, netPay),
        bankDetails: emp.bankDetails || {},
        paymentStatus: "pending",
      });
    }

    // Upsert or Create Payroll Run
    let payrollRun = await PayrollRunModel.findOne({ month: Number(month), year: Number(year) });
    if (!payrollRun) {
      payrollRun = new PayrollRunModel({
        month: Number(month),
        year: Number(year),
        payrollPeriodLabel: periodLabel,
        cycleStartDate: cycleStart,
        cycleEndDate: cycleEnd,
        currency: config.currency || "INR",
        status: "calculated",
      });
    } else {
      if (payrollRun.status === "locked" || payrollRun.status === "paid") {
        return res.status(400).json({ message: `Payroll for ${periodLabel} is locked/paid and cannot be recalculated.` });
      }
      payrollRun.status = "calculated";
    }

    payrollRun.summary = {
      totalGross,
      totalDeductions,
      totalEmployerContributions,
      totalNetPay,
      employeeCount: employeeRecords.length,
    };
    payrollRun.exceptions = exceptions;
    payrollRun.employeeRecords = employeeRecords;
    payrollRun.calculatedAt = new Date();
    payrollRun.calculatedBy = req.user.id;

    await payrollRun.save();
    await createAuditLog("PAYROLL_CALCULATED", "payroll_run", payrollRun._id, periodLabel, req.user, null, payrollRun.summary, `Calculated payroll for ${periodLabel} with ${employeeRecords.length} employees`);

    res.json({ message: `Payroll for ${periodLabel} calculated successfully!`, payrollRun });
  } catch (err) {
    console.error("Calculate payroll error:", err);
    res.status(500).json({ message: "Failed to calculate payroll" });
  }
});

// Update Lifecycle Stage (Approve, Lock, Disburse)
router.put("/runs/:id/stage", verifyToken, async (req, res) => {
  const { action } = req.body; // "approve" | "lock" | "disburse"
  try {
    const run = await PayrollRunModel.findById(req.params.id);
    if (!run) return res.status(404).json({ message: "Payroll run not found" });

    if (action === "approve") {
      run.status = "approved";
      run.approvedAt = new Date();
      run.approvedBy = req.user.id;
    } else if (action === "lock") {
      run.status = "locked";
      run.lockedAt = new Date();
      run.lockedBy = req.user.id;
    } else if (action === "disburse") {
      run.status = "paid";
      run.paidAt = new Date();
      run.employeeRecords.forEach((r) => {
        r.paymentStatus = "paid";
        r.paymentDate = new Date();
      });
    }

    await run.save();
    await createAuditLog(`PAYROLL_${action.toUpperCase()}`, "payroll_run", run._id, run.payrollPeriodLabel, req.user, null, null, `Payroll ${run.payrollPeriodLabel} transitioned to ${run.status}`);
    res.json({ message: `Payroll status updated to ${run.status}`, run });
  } catch (err) {
    res.status(500).json({ message: "Failed to update payroll stage" });
  }
});

// Edit / Adjust Specific Employee Line Items in a Payroll Run
router.put("/runs/:id/adjust-employee", verifyToken, async (req, res) => {
  const { userId, baseSalary, monthlyAdjustments, overtimeHours, bonusAmount, commissionAmount, notes } = req.body;
  try {
    const run = await PayrollRunModel.findById(req.params.id);
    if (!run) return res.status(404).json({ message: "Payroll run not found" });

    if (run.status === "locked" || run.status === "paid") {
      return res.status(400).json({ message: "Cannot edit adjustments on a locked or disbursed payroll." });
    }

    const recIdx = run.employeeRecords.findIndex((r) => String(r.userId) === String(userId));
    if (recIdx === -1) return res.status(404).json({ message: "Employee record not found in this run" });

    const rec = run.employeeRecords[recIdx];

    // Update basic fields if provided
    if (baseSalary !== undefined) rec.baseSalary = Number(baseSalary);
    if (overtimeHours !== undefined) rec.overtimeHours = Number(overtimeHours);
    if (bonusAmount !== undefined) rec.bonusAmount = Number(bonusAmount);
    if (commissionAmount !== undefined) rec.commissionAmount = Number(commissionAmount);
    if (notes !== undefined) rec.notes = notes;

    // Set Monthly Adjustments
    if (Array.isArray(monthlyAdjustments)) {
      rec.monthlyAdjustments = monthlyAdjustments;
    }

    // Recompute Employee Earnings & Deductions
    let newGross = rec.baseSalary || 0;
    const updatedEarnings = [{ code: "BASIC", name: "Basic Salary", amount: rec.baseSalary, type: "earning" }];

    // Re-evaluate structure earnings
    const struct = await SalaryStructureModel.findById(rec.salaryStructureId);
    if (struct && struct.components) {
      struct.components.forEach((c) => {
        if (c.type === "earning" && c.code !== "BASIC") {
          let amt = 0;
          if (c.calculationType === "percentage") {
            amt = Math.round(rec.baseSalary * ((Number(c.value) || 0) / 100));
          } else if (c.calculationType === "fixed_amount") {
            amt = Number(c.value || 0);
          }
          if (amt > 0) {
            updatedEarnings.push({ code: c.code, name: c.name, amount: amt, type: "earning" });
            newGross += amt;
          }
        }
      });
    }

    if (rec.bonusAmount > 0) {
      updatedEarnings.push({ code: "BONUS", name: "Monthly Performance Bonus", amount: rec.bonusAmount, type: "earning" });
      newGross += rec.bonusAmount;
    }
    if (rec.commissionAmount > 0) {
      updatedEarnings.push({ code: "COMM", name: "Sales Commission", amount: rec.commissionAmount, type: "earning" });
      newGross += rec.commissionAmount;
    }

    // Add monthly adjustments (earnings)
    (rec.monthlyAdjustments || []).forEach((adj) => {
      if (adj.type === "earning" && Number(adj.amount) > 0) {
        updatedEarnings.push({ code: "ADJ_EARN", name: adj.title || "Manual Allowance Adjustment", amount: Number(adj.amount), type: "earning" });
        newGross += Number(adj.amount);
      }
    });

    rec.earnings = updatedEarnings;
    rec.grossPay = newGross;

    // Deductions
    let newDeductions = 0;
    const updatedDeductions = [];

    if (rec.unpaidLeaveDeductionAmount > 0) {
      updatedDeductions.push({ code: "UNPAID_LEAVE", name: `Unpaid Leave (${rec.unpaidLeaveDays}d)`, amount: rec.unpaidLeaveDeductionAmount, type: "deduction" });
      newDeductions += rec.unpaidLeaveDeductionAmount;
    }

    if (struct && struct.components) {
      struct.components.forEach((c) => {
        if (c.type === "deduction") {
          let amt = 0;
          if (c.calculationType === "percentage") {
            const b = c.calculationBase === "gross_salary" ? newGross : rec.baseSalary;
            amt = Math.round(b * ((Number(c.value) || 0) / 100));
          } else if (c.calculationType === "fixed_amount") {
            amt = Number(c.value || 0);
          }
          if (amt > 0) {
            updatedDeductions.push({ code: c.code, name: c.name, amount: amt, type: "deduction" });
            newDeductions += amt;
          }
        }
      });
    }

    // Add monthly adjustments (deductions)
    (rec.monthlyAdjustments || []).forEach((adj) => {
      if (adj.type === "deduction" && Number(adj.amount) > 0) {
        updatedDeductions.push({ code: "ADJ_DEDUCT", name: adj.title || "Manual Salary Deduction", amount: Number(adj.amount), type: "deduction" });
        newDeductions += Number(adj.amount);
      }
    });

    rec.deductions = updatedDeductions;
    rec.totalDeductions = newDeductions;
    rec.netPay = Math.max(0, newGross - newDeductions);

    // Update overall summary
    run.summary.totalGross = run.employeeRecords.reduce((sum, r) => sum + (r.grossPay || 0), 0);
    run.summary.totalDeductions = run.employeeRecords.reduce((sum, r) => sum + (r.totalDeductions || 0), 0);
    run.summary.totalNetPay = run.employeeRecords.reduce((sum, r) => sum + (r.netPay || 0), 0);

    await run.save();
    await createAuditLog("PAYROLL_ADJUSTMENT", "payroll_run", run._id, `${rec.username} (${run.payrollPeriodLabel})`, req.user, null, rec, `Adjusted payroll line items for ${rec.username}: Net Pay ₹${rec.netPay}`);

    res.json({ message: `Adjusted salary statement for ${rec.username} successfully!`, updatedRecord: rec, run });
  } catch (err) {
    console.error("Adjust employee error:", err);
    res.status(500).json({ message: "Failed to adjust employee salary" });
  }
});

// Selective Payslip Dispatching (Send to All / Specific Team / Individual with Exclusions)
router.post("/runs/:id/dispatch-slips", verifyToken, async (req, res) => {
  const { mode, targetTeamId, targetEmployeeIds, excludedEmployeeIds = [], forceResend = false } = req.body;
  // mode: "all" | "team" | "individual"
  try {
    const run = await PayrollRunModel.findById(req.params.id);
    if (!run) return res.status(404).json({ message: "Payroll run not found" });

    let sentCount = 0;
    let skippedCount = 0;
    let alreadySentCount = 0;

    const excludedSet = new Set((excludedEmployeeIds || []).map((id) => String(id)));
    const targetSet = new Set((targetEmployeeIds || []).map((id) => String(id)));

    run.employeeRecords.forEach((rec) => {
      const empIdStr = String(rec.userId);

      // Check if excluded
      if (excludedSet.has(empIdStr)) {
        skippedCount++;
        return;
      }

      let isEligible = false;
      if (mode === "all") {
        isEligible = true;
      } else if (mode === "individual") {
        isEligible = targetSet.has(empIdStr);
      } else if (mode === "team" && targetTeamId) {
        isEligible = String(rec.teamId) === String(targetTeamId) || rec.role === targetTeamId;
      }

      if (isEligible) {
        if (rec.isSent && !forceResend) {
          alreadySentCount++;
        } else {
          rec.isSent = true;
          rec.sentAt = new Date();
          rec.sentBy = req.user.id;
          sentCount++;
        }
      } else {
        skippedCount++;
      }
    });

    await run.save();
    await createAuditLog(
      "PAYSLIPS_DISPATCHED",
      "payroll_run",
      run._id,
      run.payrollPeriodLabel,
      req.user,
      null,
      { sentCount, skippedCount, alreadySentCount, mode },
      `Dispatched ${sentCount} payslips for ${run.payrollPeriodLabel} (Mode: ${mode})`
    );

    res.json({
      message: `Successfully dispatched ${sentCount} salary slips to employees!`,
      sentCount,
      skippedCount,
      alreadySentCount,
      run,
    });
  } catch (err) {
    console.error("Dispatch slips error:", err);
    res.status(500).json({ message: "Failed to dispatch payslips" });
  }
});

// Export Payroll Run to Excel (.CSV)
router.get("/runs/:id/export-csv", verifyToken, async (req, res) => {
  try {
    const run = await PayrollRunModel.findById(req.params.id);
    if (!run) return res.status(404).json({ message: "Payroll run not found" });

    // Build CSV Headers
    const headers = [
      "Employee ID",
      "Full Name",
      "Email",
      "Designation",
      "Role",
      "Salary Structure",
      "Base Salary (INR)",
      "Gross Earnings (INR)",
      "Total Deductions (INR)",
      "Net Take-Home Pay (INR)",
      "Unpaid Leave Days",
      "Unpaid Leave Deduction",
      "Overtime Hours",
      "Overtime Pay",
      "Performance Bonus",
      "Sales Commission",
      "Bank Name",
      "Account Number",
      "IFSC Code",
      "Payment Status",
      "Payslip Dispatched",
      "Dispatched At",
    ];

    const rows = (run.employeeRecords || []).map((rec) => [
      `"${rec.employeeIdCode || ""}"`,
      `"${rec.username || ""}"`,
      `"${rec.email || ""}"`,
      `"${rec.designation || ""}"`,
      `"${rec.role || ""}"`,
      `"${rec.salaryStructureName || ""}"`,
      rec.baseSalary || 0,
      rec.grossPay || 0,
      rec.totalDeductions || 0,
      rec.netPay || 0,
      rec.unpaidLeaveDays || 0,
      rec.unpaidLeaveDeductionAmount || 0,
      rec.overtimeHours || 0,
      rec.overtimePay || 0,
      rec.bonusAmount || 0,
      rec.commissionAmount || 0,
      `"${rec.bankDetails?.bankName || ""}"`,
      `"${rec.bankDetails?.accountNumber || ""}"`,
      `"${rec.bankDetails?.ifscRouting || ""}"`,
      `"${(rec.paymentStatus || "pending").toUpperCase()}"`,
      rec.isSent ? "YES" : "NO",
      rec.sentAt ? `"${new Date(rec.sentAt).toLocaleString()}"` : '"—"',
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Payroll_${run.payrollPeriodLabel.replace(/\s+/g, "_")}.csv"`
    );
    res.send(csvContent);
  } catch (err) {
    console.error("Export CSV error:", err);
    res.status(500).json({ message: "Failed to export payroll to CSV" });
  }
});

// ============================================================================
// 6. PAYSLIP DESIGNER & RENDERING
// ============================================================================
router.get("/payslip-templates", verifyToken, async (req, res) => {
  try {
    const templates = await PayslipTemplateModel.find().sort({ isDefault: -1, name: 1 });
    res.json(templates);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch payslip templates" });
  }
});

router.post("/payslip-templates", verifyToken, async (req, res) => {
  try {
    const template = await PayslipTemplateModel.create(req.body);
    res.status(201).json(template);
  } catch (err) {
    res.status(400).json({ message: "Failed to create payslip template" });
  }
});

router.put("/payslip-templates/:id", verifyToken, async (req, res) => {
  try {
    const updated = await PayslipTemplateModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: "Failed to update payslip template" });
  }
});

// Get Rendered Payslip for an Employee (Only Sent slips for employees, All for HR/Admin)
router.get("/payslips/employee/:employeeId", verifyToken, async (req, res) => {
  try {
    const isHrOrAdmin = req.user.role === "hr" || req.user.role === "admin";
    const isOwnProfile = String(req.user.id) === String(req.params.employeeId);

    const query = {
      "employeeRecords.userId": req.params.employeeId,
    };

    if (!isHrOrAdmin) {
      query.status = { $in: ["approved", "locked", "paid"] };
    }

    const runs = await PayrollRunModel.find(query).sort({ year: -1, month: -1 });

    const payslips = [];
    runs.forEach((r) => {
      const rec = r.employeeRecords.find((e) => String(e.userId) === String(req.params.employeeId));
      if (rec) {
        // If employee viewing their own portal, only show if HR dispatched it (isSent === true)
        if (isHrOrAdmin || rec.isSent) {
          payslips.push({
            runId: r._id,
            month: r.month,
            year: r.year,
            periodLabel: r.payrollPeriodLabel,
            currency: r.currency,
            status: r.status,
            isSent: rec.isSent,
            sentAt: rec.sentAt,
            record: rec,
          });
        }
      }
    });

    res.json(payslips);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch employee payslips" });
  }
});

// ============================================================================
// 7. EMPLOYEE DOCUMENTS REPOSITORY
// ============================================================================
router.get("/documents/employee/:employeeId", verifyToken, async (req, res) => {
  try {
    const docs = await EmployeeDocumentModel.find({ employeeId: req.params.employeeId }).sort({ createdAt: -1 });
    res.json(docs);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch employee documents" });
  }
});

router.post("/documents/employee/:employeeId", verifyToken, upload.single("file"), async (req, res) => {
  const { title, category, expiryDate, notes, accessPermissions, fileUrl } = req.body;
  try {
    let finalUrl = fileUrl || "";
    let fileType = "application/pdf";
    let fileSize = "1 MB";

    if (req.file) {
      finalUrl = `/uploads/documents/${req.file.filename}`;
      fileType = req.file.mimetype;
      fileSize = `${(req.file.size / (1024 * 1024)).toFixed(2)} MB`;
    }

    if (!finalUrl) {
      return res.status(400).json({ message: "File is required." });
    }

    const doc = await EmployeeDocumentModel.create({
      employeeId: req.params.employeeId,
      title: title || req.file?.originalname || "Employee Document",
      category: category || "other",
      fileUrl: finalUrl,
      fileType,
      fileSize,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      notes: notes || "",
      accessPermissions: accessPermissions || "employee_and_hr",
      uploadedBy: req.user.id,
    });

    res.status(201).json(doc);
  } catch (err) {
    console.error("Document upload error:", err);
    res.status(500).json({ message: "Failed to upload document" });
  }
});

router.delete("/documents/:id", verifyToken, async (req, res) => {
  try {
    await EmployeeDocumentModel.findByIdAndDelete(req.params.id);
    res.json({ message: "Document deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete document" });
  }
});

// ============================================================================
// 8. REIMBURSEMENTS & LOANS
// ============================================================================
router.get("/reimbursements", verifyToken, async (req, res) => {
  try {
    const claims = await ReimbursementModel.find().populate("employeeId", "username email employeeId designation").sort({ createdAt: -1 });
    res.json(claims);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch reimbursements" });
  }
});

router.post("/reimbursements", verifyToken, async (req, res) => {
  try {
    const claim = await ReimbursementModel.create({
      ...req.body,
      employeeId: req.user.id,
      status: "pending",
    });
    res.status(201).json(claim);
  } catch (err) {
    res.status(400).json({ message: "Failed to submit reimbursement claim" });
  }
});

router.put("/reimbursements/:id/status", verifyToken, async (req, res) => {
  const { status, approvedAmount, rejectionReason } = req.body;
  try {
    const claim = await ReimbursementModel.findById(req.params.id);
    if (!claim) return res.status(404).json({ message: "Claim not found" });

    claim.status = status;
    claim.approvedBy = req.user.id;
    if (approvedAmount !== undefined) claim.approvedAmount = Number(approvedAmount);
    if (rejectionReason) claim.rejectionReason = rejectionReason;

    await claim.save();
    res.json(claim);
  } catch (err) {
    res.status(400).json({ message: "Failed to update claim status" });
  }
});

// Loans & Advances
router.get("/loans", verifyToken, async (req, res) => {
  try {
    const loans = await LoanAdvanceModel.find().populate("employeeId", "username email employeeId designation").sort({ createdAt: -1 });
    res.json(loans);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch loans" });
  }
});

router.post("/loans", verifyToken, async (req, res) => {
  try {
    const { employeeId, title, totalAmount, monthlyInstallment, totalInstallments, reason } = req.body;
    const loan = await LoanAdvanceModel.create({
      employeeId,
      title,
      totalAmount: Number(totalAmount),
      monthlyInstallment: Number(monthlyInstallment),
      remainingBalance: Number(totalAmount),
      totalInstallments: Number(totalInstallments),
      reason,
      approvedBy: req.user.id,
      status: "active",
    });
    res.status(201).json(loan);
  } catch (err) {
    res.status(400).json({ message: "Failed to create loan advance" });
  }
});

// ============================================================================
// 9. AUDIT LOGS
// ============================================================================
router.get("/audit-logs", verifyToken, async (req, res) => {
  try {
    const logs = await PayrollAuditLogModel.find().sort({ timestamp: -1 }).limit(100);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch audit logs" });
  }
});

export default router;
