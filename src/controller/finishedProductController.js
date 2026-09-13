import {
  recordFinishedProduct,
  findAllFinishedProducts,
  findFinishedProductById,
  updateFinishedProduct,
  deleteFinishedProduct
} from "../model/finishedProductModel.js";

export const recordProduct = async (req, res, next) => {
  try {
    const product = await recordFinishedProduct(req.body, req.user.id);
    res.status(201).json({
      success: true,
      message: `Finished product '${product.finished_product_name}' (${product.finished_weight_mt} MT) recorded with ${product.yield_percentage}% yield.`,
      data: product
    });
  } catch (error) {
    next(error);
  }
};

export const getProducts = async (req, res, next) => {
  try {
    const { heat_number, product_name, search, limit, offset, page } = req.query;
    const limitNum = limit !== undefined ? parseInt(limit, 10) : 10;
    const pageNum = page !== undefined ? parseInt(page, 10) : (offset !== undefined ? Math.floor(parseInt(offset, 10) / limitNum) + 1 : 1);
    const offsetNum = offset !== undefined ? parseInt(offset, 10) : (pageNum - 1) * limitNum;

    const result = await findAllFinishedProducts({
      heat_number,
      product_name,
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

export const getProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await findFinishedProductById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Finished product record #${id} not found.`
      });
    }

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    next(error);
  }
};

export const editProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updated = await updateFinishedProduct(id, req.body);

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: `Finished product record #${id} not found.`
      });
    }

    res.json({
      success: true,
      message: `Finished product record #${id} updated successfully.`,
      data: updated
    });
  } catch (error) {
    next(error);
  }
};

export const removeProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await deleteFinishedProduct(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: `Finished product record #${id} not found.`
      });
    }

    res.json({
      success: true,
      message: `Finished product record #${id} deleted successfully.`,
      data: deleted
    });
  } catch (error) {
    next(error);
  }
};
