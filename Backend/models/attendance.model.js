const {
  supabaseAdmin,
} = require(
  "../config/supabase"
);

const {
  allRows,
} = require(
  "../utils/api"
);

// ======================================================
// SELECTS
// ======================================================

const CONTEXT_SELECT = `
  id,
  course_id,
  batch_id,
  semester_id,
  teacher_id,
  status,
  lifecycle_status,

  course:courses!course_assignments_course_id_fkey(
    id,
    name,
    course_code,
    department_id,
    program_id,
    status
  ),

  teacher:profiles!course_assignments_teacher_id_fkey(
    id,
    full_name,
    email
  ),

  batch:academic_batches!course_assignments_batch_id_fkey(
    id,
    start_year,
    end_year,
    status
  ),

  semester:academic_semesters!course_assignments_semester_id_fkey(
    id,
    name,
    semester_number,
    program_id,
    status
  )
`;

const SESSION_SELECT = `
  id,
  course_assignment_id,
  teacher_id,
  attendance_date,
  title,
  status,
  created_at,
  closed_at,

  teacher:profiles!attendance_sessions_teacher_id_fkey(
    id,
    full_name,
    email
  )
`;

const RECORD_SELECT = `
  id,
  course_id,
  student_id,
  date,
  status,
  marked_by,
  marked_at,
  reason,
  course_assignment_id,
  attendance_session_id,

  student:profiles!attendance_records_student_id_fkey(
    id,
    full_name,
    email,
    student_id,
    batch_id,
    department_id,
    program_id,
    semester_id,
    is_active
  ),

  marker:profiles!attendance_records_marked_by_fkey(
    id,
    full_name,
    email
  )
`;

const ENROLLMENT_SELECT = `
  id,
  student_id,
  course_id,
  course_assignment_id,
  batch_id,
  semester_id,
  status,
  enrollment_type,
  enrolled_at,
  completed_at,

  student:profiles!enrollments_student_id_fkey(
    id,
    full_name,
    email,
    student_id,
    batch_id,
    department_id,
    program_id,
    semester_id,
    is_active
  )
`;

// ======================================================
// GENERIC HELPERS
// ======================================================

const unique = (
  values = []
) =>
  [
    ...new Set(
      values.filter(
        Boolean
      )
    ),
  ];

const chunk = (
  values,
  size = 150
) => {
  const output = [];

  for (
    let index = 0;
    index < values.length;
    index += size
  ) {
    output.push(
      values.slice(
        index,
        index + size
      )
    );
  }

  return output;
};

const fetchInChunks =
  async ({
    table,
    select,
    column,
    values,
    configure,
  }) => {
    const cleanValues =
      unique(values);

    if (
      !cleanValues.length
    ) {
      return [];
    }

    const output = [];

    for (
      const group
      of chunk(
        cleanValues
      )
    ) {
      const rows =
        await allRows(
          () => {
            let query =
              supabaseAdmin
                .from(
                  table
                )
                .select(
                  select
                )
                .in(
                  column,
                  group
                );

            if (
              configure
            ) {
              query =
                configure(
                  query
                );
            }

            return query;
          }
        );

      output.push(
        ...rows
      );
    }

    return output;
  };

const lower = (
  value
) =>
  String(
    value || ""
  )
    .trim()
    .toLowerCase();

const normalizeStatus = (
  value
) => {
  const key =
    lower(value)
      .replace(
        /[_-]+/g,
        " "
      )
      .replace(
        /\s+/g,
        " "
      );

  if (
    [
      "present",
      "p",
    ].includes(key)
  ) {
    return "present";
  }

  if (
    [
      "absent",
      "a",
    ].includes(key)
  ) {
    return "absent";
  }

  if (
    [
      "late",
      "tardy",
      "l",
    ].includes(key)
  ) {
    return "late";
  }

  if (
    [
      "leave",
      "excused",
      "excuse",
      "on leave",
      "lv",
      "e",
    ].includes(key)
  ) {
    return "excused";
  }

  return (
    key ||
    "unknown"
  );
};

const todayIso = () =>
  new Date()
    .toISOString()
    .slice(
      0,
      10
    );

const isCancelledSession = (
  session
) =>
  [
    "cancelled",
    "canceled",
  ].includes(
    lower(
      session?.status
    )
  );

const isConductedSession = (
  session
) => {
  if (
    !session ||
    isCancelledSession(
      session
    )
  ) {
    return false;
  }

  const date =
    String(
      session.attendance_date ||
        ""
    );

  return (
    Boolean(date) &&
    date <= todayIso()
  );
};

const batchLabel = (
  batch
) =>
  batch?.start_year &&
  batch?.end_year
    ? `${batch.start_year}-${batch.end_year}`
    : "";

// ======================================================
// STATUS CALCULATION
// ======================================================

const countStatuses = (
  records = [],
  totalSessions = null
) => {
  const counts = {
    present: 0,
    absent: 0,
    late: 0,
    excused: 0,
    other: 0,
  };

  for (
    const record
    of records
  ) {
    const status =
      normalizeStatus(
        record.status
      );

    if (
      Object.prototype
        .hasOwnProperty.call(
          counts,
          status
        )
    ) {
      counts[
        status
      ] += 1;
    } else {
      counts.other +=
        1;
    }
  }

  const eligible =
    counts.present +
    counts.absent +
    counts.late;

  const attended =
    counts.present +
    counts.late;

  const rate =
    eligible > 0
      ? Math.round(
          (
            attended /
            eligible
          ) *
            100
        )
      : 0;

  const recorded =
    records.length;

  const notMarked =
    Number.isFinite(
      Number(
        totalSessions
      )
    )
      ? Math.max(
          0,
          Number(
            totalSessions
          ) -
            recorded
        )
      : 0;

  return {
    ...counts,

    attended,
    eligible,
    recorded,

    not_marked:
      notMarked,

    total_sessions:
      totalSessions ??
      recorded,

    rate,
  };
};

