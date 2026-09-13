// import { connectDB } from "./src/dbConfig/db.js";
// import { initDb } from "./src/dbConfig/initDb.js";
// import app from "./src/app.js";

// const runTests = async () => {
//   console.log("===============================================================");
//   console.log("   CHANDAN STEEL BILLET END-TO-END TRACEABILITY TEST (MONGODB) ");
//   console.log("===============================================================");

//   let server;
//   const PORT = 5001;

//   try {
//     // 1. Connect MongoDB
//     console.log("\n[1/7] Connecting to MongoDB Database...");
//     const conn = await connectDB();
//     console.log(`✓ Connected to: ${conn.connection.host}/${conn.connection.name}`);

//     // 2. Initialize schema & seed
//     console.log("\n[2/7] Initializing collections & seeding default admin / demo heat...");
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
//     console.log("\n[3/7] Logging in as Admin...");
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

//     // 5. Cast new Heat with multiple lengths: 7.4m, 5.0m, 5.4m
//     console.log("\n[4/7] Casting Heat with multiple lengths (7.4m, 5.0m, 5.4m)...");
//     const testHeatNo = `HEAT-CH-${Date.now().toString().slice(-4)}`;
//     const castRes = await request("/api/billets/heats", {
//       method: "POST",
//       token,
//       body: JSON.stringify({
//         heat_number: testHeatNo,
//         grade: "304",
//         section: "120x120 mm",
//         remarks: "Heat cast with multiple lengths 7.4m, 5.0m, 5.4m",
//         lengths: [
//           { length_meters: 7.4, piece_count: 10 },
//           { length_meters: 5.0, piece_count: 8 },
//           { length_meters: 5.4, piece_count: 6 }
//         ]
//       })
//     });

//     if (castRes.status !== 201 || !castRes.data.success) {
//       throw new Error(`Cast heat failed: ${JSON.stringify(castRes)}`);
//     }

//     const castData = castRes.data.data;
//     console.log(`✓ Heat '${testHeatNo}' Cast successfully:`);
//     console.log(`  - Core: Grade='${castData.grade}', Section='${castData.section}'`);
//     console.log(`  - Total Initial Pieces across all lengths: ${castData.total_pieces} pcs (10 + 8 + 6)`);
//     console.log(`  - Total Initial Weight MT: ${castData.total_weight_mt} MT`);
//     console.log(`  - Available in Yard: ${castData.available_pieces} pcs / ${castData.available_weight_mt} MT`);
//     console.log("  - Length variants breakdown:");
//     for (const len of castData.lengths) {
//       console.log(`    * Length: ${len.length_meters}m | Pieces: ${len.piece_count} pcs | Piece Wt: ${len.weight_per_piece_kg} kg | Total: ${len.total_weight_mt} MT`);
//     }

//     // 6. Quality Lab Check
//     console.log("\n[5/7] Submitting Spectrometry Lab Quality Check...");
//     const labRes = await request("/api/lab/check", {
//       method: "POST",
//       token,
//       body: JSON.stringify({
//         heat_id: castData.id,
//         test_certificate_no: `TC-${testHeatNo}`,
//         c_percent: 0.062,
//         mn_percent: 1.78,
//         si_percent: 0.52,
//         cr_percent: 18.3,
//         ni_percent: 8.2,
//         verdict: "APPROVED",
//         lab_remarks: "Chemical parameters within AISI 304 spec"
//       })
//     });

//     if (labRes.status !== 200 || labRes.data.data.verdict !== "APPROVED") {
//       throw new Error(`Lab check failed: ${JSON.stringify(labRes)}`);
//     }
//     console.log(`✓ Quality Lab Check APPROVED for Heat '${testHeatNo}'.`);

//     // 7. Transfer in Plant (Dispatch) with breakdown of lengths
//     console.log("\n[6/7] Transferring / Dispatching billets to Plant...");
//     const transferRes = await request("/api/dispatches", {
//       method: "POST",
//       token,
//       body: JSON.stringify({
//         heat_number: testHeatNo,
//         target_plant: "Rolling Mill #1",
//         dispatched_pieces: 11,
//         dispatched_weight_mt: 7.936,
//         lengths_breakdown: [
//           { length_meters: 7.4, pieces: 6, weight_mt: 5.019 },
//           { length_meters: 5.4, pieces: 2, weight_mt: 1.221 },
//           { length_meters: 5.0, pieces: 3, weight_mt: 1.696 }
//         ],
//         remarks: "Transferred to Rolling Mill #1 for wire rod rolling"
//       })
//     });

//     if (transferRes.status !== 201 || !transferRes.data.success) {
//       throw new Error(`Transfer failed: ${JSON.stringify(transferRes)}`);
//     }

//     const dsp = transferRes.data.data;
//     console.log(`✓ Transferred ${dsp.dispatched_pieces} pcs (${dsp.dispatched_weight_mt} MT) to '${dsp.target_plant}'.`);
//     console.log(`  - Voucher: ${dsp.dispatch_number}`);

