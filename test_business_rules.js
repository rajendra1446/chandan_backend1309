// import { connectDB } from "./src/dbConfig/db.js";
// import { initDb } from "./src/dbConfig/initDb.js";
// import app from "./src/app.js";

// const runRuleTests = async () => {
//   console.log("======================================================================");
//   console.log("   CHANDAN STEEL BILLET TRACEABILITY - BUSINESS RULES VERIFICATION   ");
//   console.log("======================================================================");

//   let server;
//   const PORT = 5002;

//   try {
//     // 1. Connect MongoDB
//     console.log("\n[1/8] Connecting to MongoDB Database...");
//     const conn = await connectDB();
//     console.log(`✓ Connected to: ${conn.connection.host}/${conn.connection.name}`);

//     // 2. Initialize schema & seed master data
//     console.log("\n[2/8] Initializing master tables (Admin, Plants, Grades)...");
//     await initDb();
//     console.log("✓ Database initialized successfully.");

//     // 3. Start local express test server
//     await new Promise((resolve) => {
//       server = app.listen(PORT, () => {
//         console.log(`✓ Test server running at http://localhost:${PORT}`);
//         resolve();
//       });
//     });

//     const baseUrl = `http://localhost:${PORT}`;

//     const request = async (path, options = {}) => {
//       const url = `${baseUrl}${path}`;
//       const res = await fetch(url, {
//         headers: {
//           "Content-Type": "application/json",
//           ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
//         },
//         ...options
//       });
//       const data = await res.json();
//       return { status: res.status, data };
//     };

//     // 4. Admin Authentication Login
//     console.log("\n[3/8] Authenticating Admin user...");
//     const loginRes = await request("/api/auth/login", {
//       method: "POST",
//       body: JSON.stringify({
//         email: "admin@chandansteel.com",
//         password: "Admin@123"
//       })
//     });

//     if (loginRes.status !== 200 || !loginRes.data.success) {
//       throw new Error(`Login failed: ${JSON.stringify(loginRes)}`);
//     }
//     const token = loginRes.data.data.token;
//     console.log("✓ Admin authenticated successfully.");

//     // Rule 4: Dynamic Master Data (/api/plants and /api/grades)
//     console.log("\n[4/8] Testing Rule 4: Dynamic Master Data APIs (/api/plants & /api/grades)...");
//     const plantsRes = await request("/api/plants", { token });
//     if (plantsRes.status !== 200 || !plantsRes.data.data || plantsRes.data.data.length === 0) {
//       throw new Error(`Plants API failed: ${JSON.stringify(plantsRes)}`);
//     }
//     console.log(`✓ /api/plants returned ${plantsRes.data.data.length} registered units from database.`);

//     const gradesRes = await request("/api/grades", { token });
//     if (gradesRes.status !== 200 || !gradesRes.data.data || gradesRes.data.data.length === 0) {
//       throw new Error(`Grades API failed: ${JSON.stringify(gradesRes)}`);
//     }
//     console.log(`✓ /api/grades returned ${gradesRes.data.data.length} registered steel grades from database.`);

//     // Rule 5: Manual Billet Weight Input during Casting
//     console.log("\n[5/8] Testing Rule 5: Manual Cast Billet Weight Inputs & Persistence...");
//     const testHeatNo = `HEAT-TEST-${Date.now().toString().slice(-4)}`;
//     const manualWeightPerPiece = 850.25; // user manual input
//     const manualTotalWeight = 8.503;     // 10 pcs * 850.25 kg
//     const castRes = await request("/api/billets/heats", {
//       method: "POST",
//       token,
//       body: JSON.stringify({
//         heat_number: testHeatNo,
//         grade: "AISI 304",
//         section: "120x120 mm",
//         remarks: "Casting with verified weighbridge weights",
//         lengths: [
//           {
//             length_meters: 7.4,
//             piece_count: 10,
//             weight_per_piece_kg: manualWeightPerPiece,
//             total_weight_mt: manualTotalWeight
//           }
//         ]
//       })
//     });

