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

// async function runVerification() {
//   console.log("===============================================================");
//   console.log(" VERIFYING MATERIAL BALANCE, REJECTION RULES & DYNAMIC CHEMISTRY");
//   console.log("===============================================================");

//   const conn = await connectDB();
//   console.log(`Connected to DB: ${conn.connection.name}`);

//   const testHeatNumber = `TEST-HT-${Date.now().toString().slice(-5)}`;
//   console.log(`\n1. Creating Test Heat: ${testHeatNumber}...`);

//   const heat = await BilletHeat.create({
//     heat_number: testHeatNumber,
//     grade: "SS 304",
//     section: "120x120 mm",
//     total_pieces: 20,
//     total_weight_mt: 20.0,
//     available_pieces: 20,
//     available_weight_mt: 20.0
//   });

//   await BilletLength.create({
//     heat_id: heat._id,
//     heat_number: testHeatNumber,
//     length_meters: 6.0,
//     piece_count: 20,
//     total_weight_mt: 20.0,
//     weight_per_piece_kg: 1000,
//     remaining_pieces: 20,
//     remaining_weight_mt: 20.0
//   });

//   console.log("2. Submitting Lab Check with Dynamic Chemistry Options (V, Ti)...");
//   const labCheck = await createOrUpdateLabCheck(heat._id, {
//     c_percent: 0.07,
//     mn_percent: 1.5,
//     si_percent: 0.45,
//     cr_percent: 18.1,
//     ni_percent: 8.05,
//     other_elements: {
//       V: 0.045,
//       TI: 0.025
//     },
//     verdict: "APPROVED"
//   });

//   if (labCheck.other_elements?.V !== 0.045 || labCheck.other_elements?.TI !== 0.025) {
//     throw new Error("Failed to persist custom other_elements (V, Ti) in Lab Check!");
//   }
//   console.log("✓ Dynamic Chemistry elements V (0.045%) & Ti (0.025%) saved and verified successfully.");

//   console.log("\n3. Creating Dispatch Manifest 1 (10.0 MT to RM16)...");
//   const dispatch1 = await createPlantDispatch({
//     heat_number: testHeatNumber,
//     target_plant: "Rolling Mill #1",
//     dispatched_pieces: 10,
//     dispatched_weight_mt: 10.0,
//     lengths_breakdown: [
//       { length_meters: 6.0, pieces: 10, weight_mt: 10.0 }
//     ]
//   });
//   console.log(`✓ Dispatch 1 created: #${dispatch1.dispatch_number} (10 MT)`);

//   console.log("\n4. Scenario A: Finished Product uses FULL 10.0 MT of Dispatch 1...");
//   const prod1 = await recordFinishedProduct({
//     heat_number: testHeatNumber,
//     dispatch_id: dispatch1.id,
//     finished_product_name: "SS 304 Rebar 16mm",
//     finished_size: "16 mm",
//     input_billet_weight_mt: 10.0,
//     finished_pieces: 10,
//     finished_weight_mt: 9.6
//   });
//   console.log(`✓ Finished product recorded consuming 10.0 MT: #${prod1.production_batch_number}`);

//   console.log("\n5. Testing Rule: Attempt to add rejection when finished product built == dispatch material...");
//   let ruleABlocked = false;
//   try {
//     await recordRejection({
//       heat_number: testHeatNumber,
//       dispatch_id: dispatch1.id,
//       stage: "ROLLING_MILL",
//       rejection_type: "COBBLE_SCRAP",
//       rejected_pieces: 1,
//       rejected_weight_mt: 1.0,
//       rejection_reason: "Cobble in roughing stand"
//     });
//   } catch (err) {
//     ruleABlocked = true;
//     console.log(`✓ Rule A correctly enforced! Blocked with message: "${err.message}"`);
//   }

//   if (!ruleABlocked) {
//     throw new Error("FAIL: Rejection should have been impossible when finished product built equals dispatch material!");
//   }

//   console.log("\n6. Scenario B: Creating Dispatch Manifest 2 (10.0 MT to RM16)...");
//   const dispatch2 = await createPlantDispatch({
//     heat_number: testHeatNumber,
//     target_plant: "Rolling Mill #1",
//     dispatched_pieces: 10,
//     dispatched_weight_mt: 10.0,
//     lengths_breakdown: [
//       { length_meters: 6.0, pieces: 10, weight_mt: 10.0 }
//     ]
//   });

//   console.log("Finished product built is LESS than dispatch: Built using 7.0 MT of 10.0 MT dispatched (3.0 MT remaining)...");
//   const prod2 = await recordFinishedProduct({
//     heat_number: testHeatNumber,
//     dispatch_id: dispatch2.id,
//     finished_product_name: "SS 304 Wire Rod 5.5mm",
//     finished_size: "5.5 mm",
//     input_billet_weight_mt: 7.0,
//     finished_pieces: 7,
//     finished_weight_mt: 6.8
//   });
//   console.log(`✓ Finished product recorded: #${prod2.production_batch_number} (7.0 MT input consumed, 3.0 MT unconsumed)`);

//   console.log("\n7. Attempting rejection of 4.0 MT (exceeds remaining 3.0 MT balance)...");
//   let excessBlocked = false;
//   try {
//     await recordRejection({
//       heat_number: testHeatNumber,
//       dispatch_id: dispatch2.id,
//       stage: "ROLLING_MILL",
//       rejection_type: "END_CROP_SCRAP",
//       rejected_pieces: 2,
//       rejected_weight_mt: 4.0,
//       rejection_reason: "Crop cuts"
//     });
//   } catch (err) {
//     excessBlocked = true;
//     console.log(`✓ Excess rejection correctly blocked: "${err.message}"`);
//   }
//   if (!excessBlocked) {
//     throw new Error("FAIL: Excess rejection of 4.0 MT should have been blocked (only 3.0 MT available)!");
//   }

//   console.log("\n8. Attempting valid rejection of 2.0 MT (within 3.0 MT remaining balance)...");
//   const validRej = await recordRejection({
//     heat_number: testHeatNumber,
//     dispatch_id: dispatch2.id,
//     stage: "ROLLING_MILL",
//     rejection_type: "END_CROP_SCRAP",
//     rejected_pieces: 2,
//     rejected_weight_mt: 2.0,
//     rejection_reason: "Valid crop cuts within remaining dispatch material"
//   });
//   console.log(`✓ Valid rejection successfully recorded: #${validRej.rejection_number} (${validRej.rejected_weight_mt} MT)`);

//   console.log("\n9. Cleaning up test data...");
//   await FinishedProduct.deleteMany({ heat_number: testHeatNumber });
//   await BilletRejection.deleteMany({ heat_number: testHeatNumber });
//   await BilletPlantDispatch.deleteMany({ heat_number: testHeatNumber });
//   await BilletLabCheck.deleteMany({ heat_number: testHeatNumber });
//   await BilletLength.deleteMany({ heat_id: heat._id });
//   await BilletHeat.findByIdAndDelete(heat._id);
//   console.log("✓ Cleanup complete.");

//   console.log("\n===============================================================");
//   console.log(" ALL RULES VERIFIED AND PASSED 100% SUCCESSFULLY! ");
//   console.log("===============================================================");
//   process.exit(0);
// }

// runVerification().catch((err) => {
//   console.error("\n❌ Verification Failed:", err);
//   process.exit(1);
// });
