import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Archive,
  BookOpen,
  CheckSquare,
  CircleCheck,
  Download,
  Eye,
  FileSpreadsheet,
  History,
  Pencil,
  Plus,
  Search,
  Square,
  Trash2,
} from "lucide-react";

import {
  deleteCourse,
  getAllCourses,
  updateCourse,
} from "../services/courseService";
import { getCourseAssignments } from "../services/courseAssignmentService";
import AcademicStructureService from "../services/AcademicStructureService";

import { AddCourseModal } from "../components/DashboardModals";
import { EditCourseModal } from "../components/CourseModals";
import { EmptyState, TableSkeleton } from "../components/PageHeader";
import ConfirmDialog from "../components/ConfirmDialog";
import SelectionActionBar from "../components/SelectionActionBar";

import {
  exportRowsToCsv,
  exportRowsToExcel,
} from "../utils/exportData";

const fieldClass =
  "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-800 dark:bg-slate-900 dark:text-white";

const sameId = (a, b) => String(a || "") === String(b || "");
const activeOnly = (item) => item?.status !== "inactive";

const unwrap = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.data)) return response.data.data;
  return [];
};

const batchLabel = (batch) => {
  if (!batch) return "—";
  if (batch.start_year && batch.end_year) {
    return `${batch.start_year}–${batch.end_year}`;
  }
  return batch.name || "Batch";
};

