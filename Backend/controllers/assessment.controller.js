const assessments = require("../models/assessment.model");
const { supabaseAdmin } = require("../config/supabase");
const {
  handle,
  httpError,
  uuid,
  allRows,
} = require("../utils/api");

const assessmentTypes = ["quiz", "assignment", "mid"];
const planStatuses = ["draft", "published", "cancelled"];
const scopes = ["semester", "course"];
const reportCategories = ["quiz", "assignment", "mid", "final"];

// ======================================================
// LOCAL CLOCK HELPERS
// ======================================================

// Option A:
// Assessment dates are stored as timestamp WITHOUT time zone.
// Keep the exact wall-clock time entered by Admin.
const toIso = (value, label) => {
  if (typeof value !== "string") {
    throw httpError(`${label} is invalid`);
  }

  const match = value.trim().match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/
  );

  if (!match) {
    throw httpError(`${label} is invalid`);
  }

  const [
    ,
    year,
    month,
    day,
    hour,
    minute,
    second = "00",
  ] = match;

  // Date.UTC is used ONLY to validate calendar components.
  // It does not convert the assessment's stored time.
  const check = new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    )
  );

  const valid =
    check.getUTCFullYear() === Number(year) &&
    check.getUTCMonth() + 1 === Number(month) &&
    check.getUTCDate() === Number(day) &&
    check.getUTCHours() === Number(hour) &&
    check.getUTCMinutes() === Number(minute) &&
    check.getUTCSeconds() === Number(second);

  if (!valid) {
    throw httpError(`${label} is invalid`);
  }

  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
};

const positiveNumber = (value, label) => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw httpError(`${label} must be greater than zero`);
  }

  return parsed;
};

const number = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

// Normalize a PostgreSQL timestamp WITHOUT time zone.
// Do not use new Date(value) for assessment schedule windows.
const assessmentClockTime = (value) => {
  if (value == null || value === "") {
    return null;
  }

  const match = String(value).trim().match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/
  );

  if (!match) {
    return null;
  }

  return (
    `${match[1]}-${match[2]}-${match[3]}` +
    `T${match[4]}:${match[5]}:${match[6] || "00"}`
  );
};

// Calculate the CURRENT local clock of the requesting Admin.
// The timezone is supplied in the request header, not stored
// in the assessment and not hardcoded to Pakistan.
const getClientLocalNow = (req) => {
  const timeZone = String(
    req.headers["x-client-timezone"] || ""
  ).trim();

  if (!timeZone) {
    throw httpError(
      "Client timezone is required for assessment status",
      400
    );
  }

  try {
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });

    const parts = Object.fromEntries(
      formatter
        .formatToParts(new Date())
        .map((part) => [part.type, part.value])
    );

    return (
      `${parts.year}-${parts.month}-${parts.day}` +
      `T${parts.hour}:${parts.minute}:${parts.second}`
    );
  } catch {
    throw httpError("Invalid client timezone", 400);
  }
};

// ======================================================
// ACADEMIC VALIDATION
// ======================================================

const validateHierarchy = async ({
  departmentId,
  programId,
  semesterId,
  batchId,
  requireActive = true,
}) => {
  const [
    departmentRes,
    programRes,
    semesterRes,
    batchRes,
  ] = await Promise.all([
    supabaseAdmin
      .from("academic_departments")
      .select("id,name,code,status")
      .eq("id", departmentId)
      .maybeSingle(),

    supabaseAdmin
      .from("academic_programs")
      .select(
        "id,name,code,degree_title,status,department_id"
      )
      .eq("id", programId)
      .maybeSingle(),

    supabaseAdmin
      .from("academic_semesters")
      .select(
        "id,name,status,program_id,semester_number"
      )
      .eq("id", semesterId)
      .maybeSingle(),

    supabaseAdmin
      .from("academic_batches")
      .select("id,start_year,end_year,status")
      .eq("id", batchId)
      .maybeSingle(),
  ]);

  for (const response of [
    departmentRes,
    programRes,
    semesterRes,
    batchRes,
  ]) {
    if (response.error) {
      throw response.error;
    }
  }

  const department = departmentRes.data;
  const program = programRes.data;
  const semester = semesterRes.data;
  const batch = batchRes.data;

  if (!department || !program || !semester || !batch) {
    throw httpError(
      "Selected academic structure is incomplete",
      404
    );
  }

  if (
    requireActive &&
    [department, program, semester, batch].some(
      (item) => item.status !== "active"
    )
  ) {
    throw httpError(
      "Select only active Department, Program, Batch and Semester"
    );
  }

  if (program.department_id !== departmentId) {
    throw httpError(
      "Program does not belong to the selected Department"
    );
  }

  if (semester.program_id !== programId) {
    throw httpError(
      "Semester does not belong to the selected Program"
    );
  }

  // Verify the Batch <-> Program mapping.
  const {
    data: batchProgram,
    error: batchProgramError,
  } = await supabaseAdmin
    .from("academic_batch_programs")
    .select(`
      id,
      batch_id,
      program_id,
      admission_type,
      entry_semester_id,
      current_semester_id,
      status
    `)
    .eq("batch_id", batchId)
    .eq("program_id", programId)
    .maybeSingle();

  if (batchProgramError) {
    throw batchProgramError;
  }

  if (!batchProgram) {
    throw httpError(
      "Selected Program is not configured in the selected Batch"
    );
  }

  if (
    requireActive &&
    batchProgram.status !== "active"
  ) {
    throw httpError(
      "Selected Program is inactive for this Batch"
    );
  }

  return {
    department,
    program,
    semester,
    batch,
    batchProgram,
  };
};

const normalizeBasePayload = async (body) => {
  const departmentId = uuid(
    body.department_id,
    "Department"
  );

  const programId = uuid(
    body.program_id,
    "Program"
  );

  const batchId = uuid(
    body.batch_id,
    "Batch"
  );

  const semesterId = uuid(
    body.semester_id,
    "Semester"
  );

  if (!assessmentTypes.includes(body.assessment_type)) {
    throw httpError(
      "Assessment type must be Quiz, Assignment or Mid"
    );
  }

  if (!scopes.includes(body.scope_type)) {
    throw httpError(
      "Assessment scope must be Entire Semester or Specific Course"
    );
  }

  const startAt = toIso(
    body.default_start_at,
    "Availability start"
  );

  const endAt = toIso(
    body.default_end_at,
    "Availability end"
  );

  // Both strings have the same fixed-width local-clock format.
  if (endAt <= startAt) {
    throw httpError(
      "Availability end must be after availability start"
    );
  }

  const maxMarks = positiveNumber(
    body.default_max_marks,
    "Maximum marks"
  );

  await validateHierarchy({
    departmentId,
    programId,
    semesterId,
    batchId,
  });

  return {
    department_id: departmentId,
    program_id: programId,
    batch_id: batchId,
    semester_id: semesterId,
    assessment_type: body.assessment_type,
    scope_type: body.scope_type,
    default_start_at: startAt,
    default_end_at: endAt,
    default_max_marks: maxMarks,
  };
};

// ======================================================
// ASSESSMENT STATUS
// ======================================================

