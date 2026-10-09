const {
  supabaseAdmin,
} = require(
  "../config/supabase"
);

const {
  result,
  allRows,
} = require(
  "../utils/api"
);

const courseAssignments =
  require(
    "./courseAssignment.model"
  );

const students =
  require(
    "./student.model"
  );

const teachers =
  require(
    "./teacher.model"
  );

const courses =
  require(
    "./course.model"
  );

// ======================================================
// DATABASE HELPERS
// ======================================================

const rows = (
  table,
  build
) =>
  allRows(
    () => {
      let query =
        supabaseAdmin
          .from(
            table
          )
          .select(
            "*"
          );

      return build
        ? build(
            query
          )
        : query;
    }
  );

const optionalRows =
  async (
    table,
    build
  ) => {
    try {
      return await rows(
        table,
        build
      );
    } catch (
      error
    ) {
      if (
        [
          "42P01",
          "42703",
          "PGRST204",
          "PGRST205",
        ].includes(
          error?.code
        )
      ) {
        return [];
      }

      if (
        String(
          error?.message ||
            ""
        )
          .toLowerCase()
          .includes(
            "schema cache"
          )
      ) {
        return [];
      }

      throw error;
    }
  };

const mapById =
  async (
    table,
    ids,
    select = "*"
  ) => {
    const clean = [
      ...new Set(
        (
          ids ||
          []
        ).filter(
          Boolean
        )
      ),
    ];

    if (
      !clean.length
    ) {
      return new Map();
    }

    const data =
      await result(
        supabaseAdmin
          .from(
            table
          )
          .select(
            select
          )
          .in(
            "id",
            clean
          )
      );

    return new Map(
      (
        data ||
        []
      ).map(
        (
          item
        ) => [
          item.id,
          item,
        ]
      )
    );
  };

// ======================================================
// NUMBER HELPERS
// ======================================================

const number = (
  value
) => {
  const parsed =
    Number(
      value
    );

  return Number.isFinite(
    parsed
  )
    ? parsed
    : 0;
};

const clamp = (
  value
) =>
  Math.max(
    0,
    Math.min(
      100,
      Math.round(
        number(
          value
        )
      )
    )
  );

// ======================================================
// STUDENT OVERVIEW
// ======================================================