export default function Courses() {
  const navigate = useNavigate();

  const [courses, setCourses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [academic, setAcademic] = useState({
    batches: [],
    departments: [],
    programs: [],
    semesters: [],
    batchPrograms: [],
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [filters, setFilters] = useState({
    batch_id: "",
    department_id: "",
    program_id: "",
    semester_id: "",
    status: "",
  });

  const [selectedIds, setSelectedIds] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [bulkTarget, setBulkTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  // ======================================================
  // LOAD
  // ======================================================

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [
        courseResponse,
        assignmentResponse,
        batchResponse,
        departmentResponse,
        programResponse,
        semesterResponse,
        mappingResponse,
      ] = await Promise.all([
        getAllCourses(),
        getCourseAssignments(),
        AcademicStructureService.getBatches(),
        AcademicStructureService.getDepartments(),
        AcademicStructureService.getPrograms(),
        AcademicStructureService.getSemesters(),
        AcademicStructureService.getBatchPrograms(null, "active"),
      ]);

      setCourses(unwrap(courseResponse));
      setAssignments(unwrap(assignmentResponse));

      setAcademic({
        batches: unwrap(batchResponse),
        departments: unwrap(departmentResponse),
        programs: unwrap(programResponse),
        semesters: unwrap(semesterResponse),
        batchPrograms: unwrap(mappingResponse),
      });
    } catch (loadError) {
      setError(
        loadError?.response?.data?.message ||
          loadError?.message ||
          "Failed to load courses."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ======================================================
  // ACADEMIC FILTER OPTIONS
  //
  // All filters are optional.
  // Selecting one only narrows the options that follow it.
  //
  // Batch -> academic_batch_programs -> Program
  // Program -> Department / Semester
  // ======================================================

  const activeBatchMappings = useMemo(() => {
    let rows = academic.batchPrograms.filter(activeOnly);

    if (filters.batch_id) {
      rows = rows.filter((mapping) =>
        sameId(mapping.batch_id, filters.batch_id)
      );
    }

    return rows;
  }, [academic.batchPrograms, filters.batch_id]);

  const departmentOptions = useMemo(() => {
    let rows = academic.departments.filter(activeOnly);

    if (filters.batch_id) {
      const mappedProgramIds = new Set(
        activeBatchMappings.map((mapping) => String(mapping.program_id))
      );

      const mappedDepartmentIds = new Set(
        academic.programs
          .filter((program) => mappedProgramIds.has(String(program.id)))
          .map((program) => String(program.department_id))
      );

      rows = rows.filter((department) =>
        mappedDepartmentIds.has(String(department.id))
      );
    }

    return rows
      .slice()
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  }, [
    academic.departments,
    academic.programs,
    activeBatchMappings,
    filters.batch_id,
  ]);

  const programOptions = useMemo(() => {
    let rows = academic.programs.filter(activeOnly);

    if (filters.department_id) {
      rows = rows.filter((program) =>
        sameId(program.department_id, filters.department_id)
      );
    }

    if (filters.batch_id) {
      const mappedProgramIds = new Set(
        activeBatchMappings.map((mapping) => String(mapping.program_id))
      );

      rows = rows.filter((program) =>
        mappedProgramIds.has(String(program.id))
      );
    }

    return rows
      .slice()
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  }, [
    academic.programs,
    activeBatchMappings,
    filters.batch_id,
    filters.department_id,
  ]);

  const semesterOptions = useMemo(() => {
    let rows = academic.semesters.filter(activeOnly);

    let allowedProgramIds = null;

    if (filters.program_id) {
      allowedProgramIds = new Set([String(filters.program_id)]);
    } else if (filters.department_id) {
      let programs = academic.programs.filter(
        (program) =>
          activeOnly(program) &&
          sameId(program.department_id, filters.department_id)
      );

      if (filters.batch_id) {
        const mappedProgramIds = new Set(
          activeBatchMappings.map((mapping) => String(mapping.program_id))
        );

        programs = programs.filter((program) =>
          mappedProgramIds.has(String(program.id))
        );
      }

      allowedProgramIds = new Set(
        programs.map((program) => String(program.id))
      );
    } else if (filters.batch_id) {
      allowedProgramIds = new Set(
        activeBatchMappings.map((mapping) => String(mapping.program_id))
      );
    }

    if (allowedProgramIds) {
      rows = rows.filter((semester) =>
        allowedProgramIds.has(String(semester.program_id))
      );
    }

    // Keep the existing semester behavior.
    // If Batch + Program are selected, hide semesters before the
    // configured entry semester for that Batch/Program mapping.
    if (filters.batch_id && filters.program_id) {
      const selectedMapping = activeBatchMappings.find((mapping) =>
        sameId(mapping.program_id, filters.program_id)
      );

      const entrySemesterNumber = Number(
        selectedMapping?.entry_semester?.semester_number || 0
      );

      if (entrySemesterNumber) {
        rows = rows.filter(
          (semester) =>
            Number(semester.semester_number || 0) >= entrySemesterNumber
        );
      }
    }

    return rows.slice().sort((a, b) => {
      const firstProgram = academic.programs.find((program) =>
        sameId(program.id, a.program_id)
      );
      const secondProgram = academic.programs.find((program) =>
        sameId(program.id, b.program_id)
      );

      const programCompare = String(firstProgram?.name || "").localeCompare(
        String(secondProgram?.name || "")
      );

      if (programCompare !== 0) return programCompare;

      return (
        Number(a.semester_number || 0) - Number(b.semester_number || 0)
      );
    });
  }, [
    academic.programs,
    academic.semesters,
    activeBatchMappings,
    filters.batch_id,
    filters.department_id,
    filters.program_id,
  ]);

  // ======================================================
  // COURSE ASSIGNMENT CONTEXT
  //
  // Generic Course itself does not own Batch or Semester.
  // Batch/Semester filters therefore use Course Assignment.
  // ======================================================

  const matchingAssignmentCourseIds = useMemo(() => {
    if (!filters.batch_id && !filters.semester_id) {
      return null;
    }

    return new Set(
      assignments
        .filter((assignment) => {
          if (
            filters.batch_id &&
            !sameId(assignment.batch_id, filters.batch_id)
          ) {
            return false;
          }

          if (
            filters.semester_id &&
            !sameId(assignment.semester_id, filters.semester_id)
          ) {
            return false;
          }

          return true;
        })
        .map((assignment) => String(assignment.course_id))
    );
  }, [assignments, filters.batch_id, filters.semester_id]);

  // ======================================================
  // FILTERED COURSES
  // ======================================================

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return courses.filter((course) => {
      const departmentName =
        course.linked_department?.name || course.department || "";
      const programName = course.linked_program?.name || course.program || "";

      if (
        query &&
        !`${course.name || ""} ${course.course_code || ""} ${departmentName} ${programName}`
          .toLowerCase()
          .includes(query)
      ) {
        return false;
      }

      if (
        filters.department_id &&
        !sameId(course.department_id, filters.department_id)
      ) {
        return false;
      }

      if (
        filters.program_id &&
        !sameId(course.program_id, filters.program_id)
      ) {
        return false;
      }

      if (filters.status && course.status !== filters.status) {
        return false;
      }

      if (
        matchingAssignmentCourseIds &&
        !matchingAssignmentCourseIds.has(String(course.id))
      ) {
        return false;
      }

      return true;
    });
  }, [courses, filters, matchingAssignmentCourseIds, search]);

  // ======================================================
  // SELECTION
  // ======================================================

  const selected = courses.filter((course) => selectedIds.includes(course.id));
  const single = selected.length === 1 ? selected[0] : null;
  const visibleIds = filtered.map((course) => course.id);
  const allSelected =
    visibleIds.length > 0 &&
    visibleIds.every((id) => selectedIds.includes(id));

  const toggle = (id) => {
    setSelectedIds((previous) =>
      previous.includes(id)
        ? previous.filter((value) => value !== id)
        : [...previous, id]
    );
  };

  const toggleAll = () => {
    setSelectedIds((previous) =>
      allSelected
        ? previous.filter((id) => !visibleIds.includes(id))
        : [...new Set([...previous, ...visibleIds])]
    );
  };

  // ======================================================
  // EXPORT
  // ======================================================

  const assignmentCount = (courseId) =>
    assignments.filter((assignment) => sameId(assignment.course_id, courseId))
      .length;

  const exportRows = (rows) =>
    rows.map((course) => ({
      Course: course.name || "",
      Code: course.course_code || "",
      Department:
        course.linked_department?.name || course.department || "",
      Program: course.linked_program?.name || course.program || "",
      Credits: course.credits ?? "",
      Status: course.status || "",
      Course_Assignments: assignmentCount(course.id),
    }));

  const doExport = (type, rows = filtered) => {
    const data = exportRows(rows);
    const filename = `courses-${new Date().toISOString().slice(0, 10)}`;

    return type === "csv"
      ? exportRowsToCsv(data, undefined, filename)
      : exportRowsToExcel(data, undefined, filename);
  };

  // ======================================================
  // DELETE / BULK
  // ======================================================

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    setBusy(true);

    try {
      await deleteCourse(deleteTarget.id);
      setDeleteTarget(null);
      setSelectedIds([]);
      await load();
    } catch (deleteError) {
      setError(
        deleteError?.response?.data?.message ||
          deleteError?.message ||
          "Failed to delete course. Archive it if historical data must be retained."
      );
    } finally {
      setBusy(false);
    }
  };

  const confirmBulk = async () => {
    if (!bulkTarget) return;

    setBusy(true);

    try {
      const jobs = selectedIds.map((id) =>
        bulkTarget === "delete"
          ? deleteCourse(id)
          : updateCourse(id, { status: bulkTarget })
      );

      const results = await Promise.allSettled(jobs);
      const failed = results.filter((result) => result.status === "rejected").length;

      if (failed) {
        setError(
          `${failed} course action${failed === 1 ? "" : "s"} could not be completed.`
        );
      }

      setBulkTarget(null);
      setSelectedIds([]);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const actions = [
    {
      key: "edit",
      label: "Edit",
      icon: Pencil,
      singleOnly: true,
      onClick: () => setEditTarget(single),
    },
    {
      key: "publish",
      label: "Activate",
      icon: CircleCheck,
      tone: "success",
      disabled:
        selected.length > 0 &&
        selected.every((course) => course.status === "published"),
      onClick: () =>
        selected.length === 1
          ? updateCourse(single.id, { status: "published" })
              .then(load)
              .then(() => setSelectedIds([]))
              .catch((actionError) =>
                setError(
                  actionError?.response?.data?.message || actionError.message
                )
              )
          : setBulkTarget("published"),
    },
    {
      key: "archive",
      label: "Deactivate",
      icon: Archive,
      tone: "warning",
      disabled:
        selected.length > 0 &&
        selected.every((course) => course.status === "archived"),
      onClick: () =>
        selected.length === 1
          ? updateCourse(single.id, { status: "archived" })
              .then(load)
              .then(() => setSelectedIds([]))
              .catch((actionError) =>
                setError(
                  actionError?.response?.data?.message || actionError.message
                )
              )
          : setBulkTarget("archived"),
    },
    {
      key: "csv",
      label: "CSV",
      icon: Download,
      onClick: () => doExport("csv", selected),
    },
    {
      key: "excel",
      label: "Excel",
      icon: FileSpreadsheet,
      onClick: () => doExport("excel", selected),
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

  // ======================================================
  // FILTER CHANGE HELPERS
  // ======================================================

  const setBatchFilter = (batchId) => {
    setFilters((old) => ({
      ...old,
      batch_id: batchId,
      department_id: "",
      program_id: "",
      semester_id: "",
    }));
  };

  const setDepartmentFilter = (departmentId) => {
    setFilters((old) => ({
      ...old,
      department_id: departmentId,
      program_id: "",
      semester_id: "",
    }));
  };

  const setProgramFilter = (programId) => {
    setFilters((old) => ({
      ...old,
      program_id: programId,
      semester_id: "",
    }));
  };

  // ======================================================
  // UI
  // ======================================================

  return (
    <main className="min-h-full bg-slate-50 p-4 text-slate-700 dark:bg-slate-950 dark:text-slate-200 md:p-8">
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Courses
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Generic course catalog. Batch, semester and teacher are managed
            through Course Assignments.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => doExport("csv")}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold dark:border-slate-800 dark:bg-slate-900"
          >
            <Download size={15} />
            Export CSV
          </button>

          <button
            onClick={() => doExport("excel")}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold dark:border-slate-800 dark:bg-slate-900"
          >
            <FileSpreadsheet size={15} />
            Export Excel
          </button>

          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white"
          >
            <Plus size={17} />
            Add Course
          </button>
        </div>
      </div>

      {/* ==================================================
          FILTERS

          No filter is required.
          Selecting an upstream filter only narrows the
          following options.
      ================================================== */}

      <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <label className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              className={`${fieldClass} pl-9`}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search courses..."
            />
          </label>

          {/* BATCH */}
          <select
            className={fieldClass}
            value={filters.batch_id}
            onChange={(event) => setBatchFilter(event.target.value)}
          >
            <option value="">All batches</option>
            {academic.batches
              .filter(activeOnly)
              .slice()
              .sort(
                (a, b) =>
                  Number(b.start_year || 0) - Number(a.start_year || 0)
              )
              .map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batchLabel(batch)}
                </option>
              ))}
          </select>

          {/* DEPARTMENT */}
          <select
            className={fieldClass}
            value={filters.department_id}
            onChange={(event) => setDepartmentFilter(event.target.value)}
          >
            <option value="">All departments</option>
            {departmentOptions.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
                {department.code ? ` (${department.code})` : ""}
              </option>
            ))}
          </select>

          {/* PROGRAM */}
          <select
            className={fieldClass}
            value={filters.program_id}
            onChange={(event) => setProgramFilter(event.target.value)}
          >
            <option value="">All programs</option>
            {programOptions.map((program) => (
              <option key={program.id} value={program.id}>
                {program.name}
                {program.code ? ` (${program.code})` : ""}
              </option>
            ))}
          </select>

          {/* SEMESTER */}
          <select
            className={fieldClass}
            value={filters.semester_id}
            onChange={(event) =>
              setFilters((old) => ({
                ...old,
                semester_id: event.target.value,
              }))
            }
          >
            <option value="">All semesters</option>
            {semesterOptions.map((semester) => {
              const program = academic.programs.find((item) =>
                sameId(item.id, semester.program_id)
              );

              return (
                <option key={semester.id} value={semester.id}>
                  {program?.name ? `${program.name} · ` : ""}
                  {semester.name || `Semester ${semester.semester_number}`}
                </option>
              );
            })}
          </select>

          {/* STATUS */}
          <select
            className={fieldClass}
            value={filters.status}
            onChange={(event) =>
              setFilters((old) => ({
                ...old,
                status: event.target.value,
              }))
            }
          >
            <option value="">All statuses</option>
            <option value="published">Active</option>
            <option value="draft">Draft</option>
            <option value="archived">Inactive</option>
          </select>
        </div>

        <p className="mt-3 text-[11px] text-slate-400">
          All filters are optional. Batch uses the latest Batch–Program
          configuration; Batch and Semester filters match Course Assignment
          context because generic Courses do not store those values directly.
        </p>
      </section>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      )}

      <SelectionActionBar
        count={selected.length}
        label="courses selected"
        actions={actions}
        onClear={() => setSelectedIds([])}
      />

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {loading ? (
          <TableSkeleton columns={7} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No courses found"
            description="Try changing filters or add a course."
          />
        ) : (
          <table className="w-full table-fixed text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400 dark:border-slate-800">
                <th className="w-11 px-3 py-4">
                  <button onClick={toggleAll}>
                    {allSelected ? (
                      <CheckSquare size={16} />
                    ) : (
                      <Square size={16} />
                    )}
                  </button>
                </th>

                <th className="w-[28%] px-3 py-4">Course</th>
                <th className="w-[14%] px-3 py-4">Code</th>
                <th className="hidden w-[20%] px-3 py-4 md:table-cell">
                  Department / Program
                </th>
                <th className="hidden w-[10%] px-3 py-4 lg:table-cell">
                  Assignments
                </th>
                <th className="w-[13%] px-3 py-4">Status</th>
                <th className="w-[82px] px-2 py-4 text-right">View</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((course) => (
                <tr
                  key={course.id}
                  className={`${
                    course.status === "archived" ? "opacity-60" : ""
                  } hover:bg-slate-50 dark:hover:bg-slate-800/40`}
                >
                  <td className="px-3 py-4">
                    <button onClick={() => toggle(course.id)}>
                      {selectedIds.includes(course.id) ? (
                        <CheckSquare size={16} />
                      ) : (
                        <Square size={16} />
                      )}
                    </button>
                  </td>

                  <td className="px-3 py-4">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/10">
                        <BookOpen size={17} />
                      </span>

                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900 dark:text-white">
                          {course.name}
                        </p>
                        <p className="truncate text-xs text-slate-400">
                          {course.credits
                            ? `${course.credits} credits`
                            : course.level || "Generic course"}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="truncate px-3 py-4 font-medium">
                    {course.course_code || "—"}
                  </td>

                  <td className="hidden px-3 py-4 md:table-cell">
                    <p className="truncate">
                      {course.linked_department?.name ||
                        course.department ||
                        "—"}
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      {course.linked_program?.name || course.program || "—"}
                    </p>
                  </td>

                  <td className="hidden px-3 py-4 font-semibold lg:table-cell">
                    {assignmentCount(course.id)}
                  </td>

                  <td className="px-3 py-4">
                    <span
                      className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                        course.status === "published"
                          ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                          : course.status === "archived"
                            ? "bg-slate-100 text-slate-500 dark:bg-slate-800"
                            : "bg-amber-50 text-amber-600 dark:bg-amber-500/10"
                      }`}
                    >
                      {course.status === "published"
                        ? "Active"
                        : course.status === "archived"
                          ? "Inactive"
                          : course.status || "Draft"}
                    </span>
                  </td>

                  <td className="px-2 py-4">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => navigate(`/courses/${course.id}`)}
                        title="Course details"
                        className="rounded-lg p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10"
                      >
                        <Eye size={16} />
                      </button>

                      <button
                        onClick={() => navigate(`/courses/${course.id}/history`)}
                        title="Course history"
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800"
                      >
                        <History size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <AddCourseModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onCreated={load}
      />

      <EditCourseModal
        open={Boolean(editTarget)}
        course={editTarget}
        onClose={() => setEditTarget(null)}
        onUpdated={() => {
          setSelectedIds([]);
          load();
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={busy}
        title="Delete Course"
        message={`Permanently delete ${
          deleteTarget?.name || "this course"
        } and its linked Course Assignments, enrollments, materials, assignments, quizzes, attendance and gradebook data? This cannot be undone. Use Deactivate if you only want to hide access temporarily.`}
        confirmLabel="Delete"
        danger
      />

      <ConfirmDialog
        open={Boolean(bulkTarget)}
        onClose={() => setBulkTarget(null)}
        onConfirm={confirmBulk}
        loading={busy}
        title={`${
          bulkTarget === "delete"
            ? "Delete"
            : bulkTarget === "published"
              ? "Activate"
              : "Deactivate"
        } Courses`}
        message={
          bulkTarget === "delete"
            ? `Permanently delete ${selectedIds.length} selected courses and their linked teaching data? This cannot be undone.`
            : `Apply this status change to ${selectedIds.length} selected courses?`
        }
        confirmLabel="Continue"
        danger={bulkTarget !== "published"}
      />
    </main>
  );
}
