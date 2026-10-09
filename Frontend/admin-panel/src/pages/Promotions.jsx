import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  GraduationCap,
} from "lucide-react";

import {
  PageHeader,
  EmptyState,
  TableSkeleton,
} from "../components/PageHeader";

import FormField, {
  Alert,
  inputClass,
} from "../components/FormField";

import AcademicStructureService from "../services/AcademicStructureService";

import {
  getAllStudents,
} from "../services/studentService";

import {
  promoteStudentsBulk,
} from "../services/promotionService";

// ======================================================
// HELPERS
// ======================================================

const sameId = (first, second) =>
  String(first || "") === String(second || "");

const activeOnly = (item) =>
  item?.status !== "inactive";

const unwrapArray = (response) => {
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
    : batch?.name || "Batch";

const semesterLabel = (semester) =>
  semester?.name ||
  (semester?.semester_number
    ? `Semester ${semester.semester_number}`
    : "Semester");

// ======================================================
// PAGE
// ======================================================

export default function Promotions() {
  const [data, setData] = useState({
    students: [],
    batches: [],
    batchPrograms: [],
    departments: [],
    programs: [],
    semesters: [],
  });

  const [filters, setFilters] = useState({
    batch_id: "",
    department_id: "",
    program_id: "",
    semester_id: "",
    to_semester_id: "",
    status: "active",
  });

  const [selectedIds, setSelectedIds] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [promoting, setPromoting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  // ====================================================
  // LOAD
  // ====================================================

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const responses = await Promise.all([
        getAllStudents(),
        AcademicStructureService.getBatches(),
        AcademicStructureService.getBatchPrograms(null, "active"),
        AcademicStructureService.getDepartments(),
        AcademicStructureService.getPrograms(),
        AcademicStructureService.getSemesters(),
      ]);

      setData({
        students: unwrapArray(responses[0]),
        batches: unwrapArray(responses[1]),
        batchPrograms: unwrapArray(responses[2]),
        departments: unwrapArray(responses[3]),
        programs: unwrapArray(responses[4]),
        semesters: unwrapArray(responses[5]),
      });
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Unable to load promotion data"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ====================================================
  // ACTIVE MASTER DATA
  // ====================================================

  const activeBatches = useMemo(
    () =>
      data.batches
        .filter(activeOnly)
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
        }),
    [data.batches]
  );

  const activeDepartments = useMemo(
    () => data.departments.filter(activeOnly),
    [data.departments]
  );

  const activePrograms = useMemo(
    () => data.programs.filter(activeOnly),
    [data.programs]
  );

  const activeSemesters = useMemo(
    () => data.semesters.filter(activeOnly),
    [data.semesters]
  );

  // ====================================================
  // BATCH MAPPINGS
  // ====================================================

  const activeMappings = useMemo(
    () => data.batchPrograms.filter(activeOnly),
    [data.batchPrograms]
  );

  const selectedBatchMappings = useMemo(() => {
    if (!filters.batch_id) {
      return activeMappings;
    }

    return activeMappings.filter((mapping) =>
      sameId(mapping.batch_id, filters.batch_id)
    );
  }, [activeMappings, filters.batch_id]);

  // ====================================================
  // OPTIONAL DEPENDENT FILTER OPTIONS
  //
  // Filters are NOT required for browsing.
  // Selecting an upstream filter only narrows the next
  // available options.
  // ====================================================

  const departmentOptions = useMemo(() => {
    let available = activeDepartments;

    if (filters.batch_id) {
      const mappedProgramIds = new Set(
        selectedBatchMappings.map((mapping) =>
          String(mapping.program_id)
        )
      );

      const mappedDepartmentIds = new Set(
        activePrograms
          .filter((program) =>
            mappedProgramIds.has(String(program.id))
          )
          .map((program) => String(program.department_id))
      );

      available = available.filter((department) =>
        mappedDepartmentIds.has(String(department.id))
      );
    }

    return available
      .slice()
      .sort((first, second) =>
        String(first.name || "").localeCompare(
          String(second.name || "")
        )
      );
  }, [
    activeDepartments,
    activePrograms,
    filters.batch_id,
    selectedBatchMappings,
  ]);

  const programOptions = useMemo(() => {
    let available = activePrograms;

    if (filters.department_id) {
      available = available.filter((program) =>
        sameId(program.department_id, filters.department_id)
      );
    }

    if (filters.batch_id) {
      const mappedProgramIds = new Set(
        selectedBatchMappings.map((mapping) =>
          String(mapping.program_id)
        )
      );

      available = available.filter((program) =>
        mappedProgramIds.has(String(program.id))
      );
    }

    return available
      .slice()
      .sort((first, second) =>
        String(first.name || "").localeCompare(
          String(second.name || "")
        )
      );
  }, [
    activePrograms,
    filters.batch_id,
    filters.department_id,
    selectedBatchMappings,
  ]);

  const selectedMapping = useMemo(() => {
    if (!filters.batch_id || !filters.program_id) {
      return null;
    }

    return (
      activeMappings.find(
        (mapping) =>
          sameId(mapping.batch_id, filters.batch_id) &&
          sameId(mapping.program_id, filters.program_id)
      ) || null
    );
  }, [
    activeMappings,
    filters.batch_id,
    filters.program_id,
  ]);

  const semesterOptions = useMemo(() => {
    let allowedProgramIds = null;

    if (filters.program_id) {
      allowedProgramIds = new Set([
        String(filters.program_id),
      ]);
    } else if (filters.department_id) {
      let programsInDepartment = activePrograms.filter((program) =>
        sameId(program.department_id, filters.department_id)
      );

      if (filters.batch_id) {
        const mappedProgramIds = new Set(
          selectedBatchMappings.map((mapping) =>
            String(mapping.program_id)
          )
        );

        programsInDepartment = programsInDepartment.filter(
          (program) => mappedProgramIds.has(String(program.id))
        );
      }

      allowedProgramIds = new Set(
        programsInDepartment.map((program) => String(program.id))
      );
    } else if (filters.batch_id) {
      allowedProgramIds = new Set(
        selectedBatchMappings.map((mapping) =>
          String(mapping.program_id)
        )
      );
    }

    let available = activeSemesters;

    if (allowedProgramIds) {
      available = available.filter((semester) =>
        allowedProgramIds.has(String(semester.program_id))
      );
    }

    // Keep the existing lateral/entry-semester rule when a
    // specific Batch + Program mapping is selected.
    if (filters.batch_id && filters.program_id && selectedMapping) {
      const entrySemester =
        selectedMapping.entry_semester ||
        activeSemesters.find((semester) =>
          sameId(semester.id, selectedMapping.entry_semester_id)
        );

      const entryNumber = Number(
        entrySemester?.semester_number || 0
      );

      if (entryNumber) {
        available = available.filter(
          (semester) =>
            !sameId(semester.program_id, filters.program_id) ||
            Number(semester.semester_number || 0) >= entryNumber
        );
      }
    }

    return available.slice().sort((first, second) => {
      const firstProgram = activePrograms.find((program) =>
        sameId(program.id, first.program_id)
      );

      const secondProgram = activePrograms.find((program) =>
        sameId(program.id, second.program_id)
      );

      const programCompare = String(
        firstProgram?.name || ""
      ).localeCompare(String(secondProgram?.name || ""));

      if (programCompare !== 0) {
        return programCompare;
      }

      return (
        Number(first.semester_number || 0) -
        Number(second.semester_number || 0)
      );
    });
  }, [
    activePrograms,
    activeSemesters,
    filters.batch_id,
    filters.department_id,
    filters.program_id,
    selectedBatchMappings,
    selectedMapping,
  ]);

  // ====================================================
  // PROMOTION ACTION OPTIONS
  //
  // Browsing filters are optional, but a bulk promotion
  // needs one exact cohort context:
  // Batch + Program + Current Semester.
  // Department is not required because Program already
  // identifies its Department.
  // ====================================================

  const currentSemester = useMemo(
    () =>
      activeSemesters.find((semester) =>
        sameId(semester.id, filters.semester_id)
      ) || null,
    [activeSemesters, filters.semester_id]
  );

  const selectionContextReady = Boolean(
    filters.batch_id &&
      filters.program_id &&
      filters.semester_id
  );

  const targetSemesters = useMemo(() => {
    if (!selectionContextReady || !currentSemester) {
      return [];
    }

    const currentNumber = Number(
      currentSemester.semester_number || 0
    );

    return activeSemesters
      .filter(
        (semester) =>
          sameId(semester.program_id, filters.program_id) &&
          Number(semester.semester_number || 0) > currentNumber
      )
      .filter((semester) => {
        if (!selectedMapping) return true;

        const entrySemester =
          selectedMapping.entry_semester ||
          activeSemesters.find((item) =>
            sameId(item.id, selectedMapping.entry_semester_id)
          );

        const entryNumber = Number(
          entrySemester?.semester_number || 0
        );

        return (
          !entryNumber ||
          Number(semester.semester_number || 0) >= entryNumber
        );
      })
      .slice()
      .sort(
        (first, second) =>
          Number(first.semester_number || 0) -
          Number(second.semester_number || 0)
      );
  }, [
    activeSemesters,
    currentSemester,
    filters.program_id,
    selectedMapping,
    selectionContextReady,
  ]);

  // ====================================================
  // STUDENTS
  // ====================================================

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();

    return data.students.filter((student) => {
      if (
        filters.batch_id &&
        !sameId(student.batch_id, filters.batch_id)
      ) {
        return false;
      }

      if (
        filters.department_id &&
        !sameId(student.department_id, filters.department_id)
      ) {
        return false;
      }

      if (
        filters.program_id &&
        !sameId(student.program_id, filters.program_id)
      ) {
        return false;
      }

      if (
        filters.semester_id &&
        !sameId(student.semester_id, filters.semester_id)
      ) {
        return false;
      }

      if (filters.status === "active" && !student.is_active) {
        return false;
      }

      if (filters.status === "inactive" && student.is_active) {
        return false;
      }

      if (!query) {
        return true;
      }

      return `${student.full_name || ""} ${
        student.email || ""
      } ${student.student_id || ""} ${student.cnic || ""}`
        .toLowerCase()
        .includes(query);
    });
  }, [data.students, filters, search]);

  // Only the exact filtered cohort may be selected for a
  // single bulk promotion action.
  const selectableIds = useMemo(() => {
    if (!selectionContextReady) {
      return [];
    }

    return filteredStudents
      .filter((student) => student.is_active)
      .map((student) => student.id);
  }, [filteredStudents, selectionContextReady]);

  const allSelected =
    selectableIds.length > 0 &&
    selectableIds.every((id) => selectedIds.includes(id));

  // ====================================================
  // FILTER CHANGES
  // ====================================================

  const resetActionState = () => {
    setSelectedIds([]);
    setResult(null);
    setError("");
  };

  const changeBatch = (batchId) => {
    setFilters((old) => ({
      ...old,
      batch_id: batchId,
      department_id: "",
      program_id: "",
      semester_id: "",
      to_semester_id: "",
    }));

    resetActionState();
  };

  const changeDepartment = (departmentId) => {
    setFilters((old) => ({
      ...old,
      department_id: departmentId,
      program_id: "",
      semester_id: "",
      to_semester_id: "",
    }));

    resetActionState();
  };

  const changeProgram = (programId) => {
    setFilters((old) => ({
      ...old,
      program_id: programId,
      semester_id: "",
      to_semester_id: "",
    }));

    resetActionState();
  };

  const changeSemester = (semesterId) => {
    setFilters((old) => ({
      ...old,
      semester_id: semesterId,
      to_semester_id: "",
    }));

    resetActionState();
  };

  const changeStatus = (status) => {
    setFilters((old) => ({
      ...old,
      status,
    }));

    resetActionState();
  };

  // ====================================================
  // PROMOTE
  // ====================================================

  const promote = async () => {
    if (!selectionContextReady) {
      setError(
        "Select Batch, Program and Current Semester before promoting students."
      );
      return;
    }

    if (!selectedIds.length || !filters.to_semester_id) {
      return;
    }

    setPromoting(true);
    setError("");
    setResult(null);

    try {
      const response = await promoteStudentsBulk(
        selectedIds,
        filters.to_semester_id
      );

      setResult(response?.data || null);
      setSelectedIds([]);

      await load();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Bulk promotion failed"
      );
    } finally {
      setPromoting(false);
    }
  };

  // ====================================================
  // LOOKUP HELPERS FOR TABLE
  // ====================================================

  const programById = useMemo(
    () =>
      new Map(
        data.programs.map((program) => [
          String(program.id),
          program,
        ])
      ),
    [data.programs]
  );

  const batchById = useMemo(
    () =>
      new Map(
        data.batches.map((batch) => [
          String(batch.id),
          batch,
        ])
      ),
    [data.batches]
  );

  // ====================================================
  // UI
  // ====================================================

  return (
    <main className="min-h-full bg-slate-50 p-4 text-slate-700 dark:bg-slate-950 dark:text-slate-200 md:p-8">
      <PageHeader
        title="Student Promotion"
        description="Browse students with optional academic filters, then choose one Batch + Program + Current Semester cohort for promotion. Previous academic history is preserved and courses are not auto-enrolled."
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search name, Student ID, CNIC or email..."
      />

      <Alert message={error} />

      {result && (
        <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm dark:border-emerald-500/20 dark:bg-emerald-500/10">
          Promoted: <strong>{result.promoted ?? 0}</strong> · Skipped:{" "}
          <strong>{result.skipped ?? 0}</strong>. No course enrollments were created.

          {result.batch_current_semester_updated && (
            <span className="ml-1">
              Batch/Program current semester was also updated because the complete active cohort was promoted.
            </span>
          )}
        </div>
      )}

      {/* ===============================================
          OPTIONAL FILTERS
      =============================================== */}

      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <FormField label="Batch">
            <select
              className={inputClass}
              value={filters.batch_id}
              onChange={(event) => changeBatch(event.target.value)}
            >
              <option value="">All batches</option>

              {activeBatches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batchLabel(batch)}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Department">
            <select
              className={inputClass}
              value={filters.department_id}
              onChange={(event) =>
                changeDepartment(event.target.value)
              }
            >
              <option value="">All departments</option>

              {departmentOptions.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                  {department.code ? ` (${department.code})` : ""}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Program">
            <select
              className={inputClass}
              value={filters.program_id}
              onChange={(event) => changeProgram(event.target.value)}
            >
              <option value="">All programs</option>

              {programOptions.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.name}
                  {program.code ? ` (${program.code})` : ""}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Current Semester">
            <select
              className={inputClass}
              value={filters.semester_id}
              onChange={(event) => changeSemester(event.target.value)}
            >
              <option value="">All semesters</option>

              {semesterOptions.map((semester) => {
                const program = programById.get(
                  String(semester.program_id)
                );

                const includeProgramName = !filters.program_id;

                return (
                  <option key={semester.id} value={semester.id}>
                    {includeProgramName && program?.name
                      ? `${program.name} · `
                      : ""}
                    {semesterLabel(semester)}
                  </option>
                );
              })}
            </select>
          </FormField>

          <FormField label="Status">
            <select
              className={inputClass}
              value={filters.status}
              onChange={(event) => changeStatus(event.target.value)}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="all">All</option>
            </select>
          </FormField>

          {/* Promote To is an ACTION field, not a required browsing filter. */}
          <FormField label="Promote To">
            <select
              className={inputClass}
              value={filters.to_semester_id}
              disabled={!selectionContextReady}
              onChange={(event) => {
                setFilters((old) => ({
                  ...old,
                  to_semester_id: event.target.value,
                }));

                setSelectedIds([]);
                setResult(null);
                setError("");
              }}
            >
              <option value="">
                {selectionContextReady
                  ? "Select later semester"
                  : "Select Batch, Program & Current Semester"}
              </option>

              {targetSemesters.map((semester) => (
                <option key={semester.id} value={semester.id}>
                  {semesterLabel(semester)}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        {/* Batch/Program mapping information only. */}
        {selectedMapping && (
          <div className="mt-4 grid gap-2 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-700 sm:grid-cols-3 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
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
                {selectedMapping.entry_semester?.name ||
                  activeSemesters.find((semester) =>
                    sameId(
                      semester.id,
                      selectedMapping.entry_semester_id
                    )
                  )?.name ||
                  "Not configured"}
              </p>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
                Batch Current Semester
              </p>
              <p className="mt-1 font-semibold">
                {selectedMapping.current_semester?.name ||
                  activeSemesters.find((semester) =>
                    sameId(
                      semester.id,
                      selectedMapping.current_semester_id
                    )
                  )?.name ||
                  "Not configured"}
              </p>
            </div>
          </div>
        )}

        {!selectionContextReady && (
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Filters above are optional for browsing. To select and promote students in bulk, choose one Batch, Program and Current Semester.
          </p>
        )}
      </div>

      {/* ===============================================
          BULK ACTIONS
      =============================================== */}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() =>
            setSelectedIds(allSelected ? [] : selectableIds)
          }
          disabled={!selectableIds.length}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium disabled:opacity-50 dark:border-slate-700"
        >
          {allSelected ? "Clear Selection" : "Select All Visible"}
        </button>

        <button
          type="button"
          onClick={promote}
          disabled={
            !selectionContextReady ||
            !selectedIds.length ||
            !filters.to_semester_id ||
            promoting
          }
          className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {promoting
            ? "Promoting..."
            : `Promote ${selectedIds.length || ""} Student${
                selectedIds.length === 1 ? "" : "s"
              }`}
        </button>
      </div>

      {/* ===============================================
          STUDENTS TABLE
      =============================================== */}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {loading ? (
          <TableSkeleton columns={6} />
        ) : !filteredStudents.length ? (
          <EmptyState
            icon={GraduationCap}
            title="No students found"
            description="No students match the current search and academic filters."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] table-fixed text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  {[
                    "Select",
                    "Student",
                    "Student ID",
                    "Batch / Program",
                    "Current Semester",
                    "Status",
                  ].map((title) => (
                    <th key={title} className="px-5 py-4">
                      {title}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {filteredStudents.map((student) => {
                  const studentBatch = batchById.get(
                    String(student.batch_id)
                  );

                  const studentProgram = programById.get(
                    String(student.program_id)
                  );

                  const selectable =
                    selectionContextReady && student.is_active;

                  return (
                    <tr
                      key={student.id}
                      className="border-b border-slate-100 dark:border-slate-800"
                    >
                      <td className="px-5 py-4">
                        <input
                          type="checkbox"
                          disabled={!selectable}
                          checked={selectedIds.includes(student.id)}
                          onChange={() =>
                            setSelectedIds((old) =>
                              old.includes(student.id)
                                ? old.filter((id) => id !== student.id)
                                : [...old, student.id]
                            )
                          }
                        />
                      </td>

                      <td className="px-5 py-4">
                        <p className="font-semibold">
                          {student.full_name}
                        </p>

                        <p className="text-xs text-slate-500">
                          {student.email || student.cnic || "No contact"}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        {student.student_id || "—"}
                      </td>

                      <td className="px-5 py-4">
                        <p className="font-medium">
                          {studentBatch
                            ? batchLabel(studentBatch)
                            : "—"}
                        </p>

                        <p className="text-xs text-slate-500">
                          {studentProgram?.name || "Unknown program"}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        {student.linked_semester?.name ||
                          student.semester ||
                          activeSemesters.find((semester) =>
                            sameId(semester.id, student.semester_id)
                          )?.name ||
                          "—"}
                      </td>

                      <td className="px-5 py-4">
                        {student.is_active ? "Active" : "Inactive"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
