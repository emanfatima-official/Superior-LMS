import axiosClient from "../api/axiosClient";

export const getStudentHistory = (id) => axiosClient.get(`/history/students/${id}`);
export const getStudentCourseHistory = (id, courseAssignmentId) =>
  axiosClient.get(`/history/students/${id}/course-assignments/${courseAssignmentId}`);
export const getTeacherHistory = (id) => axiosClient.get(`/history/teachers/${id}`);
export const getCourseHistory = (id) => axiosClient.get(`/history/courses/${id}`);
export const getCourseAssignmentHistory = (id) => axiosClient.get(`/history/course-assignments/${id}`);
