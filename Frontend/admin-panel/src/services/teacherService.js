import api from "../api/axiosClient";

// ======================================================
// GET ALL TEACHERS
// ======================================================

export const getAllTeachers = (
  params = {}
) => {
  return api.get(
    "/teachers",
    {
      params,
    }
  );
};


// ======================================================
// GET TEACHER BY ID
// ======================================================

export const getTeacherById = (
  id
) => {
  return api.get(
    `/teachers/${id}`
  );
};


// ======================================================
// CREATE TEACHER
// ======================================================

export const createTeacher = (
  payload
) => {
  return api.post(
    "/teachers",
    payload
  );
};


// ======================================================
// UPDATE TEACHER
// ======================================================

export const updateTeacher = (
  id,
  payload
) => {
  return api.put(
    `/teachers/${id}`,
    payload
  );
};


// ======================================================
// DELETE TEACHER
// ======================================================

export const deleteTeacher = (
  id
) => {
  return api.delete(
    `/teachers/${id}`
  );
};


// ======================================================
// RESET TEACHER PASSWORD
// ======================================================

export const resetTeacherPassword = (
  id,
  password
) => {
  return api.patch(
    `/teachers/${id}/password`,
    {
      password,
    }
  );
};


// ======================================================
// UPLOAD AVATAR
// ======================================================

export const uploadAvatar = (
 file
) => {
  const formData =
    new FormData();

  formData.append(
    "avatar",
    file
  );

  return api.post(
    "/teachers/avatar",
    formData,
    {
      headers: {
        "Content-Type":
          "multipart/form-data",
      },
    }
  );
};