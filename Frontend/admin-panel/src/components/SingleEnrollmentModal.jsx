import { useEffect, useMemo, useState } from "react";

import Modal from "./Modal";
import FormField, { Alert, inputClass } from "./FormField";

import { getCourseAssignments } from "../services/courseAssignmentService";
import { getAllStudents } from "../services/studentService";
import { getAllCourses } from "../services/courseService";
import AcademicStructureService from "../services/AcademicStructureService";
import {
  mappedDepartmentsForBatch,
  mappedProgramsForBatch,
  mappedSemestersForBatchProgram,
} from "../utils/academicMappings";
import { createEnrollment } from "../services/enrollmentService";

// ======================================================
// HELPERS
// ======================================================

const sameId = (first, second) =>
  String(first || "") === String(second || "");

const unwrap = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.data)) return response.data.data;
  return [];
};

const batchLabel = (batch) =>
  batch?.start_year && batch?.end_year
    ? `${batch.start_year}–${batch.end_year}`
    : batch?.name || "Batch";

const activeOnly = (item) => item?.status !== "inactive";

const sortByName = (items = []) =>
  [...items].sort((first, second) =>
    String(first?.name || "").localeCompare(String(second?.name || ""))
  );

const sortSemesters = (items = []) =>
  [...items].sort(
    (first, second) =>
      Number(first?.semester_number || 0) -
      Number(second?.semester_number || 0)
  );

// ======================================================
// SINGLE ENROLLMENT
//
// Latest Academic Structure:
//
// Batch
//   ↓ academic_batch_programs
// Department
//   ↓
// Program
//   ↓
// Semester
//
// Course belongs to Department + Program.
// Student must belong to the same selected academic
// placement.
//
// IMPORTANT:
// Semester behavior is intentionally kept the same.
// The admin still selects the student's current Semester.
// We do not auto-force Batch current_semester_id.
// ======================================================

