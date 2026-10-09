const { supabaseAdmin } = require("../config/supabase");

const enrollmentModel = require("../models/enrollment.model");

const assignmentModel = require("../models/courseAssignment.model");

const {
  resolveAcademic,
} = require("../utils/academicRelations");

const {
  matchesIdentity,
} = require("../utils/catalogIdentity");

const {
  handle,
  httpError,
  uuid,
  ids,
} = require("../utils/api");

// ======================================================
// CONSTANTS
// ======================================================

const allowedStatuses = [
  "active",
  "inactive",
  "completed",
  "suspended",
  "expired",
];

const allowedTypes = [
  "regular",
  "supply",
];

const hasOwn = (object, key) =>
  Object.prototype.hasOwnProperty.call(
    object,
    key
  );

const sameId = (first, second) =>
  String(first || "") === String(second || "");

// ======================================================
// NORMALIZE ENROLLMENT METADATA
//
// Existing payload behavior is preserved.
// ======================================================

const metadata = (body, adminId) => {
  const progress =
    body.progress_percent === "" ||
    body.progress_percent == null
      ? 0
      : Number(body.progress_percent);

  if (
    !Number.isFinite(progress) ||
    progress < 0 ||
    progress > 100
  ) {
    throw httpError(
      "Progress must be between 0 and 100"
    );
  }

  const status =
    body.status || "active";

  if (!allowedStatuses.includes(status)) {
    throw httpError(
      "Invalid enrollment status"
    );
  }

  const enrollmentType =
    body.enrollment_type || "regular";

  if (!allowedTypes.includes(enrollmentType)) {
    throw httpError(
      "Enrollment type must be regular or supply"
    );
  }

  return {
    ...(hasOwn(body, "enrolled_at")
      ? {
          enrolled_at:
            body.enrolled_at || null,
        }
      : {}),

    ...(hasOwn(body, "access_start_date")
      ? {
          access_start_date:
            body.access_start_date || null,
        }
      : {}),

    status,

    enrollment_type:
      enrollmentType,

    enrolled_by:
      adminId ||
      body.enrolled_by ||
      null,

    access_expiry_date:
      hasOwn(body, "access_expiry_date")
        ? body.access_expiry_date || null
        : null,

    progress_percent:
      progress,

    completed_at:
      hasOwn(body, "completed_at")
        ? body.completed_at || null
        : null,
  };
};

// ======================================================
// VALIDATE COURSE ASSIGNMENT ACADEMIC CONTEXT
//
// Latest Academic Structure:
//
// Batch
//   ↓
// academic_batch_programs
//   ↓
// Program
//   ↓
// Semester
//
// Course Assignment stores:
// course_id, batch_id, semester_id, teacher_id
//
// The Program and Department are resolved from
// the selected Semester.
// ======================================================

const getEnrollmentAcademicContext = async (
  assignment
) => {
  if (!assignment) {
    throw httpError(
      "Course Assignment not found",
      404
    );
  }

  if (assignment.status !== "active") {
    throw httpError(
      "Select an active Course Assignment"
    );
  }

  if (
    !assignment.batch_id ||
    !assignment.semester_id ||
    !assignment.course_id
  ) {
    throw httpError(
      "Course Assignment has incomplete academic context"
    );
  }

  // ----------------------------------------------------
  // RESOLVE BATCH / PROGRAM / SEMESTER
  // ----------------------------------------------------

  const academic = await resolveAcademic({
    batch_id:
      assignment.batch_id,

    semester_id:
      assignment.semester_id,
  });

  // ----------------------------------------------------
  // CHECK BATCH-PROGRAM MAPPING
  // ----------------------------------------------------

  if (
    !academic.batchProgram ||
    academic.batchProgram.status !== "active"
  ) {
    throw httpError(
      "This Program is not active/configured in the selected Batch"
    );
  }

  // ----------------------------------------------------
  // CHECK REQUIRED ACADEMIC RECORDS
  // ----------------------------------------------------

  if (
    !academic.batch ||
    !academic.department ||
    !academic.program ||
    !academic.semester
  ) {
    throw httpError(
      "Course Assignment academic context is incomplete"
    );
  }

  // ----------------------------------------------------
  // CHECK ACTIVE ACADEMIC RECORDS
  // ----------------------------------------------------

  const academicRecords = [
    academic.batch,
    academic.department,
    academic.program,
    academic.semester,
  ];

  if (
    academicRecords.some(
      (item) =>
        item.status &&
        item.status !== "active"
    )
  ) {
    throw httpError(
      "Activate the linked Batch, Department, Program and Semester first"
    );
  }

  // ----------------------------------------------------
  // CHECK LINKED COURSE
  // ----------------------------------------------------

  if (!assignment.course) {
    throw httpError(
      "Course Assignment has no linked Course"
    );
  }

  // A generic Course must belong to the same logical
  // Department and Program as the selected Semester.

  if (
    !matchesIdentity(
      assignment.course,
      academic.department,
      academic.program
    )
  ) {
    throw httpError(
      "The Course does not belong to this Batch/Program academic context"
    );
  }

  return academic;
};

