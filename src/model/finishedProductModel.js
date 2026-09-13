import mongoose from "mongoose";

const finishedProductSchema = new mongoose.Schema(
  {
    production_batch_number: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true
    },
    dispatch_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BilletPlantDispatch",
      default: null
    },
    heat_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BilletHeat",
      required: true,
      index: true
    },
    heat_number: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    finished_product_name: {
      type: String,
      required: true,
      trim: true
    },
    finished_size: {
      type: String,
      required: true,
      trim: true
    },
    standard_specification: {
      type: String,
      trim: true,
      default: null
    },
    input_billet_weight_mt: {
      type: Number,
      required: true
    },
    finished_pieces: {
      type: Number,
      default: 0
    },
    finished_weight_mt: {
      type: Number,
      required: true
    },
    yield_percentage: {
      type: Number,
      required: true
    },
    mill_name: {
      type: String,
      trim: true,
      default: "Rolling Mill #1"
    },
    rolling_date: {
      type: Date,
      default: Date.now
    },
    operator_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    lot_number: {
      type: String,
      trim: true,
      default: null
    },
    bundle_tags: {
      type: [String],
      default: []
    },
    remarks: {
      type: String,
      trim: true,
      default: null
    }
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret.__v;
        return ret;
      }
    },
    toObject: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret.__v;
        return ret;
      }
    }
  }
);

export const FinishedProduct =
  mongoose.models.FinishedProduct || mongoose.model("FinishedProduct", finishedProductSchema);

