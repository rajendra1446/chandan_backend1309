import {
  createHeatWithLengths,
  findAllHeats,
  findHeatById,
  findHeatByNumber,
  updateHeat,
  deleteHeat
} from "../model/billetHeatModel.js";
import {
  addLengthToHeat,
  findLengthById,
  updateLength,
  deleteLength
} from "../model/billetLengthModel.js";

export const createHeat = async (req, res, next) => {
  try {
    const { heat_number, grade, section, status, remarks, lengths } = req.body;

    const existing = await findHeatByNumber(heat_number);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Heat '${heat_number.toUpperCase()}' already exists. Please use a unique heat number.`
      });
    }

    const heat = await createHeatWithLengths(
      { heat_number, grade, section, status, remarks },
      lengths || [],
      req.user.id
    );

    res.status(201).json({
      success: true,
      message: `Billet Heat '${heat.heat_number}' created successfully.`,
      data: heat
    });
  } catch (error) {
    next(error);
  }
};

export const getHeats = async (req, res, next) => {
  try {
    const { grade, status, search, limit, offset, page } = req.query;
    const limitNum = limit !== undefined ? parseInt(limit, 10) : 10;
    const pageNum = page !== undefined ? parseInt(page, 10) : (offset !== undefined ? Math.floor(parseInt(offset, 10) / limitNum) + 1 : 1);
    const offsetNum = offset !== undefined ? parseInt(offset, 10) : (pageNum - 1) * limitNum;

    const result = await findAllHeats({
      grade,
      status,
      search,
      limit: limitNum,
      offset: offsetNum
    });

    res.json({
      success: true,
      data: result.items,
      pagination: {
        total: result.total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(result.total / limitNum) || 1,
        offset: offsetNum
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getHeat = async (req, res, next) => {
  try {
    const { id } = req.params;
    let heat = null;

    heat = await findHeatById(id);
    if (!heat) {
      heat = await findHeatByNumber(id);
    }

    if (!heat) {
      return res.status(404).json({
        success: false,
        message: `Billet heat '${id}' not found.`
      });
    }

    res.json({
      success: true,
      data: heat
    });
  } catch (error) {
    next(error);
  }
};

export const editHeat = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updated = await updateHeat(id, req.body);

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: `Billet heat #${id} not found.`
      });
    }

    res.json({
      success: true,
      message: `Billet heat '${updated.heat_number}' updated successfully.`,
      data: updated
    });
  } catch (error) {
    next(error);
  }
};

export const removeHeat = async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await deleteHeat(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: `Billet heat #${id} not found.`
      });
    }

    res.json({
      success: true,
      message: `Billet heat '${deleted.heat_number}' and associated records deleted.`,
      data: deleted
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// Length Specific CRUD ("length add different different")
// ============================================
export const addLength = async (req, res, next) => {
  try {
    const { heat_id, heat_number, length_meters, piece_count, weight_per_piece_kg, total_weight_mt, bundle_code, remarks } = req.body;

    let targetHeatId = heat_id;
    if (!targetHeatId && heat_number) {
      const heat = await findHeatByNumber(heat_number);
      if (heat) targetHeatId = heat.id;
    }

    if (!targetHeatId) {
      return res.status(400).json({
        success: false,
        message: "Please specify a valid 'heat_id' or 'heat_number' to attach this length to."
      });
    }

    const newLength = await addLengthToHeat(targetHeatId, {
      length_meters,
      piece_count,
      weight_per_piece_kg,
      total_weight_mt,
      bundle_code,
      remarks
    });

    res.status(201).json({
      success: true,
      message: `Length ${newLength.length_meters}m (${newLength.piece_count} pcs) added to heat.`,
      data: newLength
    });
  } catch (error) {
    next(error);
  }
};

export const getLength = async (req, res, next) => {
  try {
    const { id } = req.params;
    const length = await findLengthById(id);

    if (!length) {
      return res.status(404).json({
        success: false,
        message: `Billet length record #${id} not found.`
      });
    }

    res.json({
      success: true,
      data: length
    });
  } catch (error) {
    next(error);
  }
};

export const editLength = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updated = await updateLength(id, req.body);

    res.json({
      success: true,
      message: `Billet length record #${id} updated successfully.`,
      data: updated
    });
  } catch (error) {
    next(error);
  }
};

export const removeLength = async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await deleteLength(id);

    res.json({
      success: true,
      message: `Billet length record #${id} deleted and heat totals updated.`,
      data: deleted
    });
  } catch (error) {
    next(error);
  }
};
