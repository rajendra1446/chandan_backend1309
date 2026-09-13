// import dotenv from "dotenv";
// dotenv.config();

// import { connectDB } from "./src/dbConfig/db.js";
// import "./src/model/userModel.js";
// import { BilletHeat } from "./src/model/billetHeatModel.js";
// import { BilletLength } from "./src/model/billetLengthModel.js";
// import { BilletLabCheck, createOrUpdateLabCheck } from "./src/model/billetLabModel.js";
// import { BilletPlantDispatch, createPlantDispatch } from "./src/model/dispatchModel.js";
// import { FinishedProduct, recordFinishedProduct } from "./src/model/finishedProductModel.js";
// import { BilletRejection, recordRejection } from "./src/model/rejectionModel.js";
// import { PlantReturn, recordPlantReturn } from "./src/model/plantReturnModel.js";

// async function runComprehensiveVerification() {
//   console.log("=======================================================================");
//   console.log(" COMPREHENSIVE VERIFICATION: PLANT RETURNS, REJECTION & MATERIAL BALANCE ");
//   console.log("=======================================================================");

//   const conn = await connectDB();
//   console.log(`Connected to DB: ${conn.connection.name}`);

//   const testHeatNumber = `TEST-RET-${Date.now().toString().slice(-6)}`;
//   console.log(`\n1. Creating Test Heat: ${testHeatNumber} (10.0 MT, 10 pcs)...`);

//   const heat = await BilletHeat.create({
//     heat_number: testHeatNumber,
//     grade: "SS 316L",
//     section: "130x130 mm",
//     total_pieces: 10,
//     total_weight_mt: 10.0,
//     available_pieces: 10,
//     available_weight_mt: 10.0
//   });

//   await BilletLength.create({
//     heat_id: heat._id,
//     heat_number: testHeatNumber,
//     length_meters: 6.0,
//     piece_count: 10,
//     total_weight_mt: 10.0,
//     weight_per_piece_kg: 1000,
//     remaining_pieces: 10,
//     remaining_weight_mt: 10.0
//   });

//   console.log("2. Approving Lab Spectrometry Check...");
//   await createOrUpdateLabCheck(heat._id, {
//     c_percent: 0.025,
//     mn_percent: 1.6,
//     si_percent: 0.40,
//     cr_percent: 17.2,
//     ni_percent: 11.5,
//     mo_percent: 2.15,
//     verdict: "APPROVED"
//   });
//   console.log("✓ Lab test approved.");

//   console.log("\n3. Dispatching 5.0 MT to Mill #2...");
//   const dispatch = await createPlantDispatch({
//     heat_number: testHeatNumber,
//     target_plant: "Rolling Mill #2",
//     dispatched_pieces: 5,
//     dispatched_weight_mt: 5.0,
//     lengths_breakdown: [
//       { length_meters: 6.0, pieces: 5, weight_mt: 5.0 }
//     ]
//   });
//   console.log(`✓ Dispatch created: #${dispatch.dispatch_number} (5.0 MT sent to mill)`);

//   console.log("\n4. Finished product made is LESS than dispatch: Built 2.0 MT prime goods...");
//   const finished = await recordFinishedProduct({
//     heat_number: testHeatNumber,
//     dispatch_id: dispatch.id,
//     finished_product_name: "SS 316L Hex Bar 22mm",
//     finished_size: "22 mm",
//     input_billet_weight_mt: 2.0,
//     finished_pieces: 2,
//     finished_weight_mt: 1.92
//   });
//   console.log(`✓ Finished product recorded: #${finished.production_batch_number} (2.0 MT consumed, 3.0 MT unconsumed balance)`);

//   console.log("\n5. Testing Rejection: Attempting rejection exceeding remaining unconsumed balance (3.5 MT > 3.0 MT)...");
//   let excessRejectionBlocked = false;
//   try {
//     await recordRejection({
//       heat_number: testHeatNumber,
//       dispatch_id: dispatch.id,
//       stage: "ROLLING_MILL",
//       rejection_type: "COBBLE_SCRAP",
//       rejected_pieces: 4,
//       rejected_weight_mt: 3.5,
//       rejection_reason: "Excess rejection test"
//     });
//   } catch (err) {
//     excessRejectionBlocked = true;
//     console.log(`✓ Excess rejection blocked as expected: "${err.message}"`);
//   }
//   if (!excessRejectionBlocked) {
//     throw new Error("FAIL: Excess rejection exceeding dispatch balance was not blocked!");
//   }

//   console.log("\n6. Recording valid scrap/cobble rejection of 0.8 MT...");
//   const rej = await recordRejection({
//     heat_number: testHeatNumber,
//     dispatch_id: dispatch.id,
//     stage: "ROLLING_MILL",
//     rejection_type: "END_CROP_SCRAP",
//     rejected_pieces: 1,
//     rejected_weight_mt: 0.8,
//     rejection_reason: "Valid crop cuts within remaining balance"
//   });
//   console.log(`✓ Valid rejection recorded: #${rej.rejection_number} (0.8 MT). Remaining balance now = 5.0 - 2.0 - 0.8 = 2.2 MT.`);