// starts_at / ends_at:
// Admin's overall availability window.
//
// conduct_starts_at / conduct_ends_at:
// Exact slot selected by Teacher.
//
// Status flow used by the Admin panel:
// Window Open -> Conduct Scheduled -> Conducting
// -> Result Pending -> Completed.
//
// IMPORTANT:
// 1. Assessment dates are local wall-clock timestamps.
// 2. A persisted old "missed" value must not override the
//    current viewer-local schedule window.
// 3. Result Pending is also derived from real submissions,
//    so the Admin panel does not depend only on a schedule
//    row being updated by the mobile app.

const chunkValues = (values, size = 100) => {
  const clean = [
    ...new Set(
      (values || []).filter(Boolean)
    ),
  ];

  const chunks = [];

  for (
    let index = 0;
    index < clean.length;
    index += size
  ) {
    chunks.push(
      clean.slice(index, index + size)
    );
  }

  return chunks;
};

const fetchAssessmentSubmissionRows = async ({
  table,
  select,
  sourceField,
  sourceIds,
  studentIds,
}) => {
  if (
    !sourceIds.length ||
    !studentIds.length
  ) {
    return [];
  }

  const output = [];

  for (
    const sourceChunk
    of chunkValues(sourceIds, 100)
  ) {
    for (
      const studentChunk
      of chunkValues(studentIds, 150)
    ) {
      const rows = await allRows(() =>
        supabaseAdmin
          .from(table)
          .select(select)
          .in(sourceField, sourceChunk)
          .in("student_id", studentChunk)
      );

      output.push(...rows);
    }
  }

  return output;
};

const fetchAssessmentWorkflowEvidence = async (
  plans,
  rosterRows
) => {
  const items = plans.flatMap(
    (plan) => plan.items || []
  );

  if (!items.length) {
    return new Map();
  }

  const quizIds = [
    ...new Set(
      items
        .map((item) => item.linked_quiz_id)
        .filter(Boolean)
    ),
  ];

  const assignmentIds = [
    ...new Set(
      items
        .map((item) => item.linked_assignment_id)
        .filter(Boolean)
    ),
  ];

  const studentIds = [
    ...new Set(
      (rosterRows || [])
        .filter(
          (row) =>
            row.eligibility_status === "eligible"
        )
        .map((row) => row.student_id)
        .filter(Boolean)
    ),
  ];

  const [
    quizzes,
    assignments,
    quizSubmissions,
    assignmentSubmissions,
  ] = await Promise.all([
    quizIds.length
      ? allRows(() =>
          supabaseAdmin
            .from("quizzes")
            .select(
              "id,status,grading_status"
            )
            .in("id", quizIds)
        )
      : Promise.resolve([]),

    assignmentIds.length
      ? allRows(() =>
          supabaseAdmin
            .from("assignments")
            .select(
              "id,status,result_published"
            )
            .in("id", assignmentIds)
        )
      : Promise.resolve([]),

    fetchAssessmentSubmissionRows({
      table: "quiz_submissions",
      select:
        "id,quiz_id,student_id,submitted_at",
      sourceField: "quiz_id",
      sourceIds: quizIds,
      studentIds,
    }),

    fetchAssessmentSubmissionRows({
      table: "assignment_submissions",
      select:
        "id,assignment_id,student_id,status,submitted_at,graded_at",
      sourceField: "assignment_id",
      sourceIds: assignmentIds,
      studentIds,
    }),
  ]);

  const quizById = new Map(
    quizzes.map((row) => [row.id, row])
  );

  const assignmentById = new Map(
    assignments.map((row) => [row.id, row])
  );

  const eligibleStudentsByItem = new Map();

  for (const row of rosterRows || []) {
    if (
      row.eligibility_status !== "eligible" ||
      !row.student_id
    ) {
      continue;
    }

    if (
      !eligibleStudentsByItem.has(
        row.schedule_item_id
      )
    ) {
      eligibleStudentsByItem.set(
        row.schedule_item_id,
        new Set()
      );
    }

    eligibleStudentsByItem
      .get(row.schedule_item_id)
      .add(row.student_id);
  }

  const quizSubmittedStudents = new Map();

  for (const row of quizSubmissions) {
    if (
      !row.quiz_id ||
      !row.student_id ||
      !row.submitted_at
    ) {
      continue;
    }

    if (!quizSubmittedStudents.has(row.quiz_id)) {
      quizSubmittedStudents.set(
        row.quiz_id,
        new Set()
      );
    }

    quizSubmittedStudents
      .get(row.quiz_id)
      .add(row.student_id);
  }

  const assignmentSubmittedStudents = new Map();

  for (const row of assignmentSubmissions) {
    if (
      !row.assignment_id ||
      !row.student_id ||
      !row.submitted_at
    ) {
      continue;
    }

    if (
      !assignmentSubmittedStudents.has(
        row.assignment_id
      )
    ) {
      assignmentSubmittedStudents.set(
        row.assignment_id,
        new Set()
      );
    }

    assignmentSubmittedStudents
      .get(row.assignment_id)
      .add(row.student_id);
  }

  const evidenceByItem = new Map();

  for (const item of items) {
    const eligibleStudents =
      eligibleStudentsByItem.get(item.id) ||
      new Set();

    let submittedStudents = new Set();

    if (item.linked_quiz_id) {
      submittedStudents =
        quizSubmittedStudents.get(
          item.linked_quiz_id
        ) || new Set();
    } else if (item.linked_assignment_id) {
      submittedStudents =
        assignmentSubmittedStudents.get(
          item.linked_assignment_id
        ) || new Set();
    }

    const submittedEligibleCount = [
      ...eligibleStudents,
    ].filter((studentId) =>
      submittedStudents.has(studentId)
    ).length;

    const eligibleCount =
      eligibleStudents.size;

    const hasAnySubmission =
      submittedEligibleCount > 0;

    const allEligibleSubmitted =
      eligibleCount > 0 &&
      submittedEligibleCount === eligibleCount;

    const linkedQuiz = item.linked_quiz_id
      ? quizById.get(item.linked_quiz_id)
      : null;

    const linkedAssignment =
      item.linked_assignment_id
        ? assignmentById.get(
            item.linked_assignment_id
          )
        : null;

    const quizResultsPublished =
      String(
        linkedQuiz?.grading_status || ""
      )
        .trim()
        .toLowerCase() === "published";

    const assignmentResultsPublished =
      linkedAssignment?.result_published === true;

    const completed = Boolean(
      item.results_submitted_at ||
      item.result_status === "completed" ||
      quizResultsPublished ||
      assignmentResultsPublished
    );

    const resultPending = Boolean(
      !completed &&
      (
        item.result_status ===
          "result_pending" ||
        allEligibleSubmitted
      )
    );

    const started = Boolean(
      !completed &&
      (
        item.execution_started_at ||
        item.result_status === "in_progress" ||
        hasAnySubmission ||
        resultPending
      )
    );

    evidenceByItem.set(item.id, {
      completed,
      resultPending,
      started,
      eligibleCount,
      submittedEligibleCount,
    });
  }

  return evidenceByItem;
};