const getStudentOverview =
  async (
    studentId
  ) => {
    const profile =
      await students
        .getStudentById(
          studentId
        );

    if (
      !profile
    ) {
      return null;
    }

    const [
      academicHistory,
      enrollments,
      allMarks,
    ] =
      await Promise.all(
        [
          rows(
            "student_academic_history",

            (
              query
            ) =>
              query
                .eq(
                  "student_id",
                  studentId
                )
                .order(
                  "started_at",
                  {
                    ascending:
                      true,
                  }
                )
          ),

          rows(
            "enrollments",

            (
              query
            ) =>
              query
                .eq(
                  "student_id",
                  studentId
                )
                .order(
                  "enrolled_at",
                  {
                    ascending:
                      false,
                  }
                )
          ),

          optionalRows(
            "gradebook_marks",

            (
              query
            ) =>
              query.eq(
                "student_id",
                studentId
              )
          ),
        ]
      );

    const assignmentMap =
      await mapById(
        "course_assignments",

        enrollments.map(
          (
            item
          ) =>
            item.course_assignment_id
        ),

        `
          id,
          course_id,
          batch_id,
          semester_id,
          teacher_id,
          status,
          created_at,
          updated_at
        `
      );

    const assignmentValues = [
      ...assignmentMap.values(),
    ];

    const semesterIds = [
      ...academicHistory.map(
        (
          item
        ) =>
          item.semester_id
      ),

      ...enrollments.map(
        (
          item
        ) =>
          item.semester_id
      ),

      ...assignmentValues.map(
        (
          item
        ) =>
          item.semester_id
      ),
    ];

    const batchIds = [
      ...academicHistory.map(
        (
          item
        ) =>
          item.batch_id
      ),

      ...enrollments.map(
        (
          item
        ) =>
          item.batch_id
      ),

      ...assignmentValues.map(
        (
          item
        ) =>
          item.batch_id
      ),
    ];

    const [
      batches,
      departments,
      programs,
      semesters,
      courseMap,
      teacherMap,
    ] =
      await Promise.all(
        [
          mapById(
            "academic_batches",

            batchIds,

            `
              id,
              start_year,
              end_year,
              status
            `
          ),

          mapById(
            "academic_departments",

            academicHistory.map(
              (
                item
              ) =>
                item.department_id
            ),

            `
              id,
              name,
              code,
              status,
              batch_id
            `
          ),

          mapById(
            "academic_programs",

            academicHistory.map(
              (
                item
              ) =>
                item.program_id
            ),

            `
              id,
              name,
              code,
              degree_title,
              status,
              department_id
            `
          ),

          mapById(
            "academic_semesters",

            semesterIds,

            `
              id,
              name,
              semester_number,
              program_id,
              status
            `
          ),

          mapById(
            "courses",

            enrollments.map(
              (
                item
              ) =>
                item.course_id
            ),

            `
              id,
              name,
              course_code,
              credits,
              status,
              department_id,
              program_id
            `
          ),

          mapById(
            "profiles",

            assignmentValues.map(
              (
                item
              ) =>
                item.teacher_id
            ),

            `
              id,
              full_name,
              email,
              department,
              avatar_url
            `
          ),
        ]
      );

    const enrichedAcademic =
      academicHistory.map(
        (
          item
        ) => ({
          ...item,

          batch:
            batches.get(
              item.batch_id
            ) ||
            null,

          department:
            departments.get(
              item.department_id
            ) ||
            null,

          program:
            programs.get(
              item.program_id
            ) ||
            null,

          semester:
            semesters.get(
              item.semester_id
            ) ||
            null,
        })
      );

    const enrichedEnrollments =
      enrollments.map(
        (
          item
        ) => {
          const assignment =
            assignmentMap.get(
              item.course_assignment_id
            ) ||
            null;

          const semesterId =
            item.semester_id ||
            assignment
              ?.semester_id ||
            null;

          const batchId =
            item.batch_id ||
            assignment
              ?.batch_id ||
            null;

          return {
            ...item,

            semester_id:
              semesterId,

            batch_id:
              batchId,

            semester:
              semesters.get(
                semesterId
              ) ||
              null,

            batch:
              batches.get(
                batchId
              ) ||
              null,

            course:
              courseMap.get(
                item.course_id
              ) ||
              null,

            course_assignment:
              assignment
                ? {
                    ...assignment,

                    teacher:
                      teacherMap.get(
                        assignment.teacher_id
                      ) ||
                      null,
                  }
                : null,
          };
        }
      );

    const historyBySemester =
      new Map();

    for (
      const term
      of enrichedAcademic
    ) {
      if (
        !term.semester_id
      ) {
        continue;
      }

      historyBySemester.set(
        term.semester_id,
        {
          semester_id:
            term.semester_id,

          semester:
            term.semester,

          academic_record:
            term,

          is_current:
            term.status ===
              "current" &&
            !term.ended_at,

          enrollments:
            [],
        }
      );
    }

    for (
      const enrollment
      of enrichedEnrollments
    ) {
      const key =
        enrollment.semester_id ||
        "legacy";

      if (
        !historyBySemester.has(
          key
        )
      ) {
        historyBySemester.set(
          key,
          {
            semester_id:
              enrollment.semester_id ||
              null,

            semester:
              enrollment.semester ||
              null,

            academic_record:
              null,

            is_current:
              Boolean(
                enrollment.semester_id &&
                  profile.semester_id &&
                  String(
                    enrollment.semester_id
                  ) ===
                    String(
                      profile.semester_id
                    )
              ),

            enrollments:
              [],
          }
        );
      }

      historyBySemester
        .get(
          key
        )
        .enrollments
        .push(
          enrollment
        );
    }

    const semesterHistory = [
      ...historyBySemester.values(),
    ]
      .map(
        (
          term
        ) => {
          const progressValues =
            term.enrollments
              .map(
                (
                  item
                ) =>
                  Number(
                    item.progress_percent
                  )
              )
              .filter(
                Number.isFinite
              );

          return {
            ...term,

            summary: {
              courses:
                term.enrollments
                  .length,

              regular:
                term.enrollments.filter(
                  (
                    item
                  ) =>
                    (
                      item.enrollment_type ||
                      "regular"
                    ) ===
                    "regular"
                ).length,

              supply:
                term.enrollments.filter(
                  (
                    item
                  ) =>
                    item.enrollment_type ===
                    "supply"
                ).length,

              active:
                term.enrollments.filter(
                  (
                    item
                  ) =>
                    item.status ===
                    "active"
                ).length,

              completed:
                term.enrollments.filter(
                  (
                    item
                  ) =>
                    item.status ===
                    "completed"
                ).length,

              average_stored_progress:
                progressValues.length
                  ? Math.round(
                      progressValues.reduce(
                        (
                          sum,
                          value
                        ) =>
                          sum +
                          value,

                        0
                      ) /
                        progressValues.length
                    )
                  : 0,
            },
          };
        }
      )
      .sort(
        (
          first,
          second
        ) =>
          number(
            first.semester
              ?.semester_number
          ) -
          number(
            second.semester
              ?.semester_number
          )
      );

    const markValues =
      allMarks
        .map(
          (
            item
          ) =>
            Number(
              item.marks_obtained
            )
        )
        .filter(
          Number.isFinite
        );

    return {
      profile,

      academic_history:
        enrichedAcademic,

      enrollments:
        enrichedEnrollments,

      semester_history:
        semesterHistory,

      overall: {
        semesters:
          semesterHistory.filter(
            (
              item
            ) =>
              item.semester_id
          ).length,

        total_course_records:
          enrichedEnrollments.length,

        // Kept for older frontend compatibility.
        course_enrollments:
          enrichedEnrollments.length,

        regular_enrollments:
          enrichedEnrollments.filter(
            (
              item
            ) =>
              (
                item.enrollment_type ||
                "regular"
              ) ===
              "regular"
          ).length,

        supply_enrollments:
          enrichedEnrollments.filter(
            (
              item
            ) =>
              item.enrollment_type ===
              "supply"
          ).length,

        completed_courses:
          enrichedEnrollments.filter(
            (
              item
            ) =>
              item.status ===
              "completed"
          ).length,

        current_courses:
          enrichedEnrollments.filter(
            (
              item
            ) =>
              item.status ===
                "active" &&
              (
                item.enrollment_type ===
                  "supply" ||
                (
                  item.semester_id &&
                  profile.semester_id &&
                  String(
                    item.semester_id
                  ) ===
                    String(
                      profile.semester_id
                    )
                )
              )
          ).length,

        current_progress:
          clamp(
            profile.progress_percentage ??
              profile.progress ??
              0
          ),

        gradebook_marks:
          allMarks.length,

        average_recorded_mark:
          markValues.length
            ? Math.round(
                (
                  markValues.reduce(
                    (
                      sum,
                      value
                    ) =>
                      sum +
                      value,

                    0
                  ) /
                  markValues.length
                ) *
                  100
              ) /
              100
            : null,
      },
    };
  };

// ======================================================
// STUDENT COURSE HISTORY
// ======================================================

