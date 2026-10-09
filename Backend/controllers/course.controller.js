const { supabaseAdmin } = require("../config/supabase");
const courseModel = require("../models/course.model");
const { resolveAcademic } = require("../utils/academicRelations");
const {
  normalizeCode,
  matchesIdentity,
} = require("../utils/catalogIdentity");
const { handle, httpError, uuid } = require("../utils/api");

// ======================================================
// HELPERS
// ======================================================

const uniqueIds = (values = []) => [
  ...new Set(
    values
      .map((value) => String(value || "").trim())
      .filter(Boolean)
  ),
];

const requestedProgramIds = (body = {}) => {
  if (Array.isArray(body.program_ids)) {
    return uniqueIds(body.program_ids);
  }

  if (body.program_id) {
    return uniqueIds([body.program_id]);
  }

  return [];
};

const payloadFor = async (
  body,
  existing = {},
  programIdOverride = null
) => {
  const value = { ...existing, ...body };
  const programId = programIdOverride || value.program_id;

  if (
    typeof value.name !== "string" ||
    !value.name.trim()
  ) {
    throw httpError("Course name is required");
  }

  if (!value.department_id || !programId) {
    throw httpError(
      "Department and program are required"
    );
  }

  const academic = await resolveAcademic({
    department_id: value.department_id,
    program_id: programId,
  });

  if (!academic.department || !academic.program) {
    throw httpError(
      "Invalid academic Department/Program"
    );
  }

  if (
    (academic.department.status &&
      academic.department.status !== "active") ||
    (academic.program.status &&
      academic.program.status !== "active")
  ) {
    throw httpError(
      "Select an active Department and Program"
    );
  }

  const payload = {
    name: value.name.trim(),
    department_id: academic.department_id,
    program_id: academic.program_id,
    department: academic.department.name,
    program: academic.program.name,

    // Keep the existing Course schema exactly as-is.
    // Each selected Program receives its own normal Course row,
    // so Teacher/Student apps can continue using courses.program_id.
    catalog_department_code:
      normalizeCode(academic.department.code) || null,
    catalog_program_code:
      normalizeCode(academic.program.code) || null,

    status: value.status || "published",
  };

  if (
    !["published", "draft", "archived"].includes(
      payload.status
    )
  ) {
    throw httpError("Invalid course status");
  }

  for (const key of [
    "course_code",
    "description",
    "thumbnail_url",
    "level",
  ]) {
    if (
      value[key] != null &&
      typeof value[key] !== "string"
    ) {
      throw httpError(`${key} must be text`);
    }

    payload[key] =
      value[key]?.trim() ||
      (key === "description" ? "" : null);
  }

  // Generic Course: no Start Date / End Date payload.
  for (const key of ["credits", "duration_weeks"]) {
    const number =
      value[key] === "" || value[key] == null
        ? null
        : Number(value[key]);

    if (
      number !== null &&
      (!Number.isFinite(number) ||
        number < 0 ||
        (key === "duration_weeks" &&
          !Number.isInteger(number)))
    ) {
      throw httpError(`Invalid ${key}`);
    }

    payload[key] = number;
  }

  return payload;
};

// ======================================================
// CREATE COURSE
//
// Backward compatible:
// - Old callers can still send program_id.
// - Admin Add Course can send program_ids: [id1, id2, ...].
// - No new database table is required.
// - One normal courses row is created per selected Program.
// ======================================================

