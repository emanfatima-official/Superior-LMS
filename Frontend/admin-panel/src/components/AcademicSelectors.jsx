import {
  useEffect,
  useMemo,
  useState,
} from "react";

import AcademicStructureService from "../services/AcademicStructureService";

// ======================================================
// HELPERS
// ======================================================

const unwrapArray = (response) => {
  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  if (
    Array.isArray(
      response?.data?.data
    )
  ) {
    return response.data.data;
  }

  return [];
};

const sameId = (
  first,
  second
) =>
  String(first || "") ===
  String(second || "");

const isActive = (item) =>
  item?.status !== "inactive";

// ======================================================
// INPUT STYLE
// ======================================================

const selectClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200";

// ======================================================
// ACADEMIC SELECTORS
//
// New Academic Structure:
//
// Department
//    ↓
// Program
//    ↓
// Semester
//
// Batch
//    ↓
// academic_batch_programs
//    ↓
// Program
//
// IMPORTANT:
// Semester behavior intentionally remains the same:
// once Program is selected, all active Semesters of that
// Program are available.
// ======================================================

function AcademicSelectors({
  value = {},
  onChange,

  disabled = false,
  required = false,

  showBatch = true,
  showDepartment = true,
  showProgram = true,
  showSemester = true,
}) {
  // ====================================================
  // MASTER DATA
  // ====================================================

  const [
    batches,
    setBatches,
  ] = useState([]);

  const [
    departments,
    setDepartments,
  ] = useState([]);

  const [
    programs,
    setPrograms,
  ] = useState([]);

  const [
    semesters,
    setSemesters,
  ] = useState([]);

  const [
    batchPrograms,
    setBatchPrograms,
  ] = useState([]);

  // ====================================================
  // LOADING
  // ====================================================

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    loadError,
    setLoadError,
  ] = useState("");

  // ====================================================
  // LOAD ALL ACADEMIC MASTER DATA
  //
  // We intentionally load the master tables separately
  // and use academic_batch_programs as the source of truth
  // for Batch membership.
  // ====================================================

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setLoadError("");

      try {
        const [
          batchResponse,
          departmentResponse,
          programResponse,
          semesterResponse,
          mappingResponse,
        ] = await Promise.all([
          AcademicStructureService.getBatches(),

          AcademicStructureService.getDepartments(),

          AcademicStructureService.getPrograms(),

          AcademicStructureService.getSemesters(),

          AcademicStructureService.getBatchPrograms(
            null,
            "active"
          ),
        ]);

        if (cancelled) {
          return;
        }

        setBatches(
          unwrapArray(
            batchResponse
          )
        );

        setDepartments(
          unwrapArray(
            departmentResponse
          )
        );

        setPrograms(
          unwrapArray(
            programResponse
          )
        );

        setSemesters(
          unwrapArray(
            semesterResponse
          )
        );

        setBatchPrograms(
          unwrapArray(
            mappingResponse
          )
        );
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error(
          "LOAD ACADEMIC SELECTORS ERROR:",
          error
        );

        setLoadError(
          error?.response?.data
            ?.message ||
            error?.message ||
            "Unable to load Academic Structure."
        );

        setBatches([]);
        setDepartments([]);
        setPrograms([]);
        setSemesters([]);
        setBatchPrograms([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  // ====================================================
  // ACTIVE BATCHES
  // ====================================================

  const batchOptions =
    useMemo(
      () =>
        batches
          .filter(
            isActive
          )
          .slice()
          .sort(
            (
              first,
              second
            ) => {
              const startDiff =
                Number(
                  second.start_year ||
                    0
                ) -
                Number(
                  first.start_year ||
                    0
                );

              if (startDiff) {
                return startDiff;
              }

              return (
                Number(
                  second.end_year ||
                    0
                ) -
                Number(
                  first.end_year ||
                    0
                )
              );
            }
          ),
      [
        batches,
      ]
    );

  // ====================================================
  // ACTIVE MAPPINGS FOR SELECTED BATCH
  // ====================================================

  const selectedBatchMappings =
    useMemo(() => {
      if (
        !showBatch ||
        !value?.batch_id
      ) {
        return [];
      }

      return batchPrograms.filter(
        (mapping) =>
          isActive(mapping) &&
          sameId(
            mapping.batch_id,
            value.batch_id
          )
      );
    }, [
      batchPrograms,
      showBatch,
      value?.batch_id,
    ]);

  // ====================================================
  // DEPARTMENT OPTIONS
  //
  // With Batch:
  // Batch -> mappings -> Programs -> Departments
  //
  // Without Batch:
  // All master Departments.
  // ====================================================

  const departmentOptions =
    useMemo(() => {
      const activeDepartments =
        departments.filter(
          isActive
        );

      if (!showBatch) {
        return activeDepartments
          .slice()
          .sort((a, b) =>
            String(
              a.name || ""
            ).localeCompare(
              String(
                b.name || ""
              )
            )
          );
      }

      if (
        !value?.batch_id
      ) {
        return [];
      }

      const mappedProgramIds =
        new Set(
          selectedBatchMappings.map(
            (mapping) =>
              String(
                mapping.program_id
              )
          )
        );

      const mappedDepartmentIds =
        new Set(
          programs
            .filter(
              (program) =>
                mappedProgramIds.has(
                  String(
                    program.id
                  )
                )
            )
            .map(
              (program) =>
                String(
                  program.department_id
                )
            )
        );

      return activeDepartments
        .filter(
          (department) =>
            mappedDepartmentIds.has(
              String(
                department.id
              )
            )
        )
        .sort((a, b) =>
          String(
            a.name || ""
          ).localeCompare(
            String(
              b.name || ""
            )
          )
        );
    }, [
      departments,
      programs,
      selectedBatchMappings,
      showBatch,
      value?.batch_id,
    ]);

  // ====================================================
  // PROGRAM OPTIONS
  //
  // With Batch:
  // Program must exist in academic_batch_programs.
  //
  // Without Batch:
  // Normal Department -> Program master relationship.
  // ====================================================

  const programOptions =
    useMemo(() => {
      if (
        !value?.department_id
      ) {
        return [];
      }

      const activePrograms =
        programs.filter(
          (program) =>
            isActive(program) &&
            sameId(
              program.department_id,
              value.department_id
            )
        );

      if (!showBatch) {
        return activePrograms
          .slice()
          .sort((a, b) =>
            String(
              a.name || ""
            ).localeCompare(
              String(
                b.name || ""
              )
            )
          );
      }

      if (
        !value?.batch_id
      ) {
        return [];
      }

      const mappedProgramIds =
        new Set(
          selectedBatchMappings.map(
            (mapping) =>
              String(
                mapping.program_id
              )
          )
        );

      return activePrograms
        .filter(
          (program) =>
            mappedProgramIds.has(
              String(
                program.id
              )
            )
        )
        .sort((a, b) =>
          String(
            a.name || ""
          ).localeCompare(
            String(
              b.name || ""
            )
          )
        );
    }, [
      programs,
      selectedBatchMappings,
      showBatch,
      value?.batch_id,
      value?.department_id,
    ]);

  // ====================================================
  // SEMESTER OPTIONS
  //
  // KEEPING EXISTING BEHAVIOR:
  // Program selected -> show that Program's Semesters.
  //
  // We are NOT auto-selecting current_semester_id here.
  // We are NOT changing the student's Semester behavior.
  // ====================================================

  const semesterOptions =
    useMemo(() => {
      if (
        !value?.program_id
      ) {
        return [];
      }

      return semesters
        .filter(
          (semester) =>
            isActive(
              semester
            ) &&
            sameId(
              semester.program_id,
              value.program_id
            )
        )
        .slice()
        .sort(
          (
            first,
            second
          ) =>
            Number(
              first.semester_number ||
                0
            ) -
            Number(
              second.semester_number ||
                0
            )
        );
    }, [
      semesters,
      value?.program_id,
    ]);

  // ====================================================
  // SELECTED BATCH-PROGRAM MAPPING
  //
  // Useful to show Admission Type / placement context.
  // This does NOT alter Semester automatically.
  // ====================================================

  const selectedMapping =
    useMemo(() => {
      if (
        !value?.batch_id ||
        !value?.program_id
      ) {
        return null;
      }

      return (
        selectedBatchMappings.find(
          (mapping) =>
            sameId(
              mapping.program_id,
              value.program_id
            )
        ) ||
        null
      );
    }, [
      selectedBatchMappings,
      value?.batch_id,
      value?.program_id,
    ]);

  // ====================================================
  // EMIT
  // ====================================================

  const emit = (patch) => {
    onChange?.({
      ...value,
      ...patch,
    });
  };

  // ====================================================
  // BATCH LABEL
  // ====================================================

  const batchLabel = (
    batch
  ) => {
    if (
      batch?.start_year &&
      batch?.end_year
    ) {
      return `${batch.start_year}–${batch.end_year}`;
    }

    return (
      batch?.name ||
      "Batch"
    );
  };

  // ====================================================
  // UI
  // ====================================================

  return (
    <div className="space-y-4">
      {/* ===============================================
          LOAD ERROR
      =============================================== */}

      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
          {loadError}
        </div>
      )}

      {/* ===============================================
          BATCH
      =============================================== */}

      {showBatch && (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Batch{" "}
            {required &&
              "*"}
          </label>

          <select
            value={
              value?.batch_id ||
              ""
            }
            onChange={(
              event
            ) =>
              emit({
                batch_id:
                  event.target
                    .value,

                // Batch changed:
                // downstream values must be selected again.
                department_id:
                  "",

                program_id:
                  "",

                semester_id:
                  "",
              })
            }
            disabled={
              disabled ||
              loading
            }
            required={
              required
            }
            className={
              selectClass
            }
          >
            <option value="">
              {loading
                ? "Loading Batches..."
                : "Select Batch"}
            </option>

            {batchOptions.map(
              (batch) => (
                <option
                  key={
                    batch.id
                  }
                  value={
                    batch.id
                  }
                >
                  {batchLabel(
                    batch
                  )}
                </option>
              )
            )}
          </select>
        </div>
      )}

      {/* ===============================================
          DEPARTMENT
      =============================================== */}

      {showDepartment && (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Department{" "}
            {required &&
              "*"}
          </label>

          <select
            value={
              value?.department_id ||
              ""
            }
            onChange={(
              event
            ) =>
              emit({
                department_id:
                  event.target
                    .value,

                program_id:
                  "",

                semester_id:
                  "",
              })
            }
            disabled={
              disabled ||
              loading ||
              (
                showBatch &&
                !value?.batch_id
              )
            }
            required={
              required
            }
            className={
              selectClass
            }
          >
            <option value="">
              {showBatch &&
              !value?.batch_id
                ? "Select Batch First"
                : loading
                  ? "Loading Departments..."
                  : "Select Department"}
            </option>

            {departmentOptions.map(
              (
                department
              ) => (
                <option
                  key={
                    department.id
                  }
                  value={
                    department.id
                  }
                >
                  {
                    department.name
                  }

                  {department.code
                    ? ` (${department.code})`
                    : ""}
                </option>
              )
            )}
          </select>

          {showBatch &&
            value?.batch_id &&
            !loading &&
            departmentOptions.length ===
              0 && (
              <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
                No active Programs are configured in this Batch.
              </p>
            )}
        </div>
      )}

      {/* ===============================================
          PROGRAM
      =============================================== */}

      {showProgram && (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Program{" "}
            {required &&
              "*"}
          </label>

          <select
            value={
              value?.program_id ||
              ""
            }
            onChange={(
              event
            ) =>
              emit({
                program_id:
                  event.target
                    .value,

                semester_id:
                  "",
              })
            }
            disabled={
              disabled ||
              loading ||
              !value
                ?.department_id
            }
            required={
              required
            }
            className={
              selectClass
            }
          >
            <option value="">
              {!value
                ?.department_id
                ? "Select Department First"
                : loading
                  ? "Loading Programs..."
                  : "Select Program"}
            </option>

            {programOptions.map(
              (program) => (
                <option
                  key={
                    program.id
                  }
                  value={
                    program.id
                  }
                >
                  {
                    program.name
                  }

                  {program.code
                    ? ` (${program.code})`
                    : ""}
                </option>
              )
            )}
          </select>

          {value
            ?.department_id &&
            !loading &&
            programOptions.length ===
              0 && (
              <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
                {showBatch
                  ? "No Program from this Department is configured in the selected Batch."
                  : "No active Program exists in this Department."}
              </p>
            )}
        </div>
      )}

      {/* ===============================================
          BATCH PROGRAM INFO
      =============================================== */}

      {showBatch &&
        value?.batch_id &&
        value?.program_id &&
        selectedMapping && (
          <div className="grid gap-2 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-700 sm:grid-cols-3 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
                Admission
              </p>

              <p className="mt-1 font-semibold capitalize">
                {selectedMapping.admission_type ||
                  "regular"}
              </p>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
                Entry Semester
              </p>

              <p className="mt-1 font-semibold">
                {selectedMapping
                  .entry_semester
                  ?.name ||
                  "Not configured"}
              </p>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
                Batch Current Semester
              </p>

              <p className="mt-1 font-semibold">
                {selectedMapping
                  .current_semester
                  ?.name ||
                  "Not configured"}
              </p>
            </div>
          </div>
        )}

      {/* ===============================================
          SEMESTER

          NOTE:
          Existing Semester behavior is intentionally
          preserved.
      =============================================== */}

      {showSemester && (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Semester{" "}
            {required &&
              "*"}
          </label>

          <select
            value={
              value?.semester_id ||
              ""
            }
            onChange={(
              event
            ) =>
              emit({
                semester_id:
                  event.target
                    .value,
              })
            }
            disabled={
              disabled ||
              loading ||
              !value
                ?.program_id
            }
            required={
              required
            }
            className={
              selectClass
            }
          >
            <option value="">
              {!value
                ?.program_id
                ? "Select Program First"
                : loading
                  ? "Loading Semesters..."
                  : "Select Semester"}
            </option>

            {semesterOptions.map(
              (
                semester
              ) => (
                <option
                  key={
                    semester.id
                  }
                  value={
                    semester.id
                  }
                >
                  {semester.name ||
                    `Semester ${semester.semester_number}`}
                </option>
              )
            )}
          </select>
        </div>
      )}
    </div>
  );
}

export default AcademicSelectors;