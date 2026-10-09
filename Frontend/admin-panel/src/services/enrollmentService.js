import axiosClient from "../api/axiosClient";

export const getAllEnrollments = () => axiosClient.get("/enrollments");

export const getStudentEnrollments = (studentId) =>
  axiosClient.get(`/enrollments/student/${studentId}`);

export const getCourseEnrollments = (courseId, courseAssignmentId) =>
  axiosClient.get(`/enrollments/course/${courseId}`, {
    params: courseAssignmentId ? { course_assignment_id: courseAssignmentId } : undefined,
  });

export const createEnrollment = (payload) => axiosClient.post("/enrollments", payload);

export const bulkEnrollStudents = (payload) => axiosClient.post("/enrollments/bulk", payload);

export const updateEnrollment = (id, payload) => axiosClient.put(`/enrollments/${id}`, payload);

export const deleteEnrollment = (id) => axiosClient.delete(`/enrollments/${id}`);