//     if (castRes.status !== 201 || !castRes.data.success) {
//       throw new Error(`Cast heat failed: ${JSON.stringify(castRes)}`);
//     }
//     const castHeat = castRes.data.data;
//     if (castHeat.total_weight_mt !== manualTotalWeight) {
//       throw new Error(`Manual weight mismatch: expected ${manualTotalWeight}, got ${castHeat.total_weight_mt}`);
//     }
//     console.log(`✓ Heat '${testHeatNo}' saved with user's exact manual weight: ${castHeat.total_weight_mt} MT (${castHeat.total_pieces} pcs).`);

//     // Approve Lab check for this heat
//     const labRes = await request("/api/lab/check", {
//       method: "POST",
//       token,
//       body: JSON.stringify({
//         heat_id: castHeat.id,
//         test_certificate_no: `TC-${testHeatNo}`,
//         c_percent: 0.065,
//         mn_percent: 1.82,
//         cr_percent: 18.25,
//         ni_percent: 8.15,
//         verdict: "APPROVED",
//         lab_remarks: "Certified test compliant"
//       })
//     });
//     if (labRes.status !== 200 || !labRes.data.success) {
//       throw new Error(`Lab check failed: ${JSON.stringify(labRes)}`);
//     }

//     // Rule 1: Material Validation - Dispatch cannot exceed available material
//     console.log("\n[6/8] Testing Rule 1: Material Validation (Dispatched quantity cannot exceed available stock)...");
//     const invalidDispatchRes = await request("/api/dispatches", {
//       method: "POST",
//       token,
//       body: JSON.stringify({
//         heat_number: testHeatNo,
//         target_plant: "RM16",
//         dispatched_pieces: 15, // Only 10 available!
//         dispatched_weight_mt: 12.0
//       })
//     });

//     if (invalidDispatchRes.status !== 400 && invalidDispatchRes.status !== 500) {
//       throw new Error(`Material validation failed to reject excess pieces! Response: ${JSON.stringify(invalidDispatchRes)}`);
//     }
//     console.log(`✓ Excess dispatch rejected properly: "${invalidDispatchRes.data.message}"`);

//     // Valid Dispatch: send 6 pcs (5.101 MT) to RM16
//     const validDispatchRes = await request("/api/dispatches", {
//       method: "POST",
//       token,
//       body: JSON.stringify({
//         heat_number: testHeatNo,
//         target_plant: "RM16",
//         dispatched_pieces: 6,
//         dispatched_weight_mt: 5.101,
//         lengths_breakdown: [
//           { length_meters: 7.4, pieces: 6, weight_mt: 5.101 }
//         ]
//       })
//     });

//     if (validDispatchRes.status !== 201 || !validDispatchRes.data.success) {
//       throw new Error(`Valid dispatch failed: ${JSON.stringify(validDispatchRes)}`);
//     }
//     const dispatchDoc = validDispatchRes.data.data;
//     console.log(`✓ Valid dispatch created: #${dispatchDoc.dispatch_number} (6 pcs / 5.101 MT to ${dispatchDoc.target_plant}).`);

//     // Rule 3: Production Validation - Output weight cannot exceed input weight (yield <= 100%)
//     console.log("\n[7/8] Testing Rule 3: Production Validation (Output cannot exceed input weight)...");
//     const invalidYieldRes = await request("/api/finished-products", {
//       method: "POST",
//       token,
//       body: JSON.stringify({
//         heat_number: testHeatNo,
//         dispatch_id: dispatchDoc.id,
//         finished_product_name: "SS 304 Rebar",
//         finished_size: "16 mm",
//         input_billet_weight_mt: 5.0,
//         finished_pieces: 10,
//         finished_weight_mt: 6.5, // 6.5 > 5.0 impossible yield!
//         mill_name: "RM16"
//       })
//     });

//     if (invalidYieldRes.status !== 400 && invalidYieldRes.status !== 500) {
//       throw new Error(`Production validation failed to reject excess finished weight! Response: ${JSON.stringify(invalidYieldRes)}`);
//     }
//     console.log(`✓ Physically impossible production yield rejected: "${invalidYieldRes.data.message}"`);

