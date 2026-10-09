const history = require("../models/history.model");
const { handle, httpError, uuid } = require("../utils/api");

const studentOverview = handle(async (req, res) => {
  const studentId = uuid(req.params.id, "Student");
  const data = await history.getStudentOverview(studentId);
  if (!data) throw httpError("Student not found", 404);
  res.json({ success: true, data });
});

const studentCourseHistory = handle(async (req, res) => {
  const studentId = uuid(req.params.id, "Student");
  const assignmentId = uuid(req.params.courseAssignmentId, "Course assignment");
  const data = await history.getStudentCourseHistory(studentId, assignmentId);
  if (!data) throw httpError("Student or Course Assignment not found", 404);
  res.json({ success: true, data });
});

const teacherHistory = handle(async (req, res) => {
  const teacherId = uuid(req.params.id, "Teacher");
  const data = await history.getTeacherHistory(teacherId);
  if (!data) throw httpError("Teacher not found", 404);
  res.json({ success: true, data });
});

const courseHistory = handle(async (req, res) => {
  const courseId = uuid(req.params.id, "Course");
  const data = await history.getCourseHistory(courseId);
  if (!data) throw httpError("Course not found", 404);
  res.json({ success: true, data });
});

const courseAssignmentHistory = handle(async (req, res) => {
  const assignmentId = uuid(req.params.id, "Course assignment");
  const data = await history.getCourseAssignmentHistory(assignmentId);
  if (!data) throw httpError("Course Assignment not found", 404);
  res.json({ success: true, data });
});

module.exports = {
  studentOverview,
  studentCourseHistory,
  teacherHistory,
  courseHistory,
  courseAssignmentHistory,
};
