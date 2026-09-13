import {
  createPlantDispatch,
  findAllDispatches,
  findDispatchById,
  updateDispatch,
  deleteDispatch
} from "../model/dispatchModel.js";

export const createDispatch = async (req, res, next) => {
  try {
    const dispatch = await createPlantDispatch(req.body, req.user.id);
    res.status(201).json({
      success: true,
      message: `Dispatched ${dispatch.dispatched_pieces} pieces (${dispatch.dispatched_weight_mt} MT) of Heat '${dispatch.heat_number}' to '${dispatch.target_plant}'.`,
      data: dispatch
    });
  } catch (error) {
    next(error);
  }
};

export const getDispatches = async (req, res, next) => {
  try {
    const { heat_number, target_plant, status, search, limit, offset, page } = req.query;
    const limitNum = limit !== undefined ? parseInt(limit, 10) : 10;
    const pageNum = page !== undefined ? parseInt(page, 10) : (offset !== undefined ? Math.floor(parseInt(offset, 10) / limitNum) + 1 : 1);
    const offsetNum = offset !== undefined ? parseInt(offset, 10) : (pageNum - 1) * limitNum;

    const result = await findAllDispatches({
      heat_number,
      target_plant,
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

export const getDispatch = async (req, res, next) => {
  try {
    const { id } = req.params;
    const dispatch = await findDispatchById(id);

    if (!dispatch) {
      return res.status(404).json({
        success: false,
        message: `Dispatch record #${id} not found.`
      });
    }

    res.json({
      success: true,
      data: dispatch
    });
  } catch (error) {
    next(error);
  }
};

export const editDispatch = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updated = await updateDispatch(id, req.body);

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: `Dispatch record #${id} not found.`
      });
    }

    res.json({
      success: true,
      message: `Dispatch #${id} updated successfully.`,
      data: updated
    });
  } catch (error) {
    next(error);
  }
};

export const removeDispatch = async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await deleteDispatch(id);

    res.json({
      success: true,
      message: `Dispatch #${id} cancelled and ${deleted.dispatched_pieces} pcs (${deleted.dispatched_weight_mt} MT) restored to billet inventory.`,
      data: deleted
    });
  } catch (error) {
    next(error);
  }
};
