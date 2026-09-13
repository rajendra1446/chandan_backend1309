import {
  recordPlantReturn,
  findAllReturns,
  findReturnById,
  updatePlantReturn,
  deletePlantReturn
} from "../model/plantReturnModel.js";

export const addReturn = async (req, res, next) => {
  try {
    const returnRecord = await recordPlantReturn(req.body, req.user.id);
    res.status(201).json({
      success: true,
      message: `Return recorded: ${returnRecord.returned_pieces} pcs (${returnRecord.returned_weight_mt} MT) returned from '${returnRecord.returned_from}' to '${returnRecord.returned_to}'.`,
      data: returnRecord
    });
  } catch (error) {
    next(error);
  }
};

export const getReturns = async (req, res, next) => {
  try {
    const { heat_number, return_type, search, limit, offset, page } = req.query;
    const limitNum = limit !== undefined ? parseInt(limit, 10) : 10;
    const pageNum = page !== undefined ? parseInt(page, 10) : (offset !== undefined ? Math.floor(parseInt(offset, 10) / limitNum) + 1 : 1);
    const offsetNum = offset !== undefined ? parseInt(offset, 10) : (pageNum - 1) * limitNum;

    const result = await findAllReturns({
      heat_number,
      return_type,
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

export const getReturn = async (req, res, next) => {
  try {
    const { id } = req.params;
    const record = await findReturnById(id);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: `Plant return record #${id} not found.`
      });
    }

    res.json({
      success: true,
      data: record
    });
  } catch (error) {
    next(error);
  }
};

export const editReturn = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updated = await updatePlantReturn(id, req.body);

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: `Plant return record #${id} not found.`
      });
    }

    res.json({
      success: true,
      message: `Plant return #${id} updated successfully.`,
      data: updated
    });
  } catch (error) {
    next(error);
  }
};

export const removeReturn = async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await deletePlantReturn(id);

    res.json({
      success: true,
      message: `Plant return #${id} deleted successfully.`,
      data: deleted
    });
  } catch (error) {
    next(error);
  }
};