// ======================================================
// LATEST ATTENDANCE RECORD
// ======================================================

const latestRecords = (
  rows = []
) => {
  const map =
    new Map();

  for (
    const row
    of rows
  ) {
    const key =
      row.attendance_session_id
        ? `${row.student_id}:${row.attendance_session_id}`
        : `${row.student_id}:${row.course_id}:${row.date}`;

    const previous =
      map.get(key);

    if (!previous) {
      map.set(
        key,
        row
      );

      continue;
    }

    const previousTime =
      new Date(
        previous.marked_at ||
          0
      ).getTime();

    const currentTime =
      new Date(
        row.marked_at ||
          0
      ).getTime();

    if (
      currentTime >=
      previousTime
    ) {
      map.set(
        key,
        row
      );
    }
  }

  return [
    ...map.values(),
  ];
};

// ======================================================
// ACADEMIC LOOKUPS
// ======================================================

const getAcademicMaps =
  async (
    contexts
  ) => {
    const departmentIds =
      unique(
        contexts.map(
          (row) =>
            row.course
              ?.department_id
        )
      );

    const programIds =
      unique(
        contexts.map(
          (row) =>
            row.course
              ?.program_id
        )
      );

    const [
      departments,
      programs,
    ] =
      await Promise.all([
        fetchInChunks({
          table:
            "academic_departments",

          select:
            "id,name,code,batch_id,status",

          column:
            "id",

          values:
            departmentIds,
        }),

        fetchInChunks({
          table:
            "academic_programs",

          select:
            "id,name,code,department_id,status",

          column:
            "id",

          values:
            programIds,
        }),
      ]);

    return {
      departmentMap:
        new Map(
          departments.map(
            (row) => [
              row.id,
              row,
            ]
          )
        ),

      programMap:
        new Map(
          programs.map(
            (row) => [
              row.id,
              row,
            ]
          )
        ),
    };
  };

// ======================================================
// COURSE ASSIGNMENT CONTEXTS
// ======================================================

const getContexts =
  async (
    filters = {}
  ) => {
    let contexts =
      await allRows(
        () => {
          let query =
            supabaseAdmin
              .from(
                "course_assignments"
              )
              .select(
                CONTEXT_SELECT
              )
              .order(
                "created_at",
                {
                  ascending:
                    false,
                }
              );

          if (
            filters.batch_id
          ) {
            query =
              query.eq(
                "batch_id",
                filters.batch_id
              );
          }

          if (
            filters.semester_id
          ) {
            query =
              query.eq(
                "semester_id",
                filters.semester_id
              );
          }

          if (
            filters.course_assignment_id
          ) {
            query =
              query.eq(
                "id",
                filters.course_assignment_id
              );
          }

          return query;
        }
      );

    if (
      filters.department_id
    ) {
      contexts =
        contexts.filter(
          (row) =>
            String(
              row.course
                ?.department_id ||
                ""
            ) ===
            String(
              filters.department_id
            )
        );
    }

    if (
      filters.program_id
    ) {
      contexts =
        contexts.filter(
          (row) =>
            String(
              row.course
                ?.program_id ||
                ""
            ) ===
            String(
              filters.program_id
            )
        );
    }

    const {
      departmentMap,
      programMap,
    } =
      await getAcademicMaps(
        contexts
      );

    return contexts.map(
      (row) => ({
        ...row,

        department:
          departmentMap.get(
            row.course
              ?.department_id
          ) || null,

        program:
          programMap.get(
            row.course
              ?.program_id
          ) || null,
      })
    );
  };

// ======================================================
// DECORATE RECORD
// ======================================================

const decorateRecord =
  ({
    record,
    context,
    session,
  }) => ({
    ...record,

    status:
      normalizeStatus(
        record.status
      ),

    date:
      record.date ||
      session?.attendance_date ||
      null,

    context,

    session:
      session || null,

    course:
      context?.course ||
      null,

    teacher:
      session?.teacher ||
      context?.teacher ||
      null,

    batch:
      context?.batch ||
      null,

    department:
      context?.department ||
      null,

    program:
      context?.program ||
      null,

    semester:
      context?.semester ||
      null,
  });

// ======================================================
// MAIN DATASET
// ======================================================

