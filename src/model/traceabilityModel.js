import mongoose from "mongoose";
import { BilletHeat } from "./billetHeatModel.js";
import { BilletLength } from "./billetLengthModel.js";
import { BilletLabCheck } from "./billetLabModel.js";
import { BilletPlantDispatch } from "./dispatchModel.js";
import { FinishedProduct } from "./finishedProductModel.js";
import { BilletRejection } from "./rejectionModel.js";
import { PlantReturn } from "./plantReturnModel.js";
import { formatPlantName } from "../config/plants.js";

export const getFullHeatTraceability = async (heatNumber) => {
  if (!heatNumber) return null;
  const cleanHeatNo = heatNumber.trim().toUpperCase();

  const heat = await BilletHeat.findOne({
    $or: [
      { heat_number: cleanHeatNo },
      ...(mongoose.isValidObjectId(cleanHeatNo) ? [{ _id: cleanHeatNo }] : [])
    ]
  }).populate("created_by", "name");
  if (!heat) return null;

  const heatId = heat._id;
  const heatNo = heat.heat_number;

  // 1. First fetch lengths, lab check, and dispatches directly associated with this heat
  const [lengths, labCheck, dispatches] = await Promise.all([
    BilletLength.find({
      $or: [{ heat_id: heatId }, { heat_number: heatNo }]
    }).sort({ length_meters: -1, created_at: 1 }),

    BilletLabCheck.findOne({
      $or: [{ heat_id: heatId }, { heat_number: heatNo }]
    })
      .populate("tested_by_id", "name")
      .populate("approved_by_id", "name"),

    BilletPlantDispatch.find({
      $or: [{ heat_id: heatId }, { heat_number: heatNo }]
    })
      .sort({ created_at: 1 })
      .populate("dispatched_by_id", "name")
  ]);

  const dispatchIds = dispatches.map((d) => d._id);

  // 2. Fetch finished products linked by heat or through dispatches of this heat
  const finishedProducts = await FinishedProduct.find({
    $or: [
      { heat_id: heatId },
      { heat_number: heatNo },
      ...(dispatchIds.length ? [{ dispatch_id: { $in: dispatchIds } }] : [])
    ]
  })
    .sort({ created_at: 1 })
    .populate("operator_id", "name");

  const finishedIds = finishedProducts.map((fp) => fp._id);

  // 3. Fetch rejections & plant returns linked by heat, dispatch, or production batch
  const [rejections, returns] = await Promise.all([
    BilletRejection.find({
      $or: [
        { heat_id: heatId },
        { heat_number: heatNo },
        ...(dispatchIds.length ? [{ dispatch_id: { $in: dispatchIds } }] : []),
        ...(finishedIds.length ? [{ production_id: { $in: finishedIds } }] : [])
      ]
    })
      .sort({ created_at: 1 })
      .populate("reported_by_id", "name"),

    PlantReturn.find({
      $or: [
        { heat_id: heatId },
        { heat_number: heatNo },
        ...(dispatchIds.length ? [{ dispatch_id: { $in: dispatchIds } }] : [])
      ]
    })
      .sort({ created_at: 1 })
      .populate("authorized_by_id", "name")
  ]);

  const castWeightMt = Math.max(0, Number(heat.total_weight_mt) || 0);
  const availableYardWeightMt = Math.max(0, Number(heat.available_weight_mt) || 0);

  const dispatchedWeightMt = Math.max(
    0,
    dispatches.reduce((acc, cur) => acc + Number(cur.dispatched_weight_mt || 0), 0)
  );
  const finishedWeightMt = Math.max(
    0,
    finishedProducts.reduce((acc, cur) => acc + Number(cur.finished_weight_mt || 0), 0)
  );
  const rejectionScrapWeightMt = Math.max(
    0,
    rejections.reduce((acc, cur) => acc + Number(cur.rejected_weight_mt || 0), 0)
  );
  const returnedWeightMt = Math.max(
    0,
    returns.reduce((acc, cur) => acc + Number(cur.returned_weight_mt || 0), 0)
  );

  const rawDelta = dispatchedWeightMt - finishedWeightMt - rejectionScrapWeightMt - returnedWeightMt;
  const unaccountedDeltaOrScaleLossMt = dispatchedWeightMt > 0
    ? (rawDelta > 0.0005 ? Number(rawDelta.toFixed(3)) : 0)
    : 0;
  const discrepancyMt = rawDelta < -0.0005 ? Number(Math.abs(rawDelta).toFixed(3)) : 0;

  const overallRecoveryRatePct = dispatchedWeightMt > 0
    ? Math.min(100, Number(((finishedWeightMt / dispatchedWeightMt) * 100).toFixed(2)))
    : 0;

  const labJson = labCheck ? {
    ...labCheck.toJSON(),
    tested_by_name: labCheck.tested_by_id ? labCheck.tested_by_id.name : null,
    approved_by_name: labCheck.approved_by_id ? labCheck.approved_by_id.name : null
  } : {
    verdict: "NOT_TESTED",
    message: "No lab check record has been entered for this heat."
  };

  const dispatchesJson = dispatches.map((d) => {
    const j = d.toJSON();
    j.dispatched_by_name = d.dispatched_by_id ? d.dispatched_by_id.name : null;
    j.target_plant = formatPlantName(d.target_plant);
    return j;
  });

  const finishedJson = finishedProducts.map((fp) => {
    const j = fp.toJSON();
    j.operator_name = fp.operator_id ? fp.operator_id.name : null;
    j.mill_name = formatPlantName(fp.mill_name);
    return j;
  });

  const rejectionsJson = rejections.map((r) => {
    const j = r.toJSON();
    j.reported_by_name = r.reported_by_id ? r.reported_by_id.name : null;
    return j;
  });

  const returnsJson = returns.map((pr) => {
    const j = pr.toJSON();
    j.authorized_by_name = pr.authorized_by_id ? pr.authorized_by_id.name : null;
    j.source_plant = formatPlantName(pr.source_plant || pr.returned_from);
    j.returned_from = formatPlantName(pr.returned_from || pr.source_plant);
    return j;
  });

  return {
    heat_number: heat.heat_number,
    grade: heat.grade,
    section: heat.section,
    status: heat.status,
    casting_details: {
      heat_id: heat._id.toString(),
      heat_number: heat.heat_number,
      grade: heat.grade,
      section: heat.section,
      casting_date: heat.casting_date,
      total_pieces: heat.total_pieces,
      cast_pieces: heat.total_pieces,
      total_weight_mt: Number(heat.total_weight_mt),
      cast_weight_mt: Number(heat.total_weight_mt),
      available_pieces: heat.available_pieces,
      available_weight_mt: Number(heat.available_weight_mt),
      cast_by: heat.created_by ? heat.created_by.name : null,
      remarks: heat.remarks
    },
    length_breakdown: lengths.map((l) => l.toJSON()),
    quality_lab_check: labJson,
    plant_dispatches: dispatchesJson,
    finished_products: finishedJson,
    rejections_and_scrap: rejectionsJson,
    plant_returns: returnsJson,
    material_balance_reconciliation: {
      total_cast_pieces: Number(heat.total_pieces) || 0,
      total_cast_weight_mt: castWeightMt,
      cast_pieces: Number(heat.total_pieces) || 0,
      cast_weight_mt: castWeightMt,
      current_yard_available_pieces: Number(heat.available_pieces) || 0,
      current_yard_available_weight_mt: availableYardWeightMt,
      total_sent_to_plant_pieces: dispatches.reduce((acc, cur) => acc + Number(cur.dispatched_pieces || 0), 0),
      total_sent_to_plant_mt: Number(dispatchedWeightMt.toFixed(3)),
      dispatched_mt: Number(dispatchedWeightMt.toFixed(3)),
      good_finished_product_pieces: finishedProducts.reduce((acc, cur) => acc + Number(cur.finished_pieces || 0), 0),
      good_finished_product_weight_mt: Number(finishedWeightMt.toFixed(3)),
      finished_mt: Number(finishedWeightMt.toFixed(3)),
      rejection_scrap_pieces: rejections.reduce((acc, cur) => acc + Number(cur.rejected_pieces || 0), 0),
      rejection_scrap_loss_mt: Number(rejectionScrapWeightMt.toFixed(3)),
      rejection_scrap_mt: Number(rejectionScrapWeightMt.toFixed(3)),
      returned_to_yard_pieces: returns.reduce((acc, cur) => acc + Number(cur.returned_pieces || 0), 0),
      returned_to_yard_or_remelt_mt: Number(returnedWeightMt.toFixed(3)),
      returned_mt: Number(returnedWeightMt.toFixed(3)),
      scale_loss_or_burning_loss_mt: unaccountedDeltaOrScaleLossMt,
      unaccounted_delta_or_scale_loss_mt: unaccountedDeltaOrScaleLossMt,
      discrepancy_mt: discrepancyMt,
      is_balanced: Math.abs(rawDelta) < 0.0005,
      rolling_yield_recovery_pct: overallRecoveryRatePct,
      overall_recovery_rate_pct: overallRecoveryRatePct,
      reconciliation_status:
        Math.abs(rawDelta) < 0.0005
          ? "BALANCED"
          : rawDelta < -0.0005
          ? "DISCREPANCY"
          : "ACTIVE"
    }
  };
};

