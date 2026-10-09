import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Bell,
  Send,
  Users,
  GraduationCap,
  Megaphone,
  Loader2,
  RefreshCw,
  Paperclip,
  X,
  FileText,
} from "lucide-react";

import {
  PageHeader,
  EmptyState,
} from "../components/PageHeader";

import AcademicStructureService from "../services/AcademicStructureService";
import { getAllTeachers } from "../services/teacherService";

import {
  getAdminAnnouncements,
  sendAdminAnnouncement,
  uploadAnnouncementAttachment,
} from "../services/adminNotificationService";

// ======================================================
// HELPERS
// ======================================================

const unwrap = (response) => {
  const body = response?.data ?? response;

  return Array.isArray(body)
    ? body
    : Array.isArray(body?.data)
      ? body.data
      : [];
};

const sameId = (first, second) =>
  String(first || "") === String(second || "");

const activeOnly = (item) => item?.status !== "inactive";

const fieldClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-800 dark:bg-slate-950 dark:text-white";

const formatSize = (value) => {
  const bytes = Number(value || 0);

  if (!bytes) return "";

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(1)} MB`;
};

const batchLabel = (batch) => {
  if (batch?.start_year && batch?.end_year) {
    return `${batch.start_year}–${batch.end_year}`;
  }

  return batch?.name || "Batch";
};

// ======================================================
// PAGE
// ======================================================

function Notifications() {
  const [announcements, setAnnouncements] = useState([]);

  const [batches, setBatches] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [batchPrograms, setBatchPrograms] = useState([]);

  const [teachers, setTeachers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [attachmentFile, setAttachmentFile] = useState(null);

  const fileRef = useRef(null);

  const [form, setForm] = useState({
    title: "",
    body: "",
    audience: "students",

    batch_id: "",
    department_id: "",
    program_id: "",
    semester_id: "",

    teacher_department: "",
  });

  // ====================================================
  // LOAD DATA
  // ====================================================

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [
        announcementRes,
        batchRes,
        departmentRes,
        programRes,
        semesterRes,
        batchProgramRes,
        teacherRes,
      ] = await Promise.all([
        getAdminAnnouncements(),
        AcademicStructureService.getBatches(),
        AcademicStructureService.getDepartments(),
        AcademicStructureService.getPrograms(),
        AcademicStructureService.getSemesters(),
        AcademicStructureService.getBatchPrograms(null, "active"),
        getAllTeachers(),
      ]);

      setAnnouncements(unwrap(announcementRes));
      setBatches(unwrap(batchRes));
      setDepartments(unwrap(departmentRes));
      setPrograms(unwrap(programRes));
      setSemesters(unwrap(semesterRes));
      setBatchPrograms(unwrap(batchProgramRes));
      setTeachers(unwrap(teacherRes));
    } catch (err) {
      console.error("LOAD ANNOUNCEMENTS ERROR:", err);

      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load announcements."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ====================================================
  // TEACHER DEPARTMENTS
  // ====================================================

  const teacherDepartments = useMemo(
    () =>
      [
        ...new Set(
          teachers
            .map((teacher) => teacher.department)
            .filter(Boolean)
        ),
      ].sort(),
    [teachers]
  );

  // ====================================================
  // ACTIVE MASTER DATA
  // ====================================================

  const activeBatches = useMemo(
    () =>
      batches
        .filter(activeOnly)
        .slice()
        .sort((first, second) => {
          const firstStart = Number(first.start_year || 0);
          const secondStart = Number(second.start_year || 0);

          if (firstStart !== secondStart) {
            return secondStart - firstStart;
          }

          return Number(second.end_year || 0) - Number(first.end_year || 0);
        }),
    [batches]
  );

  // ====================================================
  // BATCH MAPPINGS
  // ====================================================

  const selectedBatchMappings = useMemo(() => {
    const activeMappings = batchPrograms.filter(activeOnly);

    if (!form.batch_id) {
      return activeMappings;
    }

    return activeMappings.filter((mapping) =>
      sameId(mapping.batch_id, form.batch_id)
    );
  }, [batchPrograms, form.batch_id]);

  // ====================================================
  // DEPARTMENT OPTIONS
  //
  // Filters are optional.
  // No Batch -> all active Departments.
  // Batch selected -> Departments represented by Programs
  // configured in academic_batch_programs.
  // ====================================================

  const departmentOptions = useMemo(() => {
    const activeDepartments = departments.filter(activeOnly);

    if (!form.batch_id) {
      return activeDepartments
        .slice()
        .sort((a, b) =>
          String(a.name || "").localeCompare(String(b.name || ""))
        );
    }

    const mappedProgramIds = new Set(
      selectedBatchMappings.map((mapping) => String(mapping.program_id))
    );

    const mappedDepartmentIds = new Set(
      programs
        .filter((program) => mappedProgramIds.has(String(program.id)))
        .map((program) => String(program.department_id))
    );

    return activeDepartments
      .filter((department) =>
        mappedDepartmentIds.has(String(department.id))
      )
      .slice()
      .sort((a, b) =>
        String(a.name || "").localeCompare(String(b.name || ""))
      );
  }, [
    departments,
    form.batch_id,
    programs,
    selectedBatchMappings,
  ]);

  // ====================================================
  // PROGRAM OPTIONS
  //
  // No filters -> all active Programs.
  // Department -> only that Department's Programs.
  // Batch -> only Programs configured in that Batch.
  // Both -> must satisfy both.
  // ====================================================

  const programOptions = useMemo(() => {
    let rows = programs.filter(activeOnly);

    if (form.department_id) {
      rows = rows.filter((program) =>
        sameId(program.department_id, form.department_id)
      );
    }

    if (form.batch_id) {
      const mappedProgramIds = new Set(
        selectedBatchMappings.map((mapping) => String(mapping.program_id))
      );

      rows = rows.filter((program) =>
        mappedProgramIds.has(String(program.id))
      );
    }

    return rows
      .slice()
      .sort((a, b) =>
        String(a.name || "").localeCompare(String(b.name || ""))
      );
  }, [
    form.batch_id,
    form.department_id,
    programs,
    selectedBatchMappings,
  ]);

  // ====================================================
  // SEMESTER OPTIONS
  //
  // Existing Semester behavior stays unchanged.
  // We only narrow available semester choices according
  // to currently selected academic filters.
  // ====================================================

  const semesterOptions = useMemo(() => {
    let rows = semesters.filter(activeOnly);

    let allowedProgramIds = null;

    if (form.program_id) {
      allowedProgramIds = new Set([String(form.program_id)]);
    } else if (form.department_id) {
      allowedProgramIds = new Set(
        programs
          .filter(
            (program) =>
              activeOnly(program) &&
              sameId(program.department_id, form.department_id)
          )
          .map((program) => String(program.id))
      );
    } else if (form.batch_id) {
      allowedProgramIds = new Set(
        selectedBatchMappings.map((mapping) => String(mapping.program_id))
      );
    }

    if (allowedProgramIds) {
      rows = rows.filter((semester) =>
        allowedProgramIds.has(String(semester.program_id))
      );
    }

    return rows
      .slice()
      .sort((first, second) => {
        const firstProgram = programs.find((program) =>
          sameId(program.id, first.program_id)
        );

        const secondProgram = programs.find((program) =>
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
    form.batch_id,
    form.department_id,
    form.program_id,
    programs,
    selectedBatchMappings,
    semesters,
  ]);

  // ====================================================
  // FORM HELPERS
  // ====================================================

  const setValue = (key, value) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const setAcademicValue = (key, value) => {
    setForm((current) => {
      if (key === "batch_id") {
        return {
          ...current,
          batch_id: value,
          department_id: "",
          program_id: "",
          semester_id: "",
        };
      }

      if (key === "department_id") {
        return {
          ...current,
          department_id: value,
          program_id: "",
          semester_id: "",
        };
      }

      if (key === "program_id") {
        return {
          ...current,
          program_id: value,
          semester_id: "",
        };
      }

      return {
        ...current,
        [key]: value,
      };
    });
  };

  // ====================================================
  // ATTACHMENT
  // ====================================================

  const chooseAttachment = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError(
        "Announcement attachment must be 10 MB or smaller."
      );

      event.target.value = "";

      return;
    }

    setError("");
    setAttachmentFile(file);
  };

  const clearAttachment = () => {
    setAttachmentFile(null);

    if (fileRef.current) {
      fileRef.current.value = "";
    }
  };

  // ====================================================
  // SUBMIT
  // ====================================================

  const handleSubmit = async (event) => {
    event.preventDefault();

    setSending(true);
    setError("");
    setSuccess("");

    try {
      const payload = Object.fromEntries(
        Object.entries(form).map(([key, value]) => [
          key,
          typeof value === "string" ? value.trim() : value,
        ])
      );

      if (attachmentFile) {
        const uploadResponse =
          await uploadAnnouncementAttachment(attachmentFile);

        const attachment = uploadResponse?.data || uploadResponse;

        payload.attachment_url =
          attachment?.attachment_url || null;

        payload.attachment_name =
          attachment?.attachment_name || attachmentFile.name;

        payload.attachment_type =
          attachment?.attachment_type || attachmentFile.type;

        payload.attachment_size_bytes =
          attachment?.attachment_size_bytes || attachmentFile.size;
      }

      const response = await sendAdminAnnouncement(payload);

      setSuccess(
        response?.message ||
          response?.data?.message ||
          "Announcement sent successfully."
      );

      // Keep audience + selected filters for convenience,
      // only clear message fields after successful send.
      setForm((current) => ({
        ...current,
        title: "",
        body: "",
      }));

      clearAttachment();

      await load();
    } catch (err) {
      console.error("SEND ANNOUNCEMENT ERROR:", err);

      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to send announcement."
      );
    } finally {
      setSending(false);
    }
  };

  // ====================================================
  // UI
  // ====================================================

  return (
    <main className="min-h-full bg-slate-50 p-4 text-slate-700 dark:bg-slate-950 dark:text-slate-200 md:p-8">
      <PageHeader
        title="Notifications & Announcements"
        description="Send in-app announcements to active students and teachers using optional academic filters."
      />

      {error && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
          {success}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        {/* =============================================
            SENT ANNOUNCEMENTS
        ============================================= */}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-white">
                Sent Announcements
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Only active users are targeted when an announcement is sent.
              </p>
            </div>

            <button
              type="button"
              onClick={load}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800"
              title="Refresh"
            >
              <RefreshCw
                size={17}
                className={loading ? "animate-spin" : ""}
              />
            </button>
          </div>

          {loading ? (
            <div className="space-y-3 p-5">
              {[1, 2, 3, 4].map((item) => (
                <div
                  key={item}
                  className="skeleton h-20 rounded-xl"
                />
              ))}
            </div>
          ) : announcements.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="No announcements sent"
              description="Create your first university announcement."
            />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {announcements.map((item) => (
                <article
                  key={`${item.id}-${item.created_at}`}
                  className="p-5 transition hover:bg-slate-50 dark:hover:bg-slate-800/40"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                      <Megaphone size={18} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <h3 className="font-semibold text-slate-900 dark:text-white">
                          {item.title}
                        </h3>

                        <span className="text-xs text-slate-400">
                          {item.created_at
                            ? new Date(item.created_at).toLocaleString()
                            : ""}
                        </span>
                      </div>

                      <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                        {item.body}
                      </p>

                      {item.attachment_url && (
                        <a
                          href={item.attachment_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-flex max-w-full items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:border-slate-700 dark:hover:bg-blue-500/10"
                        >
                          <FileText size={14} />

                          <span className="truncate">
                            {item.attachment_name || "Open attachment"}
                          </span>

                          {item.attachment_size_bytes ? (
                            <span className="text-slate-400">
                              {formatSize(item.attachment_size_bytes)}
                            </span>
                          ) : null}
                        </a>
                      )}

                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {item.recipients || 0} recipients
                        </span>

                        {item.students > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                            <GraduationCap size={12} />
                            {item.students} students
                          </span>
                        )}

                        {item.teachers > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                            <Users size={12} />
                            {item.teachers} teachers
                          </span>
                        )}

                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {item.read || 0} read
                        </span>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* =============================================
            CREATE ANNOUNCEMENT
        ============================================= */}

        <form
          onSubmit={handleSubmit}
          className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 xl:sticky xl:top-24"
        >
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
              <Send size={18} />
            </div>

            <div>
              <h2 className="font-semibold text-slate-900 dark:text-white">
                Create Announcement
              </h2>

              <p className="text-xs text-slate-500">
                Send a message and an optional file to the selected active audience.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold">
                Title
              </span>

              <input
                className={fieldClass}
                value={form.title}
                onChange={(event) =>
                  setValue("title", event.target.value)
                }
                maxLength={160}
                required
                placeholder="Announcement title"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold">
                Message
              </span>

              <textarea
                className="min-h-32 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                value={form.body}
                onChange={(event) =>
                  setValue("body", event.target.value)
                }
                maxLength={2000}
                required
                placeholder="Write announcement message..."
              />
            </label>

            {/* ATTACHMENT */}
            <div>
              <span className="mb-1.5 block text-xs font-semibold">
                Attachment{" "}
                <span className="font-normal text-slate-400">
                  (optional)
                </span>
              </span>

              <input
                ref={fileRef}
                type="file"
                onChange={chooseAttachment}
                className="hidden"
              />

              {attachmentFile ? (
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                  <Paperclip
                    size={17}
                    className="text-blue-500"
                  />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {attachmentFile.name}
                    </p>

                    <p className="text-xs text-slate-400">
                      {formatSize(attachmentFile.size)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={clearAttachment}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-500 dark:hover:bg-slate-800"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 text-sm font-semibold text-slate-500 hover:border-blue-400 hover:text-blue-600 dark:border-slate-700"
                >
                  <Paperclip size={16} />
                  Attach file (max 10 MB)
                </button>
              )}
            </div>

            {/* AUDIENCE */}
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold">
                Audience
              </span>

              <select
                className={fieldClass}
                value={form.audience}
                onChange={(event) =>
                  setValue("audience", event.target.value)
                }
              >
                <option value="students">Students</option>
                <option value="teachers">Teachers</option>
                <option value="both">Students & Teachers</option>
              </select>
            </label>

            {/* ===========================================
                STUDENT ACADEMIC FILTERS

                All optional.

                Batch selected
                -> Department / Program / Semester narrow.

                Department selected without Batch
                -> Program / Semester narrow.

                Program selected
                -> Semester narrows.
            =========================================== */}

            {(form.audience === "students" ||
              form.audience === "both") && (
              <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                <p className="mb-3 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Student filters{" "}
                  <span className="font-normal text-slate-400">
                    (all optional)
                  </span>
                </p>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  {/* BATCH */}
                  <select
                    className={fieldClass}
                    value={form.batch_id}
                    onChange={(event) =>
                      setAcademicValue("batch_id", event.target.value)
                    }
                  >
                    <option value="">All batches</option>

                    {activeBatches.map((item) => (
                      <option
                        key={item.id}
                        value={item.id}
                      >
                        {batchLabel(item)}
                      </option>
                    ))}
                  </select>

                  {/* DEPARTMENT */}
                  <select
                    className={fieldClass}
                    value={form.department_id}
                    onChange={(event) =>
                      setAcademicValue(
                        "department_id",
                        event.target.value
                      )
                    }
                  >
                    <option value="">All academic departments</option>

                    {departmentOptions.map((item) => (
                      <option
                        key={item.id}
                        value={item.id}
                      >
                        {item.name}
                        {item.code ? ` (${item.code})` : ""}
                      </option>
                    ))}
                  </select>

                  {/* PROGRAM */}
                  <select
                    className={fieldClass}
                    value={form.program_id}
                    onChange={(event) =>
                      setAcademicValue("program_id", event.target.value)
                    }
                  >
                    <option value="">All programs</option>

                    {programOptions.map((item) => (
                      <option
                        key={item.id}
                        value={item.id}
                      >
                        {item.name}
                        {item.code ? ` (${item.code})` : ""}
                      </option>
                    ))}
                  </select>

                  {/* SEMESTER */}
                  <select
                    className={fieldClass}
                    value={form.semester_id}
                    onChange={(event) =>
                      setAcademicValue("semester_id", event.target.value)
                    }
                  >
                    <option value="">All semesters</option>

                    {semesterOptions.map((item) => {
                      const program = programs.find((programItem) =>
                        sameId(programItem.id, item.program_id)
                      );

                      return (
                        <option
                          key={item.id}
                          value={item.id}
                        >
                          {program?.name
                            ? `${program.name} · `
                            : ""}
                          {item.name ||
                            `Semester ${item.semester_number}`}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <p className="mt-2 text-[11px] leading-5 text-slate-400">
                  Any single filter can be used by itself. Selecting a Batch,
                  Department or Program only narrows the options that follow it.
                  No academic filter means every active student.
                </p>
              </div>
            )}

            {/* TEACHER FILTER */}
            {(form.audience === "teachers" ||
              form.audience === "both") && (
              <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                <p className="mb-3 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Teacher department{" "}
                  <span className="font-normal text-slate-400">
                    (optional)
                  </span>
                </p>

                <select
                  className={fieldClass}
                  value={form.teacher_department}
                  onChange={(event) =>
                    setValue("teacher_department", event.target.value)
                  }
                >
                  <option value="">All active teachers</option>

                  {teacherDepartments.map((department) => (
                    <option
                      key={department}
                      value={department}
                    >
                      {department}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="submit"
              disabled={sending}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:opacity-60"
            >
              {sending ? (
                <Loader2
                  size={17}
                  className="animate-spin"
                />
              ) : (
                <Send size={17} />
              )}

              {sending ? "Sending..." : "Send Announcement"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

export default Notifications;
