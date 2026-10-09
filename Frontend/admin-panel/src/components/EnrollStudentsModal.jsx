import { useEffect, useMemo, useState } from "react";
import Modal from "./Modal";
import FormField, { Alert, inputClass } from "./FormField";
import AcademicStructureService from "../services/AcademicStructureService";
import {
  mappedDepartmentsForBatch,
  mappedProgramsForBatch,
  mappedSemestersForBatchProgram,
} from "../utils/academicMappings";
import { getAllCourses } from "../services/courseService";
import { getAllStudents } from "../services/studentService";
import { bulkEnrollStudents } from "../services/enrollmentService";

const sameId = (a, b) => String(a || "") === String(b || "");

const batchLabel = (batch) =>
  batch?.start_year && batch?.end_year
    ? `${batch.start_year}–${batch.end_year}`
    : batch?.name || "Batch";

const initialFilters = {
  batch_id: "",
  department_id: "",
  program_id: "",
  current_semester_id: "",
  target_semester_id: "",
  status: "active",
  enrollment_type: "regular",
};

const unwrap = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.data)) return response.data.data;
  return [];
};

export default function EnrollStudentsModal({
  open,
  onClose,
  onCreated,
}) {
  const [data, setData] = useState({
    courses: [],
    students: [],
    batches: [],
    batchPrograms: [],
    departments: [],
    programs: [],
    semesters: [],
  });

  const [filters, setFilters] = useState(initialFilters);
  const [selectedCourses, setSelectedCourses] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  // ======================================================
  // LOAD DATA
  // ======================================================

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;

    setFilters(initialFilters);
    setSelectedCourses([]);
    setSelectedStudents([]);
    setStudentSearch("");
    setResult(null);
    setError("");
    setFetching(true);

    Promise.all([
      getAllCourses(),
      getAllStudents(),
      AcademicStructureService.getBatches(),
      AcademicStructureService.getBatchPrograms(null, "active"),
      AcademicStructureService.getDepartments(),
      AcademicStructureService.getPrograms(),
      AcademicStructureService.getSemesters(),
    ])
      .then((responses) => {
        if (cancelled) return;

        setData({
          courses: unwrap(responses[0]).filter(
            (course) => course.status === "published"
          ),
          students: unwrap(responses[1]),
          batches: unwrap(responses[2]),
          batchPrograms: unwrap(responses[3]),
          departments: unwrap(responses[4]),
          programs: unwrap(responses[5]),
          semesters: unwrap(responses[6]),
        });
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err?.response?.data?.message ||
              err?.message ||
              "Unable to load enrollment options"
          );
        }
      })
      .finally(() => {
        if (!cancelled) setFetching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  // ======================================================
  // ACTIVE BATCHES
  // ======================================================

  const batchOptions = useMemo(
    () =>
      data.batches
        .filter((batch) => batch.status !== "inactive")
        .slice()
        .sort((a, b) => {
          const first = Number(a.start_year || 0);
          const second = Number(b.start_year || 0);
          if (first !== second) return second - first;
          return Number(b.end_year || 0) - Number(a.end_year || 0);
        }),
    [data.batches]
  );

  // ======================================================
  // LATEST ACADEMIC STRUCTURE
  // Batch -> academic_batch_programs -> Program
  // Program -> Department + Semesters
  // ======================================================

  const departmentOptions = useMemo(
    () =>
      mappedDepartmentsForBatch(
        data.departments,
        data.programs,
        data.batchPrograms,
        filters.batch_id
      )
        .filter((department) => department.status !== "inactive")
        .slice()
        .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""))),
    [
      data.departments,
      data.programs,
      data.batchPrograms,
      filters.batch_id,
    ]
  );

  const programOptions = useMemo(
    () =>
      mappedProgramsForBatch(
        data.programs,
        data.batchPrograms,
        filters.batch_id,
        filters.department_id
      )
        .filter((program) => program.status !== "inactive")
        .slice()
        .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""))),
    [
      data.programs,
      data.batchPrograms,
      filters.batch_id,
      filters.department_id,
    ]
  );

  // IMPORTANT:
  // Semester behavior intentionally stays the same as before.
  // Admin selects the student's actual/current semester manually.
  // We only restrict to valid semesters of the selected Batch + Program.
  const semesterOptions = useMemo(
    () =>
      mappedSemestersForBatchProgram(
        data.semesters,
        data.batchPrograms,
        filters.batch_id,
        filters.program_id
      )
        .filter((semester) => semester.status !== "inactive")
        .slice()
        .sort(
          (a, b) =>
            Number(a.semester_number || 0) - Number(b.semester_number || 0)
        ),
    [
      data.semesters,
      data.batchPrograms,
      filters.batch_id,
      filters.program_id,
    ]
  );

  const selectedMapping = useMemo(() => {
    if (!filters.batch_id || !filters.program_id) return null;

    return (
      data.batchPrograms.find(
        (mapping) =>
          mapping.status === "active" &&
          sameId(mapping.batch_id, filters.batch_id) &&
          sameId(mapping.program_id, filters.program_id)
      ) || null
    );
  }, [data.batchPrograms, filters.batch_id, filters.program_id]);

  // ======================================================
  // COURSE OPTIONS
  // Generic courses belong to Department + Program.
  // Batch/Semester assignment availability is verified by backend.
  // ======================================================

  const courseOptions = useMemo(() => {
    if (!filters.department_id || !filters.program_id) return [];

    return data.courses
      .filter(
        (course) =>
          sameId(course.department_id, filters.department_id) &&
          sameId(course.program_id, filters.program_id)
      )
      .slice()
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  }, [data.courses, filters.department_id, filters.program_id]);

  const allCoursesSelected =
    courseOptions.length > 0 &&
    courseOptions.every((course) => selectedCourses.includes(course.id));

  // ======================================================
  // SUPPLY COURSE SEMESTER
  // Same Program semesters only; does not alter student's current semester.
  // ======================================================

  const targetSemesterOptions = semesterOptions;

  // ======================================================
  // FILTER STUDENTS
  // ======================================================

  const filteredStudents = useMemo(() => {
    if (
      !filters.batch_id ||
      !filters.department_id ||
      !filters.program_id ||
      !filters.current_semester_id
    ) {
      return [];
    }

    const query = studentSearch.trim().toLowerCase();

    return data.students.filter((student) => {
      if (!sameId(student.batch_id, filters.batch_id)) return false;
      if (!sameId(student.department_id, filters.department_id)) return false;
      if (!sameId(student.program_id, filters.program_id)) return false;
      if (!sameId(student.semester_id, filters.current_semester_id)) return false;

      if (filters.status === "active" && !student.is_active) return false;
      if (filters.status === "inactive" && student.is_active) return false;

      if (!query) return true;

      return `${student.full_name || ""} ${student.email || ""} ${
        student.student_id || ""
      } ${student.cnic || ""}`
        .toLowerCase()
        .includes(query);
    });
  }, [data.students, filters, studentSearch]);

  const activeVisibleIds = filteredStudents
    .filter((student) => student.is_active)
    .map((student) => student.id);

  const allVisibleSelected =
    activeVisibleIds.length > 0 &&
    activeVisibleIds.every((id) => selectedStudents.includes(id));

  // ======================================================
  // UPDATE FILTER
  // ======================================================

  const updateFilter = (patch) => {
    setFilters((old) => ({ ...old, ...patch }));
    setError("");
    setResult(null);
  };

  const targetSemesterId =
    filters.enrollment_type === "regular"
      ? filters.current_semester_id
      : filters.target_semester_id;

  // ======================================================
  // SUBMIT
  // ======================================================

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setResult(null);

    if (
      !filters.batch_id ||
      !filters.department_id ||
      !filters.program_id ||
      !filters.current_semester_id
    ) {
      return setError(
        "Select Batch, Department, Program and the students' current semester."
      );
    }

    if (!selectedMapping) {
      return setError(
        "The selected Program is not configured in this Batch."
      );
    }

    if (!selectedCourses.length) {
      return setError("Select at least one course.");
    }

    if (!selectedStudents.length) {
      return setError("Select at least one active student.");
    }

    if (filters.enrollment_type === "supply" && !filters.target_semester_id) {
      return setError("Select the original semester for the Supply course.");
    }

    if (!targetSemesterId) {
      return setError("Select the enrollment semester.");
    }

    setLoading(true);

    try {
      const response = await bulkEnrollStudents({
        student_ids: selectedStudents,
        course_ids: selectedCourses,
        batch_id: filters.batch_id,
        semester_id: targetSemesterId,
        enrollment_type: filters.enrollment_type,
        status: "active",
      });

      setResult(response?.data || null);
      onCreated?.(response?.data);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Bulk enrollment failed"
      );
    } finally {
      setLoading(false);
    }
  };

  // ======================================================
  // UI
  // ======================================================

  return (
    <Modal
      open={open}
      onClose={() => !loading && onClose()}
      title="Bulk Enrollment"
      subtitle="Select the Batch academic context, courses and students. Existing student-course combinations are skipped individually."
    >
      <form onSubmit={submit} className="space-y-5 text-slate-700 dark:text-slate-200">
        <Alert message={error} />

        {result && (
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm dark:border-emerald-500/20 dark:bg-emerald-500/10">
            <div>
              <span className="font-semibold">Inserted:</span>{" "}
              {result.inserted ?? 0}
            </div>

            <div>
              <span className="font-semibold">Skipped existing:</span>{" "}
              {result.skipped_existing ?? 0}
            </div>

            <div>
              <span className="font-semibold">Invalid students:</span>{" "}
              {result.invalid_students ?? 0}
            </div>

            <div>
              <span className="font-semibold">Missing assignments:</span>{" "}
              {result.missing_course_assignments ?? 0}
            </div>
          </div>
        )}

        <fieldset disabled={loading || fetching} className="space-y-5">
          {/* ==================================================
              1. ACADEMIC CONTEXT
          ================================================== */}

          <section className="space-y-4 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <div>
              <h3 className="font-semibold">1. Academic Context</h3>
              <p className="mt-1 text-xs text-slate-500">
                Batch controls which Departments and Programs are available through
                the new Academic Structure.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Batch" required>
                <select
                  className={inputClass}
                  value={filters.batch_id}
                  onChange={(event) => {
                    updateFilter({
                      batch_id: event.target.value,
                      department_id: "",
                      program_id: "",
                      current_semester_id: "",
                      target_semester_id: "",
                    });
                    setSelectedCourses([]);
                    setSelectedStudents([]);
                  }}
                  required
                >
                  <option value="">Select batch</option>
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
                  value={filters.department_id}
                  onChange={(event) => {
                    updateFilter({
                      department_id: event.target.value,
                      program_id: "",
                      current_semester_id: "",
                      target_semester_id: "",
                    });
                    setSelectedCourses([]);
                    setSelectedStudents([]);
                  }}
                  disabled={!filters.batch_id}
                  required
                >
                  <option value="">
                    {filters.batch_id
                      ? "Select department"
                      : "Select batch first"}
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
                  value={filters.program_id}
                  onChange={(event) => {
                    updateFilter({
                      program_id: event.target.value,
                      current_semester_id: "",
                      target_semester_id: "",
                    });
                    setSelectedCourses([]);
                    setSelectedStudents([]);
                  }}
                  disabled={!filters.department_id}
                  required
                >
                  <option value="">
                    {filters.department_id
                      ? "Select program"
                      : "Select department first"}
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
                label="Students' Current Semester"
                required
                hint="Existing semester behavior is unchanged. Select the students' actual current semester."
              >
                <select
                  className={inputClass}
                  value={filters.current_semester_id}
                  onChange={(event) => {
                    updateFilter({
                      current_semester_id: event.target.value,
                    });
                    setSelectedStudents([]);
                  }}
                  disabled={!filters.program_id}
                  required
                >
                  <option value="">
                    {filters.program_id
                      ? "Select semester"
                      : "Select program first"}
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
              <div className="grid gap-3 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-700 sm:grid-cols-3 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
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

          {/* ==================================================
              2. ENROLLMENT TYPE
          ================================================== */}

          <section className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <h3 className="font-semibold">2. Enrollment Type</h3>

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Type" required>
                <select
                  className={inputClass}
                  value={filters.enrollment_type}
                  onChange={(event) =>
                    updateFilter({
                      enrollment_type: event.target.value,
                      target_semester_id: "",
                    })
                  }
                  required
                >
                  <option value="regular">Regular</option>
                  <option value="supply">Supply</option>
                </select>
              </FormField>

              {filters.enrollment_type === "supply" && (
                <FormField
                  label="Supply Course Semester"
                  required
                  hint="Original semester of the course. This does not change the student's current semester."
                >
                  <select
                    className={inputClass}
                    value={filters.target_semester_id}
                    onChange={(event) =>
                      updateFilter({
                        target_semester_id: event.target.value,
                      })
                    }
                    disabled={!filters.program_id}
                    required
                  >
                    <option value="">
                      {filters.program_id
                        ? "Select original course semester"
                        : "Select program first"}
                    </option>

                    {targetSemesterOptions.map((semester) => (
                      <option key={semester.id} value={semester.id}>
                        {semester.name || `Semester ${semester.semester_number}`}
                      </option>
                    ))}
                  </select>
                </FormField>
              )}
            </div>
          </section>

          {/* ==================================================
              3. COURSES
          ================================================== */}

          <section className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">3. Select Courses</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Only generic courses belonging to the selected Department and
                  Program are shown.
                </p>
              </div>

              <span className="text-xs font-medium text-slate-500">
                {selectedCourses.length} selected
              </span>
            </div>

            <div className="flex items-center justify-end">
              <button
                type="button"
                className="text-sm font-medium text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!courseOptions.length}
                onClick={() =>
                  setSelectedCourses(
                    allCoursesSelected
                      ? []
                      : courseOptions.map((course) => course.id)
                  )
                }
              >
                {allCoursesSelected ? "Clear courses" : "Select all courses"}
              </button>
            </div>

            <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              {!filters.program_id ? (
                <p className="text-sm text-slate-500">
                  Select Batch, Department and Program first.
                </p>
              ) : !courseOptions.length ? (
                <p className="text-sm text-slate-500">
                  No published generic courses found for this Program.
                </p>
              ) : (
                courseOptions.map((course) => (
                  <label
                    key={course.id}
                    className="flex items-center gap-3 border-b border-slate-100 py-2 last:border-b-0 dark:border-slate-800"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCourses.includes(course.id)}
                      onChange={() =>
                        setSelectedCourses((old) =>
                          old.includes(course.id)
                            ? old.filter((id) => id !== course.id)
                            : [...old, course.id]
                        )
                      }
                    />

                    <span className="min-w-0 text-sm">
                      <span className="block font-medium text-slate-700 dark:text-slate-200">
                        {course.name}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {course.course_code || "No course code"}
                      </span>
                    </span>
                  </label>
                ))
              )}
            </div>
          </section>

          {/* ==================================================
              4. STUDENTS
          ================================================== */}

          <section className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">4. Select Students</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Students are matched by the selected Batch, Department, Program
                  and their actual current Semester.
                </p>
              </div>

              <span className="text-xs font-medium text-slate-500">
                {selectedStudents.length} selected
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Student Status">
                <select
                  className={inputClass}
                  value={filters.status}
                  onChange={(event) => {
                    updateFilter({ status: event.target.value });
                    setSelectedStudents([]);
                  }}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="all">All</option>
                </select>
              </FormField>

              <FormField label="Search students">
                <input
                  className={inputClass}
                  value={studentSearch}
                  onChange={(event) => setStudentSearch(event.target.value)}
                  placeholder="Name, Student ID, CNIC or email..."
                />
              </FormField>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span>{filteredStudents.length} matching students</span>

              <button
                type="button"
                className="font-medium text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() =>
                  setSelectedStudents((old) =>
                    allVisibleSelected
                      ? old.filter((id) => !activeVisibleIds.includes(id))
                      : [...new Set([...old, ...activeVisibleIds])]
                  )
                }
                disabled={!activeVisibleIds.length}
              >
                {allVisibleSelected ? "Clear visible" : "Select all visible"}
              </button>
            </div>

            <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              {!filters.current_semester_id ? (
                <p className="text-sm text-slate-500">
                  Complete the Academic Context first.
                </p>
              ) : !filteredStudents.length ? (
                <p className="text-sm text-slate-500">
                  No students match these filters.
                </p>
              ) : (
                filteredStudents.map((student) => (
                  <label
                    key={student.id}
                    className="flex items-center gap-3 border-b border-slate-100 py-2 last:border-b-0 dark:border-slate-800"
                  >
                    <input
                      type="checkbox"
                      disabled={!student.is_active}
                      checked={selectedStudents.includes(student.id)}
                      onChange={() =>
                        setSelectedStudents((old) =>
                          old.includes(student.id)
                            ? old.filter((id) => id !== student.id)
                            : [...old, student.id]
                        )
                      }
                    />

                    <span className="min-w-0 text-sm">
                      <span className="block font-medium text-slate-700 dark:text-slate-200">
                        {student.full_name}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {student.student_id ||
                          student.cnic ||
                          student.email ||
                          "No contact"}
                        {!student.is_active ? " · Inactive" : ""}
                      </span>
                    </span>
                  </label>
                ))
              )}
            </div>
          </section>

          {/* ==================================================
              SUBMIT
          ================================================== */}

          <button
            type="submit"
            disabled={
              loading ||
              fetching ||
              !selectedCourses.length ||
              !selectedStudents.length ||
              !filters.batch_id ||
              !filters.current_semester_id ||
              (filters.enrollment_type === "supply" &&
                !filters.target_semester_id)
            }
            className="h-11 w-full rounded-xl bg-blue-600 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Enrolling..." : "Enroll Selected Students"}
          </button>
        </fieldset>
      </form>
    </Modal>
  );
}