export const recordFinishedProduct = async (productData, userId) => {
  const { BilletHeat } = await import("./billetHeatModel.js");

  const heatNumber = productData.heat_number.trim().toUpperCase();
  const heat = await BilletHeat.findOne({ heat_number: heatNumber });
  if (!heat) {
    throw new Error(`Billet heat '${productData.heat_number}' not found.`);
  }

  const inputWeight = Number(productData.input_billet_weight_mt);
  const finishedWeight = Number(productData.finished_weight_mt);

  if (inputWeight <= 0 || finishedWeight <= 0) {
    throw new Error("Input billet weight and finished product weight must be greater than zero.");
  }

  if (finishedWeight > inputWeight) {
    throw new Error(
      `Finished output weight (${finishedWeight} MT) cannot exceed input billet weight (${inputWeight} MT). Rolling yield cannot exceed 100%.`
    );
  }

  const scrapWeight = Number(productData.scrap_weight_mt) || 0;
  const returnedWeight = Number(productData.returned_weight_mt) || 0;

  if (scrapWeight < 0) {
    throw new Error("Scrap weight cannot be negative.");
  }
  if (returnedWeight < 0) {
    throw new Error("Returned weight cannot be negative.");
  }

  if (finishedWeight + scrapWeight > inputWeight + 0.005) {
    throw new Error(
      `Finished prime output (${finishedWeight} MT) + scrap (${scrapWeight} MT) cannot exceed input billet consumption (${inputWeight} MT).`
    );
  }

  const { BilletPlantDispatch } = await import("./dispatchModel.js");
  const validDispatchId = productData.dispatch_id && mongoose.isValidObjectId(productData.dispatch_id)
    ? productData.dispatch_id
    : null;

  const { BilletRejection } = await import("./rejectionModel.js");

  if (validDispatchId) {
    const dispatch = await BilletPlantDispatch.findById(validDispatchId);
    if (!dispatch) {
      throw new Error(`Referenced dispatch #${validDispatchId} not found.`);
    }
    const previousProducts = await FinishedProduct.find({ dispatch_id: validDispatchId });
    const usedInputWeight = previousProducts.reduce((sum, p) => sum + (Number(p.input_billet_weight_mt) || 0), 0);
    const existingRejections = await BilletRejection.find({ dispatch_id: validDispatchId });
    const rejectedWeight = existingRejections.reduce((sum, r) => sum + (Number(r.rejected_weight_mt) || 0), 0);
    const { PlantReturn } = await import("./plantReturnModel.js");
    const existingReturns = await PlantReturn.find({ dispatch_id: validDispatchId });
    const existingReturnWeight = existingReturns.reduce((sum, r) => sum + (Number(r.returned_weight_mt) || 0), 0);

    const remainingDispatchMaterial = Number(
      Math.max(0, dispatch.dispatched_weight_mt - usedInputWeight - rejectedWeight - existingReturnWeight).toFixed(3)
    );

    if (inputWeight + returnedWeight > remainingDispatchMaterial + 0.005) {
      throw new Error(
        `Material drawn from dispatch (Input: ${inputWeight} MT + Return: ${returnedWeight} MT) exceeds remaining unconsumed material (${remainingDispatchMaterial} MT) for dispatch #${dispatch.dispatch_number} (Dispatched: ${dispatch.dispatched_weight_mt} MT, Prior Products: ${usedInputWeight} MT, Rejections: ${rejectedWeight} MT, Prior Returns: ${existingReturnWeight} MT).`
      );
    }
  } else {
    // Check total dispatched material available for this heat
    const dispatches = await BilletPlantDispatch.find({ heat_number: heat.heat_number });
    const totalDispatched = dispatches.reduce((sum, d) => sum + (Number(d.dispatched_weight_mt) || 0), 0);
    if (totalDispatched <= 0) {
      throw new Error(
        `Cannot log production: Heat '${heat.heat_number}' has 0 MT dispatched to mills. Material must be dispatched to plant before production.`
      );
    }
    const previousProducts = await FinishedProduct.find({ heat_number: heat.heat_number });
    const usedInputWeight = previousProducts.reduce((sum, p) => sum + (Number(p.input_billet_weight_mt) || 0), 0);
    const existingRejections = await BilletRejection.find({
      heat_number: heat.heat_number,
      stage: { $in: ["ROLLING_MILL", "FINISHING"] }
    });
    const rejectedWeight = existingRejections.reduce((sum, r) => sum + (Number(r.rejected_weight_mt) || 0), 0);

    const { PlantReturn } = await import("./plantReturnModel.js");
    const existingReturns = await PlantReturn.find({ heat_number: heat.heat_number });
    const existingReturnWeight = existingReturns.reduce((sum, r) => sum + (Number(r.returned_weight_mt) || 0), 0);

    const availableMaterial = Number(
      Math.max(0, totalDispatched - usedInputWeight - rejectedWeight - existingReturnWeight).toFixed(3)
    );

    if (inputWeight + returnedWeight > availableMaterial + 0.005) {
      throw new Error(
        `Material drawn (Input: ${inputWeight} MT + Return: ${returnedWeight} MT) exceeds available dispatched material (${availableMaterial} MT) for heat '${heat.heat_number}'. (Dispatched: ${totalDispatched} MT, Products: ${usedInputWeight} MT, Scrap: ${rejectedWeight} MT, Returns: ${existingReturnWeight} MT).`
      );
    }
  }

  const yieldPercentage = Number(((finishedWeight / inputWeight) * 100).toFixed(2));
  const batchNumber = productData.production_batch_number || `FP-${Date.now().toString().slice(-6)}`;
  const validUserId = userId && mongoose.isValidObjectId(userId) ? userId : null;

  const doc = await FinishedProduct.create({
    production_batch_number: batchNumber,
    dispatch_id: validDispatchId,
    heat_id: heat._id,
    heat_number: heat.heat_number,
    finished_product_name: productData.finished_product_name.trim(),
    finished_size: productData.finished_size.trim(),
    standard_specification: productData.standard_specification || null,
    input_billet_weight_mt: inputWeight,
    finished_pieces: Number(productData.finished_pieces) || 0,
    finished_weight_mt: finishedWeight,
    yield_percentage: yieldPercentage,
    mill_name: productData.mill_name || "Rolling Mill #1",
    operator_id: validUserId,
    lot_number: productData.lot_number || null,
    bundle_tags: Array.isArray(productData.bundle_tags) ? productData.bundle_tags : [],
    remarks: productData.remarks || null
  });

  // Auto-record scrap rejection if specified
  let createdRejection = null;
  if (scrapWeight > 0) {
    const { BilletRejection } = await import("./rejectionModel.js");
    createdRejection = await BilletRejection.create({
      heat_id: heat._id,
      heat_number: heat.heat_number,
      dispatch_id: validDispatchId,
      production_id: doc._id,
      stage: "ROLLING_MILL",
      rejection_type: productData.scrap_rejection_type || "END_CROP_SCRAP",
      rejected_pieces: Number(productData.scrap_pieces) || 0,
      rejected_weight_mt: scrapWeight,
      disposition: "SCRAP_REMELT",
      rejection_reason: productData.scrap_reason || `End crop & cobble scrap generated during rolling of ${doc.finished_product_name}`,
      reported_by_id: validUserId,
      remarks: `Auto-linked from Finished Product Batch #${doc.production_batch_number}`
    });
  }

  // Auto-record return material if specified
  let createdReturn = null;
  if (returnedWeight > 0) {
    const { PlantReturn } = await import("./plantReturnModel.js");
    const voucherNo = `RET-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    const retPcs = Number(productData.returned_pieces) || 1;
    const retTo = productData.returned_to || "Billet Yard Stock";

    createdReturn = await PlantReturn.create({
      return_voucher_no: voucherNo,
      heat_id: heat._id,
      heat_number: heat.heat_number,
      dispatch_id: validDispatchId,
      returned_from: productData.mill_name || "Rolling Mill",
      returned_to: retTo,
      return_type: "UNUSED_BILLET_RETURN",
      returned_pieces: retPcs,
      returned_weight_mt: returnedWeight,
      return_reason: productData.return_reason || `Unused billet material returned from production batch #${doc.production_batch_number}`,
      stock_restored: true,
      authorized_by_id: validUserId,
      received_by_id: validUserId,
      remarks: `Auto-linked from Finished Product Batch #${doc.production_batch_number}`
    });

    // If restored to yard stock, restore available pieces & weight
    if (retTo.toLowerCase().includes("stock") || retTo.toLowerCase().includes("yard")) {
      heat.available_pieces = Math.min(heat.total_pieces, heat.available_pieces + retPcs);
      heat.available_weight_mt = Number(Math.min(heat.total_weight_mt, heat.available_weight_mt + returnedWeight).toFixed(3));
      await heat.save();
    }
  }

  const result = await findFinishedProductById(doc._id);
  if (result) {
    result.created_rejection = createdRejection ? createdRejection.toJSON() : null;
    result.created_return = createdReturn ? createdReturn.toJSON() : null;
  }
  return result;
};