const displayStatus = (
  plan,
  item,
  clientLocalNow,
  workflow = {}
) => {
  if (
    plan.status === "cancelled" ||
    item.cancelled_at ||
    item.result_status === "cancelled"
  ) {
    return "Cancelled";
  }

  if (plan.status === "draft") {
    return "Draft";
  }

  const completed = Boolean(
    workflow.completed ||
    item.results_submitted_at ||
    item.result_status === "completed"
  );

  if (completed) {
    return "Completed";
  }

  if (!clientLocalNow) {
    throw httpError(
      "Client local time is missing for assessment status",
      400
    );
  }

  const windowStart = assessmentClockTime(
    item.starts_at
  );

  const windowEnd = assessmentClockTime(
    item.ends_at
  );

  if (
    !windowStart ||
    !windowEnd ||
    windowStart >= windowEnd
  ) {
    throw httpError(
      `Invalid assessment availability window: ${
        item.id || "unknown item"
      }`,
      500
    );
  }

  const conductStart = assessmentClockTime(
    item.conduct_starts_at
  );

  const conductEnd = assessmentClockTime(
    item.conduct_ends_at
  );

  const isResultPending = Boolean(
    workflow.resultPending ||
    item.result_status === "result_pending"
  );

  const isConducting = Boolean(
    workflow.started ||
    item.execution_started_at ||
    item.result_status === "in_progress"
  );

  const prepared = Boolean(
    item.linked_quiz_id ||
    item.linked_assignment_id ||
    item.linked_gradebook_component_id ||
    item.result_status === "prepared"
  );

  // Availability has not started yet.
  if (clientLocalNow < windowStart) {
    return "Scheduled";
  }

  // Once every eligible student has submitted, Result Pending
  // must win immediately, even while the conduct slot is still open.
  if (isResultPending) {
    return "Result Pending";
  }

  // Availability has expired.
  if (clientLocalNow > windowEnd) {
    return isConducting
      ? "Result Pending"
      : "Missed";
  }

  // Exact teacher conduct slot exists.
  if (conductStart || conductEnd) {
    if (
      !conductStart ||
      !conductEnd ||
      conductStart >= conductEnd
    ) {
      throw httpError(
        `Invalid teacher conduct slot: ${
          item.id || "unknown item"
        }`,
        500
      );
    }

    if (clientLocalNow < conductStart) {
      return "Conduct Scheduled";
    }

    // The clock being inside the conduct slot alone does not
    // mean a student has started. Actual execution evidence is
    // required for Conducting.
    if (clientLocalNow <= conductEnd) {
      return isConducting
        ? "Conducting"
        : "Conduct Scheduled";
    }

    return isConducting
      ? "Result Pending"
      : "Slot Missed";
  }

  if (isConducting) {
    return "Conducting";
  }

  return prepared ? "Prepared" : "Window Open";
};

const planDisplayStatus = (plan, items) => {
  if (plan.status === "draft") {
    return "Draft";
  }

  if (plan.status === "cancelled") {
    return "Cancelled";
  }

  if (!items.length) {
    return "Published";
  }

  const statuses = items.map(
    (item) => item.display_status
  );

  const priority = [
    "Conducting",
    "Result Pending",
    "Slot Missed",
    "Window Open",
    "Prepared",
    "Conduct Scheduled",
    "Scheduled",
  ];

  for (const status of priority) {
    if (statuses.includes(status)) {
      return status;
    }
  }

  if (
    statuses.every(
      (status) => status === "Completed"
    )
  ) {
    return "Completed";
  }

  if (
    statuses.every((status) =>
      ["Completed", "Missed"].includes(status)
    )
  ) {
    return statuses.includes("Completed")
      ? "Completed"
      : "Missed";
  }

  if (
    statuses.every(
      (status) => status === "Cancelled"
    )
  ) {
    return "Cancelled";
  }

  return "Published";
};

// ======================================================
// VIEW DETAILS: RESULT PROGRESS
// ======================================================

const buildResultProgress = ({
  status,
  roster = [],
  workflow = {},
}) => {
  const eligibleRows = roster.filter(
    (row) => row.eligibility_status === "eligible"
  );

  const eligible =
    Number.isFinite(Number(workflow.eligibleCount))
      ? Number(workflow.eligibleCount)
      : eligibleRows.length;

  const rosterGraded = eligibleRows.filter(
    (row) => row.result_status === "graded"
  ).length;

  const rosterAbsent = eligibleRows.filter(
    (row) => row.result_status === "absent"
  ).length;

  const rosterPending = eligibleRows.filter(
    (row) => row.result_status === "pending"
  ).length;

  const submitted = Math.min(
    eligible,
    Math.max(
      0,
      Number(workflow.submittedEligibleCount) || 0
    )
  );

  const remaining = Math.max(
    eligible - submitted,
    0
  );

  if (
    [
      "Draft",
      "Scheduled",
      "Window Open",
      "Prepared",
      "Conduct Scheduled",
      "Published",
    ].includes(status)
  ) {
    return {
      state: "not_started",
      label: "Not started",
      eligible,
      submitted: 0,
      graded: 0,
      pending: 0,
      remaining: eligible,
    };
  }

  if (status === "Conducting") {
    return {
      state: "conducting",
      label: `${submitted} submitted · ${remaining} remaining`,
      eligible,
      submitted,
      graded: rosterGraded,
      pending: Math.max(eligible - rosterGraded, 0),
      remaining,
    };
  }

  if (status === "Result Pending") {
    const pending = Math.max(
      eligible - rosterGraded - rosterAbsent,
      0
    );

    return {
      state: "result_pending",
      label: `${rosterGraded} graded · ${pending} pending`,
      eligible,
      submitted,
      graded: rosterGraded,
      pending,
      remaining: 0,
    };
  }

  if (status === "Completed") {
    // Some older flows publish the final result without updating the
    // assessment_roster snapshot from pending -> graded. In that case,
    // use real submissions / completed lifecycle as the display fallback.
    const graded = Math.max(
      rosterGraded,
      submitted,
      Math.max(eligible - rosterAbsent, 0)
    );

    return {
      state: "completed",
      label: `${graded} graded · 0 pending`,
      eligible,
      submitted,
      graded,
      pending: 0,
      remaining: 0,
    };
  }

  if (
    status === "Missed" ||
    status === "Slot Missed"
  ) {
    return {
      state: "missed",
      label: "Not conducted",
      eligible,
      submitted: 0,
      graded: 0,
      pending: 0,
      remaining: 0,
    };
  }

  if (status === "Cancelled") {
    return {
      state: "cancelled",
      label: "Cancelled",
      eligible,
      submitted: 0,
      graded: 0,
      pending: 0,
      remaining: 0,
    };
  }

  return {
    state: "current",
    label: `${rosterGraded} graded · ${rosterPending} pending`,
    eligible,
    submitted,
    graded: rosterGraded,
    pending: rosterPending,
    remaining: Math.max(eligible - submitted, 0),
  };
};

