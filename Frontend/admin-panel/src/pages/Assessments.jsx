import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { createPortal } from "react-dom";

import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  FileText,
  GraduationCap,
  ListFilter,
  Loader2,
  Pencil,
  Plus,
  Search,
  Send,
  Square,
  Trash2,
  Users,
  X,
  XCircle,
} from "lucide-react";

import Modal from "../components/Modal";
import FormField from "../components/FormField";
import ConfirmDialog from "../components/ConfirmDialog";
import SelectionActionBar from "../components/SelectionActionBar";

import AcademicStructureService from "../services/AcademicStructureService";

import {
  cancelAssessment,
  createAssessment,
  deleteAssessment,
  getAssessmentById,
  getAssessmentCourseOptions,
  getAssessments,
  previewAssessment,
  publishAssessment,
  updateAssessment,
} from "../services/assessmentService";

// ======================================================
// STYLES
// ======================================================

const inputClass = `
  h-11
  w-full
  min-w-0
  max-w-full
  rounded-xl
  border
  border-slate-200
  bg-white
  px-3
  text-sm
  text-slate-900
  outline-none
  transition
  focus:border-blue-500
  focus:ring-4
  focus:ring-blue-500/10
  disabled:cursor-not-allowed
  disabled:bg-slate-100
  disabled:text-slate-400
  dark:border-slate-700
  dark:bg-slate-900
  dark:text-white
  dark:disabled:bg-slate-800
`;

// Native date/time controls need their own color-scheme so the
// browser-provided calendar icon also follows light/dark mode.
const dateTimeInputClass = `
  ${inputClass}
  [color-scheme:light]
  dark:[color-scheme:dark]
`;

const textAreaClass = `
  min-h-24
  w-full
  min-w-0
  max-w-full
  resize-y
  rounded-xl
  border
  border-slate-200
  bg-white
  px-3
  py-2.5
  text-sm
  text-slate-900
  outline-none
  transition
  focus:border-blue-500
  focus:ring-4
  focus:ring-blue-500/10
  dark:border-slate-700
  dark:bg-slate-900
  dark:text-white
`;

const secondaryButton = `
  inline-flex
  h-10
  items-center
  justify-center
  gap-2
  rounded-xl
  border
  border-slate-200
  bg-white
  px-3
  text-sm
  font-semibold
  text-slate-700
  transition
  hover:bg-slate-50
  disabled:cursor-not-allowed
  disabled:opacity-50
  dark:border-slate-700
  dark:bg-slate-900
  dark:text-slate-200
  dark:hover:bg-slate-800
`;

const primaryButton = `
  inline-flex
  h-10
  items-center
  justify-center
  gap-2
  rounded-xl
  bg-blue-600
  px-4
  text-sm
  font-semibold
  text-white
  shadow-lg
  shadow-blue-600/20
  transition
  hover:bg-blue-700
  disabled:cursor-not-allowed
  disabled:opacity-60
`;

// ======================================================
// ASSESSMENT CONTENT-AREA MODAL
// ======================================================

function AssessmentContentModal({
  open = true,
  onClose,
  title,
  subtitle,
  children,
  maxWidthClass = "max-w-lg",
}) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previousOverflow =
      document.body.style.overflow;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    document.addEventListener(
      "keydown",
      handleKeyDown
    );

    document.body.style.overflow =
      "hidden";

    return () => {
      document.removeEventListener(
        "keydown",
        handleKeyDown
      );

      document.body.style.overflow =
        previousOverflow;
    };
  }, [open, onClose]);

  if (
    !open ||
    typeof document === "undefined"
  ) {
    return null;
  }

  return createPortal(
    <div
      className="
        fixed
        inset-x-0
        bottom-0
        top-20
        z-[9999]
        overflow-hidden
        bg-slate-950/60
        p-2
        sm:p-4
        lg:left-64
        lg:p-6
      "
    >
      <button
        type="button"
        aria-label="Close modal"
        onClick={onClose}
        className="
          absolute
          inset-0
          cursor-default
          backdrop-blur-sm
        "
      />

      <div className="relative flex h-full min-h-0 w-full items-center justify-center">
        <section
          className={`
            relative
            flex
            max-h-full
            w-full
            min-w-0
            ${maxWidthClass}
            flex-col
            overflow-hidden
            rounded-xl
            border
            border-slate-200
            bg-white
            shadow-2xl
            animate-modal-in
            dark:border-slate-800
            dark:bg-slate-900
            sm:rounded-2xl
          `}
        >
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800 sm:px-6 sm:py-4">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {title}
              </h2>

              {subtitle ? (
                <p className="mt-1 break-words text-xs leading-5 text-slate-500 dark:text-slate-400 sm:text-sm">
                  {subtitle}
                </p>
              ) : null}
            </div>

            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <X size={18} />
            </button>
          </header>

          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
            {children}
          </div>
        </section>
      </div>
    </div>,
    document.body
  );
}

// ======================================================
// DEFAULT FORM
// ======================================================

const emptyForm = {
  title: "",
  assessment_type: "quiz",
  scope_type: "semester",

  department_id: "",
  program_id: "",
  batch_id: "",
  semester_id: "",

  course_assignment_id: "",

  default_start_at: "",
  default_end_at: "",
  default_max_marks: "",

  instructions: "",
};

// ======================================================
// HELPERS
// ======================================================

const pad = (value) =>
  String(value).padStart(2, "0");