// ======================================================
// GET VALIDATED COURSE ASSIGNMENT
// ======================================================

const getAssignment = async (
  courseAssignmentId
) => {
  uuid(
    courseAssignmentId,
    "Course Assignment"
  );

  const assignment =
    await assignmentModel.getById(
      courseAssignmentId
    );

  const academic =
    await getEnrollmentAcademicContext(
      assignment
    );

  return {
    assignment,
    academic,
  };
};

// ======================================================
// GET STUDENTS
// ======================================================

const getStudents = async (studentIds) => {
  if (!studentIds.length) {
    return [];
  }

  const {
    data,
    error,
  } = await supabaseAdmin
    .from("profiles")
    .select(`
      id,
      full_name,
      role,
      is_active,
      batch_id,
      department_id,
      program_id,
      semester_id
    `)
    .in("id", studentIds)
    .eq("role", "student");

  if (error) {
    throw error;
  }

  return data || [];
};

// ======================================================
// VALIDATE STUDENT FOR ENROLLMENT
//
// Regular:
// Student must belong to assignment's current Semester.
//
// Supply:
// Previous Semester is allowed.
//
// Semester behavior is intentionally unchanged.
//
// New checks:
// Student Batch must match.
// Student Program must match.
// Student Department must match when configured.
// ======================================================

const validateStudentForEnrollment = (
  student,
  {
    batchId,
    departmentId,
    programId,
    semesterId,
    enrollmentType,
  }
) => {
  // ----------------------------------------------------
  // STUDENT EXISTS AND IS ACTIVE
  // ----------------------------------------------------

  if (
    !student ||
    !student.is_active
  ) {
    return "inactive_or_missing";
  }

  // ----------------------------------------------------
  // BATCH
  // ----------------------------------------------------

  if (
    !sameId(
      student.batch_id,
      batchId
    )
  ) {
    return "different_batch";
  }

  // ----------------------------------------------------
  // PROGRAM
  // ----------------------------------------------------

  if (
    !sameId(
      student.program_id,
      programId
    )
  ) {
    return "different_program";
  }

  // ----------------------------------------------------
  // DEPARTMENT
  // ----------------------------------------------------

  if (
    student.department_id &&
    !sameId(
      student.department_id,
      departmentId
    )
  ) {
    return "different_department";
  }

  // ----------------------------------------------------
  // CURRENT SEMESTER
  //
  // Existing behavior:
  // Only regular enrollment requires exact match.
  // ----------------------------------------------------

  if (
    enrollmentType === "regular" &&
    !sameId(
      student.semester_id,
      semesterId
    )
  ) {
    return "different_current_semester";
  }

  return null;
};

// ======================================================
// STUDENT VALIDATION MESSAGES
// ======================================================

const invalidStudentMessage = (reason) => {
  const messages = {
    inactive_or_missing:
      "Student was not found or is inactive.",

    different_batch:
      "Student belongs to a different Batch.",

    different_program:
      "Student's Program does not match this Course Assignment.",

    different_department:
      "Student's Department does not match this Course Assignment.",

    different_current_semester:
      "For a regular enrollment, the student must currently be in the selected Semester. Use Supply for a previous-semester Course.",
  };

  return (
    messages[reason] ||
    "Student's academic placement is not valid for this Course Assignment."
  );
};

// ======================================================
// CREATE SINGLE ENROLLMENT
// ======================================================