const enrichPlan = (
  plan,
  rosterRows = [],
  clientLocalNow,
  workflowByItem = new Map()
) => {
  const rosterByItem = new Map();

  for (const row of rosterRows) {
    if (!rosterByItem.has(row.schedule_item_id)) {
      rosterByItem.set(row.schedule_item_id, []);
    }

    rosterByItem
      .get(row.schedule_item_id)
      .push(row);
  }

  const items = (plan.items || [])
    .map((item) => {
      const roster =
        rosterByItem.get(item.id) || [];

      const workflow =
        workflowByItem.get(item.id) || {};

      const status = displayStatus(
        plan,
        item,
        clientLocalNow,
        workflow
      );

      const resultProgress = buildResultProgress({
        status,
        roster,
        workflow,
      });

      return {
        ...item,
        display_status: status,
        student_count: roster.length,
        result_progress: resultProgress,

        roster_summary: {
          eligible: roster.filter(
            (row) =>
              row.eligibility_status === "eligible"
          ).length,

          graded: roster.filter(
            (row) =>
              row.result_status === "graded"
          ).length,

          absent: roster.filter(
            (row) =>
              row.result_status === "absent"
          ).length,

          exempt: roster.filter(
            (row) =>
              row.result_status === "exempt"
          ).length,

          pending: roster.filter(
            (row) =>
              row.result_status === "pending"
          ).length,
        },

        roster: roster[0]?.student
          ? roster
          : undefined,
      };
    })
    .sort((a, b) => {
      const aTime =
        assessmentClockTime(a.starts_at) || "";

      const bTime =
        assessmentClockTime(b.starts_at) || "";

      return aTime.localeCompare(bTime);
    });

  return {
    ...plan,

    display_status: planDisplayStatus(
      plan,
      items
    ),

    items,

    summary: {
      course_count: items.length,

      teacher_count: new Set(
        items
          .map(
            (item) =>
              item.course_assignment?.teacher?.id
          )
          .filter(Boolean)
      ).size,

      student_seats: items.reduce(
        (sum, item) => sum + item.student_count,
        0
      ),

      completed_items: items.filter(
        (item) =>
          item.display_status === "Completed"
      ).length,

      result_pending_items: items.filter(
        (item) =>
          item.display_status === "Result Pending"
      ).length,

      open_items: items.filter((item) =>
        [
          "Window Open",
          "Prepared",
          "Conduct Scheduled",
          "Conducting",
        ].includes(item.display_status)
      ).length,
    },
  };
};

const enrichPlansWithRoster = async (
  plans,
  detailed = false,
  clientLocalNow
) => {
  const itemIds = plans.flatMap((plan) =>
    (plan.items || []).map((item) => item.id)
  );

  const rosterRows =
    await assessments.getRosterRows(
      itemIds,
      detailed
    );

  const workflowByItem =
    await fetchAssessmentWorkflowEvidence(
      plans,
      rosterRows
    );

  const rowsByPlan = new Map();

  for (const plan of plans) {
    rowsByPlan.set(plan.id, []);
  }

  const itemPlanMap = new Map();

  for (const plan of plans) {
    for (const item of plan.items || []) {
      itemPlanMap.set(item.id, plan.id);
    }
  }

  for (const row of rosterRows) {
    const planId = itemPlanMap.get(
      row.schedule_item_id
    );

    if (planId) {
      rowsByPlan.get(planId).push(row);
    }
  }

  return plans.map((plan) =>
    enrichPlan(
      plan,
      rowsByPlan.get(plan.id) || [],
      clientLocalNow,
      workflowByItem
    )
  );
};

// ======================================================
// SCHEDULE CRUD
// ======================================================

const getAll = handle(async (req, res) => {
  const clientLocalNow =
    getClientLocalNow(req);

  for (const key of [
    "batch_id",
    "semester_id",
    "program_id",
    "department_id",
  ]) {
    if (req.query[key]) {
      uuid(req.query[key], key);
    }
  }

  if (
    req.query.status &&
    !planStatuses.includes(req.query.status)
  ) {
    throw httpError(
      "Invalid assessment status"
    );
  }

  if (
    req.query.assessment_type &&
    !assessmentTypes.includes(
      req.query.assessment_type
    )
  ) {
    throw httpError(
      "Invalid assessment type"
    );
  }

  const rows = await assessments.getPlans(
    req.query
  );

  const enriched =
    await enrichPlansWithRoster(
      rows,
      false,
      clientLocalNow
    );

  res.json({
    success: true,
    data: enriched,
  });
});

const getById = handle(async (req, res) => {
  const clientLocalNow =
    getClientLocalNow(req);

  const id = uuid(
    req.params.id,
    "Assessment"
  );

  const plan = await assessments.getPlanById(
    id
  );

  if (!plan) {
    throw httpError(
      "Assessment plan not found",
      404
    );
  }

  const [enriched] =
    await enrichPlansWithRoster(
      [plan],
      true,
      clientLocalNow
    );

  res.json({
    success: true,
    data: enriched,
  });
});

const courseOptions = handle(
  async (req, res) => {
    const batchId = uuid(
      req.query.batch_id,
      "Batch"
    );

    const semesterId = uuid(
      req.query.semester_id,
      "Semester"
    );

    const programId = uuid(
      req.query.program_id,
      "Program"
    );

    const departmentId = uuid(
      req.query.department_id,
      "Department"
    );

    await validateHierarchy({
      departmentId,
      programId,
      semesterId,
      batchId,
    });

    const rows =
      await assessments.getCourseAssignments({
        batchId,
        semesterId,
      });

    const active = rows.filter(
      (row) =>
        row.course?.status === "published" &&
        row.course?.program_id === programId &&
        row.course?.department_id ===
          departmentId
    );

    const data = await Promise.all(
      active.map(async (row) => {
        const enrollmentRows =
          await assessments.getActiveEnrollmentStudents(
            row.id
          );

        return {
          ...row,
          student_count:
            enrollmentRows.length,
        };
      })
    );

    res.json({
      success: true,
      data,
    });
  }
);

const preview = handle(async (req, res) => {
  const base = await normalizeBasePayload(
    req.body
  );

  let courseAssignmentId = null;

  if (base.scope_type === "course") {
    courseAssignmentId = uuid(
      req.body.course_assignment_id,
      "Course Assignment"
    );
  }

  const candidates =
    await assessments.getCourseAssignments({
      batchId: base.batch_id,
      semesterId: base.semester_id,
      courseAssignmentId,
    });

  const filtered = candidates.filter(
    (row) =>
      row.course?.status === "published" &&
      row.course?.program_id ===
        base.program_id &&
      row.course?.department_id ===
        base.department_id
  );

  if (!filtered.length) {
    throw httpError(
      "No active Course Assignments found for the selected scope",
      404
    );
  }

  if (
    base.scope_type === "course" &&
    filtered.length !== 1
  ) {
    throw httpError(
      "Selected Course Assignment is not available",
      404
    );
  }

  const overrideMap = new Map();

  if (Array.isArray(req.body.items)) {
    for (const item of req.body.items) {
      if (item?.course_assignment_id) {
        overrideMap.set(
          item.course_assignment_id,
          item
        );
      }
    }
  }

  const items = [];

  for (const candidate of filtered) {
    const override =
      overrideMap.get(candidate.id) || {};

    const startsAt = override.starts_at
      ? toIso(
          override.starts_at,
          "Course availability start"
        )
      : base.default_start_at;

    const endsAt = override.ends_at
      ? toIso(
          override.ends_at,
          "Course availability end"
        )
      : base.default_end_at;

    const maxMarks =
      override.max_marks != null
        ? positiveNumber(
            override.max_marks,
            "Course maximum marks"
          )
        : base.default_max_marks;

    if (endsAt <= startsAt) {
      throw httpError(
        `Availability end must be after start for ${
          candidate.course?.name ||
          "a course"
        }`
      );
    }

    const enrollments =
      await assessments.getActiveEnrollmentStudents(
        candidate.id
      );

    items.push({
      course_assignment_id:
        candidate.id,

      course:
        candidate.course,

      teacher:
        candidate.teacher,

      starts_at:
        startsAt,

      ends_at:
        endsAt,

      max_marks:
        maxMarks,

      student_count:
        enrollments.length,

      teacher_assigned:
        Boolean(candidate.teacher_id),
    });
  }

  res.json({
    success: true,

    data: {
      ...base,

      items,

      summary: {
        course_count:
          items.length,

        teacher_count:
          new Set(
            items
              .map(
                (item) =>
                  item.teacher?.id
              )
              .filter(Boolean)
          ).size,

        student_seats:
          items.reduce(
            (sum, item) =>
              sum + item.student_count,
            0
          ),

        unassigned_teacher_count:
          items.filter(
            (item) =>
              !item.teacher_assigned
          ).length,
      },
    },
  });
});