const getStudentCourseHistory =
  async (
    studentId,
    courseAssignmentId
  ) => {
    const [
      profile,
      assignment,
    ] =
      await Promise.all(
        [
          students.getStudentById(
            studentId
          ),

          courseAssignments.getById(
            courseAssignmentId
          ),
        ]
      );

    if (
      !profile ||
      !assignment
    ) {
      return null;
    }

    const [
      teacherHistory,
      attendance,
      assignmentRows,
      quizRows,
      materials,
      gradebookComponents,
      gradebookApprovals,
      enrollment,
      announcements,
      liveSessions,
    ] =
      await Promise.all(
        [
          courseAssignments.getHistory(
            courseAssignmentId
          ),

          rows(
            "attendance_records",

            (
              query
            ) =>
              query
                .eq(
                  "student_id",
                  studentId
                )
                .eq(
                  "course_assignment_id",
                  courseAssignmentId
                )
                .order(
                  "date",
                  {
                    ascending:
                      false,
                  }
                )
          ),

          rows(
            "assignments",

            (
              query
            ) =>
              query
                .eq(
                  "course_assignment_id",
                  courseAssignmentId
                )
                .order(
                  "created_at",
                  {
                    ascending:
                      false,
                  }
                )
          ),

          rows(
            "quizzes",

            (
              query
            ) =>
              query
                .eq(
                  "course_assignment_id",
                  courseAssignmentId
                )
                .order(
                  "created_at",
                  {
                    ascending:
                      false,
                  }
                )
          ),

          rows(
            "materials",

            (
              query
            ) =>
              query
                .eq(
                  "course_assignment_id",
                  courseAssignmentId
                )
                .order(
                  "uploaded_at",
                  {
                    ascending:
                      false,
                  }
                )
          ),

          optionalRows(
            "gradebook_components",

            (
              query
            ) =>
              query
                .eq(
                  "course_assignment_id",
                  courseAssignmentId
                )
                .order(
                  "created_at",
                  {
                    ascending:
                      true,
                  }
                )
          ),

          optionalRows(
            "gradebook_approvals",

            (
              query
            ) =>
              query
                .eq(
                  "course_assignment_id",
                  courseAssignmentId
                )
                .order(
                  "updated_at",
                  {
                    ascending:
                      false,
                  }
                )
          ),

          result(
            supabaseAdmin
              .from(
                "enrollments"
              )
              .select(
                "*"
              )
              .eq(
                "student_id",
                studentId
              )
              .eq(
                "course_assignment_id",
                courseAssignmentId
              )
              .order(
                "enrolled_at",
                {
                  ascending:
                    false,
                }
              )
              .limit(
                1
              )
              .maybeSingle()
          ),

          rows(
            "announcements",

            (
              query
            ) =>
              query
                .eq(
                  "course_assignment_id",
                  courseAssignmentId
                )
                .order(
                  "created_at",
                  {
                    ascending:
                      false,
                  }
                )
          ),

          rows(
            "live_sessions",

            (
              query
            ) =>
              query
                .eq(
                  "course_assignment_id",
                  courseAssignmentId
                )
                .order(
                  "started_at",
                  {
                    ascending:
                      false,
                  }
                )
          ),
        ]
      );

    const [
      submissions,
      quizSubmissions,
      gradebookMarks,
    ] =
      await Promise.all(
        [
          assignmentRows.length
            ? rows(
                "assignment_submissions",

                (
                  query
                ) =>
                  query
                    .eq(
                      "student_id",
                      studentId
                    )
                    .in(
                      "assignment_id",

                      assignmentRows.map(
                        (
                          item
                        ) =>
                          item.id
                      )
                    )
                    .order(
                      "submitted_at",
                      {
                        ascending:
                          false,
                      }
                    )
              )
            : [],

          quizRows.length
            ? rows(
                "quiz_submissions",

                (
                  query
                ) =>
                  query
                    .eq(
                      "student_id",
                      studentId
                    )
                    .in(
                      "quiz_id",

                      quizRows.map(
                        (
                          item
                        ) =>
                          item.id
                      )
                    )
                    .order(
                      "submitted_at",
                      {
                        ascending:
                          false,
                      }
                    )
              )
            : [],

          gradebookComponents.length
            ? optionalRows(
                "gradebook_marks",

                (
                  query
                ) =>
                  query
                    .eq(
                      "student_id",
                      studentId
                    )
                    .in(
                      "component_id",

                      gradebookComponents.map(
                        (
                          item
                        ) =>
                          item.id
                      )
                    )
              )
            : [],
        ]
      );

    const submissionByAssignment =
      new Map();

    for (
      const item
      of submissions
    ) {
      if (
        !submissionByAssignment.has(
          item.assignment_id
        )
      ) {
        submissionByAssignment.set(
          item.assignment_id,
          item
        );
      }
    }

    const quizSubmissionByQuiz =
      new Map();

    for (
      const item
      of quizSubmissions
    ) {
      if (
        !quizSubmissionByQuiz.has(
          item.quiz_id
        )
      ) {
        quizSubmissionByQuiz.set(
          item.quiz_id,
          item
        );
      }
    }

    const markByComponent =
      new Map(
        gradebookMarks.map(
          (
            item
          ) => [
            item.component_id,
            item,
          ]
        )
      );

    const approvalByCategory =
      new Map(
        gradebookApprovals.map(
          (
            item
          ) => [
            String(
              item.category ||
                ""
            ).toLowerCase(),

            item,
          ]
        )
      );

    const presentCount =
      attendance.filter(
        (
          item
        ) =>
          [
            "present",
            "late",
          ].includes(
            String(
              item.status ||
                ""
            ).toLowerCase()
          )
      ).length;

    const attendancePercentage =
      attendance.length
        ? Math.round(
            (
              presentCount /
              attendance.length
            ) *
              100
          )
        : 0;

    const gradebook =
      gradebookComponents.map(
        (
          item
        ) => ({
          ...item,

          approval:
            approvalByCategory.get(
              String(
                item.category ||
                  ""
              ).toLowerCase()
            ) ||
            null,

          mark:
            markByComponent.get(
              item.id
            ) ||
            null,
        })
      );

    const earned =
      gradebook.reduce(
        (
          sum,
          item
        ) =>
          sum +
          number(
            item.mark
              ?.marks_obtained
          ),

        0
      );

    const maximum =
      gradebook.reduce(
        (
          sum,
          item
        ) =>
          sum +
          number(
            item.max_marks
          ),

        0
      );

    return {
      student:
        profile,

      course_assignment:
        assignment,

      teacher_history:
        teacherHistory,

      enrollment,

      attendance: {
        records:
          attendance,

        present:
          presentCount,

        total:
          attendance.length,

        percentage:
          attendancePercentage,
      },

      assignments:
        assignmentRows.map(
          (
            item
          ) => ({
            ...item,

            submission:
              submissionByAssignment.get(
                item.id
              ) ||
              null,
          })
        ),

      quizzes:
        quizRows.map(
          (
            item
          ) => ({
            ...item,

            submission:
              quizSubmissionByQuiz.get(
                item.id
              ) ||
              null,
          })
        ),

      gradebook,

      gradebook_approvals:
        gradebookApprovals,

      materials,

      announcements,

      live_sessions:
        liveSessions,

      summary: {
        assignment_submissions:
          submissions.length,

        quiz_attempts:
          quizSubmissions.length,

        attendance_percentage:
          attendancePercentage,

        recorded_marks:
          gradebookMarks.length,

        marks_obtained:
          earned,

        max_marks:
          maximum,

        marks_percentage:
          maximum >
          0
            ? Math.round(
                (
                  earned /
                  maximum
                ) *
                  100
              )
            : null,
      },
    };
  };

