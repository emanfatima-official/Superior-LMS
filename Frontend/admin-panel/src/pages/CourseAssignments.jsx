import { useNavigate } from "react-router-dom";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  CheckSquare,
  History,
  Pencil,
  Square,
  Trash2,
  UserRoundCheck,
  UserRoundX,
  Users,
} from "lucide-react";

import {
  PageHeader,
  EmptyState,
  TableSkeleton,
} from "../components/PageHeader";

import ConfirmDialog from "../components/ConfirmDialog";
import SelectionActionBar from "../components/SelectionActionBar";
import Modal from "../components/Modal";

import FormField, {
  Alert,
  inputClass,
} from "../components/FormField";

import AcademicStructureService from "../services/AcademicStructureService";
import { getAllCourses } from "../services/courseService";

import {
  getCourseAssignments,
  createCourseAssignment,
  replaceCourseAssignmentTeacher,
  getCourseAssignmentTeacherHistory,
  getCourseAssignmentTeacherOptions,
  updateCourseAssignment,
  deleteCourseAssignment,
} from "../services/courseAssignmentService";

// ======================================================
// HELPERS
// ======================================================

const sameId = (first, second) =>
  String(first || "") === String(second || "");

const unwrapList = (response) => {
  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  if (Array.isArray(response?.data?.data)) {
    return response.data.data;
  }

  return [];
};

const batchLabel = (batch) =>
  batch?.start_year && batch?.end_year
    ? `${batch.start_year}–${batch.end_year}`
    : batch?.name || "Unknown batch";

const dateLabel = (date) =>
  date ? new Date(date).toLocaleString() : "Current";

const activeOnly = (item) => item?.status !== "inactive";

const emptyForm = {
  batch_id: "",
  department_id: "",
  program_id: "",
  course_id: "",
  semester_id: "",
  teacher_id: "",
};

// ======================================================
// COURSE ASSIGNMENT FORM
//
// Latest Academic Structure flow:
// Batch
//   -> academic_batch_programs
//   -> Department
//   -> Program
//   -> Course
//   -> Semester
//
// Semester behavior is intentionally preserved:
// semesters before entry_semester are hidden, but the
// Batch current semester is NOT forced automatically.
// ======================================================