export const findAllFinishedProducts = async ({ heat_number, product_name, search, limit = 50, offset = 0 }) => {
  const filter = {};
  if (heat_number) filter.heat_number = { $regex: heat_number, $options: "i" };
  if (product_name) filter.finished_product_name = { $regex: product_name, $options: "i" };
  if (search) {
    filter.$or = [
      { heat_number: { $regex: search, $options: "i" } },
      { finished_product_name: { $regex: search, $options: "i" } },
      { finished_size: { $regex: search, $options: "i" } },
      { mill_name: { $regex: search, $options: "i" } },
      { production_batch_number: { $regex: search, $options: "i" } }
    ];
  }

  const [items, total] = await Promise.all([
    FinishedProduct.find(filter)
      .sort({ created_at: -1 })
      .skip(offset)
      .limit(limit)
      .populate("operator_id", "name")
      .populate("heat_id", "grade section"),
    FinishedProduct.countDocuments(filter)
  ]);

  const enrichedItems = items.map((item) => {
    const json = item.toJSON();
    json.operator_name = item.operator_id ? item.operator_id.name : null;
    json.grade = item.heat_id ? item.heat_id.grade : null;
    json.section = item.heat_id ? item.heat_id.section : null;
    return json;
  });

  return {
    items: enrichedItems,
    total,
    limit,
    offset
  };
};

export const findFinishedProductById = async (id) => {
  if (!id || !mongoose.isValidObjectId(id)) return null;
  const product = await FinishedProduct.findById(id)
    .populate("operator_id", "name")
    .populate("heat_id", "grade section");
  if (!product) return null;

  const json = product.toJSON();
  json.operator_name = product.operator_id ? product.operator_id.name : null;
  json.grade = product.heat_id ? product.heat_id.grade : null;
  json.section = product.heat_id ? product.heat_id.section : null;
  return json;
};

export const updateFinishedProduct = async (id, updateData) => {
  if (!id || !mongoose.isValidObjectId(id)) return null;
  const current = await FinishedProduct.findById(id);
  if (!current) return null;

  if (updateData.finished_product_name !== undefined) current.finished_product_name = updateData.finished_product_name;
  if (updateData.finished_size !== undefined) current.finished_size = updateData.finished_size;
  if (updateData.standard_specification !== undefined) current.standard_specification = updateData.standard_specification;
  if (updateData.finished_pieces !== undefined) current.finished_pieces = Number(updateData.finished_pieces);
  if (updateData.mill_name !== undefined) current.mill_name = updateData.mill_name;
  if (updateData.lot_number !== undefined) current.lot_number = updateData.lot_number;
  if (updateData.remarks !== undefined) current.remarks = updateData.remarks;

  const inputWeight = updateData.input_billet_weight_mt !== undefined
    ? Number(updateData.input_billet_weight_mt)
    : current.input_billet_weight_mt;
  const finishedWeight = updateData.finished_weight_mt !== undefined
    ? Number(updateData.finished_weight_mt)
    : current.finished_weight_mt;

  current.input_billet_weight_mt = inputWeight;
  current.finished_weight_mt = finishedWeight;
  current.yield_percentage = Number(((finishedWeight / inputWeight) * 100).toFixed(2));

  await current.save();
  return await findFinishedProductById(id);
};

export const deleteFinishedProduct = async (id) => {
  if (!id || !mongoose.isValidObjectId(id)) return null;
  const deleted = await FinishedProduct.findByIdAndDelete(id);
  return deleted ? deleted.toJSON() : null;
};

export default FinishedProduct;
