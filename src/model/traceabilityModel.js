import mongoose from "mongoose";
import { BilletHeat } from "./billetHeatModel.js";
import { BilletLength } from "./billetLengthModel.js";
import { BilletLabCheck } from "./billetLabModel.js";
import { BilletPlantDispatch } from "./dispatchModel.js";
import { FinishedProduct } from "./finishedProductModel.js";
import { BilletRejection } from "./rejectionModel.js";
import { PlantReturn } from "./plantReturnModel.js";

export const getFullHeatTraceability = async (heatNumber) => {
  if (!heatNumber) return null;
  const cleanHeatNo = heatNumber.trim().toUpperCase();

  const heat = await BilletHeat.findOne({ heat_number: cleanHeatNo }).populate("created_by", "name");
  if (!heat) return null;

  const [lengths, labCheck, dispatches, finishedProducts, rejections, returns] = await Promise.all([
    BilletLength.find({ heat_id: heat._id }).sort({ length_meters: -1, created_at: 1 }),
    BilletLabCheck.findOne({ heat_id: heat._id })
      .populate("tested_by_id", "name")
      .populate("approved_by_id", "name"),
    BilletPlantDispatch.find({ heat_id: heat._id })
      .sort({ created_at: 1 })
      .populate("dispatched_by_id", "name"),
    FinishedProduct.find({ heat_id: heat._id })
      .sort({ created_at: 1 })
      .populate("operator_id", "name"),
    BilletRejection.find({ heat_id: heat._id })
      .sort({ created_at: 1 })
      .populate("reported_by_id", "name"),
    PlantReturn.find({ heat_id: heat._id })
      .sort({ created_at: 1 })
      .populate("authorized_by_id", "name")
  ]);

  const castWeightMt = Number(heat.total_weight_mt) || 0;
  const availableYardWeightMt = Number(heat.available_weight_mt) || 0;

  const dispatchedWeightMt = dispatches.reduce((acc, cur) => acc + Number(cur.dispatched_weight_mt || 0), 0);
  const finishedWeightMt = finishedProducts.reduce((acc, cur) => acc + Number(cur.finished_weight_mt || 0), 0);
  const rejectionScrapWeightMt = rejections.reduce((acc, cur) => acc + Number(cur.rejected_weight_mt || 0), 0);
  const returnedWeightMt = returns.reduce((acc, cur) => acc + Number(cur.returned_weight_mt || 0), 0);

  const unaccountedDeltaOrScaleLossMt = dispatchedWeightMt > 0
    ? Number((dispatchedWeightMt - finishedWeightMt - rejectionScrapWeightMt - returnedWeightMt).toFixed(3))
    : 0;

  const overallRecoveryRatePct = dispatchedWeightMt > 0
    ? Number(((finishedWeightMt / dispatchedWeightMt) * 100).toFixed(2))
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
    return j;
  });

  const finishedJson = finishedProducts.map((fp) => {
    const j = fp.toJSON();
    j.operator_name = fp.operator_id ? fp.operator_id.name : null;
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
      total_weight_mt: Number(heat.total_weight_mt),
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
      current_yard_available_pieces: Number(heat.available_pieces) || 0,
      current_yard_available_weight_mt: availableYardWeightMt,
      total_sent_to_plant_pieces: dispatches.reduce((acc, cur) => acc + Number(cur.dispatched_pieces || 0), 0),
      total_sent_to_plant_mt: Number(dispatchedWeightMt.toFixed(3)),
      good_finished_product_pieces: finishedProducts.reduce((acc, cur) => acc + Number(cur.finished_pieces || 0), 0),
      good_finished_product_weight_mt: Number(finishedWeightMt.toFixed(3)),
      rejection_scrap_pieces: rejections.reduce((acc, cur) => acc + Number(cur.rejected_pieces || 0), 0),
      rejection_scrap_loss_mt: Number(rejectionScrapWeightMt.toFixed(3)),
      returned_to_yard_pieces: returns.reduce((acc, cur) => acc + Number(cur.returned_pieces || 0), 0),
      returned_to_yard_or_remelt_mt: Number(returnedWeightMt.toFixed(3)),
      scale_loss_or_burning_loss_mt: unaccountedDeltaOrScaleLossMt,
      rolling_yield_recovery_pct: overallRecoveryRatePct,
      reconciliation_status:
        Math.abs(unaccountedDeltaOrScaleLossMt) < dispatchedWeightMt * 0.05 ? "BALANCED" : "REVIEW_REQUIRED"
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

  return {
    heats: heatStats[0] || {
      total_heats: 0,
      total_cast_pieces: 0,
      total_cast_weight_mt: 0,
      total_available_pieces: 0,
      total_available_weight_mt: 0
    },
    dispatches: dispatchStats[0] || {
      total_dispatches: 0,
      total_dispatched_pieces: 0,
      total_dispatched_weight_mt: 0
    },
    finished_production: finishedStats[0] ? {
      ...finishedStats[0],
      average_yield_pct: Number((finishedStats[0].average_yield_pct || 0).toFixed(2))
    } : {
      total_batches: 0,
      total_finished_pieces: 0,
      total_finished_weight_mt: 0,
      average_yield_pct: 0
    },
    rejections: rejectionStats[0] || {
      total_rejections: 0,
      total_rejected_pieces: 0,
      total_rejected_weight_mt: 0
    },
    returns: returnStats[0] || {
      total_returns: 0,
      total_returned_pieces: 0,
      total_returned_weight_mt: 0
    }
  };
};

export const searchTraceability = async (searchTerm) => {
  const termRegex = { $regex: searchTerm.trim(), $options: "i" };

  const [heats, finished, dispatches, lab] = await Promise.all([
    BilletHeat.find({
      $or: [{ heat_number: termRegex }, { grade: termRegex }]
    })
      .select("id heat_number grade section status")
      .limit(10),
    FinishedProduct.find({
      $or: [{ production_batch_number: termRegex }, { finished_product_name: termRegex }]
    })
      .select("id production_batch_number heat_number finished_product_name finished_size")
      .limit(10),
    BilletPlantDispatch.find({
      $or: [{ dispatch_number: termRegex }, { target_plant: termRegex }]
    })
      .select("id dispatch_number heat_number target_plant")
      .limit(10),
    BilletLabCheck.find({
      $or: [{ test_certificate_no: termRegex }, { heat_number: termRegex }]
    })
      .select("id heat_number test_certificate_no verdict")
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
