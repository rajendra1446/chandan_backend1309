import {
  recordRejection,
  findAllRejections,
  findRejectionById,
  updateRejection,
  deleteRejection
} from "../model/rejectionModel.js";

export const addRejection = async (req, res, next) => {
  try {
    const rejection = await recordRejection(req.body, req.user.id);
    res.status(201).json({
      success: true,
      message: `Rejection recorded: ${rejection.rejected_weight_mt} MT of '${rejection.rejection_type}' at stage '${rejection.stage}'.`,
      data: rejection
    });
  } catch (error) {
    next(error);
  }
};

export const getRejections = async (req, res, next) => {
  try {
    const { heat_number, stage, rejection_type, search, limit, offset, page } = req.query;
    const limitNum = limit !== undefined ? parseInt(limit, 10) : 10;
    const pageNum = page !== undefined ? parseInt(page, 10) : (offset !== undefined ? Math.floor(parseInt(offset, 10) / limitNum) + 1 : 1);
    const offsetNum = offset !== undefined ? parseInt(offset, 10) : (pageNum - 1) * limitNum;

    const result = await findAllRejections({
      heat_number,
      stage,
      rejection_type,
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

export const getRejection = async (req, res, next) => {
  try {
    const { id } = req.params;
    const rejection = await findRejectionById(id);

    if (!rejection) {
      return res.status(404).json({
        success: false,
        message: `Rejection record #${id} not found.`
      });
    }

    res.json({
      success: true,
      data: rejection
    });
  } catch (error) {
    next(error);
  }
};

export const editRejection = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updated = await updateRejection(id, req.body);

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: `Rejection record #${id} not found.`
      });
    }

    res.json({
      success: true,
      message: `Rejection record #${id} updated successfully.`,
      data: updated
    });
  } catch (error) {
    next(error);
  }
};

export const removeRejection = async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await deleteRejection(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: `Rejection record #${id} not found.`
      });
    }

    res.json({
      success: true,
      message: `Rejection record #${id} deleted successfully.`,
      data: deleted
    });
  } catch (error) {
    next(error);
  }
};
