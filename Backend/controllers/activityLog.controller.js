const activityLogModel = require("../models/activityLog.model");

const getActivityLogs = async (req, res) => {
  try {
    const {
      limit,
      module,
      action,
      search,
      from,
      to,
    } = req.query;

    const logs =
      await activityLogModel.getActivityLogs({
        limit,
        module,
        action,
        search,
        from,
        to,
      });

    return res.status(200).json({
      success: true,
      message: "Activity logs fetched successfully",
      data: logs,
    });
  } catch (error) {
    console.error(
      "GET ACTIVITY LOGS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error?.message ||
        "Failed to fetch activity logs",
    });
  }
};

module.exports = {
  getActivityLogs,
};