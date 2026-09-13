import {
  getFullHeatTraceability,
  getTraceabilityDashboardSummary,
  searchTraceability
} from "../model/traceabilityModel.js";

export const getHeatTraceability = async (req, res, next) => {
  try {
    const { heatNumber } = req.params;
    const traceabilityData = await getFullHeatTraceability(heatNumber);

    if (!traceabilityData) {
      return res.status(404).json({
        success: false,
        message: `Traceability record for Heat '${heatNumber}' could not be found.`
      });
    }

    res.json({
      success: true,
      message: `End-to-End Traceability report for Heat '${heatNumber}' generated successfully.`,
      data: traceabilityData
    });
  } catch (error) {
    next(error);
  }
};

export const getDashboardMetrics = async (req, res, next) => {
  try {
    const metrics = await getTraceabilityDashboardSummary();
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    next(error);
  }
};

export const searchGlobal = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Query parameter 'q' is required for search."
      });
    }

    const results = await searchTraceability(q);
    res.json({
      success: true,
      query: q,
      data: results
    });
  } catch (error) {
    next(error);
  }
};