//     // Valid production
//     const validProdRes = await request("/api/finished-products", {
//       method: "POST",
//       token,
//       body: JSON.stringify({
//         heat_number: testHeatNo,
//         dispatch_id: dispatchDoc.id,
//         finished_product_name: "SS 304 Rebar",
//         finished_size: "16 mm",
//         input_billet_weight_mt: 4.5,
//         finished_pieces: 8,
//         finished_weight_mt: 4.25, // 94.44% yield
//         mill_name: "RM16"
//       })
//     });
//     if (validProdRes.status !== 201 || !validProdRes.data.success) {
//       throw new Error(`Valid production failed: ${JSON.stringify(validProdRes)}`);
//     }
//     const prodDoc = validProdRes.data.data;
//     console.log(`✓ Valid finished product recorded: #${prodDoc.production_batch_number} (Yield: ${prodDoc.yield_percentage}%).`);

//     // Rule 2: Rejection Validation - Rejection cannot exceed produced or dispatched quantity
//     console.log("\n[8/8] Testing Rule 2 & Rule 6: Rejection & Plant Return Validations...");
//     const invalidRejRes = await request("/api/rejections", {
//       method: "POST",
//       token,
//       body: JSON.stringify({
//         heat_number: testHeatNo,
//         production_id: prodDoc.id,
//         stage: "ROLLING_MILL",
//         rejection_type: "END_CROP_SCRAP",
//         rejected_pieces: 20, // Only 8 produced!
//         rejected_weight_mt: 10.0 // Excess weight!
//       })
//     });
//     if (invalidRejRes.status !== 400 && invalidRejRes.status !== 500) {
//       throw new Error(`Rejection validation failed to reject excess quantity! Response: ${JSON.stringify(invalidRejRes)}`);
//     }
//     console.log(`✓ Excess rejection rejected: "${invalidRejRes.data.message}"`);

//     // Rule 6: Plant Return Validation - Must return only from the plant to which it was dispatched (RM16, not WRM)
//     const invalidReturnRes = await request("/api/returns", {
//       method: "POST",
//       token,
//       body: JSON.stringify({
//         heat_number: testHeatNo,
//         returned_from: "WRM", // Dispatched to RM16, not WRM!
//         returned_to: "Billet Yard Stock",
//         return_type: "UNUSED_BILLET_RETURN",
//         returned_pieces: 1,
//         returned_weight_mt: 0.85,
//         return_reason: "Test return"
//       })
//     });
//     if (invalidReturnRes.status !== 400 && invalidReturnRes.status !== 500) {
//       throw new Error(`Plant return validation failed to reject wrong source plant! Response: ${JSON.stringify(invalidReturnRes)}`);
//     }
//     console.log(`✓ Return from incorrect source plant rejected: "${invalidReturnRes.data.message}"`);

//     // Valid Return from RM16
//     const validReturnRes = await request("/api/returns", {
//       method: "POST",
//       token,
//       body: JSON.stringify({
//         heat_number: testHeatNo,
//         dispatch_id: dispatchDoc.id,
//         returned_from: "RM16",
//         returned_to: "Billet Yard Stock",
//         return_type: "UNUSED_BILLET_RETURN",
//         returned_pieces: 1,
//         returned_weight_mt: 0.85,
//         return_reason: "Surplus piece returned to yard stock",
//         stock_restored: true
//       })
//     });
//     if (validReturnRes.status !== 201 || !validReturnRes.data.success) {
//       throw new Error(`Valid return failed: ${JSON.stringify(validReturnRes)}`);
//     }
//     const retDoc = validReturnRes.data.data;
//     console.log(`✓ Valid plant return processed: #${retDoc.return_voucher_no} (${retDoc.returned_pieces} pcs / ${retDoc.returned_weight_mt} MT restored from ${retDoc.returned_from}).`);

//     console.log("\n======================================================================");
//     console.log("   ALL BUSINESS RULES & MATERIAL VALIDATIONS VERIFIED SUCCESSFULLY!   ");
//     console.log("======================================================================");

//   } catch (err) {
//     console.error("\n❌ VERIFICATION TEST FAILED:", err);
//     process.exitCode = 1;
//   } finally {
//     if (server) {
//       server.close();
//     }
//     process.exit(process.exitCode || 0);
//   }
// };

// runRuleTests();