const create = handle(async (req, res) => {
  if (!req.body.title?.trim()) {
    throw httpError(
      "Assessment name is required"
    );
  }

  const base =
    await normalizeBasePayload(
      req.body
    );

  const publish =
    req.body.publish === true;

  if (
    !Array.isArray(req.body.items) ||
    !req.body.items.length
  ) {
    throw httpError(
      "Preview the schedule before saving it"
    );
  }

  const items = req.body.items.map(
    (item) => ({
      course_assignment_id: uuid(
        item.course_assignment_id,
        "Course Assignment"
      ),

      starts_at: toIso(
        item.starts_at ||
          base.default_start_at,
        "Course availability start"
      ),

      ends_at: toIso(
        item.ends_at ||
          base.default_end_at,
        "Course availability end"
      ),

      max_marks: positiveNumber(
        item.max_marks ??
          base.default_max_marks,
        "Course maximum marks"
      ),
    })
  );

  for (const item of items) {
    if (
      item.ends_at <= item.starts_at
    ) {
      throw httpError(
        "Each course availability end must be after its start"
      );
    }
  }

  if (
    base.scope_type === "course" &&
    items.length !== 1
  ) {
    throw httpError(
      "Specific Course assessment must contain exactly one course"
    );
  }

  const data =
    await assessments.createPlan({
      ...base,

      title:
        req.body.title.trim(),

      instructions:
        req.body.instructions || null,

      created_by:
        req.admin.id,

      publish,

      items,
    });

  res.status(201).json({
    success: true,

    message: publish
      ? "Assessment availability published and notifications sent"
      : "Assessment draft saved",

    data,
  });
});

const update = handle(async (req, res) => {
  const id = uuid(
    req.params.id,
    "Assessment"
  );

  const plan =
    await assessments.getPlanById(
      id
    );

  if (!plan) {
    throw httpError(
      "Assessment plan not found",
      404
    );
  }

  if (
    plan.status === "cancelled"
  ) {
    throw httpError(
      "Cancelled assessments cannot be edited"
    );
  }

  if (!req.body.title?.trim()) {
    throw httpError(
      "Assessment name is required"
    );
  }

  const startAt = toIso(
    req.body.default_start_at,
    "Availability start"
  );

  const endAt = toIso(
    req.body.default_end_at,
    "Availability end"
  );

  const maxMarks = positiveNumber(
    req.body.default_max_marks,
    "Maximum marks"
  );

  if (endAt <= startAt) {
    throw httpError(
      "Availability end must be after availability start"
    );
  }

  if (
    !Array.isArray(req.body.items) ||
    !req.body.items.length
  ) {
    throw httpError(
      "Assessment course schedule is required"
    );
  }

  const existingIds = new Set(
    (plan.items || []).map(
      (item) => item.id
    )
  );

  const items = req.body.items.map(
    (item) => {
      const itemId = uuid(
        item.id,
        "Schedule Item"
      );

      if (!existingIds.has(itemId)) {
        throw httpError(
          "Invalid schedule item"
        );
      }

      const itemStart = toIso(
        item.starts_at,
        "Course availability start"
      );

      const itemEnd = toIso(
        item.ends_at,
        "Course availability end"
      );

      if (itemEnd <= itemStart) {
        throw httpError(
          "Each course availability end must be after its start"
        );
      }

      return {
        id: itemId,

        starts_at:
          itemStart,

        ends_at:
          itemEnd,

        max_marks:
          positiveNumber(
            item.max_marks,
            "Course maximum marks"
          ),
      };
    }
  );

  if (
    items.length !== existingIds.size
  ) {
    throw httpError(
      "Every existing course schedule item must be included in the update"
    );
  }

  const data =
    await assessments.updatePlan(
      id,

      {
        title:
          req.body.title.trim(),

        instructions:
          req.body.instructions || null,

        default_start_at:
          startAt,

        default_end_at:
          endAt,

        default_max_marks:
          maxMarks,

        items,
      },

      req.admin.id
    );

  res.json({
    success: true,

    message:
      plan.status === "published"
        ? "Assessment updated and users notified"
        : "Assessment draft updated",

    data,
  });
});

const publish = handle(async (req, res) => {
  const id = uuid(
    req.params.id,
    "Assessment"
  );

  const data =
    await assessments.publishPlan(
      id,
      req.admin.id
    );

  res.json({
    success: true,
    message:
      "Assessment published and notifications sent",
    data,
  });
});

const cancel = handle(async (req, res) => {
  const id = uuid(
    req.params.id,
    "Assessment"
  );

  const reason = String(
    req.body.reason || ""
  ).trim();

  if (!reason) {
    throw httpError(
      "Cancellation reason is required"
    );
  }

  const data =
    await assessments.cancelPlan(
      id,
      reason,
      req.admin.id
    );

  res.json({
    success: true,
    message:
      "Assessment cancelled and users notified",
    data,
  });
});

const remove = handle(async (req, res) => {
  const id = uuid(
    req.params.id,
    "Assessment"
  );

  const data =
    await assessments.deletePlan(
      id
    );

  res.json({
    success: true,
    message:
      "Assessment deleted",
    data,
  });
});

// ======================================================
// RESULTS REPORT HELPERS
// ======================================================

const reportScopeFromQuery = async (
  query
) => {
  const departmentId = uuid(
    query.department_id,
    "Department"
  );

  const programId = uuid(
    query.program_id,
    "Program"
  );

  const batchId = uuid(
    query.batch_id,
    "Batch"
  );

  const semesterId = uuid(
    query.semester_id,
    "Semester"
  );

  const academic =
    await validateHierarchy({
      departmentId,
      programId,
      batchId,
      semesterId,
      requireActive: false,
    });

  return {
    departmentId,
    programId,
    batchId,
    semesterId,
    academic,
  };
};

const reportAssignments = async ({
  departmentId,
  programId,
  batchId,
  semesterId,
  courseAssignmentId = null,
}) => {
  const rows =
    await assessments.getReportCourseAssignments({
      batchId,
      semesterId,
      courseAssignmentId,
    });

  return rows.filter(
    (row) =>
      row.course?.department_id ===
        departmentId &&
      row.course?.program_id ===
        programId
  );
};

const reportOptions = handle(
  async (req, res) => {
    const scope =
      await reportScopeFromQuery(
        req.query
      );

    const courseAssignments =
      await reportAssignments(
        scope
      );

    const assignmentIds =
      courseAssignments.map(
        (row) => row.id
      );

    const enrollments =
      await assessments.getReportEnrollments({
        batchId:
          scope.batchId,

        semesterId:
          scope.semesterId,

        assignmentIds,
      });

    const studentIds = [
      ...new Set(
        enrollments
          .map(
            (row) =>
              row.student_id
          )
          .filter(Boolean)
      ),
    ];

    const students =
      await assessments.getProfilesByIds(
        studentIds
      );

    res.json({
      success: true,

      data: {
        courses:
          courseAssignments,

        students,
      },
    });
  }
);

