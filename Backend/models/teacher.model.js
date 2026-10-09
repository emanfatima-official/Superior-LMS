const { supabaseAdmin } = require("../config/supabase");
const { allRows } = require("../utils/api");

const TEACHER_SELECT = `
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
  ),
  linked_batch:academic_batches(
    id,
    start_year,
    end_year,
    status
  ),
  linked_semester:academic_semesters(
    id,
    program_id,
    semester_number,
    name,
    status
  )
`;

// ======================================================
// AUTH HELPERS
// ======================================================

const getAllAuthUsers = async () => {
  const users = [];
  const perPage = 1000;

  for (let page = 1; ; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw error;
    }

    const pageUsers = data?.users || [];

    users.push(
      ...pageUsers
    );

    if (
      pageUsers.length <
      perPage
    ) {
      break;
    }
  }

  return users;
};

// ======================================================
// CREATE TEACHER
// ======================================================

const createTeacher =
  async (
    payload
  ) => {
    const {
      data,
      error,
    } =
      await supabaseAdmin
        .from(
          "profiles"
        )
        .insert(
          payload
        )
        .select(
          TEACHER_SELECT
        )
        .single();

    if (error) {
      throw error;
    }

    return data;
  };

// ======================================================
// FIND TEACHER BY EMAIL
// ======================================================

const findTeacherByEmail =
  async (
    email
  ) => {
    const {
      data,
      error,
    } =
      await supabaseAdmin
        .from(
          "profiles"
        )
        .select(
          TEACHER_SELECT
        )
        .eq(
          "email",
          email
        )
        .eq(
          "role",
          "teacher"
        )
        .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  };

// ======================================================
// GET ALL TEACHERS
// ======================================================

const getAllTeachers =
  async (
    department = "",
    department_id = ""
  ) => {
    // --------------------------------------------------
    // TEACHER QUERY
    // --------------------------------------------------

    let query =
      supabaseAdmin
        .from(
          "profiles"
        )
        .select(
          TEACHER_SELECT
        )
        .eq(
          "role",
          "teacher"
        );

    // --------------------------------------------------
    // OPTIONAL DEPARTMENT FILTER
    // --------------------------------------------------

    if (
      department_id
    ) {
      query =
        query.eq(
          "department_id",
          department_id
        );
    } else if (
      department?.trim()
    ) {
      query =
        query.eq(
          "department",
          department.trim()
        );
    }

    // --------------------------------------------------
    // FETCH TEACHERS
    // --------------------------------------------------

    const {
      data,
      error,
    } =
      await query.order(
        "created_at",
        {
          ascending:
            false,
        }
      );

    if (error) {
      throw error;
    }

    const teachers =
      data || [];

    if (
      !teachers.length
    ) {
      return [];
    }

    const teacherIds =
      teachers
        .map(
          (
            teacher
          ) =>
            teacher.id
        )
        .filter(
          Boolean
        );

    // ==================================================
    // LOAD RELATED DATA
    // ==================================================
    //
    // allRows() is important because large LMS data can
    // exceed Supabase/PostgREST single-request limits.
    // ==================================================

    const [
      courses,
      enrollments,
      authUsers,
    ] =
      await Promise.all([
        // ----------------------------------------------
        // COURSE ASSIGNMENTS
        // ----------------------------------------------

        teacherIds.length
          ? allRows(
              () =>
                supabaseAdmin
                  .from(
                    "course_assignments"
                  )
                  .select(
                    `
                      id,
                      teacher_id
                    `
                  )
                  .in(
                    "teacher_id",
                    teacherIds
                  )
            )
          : Promise.resolve(
              []
            ),

        // ----------------------------------------------
        // ENROLLMENTS
        // ----------------------------------------------

        allRows(
          () =>
            supabaseAdmin
              .from(
                "enrollments"
              )
              .select(
                `
                  course_assignment_id,
                  student_id
                `
              )
        ),

        // ----------------------------------------------
        // AUTH USERS
        // ----------------------------------------------

        getAllAuthUsers(),
      ]);

    // ==================================================
    // COURSE COUNTS
    // ==================================================

    const coursesByTeacher =
      new Map();

    const courseTeacherMap =
      new Map();

    for (
      const course
      of courses || []
    ) {
      if (
        !course?.id ||
        !course?.teacher_id
      ) {
        continue;
      }

      courseTeacherMap.set(
        course.id,
        course.teacher_id
      );

      const currentCount =
        coursesByTeacher.get(
          course.teacher_id
        ) || 0;

      coursesByTeacher.set(
        course.teacher_id,
        currentCount + 1
      );
    }

    // ==================================================
    // UNIQUE STUDENTS PER TEACHER
    // ==================================================

    const studentsByTeacher =
      new Map();

    for (
      const enrollment
      of enrollments || []
    ) {
      const assignmentId =
        enrollment
          ?.course_assignment_id;

      if (
        !assignmentId
      ) {
        continue;
      }

      const teacherId =
        courseTeacherMap.get(
          assignmentId
        );

      if (
        !teacherId
      ) {
        continue;
      }

      if (
        !studentsByTeacher.has(
          teacherId
        )
      ) {
        studentsByTeacher.set(
          teacherId,
          new Set()
        );
      }

      if (
        enrollment
          ?.student_id
      ) {
        studentsByTeacher
          .get(
            teacherId
          )
          .add(
            enrollment
              .student_id
          );
      }
    }

    // ==================================================
    // LAST LOGIN
    // ==================================================
    //
    // VERY IMPORTANT:
    //
    // Last Login matching sirf:
    //
    // teacher.id === authUser.id
    //
    // ke through hogi.
    //
    // Hum use NAHI kar rahe:
    //
    // - teacher.email
    // - personal/contact email
    // - profiles.last_login_at
    // - latestTimestamp merge
    //
    // Isse wrong teacher ka login kisi aur teacher ko
    // attach nahi hoga.
    // ==================================================

    const lastLoginByAuthUserId =
      new Map(
        (
          authUsers || []
        ).map(
          (
            user
          ) => [
            user.id,

            user
              .last_sign_in_at ||
              null,
          ]
        )
      );

    // ==================================================
    // FINAL RESPONSE
    // ==================================================

    return teachers.map(
      (
        teacher
      ) => {
        const lastLoginAt =
          lastLoginByAuthUserId.get(
            teacher.id
          ) || null;

        return {
          ...teacher,

          assigned_courses_count:
            coursesByTeacher.get(
              teacher.id
            ) || 0,

          students_count:
            studentsByTeacher
              .get(
                teacher.id
              )
              ?.size || 0,

          last_login_at:
            lastLoginAt,

          // Backward compatibility for any older code.
          last_login:
            lastLoginAt,
        };
      }
    );
  };

