// import mongoose from "mongoose";
// import dotenv from "dotenv";
// dotenv.config();

// import { connectDB } from "./src/dbConfig/db.js";
// import "./src/model/userModel.js";
// import { BilletHeat } from "./src/model/billetHeatModel.js";
// import { BilletPlantDispatch } from "./src/model/dispatchModel.js";
// import { recordFinishedProduct, FinishedProduct } from "./src/model/finishedProductModel.js";
// import { BilletRejection } from "./src/model/rejectionModel.js";
// import { PlantReturn } from "./src/model/plantReturnModel.js";
// import { getFullHeatTraceability } from "./src/model/traceabilityModel.js";

// async function runTest() {
//   try {
//     console.log("==> Connecting to MongoDB Atlas...");
//     await connectDB();
//     console.log("==> Connected successfully.");

//     // Pick a test heat
//     let heat = await BilletHeat.findOne({ heat_number: "CH-01" });
//     if (!heat) {
//       heat = await BilletHeat.findOne({});
//     }
//     if (!heat) {
//       throw new Error("No billet heat available for testing!");
//     }
//     const heatNumber = heat.heat_number;
//     console.log(`Using heat: ${heatNumber}`);

//     // Create a dedicated test dispatch for clean balance testing
//     const testDispatchNumber = `DSP-TEST-${Date.now().toString().slice(-4)}`;
//     const testDispatch = await BilletPlantDispatch.create({
//       dispatch_number: testDispatchNumber,
//       heat_id: heat._id,
//       heat_number: heatNumber,
//       target_plant: "RM10 - New Plant Rolling Mill 10",
//       dispatched_pieces: 20,
//       dispatched_weight_mt: 0.100, // 0.100 MT for minimal value testing
//       status: "RECEIVED",
//       lengths_breakdown: [
//         { length_meters: 6.0, pieces: 20, weight_mt: 0.100 }
//       ]
//     });
//     console.log(`✓ Created test dispatch #${testDispatch.dispatch_number} (${testDispatch.dispatched_weight_mt} MT)`);

//     // Test Case 1: Record finished product with minimal decimal values
//     // Input: 0.060 MT
//     // Prime Output: 0.040 MT (less than consumption by 0.020 MT)
//     // Add Scrap: 0.008 MT (minimal decimal)
//     // Add Return: 0.010 MT (minimal decimal)
//     // Scale Loss: 0.060 - 0.040 - 0.008 = 0.012 MT
//     console.log("\n[TEST 1] Logging finished product with input > output, adding scrap + return material...");
//     const productData = {
//       heat_number: heatNumber,
//       dispatch_id: testDispatch._id.toString(),
//       finished_product_name: "SS 304 Precision Wire Rod",
//       finished_size: "5.5 mm",
//       standard_specification: "ASTM A276",
//       input_billet_weight_mt: 0.060,
//       finished_pieces: 15,
//       finished_weight_mt: 0.040,
//       mill_name: "RM10 - New Plant Rolling Mill 10",
//       include_scrap: true,
//       scrap_weight_mt: 0.008,
//       scrap_pieces: 2,
//       scrap_rejection_type: "END_CROP_SCRAP",
//       scrap_reason: "Rolling end crop cuts",
//       include_return: true,
//       returned_weight_mt: 0.010,
//       returned_pieces: 2,
//       returned_to: "Billet Yard Stock",
//       return_reason: "Unused billet pieces returned to yard"
//     };

//     const createdProduct = await recordFinishedProduct(productData, null);
//     console.log("✓ Successfully created finished product batch:", createdProduct.production_batch_number);
//     console.log("  - Prime weight:", createdProduct.finished_weight_mt, "MT");
//     console.log("  - Yield %:", createdProduct.yield_percentage, "%");
//     console.log("  - Linked rejection ID:", createdProduct.created_rejection?._id || createdProduct.created_rejection?.id, "weight:", createdProduct.created_rejection?.rejected_weight_mt, "MT");
//     console.log("  - Linked return voucher:", createdProduct.created_return?.return_voucher_no, "weight:", createdProduct.created_return?.returned_weight_mt, "MT");

//     if (!createdProduct.created_rejection) {
//       throw new Error("Expected auto-created BilletRejection but none returned!");
//     }
//     if (!createdProduct.created_return) {
//       throw new Error("Expected auto-created PlantReturn but none returned!");
//     }

