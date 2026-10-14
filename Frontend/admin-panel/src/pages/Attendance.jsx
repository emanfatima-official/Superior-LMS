import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import AcademicStructureService from "../services/AcademicStructureService";

import {
  getAttendanceExportData,
  getAttendanceOptions,
  getAttendanceOverview,
  getCourseAttendance,
  getSemesterAttendance,
  getStudentAttendance,
} from "../services/attendanceService";

import {
  exportRowsToCsv,
} from "../utils/exportData";

import {
  exportAttendanceWorkbook,
} from "../utils/attendanceExport";

// ======================================================
// CONSTANTS
// ======================================================

const PAGE_SIZE =
  8;

const emptyFilters = {
  batch_id: "",
  department_id: "",
  program_id: "",
  semester_id: "",
  course_assignment_id: "",
  student_id: "",
  date_from: "",
  date_to: "",
  status: "",
};

const fieldClass = `
  h-10
  w-full
  min-w-0
  rounded-xl
  border
  border-slate-200
  bg-white
  px-3
  text-sm
  text-slate-700
  outline-none
  transition
  focus:border-blue-500
  focus:ring-4
  focus:ring-blue-500/10
  disabled:cursor-not-allowed
  disabled:bg-slate-50
  disabled:text-slate-400
  dark:border-slate-700
  dark:bg-slate-900
  dark:text-slate-200
  dark:disabled:bg-slate-800/50
  dark:[color-scheme:dark]
`;

// ======================================================
// HELPERS
// ======================================================

const responseData = (
  response
) => {
  if (
    response?.data?.data !==
    undefined
  ) {
    return response.data.data;
  }

  if (
    response?.data !==
    undefined
  ) {
    return response.data;
  }

  return response || {};
};

const academicRows = (
  response
) => {
  const data =
    responseData(
      response
    );

  if (
    Array.isArray(
      data
    )
  ) {
    return data;
  }

  if (
    Array.isArray(
      data?.data
    )
  ) {
    return data.data;
  }

  return [];
};

const activeRows = (
  rows = []
) =>
  rows.filter(
    (
      row
    ) =>
      !row.status ||
      String(
        row.status
      ).toLowerCase() ===
        "active"
  );

const batchLabel = (
  batch
) =>
  batch?.start_year &&
  batch?.end_year
    ? `${batch.start_year}-${batch.end_year}`
    : batch?.name ||
      batch?.code ||
      "Batch";

const formatDate = (
  value
) => {
  if (!value) {
    return "—";
  }

  const date =
    new Date(
      `${value}T00:00:00`
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      day: "2-digit",
      month: "short",
    }
  ).format(date);
};

const titleCase = (
  value
) =>
  String(
    value || ""
  )
    .replace(
      /_/g,
      " "
    )
    .replace(
      /\b\w/g,
      (
        char
      ) =>
        char.toUpperCase()
    );

const statusShort = (
  status
) => {
  switch (
    status
  ) {
    case "present":
      return "P";

    case "absent":
      return "A";

    case "late":
      return "L";

    case "excused":
      return "LV";

    case "not_marked":
      return "—";

    default:
      return "—";
  }
};

const statusLabel = (
  status
) => {
  if (
    status ===
    "excused"
  ) {
    return "Leave";
  }

  if (
    status ===
    "not_marked"
  ) {
    return "Not Marked";
  }

  return titleCase(
    status
  );
};

const statusClasses = (
  status
) => {
  switch (
    status
  ) {
    case "present":
      return `
        border-emerald-200
        bg-emerald-50
        text-emerald-700
        dark:border-emerald-500/20
        dark:bg-emerald-500/10
        dark:text-emerald-300
      `;

    case "absent":
      return `
        border-red-200
        bg-red-50
        text-red-700
        dark:border-red-500/20
        dark:bg-red-500/10
        dark:text-red-300
      `;

    case "late":
      return `
        border-amber-200
        bg-amber-50
        text-amber-700
        dark:border-amber-500/20
        dark:bg-amber-500/10
        dark:text-amber-300
      `;

    case "excused":
      return `
        border-blue-200
        bg-blue-50
        text-blue-700
        dark:border-blue-500/20
        dark:bg-blue-500/10
        dark:text-blue-300
      `;

    default:
      return `
        border-slate-200
        bg-slate-50
        text-slate-400
        dark:border-slate-700
        dark:bg-slate-800/60
        dark:text-slate-500
      `;
  }
};

const csvSemesterRows = (
  report
) => {
  if (
    !report?.rows
  ) {
    return [];
  }

  return report.rows.map(
    (
      row
    ) => {
      const output = {
        Student:
          row.student
            ?.full_name ||
          "",

        "Student ID":
          row.student
            ?.student_id ||
          "",
      };

      (
        report.courses ||
        []
      ).forEach(
        (
          course
        ) => {
          const stats =
            row.courses?.[
              course.course_assignment_id
            ];

          const key =
            course.course_code ||
            course.name;

          output[key] =
            stats?.eligible
              ? `${stats.rate}%`
              : "";
        }
      );

      output[
        "Overall %"
      ] =
        row.overall
          ?.eligible
          ? `${row.overall.rate}%`
          : "";

      return output;
    }
  );
};

const csvCourseRegisterRows = (
  report
) => {
  if (
    !report?.rows
  ) {
    return [];
  }

  return report.rows.map(
    (
      row
    ) => {
      const output = {
        Student:
          row.student
            ?.full_name ||
          "",

        "Student ID":
          row.student
            ?.student_id ||
          "",
      };

      (
        report.sessions ||
        []
      ).forEach(
        (
          session,
          index
        ) => {
          const sameDateCount =
            (
              report.sessions ||
              []
            ).filter(
              (
                current
              ) =>
                current.attendance_date ===
                session.attendance_date
            ).length;

          let key =
            formatDate(
              session.attendance_date
            );

          if (
            sameDateCount >
            1
          ) {
            key +=
              ` #${session.session_number || index + 1}`;
          }

          if (
            session.title
          ) {
            key +=
              ` - ${session.title}`;
          }

          output[key] =
            statusLabel(
              row.cells?.[
                session.id
              ]?.status ||
                "not_marked"
            );
        }
      );

      output.Present =
        row.present;

      output.Absent =
        row.absent;

      output.Late =
        row.late;

      output.Leave =
        row.excused;

      output[
        "Not Marked"
      ] =
        row.not_marked;

      output[
        "Total Sessions"
      ] =
        row.total_sessions;

      output[
        "Attendance %"
      ] =
        row.eligible
          ? `${row.rate}%`
          : "";

      return output;
    }
  );
};

