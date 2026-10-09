import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckSquare,
  Download,
  Eye,
  FileSpreadsheet,
  History,
  IdCard,
  KeyRound,
  Mail,
  Pencil,
  Plus,
  Search,
  Square,
  Trash2,
  UploadCloud,
  UserRoundCheck,
  UserRoundX,
  GraduationCap,
} from "lucide-react";

import {
  getAllStudents,
  deleteStudent,
  updateStudentStatus,
} from "../services/studentService";

import { AddStudentModal } from "../components/DashboardModals";
import {
  EditStudentModal,
  ResetStudentPasswordModal,
  ViewStudentModal,
} from "../components/StudentModals";

import { EmptyState, TableSkeleton } from "../components/PageHeader";
import ConfirmDialog from "../components/ConfirmDialog";
import SelectionActionBar from "../components/SelectionActionBar";
import StudentImportModal from "../components/StudentImportModal";
import { exportRowsToCsv, exportRowsToExcel } from "../utils/exportData";

const PAGE_SIZE = 8;

const fieldClass =
  "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-800 dark:bg-slate-900 dark:text-white";

const sameId = (a, b) => String(a || "") === String(b || "");

const unwrapStudents = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.data)) return response.data.data;
  return [];
};

const departmentId = (student) =>
  student?.department_id || student?.linked_department?.id || "";

const programId = (student) =>
  student?.program_id || student?.linked_program?.id || "";

const batchId = (student) =>
  student?.batch_id || student?.linked_batch?.id || "";

const semesterId = (student) =>
  student?.semester_id || student?.linked_semester?.id || "";

const departmentName = (student) =>
  student?.linked_department?.name || student?.department || "—";

const programName = (student) => student?.linked_program?.name || "—";

const semesterName = (student) =>
  student?.linked_semester?.name || student?.semester || "—";

const semesterNumber = (student) =>
  Number(student?.linked_semester?.semester_number || 0);

const batchName = (student) => {
  const batch = student?.linked_batch;

  if (!batch) return "—";

  if (batch.start_year && batch.end_year) {
    return `${batch.start_year}–${batch.end_year}`;
  }

  return batch.name || batch.batch_year || "—";
};

const progressValue = (student) =>
  Math.max(
    0,
    Math.min(
      100,
      Number(student?.progress_percentage ?? student?.progress ?? 0)
    )
  );

const createUniqueOptions = (rows, idGetter, labelGetter, extraGetter = null) => {
  const map = new Map();

  for (const row of rows) {
    const id = idGetter(row);
    if (!id || map.has(String(id))) continue;

    map.set(String(id), {
      id,
      label: labelGetter(row),
      ...(extraGetter ? extraGetter(row) : {}),
    });
  }

  return [...map.values()];
};