function AssignmentForm({
  assignment,
  data,
  onClose,
  onSaved,
}) {
  const [form, setForm] = useState(
    assignment
      ? {
          ...emptyForm,
          course_id: assignment.course_id,
          batch_id: assignment.batch_id,
          semester_id: assignment.semester_id,
          teacher_id: assignment.teacher_id || "",
        }
      : emptyForm
  );

  const [facultyDepartment, setFacultyDepartment] = useState(
    assignment?.teacher?.department || ""
  );

  const [teacherSearch, setTeacherSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const change = (values) => {
    setForm((old) => ({
      ...old,
      ...values,
    }));

    setError("");
  };

  // ====================================================
  // BATCH OPTIONS
  // Only show active Batches that have at least one
  // active Batch-Program mapping.
  // ====================================================

  const batchOptions = useMemo(() => {
    const mappedBatchIds = new Set(
      data.batchPrograms
        .filter(activeOnly)
        .map((mapping) => String(mapping.batch_id))
    );

    return data.batches
      .filter(
        (batch) =>
          activeOnly(batch) &&
          mappedBatchIds.has(String(batch.id))
      )
      .slice()
      .sort((first, second) => {
        const startDiff =
          Number(second.start_year || 0) -
          Number(first.start_year || 0);

        if (startDiff) return startDiff;

        return (
          Number(second.end_year || 0) -
          Number(first.end_year || 0)
        );
      });
  }, [data.batchPrograms, data.batches]);

  // ====================================================
  // MAPPINGS FOR SELECTED BATCH
  // ====================================================

  const selectedBatchMappings = useMemo(() => {
    if (!form.batch_id) {
      return [];
    }

    return data.batchPrograms.filter(
      (mapping) =>
        activeOnly(mapping) &&
        sameId(mapping.batch_id, form.batch_id)
    );
  }, [data.batchPrograms, form.batch_id]);

  // ====================================================
  // DEPARTMENTS IN SELECTED BATCH
  // ====================================================

  const departmentOptions = useMemo(() => {
    if (!form.batch_id) {
      return [];
    }

    const mappedProgramIds = new Set(
      selectedBatchMappings.map((mapping) =>
        String(mapping.program_id)
      )
    );

    const mappedDepartmentIds = new Set(
      data.programs
        .filter((program) =>
          mappedProgramIds.has(String(program.id))
        )
        .map((program) => String(program.department_id))
    );

    return data.departments
      .filter(
        (department) =>
          activeOnly(department) &&
          mappedDepartmentIds.has(String(department.id))
      )
      .slice()
      .sort((first, second) =>
        String(first.name || "").localeCompare(
          String(second.name || "")
        )
      );
  }, [
    data.departments,
    data.programs,
    form.batch_id,
    selectedBatchMappings,
  ]);

  // ====================================================
  // PROGRAMS IN SELECTED BATCH + DEPARTMENT
  // ====================================================

  const programOptions = useMemo(() => {
    if (!form.batch_id || !form.department_id) {
      return [];
    }

    const mappedProgramIds = new Set(
      selectedBatchMappings.map((mapping) =>
        String(mapping.program_id)
      )
    );

    return data.programs
      .filter(
        (program) =>
          activeOnly(program) &&
          sameId(program.department_id, form.department_id) &&
          mappedProgramIds.has(String(program.id))
      )
      .slice()
      .sort((first, second) =>
        String(first.name || "").localeCompare(
          String(second.name || "")
        )
      );
  }, [
    data.programs,
    form.batch_id,
    form.department_id,
    selectedBatchMappings,
  ]);

  // ====================================================
  // GENERIC COURSES FOR SELECTED PROGRAM
  // ====================================================

  const courseOptions = useMemo(() => {
    if (!form.department_id || !form.program_id) {
      return [];
    }

    return data.courses
      .filter(
        (course) =>
          course.status === "published" &&
          sameId(course.department_id, form.department_id) &&
          sameId(course.program_id, form.program_id)
      )
      .slice()
      .sort((first, second) =>
        String(first.name || "").localeCompare(
          String(second.name || "")
        )
      );
  }, [
    data.courses,
    form.department_id,
    form.program_id,
  ]);

  // ====================================================
  // SELECTED BATCH-PROGRAM CONFIGURATION
  // ====================================================

  const selectedMapping = useMemo(() => {
    if (!form.batch_id || !form.program_id) {
      return null;
    }

    return (
      selectedBatchMappings.find((mapping) =>
        sameId(mapping.program_id, form.program_id)
      ) || null
    );
  }, [
    form.batch_id,
    form.program_id,
    selectedBatchMappings,
  ]);

  // ====================================================
  // SEMESTER OPTIONS
  //
  // Existing behavior retained:
  // - Semester must belong to selected Program.
  // - Semester before configured entry semester is hidden.
  // - Current semester is informational only.
  // ====================================================

  const semesterOptions = useMemo(() => {
    if (!form.batch_id || !form.program_id || !selectedMapping) {
      return [];
    }

    const entrySemesterNumber = Number(
      selectedMapping?.entry_semester?.semester_number || 0
    );

    return data.semesters
      .filter((semester) => {
        if (!activeOnly(semester)) return false;

        if (!sameId(semester.program_id, form.program_id)) {
          return false;
        }

        if (
          entrySemesterNumber &&
          Number(semester.semester_number || 0) <
            entrySemesterNumber
        ) {
          return false;
        }

        return true;
      })
      .slice()
      .sort(
        (first, second) =>
          Number(first.semester_number || 0) -
          Number(second.semester_number || 0)
      );
  }, [
    data.semesters,
    form.batch_id,
    form.program_id,
    selectedMapping,
  ]);

  // ====================================================
  // TEACHERS
  // ====================================================

  const facultyOptions = useMemo(
    () =>
      [
        ...new Set(
          data.teachers
            .map((teacher) => teacher.department?.trim())
            .filter(Boolean)
        ),
      ].sort((first, second) => first.localeCompare(second)),
    [data.teachers]
  );

  const teacherOptions = useMemo(() => {
    const faculty = facultyDepartment.trim().toLowerCase();
    const search = teacherSearch.trim().toLowerCase();

    return data.teachers.filter((teacher) => {
      if (!teacher.is_active) return false;

      if (
        faculty &&
        (teacher.department || "").trim().toLowerCase() !== faculty
      ) {
        return false;
      }

      return (
        !search ||
        `${teacher.full_name || ""} ${teacher.email || ""}`
          .toLowerCase()
          .includes(search)
      );
    });
  }, [data.teachers, facultyDepartment, teacherSearch]);

  // ====================================================
  // DUPLICATE CHECK
  // ====================================================

  const duplicate =
    !assignment &&
    Boolean(form.course_id && form.batch_id && form.semester_id) &&
    data.assignments.some(
      (item) =>
        sameId(item.course_id, form.course_id) &&
        sameId(item.batch_id, form.batch_id) &&
        sameId(item.semester_id, form.semester_id)
    );

  // ====================================================
  // SUBMIT
  // ====================================================

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      if (assignment) {
        await replaceCourseAssignmentTeacher(assignment.id, {
          teacher_id: form.teacher_id,
          expected_updated_at: assignment.updated_at,
        });
      } else {
        if (
          !form.batch_id ||
          !form.department_id ||
          !form.program_id ||
          !form.course_id ||
          !form.semester_id
        ) {
          throw new Error(
            "Complete Batch, Department, Program, Course and Semester first."
          );
        }

        await createCourseAssignment({
          course_id: form.course_id,
          batch_id: form.batch_id,
          semester_id: form.semester_id,
          teacher_id: form.teacher_id || null,
        });
      }

      onSaved();
    } catch (err) {
      setError(err?.message || "Unable to save course assignment");
    } finally {
      setSaving(false);
    }
  };

  // ====================================================
  // UI
  // ====================================================

  return (
    <Modal
      open
      onClose={() => !saving && onClose()}
      title={assignment ? "Change Teacher" : "New Course Assignment"}
      subtitle={
        assignment
          ? "The Course Assignment stays the same. Previous teacher work and history remain available."
          : "Choose the Batch first, then schedule a generic Course for the correct Program and Semester."
      }
    >
      <form onSubmit={submit} className="space-y-4 text-slate-700 dark:text-slate-200">
        <Alert message={error} />

        <fieldset disabled={saving} className="space-y-4">
          {assignment ? (
            <div className="rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-800">
              <p className="font-semibold">
                {assignment.course?.name}
              </p>

              <p>
                Batch {batchLabel(assignment.batch)} ·{" "}
                {assignment.semester?.name}
              </p>

              <p className="mt-2 text-slate-500">
                Current teacher: {assignment.teacher?.full_name || "Unassigned"}
              </p>
            </div>
          ) : (
            <>
              {/* =======================================
                  BATCH FIRST
              ======================================= */}

              <FormField label="Batch" required>
                <select
                  className={inputClass}
                  value={form.batch_id}
                  onChange={(event) =>
                    change({
                      ...emptyForm,
                      batch_id: event.target.value,
                    })
                  }
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

              <div className="grid gap-4 sm:grid-cols-2">
                {/* =====================================
                    DEPARTMENT FROM BATCH MAPPINGS
                ===================================== */}

                <FormField
                  label="Department"
                  required
                  hint={
                    form.batch_id && !departmentOptions.length
                      ? "No active Department/Program is configured in this Batch."
                      : ""
                  }
                >
                  <select
                    className={inputClass}
                    value={form.department_id}
                    onChange={(event) =>
                      change({
                        department_id: event.target.value,
                        program_id: "",
                        course_id: "",
                        semester_id: "",
                      })
                    }
                    disabled={!form.batch_id}
                    required
                  >
                    <option value="">
                      {form.batch_id
                        ? "Select department"
                        : "Select batch first"}
                    </option>

                    {departmentOptions.map((department) => (
                      <option
                        key={department.id}
                        value={department.id}
                      >
                        {department.name}
                        {department.code
                          ? ` (${department.code})`
                          : ""}
                      </option>
                    ))}
                  </select>
                </FormField>

                {/* =====================================
                    PROGRAM FROM BATCH MAPPINGS
                ===================================== */}

                <FormField
                  label="Program"
                  required
                  hint={
                    form.department_id && !programOptions.length
                      ? "No Program from this Department is configured in the selected Batch."
                      : ""
                  }
                >
                  <select
                    className={inputClass}
                    value={form.program_id}
                    onChange={(event) =>
                      change({
                        program_id: event.target.value,
                        course_id: "",
                        semester_id: "",
                      })
                    }
                    disabled={!form.department_id}
                    required
                  >
                    <option value="">
                      {form.department_id
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
              </div>

              {/* =======================================
                  BATCH-PROGRAM PLACEMENT INFO
              ======================================= */}

              {selectedMapping && (
                <div className="grid gap-2 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-700 sm:grid-cols-3 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
                      Admission
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
                      {selectedMapping.entry_semester?.name ||
                        "Not configured"}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
                      Batch Current Semester
                    </p>
                    <p className="mt-1 font-semibold">
                      {selectedMapping.current_semester?.name ||
                        "Not configured"}
                    </p>
                  </div>
                </div>
              )}

              {/* =======================================
                  COURSE
              ======================================= */}

              <FormField
                label="Course"
                required
                hint={
                  form.program_id && !courseOptions.length
                    ? "No active/published Course exists for this Program."
                    : ""
                }
              >
                <select
                  className={inputClass}
                  value={form.course_id}
                  onChange={(event) =>
                    change({
                      course_id: event.target.value,
                      semester_id: "",
                    })
                  }
                  disabled={!form.program_id}
                  required
                >
                  <option value="">
                    {form.program_id
                      ? "Select course"
                      : "Select program first"}
                  </option>

                  {courseOptions.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.name}
                      {course.course_code
                        ? ` (${course.course_code})`
                        : ""}
                    </option>
                  ))}
                </select>
              </FormField>

              {/* =======================================
                  SEMESTER
              ======================================= */}

              <FormField
                label="Semester"
                required
                hint={
                  form.program_id &&
                  form.batch_id &&
                  !semesterOptions.length
                    ? "No valid Semester exists for this Batch/Program placement."
                    : ""
                }
              >
                <select
                  className={inputClass}
                  value={form.semester_id}
                  onChange={(event) =>
                    change({
                      semester_id: event.target.value,
                    })
                  }
                  disabled={!form.course_id}
                  required
                >
                  <option value="">
                    {form.course_id
                      ? "Select semester"
                      : "Select course first"}
                  </option>

                  {semesterOptions.map((semester) => (
                    <option key={semester.id} value={semester.id}>
                      {semester.name ||
                        `Semester ${semester.semester_number}`}
                    </option>
                  ))}
                </select>
              </FormField>
            </>
          )}

          <Alert
            message={
              duplicate
                ? "This course already has a Course Assignment for the selected Batch and Semester. Use Change Teacher on the existing assignment."
                : ""
            }
          />

          {/* ===========================================
              TEACHER
          =========================================== */}

          <FormField
            label="Faculty department"
            hint="Optional. Select a faculty department only when assigning a teacher now."
          >
            <select
              className={inputClass}
              value={facultyDepartment}
              onChange={(event) => {
                setFacultyDepartment(event.target.value);
                change({ teacher_id: "" });
              }}
            >
              <option value="">
                Assign teacher later / Select faculty department
              </option>

              {facultyOptions.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Search teacher">
            <input
              className={inputClass}
              value={teacherSearch}
              onChange={(event) => setTeacherSearch(event.target.value)}
              placeholder="Teacher name or email"
            />
          </FormField>

          <FormField
            label="Teacher"
            hint={
              facultyDepartment && !teacherOptions.length
                ? "No active teachers found in this faculty department."
                : "Teacher is optional. The course can be scheduled and students can be enrolled before a teacher is assigned."
            }
          >
            <select
              className={inputClass}
              value={form.teacher_id}
              onChange={(event) =>
                change({
                  teacher_id: event.target.value,
                })
              }
              disabled={
                Boolean(facultyDepartment)
                  ? !assignment && !form.semester_id
                  : false
              }
            >
              <option value="">Unassigned / Assign later</option>

              {teacherOptions.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.full_name}
                  {teacher.email ? ` · ${teacher.email}` : ""}
                </option>
              ))}
            </select>
          </FormField>

          <button
            disabled={
              duplicate ||
              (!assignment &&
                (!form.batch_id ||
                  !form.department_id ||
                  !form.program_id ||
                  !form.course_id ||
                  !form.semester_id)) ||
              (assignment &&
                (form.teacher_id || "") ===
                  (assignment.teacher_id || ""))
            }
            className="h-11 w-full rounded-xl bg-blue-600 font-semibold text-white disabled:opacity-50"
          >
            {saving
              ? "Saving..."
              : assignment
                ? form.teacher_id
                  ? "Assign / Change Teacher"
                  : "Unassign Teacher"
                : form.teacher_id
                  ? "Schedule & Assign Teacher"
                  : "Schedule Course for Semester"}
          </button>
        </fieldset>
      </form>
    </Modal>
  );
}

