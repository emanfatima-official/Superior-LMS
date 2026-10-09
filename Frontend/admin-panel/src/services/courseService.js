import axiosClient from "../api/axiosClient";

export const getAllCourses = () => axiosClient.get("/courses");

export const getCourseById = (id) => axiosClient.get(`/courses/${id}`);

export const createCourse = (payload) =>
  axiosClient.post("/courses", payload);

export const updateCourse = (id, payload) =>
  axiosClient.put(`/courses/${id}`, payload);

export const deleteCourse = (id) => axiosClient.delete(`/courses/${id}`);