const buildDataset =
  async (
    filters = {},
    {
      includeRecords = true,
    } = {}
  ) => {
    const contexts =
      await getContexts(
        filters
      );

    const contextIds =
      contexts.map(
        (row) =>
          row.id
      );

    const courseIds =
      unique(
        contexts.map(
          (row) =>
            row.course_id
        )
      );

    if (
      !contexts.length
    ) {
      return {
        contexts: [],
        sessions: [],
        records: [],
        enrollments: [],
        students: [],
      };
    }

    const contextMap =
      new Map(
        contexts.map(
          (row) => [
            row.id,
            row,
          ]
        )
      );

    const [
      allSessions,
      enrollments,
    ] =
      await Promise.all([
        fetchInChunks({
          table:
            "attendance_sessions",

          select:
            SESSION_SELECT,

          column:
            "course_assignment_id",

          values:
            contextIds,
        }),

        fetchInChunks({
          table:
            "enrollments",

          select:
            ENROLLMENT_SELECT,

          column:
            "course_assignment_id",

          values:
            contextIds,
        }),
      ]);

    const sessions =
      allSessions
        .filter(
          (session) => {
            if (
              filters.date_from &&
              session.attendance_date <
                filters.date_from
            ) {
              return false;
            }

            if (
              filters.date_to &&
              session.attendance_date >
                filters.date_to
            ) {
              return false;
            }

            return true;
          }
        )
        .sort(
          (
            a,
            b
          ) => {
            const dateCompare =
              String(
                a.attendance_date ||
                  ""
              ).localeCompare(
                String(
                  b.attendance_date ||
                    ""
                )
              );

            if (
              dateCompare !==
              0
            ) {
              return dateCompare;
            }

            return String(
              a.created_at ||
                ""
            ).localeCompare(
              String(
                b.created_at ||
                  ""
              )
            );
          }
        );

    const studentMap =
      new Map();

    for (
      const enrollment
      of enrollments
    ) {
      if (
        enrollment.student
          ?.id
      ) {
        studentMap.set(
          enrollment.student.id,
          enrollment.student
        );
      }
    }

    if (
      !includeRecords
    ) {
      return {
        contexts,
        sessions,
        records: [],
        enrollments,

        students: [
          ...studentMap.values(),
        ].sort(
          (
            a,
            b
          ) =>
            String(
              a.full_name ||
                ""
            ).localeCompare(
              String(
                b.full_name ||
                  ""
              )
            )
        ),
      };
    }

    const sessionMap =
      new Map(
        allSessions.map(
          (row) => [
            row.id,
            row,
          ]
        )
      );

    const [
      contextRecords,
      legacyRecords,
    ] =
      await Promise.all([
        fetchInChunks({
          table:
            "attendance_records",

          select:
            RECORD_SELECT,

          column:
            "course_assignment_id",

          values:
            contextIds,
        }),

        courseIds.length
          ? fetchInChunks({
              table:
                "attendance_records",

              select:
                RECORD_SELECT,

              column:
                "course_id",

              values:
                courseIds,

              configure:
                (
                  query
                ) =>
                  query.is(
                    "course_assignment_id",
                    null
                  ),
            })
          : [],
      ]);

    const contextsByCourse =
      new Map();

    for (
      const context
      of contexts
    ) {
      if (
        !contextsByCourse.has(
          context.course_id
        )
      ) {
        contextsByCourse.set(
          context.course_id,
          []
        );
      }

      contextsByCourse
        .get(
          context.course_id
        )
        .push(
          context
        );
    }

    const records = [];

    for (
      const record
      of latestRecords([
        ...contextRecords,
        ...legacyRecords,
      ])
    ) {
      const session =
        record.attendance_session_id
          ? sessionMap.get(
              record.attendance_session_id
            )
          : null;

      let context =
        record.course_assignment_id
          ? contextMap.get(
              record.course_assignment_id
            )
          : null;

      if (
        !context &&
        session?.course_assignment_id
      ) {
        context =
          contextMap.get(
            session.course_assignment_id
          );
      }

      if (
        !context &&
        record.course_id
      ) {
        const possible =
          contextsByCourse.get(
            record.course_id
          ) || [];

        if (
          possible.length ===
          1
        ) {
          context =
            possible[0];
        }
      }

      if (!context) {
        continue;
      }

      const decorated =
        decorateRecord({
          record,
          context,
          session,
        });

      if (
        filters.student_id &&
        String(
          decorated.student_id
        ) !==
          String(
            filters.student_id
          )
      ) {
        continue;
      }

      if (
        filters.date_from &&
        decorated.date &&
        decorated.date <
          filters.date_from
      ) {
        continue;
      }

      if (
        filters.date_to &&
        decorated.date &&
        decorated.date >
          filters.date_to
      ) {
        continue;
      }

      records.push(
        decorated
      );

      if (
        decorated.student
          ?.id
      ) {
        studentMap.set(
          decorated.student.id,
          decorated.student
        );
      }
    }

    return {
      contexts,
      sessions,
      records,
      enrollments,

      students: [
        ...studentMap.values(),
      ].sort(
        (
          a,
          b
        ) =>
          String(
            a.full_name ||
              ""
          ).localeCompare(
            String(
              b.full_name ||
                ""
            )
          )
      ),
    };
  };

// ======================================================
// COURSE DESCRIPTOR
// ======================================================

const courseDescriptor = (
  context
) => ({
  course_assignment_id:
    context.id,

  course_id:
    context.course_id,

  name:
    context.course
      ?.name ||
    "Course",

  course_code:
    context.course
      ?.course_code ||
    "",

  teacher:
    context.teacher ||
    null,

  batch:
    context.batch ||
    null,

  department:
    context.department ||
    null,

  program:
    context.program ||
    null,

  semester:
    context.semester ||
    null,

  status:
    context.status,

  lifecycle_status:
    context.lifecycle_status,
});

// ======================================================
// OPTIONS
// ======================================================