// ======================================================
// GET TEACHER BY ID
// ======================================================

const getTeacherById =
  async (
    id
  ) => {
    const {
      data,
      error,
    } =
      await supabaseAdmin
        .from(
          "profiles"
        )
        .select(
          TEACHER_SELECT
        )
        .eq(
          "id",
          id
        )
        .eq(
          "role",
          "teacher"
        )
        .maybeSingle();

    if (error) {
      throw error;
    }

    if (
      !data
    ) {
      return null;
    }

    // ==================================================
    // EXACT AUTH USER LOOKUP BY UUID
    // ==================================================

    let lastLoginAt =
      null;

    try {
      const {
        data:
          authData,

        error:
          authError,
      } =
        await supabaseAdmin
          .auth
          .admin
          .getUserById(
            id
          );

      if (
        authError
      ) {
        throw authError;
      }

      // Extra safety:
      // Auth UUID must exactly equal profile/teacher UUID.

      if (
        authData?.user?.id ===
        id
      ) {
        lastLoginAt =
          authData
            .user
            .last_sign_in_at ||
          null;
      }
    } catch (
      authError
    ) {
      console.warn(
        "TEACHER LAST LOGIN AUTH LOOKUP ERROR:",
        authError?.message ||
          authError
      );
    }

    return {
      ...data,

      last_login_at:
        lastLoginAt,

      last_login:
        lastLoginAt,
    };
  };

// ======================================================
// UPDATE TEACHER
// ======================================================

const updateTeacher =
  async ({
    id,
    ...teacherData
  }) => {
    const {
      data,
      error,
    } =
      await supabaseAdmin
        .from(
          "profiles"
        )
        .update(
          teacherData
        )
        .eq(
          "id",
          id
        )
        .eq(
          "role",
          "teacher"
        )
        .select(
          TEACHER_SELECT
        )
        .single();

    if (error) {
      throw error;
    }

    return data;
  };

// ======================================================
// DELETE TEACHER PROFILE
// ======================================================

const deleteTeacher =
  async (
    id
  ) => {
    const {
      data,
      error,
    } =
      await supabaseAdmin
        .from(
          "profiles"
        )
        .delete()
        .eq(
          "id",
          id
        )
        .eq(
          "role",
          "teacher"
        )
        .select()
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
  createTeacher,
  findTeacherByEmail,
  getAllTeachers,
  getTeacherById,
  updateTeacher,
  deleteTeacher,
};