export default function SingleEnrollmentModal({
  open,
  onClose,
  onCreated,
}) {
  // ====================================================
  // MASTER DATA
  // ====================================================

  const [data, setData] = useState({
    assignments: [],
    courses: [],
    students: [],
    batches: [],
    batchPrograms: [],
    departments: [],
    programs: [],
    semesters: [],
  });

  // ====================================================
  // ACADEMIC PLACEMENT
  // ====================================================

  const [batchId, setBatchId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [programId, setProgramId] = useState("");
  const [semesterId, setSemesterId] = useState("");

  // ====================================================
  // STUDENT / COURSE
  // ====================================================

  const [studentId, setStudentId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [search, setSearch] = useState("");

  // ====================================================
  // ENROLLMENT TYPE
  // ====================================================

  const [type, setType] = useState("regular");
  const [supplySemesterId, setSupplySemesterId] = useState("");

  // ====================================================
  // UI STATE
  // ====================================================

  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // ====================================================
  // RESET
  // ====================================================

  const resetForm = () => {
    setBatchId("");
    setDepartmentId("");
    setProgramId("");
    setSemesterId("");
    setStudentId("");
    setCourseId("");
    setSearch("");
    setType("regular");
    setSupplySemesterId("");
    setError("");
  };

  // ====================================================
  // LOAD DATA
  // ====================================================

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;

    resetForm();
    setFetching(true);

    Promise.all([
      getCourseAssignments({ status: "active" }),
      getAllCourses(),
      getAllStudents(),
      AcademicStructureService.getBatches(),
      AcademicStructureService.getBatchPrograms(null, "active"),
      AcademicStructureService.getDepartments(),
      AcademicStructureService.getPrograms(),
      AcademicStructureService.getSemesters(),
    ])
      .then(
        ([
          assignmentResponse,
          courseResponse,
          studentResponse,
          batchResponse,
          batchProgramResponse,
          departmentResponse,
          programResponse,
          semesterResponse,
        ]) => {
          if (cancelled) return;

          const assignments = unwrap(assignmentResponse);
          const courses = unwrap(courseResponse);
          const students = unwrap(studentResponse);
          const batches = unwrap(batchResponse);
          const batchPrograms = unwrap(batchProgramResponse);
          const departments = unwrap(departmentResponse);
          const programs = unwrap(programResponse);
          const semesters = unwrap(semesterResponse);

          setData({
            assignments: assignments.filter(
              (item) => item?.status === "active"
            ),

            // Preserve the project's existing Course behavior.
            // Published Courses are available for enrollment.
            courses: courses.filter(
              (course) => course?.status === "published"
            ),

            students,

            batches: batches.filter(activeOnly),

            batchPrograms: batchPrograms.filter(activeOnly),

            departments: departments.filter(activeOnly),

            programs: programs.filter(activeOnly),

            semesters: semesters.filter(activeOnly),
          });
        }
      )
      .catch((err) => {
        if (cancelled) return;

        console.error("LOAD SINGLE ENROLLMENT OPTIONS ERROR:", err);

        setError(
          err?.response?.data?.message ||
            err?.message ||
            "Unable to load enrollment options"
        );
      })
      .finally(() => {
        if (!cancelled) setFetching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  // ====================================================
  // BATCH OPTIONS
  // ====================================================

  const batchOptions = useMemo(
    () =>
      [...data.batches].sort((first, second) => {
        const startDiff =
          Number(second?.start_year || 0) -
          Number(first?.start_year || 0);

        if (startDiff !== 0) return startDiff;

        return (
          Number(second?.end_year || 0) -
          Number(first?.end_year || 0)
        );
      }),
    [data.batches]
  );

  // ====================================================
  // LATEST BATCH MAPPING
  // ====================================================

  const departmentOptions = useMemo(
    () =>
      sortByName(
        mappedDepartmentsForBatch(
          data.departments,
          data.programs,
          data.batchPrograms,
          batchId
        )
      ),
    [
      data.departments,
      data.programs,
      data.batchPrograms,
      batchId,
    ]
  );

  const programOptions = useMemo(
    () =>
      sortByName(
        mappedProgramsForBatch(
          data.programs,
          data.batchPrograms,
          batchId,
          departmentId
        )
      ),
    [data.programs, data.batchPrograms, batchId, departmentId]
  );

  // Semester behavior intentionally preserved.
  // Only semesters belonging to the selected Program and
  // valid from the Batch mapping's entry semester onward
  // are shown.
  const semesterOptions = useMemo(
    () =>
      sortSemesters(
        mappedSemestersForBatchProgram(
          data.semesters,
          data.batchPrograms,
          batchId,
          programId
        )
      ),
    [data.semesters, data.batchPrograms, batchId, programId]
  );

  const selectedMapping = useMemo(() => {
    if (!batchId || !programId) return null;

    return (
      data.batchPrograms.find(
        (mapping) =>
          activeOnly(mapping) &&
          sameId(mapping.batch_id, batchId) &&
          sameId(mapping.program_id, programId)
      ) || null
    );
  }, [data.batchPrograms, batchId, programId]);

  // ====================================================
  // COURSES
  //
  // A Course must belong to the same Department + Program
  // as the selected student placement.
  // ====================================================

  const courseOptions = useMemo(() => {
    if (!departmentId || !programId) return [];

    return sortByName(
      data.courses.filter(
        (course) =>
          sameId(course.department_id, departmentId) &&
          sameId(course.program_id, programId)
      )
    );
  }, [data.courses, departmentId, programId]);

  const selectedCourse = useMemo(
    () => data.courses.find((course) => sameId(course.id, courseId)) || null,
    [data.courses, courseId]
  );

  // ====================================================
  // STUDENTS
  //
  // Student must match the selected Batch + Department +
  // Program + current Semester.
  // ====================================================

  const filteredStudents = useMemo(() => {
    if (!batchId || !departmentId || !programId || !semesterId) {
      return [];
    }

    const query = search.trim().toLowerCase();

    return data.students
      .filter((student) => {
        if (student?.is_active === false) return false;

        if (!sameId(student.batch_id, batchId)) return false;
        if (!sameId(student.department_id, departmentId)) return false;
        if (!sameId(student.program_id, programId)) return false;
        if (!sameId(student.semester_id, semesterId)) return false;

        if (!query) return true;

        return `${student.full_name || ""} ${student.email || ""} ${
          student.student_id || ""
        } ${student.roll_no || ""} ${student.cnic || ""}`
          .toLowerCase()
          .includes(query);
      })
      .sort((first, second) =>
        String(first?.full_name || "").localeCompare(
          String(second?.full_name || "")
        )
      );
  }, [
    data.students,
    batchId,
    departmentId,
    programId,
    semesterId,
    search,
  ]);

  // Clear stale Student if upstream filters change.
  useEffect(() => {
    if (
      studentId &&
      !filteredStudents.some((student) => sameId(student.id, studentId))
    ) {
      setStudentId("");
    }
  }, [filteredStudents, studentId]);

  // Clear stale Course if Program/Department changes.
  useEffect(() => {
    if (
      courseId &&
      !courseOptions.some((course) => sameId(course.id, courseId))
    ) {
      setCourseId("");
      setSupplySemesterId("");
    }
  }, [courseOptions, courseId]);

  // ====================================================
  // SUPPLY SEMESTERS
  //
  // Supply uses an original Course Assignment semester.
  // This does not change the student's current Semester.
  // ====================================================

  const supplySemesterOptions = useMemo(() => {
    if (!courseId || !batchId || !programId) return [];

    const validProgramSemesterIds = new Set(
      data.semesters
        .filter((semester) => sameId(semester.program_id, programId))
        .map((semester) => String(semester.id))
    );

    const assignmentSemesterIds = new Set(
      data.assignments
        .filter(
          (assignment) =>
            sameId(assignment.course_id, courseId) &&
            sameId(assignment.batch_id, batchId) &&
            assignment?.status === "active"
        )
        .map((assignment) => String(assignment.semester_id))
    );

    return sortSemesters(
      data.semesters.filter(
        (semester) =>
          validProgramSemesterIds.has(String(semester.id)) &&
          assignmentSemesterIds.has(String(semester.id))
      )
    );
  }, [
    data.assignments,
    data.semesters,
    courseId,
    batchId,
    programId,
  ]);

  // ====================================================
  // COURSE ASSIGNMENT RESOLUTION
  // ====================================================

  const targetSemesterId =
    type === "supply" ? supplySemesterId : semesterId;

  const assignment = useMemo(() => {
    if (!courseId || !batchId || !targetSemesterId) return null;

    return (
      data.assignments.find(
        (item) =>
          sameId(item.course_id, courseId) &&
          sameId(item.batch_id, batchId) &&
          sameId(item.semester_id, targetSemesterId) &&
          item?.status === "active"
      ) || null
    );
  }, [data.assignments, courseId, batchId, targetSemesterId]);

  // ====================================================
  // DEPENDENT RESET HANDLERS
  // ====================================================

  const handleBatchChange = (value) => {
    setBatchId(value);
    setDepartmentId("");
    setProgramId("");
    setSemesterId("");
    setStudentId("");
    setCourseId("");
    setSupplySemesterId("");
  };

  const handleDepartmentChange = (value) => {
    setDepartmentId(value);
    setProgramId("");
    setSemesterId("");
    setStudentId("");
    setCourseId("");
    setSupplySemesterId("");
  };

  const handleProgramChange = (value) => {
    setProgramId(value);
    setSemesterId("");
    setStudentId("");
    setCourseId("");
    setSupplySemesterId("");
  };

  const handleSemesterChange = (value) => {
    setSemesterId(value);
    setStudentId("");

    if (type === "regular") {
      setSupplySemesterId("");
    }
  };

  // ====================================================
  // VALIDATION / SUBMIT
  // ====================================================

  const submit = async (event) => {
    event.preventDefault();
    setError("");

    if (!batchId || !departmentId || !programId || !semesterId) {
      setError(
        "Select Batch, Department, Program and the student's current Semester."
      );
      return;
    }

    if (!selectedMapping) {
      setError(
        "The selected Program is not configured in this Batch. Please review Academic Structure."
      );
      return;
    }

    if (!studentId) {
      setError("Select a Student.");
      return;
    }

    if (!courseId) {
      setError("Select a Course.");
      return;
    }

    if (type === "supply" && !supplySemesterId) {
      setError("Select the original Semester for the Supply Course.");
      return;
    }

    if (!assignment) {
      setError(
        "No active Course Assignment exists for this Course + Batch + Semester. Create the Course Assignment first; teacher assignment can remain optional."
      );
      return;
    }

    setSaving(true);

    try {
      const response = await createEnrollment({
        student_id: studentId,
        course_assignment_id: assignment.id,
        enrollment_type: type,
        status: "active",
      });

      onCreated?.(response?.data?.data || response?.data);
      onClose();
    } catch (err) {
      console.error("CREATE ENROLLMENT ERROR:", err);

      setError(
        err?.response?.data?.message || err?.message || "Enrollment failed"
      );
    } finally {
      setSaving(false);
    }
  };

  // ====================================================
  // ASSIGNMENT MESSAGE
  // ====================================================

  const assignmentHint = useMemo(() => {
    if (!courseId || !batchId || !targetSemesterId) return "";

    if (!assignment) {
      return "No active Course Assignment exists for this Course + Batch + Semester. Schedule the course first; teacher can be assigned later.";
    }

    return `Scheduled: ${assignment.semester?.name || "Semester"} · Teacher: ${
      assignment.teacher?.full_name || "Unassigned (can be assigned later)"
    }`;
  }, [assignment, courseId, batchId, targetSemesterId]);

  // ====================================================
  // UI
  // ====================================================

  return (
    <Modal
      open={open}
      onClose={() => !saving && onClose()}
      title="Single Enrollment"
      subtitle="Select the student's Batch placement first, then enroll the student in a matching Course Assignment."
    >
      <form onSubmit={submit} className="space-y-5">
        <Alert message={error} />

        <fieldset
          disabled={fetching || saving}
          className="space-y-5"
        >
          {/* ===========================================
              1. ACADEMIC PLACEMENT
          =========================================== */}

          <section className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
            <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">
              1. Academic Placement
            </h3>

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Batch" required>
                <select
                  className={inputClass}
                  value={batchId}
                  onChange={(event) => handleBatchChange(event.target.value)}
                  required
                >
                  <option value="">
                    {fetching ? "Loading batches..." : "Select batch"}
                  </option>

                  {batchOptions.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {batchLabel(batch)}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Department" required>
                <select
                  className={inputClass}
                  value={departmentId}
                  onChange={(event) =>
                    handleDepartmentChange(event.target.value)
                  }
                  disabled={!batchId}
                  required
                >
                  <option value="">
                    {!batchId ? "Select batch first" : "Select department"}
                  </option>

                  {departmentOptions.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                      {department.code ? ` (${department.code})` : ""}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Program" required>
                <select
                  className={inputClass}
                  value={programId}
                  onChange={(event) => handleProgramChange(event.target.value)}
                  disabled={!departmentId}
                  required
                >
                  <option value="">
                    {!departmentId
                      ? "Select department first"
                      : "Select program"}
                  </option>

                  {programOptions.map((program) => (
                    <option key={program.id} value={program.id}>
                      {program.name}
                      {program.code ? ` (${program.code})` : ""}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField
                label="Current Semester"
                required
                hint="Semester behavior is unchanged; select the student's actual current Semester."
              >
                <select
                  className={inputClass}
                  value={semesterId}
                  onChange={(event) => handleSemesterChange(event.target.value)}
                  disabled={!programId}
                  required
                >
                  <option value="">
                    {!programId ? "Select program first" : "Select semester"}
                  </option>

                  {semesterOptions.map((semester) => (
                    <option key={semester.id} value={semester.id}>
                      {semester.name || `Semester ${semester.semester_number}`}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>

            {selectedMapping && (
              <div className="mt-3 grid gap-2 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-700 sm:grid-cols-3 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
                    Admission Type
                  </p>
                  <p className="mt-1 font-semibold capitalize">
                    {selectedMapping.admission_type || "regular"}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
                    Entry Semester
                  </p>
                  <p className="mt-1 font-semibold">
                    {selectedMapping.entry_semester?.name || "Not configured"}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
                    Batch Current Semester
                  </p>
                  <p className="mt-1 font-semibold">
                    {selectedMapping.current_semester?.name || "Not configured"}
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* ===========================================
              2. STUDENT
          =========================================== */}

          <section className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
            <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">
              2. Select Student
            </h3>

            <FormField label="Search Students">
              <input
                className={inputClass}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                disabled={!semesterId}
                placeholder="Name, Student ID, Roll No, CNIC or email"
              />
            </FormField>

            <FormField
              label="Student"
              required
              hint={
                semesterId
                  ? `${filteredStudents.length} matching active student${
                      filteredStudents.length === 1 ? "" : "s"
                    }`
                  : "Select the academic placement first."
              }
            >
              <select
                className={inputClass}
                value={studentId}
                onChange={(event) => setStudentId(event.target.value)}
                disabled={!semesterId}
                required
              >
                <option value="">
                  {!semesterId ? "Select semester first" : "Select student"}
                </option>

                {filteredStudents.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.full_name}
                    {" · "}
                    {student.roll_no ||
                      student.student_id ||
                      student.cnic ||
                      student.email ||
                      "No identifier"}
                  </option>
                ))}
              </select>
            </FormField>
          </section>

          {/* ===========================================
              3. COURSE / ENROLLMENT TYPE
          =========================================== */}

          <section className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
            <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">
              3. Course & Enrollment Type
            </h3>

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Course" required>
                <select
                  className={inputClass}
                  value={courseId}
                  onChange={(event) => {
                    setCourseId(event.target.value);
                    setSupplySemesterId("");
                  }}
                  disabled={!programId}
                  required
                >
                  <option value="">
                    {!programId ? "Select program first" : "Select course"}
                  </option>

                  {courseOptions.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.name}
                      {course.course_code ? ` (${course.course_code})` : ""}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Enrollment Type" required>
                <select
                  className={inputClass}
                  value={type}
                  onChange={(event) => {
                    setType(event.target.value);
                    setSupplySemesterId("");
                  }}
                >
                  <option value="regular">Regular</option>
                  <option value="supply">Supply</option>
                </select>
              </FormField>
            </div>

            {selectedCourse && (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Selected course: <strong>{selectedCourse.name}</strong>
              </p>
            )}

            {type === "supply" && (
              <div className="mt-3">
                <FormField
                  label="Supply Course Semester"
                  required
                  hint="This selects the original Course Assignment Semester and does not change the student's current Semester."
                >
                  <select
                    className={inputClass}
                    value={supplySemesterId}
                    onChange={(event) =>
                      setSupplySemesterId(event.target.value)
                    }
                    disabled={!courseId || !batchId}
                    required
                  >
                    <option value="">
                      Select original course semester
                    </option>

                    {supplySemesterOptions.map((semester) => (
                      <option key={semester.id} value={semester.id}>
                        {semester.name || `Semester ${semester.semester_number}`}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>
            )}

            {assignmentHint && (
              <p
                className={`mt-3 rounded-xl p-3 text-xs ${
                  assignment
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                    : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
                }`}
              >
                {assignmentHint}
              </p>
            )}
          </section>

          <button
            type="submit"
            disabled={!studentId || !courseId || !assignment || saving}
            className="h-11 w-full rounded-xl bg-blue-600 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Enrolling..." : "Create Enrollment"}
          </button>
        </fieldset>
      </form>
    </Modal>
  );
}
