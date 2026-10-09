import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  Users,
  FileText,
  ClipboardList,
  HelpCircle,
  CalendarCheck,
  BarChart3,
  History,
  ExternalLink,
} from "lucide-react";
import { getCourseHistory, getCourseAssignmentHistory } from "../services/historyService";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar } from "recharts";
import { EmptyState } from "../components/PageHeader";

const unwrap = (response) => response?.data?.data ?? response?.data ?? response;
const fmt = (value) => (value ? new Date(value).toLocaleString() : "—");
const batchLabel = (batch) => (batch ? `${batch.start_year}–${batch.end_year}` : "Batch");

const tabs = [
  ["overview", "Overview", BookOpen],
  ["content", "Materials", FileText],
  ["assignments", "Assignments", ClipboardList],
  ["quizzes", "Quizzes", HelpCircle],
  ["attendance", "Attendance", CalendarCheck],
  ["results", "Results", BarChart3],
  ["analytics", "Analytics", BarChart3],
];

const card = "rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";

function Metric({ label, value, note }) {
  return (
    <div className={`${card} p-4`}>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{value ?? 0}</p>
      {note && <p className="mt-1 text-xs text-slate-400">{note}</p>}
    </div>
  );
}

function SimpleTable({ headings, rows, empty = "No data found." }) {
  if (!rows?.length) return <div className="py-10 text-center text-sm text-slate-400">{empty}</div>;
  return (
    <>
      <div className="grid gap-3 p-3 md:hidden">
        {rows.map((row, rowIndex) => (
          <article key={row.id || rowIndex} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <dl className="space-y-3">
              {headings.filter((h) => !String(h.className || "").includes("mobile-hidden")).map((h) => (
                <div key={h.label} className="grid grid-cols-[96px_minmax(0,1fr)] gap-3 text-sm">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{h.label}</dt>
                  <dd className="min-w-0 break-words text-slate-700 dark:text-slate-200">{h.render(row)}</dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>
      <div className="hidden md:block">
        <table className="w-full table-fixed text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400 dark:bg-slate-950/40">
            <tr>{headings.map((h) => <th key={h.label} className={`${h.className || ""} px-4 py-3 font-semibold`}>{h.label}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((row, rowIndex) => (
              <tr key={row.id || rowIndex} className="align-top hover:bg-slate-50 dark:hover:bg-slate-800/40">
                {headings.map((h) => <td key={h.label} className={`${h.className || ""} break-words px-4 py-3 text-slate-600 dark:text-slate-300`}>{h.render(row)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function CourseDetail() {
  const { id, section = "overview" } = useParams();
  const navigate = useNavigate();
  const [courseHistory, setCourseHistory] = useState(null);
  const [assignmentData, setAssignmentData] = useState(null);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    getCourseHistory(id)
      .then((response) => {
        if (!active) return;
        const data = unwrap(response);
        setCourseHistory(data);
        const preferred = data?.course_assignments?.find((item) => item.status === "active") || data?.course_assignments?.[0];
        setSelectedAssignmentId(preferred?.id || "");
      })
      .catch((err) => active && setError(err?.response?.data?.message || err?.message || "Failed to load course."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    if (!selectedAssignmentId) {
      setAssignmentData(null);
      return undefined;
    }

    let active = true;
    let firstLoad = true;

    const loadAssignment = async () => {
      if (firstLoad) setDetailLoading(true);
      try {
        const response = await getCourseAssignmentHistory(selectedAssignmentId);
        if (active) {
          setAssignmentData(unwrap(response));
          setError("");
        }
      } catch (err) {
        if (active) setError(err?.response?.data?.message || err?.message || "Failed to load teaching context.");
      } finally {
        if (active && firstLoad) setDetailLoading(false);
        firstLoad = false;
      }
    };

    loadAssignment();
    const timer = window.setInterval(loadAssignment, 15000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [selectedAssignmentId]);

  const course = courseHistory?.course;
  const assignment = assignmentData?.course_assignment;
  const currentTeacher = assignment?.teacher;
  const counts = assignmentData?.counts || {};
  const analytics = assignmentData?.analytics || {};

  const attendanceSummary = useMemo(() => {
    const records = assignmentData?.attendance_records || [];
    const present = records.filter((row) => String(row.status).toLowerCase() === "present").length;
    const absent = records.filter((row) => String(row.status).toLowerCase() === "absent").length;
    const late = records.filter((row) => String(row.status).toLowerCase() === "late").length;
    return { present, absent, late, total: records.length };
  }, [assignmentData]);

  if (loading) return <main className="min-h-full bg-slate-50 p-8 dark:bg-slate-950"><div className="skeleton h-72 rounded-2xl" /></main>;

  return (
    <main className="min-h-full bg-slate-50 p-4 text-slate-700 dark:bg-slate-950 dark:text-slate-200 md:p-8">
      <button onClick={() => navigate("/courses")} className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-blue-600"><ArrowLeft size={16} /> Back to Courses</button>

      {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">{error}</div>}

      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{course?.name || "Course Details"}</h1>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${course?.status === "published" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-slate-100 text-slate-500 dark:bg-slate-800"}`}>{course?.status || "—"}</span>
          </div>
          <p className="mt-1 text-sm text-slate-500">{course?.course_code || "No course code"} · {course?.linked_department?.name || course?.department || "Department"} · {course?.linked_program?.name || course?.program || "Program"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={selectedAssignmentId} onChange={(e) => setSelectedAssignmentId(e.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white">
            <option value="">No Course Assignment</option>
            {(courseHistory?.course_assignments || []).map((item) => <option key={item.id} value={item.id}>{batchLabel(item.batch)} · {item.semester?.name || "Semester"} · {item.teacher?.full_name || "Unassigned"} · {item.status}</option>)}
          </select>
          <Link to={`/courses/${id}/history`} className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 hover:border-blue-300 hover:text-blue-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"><History size={16} /> Full History</Link>
        </div>
      </div>

      <nav className="mb-6 grid grid-cols-2 gap-1 rounded-xl sm:flex sm:flex-wrap border border-slate-200 bg-white p-1.5 dark:border-slate-800 dark:bg-slate-900">
        {tabs.map(([key, label, Icon]) => (
          <Link key={key} to={key === "overview" ? `/courses/${id}` : `/courses/${id}/${key}`} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${section === key ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"}`}><Icon size={15} /> {label}</Link>
        ))}
      </nav>

      {detailLoading && <div className="mb-5 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"><div className="h-full w-1/2 animate-pulse bg-blue-500" /></div>}

      {section === "overview" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Active Students" value={counts.active_students || 0} />
            <Metric label="Live Course Progress" value={`${analytics.average_live_progress || 0}%`} />
            <Metric label="Assignments" value={counts.assignments || 0} />
            <Metric label="Quizzes" value={counts.quizzes || 0} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <section className={`${card} p-5`}>
              <h2 className="font-semibold text-slate-900 dark:text-white">Course Information</h2>
              <dl className="mt-4 grid grid-cols-[130px_minmax(0,1fr)] gap-x-4 gap-y-3 text-sm">
                {[['Course Code', course?.course_code], ['Department', course?.linked_department?.name || course?.department], ['Program', course?.linked_program?.name || course?.program], ['Credits', course?.credits], ['Level', course?.level], ['Duration', course?.duration_weeks ? `${course.duration_weeks} weeks` : null]].map(([label,value]) => <div key={label} className="contents"><dt className="text-slate-400">{label}</dt><dd className="font-medium text-slate-700 dark:text-slate-200">{value ?? "—"}</dd></div>)}
              </dl>
              {course?.description && <p className="mt-5 border-t border-slate-100 pt-4 text-sm leading-6 text-slate-500 dark:border-slate-800 dark:text-slate-400">{course.description}</p>}
            </section>
            <section className={`${card} p-5`}>
              <h2 className="font-semibold text-slate-900 dark:text-white">Selected Teaching Context</h2>
              {!assignment ? <p className="mt-4 text-sm text-slate-400">No Course Assignment exists for this course yet.</p> : <div className="mt-4 space-y-3 text-sm">
                <p><span className="text-slate-400">Batch:</span> <strong>{batchLabel(assignment.batch)}</strong></p>
                <p><span className="text-slate-400">Semester:</span> <strong>{assignment.semester?.name || "—"}</strong></p>
                <p><span className="text-slate-400">Current Teacher:</span> <strong>{currentTeacher?.full_name || "—"}</strong></p>
                <p><span className="text-slate-400">Status:</span> <strong className="capitalize">{assignment.status || "—"}</strong></p>
                <Link to={`/course-assignments/${assignment.id}/history`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600"><ExternalLink size={13} /> Open Course Assignment History</Link>
              </div>}
            </section>
          </div>
        </div>
      )}

      {section === "content" && <section className={card}><SimpleTable empty="No materials uploaded for this Course Assignment." headings={[
        { label: "Material", render: (r) => <div><p className="font-semibold text-slate-800 dark:text-white">{r.title}</p><p className="text-xs text-slate-400">{r.file_name || r.file_type || "Material"}</p></div> },
        { label: "Uploaded By", className: "hidden md:table-cell", render: (r) => r.teacher?.full_name || "—" },
        { label: "Uploaded", className: "hidden lg:table-cell", render: (r) => fmt(r.uploaded_at) },
        { label: "Status", render: (r) => <span className="capitalize">{r.status || "—"}</span> },
        { label: "Open", render: (r) => r.file_url ? <a className="font-semibold text-blue-600" href={r.file_url} target="_blank" rel="noreferrer">View</a> : "—" },
      ]} rows={assignmentData?.materials || []} /></section>}

      {section === "assignments" && <section className={card}><SimpleTable empty="No assignments created for this Course Assignment." headings={[
        { label: "Assignment", render: (r) => <div><p className="font-semibold text-slate-800 dark:text-white">{r.title}</p><p className="text-xs text-slate-400">{r.teacher?.full_name || "Teacher"}</p></div> },
        { label: "Due", className: "hidden md:table-cell", render: (r) => fmt(r.due_date) },
        { label: "Marks", render: (r) => r.total_marks ?? 0 },
        { label: "Submissions", render: (r) => r.submission_count ?? 0 },
        { label: "Status", render: (r) => <span className="capitalize">{r.status || "—"}</span> },
      ]} rows={assignmentData?.assignments || []} /></section>}

      {section === "quizzes" && <section className={card}><SimpleTable empty="No quizzes created for this Course Assignment." headings={[
        { label: "Quiz", render: (r) => <div><p className="font-semibold text-slate-800 dark:text-white">{r.title}</p><p className="text-xs text-slate-400">{r.teacher?.full_name || "Teacher"}</p></div> },
        { label: "Date", className: "hidden md:table-cell", render: (r) => r.quiz_date || fmt(r.created_at) },
        { label: "Marks", render: (r) => r.total_marks ?? 0 },
        { label: "Attempts", render: (r) => r.attempt_count ?? 0 },
        { label: "Status", render: (r) => <span className="capitalize">{r.status || "—"}</span> },
      ]} rows={assignmentData?.quizzes || []} /></section>}

      {section === "attendance" && <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Sessions" value={counts.attendance_sessions || 0} /><Metric label="Present Records" value={attendanceSummary.present} /><Metric label="Absent Records" value={attendanceSummary.absent} /><Metric label="Attendance Rate" value={`${analytics.attendance_rate || 0}%`} /></div>
        <section className={card}><SimpleTable empty="No attendance sessions found." headings={[
          { label: "Date", render: (r) => r.attendance_date || "—" },
          { label: "Title", render: (r) => r.title || "Attendance" },
          { label: "Status", render: (r) => <span className="capitalize">{r.status || "—"}</span> },
          { label: "Created", className: "hidden md:table-cell", render: (r) => fmt(r.created_at) },
        ]} rows={assignmentData?.attendance_sessions || []} /></section>
      </div>}

      {section === "results" && <section className={card}><SimpleTable empty="No gradebook components found." headings={[
        { label: "Component", render: (r) => <div><p className="font-semibold text-slate-800 dark:text-white">{r.name}</p><p className="text-xs capitalize text-slate-400">{r.category}</p></div> },
        { label: "Max Marks", render: (r) => r.max_marks ?? 0 },
        { label: "Marks Entered", render: (r) => r.marks?.length || 0 },
        { label: "Average", render: (r) => { const values=(r.marks||[]).map(x=>Number(x.marks_obtained)).filter(Number.isFinite); return values.length ? (values.reduce((a,b)=>a+b,0)/values.length).toFixed(1) : "—"; } },
        { label: "Approval", className: "hidden md:table-cell", render: (r) => <span className="capitalize">{r.approval?.status || r.approval_status || "—"}</span> },
      ]} rows={assignmentData?.gradebook_components || []} /></section>}

      {section === "analytics" && <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Students" value={analytics.total_students || counts.students || 0} />
          <Metric label="Average Live Progress" value={`${analytics.average_live_progress || 0}%`} note="Assignments + quizzes + attendance + gradebook" />
          <Metric label="Attendance Rate" value={`${analytics.attendance_rate || 0}%`} />
          <Metric label="Average Recorded Mark" value={analytics.average_recorded_mark_percent == null ? "—" : `${analytics.average_recorded_mark_percent}%`} />
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <section className={`${card} p-5`}>
            <div className="mb-4">
              <h2 className="font-semibold text-slate-900 dark:text-white">Student Progress</h2>
              <p className="mt-1 text-xs text-slate-400">Live completion percentage for each enrolled student in this Course Assignment.</p>
            </div>
            {!analytics.student_progress?.length ? <div className="py-12 text-center text-sm text-slate-400">No progress data yet.</div> : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.student_progress.map((row) => ({ name: row.student?.full_name || row.student_id?.slice(0, 6) || "Student", progress: row.progress }))} margin={{ top: 8, right: 8, left: -20, bottom: 28 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                    <XAxis dataKey="name" angle={-20} textAnchor="end" height={58} tick={{ fontSize: 11 }} />
                    <YAxis domain={[0,100]} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value) => [`${value}%`, "Progress"]} />
                    <Bar dataKey="progress" fill="var(--brand-primary, #2563eb)" radius={[6,6,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <section className={`${card} p-5`}>
            <div className="mb-4">
              <h2 className="font-semibold text-slate-900 dark:text-white">Progress Distribution</h2>
              <p className="mt-1 text-xs text-slate-400">How students are distributed across completion ranges.</p>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.progress_distribution || []} margin={{ top: 8, right: 8, left: -20, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                  <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="var(--brand-primary, #2563eb)" radius={[6,6,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <section className={`${card} p-5`}>
            <div className="mb-4">
              <h2 className="font-semibold text-slate-900 dark:text-white">Attendance Trend</h2>
              <p className="mt-1 text-xs text-slate-400">Present-rate trend from recorded attendance dates.</p>
            </div>
            {!analytics.attendance_trend?.length ? <div className="py-12 text-center text-sm text-slate-400">No attendance trend yet.</div> : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics.attendance_trend} margin={{ top: 8, right: 8, left: -20, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0,100]} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value) => [`${value}%`, "Attendance"]} />
                    <Line type="monotone" dataKey="rate" stroke="var(--brand-primary, #2563eb)" strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <section className={`${card} p-5`}>
            <div className="mb-4">
              <h2 className="font-semibold text-slate-900 dark:text-white">Assessment Completion</h2>
              <p className="mt-1 text-xs text-slate-400">Completion based on actual submissions/attempts/recorded gradebook marks.</p>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.assessment_completion || []} margin={{ top: 8, right: 8, left: -20, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0,100]} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => [`${value}%`, "Completion"]} />
                  <Bar dataKey="rate" fill="var(--brand-primary, #2563eb)" radius={[6,6,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>

        <section className={`${card} p-5`}>
          <h2 className="font-semibold text-slate-900 dark:text-white">Activity Summary</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[["Assignment submissions",counts.assignment_submissions],["Quiz submissions",counts.quiz_submissions],["Attendance records",counts.attendance_records],["Gradebook marks",counts.gradebook_marks]].map(([label,value]) => <div key={label} className="rounded-xl bg-slate-50 p-4 dark:bg-slate-950/50"><p className="text-xs text-slate-400">{label}</p><p className="mt-1 text-xl font-bold">{value || 0}</p></div>)}
          </div>
        </section>
      </div>}

      {!tabs.some(([key]) => key === section) && <EmptyState icon={BookOpen} title="Unknown course section" description="Choose a valid course tab." />}
    </main>
  );
}

export default CourseDetail;