// ======================================================
// STAT CARD
// ======================================================

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "blue",
}) {
  const toneMap = {
    blue: `
      bg-blue-50
      text-blue-600
      dark:bg-blue-500/10
      dark:text-blue-400
    `,

    green: `
      bg-emerald-50
      text-emerald-600
      dark:bg-emerald-500/10
      dark:text-emerald-400
    `,

    red: `
      bg-red-50
      text-red-600
      dark:bg-red-500/10
      dark:text-red-400
    `,

    amber: `
      bg-amber-50
      text-amber-600
      dark:bg-amber-500/10
      dark:text-amber-400
    `,

    violet: `
      bg-violet-50
      text-violet-600
      dark:bg-violet-500/10
      dark:text-violet-400
    `,

    cyan: `
      bg-cyan-50
      text-cyan-600
      dark:bg-cyan-500/10
      dark:text-cyan-400
    `,
  };

  return (
    <div
      className="
        rounded-2xl
        border
        border-slate-200
        bg-white
        p-4
        shadow-sm
        transition
        hover:-translate-y-0.5
        hover:shadow-md
        dark:border-slate-800
        dark:bg-slate-900
      "
    >
      <div className="flex items-start gap-3">
        <div
          className={`
            flex
            h-11
            w-11
            shrink-0
            items-center
            justify-center
            rounded-xl
            ${toneMap[tone]}
          `}
        >
          <Icon
            size={
              20
            }
          />
        </div>

        <div className="min-w-0">
          <p
            className="
              truncate
              text-[11px]
              font-semibold
              uppercase
              tracking-wide
              text-slate-400
            "
          >
            {label}
          </p>

          <p
            className="
              mt-1
              text-2xl
              font-bold
              text-slate-900
              dark:text-white
            "
          >
            {value}
          </p>

          {hint ? (
            <p
              className="
                mt-1
                text-[11px]
                text-slate-400
              "
            >
              {hint}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ======================================================
// CHART TOOLTIP
// ======================================================

function ChartTooltip({
  active,
  payload,
  label,
}) {
  if (
    !active ||
    !payload?.length
  ) {
    return null;
  }

  return (
    <div
      className="
        min-w-[160px]
        rounded-xl
        border
        border-slate-200
        bg-white
        p-3
        shadow-xl
        dark:border-slate-700
        dark:bg-slate-900
      "
    >
      <p
        className="
          mb-2
          text-xs
          font-bold
          text-slate-800
          dark:text-white
        "
      >
        {label}
      </p>

      <div className="space-y-1.5">
        {payload.map(
          (
            item
          ) => (
            <div
              key={
                item.dataKey
              }
              className="
                flex
                items-center
                justify-between
                gap-5
                text-xs
              "
            >
              <span
                style={{
                  color:
                    item.color,
                }}
              >
                {
                  item.name
                }
              </span>

              <span
                className="
                  font-semibold
                  text-slate-700
                  dark:text-slate-200
                "
              >
                {
                  item.value
                }

                {item.dataKey ===
                "rate"
                  ? "%"
                  : ""}
              </span>
            </div>
          )
        )}
      </div>
    </div>
  );
}

// ======================================================
// EMPTY PANEL
// ======================================================

function EmptyPanel({
  children,
}) {
  return (
    <div
      className="
        flex
        min-h-[220px]
        items-center
        justify-center
        rounded-xl
        border
        border-dashed
        border-slate-300
        bg-slate-50/50
        px-6
        text-center
        text-sm
        text-slate-500
        dark:border-slate-700
        dark:bg-slate-900/40
        dark:text-slate-400
      "
    >
      {children}
    </div>
  );
}

// ======================================================
// STATUS BADGE
// ======================================================

function AttendanceBadge({
  status,
}) {
  return (
    <span
      title={
        statusLabel(
          status
        )
      }
      className={`
        inline-flex
        min-w-[34px]
        items-center
        justify-center
        rounded-lg
        border
        px-2
        py-1.5
        text-[11px]
        font-bold
        ${statusClasses(
          status
        )}
      `}
    >
      {statusShort(
        status
      )}
    </span>
  );
}

// ======================================================
// PAGE
// ======================================================

function Attendance() {
  const [
    filters,
    setFilters,
  ] =
    useState(
      emptyFilters
    );

  const [
    appliedFilters,
    setAppliedFilters,
  ] =
    useState(
      emptyFilters
    );

  const [
    batches,
    setBatches,
  ] =
    useState([]);

  const [
    batchPrograms,
    setBatchPrograms,
  ] =
    useState([]);

  const [
    departments,
    setDepartments,
  ] =
    useState([]);

  const [
    programs,
    setPrograms,
  ] =
    useState([]);

  const [
    semesters,
    setSemesters,
  ] =
    useState([]);

  const [
    options,
    setOptions,
  ] =
    useState({
      courses: [],
      students: [],
    });

  const [
    overview,
    setOverview,
  ] =
    useState(null);

  const [
    report,
    setReport,
  ] =
    useState(null);

  const [
    activeTab,
    setActiveTab,
  ] =
    useState(
      "overview"
    );

  const [
    courseView,
    setCourseView,
  ] =
    useState(
      "summary"
    );

  const [
    loadingMeta,
    setLoadingMeta,
  ] =
    useState(true);

  const [
    loadingReport,
    setLoadingReport,
  ] =
    useState(true);

  const [
    exporting,
    setExporting,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    page,
    setPage,
  ] =
    useState(1);

  // ====================================================
  // ACADEMIC STRUCTURE
  //
  // Latest structure:
  // Department -> Program -> Semester
  // Batch <-> Program through academic_batch_programs
  //
  // All filter fields remain optional. Selecting an
  // upstream value only narrows the options that follow.
  // ====================================================

  useEffect(
    () => {
      let active =
        true;

      const load =
        async () => {
          setLoadingMeta(
            true
          );

          try {
            const [
              batchResponse,
              mappingResponse,
              departmentResponse,
              programResponse,
              semesterResponse,
            ] =
              await Promise.all([
                AcademicStructureService.getBatches(),
                AcademicStructureService.getBatchPrograms(
                  null,
                  "active"
                ),
                AcademicStructureService.getDepartments(),
                AcademicStructureService.getPrograms(),
                AcademicStructureService.getSemesters(),
              ]);

            if (!active) {
              return;
            }

            setBatches(
              activeRows(
                academicRows(
                  batchResponse
                )
              )
            );

            setBatchPrograms(
              activeRows(
                academicRows(
                  mappingResponse
                )
              )
            );

            setDepartments(
              activeRows(
                academicRows(
                  departmentResponse
                )
              )
            );

            setPrograms(
              activeRows(
                academicRows(
                  programResponse
                )
              )
            );

            setSemesters(
              activeRows(
                academicRows(
                  semesterResponse
                )
              )
            );
          } catch (
            err
          ) {
            if (
              active
            ) {
              setError(
                err?.response
                  ?.data
                  ?.message ||
                  err?.message ||
                  "Unable to load academic structure."
              );
            }
          } finally {
            if (
              active
            ) {
              setLoadingMeta(
                false
              );
            }
          }
        };

      load();

      return () => {
        active =
          false;
      };
    },
    []
  );

  const sameId =
    (first, second) =>
      String(
        first || ""
      ) ===
      String(
        second || ""
      );

  // Batch mappings are the source of truth for which
  // Programs are actually running in a Batch.
  const selectedBatchMappings =
    useMemo(
      () => {
        if (
          !filters.batch_id
        ) {
          return batchPrograms;
        }

        return batchPrograms.filter(
          (mapping) =>
            sameId(
              mapping.batch_id,
              filters.batch_id
            )
        );
      },
      [
        batchPrograms,
        filters.batch_id,
      ]
    );

  // All Departments are available when no Batch is
  // selected. With a Batch selected, only Departments
  // that own at least one mapped Program remain.
  const availableDepartments =
    useMemo(
      () => {
        if (
          !filters.batch_id
        ) {
          return departments;
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

        const departmentIds =
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

        return departments.filter(
          (department) =>
            departmentIds.has(
              String(
                department.id
              )
            )
        );
      },
      [
        departments,
        filters.batch_id,
        programs,
        selectedBatchMappings,
      ]
    );

  // Program options honor whichever upstream filters are
  // selected. Neither Batch nor Department is required.
  const availablePrograms =
    useMemo(
      () => {
        let rows =
          programs;

        if (
          filters.department_id
        ) {
          rows =
            rows.filter(
              (program) =>
                sameId(
                  program.department_id,
                  filters.department_id
                )
            );
        }

        if (
          filters.batch_id
        ) {
          const mappedProgramIds =
            new Set(
              selectedBatchMappings.map(
                (mapping) =>
                  String(
                    mapping.program_id
                  )
              )
            );

          rows =
            rows.filter(
              (program) =>
                mappedProgramIds.has(
                  String(
                    program.id
                  )
                )
            );
        }

        return rows;
      },
      [
        filters.batch_id,
        filters.department_id,
        programs,
        selectedBatchMappings,
      ]
    );

  // Semester behavior stays the same: Semester is a
  // Program master record. Filters only narrow which
  // Program semesters are visible; no current Semester is
  // auto-forced here.
  const availableSemesters =
    useMemo(
      () => {
        let allowedProgramIds =
          null;

        if (
          filters.program_id
        ) {
          allowedProgramIds =
            new Set([
              String(
                filters.program_id
              ),
            ]);
        } else if (
          filters.department_id ||
          filters.batch_id
        ) {
          allowedProgramIds =
            new Set(
              availablePrograms.map(
                (program) =>
                  String(
                    program.id
                  )
              )
            );
        }

        if (
          !allowedProgramIds
        ) {
          return semesters;
        }

        return semesters.filter(
          (semester) =>
            allowedProgramIds.has(
              String(
                semester.program_id
              )
            )
        );
      },
      [
        availablePrograms,
        filters.batch_id,
        filters.department_id,
        filters.program_id,
        semesters,
      ]
    );

  const changeBatch =
    (batchId) => {
      setFilters(
        (current) => ({
          ...current,

          batch_id:
            batchId,

          department_id:
            "",

          program_id:
            "",

          semester_id:
            "",

          course_assignment_id:
            "",

          student_id:
            "",
        })
      );
    };

  const changeDepartment =
    (departmentId) => {
      setFilters(
        (current) => ({
          ...current,

          department_id:
            departmentId,

          program_id:
            "",

          semester_id:
            "",

          course_assignment_id:
            "",

          student_id:
            "",
        })
      );
    };

  const changeProgram =
    (programId) => {
      setFilters(
        (current) => ({
          ...current,

          program_id:
            programId,

          semester_id:
            "",

          course_assignment_id:
            "",

          student_id:
            "",
        })
      );
    };

  // ====================================================
  // COURSE / STUDENT OPTIONS
  // ====================================================

  const loadOptions =
    useCallback(
      async (
        sourceFilters
      ) => {
        try {
          const response =
            await getAttendanceOptions(
              sourceFilters
            );

          const data =
            responseData(
              response
            );

          setOptions({
            courses:
              Array.isArray(
                data?.courses
              )
                ? data.courses
                : [],

            students:
              Array.isArray(
                data?.students
              )
                ? data.students
                : [],
          });
        } catch (
          err
        ) {
          setOptions({
            courses: [],
            students: [],
          });

          setError(
            err?.response
              ?.data
              ?.message ||
              err?.message ||
              "Unable to load attendance options."
          );
        }
      },
      []
    );

  useEffect(
    () => {
      loadOptions({
        batch_id:
          filters.batch_id ||
          undefined,

        department_id:
          filters.department_id ||
          undefined,

        program_id:
          filters.program_id ||
          undefined,

        semester_id:
          filters.semester_id ||
          undefined,

        course_assignment_id:
          filters.course_assignment_id ||
          undefined,
      });
    },
    [
      filters.batch_id,
      filters.department_id,
      filters.program_id,
      filters.semester_id,
      filters.course_assignment_id,
      loadOptions,
    ]
  );

  // ====================================================
  // REQUEST PARAMS
  // ====================================================

  const buildRequestParams =
    useCallback(
      (
        source
      ) => {
        const params =
          {};

        Object.entries(
          source
        ).forEach(
          ([
            key,
            value,
          ]) => {
            if (
              value !==
                "" &&
              value !==
                null &&
              value !==
                undefined
            ) {
              params[
                key
              ] =
                value;
            }
          }
        );

        return params;
      },
      []
    );

  // ====================================================
  // LOAD OVERVIEW
  // ====================================================

  const loadOverview =
    useCallback(
      async (
        sourceFilters
      ) => {
        const params =
          buildRequestParams(
            sourceFilters
          );

        const response =
          await getAttendanceOverview(
            params
          );

        return responseData(
          response
        );
      },
      [
        buildRequestParams,
      ]
    );

  // ====================================================
  // LOAD ACTIVE REPORT
  // ====================================================

  const loadReport =
    useCallback(
      async (
        tab,
        sourceFilters
      ) => {
        const params =
          buildRequestParams(
            sourceFilters
          );

        if (
          tab ===
          "semester"
        ) {
          if (
            !sourceFilters.semester_id
          ) {
            return null;
          }

          const response =
            await getSemesterAttendance(
              params
            );

          return responseData(
            response
          );
        }

        if (
          tab ===
          "course"
        ) {
          if (
            !sourceFilters.course_assignment_id
          ) {
            return null;
          }

          const response =
            await getCourseAttendance(
              params
            );

          return responseData(
            response
          );
        }

        if (
          tab ===
          "student"
        ) {
          if (
            !sourceFilters.student_id
          ) {
            return null;
          }

          const response =
            await getStudentAttendance(
              params
            );

          return responseData(
            response
          );
        }

        return null;
      },
      [
        buildRequestParams,
      ]
    );

  // ====================================================
  // APPLY FILTERS
  // ====================================================

  const applyFilters =
    async () => {
      const next = {
        ...filters,
      };

      setAppliedFilters(
        next
      );

      setError("");

      setLoadingReport(
        true
      );

      try {
        const [
          nextOverview,
          nextReport,
        ] =
          await Promise.all([
            loadOverview(
              next
            ),

            loadReport(
              activeTab,
              next
            ),
          ]);

        setOverview(
          nextOverview
        );

        setReport(
          nextReport
        );
      } catch (
        err
      ) {
        setError(
          err?.response
            ?.data
            ?.message ||
            err?.message ||
            "Unable to load attendance report."
        );
      } finally {
        setLoadingReport(
          false
        );
      }
    };

  // ====================================================
  // INITIAL OVERVIEW
  // ====================================================

  useEffect(
    () => {
      let active =
        true;

      const run =
        async () => {
          setLoadingReport(
            true
          );

          try {
            const nextOverview =
              await loadOverview(
                emptyFilters
              );

            if (
              active
            ) {
              setOverview(
                nextOverview
              );
            }
          } catch (
            err
          ) {
            if (
              active
            ) {
              setError(
                err?.response
                  ?.data
                  ?.message ||
                  err?.message ||
                  "Unable to load attendance overview."
              );
            }
          } finally {
            if (
              active
            ) {
              setLoadingReport(
                false
              );
            }
          }
        };

      run();

      return () => {
        active =
          false;
      };
    },
    [
      loadOverview,
    ]
  );

  // ====================================================
  // TAB CHANGE
  // ====================================================

  const handleTabChange =
    async (
      tab
    ) => {
      setActiveTab(
        tab
      );

      setReport(
        null
      );

      setSearch(
        ""
      );

      setPage(
        1
      );

      if (
        tab ===
        "overview"
      ) {
        return;
      }

      setLoadingReport(
        true
      );

      try {
        const nextReport =
          await loadReport(
            tab,
            appliedFilters
          );

        setReport(
          nextReport
        );
      } catch (
        err
      ) {
        setError(
          err?.response
            ?.data
            ?.message ||
            err?.message ||
            "Unable to load attendance report."
        );
      } finally {
        setLoadingReport(
          false
        );
      }
    };

  // ====================================================
  // CLEAR FILTERS
  // ====================================================

  const clearFilters =
    async () => {
      setFilters(
        emptyFilters
      );

      setAppliedFilters(
        emptyFilters
      );

      setOptions({
        courses: [],
        students: [],
      });

      setSearch(
        ""
      );

      setPage(
        1
      );

      setCourseView(
        "summary"
      );

      setError("");

      setLoadingReport(
        true
      );

      try {
        const nextOverview =
          await loadOverview(
            emptyFilters
          );

        setOverview(
          nextOverview
        );

        if (
          activeTab !==
          "overview"
        ) {
          setReport(
            null
          );
        }
      } catch (
        err
      ) {
        setError(
          err?.response
            ?.data
            ?.message ||
            err?.message ||
            "Unable to reset attendance."
        );
      } finally {
        setLoadingReport(
          false
        );
      }
    };

  // ====================================================
  // EXPORT
  // ====================================================

  const handleExport =
    async (
      type
    ) => {
      setExporting(
        true
      );

      setError("");

      try {
        const requestParams =
          buildRequestParams(
            appliedFilters
          );

        const stamp =
          new Date()
            .toISOString()
            .slice(
              0,
              10
            );

        if (
          type ===
          "csv"
        ) {
          if (
            activeTab ===
              "semester" &&
            report?.rows
          ) {
            exportRowsToCsv(
              csvSemesterRows(
                report
              ),
              undefined,
              `semester-attendance-${stamp}`
            );

            return;
          }

          if (
            activeTab ===
              "course" &&
            courseView ===
              "register" &&
            report?.rows
          ) {
            exportRowsToCsv(
              csvCourseRegisterRows(
                report
              ),
              undefined,
              `course-date-wise-attendance-${stamp}`
            );

            return;
          }

          if (
            activeTab ===
              "course" &&
            report?.rows
          ) {
            const rows =
              report.rows.map(
                (
                  row
                ) => ({
                  Student:
                    row.student
                      ?.full_name ||
                    "",

                  "Student ID":
                    row.student
                      ?.student_id ||
                    "",

                  Present:
                    row.present,

                  Absent:
                    row.absent,

                  Late:
                    row.late,

                  Leave:
                    row.excused,

                  "Not Marked":
                    row.not_marked,

                  "Total Sessions":
                    row.total_sessions,

                  "Attendance %":
                    row.eligible
                      ? `${row.rate}%`
                      : "",
                })
              );

            exportRowsToCsv(
              rows,
              undefined,
              `course-attendance-${stamp}`
            );

            return;
          }

          const response =
            await getAttendanceExportData(
              requestParams
            );

          const data =
            responseData(
              response
            );

          exportRowsToCsv(
            data.session_rows ||
              [],
            undefined,
            `attendance-log-${stamp}`
          );

          return;
        }

        const response =
          await getAttendanceExportData(
            requestParams
          );

        exportAttendanceWorkbook(
          responseData(
            response
          ),
          `attendance-${stamp}`
        );
      } catch (
        err
      ) {
        setError(
          err?.response
            ?.data
            ?.message ||
            err?.message ||
            "Unable to export attendance."
        );
      } finally {
        setExporting(
          false
        );
      }
    };

  // ====================================================
  // CHART DATA
  // ====================================================

  const trendData =
    useMemo(
      () =>
        (
          overview?.trend ||
          []
        )
          .slice(
            -12
          )
          .map(
            (
              row
            ) => ({
              ...row,

              label:
                formatDate(
                  row.date
                ),
            })
          ),
      [
        overview,
      ]
    );

  const courseChartData =
    useMemo(
      () =>
        (
          overview
            ?.course_summary ||
          []
        )
          .slice()
          .sort(
            (
              a,
              b
            ) =>
              b.rate -
              a.rate
          )
          .slice(
            0,
            7
          )
          .map(
            (
              row
            ) => ({
              name: [
                row.course_code || row.name,
                row.program?.code,
                row.semester?.semester_number
                  ? `S${row.semester.semester_number}`
                  : "",
              ]
                .filter(Boolean)
                .join(" · "),

              rate:
                row.rate,
            })
          ),
      [
        overview,
      ]
    );

  // ====================================================
  // OVERVIEW TABLE FILTER
  // ====================================================

  const filteredCourses =
    useMemo(
      () => {
        const query =
          search
            .trim()
            .toLowerCase();

        return (
          overview
            ?.course_summary ||
          []
        ).filter(
          (
            row
          ) =>
            !query ||
            String(
              row.name ||
                ""
            )
              .toLowerCase()
              .includes(
                query
              ) ||
            String(
              row.course_code ||
                ""
            )
              .toLowerCase()
              .includes(
                query
              ) ||
            String(
              row.teacher
                ?.full_name ||
                ""
            )
              .toLowerCase()
              .includes(
                query
              ) ||
            String(row.class_label || "")
              .toLowerCase()
              .includes(query)
        );
      },
      [
        overview,
        search,
      ]
    );

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filteredCourses.length /
          PAGE_SIZE
      )
    );

  const safePage =
    Math.min(
      page,
      totalPages
    );

  const pageStart =
    (
      safePage -
      1
    ) *
    PAGE_SIZE;

  const pageRows =
    filteredCourses.slice(
      pageStart,
      pageStart +
        PAGE_SIZE
    );

  useEffect(
    () => {
      setPage(
        1
      );
    },
    [
      search,
    ]
  );

  // ====================================================
  // SUMMARY / TABS
  // ====================================================

  const summary =
    overview?.summary ||
    {};

  const tabs = [
    [
      "overview",
      "Overview",
    ],

    [
      "semester",
      "Semester",
    ],

    [
      "course",
      "Course",
    ],

    [
      "student",
      "Student",
    ],
  ];

  // ====================================================
  // RENDER
  // ====================================================

  return (
    <main
      className="
        min-h-full
        bg-slate-50
        p-4
        text-slate-700
        dark:bg-slate-950
        dark:text-slate-200
        md:p-8
      "
    >
      {/* HEADER */}

      <div
        className="
          mb-6
          flex
          flex-col
          gap-4
          xl:flex-row
          xl:items-center
          xl:justify-between
        "
      >
        <div>
          <h1
            className="
              text-2xl
              font-bold
              text-slate-900
              dark:text-white
            "
          >
            Attendance
          </h1>

          <p
            className="
              mt-1
              max-w-3xl
              text-sm
              text-slate-500
              dark:text-slate-400
            "
          >
            Monitor LMS attendance, compare semester
            courses, review date-wise registers and export
            complete attendance reports.
          </p>
        </div>

        <div
          className="
            grid
            grid-cols-2
            gap-2
            sm:flex
            sm:w-auto
          "
        >
          <button
            type="button"
            onClick={() =>
              handleExport(
                "csv"
              )
            }
            disabled={
              exporting
            }
            className="
              inline-flex
              h-10
              items-center
              justify-center
              gap-2
              rounded-xl
              border
              border-slate-200
              bg-white
              px-4
              text-xs
              font-semibold
              text-slate-600
              transition
              hover:border-blue-300
              hover:text-blue-600
              disabled:opacity-50
              dark:border-slate-700
              dark:bg-slate-900
              dark:text-slate-300
            "
          >
            <Download
              size={
                15
              }
            />

            CSV
          </button>

          <button
            type="button"
            onClick={() =>
              handleExport(
                "excel"
              )
            }
            disabled={
              exporting
            }
            className="
              inline-flex
              h-10
              items-center
              justify-center
              gap-2
              rounded-xl
              bg-blue-600
              px-4
              text-xs
              font-semibold
              text-white
              transition
              hover:bg-blue-700
              disabled:opacity-50
            "
          >
            {exporting ? (
              <Loader2
                size={
                  15
                }
                className="animate-spin"
              />
            ) : (
              <FileSpreadsheet
                size={
                  15
                }
              />
            )}

            Excel
          </button>
        </div>
      </div>

      {/* FILTERS */}

      <section
        className="
          mb-5
          rounded-2xl
          border
          border-slate-200
          bg-white
          p-4
          shadow-sm
          dark:border-slate-800
          dark:bg-slate-900
        "
      >
        <div
          className="
            grid
            gap-3
            md:grid-cols-2
            xl:grid-cols-4
          "
        >
          {/* BATCH */}

          <select
            value={
              filters.batch_id
            }
            onChange={(
              event
            ) =>
              changeBatch(
                event
                  .target
                  .value
              )
            }
            className={
              fieldClass
            }
            disabled={
              loadingMeta
            }
          >
            <option value="">
              All Batches
            </option>

            {batches.map(
              (
                batch
              ) => (
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

          {/* DEPARTMENT */}

          <select
            value={
              filters.department_id
            }
            onChange={(
              event
            ) =>
              changeDepartment(
                event
                  .target
                  .value
              )
            }
            className={
              fieldClass
            }
          >
            <option value="">
              All Departments
            </option>

            {availableDepartments.map(
              (
                row
              ) => (
                <option
                  key={
                    row.id
                  }
                  value={
                    row.id
                  }
                >
                  {
                    row.name
                  }
                </option>
              )
            )}
          </select>

          {/* PROGRAM */}

          <select
            value={
              filters.program_id
            }
            onChange={(
              event
            ) =>
              changeProgram(
                event
                  .target
                  .value
              )
            }
            className={
              fieldClass
            }
          >
            <option value="">
              All Programs
            </option>

            {availablePrograms.map(
              (
                row
              ) => (
                <option
                  key={
                    row.id
                  }
                  value={
                    row.id
                  }
                >
                  {
                    row.name
                  }
                </option>
              )
            )}
          </select>

          {/* SEMESTER */}

          <select
            value={
              filters.semester_id
            }
            onChange={(
              event
            ) =>
              setFilters(
                (
                  current
                ) => ({
                  ...current,

                  semester_id:
                    event
                      .target
                      .value,

                  course_assignment_id:
                    "",

                  student_id:
                    "",
                })
              )
            }
            className={
              fieldClass
            }
          >
            <option value="">
              All Semesters
            </option>

            {availableSemesters.map(
              (
                row
              ) => (
                <option
                  key={
                    row.id
                  }
                  value={
                    row.id
                  }
                >
                  {
                    row.name
                  }
                </option>
              )
            )}
          </select>

          {/* COURSE */}

          <select
            value={
              filters.course_assignment_id
            }
            onChange={(
              event
            ) =>
              setFilters(
                (
                  current
                ) => ({
                  ...current,

                  course_assignment_id:
                    event
                      .target
                      .value,

                  student_id:
                    "",
                })
              )
            }
            className={
              fieldClass
            }
          >
            <option value="">
              All Courses
            </option>

            {options.courses.map(
              (
                row
              ) => (
                <option
                  key={
                    row.course_assignment_id
                  }
                  value={
                    row.course_assignment_id
                  }
                >
                  {row.course_code
                    ? `${row.course_code} - ${row.name}`
                    : row.name}
                </option>
              )
            )}
          </select>

          {/* STUDENT */}

          <select
            value={
              filters.student_id
            }
            onChange={(
              event
            ) =>
              setFilters(
                (
                  current
                ) => ({
                  ...current,

                  student_id:
                    event
                      .target
                      .value,
                })
              )
            }
            className={
              fieldClass
            }
          >
            <option value="">
              All Students
            </option>

            {options.students.map(
              (
                student
              ) => (
                <option
                  key={
                    student.id
                  }
                  value={
                    student.id
                  }
                >
                  {student.full_name}

                  {student.student_id
                    ? ` · ${student.student_id}`
                    : ""}
                </option>
              )
            )}
          </select>

          {/* DATE FROM */}

          <input
            type="date"
            value={
              filters.date_from
            }
            onChange={(
              event
            ) =>
              setFilters(
                (
                  current
                ) => ({
                  ...current,

                  date_from:
                    event
                      .target
                      .value,
                })
              )
            }
            className={
              fieldClass
            }
          />

          {/* DATE TO */}

          <input
            type="date"
            value={
              filters.date_to
            }
            onChange={(
              event
            ) =>
              setFilters(
                (
                  current
                ) => ({
                  ...current,

                  date_to:
                    event
                      .target
                      .value,
                })
              )
            }
            className={
              fieldClass
            }
          />
        </div>

        <div
          className="
            mt-3
            flex
            flex-col
            gap-2
            sm:flex-row
            sm:items-center
            sm:justify-end
          "
        >
          <button
            type="button"
            onClick={
              clearFilters
            }
            className="
              h-10
              rounded-xl
              border
              border-slate-200
              bg-white
              px-4
              text-sm
              font-semibold
              text-slate-600
              transition
              hover:bg-slate-50
              dark:border-slate-700
              dark:bg-slate-900
              dark:text-slate-300
              dark:hover:bg-slate-800
            "
          >
            Clear
          </button>

          <button
            type="button"
            onClick={
              applyFilters
            }
            className="
              h-10
              rounded-xl
              bg-blue-600
              px-5
              text-sm
              font-semibold
              text-white
              transition
              hover:bg-blue-700
            "
          >
            Apply
          </button>
        </div>

        <p className="mt-3 text-[11px] text-slate-400">
          Select a Semester for course-wise attendance. Select
          a Course with a date range for the date-wise
          attendance register.
        </p>
      </section>

      {/* ERROR */}

      {error ? (
        <div
          className="
            mb-5
            rounded-xl
            border
            border-red-200
            bg-red-50
            px-4
            py-3
            text-sm
            text-red-700
            dark:border-red-500/20
            dark:bg-red-500/10
            dark:text-red-300
          "
        >
          {error}
        </div>
      ) : null}

      {/* TABS */}

      <div
        className="
          mb-5
          grid
          grid-cols-2
          gap-1
          rounded-xl
          border
          border-slate-200
          bg-white
          p-1.5
          dark:border-slate-800
          dark:bg-slate-900
          sm:grid-cols-4
        "
      >
        {tabs.map(
          ([
            key,
            label,
          ]) => (
            <button
              key={
                key
              }
              type="button"
              onClick={() =>
                handleTabChange(
                  key
                )
              }
              className={`
                rounded-lg
                px-3
                py-2.5
                text-xs
                font-semibold
                transition
                ${
                  activeTab ===
                  key
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                }
              `}
            >
              {label}
            </button>
          )
        )}
      </div>

      {/* LOADING */}

      {loadingReport ? (
        <div
          className="
            flex
            min-h-[320px]
            items-center
            justify-center
            rounded-2xl
            border
            border-slate-200
            bg-white
            dark:border-slate-800
            dark:bg-slate-900
          "
        >
          <Loader2
            size={
              28
            }
            className="animate-spin text-blue-500"
          />
        </div>
      ) : null}

      {/* OVERVIEW */}

      {!loadingReport &&
      activeTab ===
        "overview" ? (
        <div className="space-y-5">
          {/* SUMMARY */}

          <div
            className="
              grid
              gap-4
              sm:grid-cols-2
              xl:grid-cols-4
            "
          >
            <StatCard
              icon={
                BarChart3
              }
              label="Overall Attendance"
              value={`${Math.round(
                summary.overall_rate ||
                  0
              )}%`}
              hint="Present + late"
              tone="blue"
            />

            <StatCard
              icon={
                CalendarDays
              }
              label="Sessions"
              value={
                summary.total_sessions ||
                0
              }
              hint="Conducted sessions"
              tone="violet"
            />

            <StatCard
              icon={
                CheckCircle2
              }
              label="Present Today"
              value={
                summary.present_today ||
                0
              }
              hint="Present marks"
              tone="green"
            />

            <StatCard
              icon={
                AlertTriangle
              }
              label="At Risk"
              value={
                summary.at_risk_students ||
                0
              }
              hint={`Below ${
                summary.threshold ||
                75
              }%`}
              tone="red"
            />
          </div>

          {/* CHARTS */}

          <div
            className="
              grid
              gap-5
              xl:grid-cols-2
            "
          >
            <section
              className="
                rounded-2xl
                border
                border-slate-200
                bg-white
                p-4
                shadow-sm
                dark:border-slate-800
                dark:bg-slate-900
              "
            >
              <h2
                className="
                  font-bold
                  text-slate-900
                  dark:text-white
                "
              >
                Attendance Trend
              </h2>

              <p className="mt-1 text-xs text-slate-400">
                Recent attendance activity
              </p>

              {!trendData.length ? (
                <EmptyPanel>
                  No attendance trend is available.
                </EmptyPanel>
              ) : (
                <div className="mt-4 h-72">
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                  >
                    <AreaChart
                      data={
                        trendData
                      }
                      margin={{
                        top: 10,
                        right: 10,
                        left: -15,
                        bottom: 0,
                      }}
                    >
                      <defs>
                        <linearGradient
                          id="attendancePageArea"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#3b82f6"
                            stopOpacity={
                              0.3
                            }
                          />

                          <stop
                            offset="95%"
                            stopColor="#3b82f6"
                            stopOpacity={
                              0.02
                            }
                          />
                        </linearGradient>
                      </defs>

                      <CartesianGrid
                        vertical={
                          false
                        }
                        strokeOpacity={
                          0.15
                        }
                      />

                      <XAxis
                        dataKey="label"
                        tickLine={
                          false
                        }
                        axisLine={
                          false
                        }
                        tick={{
                          fontSize: 10,
                          fill: "#94a3b8",
                        }}
                      />

                      <YAxis
                        domain={[
                          0,
                          100,
                        ]}
                        tickFormatter={(
                          value
                        ) =>
                          `${value}%`
                        }
                        tickLine={
                          false
                        }
                        axisLine={
                          false
                        }
                        tick={{
                          fontSize: 10,
                          fill: "#94a3b8",
                        }}
                      />

                      <Tooltip
                        content={
                          <ChartTooltip />
                        }
                      />

                      <Area
                        type="monotone"
                        dataKey="rate"
                        name="Attendance"
                        stroke="#3b82f6"
                        strokeWidth={
                          3
                        }
                        fill="url(#attendancePageArea)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            <section
              className="
                rounded-2xl
                border
                border-slate-200
                bg-white
                p-4
                shadow-sm
                dark:border-slate-800
                dark:bg-slate-900
              "
            >
              <h2
                className="
                  font-bold
                  text-slate-900
                  dark:text-white
                "
              >
                Course Attendance
              </h2>

              <p className="mt-1 text-xs text-slate-400">
                Attendance percentage by course
              </p>

              {!courseChartData.length ? (
                <EmptyPanel>
                  No course attendance data is available.
                </EmptyPanel>
              ) : (
                <div className="mt-4 h-72">
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                  >
                    <BarChart
                      data={
                        courseChartData
                      }
                      margin={{
                        top: 10,
                        right: 10,
                        left: -15,
                        bottom: 5,
                      }}
                    >
                      <CartesianGrid
                        vertical={
                          false
                        }
                        strokeOpacity={
                          0.15
                        }
                      />

                      <XAxis
                        dataKey="name"
                        tickLine={
                          false
                        }
                        axisLine={
                          false
                        }
                        tick={{
                          fontSize: 10,
                          fill: "#94a3b8",
                        }}
                      />

                      <YAxis
                        domain={[
                          0,
                          100,
                        ]}
                        tickFormatter={(
                          value
                        ) =>
                          `${value}%`
                        }
                        tickLine={
                          false
                        }
                        axisLine={
                          false
                        }
                        tick={{
                          fontSize: 10,
                          fill: "#94a3b8",
                        }}
                      />

                      <Tooltip
                        content={
                          <ChartTooltip />
                        }
                      />

                      <Bar
                        dataKey="rate"
                        name="Attendance"
                        fill="#3b82f6"
                        radius={[
                          6,
                          6,
                          0,
                          0,
                        ]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>
          </div>

          {/* COURSE SUMMARY TABLE */}

          <section
            className="
              overflow-hidden
              rounded-2xl
              border
              border-slate-200
              bg-white
              shadow-sm
              dark:border-slate-800
              dark:bg-slate-900
            "
          >
            <div
              className="
                flex
                flex-col
                gap-3
                border-b
                border-slate-200
                p-4
                dark:border-slate-800
                sm:flex-row
                sm:items-center
                sm:justify-between
              "
            >
              <div>
                <h2
                  className="
                    font-bold
                    text-slate-900
                    dark:text-white
                  "
                >
                  Course Summary
                </h2>

                <p className="mt-1 text-xs text-slate-400">
                  Attendance performance per course, class (program / semester) and teacher
                </p>
              </div>

              <label className="relative w-full sm:w-72">
                <Search
                  size={
                    15
                  }
                  className="
                    absolute
                    left-3
                    top-1/2
                    -translate-y-1/2
                    text-slate-400
                  "
                />

                <input
                  value={
                    search
                  }
                  onChange={(
                    event
                  ) =>
                    setSearch(
                      event
                        .target
                        .value
                    )
                  }
                  placeholder="Search course or teacher..."
                  className={`${fieldClass} pl-9`}
                />
              </label>
            </div>

            {!pageRows.length ? (
              <EmptyPanel>
                No course attendance records found.
              </EmptyPanel>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table
                    className="
                      w-full
                      min-w-[1100px]
                      table-fixed
                      text-left
                      text-sm
                    "
                  >
                    <thead
                      className="
                        bg-slate-50
                        text-xs
                        uppercase
                        tracking-wide
                        text-slate-400
                        dark:bg-slate-950/50
                      "
                    >
                      <tr>
                        <th className="w-[20%] px-4 py-3">
                          Course
                        </th>
                        <th className="w-[21%] px-4 py-3">
                          Program / Semester
                        </th>
                        <th className="w-[14%] px-4 py-3">
                          Teacher
                        </th>
                        <th className="w-[8%] px-4 py-3">
                          Sessions
                        </th>
                        <th className="w-[8%] px-4 py-3">
                          Present
                        </th>
                        <th className="w-[8%] px-4 py-3">
                          Absent
                        </th>
                        <th className="w-[7%] px-4 py-3">
                          Late
                        </th>
                        <th className="w-[7%] px-4 py-3">
                          Leave
                        </th>
                        <th className="w-[7%] px-4 py-3">
                          Rate
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {pageRows.map(
                        (
                          row
                        ) => (
                          <tr
                            key={`${row.course_assignment_id}:${row.class_key || ""}`}
                            className="
                              border-t
                              border-slate-100
                              dark:border-slate-800
                            "
                          >
                            <td className="px-4 py-4">
                              <p
                                className="
                                  truncate
                                  font-semibold
                                  text-slate-900
                                  dark:text-white
                                "
                              >
                                {
                                  row.name
                                }
                              </p>

                              <p className="truncate text-xs text-slate-400">
                                {row.course_code ||
                                  "—"}
                              </p>
                            </td>

                            <td
                              className="px-4 py-4"
                              title={row.class_label || ""}
                            >
                              <p className="truncate font-medium text-slate-800 dark:text-slate-200">
                                {row.program?.name || "—"}
                              </p>

                              <p className="truncate text-xs text-slate-400">
                                {[
                                  row.semester?.name,
                                  row.batch?.start_year && row.batch?.end_year
                                    ? `${row.batch.start_year}-${row.batch.end_year}`
                                    : "",
                                ]
                                  .filter(Boolean)
                                  .join(" · ") || "—"}
                              </p>

                              {row.student_count > 0 && (
                                <p className="truncate text-[11px] text-slate-400">
                                  {row.student_count} student
                                  {row.student_count === 1 ? "" : "s"}
                                </p>
                              )}
                            </td>

                            <td className="truncate px-4 py-4">
                              {row.teacher
                                ?.full_name ||
                                "Unassigned"}
                            </td>

                            <td className="px-4 py-4">
                              {
                                row.sessions
                              }
                            </td>

                            <td className="px-4 py-4 text-emerald-600">
                              {
                                row.present
                              }
                            </td>

                            <td className="px-4 py-4 text-red-600">
                              {
                                row.absent
                              }
                            </td>

                            <td className="px-4 py-4 text-amber-600">
                              {
                                row.late
                              }
                            </td>

                            <td className="px-4 py-4 text-blue-600">
                              {
                                row.excused
                              }
                            </td>

                            <td className="px-4 py-4">
                              <span
                                className="
                                  rounded-full
                                  bg-blue-50
                                  px-2.5
                                  py-1
                                  text-xs
                                  font-bold
                                  text-blue-600
                                  dark:bg-blue-500/10
                                  dark:text-blue-400
                                "
                              >
                                {
                                  row.rate
                                }
                                %
                              </span>
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>

                <div
                  className="
                    flex
                    items-center
                    justify-between
                    border-t
                    border-slate-200
                    px-4
                    py-3
                    text-xs
                    dark:border-slate-800
                  "
                >
                  <span className="text-slate-400">
                    Page{" "}
                    {
                      safePage
                    }{" "}
                    of{" "}
                    {
                      totalPages
                    }
                  </span>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={
                        safePage <=
                        1
                      }
                      onClick={() =>
                        setPage(
                          (
                            current
                          ) =>
                            Math.max(
                              1,
                              current -
                                1
                            )
                        )
                      }
                      className="
                        rounded-lg
                        border
                        border-slate-200
                        px-3
                        py-2
                        disabled:opacity-30
                        dark:border-slate-700
                      "
                    >
                      Previous
                    </button>

                    <button
                      type="button"
                      disabled={
                        safePage >=
                        totalPages
                      }
                      onClick={() =>
                        setPage(
                          (
                            current
                          ) =>
                            Math.min(
                              totalPages,
                              current +
                                1
                            )
                        )
                      }
                      className="
                        rounded-lg
                        border
                        border-slate-200
                        px-3
                        py-2
                        disabled:opacity-30
                        dark:border-slate-700
                      "
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      ) : null}

      {/* ================================================= */}
      {/* SEMESTER — STUDENT × COURSE MATRIX */}
      {/* ================================================= */}

      {!loadingReport &&
      activeTab ===
        "semester" ? (
        !appliedFilters.semester_id ? (
          <EmptyPanel>
            Select Batch, Department, Program and Semester,
            then press Apply to view the course-wise
            attendance report.
          </EmptyPanel>
        ) : (
          <div className="space-y-4">
            <div>
              <h2
                className="
                  font-bold
                  text-slate-900
                  dark:text-white
                "
              >
                Semester Course-wise Attendance
              </h2>

              <p className="mt-1 text-xs text-slate-400">
                Every course is displayed as a separate
                column. Percentage is calculated from the
                actual attendance sessions of that course.
              </p>
            </div>

            {!report?.rows?.length ? (
              <EmptyPanel>
                No semester attendance data is available.
              </EmptyPanel>
            ) : (
              <div
                className="
                  max-w-full
                  overflow-x-auto
                  rounded-xl
                  border
                  border-slate-200
                  bg-white
                  shadow-sm
                  dark:border-slate-800
                  dark:bg-slate-900
                "
              >
                <table
                  className="
                    min-w-max
                    text-left
                    text-sm
                  "
                >
                  <thead
                    className="
                      sticky
                      top-0
                      z-10
                      bg-slate-50
                      text-xs
                      uppercase
                      tracking-wide
                      text-slate-400
                      dark:bg-slate-950
                    "
                  >
                    <tr>
                      <th
                        className="
                          sticky
                          left-0
                          z-20
                          min-w-[220px]
                          bg-slate-50
                          px-4
                          py-3
                          dark:bg-slate-950
                        "
                      >
                        Student
                      </th>

                      <th
                        className="
                          sticky
                          left-[220px]
                          z-20
                          min-w-[150px]
                          bg-slate-50
                          px-4
                          py-3
                          dark:bg-slate-950
                        "
                      >
                        Student ID
                      </th>

                      {(
                        report.courses ||
                        []
                      ).map(
                        (
                          course
                        ) => (
                          <th
                            key={
                              course.course_assignment_id
                            }
                            className="min-w-[130px] px-4 py-3 text-center"
                          >
                            <span className="block truncate">
                              {course.course_code ||
                                course.name}
                            </span>
                          </th>
                        )
                      )}

                      <th className="min-w-[120px] px-4 py-3 text-center">
                        Overall
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {report.rows.map(
                      (
                        row
                      ) => (
                        <tr
                          key={
                            row.student
                              ?.id
                          }
                          className="
                            border-t
                            border-slate-100
                            dark:border-slate-800
                          "
                        >
                          <td
                            className="
                              sticky
                              left-0
                              z-10
                              bg-white
                              px-4
                              py-4
                              dark:bg-slate-900
                            "
                          >
                            <p
                              className="
                                font-semibold
                                text-slate-900
                                dark:text-white
                              "
                            >
                              {row.student
                                ?.full_name ||
                                "Student"}
                            </p>
                          </td>

                          <td
                            className="
                              sticky
                              left-[220px]
                              z-10
                              bg-white
                              px-4
                              py-4
                              font-medium
                              dark:bg-slate-900
                            "
                          >
                            {row.student
                              ?.student_id ||
                              "—"}
                          </td>

                          {(
                            report.courses ||
                            []
                          ).map(
                            (
                              course
                            ) => {
                              const stats =
                                row.courses?.[
                                  course.course_assignment_id
                                ];

                              return (
                                <td
                                  key={
                                    course.course_assignment_id
                                  }
                                  className="px-4 py-4 text-center"
                                >
                                  {stats?.eligible ? (
                                    <span className="font-semibold">
                                      {
                                        stats.rate
                                      }
                                      %
                                    </span>
                                  ) : (
                                    <span className="text-slate-300 dark:text-slate-600">
                                      —
                                    </span>
                                  )}
                                </td>
                              );
                            }
                          )}

                          <td className="px-4 py-4 text-center">
                            {row.overall
                              ?.eligible ? (
                              <span
                                className="
                                  rounded-full
                                  bg-blue-50
                                  px-2.5
                                  py-1
                                  text-xs
                                  font-bold
                                  text-blue-600
                                  dark:bg-blue-500/10
                                  dark:text-blue-400
                                "
                              >
                                {
                                  row.overall
                                    .rate
                                }
                                %
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      ) : null}

      {/* ================================================= */}
      {/* COURSE REPORT */}
      {/* ================================================= */}

      {!loadingReport &&
      activeTab ===
        "course" ? (
        !appliedFilters.course_assignment_id ? (
          <EmptyPanel>
            Select a Course and press Apply to view its
            attendance report.
          </EmptyPanel>
        ) : !report ? (
          <EmptyPanel>
            No course attendance report is available.
          </EmptyPanel>
        ) : (
          <div className="space-y-5">
            {/* COURSE HEADER */}

            <section
              className="
                rounded-2xl
                border
                border-slate-200
                bg-white
                p-4
                shadow-sm
                dark:border-slate-800
                dark:bg-slate-900
              "
            >
              <div
                className="
                  flex
                  flex-col
                  gap-4
                  lg:flex-row
                  lg:items-center
                  lg:justify-between
                "
              >
                <div>
                  <h2
                    className="
                      font-bold
                      text-slate-900
                      dark:text-white
                    "
                  >
                    {report.course
                      ?.name ||
                      "Course Attendance"}
                  </h2>

                  <p className="mt-1 text-xs text-slate-400">
                    {report.course
                      ?.course_code ||
                      "No code"}

                    {" · "}

                    {report.course
                      ?.teacher
                      ?.full_name ||
                      "Unassigned teacher"}

                    {" · "}

                    {report.session_count ||
                      0}{" "}
                    session(s)
                  </p>
                </div>

                <div
                  className="
                    grid
                    grid-cols-2
                    gap-1
                    rounded-xl
                    bg-slate-100
                    p-1
                    dark:bg-slate-950
                  "
                >
                  <button
                    type="button"
                    onClick={() =>
                      setCourseView(
                        "summary"
                      )
                    }
                    className={`
                      rounded-lg
                      px-4
                      py-2
                      text-xs
                      font-semibold
                      transition
                      ${
                        courseView ===
                        "summary"
                          ? "bg-white text-blue-600 shadow-sm dark:bg-slate-800 dark:text-blue-400"
                          : "text-slate-500"
                      }
                    `}
                  >
                    Summary
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setCourseView(
                        "register"
                      )
                    }
                    className={`
                      rounded-lg
                      px-4
                      py-2
                      text-xs
                      font-semibold
                      transition
                      ${
                        courseView ===
                        "register"
                          ? "bg-white text-blue-600 shadow-sm dark:bg-slate-800 dark:text-blue-400"
                          : "text-slate-500"
                      }
                    `}
                  >
                    Date Register
                  </button>
                </div>
              </div>
            </section>

            {courseView ===
            "summary" ? (
              <>
                <div
                  className="
                    grid
                    gap-4
                    sm:grid-cols-2
                    xl:grid-cols-5
                  "
                >
                  <StatCard
                    icon={
                      CheckCircle2
                    }
                    label="Present"
                    value={
                      report.summary
                        ?.present ||
                      0
                    }
                    tone="green"
                  />

                  <StatCard
                    icon={
                      XCircle
                    }
                    label="Absent"
                    value={
                      report.summary
                        ?.absent ||
                      0
                    }
                    tone="red"
                  />

                  <StatCard
                    icon={
                      Clock3
                    }
                    label="Late"
                    value={
                      report.summary
                        ?.late ||
                      0
                    }
                    tone="amber"
                  />

                  <StatCard
                    icon={
                      CalendarDays
                    }
                    label="Leave"
                    value={
                      report.summary
                        ?.excused ||
                      0
                    }
                    tone="cyan"
                  />

                  <StatCard
                    icon={
                      BarChart3
                    }
                    label="Rate"
                    value={`${Math.round(
                      report.summary
                        ?.rate ||
                        0
                    )}%`}
                    tone="blue"
                  />
                </div>

                {!report.rows
                  ?.length ? (
                  <EmptyPanel>
                    No students are available in this course.
                  </EmptyPanel>
                ) : (
                  <section
                    className="
                      overflow-hidden
                      rounded-2xl
                      border
                      border-slate-200
                      bg-white
                      shadow-sm
                      dark:border-slate-800
                      dark:bg-slate-900
                    "
                  >
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[900px] table-fixed text-left text-sm">
                        <thead
                          className="
                            bg-slate-50
                            text-xs
                            uppercase
                            tracking-wide
                            text-slate-400
                            dark:bg-slate-950/50
                          "
                        >
                          <tr>
                            <th className="w-[25%] px-4 py-3">
                              Student
                            </th>

                            <th className="w-[16%] px-4 py-3">
                              Student ID
                            </th>

                            <th className="w-[10%] px-4 py-3">
                              Present
                            </th>

                            <th className="w-[10%] px-4 py-3">
                              Absent
                            </th>

                            <th className="w-[10%] px-4 py-3">
                              Late
                            </th>

                            <th className="w-[10%] px-4 py-3">
                              Leave
                            </th>

                            <th className="w-[10%] px-4 py-3">
                              Not Marked
                            </th>

                            <th className="w-[12%] px-4 py-3">
                              Attendance
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {report.rows.map(
                            (
                              row
                            ) => (
                              <tr
                                key={
                                  row.student
                                    ?.id
                                }
                                className="
                                  border-t
                                  border-slate-100
                                  dark:border-slate-800
                                "
                              >
                                <td className="px-4 py-4">
                                  <p
                                    className="
                                      truncate
                                      font-semibold
                                      text-slate-900
                                      dark:text-white
                                    "
                                  >
                                    {row.student
                                      ?.full_name ||
                                      "Student"}
                                  </p>
                                </td>

                                <td className="truncate px-4 py-4 font-medium">
                                  {row.student
                                    ?.student_id ||
                                    "—"}
                                </td>

                                <td className="px-4 py-4 text-emerald-600">
                                  {
                                    row.present
                                  }
                                </td>

                                <td className="px-4 py-4 text-red-600">
                                  {
                                    row.absent
                                  }
                                </td>

                                <td className="px-4 py-4 text-amber-600">
                                  {
                                    row.late
                                  }
                                </td>

                                <td className="px-4 py-4 text-blue-600">
                                  {
                                    row.excused
                                  }
                                </td>

                                <td className="px-4 py-4">
                                  {
                                    row.not_marked
                                  }
                                </td>

                                <td className="px-4 py-4">
                                  {row.eligible ? (
                                    <span
                                      className="
                                        rounded-full
                                        bg-blue-50
                                        px-2.5
                                        py-1
                                        text-xs
                                        font-bold
                                        text-blue-600
                                        dark:bg-blue-500/10
                                        dark:text-blue-400
                                      "
                                    >
                                      {
                                        row.rate
                                      }
                                      %
                                    </span>
                                  ) : (
                                    "—"
                                  )}
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}
              </>
            ) : (
              <>
                {!report.sessions
                  ?.length ? (
                  <EmptyPanel>
                    No conducted attendance sessions are available.
                  </EmptyPanel>
                ) : !report.rows
                    ?.length ? (
                  <EmptyPanel>
                    No student attendance register is available.
                  </EmptyPanel>
                ) : (
                  <section
                    className="
                      overflow-hidden
                      rounded-2xl
                      border
                      border-slate-200
                      bg-white
                      shadow-sm
                      dark:border-slate-800
                      dark:bg-slate-900
                    "
                  >
                    <div className="overflow-x-auto">
                      <table className="min-w-max text-left text-sm">
                        <thead
                          className="
                            bg-slate-50
                            text-xs
                            uppercase
                            tracking-wide
                            text-slate-400
                            dark:bg-slate-950/50
                          "
                        >
                          <tr>
                            <th
                              className="
                                sticky
                                left-0
                                z-20
                                min-w-[220px]
                                bg-slate-50
                                px-4
                                py-3
                                dark:bg-slate-950
                              "
                            >
                              Student
                            </th>

                            <th
                              className="
                                sticky
                                left-[220px]
                                z-20
                                min-w-[150px]
                                bg-slate-50
                                px-4
                                py-3
                                dark:bg-slate-950
                              "
                            >
                              Student ID
                            </th>

                            {report.sessions.map(
                              (
                                session
                              ) => (
                                <th
                                  key={
                                    session.id
                                  }
                                  className="min-w-[110px] px-3 py-3 text-center"
                                >
                                  <span className="block">
                                    {formatDate(
                                      session.attendance_date
                                    )}
                                  </span>

                                  {session.title ? (
                                    <span className="mt-1 block max-w-[120px] truncate text-[10px] normal-case text-slate-400">
                                      {
                                        session.title
                                      }
                                    </span>
                                  ) : null}
                                </th>
                              )
                            )}

                            <th className="min-w-[100px] px-4 py-3 text-center">
                              P
                            </th>

                            <th className="min-w-[100px] px-4 py-3 text-center">
                              A
                            </th>

                            <th className="min-w-[100px] px-4 py-3 text-center">
                              L
                            </th>

                            <th className="min-w-[100px] px-4 py-3 text-center">
                              LV
                            </th>

                            <th className="min-w-[110px] px-4 py-3 text-center">
                              Rate
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {report.rows.map(
                            (
                              row
                            ) => (
                              <tr
                                key={
                                  row.student
                                    ?.id
                                }
                                className="
                                  border-t
                                  border-slate-100
                                  dark:border-slate-800
                                "
                              >
                                <td
                                  className="
                                    sticky
                                    left-0
                                    z-10
                                    bg-white
                                    px-4
                                    py-4
                                    dark:bg-slate-900
                                  "
                                >
                                  <p
                                    className="
                                      font-semibold
                                      text-slate-900
                                      dark:text-white
                                    "
                                  >
                                    {row.student
                                      ?.full_name ||
                                      "Student"}
                                  </p>
                                </td>

                                <td
                                  className="
                                    sticky
                                    left-[220px]
                                    z-10
                                    bg-white
                                    px-4
                                    py-4
                                    font-medium
                                    dark:bg-slate-900
                                  "
                                >
                                  {row.student
                                    ?.student_id ||
                                    "—"}
                                </td>

                                {report.sessions.map(
                                  (
                                    session
                                  ) => (
                                    <td
                                      key={
                                        session.id
                                      }
                                      className="px-3 py-4 text-center"
                                    >
                                      <AttendanceBadge
                                        status={
                                          row.cells?.[
                                            session.id
                                          ]
                                            ?.status ||
                                          "not_marked"
                                        }
                                      />
                                    </td>
                                  )
                                )}

                                <td className="px-4 py-4 text-center text-emerald-600">
                                  {
                                    row.present
                                  }
                                </td>

                                <td className="px-4 py-4 text-center text-red-600">
                                  {
                                    row.absent
                                  }
                                </td>

                                <td className="px-4 py-4 text-center text-amber-600">
                                  {
                                    row.late
                                  }
                                </td>

                                <td className="px-4 py-4 text-center text-blue-600">
                                  {
                                    row.excused
                                  }
                                </td>

                                <td className="px-4 py-4 text-center">
                                  {row.eligible
                                    ? `${row.rate}%`
                                    : "—"}
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        )
      ) : null}

      {/* ================================================= */}
      {/* STUDENT REPORT */}
      {/* ================================================= */}

      {!loadingReport &&
      activeTab ===
        "student" ? (
        !appliedFilters.student_id ? (
          <EmptyPanel>
            Select a Student and press Apply to view their
            attendance history.
          </EmptyPanel>
        ) : !report?.student ? (
          <EmptyPanel>
            No attendance data is available for this student.
          </EmptyPanel>
        ) : (
          <div className="space-y-5">
            {/* STUDENT HEADER */}

            <section
              className="
                rounded-2xl
                border
                border-slate-200
                bg-white
                p-4
                shadow-sm
                dark:border-slate-800
                dark:bg-slate-900
              "
            >
              <div
                className="
                  flex
                  flex-col
                  gap-4
                  sm:flex-row
                  sm:items-center
                  sm:justify-between
                "
              >
                <div>
                  <h2
                    className="
                      font-bold
                      text-slate-900
                      dark:text-white
                    "
                  >
                    {report.student
                      ?.full_name ||
                      "Student"}
                  </h2>

                  <p className="mt-1 text-xs text-slate-400">
                    Student ID:{" "}
                    {report.student
                      ?.student_id ||
                      "—"}
                  </p>
                </div>

                <span
                  className="
                    rounded-full
                    bg-blue-50
                    px-3
                    py-1.5
                    text-sm
                    font-bold
                    text-blue-600
                    dark:bg-blue-500/10
                    dark:text-blue-400
                  "
                >
                  {report.summary
                    ?.eligible
                    ? `${report.summary.rate}%`
                    : "No attendance"}
                </span>
              </div>
            </section>

            {/* STUDENT SUMMARY */}

            <div
              className="
                grid
                gap-4
                sm:grid-cols-2
                xl:grid-cols-5
              "
            >
              <StatCard
                icon={
                  CheckCircle2
                }
                label="Present"
                value={
                  report.summary
                    ?.present ||
                  0
                }
                tone="green"
              />

              <StatCard
                icon={
                  XCircle
                }
                label="Absent"
                value={
                  report.summary
                    ?.absent ||
                  0
                }
                tone="red"
              />

              <StatCard
                icon={
                  Clock3
                }
                label="Late"
                value={
                  report.summary
                    ?.late ||
                  0
                }
                tone="amber"
              />

              <StatCard
                icon={
                  CalendarDays
                }
                label="Leave"
                value={
                  report.summary
                    ?.excused ||
                  0
                }
                tone="cyan"
              />

              <StatCard
                icon={
                  BarChart3
                }
                label="Attendance"
                value={
                  report.summary
                    ?.eligible
                    ? `${report.summary.rate}%`
                    : "—"
                }
                tone="blue"
              />
            </div>

            {/* COURSE-WISE */}

            <section
              className="
                overflow-hidden
                rounded-2xl
                border
                border-slate-200
                bg-white
                shadow-sm
                dark:border-slate-800
                dark:bg-slate-900
              "
            >
              <div className="border-b border-slate-200 p-4 dark:border-slate-800">
                <h2
                  className="
                    font-bold
                    text-slate-900
                    dark:text-white
                  "
                >
                  Course-wise Attendance
                </h2>

                <p className="mt-1 text-xs text-slate-400">
                  Attendance summary across enrolled courses
                </p>
              </div>

              {!report.courses
                ?.length ? (
                <EmptyPanel>
                  No course attendance is available.
                </EmptyPanel>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[850px] table-fixed text-left text-sm">
                    <thead
                      className="
                        bg-slate-50
                        text-xs
                        uppercase
                        tracking-wide
                        text-slate-400
                        dark:bg-slate-950/50
                      "
                    >
                      <tr>
                        <th className="w-[28%] px-4 py-3">
                          Course
                        </th>

                        <th className="w-[18%] px-4 py-3">
                          Teacher
                        </th>

                        <th className="w-[10%] px-4 py-3">
                          Present
                        </th>

                        <th className="w-[10%] px-4 py-3">
                          Absent
                        </th>

                        <th className="w-[10%] px-4 py-3">
                          Late
                        </th>

                        <th className="w-[10%] px-4 py-3">
                          Leave
                        </th>

                        <th className="w-[12%] px-4 py-3">
                          Attendance
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {report.courses.map(
                        (
                          course
                        ) => (
                          <tr
                            key={
                              course.course_assignment_id
                            }
                            className="
                              border-t
                              border-slate-100
                              dark:border-slate-800
                            "
                          >
                            <td className="px-4 py-4">
                              <p
                                className="
                                  truncate
                                  font-semibold
                                  text-slate-900
                                  dark:text-white
                                "
                              >
                                {
                                  course.name
                                }
                              </p>

                              <p className="truncate text-xs text-slate-400">
                                {course.course_code ||
                                  "—"}
                              </p>
                            </td>

                            <td className="truncate px-4 py-4">
                              {course.teacher
                                ?.full_name ||
                                "Unassigned"}
                            </td>

                            <td className="px-4 py-4 text-emerald-600">
                              {
                                course.present
                              }
                            </td>

                            <td className="px-4 py-4 text-red-600">
                              {
                                course.absent
                              }
                            </td>

                            <td className="px-4 py-4 text-amber-600">
                              {
                                course.late
                              }
                            </td>

                            <td className="px-4 py-4 text-blue-600">
                              {
                                course.excused
                              }
                            </td>

                            <td className="px-4 py-4">
                              {course.eligible ? (
                                <span
                                  className="
                                    rounded-full
                                    bg-blue-50
                                    px-2.5
                                    py-1
                                    text-xs
                                    font-bold
                                    text-blue-600
                                    dark:bg-blue-500/10
                                    dark:text-blue-400
                                  "
                                >
                                  {
                                    course.rate
                                  }
                                  %
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* SESSION LOG */}

            <section
              className="
                overflow-hidden
                rounded-2xl
                border
                border-slate-200
                bg-white
                shadow-sm
                dark:border-slate-800
                dark:bg-slate-900
              "
            >
              <div className="border-b border-slate-200 p-4 dark:border-slate-800">
                <h2
                  className="
                    font-bold
                    text-slate-900
                    dark:text-white
                  "
                >
                  Attendance Log
                </h2>

                <p className="mt-1 text-xs text-slate-400">
                  Date-wise recorded attendance
                </p>
              </div>

              {!report.sessions
                ?.length ? (
                <EmptyPanel>
                  No attendance entries found.
                </EmptyPanel>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] table-fixed text-left text-sm">
                    <thead
                      className="
                        bg-slate-50
                        text-xs
                        uppercase
                        tracking-wide
                        text-slate-400
                        dark:bg-slate-950/50
                      "
                    >
                      <tr>
                        <th className="w-[14%] px-4 py-3">
                          Date
                        </th>

                        <th className="w-[24%] px-4 py-3">
                          Course
                        </th>

                        <th className="w-[15%] px-4 py-3">
                          Status
                        </th>

                        <th className="w-[20%] px-4 py-3">
                          Teacher
                        </th>

                        <th className="w-[27%] px-4 py-3">
                          Reason
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {report.sessions.map(
                        (
                          row
                        ) => (
                          <tr
                            key={
                              row.id
                            }
                            className="
                              border-t
                              border-slate-100
                              dark:border-slate-800
                            "
                          >
                            <td className="px-4 py-4">
                              {formatDate(
                                row.date
                              )}
                            </td>

                            <td className="px-4 py-4">
                              <p
                                className="
                                  truncate
                                  font-semibold
                                  text-slate-900
                                  dark:text-white
                                "
                              >
                                {
                                  row.course_name
                                }
                              </p>

                              <p className="truncate text-xs text-slate-400">
                                {row.course_code ||
                                  "—"}
                              </p>
                            </td>

                            <td className="px-4 py-4">
                              <AttendanceBadge
                                status={
                                  row.status
                                }
                              />
                            </td>

                            <td className="truncate px-4 py-4">
                              {row.teacher_name ||
                                "—"}
                            </td>

                            <td className="truncate px-4 py-4 text-slate-500">
                              {row.reason ||
                                "—"}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )
      ) : null}
    </main>
  );
}

export default Attendance;