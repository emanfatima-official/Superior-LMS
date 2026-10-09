import axiosClient from "../api/axiosClient";

// ======================================================
// GET ALL STUDENTS
// ======================================================

export const getAllStudents = (
  courseId
) =>
  axiosClient.get(
    "/students",
    {
      params:
        courseId
          ? {
              course_id:
                courseId,
            }
          : undefined,
    }
  );

// ======================================================
// GET SINGLE STUDENT
// ======================================================

export const getStudentById = (
  id
) =>
  axiosClient.get(
    `/students/${id}`
  );

// ======================================================
// CREATE STUDENT
// ======================================================

export const createStudent = (
  payload
) =>
  axiosClient.post(
    "/students",
    payload
  );

// ======================================================
// UPDATE STUDENT
// ======================================================

export const updateStudent = (
  id,
  payload
) =>
  axiosClient.put(
    `/students/${id}`,
    payload
  );

// ======================================================
// UPDATE STUDENT STATUS
// ======================================================

export const updateStudentStatus = (
  id,
  isActive
) =>
  axiosClient.patch(
    `/students/${id}/status`,
    {
      is_active:
        Boolean(
          isActive
        ),
    }
  );

// ======================================================
// RESET STUDENT PASSWORD
// ======================================================

export const resetStudentPassword = (
  id,
  password
) =>
  axiosClient.patch(
    `/students/${id}/reset-password`,
    {
      password,
    }
  );

// ======================================================
// DELETE STUDENT
// ======================================================

export const deleteStudent = (
  id
) =>
  axiosClient.delete(
    `/students/${id}`
  );

// ======================================================
// UPLOAD SINGLE STUDENT AVATAR
// ======================================================
// Bulk profile-image upload is handled separately by
// importService.js.
// ======================================================

export const uploadAvatar =
  async (
    file
  ) => {
    const formData =
      new FormData();

    formData.append(
      "avatar",
      file
    );

    const response =
      await axiosClient.post(
        "/upload/avatar",
        formData,
        {
          headers: {
            "Content-Type":
              "multipart/form-data",
          },
        }
      );

    return response.data;
  };