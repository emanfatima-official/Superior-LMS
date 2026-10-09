const assignments = require("../models/courseAssignment.model");
const courses = require("../models/course.model");
const teachers = require("../models/teacher.model");
const { resolveAcademic } = require("../utils/academicRelations");
const { matchesIdentity } = require("../utils/catalogIdentity");
const { handle, httpError, uuid } = require("../utils/api");

const allowedStatuses = ["active", "completed", "inactive"];

const getActiveTeacher = async (id, { optional = false } = {}) => {
  if (!id) {
    if (optional) return null;
    throw httpError("Teacher is required");
  }

  uuid(id, "Teacher");
  const teacher = await teachers.getTeacherById(id);
  if (!teacher || teacher.role !== "teacher") throw httpError("Teacher not found", 404);
  if (!teacher.is_active) throw httpError("Select an active teacher");
  return teacher;
};

const assignmentById = async (id) => {
  uuid(id, "Course assignment");
  const data = await assignments.getById(id);
  if (!data) throw httpError("Course assignment not found", 404);
  return data;
};

const getAll = handle(async (req, res) => {
  for (const key of ["course_id", "batch_id", "semester_id", "teacher_id"]) {
    if (req.query[key]) uuid(req.query[key], key);
  }
  if (req.query.status && !allowedStatuses.includes(req.query.status)) {
    throw httpError("Invalid assignment status");
  }
  res.json({ success: true, data: await assignments.getAll(req.query) });
});

const getById = handle(async (req, res) => {
  res.json({ success: true, data: await assignmentById(req.params.id) });
});

const create = handle(async (req, res) => {
  const { course_id, batch_id, semester_id } = req.body;
  const teacherId = req.body.teacher_id || null;

  uuid(course_id, "Course");
  uuid(batch_id, "Batch");
  uuid(semester_id, "Semester");

  // IMPORTANT: Course + Batch + Semester is the semester teaching context.
  // Teacher is optional and can be assigned later without changing this row.
  const [course, academic, teacher] = await Promise.all([
    courses.getCourseById(course_id),
    resolveAcademic({ batch_id, semester_id }),
    getActiveTeacher(teacherId, { optional: true }),
  ]);

  if (!course) throw httpError("Course not found", 404);
  if (course.status !== "published") throw httpError("Only active/published courses can be scheduled");
  if (!academic.batch || !academic.department || !academic.program || !academic.semester) {
    throw httpError("Selected academic context is incomplete");
  }

  for (const item of [academic.batch, academic.department, academic.program, academic.semester]) {
    if (item.status && item.status !== "active") {
      throw httpError("Select an active Batch, Department, Program and Semester");
    }
  }

  if (!matchesIdentity(course, academic.department, academic.program)) {
    throw httpError(
      "The selected semester does not belong to the same logical Department/Program as this generic course."
    );
  }

  const existing = await assignments.getAll({ course_id, batch_id, semester_id });
  if (existing.length) {
    throw httpError(
      "This course is already scheduled for the selected Batch and Semester. Open the existing Course Assignment to assign/change its teacher.",
      409
    );
  }

  const status = req.body.status || "active";
  if (!allowedStatuses.includes(status)) throw httpError("Invalid assignment status");

  const data = await assignments.create({
    course_id: course.id,
    batch_id: academic.batch.id,
    semester_id: academic.semester.id,
    teacher_id: teacher?.id || null,
    lifecycle_status: status,
    status,
  });

  res.status(201).json({
    success: true,
    message: teacher
      ? "Course scheduled and teacher assigned successfully"
      : "Course scheduled for the selected Batch/Semester. A teacher can be assigned later.",
    data,
  });
});

const update = handle(async (req, res) => {
  const existing = await assignmentById(req.params.id);

  // Course/Batch/Semester define this immutable teaching context.
  for (const key of ["course_id", "batch_id", "semester_id"]) {
    if (req.body[key] !== undefined && req.body[key] !== existing[key]) {
      throw httpError(
        "Course Assignment context is fixed. Create a new assignment for another Course, Batch or Semester."
      );
    }
  }

  if (req.body.teacher_id !== undefined && req.body.teacher_id !== existing.teacher_id) {
    throw httpError("Use Assign/Change Teacher for teacher changes");
  }

  const status = req.body.status;
  if (!allowedStatuses.includes(status)) throw httpError("Select a valid assignment status");

  if ((existing.academic_blocked || existing.course_blocked) && status !== existing.status) {
    throw httpError(
      existing.academic_blocked
        ? "This Course Assignment is blocked by an inactive academic parent. Activate the Batch/Department/Program/Semester first."
        : "This Course Assignment is blocked by an inactive Course. Activate the Course first."
    );
  }

  const data = await assignments.update(
    existing.id,
    { lifecycle_status: status, status },
    req.body.expected_updated_at
  );
  if (!data) throw httpError("Assignment changed. Refresh before editing again.", 409);

  res.json({ success: true, message: "Course Assignment updated", data });
});

const replaceTeacher = handle(async (req, res) => {
  const existing = await assignmentById(req.params.id);
  const requestedTeacherId = req.body.teacher_id || null;
  const newTeacher = requestedTeacherId
    ? await getActiveTeacher(requestedTeacherId)
    : null;

  if ((newTeacher?.id || null) === (existing.teacher_id || null)) {
    throw httpError(newTeacher ? "This teacher is already assigned to the course" : "This Course Assignment is already unassigned");
  }

  for (const key of ["course_id", "batch_id", "semester_id"]) {
    if (req.body[key] !== undefined && req.body[key] !== existing[key]) {
      throw httpError("Teacher change cannot change Course Assignment context");
    }
  }

  const data = await assignments.update(
    existing.id,
    { teacher_id: newTeacher?.id || null },
    req.body.expected_updated_at
  );
  if (!data) throw httpError("Assignment changed. Refresh before changing the teacher.", 409);

  res.json({
    success: true,
    message: newTeacher
      ? "Teacher assigned successfully. Previous teacher history and course work remain retained."
      : "Teacher unassigned successfully. The Batch/Semester course plan and all historical data remain retained.",
    data,
  });
});

const remove = handle(async (req, res) => {
  const existing = await assignmentById(req.params.id);
  const counts = await assignments.getDependencyCounts(existing.id);

  try {
    await assignments.deleteById(existing.id);
  } catch (error) {
    if (error?.code === "23503") {
      throw httpError(
        "Course Assignment has linked data and the database hard-delete migration is not applied. Run RUN_THIS_FINAL_005_SQL.sql first.",
        409
      );
    }
    throw error;
  }

  res.json({
    success: true,
    message: "Course Assignment and its linked teaching-context data were permanently deleted.",
    deleted: true,
    dependencies: counts,
  });
});

const teacherHistory = handle(async (req, res) => {
  const existing = await assignmentById(req.params.id);
  res.json({ success: true, data: await assignments.getHistory(existing.id) });
});

const teacherOptions = handle(async (_req, res) => {
  res.json({ success: true, data: await assignments.getTeacherOptions() });
});

module.exports = {
  getAll,
  getById,
  create,
  update,
  replaceTeacher,
  teacherHistory,
  teacherOptions,
  remove,
};
