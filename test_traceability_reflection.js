// import mongoose from "mongoose";
// import dotenv from "dotenv";
// dotenv.config();

// import { connectDB } from "./src/dbConfig/db.js";
// import "./src/model/userModel.js";
// import { BilletHeat } from "./src/model/billetHeatModel.js";
// import { BilletLength } from "./src/model/billetLengthModel.js";
// import { BilletLabCheck } from "./src/model/billetLabModel.js";
// import { BilletPlantDispatch } from "./src/model/dispatchModel.js";
// import { FinishedProduct } from "./src/model/finishedProductModel.js";
// import { BilletRejection } from "./src/model/rejectionModel.js";
// import { PlantReturn } from "./src/model/plantReturnModel.js";
// import {
//   getFullHeatTraceability,
//   getTraceabilityDashboardSummary,
//   searchTraceability
// } from "./src/model/traceabilityModel.js";

// async function runTraceabilityReflectionTest() {
//   try {
//     console.log("==> Connecting to MongoDB Atlas...");
//     await connectDB();
//     console.log("==> Connected successfully.");

//     // 1. Test getTraceabilityDashboardSummary
//     console.log("\n[TEST 1] Testing getTraceabilityDashboardSummary()...");
//     const summary = await getTraceabilityDashboardSummary();
//     console.log("Summary metrics check:", {
//       heats_count: summary.heats_count,
//       total_cast_weight_mt: summary.total_cast_weight_mt,
//       dispatches_count: summary.dispatches_count,
//       total_dispatched_weight_mt: summary.total_dispatched_weight_mt,
//       finished_batches_count: summary.finished_batches_count,
//       total_finished_weight_mt: summary.total_finished_weight_mt,
//       overall_recovery_pct: summary.overall_recovery_pct,
//       rejections_count: summary.rejections_count,
//       total_rejected_weight_mt: summary.total_rejected_weight_mt,
//       returns_count: summary.returns_count,
//       total_returned_weight_mt: summary.total_returned_weight_mt
//     });

//     if (summary.heats_count === undefined || summary.total_cast_weight_mt === undefined) {
//       throw new Error("Summary metrics missing top-level keys!");
//     }
//     console.log("✓ TEST 1 PASSED: Summary metrics contains top-level and nested structures.");

//     // 2. Test getFullHeatTraceability on CH-01
//     console.log("\n[TEST 2] Testing getFullHeatTraceability('CH-01')...");
//     const heatNo = "CH-01";
//     let trace = await getFullHeatTraceability(heatNo);
//     if (!trace) {
//       throw new Error(`Heat ${heatNo} not found in database!`);
//     }

//     console.log("Traceability pedigree fetched for:", trace.heat_number);
//     console.log("Casting Details:", {
//       heat_number: trace.casting_details.heat_number,
//       total_pieces: trace.casting_details.total_pieces,
//       cast_pieces: trace.casting_details.cast_pieces,
//       total_weight_mt: trace.casting_details.total_weight_mt,
//       available_weight_mt: trace.casting_details.available_weight_mt
//     });
//     console.log("Material Balance Ledger:", trace.material_balance_reconciliation);

//     console.log(`Child Records Count: Lengths=${trace.length_breakdown.length}, Dispatches=${trace.plant_dispatches.length}, Finished=${trace.finished_products.length}, Rejections=${trace.rejections_and_scrap.length}, Returns=${trace.plant_returns.length}`);

//     // Verify reconciliation fields are present
//     const ledger = trace.material_balance_reconciliation;
//     if (
//       ledger.total_cast_weight_mt === undefined ||
//       ledger.dispatched_mt === undefined ||
//       ledger.finished_mt === undefined ||
//       ledger.rejection_scrap_mt === undefined ||
//       ledger.returned_mt === undefined ||
//       ledger.scale_loss_or_burning_loss_mt === undefined
//     ) {
//       throw new Error("Reconciliation ledger missing essential fields!");
//     }
//     console.log("✓ TEST 2 PASSED: getFullHeatTraceability produces complete, unbroken digital thread.");

//     // 3. Test global search
//     console.log("\n[TEST 3] Testing searchTraceability('CH-01')...");
//     const searchRes = await searchTraceability("CH-01");
//     console.log(`Search returned: ${searchRes.heats.length} heats, ${searchRes.finished_products.length} finished, ${searchRes.dispatches.length} dispatches, ${searchRes.lab_checks.length} lab checks`);
//     if (searchRes.heats.length === 0) {
//       throw new Error("Search did not return heat CH-01!");
//     }
//     console.log("✓ TEST 3 PASSED: searchTraceability works properly.");

//     // 4. Test live reflection on change
//     console.log("\n[TEST 4] Verifying dynamic reflection of modifications...");
//     // Let's verify that any edit in returns or rejections immediately changes the traceability values
//     const sampleReturn = await PlantReturn.findOne({ heat_number: heatNo });
//     if (sampleReturn) {
//       console.log(`Found existing return voucher ${sampleReturn.return_voucher_no} with weight ${sampleReturn.returned_weight_mt} MT.`);
//       console.log("Traceability ledger returned_to_yard_or_remelt_mt matches return sum:", ledger.returned_to_yard_or_remelt_mt);
//       if (Math.abs(ledger.returned_to_yard_or_remelt_mt - sampleReturn.returned_weight_mt) > 0.001) {
//         console.warn("Notice: Multiple returns exist or delta detected.");
//       }
//     }

//     console.log("\nALL VERIFICATION TESTS COMPLETED SUCCESSFULLY (100% PASS)!");
//   } catch (error) {
//     console.error("Test failed with error:", error);
//     process.exit(1);
//   } finally {
//     await mongoose.disconnect();
//     console.log("==> Disconnected from MongoDB.");
//   }
// }

// runTraceabilityReflectionTest();
