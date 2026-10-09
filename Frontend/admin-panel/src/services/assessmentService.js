import axiosClient from "../api/axiosClient";

export const getAssessments = (
  params = {}
) =>
  axiosClient.get(
    "/assessments",
    { params }
  );

export const getAssessmentById = (
  id
) =>
  axiosClient.get(
    `/assessments/${id}`
  );

export const getAssessmentCourseOptions = (
  params
) =>
  axiosClient.get(
    "/assessments/course-options",
    { params }
  );

export const previewAssessment = (
  payload
) =>
  axiosClient.post(
    "/assessments/preview",
    payload
  );

export const createAssessment = (
  payload
) =>
  axiosClient.post(
    "/assessments",
    payload
  );

export const updateAssessment = (
  id,
  payload
) =>
  axiosClient.put(
    `/assessments/${id}`,
    payload
  );

export const publishAssessment = (
  id
) =>
  axiosClient.post(
    `/assessments/${id}/publish`
  );

export const cancelAssessment = (
  id,
  reason
) =>
  axiosClient.post(
    `/assessments/${id}/cancel`,
    { reason }
  );

export const deleteAssessment = (
  id
) =>
  axiosClient.delete(
    `/assessments/${id}`
  );

export const getAssessmentReportOptions = (
  params
) =>
  axiosClient.get(
    "/assessments/reports/options",
    { params }
  );

export const getAssessmentResultsReport = (
  params
) =>
  axiosClient.get(
    "/assessments/reports/results",
    { params }
  );