const getOptions =
  async (
    filters = {}
  ) => {
    // The course dropdown must always list ALL courses of the
    // selected class. Only the student list depends on the
    // selected course, so it is filtered below instead.
    const {
      course_assignment_id: selectedCourseId,
      ...datasetFilters
    } = filters;

    const dataset =
      await buildDataset(
        datasetFilters,
        {
          includeRecords:
            false,
        }
      );

    const studentMap =
      new Map();

    for (
      const enrollment
      of dataset.enrollments
    ) {
      if (
        selectedCourseId &&
        String(
          enrollment.course_assignment_id
        ) !==
          String(
            selectedCourseId
          )
      ) {
        continue;
      }

      if (
        enrollment.student
          ?.id
      ) {
        studentMap.set(
          enrollment.student.id,
          enrollment.student
        );
      }
    }

    return {
      courses:
        dataset.contexts
          .map(
            courseDescriptor
          )
          .sort(
            (
              a,
              b
            ) =>
              String(
                a.name
              ).localeCompare(
                String(
                  b.name
                )
              )
          ),

      students: [
        ...studentMap.values(),
      ].sort(
        (
          a,
          b
        ) =>
          String(
            a.full_name ||
              ""
          ).localeCompare(
            String(
              b.full_name ||
                ""
            )
          )
      ),
    };
  };

// ======================================================
// STUDENT AGGREGATES
// ======================================================

const buildStudentSummaries = (
  dataset
) => {
  const map =
    new Map();

  for (
    const enrollment
    of dataset.enrollments
  ) {
    if (
      !enrollment.student
        ?.id
    ) {
      continue;
    }

    if (
      !map.has(
        enrollment.student.id
      )
    ) {
      map.set(
        enrollment.student.id,
        {
          student:
            enrollment.student,

          records: [],
        }
      );
    }
  }

  for (
    const record
    of dataset.records
  ) {
    if (
      !record.student_id
    ) {
      continue;
    }

    if (
      !map.has(
        record.student_id
      )
    ) {
      map.set(
        record.student_id,
        {
          student:
            record.student,

          records: [],
        }
      );
    }

    map
      .get(
        record.student_id
      )
      .records.push(
        record
      );
  }

  return [
    ...map.values(),
  ].map(
    (entry) => ({
      student:
        entry.student,

      ...countStatuses(
        entry.records
      ),
    })
  );
};

// ======================================================
// CLASS-WISE COURSE SUMMARY
// One row per (course assignment x student class).
// A "class" = program + batch + semester of the enrolled
// students, so the same teacher/course taught to several
// classes is NOT merged into one record anymore.
// ======================================================

const classKeyOf = (cls) =>
  [
    cls.program_id || "none",
    cls.batch_id || "none",
    cls.semester_id || "none",
  ].join(":");

const classOfStudent = (context, enrollment, student) => ({
  program_id:
    student?.program_id ||
    context.course?.program_id ||
    null,
  batch_id:
    enrollment?.batch_id ||
    context.batch_id ||
    null,
  semester_id:
    enrollment?.semester_id ||
    context.semester_id ||
    null,
});

const getClassMaps = async (dataset, classIds) => {
  const [programs, semesters, batches] =
    await Promise.all([
      fetchInChunks({
        table: "academic_programs",
        select:
          "id,name,code,department_id,status",
        column: "id",
        values: [...classIds.programs],
      }),
      fetchInChunks({
        table: "academic_semesters",
        select:
          "id,name,semester_number,program_id,status",
        column: "id",
        values: [...classIds.semesters],
      }),
      fetchInChunks({
        table: "academic_batches",
        select:
          "id,start_year,end_year,status",
        column: "id",
        values: [...classIds.batches],
      }),
    ]);

  return {
    programMap: new Map(
      programs.map((row) => [row.id, row])
    ),
    semesterMap: new Map(
      semesters.map((row) => [row.id, row])
    ),
    batchMap: new Map(
      batches.map((row) => [row.id, row])
    ),
  };
};

