// import dotenv from "dotenv";
// dotenv.config();

// import { connectDB } from "./src/dbConfig/db.js";
// import "./src/model/userModel.js";
// import { BilletHeat } from "./src/model/billetHeatModel.js";
// import { BilletLength } from "./src/model/billetLengthModel.js";
// import { BilletPlantDispatch, createPlantDispatch } from "./src/model/dispatchModel.js";
// import { PlantReturn, recordPlantReturn, updatePlantReturn } from "./src/model/plantReturnModel.js";

// async function runEditReturnVerification() {
//   console.log("=======================================================================");
//   console.log(" VERIFYING EDIT PLANT RETURN FUNCTIONALITY & INVENTORY RECONCILIATION ");
//   console.log("=======================================================================");

//   const conn = await connectDB();
//   console.log(`Connected to DB: ${conn.connection.name}`);

//   const testHeatNumber = `TEST-EDIT-${Date.now().toString().slice(-6)}`;
//   console.log(`\n1. Creating Test Heat: ${testHeatNumber} (10.0 MT)...`);

//   const heat = await BilletHeat.create({
//     heat_number: testHeatNumber,
//     grade: "SS 304",
//     section: "120x120 mm",
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

//   const { createOrUpdateLabCheck } = await import("./src/model/billetLabModel.js");
//   await createOrUpdateLabCheck(heat._id, {
//     c_percent: 0.05,
//     mn_percent: 1.5,
//     si_percent: 0.45,
//     cr_percent: 18.0,
//     ni_percent: 8.0,
//     verdict: "APPROVED"
//   });

//   console.log("\n2. Dispatching 6.0 MT to 'Rolling Mill #1'...");
//   const dispatch = await createPlantDispatch({
//     heat_number: testHeatNumber,
//     target_plant: "Rolling Mill #1",
//     dispatched_pieces: 6,
//     dispatched_weight_mt: 6.0,
//     lengths_breakdown: [
//       { length_meters: 6.0, pieces: 6, weight_mt: 6.0 }
//     ]
//   });
//   console.log(`✓ Dispatch created: #${dispatch.dispatch_number} (6.0 MT dispatched, 4.0 MT remaining in yard)`);

//   const heatAfterDisp = await BilletHeat.findById(heat._id);
//   console.log(`✓ Yard available balance after dispatch: ${heatAfterDisp.available_weight_mt} MT`);

//   console.log("\n3. Creating initial Plant Return of 1.0 MT (1 pc) from 'Rolling Mill #1'...");
//   const initialReturn = await recordPlantReturn({
//     heat_number: testHeatNumber,
//     dispatch_id: dispatch.id,
//     return_type: "UNUSED_BILLET_RETURN",
//     source_plant: "Rolling Mill #1",
//     returned_to: "Billet Yard Stock",
//     returned_pieces: 1,
//     returned_weight_mt: 1.0,
//     return_reason: "Initial roll test return",
//     stock_restored: true
//   });
//   console.log(`✓ Initial return created: #${initialReturn.return_number} (1.0 MT, stock restored)`);

//   const heatAfterRet1 = await BilletHeat.findById(heat._id);
//   console.log(`✓ Yard available balance after return: ${heatAfterRet1.available_weight_mt} MT (4.0 + 1.0 = 5.0 MT)`);

//   console.log("\n4. EDITING Return: Updating returned pieces from 1 -> 2, weight from 1.0 -> 2.0 MT...");
//   const updatedReturn = await updatePlantReturn(initialReturn.id, {
//     returned_from: "Rolling Mill #1",
//     returned_to: "Billet Yard Stock",
//     return_type: "UNUSED_BILLET_RETURN",
//     returned_pieces: 2,
//     returned_weight_mt: 2.0,
//     stock_restored: true,
//     return_reason: "Adjusted to 2 pieces after physical weighbridge verification"
//   });

