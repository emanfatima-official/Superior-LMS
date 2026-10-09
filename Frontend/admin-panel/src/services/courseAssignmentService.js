import axiosClient from "../api/axiosClient";

export const getCourseAssignments = (params = {}) =>
  axiosClient.get("/course-assignments", { params });

export const getCourseAssignmentById = (id) =>
  axiosClient.get(`/course-assignments/${id}`);

export const createCourseAssignment = (payload) =>
  axiosClient.post("/course-assignments", payload);

export const updateCourseAssignment = (id, payload) =>
  axiosClient.put(`/course-assignments/${id}`, payload);

export const replaceCourseAssignmentTeacher = (id, payload) =>
  axiosClient.put(`/course-assignments/${id}/teacher`, payload);

export const getCourseAssignmentTeacherHistory = (id) =>
  axiosClient.get(`/course-assignments/${id}/history`);

export const getCourseAssignmentTeacherOptions = () =>
  axiosClient.get("/course-assignments/teacher-options");

export const deleteCourseAssignment = (id) =>
  axiosClient.delete(`/course-assignments/${id}`);