const createEnrollment = handle(
  async (req, res) => {
    const studentId = uuid(
      req.body.student_id,
      "Student"
    );

    // --------------------------------------------------
    // GET COURSE ASSIGNMENT + ACADEMIC CONTEXT
    // --------------------------------------------------

    const {
      assignment,
      academic,
    } = await getAssignment(
      req.body.course_assignment_id
    );

    // --------------------------------------------------
    // GET STUDENT
    // --------------------------------------------------

    const [student] = await getStudents([
      studentId,
    ]);

    const enrollmentType =
      req.body.enrollment_type ||
      "regular";

    if (
      !allowedTypes.includes(
        enrollmentType
      )
    ) {
      throw httpError(
        "Enrollment type must be regular or supply"
      );
    }

    // --------------------------------------------------
    // VALIDATE STUDENT'S ACADEMIC PLACEMENT
    // --------------------------------------------------

    const reason =
      validateStudentForEnrollment(
        student,
        {
          batchId:
            assignment.batch_id,

          departmentId:
            academic.department.id,

          programId:
            academic.program.id,

          semesterId:
            assignment.semester_id,

          enrollmentType,
        }
      );

    if (reason) {
      throw httpError(
        invalidStudentMessage(reason)
      );
    }

    // --------------------------------------------------
    // PREPARE PAYLOAD
    // --------------------------------------------------

    const payload = {
      ...metadata(
        req.body,
        req.admin.id
      ),

      student_id:
        studentId,

      course_id:
        assignment.course_id,

      course_assignment_id:
        assignment.id,

      batch_id:
        assignment.batch_id,

      semester_id:
        assignment.semester_id,
    };

    // --------------------------------------------------
    // CREATE
    // --------------------------------------------------

    const data =
      await enrollmentModel.createEnrollment(
        payload
      );

    res.status(201).json({
      success: true,

      message:
        "Student enrolled successfully",

      data,
    });
  }
);

// ======================================================
// BULK ENROLLMENT
// ======================================================