//   console.log(`✓ Return updated successfully:`);
//   console.log(`  - New pieces: ${updatedReturn.returned_pieces} pcs (was 1 pc)`);
//   console.log(`  - New weight: ${updatedReturn.returned_weight_mt} MT (was 1.0 MT)`);
//   console.log(`  - Reason: ${updatedReturn.return_reason}`);

//   if (updatedReturn.returned_pieces !== 2 || updatedReturn.returned_weight_mt !== 2.0) {
//     throw new Error("FAIL: updatePlantReturn failed to update pieces or weight!");
//   }

//   const heatAfterEdit = await BilletHeat.findById(heat._id);
//   console.log(`✓ Yard available balance after edit: ${heatAfterEdit.available_weight_mt} MT (5.0 + 1.0 delta = 6.0 MT)`);
//   if (Math.abs(heatAfterEdit.available_weight_mt - 6.0) > 0.001) {
//     throw new Error(`FAIL: Yard stock delta was not properly applied! Expected 6.0 MT, got ${heatAfterEdit.available_weight_mt} MT`);
//   }

//   console.log("\n5. Testing Edit: Attempting to edit source plant to an undispatched plant ('Rolling Mill #99')...");
//   let invalidPlantBlocked = false;
//   try {
//     await updatePlantReturn(initialReturn.id, {
//       returned_from: "Rolling Mill #99"
//     });
//   } catch (err) {
//     invalidPlantBlocked = true;
//     console.log(`✓ Invalid plant edit blocked as expected: "${err.message}"`);
//   }
//   if (!invalidPlantBlocked) {
//     throw new Error("FAIL: Editing to undispatched plant should have been blocked!");
//   }

//   console.log("\n6. Testing Edit: Attempting to edit weight exceeding dispatch balance (7.0 MT > 6.0 MT)...");
//   let excessEditBlocked = false;
//   try {
//     await updatePlantReturn(initialReturn.id, {
//       returned_weight_mt: 7.0
//     });
//   } catch (err) {
//     excessEditBlocked = true;
//     console.log(`✓ Excess weight edit blocked as expected: "${err.message}"`);
//   }
//   if (!excessEditBlocked) {
//     throw new Error("FAIL: Editing to excess weight should have been blocked!");
//   }

//   console.log("\n7. EDITING Return Category: Changing to SCRAP_REMELT (Stock NOT restored)...");
//   const remeltEdit = await updatePlantReturn(initialReturn.id, {
//     return_type: "SCRAP_REMELT",
//     returned_to: "SMS Induction / Arc Furnace (Remelt Bay)",
//     stock_restored: false,
//     returned_pieces: 2,
//     returned_weight_mt: 2.0
//   });

//   const heatAfterRemelt = await BilletHeat.findById(heat._id);
//   console.log(`✓ Yard available balance after changing to remelt: ${heatAfterRemelt.available_weight_mt} MT (reversed -2.0 MT, back to 4.0 MT)`);
//   if (Math.abs(heatAfterRemelt.available_weight_mt - 4.0) > 0.001) {
//     throw new Error(`FAIL: Remelt inventory reversal not applied! Expected 4.0 MT, got ${heatAfterRemelt.available_weight_mt} MT`);
//   }

//   console.log("\n8. Cleaning up test data...");
//   await PlantReturn.deleteMany({ heat_number: testHeatNumber });
//   await BilletPlantDispatch.deleteMany({ heat_number: testHeatNumber });
//   await BilletLength.deleteMany({ heat_id: heat._id });
//   await BilletHeat.findByIdAndDelete(heat._id);
//   console.log("✓ Cleanup complete.");

//   console.log("\n=======================================================================");
//   console.log(" ALL EDIT PLANT RETURN VERIFICATION TESTS PASSED 100%! ");
//   console.log("=======================================================================");
//   process.exit(0);
// }

// runEditReturnVerification().catch((err) => {
//   console.error("\n❌ Test Failed:", err);
//   process.exit(1);
// });
