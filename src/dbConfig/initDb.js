import bcrypt from "bcrypt";
import { User } from "../model/userModel.js";
import { PlantUnit } from "../model/plantUnitModel.js";
import { Grade } from "../model/gradeModel.js";

export const initDb = async () => {
  try {
    // 1. Seed default admin user if none exists
    let admin = await User.findOne({ email: "admin@chandansteel.com" });
    if (!admin) {
      const hashedPassword = await bcrypt.hash("Admin@123", 10);
      admin = await User.create({
        name: "System Administrator",
        email: "admin@chandansteel.com",
        password_hash: hashedPassword,
        role: "ADMIN",
        department: "Management",
        is_active: true
      });
      console.log("Seeded default admin user: admin@chandansteel.com / Admin@123");
    }

    // 2. Seed default master Plant Units / Mills if none exist
    const plantCount = await PlantUnit.countDocuments();
    if (plantCount === 0) {
      await PlantUnit.insertMany([
        { code: "RM16", name: "Rolling Mill 16", unit_type: "ROLLING_MILL", description: "Primary rebar and profile rolling line" },
        { code: "RM10", name: "New Plant Rolling Mill 10", unit_type: "ROLLING_MILL", description: "High-speed continuous rolling mill unit 10" },
        { code: "RM20", name: "New Plant Rolling Mill 20", unit_type: "ROLLING_MILL", description: "Heavy bar and section rolling mill unit 20" },
        { code: "BB", name: "Bright Bar", unit_type: "BRIGHT_BAR", description: "Cold finished and peeled bright bar processing line" },
        { code: "WRM", name: "Wire Rod Mill", unit_type: "WIRE_ROD", description: "Precision continuous wire rod in coil rolling mill" },
        { code: "Forging", name: "Forging Plant", unit_type: "FORGING", description: "Open and closed die forging division" },
        { code: "SMS", name: "Steel Melting Shop / CCM", unit_type: "SMS", description: "Continuous casting machine casting yard" },
        { code: "YARD", name: "Billet Yard Stock", unit_type: "YARD", description: "Central billet storage and stock reconciliation yard" }
      ]);
      console.log("Seeded default master Plant Units (RM16, RM10, RM20, BB, WRM, Forging, SMS, YARD).");
    }

    // 3. Seed default master Steel Grades if none exist
    const gradeCount = await Grade.countDocuments();
    if (gradeCount === 0) {
      await Grade.insertMany([
        { code: "AISI 304", name: "Austenitic Stainless Steel 304", standard: "ASTM A276", description: "General purpose 18/8 austenitic stainless steel" },
        { code: "AISI 316L", name: "Austenitic Stainless Steel 316L (Low Carbon)", standard: "ASTM A276", description: "Molybdenum-bearing marine grade corrosion resistant steel" },
        { code: "AISI 201", name: "Austenitic Cr-Mn-Ni Stainless Steel 201", standard: "ASTM A276", description: "High-strength nitrogen/manganese austenitic stainless steel" },
        { code: "AISI 410", name: "Martensitic Stainless Steel 410", standard: "ASTM A276", description: "12% chromium heat-treatable martensitic stainless steel" },
        { code: "EN8", name: "080M40 Medium Carbon Steel", standard: "BS 970", description: "Unalloyed medium carbon engineering steel" },
        { code: "AISI 304L", name: "Austenitic Stainless Steel 304L", standard: "ASTM A276", description: "Extra low carbon 304 for enhanced weldability" }
      ]);
      console.log("Seeded default master Steel Grades (AISI 304, AISI 316L, AISI 201, AISI 410, EN8, AISI 304L).");
    }

    console.log("MongoDB master tables initialized successfully.");
  } catch (error) {
    console.error("Database initialization failed:", error);
    throw error;
  }
};

export default initDb;