const createCourse = handle(async (req, res) => {
  const programIds = requestedProgramIds(req.body);

  if (!req.body?.department_id) {
    throw httpError("Department is required");
  }

  if (programIds.length === 0) {
    throw httpError("Select at least one Program");
  }

  // Validate every Program before inserting anything.
  // This avoids partially creating rows because of a bad Program selection.
  const payloads = [];

  for (const programId of programIds) {
    payloads.push(
      await payloadFor(req.body, {}, programId)
    );
  }

  // Old single-program API behavior remains unchanged.
  if (
    !Array.isArray(req.body.program_ids) &&
    payloads.length === 1
  ) {
    const data = await courseModel.createCourse(
      payloads[0]
    );

    return res.status(201).json({
      success: true,
      message: "Course created successfully",
      data,
    });
  }

  const created = [];

  try {
    for (const payload of payloads) {
      const course =
        await courseModel.createCourse(payload);

      created.push(course);
    }
  } catch (error) {
    // These rows have just been created and have no Course Assignment /
    // Enrollment data yet, so a best-effort rollback is safe.
    for (const course of [...created].reverse()) {
      try {
        await courseModel.deleteCourse(course.id);
      } catch (rollbackError) {
        console.error(
          "Course multi-create rollback error:",
          rollbackError
        );
      }
    }

    throw error;
  }

  return res.status(201).json({
    success: true,
    message:
      created.length === 1
        ? "Course created successfully"
        : `Course created successfully for ${created.length} Programs`,
    count: created.length,
    data: created,
  });
});

// ======================================================
// GET ALL COURSES
// ======================================================

const getAllCourses = handle(async (req, res) => {
  let data = await courseModel.getAllCourses();

  if (req.query.program_id) {
    const academic = await resolveAcademic({
      department_id: req.query.department_id,
      program_id: req.query.program_id,
    });

    data = data.filter((course) =>
      matchesIdentity(
        course,
        academic.department,
        academic.program
      )
    );
  } else if (req.query.department_id) {
    const academic = await resolveAcademic({
      department_id: req.query.department_id,
    });

    const code = normalizeCode(
      academic.department.code
    );

    data = data.filter((course) =>
      code &&
      normalizeCode(
        course.catalog_department_code ||
          course.linked_department?.code
      )
        ? normalizeCode(
            course.catalog_department_code ||
              course.linked_department?.code
          ) === code
        : course.department_id ===
          academic.department_id
    );
  }

  res.json({ success: true, data });
});

// ======================================================
// GET COURSE
// ======================================================

const getCourseById = handle(async (req, res) => {
  uuid(req.params.id);

  const data = await courseModel.getCourseById(
    req.params.id
  );

  if (!data) {
    throw httpError("Course not found", 404);
  }

  res.json({ success: true, data });
});

// ======================================================
// UPDATE COURSE
//
// Intentionally remains single-row/single-program.
// Existing Teacher/Student app compatibility is preserved.
// ======================================================

const updateCourse = handle(async (req, res) => {
  uuid(req.params.id);

  const existing = await courseModel.getCourseById(
    req.params.id
  );

  if (!existing) {
    throw httpError("Course not found", 404);
  }

  const data = await courseModel.updateCourse({
    id: existing.id,
    ...(await payloadFor(req.body, existing)),
  });

  // Course status is independent from Enrollment lifecycle.
  // Archived/Draft courses are hidden from current app access by access queries/views,
  // but historical enrollments and completed results are never rewritten.
  if (data.status !== existing.status) {
    const { error: blockError } =
      await supabaseAdmin.rpc(
        "set_course_assignment_course_block",
        {
          p_course_id: existing.id,
          p_block: data.status !== "published",
        }
      );

    if (blockError) {
      throw blockError;
    }
  }

  res.json({
    success: true,
    message:
      data.status === "published"
        ? "Course activated successfully"
        : data.status === "archived"
          ? "Course deactivated successfully"
          : "Course updated successfully",
    data,
  });
});

// ======================================================
// DELETE COURSE
// ======================================================

const deleteCourse = handle(async (req, res) => {
  uuid(req.params.id);

  try {
    await courseModel.deleteCourse(req.params.id);
  } catch (error) {
    if (error?.code === "23503") {
      throw httpError(
        "Course has linked data and cannot be hard-deleted until RUN_THIS_FINAL_005_SQL.sql is applied.",
        409
      );
    }

    throw error;
  }

  res.json({
    success: true,
    message:
      "Course and its linked Course Assignments/teaching data were permanently deleted.",
  });
});

module.exports = {
  createCourse,
  getAllCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
};