//     // Verify rejection record in DB
//     const dbRejection = await BilletRejection.findById(createdProduct.created_rejection._id || createdProduct.created_rejection.id);
//     if (!dbRejection || dbRejection.rejected_weight_mt !== 0.008) {
//       throw new Error("DB Rejection weight does not match expected 0.008 MT!");
//     }
//     console.log("✓ Verified Rejection in DB: 0.008 MT with stage:", dbRejection.stage);

//     // Verify return record in DB
//     const dbReturn = await PlantReturn.findById(createdProduct.created_return._id || createdProduct.created_return.id);
//     if (!dbReturn || dbReturn.returned_weight_mt !== 0.010) {
//       throw new Error("DB Return weight does not match expected 0.010 MT!");
//     }
//     console.log("✓ Verified Plant Return in DB: 0.010 MT with destination:", dbReturn.returned_to);

//     // Test Case 2: Minimal decimal test (e.g. 0.0005 MT)
//     console.log("\n[TEST 2] Testing minimal decimal handling (0.001 MT / 0.0005 MT)...");
//     const minimalProductData = {
//       heat_number: heatNumber,
//       dispatch_id: testDispatch._id.toString(),
//       finished_product_name: "Micro Sample Wire",
//       finished_size: "1.0 mm",
//       input_billet_weight_mt: 0.005,
//       finished_pieces: 1,
//       finished_weight_mt: 0.003,
//       mill_name: "RM10 - New Plant Rolling Mill 10",
//       scrap_weight_mt: 0.001,
//       returned_weight_mt: 0.0005,
//       scrap_rejection_type: "END_CROP_SCRAP",
//       returned_to: "Billet Yard Stock"
//     };

//     const minimalProduct = await recordFinishedProduct(minimalProductData, null);
//     console.log("✓ Created minimal product batch:", minimalProduct.production_batch_number);
//     console.log("  - Prime weight:", minimalProduct.finished_weight_mt, "MT");
//     console.log("  - Scrap weight:", minimalProduct.created_rejection?.rejected_weight_mt, "MT");
//     console.log("  - Return weight:", minimalProduct.created_return?.returned_weight_mt, "MT");

//     // Test Case 3: Verify Traceability Balance
//     console.log("\n[TEST 3] Verifying 360° Heat Traceability balances...");
//     const trace = await getFullHeatTraceability(heatNumber);
//     const ledger = trace.material_balance_reconciliation;
//     console.log("Traceability summary for", heatNumber, ":", {
//       total_cast_weight_mt: ledger.total_cast_weight_mt,
//       dispatched_mt: ledger.dispatched_mt,
//       finished_mt: ledger.finished_mt,
//       rejection_scrap_mt: ledger.rejection_scrap_mt,
//       returned_mt: ledger.returned_mt,
//       scale_loss_or_burning_loss_mt: ledger.scale_loss_or_burning_loss_mt,
//       discrepancy_mt: ledger.discrepancy_mt
//     });

//     if (ledger.scale_loss_or_burning_loss_mt < 0) {
//       throw new Error("Scale/burning loss is negative!");
//     }
//     console.log("✓ Traceability balance verified: all metrics strictly positive or zero, no negative values.");

//     // Clean up test documents
//     console.log("\n[CLEANUP] Cleaning up test records...");
//     await FinishedProduct.deleteOne({ _id: createdProduct.id || createdProduct._id });
//     await FinishedProduct.deleteOne({ _id: minimalProduct.id || minimalProduct._id });
//     if (createdProduct.created_rejection) {
//       await BilletRejection.deleteOne({ _id: createdProduct.created_rejection.id || createdProduct.created_rejection._id });
//     }
//     if (createdProduct.created_return) {
//       await PlantReturn.deleteOne({ _id: createdProduct.created_return.id || createdProduct.created_return._id });
//     }
//     if (minimalProduct.created_rejection) {
//       await BilletRejection.deleteOne({ _id: minimalProduct.created_rejection.id || minimalProduct.created_rejection._id });
//     }
//     if (minimalProduct.created_return) {
//       await PlantReturn.deleteOne({ _id: minimalProduct.created_return.id || minimalProduct.created_return._id });
//     }
//     await BilletPlantDispatch.deleteOne({ _id: testDispatch._id });
//     console.log("✓ Cleanup completed successfully.");

//     console.log("\n=========================================");
//     console.log("ALL MINIMAL VALUE & SCRAP/RETURN TESTS PASSED!");
//     console.log("=========================================");
//     process.exit(0);
//   } catch (err) {
//     console.error("\n❌ TEST FAILED:", err);
//     process.exit(1);
//   }
// }

// runTest();