const bulkEnrollStudents = handle(
  async (req, res) => {
    // --------------------------------------------------
    // INPUTS
    // --------------------------------------------------

    const studentIds = ids(
      req.body.student_ids,
      "student IDs"
    );

    const courseIds = ids(
      req.body.course_ids,
      "course IDs"
    );

    const batchId = uuid(
      req.body.batch_id,
      "Batch"
    );

    const semesterId = uuid(
      req.body.semester_id,
      "Semester"
    );

    const enrollmentType =
      req.body.enrollment_type ||
      "regular";

    if (
      !allowedTypes.includes(
        enrollmentType
      )
    ) {
      throw httpError(
        "Enrollment type must be regular or supply"
      );
    }

    // --------------------------------------------------
    // GET ACTIVE COURSE ASSIGNMENTS
    // --------------------------------------------------

    const assignments =
      await assignmentModel.getAll({
        batch_id:
          batchId,

        semester_id:
          semesterId,

        status:
          "active",
      });

    // --------------------------------------------------
    // MATCH REQUESTED COURSES
    // --------------------------------------------------

    const assignmentByCourse = new Map(
      assignments
        .filter((assignment) =>
          courseIds.includes(
            assignment.course_id
          )
        )
        .map((assignment) => [
          assignment.course_id,
          assignment,
        ])
    );

    const missingCourseAssignments =
      courseIds.filter(
        (courseId) =>
          !assignmentByCourse.has(
            courseId
          )
      );

    const usableAssignments =
      courseIds
        .map((courseId) =>
          assignmentByCourse.get(
            courseId
          )
        )
        .filter(Boolean);

    const usableAssignmentIds =
      usableAssignments.map(
        (assignment) =>
          assignment.id
      );

    // --------------------------------------------------
    // VALIDATE LATEST BATCH-PROGRAM RELATION
    //
    // One Batch + Semester resolves to one Program.
    // Every selected Course must match that Program.
    // --------------------------------------------------

    let academic = null;

    if (usableAssignments.length) {
      academic =
        await getEnrollmentAcademicContext(
          usableAssignments[0]
        );

      for (
        const assignment of usableAssignments.slice(
          1
        )
      ) {
        const validContext =
          sameId(
            assignment.batch_id,
            batchId
          ) &&
          sameId(
            assignment.semester_id,
            semesterId
          ) &&
          Boolean(
            assignment.course
          ) &&
          matchesIdentity(
            assignment.course,
            academic.department,
            academic.program
          );

        if (!validContext) {
          throw httpError(
            "Selected Courses are not all assigned to the same Batch/Program/Semester"
          );
        }
      }
    }

    // --------------------------------------------------
    // GET STUDENTS
    // --------------------------------------------------

    const students =
      await getStudents(
        studentIds
      );

    const studentById = new Map(
      students.map((student) => [
        student.id,
        student,
      ])
    );

    const invalidStudents = [];

    const validStudents = [];

    // --------------------------------------------------
    // VALIDATE EACH STUDENT
    // --------------------------------------------------

    for (
      const studentId of studentIds
    ) {
      const student =
        studentById.get(
          studentId
        );

      let reason = null;

      if (academic) {
        reason =
          validateStudentForEnrollment(
            student,
            {
              batchId,

              departmentId:
                academic.department.id,

              programId:
                academic.program.id,

              semesterId,

              enrollmentType,
            }
          );
      } else {
        // No matching Course Assignment exists.
        // Preserve the existing invalid-student
        // reporting behavior.

        if (
          !student ||
          !student.is_active
        ) {
          reason =
            "inactive_or_missing";
        } else if (
          !sameId(
            student.batch_id,
            batchId
          )
        ) {
          reason =
            "different_batch";
        } else if (
          enrollmentType === "regular" &&
          !sameId(
            student.semester_id,
            semesterId
          )
        ) {
          reason =
            "different_current_semester";
        }
      }

      if (reason) {
        invalidStudents.push({
          student_id:
            studentId,

          reason,
        });
      } else {
        validStudents.push(
          student
        );
      }
    }

    // --------------------------------------------------
    // CHECK EXISTING ACTIVE ENROLLMENTS
    // --------------------------------------------------

    let existingRows = [];

    if (
      usableAssignmentIds.length &&
      validStudents.length
    ) {
      const {
        data,
        error,
      } = await supabaseAdmin
        .from("enrollments")
        .select(`
          student_id,
          course_assignment_id
        `)
        .in(
          "course_assignment_id",
          usableAssignmentIds
        )
        .in(
          "student_id",
          validStudents.map(
            (student) =>
              student.id
          )
        )
        .eq(
          "status",
          "active"
        );

      if (error) {
        throw error;
      }

      existingRows =
        data || [];
    }

    const existingKeys = new Set(
      existingRows.map(
        (row) =>
          `${row.student_id}:${row.course_assignment_id}`
      )
    );

    // --------------------------------------------------
    // METADATA
    // --------------------------------------------------

    const meta = metadata(
      {
        ...req.body,

        enrollment_type:
          enrollmentType,
      },
      req.admin.id
    );

    // --------------------------------------------------
    // BUILD ENROLLMENT PAYLOADS
    // --------------------------------------------------

    const payloads = [];

    const skippedExisting = [];

    for (
      const student of validStudents
    ) {
      for (
        const assignment of usableAssignments
      ) {
        const key =
          `${student.id}:${assignment.id}`;

        if (
          existingKeys.has(
            key
          )
        ) {
          skippedExisting.push({
            student_id:
              student.id,

            course_id:
              assignment.course_id,

            course_assignment_id:
              assignment.id,
          });

          continue;
        }

        payloads.push({
          ...meta,

          student_id:
            student.id,

          course_id:
            assignment.course_id,

          course_assignment_id:
            assignment.id,

          batch_id:
            assignment.batch_id,

          semester_id:
            assignment.semester_id,
        });
      }
    }

    // --------------------------------------------------
    // INSERT
    // --------------------------------------------------

    const enrollments =
      await enrollmentModel.createBulkEnrollments(
        payloads
      );

    // --------------------------------------------------
    // RESPONSE
    // --------------------------------------------------

    res.status(201).json({
      success: true,

      message:
        payloads.length
          ? "Bulk enrollment completed"
          : "Bulk enrollment completed with no new rows",

      data: {
        inserted:
          enrollments.length,

        skipped_existing:
          skippedExisting.length,

        invalid_students:
          invalidStudents.length,

        missing_course_assignments:
          missingCourseAssignments.length,

        enrollments,

        skipped_existing_rows:
          skippedExisting,

        invalid_student_rows:
          invalidStudents,

        missing_course_assignment_course_ids:
          missingCourseAssignments,
      },
    });
  }
);

// ======================================================
// GET ALL ENROLLMENTS
// ======================================================

const getAllEnrollments = handle(
  async (_req, res) => {
    res.json({
      success: true,

      data:
        await enrollmentModel.getAllEnrollments(),
    });
  }
);

// ======================================================
// GET STUDENT ENROLLMENTS
// ======================================================

const getStudentEnrollments = handle(
  async (req, res) => {
    uuid(
      req.params.student_id,
      "Student"
    );

    res.json({
      success: true,

      data:
        await enrollmentModel.getStudentEnrollments(
          req.params.student_id,
          {
            history:
              req.query.history ===
              "true",
          }
        ),
    });
  }
);

// ======================================================
// GET COURSE ENROLLMENTS
// ======================================================

const getCourseEnrollments = handle(
  async (req, res) => {
    uuid(
      req.params.course_id,
      "Course"
    );

    if (
      req.query.course_assignment_id
    ) {
      uuid(
        req.query.course_assignment_id,
        "Course Assignment"
      );
    }

    res.json({
      success: true,

      data:
        await enrollmentModel.getCourseEnrollments(
          req.params.course_id,
          req.query.course_assignment_id
        ),
    });
  }
);