// ======================================================
// TEACHER HISTORY
// ======================================================

const getTeacherHistory =
  async (
    teacherId
  ) => {
    const profile =
      await teachers
        .getTeacherById(
          teacherId
        );

    if (
      !profile
    ) {
      return null;
    }

    const [
      history,
      teacherActivities,
    ] =
      await Promise.all(
        [
          rows(
            "course_assignment_teacher_history",

            (
              query
            ) =>
              query
                .eq(
                  "teacher_id",
                  teacherId
                )
                .order(
                  "assigned_at",
                  {
                    ascending:
                      false,
                  }
                )
          ),

          Promise.all(
            [
              rows(
                "assignments",

                (
                  query
                ) =>
                  query
                    .eq(
                      "teacher_id",
                      teacherId
                    )
                    .order(
                      "created_at",
                      {
                        ascending:
                          false,
                      }
                    )
              ),

              rows(
                "quizzes",

                (
                  query
                ) =>
                  query
                    .eq(
                      "teacher_id",
                      teacherId
                    )
                    .order(
                      "created_at",
                      {
                        ascending:
                          false,
                      }
                    )
              ),

              rows(
                "materials",

                (
                  query
                ) =>
                  query
                    .eq(
                      "teacher_id",
                      teacherId
                    )
                    .order(
                      "uploaded_at",
                      {
                        ascending:
                          false,
                      }
                    )
              ),

              rows(
                "announcements",

                (
                  query
                ) =>
                  query
                    .eq(
                      "teacher_id",
                      teacherId
                    )
                    .order(
                      "created_at",
                      {
                        ascending:
                          false,
                      }
                    )
              ),

              rows(
                "live_sessions",

                (
                  query
                ) =>
                  query
                    .eq(
                      "teacher_id",
                      teacherId
                    )
                    .order(
                      "started_at",
                      {
                        ascending:
                          false,
                      }
                    )
              ),

              rows(
                "attendance_records",

                (
                  query
                ) =>
                  query
                    .eq(
                      "marked_by",
                      teacherId
                    )
                    .order(
                      "marked_at",
                      {
                        ascending:
                          false,
                      }
                    )
              ),

              rows(
                "attendance_sessions",

                (
                  query
                ) =>
                  query
                    .eq(
                      "teacher_id",
                      teacherId
                    )
                    .order(
                      "attendance_date",
                      {
                        ascending:
                          false,
                      }
                    )
              ),
            ]
          ),
        ]
      );

    const [
      assignmentActivities,
      quizzes,
      materials,
      announcements,
      liveSessions,
      attendance,
      attendanceSessions,
    ] =
      teacherActivities;

    const allActivities = [
      ...assignmentActivities,
      ...quizzes,
      ...materials,
      ...announcements,
      ...liveSessions,
      ...attendance,
      ...attendanceSessions,
    ];

    const contextIds = [
      ...history.map(
        (
          item
        ) =>
          item.course_assignment_id
      ),

      ...allActivities.map(
        (
          item
        ) =>
          item.course_assignment_id
      ),
    ];

    const assignmentMap =
      await mapById(
        "course_assignments",

        contextIds,

        `
          id,
          course_id,
          batch_id,
          semester_id,
          teacher_id,
          status,
          created_at,
          updated_at
        `
      );

    const assignmentContexts = [
      ...assignmentMap.values(),
    ];

    const activityCourseIds =
      allActivities.map(
        (
          item
        ) =>
          item.course_id
      );

    const [
      courseMap,
      batchMap,
      semesterMap,
    ] =
      await Promise.all(
        [
          mapById(
            "courses",

            [
              ...assignmentContexts.map(
                (
                  item
                ) =>
                  item.course_id
              ),

              ...activityCourseIds,
            ],

            `
              id,
              name,
              course_code,
              credits,
              status
            `
          ),

          mapById(
            "academic_batches",

            assignmentContexts.map(
              (
                item
              ) =>
                item.batch_id
            ),

            `
              id,
              start_year,
              end_year,
              status
            `
          ),

          mapById(
            "academic_semesters",

            assignmentContexts.map(
              (
                item
              ) =>
                item.semester_id
            ),

            `
              id,
              name,
              semester_number,
              program_id,
              status
            `
          ),
        ]
      );

    const contextFor = (
      item
    ) => {
      const courseAssignment =
        assignmentMap.get(
          item.course_assignment_id
        ) ||
        null;

      const courseId =
        courseAssignment
          ?.course_id ||
        item.course_id ||
        null;

      return {
        course_assignment_id:
          courseAssignment
            ?.id ||
          item.course_assignment_id ||
          null,

        course:
          courseMap.get(
            courseId
          ) ||
          null,

        batch:
          courseAssignment
            ? batchMap.get(
                courseAssignment.batch_id
              ) ||
              null
            : null,

        semester:
          courseAssignment
            ? semesterMap.get(
                courseAssignment.semester_id
              ) ||
              null
            : null,

        is_legacy:
          !courseAssignment,
      };
    };

    const enrichActivities = (
      items
    ) =>
      items.map(
        (
          item
        ) => ({
          ...item,

          context:
            contextFor(
              item
            ),
        })
      );

    return {
      profile,

      teaching_history:
        history.map(
          (
            item
          ) => {
            const assignment =
              assignmentMap.get(
                item.course_assignment_id
              ) ||
              null;

            return {
              ...item,

              course_assignment:
                assignment
                  ? {
                      ...assignment,

                      course:
                        courseMap.get(
                          assignment.course_id
                        ) ||
                        null,

                      batch:
                        batchMap.get(
                          assignment.batch_id
                        ) ||
                        null,

                      semester:
                        semesterMap.get(
                          assignment.semester_id
                        ) ||
                        null,
                    }
                  : null,
            };
          }
        ),

      activity_counts: {
        assignments:
          assignmentActivities.length,

        quizzes:
          quizzes.length,

        materials:
          materials.length,

        announcements:
          announcements.length,

        live_sessions:
          liveSessions.length,

        attendance_records:
          attendance.length,

        attendance_sessions:
          attendanceSessions.length,
      },

      activities: {
        assignments:
          enrichActivities(
            assignmentActivities
          ),

        quizzes:
          enrichActivities(
            quizzes
          ),

        materials:
          enrichActivities(
            materials
          ),

        announcements:
          enrichActivities(
            announcements
          ),

        live_sessions:
          enrichActivities(
            liveSessions
          ),

        attendance_records:
          enrichActivities(
            attendance
          ),

        attendance_sessions:
          enrichActivities(
            attendanceSessions
          ),
      },
    };
  };