export default function Students() {
  const navigate = useNavigate();

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [batchFilter, setBatchFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [programFilter, setProgramFilter] = useState("");
  const [semesterFilter, setSemesterFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [viewTarget, setViewTarget] = useState(null);
  const [passwordTarget, setPasswordTarget] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [bulkTarget, setBulkTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  // =====================================================
  // LOAD
  // =====================================================

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await getAllStudents();
      setStudents(unwrapStudents(response));
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.message || "Failed to load students."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // =====================================================
  // LATEST ACADEMIC STRUCTURE FILTER OPTIONS
  // Batch -> Department -> Program -> Semester
  // =====================================================

  const batchOptions = useMemo(() => {
    return createUniqueOptions(
      students,
      batchId,
      batchName,
      (student) => ({
        start_year: Number(student?.linked_batch?.start_year || 0),
        end_year: Number(student?.linked_batch?.end_year || 0),
      })
    ).sort(
      (a, b) =>
        b.start_year - a.start_year ||
        b.end_year - a.end_year ||
        String(a.label).localeCompare(String(b.label))
    );
  }, [students]);

  const studentsForDepartmentOptions = useMemo(
    () =>
      students.filter(
        (student) => !batchFilter || sameId(batchId(student), batchFilter)
      ),
    [students, batchFilter]
  );

  const departmentOptions = useMemo(() => {
    return createUniqueOptions(
      studentsForDepartmentOptions,
      departmentId,
      departmentName
    ).sort((a, b) => String(a.label).localeCompare(String(b.label)));
  }, [studentsForDepartmentOptions]);

  const studentsForProgramOptions = useMemo(
    () =>
      studentsForDepartmentOptions.filter(
        (student) =>
          !departmentFilter || sameId(departmentId(student), departmentFilter)
      ),
    [studentsForDepartmentOptions, departmentFilter]
  );

  const programOptions = useMemo(() => {
    return createUniqueOptions(
      studentsForProgramOptions,
      programId,
      programName,
      (student) => ({ code: student?.linked_program?.code || "" })
    ).sort((a, b) => String(a.label).localeCompare(String(b.label)));
  }, [studentsForProgramOptions]);

  const studentsForSemesterOptions = useMemo(
    () =>
      studentsForProgramOptions.filter(
        (student) => !programFilter || sameId(programId(student), programFilter)
      ),
    [studentsForProgramOptions, programFilter]
  );

  const semesterOptions = useMemo(() => {
    return createUniqueOptions(
      studentsForSemesterOptions,
      semesterId,
      semesterName,
      (student) => ({ number: semesterNumber(student) })
    ).sort(
      (a, b) =>
        a.number - b.number || String(a.label).localeCompare(String(b.label))
    );
  }, [studentsForSemesterOptions]);

  // =====================================================
  // FILTERED STUDENTS
  // =====================================================

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return students.filter((student) => {
      const searchable = [
        student.full_name,
        student.father_name,
        student.email,
        student.student_id,
        student.cnic,
        student.phone,
        batchName(student),
        departmentName(student),
        programName(student),
        semesterName(student),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (query && !searchable.includes(query)) return false;

      if (batchFilter && !sameId(batchId(student), batchFilter)) return false;

      if (
        departmentFilter &&
        !sameId(departmentId(student), departmentFilter)
      ) {
        return false;
      }

      if (programFilter && !sameId(programId(student), programFilter)) {
        return false;
      }

      if (semesterFilter && !sameId(semesterId(student), semesterFilter)) {
        return false;
      }

      if (statusFilter === "active" && student.is_active === false) return false;
      if (statusFilter === "inactive" && student.is_active !== false) return false;

      return true;
    });
  }, [
    students,
    search,
    batchFilter,
    departmentFilter,
    programFilter,
    semesterFilter,
    statusFilter,
  ]);

  useEffect(() => {
    setPage(1);
  }, [
    search,
    batchFilter,
    departmentFilter,
    programFilter,
    semesterFilter,
    statusFilter,
  ]);

  // =====================================================
  // PAGINATION
  // =====================================================

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paginated = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  );

  // =====================================================
  // SELECTION
  // =====================================================

  const visibleIds = paginated.map((student) => student.id);
  const selected = students.filter((student) => selectedIds.includes(student.id));
  const single = selected.length === 1 ? selected[0] : null;
  const allSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  const toggle = (id) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id]
    );
  };

  const toggleAll = () => {
    setSelectedIds((current) =>
      allSelected
        ? current.filter((id) => !visibleIds.includes(id))
        : [...new Set([...current, ...visibleIds])]
    );
  };

  // =====================================================
  // EXPORT
  // =====================================================

  const rowsForExport = (rows) =>
    rows.map((student) => ({
      Full_Name: student.full_name || "",
      Father_Name: student.father_name || "",
      Student_ID: student.student_id || "",
      Username_CNIC: student.cnic || "",
      Email: student.email || "",
      Phone: student.phone || "",
      Batch: batchName(student),
      Department: departmentName(student),
      Program: programName(student),
      Semester: semesterName(student),
      Status: student.is_active === false ? "Inactive" : "Active",
      Progress_Percentage: progressValue(student),
      Last_Login: student.last_login_at || "",
    }));

  const doExport = (type, rows = filtered) => {
    const data = rowsForExport(rows);
    const filename = `students-${new Date().toISOString().slice(0, 10)}`;

    if (type === "csv") {
      exportRowsToCsv(data, undefined, filename);
    } else {
      exportRowsToExcel(data, undefined, filename);
    }
  };

  // =====================================================
  // STATUS / DELETE / BULK
  // =====================================================

  const confirmStatus = async () => {
    if (!statusTarget) return;

    setBusy(true);

    try {
      const nextStatus = statusTarget.is_active === false;
      await updateStudentStatus(statusTarget.id, nextStatus);
      setStatusTarget(null);
      setSelectedIds([]);
      await load();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to update student status."
      );
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    setBusy(true);

    try {
      await deleteStudent(deleteTarget.id);
      setDeleteTarget(null);
      setSelectedIds([]);
      await load();
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.message || "Failed to delete student."
      );
    } finally {
      setBusy(false);
    }
  };

  const confirmBulk = async () => {
    if (!bulkTarget || !selectedIds.length) return;

    setBusy(true);

    try {
      const results = await Promise.allSettled(
        selectedIds.map((id) => {
          if (bulkTarget === "delete") return deleteStudent(id);
          return updateStudentStatus(id, bulkTarget === "activate");
        })
      );

      const failures = results.filter((result) => result.status === "rejected").length;

      if (failures) {
        setError(
          `${failures} selected student action${failures === 1 ? "" : "s"} could not be completed.`
        );
      }

      setBulkTarget(null);
      setSelectedIds([]);
      await load();
    } finally {
      setBusy(false);
    }
  };

  // =====================================================
  // SELECTION ACTION BAR
  // =====================================================

  const selectionActions = [
    {
      key: "edit",
      label: "Edit",
      icon: Pencil,
      singleOnly: true,
      onClick: () => setEditTarget(single),
    },
    {
      key: "password",
      label: "Reset Password",
      icon: KeyRound,
      singleOnly: true,
      tone: "warning",
      onClick: () => setPasswordTarget(single),
    },
    {
      key: "activate",
      label: "Activate",
      icon: UserRoundCheck,
      tone: "success",
      disabled:
        selected.length > 0 &&
        selected.every((student) => student.is_active !== false),
      onClick: () =>
        selected.length === 1
          ? setStatusTarget({ ...single, is_active: false })
          : setBulkTarget("activate"),
    },
    {
      key: "deactivate",
      label: "Deactivate",
      icon: UserRoundX,
      tone: "warning",
      disabled:
        selected.length > 0 &&
        selected.every((student) => student.is_active === false),
      onClick: () =>
        selected.length === 1
          ? setStatusTarget({ ...single, is_active: true })
          : setBulkTarget("deactivate"),
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

  return (
    <main className="min-h-full bg-slate-50 p-4 text-slate-700 dark:bg-slate-950 dark:text-slate-200 md:p-8">
      {/* HEADER */}
      <div className="mb-6 flex flex-col gap-4 2xl:flex-row 2xl:items-center 2xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Students
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage student accounts, academic placement and login access.
          </p>
        </div>

        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-nowrap 2xl:justify-end">
          <button
            type="button"
            onClick={() => doExport("csv")}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:border-blue-300 hover:text-blue-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 sm:w-auto"
          >
            <Download size={15} />
            Export CSV
          </button>

          <button
            type="button"
            onClick={() => doExport("excel")}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:border-blue-300 hover:text-blue-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 sm:w-auto"
          >
            <FileSpreadsheet size={15} />
            Export Excel
          </button>

          <button
            type="button"
            onClick={() => setShowImport(true)}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/20 sm:w-auto"
          >
            <UploadCloud size={16} />
            Bulk Import
          </button>

          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 sm:w-auto"
          >
            <Plus size={17} />
            Add Student
          </button>
        </div>
      </div>

      {/* FILTERS */}
      <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <label className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className={`${fieldClass} pl-9`}
              placeholder="Search student..."
            />
          </label>

          <select
            className={fieldClass}
            value={batchFilter}
            onChange={(event) => {
              setBatchFilter(event.target.value);
              setDepartmentFilter("");
              setProgramFilter("");
              setSemesterFilter("");
            }}
          >
            <option value="">All Batches</option>
            {batchOptions.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.label}
              </option>
            ))}
          </select>

          <select
            className={fieldClass}
            value={departmentFilter}
            onChange={(event) => {
              setDepartmentFilter(event.target.value);
              setProgramFilter("");
              setSemesterFilter("");
            }}
          >
            <option value="">All Departments</option>
            {departmentOptions.map((department) => (
              <option key={department.id} value={department.id}>
                {department.label}
              </option>
            ))}
          </select>

          <select
            className={fieldClass}
            value={programFilter}
            onChange={(event) => {
              setProgramFilter(event.target.value);
              setSemesterFilter("");
            }}
          >
            <option value="">All Programs</option>
            {programOptions.map((program) => (
              <option key={program.id} value={program.id}>
                {program.label}
                {program.code ? ` (${program.code})` : ""}
              </option>
            ))}
          </select>

          <select
            className={fieldClass}
            value={semesterFilter}
            onChange={(event) => setSemesterFilter(event.target.value)}
          >
            <option value="">All Semesters</option>
            {semesterOptions.map((semester) => (
              <option key={semester.id} value={semester.id}>
                {semester.label}
              </option>
            ))}
          </select>

          <select
            className={fieldClass}
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </section>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      ) : null}

      <SelectionActionBar
        count={selected.length}
        label="students selected"
        actions={selectionActions}
        onClear={() => setSelectedIds([])}
      />

      {/* TABLE */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {loading ? (
          <TableSkeleton columns={8} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="No students found"
            description="Try changing filters or add a student."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] table-fixed text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400 dark:border-slate-800">
                    <th className="w-11 px-3 py-4">
                      <button type="button" onClick={toggleAll}>
                        {allSelected ? (
                          <CheckSquare size={16} />
                        ) : (
                          <Square size={16} />
                        )}
                      </button>
                    </th>
                    <th className="w-[25%] px-3 py-4">Student</th>
                    <th className="w-[18%] px-3 py-4">ID / Username</th>
                    <th className="w-[18%] px-3 py-4">Academic</th>
                    <th className="hidden w-[13%] px-3 py-4 md:table-cell">
                      Progress
                    </th>
                    <th className="hidden w-[13%] px-3 py-4 lg:table-cell">
                      Contact
                    </th>
                    <th className="w-[10%] px-3 py-4">Status</th>
                    <th className="w-[85px] px-2 py-4 text-right">View</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paginated.map((student) => {
                    const progress = progressValue(student);

                    return (
                      <tr
                        key={student.id}
                        className={`${
                          student.is_active === false ? "opacity-60" : ""
                        } hover:bg-slate-50 dark:hover:bg-slate-800/40`}
                      >
                        <td className="px-3 py-4">
                          <button type="button" onClick={() => toggle(student.id)}>
                            {selectedIds.includes(student.id) ? (
                              <CheckSquare size={16} />
                            ) : (
                              <Square size={16} />
                            )}
                          </button>
                        </td>

                        <td className="px-3 py-4">
                          <div className="flex min-w-0 items-center gap-2.5">
                            {student.avatar_url ? (
                              <img
                                src={student.avatar_url}
                                alt=""
                                className="h-9 w-9 shrink-0 rounded-full object-cover"
                              />
                            ) : (
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                                {student.full_name?.[0]?.toUpperCase() || "S"}
                              </span>
                            )}

                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-900 dark:text-white">
                                {student.full_name}
                              </p>
                              <p className="truncate text-[11px] text-slate-400">
                                Father: {student.father_name || "—"}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-3 py-4">
                          <div className="space-y-1">
                            <p className="flex items-center gap-1.5 truncate font-semibold text-slate-800 dark:text-slate-200">
                              <IdCard size={13} className="shrink-0 text-slate-400" />
                              {student.student_id || "—"}
                            </p>
                            <p className="truncate text-[11px] text-slate-400">
                              CNIC: {student.cnic || "—"}
                            </p>
                          </div>
                        </td>

                        <td className="px-3 py-4">
                          <p className="truncate font-medium">
                            {programName(student)}
                          </p>
                          <p className="truncate text-[11px] text-slate-400">
                            {semesterName(student)} · {batchName(student)}
                          </p>
                          <p className="truncate text-[11px] text-slate-400">
                            {departmentName(student)}
                          </p>
                        </td>

                        <td className="hidden px-3 py-4 md:table-cell">
                          <div className="flex items-center gap-2">
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                              <div
                                className="h-full rounded-full bg-blue-500"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="w-10 text-right text-xs font-semibold">
                              {Math.round(progress)}%
                            </span>
                          </div>
                        </td>

                        <td className="hidden px-3 py-4 lg:table-cell">
                          <div className="space-y-1 text-xs text-slate-500">
                            <p className="flex items-center gap-1 truncate">
                              <Mail size={11} className="shrink-0" />
                              {student.email || "No email"}
                            </p>
                            <p className="truncate">{student.phone || "No phone"}</p>
                          </div>
                        </td>

                        <td className="px-3 py-4">
                          <span
                            className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                              student.is_active === false
                                ? "bg-slate-100 text-slate-500 dark:bg-slate-800"
                                : "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                            }`}
                          >
                            {student.is_active === false ? "Inactive" : "Active"}
                          </span>
                        </td>

                        <td className="px-2 py-4">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setViewTarget(student)}
                              title="View student"
                              className="rounded-lg p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10"
                            >
                              <Eye size={16} />
                            </button>

                            <button
                              type="button"
                              onClick={() => navigate(`/students/${student.id}/history`)}
                              title="Student history"
                              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800"
                            >
                              <History size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-slate-500">
                Showing {filtered.length ? (page - 1) * PAGE_SIZE + 1 : 0}–
                {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold disabled:opacity-40 dark:border-slate-700"
                >
                  Previous
                </button>

                <span className="text-xs text-slate-500">
                  Page {page} of {totalPages}
                </span>

                <button
                  type="button"
                  disabled={page === totalPages}
                  onClick={() =>
                    setPage((current) => Math.min(totalPages, current + 1))
                  }
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold disabled:opacity-40 dark:border-slate-700"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* MODALS */}
      <AddStudentModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onCreated={() => {
          setSelectedIds([]);
          load();
        }}
      />

      <StudentImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onImported={() => {
          setSelectedIds([]);
          load();
        }}
      />

      <ViewStudentModal
        open={Boolean(viewTarget)}
        student={viewTarget}
        onClose={() => setViewTarget(null)}
      />

      <EditStudentModal
        open={Boolean(editTarget)}
        student={editTarget}
        onClose={() => setEditTarget(null)}
        onUpdated={() => {
          setSelectedIds([]);
          load();
        }}
      />

      <ResetStudentPasswordModal
        open={Boolean(passwordTarget)}
        student={passwordTarget}
        onClose={() => setPasswordTarget(null)}
        onDone={load}
      />

      <ConfirmDialog
        open={Boolean(statusTarget)}
        onClose={() => setStatusTarget(null)}
        onConfirm={confirmStatus}
        loading={busy}
        title={
          statusTarget?.is_active === false
            ? "Activate Student"
            : "Deactivate Student"
        }
        message={`Are you sure you want to ${
          statusTarget?.is_active === false ? "activate" : "deactivate"
        } ${statusTarget?.full_name || "this student"}?`}
        confirmLabel="Continue"
        danger={statusTarget?.is_active !== false}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={busy}
        title="Delete Student"
        message={`Delete ${
          deleteTarget?.full_name || "this student"
        } permanently? Academic history and linked data may also be removed according to the database delete policy.`}
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
            : bulkTarget === "activate"
              ? "Activate"
              : "Deactivate"
        } Students`}
        message={`Apply this action to ${selectedIds.length} selected students?`}
        confirmLabel="Continue"
        danger={bulkTarget !== "activate"}
      />
    </main>
  );
}
