const { supabaseAdmin } = require("../config/supabase");

const COURSE_SELECT = `
  *,
  linked_department:academic_departments(
    id,
    name,
    code,
    description,
    status
  ),
  linked_program:academic_programs(
    id,
    name,
    code,
    degree_title,
    department_id,
    status
  )
`;

const createCourse = async (payload) => {
  const { data, error } = await supabaseAdmin
    .from("courses")
    .insert([payload])
    .select(COURSE_SELECT)
    .single();

  if (error) {
    console.error("Supabase createCourse error:", error);
    throw error;
  }

  return data;
};

const getAllCourses = async () => {
  const { data, error } = await supabaseAdmin
    .from("courses")
    .select(COURSE_SELECT)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Supabase getAllCourses error:", error);
    throw error;
  }

  return data || [];
};

const getCourseById = async (id) => {
  const { data, error } = await supabaseAdmin
    .from("courses")
    .select(COURSE_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Supabase getCourseById error:", error);
    throw error;
  }

  return data;
};

const updateCourse = async ({ id, ...payload }) => {
  const { data, error } = await supabaseAdmin
    .from("courses")
    .update(payload)
    .eq("id", id)
    .select(COURSE_SELECT)
    .single();

  if (error) {
    console.error("Supabase updateCourse error:", error);
    throw error;
  }

  return data;
};

const deleteCourse = async (id) => {
  const { data, error } = await supabaseAdmin
    .from("courses")
    .delete()
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Supabase deleteCourse error:", error);
    throw error;
  }

  return data;
};

module.exports = {
  createCourse,
  getAllCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
};