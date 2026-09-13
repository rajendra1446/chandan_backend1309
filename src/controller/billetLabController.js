import {
  createOrUpdateLabCheck,
  findLabCheckById,
  findLabCheckByHeatId,
  updateLabCheck,
  deleteLabCheck
} from "../model/billetLabModel.js";
import { findHeatByNumber } from "../model/billetHeatModel.js";

export const submitLabCheck = async (req, res, next) => {
  try {
    const { heat_id, heat_number } = req.body;

    let targetHeatId = heat_id;
    if (!targetHeatId && heat_number) {
      const heat = await findHeatByNumber(heat_number);
      if (heat) targetHeatId = heat.id;
    }

    if (!targetHeatId) {
      return res.status(400).json({
        success: false,
        message: "Valid 'heat_id' or 'heat_number' is required to submit a lab check."
      });
    }

    const labRecord = await createOrUpdateLabCheck(targetHeatId, req.body, req.user.id);

    res.status(200).json({
      success: true,
      message: `Lab check submitted with verdict: ${labRecord.verdict}.`,
      data: labRecord
    });
  } catch (error) {
    next(error);
  }
};

export const getLabByHeat = async (req, res, next) => {
  try {
    const { heatIdOrNumber } = req.params;
    let lab = null;

    lab = await findLabCheckByHeatId(heatIdOrNumber);
    if (!lab) {
      const heat = await findHeatByNumber(heatIdOrNumber);
      if (heat) {
        lab = await findLabCheckByHeatId(heat.id);
      }
    }

    if (!lab) {
      return res.status(404).json({
        success: false,
        message: `No lab check report found for heat '${heatIdOrNumber}'.`
      });
    }

    res.json({
      success: true,
      data: lab
    });
  } catch (error) {
    next(error);
  }
};

export const getLabById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const lab = await findLabCheckById(id);

    if (!lab) {
      return res.status(404).json({
        success: false,
        message: `Lab check record #${id} not found.`
      });
    }

    res.json({
      success: true,
      data: lab
    });
  } catch (error) {
    next(error);
  }
};

export const editLab = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updated = await updateLabCheck(id, req.body, req.user.id);

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: `Lab check record #${id} not found.`
      });
    }

    res.json({
      success: true,
      message: `Lab check #${id} updated successfully.`,
      data: updated
    });
  } catch (error) {
    next(error);
  }
};

export const removeLab = async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await deleteLabCheck(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: `Lab check record #${id} not found.`
      });
    }

    res.json({
      success: true,
      message: `Lab check #${id} deleted and parent heat status reset to CAST.`,
      data: deleted
    });
  } catch (error) {
    next(error);
  }
};
