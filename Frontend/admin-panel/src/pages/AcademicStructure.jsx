import {
  Fragment,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Building2,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Edit2,
  GraduationCap,
  Layers3,
  Trash2,
  UserCheck,
  UserX,
  X,
} from "lucide-react";

import AcademicStructureService from "../services/AcademicStructureService";

import {
  EmptyState,
  PageHeader,
  TableSkeleton,
} from "../components/PageHeader";

import ConfirmDialog from "../components/ConfirmDialog";

import {
  BatchModal,
  DepartmentModal,
  ProgramModal,
  SemesterModal,
} from "../components/AcademicStructureModals";

// ======================================================
// HELPERS
// ======================================================

const unwrap = (response) => {
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

const actionErrorMessage = (
  error,
  fallback = "Unable to complete this action"
) =>
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  error?.message ||
  fallback;

const sameId = (a, b) =>
  String(a || "") === String(b || "");

// ======================================================
// TABS
// IMPORTANT:
// Never derive Batch -> "batche" using slice.
// ======================================================

const tabs = [
  {
    id: "departments",
    type: "department",
    label: "Departments",
    singular: "Department",
    icon: Building2,
  },
  {
    id: "programs",
    type: "program",
    label: "Programs",
    singular: "Program",
    icon: Layers3,
  },
  {
    id: "semesters",
    type: "semester",
    label: "Semesters",
    singular: "Semester",
    icon: GraduationCap,
  },
  {
    id: "batches",
    type: "batch",
    label: "Batches",
    singular: "Batch",
    icon: GraduationCap,
  },
];

// ======================================================
// BADGES
// ======================================================

const StatusBadge = ({ value }) => (
  <span
    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
      value === "active"
        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
    }`}
  >
    {value || "inactive"}
  </span>
);

const ConfigurationBadge = ({ ready }) => (
  <span
    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
      ready
        ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
        : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
    }`}
  >
    {ready ? "Ready" : "Needs setup"}
  </span>
);

// ======================================================
// CHECKBOX
// ======================================================

const RowCheckbox = ({
  checked,
  onChange,
  label,
}) => (
  <input
    type="checkbox"
    checked={checked}
    onChange={onChange}
    aria-label={label}
    className="
      h-4
      w-4
      cursor-pointer
      rounded
      border-slate-300
      text-blue-600
      focus:ring-blue-500
      dark:border-slate-600
      dark:bg-slate-800
    "
  />
);

// ======================================================
// PAGE
// ======================================================

