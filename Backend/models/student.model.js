const { supabaseAdmin } = require("../config/supabase");
const { allRows } = require("../utils/api");

// ======================================================
// PROFILE SELECT
// ======================================================
//
// IMPORTANT:
// Department table is `academic_departments`.
// There is NO `departments` table/relation.
//
// ======================================================

const PROFILE_SELECT = `
  *,
  linked_department:academic_departments(
    id,
    name,
    code,
    created_at,
    updated_at
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
// AUTH LAST LOGIN HELPERS
// ======================================================
//
// profiles.last_login_at is updated by the LMS login API,
// while Supabase Auth also keeps last_sign_in_at.
// Use the newest valid value so Admin stays correct even
// when a mobile app signs in directly through Supabase.
// ======================================================

const latestTimestamp = (...values) => {
  const valid = values
    .filter(Boolean)
    .map((value) => ({
      value,
      time: new Date(value).getTime(),
    }))
    .filter((item) => Number.isFinite(item.time));

  if (!valid.length) return null;

  valid.sort((a, b) => b.time - a.time);
  return valid[0].value;
};

const getAllAuthUsers = async () => {
  const users = [];
  const perPage = 1000;

  for (let page = 1; ; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) throw error;

    const pageUsers = data?.users || [];
    users.push(...pageUsers);

    if (pageUsers.length < perPage) break;
  }

  return users;
};

const attachLastLogin = async (profiles = []) => {
  if (!profiles.length) return [];

  try {
    const authUsers = await getAllAuthUsers();

    const authById = new Map(
      authUsers.map((user) => [user.id, user.last_sign_in_at || null])
    );

    return profiles.map((profile) => ({
      ...profile,
      last_login_at: latestTimestamp(
        profile.last_login_at,
        authById.get(profile.id)
      ),
    }));
  } catch (error) {
    console.warn(
      "STUDENT LAST LOGIN AUTH LOOKUP ERROR:",
      error?.message || error
    );

    return profiles;
  }
};

// ======================================================
// ENROLLMENT DATA
// ======================================================
//
// Enrollment statistics are fetched separately.
// This avoids relationship ambiguity and keeps the
// student query independent from enrollments.
//
// ======================================================

const attachEnrollmentStats = async (students = []) => {
  if (!students.length) return [];

  const clamp = (value) =>
    Math.max(
      0,
      Math.min(100, Number(value) || 0)
    );

  const number = (value) => {
    const parsed = Number(value);

    return Number.isFinite(parsed)
      ? parsed
      : null;
  };

  const percent = (
    earned,
    maximum
  ) => {
    const max =
      number(maximum);

    if (
      max == null ||
      max <= 0
    ) {
      return null;
    }

    return clamp(
      (
        (number(earned) || 0) /
        max
      ) * 100
    );
  };

  // Latest submission/attendance row
  // will be used if duplicate rows exist.
  const latestByKey = (
    rows,
    keyOf,
    dateOf
  ) => {
    const map =
      new Map();

    for (
      const row of rows || []
    ) {
      const key =
        keyOf(row);

      const previous =
        map.get(key);

      if (
        !previous ||
        new Date(
          dateOf(row) || 0
        ).getTime() >=
          new Date(
            dateOf(previous) || 0
          ).getTime()
      ) {
        map.set(
          key,
          row
        );
      }
    }

    return map;
  };

  // Future scheduled activity should
  // not reduce current progress.
  const released = (
    row,
    fields
  ) => {
    const date =
      fields
        .map(
          (field) =>
            row?.[field]
        )
        .find(Boolean);

    if (!date) {
      return true;
    }

    const time =
      new Date(
        date
      ).getTime();

    return (
      !Number.isFinite(time) ||
      time <= Date.now()
    );
  };

  const emptyProgress = (
    courseCount = 0
  ) => ({
    enrolled_courses_count:
      courseCount,

    enrolled_courses:
      courseCount,

    course_count:
      courseCount,

    progress_percentage: 0,
    average_progress: 0,
    progress: 0,

    progress_breakdown: {
      attendance: null,
      assignments: null,
      quizzes: null,
      included_categories: 0,
    },

    progress_source:
      "current_semester_live_performance",
  });

  const studentIds =
    students
      .map(
        (student) =>
          student.id
      )
      .filter(Boolean);

  const studentMap =
    new Map(
      students.map(
        (student) => [
          student.id,
          student,
        ]
      )
    );

  if (!studentIds.length) {
    return students;
  }

  // ====================================================
  // CURRENT ACTIVE REGULAR ENROLLMENTS
  // ====================================================

  // Fetch every matching enrollment. A single Supabase/PostgREST
  // request may stop at the configured row limit and caused some
  // students to receive 0% even though attendance existed.
  const enrollmentData =
    await allRows(() =>
      supabaseAdmin
        .from(
          "enrollments"
        )
        .select(`
          id,
          student_id,
          course_id,
          course_assignment_id,
          semester_id,
          enrollment_type,
          status,
          enrolled_at,
          access_start_date
        `)
        .in(
          "student_id",
          studentIds
        )
        .eq(
          "status",
          "active"
        )
    );

  const candidateEnrollments =
    (
      enrollmentData ||
      []
    ).filter(
      (row) =>
        (
          row.enrollment_type ||
          "regular"
        ) ===
          "regular" &&
        row.course_assignment_id
    );

  const candidateContextIds = [
    ...new Set(
      candidateEnrollments.map(
        (row) =>
          row.course_assignment_id
      )
    ),
  ];

  if (
    !candidateContextIds.length
  ) {
    return students.map(
      (student) => ({
        ...student,
        ...emptyProgress(),
      })
    );
  }

  // ====================================================
  // ACTIVE COURSE ASSIGNMENTS
  // ====================================================

  const contextData =
    await allRows(() =>
      supabaseAdmin
        .from(
          "course_assignments"
        )
        .select(
          "id,semester_id,status"
        )
        .in(
          "id",
          candidateContextIds
        )
    );

  const contextMap =
    new Map(
      (
        contextData ||
        []
      ).map(
        (row) => [
          row.id,
          row,
        ]
      )
    );

  const uniqueEnrollments =
    new Map();

  for (
    const enrollment
    of candidateEnrollments
  ) {
    const student =
      studentMap.get(
        enrollment.student_id
      );

    const context =
      contextMap.get(
        enrollment
          .course_assignment_id
      );

    const semesterId =
      enrollment.semester_id ||
      context?.semester_id;

    if (
      !student ||
      context?.status !==
        "active"
    ) {
      continue;
    }

    if (
      !semesterId ||
      String(
        semesterId
      ) !==
        String(
          student.semester_id
        )
    ) {
      continue;
    }

    uniqueEnrollments.set(
      `${enrollment.student_id}:${enrollment.course_assignment_id}`,
      enrollment
    );
  }

  const enrollments = [
    ...uniqueEnrollments.values(),
  ];

  const contextIds = [
    ...new Set(
      enrollments.map(
        (row) =>
          row.course_assignment_id
      )
    ),
  ];

  const courseIds = [
    ...new Set(
      enrollments
        .map(
          (row) =>
            row.course_id
        )
        .filter(Boolean)
    ),
  ];

  if (!contextIds.length) {
    return students.map(
      (student) => ({
        ...student,
        ...emptyProgress(),
      })
    );
  }

  // ====================================================
  // SAFE DATABASE QUERY
  // ====================================================

  const safeRows = async (
    table,
    select,
    configure
  ) => {
    try {
      return await allRows(() => {
        let query =
          supabaseAdmin
            .from(table)
            .select(select);

        query =
          configure(query);

        return query;
      });
    } catch (error) {
      console.warn(
        `STUDENT PROGRESS ${table} QUERY ERROR:`,
        error?.message || error
      );

      return [];
    }
  };

  // ====================================================
  // LOAD ACTIVITIES
  // ====================================================

  const [
    assignmentData,
    quizData,
    contextAttendance,
    legacyAttendance,
  ] =
    await Promise.all([
      safeRows(
        "assignments",

        `
          id,
          course_assignment_id,
          total_marks,
          status,
          available_from,
          start_date
        `,

        (query) =>
          query
            .in(
              "course_assignment_id",
              contextIds
            )
            .eq(
              "status",
              "published"
            )
      ),

      safeRows(
        "quizzes",

        `
          id,
          course_assignment_id,
          total_marks,
          status,
          starts_at,
          quiz_date
        `,

        (query) =>
          query
            .in(
              "course_assignment_id",
              contextIds
            )
            .eq(
              "status",
              "published"
            )
      ),

      // New attendance records
      safeRows(
        "attendance_records",

        `
          id,
          student_id,
          course_id,
          course_assignment_id,
          attendance_session_id,
          date,
          status,
          marked_at
        `,

        (query) =>
          query
            .in(
              "course_assignment_id",
              contextIds
            )
            .in(
              "student_id",
              studentIds
            )
      ),

      // Old mobile-app attendance records
      // may not contain course_assignment_id.
      courseIds.length
        ? safeRows(
            "attendance_records",

            `
              id,
              student_id,
              course_id,
              course_assignment_id,
              attendance_session_id,
              date,
              status,
              marked_at
            `,

            (query) =>
              query
                .in(
                  "course_id",
                  courseIds
                )
                .in(
                  "student_id",
                  studentIds
                )
                .is(
                  "course_assignment_id",
                  null
                )
          )
        : [],
    ]);

    // Pehle tamam published activities ki submissions load hongi.
  // Agar submission mojood hai to activity conducted samjhi jayegi,
  // chahe starts_at timezone ki wajah se future nazar aa raha ho.

  const assignmentCandidates =
    assignmentData || [];

  const quizCandidates =
    quizData || [];

  const studentRows = async (
    table,
    select,
    column,
    values
  ) =>
    values.length
      ? safeRows(
          table,
          select,
          (q) =>
            q
              .in(column, values)
              .in(
                "student_id",
                studentIds
              )
        )
      : [];

  const [
    allAssignmentSubmissions,
    allQuizSubmissions,
  ] = await Promise.all([
    studentRows(
      "assignment_submissions",
      `
        id,
        assignment_id,
        student_id,
        marks_obtained,
        status,
        graded_at,
        submitted_at
      `,
      "assignment_id",
      assignmentCandidates.map(
        (row) => row.id
      )
    ),

    studentRows(
      "quiz_submissions",
      `
        id,
        quiz_id,
        student_id,
        score,
        total_marks,
        submitted_at
      `,
      "quiz_id",
      quizCandidates.map(
        (row) => row.id
      )
    ),
  ]);

  const submittedAssignmentIds =
    new Set(
      allAssignmentSubmissions.map(
        (row) => row.assignment_id
      )
    );

  const submittedQuizIds =
    new Set(
      allQuizSubmissions.map(
        (row) => row.quiz_id
      )
    );

  // Released activity include hogi.
  // Agar submission already mojood hai to date mismatch ke bawajood
  // activity ko include kiya jayega.

  const assignments =
    assignmentCandidates.filter(
      (row) =>
        released(
          row,
          [
            "available_from",
            "start_date",
          ]
        ) ||
        submittedAssignmentIds.has(
          row.id
        )
    );

  const quizzes =
    quizCandidates.filter(
      (row) =>
        released(
          row,
          [
            "starts_at",
            "quiz_date",
          ]
        ) ||
        submittedQuizIds.has(
          row.id
        )
    );

  const includedAssignmentIds =
    new Set(
      assignments.map(
        (row) => row.id
      )
    );

  const includedQuizIds =
    new Set(
      quizzes.map(
        (row) => row.id
      )
    );

  const assignmentSubmissions =
    allAssignmentSubmissions.filter(
      (row) =>
        includedAssignmentIds.has(
          row.assignment_id
        )
    );

  const quizSubmissions =
    allQuizSubmissions.filter(
      (row) =>
        includedQuizIds.has(
          row.quiz_id
        )
    );

  const latestAssignments =
    latestByKey(
      assignmentSubmissions,

      (row) =>
        `${row.student_id}:${row.assignment_id}`,

      (row) =>
        row.graded_at ||
        row.submitted_at
    );

  const latestQuizzes =
    latestByKey(
      quizSubmissions,

      (row) =>
        `${row.student_id}:${row.quiz_id}`,

      (row) =>
        row.submitted_at
    );

  // ====================================================
  // ENROLLMENT LOOKUP
  // ====================================================

  const enrollmentsByContext =
    new Map();

  const legacyContext =
    new Map();

  for (
    const enrollment
    of enrollments
  ) {
    const contextList =
      enrollmentsByContext.get(
        enrollment
          .course_assignment_id
      ) || [];

    contextList.push(
      enrollment
    );

    enrollmentsByContext.set(
      enrollment
        .course_assignment_id,
      contextList
    );

    const key =
      `${enrollment.student_id}:${enrollment.course_id}`;

    if (
      !legacyContext.has(key)
    ) {
      legacyContext.set(
        key,
        enrollment
      );
    } else {
      // More than one matching enrollment:
      // do not guess its Course Assignment.
      legacyContext.set(
        key,
        null
      );
    }
  }

  // ====================================================
  // NORMALIZE ATTENDANCE
  // ====================================================

  const contextSet =
    new Set(contextIds);

  const attendanceRows = [
    ...contextAttendance,
    ...legacyAttendance,
  ]
    .map(
      (row) => {
        if (
          row.course_assignment_id &&
          contextSet.has(
            row.course_assignment_id
          )
        ) {
          return {
            ...row,
            context_id:
              row.course_assignment_id,
          };
        }

        const enrollment =
          legacyContext.get(
            `${row.student_id}:${row.course_id}`
          );

        if (!enrollment) {
          return null;
        }

        const recordDate =
          row.date
            ? String(
                row.date
              ).slice(
                0,
                10
              )
            : null;

        const startDate =
          String(
            enrollment
              .access_start_date ||
              enrollment
                .enrolled_at ||
              ""
          ).slice(
            0,
            10
          );

        if (
          recordDate &&
          startDate &&
          recordDate <
            startDate
        ) {
          return null;
        }

        return {
          ...row,

          context_id:
            enrollment
              .course_assignment_id,
        };
      }
    )
    .filter(Boolean);

  // attendance_sessions table empty ho to
  // date ko temporary session key use karega.
  const latestAttendance =
    latestByKey(
      attendanceRows,

      (row) =>
        `${row.student_id}:${row.context_id}:` +
        `${
          row.attendance_session_id ||
          row.date ||
          row.id
        }`,

      (row) =>
        row.marked_at
    );

  // ====================================================
  // STUDENT STATISTICS
  // ====================================================

  const stats =
    new Map(
      studentIds.map(
        (id) => [
          id,

          {
            courses: 0,

            present: 0,
            attendance: 0,

            assignmentEarned: 0,
            assignmentMax: 0,

            quizEarned: 0,
            quizMax: 0,
          },
        ]
      )
    );

  for (
    const enrollment
    of enrollments
  ) {
    const stat =
      stats.get(
        enrollment.student_id
      );

    if (stat) {
      stat.courses += 1;
    }
  }

  // ====================================================
  // ASSIGNMENT MARKS
  // ====================================================

  for (
    const assignment
    of assignments
  ) {
    const max =
      number(
        assignment.total_marks
      );

    if (
      max == null ||
      max <= 0
    ) {
      continue;
    }

    const enrolledStudents =
      enrollmentsByContext.get(
        assignment
          .course_assignment_id
      ) || [];

    for (
      const enrollment
      of enrolledStudents
    ) {
      const stat =
        stats.get(
          enrollment.student_id
        );

      if (!stat) continue;

      const submission =
        latestAssignments.get(
          `${enrollment.student_id}:${assignment.id}`
        );

      const earned =
        number(
          submission
            ?.marks_obtained
        );

      stat.assignmentMax +=
        max;

      // Published assignment not submitted
      // or not graded = zero marks.
      stat.assignmentEarned +=
        earned == null
          ? 0
          : Math.max(
              0,
              Math.min(
                max,
                earned
              )
            );
    }
  }

  // ====================================================
  // QUIZ MARKS
  // ====================================================

  for (
    const quiz
    of quizzes
  ) {
    const enrolledStudents =
      enrollmentsByContext.get(
        quiz.course_assignment_id
      ) || [];

    for (
      const enrollment
      of enrolledStudents
    ) {
      const stat =
        stats.get(
          enrollment.student_id
        );

      if (!stat) continue;

      const submission =
        latestQuizzes.get(
          `${enrollment.student_id}:${quiz.id}`
        );

      const submittedMax =
        number(
          submission?.total_marks
        );

      const quizMax =
        number(
          quiz.total_marks
        );

      const max =
        submittedMax != null &&
        submittedMax > 0
          ? submittedMax
          : quizMax;

      if (
        max == null ||
        max <= 0
      ) {
        continue;
      }

      const earned =
        number(
          submission?.score
        );

      stat.quizMax +=
        max;

      // Started quiz not attempted = zero.
      stat.quizEarned +=
        earned == null
          ? 0
          : Math.max(
              0,
              Math.min(
                max,
                earned
              )
            );
    }
  }

  // ====================================================
  // ATTENDANCE STATUS
  // ====================================================

  for (
    const row
    of latestAttendance.values()
  ) {
    const stat =
      stats.get(
        row.student_id
      );

    if (!stat) continue;

    const status =
      String(
        row.status || ""
      )
        .trim()
        .toLowerCase();

    stat.attendance += 1;

    if (
      status === "present" ||
      status === "late"
    ) {
      stat.present += 1;
    }
  }

  // ====================================================
  // FINAL STUDENT PROGRESS
  // ====================================================

  return students.map(
    (student) => {
      const stat =
        stats.get(
          student.id
        );

      if (
        !stat ||
        !stat.courses
      ) {
        return {
          ...student,
          ...emptyProgress(),
        };
      }

      const breakdown = {
        attendance:
          stat.attendance > 0
            ? clamp(
                (
                  stat.present /
                  stat.attendance
                ) * 100
              )
            : null,

        assignments:
          percent(
            stat.assignmentEarned,
            stat.assignmentMax
          ),

        quizzes:
          percent(
            stat.quizEarned,
            stat.quizMax
          ),
      };

      // Only categories that currently
      // have real/released data are included.
      const included =
        Object.values(
          breakdown
        ).filter(
          (value) =>
            value != null
        );

      const progress =
        included.length
          ? Math.round(
              included.reduce(
                (
                  sum,
                  value
                ) =>
                  sum +
                  value,

                0
              ) /
                included.length
            )
          : 0;

      return {
        ...student,

        enrolled_courses_count:
          stat.courses,

        enrolled_courses:
          stat.courses,

        course_count:
          stat.courses,

        progress_percentage:
          progress,

        average_progress:
          progress,

        progress,

        progress_breakdown: {
          attendance:
            breakdown.attendance ==
            null
              ? null
              : Math.round(
                  breakdown.attendance
                ),

          assignments:
            breakdown.assignments ==
            null
              ? null
              : Math.round(
                  breakdown.assignments
                ),

          quizzes:
            breakdown.quizzes ==
            null
              ? null
              : Math.round(
                  breakdown.quizzes
                ),

          included_categories:
            included.length,
        },

        progress_source:
          "current_semester_live_performance",
      };
    }
  );
};

// ======================================================
// FIND STUDENT BY EMAIL
// ======================================================

const findStudentByEmail = async (email) => {
  const {
    data,
    error,
  } = await supabaseAdmin
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("email", email)
    .eq("role", "student")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
};

// ======================================================
// CREATE STUDENT PROFILE
// ======================================================

const createStudentProfile = async (payload) => {
  const {
    data,
    error,
  } = await supabaseAdmin
    .from("profiles")
    .upsert(payload, {
      onConflict: "id",
      ignoreDuplicates: false,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error(
      "Student profile was not created."
    );
  }

  return getStudentById(payload.id);
};

// ======================================================
// GET ALL STUDENTS
// ======================================================

const getAllStudents = async (courseId = null) => {
  let excludedStudentIds = [];

  // ----------------------------------------------------
  // If courseId is supplied, return only students who
  // are NOT already enrolled in that course.
  // ----------------------------------------------------

  if (courseId) {
    const enrolledStudents = await allRows(() =>
      supabaseAdmin
        .from("enrollments")
        .select("student_id")
        .eq("course_id", courseId)
    );

    excludedStudentIds = [
      ...new Set(
        (enrolledStudents || [])
          .map((item) => item.student_id)
          .filter(Boolean)
      ),
    ];
  }

  // ----------------------------------------------------
  // Fetch ALL students, not only the first PostgREST page.
  // ----------------------------------------------------

  const data = await allRows(() => {
    let query = supabaseAdmin
      .from("profiles")
      .select(PROFILE_SELECT)
      .eq("role", "student")
      .order("created_at", {
        ascending: false,
      });

    if (excludedStudentIds.length) {
      query = query.not(
        "id",
        "in",
        `(${excludedStudentIds.join(",")})`
      );
    }

    return query;
  });

  const withLastLogin = await attachLastLogin(data || []);

  return attachEnrollmentStats(withLastLogin);
};

// ======================================================
// GET SINGLE STUDENT
// ======================================================

const getStudentById = async (id) => {
  const {
    data,
    error,
  } = await supabaseAdmin
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("id", id)
    .eq("role", "student")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const [withLastLogin] = await attachLastLogin([data]);

  const enriched = await attachEnrollmentStats([
    withLastLogin || data,
  ]);

  return enriched[0] || withLastLogin || data;
};

// ======================================================
// UPDATE STUDENT
// ======================================================

const updateStudent = async ({
  id,
  ...studentData
}) => {
  const {
    data,
    error,
  } = await supabaseAdmin
    .from("profiles")
    .update({
      ...studentData,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("role", "student")
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return getStudentById(id);
};

// ======================================================
// UPDATE STUDENT STATUS
// ======================================================

const updateStudentStatus = async (
  id,
  manualIsActive,
  academicBlocked = false
) => {
  const effectiveActive = Boolean(manualIsActive) && !Boolean(academicBlocked);

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      manual_is_active: Boolean(manualIsActive),
      is_active: effectiveActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("role", "student");

  if (error) throw error;
  return getStudentById(id);
};

// ======================================================
// DELETE STUDENT PROFILE
// ======================================================

const deleteStudentProfile = async (id) => {
  const {
    error,
  } = await supabaseAdmin
    .from("profiles")
    .delete()
    .eq("id", id)
    .eq("role", "student");

  if (error) {
    throw error;
  }

  return {
    id,
  };
};


// ======================================================
// CREATE STUDENT ACADEMIC HISTORY
// ======================================================

const createAcademicHistory = async (payload) => {
  const { data, error } = await supabaseAdmin
    .from("student_academic_history")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
};

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  PROFILE_SELECT,

  findStudentByEmail,

  createStudentProfile,

  getAllStudents,

  getStudentById,

  updateStudent,

  updateStudentStatus,

  deleteStudentProfile,

  createAcademicHistory,
};