// ======================================================
// TEACHER HISTORY MODAL
// ======================================================

function AssignmentHistory({
  assignment,
  onClose,
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    getCourseAssignmentTeacherHistory(assignment.id)
      .then((response) => {
        if (!cancelled) {
          setRows(unwrapList(response));
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.message || "Unable to load teacher history");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [assignment.id]);

  return (
    <Modal
      open
      onClose={onClose}
      title="Teacher History"
      subtitle={`${assignment.course?.name} · ${batchLabel(
        assignment.batch
      )} · ${assignment.semester?.name}`}
    >
      <Alert message={error} />

      {loading ? (
        <TableSkeleton columns={2} rows={3} />
      ) : (
        <div className="space-y-3">
          {!rows.length && !error && (
            <p>No teacher history recorded yet.</p>
          )}

          {rows.map((row) => (
            <div
              key={row.id}
              className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"
            >
              <p className="font-semibold">
                {row.teacher?.full_name || "Unknown teacher"}

                {row.is_current && (
                  <span className="ml-2 text-xs text-green-600">
                    Current
                  </span>
                )}
              </p>

              <p className="text-xs text-slate-500">
                {row.teacher?.department}
              </p>

              <p className="mt-2 text-sm">
                {dateLabel(row.assigned_at)} → {dateLabel(row.unassigned_at)}
              </p>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

// ======================================================
// PAGE
// ======================================================

export default function CourseAssignments() {
  const navigate = useNavigate();

  const [data, setData] = useState({
    assignments: [],
    courses: [],
    batches: [],
    batchPrograms: [],
    departments: [],
    programs: [],
    semesters: [],
    teachers: [],
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  // ====================================================
  // FILTERS
  // Batch-first filtering according to latest Academic
  // Structure.
  // ====================================================

  const [batchFilter, setBatchFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [programFilter, setProgramFilter] = useState("");
  const [semesterFilter, setSemesterFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [editing, setEditing] = useState(undefined);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkTarget, setBulkTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  // ====================================================
  // LOAD
  // ====================================================

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const results = await Promise.all([
        getCourseAssignments(),
        getAllCourses(),
        AcademicStructureService.getBatches(),
        AcademicStructureService.getBatchPrograms(null, "active"),
        AcademicStructureService.getDepartments(),
        AcademicStructureService.getPrograms(),
        AcademicStructureService.getSemesters(),
        getCourseAssignmentTeacherOptions(),
      ]);

      setData({
        assignments: unwrapList(results[0]),

        courses: unwrapList(results[1]).filter(
          (course) => course.status === "published"
        ),

        batches: unwrapList(results[2]).filter(activeOnly),

        batchPrograms: unwrapList(results[3]).filter(activeOnly),

        departments: unwrapList(results[4]).filter(activeOnly),

        programs: unwrapList(results[5]).filter(activeOnly),

        semesters: unwrapList(results[6]).filter(activeOnly),

        teachers: unwrapList(results[7]),
      });
    } catch (err) {
      setError(
        err?.message ||
          err?.response?.data?.message ||
          "Unable to load course assignments"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

// ====================================================
// FILTER OPTION HELPERS
//
// IMPORTANT:
// None of these filters is required.
//
// No selection:
// Batch      -> all
// Department -> all
// Program    -> all
// Semester   -> all
//
// If an upstream filter is selected, downstream options
// automatically narrow according to the latest Academic
// Structure.
// ====================================================

const filterBatchMappings = useMemo(() => {
  if (!batchFilter) {
    return data.batchPrograms.filter(activeOnly);
  }

  return data.batchPrograms.filter(
    (mapping) =>
      activeOnly(mapping) &&
      sameId(mapping.batch_id, batchFilter)
  );
}, [
  batchFilter,
  data.batchPrograms,
]);

// ====================================================
// DEPARTMENTS
//
// No Batch:
// -> all Departments
//
// Batch selected:
// -> only Departments having a Program mapped
//    to that Batch.
// ====================================================

const filterDepartmentOptions = useMemo(() => {
  let availableDepartments = data.departments.filter(activeOnly);

  if (!batchFilter) {
    return availableDepartments
      .slice()
      .sort((first, second) =>
        String(first.name || "").localeCompare(
          String(second.name || "")
        )
      );
  }

  const mappedProgramIds = new Set(
    filterBatchMappings.map((mapping) =>
      String(mapping.program_id)
    )
  );

  const mappedDepartmentIds = new Set(
    data.programs
      .filter((program) =>
        mappedProgramIds.has(String(program.id))
      )
      .map((program) =>
        String(program.department_id)
      )
  );

  return availableDepartments
    .filter((department) =>
      mappedDepartmentIds.has(
        String(department.id)
      )
    )
    .slice()
    .sort((first, second) =>
      String(first.name || "").localeCompare(
        String(second.name || "")
      )
    );
}, [
  batchFilter,
  data.departments,
  data.programs,
  filterBatchMappings,
]);

// ====================================================
// PROGRAMS
//
// No filters:
// -> all Programs
//
// Batch:
// -> Programs mapped to Batch
//
// Department:
// -> Programs from Department
//
// Batch + Department:
// -> Programs satisfying both
// ====================================================

const filterProgramOptions = useMemo(() => {
  let availablePrograms =
    data.programs.filter(activeOnly);

  // Department filter
  if (departmentFilter) {
    availablePrograms =
      availablePrograms.filter((program) =>
        sameId(
          program.department_id,
          departmentFilter
        )
      );
  }

  // Batch filter
  if (batchFilter) {
    const mappedProgramIds = new Set(
      filterBatchMappings.map((mapping) =>
        String(mapping.program_id)
      )
    );

    availablePrograms =
      availablePrograms.filter((program) =>
        mappedProgramIds.has(
          String(program.id)
        )
      );
  }

  return availablePrograms
    .slice()
    .sort((first, second) =>
      String(first.name || "").localeCompare(
        String(second.name || "")
      )
    );
}, [
  batchFilter,
  departmentFilter,
  data.programs,
  filterBatchMappings,
]);

// ====================================================
// SELECTED PROGRAM MAPPING
//
// Only needed when Batch + Program are both selected.
// ====================================================

const filterSelectedMapping = useMemo(() => {
  if (
    !batchFilter ||
    !programFilter
  ) {
    return null;
  }

  return (
    filterBatchMappings.find((mapping) =>
      sameId(
        mapping.program_id,
        programFilter
      )
    ) || null
  );
}, [
  batchFilter,
  filterBatchMappings,
  programFilter,
]);

// ====================================================
// SEMESTERS
//
// No filters:
// -> all Semesters
//
// Batch:
// -> Semesters belonging to Programs in Batch
//
// Department:
// -> Semesters belonging to Programs in Department
//
// Program:
// -> Semesters belonging to Program
//
// Semester behavior itself is NOT changed.
// ====================================================

const filterSemesterOptions = useMemo(() => {
  let availableSemesters =
    data.semesters.filter(activeOnly);

  let allowedProgramIds = null;

  // ----------------------------------------------
  // PROGRAM SELECTED
  // ----------------------------------------------

  if (programFilter) {
    allowedProgramIds = new Set([
      String(programFilter),
    ]);
  }

  // ----------------------------------------------
  // DEPARTMENT SELECTED
  // ----------------------------------------------

  else if (departmentFilter) {
    allowedProgramIds = new Set(
      data.programs
        .filter(
          (program) =>
            activeOnly(program) &&
            sameId(
              program.department_id,
              departmentFilter
            )
        )
        .map((program) =>
          String(program.id)
        )
    );
  }

  // ----------------------------------------------
  // BATCH SELECTED ONLY
  // ----------------------------------------------

  else if (batchFilter) {
    allowedProgramIds = new Set(
      filterBatchMappings.map((mapping) =>
        String(mapping.program_id)
      )
    );
  }

  if (allowedProgramIds) {
    availableSemesters =
      availableSemesters.filter(
        (semester) =>
          allowedProgramIds.has(
            String(
              semester.program_id
            )
          )
      );
  }

  // ----------------------------------------------
  // If a specific Batch + Program is selected,
  // keep existing Entry Semester restriction.
  // ----------------------------------------------

  const entrySemesterNumber = Number(
    filterSelectedMapping
      ?.entry_semester
      ?.semester_number ||
      0
  );

  if (
    programFilter &&
    batchFilter &&
    entrySemesterNumber
  ) {
    availableSemesters =
      availableSemesters.filter(
        (semester) =>
          Number(
            semester.semester_number ||
              0
          ) >= entrySemesterNumber
      );
  }

  return availableSemesters
    .slice()
    .sort((first, second) => {
      // Program first
      const firstProgram =
        data.programs.find(
          (program) =>
            sameId(
              program.id,
              first.program_id
            )
        );

      const secondProgram =
        data.programs.find(
          (program) =>
            sameId(
              program.id,
              second.program_id
            )
        );

      const programCompare =
        String(
          firstProgram?.name || ""
        ).localeCompare(
          String(
            secondProgram?.name || ""
          )
        );

      if (programCompare !== 0) {
        return programCompare;
      }

      return (
        Number(
          first.semester_number ||
            0
        ) -
        Number(
          second.semester_number ||
            0
        )
      );
    });
}, [
  batchFilter,
  departmentFilter,
  programFilter,
  data.programs,
  data.semesters,
  filterBatchMappings,
  filterSelectedMapping,
]);

  // ====================================================
  // FILTERED ROWS
  // ====================================================

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return data.assignments.filter((assignment) => {
      const course = assignment.course || {};

      if (
        batchFilter &&
        !sameId(assignment.batch_id, batchFilter)
      ) {
        return false;
      }

      if (
        departmentFilter &&
        !sameId(course.department_id, departmentFilter)
      ) {
        return false;
      }

      if (
        programFilter &&
        !sameId(course.program_id, programFilter)
      ) {
        return false;
      }

      if (
        semesterFilter &&
        !sameId(assignment.semester_id, semesterFilter)
      ) {
        return false;
      }

      if (
        statusFilter &&
        assignment.status !== statusFilter
      ) {
        return false;
      }

      if (!query) {
        return true;
      }

      const department = data.departments.find((item) =>
        sameId(item.id, course.department_id)
      );

      const program = data.programs.find((item) =>
        sameId(item.id, course.program_id)
      );

      return `${
        course.name || ""
      } ${course.course_code || ""} ${
        department?.name || ""
      } ${program?.name || ""} ${
        assignment.teacher?.full_name || ""
      } ${assignment.teacher?.department || ""} ${
        assignment.semester?.name || ""
      } ${batchLabel(assignment.batch)}`
        .toLowerCase()
        .includes(query);
    });
  }, [
    batchFilter,
    data.assignments,
    data.departments,
    data.programs,
    departmentFilter,
    programFilter,
    search,
    semesterFilter,
    statusFilter,
  ]);

  // ====================================================
  // SELECTION
  // ====================================================

  const selected = data.assignments.filter((item) =>
    selectedIds.includes(item.id)
  );

  const single = selected.length === 1 ? selected[0] : null;

  const visibleIds = rows.map((item) => item.id);

  const allVisibleSelected =
    visibleIds.length > 0 &&
    visibleIds.every((id) => selectedIds.includes(id));

  const toggle = (id) =>
    setSelectedIds((previous) =>
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id]
    );

  const toggleAll = () =>
    setSelectedIds((previous) =>
      allVisibleSelected
        ? previous.filter((id) => !visibleIds.includes(id))
        : [...new Set([...previous, ...visibleIds])]
    );

  // ====================================================
  // STATUS
  // ====================================================

  const updateStatus = async (status) => {
    setBusy(true);

    try {
      if (selected.length === 1) {
        await updateCourseAssignment(single.id, {
          status,
        });
      } else {
        const result = await Promise.allSettled(
          selectedIds.map((id) =>
            updateCourseAssignment(id, {
              status,
            })
          )
        );

        const failed = result.filter(
          (item) => item.status === "rejected"
        ).length;

        if (failed) {
          setError(
            `${failed} assignment${failed === 1 ? "" : "s"} could not be updated.`
          );
        }
      }

      setSelectedIds([]);
      setBulkTarget(null);
      await load();
    } catch (err) {
      setError(
        err?.message ||
          err?.response?.data?.message ||
          "Unable to update assignment."
      );
    } finally {
      setBusy(false);
    }
  };

  // ====================================================
  // DELETE
  // ====================================================

  const removeSelected = async () => {
    setBusy(true);

    try {
      if (deleteTarget) {
        await deleteCourseAssignment(deleteTarget.id);
      } else {
        const result = await Promise.allSettled(
          selectedIds.map((id) => deleteCourseAssignment(id))
        );

        const failed = result.filter(
          (item) => item.status === "rejected"
        ).length;

        if (failed) {
          setError(
            `${failed} assignment${failed === 1 ? "" : "s"} could not be removed.`
          );
        }
      }

      setDeleteTarget(null);
      setBulkTarget(null);
      setSelectedIds([]);
      await load();
    } catch (err) {
      setError(
        err?.message ||
          err?.response?.data?.message ||
          "Unable to remove Course Assignment."
      );
    } finally {
      setBusy(false);
    }
  };

  // ====================================================
  // BULK ACTIONS
  // ====================================================

  const actions = [
    {
      key: "teacher",
      label: "Assign / Change Teacher",
      icon: Pencil,
      singleOnly: true,
      onClick: () => setEditing(single),
    },
    {
      key: "activate",
      label: "Activate",
      icon: UserRoundCheck,
      tone: "success",
      disabled:
        selected.length > 0 &&
        selected.every((item) => item.status === "active"),
      onClick: () =>
        selected.length === 1
          ? updateStatus("active")
          : setBulkTarget("active"),
    },
    {
      key: "deactivate",
      label: "Deactivate",
      icon: UserRoundX,
      tone: "warning",
      disabled:
        selected.length > 0 &&
        selected.every((item) => item.status === "inactive"),
      onClick: () =>
        selected.length === 1
          ? updateStatus("inactive")
          : setBulkTarget("inactive"),
    },
    {
      key: "delete",
      label: "Delete",
      icon: Trash2,
      tone: "danger",
      onClick: () =>
        selected.length === 1
          ? setDeleteTarget(single)
          : setBulkTarget("delete"),
    },
  ];

  // ====================================================
  // UI
  // ====================================================

  return (
    <main className="min-h-full bg-slate-50 p-4 text-slate-700 dark:bg-slate-950 dark:text-slate-200 md:p-8">
      <PageHeader
        title="Course Assignments"
        description="Schedule Courses using the latest Batch → Department → Program → Semester structure."
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search course or teacher..."
        actionLabel="New Assignment"
        onAction={!loading && !error ? () => setEditing(null) : undefined}
      />

      <Alert message={error} />

      {/* ===============================================
          FILTERS
      =============================================== */}

     {/* ===============================================
    FILTERS

    All filters are optional.

    Selecting one filter only narrows the options
    available in the following filters.
=============================================== */}

<div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
  {/* BATCH */}
  <select
    aria-label="Filter by batch"
    className={inputClass}
    value={batchFilter}
    onChange={(event) => {
      setBatchFilter(
        event.target.value
      );

      // Reset dependent filters because available
      // options may have changed.
      setDepartmentFilter("");
      setProgramFilter("");
      setSemesterFilter("");
    }}
  >
    <option value="">
      All batches
    </option>

    {data.batches.map((batch) => (
      <option
        key={batch.id}
        value={batch.id}
      >
        {batchLabel(batch)}
      </option>
    ))}
  </select>

  {/* DEPARTMENT */}
  <select
    aria-label="Filter by department"
    className={inputClass}
    value={departmentFilter}
    onChange={(event) => {
      setDepartmentFilter(
        event.target.value
      );

      setProgramFilter("");
      setSemesterFilter("");
    }}
  >
    <option value="">
      All departments
    </option>

    {filterDepartmentOptions.map(
      (department) => (
        <option
          key={department.id}
          value={department.id}
        >
          {department.name}

          {department.code
            ? ` (${department.code})`
            : ""}
        </option>
      )
    )}
  </select>

  {/* PROGRAM */}
  <select
    aria-label="Filter by program"
    className={inputClass}
    value={programFilter}
    onChange={(event) => {
      setProgramFilter(
        event.target.value
      );

      setSemesterFilter("");
    }}
  >
    <option value="">
      All programs
    </option>

    {filterProgramOptions.map(
      (program) => (
        <option
          key={program.id}
          value={program.id}
        >
          {program.name}

          {program.code
            ? ` (${program.code})`
            : ""}
        </option>
      )
    )}
  </select>

  {/* SEMESTER */}
  <select
    aria-label="Filter by semester"
    className={inputClass}
    value={semesterFilter}
    onChange={(event) =>
      setSemesterFilter(
        event.target.value
      )
    }
  >
    <option value="">
      All semesters
    </option>

    {filterSemesterOptions.map(
      (semester) => {
        const program =
          data.programs.find(
            (item) =>
              sameId(
                item.id,
                semester.program_id
              )
          );

        return (
          <option
            key={semester.id}
            value={semester.id}
          >
            {program?.name
              ? `${program.name} · `
              : ""}

            {semester.name ||
              `Semester ${semester.semester_number}`}
          </option>
        );
      }
    )}
  </select>

  {/* STATUS */}
  <select
    aria-label="Filter by status"
    className={inputClass}
    value={statusFilter}
    onChange={(event) =>
      setStatusFilter(
        event.target.value
      )
    }
  >
    <option value="">
      All statuses
    </option>

    <option value="active">
      Active
    </option>

    <option value="inactive">
      Inactive
    </option>

    <option value="completed">
      Completed
    </option>
  </select>
</div>

      <SelectionActionBar
        count={selected.length}
        label="assignments selected"
        actions={actions}
        onClear={() => setSelectedIds([])}
      />

      {/* ===============================================
          TABLE
      =============================================== */}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {loading ? (
          <TableSkeleton columns={7} />
        ) : !rows.length ? (
          <EmptyState
            icon={Users}
            title="No course assignments found"
            description="Schedule a generic Course for the correct Batch and Semester. Teacher assignment is optional."
          />
        ) : (
          <table className="w-full table-fixed text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400 dark:border-slate-800">
                <th className="w-11 px-3 py-4">
                  <button type="button" onClick={toggleAll}>
                    {allVisibleSelected ? (
                      <CheckSquare size={16} />
                    ) : (
                      <Square size={16} />
                    )}
                  </button>
                </th>

                <th className="w-[28%] px-3 py-4">Course</th>

                <th className="hidden w-[18%] px-3 py-4 md:table-cell">
                  Batch
                </th>

                <th className="w-[18%] px-3 py-4">Semester</th>

                <th className="hidden w-[22%] px-3 py-4 lg:table-cell">
                  Current Teacher
                </th>

                <th className="w-[12%] px-3 py-4">Status</th>

                <th className="w-[62px] px-2 py-4 text-right">
                  View
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((assignment) => (
                <tr
                  key={assignment.id}
                  className={`${
                    assignment.status === "inactive" ? "opacity-60" : ""
                  } hover:bg-slate-50 dark:hover:bg-slate-800/40`}
                >
                  <td className="px-3 py-4">
                    <button
                      type="button"
                      onClick={() => toggle(assignment.id)}
                    >
                      {selectedIds.includes(assignment.id) ? (
                        <CheckSquare size={16} />
                      ) : (
                        <Square size={16} />
                      )}
                    </button>
                  </td>

                  <td className="px-3 py-4">
                    <p className="truncate font-semibold text-slate-900 dark:text-white">
                      {assignment.course?.name || "—"}
                    </p>

                    <p className="truncate text-xs text-slate-400">
                      {assignment.course?.course_code || "—"}
                    </p>
                  </td>

                  <td className="hidden px-3 py-4 md:table-cell">
                    {batchLabel(assignment.batch)}
                  </td>

                  <td className="truncate px-3 py-4">
                    {assignment.semester?.name || "—"}
                  </td>

                  <td className="hidden px-3 py-4 lg:table-cell">
                    <p className="truncate font-medium">
                      {assignment.teacher?.full_name || "Unassigned"}
                    </p>

                    <p className="truncate text-xs text-slate-400">
                      {assignment.teacher?.department || ""}
                    </p>
                  </td>

                  <td className="px-3 py-4">
                    <span
                      className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                        assignment.status === "active"
                          ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                          : assignment.status === "completed"
                            ? "bg-blue-50 text-blue-600 dark:bg-blue-500/10"
                            : "bg-slate-100 text-slate-500 dark:bg-slate-800"
                      }`}
                    >
                      {assignment.status || "active"}
                    </span>
                  </td>

                  <td className="px-2 py-4 text-right">
                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          `/course-assignments/${assignment.id}/history`
                        )
                      }
                      title="Assignment details & history"
                      className="rounded-lg p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10"
                    >
                      <History size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* ===============================================
          FORM MODAL
      =============================================== */}

      {editing !== undefined && (
        <AssignmentForm
          assignment={editing}
          data={data}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            setSelectedIds([]);
            load();
          }}
        />
      )}

      {/* ===============================================
          DELETE CONFIRM
      =============================================== */}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={removeSelected}
        loading={busy}
        title="Delete Course Assignment"
        message="This permanently deletes the Course Assignment and linked enrollments, materials, assignments, quizzes, attendance and gradebook data for this teaching context. This cannot be undone."
        confirmLabel="Delete permanently"
        danger
      />

      <ConfirmDialog
        open={Boolean(bulkTarget)}
        onClose={() => setBulkTarget(null)}
        onConfirm={() =>
          bulkTarget === "delete"
            ? removeSelected()
            : updateStatus(bulkTarget)
        }
        loading={busy}
        title={
          bulkTarget === "delete"
            ? "Remove Course Assignments"
            : bulkTarget === "active"
              ? "Activate Course Assignments"
              : "Deactivate Course Assignments"
        }
        message={
          bulkTarget === "delete"
            ? `Permanently delete ${selectedIds.length} selected Course Assignments and their linked teaching data? This cannot be undone.`
            : `Apply this status change to ${selectedIds.length} selected Course Assignments?`
        }
        confirmLabel={
          bulkTarget === "delete" ? "Delete permanently" : "Continue"
        }
        danger={bulkTarget !== "active"}
      />
    </main>
  );
}