// ======================================================
// LIVE REPORT DATA
// ======================================================

const fetchLiveQuizzes = async (
  courseAssignmentIds
) => {
  if (!courseAssignmentIds.length) {
    return [];
  }

  return allRows(() =>
    supabaseAdmin
      .from("quizzes")
      .select(`
        id,
        course_id,
        course_assignment_id,
        teacher_id,
        title,
        total_marks,
        created_at,
        updated_at,
        starts_at,
        ends_at,
        status,
        grading_status,
        result_reveal_at
      `)
      .in(
        "course_assignment_id",
        courseAssignmentIds
      )
      .order("created_at", {
        ascending: true,
      })
  );
};

const fetchLiveAssignments = async (
  courseAssignmentIds
) => {
  if (!courseAssignmentIds.length) {
    return [];
  }

  return allRows(() =>
    supabaseAdmin
      .from("assignments")
      .select(`
        id,
        course_id,
        course_assignment_id,
        teacher_id,
        title,
        total_marks,
        created_at,
        updated_at,
        available_from,
        start_date,
        due_date,
        status,
        result_published,
        result_publish_at,
        result_release_at
      `)
      .in(
        "course_assignment_id",
        courseAssignmentIds
      )
      .order("created_at", {
        ascending: true,
      })
  );
};

const fetchLiveQuizSubmissions = async ({
  quizIds,
  studentIds,
}) => {
  if (
    !quizIds.length ||
    !studentIds.length
  ) {
    return [];
  }

  const output = [];
  const quizChunks = [];

  for (
    let index = 0;
    index < quizIds.length;
    index += 100
  ) {
    quizChunks.push(
      quizIds.slice(
        index,
        index + 100
      )
    );
  }

  const studentChunks = [];

  for (
    let index = 0;
    index < studentIds.length;
    index += 150
  ) {
    studentChunks.push(
      studentIds.slice(
        index,
        index + 150
      )
    );
  }

  for (const quizChunk of quizChunks) {
    for (
      const studentChunk of studentChunks
    ) {
      const rows = await allRows(() =>
        supabaseAdmin
          .from("quiz_submissions")
          .select(`
            id,
            quiz_id,
            student_id,
            score,
            total_marks,
            submitted_at
          `)
          .in(
            "quiz_id",
            quizChunk
          )
          .in(
            "student_id",
            studentChunk
          )
          .order("submitted_at", {
            ascending: true,
          })
      );

      output.push(...rows);
    }
  }

  return output;
};

const fetchLiveAssignmentSubmissions =
  async ({
    assignmentIds,
    studentIds,
  }) => {
    if (
      !assignmentIds.length ||
      !studentIds.length
    ) {
      return [];
    }

    const output = [];
    const assignmentChunks = [];

    for (
      let index = 0;
      index < assignmentIds.length;
      index += 100
    ) {
      assignmentChunks.push(
        assignmentIds.slice(
          index,
          index + 100
        )
      );
    }

    const studentChunks = [];

    for (
      let index = 0;
      index < studentIds.length;
      index += 150
    ) {
      studentChunks.push(
        studentIds.slice(
          index,
          index + 150
        )
      );
    }

    for (
      const assignmentChunk
      of assignmentChunks
    ) {
      for (
        const studentChunk
        of studentChunks
      ) {
        const rows = await allRows(() =>
          supabaseAdmin
            .from(
              "assignment_submissions"
            )
            .select(`
              id,
              assignment_id,
              student_id,
              status,
              marks_obtained,
              submitted_at,
              graded_at
            `)
            .in(
              "assignment_id",
              assignmentChunk
            )
            .in(
              "student_id",
              studentChunk
            )
            .order("submitted_at", {
              ascending: true,
            })
        );

        output.push(...rows);
      }
    }

    return output;
  };

// ======================================================
// REPORT CALCULATION HELPERS
// ======================================================

const latestRow = (
  existing,
  next,
  dateFields = []
) => {
  if (!existing) {
    return next;
  }

  const getTime = (row) => {
    for (const field of dateFields) {
      if (!row?.[field]) {
        continue;
      }

      const value = new Date(
        row[field]
      ).getTime();

      if (
        Number.isFinite(value)
      ) {
        return value;
      }
    }

    return 0;
  };

  return getTime(next) >=
    getTime(existing)
    ? next
    : existing;
};

const createQuizSubmissionMap = (
  rows
) => {
  const map = new Map();

  for (const row of rows) {
    const key =
      `${row.student_id}:${row.quiz_id}`;

    map.set(
      key,

      latestRow(
        map.get(key),
        row,
        ["submitted_at"]
      )
    );
  }

  return map;
};

const createAssignmentSubmissionMap = (
  rows
) => {
  const map = new Map();

  for (const row of rows) {
    const key =
      `${row.student_id}:${row.assignment_id}`;

    map.set(
      key,

      latestRow(
        map.get(key),
        row,
        [
          "graded_at",
          "submitted_at",
        ]
      )
    );
  }

  return map;
};

const componentSourceKey = (
  category,
  sourceId
) =>
  sourceId
    ? `${category}:${sourceId}`
    : null;

// ======================================================
// RESULTS REPORT
// Priority:
// 1. Gradebook marks
// 2. Live Quiz submissions
// 3. Live Assignment submissions
// Mid remains Gradebook-only.
// ======================================================

