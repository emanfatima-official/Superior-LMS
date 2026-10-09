import axiosClient from "../api/axiosClient";

export const getActivityLogs = (params = {}) => {
  return axiosClient.get("/activity-logs", {
    params,
  });
};