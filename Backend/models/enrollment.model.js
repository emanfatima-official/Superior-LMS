const { supabaseAdmin } = require("../config/supabase");
const { allRows } = require("../utils/api");

// ======================================================
// ENROLLMENT SELECT
//
// Student placement:
// profiles.batch_id / program_id / semester_id
//
// Teaching context:
// course_assignments.batch_id / semester_id
//
// Batch-Program mapping is validated by the controller
// through academic_batch_programs.
// ======================================================

const ENROLLMENT_SELECT = `
  *,

  student:profiles!enrollments_student_id_fkey(
    id,
    full_name,
    email,
    student_id,
    cnic,
    department_id,
    program_id,
    batch_id,
    semester_id,
    is_active
  ),

  course:courses!enrollments_course_id_fkey(
    id,
    name,
    course_code,
    department_id,
    program_id,
    status,
    catalog_department_code,
    catalog_program_code
  ),

  course_assignment:course_assignments!enrollments_course_assignment_id_fkey(
    id,
    course_id,
    teacher_id,
    batch_id,
    semester_id,
    status,

    teacher:profiles!course_assignments_teacher_id_fkey(
      id,
      full_name,
      email,
      department,
      department_id
    ),

    semester:academic_semesters!course_assignments_semester_id_fkey(
      id,
      name,
      semester_number,
      program_id
    )
  ),

  batch:academic_batches!enrollments_batch_id_fkey(
    id,
    start_year,
    end_year,
    status
  ),

  semester:academic_semesters!enrollments_semester_id_fkey(
    id,
    name,
    semester_number,
    program_id
  )
`;

// ======================================================
// HELPERS
// ======================================================

const sameId = (first, second) =>
  String(first || "") === String(second || "");

// ======================================================
// CREATE SINGLE ENROLLMENT
// ======================================================

const createEnrollment = async (payload) => {
  const { data, error } = await supabaseAdmin
    .from("enrollments")
    .insert([payload])
    .select(ENROLLMENT_SELECT)
    .single();

  if (error) {
    throw error;
  }

  return data;
};

// ======================================================
// CREATE BULK ENROLLMENTS
// ======================================================

const createBulkEnrollments = async (payloads) => {
  if (
    !Array.isArray(payloads) ||
    payloads.length === 0
  ) {
    return [];
  }

  const { data, error } = await supabaseAdmin
    .from("enrollments")
    .insert(payloads)
    .select(ENROLLMENT_SELECT);

  if (error) {
    throw error;
  }

  return data || [];
};

// ======================================================
// GET ALL ENROLLMENTS
//
// allRows prevents Supabase's default result limit
// from silently hiding records when the LMS grows.
// ======================================================

const getAllEnrollments = () =>
  allRows(() =>
    supabaseAdmin
      .from("enrollments")
      .select(ENROLLMENT_SELECT)
      .order("enrolled_at", {
        ascending: false,
      })
      .order("id", {
        ascending: true,
      })
  );

// ======================================================
// GET STUDENT ENROLLMENTS
//
// history=true:
// Return all historical enrollments.
//
// history=false:
// Return only currently accessible enrollments.
//
// IMPORTANT:
// Existing Semester behavior is preserved:
// Regular -> student's current Semester
// Supply  -> previous Semester allowed
// ======================================================