export const getTraceabilityDashboardSummary = async () => {
  const [heatStats, dispatchStats, finishedStats, rejectionStats, returnStats] = await Promise.all([
    BilletHeat.aggregate([
      {
        $group: {
          _id: null,
          total_heats: { $sum: 1 },
          total_cast_pieces: { $sum: "$total_pieces" },
          total_cast_weight_mt: { $sum: "$total_weight_mt" },
          total_available_pieces: { $sum: "$available_pieces" },
          total_available_weight_mt: { $sum: "$available_weight_mt" }
        }
      }
    ]),
    BilletPlantDispatch.aggregate([
      {
        $group: {
          _id: null,
          total_dispatches: { $sum: 1 },
          total_dispatched_pieces: { $sum: "$dispatched_pieces" },
          total_dispatched_weight_mt: { $sum: "$dispatched_weight_mt" }
        }
      }
    ]),
    FinishedProduct.aggregate([
      {
        $group: {
          _id: null,
          total_batches: { $sum: 1 },
          total_finished_pieces: { $sum: "$finished_pieces" },
          total_finished_weight_mt: { $sum: "$finished_weight_mt" },
          average_yield_pct: { $avg: "$yield_percentage" }
        }
      }
    ]),
    BilletRejection.aggregate([
      {
        $group: {
          _id: null,
          total_rejections: { $sum: 1 },
          total_rejected_pieces: { $sum: "$rejected_pieces" },
          total_rejected_weight_mt: { $sum: "$rejected_weight_mt" }
        }
      }
    ]),
    PlantReturn.aggregate([
      {
        $group: {
          _id: null,
          total_returns: { $sum: 1 },
          total_returned_pieces: { $sum: "$returned_pieces" },
          total_returned_weight_mt: { $sum: "$returned_weight_mt" }
        }
      }
    ])
  ]);

  const h = heatStats[0] || {
    total_heats: 0,
    total_cast_pieces: 0,
    total_cast_weight_mt: 0,
    total_available_pieces: 0,
    total_available_weight_mt: 0
  };
  const d = dispatchStats[0] || {
    total_dispatches: 0,
    total_dispatched_pieces: 0,
    total_dispatched_weight_mt: 0
  };
  const f = finishedStats[0] || {
    total_batches: 0,
    total_finished_pieces: 0,
    total_finished_weight_mt: 0,
    average_yield_pct: 0
  };
  const r = rejectionStats[0] || {
    total_rejections: 0,
    total_rejected_pieces: 0,
    total_rejected_weight_mt: 0
  };
  const ret = returnStats[0] || {
    total_returns: 0,
    total_returned_pieces: 0,
    total_returned_weight_mt: 0
  };

  const totalCastMt = Number((h.total_cast_weight_mt || 0).toFixed(3));
  const totalDispatchedMt = Number((d.total_dispatched_weight_mt || 0).toFixed(3));
  const totalFinishedMt = Number((f.total_finished_weight_mt || 0).toFixed(3));
  const totalRejectedMt = Number((r.total_rejected_weight_mt || 0).toFixed(3));
  const totalReturnedMt = Number((ret.total_returned_weight_mt || 0).toFixed(3));
  const overallYield = totalDispatchedMt > 0 ? Number(((totalFinishedMt / totalDispatchedMt) * 100).toFixed(2)) : 0;

  return {
    heats_count: h.total_heats || 0,
    total_cast_pieces: h.total_cast_pieces || 0,
    total_cast_weight_mt: totalCastMt,
    total_available_pieces: h.total_available_pieces || 0,
    total_available_weight_mt: Number((h.total_available_weight_mt || 0).toFixed(3)),

    dispatches_count: d.total_dispatches || 0,
    total_dispatched_pieces: d.total_dispatched_pieces || 0,
    total_dispatched_weight_mt: totalDispatchedMt,

    finished_batches_count: f.total_batches || 0,
    total_finished_pieces: f.total_finished_pieces || 0,
    total_finished_weight_mt: totalFinishedMt,
    overall_recovery_pct: overallYield,

    rejections_count: r.total_rejections || 0,
    total_rejected_pieces: r.total_rejected_pieces || 0,
    total_rejected_weight_mt: totalRejectedMt,

    returns_count: ret.total_returns || 0,
    total_returned_pieces: ret.total_returned_pieces || 0,
    total_returned_weight_mt: totalReturnedMt,

    // Nested groups for backwards-compatibility:
    heats: h,
    dispatches: d,
    finished_production: { ...f, average_yield_pct: overallYield },
    rejections: r,
    returns: ret
  };
};