//     // Check remaining inventory on heat
//     const heatCheckRes = await request(`/api/billets/heats/${testHeatNo}`, { token });
//     const remainingHeat = heatCheckRes.data.data;
//     console.log(`  - Yard Remaining after transfer: ${remainingHeat.available_pieces} pcs / ${remainingHeat.available_weight_mt} MT`);

//     // 8. Record Finished Product built, Rejection, and Plant Return
//     console.log("\n[7/7] Recording Product built in plant, Rejections, and Plant Returns...");
    
//     // Finished product built
//     const fpRes = await request("/api/finished-products", {
//       method: "POST",
//       token,
//       body: JSON.stringify({
//         heat_number: testHeatNo,
//         dispatch_id: dsp.id,
//         finished_product_name: "SS 304 Wire Rod in Coils",
//         finished_size: "5.5 mm",
//         input_billet_weight_mt: 7.936,
//         finished_pieces: 7,
//         finished_weight_mt: 7.28,
//         mill_name: "Rolling Mill #1",
//         remarks: "Rolled coils from dispatched billets"
//       })
//     });
//     const fp = fpRes.data.data;
//     console.log(`✓ Finished Product Built: '${fp.finished_product_name}' (${fp.finished_size}) | Output: ${fp.finished_weight_mt} MT | Yield: ${fp.yield_percentage}%`);

//     // Billet / Material rejection
//     const rejRes = await request("/api/rejections", {
//       method: "POST",
//       token,
//       body: JSON.stringify({
//         heat_number: testHeatNo,
//         dispatch_id: dsp.id,
//         stage: "ROLLING_MILL",
//         rejection_type: "END_CROP_SCRAP",
//         rejected_pieces: 0,
//         rejected_weight_mt: 0.38,
//         disposition: "SCRAP_REMELT",
//         rejection_reason: "Front/tail end cropping at flying shear"
//       })
//     });
//     console.log(`✓ Material Rejection Recorded: ${rejRes.data.data.rejected_weight_mt} MT scrap recorded.`);

//     // Plant return
//     const retRes = await request("/api/returns", {
//       method: "POST",
//       token,
//       body: JSON.stringify({
//         heat_number: testHeatNo,
//         dispatch_id: dsp.id,
//         returned_from: "Rolling Mill #1",
//         returned_to: "Billet Yard Stock",
//         return_type: "UNUSED_BILLET_RETURN",
//         returned_pieces: 1,
//         returned_weight_mt: 0.27,
//         return_reason: "Unused piece returned to yard stock",
//         stock_restored: true
//       })
//     });
//     console.log(`✓ Plant Return Recorded: ${retRes.data.data.returned_pieces} pc (${retRes.data.data.returned_weight_mt} MT) returned to yard stock.`);

//     // 9. Full End-to-End Traceability Report & Material Balance Ledger
//     console.log("\n[8/7] Generating End-to-End Billet Traceability Report...");
//     const traceRes = await request(`/api/traceability/heat/${testHeatNo}`, { token });
//     if (traceRes.status !== 200 || !traceRes.data.success) {
//       throw new Error(`Traceability failed: ${JSON.stringify(traceRes)}`);
//     }

//     const trace = traceRes.data.data;
//     const ledger = trace.material_balance_reconciliation;
//     console.log("===============================================================");
//     console.log(`   END-TO-END TRACEABILITY AUDIT FOR HEAT: ${trace.heat_number}`);
//     console.log("===============================================================");
//     console.log(`• Heat: ${trace.heat_number} | Grade: ${trace.grade} | Section: ${trace.section} | Status: ${trace.status}`);
//     console.log(`• Quality Lab: Verdict=${trace.quality_lab_check.verdict} (TC: ${trace.quality_lab_check.test_certificate_no})`);
//     console.log("• Material Balance Ledger Reconciliation:");
//     console.log(`  - Total Initial Cast:       ${ledger.total_cast_pieces} pcs / ${ledger.total_cast_weight_mt} MT`);
//     console.log(`  - Transferred to Plant:     ${ledger.total_sent_to_plant_pieces} pcs / ${ledger.total_sent_to_plant_mt} MT`);
//     console.log(`  - Finished Product Built:   ${ledger.good_finished_product_pieces} pcs / ${ledger.good_finished_product_weight_mt} MT`);
//     console.log(`  - Rejected Scrap Loss:      ${ledger.rejection_scrap_loss_mt} MT`);
//     console.log(`  - Returned Back to Stock:   ${ledger.returned_to_yard_pieces} pcs / ${ledger.returned_to_yard_or_remelt_mt} MT`);
//     console.log(`  - Scale / Burning Loss:     ${ledger.scale_loss_or_burning_loss_mt} MT`);
//     console.log(`  - Rolling Yield Recovery:   ${ledger.rolling_yield_recovery_pct}%`);
//     console.log(`  - Reconciliation Status:    ${ledger.reconciliation_status}`);
//     console.log("===============================================================");
//     console.log("   ALL END-TO-END TRACEABILITY CHECKS VERIFIED SUCCESSFULLY!   ");
//     console.log("===============================================================");

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

// runTests();