const buildClassCourseSummary = async (
  dataset,
  conductedSessions
) => {
  const conductedIds = new Set(
    conductedSessions.map((row) =>
      String(row.id)
    )
  );

  // ---------------- group per assignment + class ----
  const drafts = [];
  const classIds = {
    programs: new Set(),
    semesters: new Set(),
    batches: new Set(),
  };

  for (const context of dataset.contexts) {
    const contextId = String(context.id);

    const enrollmentByStudent = new Map();

    for (const enrollment of dataset.enrollments) {
      if (
        String(
          enrollment.course_assignment_id
        ) === contextId &&
        enrollment.student_id
      ) {
        enrollmentByStudent.set(
          enrollment.student_id,
          enrollment
        );
      }
    }

    const groups = new Map();

    const ensureGroup = (cls) => {
      const key = classKeyOf(cls);

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          cls,
          records: [],
          sessionKeys: new Set(),
          students: new Set(),
        });
      }

      return groups.get(key);
    };

    for (const [
      studentId,
      enrollment,
    ] of enrollmentByStudent) {
      ensureGroup(
        classOfStudent(
          context,
          enrollment,
          enrollment.student
        )
      ).students.add(studentId);
    }

    for (const record of dataset.records) {
      if (
        String(record.context?.id) !==
        contextId
      ) {
        continue;
      }

      const enrollment =
        enrollmentByStudent.get(
          record.student_id
        );

      const group = ensureGroup(
        classOfStudent(
          context,
          enrollment,
          enrollment?.student ||
            record.student
        )
      );

      group.records.push(record);

      if (record.attendance_session_id) {
        if (
          conductedIds.has(
            String(
              record.attendance_session_id
            )
          )
        ) {
          group.sessionKeys.add(
            `s:${record.attendance_session_id}`
          );
        }
      } else if (record.date) {
        group.sessionKeys.add(
          `d:${record.date}`
        );
      }
    }

    if (!groups.size) {
      ensureGroup(
        classOfStudent(
          context,
          null,
          null
        )
      );
    }

    const assignmentSessions =
      conductedSessions.filter(
        (row) =>
          String(
            row.course_assignment_id
          ) === contextId
      ).length;

    for (const group of groups.values()) {
      if (group.cls.program_id) {
        classIds.programs.add(
          group.cls.program_id
        );
      }

      if (group.cls.semester_id) {
        classIds.semesters.add(
          group.cls.semester_id
        );
      }

      if (group.cls.batch_id) {
        classIds.batches.add(
          group.cls.batch_id
        );
      }

      drafts.push({
        context,
        group,
        // Only one class in this assignment: every
        // conducted session belongs to it (old behaviour).
        // Several classes: count only sessions in which
        // THIS class actually has attendance marked.
        sessions:
          groups.size === 1
            ? assignmentSessions
            : group.sessionKeys.size,
      });
    }
  }

  const {
    programMap,
    semesterMap,
    batchMap,
  } = await getClassMaps(
    dataset,
    classIds
  );

  const rows = drafts.map(
    ({ context, group, sessions }) => {
      const program =
        programMap.get(
          group.cls.program_id
        ) ||
        context.program ||
        null;

      const semester =
        semesterMap.get(
          group.cls.semester_id
        ) ||
        context.semester ||
        null;

      const batch =
        batchMap.get(
          group.cls.batch_id
        ) ||
        context.batch ||
        null;

      const label = [
        program?.code || program?.name,
        semester?.name,
        batchLabel(batch),
      ]
        .filter(Boolean)
        .join(" · ");

      return {
        ...courseDescriptor(context),

        program,
        semester,
        batch,

        class_key: group.key,
        class_label: label,
        student_count:
          group.students.size,

        ...countStatuses(
          group.records
        ),

        sessions,
      };
    }
  );

  return rows.sort((a, b) => {
    const byCourse = String(
      a.name || ""
    ).localeCompare(
      String(b.name || "")
    );

    if (byCourse !== 0) {
      return byCourse;
    }

    const byProgram = String(
      a.program?.name || ""
    ).localeCompare(
      String(b.program?.name || "")
    );

    if (byProgram !== 0) {
      return byProgram;
    }

    return (
      Number(
        a.semester?.semester_number ||
          0
      ) -
      Number(
        b.semester?.semester_number ||
          0
      )
    );
  });
};

// ======================================================
// OVERVIEW
// ======================================================

const getOverview =
  async (
    filters = {}
  ) => {
    const dataset =
      await buildDataset(
        filters
      );

    const conductedSessions =
      dataset.sessions.filter(
        isConductedSession
      );

    const counts =
      countStatuses(
        dataset.records
      );

    const students =
      buildStudentSummaries(
        dataset
      );

    const threshold =
      Number(
        filters.at_risk_threshold ||
          75
      );

    const atRisk =
      students
        .filter(
          (row) =>
            row.eligible >
              0 &&
            row.rate <
              threshold
        )
        .sort(
          (
            a,
            b
          ) =>
            a.rate -
            b.rate
        );

    const today =
      todayIso();

    const todayCounts =
      countStatuses(
        dataset.records.filter(
          (row) =>
            row.date ===
            today
        )
      );

    const courseSummary =
      await buildClassCourseSummary(
        dataset,
        conductedSessions
      );

    const trendMap =
      new Map();

    for (
      const record
      of dataset.records
    ) {
      const date =
        record.date;

      if (!date) {
        continue;
      }

      if (
        !trendMap.has(
          date
        )
      ) {
        trendMap.set(
          date,
          []
        );
      }

      trendMap
        .get(date)
        .push(record);
    }

    const trend =
      [
        ...trendMap.entries(),
      ]
        .map(
          ([
            date,
            rows,
          ]) => ({
            date,

            ...countStatuses(
              rows
            ),
          })
        )
        .sort(
          (
            a,
            b
          ) =>
            String(
              a.date
            ).localeCompare(
              String(
                b.date
              )
            )
        );

    return {
      summary: {
        overall_rate:
          counts.rate,

        total_sessions:
          conductedSessions.length,

        recorded_marks:
          counts.recorded,

        present_today:
          todayCounts.present,

        absent_today:
          todayCounts.absent,

        late_today:
          todayCounts.late,

        excused_today:
          todayCounts.excused,

        at_risk_students:
          atRisk.length,

        students_with_attendance:
          students.filter(
            (row) =>
              row.eligible >
              0
          ).length,

        threshold,
      },

      at_risk:
        atRisk.slice(
          0,
          25
        ),

      course_summary:
        courseSummary,

      trend,
    };
  };

// ======================================================
// SEMESTER COURSE-WISE MATRIX
// ======================================================

