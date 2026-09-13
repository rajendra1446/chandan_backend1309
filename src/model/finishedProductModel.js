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

  const { BilletPlantDispatch } = await import("./dispatchModel.js");
  const validDispatchId = productData.dispatch_id && mongoose.isValidObjectId(productData.dispatch_id)
    ? productData.dispatch_id
    : null;

  if (validDispatchId) {
    const dispatch = await BilletPlantDispatch.findById(validDispatchId);
    if (!dispatch) {
      throw new Error(`Referenced dispatch #${validDispatchId} not found.`);
    }
    const previousProducts = await FinishedProduct.find({ dispatch_id: validDispatchId });
    const usedInputWeight = previousProducts.reduce((sum, p) => sum + (Number(p.input_billet_weight_mt) || 0), 0);
    const remainingDispatchMaterial = Number(Math.max(0, dispatch.dispatched_weight_mt - usedInputWeight).toFixed(3));

    if (inputWeight > remainingDispatchMaterial + 0.005) {
      throw new Error(
        `Input billet weight (${inputWeight} MT) exceeds remaining unconsumed material (${remainingDispatchMaterial} MT) for dispatch #${dispatch.dispatch_number}.`
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
    const availableMaterial = Number(Math.max(0, totalDispatched - usedInputWeight).toFixed(3));

    if (inputWeight > availableMaterial + 0.005) {
      throw new Error(
        `Input billet weight (${inputWeight} MT) exceeds available dispatched material (${availableMaterial} MT) for heat '${heat.heat_number}'.`
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

  return await findFinishedProductById(doc._id);
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
