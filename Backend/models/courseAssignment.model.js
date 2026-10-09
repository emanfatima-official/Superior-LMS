const {
  supabaseAdmin,
} = require("../config/supabase");

const {
  result,
  allRows,
} = require("../utils/api");

// ======================================================
// COURSE ASSIGNMENT SELECT
//
// Latest Academic Structure:
//
// Course
//   -> Department
//   -> Program
//
// Batch
//   -> academic_batch_programs
//   -> Program
//
// Course Assignment stores:
//
// course_id
// batch_id
// semester_id
// teacher_id
//
// Program / Department are resolved from Course +
// Semester rather than duplicated on course_assignments.
// ======================================================

const ASSIGNMENT_SELECT = `
  *,

  course:courses!course_assignments_course_id_fkey(
    id,
    name,
    course_code,
    credits,
    status,
    department_id,
    program_id,
    catalog_department_code,
    catalog_program_code,

    linked_department:academic_departments(
      id,
      name,
      code,
      status
    ),

    linked_program:academic_programs(
      id,
      department_id,
      name,
      code,
      degree_title,
      status
    )
  ),

  batch:academic_batches!course_assignments_batch_id_fkey(
    id,
    start_year,
    end_year,
    status
  ),

  semester:academic_semesters!course_assignments_semester_id_fkey(
    id,
    program_id,
    semester_number,
    name,
    status,

    program:academic_programs(
      id,
      department_id,
      name,
      code,
      degree_title,
      status,

      department:academic_departments(
        id,
        name,
        code,
        status
      )
    )
  ),

  teacher:profiles!course_assignments_teacher_id_fkey(
    id,
    full_name,
    email,
    phone,
    department,
    department_id,
    program_id,
    batch_id,
    semester_id,
    is_active,

    linked_department:academic_departments(
      id,
      name,
      code,
      status
    )
  )
`;

// ======================================================
// GET ALL COURSE ASSIGNMENTS
// ======================================================

const getAll = (
  filters = {}
) =>
  allRows(() => {
    let query =
      supabaseAdmin
        .from(
          "course_assignments"
        )
        .select(
          ASSIGNMENT_SELECT
        )
        .order(
          "created_at",
          {
            ascending:
              false,
          }
        )
        .order(
          "id",
          {
            ascending:
              true,
          }
        );

    // ----------------------------------------------
    // Direct course_assignment fields
    // ----------------------------------------------

    for (const key of [
      "course_id",
      "batch_id",
      "semester_id",
      "teacher_id",
      "status",
    ]) {
      if (
        filters[key]
      ) {
        query =
          query.eq(
            key,
            filters[key]
          );
      }
    }

    return query;
  });

// ======================================================
// GET COURSE ASSIGNMENT BY ID
// ======================================================

const getById = (
  id
) =>
  result(
    supabaseAdmin
      .from(
        "course_assignments"
      )
      .select(
        ASSIGNMENT_SELECT
      )
      .eq(
        "id",
        id
      )
      .maybeSingle()
  );

// ======================================================
// CREATE COURSE ASSIGNMENT
// ======================================================

const create = (
  payload
) =>
  result(
    supabaseAdmin
      .from(
        "course_assignments"
      )
      .insert(
        payload
      )
      .select(
        ASSIGNMENT_SELECT
      )
      .single()
  );

// ======================================================
// UPDATE COURSE ASSIGNMENT
// ======================================================

const update = (
  id,
  payload,
  expectedUpdatedAt
) => {
  let query =
    supabaseAdmin
      .from(
        "course_assignments"
      )
      .update(
        payload
      )
      .eq(
        "id",
        id
      );

  // Optimistic concurrency:
  // only update if frontend is editing latest row.

  if (
    expectedUpdatedAt
  ) {
    query =
      query.eq(
        "updated_at",
        expectedUpdatedAt
      );
  }

  return result(
    query
      .select(
        ASSIGNMENT_SELECT
      )
      .maybeSingle()
  );
};

// ======================================================
// TEACHER HISTORY
// ======================================================

const getHistory = (
  id
) =>
  allRows(() =>
    supabaseAdmin
      .from(
        "course_assignment_teacher_history"
      )
      .select(
        `
          *,

          teacher:profiles!course_assignment_teacher_history_teacher_id_fkey(
            id,
            full_name,
            email,
            phone,
            department,
            department_id,
            is_active,

            linked_department:academic_departments(
              id,
              name,
              code,
              status
            )
          )
        `
      )
      .eq(
        "course_assignment_id",
        id
      )
      .order(
        "assigned_at",
        {
          ascending:
            true,
        }
      )
      .order(
        "id",
        {
          ascending:
            true,
        }
      )
  );

// ======================================================
// TEACHER OPTIONS
//
// Latest structure:
//
// Teacher Department should be read from department_id.
//
// Legacy `department` text is returned only for backward
// compatibility and display fallback.
// ======================================================

const getTeacherOptions =
  () =>
    allRows(() =>
      supabaseAdmin
        .from(
          "profiles"
        )
        .select(
          `
            id,
            full_name,
            email,
            phone,
            department,
            department_id,
            program_id,
            batch_id,
            semester_id,
            is_active,

            linked_department:academic_departments(
              id,
              name,
              code,
              status
            )
          `
        )
        .eq(
          "role",
          "teacher"
        )
        .eq(
          "is_active",
          true
        )
        .order(
          "full_name",
          {
            ascending:
              true,
          }
        )
    );

// ======================================================
// DELETE COURSE ASSIGNMENT
// ======================================================

const deleteById =
  async (
    id
  ) => {
    const {
      data,
      error,
    } =
      await supabaseAdmin
        .from(
          "course_assignments"
        )
        .delete()
        .eq(
          "id",
          id
        )
        .select(
          "id"
        )
        .maybeSingle();

    if (
      error
    ) {
      throw error;
    }

    return data;
  };

// ======================================================
// DELETE TEACHER HISTORY
// ======================================================

const deleteHistory =
  async (
    id
  ) => {
    const {
      error,
    } =
      await supabaseAdmin
        .from(
          "course_assignment_teacher_history"
        )
        .delete()
        .eq(
          "course_assignment_id",
          id
        );

    if (
      error
    ) {
      throw error;
    }
  };

// ======================================================
// DEPENDENCY COUNTS
//
// Used before permanent delete.
// Missing optional tables / columns are tolerated because
// some installations may not yet contain every module.
// ======================================================

const getDependencyCounts =
  async (
    id
  ) => {
    const tables = [
      "enrollments",
      "materials",
      "assignments",
      "quizzes",
      "attendance_records",
      "attendance_sessions",
      "announcements",
      "live_sessions",
      "periods",
      "gradebook_components",
      "gradebook_approvals",
    ];

    const entries =
      await Promise.all(
        tables.map(
          async (
            table
          ) => {
            const {
              count,
              error,
            } =
              await supabaseAdmin
                .from(
                  table
                )
                .select(
                  "id",
                  {
                    count:
                      "exact",

                    head:
                      true,
                  }
                )
                .eq(
                  "course_assignment_id",
                  id
                );

            // Ignore table / column missing cases for
            // modules that may not exist in an older DB.

            if (
              error &&
              ![
                "42P01",
                "42703",
                "PGRST204",
              ].includes(
                error.code
              )
            ) {
              throw error;
            }

            return [
              table,

              error
                ? 0
                : count ||
                  0,
            ];
          }
        )
      );

    return Object.fromEntries(
      entries
    );
  };

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  getAll,
  getById,
  create,
  update,
  getHistory,
  getTeacherOptions,
  deleteById,
  deleteHistory,
  getDependencyCounts,
};