const getSemesterReport =
  async (
    filters = {}
  ) => {
    const dataset =
      await buildDataset(
        filters
      );

    const conductedSessions =
      dataset.sessions.filter(
        isConductedSession
      );

    const courses =
      dataset.contexts
        .map(
          (
            context
          ) => {
            const sessionCount =
              conductedSessions.filter(
                (
                  session
                ) =>
                  String(
                    session.course_assignment_id
                  ) ===
                  String(
                    context.id
                  )
              ).length;

            return {
              ...courseDescriptor(
                context
              ),

              session_count:
                sessionCount,
            };
          }
        )
        .sort(
          (
            a,
            b
          ) =>
            String(
              a.course_code ||
                a.name
            ).localeCompare(
              String(
                b.course_code ||
                  b.name
              )
            )
        );

    const studentMap =
      new Map();

    for (
      const enrollment
      of dataset.enrollments
    ) {
      if (
        !enrollment.student
          ?.id
      ) {
        continue;
      }

      if (
        !studentMap.has(
          enrollment.student.id
        )
      ) {
        studentMap.set(
          enrollment.student.id,
          {
            student:
              enrollment.student,

            contexts:
              new Set(),
          }
        );
      }

      studentMap
        .get(
          enrollment.student.id
        )
        .contexts.add(
          enrollment.course_assignment_id
        );
    }

    for (
      const record
      of dataset.records
    ) {
      if (
        !record.student
          ?.id
      ) {
        continue;
      }

      if (
        !studentMap.has(
          record.student.id
        )
      ) {
        studentMap.set(
          record.student.id,
          {
            student:
              record.student,

            contexts:
              new Set(),
          }
        );
      }

      if (
        record.context
          ?.id
      ) {
        studentMap
          .get(
            record.student.id
          )
          .contexts.add(
            record.context.id
          );
      }
    }

    const rows =
      [
        ...studentMap.values(),
      ]
        .map(
          ({
            student,
            contexts,
          }) => {
            const courseStats =
              {};

            const allRecords =
              [];

            let totalSessions =
              0;

            for (
              const course
              of courses
            ) {
              if (
                !contexts.has(
                  course.course_assignment_id
                )
              ) {
                continue;
              }

              const records =
                dataset.records.filter(
                  (record) =>
                    String(
                      record.student_id
                    ) ===
                      String(
                        student.id
                      ) &&
                    String(
                      record.context
                        ?.id
                    ) ===
                      String(
                        course.course_assignment_id
                      )
                );

              const stats =
                countStatuses(
                  records,
                  course.session_count
                );

              courseStats[
                course.course_assignment_id
              ] =
                stats;

              allRecords.push(
                ...records
              );

              totalSessions +=
                course.session_count;
            }

            return {
              student,

              courses:
                courseStats,

              overall:
                countStatuses(
                  allRecords,
                  totalSessions
                ),
            };
          }
        )
        .sort(
          (
            a,
            b
          ) =>
            String(
              a.student
                ?.full_name ||
                ""
            ).localeCompare(
              String(
                b.student
                  ?.full_name ||
                  ""
              )
            )
        );

    return {
      courses,
      rows,
    };
  };

// ======================================================
// COURSE REPORT
// ======================================================

const getCourseReport =
  async (
    filters = {}
  ) => {
    const dataset =
      await buildDataset(
        filters
      );

    const context =
      dataset.contexts.find(
        (row) =>
          String(
            row.id
          ) ===
          String(
            filters.course_assignment_id
          )
      );

    if (!context) {
      return {
        course: null,

        summary:
          countStatuses(
            []
          ),

        sessions: [],
        rows: [],
      };
    }

    const sessions =
      dataset.sessions
        .filter(
          (session) =>
            String(
              session.course_assignment_id
            ) ===
              String(
                context.id
              ) &&
            isConductedSession(
              session
            )
        )
        .sort(
          (
            a,
            b
          ) => {
            const dateCompare =
              String(
                a.attendance_date ||
                  ""
              ).localeCompare(
                String(
                  b.attendance_date ||
                    ""
                )
              );

            if (
              dateCompare !==
              0
            ) {
              return dateCompare;
            }

            return String(
              a.created_at ||
                ""
            ).localeCompare(
              String(
                b.created_at ||
                  ""
              )
            );
          }
        );

    const dateCounts =
      new Map();

    const sessionColumns =
      sessions.map(
        (
          session
        ) => {
          const date =
            session.attendance_date;

          const next =
            (
              dateCounts.get(
                date
              ) ||
              0
            ) +
            1;

          dateCounts.set(
            date,
            next
          );

          return {
            id:
              session.id,

            attendance_date:
              date,

            title:
              session.title ||
              "",

            session_number:
              next,

            teacher:
              session.teacher ||
              context.teacher ||
              null,
          };
        }
      );

    const roster =
      new Map();

    for (
      const enrollment
      of dataset.enrollments
    ) {
      if (
        String(
          enrollment.course_assignment_id
        ) !==
        String(
          context.id
        )
      ) {
        continue;
      }

      if (
        enrollment.student
          ?.id
      ) {
        roster.set(
          enrollment.student.id,
          enrollment.student
        );
      }
    }

    for (
      const record
      of dataset.records
    ) {
      if (
        String(
          record.context
            ?.id
        ) !==
        String(
          context.id
        )
      ) {
        continue;
      }

      if (
        record.student
          ?.id
      ) {
        roster.set(
          record.student.id,
          record.student
        );
      }
    }

    const courseRecords =
      dataset.records.filter(
        (record) =>
          String(
            record.context
              ?.id
          ) ===
          String(
            context.id
          )
      );

    const recordMap =
      new Map();

    for (
      const record
      of courseRecords
    ) {
      if (
        !record.student_id ||
        !record.attendance_session_id
      ) {
        continue;
      }

      recordMap.set(
        `${record.student_id}:${record.attendance_session_id}`,
        record
      );
    }

    const rows =
      [
        ...roster.values(),
      ]
        .map(
          (
            student
          ) => {
            const cells =
              {};

            const records =
              [];

            for (
              const session
              of sessionColumns
            ) {
              const record =
                recordMap.get(
                  `${student.id}:${session.id}`
                );

              if (
                record
              ) {
                const status =
                  normalizeStatus(
                    record.status
                  );

                cells[
                  session.id
                ] = {
                  status,

                  reason:
                    record.reason ||
                    "",

                  marked_at:
                    record.marked_at ||
                    null,

                  marked_by:
                    record.marker ||
                    null,
                };

                records.push(
                  record
                );
              } else {
                cells[
                  session.id
                ] = {
                  status:
                    "not_marked",

                  reason:
                    "",

                  marked_at:
                    null,

                  marked_by:
                    null,
                };
              }
            }

            return {
              student,

              cells,

              ...countStatuses(
                records,
                sessionColumns.length
              ),
            };
          }
        )
        .sort(
          (
            a,
            b
          ) =>
            String(
              a.student
                ?.full_name ||
                ""
            ).localeCompare(
              String(
                b.student
                  ?.full_name ||
                  ""
              )
            )
        );

    return {
      course:
        courseDescriptor(
          context
        ),

      summary:
        countStatuses(
          courseRecords
        ),

      session_count:
        sessionColumns.length,

      sessions:
        sessionColumns,

      rows,
    };
  };

