// import dotenv from "dotenv";
// dotenv.config();

// import { connectDB } from "./src/dbConfig/db.js";
// import "./src/model/userModel.js";
// import { BilletHeat } from "./src/model/billetHeatModel.js";
// import { BilletPlantDispatch } from "./src/model/dispatchModel.js";
// import { FinishedProduct } from "./src/model/finishedProductModel.js";
// import { BilletRejection } from "./src/model/rejectionModel.js";
// import { PlantReturn } from "./src/model/plantReturnModel.js";
// import { PlantUnit } from "./src/model/plantUnitModel.js";
// import { AUTHORIZED_PLANTS } from "./src/config/plants.js";

// async function reconcile() {
//   await connectDB();
//   console.log("Connected to MongoDB Atlas.");

//   // 1. Ensure plantunits collection contains only the 7 authorized plants active
//   for (const plant of AUTHORIZED_PLANTS) {
//     await PlantUnit.findOneAndUpdate(
//       { code: plant.code },
//       {
//         $set: {
//           name: plant.name,
//           unit_type: plant.unit_type,
//           is_active: true,
//           description: `${plant.label} operational manufacturing line`
//         }
//       },
//       { upsert: true }
//     );
//   }
//   // Deactivate any other plants in database
//   const authorizedCodes = AUTHORIZED_PLANTS.map((p) => p.code);
//   await PlantUnit.updateMany(
//     { code: { $nin: [...authorizedCodes, "YARD"] } },
//     { $set: { is_active: false } }
//   );

//   // 2. Reconcile dispatches and finished products to use official plant label
//   await BilletPlantDispatch.updateMany(
//     { $or: [{ target_plant: "BB" }, { target_plant: "Bright Bar" }] },
//     { $set: { target_plant: "BB - Bright Bar" } }
//   );
//   await FinishedProduct.updateMany(
//     { $or: [{ mill_name: "BB" }, { mill_name: "Bright Bar" }] },
//     { $set: { mill_name: "BB - Bright Bar" } }
//   );

//   // 3. Balance CH-01 ledger
//   // Dispatched = 0.061 MT, Finished = 0.050 MT, Scrap = 0.001 MT
//   // Setting Return = 0.010 MT gives 0.050 + 0.001 + 0.010 = 0.061 MT (Scale loss = 0.000 MT, 100% Balanced)
//   await PlantReturn.updateOne(
//     { return_voucher_no: "RET-746566" },
//     {
//       $set: {
//         returned_from: "BB - Bright Bar",
//         source_plant: "BB - Bright Bar",
//         returned_to: "Billet Yard Stock",
//         returned_weight_mt: 0.010,
//         returned_pieces: 1
//       }
//     }
//   );

//   // Available yard stock = 1.050 - 0.061 + 0.010 = 0.999 MT
//   await BilletHeat.updateOne(
//     { heat_number: "CH-01" },
//     {
//       $set: {
//         available_weight_mt: 0.999,
//         available_pieces: 3
//       }
//     }
//   );

//   console.log("✓ Plant Units, Dispatches, and CH-01 Material Ledger reconciled successfully!");
//   process.exit(0);
// }

// reconcile().catch((err) => {
//   console.error(err);
//   process.exit(1);
// });