const isoToLocalInput = (value) => {
  if (!value) {
    return "";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return `${date.getFullYear()}-${pad(
    date.getMonth() + 1
  )}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
};

const localToIso = (value) => {
  if (!value) {
    return null;
  }

  const input = String(value).trim();

  const match = input.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/
  );

  if (!match) {
    return null;
  }

  const [, year, month, day, hour, minute, second = "00"] =
    match;

  // Admin ka entered date/time as-it-is bhejo.
  // Yahan UTC conversion nahi hogi.
  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
};

const formatDateTime = (value) => {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(date);
};

const batchLabel = (batch) =>
  batch
    ? `${batch.start_year}-${batch.end_year}`
    : "—";

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

const sameId = (first, second) =>
  String(first || "") === String(second || "");

const activeOnly = (item) =>
  item?.status !== "inactive";

const typeLabel = (type) =>
  ({
    quiz: "Quiz",
    assignment: "Assignment",
    mid: "Mid",
    final: "Final",
  }[type] ||
    type ||
    "—");

const durationLabel = (
  start,
  end
) => {
  if (
    !start ||
    !end
  ) {
    return "—";
  }

  const diff =
    new Date(
      end
    ).getTime() -
    new Date(
      start
    ).getTime();

  if (
    !Number.isFinite(
      diff
    ) ||
    diff <= 0
  ) {
    return "—";
  }

  const minutes =
    Math.round(
      diff /
        60000
    );

  if (
    minutes < 60
  ) {
    return `${minutes} min`;
  }

  const hours =
    minutes /
    60;

  if (
    hours < 24
  ) {
    return `${
      Number.isInteger(
        hours
      )
        ? hours
        : hours.toFixed(
            1
          )
    } hr`;
  }

  const days =
    hours /
    24;

  return `${
    Number.isInteger(
      days
    )
      ? days
      : days.toFixed(
          1
        )
  } day${
    days === 1
      ? ""
      : "s"
  }`;
};

// ======================================================
// STATUS
// ======================================================

const statusClasses = (status) => {
  const key =
    String(
      status ||
        ""
    ).toLowerCase();

  if (
    key ===
    "completed"
  ) {
    return `
      bg-emerald-50
      text-emerald-700
      ring-emerald-600/10
      dark:bg-emerald-500/10
      dark:text-emerald-300
    `;
  }

  if (
    [
      "cancelled",
      "missed",
      "slot missed",
    ].includes(key)
  ) {
    return `
      bg-red-50
      text-red-700
      ring-red-600/10
      dark:bg-red-500/10
      dark:text-red-300
    `;
  }

  if (
    [
      "result pending",
      "conducting",
    ].includes(key)
  ) {
    return `
      bg-amber-50
      text-amber-700
      ring-amber-600/10
      dark:bg-amber-500/10
      dark:text-amber-300
    `;
  }

  if (
    [
      "window open",
      "prepared",
      "conduct scheduled",
    ].includes(key)
  ) {
    return `
      bg-violet-50
      text-violet-700
      ring-violet-600/10
      dark:bg-violet-500/10
      dark:text-violet-300
    `;
  }

  if (
    key ===
    "draft"
  ) {
    return `
      bg-slate-100
      text-slate-700
      ring-slate-600/10
      dark:bg-slate-800
      dark:text-slate-300
    `;
  }

  return `
    bg-blue-50
    text-blue-700
    ring-blue-600/10
    dark:bg-blue-500/10
    dark:text-blue-300
  `;
};

function StatusBadge({
  status,
  compact = false,
}) {
  return (
    <span
      className={`
        inline-flex
        max-w-full
        items-center
        justify-center
        rounded-full
        py-1
        font-semibold
        ring-1
        ring-inset
        ${
          compact
            ? "min-w-0 whitespace-normal break-words px-2 text-center text-[10px] leading-4"
            : "shrink-0 whitespace-nowrap px-2.5 text-xs"
        }
        ${statusClasses(
          status
        )}
      `}
    >
      {status ||
        "—"}
    </span>
  );
}

// ======================================================
// GENERIC UI
// ======================================================

function Alert({
  children,
  tone = "warning",
}) {
  if (
    !children
  ) {
    return null;
  }

  const classes =
    tone ===
    "danger"
      ? `
        border-red-200
        bg-red-50
        text-red-700
        dark:border-red-900/50
        dark:bg-red-500/10
        dark:text-red-300
      `
      : tone ===
          "success"
        ? `
          border-emerald-200
          bg-emerald-50
          text-emerald-700
          dark:border-emerald-900/50
          dark:bg-emerald-500/10
          dark:text-emerald-300
        `
        : tone ===
            "info"
          ? `
            border-blue-200
            bg-blue-50
            text-blue-700
            dark:border-blue-900/50
            dark:bg-blue-500/10
            dark:text-blue-300
          `
          : `
            border-amber-200
            bg-amber-50
            text-amber-800
            dark:border-amber-900/50
            dark:bg-amber-500/10
            dark:text-amber-300
          `;

  return (
    <div
      className={`
        rounded-xl
        border
        px-4
        py-3
        text-sm
        ${classes}
      `}
    >
      {children}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}) {
  return (
    <div
      className="
        min-w-0
        rounded-2xl
        border
        border-slate-200
        bg-white
        p-4
        dark:border-slate-800
        dark:bg-slate-900
      "
    >
      <div className="flex min-w-0 items-center gap-3">
        <div
          className="
            shrink-0
            rounded-xl
            bg-slate-100
            p-2.5
            text-slate-600
            dark:bg-slate-800
            dark:text-slate-300
          "
        >
          <Icon
            size={
              18
            }
          />
        </div>

        <div className="min-w-0">
          <p
            className="
              truncate
              text-xs
              font-medium
              uppercase
              tracking-wide
              text-slate-400
            "
          >
            {label}
          </p>

          <p
            className="
              mt-0.5
              text-xl
              font-bold
              text-slate-900
              dark:text-white
            "
          >
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

function InfoCell({
  label,
  value,
}) {
  return (
    <div className="min-w-0">
      <p
        className="
          text-[11px]
          font-semibold
          uppercase
          tracking-wide
          text-slate-400
        "
      >
        {label}
      </p>

      <div
        className="
          mt-1
          break-words
          text-sm
          font-medium
          text-slate-700
          dark:text-slate-200
        "
      >
        {value ||
          "—"}
      </div>
    </div>
  );
}

// ======================================================
// ASSESSMENT CREATE / EDIT MODAL
// ======================================================

function AssessmentEditorModal({
  assessment = null,
  onClose,
  onSaved,
}) {
  const editing =
    Boolean(
      assessment
    );

  const [
    form,
    setForm,
  ] =
    useState(() =>
      editing
        ? {
            title:
              assessment.title ||
              "",

            assessment_type:
              assessment.assessment_type,

            scope_type:
              assessment.scope_type,

            department_id:
              assessment.department_id,

            program_id:
              assessment.program_id,

            batch_id:
              assessment.batch_id,

            semester_id:
              assessment.semester_id,

            course_assignment_id:
              assessment.scope_type ===
              "course"
                ? assessment.items?.[0]
                    ?.course_assignment_id ||
                  ""
                : "",

            default_start_at:
              isoToLocalInput(
                assessment.default_start_at
              ),

            default_end_at:
              isoToLocalInput(
                assessment.default_end_at
              ),

            default_max_marks:
              assessment.default_max_marks ??
              "",

            instructions:
              assessment.instructions ||
              "",
          }
        : emptyForm
    );

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
    batches,
    setBatches,
  ] =
    useState([]);

  const [
    semesters,
    setSemesters,
  ] =
    useState([]);

  const [
    batchPrograms,
    setBatchPrograms,
  ] =
    useState([]);

  const [
    courseOptions,
    setCourseOptions,
  ] =
    useState([]);

  const [
    preview,
    setPreview,
  ] =
    useState(null);

  const [
    rows,
    setRows,
  ] =
    useState(() =>
      editing
        ? (
            assessment.items ||
            []
          ).map(
            (
              item
            ) => ({
              id:
                item.id,

              course_assignment_id:
                item.course_assignment_id,

              course:
                item.course_assignment
                  ?.course,

              teacher:
                item.course_assignment
                  ?.teacher,

              student_count:
                item.student_count ||
                0,

              starts_at:
                isoToLocalInput(
                  item.starts_at
                ),

              ends_at:
                isoToLocalInput(
                  item.ends_at
                ),

              max_marks:
                item.max_marks,

              conduct_starts_at:
                item.conduct_starts_at,

              conduct_ends_at:
                item.conduct_ends_at,

              result_status:
                item.result_status,

              gradebook_component:
                item.gradebook_component,
            })
          )
        : []
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );

  const [
    checking,
    setChecking,
  ] =
    useState(
      false
    );

  const [
    saving,
    setSaving,
  ] =
    useState(
      false
    );

  const [
    error,
    setError,
  ] =
    useState(
      ""
    );

  // ====================================================
  // FIELD UPDATE
  // ====================================================

  const updateForm =
    useCallback(
      (
        patch
      ) => {
        setForm(
          (
            current
          ) => ({
            ...current,
            ...patch,
          })
        );

        if (
          !editing
        ) {
          setPreview(
            null
          );

          setRows(
            []
          );
        }
      },
      [
        editing,
      ]
    );

  // ====================================================
  // INITIAL ACADEMIC DATA
  //
  // Latest structure:
  // Department -> Program -> Semester
  // Batch <-> Program -> academic_batch_programs
  //
  // Load reusable master data once and use the mapping
  // table as the source of truth for Batch membership.
  // ====================================================

  useEffect(() => {
    let active =
      true;

    const load =
      async () => {
        setLoading(
          true
        );

        setError(
          ""
        );

        try {
          const [
            batchResponse,
            departmentResponse,
            programResponse,
            semesterResponse,
            mappingResponse,
          ] =
            await Promise.all([
              AcademicStructureService.getBatches(),
              AcademicStructureService.getDepartments(),
              AcademicStructureService.getPrograms(),
              AcademicStructureService.getSemesters(),
              AcademicStructureService.getBatchPrograms(
                null,
                "active"
              ),
            ]);

          if (!active) {
            return;
          }

          setBatches(
            unwrapArray(
              batchResponse
            ).filter(
              activeOnly
            )
          );

          setDepartments(
            unwrapArray(
              departmentResponse
            ).filter(
              activeOnly
            )
          );

          setPrograms(
            unwrapArray(
              programResponse
            ).filter(
              activeOnly
            )
          );

          setSemesters(
            unwrapArray(
              semesterResponse
            ).filter(
              activeOnly
            )
          );

          setBatchPrograms(
            unwrapArray(
              mappingResponse
            ).filter(
              activeOnly
            )
          );

          if (editing) {
            const courseResponse =
              await getAssessmentCourseOptions({
                department_id:
                  assessment.department_id,

                program_id:
                  assessment.program_id,

                batch_id:
                  assessment.batch_id,

                semester_id:
                  assessment.semester_id,
              });

            if (!active) {
              return;
            }

            setCourseOptions(
              unwrapArray(
                courseResponse
              )
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
                "Unable to load academic data"
            );
          }
        } finally {
          if (
            active
          ) {
            setLoading(
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
  }, [
    editing,
    assessment,
  ]);

  // ====================================================
  // ACADEMIC OPTIONS
  // ====================================================

  const selectedBatchMappings =
    useMemo(() => {
      if (!form.batch_id) {
        return [];
      }

      return batchPrograms.filter(
        (mapping) =>
          activeOnly(
            mapping
          ) &&
          sameId(
            mapping.batch_id,
            form.batch_id
          )
      );
    }, [
      batchPrograms,
      form.batch_id,
    ]);

  const departmentOptions =
    useMemo(() => {
      if (!form.batch_id) {
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

      return departments
        .filter(
          (department) =>
            activeOnly(
              department
            ) &&
            mappedDepartmentIds.has(
              String(
                department.id
              )
            )
        )
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
    }, [
      departments,
      programs,
      form.batch_id,
      selectedBatchMappings,
    ]);

  const programOptions =
    useMemo(() => {
      if (
        !form.batch_id ||
        !form.department_id
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

      return programs
        .filter(
          (program) =>
            activeOnly(
              program
            ) &&
            sameId(
              program.department_id,
              form.department_id
            ) &&
            mappedProgramIds.has(
              String(
                program.id
              )
            )
        )
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
    }, [
      programs,
      form.batch_id,
      form.department_id,
      selectedBatchMappings,
    ]);

  // Semester behavior intentionally stays the same:
  // Program selected -> show that Program's active
  // Semesters. Do not force the Batch current semester.
  const semesterOptions =
    useMemo(() => {
      if (!form.program_id) {
        return [];
      }

      return semesters
        .filter(
          (semester) =>
            activeOnly(
              semester
            ) &&
            sameId(
              semester.program_id,
              form.program_id
            )
        )
        .slice()
        .sort(
          (a, b) =>
            Number(
              a.semester_number ||
                0
            ) -
            Number(
              b.semester_number ||
                0
            )
        );
    }, [
      semesters,
      form.program_id,
    ]);

  const selectedBatchProgram =
    useMemo(() => {
      if (
        !form.batch_id ||
        !form.program_id
      ) {
        return null;
      }

      return (
        selectedBatchMappings.find(
          (mapping) =>
            sameId(
              mapping.program_id,
              form.program_id
            )
        ) || null
      );
    }, [
      form.batch_id,
      form.program_id,
      selectedBatchMappings,
    ]);

  // ====================================================
  // BATCH
  // ====================================================

  const changeBatch =
    (
      batchId
    ) => {
      updateForm({
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
      });

      setCourseOptions(
        []
      );
    };

  // ====================================================
  // DEPARTMENT
  // ====================================================

  const changeDepartment =
    (
      departmentId
    ) => {
      updateForm({
        department_id:
          departmentId,

        program_id:
          "",

        semester_id:
          "",

        course_assignment_id:
          "",
      });

      setCourseOptions(
        []
      );
    };

  // ====================================================
  // PROGRAM
  // ====================================================

  const changeProgram =
    (
      programId
    ) => {
      updateForm({
        program_id:
          programId,

        semester_id:
          "",

        course_assignment_id:
          "",
      });

      setCourseOptions(
        []
      );
    };

  // ====================================================
  // COURSE OPTIONS
  // ====================================================

  useEffect(
    () => {
      if (
        editing ||
        !form.department_id ||
        !form.program_id ||
        !form.batch_id ||
        !form.semester_id
      ) {
        if (
          !editing
        ) {
          setCourseOptions(
            []
          );
        }

        return;
      }

      let active =
        true;

      getAssessmentCourseOptions({
        department_id:
          form.department_id,

        program_id:
          form.program_id,

        batch_id:
          form.batch_id,

        semester_id:
          form.semester_id,
      })
        .then(
          (
            response
          ) => {
            if (
              !active
            ) {
              return;
            }

            setCourseOptions(
              response.data ||
              []
            );
          }
        )
        .catch(
          (
            err
          ) => {
            if (
              !active
            ) {
              return;
            }

            setError(
              err?.response
                ?.data
                ?.message ||
                err?.message ||
                "Unable to load courses"
            );
          }
        );

      return () => {
        active =
          false;
      };
    },
    [
      editing,
      form.department_id,
      form.program_id,
      form.batch_id,
      form.semester_id,
    ]
  );

  // ====================================================
  // PAYLOAD
  // ====================================================

  const basePayload =
    () => ({
      title:
        form.title.trim(),

      assessment_type:
        form.assessment_type,

      scope_type:
        form.scope_type,

      department_id:
        form.department_id,

      program_id:
        form.program_id,

      batch_id:
        form.batch_id,

      semester_id:
        form.semester_id,

      course_assignment_id:
        form.scope_type ===
        "course"
          ? form.course_assignment_id
          : undefined,

      default_start_at:
        localToIso(
          form.default_start_at
        ),

      default_end_at:
        localToIso(
          form.default_end_at
        ),

      default_max_marks:
        Number(
          form.default_max_marks
        ),

      instructions:
        form.instructions,
    });

  // ====================================================
  // VALIDATION
  // ====================================================

  const validateForm =
    () => {
      if (
        !form.title.trim()
      ) {
        return "Assessment name is required.";
      }

      if (
        !form.department_id ||
        !form.program_id ||
        !form.batch_id ||
        !form.semester_id
      ) {
        return "Select Batch, Department, Program and Semester.";
      }

      if (
        form.scope_type ===
          "course" &&
        !form.course_assignment_id
      ) {
        return "Select a course.";
      }

      if (
        !form.default_start_at ||
        !form.default_end_at
      ) {
        return "Availability start and end date/time are required.";
      }

      if (
        new Date(
          form.default_end_at
        ) <=
        new Date(
          form.default_start_at
        )
      ) {
        return "Availability end must be after availability start.";
      }

      if (
        !Number(
          form.default_max_marks
        ) ||
        Number(
          form.default_max_marks
        ) <= 0
      ) {
        return "Maximum marks must be greater than zero.";
      }

      return "";
    };

  // ====================================================
  // PREVIEW
  // ====================================================

  const runPreview =
    async () => {
      const validation =
        validateForm();

      if (
        validation
      ) {
        setError(
          validation
        );

        return;
      }

      setChecking(
        true
      );

      setError(
        ""
      );

      try {
        const payload =
          basePayload();

        if (
          rows.length
        ) {
          payload.items =
            rows.map(
              (
                row
              ) => ({
                course_assignment_id:
                  row.course_assignment_id,

                starts_at:
                  localToIso(
                    row.starts_at
                  ),

                ends_at:
                  localToIso(
                    row.ends_at
                  ),

                max_marks:
                  Number(
                    row.max_marks
                  ),
              })
            );
        }

        const response =
          await previewAssessment(
            payload
          );

        const data =
          response.data;

        setPreview(
          data
        );

        setRows(
          (
            data.items ||
            []
          ).map(
            (
              item
            ) => ({
              ...item,

              starts_at:
                isoToLocalInput(
                  item.starts_at
                ),

              ends_at:
                isoToLocalInput(
                  item.ends_at
                ),
            })
          )
        );
      } catch (
        err
      ) {
        setError(
          err?.response
            ?.data
            ?.message ||
            err?.message ||
            "Unable to preview assessment schedule"
        );
      } finally {
        setChecking(
          false
        );
      }
    };

  // ====================================================
  // ROW CHANGE
  // ====================================================

  const updateRow = (
    key,
    patch
  ) => {
    setRows(
      (
        current
      ) =>
        current.map(
          (
            row
          ) =>
            (
              row.id ||
              row.course_assignment_id
            ) ===
            key
              ? {
                  ...row,
                  ...patch,
                }
              : row
        )
    );
  };

  // ====================================================
  // CREATE
  // ====================================================

  const saveCreate =
    async (
      publish
    ) => {
      const validation =
        validateForm();

      if (
        validation
      ) {
        setError(
          validation
        );

        return;
      }

      if (
        !rows.length ||
        !preview
      ) {
        setError(
          "Preview the schedule first."
        );

        return;
      }

      if (
        publish &&
        rows.some(
          (
            row
          ) =>
            !row.teacher
              ?.id
        )
      ) {
        setError(
          "Every selected course must have an assigned teacher before publishing."
        );

        return;
      }

      setSaving(
        true
      );

      setError(
        ""
      );

      try {
        await createAssessment({
          ...basePayload(),

          publish,

          items:
            rows.map(
              (
                row
              ) => ({
                course_assignment_id:
                  row.course_assignment_id,

                starts_at:
                  localToIso(
                    row.starts_at
                  ),

                ends_at:
                  localToIso(
                    row.ends_at
                  ),

                max_marks:
                  Number(
                    row.max_marks
                  ),
              })
            ),
        });

        onSaved();
      } catch (
        err
      ) {
        setError(
          err?.response
            ?.data
            ?.message ||
            err?.message ||
            "Unable to save assessment"
        );
      } finally {
        setSaving(
          false
        );
      }
    };

  // ====================================================
  // UPDATE
  // ====================================================

  const saveEdit =
    async () => {
      const validation =
        validateForm();

      if (
        validation
      ) {
        setError(
          validation
        );

        return;
      }

      if (
        !rows.length
      ) {
        setError(
          "Assessment schedule items are missing."
        );

        return;
      }

      setSaving(
        true
      );

      setError(
        ""
      );

      try {
        await updateAssessment(
          assessment.id,
          {
            title:
              form.title.trim(),

            default_start_at:
              localToIso(
                form.default_start_at
              ),

            default_end_at:
              localToIso(
                form.default_end_at
              ),

            default_max_marks:
              Number(
                form.default_max_marks
              ),

            instructions:
              form.instructions,

            items:
              rows.map(
                (
                  row
                ) => ({
                  id:
                    row.id,

                  starts_at:
                    localToIso(
                      row.starts_at
                    ),

                  ends_at:
                    localToIso(
                      row.ends_at
                    ),

                  max_marks:
                    Number(
                      row.max_marks
                    ),
                })
              ),
          }
        );

        onSaved();
      } catch (
        err
      ) {
        setError(
          err?.response
            ?.data
            ?.message ||
            err?.message ||
            "Unable to update assessment"
        );
      } finally {
        setSaving(
          false
        );
      }
    };

  // ====================================================
  // SUMMARY
  // ====================================================

  const summary =
    editing
      ? {
          course_count:
            rows.length,

          teacher_count:
            new Set(
              rows
                .map(
                  (
                    row
                  ) =>
                    row.teacher
                      ?.id
                )
                .filter(
                  Boolean
                )
            ).size,

          student_seats:
            rows.reduce(
              (
                sum,
                row
              ) =>
                sum +
                Number(
                  row.student_count ||
                    0
                ),
              0
            ),

          unassigned_teacher_count:
            rows.filter(
              (
                row
              ) =>
                !row.teacher
                  ?.id
            ).length,
        }
      : preview?.summary ||
        {};

  // ====================================================
  // EDITOR RENDER
  // ====================================================

  return (
    <AssessmentContentModal
      open
      onClose={() => {
        if (
          !saving
        ) {
          onClose();
        }
      }}
      title={
        editing
          ? "Edit Assessment Schedule"
          : "Schedule Assessment"
      }
      subtitle={
        editing
          ? "Update assessment availability, marks and instructions without changing the original academic scope."
          : "Set the assessment availability window. The teacher may later choose the exact conduct hours inside this window."
      }
      maxWidthClass="max-w-5xl"
    >
      <div className="min-w-0 space-y-5">
        <Alert tone="danger">
          {error}
        </Alert>

        <Alert tone="info">
          <strong>
            Availability
            window:
          </strong>{" "}
          Quiz and Mid
          windows may span
          multiple days.
          This does not
          mean the
          assessment is
          continuously
          being conducted.
          The teacher can
          select the exact
          conduct hours
          inside this
          window.
        </Alert>

        <fieldset
          disabled={
            saving ||
            loading
          }
          className="min-w-0 space-y-5"
        >
          {/* BASIC DETAILS */}

          <div
            className="
              grid
              grid-cols-1
              gap-4
              lg:grid-cols-3
            "
          >
            <FormField
              label="Assessment name"
              required
            >
              <input
                className={
                  inputClass
                }
                value={
                  form.title
                }
                onChange={(
                  event
                ) =>
                  updateForm({
                    title:
                      event
                        .target
                        .value,
                  })
                }
                placeholder="e.g. Quiz 2"
              />
            </FormField>

            <FormField
              label="Assessment type"
              required
            >
              <select
                className={
                  inputClass
                }
                value={
                  form.assessment_type
                }
                disabled={
                  editing
                }
                onChange={(
                  event
                ) =>
                  updateForm({
                    assessment_type:
                      event
                        .target
                        .value,
                  })
                }
              >
                <option value="quiz">
                  Quiz
                </option>

                <option value="assignment">
                  Assignment
                </option>

                <option value="mid">
                  Mid
                </option>
              </select>
            </FormField>

            <FormField
              label="Target"
              required
            >
              <select
                className={
                  inputClass
                }
                value={
                  form.scope_type
                }
                disabled={
                  editing
                }
                onChange={(
                  event
                ) =>
                  updateForm({
                    scope_type:
                      event
                        .target
                        .value,

                    course_assignment_id:
                      "",
                  })
                }
              >
                <option value="semester">
                  Entire Semester
                </option>

                <option value="course">
                  Specific Course
                </option>
              </select>
            </FormField>
          </div>

          {/* ACADEMIC SCOPE */}

          <div
            className="
              grid
              grid-cols-1
              gap-4
              sm:grid-cols-2
              xl:grid-cols-4
            "
          >
            <FormField
              label="Batch"
              required
            >
              <select
                className={
                  inputClass
                }
                value={
                  form.batch_id
                }
                disabled={
                  editing
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
              >
                <option value="">
                  Select batch
                </option>

                {batches.map(
                  (
                    item
                  ) => (
                    <option
                      key={
                        item.id
                      }
                      value={
                        item.id
                      }
                    >
                      {batchLabel(
                        item
                      )}
                    </option>
                  )
                )}
              </select>
            </FormField>

            <FormField
              label="Department"
              required
            >
              <select
                className={
                  inputClass
                }
                value={
                  form.department_id
                }
                disabled={
                  editing ||
                  !form.batch_id
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
              >
                <option value="">
                  {form.batch_id
                    ? "Select department"
                    : "Select batch first"}
                </option>

                {departmentOptions.map(
                  (
                    item
                  ) => (
                    <option
                      key={
                        item.id
                      }
                      value={
                        item.id
                      }
                    >
                      {item.name}

                      {item.code
                        ? ` (${item.code})`
                        : ""}
                    </option>
                  )
                )}
              </select>
            </FormField>

            <FormField
              label="Program"
              required
            >
              <select
                className={
                  inputClass
                }
                value={
                  form.program_id
                }
                disabled={
                  editing ||
                  !form.department_id
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
              >
                <option value="">
                  {form.department_id
                    ? "Select program"
                    : "Select department first"}
                </option>

                {programOptions.map(
                  (
                    item
                  ) => (
                    <option
                      key={
                        item.id
                      }
                      value={
                        item.id
                      }
                    >
                      {item.name}

                      {item.code
                        ? ` (${item.code})`
                        : ""}
                    </option>
                  )
                )}
              </select>
            </FormField>

            <FormField
              label="Semester"
              required
            >
              <select
                className={
                  inputClass
                }
                value={
                  form.semester_id
                }
                disabled={
                  editing ||
                  !form.program_id
                }
                onChange={(
                  event
                ) =>
                  updateForm({
                    semester_id:
                      event
                        .target
                        .value,

                    course_assignment_id:
                      "",
                  })
                }
              >
                <option value="">
                  {form.program_id
                    ? "Select semester"
                    : "Select program first"}
                </option>

                {semesterOptions.map(
                  (
                    item
                  ) => (
                    <option
                      key={
                        item.id
                      }
                      value={
                        item.id
                      }
                    >
                      {item.name ||
                        `Semester ${item.semester_number}`}
                    </option>
                  )
                )}
              </select>
            </FormField>
          </div>

          {selectedBatchProgram ? (
            <div className="grid min-w-0 gap-3 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-700 sm:grid-cols-3 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
              <div>
                <p className="font-semibold uppercase tracking-wide opacity-70">
                  Admission type
                </p>
                <p className="mt-1 font-semibold capitalize">
                  {selectedBatchProgram.admission_type || "regular"}
                </p>
              </div>

              <div>
                <p className="font-semibold uppercase tracking-wide opacity-70">
                  Entry semester
                </p>
                <p className="mt-1 font-semibold">
                  {selectedBatchProgram.entry_semester?.name || "Not configured"}
                </p>
              </div>

              <div>
                <p className="font-semibold uppercase tracking-wide opacity-70">
                  Batch current semester
                </p>
                <p className="mt-1 font-semibold">
                  {selectedBatchProgram.current_semester?.name || "Not configured"}
                </p>
              </div>
            </div>
          ) : null}

          {/* COURSE */}

          {!editing &&
          form.scope_type ===
            "course" ? (
            <FormField
              label="Course"
              required
              hint="Only active Course Assignments for the selected Program, Batch and Semester are shown."
            >
              <select
                className={
                  inputClass
                }
                value={
                  form.course_assignment_id
                }
                disabled={
                  !form.batch_id ||
                  !form.semester_id
                }
                onChange={(
                  event
                ) =>
                  updateForm({
                    course_assignment_id:
                      event
                        .target
                        .value,
                  })
                }
              >
                <option value="">
                  Select course
                </option>

                {courseOptions.map(
                  (
                    item
                  ) => (
                    <option
                      key={
                        item.id
                      }
                      value={
                        item.id
                      }
                    >
                      {item.course
                        ?.name ||
                        "Course"}

                      {item.course
                        ?.course_code
                        ? ` (${item.course.course_code})`
                        : ""}

                      {" · "}

                      {item.teacher
                        ?.full_name ||
                        "No teacher"}
                    </option>
                  )
                )}
              </select>
            </FormField>
          ) : null}

          {/* DEFAULT WINDOW */}

          <div
            className="
              grid
              grid-cols-1
              gap-4
              lg:grid-cols-3
            "
          >
            <FormField
              label="Default availability start"
              required
            >
              <input
                type="datetime-local"
                className={
                  dateTimeInputClass
                }
                value={
                  form.default_start_at
                }
                onChange={(
                  event
                ) =>
                  updateForm({
                    default_start_at:
                      event
                        .target
                        .value,
                  })
                }
              />
            </FormField>

            <FormField
              label="Default availability end"
              required
            >
              <input
                type="datetime-local"
                className={
                  dateTimeInputClass
                }
                value={
                  form.default_end_at
                }
                onChange={(
                  event
                ) =>
                  updateForm({
                    default_end_at:
                      event
                        .target
                        .value,
                  })
                }
              />
            </FormField>

            <FormField
              label="Maximum marks"
              required
            >
              <input
                type="number"
                min="1"
                step="0.5"
                className={
                  inputClass
                }
                value={
                  form.default_max_marks
                }
                onChange={(
                  event
                ) =>
                  updateForm({
                    default_max_marks:
                      event
                        .target
                        .value,
                  })
                }
              />
            </FormField>
          </div>

          <FormField label="Instructions">
            <textarea
              className={
                textAreaClass
              }
              value={
                form.instructions
              }
              onChange={(
                event
              ) =>
                updateForm({
                  instructions:
                    event
                      .target
                      .value,
                })
              }
              placeholder="Optional instructions for teachers or students"
            />
          </FormField>

          {!editing ? (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={
                  runPreview
                }
                disabled={
                  checking
                }
                className={
                  secondaryButton
                }
              >
                {checking ? (
                  <Loader2
                    size={
                      16
                    }
                    className="animate-spin"
                  />
                ) : (
                  <Eye
                    size={
                      16
                    }
                  />
                )}

                {checking
                  ? "Loading..."
                  : rows.length
                    ? "Refresh Preview"
                    : "Preview Schedule"}
              </button>
            </div>
          ) : null}
        </fieldset>

        {/* COURSE PREVIEW */}

        {rows.length ? (
          <div
            className="
              space-y-4
              border-t
              border-slate-200
              pt-5
              dark:border-slate-800
            "
          >
            <div
              className="
                grid
                grid-cols-2
                gap-3
                lg:grid-cols-4
              "
            >
              <StatCard
                icon={
                  FileText
                }
                label="Courses"
                value={
                  summary.course_count ||
                  0
                }
              />

              <StatCard
                icon={
                  GraduationCap
                }
                label="Teachers"
                value={
                  summary.teacher_count ||
                  0
                }
              />

              <StatCard
                icon={
                  Users
                }
                label="Student seats"
                value={
                  summary.student_seats ||
                  0
                }
              />

              <StatCard
                icon={
                  AlertTriangle
                }
                label="No teacher"
                value={
                  summary.unassigned_teacher_count ||
                  0
                }
              />
            </div>

            {/* MOBILE */}

            <div className="space-y-3 lg:hidden">
              {rows.map(
                (
                  row
                ) => {
                  const key =
                    row.id ||
                    row.course_assignment_id;

                  return (
                    <div
                      key={
                        key
                      }
                      className="
                        rounded-2xl
                        border
                        border-slate-200
                        bg-white
                        p-4
                        dark:border-slate-800
                        dark:bg-slate-900
                      "
                    >
                      <div className="mb-4">
                        <p
                          className="
                            font-semibold
                            text-slate-900
                            dark:text-white
                          "
                        >
                          {row.course
                            ?.name ||
                            "Course"}
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          {row.course
                            ?.course_code ||
                            "No course code"}
                        </p>
                      </div>

                      <div
                        className="
                          grid
                          grid-cols-1
                          gap-4
                          sm:grid-cols-2
                        "
                      >
                        <InfoCell
                          label="Teacher"
                          value={
                            row.teacher
                              ?.full_name ||
                            "Not assigned"
                          }
                        />

                        <InfoCell
                          label="Students"
                          value={
                            row.student_count ||
                            0
                          }
                        />

                        <FormField label="Availability start">
                          <input
                            type="datetime-local"
                            className={
                              dateTimeInputClass
                            }
                            value={
                              row.starts_at
                            }
                            onChange={(
                              event
                            ) =>
                              updateRow(
                                key,
                                {
                                  starts_at:
                                    event
                                      .target
                                      .value,
                                }
                              )
                            }
                          />
                        </FormField>

                        <FormField label="Availability end">
                          <input
                            type="datetime-local"
                            className={
                              dateTimeInputClass
                            }
                            value={
                              row.ends_at
                            }
                            onChange={(
                              event
                            ) =>
                              updateRow(
                                key,
                                {
                                  ends_at:
                                    event
                                      .target
                                      .value,
                                }
                              )
                            }
                          />
                        </FormField>

                        <FormField label="Maximum marks">
                          <input
                            type="number"
                            min="1"
                            step="0.5"
                            className={
                              inputClass
                            }
                            value={
                              row.max_marks
                            }
                            onChange={(
                              event
                            ) =>
                              updateRow(
                                key,
                                {
                                  max_marks:
                                    event
                                      .target
                                      .value,
                                }
                              )
                            }
                          />
                        </FormField>
                      </div>
                    </div>
                  );
                }
              )}
            </div>

            {/* DESKTOP TABLE */}

            <div
              className="
                hidden
                overflow-x-auto
                rounded-2xl
                border
                border-slate-200
                dark:border-slate-800
                lg:block
              "
            >
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead
                  className="
                    bg-slate-50
                    text-xs
                    uppercase
                    tracking-wide
                    text-slate-500
                    dark:bg-slate-800
                    dark:text-slate-400
                  "
                >
                  <tr>
                    <th className="px-4 py-3">
                      Course
                    </th>

                    <th className="px-4 py-3">
                      Teacher
                    </th>

                    <th className="px-4 py-3">
                      Students
                    </th>

                    <th className="px-4 py-3">
                      Start
                    </th>

                    <th className="px-4 py-3">
                      End
                    </th>

                    <th className="px-4 py-3">
                      Marks
                    </th>
                  </tr>
                </thead>

                <tbody
                  className="
                    divide-y
                    divide-slate-100
                    dark:divide-slate-800
                  "
                >
                  {rows.map(
                    (
                      row
                    ) => {
                      const key =
                        row.id ||
                        row.course_assignment_id;

                      return (
                        <tr
                          key={
                            key
                          }
                          className="
                            bg-white
                            dark:bg-slate-900
                          "
                        >
                          <td className="px-4 py-3">
                            <p
                              className="
                                font-semibold
                                text-slate-800
                                dark:text-slate-100
                              "
                            >
                              {row.course
                                ?.name ||
                                "Course"}
                            </p>

                            <p className="mt-1 text-xs text-slate-400">
                              {row.course
                                ?.course_code ||
                                ""}
                            </p>
                          </td>

                          <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                            {row.teacher
                              ?.full_name || (
                              <span className="font-semibold text-red-500 dark:text-red-400">
                                Not assigned
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                            {row.student_count ||
                              0}
                          </td>

                          <td className="px-4 py-3">
                            <input
                              type="datetime-local"
                              className={`${dateTimeInputClass} min-w-[12rem]`}
                              value={
                                row.starts_at
                              }
                              onChange={(
                                event
                              ) =>
                                updateRow(
                                  key,
                                  {
                                    starts_at:
                                      event
                                        .target
                                        .value,
                                  }
                                )
                              }
                            />
                          </td>

                          <td className="px-4 py-3">
                            <input
                              type="datetime-local"
                              className={`${dateTimeInputClass} min-w-[12rem]`}
                              value={
                                row.ends_at
                              }
                              onChange={(
                                event
                              ) =>
                                updateRow(
                                  key,
                                  {
                                    ends_at:
                                      event
                                        .target
                                        .value,
                                  }
                                )
                              }
                            />
                          </td>

                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min="1"
                              step="0.5"
                              className={`${inputClass} w-24`}
                              value={
                                row.max_marks
                              }
                              onChange={(
                                event
                              ) =>
                                updateRow(
                                  key,
                                  {
                                    max_marks:
                                      event
                                        .target
                                        .value,
                                  }
                                )
                              }
                            />
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>

            {/* FOOTER */}

            <div
              className="
                flex
                flex-col-reverse
                gap-3
                sm:flex-row
                sm:justify-end
              "
            >
              <button
                type="button"
                onClick={
                  onClose
                }
                disabled={
                  saving
                }
                className={`${secondaryButton} w-full sm:w-auto`}
              >
                Close
              </button>

              {editing ? (
                <button
                  type="button"
                  onClick={
                    saveEdit
                  }
                  disabled={
                    saving
                  }
                  className={`${primaryButton} w-full sm:w-auto`}
                >
                  {saving ? (
                    <Loader2
                      size={
                        16
                      }
                      className="animate-spin"
                    />
                  ) : (
                    <Pencil
                      size={
                        16
                      }
                    />
                  )}

                  {saving
                    ? "Saving..."
                    : "Save Changes"}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      saveCreate(
                        false
                      )
                    }
                    disabled={
                      saving
                    }
                    className={`${secondaryButton} w-full sm:w-auto`}
                  >
                    Save Draft
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      saveCreate(
                        true
                      )
                    }
                    disabled={
                      saving ||
                      summary.unassigned_teacher_count >
                        0
                    }
                    className={`${primaryButton} w-full sm:w-auto`}
                  >
                    {saving ? (
                      <Loader2
                        size={
                          16
                        }
                        className="animate-spin"
                      />
                    ) : (
                      <Send
                        size={
                          16
                        }
                      />
                    )}

                    {saving
                      ? "Publishing..."
                      : "Publish Schedule"}
                  </button>
                </>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </AssessmentContentModal>
  );
}

// ======================================================
// DETAIL MODAL
// ======================================================

function AssessmentDetailModal({
  assessmentId,
  onClose,
  onEdit,
}) {
  const [
    assessment,
    setAssessment,
  ] =
    useState(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );

  const [
    error,
    setError,
  ] =
    useState(
      ""
    );

  const [
    openRoster,
    setOpenRoster,
  ] =
    useState(
      ""
    );

  useEffect(
    () => {
      let active =
        true;

      setLoading(
        true
      );

      getAssessmentById(
        assessmentId
      )
        .then(
          (
            response
          ) => {
            if (
              !active
            ) {
              return;
            }

            setAssessment(
              response.data
            );
          }
        )
        .catch(
          (
            err
          ) => {
            if (
              !active
            ) {
              return;
            }

            setError(
              err?.response
                ?.data
                ?.message ||
                err?.message ||
                "Unable to load assessment details"
            );
          }
        )
        .finally(
          () => {
            if (
              active
            ) {
              setLoading(
                false
              );
            }
          }
        );

      return () => {
        active =
          false;
      };
    },
    [
      assessmentId,
    ]
  );

  return (
    <AssessmentContentModal
      open
      onClose={
        onClose
      }
      title={
        assessment
          ?.title ||
        "Assessment Details"
      }
      subtitle="Complete academic, teacher, schedule, conduct and student roster information."
      maxWidthClass="max-w-6xl"
    >
      {loading ? (
        <div
          className="
            flex
            min-h-64
            items-center
            justify-center
          "
        >
          <Loader2
            size={
              28
            }
            className="animate-spin text-blue-600"
          />
        </div>
      ) : error ? (
        <Alert tone="danger">
          {error}
        </Alert>
      ) : assessment ? (
        <div className="space-y-6">
          {/* TOP STATUS */}

          <div
            className="
              flex
              flex-col
              gap-3
              sm:flex-row
              sm:items-center
              sm:justify-between
            "
          >
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                status={
                  assessment.display_status
                }
              />

              <span
                className="
                  rounded-full
                  bg-slate-100
                  px-2.5
                  py-1
                  text-xs
                  font-semibold
                  text-slate-600
                  dark:bg-slate-800
                  dark:text-slate-300
                "
              >
                {typeLabel(
                  assessment.assessment_type
                )}
              </span>
            </div>

            {assessment.status ===
            "draft" ? (
              <button
                type="button"
                onClick={() =>
                  onEdit(
                    assessment
                  )
                }
                className={
                  secondaryButton
                }
              >
                <Pencil
                  size={
                    15
                  }
                />

                Edit
              </button>
            ) : null}
          </div> 

        {/* STATS */}

        <div
          className="
            grid
            grid-cols-2
            gap-3
            lg:grid-cols-4
          "
        >
          <StatCard
            icon={
              FileText
            }
            label="Courses"
            value={
              assessment.summary
                ?.course_count ||
              0
            }
          />

          <StatCard
            icon={
              GraduationCap
            }
            label="Teachers"
            value={
              assessment.summary
                ?.teacher_count ||
              0
            }
          />

          <StatCard
            icon={
              Users
            }
            label="Student seats"
            value={
              assessment.summary
                ?.student_seats ||
              0
            }
          />

          <StatCard
            icon={
              CheckCircle2
            }
            label="Completed"
            value={
              assessment.summary
                ?.completed_items ||
              0
            }
          />
        </div>

        {/* ACADEMIC CONTEXT */}

        <section
          className="
            rounded-2xl
            border
            border-slate-200
            bg-slate-50/60
            p-4
            dark:border-slate-800
            dark:bg-slate-800/30
          "
        >
          <h3
            className="
              mb-4
              text-sm
              font-bold
              text-slate-900
              dark:text-white
            "
          >
            Academic Context
          </h3>

          <div
            className="
              grid
              grid-cols-1
              gap-4
              sm:grid-cols-2
              lg:grid-cols-4
            "
          >
            <InfoCell
              label="Department"
              value={
                assessment.department
                  ?.name
              }
            />

            <InfoCell
              label="Program"
              value={
                assessment.program
                  ?.name
              }
            />

            <InfoCell
              label="Batch"
              value={
                batchLabel(
                  assessment.batch
                )
              }
            />

            <InfoCell
              label="Semester"
              value={
                assessment.semester
                  ?.name
              }
            />

            <InfoCell
              label="Default start"
              value={
                formatDateTime(
                  assessment.default_start_at
                )
              }
            />

            <InfoCell
              label="Default end"
              value={
                formatDateTime(
                  assessment.default_end_at
                )
              }
            />

            <InfoCell
              label="Default marks"
              value={
                assessment.default_max_marks
              }
            />

            <InfoCell
              label="Created by"
              value={
                assessment.creator
                  ?.full_name ||
                "Admin"
              }
            />

            <InfoCell
              label="Created"
              value={
                formatDateTime(
                  assessment.created_at
                )
              }
            />

            <InfoCell
              label="Published"
              value={
                formatDateTime(
                  assessment.published_at
                )
              }
            />

            <InfoCell
              label="Last updated"
              value={
                formatDateTime(
                  assessment.updated_at
                )
              }
            />

            <InfoCell
              label="Cancelled"
              value={
                formatDateTime(
                  assessment.cancelled_at
                )
              }
            />
          </div>

          {assessment.instructions ? (
            <div
              className="
                mt-4
                rounded-xl
                border
                border-slate-200
                bg-white
                p-4
                dark:border-slate-700
                dark:bg-slate-900
              "
            >
              <p
                className="
                  text-xs
                  font-semibold
                  uppercase
                  tracking-wide
                  text-slate-400
                "
              >
                Instructions
              </p>

              <p
                className="
                  mt-2
                  whitespace-pre-wrap
                  text-sm
                  leading-6
                  text-slate-700
                  dark:text-slate-200
                "
              >
                {
                  assessment.instructions
                }
              </p>
            </div>
          ) : null}

          {assessment.cancellation_reason ? (
            <div className="mt-4">
              <Alert tone="danger">
                <strong>
                  Cancellation reason:
                </strong>{" "}
                {
                  assessment.cancellation_reason
                }
              </Alert>
            </div>
          ) : null}
        </section>

        {/* COURSE SCHEDULE */}

        <section>
          <div className="mb-4">
            <h3
              className="
                text-base
                font-bold
                text-slate-900
                dark:text-white
              "
            >
              Course-wise Schedule
            </h3>

            <p className="mt-1 text-xs text-slate-500">
              Each course keeps its own teacher,
              availability window, conduct slot,
              marks and roster.
            </p>
          </div>

          <div className="space-y-3">
            {(assessment.items || []).map(
              (
                item
              ) => {
                const rosterOpen =
                  openRoster ===
                  item.id;

                const roster =
                  item.roster ||
                  [];

                return (
                  <div
                    key={
                      item.id
                    }
                    className="
                      overflow-hidden
                      rounded-2xl
                      border
                      border-slate-200
                      bg-white
                      dark:border-slate-800
                      dark:bg-slate-900
                    "
                  >
                    <div className="p-4 sm:p-5">
                      <div
                        className="
                          flex
                          flex-col
                          gap-4
                          xl:flex-row
                          xl:items-start
                          xl:justify-between
                        "
                      >
                        <div className="min-w-0">
                          <div
                            className="
                              flex
                              flex-wrap
                              items-center
                              gap-2
                            "
                          >
                            <h4
                              className="
                                font-bold
                                text-slate-900
                                dark:text-white
                              "
                            >
                              {item
                                .course_assignment
                                ?.course
                                ?.name ||
                                "Course"}
                            </h4>

                            <StatusBadge
                              status={
                                item.display_status
                              }
                            />
                          </div>

                          <p className="mt-1 text-xs text-slate-400">
                            {item
                              .course_assignment
                              ?.course
                              ?.course_code ||
                              "No course code"}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setOpenRoster(
                              rosterOpen
                                ? ""
                                : item.id
                            )
                          }
                          className={
                            secondaryButton
                          }
                        >
                          <Users
                            size={
                              15
                            }
                          />

                          {rosterOpen
                            ? "Hide Roster"
                            : `Roster (${item.student_count || 0})`}

                          <ChevronDown
                            size={
                              14
                            }
                            className={`transition ${
                              rosterOpen
                                ? "rotate-180"
                                : ""
                            }`}
                          />
                        </button>
                      </div>

                      <div
                        className="
                          mt-5
                          grid
                          grid-cols-1
                          gap-4
                          sm:grid-cols-2
                          xl:grid-cols-4
                        "
                      >
                        <InfoCell
                          label="Teacher"
                          value={
                            <>
                              <p>
                                {item
                                  .course_assignment
                                  ?.teacher
                                  ?.full_name ||
                                  "Not assigned"}
                              </p>

                              <p className="mt-0.5 text-xs font-normal text-slate-400">
                                {item
                                  .course_assignment
                                  ?.teacher
                                  ?.email ||
                                  ""}
                              </p>
                            </>
                          }
                        />

                        <InfoCell
                          label="Availability window"
                          value={
                            <>
                              <p>
                                {formatDateTime(
                                  item.starts_at
                                )}
                              </p>

                              <p className="mt-1 text-xs font-normal text-slate-400">
                                to{" "}
                                {formatDateTime(
                                  item.ends_at
                                )}

                                {" · "}

                                {durationLabel(
                                  item.starts_at,
                                  item.ends_at
                                )}
                              </p>
                            </>
                          }
                        />

                        <InfoCell
                          label="Conduct slot"
                          value={
                            item.conduct_starts_at
                              ? (
                                <>
                                  <p>
                                    {formatDateTime(
                                      item.conduct_starts_at
                                    )}
                                  </p>

                                  <p className="mt-1 text-xs font-normal text-slate-400">
                                    to{" "}
                                    {formatDateTime(
                                      item.conduct_ends_at
                                    )}
                                  </p>
                                </>
                              )
                              : "Teacher has not selected exact hours"
                          }
                        />

                        <InfoCell
                          label="Maximum marks"
                          value={
                            item.max_marks
                          }
                        />

                        <InfoCell
                          label="Prepared"
                          value={
                            formatDateTime(
                              item.prepared_at
                            )
                          }
                        />

                        <InfoCell
                          label="Execution started"
                          value={
                            formatDateTime(
                              item.execution_started_at
                            )
                          }
                        />

                        <InfoCell
                          label="Results submitted"
                          value={
                            formatDateTime(
                              item.results_submitted_at
                            )
                          }
                        />

                        <InfoCell
                          label="Result progress"
                          value={(() => {
                            const status = String(
                              item.display_status || ""
                            ).toLowerCase();

                            const eligible = Number(
                              item.roster_summary?.eligible ??
                                item.student_count ??
                                0
                            );

                            const graded = Number(
                              item.roster_summary?.graded || 0
                            );

                            const absent = Number(
                              item.roster_summary?.absent || 0
                            );

                            const exempt = Number(
                              item.roster_summary?.exempt || 0
                            );

                            const pending = Number(
                              item.roster_summary?.pending || 0
                            );

                            if (
                              [
                                "draft",
                                "scheduled",
                                "window open",
                                "prepared",
                                "conduct scheduled",
                              ].includes(status)
                            ) {
                              return "Not started";
                            }

                            if (status === "conducting") {
                              return "In progress";
                            }

                            if (status === "result pending") {
                              const resultPending = Math.max(
                                eligible - graded - absent - exempt,
                                0
                              );

                              return `${graded} graded · ${resultPending} pending`;
                            }

                            if (status === "completed") {
                              const finalGraded = Math.max(
                                graded,
                                eligible - absent - exempt
                              );

                              return `${finalGraded} graded · 0 pending`;
                            }

                            if (
                              status === "missed" ||
                              status === "slot missed"
                            ) {
                              return "Not conducted";
                            }

                            if (status === "cancelled") {
                              return "Cancelled";
                            }

                            return `${graded} graded · ${pending} pending`;
                          })()}
                        />
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {item.linked_quiz_id &&
                        ![
                          "completed",
                          "missed",
                          "slot missed",
                          "cancelled",
                        ].includes(
                          String(
                            item.display_status || ""
                          ).toLowerCase()
                        ) ? (
                          <span
                            className="
                              rounded-lg
                              bg-blue-50
                              px-2.5
                              py-1.5
                              text-xs
                              font-medium
                              text-blue-700
                              dark:bg-blue-500/10
                              dark:text-blue-300
                            "
                          >
                            Quiz Prepared
                          </span>
                        ) : null}

                        {item.linked_assignment_id &&
                        ![
                          "completed",
                          "missed",
                          "slot missed",
                          "cancelled",
                        ].includes(
                          String(
                            item.display_status || ""
                          ).toLowerCase()
                        ) ? (
                          <span
                            className="
                              rounded-lg
                              bg-violet-50
                              px-2.5
                              py-1.5
                              text-xs
                              font-medium
                              text-violet-700
                              dark:bg-violet-500/10
                              dark:text-violet-300
                            "
                          >
                            Assignment Prepared
                          </span>
                        ) : null}

                        {item.gradebook_component ? (
                          <span
                            className="
                              rounded-lg
                              bg-emerald-50
                              px-2.5
                              py-1.5
                              text-xs
                              font-medium
                              text-emerald-700
                              dark:bg-emerald-500/10
                              dark:text-emerald-300
                            "
                          >
                            Gradebook:{" "}
                            {
                              item
                                .gradebook_component
                                .name
                            }
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {/* ROSTER */}

                    {rosterOpen ? (
                      <div
                        className="
                          border-t
                          border-slate-200
                          bg-slate-50/70
                          p-4
                          dark:border-slate-800
                          dark:bg-slate-800/20
                        "
                      >
                        {!roster.length ? (
                          <p className="text-sm text-slate-500">
                            No published roster snapshot is available.
                          </p>
                        ) : (
                          <div
                            className="
                              max-h-72
                              overflow-auto
                              rounded-xl
                              border
                              border-slate-200
                              bg-white
                              dark:border-slate-800
                              dark:bg-slate-900
                            "
                          >
                            <table
                              className="
                                w-full
                                min-w-[520px]
                                text-left
                                text-sm
                              "
                            >
                              <thead
                                className="
                                  sticky
                                  top-0
                                  bg-slate-50
                                  text-xs
                                  uppercase
                                  text-slate-500
                                  dark:bg-slate-800
                                "
                              >
                                <tr>
                                  <th className="px-4 py-3">
                                    Student
                                  </th>

                                  <th className="px-4 py-3">
                                    Student ID
                                  </th>

                                  <th className="px-4 py-3">
                                    Eligibility
                                  </th>

                                  <th className="px-4 py-3">
                                    Result
                                  </th>
                                </tr>
                              </thead>

                              <tbody
                                className="
                                  divide-y
                                  divide-slate-100
                                  dark:divide-slate-800
                                "
                              >
                                {roster.map(
                                  (
                                    row
                                  ) => (
                                    <tr
                                      key={
                                        row.id
                                      }
                                    >
                                      <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">
                                        {row.student
                                          ?.full_name ||
                                          "Student"}
                                      </td>

                                      <td className="px-4 py-3 text-slate-500">
                                        {row.student
                                          ?.student_id ||
                                          "—"}
                                      </td>

                                      <td className="px-4 py-3 capitalize text-slate-500">
                                        {
                                          row.eligibility_status
                                        }
                                      </td>

                                      <td className="px-4 py-3 capitalize text-slate-500">
                                        {
                                          row.result_status
                                        }
                                      </td>
                                    </tr>
                                  )
                                )}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              }
            )}
          </div>
        </section>
      </div>
    ) : null}
  </AssessmentContentModal>
);
}

// ======================================================
// CANCEL MODAL
// ======================================================

function CancelModal({
assessment,
onClose,
onSaved,
}) {
const [
  reason,
  setReason,
] = useState("");

const [
  saving,
  setSaving,
] = useState(false);

const [
  error,
  setError,
] = useState("");

const submit =
  async () => {
    if (
      !reason.trim()
    ) {
      setError(
        "Cancellation reason is required."
      );

      return;
    }

    setSaving(
      true
    );

    setError(
      ""
    );

    try {
      await cancelAssessment(
        assessment.id,
        reason.trim()
      );

      onSaved();
    } catch (
      err
    ) {
      setError(
        err?.response
          ?.data
          ?.message ||
          err?.message ||
          "Unable to cancel assessment"
      );
    } finally {
      setSaving(
        false
      );
    }
  };

return (
  <Modal
    open
    onClose={() => {
      if (
        !saving
      ) {
        onClose();
      }
    }}
    title="Cancel Assessment"
    subtitle={
      assessment.title
    }
    maxWidthClass="max-w-xl"
  >
    <div className="space-y-4">
      <Alert tone="danger">
        {error}
      </Alert>

      <Alert>
        Cancellation keeps the assessment in admin
        history and notifies relevant users.
      </Alert>

      <FormField
        label="Cancellation reason"
        required
      >
        <textarea
          className={
            textAreaClass
          }
          value={
            reason
          }
          onChange={(
            event
          ) =>
            setReason(
              event.target
                .value
            )
          }
          placeholder="Enter cancellation reason"
        />
      </FormField>

      <div
        className="
          flex
          flex-col-reverse
          gap-3
          sm:flex-row
          sm:justify-end
        "
      >
        <button
          type="button"
          onClick={
            onClose
          }
          disabled={
            saving
          }
          className={
            secondaryButton
          }
        >
          Keep Schedule
        </button>

        <button
          type="button"
          onClick={
            submit
          }
          disabled={
            saving
          }
          className="
            inline-flex
            h-10
            items-center
            justify-center
            gap-2
            rounded-xl
            bg-red-600
            px-4
            text-sm
            font-semibold
            text-white
            transition
            hover:bg-red-700
            disabled:opacity-60
          "
        >
          {saving ? (
            <Loader2
              size={
                16
              }
              className="animate-spin"
            />
          ) : (
            <XCircle
              size={
                16
              }
            />
          )}

          {saving
            ? "Cancelling..."
            : "Cancel Assessment"}
        </button>
      </div>
    </div>
  </Modal>
);
}

// ======================================================
// SCHEDULE REGISTER
// ======================================================

function ScheduleRegister() {
const [
  assessments,
  setAssessments,
] =
  useState([]);

const [
  loading,
  setLoading,
] =
  useState(
    true
  );

const [
  error,
  setError,
] =
  useState(
    ""
  );

const [
  search,
  setSearch,
] =
  useState(
    ""
  );

const [
  typeFilter,
  setTypeFilter,
] =
  useState(
    "all"
  );

const [
  statusFilter,
  setStatusFilter,
] =
  useState(
    "all"
  );

const [
  batchFilter,
  setBatchFilter,
] =
  useState(
    ""
  );

const [
  departmentFilter,
  setDepartmentFilter,
] =
  useState(
    ""
  );

const [
  programFilter,
  setProgramFilter,
] =
  useState(
    ""
  );

const [
  semesterFilter,
  setSemesterFilter,
] =
  useState(
    ""
  );

const [
  academicData,
  setAcademicData,
] =
  useState({
    batches: [],
    departments: [],
    programs: [],
    semesters: [],
    batchPrograms: [],
  });

const [
  showCreate,
  setShowCreate,
] =
  useState(
    false
  );

const [
  detailId,
  setDetailId,
] =
  useState(
    ""
  );

const [
  editTarget,
  setEditTarget,
] =
  useState(
    null
  );

const [
  cancelTarget,
  setCancelTarget,
] =
  useState(
    null
  );

const [
  deleteTarget,
  setDeleteTarget,
] =
  useState(
    null
  );

const [
  deleteLoading,
  setDeleteLoading,
] =
  useState(
    false
  );

const [
  actionId,
  setActionId,
] =
  useState(
    ""
  );

const [
  selectedRowIds,
  setSelectedRowIds,
] =
  useState(
    () =>
      new Set()
  );

const [
  currentPage,
  setCurrentPage,
] =
  useState(
    1
  );

const PAGE_SIZE =
  8;

const [
  bulkDeleteOpen,
  setBulkDeleteOpen,
] =
  useState(
    false
  );

const [
  bulkDeleteLoading,
  setBulkDeleteLoading,
] =
  useState(
    false
  );

// ====================================================
// LOAD
// ====================================================

const load =
  useCallback(
    async () => {
      setLoading(
        true
      );

      setError(
        ""
      );

      try {
        const [
          assessmentResponse,
          batchResponse,
          departmentResponse,
          programResponse,
          semesterResponse,
          mappingResponse,
        ] =
          await Promise.all([
            getAssessments(),
            AcademicStructureService.getBatches(),
            AcademicStructureService.getDepartments(),
            AcademicStructureService.getPrograms(),
            AcademicStructureService.getSemesters(),
            AcademicStructureService.getBatchPrograms(
              null,
              "active"
            ),
          ]);

        setAssessments(
          unwrapArray(
            assessmentResponse
          )
        );

        setAcademicData({
          batches:
            unwrapArray(
              batchResponse
            ).filter(
              activeOnly
            ),

          departments:
            unwrapArray(
              departmentResponse
            ).filter(
              activeOnly
            ),

          programs:
            unwrapArray(
              programResponse
            ).filter(
              activeOnly
            ),

          semesters:
            unwrapArray(
              semesterResponse
            ).filter(
              activeOnly
            ),

          batchPrograms:
            unwrapArray(
              mappingResponse
            ).filter(
              activeOnly
            ),
        });
      } catch (
        err
      ) {
        setError(
          err?.response
            ?.data
            ?.message ||
            err?.message ||
            "Unable to load assessments"
        );
      } finally {
        setLoading(
          false
        );
      }
    },
    []
  );

useEffect(
  () => {
    load();
  },
  [
    load,
  ]
);

useEffect(
  () => {
    const validRowIds =
      new Set(
        assessments.flatMap(
          (
            plan
          ) =>
            (
              plan.items ||
              []
            )
              .map(
                (
                  item
                ) =>
                  item.id
              )
              .filter(
                Boolean
              )
        )
      );

    setSelectedRowIds(
      (
        current
      ) => {
        const next =
          new Set(
            [
              ...current,
            ].filter(
              (
                id
              ) =>
                validRowIds.has(
                  id
                )
            )
          );

        if (
          next.size ===
          current.size
        ) {
          return current;
        }

        return next;
      }
    );
  },
  [
    assessments,
  ]
);

  // ====================================================
  // OPTIONAL ACADEMIC FILTER OPTIONS
  //
  // Nothing is required in these page filters. Selecting
  // one value only narrows the next choices according to
  // the latest Batch -> academic_batch_programs mapping.
  // ====================================================

  const registerBatchMappings =
    useMemo(() => {
      if (!batchFilter) {
        return academicData.batchPrograms;
      }

      return academicData.batchPrograms.filter(
        (mapping) =>
          sameId(
            mapping.batch_id,
            batchFilter
          )
      );
    }, [
      academicData.batchPrograms,
      batchFilter,
    ]);

  const registerDepartmentOptions =
    useMemo(() => {
      if (!batchFilter) {
        return academicData.departments
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

      const mappedProgramIds =
        new Set(
          registerBatchMappings.map(
            (mapping) =>
              String(
                mapping.program_id
              )
          )
        );

      const mappedDepartmentIds =
        new Set(
          academicData.programs
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

      return academicData.departments
        .filter(
          (department) =>
            mappedDepartmentIds.has(
              String(
                department.id
              )
            )
        )
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
    }, [
      academicData.departments,
      academicData.programs,
      batchFilter,
      registerBatchMappings,
    ]);

  const registerProgramOptions =
    useMemo(() => {
      let available =
        academicData.programs.slice();

      if (departmentFilter) {
        available =
          available.filter(
            (program) =>
              sameId(
                program.department_id,
                departmentFilter
              )
          );
      }

      if (batchFilter) {
        const mappedProgramIds =
          new Set(
            registerBatchMappings.map(
              (mapping) =>
                String(
                  mapping.program_id
                )
            )
          );

        available =
          available.filter(
            (program) =>
              mappedProgramIds.has(
                String(
                  program.id
                )
              )
          );
      }

      return available
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
    }, [
      academicData.programs,
      batchFilter,
      departmentFilter,
      registerBatchMappings,
    ]);

  const registerSemesterOptions =
    useMemo(() => {
      let allowedProgramIds =
        null;

      if (programFilter) {
        allowedProgramIds =
          new Set([
            String(
              programFilter
            ),
          ]);
      } else if (departmentFilter) {
        allowedProgramIds =
          new Set(
            academicData.programs
              .filter(
                (program) =>
                  sameId(
                    program.department_id,
                    departmentFilter
                  )
              )
              .map(
                (program) =>
                  String(
                    program.id
                  )
              )
          );
      } else if (batchFilter) {
        allowedProgramIds =
          new Set(
            registerBatchMappings.map(
              (mapping) =>
                String(
                  mapping.program_id
                )
            )
          );
      }

      let available =
        academicData.semesters.slice();

      if (allowedProgramIds) {
        available =
          available.filter(
            (semester) =>
              allowedProgramIds.has(
                String(
                  semester.program_id
                )
              )
          );
      }

      return available
        .slice()
        .sort((a, b) => {
          const aProgram =
            academicData.programs.find(
              (program) =>
                sameId(
                  program.id,
                  a.program_id
                )
            );

          const bProgram =
            academicData.programs.find(
              (program) =>
                sameId(
                  program.id,
                  b.program_id
                )
            );

          const programCompare =
            String(
              aProgram?.name || ""
            ).localeCompare(
              String(
                bProgram?.name || ""
              )
            );

          if (programCompare) {
            return programCompare;
          }

          return (
            Number(
              a.semester_number ||
                0
            ) -
            Number(
              b.semester_number ||
                0
            )
          );
        });
    }, [
      academicData.programs,
      academicData.semesters,
      batchFilter,
      departmentFilter,
      programFilter,
      registerBatchMappings,
    ]);

  // ====================================================
  // FLATTEN ROWS
  // ====================================================

  const rows =
    useMemo(
      () => {
        const flattened =
          [];

        for (
          const plan
          of assessments
        ) {
          for (
            const item
            of plan.items ||
              []
          ) {
            flattened.push({
              plan,
              item,
            });
          }
        }

        const query =
          search
            .trim()
            .toLowerCase();

        return flattened.filter(
          ({
            plan,
            item,
          }) => {
            if (
              batchFilter &&
              !sameId(
                plan.batch_id,
                batchFilter
              )
            ) {
              return false;
            }

            if (
              departmentFilter &&
              !sameId(
                plan.department_id,
                departmentFilter
              )
            ) {
              return false;
            }

            if (
              programFilter &&
              !sameId(
                plan.program_id,
                programFilter
              )
            ) {
              return false;
            }

            if (
              semesterFilter &&
              !sameId(
                plan.semester_id,
                semesterFilter
              )
            ) {
              return false;
            }

            if (
              typeFilter !==
                "all" &&
              plan.assessment_type !==
                typeFilter
            ) {
              return false;
            }

            if (
              statusFilter !==
                "all" &&
              item.display_status !==
                statusFilter
            ) {
              return false;
            }

            if (
              !query
            ) {
              return true;
            }

            const haystack =
              [
                plan.title,
                plan.assessment_type,
                plan.department
                  ?.name,
                plan.program
                  ?.name,
                plan.semester
                  ?.name,
                batchLabel(
                  plan.batch
                ),
                item
                  .course_assignment
                  ?.course
                  ?.name,
                item
                  .course_assignment
                  ?.course
                  ?.course_code,
                item
                  .course_assignment
                  ?.teacher
                  ?.full_name,
                item
                  .course_assignment
                  ?.teacher
                  ?.email,
                item.display_status,
              ]
                .filter(
                  Boolean
                )
                .join(
                  " "
                )
                .toLowerCase();

            return haystack.includes(
              query
            );
          }
        );
      },
      [
        assessments,
        search,
        batchFilter,
        departmentFilter,
        programFilter,
        semesterFilter,
        typeFilter,
        statusFilter,
      ]
    );

  // ====================================================
  // PAGINATION
  // ====================================================

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        rows.length /
          PAGE_SIZE
      )
    );

  const pageStart =
    (
      currentPage -
      1
    ) *
    PAGE_SIZE;

  const pageRows =
    useMemo(
      () =>
        rows.slice(
          pageStart,
          pageStart +
            PAGE_SIZE
        ),
      [
        rows,
        pageStart,
      ]
    );

  const showingFrom =
    rows.length
      ? pageStart +
        1
      : 0;

  const showingTo =
    Math.min(
      pageStart +
        PAGE_SIZE,
      rows.length
    );

  useEffect(
    () => {
      setCurrentPage(
        1
      );

      setSelectedRowIds(
        new Set()
      );
    },
    [
      search,
      batchFilter,
      departmentFilter,
      programFilter,
      semesterFilter,
      typeFilter,
      statusFilter,
    ]
  );

  useEffect(
    () => {
      if (
        currentPage >
        totalPages
      ) {
        setCurrentPage(
          totalPages
        );
      }
    },
    [
      currentPage,
      totalPages,
    ]
  );

  // ====================================================
  // ROW-LEVEL SELECTION
  // ====================================================

  const currentPageRowIds =
    useMemo(
      () =>
        pageRows
          .map(
            ({
              item,
            }) =>
              item?.id
          )
          .filter(
            Boolean
          ),
      [
        pageRows,
      ]
    );

  const selectedRows =
    useMemo(
      () =>
        rows.filter(
          ({
            item,
          }) =>
            selectedRowIds.has(
              item.id
            )
        ),
      [
        rows,
        selectedRowIds,
      ]
    );

  const selectedPlans =
    useMemo(
      () => {
        const selected =
          new Map();

        for (
          const {
            plan,
          }
          of selectedRows
        ) {
          if (
            plan?.id
          ) {
            selected.set(
              plan.id,
              plan
            );
          }
        }

        return [
          ...selected.values(),
        ];
      },
      [
        selectedRows,
      ]
    );

  const partiallySelectedPlans =
    useMemo(
      () => {
        const partial =
          [];

        for (
          const plan
          of selectedPlans
        ) {
          const itemIds =
            (
              plan.items ||
              []
            )
              .map(
                (
                  item
                ) =>
                  item.id
              )
              .filter(
                Boolean
              );

          const selectedCount =
            itemIds.filter(
              (
                id
              ) =>
                selectedRowIds.has(
                  id
                )
            ).length;

          if (
            selectedCount >
              0 &&
            selectedCount <
              itemIds.length
          ) {
            partial.push(
              plan
            );
          }
        }

        return partial;
      },
      [
        selectedPlans,
        selectedRowIds,
      ]
    );

  const allCurrentPageSelected =
    Boolean(
      currentPageRowIds.length
    ) &&
    currentPageRowIds.every(
      (
        id
      ) =>
        selectedRowIds.has(
          id
        )
    );

  const toggleRowSelection =
    (
      rowId
    ) => {
      setSelectedRowIds(
        (
          current
        ) => {
          const next =
            new Set(
              current
            );

          if (
            next.has(
              rowId
            )
          ) {
            next.delete(
              rowId
            );
          } else {
            next.add(
              rowId
            );
          }

          return next;
        }
      );
    };

  const toggleAllCurrentPage =
    () => {
      setSelectedRowIds(
        (
          current
        ) => {
          const next =
            new Set(
              current
            );

          if (
            allCurrentPageSelected
          ) {
            for (
              const id
              of currentPageRowIds
            ) {
              next.delete(
                id
              );
            }
          } else {
            for (
              const id
              of currentPageRowIds
            ) {
              next.add(
                id
              );
            }
          }

          return next;
        }
      );
    };

  const clearSelection =
    () => {
      setSelectedRowIds(
        new Set()
      );
    };

  // ====================================================
  // STATS
  // ====================================================

  const totals =
    useMemo(
      () => {
        const items =
          assessments.flatMap(
            (
              plan
            ) =>
              plan.items ||
              []
          );

        return {
          plans:
            assessments.length,

          published:
            assessments.filter(
              (
                plan
              ) =>
                plan.status ===
                "published"
            ).length,

          active:
            items.filter(
              (
                item
              ) =>
                [
                  "Window Open",
                  "Prepared",
                  "Conduct Scheduled",
                  "Conducting",
                ].includes(
                  item.display_status
                )
            ).length,

          pending:
            items.filter(
              (
                item
              ) =>
                item.display_status ===
                "Result Pending"
            ).length,

          completed:
            items.filter(
              (
                item
              ) =>
                item.display_status ===
                "Completed"
            ).length,
        };
      },
      [
        assessments,
      ]
    );

  // ====================================================
  // PUBLISH
  // ====================================================

  const publishDraft =
    async (
      plan
    ) => {
      setActionId(
        plan.id
      );

      setError(
        ""
      );

      try {
        await publishAssessment(
          plan.id
        );

        await load();
      } catch (
        err
      ) {
        setError(
          err?.response
            ?.data
            ?.message ||
            err?.message ||
            "Unable to publish assessment"
        );
      } finally {
        setActionId(
          ""
        );
      }
    };

  // ====================================================
  // DELETE
  // ====================================================

  const confirmDelete =
    async () => {
      if (
        !deleteTarget
      ) {
        return;
      }

      setDeleteLoading(
        true
      );

      setError(
        ""
      );

      try {
        await deleteAssessment(
          deleteTarget.id
        );

        setDeleteTarget(
          null
        );

        await load();
      } catch (
        err
      ) {
        setError(
          err?.response
            ?.data
            ?.message ||
            err?.message ||
            "Unable to delete assessment"
        );
      } finally {
        setDeleteLoading(
          false
        );
      }
    };

  const confirmBulkDelete =
    async () => {
      if (
        !selectedPlans.length
      ) {
        return;
      }

      if (
        partiallySelectedPlans.length
      ) {
        setBulkDeleteOpen(
          false
        );

        setError(
          "One or more selected rows belong to an Entire Semester assessment. Select every course row of that assessment before deleting the complete schedule."
        );

        return;
      }

      const published =
        selectedPlans.filter(
          (
            plan
          ) =>
            plan.status ===
            "published"
        );

      if (
        published.length
      ) {
        setBulkDeleteOpen(
          false
        );

        setError(
          `${published.length} selected assessment${
            published.length ===
            1
              ? " is"
              : "s are"
          } published. Cancel published assessments before deleting them.`
        );

        return;
      }

      setBulkDeleteLoading(
        true
      );

      setError(
        ""
      );

      try {
        const results =
          await Promise.allSettled(
            selectedPlans.map(
              (
                plan
              ) =>
                deleteAssessment(
                  plan.id
                )
            )
          );

        const failed =
          results.filter(
            (
              result
            ) =>
              result.status ===
              "rejected"
          );

        setBulkDeleteOpen(
          false
        );

        clearSelection();

        await load();

        if (
          failed.length
        ) {
          const firstReason =
            failed[0]
              ?.reason;

          setError(
            `${failed.length} assessment${
              failed.length ===
              1
                ? ""
                : "s"
            } could not be deleted. ${
              firstReason
                ?.response
                ?.data
                ?.message ||
              firstReason
                ?.message ||
              "They may contain teacher activity or results."
            }`
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
            "Unable to delete selected assessments"
        );
      } finally {
        setBulkDeleteLoading(
          false
        );
      }
    };

  const saved =
    async () => {
      setShowCreate(
        false
      );

      setEditTarget(
        null
      );

      setCancelTarget(
        null
      );

      await load();
    };

  // ====================================================
  // UI
  // ====================================================

  return (
    <div className="space-y-6">
      {/* HEADER */}

      <div
        className="
          flex
          min-w-0
          flex-col
          gap-4
          2xl:flex-row
          2xl:items-center
          2xl:justify-between
        "
      >
        <div className="min-w-0">
          <h1
            className="
              text-2xl
              font-bold
              text-slate-900
              dark:text-white
            "
          >
            Exams & Assessments
          </h1>

          <p
            className="
              mt-1
              max-w-4xl
              text-sm
              leading-6
              text-slate-500
              dark:text-slate-400
            "
          >
            Manage assessment schedules, teachers,
            course-wise availability windows, conduct
            status and student rosters.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            setShowCreate(
              true
            )
          }
          className={`${primaryButton} h-11 w-full sm:w-auto`}
        >
          <Plus
            size={
              18
            }
          />

          Schedule Assessment
        </button>
      </div>

      <Alert tone="danger">
        {error}
      </Alert>

      {/* STATS */}

      <div
        className="
          grid
          grid-cols-2
          gap-3
          lg:grid-cols-5
        "
      >
        <StatCard
          icon={
            CalendarDays
          }
          label="Total plans"
          value={
            totals.plans
          }
        />

        <StatCard
          icon={
            Send
          }
          label="Published"
          value={
            totals.published
          }
        />

        <StatCard
          icon={
            CalendarClock
          }
          label="Open / active"
          value={
            totals.active
          }
        />

        <StatCard
          icon={
            Clock3
          }
          label="Result pending"
          value={
            totals.pending
          }
        />

        <StatCard
          icon={
            CheckCircle2
          }
          label="Completed"
          value={
            totals.completed
          }
        />
      </div>

      {/* FILTERS */}

      <div
        className="
          rounded-2xl
          border
          border-slate-200
          bg-white
          p-3
          dark:border-slate-800
          dark:bg-slate-900
          sm:p-4
        "
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
          <label className="relative min-w-0 sm:col-span-2 xl:col-span-2 2xl:col-span-1">
            <Search
              size={17}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              className={`${inputClass} pl-10`}
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search assessment, course, teacher, program..."
            />
          </label>

          <select
            aria-label="Filter by batch"
            className={inputClass}
            value={batchFilter}
            onChange={(event) => {
              setBatchFilter(
                event.target.value
              );
              setDepartmentFilter(
                ""
              );
              setProgramFilter(
                ""
              );
              setSemesterFilter(
                ""
              );
            }}
          >
            <option value="">
              All batches
            </option>

            {academicData.batches.map(
              (batch) => (
                <option
                  key={batch.id}
                  value={batch.id}
                >
                  {batchLabel(
                    batch
                  )}
                </option>
              )
            )}
          </select>

          <select
            aria-label="Filter by department"
            className={inputClass}
            value={departmentFilter}
            onChange={(event) => {
              setDepartmentFilter(
                event.target.value
              );
              setProgramFilter(
                ""
              );
              setSemesterFilter(
                ""
              );
            }}
          >
            <option value="">
              All departments
            </option>

            {registerDepartmentOptions.map(
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

          <select
            aria-label="Filter by program"
            className={inputClass}
            value={programFilter}
            onChange={(event) => {
              setProgramFilter(
                event.target.value
              );
              setSemesterFilter(
                ""
              );
            }}
          >
            <option value="">
              All programs
            </option>

            {registerProgramOptions.map(
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

            {registerSemesterOptions.map(
              (semester) => {
                const program =
                  academicData.programs.find(
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

          <label className="relative">
            <ListFilter
              size={15}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <select
              className={`${inputClass} pl-9`}
              value={typeFilter}
              onChange={(event) =>
                setTypeFilter(
                  event.target.value
                )
              }
            >
              <option value="all">
                All types
              </option>
              <option value="quiz">
                Quiz
              </option>
              <option value="assignment">
                Assignment
              </option>
              <option value="mid">
                Mid
              </option>
            </select>
          </label>

          <select
            className={inputClass}
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value
              )
            }
          >
            <option value="all">
              All statuses
            </option>
            <option value="Draft">
              Draft
            </option>
            <option value="Scheduled">
              Scheduled
            </option>
            <option value="Window Open">
              Window Open
            </option>
            <option value="Prepared">
              Prepared
            </option>
            <option value="Conduct Scheduled">
              Conduct Scheduled
            </option>
            <option value="Conducting">
              Conducting
            </option>
            <option value="Result Pending">
              Result Pending
            </option>
            <option value="Completed">
              Completed
            </option>
            <option value="Slot Missed">
              Slot Missed
            </option>
            <option value="Missed">
              Missed
            </option>
            <option value="Cancelled">
              Cancelled
            </option>
          </select>
        </div>
      </div>

      {/* BULK ACTION BAR */}

      <SelectionActionBar
        count={
          selectedRows.length
        }
        label="rows selected"
        onClear={
          clearSelection
        }
        actions={[
          {
            key:
              "view",

            label:
              "View",

            icon:
              Eye,

            singleOnly:
              true,

            onClick:
              () => {
                const row =
                  selectedRows[0];

                if (
                  row?.plan
                ) {
                  setDetailId(
                    row.plan.id
                  );
                }
              },
          },

          {
            key:
              "edit",

            label:
              "Edit",

            icon:
              Pencil,

            singleOnly:
              true,

            disabled:
              selectedRows.length !==
                1 ||
              selectedRows[0]
                ?.plan
                ?.status ===
                "cancelled",

            title:
              selectedRows[0]
                ?.plan
                ?.status ===
              "cancelled"
                ? "Cancelled assessments cannot be edited"
                : "Edit selected assessment",

            onClick:
              () => {
                const row =
                  selectedRows[0];

                if (
                  row?.plan
                ) {
                  setEditTarget(
                    row.plan
                  );
                }
              },
          },

          ...(
            selectedRows.length ===
              1 &&
            selectedRows[0]
              ?.plan
              ?.status ===
              "draft"
              ? [
                  {
                    key:
                      "publish",

                    label:
                      actionId ===
                      selectedRows[0]
                        .plan.id
                        ? "Publishing..."
                        : "Publish",

                    icon:
                      Send,

                    disabled:
                      actionId ===
                      selectedRows[0]
                        .plan.id,

                    onClick:
                      () =>
                        publishDraft(
                          selectedRows[0]
                            .plan
                        ),
                  },
                ]
              : []
          ),

          ...(
            selectedRows.length ===
              1 &&
            selectedRows[0]
              ?.plan
              ?.status ===
              "published"
              ? [
                  {
                    key:
                      "cancel",

                    label:
                      "Cancel",

                    icon:
                      XCircle,

                    tone:
                      "warning",

                    onClick:
                      () =>
                        setCancelTarget(
                          selectedRows[0]
                            .plan
                        ),
                  },
                ]
              : []
          ),

          {
            key:
              "delete",

            label:
              selectedRows.length >
              1
                ? `Delete ${selectedRows.length}`
                : "Delete",

            icon:
              Trash2,

            tone:
              "danger",

            disabled:
              selectedPlans.some(
                (
                  plan
                ) =>
                  plan.status ===
                  "published"
              ) ||
              partiallySelectedPlans.length >
                0,

            title:
              selectedPlans.some(
                (
                  plan
                ) =>
                  plan.status ===
                  "published"
              )
                ? "Cancel published assessments before deleting them"
                : partiallySelectedPlans.length >
                    0
                  ? "This row belongs to an Entire Semester assessment. Select every course row of that assessment before deleting the complete schedule."
                  : "Delete selected assessment schedule(s)",

            onClick:
              () =>
                setBulkDeleteOpen(
                  true
                ),
          },
        ]}
      />

      {/* ================================================= */}
      {/* TABLE / MOBILE CARDS */}
      {/* ================================================= */}

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
        {loading ? (
          <div
            className="
              flex
              min-h-72
              items-center
              justify-center
            "
          >
            <Loader2
              size={
                28
              }
              className="animate-spin text-blue-600"
            />
          </div>
        ) : rows.length ===
          0 ? (
          <div
            className="
              flex
              min-h-72
              flex-col
              items-center
              justify-center
              px-6
              text-center
            "
          >
            <div
              className="
                rounded-2xl
                bg-slate-100
                p-4
                text-slate-500
                dark:bg-slate-800
              "
            >
              <CalendarDays
                size={
                  28
                }
              />
            </div>

            <h3
              className="
                mt-4
                font-bold
                text-slate-800
                dark:text-white
              "
            >
              No schedule rows found
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Create an assessment or change the current filters.
            </p>
          </div>
        ) : (
          <>
            {/* MOBILE / TABLET */}

            <div
              className="
                divide-y
                divide-slate-100
                dark:divide-slate-800
                xl:hidden
              "
            >
              {pageRows.map(
                ({
                  plan,
                  item,
                }) => {
                  const selected =
                    selectedRowIds.has(
                      item.id
                    );

                  return (
                    <div
                      key={
                        item.id
                      }
                      className={`p-4 transition ${
                        selected
                          ? "bg-blue-50/70 dark:bg-blue-500/5"
                          : "bg-white dark:bg-slate-900"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            toggleRowSelection(
                              item.id
                            )
                          }
                          aria-label={`Select ${plan.title}`}
                          className="mt-0.5 shrink-0 text-slate-500 transition hover:text-blue-600"
                        >
                          {selected ? (
                            <CheckSquare
                              size={
                                17
                              }
                            />
                          ) : (
                            <Square
                              size={
                                17
                              }
                            />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setDetailId(
                              plan.id
                            )
                          }
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="break-words font-bold text-slate-900 dark:text-white">
                              {
                                plan.title
                              }
                            </h3>

                            <StatusBadge
                              status={
                                item.display_status
                              }
                            />
                          </div>

                          <p className="mt-1 break-words text-xs text-slate-400">
                            {typeLabel(
                              plan.assessment_type
                            )}

                            {" · "}

                            {item
                              .course_assignment
                              ?.course
                              ?.name ||
                              "Course"}
                          </p>
                        </button>
                      </div>

                      <div
                        className="
                          mt-4
                          grid
                          grid-cols-1
                          gap-4
                          sm:grid-cols-2
                        "
                      >
                        <InfoCell
                          label="Academic scope"
                          value={`${plan.program?.name || "—"} · ${plan.semester?.name || "—"} · Batch ${batchLabel(plan.batch)}`}
                        />

                        <InfoCell
                          label="Teacher"
                          value={
                            item
                              .course_assignment
                              ?.teacher
                              ?.full_name ||
                            "Not assigned"
                          }
                        />

                        <InfoCell
                          label="Availability"
                          value={`${formatDateTime(item.starts_at)} → ${formatDateTime(item.ends_at)}`}
                        />

                        <InfoCell
                          label="Conduct slot"
                          value={
                            item.conduct_starts_at
                              ? `${formatDateTime(item.conduct_starts_at)} → ${formatDateTime(item.conduct_ends_at)}`
                              : "Not selected yet"
                          }
                        />

                        <InfoCell
                          label="Students"
                          value={
                            item.student_count ||
                            0
                          }
                        />

                        <InfoCell
                          label="Maximum marks"
                          value={
                            item.max_marks
                          }
                        />
                      </div>
                    </div>
                  );
                }
              )}
            </div>

            {/* DESKTOP TABLE */}

            <div className="hidden xl:block">
              <table className="w-full table-fixed text-left text-sm">
                <thead>
                  <tr
                    className="
                      border-b
                      border-slate-200
                      text-xs
                      uppercase
                      tracking-wide
                      text-slate-400
                      dark:border-slate-800
                    "
                  >
                    <th className="w-[4%] px-3 py-4">
                      <button
                        type="button"
                        onClick={
                          toggleAllCurrentPage
                        }
                        aria-label="Select all rows on current page"
                        className="text-slate-500 transition hover:text-blue-600"
                      >
                        {allCurrentPageSelected ? (
                          <CheckSquare
                            size={
                              16
                            }
                          />
                        ) : (
                          <Square
                            size={
                              16
                            }
                          />
                        )}
                      </button>
                    </th>

                    <th className="w-[15%] px-3 py-4 font-semibold">
                      Assessment
                    </th>

                    <th className="w-[16%] px-3 py-4 font-semibold">
                      Academic Context
                    </th>

                    <th className="w-[19%] px-3 py-4 font-semibold">
                      Course & Teacher
                    </th>

                    <th className="w-[24%] px-3 py-4 font-semibold">
                      Availability / Conduct
                    </th>

                    <th className="w-[10%] px-3 py-4 font-semibold">
                      Students / Marks
                    </th>

                    <th className="w-[12%] px-3 py-4 font-semibold">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody
                  className="
                    divide-y
                    divide-slate-100
                    dark:divide-slate-800
                  "
                >
                  {pageRows.map(
                    ({
                      plan,
                      item,
                    }) => {
                      const selected =
                        selectedRowIds.has(
                          item.id
                        );

                      return (
                        <tr
                          key={
                            item.id
                          }
                          className={`align-top transition hover:bg-slate-50 dark:hover:bg-slate-800/40 ${
                            selected
                              ? "bg-blue-50/60 dark:bg-blue-500/5"
                              : ""
                          }`}
                        >
                          <td className="px-3 py-4">
                            <button
                              type="button"
                              onClick={() =>
                                toggleRowSelection(
                                  item.id
                                )
                              }
                              aria-label={`Select ${plan.title}`}
                              className="text-slate-500 transition hover:text-blue-600"
                            >
                              {selected ? (
                                <CheckSquare
                                  size={
                                    16
                                  }
                                />
                              ) : (
                                <Square
                                  size={
                                    16
                                  }
                                />
                              )}
                            </button>
                          </td>

                          <td className="min-w-0 px-3 py-4">
                            <button
                              type="button"
                              onClick={() =>
                                setDetailId(
                                  plan.id
                                )
                              }
                              className="block w-full min-w-0 text-left"
                            >
                              <p className="break-words font-bold leading-5 text-slate-900 hover:text-blue-600 dark:text-white">
                                {
                                  plan.title
                                }
                              </p>

                              <p className="mt-1 break-words text-xs leading-4 text-slate-400">
                                {typeLabel(
                                  plan.assessment_type
                                )}

                                {" · "}

                                {plan.scope_type ===
                                "semester"
                                  ? "Entire Semester"
                                  : "Specific Course"}
                              </p>
                            </button>
                          </td>

                          <td className="min-w-0 px-3 py-4">
                            <p className="break-words font-medium leading-5 text-slate-700 dark:text-slate-200">
                              {plan.program
                                ?.name ||
                                "—"}
                            </p>

                            <p className="mt-1 break-words text-xs leading-4 text-slate-400">
                              Batch{" "}
                              {batchLabel(
                                plan.batch
                              )}

                              {" · "}

                              {plan.semester
                                ?.name ||
                                "Semester"}
                            </p>
                          </td>

                          <td className="min-w-0 px-3 py-4">
                            <p className="break-words font-semibold leading-5 text-slate-800 dark:text-slate-100">
                              {item
                                .course_assignment
                                ?.course
                                ?.name ||
                                "Course"}
                            </p>

                            <p className="mt-1 break-words text-xs leading-4 text-slate-400">
                              {item
                                .course_assignment
                                ?.course
                                ?.course_code ||
                                ""}
                            </p>

                            <p className="mt-2 break-words text-xs font-medium leading-4 text-slate-600 dark:text-slate-300">
                              {item
                                .course_assignment
                                ?.teacher
                                ?.full_name ||
                                "Teacher not assigned"}
                            </p>
                          </td>

                          <td className="min-w-0 px-3 py-4">
                            <p className="break-words text-xs font-semibold leading-4 text-slate-700 dark:text-slate-200">
                              {formatDateTime(
                                item.starts_at
                              )}
                            </p>

                            <p className="mt-1 break-words text-xs leading-4 text-slate-400">
                              to{" "}
                              {formatDateTime(
                                item.ends_at
                              )}

                              {" · "}

                              {durationLabel(
                                item.starts_at,
                                item.ends_at
                              )}
                            </p>

                            <p className="mt-2 break-words text-[11px] font-medium leading-4 text-violet-600 dark:text-violet-300">
                              {item.conduct_starts_at
                                ? `Conduct: ${formatDateTime(item.conduct_starts_at)} → ${formatDateTime(item.conduct_ends_at)}`
                                : "Exact conduct slot not selected"}
                            </p>
                          </td>

                          <td className="min-w-0 px-3 py-4">
                            <p className="break-words font-semibold leading-5 text-slate-700 dark:text-slate-200">
                              {item.student_count ||
                                0}{" "}
                              students
                            </p>

                            <p className="mt-1 break-words text-xs leading-4 text-slate-400">
                              Max:{" "}
                              {
                                item.max_marks
                              }{" "}
                              marks
                            </p>

                            {item.roster_summary
                              ?.graded ? (
                              <p className="mt-1 break-words text-xs font-medium leading-4 text-emerald-600">
                                {
                                  item
                                    .roster_summary
                                    .graded
                                }{" "}
                                graded
                              </p>
                            ) : null}
                          </td>

                          <td className="min-w-0 px-2 py-4 pr-4">
                            <div className="flex min-w-0 items-start justify-start overflow-visible">
                              <StatusBadge
                                compact
                                status={
                                  item.display_status
                                }
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* PAGINATION */}

        {!loading &&
        rows.length >
          0 ? (
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
              text-slate-500
              dark:border-slate-800
            "
          >
            <span>
              Showing{" "}
              {
                showingFrom
              }
              –
              {
                showingTo
              }{" "}
              of{" "}
              {
                rows.length
              }
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={
                  currentPage <=
                  1
                }
                onClick={() =>
                  setCurrentPage(
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
                className="rounded-lg border border-slate-200 p-2 disabled:opacity-30 dark:border-slate-800"
                aria-label="Previous page"
              >
                <ChevronLeft
                  size={
                    15
                  }
                />
              </button>

              <span className="font-semibold">
                {
                  currentPage
                }
                /
                {
                  totalPages
                }
              </span>

              <button
                type="button"
                disabled={
                  currentPage >=
                  totalPages
                }
                onClick={() =>
                  setCurrentPage(
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
                className="rounded-lg border border-slate-200 p-2 disabled:opacity-30 dark:border-slate-800"
                aria-label="Next page"
              >
                <ChevronRight
                  size={
                    15
                  }
                />
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {/* MODALS */}

      {showCreate ? (
        <AssessmentEditorModal
          onClose={() =>
            setShowCreate(
              false
            )
          }
          onSaved={
            saved
          }
        />
      ) : null}

      {editTarget ? (
        <AssessmentEditorModal
          assessment={
            editTarget
          }
          onClose={() =>
            setEditTarget(
              null
            )
          }
          onSaved={
            saved
          }
        />
      ) : null}

      {detailId ? (
        <AssessmentDetailModal
          assessmentId={
            detailId
          }
          onClose={() =>
            setDetailId(
              ""
            )
          }
          onEdit={(
            assessment
          ) => {
            setDetailId(
              ""
            );

            setEditTarget(
              assessment
            );
          }}
        />
      ) : null}

      {cancelTarget ? (
        <CancelModal
          assessment={
            cancelTarget
          }
          onClose={() =>
            setCancelTarget(
              null
            )
          }
          onSaved={
            saved
          }
        />
      ) : null}

      <ConfirmDialog
        open={
          bulkDeleteOpen
        }
        onClose={() => {
          if (
            !bulkDeleteLoading
          ) {
            setBulkDeleteOpen(
              false
            );
          }
        }}
        onConfirm={
          confirmBulkDelete
        }
        loading={
          bulkDeleteLoading
        }
        title="Delete Selected Assessments"
        confirmLabel="Delete Selected"
        message={
          selectedPlans.length
            ? `Permanently delete ${selectedPlans.length} complete assessment schedule${
                selectedPlans.length ===
                1
                  ? ""
                  : "s"
              } covering ${selectedRows.length} selected row${
                selectedRows.length ===
                1
                  ? ""
                  : "s"
              }? Draft/Cancelled assessments can only be deleted when they have no teacher activity or results.`
            : ""
        }
      />

      <ConfirmDialog
        open={Boolean(
          deleteTarget
        )}
        onClose={() => {
          if (
            !deleteLoading
          ) {
            setDeleteTarget(
              null
            );
          }
        }}
        onConfirm={
          confirmDelete
        }
        loading={
          deleteLoading
        }
        title="Delete Assessment"
        confirmLabel="Delete"
        message={
          deleteTarget
            ? `Delete “${deleteTarget.title}”? Only Draft/Cancelled assessments without teacher activity or results can be permanently deleted.`
            : ""
        }
      />
    </div>
  );
}

// ======================================================
// PAGE
// ======================================================

function Assessments() {
  return (
    <main
      className="
        min-h-full
        min-w-0
        bg-slate-50
        p-4
        text-slate-700
        dark:bg-slate-950
        dark:text-slate-200
        md:p-6
        xl:p-8
      "
    >
      <div
        className="
          mx-auto
          min-w-0
          max-w-[1700px]
          animate-fade-in
        "
      >
        <ScheduleRegister />
      </div>
    </main>
  );
}

export default Assessments;