// ======================================================
// COURSE ASSIGNMENT HISTORY
// ======================================================

const getCourseAssignmentHistory =
  async (
    courseAssignmentId
  ) => {
    const assignment =
      await courseAssignments
        .getById(
          courseAssignmentId
        );

    if (
      !assignment
    ) {
      return null;
    }

    const [
      teacherHistory,
      enrollments,
      materials,
      assignmentRows,
      quizRows,
      attendance,
      attendanceSessions,
      gradebook,
      approvals,
      announcements,
      liveSessions,
      periods,
    ] =
      await Promise.all(
        [
          courseAssignments.getHistory(
            courseAssignmentId
          ),

          rows(
            "enrollments",

            (
              query
            ) =>
              query
                .eq(
                  "course_assignment_id",
                  courseAssignmentId
                )
                .order(
                  "enrolled_at",
                  {
                    ascending:
                      false,
                  }
                )
          ),

          rows(
            "materials",

            (
              query
            ) =>
              query
                .eq(
                  "course_assignment_id",
                  courseAssignmentId
                )
                .order(
                  "uploaded_at",
                  {
                    ascending:
                      false,
                  }
                )
          ),

          rows(
            "assignments",

            (
              query
            ) =>
              query
                .eq(
                  "course_assignment_id",
                  courseAssignmentId
                )
                .order(
                  "created_at",
                  {
                    ascending:
                      false,
                  }
                )
          ),

          rows(
            "quizzes",

            (
              query
            ) =>
              query
                .eq(
                  "course_assignment_id",
                  courseAssignmentId
                )
                .order(
                  "created_at",
                  {
                    ascending:
                      false,
                  }
                )
          ),

          rows(
            "attendance_records",

            (
              query
            ) =>
              query
                .eq(
                  "course_assignment_id",
                  courseAssignmentId
                )
                .order(
                  "date",
                  {
                    ascending:
                      false,
                  }
                )
          ),

          rows(
            "attendance_sessions",

            (
              query
            ) =>
              query
                .eq(
                  "course_assignment_id",
                  courseAssignmentId
                )
                .order(
                  "attendance_date",
                  {
                    ascending:
                      false,
                  }
                )
          ),

          optionalRows(
            "gradebook_components",

            (
              query
            ) =>
              query
                .eq(
                  "course_assignment_id",
                  courseAssignmentId
                )
                .order(
                  "created_at",
                  {
                    ascending:
                      true,
                  }
                )
          ),

          optionalRows(
            "gradebook_approvals",

            (
              query
            ) =>
              query
                .eq(
                  "course_assignment_id",
                  courseAssignmentId
                )
                .order(
                  "updated_at",
                  {
                    ascending:
                      false,
                  }
                )
          ),

          rows(
            "announcements",

            (
              query
            ) =>
              query
                .eq(
                  "course_assignment_id",
                  courseAssignmentId
                )
                .order(
                  "created_at",
                  {
                    ascending:
                      false,
                  }
                )
          ),

          rows(
            "live_sessions",

            (
              query
            ) =>
              query
                .eq(
                  "course_assignment_id",
                  courseAssignmentId
                )
                .order(
                  "started_at",
                  {
                    ascending:
                      false,
                  }
                )
          ),

          rows(
            "periods",

            (
              query
            ) =>
              query
                .eq(
                  "course_assignment_id",
                  courseAssignmentId
                )
                .order(
                  "created_at",
                  {
                    ascending:
                      false,
                  }
                )
          ),
        ]
      );

    const [
      studentMap,
      teacherMap,
      assignmentSubmissions,
      quizSubmissions,
      gradebookMarks,
    ] =
      await Promise.all(
        [
          mapById(
            "profiles",

            enrollments.map(
              (
                item
              ) =>
                item.student_id
            ),

            `
              id,
              full_name,
              email,
              student_id,
              avatar_url,
              is_active
            `
          ),

          mapById(
            "profiles",

            [
              ...materials.map(
                (
                  item
                ) =>
                  item.teacher_id
              ),

              ...assignmentRows.map(
                (
                  item
                ) =>
                  item.teacher_id
              ),

              ...quizRows.map(
                (
                  item
                ) =>
                  item.teacher_id
              ),

              ...announcements.map(
                (
                  item
                ) =>
                  item.teacher_id
              ),

              ...liveSessions.map(
                (
                  item
                ) =>
                  item.teacher_id
              ),

              ...attendance.map(
                (
                  item
                ) =>
                  item.marked_by
              ),
            ],

            `
              id,
              full_name,
              email,
              department,
              avatar_url,
              is_active
            `
          ),

          assignmentRows.length
            ? rows(
                "assignment_submissions",

                (
                  query
                ) =>
                  query
                    .in(
                      "assignment_id",

                      assignmentRows.map(
                        (
                          item
                        ) =>
                          item.id
                      )
                    )
                    .order(
                      "submitted_at",
                      {
                        ascending:
                          false,
                      }
                    )
              )
            : [],

          quizRows.length
            ? rows(
                "quiz_submissions",

                (
                  query
                ) =>
                  query
                    .in(
                      "quiz_id",

                      quizRows.map(
                        (
                          item
                        ) =>
                          item.id
                      )
                    )
                    .order(
                      "submitted_at",
                      {
                        ascending:
                          false,
                      }
                    )
              )
            : [],

          gradebook.length
            ? optionalRows(
                "gradebook_marks",

                (
                  query
                ) =>
                  query.in(
                    "component_id",

                    gradebook.map(
                      (
                        item
                      ) =>
                        item.id
                    )
                  )
              )
            : [],
        ]
      );

    const assignmentSubmissionCounts =
      new Map();

    for (
      const item
      of assignmentSubmissions
    ) {
      assignmentSubmissionCounts.set(
        item.assignment_id,

        (
          assignmentSubmissionCounts.get(
            item.assignment_id
          ) ||
          0
        ) +
          1
      );
    }

    const quizSubmissionCounts =
      new Map();

    for (
      const item
      of quizSubmissions
    ) {
      quizSubmissionCounts.set(
        item.quiz_id,

        (
          quizSubmissionCounts.get(
            item.quiz_id
          ) ||
          0
        ) +
          1
      );
    }

    const marksByComponent =
      new Map();

    for (
      const item
      of gradebookMarks
    ) {
      if (
        !marksByComponent.has(
          item.component_id
        )
      ) {
        marksByComponent.set(
          item.component_id,
          []
        );
      }

      marksByComponent
        .get(
          item.component_id
        )
        .push(
          item
        );
    }

    const approvalMap =
      new Map(
        approvals.map(
          (
            item
          ) => [
            String(
              item.category ||
                ""
            ).toLowerCase(),

            item,
          ]
        )
      );

    const enrichedGradebook =
      gradebook.map(
        (
          item
        ) => ({
          ...item,

          approval:
            approvalMap.get(
              String(
                item.category ||
                  ""
              ).toLowerCase()
            ) ||
            null,

          marks:
            marksByComponent.get(
              item.id
            ) ||
            [],
        })
      );

    const presentCount =
      attendance.filter(
        (
          item
        ) =>
          [
            "present",
            "late",
          ].includes(
            String(
              item.status ||
                ""
            ).toLowerCase()
          )
      ).length;

    const attendanceRate =
      attendance.length
        ? Math.round(
            (
              presentCount /
              attendance.length
            ) *
              100
          )
        : 0;

    const visibleEnrollments =
      enrollments.filter(
        (
          item
        ) =>
          item.status !==
          "inactive"
      );

    const studentIds = [
      ...new Set(
        visibleEnrollments
          .map(
            (
              item
            ) =>
              item.student_id
          )
          .filter(
            Boolean
          )
      ),
    ];

    const studentCount =
      studentIds.length;

    const publishedAssignments =
      assignmentRows.filter(
        (
          item
        ) =>
          item.status ===
          "published"
      );

    const publishedQuizzes =
      quizRows.filter(
        (
          item
        ) =>
          item.status ===
          "published"
      );

    const usableSessions =
      attendanceSessions.filter(
        (
          item
        ) =>
          item.status !==
          "cancelled"
      );

    const usableComponents =
      enrichedGradebook.filter(
        (
          item
        ) => {
          const directStatus =
            String(
              item.approval_status ||
                ""
            ).toLowerCase();

          const categoryStatus =
            String(
              item.approval
                ?.status ||
                ""
            ).toLowerCase();

          return (
            directStatus !==
              "rejected" &&
            categoryStatus !==
              "rejected"
          );
        }
      );

    const totalItems =
      publishedAssignments.length +
      publishedQuizzes.length +
      usableSessions.length +
      usableComponents.length;

    const assignmentContext =
      new Set(
        publishedAssignments.map(
          (
            item
          ) =>
            item.id
        )
      );

    const quizContext =
      new Set(
        publishedQuizzes.map(
          (
            item
          ) =>
            item.id
        )
      );

    const sessionContext =
      new Set(
        usableSessions.map(
          (
            item
          ) =>
            item.id
        )
      );

    const componentContext =
      new Set(
        usableComponents.map(
          (
            item
          ) =>
            item.id
        )
      );

    const completedByStudent =
      new Map(
        studentIds.map(
          (
            id
          ) => [
            id,
            new Set(),
          ]
        )
      );

    for (
      const item
      of assignmentSubmissions
    ) {
      if (
        assignmentContext.has(
          item.assignment_id
        ) &&
        completedByStudent.has(
          item.student_id
        )
      ) {
        completedByStudent
          .get(
            item.student_id
          )
          .add(
            `a:${item.assignment_id}`
          );
      }
    }

    for (
      const item
      of quizSubmissions
    ) {
      if (
        quizContext.has(
          item.quiz_id
        ) &&
        completedByStudent.has(
          item.student_id
        )
      ) {
        completedByStudent
          .get(
            item.student_id
          )
          .add(
            `q:${item.quiz_id}`
          );
      }
    }

    for (
      const item
      of attendance
    ) {
      if (
        sessionContext.has(
          item.attendance_session_id
        ) &&
        completedByStudent.has(
          item.student_id
        )
      ) {
        completedByStudent
          .get(
            item.student_id
          )
          .add(
            `t:${item.attendance_session_id}`
          );
      }
    }

    for (
      const item
      of gradebookMarks
    ) {
      if (
        componentContext.has(
          item.component_id
        ) &&
        completedByStudent.has(
          item.student_id
        )
      ) {
        completedByStudent
          .get(
            item.student_id
          )
          .add(
            `g:${item.component_id}`
          );
      }
    }

    const enrollmentByStudent =
      new Map();

    for (
      const item
      of visibleEnrollments
    ) {
      if (
        !enrollmentByStudent.has(
          item.student_id
        ) ||
        item.status ===
          "active"
      ) {
        enrollmentByStudent.set(
          item.student_id,
          item
        );
      }
    }

    const studentProgress =
      studentIds.map(
        (
          studentId
        ) => {
          const enrollment =
            enrollmentByStudent.get(
              studentId
            );

          const completed =
            completedByStudent.get(
              studentId
            )?.size ||
            0;

          const progress =
            totalItems >
            0
              ? Math.round(
                  (
                    completed /
                    totalItems
                  ) *
                    100
                )
              : clamp(
                  enrollment
                    ?.progress_percent
                );

          return {
            student_id:
              studentId,

            student:
              studentMap.get(
                studentId
              ) ||
              null,

            status:
              enrollment
                ?.status ||
              null,

            enrollment_type:
              enrollment
                ?.enrollment_type ||
              "regular",

            completed_items:
              completed,

            total_items:
              totalItems,

            progress:
              clamp(
                progress
              ),
          };
        }
      );

    const averageLiveProgress =
      studentProgress.length
        ? Math.round(
            studentProgress.reduce(
              (
                sum,
                item
              ) =>
                sum +
                item.progress,

              0
            ) /
              studentProgress.length
          )
        : 0;

    const distribution = [
      {
        range:
          "0–25",

        count:
          studentProgress.filter(
            (
              item
            ) =>
              item.progress <=
              25
          ).length,
      },
      {
        range:
          "26–50",

        count:
          studentProgress.filter(
            (
              item
            ) =>
              item.progress >=
                26 &&
              item.progress <=
                50
          ).length,
      },
      {
        range:
          "51–75",

        count:
          studentProgress.filter(
            (
              item
            ) =>
              item.progress >=
                51 &&
              item.progress <=
                75
          ).length,
      },
      {
        range:
          "76–100",

        count:
          studentProgress.filter(
            (
              item
            ) =>
              item.progress >=
              76
          ).length,
      },
    ];

    const attendanceByDate =
      new Map();

    for (
      const item
      of attendance
    ) {
      const key =
        item.date ||
        "Unknown";

      if (
        !attendanceByDate.has(
          key
        )
      ) {
        attendanceByDate.set(
          key,
          {
            date:
              key,

            present:
              0,

            total:
              0,
          }
        );
      }

      const bucket =
        attendanceByDate.get(
          key
        );

      bucket.total +=
        1;

      if (
        [
          "present",
          "late",
        ].includes(
          String(
            item.status ||
              ""
          ).toLowerCase()
        )
      ) {
        bucket.present +=
          1;
      }
    }

    const attendanceTrend = [
      ...attendanceByDate.values(),
    ]
      .map(
        (
          item
        ) => ({
          ...item,

          rate:
            item.total
              ? Math.round(
                  (
                    item.present /
                    item.total
                  ) *
                    100
                )
              : 0,
        })
      )
      .sort(
        (
          first,
          second
        ) =>
          String(
            first.date
          ).localeCompare(
            String(
              second.date
            )
          )
      );

    const expectedAssignments =
      studentCount *
      publishedAssignments.length;

    const expectedQuizzes =
      studentCount *
      publishedQuizzes.length;

    const expectedGradebook =
      studentCount *
      usableComponents.length;

    let completedAssignments =
      0;

    let completedQuizzes =
      0;

    let completedGradebook =
      0;

    for (
      const completedItems
      of completedByStudent.values()
    ) {
      for (
        const key
        of completedItems
      ) {
        if (
          key.startsWith(
            "a:"
          )
        ) {
          completedAssignments +=
            1;
        }

        if (
          key.startsWith(
            "q:"
          )
        ) {
          completedQuizzes +=
            1;
        }

        if (
          key.startsWith(
            "g:"
          )
        ) {
          completedGradebook +=
            1;
        }
      }
    }

    const assessmentCompletion = [
      {
        name:
          "Assignments",

        completed:
          completedAssignments,

        expected:
          expectedAssignments,
      },
      {
        name:
          "Quizzes",

        completed:
          completedQuizzes,

        expected:
          expectedQuizzes,
      },
      {
        name:
          "Gradebook",

        completed:
          completedGradebook,

        expected:
          expectedGradebook,
      },
    ].map(
      (
        item
      ) => ({
        ...item,

        rate:
          item.expected
            ? clamp(
                (
                  item.completed /
                  item.expected
                ) *
                  100
              )
            : 0,
      })
    );

    const markPercentages =
      [];

    for (
      const component
      of usableComponents
    ) {
      const maximum =
        number(
          component.max_marks
        );

      if (
        maximum <=
        0
      ) {
        continue;
      }

      for (
        const mark
        of component.marks ||
          []
      ) {
        markPercentages.push(
          (
            number(
              mark.marks_obtained
            ) /
            maximum
          ) *
            100
        );
      }
    }

    const averageMarkPercentage =
      markPercentages.length
        ? clamp(
            markPercentages.reduce(
              (
                sum,
                value
              ) =>
                sum +
                value,

              0
            ) /
              markPercentages.length
          )
        : null;

    return {
      course_assignment:
        assignment,

      teacher_history:
        teacherHistory,

      enrollments:
        enrollments.map(
          (
            item
          ) => ({
            ...item,

            student:
              studentMap.get(
                item.student_id
              ) ||
              null,
          })
        ),

      materials:
        materials.map(
          (
            item
          ) => ({
            ...item,

            teacher:
              teacherMap.get(
                item.teacher_id
              ) ||
              null,
          })
        ),

      assignments:
        assignmentRows.map(
          (
            item
          ) => ({
            ...item,

            teacher:
              teacherMap.get(
                item.teacher_id
              ) ||
              null,

            submission_count:
              assignmentSubmissionCounts.get(
                item.id
              ) ||
              0,
          })
        ),

      assignment_submissions:
        assignmentSubmissions,

      quizzes:
        quizRows.map(
          (
            item
          ) => ({
            ...item,

            teacher:
              teacherMap.get(
                item.teacher_id
              ) ||
              null,

            attempt_count:
              quizSubmissionCounts.get(
                item.id
              ) ||
              0,
          })
        ),

      quiz_submissions:
        quizSubmissions,

      attendance_records:
        attendance,

      attendance_sessions:
        attendanceSessions,

      gradebook_components:
        enrichedGradebook,

      gradebook_marks:
        gradebookMarks,

      gradebook_approvals:
        approvals,

      announcements,

      live_sessions:
        liveSessions,

      periods,

      analytics: {
        active_students:
          new Set(
            enrollments
              .filter(
                (
                  item
                ) =>
                  item.status ===
                  "active"
              )
              .map(
                (
                  item
                ) =>
                  item.student_id
              )
          ).size,

        total_students:
          studentCount,

        attendance_rate:
          attendanceRate,

        average_live_progress:
          averageLiveProgress,

        average_recorded_mark_percent:
          averageMarkPercentage,

        student_progress:
          studentProgress,

        progress_distribution:
          distribution,

        attendance_trend:
          attendanceTrend,

        assessment_completion:
          assessmentCompletion,
      },

      counts: {
        students:
          new Set(
            enrollments.map(
              (
                item
              ) =>
                item.student_id
            )
          ).size,

        active_students:
          new Set(
            enrollments
              .filter(
                (
                  item
                ) =>
                  item.status ===
                  "active"
              )
              .map(
                (
                  item
                ) =>
                  item.student_id
              )
          ).size,

        materials:
          materials.length,

        assignments:
          assignmentRows.length,

        assignment_submissions:
          assignmentSubmissions.length,

        quizzes:
          quizRows.length,

        quiz_submissions:
          quizSubmissions.length,

        attendance_records:
          attendance.length,

        attendance_sessions:
          attendanceSessions.length,

        gradebook_components:
          gradebook.length,

        gradebook_marks:
          gradebookMarks.length,

        gradebook_approvals:
          approvals.length,

        announcements:
          announcements.length,

        live_sessions:
          liveSessions.length,
      },
    };
  };

// ======================================================
// COURSE HISTORY
// ======================================================

const getCourseHistory =
  async (
    courseId
  ) => {
    const course =
      await courses
        .getCourseById(
          courseId
        );

    if (
      !course
    ) {
      return null;
    }

    const assignments =
      await courseAssignments
        .getAll({
          course_id:
            courseId,
        });

    const histories =
      await Promise.all(
        assignments.map(
          async (
            assignment
          ) => {
            const detail =
              await getCourseAssignmentHistory(
                assignment.id
              );

            return {
              ...assignment,

              teacher_history:
                detail
                  ?.teacher_history ||
                [],

              counts:
                detail
                  ?.counts ||
                {},

              analytics:
                detail
                  ?.analytics ||
                {},
            };
          }
        )
      );

    return {
      course,

      course_assignments:
        histories,
    };
  };

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  getStudentOverview,
  getStudentCourseHistory,
  getTeacherHistory,
  getCourseHistory,
  getCourseAssignmentHistory,
};