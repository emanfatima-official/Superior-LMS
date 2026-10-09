import axiosClient from "../api/axiosClient";

export const promoteStudent = (studentId, toSemesterId) =>
  axiosClient.post(`/promotions/student/${studentId}`, {
    to_semester_id: toSemesterId,
  });

export const promoteStudentsBulk = (studentIds, toSemesterId) =>
  axiosClient.post("/promotions/bulk", {
    student_ids: studentIds,
    to_semester_id: toSemesterId,
  });