// ======================================================
// UPDATE ENROLLMENT
//
// Student, Course and Academic context remain immutable.
// ======================================================

const updateEnrollment = handle(
  async (req, res) => {
    uuid(
      req.params.id,
      "Enrollment"
    );

    const existing =
      await enrollmentModel.getById(
        req.params.id
      );

    if (!existing) {
      throw httpError(
        "Enrollment not found",
        404
      );
    }

    // Progress is derived automatically from academic activity.
    // Admins must not overwrite it manually from the enrollment editor/API.
    if (hasOwn(req.body, "progress_percent")) {
      throw httpError(
        "Enrollment progress is calculated automatically and cannot be edited manually"
      );
    }

    // --------------------------------------------------
    // PREVENT ACADEMIC CONTEXT CHANGES
    // --------------------------------------------------

    for (
      const key of [
        "student_id",
        "course_id",
        "batch_id",
        "semester_id",
        "course_assignment_id",
      ]
    ) {
      if (
        req.body[key] !== undefined &&
        !sameId(
          req.body[key],
          existing[key]
        )
      ) {
        throw httpError(
          "Student, Course and Course Assignment cannot be changed. Create a separate enrollment instead."
        );
      }
    }

    // --------------------------------------------------
    // STATUS / TYPE
    // --------------------------------------------------

    const nextStatus =
      req.body.status ??
      existing.status ??
      "active";

    const nextType =
      req.body.enrollment_type ??
      existing.enrollment_type ??
      "regular";

    if (
      !allowedStatuses.includes(
        nextStatus
      )
    ) {
      throw httpError(
        "Invalid enrollment status"
      );
    }

    if (
      !allowedTypes.includes(
        nextType
      )
    ) {
      throw httpError(
        "Enrollment type must be regular or supply"
      );
    }

    // --------------------------------------------------
    // REACTIVATION VALIDATION
    // --------------------------------------------------

    if (
      nextStatus === "active"
    ) {
      const {
        assignment,
        academic,
      } = await getAssignment(
        existing.course_assignment_id
      );

      const [student] =
        await getStudents([
          existing.student_id,
        ]);

      const reason =
        validateStudentForEnrollment(
          student,
          {
            batchId:
              assignment.batch_id,

            departmentId:
              academic.department.id,

            programId:
              academic.program.id,

            semesterId:
              assignment.semester_id,

            enrollmentType:
              nextType,
          }
        );

      if (reason) {
        throw httpError(
          reason ===
            "different_current_semester"
            ? "This Regular enrollment belongs to a previous semester. Change it to Supply or keep it Completed."
            : invalidStudentMessage(
                reason
              )
        );
      }
    }

    // --------------------------------------------------
    // COMPLETION
    // --------------------------------------------------

    const now =
      new Date().toISOString();

    const completedAt =
      nextStatus === "completed"
        ? existing.completed_at ||
          req.body.completed_at ||
          now
        : null;

    // --------------------------------------------------
    // UPDATE
    // --------------------------------------------------

    const payload = {
      ...metadata(
        {
          ...existing,
          ...req.body,

          status:
            nextStatus,

          enrollment_type:
            nextType,

          completed_at:
            completedAt,
        },
        existing.enrolled_by
      ),

      updated_at:
        now,
    };

    await enrollmentModel.updateEnrollment(
      existing.id,
      payload
    );

    // Fetch again to receive any trigger-updated values.

    const data =
      await enrollmentModel.getById(
        existing.id
      );

    res.json({
      success: true,

      message:
        nextStatus === "completed"
          ? "Enrollment completed successfully"
          : "Enrollment updated successfully",

      data,
    });
  }
);

// ======================================================
// HARD DELETE ENROLLMENT
// ======================================================

const deleteEnrollment = handle(
  async (req, res) => {
    uuid(
      req.params.id,
      "Enrollment"
    );

    const existing =
      await enrollmentModel.getById(
        req.params.id
      );

    if (!existing) {
      throw httpError(
        "Enrollment not found",
        404
      );
    }

    await enrollmentModel.deleteEnrollment(
      req.params.id
    );

    res.json({
      success: true,

      message:
        "Enrollment permanently deleted. Use Inactive/Completed status when history must be retained.",
    });
  }
);

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  createEnrollment,
  bulkEnrollStudents,
  getAllEnrollments,
  getStudentEnrollments,
  getCourseEnrollments,
  updateEnrollment,
  deleteEnrollment,
};