function AcademicStructure({
  initialTab = "departments",
}) {
  const [
    activeTab,
    setActiveTab,
  ] = useState(initialTab);

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
    search,
    setSearch,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  const [
    modal,
    setModal,
  ] = useState(null);

  const [
    confirm,
    setConfirm,
  ] = useState(null);

  const [
    confirming,
    setConfirming,
  ] = useState(false);

  const [
    expandedBatch,
    setExpandedBatch,
  ] = useState(null);

  const [
    selectedIds,
    setSelectedIds,
  ] = useState([]);

  // ====================================================
  // CURRENT TAB
  // ====================================================

  const currentTab =
    tabs.find(
      (tab) =>
        tab.id === activeTab
    ) || tabs[0];

  const currentType =
    currentTab.type;

  const Icon =
    currentTab.icon;

  // ====================================================
  // INITIAL TAB
  // ====================================================

  useEffect(() => {
    setActiveTab(initialTab);
    setSearch("");
    setSelectedIds([]);
    setExpandedBatch(null);
  }, [initialTab]);

  // ====================================================
  // LOAD DATA
  // ====================================================

  const load = async () => {
    setLoading(true);
    setError("");

    try {
      const [
        batchResponse,
        departmentResponse,
        programResponse,
        semesterResponse,
      ] = await Promise.all([
        AcademicStructureService.getBatches(),
        AcademicStructureService.getDepartments(),
        AcademicStructureService.getPrograms(),
        AcademicStructureService.getSemesters(),
      ]);

      setBatches(
        unwrap(batchResponse)
      );

      setDepartments(
        unwrap(departmentResponse)
      );

      setPrograms(
        unwrap(programResponse)
      );

      setSemesters(
        unwrap(semesterResponse)
      );
    } catch (loadError) {
      setError(
        actionErrorMessage(
          loadError,
          "Failed to load Academic Structure"
        )
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // ====================================================
  // NOTIFICATION
  // ====================================================

  const notify = (message) => {
    setSuccess(message);

    window.setTimeout(() => {
      setSuccess("");
    }, 3000);
  };

  // ====================================================
  // CURRENT SOURCE
  // ====================================================

  const currentSource = useMemo(() => {
    if (activeTab === "departments") {
      return departments;
    }

    if (activeTab === "programs") {
      return programs;
    }

    if (activeTab === "semesters") {
      return semesters;
    }

    return batches;
  }, [
    activeTab,
    batches,
    departments,
    programs,
    semesters,
  ]);

  // ====================================================
  // FILTER
  // ====================================================

  const rows = useMemo(() => {
    const query =
      search
        .trim()
        .toLowerCase();

    if (!query) {
      return currentSource;
    }

    return currentSource.filter((row) =>
      JSON.stringify(row)
        .toLowerCase()
        .includes(query)
    );
  }, [
    currentSource,
    search,
  ]);

  // ====================================================
  // SELECTION
  // ====================================================

  const visibleIds = useMemo(
    () =>
      rows
        .map((row) => row.id)
        .filter(Boolean),
    [rows]
  );

  const selectedRows = useMemo(
    () =>
      currentSource.filter((row) =>
        selectedIds.some((id) =>
          sameId(id, row.id)
        )
      ),
    [
      currentSource,
      selectedIds,
    ]
  );

  const allVisibleSelected =
    visibleIds.length > 0 &&
    visibleIds.every((id) =>
      selectedIds.some((selectedId) =>
        sameId(selectedId, id)
      )
    );

  const toggleRow = (id) => {
    setSelectedIds((old) => {
      const exists =
        old.some((value) =>
          sameId(value, id)
        );

      if (exists) {
        return old.filter(
          (value) =>
            !sameId(value, id)
        );
      }

      return [
        ...old,
        id,
      ];
    });
  };

  const toggleAllVisible = () => {
    setSelectedIds((old) => {
      if (allVisibleSelected) {
        return old.filter(
          (id) =>
            !visibleIds.some(
              (visibleId) =>
                sameId(
                  visibleId,
                  id
                )
            )
        );
      }

      const merged = [
        ...old,
      ];

      for (const id of visibleIds) {
        if (
          !merged.some(
            (existing) =>
              sameId(
                existing,
                id
              )
          )
        ) {
          merged.push(id);
        }
      }

      return merged;
    });
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  // ====================================================
  // RELATION HELPERS
  // ====================================================

  const departmentForProgram = (
    program
  ) =>
    departments.find(
      (department) =>
        sameId(
          department.id,
          program?.department_id
        )
    );

  const programForSemester = (
    semester
  ) =>
    programs.find(
      (program) =>
        sameId(
          program.id,
          semester?.program_id
        )
    );

  // ====================================================
  // TAB CHANGE
  // ====================================================

  const changeTab = (tabId) => {
    setActiveTab(tabId);
    setSearch("");
    setSelectedIds([]);
    setExpandedBatch(null);
    setError("");
  };

  // ====================================================
  // CREATE
  // ====================================================

  const openCreate = () => {
    setError("");

    if (
      activeTab === "programs" &&
      departments.length === 0
    ) {
      setError(
        "Create a Department before adding a Program."
      );

      return;
    }

    if (
      activeTab === "semesters" &&
      programs.length === 0
    ) {
      setError(
        "Create a Program before adding a Semester."
      );

      return;
    }

    if (
      activeTab === "batches" &&
      (
        !departments.length ||
        !programs.length ||
        !semesters.length
      )
    ) {
      setError(
        "Create Departments, Programs and Semesters before configuring a Batch."
      );

      return;
    }

    setModal({
      type:
        currentType,

      data:
        null,
    });
  };

  // ====================================================
  // SAVE
  // ====================================================

  const save = async (
    type,
    data,
    id = null
  ) => {
    // --------------------------------------------------
    // BULK SEMESTER CREATE
    // --------------------------------------------------

    if (
      type === "semester" &&
      !id &&
      Array.isArray(
        data?.semesters
      )
    ) {
      const response =
        await AcademicStructureService.createSemestersBulk(
          data
        );

      setModal(null);

      notify(
        response?.data?.message ||
          `${data.semesters.length} Semester${
            data.semesters.length === 1
              ? ""
              : "s"
          } created successfully`
      );

      await load();

      return response;
    }

    // --------------------------------------------------
    // NORMAL CREATE / UPDATE
    // --------------------------------------------------

    const capitalized =
      `${type[0].toUpperCase()}${type.slice(
        1
      )}`;

    const method =
      `${
        id
          ? "update"
          : "create"
      }${capitalized}`;

    const handler =
      AcademicStructureService[
        method
      ];

    if (
      typeof handler !==
      "function"
    ) {
      throw new Error(
        `${method} service function is missing`
      );
    }

    const response =
      id
        ? await handler(
            id,
            data
          )
        : await handler(
            data
          );

    setModal(null);

    notify(
      response?.data?.message ||
        `${capitalized} ${
          id
            ? "updated"
            : "created"
        } successfully`
    );

    await load();

    return response;
  };

  // ====================================================
  // STATUS PAYLOAD
  // ====================================================

  const statusPayload = (
    type,
    row,
    status
  ) => {
    if (type === "batch") {
      return {
        start_year:
          row.start_year,

        end_year:
          row.end_year,

        status,
      };
    }

    if (type === "department") {
      return {
        name:
          row.name,

        code:
          row.code,

        description:
          row.description,

        status,
      };
    }

    if (type === "program") {
      return {
        department_id:
          row.department_id,

        name:
          row.name,

        code:
          row.code,

        degree_title:
          row.degree_title,

        status,
      };
    }

    return {
      program_id:
        row.program_id,

      semester_number:
        row.semester_number,

      name:
        row.name,

      status,
    };
  };

  // ====================================================
  // SERVICE METHODS
  // ====================================================

  const serviceMethod = (
    prefix,
    type
  ) => {
    const capitalized =
      `${type[0].toUpperCase()}${type.slice(
        1
      )}`;

    const methodName =
      `${prefix}${capitalized}`;

    const handler =
      AcademicStructureService[
        methodName
      ];

    if (
      typeof handler !==
      "function"
    ) {
      throw new Error(
        `${methodName} service function is missing`
      );
    }

    return handler;
  };

  // ====================================================
  // SINGLE CONFIRM
  // ====================================================

  const runSingleAction = async () => {
    const {
      action,
      type,
      row,
    } = confirm;

    if (!row?.id) {
      return {
        success: false,
        message:
          "Invalid item",
      };
    }

    if (action === "delete") {
      const handler =
        serviceMethod(
          "delete",
          type
        );

      await handler(
        row.id
      );

      return {
        success: true,
        message: `${
          type[0].toUpperCase()
        }${type.slice(
          1
        )} deleted successfully`,
      };
    }

    const status =
      row.status === "active"
        ? "inactive"
        : "active";

    const handler =
      serviceMethod(
        "update",
        type
      );

    await handler(
      row.id,
      statusPayload(
        type,
        row,
        status
      )
    );

    return {
      success: true,
      message: `${
        type[0].toUpperCase()
      }${type.slice(
        1
      )} ${
        status === "active"
          ? "activated"
          : "deactivated"
      } successfully`,
    };
  };

  // ====================================================
  // BULK CONFIRM
  // ====================================================

  const runBulkAction = async () => {
    const {
      action,
      type,
      rows:
        targetRows = [],
      targetStatus,
    } = confirm;

    let successCount = 0;

    const failures = [];

    // Sequential operation is intentional.
    // Hard deletes may touch large dependency trees.
    for (const row of targetRows) {
      try {
        if (
          action ===
          "bulk-delete"
        ) {
          const handler =
            serviceMethod(
              "delete",
              type
            );

          await handler(
            row.id
          );
        } else {
          const handler =
            serviceMethod(
              "update",
              type
            );

          await handler(
            row.id,
            statusPayload(
              type,
              row,
              targetStatus
            )
          );
        }

        successCount += 1;
      } catch (
        itemError
      ) {
        failures.push({
          row,
          message:
            actionErrorMessage(
              itemError
            ),
        });
      }
    }

    return {
      successCount,
      failures,
    };
  };

  // ====================================================
  // CONFIRMED ACTION
  // ====================================================

  const runConfirmedAction =
    async () => {
      if (!confirm) {
        return;
      }

      setConfirming(true);
      setError("");

      try {
        const isBulk =
          confirm.action ===
            "bulk-delete" ||
          confirm.action ===
            "bulk-status";

        if (isBulk) {
          const result =
            await runBulkAction();

          setConfirm(null);
          setSelectedIds([]);

          await load();

          if (
            result.failures.length
          ) {
            const firstFailure =
              result.failures[0];

            setError(
              `${result.successCount} item(s) completed, ${result.failures.length} failed. ${firstFailure.message}`
            );

            return;
          }

          notify(
            `${result.successCount} ${
              currentTab.label
            } ${
              confirm.action ===
              "bulk-delete"
                ? "deleted"
                : confirm.targetStatus ===
                    "active"
                ? "activated"
                : "deactivated"
            } successfully`
          );

          return;
        }

        const result =
          await runSingleAction();

        setConfirm(null);
        setSelectedIds([]);

        await load();

        notify(
          result.message
        );
      } catch (
        actionError
      ) {
        setError(
          actionErrorMessage(
            actionError
          )
        );
      } finally {
        setConfirming(false);
      }
    };

  // ====================================================
  // BULK ACTION REQUEST
  // ====================================================

  const requestBulkStatus = (
    status
  ) => {
    if (
      selectedRows.length ===
      0
    ) {
      return;
    }

    setConfirm({
      action:
        "bulk-status",

      type:
        currentType,

      rows:
        selectedRows,

      targetStatus:
        status,
    });
  };

  const requestBulkDelete =
    () => {
      if (
        selectedRows.length ===
        0
      ) {
        return;
      }

      setConfirm({
        action:
          "bulk-delete",

        type:
          currentType,

        rows:
          selectedRows,
      });
    };

  // ====================================================
  // ROW ACTIONS
  // Hide single row actions during bulk selection.
  // ====================================================

  const Actions = ({
    type,
    row,
  }) => {
    if (
      selectedIds.length >
      0
    ) {
      return (
        <span className="text-xs text-slate-400">
          Bulk mode
        </span>
      );
    }

    const active =
      row.status ===
      "active";

    return (
      <div className="flex justify-end gap-1">
        <button
          type="button"
          onClick={() =>
            setModal({
              type,
              data: row,
            })
          }
          title={`Edit ${type}`}
          className="
            rounded-lg
            p-2
            text-blue-500
            transition
            hover:bg-blue-50
            dark:hover:bg-blue-500/10
          "
        >
          <Edit2
            size={16}
          />
        </button>

        <button
          type="button"
          onClick={() =>
            setConfirm({
              action:
                "status",

              type,

              row,
            })
          }
          title={
            active
              ? "Deactivate"
              : "Activate"
          }
          className={`rounded-lg p-2 transition ${
            active
              ? "text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10"
              : "text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
          }`}
        >
          {active ? (
            <UserX
              size={16}
            />
          ) : (
            <UserCheck
              size={16}
            />
          )}
        </button>

        <button
          type="button"
          onClick={() =>
            setConfirm({
              action:
                "delete",

              type,

              row,
            })
          }
          title={`Delete ${type}`}
          className="
            rounded-lg
            p-2
            text-red-500
            transition
            hover:bg-red-50
            dark:hover:bg-red-500/10
          "
        >
          <Trash2
            size={16}
          />
        </button>
      </div>
    );
  };

  // ====================================================
  // TABLE HEADERS
  // ====================================================

  const renderHeader = () => {
    if (
      activeTab ===
      "departments"
    ) {
      return [
        "Department",
        "Code",
        "Programs",
        "Status",
        "Actions",
      ];
    }

    if (
      activeTab ===
      "programs"
    ) {
      return [
        "Program",
        "Department",
        "Semesters",
        "Status",
        "Actions",
      ];
    }

    if (
      activeTab ===
      "semesters"
    ) {
      return [
        "Semester",
        "Program",
        "Number",
        "Status",
        "Actions",
      ];
    }

    return [
      "Batch",
      "Departments",
      "Programs",
      "Configuration",
      "Status",
      "Actions",
    ];
  };

  // ====================================================
  // MASTER ROW
  // ====================================================

  const renderMasterRow = (
    row
  ) => {
    if (
      activeTab ===
      "departments"
    ) {
      return (
        <>
          <td className="px-6 py-4 font-semibold text-slate-800 dark:text-slate-200">
            {row.name}
          </td>

          <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
            {row.code ||
              "—"}
          </td>

          <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
            {
              programs.filter(
                (program) =>
                  sameId(
                    program.department_id,
                    row.id
                  )
              ).length
            }
          </td>

          <td className="px-6 py-4">
            <StatusBadge
              value={
                row.status
              }
            />
          </td>

          <td className="px-6 py-4 text-right">
            <Actions
              type="department"
              row={row}
            />
          </td>
        </>
      );
    }

    if (
      activeTab ===
      "programs"
    ) {
      return (
        <>
          <td className="px-6 py-4">
            <p className="font-semibold text-slate-800 dark:text-slate-200">
              {row.name}
            </p>

            <p className="text-xs text-slate-500">
              {row.code ||
                row.degree_title ||
                "No code"}
            </p>
          </td>

          <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
            {departmentForProgram(
              row
            )?.name ||
              "—"}
          </td>

          <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
            {
              semesters.filter(
                (semester) =>
                  sameId(
                    semester.program_id,
                    row.id
                  )
              ).length
            }
          </td>

          <td className="px-6 py-4">
            <StatusBadge
              value={
                row.status
              }
            />
          </td>

          <td className="px-6 py-4 text-right">
            <Actions
              type="program"
              row={row}
            />
          </td>
        </>
      );
    }

    const program =
      programForSemester(
        row
      );

    return (
      <>
        <td className="px-6 py-4 font-semibold text-slate-800 dark:text-slate-200">
          {row.name}
        </td>

        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
          {program?.name ||
            "—"}
        </td>

        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
          {
            row.semester_number
          }
        </td>

        <td className="px-6 py-4">
          <StatusBadge
            value={
              row.status
            }
          />
        </td>

        <td className="px-6 py-4 text-right">
          <Actions
            type="semester"
            row={row}
          />
        </td>
      </>
    );
  };

  // ====================================================
  // DEPARTMENT DELETE WARNING
  // ====================================================

  const departmentDeleteWarning = (
    name,
    count = null
  ) => (
    <span className="block space-y-2">
      <span className="block font-semibold text-red-700 dark:text-red-300">
        This is a permanent hard delete.
      </span>

      <span className="block">
        {count
          ? `You are deleting ${count} Department(s).`
          : (
              <>
                Deleting{" "}
                <strong>
                  {name ||
                    "this Department"}
                </strong>.
              </>
            )}
      </span>

      <span className="block">
        The selected Department data will permanently remove:
        Programs, Semesters, Courses, Course Assignments,
        Enrollments, Assignments, Assignment Submissions,
        Quizzes, Quiz Attempts, Quiz Submissions,
        Attendance, Gradebook data, Materials,
        Assessment schedules and linked course history.
      </span>

      <span className="block">
        Students belonging to the Department will also be
        deleted. Their Supabase Auth accounts will be removed
        by the backend.
      </span>

      <span className="block">
        Teacher accounts will be preserved, but links to the
        deleted Department and deleted Courses will be removed.
      </span>

      <span className="block">
        Shared Batches are preserved. Material database rows
        are deleted, and the backend will also attempt to
        remove linked files from Supabase Storage.
      </span>

      <span className="block font-semibold">
        This action cannot be undone.
      </span>
    </span>
  );

  // ====================================================
  // CONFIRM MESSAGE
  // ====================================================

  const confirmMessage = () => {
    if (!confirm) {
      return "";
    }

    // --------------------------------------------------
    // BULK STATUS
    // --------------------------------------------------

    if (
      confirm.action ===
      "bulk-status"
    ) {
      return `Are you sure you want to ${
        confirm.targetStatus ===
        "active"
          ? "activate"
          : "deactivate"
      } ${
        confirm.rows?.length ||
        0
      } selected ${currentTab.label}?`;
    }

    // --------------------------------------------------
    // BULK DELETE
    // --------------------------------------------------

    if (
      confirm.action ===
      "bulk-delete"
    ) {
      if (
        confirm.type ===
        "department"
      ) {
        return departmentDeleteWarning(
          null,
          confirm.rows?.length ||
            0
        );
      }

      if (
        confirm.type ===
        "batch"
      ) {
        return `This will permanently delete ${
          confirm.rows?.length ||
          0
        } selected Batch(es) and their Batch-specific mappings/data. Reusable Departments, Programs and Semesters will be preserved. Continue?`;
      }

      if (
        confirm.type ===
        "program"
      ) {
        return `This will permanently delete ${
          confirm.rows?.length ||
          0
        } selected Program(s), their Semesters and linked academic data. Shared Batches will be preserved. Continue?`;
      }

      return `This will permanently delete ${
        confirm.rows?.length ||
        0
      } selected Semester(s) and linked academic data. Continue?`;
    }

    // --------------------------------------------------
    // SINGLE STATUS
    // --------------------------------------------------

    if (
      confirm.action !==
      "delete"
    ) {
      return `Are you sure you want to ${
        confirm.row?.status ===
        "active"
          ? "deactivate"
          : "activate"
      } this ${
        confirm.type ||
        "item"
      }?`;
    }

    // --------------------------------------------------
    // SINGLE DELETE
    // --------------------------------------------------

    if (
      confirm.type ===
      "department"
    ) {
      return departmentDeleteWarning(
        confirm.row?.name
      );
    }

    if (
      confirm.type ===
      "batch"
    ) {
      return "This permanently deletes this Batch and its Batch-specific mappings/data. Reusable Departments, Programs and Semesters are preserved. Continue?";
    }

    if (
      confirm.type ===
      "program"
    ) {
      return "This permanently deletes this Program, its Semesters and linked academic data. Shared Batches are preserved. Continue?";
    }

    if (
      confirm.type ===
      "semester"
    ) {
      return "This permanently deletes this Semester and linked academic data. Continue?";
    }

    return "This permanently deletes linked records. Continue?";
  };

  // ====================================================
  // CONFIRM TITLE
  // ====================================================

  const confirmTitle = () => {
    if (!confirm) {
      return "";
    }

    if (
      confirm.action ===
      "bulk-delete"
    ) {
      return `Delete ${confirm.rows?.length || 0} ${currentTab.label}`;
    }

    if (
      confirm.action ===
      "bulk-status"
    ) {
      return `${
        confirm.targetStatus ===
        "active"
          ? "Activate"
          : "Deactivate"
      } ${confirm.rows?.length || 0} ${currentTab.label}`;
    }

    if (
      confirm.action ===
      "delete"
    ) {
      return `Delete ${
        confirm.type ||
        "item"
      }`;
    }

    return confirm.row?.status ===
      "active"
      ? `Deactivate ${
          confirm.type ||
          "item"
        }`
      : `Activate ${
          confirm.type ||
          "item"
        }`;
  };

  // ====================================================
  // CONFIRM LABEL
  // ====================================================

  const confirmLabel = () => {
    if (!confirm) {
      return "Confirm";
    }

    if (
      confirm.action ===
        "delete" ||
      confirm.action ===
        "bulk-delete"
    ) {
      return "Delete Permanently";
    }

    if (
      confirm.action ===
      "bulk-status"
    ) {
      return confirm.targetStatus ===
        "active"
        ? "Activate"
        : "Deactivate";
    }

    return confirm.row?.status ===
      "active"
      ? "Deactivate"
      : "Activate";
  };

  // ====================================================
  // UI
  // ====================================================

  return (
    <main className="p-4 md:p-8">
      <PageHeader
        title="Academic Structure"
        description="Create reusable Departments, Programs and Semesters, then configure which Programs run in each Batch."
        search={search}
        onSearchChange={
          setSearch
        }
        searchPlaceholder={`Search ${currentTab.label.toLowerCase()}...`}
        actionLabel={`Add ${currentTab.singular}`}
        onAction={
          openCreate
        }
      />

      {/* =================================================
          TABS
      ================================================= */}

      <div className="mb-6 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
        <div className="flex min-w-max gap-1">
          {tabs.map((tab) => {
            const TabIcon =
              tab.icon;

            const active =
              activeTab ===
              tab.id;

            return (
              <button
                key={
                  tab.id
                }
                type="button"
                onClick={() =>
                  changeTab(
                    tab.id
                  )
                }
                className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
                  active
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                <TabIcon
                  size={16}
                />

                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* =================================================
          ERROR
      ================================================= */}

      {error && (
        <div className="mb-5 flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
          <span>
            {error}
          </span>

          <button
            type="button"
            onClick={() =>
              setError("")
            }
            className="shrink-0 font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* =================================================
          SUCCESS
      ================================================= */}

      {success && (
        <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">
          {success}
        </div>
      )}

      {/* =================================================
          BULK TOOLBAR
      ================================================= */}

      {selectedRows.length > 0 && (
        <div
          className="
            mb-5
            flex
            flex-col
            gap-3
            rounded-2xl
            border
            border-blue-200
            bg-blue-50
            p-4
            sm:flex-row
            sm:items-center
            sm:justify-between
            dark:border-blue-500/20
            dark:bg-blue-500/10
          "
        >
          <div className="flex items-center gap-3">
            <div
              className="
                flex
                h-9
                w-9
                items-center
                justify-center
                rounded-xl
                bg-blue-600
                text-white
              "
            >
              <CheckSquare
                size={18}
              />
            </div>

            <div>
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                {selectedRows.length}{" "}
                {selectedRows.length === 1
                  ? currentTab.singular
                  : currentTab.label}{" "}
                selected
              </p>

              <p className="text-xs text-blue-600 dark:text-blue-300">
                Choose a bulk action
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                requestBulkStatus(
                  "active"
                )
              }
              className="
                inline-flex
                h-10
                items-center
                gap-2
                rounded-xl
                border
                border-emerald-200
                bg-white
                px-3
                text-sm
                font-semibold
                text-emerald-600
                transition
                hover:bg-emerald-50
                dark:border-emerald-500/20
                dark:bg-slate-900
              "
            >
              <UserCheck
                size={16}
              />

              Activate
            </button>

            <button
              type="button"
              onClick={() =>
                requestBulkStatus(
                  "inactive"
                )
              }
              className="
                inline-flex
                h-10
                items-center
                gap-2
                rounded-xl
                border
                border-amber-200
                bg-white
                px-3
                text-sm
                font-semibold
                text-amber-600
                transition
                hover:bg-amber-50
                dark:border-amber-500/20
                dark:bg-slate-900
              "
            >
              <UserX
                size={16}
              />

              Deactivate
            </button>

            <button
              type="button"
              onClick={
                requestBulkDelete
              }
              className="
                inline-flex
                h-10
                items-center
                gap-2
                rounded-xl
                border
                border-red-200
                bg-white
                px-3
                text-sm
                font-semibold
                text-red-600
                transition
                hover:bg-red-50
                dark:border-red-500/20
                dark:bg-slate-900
              "
            >
              <Trash2
                size={16}
              />

              Delete
            </button>

            <button
              type="button"
              onClick={
                clearSelection
              }
              className="
                inline-flex
                h-10
                items-center
                gap-2
                rounded-xl
                border
                border-slate-200
                bg-white
                px-3
                text-sm
                font-semibold
                text-slate-600
                transition
                hover:bg-slate-50
                dark:border-slate-700
                dark:bg-slate-900
                dark:text-slate-300
              "
            >
              <X
                size={16}
              />

              Clear
            </button>
          </div>
        </div>
      )}

      {/* =================================================
          BATCH INFO
      ================================================= */}

      {activeTab ===
        "batches" && (
        <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
          Department selection is only used to filter
          Programs. The saved relationship is
          <strong>
            {" "}
            Batch → Program
          </strong>
          , while Department is derived from that Program.
          Deleting a shared Batch does not delete reusable
          Departments, Programs or Semesters.
        </div>
      )}

      {/* =================================================
          TABLE
      ================================================= */}

      <div className="animate-fade-in-up overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {loading ? (
          <TableSkeleton
            columns={
              renderHeader()
                .length + 1
            }
          />
        ) : rows.length ===
          0 ? (
          <EmptyState
            icon={Icon}
            title={`No ${currentTab.label.toLowerCase()} found`}
            description={
              search
                ? "Try a different search."
                : `Add your first ${currentTab.singular.toLowerCase()} to continue.`
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400 dark:border-slate-800">
                  {/* SELECT ALL */}

                  <th className="w-12 px-4 py-4 text-center">
                    <RowCheckbox
                      checked={
                        allVisibleSelected
                      }
                      onChange={
                        toggleAllVisible
                      }
                      label={`Select all visible ${currentTab.label}`}
                    />
                  </th>

                  {renderHeader().map(
                    (
                      label,
                      index
                    ) => (
                      <th
                        key={
                          label
                        }
                        className={`px-6 py-4 font-semibold ${
                          index ===
                          renderHeader()
                            .length -
                            1
                            ? "text-right"
                            : ""
                        }`}
                      >
                        {label}
                      </th>
                    )
                  )}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((row) =>
                  activeTab ===
                  "batches" ? (
                    <Fragment
                      key={
                        row.id
                      }
                    >
                      <tr className="transition hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        {/* CHECKBOX */}

                        <td className="px-4 py-4 text-center">
                          <RowCheckbox
                            checked={
                              selectedIds.some(
                                (id) =>
                                  sameId(
                                    id,
                                    row.id
                                  )
                              )
                            }
                            onChange={() =>
                              toggleRow(
                                row.id
                              )
                            }
                            label={`Select Batch ${row.start_year}-${row.end_year}`}
                          />
                        </td>

                        {/* BATCH */}

                        <td className="px-6 py-4">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedBatch(
                                expandedBatch ===
                                  row.id
                                  ? null
                                  : row.id
                              )
                            }
                            className="flex items-center gap-3 text-left"
                          >
                            {expandedBatch ===
                            row.id ? (
                              <ChevronDown
                                size={17}
                                className="text-blue-500"
                              />
                            ) : (
                              <ChevronRight
                                size={17}
                                className="text-slate-400"
                              />
                            )}

                            <span>
                              <span className="block font-semibold text-slate-800 dark:text-slate-200">
                                {
                                  row.start_year
                                }
                                –
                                {
                                  row.end_year
                                }
                              </span>

                              <span className="text-xs text-slate-500">
                                View Program setup
                              </span>
                            </span>
                          </button>
                        </td>

                        {/* DEPARTMENTS */}

                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                          {row.department_count ??
                            0}
                        </td>

                        {/* PROGRAMS */}

                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                          {row.program_count ??
                            0}
                        </td>

                        {/* CONFIG */}

                        <td className="px-6 py-4">
                          <ConfigurationBadge
                            ready={
                              row.configuration_complete
                            }
                          />
                        </td>

                        {/* STATUS */}

                        <td className="px-6 py-4">
                          <StatusBadge
                            value={
                              row.status
                            }
                          />
                        </td>

                        {/* ACTIONS */}

                        <td className="px-6 py-4 text-right">
                          <Actions
                            type="batch"
                            row={
                              row
                            }
                          />
                        </td>
                      </tr>

                      {/* EXPANDED BATCH */}

                      {expandedBatch ===
                        row.id && (
                        <tr>
                          <td
                            colSpan="7"
                            className="bg-slate-50 px-6 py-5 dark:bg-slate-950/40"
                          >
                            {(
                              row.program_mappings ||
                              []
                            ).filter(
                              (mapping) =>
                                mapping.status ===
                                "active"
                            ).length >
                            0 ? (
                              <div className="grid gap-3 lg:grid-cols-2">
                                {(
                                  row.program_mappings ||
                                  []
                                )
                                  .filter(
                                    (mapping) =>
                                      mapping.status ===
                                      "active"
                                  )
                                  .map(
                                    (
                                      mapping
                                    ) => (
                                      <div
                                        key={
                                          mapping.id
                                        }
                                        className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
                                      >
                                        <div className="flex items-start justify-between gap-3">
                                          <div>
                                            <p className="font-semibold text-slate-800 dark:text-slate-200">
                                              {mapping
                                                .program
                                                ?.name ||
                                                "Unknown Program"}
                                            </p>

                                            <p className="text-xs text-slate-500">
                                              {mapping
                                                .department
                                                ?.name ||
                                                "Department"}{" "}
                                              ·{" "}
                                              {mapping
                                                .program
                                                ?.code ||
                                                "No code"}
                                            </p>
                                          </div>

                                          <ConfigurationBadge
                                            ready={
                                              mapping.configuration_complete
                                            }
                                          />
                                        </div>

                                        <div className="mt-3 grid gap-3 text-xs sm:grid-cols-3">
                                          <div>
                                            <p className="text-slate-400">
                                              Admission
                                            </p>

                                            <p className="mt-1 font-semibold capitalize text-slate-700 dark:text-slate-300">
                                              {mapping.admission_type ||
                                                "regular"}
                                            </p>
                                          </div>

                                          <div>
                                            <p className="text-slate-400">
                                              Entry
                                            </p>

                                            <p className="mt-1 font-semibold text-slate-700 dark:text-slate-300">
                                              {mapping
                                                .entry_semester
                                                ?.name ||
                                                "Not set"}
                                            </p>
                                          </div>

                                          <div>
                                            <p className="text-slate-400">
                                              Current
                                            </p>

                                            <p className="mt-1 font-semibold text-slate-700 dark:text-slate-300">
                                              {mapping
                                                .current_semester
                                                ?.name ||
                                                "Not set"}
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                    )
                                  )}
                              </div>
                            ) : (
                              <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">
                                No active Program configuration found for this Batch.
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ) : (
                    <tr
                      key={
                        row.id
                      }
                      className="transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      {/* CHECKBOX */}

                      <td className="px-4 py-4 text-center">
                        <RowCheckbox
                          checked={
                            selectedIds.some(
                              (id) =>
                                sameId(
                                  id,
                                  row.id
                                )
                            )
                          }
                          onChange={() =>
                            toggleRow(
                              row.id
                            )
                          }
                          label={`Select ${row.name || currentTab.singular}`}
                        />
                      </td>

                      {renderMasterRow(
                        row
                      )}
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* =================================================
          BATCH MODAL
      ================================================= */}

      {modal?.type ===
        "batch" && (
        <BatchModal
          isOpen
          batch={
            modal.data
          }
          departments={
            departments
          }
          programs={
            programs
          }
          semesters={
            semesters
          }
          onClose={() =>
            setModal(null)
          }
          onSave={(data) =>
            save(
              "batch",
              data,
              modal.data?.id
            )
          }
        />
      )}

      {/* =================================================
          DEPARTMENT MODAL
      ================================================= */}

      {modal?.type ===
        "department" && (
        <DepartmentModal
          isOpen
          department={
            modal.data
          }
          onClose={() =>
            setModal(null)
          }
          onSave={(data) =>
            save(
              "department",
              data,
              modal.data?.id
            )
          }
        />
      )}

      {/* =================================================
          PROGRAM MODAL
      ================================================= */}

      {modal?.type ===
        "program" && (
        <ProgramModal
          isOpen
          program={
            modal.data
          }
          departments={
            departments
          }
          onClose={() =>
            setModal(null)
          }
          onSave={(data) =>
            save(
              "program",
              data,
              modal.data?.id
            )
          }
        />
      )}

      {/* =================================================
          SEMESTER MODAL

          IMPORTANT:
          Existing semesters MUST be passed here so the
          bulk generator can skip already-created numbers.
      ================================================= */}

      {modal?.type ===
        "semester" && (
        <SemesterModal
          isOpen
          semester={
            modal.data
          }
          programs={
            programs
          }
          semesters={
            semesters
          }
          onClose={() =>
            setModal(null)
          }
          onSave={(data) =>
            save(
              "semester",
              data,
              modal.data?.id
            )
          }
        />
      )}

      {/* =================================================
          CONFIRM
      ================================================= */}

      <ConfirmDialog
        open={
          Boolean(confirm)
        }
        onClose={() =>
          !confirming &&
          setConfirm(null)
        }
        onConfirm={
          runConfirmedAction
        }
        loading={
          confirming
        }
        title={
          confirmTitle()
        }
        message={
          confirmMessage()
        }
        confirmLabel={
          confirmLabel()
        }
        danger={
          confirm?.action ===
            "delete" ||
          confirm?.action ===
            "bulk-delete" ||
          (
            confirm?.action ===
              "status" &&
            confirm?.row?.status ===
              "active"
          ) ||
          (
            confirm?.action ===
              "bulk-status" &&
            confirm?.targetStatus ===
              "inactive"
          )
        }
      />
    </main>
  );
}

export default AcademicStructure;