const getStudentEnrollments = async (
  studentId,
  { history = false } = {}
) => {
  const [all, profileResult] = await Promise.all([
    allRows(() =>
      supabaseAdmin
        .from("enrollments")
        .select(ENROLLMENT_SELECT)
        .eq("student_id", studentId)
        .order("enrolled_at", {
          ascending: false,
        })
        .order("id", {
          ascending: true,
        })
    ),

    supabaseAdmin
      .from("profiles")
      .select(
        "id,batch_id,program_id,semester_id,is_active"
      )
      .eq("id", studentId)
      .maybeSingle(),
  ]);

  if (profileResult.error) {
    throw profileResult.error;
  }

  // ----------------------------------------------------
  // HISTORY
  //
  // Do not filter historical records by the student's
  // current Batch, Program or Semester.
  // ----------------------------------------------------

  if (history) {
    return all;
  }

  const profile = profileResult.data;

  if (
    !profile ||
    profile.is_active === false
  ) {
    return [];
  }

  // ----------------------------------------------------
  // CURRENT ACCESS
  // ----------------------------------------------------

  return all.filter((row) => {
    // Enrollment must be active.

    if (row.status !== "active") {
      return false;
    }

    // Linked Course must be published.

    if (
      row.course?.status &&
      row.course.status !== "published"
    ) {
      return false;
    }

    // Linked Course Assignment must be active.

    if (
      row.course_assignment?.status &&
      row.course_assignment.status !== "active"
    ) {
      return false;
    }

    // ==================================================
    // LATEST ACADEMIC STRUCTURE:
    // CHECK STUDENT BATCH
    // ==================================================

    const enrolledBatchId =
      row.batch_id ||
      row.course_assignment?.batch_id ||
      null;

    // Where both IDs are available, an active enrollment
    // must belong to the student's current Batch.
    //
    // Legacy records with missing Batch IDs continue
    // through the existing Semester validation.

    if (
      profile.batch_id &&
      enrolledBatchId &&
      !sameId(
        profile.batch_id,
        enrolledBatchId
      )
    ) {
      return false;
    }

    // ==================================================
    // CHECK STUDENT PROGRAM
    // ==================================================

    const enrollmentProgramId =
      row.course_assignment?.semester?.program_id ||
      row.semester?.program_id ||
      row.course?.program_id ||
      null;

    if (
      profile.program_id &&
      enrollmentProgramId &&
      !sameId(
        profile.program_id,
        enrollmentProgramId
      )
    ) {
      return false;
    }

    // ==================================================
    // SUPPLY ENROLLMENT
    //
    // Preserve existing behavior:
    // A Supply enrollment may belong to a previous
    // Semester of the same Batch/Program.
    // ==================================================

    if (
      (row.enrollment_type || "regular") === "supply"
    ) {
      return true;
    }

    // ==================================================
    // REGULAR ENROLLMENT
    //
    // Preserve existing behavior:
    // Enrollment Semester must match the student's
    // actual current Semester.
    // ==================================================

    const enrollmentSemesterId =
      row.semester_id ||
      row.course_assignment?.semester_id ||
      null;

    return (
      Boolean(profile.semester_id) &&
      Boolean(enrollmentSemesterId) &&
      sameId(
        profile.semester_id,
        enrollmentSemesterId
      )
    );
  });
};

// ======================================================
// GET COURSE ENROLLMENTS
// ======================================================

const getCourseEnrollments = (
  courseId,
  courseAssignmentId = null
) =>
  allRows(() => {
    let query = supabaseAdmin
      .from("enrollments")
      .select(ENROLLMENT_SELECT)
      .eq("course_id", courseId);

    if (courseAssignmentId) {
      query = query.eq(
        "course_assignment_id",
        courseAssignmentId
      );
    }

    return query
      .order("enrolled_at", {
        ascending: false,
      })
      .order("id", {
        ascending: true,
      });
  });

// ======================================================
// GET ENROLLMENT BY ID
// ======================================================

const getById = async (id) => {
  const { data, error } = await supabaseAdmin
    .from("enrollments")
    .select(ENROLLMENT_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
};

// ======================================================
// UPDATE ENROLLMENT
// ======================================================

const updateEnrollment = async (id, payload) => {
  const { data, error } = await supabaseAdmin
    .from("enrollments")
    .update(payload)
    .eq("id", id)
    .select(ENROLLMENT_SELECT)
    .single();

  if (error) {
    throw error;
  }

  return data;
};

// ======================================================
// DELETE ENROLLMENT
// ======================================================

const deleteEnrollment = async (id) => {
  const { data, error } = await supabaseAdmin
    .from("enrollments")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
};

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  createEnrollment,
  createBulkEnrollments,
  getAllEnrollments,
  getStudentEnrollments,
  getCourseEnrollments,
  getById,
  updateEnrollment,
  deleteEnrollment,
};