export const searchTraceability = async (searchTerm) => {
  if (!searchTerm || !searchTerm.trim()) {
    return { heats: [], finished_products: [], dispatches: [], lab_checks: [] };
  }
  const cleanTerm = searchTerm.trim();
  const termRegex = { $regex: cleanTerm, $options: "i" };

  const [heats, finished, dispatches, lab] = await Promise.all([
    BilletHeat.find({
      $or: [{ heat_number: termRegex }, { grade: termRegex }, { section: termRegex }]
    })
      .select("id _id heat_number grade section status total_weight_mt available_weight_mt")
      .limit(10),
    FinishedProduct.find({
      $or: [{ production_batch_number: termRegex }, { finished_product_name: termRegex }, { heat_number: termRegex }, { lot_number: termRegex }]
    })
      .select("id _id production_batch_number heat_number finished_product_name finished_size finished_weight_mt")
      .limit(10),
    BilletPlantDispatch.find({
      $or: [{ dispatch_number: termRegex }, { target_plant: termRegex }, { heat_number: termRegex }, { vehicle_number: termRegex }]
    })
      .select("id _id dispatch_number heat_number target_plant dispatched_weight_mt")
      .limit(10),
    BilletLabCheck.find({
      $or: [{ test_certificate_no: termRegex }, { heat_number: termRegex }, { verdict: termRegex }]
    })
      .select("id _id heat_number test_certificate_no verdict")
      .limit(10)
  ]);

  return {
    heats: heats.map((h) => h.toJSON()),
    finished_products: finished.map((f) => f.toJSON()),
    dispatches: dispatches.map((d) => d.toJSON()),
    lab_checks: lab.map((l) => l.toJSON())
  };
};

export default {
  getFullHeatTraceability,
  getTraceabilityDashboardSummary,
  searchTraceability
};
