const { supabaseAdmin } = require("../config/supabase");
const { result, allRows } = require("../utils/api");

const chunk = (values, size = 150) => {
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

const PLAN_SELECT = `
  id,
  title,
  assessment_type,
  scope_type,
  department_id,
  program_id,
  batch_id,
  semester_id,
  default_start_at,
  default_end_at,
  default_max_marks,
  instructions,
  status,
  created_by,
  published_at,
  cancelled_at,
  cancellation_reason,
  created_at,
  updated_at,
  creator:admins!assessment_plans_created_by_fkey(
    id,
    full_name,
    email
  ),
  department:academic_departments!assessment_plans_department_id_fkey(
    id,
    name,
    code
  ),
  program:academic_programs!assessment_plans_program_id_fkey(
    id,
    name,
    code,
    degree_title
  ),
  batch:academic_batches!assessment_plans_batch_id_fkey(
    id,
    start_year,
    end_year
  ),
  semester:academic_semesters!assessment_plans_semester_id_fkey(
    id,
    name,
    semester_number
  ),
  items:assessment_schedule_items!assessment_schedule_items_plan_id_fkey(
    id,
    course_assignment_id,
    starts_at,
    ends_at,
    max_marks,
    conduct_starts_at,
    conduct_ends_at,
    conduct_set_by,
    conduct_set_at,
    linked_quiz_id,
    linked_assignment_id,
    linked_gradebook_component_id,
    prepared_at,
    execution_started_at,
    results_submitted_at,
    completed_by,
    result_status,
    cancelled_at,
    cancellation_reason,
    created_at,
    updated_at,
    conduct_setter:profiles!assessment_schedule_items_conduct_set_by_fkey(
      id,
      full_name,
      email
    ),
    completed_teacher:profiles!assessment_schedule_items_completed_by_fkey(
      id,
      full_name,
      email
    ),
    gradebook_component:gradebook_components!assessment_schedule_items_linked_gradebook_component_id_fkey(
      id,
      name,
      category,
      max_marks,
      approval_status,
      submitted_at,
      approved_at
    ),
    course_assignment:course_assignments!assessment_schedule_items_course_assignment_id_fkey(
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
        status,
        department_id,
        program_id
      ),
      teacher:profiles!course_assignments_teacher_id_fkey(
        id,
        full_name,
        email,
        phone,
        is_active
      ),
      batch:academic_batches!course_assignments_batch_id_fkey(
        id,
        start_year,
        end_year
      ),
      semester:academic_semesters!course_assignments_semester_id_fkey(
        id,
        name,
        semester_number,
        program_id
      )
    )
  )
`;

const COURSE_ASSIGNMENT_SELECT = `
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
    status,
    department_id,
    program_id,
    catalog_department_code,
    catalog_program_code
  ),
  teacher:profiles!course_assignments_teacher_id_fkey(
    id,
    full_name,
    email,
    phone,
    is_active
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

// ======================================================
// ASSESSMENT PLANS
// ======================================================

const getPlans = (
  filters = {}
) =>
  allRows(() => {
    let query =
      supabaseAdmin
        .from(
          "assessment_plans"
        )
        .select(
          PLAN_SELECT
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        );

    for (
      const key of [
        "status",
        "assessment_type",
        "batch_id",
        "semester_id",
        "program_id",
        "department_id",
      ]
    ) {
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

const getPlanById = (
  id
) =>
  result(
    supabaseAdmin
      .from(
        "assessment_plans"
      )
      .select(
        PLAN_SELECT
      )
      .eq(
        "id",
        id
      )
      .maybeSingle()
  );

// ======================================================
// COURSE ASSIGNMENTS
// ======================================================

const getCourseAssignments = ({
  batchId,
  semesterId,
  courseAssignmentId = null,
  activeOnly = true,
}) =>
  allRows(() => {
    let query =
      supabaseAdmin
        .from(
          "course_assignments"
        )
        .select(
          COURSE_ASSIGNMENT_SELECT
        )
        .eq(
          "batch_id",
          batchId
        )
        .eq(
          "semester_id",
          semesterId
        )
        .order(
          "created_at",
          {
            ascending: true,
          }
        );

    if (
      activeOnly
    ) {
      query =
        query
          .eq(
            "status",
            "active"
          )
          .eq(
            "lifecycle_status",
            "active"
          );
    }

    if (
      courseAssignmentId
    ) {
      query =
        query.eq(
          "id",
          courseAssignmentId
        );
    }

    return query;
  });

// ======================================================
// ENROLLMENT STUDENTS
// ======================================================

const getActiveEnrollmentStudents = (
  courseAssignmentId
) =>
  allRows(() =>
    supabaseAdmin
      .from(
        "enrollments"
      )
      .select(
        "id,student_id"
      )
      .eq(
        "course_assignment_id",
        courseAssignmentId
      )
      .eq(
        "status",
        "active"
      )
      .eq(
        "enrollment_type",
        "regular"
      )
  );

// ======================================================
// ROSTER
// ======================================================

const getRosterRows =
  async (
    itemIds,
    includeStudents = false
  ) => {
    if (
      !itemIds.length
    ) {
      return [];
    }

    const select =
      includeStudents
        ? `
          id,
          schedule_item_id,
          enrollment_id,
          student_id,
          eligibility_status,
          result_status,
          created_at,
          updated_at,
          student:profiles!assessment_roster_student_id_fkey(
            id,
            full_name,
            email,
            student_id,
            is_active
          )
        `
        : `
          id,
          schedule_item_id,
          student_id,
          eligibility_status,
          result_status
        `;

    return allRows(() =>
      supabaseAdmin
        .from(
          "assessment_roster"
        )
        .select(
          select
        )
        .in(
          "schedule_item_id",
          itemIds
        )
        .order(
          "created_at",
          {
            ascending: true,
          }
        )
    );
  };

// ======================================================
// CREATE
// ======================================================

const createPlan = (
  payload
) =>
  result(
    supabaseAdmin.rpc(
      "admin_create_assessment_plan",
      {
        p_title:
          payload.title,

        p_assessment_type:
          payload.assessment_type,

        p_scope_type:
          payload.scope_type,

        p_department_id:
          payload.department_id,

        p_program_id:
          payload.program_id,

        p_batch_id:
          payload.batch_id,

        p_semester_id:
          payload.semester_id,

        p_default_start_at:
          payload.default_start_at,

        p_default_end_at:
          payload.default_end_at,

        p_default_max_marks:
          payload.default_max_marks,

        p_instructions:
          payload.instructions ||
          null,

        p_created_by:
          payload.created_by ||
          null,

        p_publish:
          Boolean(
            payload.publish
          ),

        p_items:
          payload.items,
      }
    )
  );

// ======================================================
// UPDATE
// ======================================================

const updatePlan = (
  id,
  payload,
  adminId
) =>
  result(
    supabaseAdmin.rpc(
      "admin_update_assessment_plan",
      {
        p_plan_id:
          id,

        p_title:
          payload.title,

        p_instructions:
          payload.instructions ||
          null,

        p_default_start_at:
          payload.default_start_at,

        p_default_end_at:
          payload.default_end_at,

        p_default_max_marks:
          payload.default_max_marks,

        p_items:
          payload.items,

        p_admin_id:
          adminId ||
          null,
      }
    )
  );

// ======================================================
// PUBLISH
// ======================================================

const publishPlan = (
  id,
  adminId
) =>
  result(
    supabaseAdmin.rpc(
      "admin_publish_assessment_plan",
      {
        p_plan_id:
          id,

        p_admin_id:
          adminId ||
          null,
      }
    )
  );

// ======================================================
// CANCEL
// ======================================================

const cancelPlan = (
  id,
  reason,
  adminId
) =>
  result(
    supabaseAdmin.rpc(
      "admin_cancel_assessment_plan",
      {
        p_plan_id:
          id,

        p_reason:
          reason ||
          null,

        p_admin_id:
          adminId ||
          null,
      }
    )
  );

// ======================================================
// DELETE
// ======================================================

const deletePlan = (
  id
) =>
  result(
    supabaseAdmin.rpc(
      "admin_delete_assessment_plan",
      {
        p_plan_id:
          id,
      }
    )
  );

// ======================================================
// RESULTS / REPORTS
// ======================================================

const getReportCourseAssignments = ({
  batchId,
  semesterId,
  courseAssignmentId = null,
}) =>
  getCourseAssignments({
    batchId,
    semesterId,
    courseAssignmentId,
    activeOnly: false,
  });

// ======================================================
// REPORT ENROLLMENTS
// ======================================================

const getReportEnrollments = ({
  batchId,
  semesterId,
  assignmentIds,
  studentId = null,
}) => {
  if (
    !assignmentIds.length
  ) {
    return Promise.resolve(
      []
    );
  }

  return allRows(() => {
    let query =
      supabaseAdmin
        .from(
          "enrollments"
        )
        .select(`
          id,
          student_id,
          course_id,
          course_assignment_id,
          batch_id,
          semester_id,
          status,
          enrollment_type,
          enrolled_at,
          completed_at
        `)
        .eq(
          "batch_id",
          batchId
        )
        .eq(
          "semester_id",
          semesterId
        )
        .eq(
          "enrollment_type",
          "regular"
        )
        .in(
          "course_assignment_id",
          assignmentIds
        )
        .order(
          "enrolled_at",
          {
            ascending: true,
          }
        );

    if (
      studentId
    ) {
      query =
        query.eq(
          "student_id",
          studentId
        );
    }

    return query;
  });
};

// ======================================================
// STUDENT PROFILES
// ======================================================

const getProfilesByIds =
  async (
    studentIds
  ) => {
    if (
      !studentIds.length
    ) {
      return [];
    }

    const rows =
      [];

    for (
      const ids of
      chunk(
        studentIds
      )
    ) {
      rows.push(
        ...(
          await allRows(
            () =>
              supabaseAdmin
                .from(
                  "profiles"
                )
                .select(
                  `
                    id,
                    full_name,
                    email,
                    student_id,
                    is_active
                  `
                )
                .in(
                  "id",
                  ids
                )
                .eq(
                  "role",
                  "student"
                )
                .order(
                  "full_name",
                  {
                    ascending:
                      true,
                  }
                )
          )
        )
      );
    }

    return rows.sort(
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
    );
  };

// ======================================================
// GRADEBOOK COMPONENTS
// ======================================================

const getGradebookComponents = (
  assignmentIds
) => {
  if (
    !assignmentIds.length
  ) {
    return Promise.resolve(
      []
    );
  }

  return allRows(() =>
    supabaseAdmin
      .from(
        "gradebook_components"
      )
      .select(`
        id,
        course_id,
        course_assignment_id,
        category,
        name,
        max_marks,
        source_type,
        source_id,
        approval_status,
        submitted_at,
        approved_at,
        created_at
      `)
      .in(
        "course_assignment_id",
        assignmentIds
      )
      .in(
        "category",
        [
          "quiz",
          "assignment",
          "mid",
          "final",
        ]
      )
      .order(
        "created_at",
        {
          ascending: true,
        }
      )
  );
};

// ======================================================
// GRADEBOOK MARKS
// ======================================================

const getGradebookMarks =
  async ({
    componentIds,
    studentIds,
  }) => {
    if (
      !componentIds.length ||
      !studentIds.length
    ) {
      return [];
    }

    const rows =
      [];

    for (
      const componentChunk of
      chunk(
        componentIds,
        100
      )
    ) {
      for (
        const studentChunk of
        chunk(
          studentIds,
          150
        )
      ) {
        rows.push(
          ...(
            await allRows(
              () =>
                supabaseAdmin
                  .from(
                    "gradebook_marks"
                  )
                  .select(
                    `
                      id,
                      component_id,
                      student_id,
                      marks_obtained,
                      updated_at
                    `
                  )
                  .in(
                    "component_id",
                    componentChunk
                  )
                  .in(
                    "student_id",
                    studentChunk
                  )
            )
          )
        );
      }
    }

    return rows;
  };

// ======================================================
// SCHEDULE ITEMS
// ======================================================

const getScheduleItemsForComponents = (
  assignmentIds
) => {
  if (
    !assignmentIds.length
  ) {
    return Promise.resolve(
      []
    );
  }

  return allRows(() =>
    supabaseAdmin
      .from(
        "assessment_schedule_items"
      )
      .select(`
        id,
        assessment_plan_id,
        course_assignment_id,
        linked_quiz_id,
        linked_assignment_id,
        linked_gradebook_component_id,
        starts_at,
        ends_at,
        conduct_starts_at,
        conduct_ends_at,
        result_status,
        results_submitted_at,
        plan:assessment_plans!assessment_schedule_items_plan_id_fkey(
          id,
          title,
          assessment_type,
          status
        )
      `)
      .in(
        "course_assignment_id",
        assignmentIds
      )
  );
};

// ======================================================
// PROMOTION BLOCKERS
// ======================================================

const getPromotionBlockers =
  async (
    studentIds
  ) => {
    const enrollments =
      await allRows(() =>
        supabaseAdmin
          .from(
            "enrollments"
          )
          .select(
            `
              student_id,
              course_assignment_id
            `
          )
          .in(
            "student_id",
            studentIds
          )
          .eq(
            "status",
            "active"
          )
          .eq(
            "enrollment_type",
            "regular"
          )
          .not(
            "course_assignment_id",
            "is",
            null
          )
      );

    const assignmentIds =
      [
        ...new Set(
          enrollments
            .map(
              (
                row
              ) =>
                row.course_assignment_id
            )
            .filter(
              Boolean
            )
        ),
      ];

    if (
      !assignmentIds.length
    ) {
      return [];
    }

    const items =
      await allRows(() =>
        supabaseAdmin
          .from(
            "assessment_schedule_items"
          )
          .select(`
            id,
            course_assignment_id,
            starts_at,
            ends_at,
            conduct_starts_at,
            conduct_ends_at,
            result_status,
            linked_quiz_id,
            linked_assignment_id,
            execution_started_at,
            results_submitted_at,
            plan:assessment_plans!inner(
              id,
              title,
              status,
              assessment_type
            ),
            course_assignment:course_assignments!assessment_schedule_items_course_assignment_id_fkey(
              id,
              course:courses!course_assignments_course_id_fkey(
                id,
                name,
                course_code
              )
            )
          `)
          .in(
            "course_assignment_id",
            assignmentIds
          )
          .eq(
            "plan.status",
            "published"
          )
          .not(
            "result_status",
            "in",
            "(completed,cancelled,missed)"
          )
      );

    const now =
      Date.now();

    return (
      items ||
      []
    ).filter(
      (
        item
      ) => {
        if (
          [
            "completed",
            "cancelled",
            "missed",
          ].includes(
            item.result_status
          )
        ) {
          return false;
        }

        const ended =
          new Date(
            item.ends_at
          ).getTime() <
          now;

        const hasExecutionEvidence =
          Boolean(
            item.execution_started_at ||
              item.results_submitted_at ||
              item.linked_quiz_id ||
              item.linked_assignment_id ||
              item.result_status ===
                "result_pending" ||
              item.result_status ===
                "in_progress"
          );

        // Availability window expired without
        // teacher execution => derived Missed.
        if (
          ended &&
          !hasExecutionEvidence
        ) {
          return false;
        }

        return true;
      }
    );
  };

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  getPlans,
  getPlanById,
  getCourseAssignments,
  getActiveEnrollmentStudents,
  getRosterRows,
  createPlan,
  updatePlan,
  publishPlan,
  cancelPlan,
  deletePlan,
  getReportCourseAssignments,
  getReportEnrollments,
  getProfilesByIds,
  getGradebookComponents,
  getGradebookMarks,
  getScheduleItemsForComponents,
  getPromotionBlockers,
};