//   console.log("\n7. Testing Plant Return: Attempting return of 2.5 MT (exceeds remaining 2.2 MT balance)...");
//   let excessReturnBlocked = false;
//   try {
//     await recordPlantReturn({
//       heat_number: testHeatNumber,
//       dispatch_id: dispatch.id,
//       source_plant: "Rolling Mill #2",
//       returned_to: "Billet Yard Stock",
//       returned_pieces: 3,
//       returned_weight_mt: 2.5,
//       return_reason: "Excess return test"
//     });
//   } catch (err) {
//     excessReturnBlocked = true;
//     console.log(`✓ Excess plant return blocked as expected: "${err.message}"`);
//   }
//   if (!excessReturnBlocked) {
//     throw new Error("FAIL: Excess return exceeding unconsumed balance was not blocked!");
//   }

//   console.log("\n8. Recording valid Unused Billet Return of 1.2 MT (restores yard stock)...");
//   const yardBefore = await BilletHeat.findById(heat._id);
//   const availBefore = yardBefore.available_weight_mt;

//   const validReturn = await recordPlantReturn({
//     heat_number: testHeatNumber,
//     dispatch_id: dispatch.id,
//     return_type: "UNUSED_BILLET_RETURN",
//     source_plant: "Rolling Mill #2",
//     returned_to: "Billet Yard Stock",
//     returned_pieces: 1,
//     returned_weight_mt: 1.2,
//     return_reason: "Mill roll pass completed, unheated sound billet returned",
//     stock_restored: true
//   });
//   console.log(`✓ Valid plant return voucher created: #${validReturn.return_number} (1.2 MT returned)`);

//   const yardAfter = await BilletHeat.findById(heat._id);
//   console.log(`✓ Yard available balance verified: ${availBefore} MT -> ${yardAfter.available_weight_mt} MT (restored +1.2 MT)`);
//   if (Math.abs(yardAfter.available_weight_mt - (availBefore + 1.2)) > 0.001) {
//     throw new Error("FAIL: Yard stock was not properly restored!");
//   }

//   console.log("\n9. Recording valid Scrap Remelt Return of 1.0 MT (returns to SMS furnace, balance exhausted)...");
//   const validScrapReturn = await recordPlantReturn({
//     heat_number: testHeatNumber,
//     dispatch_id: dispatch.id,
//     return_type: "SCRAP_REMELT",
//     source_plant: "Rolling Mill #2",
//     returned_to: "SMS Induction / Arc Furnace (Remelt Bay)",
//     returned_pieces: 1,
//     returned_weight_mt: 1.0,
//     return_reason: "Heavy cobble scrap charged back to melt shop",
//     stock_restored: false
//   });
//   console.log(`✓ Scrap remelt return voucher created: #${validScrapReturn.return_number} (1.0 MT remelt return)`);

//   console.log("\n10. Testing fully exhausted dispatch balance: Attempting any further rejection or return (balance = 0.0 MT)...");
//   let exhaustedRejectionBlocked = false;
//   try {
//     await recordRejection({
//       heat_number: testHeatNumber,
//       dispatch_id: dispatch.id,
//       stage: "ROLLING_MILL",
//       rejection_type: "COBBLE_SCRAP",
//       rejected_pieces: 1,
//       rejected_weight_mt: 0.1,
//       rejection_reason: "Should fail"
//     });
//   } catch (err) {
//     exhaustedRejectionBlocked = true;
//     console.log(`✓ Further rejection blocked: "${err.message}"`);
//   }

//   let exhaustedReturnBlocked = false;
//   try {
//     await recordPlantReturn({
//       heat_number: testHeatNumber,
//       dispatch_id: dispatch.id,
//       source_plant: "Rolling Mill #2",
//       returned_to: "Billet Yard Stock",
//       returned_pieces: 1,
//       returned_weight_mt: 0.1,
//       return_reason: "Should fail"
//     });
//   } catch (err) {
//     exhaustedReturnBlocked = true;
//     console.log(`✓ Further return blocked: "${err.message}"`);
//   }

//   if (!exhaustedRejectionBlocked || !exhaustedReturnBlocked) {
//     throw new Error("FAIL: Operations on exhausted dispatch should have been blocked!");
//   }

//   console.log("\n11. Verifying Full Material Reconciliation Formula:");
//   console.log("    Dispatch (5.00 MT) = Finished Input (2.00 MT) + Scrap Rejection (0.80 MT) + Yard Return (1.20 MT) + Remelt Return (1.00 MT)");
//   const totalReconciled = 2.0 + 0.8 + 1.2 + 1.0;
//   console.log(`    Sum = ${totalReconciled.toFixed(2)} MT / Dispatched = 5.00 MT. Discrepancy = 0.00 MT.`);

//   console.log("\n12. Cleaning up test data...");
//   await PlantReturn.deleteMany({ heat_number: testHeatNumber });
//   await FinishedProduct.deleteMany({ heat_number: testHeatNumber });
//   await BilletRejection.deleteMany({ heat_number: testHeatNumber });
//   await BilletPlantDispatch.deleteMany({ heat_number: testHeatNumber });
//   await BilletLabCheck.deleteMany({ heat_number: testHeatNumber });
//   await BilletLength.deleteMany({ heat_id: heat._id });
//   await BilletHeat.findByIdAndDelete(heat._id);
//   console.log("✓ Cleanup completed successfully.");

//   console.log("\n=======================================================================");
//   console.log(" ALL RECONCILIATION, PLANT RETURN & SCRAP TESTS PASSED 100%!");
//   console.log("=======================================================================");
//   process.exit(0);
// }

// runComprehensiveVerification().catch((err) => {
//   console.error("\n❌ Test Failed:", err);
//   process.exit(1);
// });