// ======================================================
// STUDENT REPORT
// ======================================================

const getStudentReport =
  async (
    filters = {}
  ) => {
    const dataset =
      await buildDataset(
        filters
      );

    const student =
      dataset.students.find(
        (row) =>
          String(
            row.id
          ) ===
          String(
            filters.student_id
          )
      );

    if (!student) {
      return {
        student: null,

        summary:
          countStatuses(
            []
          ),

        courses: [],
        sessions: [],
      };
    }

    const studentRecords =
      dataset.records.filter(
        (record) =>
          String(
            record.student_id
          ) ===
          String(
            student.id
          )
      );

    const contextIds =
      unique([
        ...dataset.enrollments
          .filter(
            (
              enrollment
            ) =>
              String(
                enrollment.student_id
              ) ===
              String(
                student.id
              )
          )
          .map(
            (
              enrollment
            ) =>
              enrollment.course_assignment_id
          ),

        ...studentRecords.map(
          (
            record
          ) =>
            record.context
              ?.id
        ),
      ]);

    const courses =
      dataset.contexts
        .filter(
          (
            context
          ) =>
            contextIds.includes(
              context.id
            )
        )
        .map(
          (
            context
          ) => {
            const contextSessions =
              dataset.sessions.filter(
                (
                  session
                ) =>
                  String(
                    session.course_assignment_id
                  ) ===
                    String(
                      context.id
                    ) &&
                  isConductedSession(
                    session
                  )
              );

            const records =
              studentRecords.filter(
                (
                  record
                ) =>
                  String(
                    record.context
                      ?.id
                  ) ===
                  String(
                    context.id
                  )
              );

            return {
              ...courseDescriptor(
                context
              ),

              ...countStatuses(
                records,
                contextSessions.length
              ),
            };
          }
        )
        .sort(
          (
            a,
            b
          ) =>
            String(
              a.name
            ).localeCompare(
              String(
                b.name
              )
            )
        );

    const selectedRecords =
      filters.status
        ? studentRecords.filter(
            (record) =>
              record.status ===
              filters.status
          )
        : studentRecords;

    const sessions =
      selectedRecords
        .map(
          (
            record
          ) => ({
            id:
              record.id,

            date:
              record.date,

            status:
              record.status,

            reason:
              record.reason ||
              "",

            marked_at:
              record.marked_at,

            session_title:
              record.session
                ?.title ||
              "",

            course_assignment_id:
              record.context
                ?.id ||
              null,

            course_name:
              record.course
                ?.name ||
              "Course",

            course_code:
              record.course
                ?.course_code ||
              "",

            teacher_name:
              record.teacher
                ?.full_name ||
              "",

            marked_by_name:
              record.marker
                ?.full_name ||
              "",
          })
        )
        .sort(
          (
            a,
            b
          ) =>
            String(
              b.date ||
                ""
            ).localeCompare(
              String(
                a.date ||
                  ""
              )
            )
        );

    const totalStudentSessions =
      courses.reduce(
        (
          sum,
          course
        ) =>
          sum +
          (
            course.total_sessions ||
            0
          ),
        0
      );

    return {
      student,

      summary:
        countStatuses(
          studentRecords,
          totalStudentSessions
        ),

      courses,
      sessions,
    };
  };

// ======================================================
// DETAILED RAW SESSION LOG
// ======================================================

const getSessions =
  async (
    filters = {}
  ) => {
    const dataset =
      await buildDataset(
        filters
      );

    const rows =
      filters.status
        ? dataset.records.filter(
            (record) =>
              record.status ===
              filters.status
          )
        : dataset.records;

    return rows
      .map(
        (
          record
        ) => ({
          id:
            record.id,

          date:
            record.date,

          status:
            record.status,

          reason:
            record.reason ||
            "",

          marked_at:
            record.marked_at,

          student_id:
            record.student
              ?.id ||
            record.student_id,

          student_name:
            record.student
              ?.full_name ||
            "Student",

          student_number:
            record.student
              ?.student_id ||
            "",

          course_assignment_id:
            record.context
              ?.id ||
            null,

          course_name:
            record.course
              ?.name ||
            "Course",

          course_code:
            record.course
              ?.course_code ||
            "",

          teacher_name:
            record.teacher
              ?.full_name ||
            "",

          marker_name:
            record.marker
              ?.full_name ||
            "",

          batch:
            batchLabel(
              record.batch
            ),

          department:
            record.department
              ?.name ||
            "",

          program:
            record.program
              ?.name ||
            "",

          semester:
            record.semester
              ?.name ||
            "",

          session_title:
            record.session
              ?.title ||
            "",
        })
      )
      .sort(
        (
          a,
          b
        ) => {
          const dateCompare =
            String(
              b.date ||
                ""
            ).localeCompare(
              String(
                a.date ||
                  ""
              )
            );

          if (
            dateCompare !==
            0
          ) {
            return dateCompare;
          }

          return String(
            a.student_name
          ).localeCompare(
            String(
              b.student_name
            )
          );
        }
      );
  };

