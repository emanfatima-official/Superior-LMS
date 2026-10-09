import axiosClient from "../api/axiosClient";

export const getAttendanceOptions = (
  params = {}
) =>
  axiosClient.get(
    "/attendance/options",
    {
      params,
    }
  );

export const getAttendanceOverview = (
  params = {}
) =>
  axiosClient.get(
    "/attendance/overview",
    {
      params,
    }
  );

export const getSemesterAttendance = (
  params = {}
) =>
  axiosClient.get(
    "/attendance/semester",
    {
      params,
    }
  );

export const getCourseAttendance = (
  params = {}
) =>
  axiosClient.get(
    "/attendance/course",
    {
      params,
    }
  );

export const getStudentAttendance = (
  params = {}
) =>
  axiosClient.get(
    "/attendance/student",
    {
      params,
    }
  );

export const getAttendanceSessions = (
  params = {}
) =>
  axiosClient.get(
    "/attendance/sessions",
    {
      params,
    }
  );

export const getAttendanceExportData = (
  params = {}
) =>
  axiosClient.get(
    "/attendance/export",
    {
      params,
    }
  );