const buildResultsReport = async ({
  scope,
  courseAssignmentId = null,
  studentId = null,
}) => {
  const courseAssignments =
    await reportAssignments({
      ...scope,
      courseAssignmentId,
    });

  if (!courseAssignments.length) {
    return {
      generated_at:
        new Date().toISOString(),

      academic:
        scope.academic,

      courses: [],
      students: [],
      rows: [],

      summary: {
        student_count: 0,
        course_count: 0,
        component_count: 0,
        recorded_marks: 0,
        pending_marks: 0,
        gradebook_marks: 0,
        live_quiz_marks: 0,
        live_assignment_marks: 0,
      },
    };
  }

  const assignmentIds =
    courseAssignments.map(
      (row) => row.id
    );

  const enrollments =
    await assessments.getReportEnrollments({
      batchId:
        scope.batchId,

      semesterId:
        scope.semesterId,

      assignmentIds,

      studentId,
    });

  const studentIds = [
    ...new Set(
      enrollments
        .map(
          (row) => row.student_id
        )
        .filter(Boolean)
    ),
  ];

  const [
    students,
    gradebookComponents,
    scheduleItems,
    quizzes,
    liveAssignments,
  ] = await Promise.all([
    assessments.getProfilesByIds(
      studentIds
    ),

    assessments.getGradebookComponents(
      assignmentIds
    ),

    assessments.getScheduleItemsForComponents(
      assignmentIds
    ),

    fetchLiveQuizzes(
      assignmentIds
    ),

    fetchLiveAssignments(
      assignmentIds
    ),
  ]);

  const gradebookComponentIds =
    gradebookComponents.map(
      (component) => component.id
    );

  const quizIds =
    quizzes.map(
      (quiz) => quiz.id
    );

  const liveAssignmentIds =
    liveAssignments.map(
      (assignment) => assignment.id
    );

  const [
    gradebookMarks,
    quizSubmissions,
    assignmentSubmissions,
  ] = await Promise.all([
    assessments.getGradebookMarks({
      componentIds:
        gradebookComponentIds,

      studentIds,
    }),

    fetchLiveQuizSubmissions({
      quizIds,
      studentIds,
    }),

    fetchLiveAssignmentSubmissions({
      assignmentIds:
        liveAssignmentIds,

      studentIds,
    }),
  ]);

  const enrollmentPairs = new Set(
    enrollments.map(
      (row) =>
        `${row.student_id}:${row.course_assignment_id}`
    )
  );

  const gradebookMarksMap = new Map(
    gradebookMarks.map(
      (mark) => [
        `${mark.student_id}:${mark.component_id}`,
        mark,
      ]
    )
  );

  const quizSubmissionMap =
    createQuizSubmissionMap(
      quizSubmissions
    );

  const assignmentSubmissionMap =
    createAssignmentSubmissionMap(
      assignmentSubmissions
    );

  // ----------------------------------------------------
  // SCHEDULE LOOKUPS
  // ----------------------------------------------------

  const scheduleByComponent =
    new Map();

  const scheduleByQuiz =
    new Map();

  const scheduleByAssignment =
    new Map();

  for (const item of scheduleItems) {
    if (
      item.linked_gradebook_component_id
    ) {
      scheduleByComponent.set(
        item.linked_gradebook_component_id,
        item
      );
    }

    if (item.linked_quiz_id) {
      scheduleByQuiz.set(
        item.linked_quiz_id,
        item
      );
    }

    if (item.linked_assignment_id) {
      scheduleByAssignment.set(
        item.linked_assignment_id,
        item
      );
    }
  }

  // ----------------------------------------------------
  // GRADEBOOK SOURCE LOOKUP
  // ----------------------------------------------------

  const gradebookBySource =
    new Map();

  for (
    const component
    of gradebookComponents
  ) {
    if (!component.source_id) {
      continue;
    }

    const key = componentSourceKey(
      component.category,
      component.source_id
    );

    if (key) {
      gradebookBySource.set(
        key,
        component
      );
    }
  }

  // ----------------------------------------------------
  // COMPONENTS BY COURSE ASSIGNMENT
  // ----------------------------------------------------

  const componentsByAssignment =
    new Map();

  const ensureAssignment = (
    assignmentId
  ) => {
    if (
      !componentsByAssignment.has(
        assignmentId
      )
    ) {
      componentsByAssignment.set(
        assignmentId,
        []
      );
    }

    return componentsByAssignment.get(
      assignmentId
    );
  };

  // 1. OFFICIAL GRADEBOOK COMPONENTS

  for (
    const component
    of gradebookComponents
  ) {
    if (
      !component.course_assignment_id
    ) {
      continue;
    }

    let scheduleItem =
      scheduleByComponent.get(
        component.id
      ) || null;

    if (
      !scheduleItem &&
      component.source_id
    ) {
      if (
        component.category === "quiz"
      ) {
        scheduleItem =
          scheduleByQuiz.get(
            component.source_id
          ) || null;
      }

      if (
        component.category === "assignment"
      ) {
        scheduleItem =
          scheduleByAssignment.get(
            component.source_id
          ) || null;
      }
    }

    ensureAssignment(
      component.course_assignment_id
    ).push({
      ...component,

      report_component_id:
        component.id,

      data_source:
        "gradebook",

      schedule_item:
        scheduleItem,
    });
  }

  // 2. QUIZ COMPONENT FALLBACK

  for (const quiz of quizzes) {
    if (
      !quiz.course_assignment_id
    ) {
      continue;
    }

    const existing =
      gradebookBySource.get(
        componentSourceKey(
          "quiz",
          quiz.id
        )
      );

    if (existing) {
      continue;
    }

    ensureAssignment(
      quiz.course_assignment_id
    ).push({
      id:
        `quiz:${quiz.id}`,

      report_component_id:
        `quiz:${quiz.id}`,

      course_id:
        quiz.course_id,

      course_assignment_id:
        quiz.course_assignment_id,

      category:
        "quiz",

      name:
        quiz.title || "Quiz",

      max_marks:
        number(quiz.total_marks),

      source_type:
        "digital_quiz",

      source_id:
        quiz.id,

      approval_status:
        quiz.grading_status ||
        quiz.status ||
        "live",

      submitted_at:
        null,

      approved_at:
        null,

      created_at:
        quiz.created_at,

      data_source:
        "quiz_submission",

      schedule_item:
        scheduleByQuiz.get(
          quiz.id
        ) || {
          starts_at:
            quiz.starts_at,

          ends_at:
            quiz.ends_at,

          conduct_starts_at:
            quiz.starts_at,

          conduct_ends_at:
            quiz.ends_at,
        },
    });
  }

  // 3. ASSIGNMENT COMPONENT FALLBACK

  for (
    const assignment
    of liveAssignments
  ) {
    if (
      !assignment.course_assignment_id
    ) {
      continue;
    }

    const existing =
      gradebookBySource.get(
        componentSourceKey(
          "assignment",
          assignment.id
        )
      );

    if (existing) {
      continue;
    }

    ensureAssignment(
      assignment.course_assignment_id
    ).push({
      id:
        `assignment:${assignment.id}`,

      report_component_id:
        `assignment:${assignment.id}`,

      course_id:
        assignment.course_id,

      course_assignment_id:
        assignment.course_assignment_id,

      category:
        "assignment",

      name:
        assignment.title || "Assignment",

      max_marks:
        number(assignment.total_marks),

      source_type:
        "digital_assignment",

      source_id:
        assignment.id,

      approval_status:
        assignment.result_published
          ? "published"
          : assignment.status || "live",

      submitted_at:
        null,

      approved_at:
        null,

      created_at:
        assignment.created_at,

      data_source:
        "assignment_submission",

      schedule_item:
        scheduleByAssignment.get(
          assignment.id
        ) || {
          starts_at:
            assignment.available_from ||
            assignment.start_date,

          ends_at:
            assignment.due_date,

          conduct_starts_at:
            assignment.available_from ||
            assignment.start_date,

          conduct_ends_at:
            assignment.due_date,
        },
    });
  }

  // ----------------------------------------------------
  // SORT COMPONENTS
  // ----------------------------------------------------

  const categoryOrder = new Map(
    reportCategories.map(
      (category, index) => [
        category,
        index,
      ]
    )
  );

  for (
    const list
    of componentsByAssignment.values()
  ) {
    list.sort((a, b) => {
      const aTime = new Date(
        a.schedule_item?.conduct_starts_at ||
          a.schedule_item?.starts_at ||
          a.created_at ||
          0
      ).getTime();

      const bTime = new Date(
        b.schedule_item?.conduct_starts_at ||
          b.schedule_item?.starts_at ||
          b.created_at ||
          0
      ).getTime();

      if (
        Number.isFinite(aTime) &&
        Number.isFinite(bTime) &&
        aTime !== bTime
      ) {
        return aTime - bTime;
      }

      const categoryDiff =
        (categoryOrder.get(a.category) ?? 99) -
        (categoryOrder.get(b.category) ?? 99);

      if (categoryDiff) {
        return categoryDiff;
      }

      return String(
        a.name || ""
      ).localeCompare(
        String(b.name || "")
      );
    });
  }

  // ----------------------------------------------------
  // COURSE ROWS
  // ----------------------------------------------------

  const courseRows = courseAssignments
    .map((assignment) => {
      const courseComponents =
        componentsByAssignment.get(
          assignment.id
        ) || [];

      return {
        ...assignment,

        components:
          courseComponents,

        enrolled_student_count:
          new Set(
            enrollments
              .filter(
                (row) =>
                  row.course_assignment_id ===
                  assignment.id
              )
              .map(
                (row) =>
                  row.student_id
              )
          ).size,
      };
    })
    .sort((a, b) =>
      String(
        a.course?.name || ""
      ).localeCompare(
        String(
          b.course?.name || ""
        )
      )
    );

  // ----------------------------------------------------
  // STUDENT RESULTS
  // ----------------------------------------------------

  let recordedMarks = 0;
  let pendingMarks = 0;
  let gradebookRecorded = 0;
  let liveQuizRecorded = 0;
  let liveAssignmentRecorded = 0;

  const studentRows = students.map(
    (student) => {
      let studentObtained = 0;
      let studentRecordedMax = 0;
      let studentRecorded = 0;
      let studentPending = 0;

      const courses = courseRows
        .filter((assignment) =>
          enrollmentPairs.has(
            `${student.id}:${assignment.id}`
          )
        )
        .map((assignment) => {
          let obtained = 0;
          let recordedMax = 0;
          let possibleMax = 0;
          let recorded = 0;
          let pending = 0;

          const courseComponents =
            assignment.components.map(
              (component) => {
                const maxMarks = number(
                  component.max_marks
                );

                possibleMax += maxMarks;

                let marksObtained = null;
                let markUpdatedAt = null;
                let markSource = null;

                const isRealGradebookComponent =
                  !String(
                    component.id
                  ).startsWith("quiz:") &&
                  !String(
                    component.id
                  ).startsWith("assignment:");

                // 1. Gradebook marks

                if (
                  isRealGradebookComponent
                ) {
                  const official =
                    gradebookMarksMap.get(
                      `${student.id}:${component.id}`
                    );

                  // A NULL mark is pending, not zero.
                  if (
                    official &&
                    official.marks_obtained != null
                  ) {
                    marksObtained = number(
                      official.marks_obtained
                    );

                    markUpdatedAt =
                      official.updated_at;

                    markSource =
                      "gradebook";
                  }
                }

                // 2. Quiz submission fallback

                if (
                  marksObtained == null &&
                  component.category ===
                    "quiz" &&
                  component.source_id
                ) {
                  const live =
                    quizSubmissionMap.get(
                      `${student.id}:${component.source_id}`
                    );

                  if (
                    live &&
                    live.score != null
                  ) {
                    marksObtained = number(
                      live.score
                    );

                    markUpdatedAt =
                      live.submitted_at;

                    markSource =
                      "quiz_submission";
                  }
                }

                // 3. Assignment submission fallback

                if (
                  marksObtained == null &&
                  component.category ===
                    "assignment" &&
                  component.source_id
                ) {
                  const live =
                    assignmentSubmissionMap.get(
                      `${student.id}:${component.source_id}`
                    );

                  if (
                    live &&
                    live.marks_obtained != null
                  ) {
                    marksObtained = number(
                      live.marks_obtained
                    );

                    markUpdatedAt =
                      live.graded_at ||
                      live.submitted_at;

                    markSource =
                      "assignment_submission";
                  }
                }

                if (
                  marksObtained != null
                ) {
                  obtained +=
                    marksObtained;

                  recordedMax +=
                    maxMarks;

                  recorded += 1;
                  recordedMarks += 1;

                  if (
                    markSource ===
                    "gradebook"
                  ) {
                    gradebookRecorded +=
                      1;
                  }

                  if (
                    markSource ===
                    "quiz_submission"
                  ) {
                    liveQuizRecorded +=
                      1;
                  }

                  if (
                    markSource ===
                    "assignment_submission"
                  ) {
                    liveAssignmentRecorded +=
                      1;
                  }
                } else {
                  pending += 1;
                  pendingMarks += 1;
                }

                return {
                  id:
                    component.id,

                  report_component_id:
                    component.report_component_id ||
                    component.id,

                  name:
                    component.name,

                  category:
                    component.category,

                  max_marks:
                    maxMarks,

                  marks_obtained:
                    marksObtained,

                  approval_status:
                    component.approval_status,

                  submitted_at:
                    component.submitted_at,

                  approved_at:
                    component.approved_at,

                  created_at:
                    component.created_at,

                  source_type:
                    component.source_type,

                  source_id:
                    component.source_id,

                  data_source:
                    component.data_source,

                  mark_source:
                    markSource,

                  schedule_item:
                    component.schedule_item,

                  mark_updated_at:
                    markUpdatedAt,
                };
              }
            );

          studentObtained += obtained;
          studentRecordedMax += recordedMax;
          studentRecorded += recorded;
          studentPending += pending;

          return {
            course_assignment_id:
              assignment.id,

            course:
              assignment.course,

            teacher:
              assignment.teacher,

            components:
              courseComponents,

            obtained_marks:
              obtained,

            max_marks:
              recordedMax,

            possible_max_marks:
              possibleMax,

            percentage:
              recordedMax > 0
                ? Number(
                    (
                      (obtained /
                        recordedMax) *
                      100
                    ).toFixed(2)
                  )
                : null,

            recorded_count:
              recorded,

            pending_count:
              pending,
          };
        });

      return {
        student,

        courses,

        obtained_marks:
          studentObtained,

        max_marks:
          studentRecordedMax,

        percentage:
          studentRecordedMax > 0
            ? Number(
                (
                  (studentObtained /
                    studentRecordedMax) *
                  100
                ).toFixed(2)
              )
            : null,

        recorded_count:
          studentRecorded,

        pending_count:
          studentPending,
      };
    }
  );

  const allComponents =
    courseRows.flatMap(
      (course) =>
        course.components || []
    );

  return {
    generated_at:
      new Date().toISOString(),

    academic:
      scope.academic,

    courses:
      courseRows,

    students,

    rows:
      studentRows,

    summary: {
      student_count:
        students.length,

      course_count:
        courseRows.length,

      component_count:
        allComponents.length,

      recorded_marks:
        recordedMarks,

      pending_marks:
        pendingMarks,

      gradebook_marks:
        gradebookRecorded,

      live_quiz_marks:
        liveQuizRecorded,

      live_assignment_marks:
        liveAssignmentRecorded,
    },
  };
};

// ======================================================
// RESULTS REPORT ENDPOINT
// ======================================================

const resultsReport = handle(
  async (req, res) => {
    const scope =
      await reportScopeFromQuery(
        req.query
      );

    const courseAssignmentId =
      req.query.course_assignment_id
        ? uuid(
            req.query.course_assignment_id,
            "Course Assignment"
          )
        : null;

    const studentId =
      req.query.student_id
        ? uuid(
            req.query.student_id,
            "Student"
          )
        : null;

    const data =
      await buildResultsReport({
        scope,
        courseAssignmentId,
        studentId,
      });

    res.json({
      success: true,
      data,
    });
  }
);

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  getAll,
  getById,
  courseOptions,
  preview,
  create,
  update,
  publish,
  cancel,
  remove,
  reportOptions,
  resultsReport,
};