// ======================================================
// EXPORT HELPERS
// ======================================================

const safeColumnName = (
  course,
  index
) =>
  course.course_code ||
  course.name ||
  `Course ${index + 1}`;

const sessionColumnName = (
  session,
  index
) => {
  const date =
    session.attendance_date ||
    `Session ${index + 1}`;

  if (
    session.title
  ) {
    return `${date} - ${session.title}`;
  }

  return date;
};

// ======================================================
// EXPORT DATA
// ======================================================

const getExportData =
  async (
    filters = {}
  ) => {
    const [
      overview,
      semester,
      sessions,
    ] =
      await Promise.all([
        getOverview(
          filters
        ),

        filters.semester_id
          ? getSemesterReport(
              filters
            )
          : Promise.resolve({
              courses: [],
              rows: [],
            }),

        getSessions(
          filters
        ),
      ]);

    let courseReport =
      null;

    if (
      filters.course_assignment_id
    ) {
      courseReport =
        await getCourseReport(
          filters
        );
    }

    // ==================================================
    // SEMESTER MATRIX
    // ==================================================

    const semesterMatrix =
      semester.rows.map(
        (
          row
        ) => {
          const output = {
            Student:
              row.student
                ?.full_name ||
              "",

            "Student ID":
              row.student
                ?.student_id ||
              "",
          };

          semester.courses.forEach(
            (
              course,
              index
            ) => {
              const stats =
                row.courses?.[
                  course.course_assignment_id
                ];

              output[
                safeColumnName(
                  course,
                  index
                )
              ] =
                stats?.eligible
                  ? `${stats.rate}%`
                  : "";
            }
          );

          output[
            "Overall %"
          ] =
            row.overall
              ?.eligible
              ? `${row.overall.rate}%`
              : "";

          return output;
        }
      );

    // ==================================================
    // COURSE REGISTER
    // ==================================================

    const courseRegister =
      courseReport?.rows?.map(
        (
          row
        ) => {
          const output = {
            Student:
              row.student
                ?.full_name ||
              "",

            "Student ID":
              row.student
                ?.student_id ||
              "",
          };

          courseReport.sessions.forEach(
            (
              session,
              index
            ) => {
              const cell =
                row.cells?.[
                  session.id
                ];

              output[
                sessionColumnName(
                  session,
                  index
                )
              ] =
                cell?.status ===
                "not_marked"
                  ? "Not Marked"
                  : cell?.status ===
                      "excused"
                    ? "Leave"
                    : cell?.status
                      ? cell.status
                          .charAt(0)
                          .toUpperCase() +
                        cell.status.slice(
                          1
                        )
                      : "Not Marked";
            }
          );

          output.Present =
            row.present;

          output.Absent =
            row.absent;

          output.Late =
            row.late;

          output.Leave =
            row.excused;

          output[
            "Not Marked"
          ] =
            row.not_marked;

          output[
            "Total Sessions"
          ] =
            row.total_sessions;

          output[
            "Attendance %"
          ] =
            row.eligible
              ? `${row.rate}%`
              : "";

          return output;
        }
      ) || [];

    // ==================================================
    // COURSE SUMMARY
    // ==================================================

    const courseSummary =
      overview.course_summary.map(
        (
          row
        ) => ({
          Course:
            row.name,

          "Course Code":
            row.course_code,

          Teacher:
            row.teacher
              ?.full_name ||
            "",

          Program:
            row.program
              ?.name ||
            "",
          Batch:
            batchLabel(
              row.batch
            ),

          Semester:
            row.semester
              ?.name ||
            "",

          Students:
            row.student_count,
          Sessions:
            row.sessions,

          Present:
            row.present,

          Absent:
            row.absent,

          Late:
            row.late,

          Leave:
            row.excused,

          "Attendance %":
            `${row.rate}%`,
        })
      );

    // ==================================================
    // RAW ATTENDANCE LOG
    // ==================================================

    const sessionRows =
      sessions.map(
        (
          row
        ) => ({
          Student:
            row.student_name,

          "Student ID":
            row.student_number,

          Course:
            row.course_name,

          "Course Code":
            row.course_code,

          Teacher:
            row.teacher_name,

          Batch:
            row.batch,

          Department:
            row.department,

          Program:
            row.program,

          Semester:
            row.semester,

          Date:
            row.date,

          Session:
            row.session_title,

          Status:
            row.status ===
            "excused"
              ? "Leave"
              : row.status,

          "Marked By":
            row.marker_name,

          "Marked At":
            row.marked_at,

          Reason:
            row.reason,
        })
      );

    return {
      semester_matrix:
        semesterMatrix,

      course_register:
        courseRegister,

      course_summary:
        courseSummary,

      session_rows:
        sessionRows,
    };
  };

module.exports = {
  getOptions,
  getOverview,
  getSemesterReport,
  getCourseReport,
  getStudentReport,
  getSessions,
  getExportData,
};