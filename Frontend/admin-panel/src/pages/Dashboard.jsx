import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  GraduationCap,
  BookOpen,
  UserPlus,
  ArrowUpRight,
  Plus,
  RefreshCw,
} from "lucide-react";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

import { getAllTeachers } from "../services/teacherService";
import { getAllStudents } from "../services/studentService";
import { getAllCourses } from "../services/courseService";
import { getAllEnrollments } from "../services/enrollmentService";

import {
  AddTeacherModal,
  AddStudentModal,
  AddCourseModal,
  EnrollStudentsModal,
} from "../components/DashboardModals";

// ======================================================
// HELPERS
// ======================================================

function unwrapResponse(response) {
  const payload = response?.data;

  // Backend response:
  // { success: true, data: [...] }
  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  // Direct array response
  if (Array.isArray(payload)) {
    return payload;
  }

  // Axios response itself may already contain data
  if (Array.isArray(response)) {
    return response;
  }

  return [];
}

function getValidDate(value) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function getEnrollmentDate(enrollment) {
  if (!enrollment) return null;

  // Primary database column
  const enrolledAt = getValidDate(enrollment.enrolled_at);

  if (enrolledAt) {
    return enrolledAt;
  }

  // Support camelCase if API ever returns it
  const camelCaseDate = getValidDate(enrollment.enrolledAt);

  if (camelCaseDate) {
    return camelCaseDate;
  }

  // Some APIs may return created_at
  const createdAt = getValidDate(enrollment.created_at);

  if (createdAt) {
    return createdAt;
  }

  return null;
}

function timeAgo(dateString) {
  const date = getValidDate(dateString);

  if (!date) return "";

  const diffMs = Date.now() - date.getTime();

  if (diffMs < 0) {
    return "just now";
  }

  const minutes = Math.floor(diffMs / 60000);

  if (minutes < 1) {
    return "just now";
  }

  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours} hr ago`;
  }

  const days = Math.floor(hours / 24);

  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function getEnrollmentRangeLabel(range) {
  switch (range) {
    case "30d":
      return "Last 30 days";

    case "15d":
      return "Last 15 days";

    case "7d":
      return "Last 7 days";

    case "3d":
      return "Last 3 days";

    case "1d":
      return "Last 1 day";

    case "12h":
      return "Last 12 hours";

    default:
      return "Enrollment activity";
  }
}

// ======================================================
// SKELETON
// ======================================================

function StatCardSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="skeleton h-11 w-11 rounded-xl" />

      <div className="skeleton mt-5 h-3 w-24 rounded" />

      <div className="skeleton mt-3 h-6 w-16 rounded" />
    </div>
  );
}

// ======================================================
// DASHBOARD
// ======================================================

function Dashboard() {
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [enrollments, setEnrollments] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [activeModal, setActiveModal] = useState(null);

  // Enrollment chart range
  const [enrollmentRange, setEnrollmentRange] = useState("7d");

  // ====================================================
  // LOAD DASHBOARD DATA
  // ====================================================

  const loadData = useCallback(async ({ silent = false } = {}) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const [
        teachersRes,
        studentsRes,
        coursesRes,
        enrollmentsRes,
      ] = await Promise.all([
        getAllTeachers(),
        getAllStudents(),
        getAllCourses(),
        getAllEnrollments(),
      ]);

      // IMPORTANT:
      // Backend returns:
      // {
      //   success: true,
      //   message: "...",
      //   data: [...]
      // }
      //
      // So we must use response.data.data

      const teachersData = unwrapResponse(teachersRes);
      const studentsData = unwrapResponse(studentsRes);
      const coursesData = unwrapResponse(coursesRes);
      const enrollmentsData = unwrapResponse(enrollmentsRes);

      setTeachers(teachersData);
      setStudents(studentsData);
      setCourses(coursesData);
      setEnrollments(enrollmentsData);

      // Helpful debugging
      console.log("DASHBOARD DATA:", {
        teachers: teachersData.length,
        students: studentsData.length,
        courses: coursesData.length,
        enrollments: enrollmentsData.length,
        enrollmentRows: enrollmentsData,
      });
    } catch (err) {
      console.error("DASHBOARD LOAD ERROR:", err);

      const message =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to load dashboard data.";

      setError(message);

      // Keep old data instead of destroying dashboard
      // if refresh fails.
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ====================================================
  // STATS
  // ====================================================

  const stats = useMemo(
    () => [
      {
        title: "Total Students",
        value: students.length,
        icon: Users,
        path: "/students",
        iconClass:
          "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
      },

      {
        title: "Total Teachers",
        value: teachers.length,
        icon: GraduationCap,
        path: "/teachers",
        iconClass:
          "bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400",
      },

      {
        title: "Total Courses",
        value: courses.length,
        icon: BookOpen,
        path: "/courses",
        iconClass:
          "bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400",
      },

      {
        title: "Enrollments",
        value: enrollments.length,
        icon: UserPlus,
        path: "/enrollments",
        iconClass:
          "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400",
      },
    ],
    [students, teachers, courses, enrollments]
  );

  // ====================================================
  // RECENT ACTIVITY
  // ====================================================

  const activities = useMemo(() => {
    const items = [
      ...teachers.map((teacher) => ({
        id: `teacher-${teacher.id}`,
        letter: "T",
        title: "New teacher added",
        description: `${teacher.full_name || "A teacher"} has been added`,
        time: teacher.created_at,
      })),

      ...students.map((student) => ({
        id: `student-${student.id}`,
        letter: "S",
        title: "New student registered",
        description: `${student.full_name || "A student"} registered as a new student`,
        time: student.created_at,
      })),

      ...courses.map((course) => ({
        id: `course-${course.id}`,
        letter: "C",
        title: "New course created",
        description: `${course.name || "A course"} was created`,
        time: course.created_at,
      })),

      ...enrollments.map((enrollment) => ({
        id: `enrollment-${enrollment.id}`,
        letter: "E",
        title: "New enrollment",
        description: "A student was enrolled in a course",
        time: getEnrollmentDate(enrollment),
      })),
    ];

    return items
      .filter((item) => item.time)
      .sort(
        (a, b) =>
          new Date(b.time).getTime() -
          new Date(a.time).getTime()
      )
      .slice(0, 6);
  }, [teachers, students, courses, enrollments]);

  // ====================================================
  // ENROLLMENT OVERVIEW
  // ====================================================

  const enrollmentOverview = useMemo(() => {
    const now = new Date();

    let startDate;
    let endDate = new Date(now);
    let interval = "day";

    switch (enrollmentRange) {
      case "30d": {
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 29);
        interval = "day";
        break;
      }

      case "15d": {
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 14);
        interval = "day";
        break;
      }

      case "7d": {
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 6);
        interval = "day";
        break;
      }

      case "3d": {
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 2);
        interval = "day";
        break;
      }

      case "1d": {
        startDate = new Date(now);
        startDate.setHours(startDate.getHours() - 23);
        interval = "hour";
        break;
      }

      case "12h": {
        startDate = new Date(now);
        startDate.setHours(startDate.getHours() - 11);
        interval = "hour";
        break;
      }

      default: {
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 6);
        interval = "day";
      }
    }

    const validEnrollments = enrollments
      .map((enrollment) => ({
        ...enrollment,
        __date: getEnrollmentDate(enrollment),
      }))
      .filter((enrollment) => enrollment.__date);

    const points = [];

    // ==================================================
    // HOURLY
    // ==================================================

    if (interval === "hour") {
      const cursor = new Date(startDate);

      cursor.setMinutes(0, 0, 0);

      const lastHour = new Date(endDate);
      lastHour.setMinutes(0, 0, 0);

      while (cursor <= lastHour) {
        const pointStart = new Date(cursor);

        const pointEnd = new Date(pointStart);
        pointEnd.setHours(pointEnd.getHours() + 1);

        const count = validEnrollments.filter((enrollment) => {
          return (
            enrollment.__date >= pointStart &&
            enrollment.__date < pointEnd
          );
        }).length;

        points.push({
          key: pointStart.toISOString(),

          label: pointStart.toLocaleTimeString([], {
            hour: "numeric",
          }),

          fullLabel: pointStart.toLocaleString([], {
            dateStyle: "medium",
            timeStyle: "short",
          }),

          enrollments: count,
        });

        cursor.setHours(cursor.getHours() + 1);
      }
    }

    // ==================================================
    // DAILY
    // ==================================================

    else {
      const cursor = new Date(startDate);

      cursor.setHours(0, 0, 0, 0);

      const lastDay = new Date(endDate);
      lastDay.setHours(0, 0, 0, 0);

      while (cursor <= lastDay) {
        const pointStart = new Date(cursor);

        const pointEnd = new Date(pointStart);
        pointEnd.setDate(pointEnd.getDate() + 1);

        const count = validEnrollments.filter((enrollment) => {
          return (
            enrollment.__date >= pointStart &&
            enrollment.__date < pointEnd
          );
        }).length;

        points.push({
          key: pointStart.toISOString(),

          label: pointStart.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          }),

          fullLabel: pointStart.toLocaleDateString(undefined, {
            dateStyle: "medium",
          }),

          enrollments: count,
        });

        cursor.setDate(cursor.getDate() + 1);
      }
    }

    const total = points.reduce(
      (sum, point) => sum + Number(point.enrollments || 0),
      0
    );

    return {
      points,
      total,
      label: getEnrollmentRangeLabel(enrollmentRange),
    };
  }, [enrollments, enrollmentRange]);

  // ====================================================
  // TOP COURSES
  // ====================================================

  const topCourses = useMemo(() => {
    const counts = {};

    enrollments.forEach((enrollment) => {
      if (!enrollment.course_id) return;

      counts[enrollment.course_id] =
        (counts[enrollment.course_id] || 0) + 1;
    });

    return courses
      .map((course) => ({
        id: course.id,
        name: course.name || "Unnamed Course",
        count: counts[course.id] || 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  }, [courses, enrollments]);

  // ====================================================
  // RENDER
  // ====================================================

  return (
    <main className="min-w-0 p-4 md:p-8">
      {/* ==================================================
          HEADER
      ================================================== */}

      <div className="animate-fade-in-up mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Dashboard
          </h1>

          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Overview of your LMS
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadData({ silent: true })}
          disabled={refreshing}
          className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <RefreshCw
            size={16}
            className={refreshing ? "animate-spin" : ""}
          />

          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* ==================================================
          ERROR
      ================================================== */}

      {error && (
        <div className="animate-fade-in mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </div>
      )}

      {/* ==================================================
          STATS
      ================================================== */}

      <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, index) => (
              <StatCardSkeleton key={index} />
            ))
          : stats.map((stat, index) => {
              const Icon = stat.icon;

              return (
                <Link
                  to={stat.path}
                  key={stat.title}
                  className="animate-fade-in-up block min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                  style={{
                    animationDelay: `${index * 0.05}s`,
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div
                      className={`rounded-xl p-3 ${stat.iconClass}`}
                    >
                      <Icon size={22} />
                    </div>

                    <ArrowUpRight
                      size={18}
                      className="text-green-500"
                    />
                  </div>

                  <p className="mt-5 text-sm text-slate-500 dark:text-slate-400">
                    {stat.title}
                  </p>

                  <h2 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                    {stat.value.toLocaleString()}
                  </h2>
                </Link>
              );
            })}
      </div>

      {/* ==================================================
          RECENT ACTIVITY + QUICK ACTIONS
      ================================================== */}

      <div className="mt-6 grid min-w-0 gap-6 xl:grid-cols-2">
        {/* Recent Activity */}

        <section className="min-w-0 animate-fade-in-up rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="font-semibold text-slate-900 dark:text-white">
              Recent Activity
            </h2>

            <Link
              to="/activity"
              className="shrink-0 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              View all
            </Link>
          </div>

          {loading ? (
            <div className="space-y-5">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="flex items-center gap-4"
                >
                  <div className="skeleton h-10 w-10 shrink-0 rounded-full" />

                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="skeleton h-3 w-2/3 rounded" />
                    <div className="skeleton h-3 w-1/3 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : activities.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              No recent activity yet.
            </p>
          ) : (
            <div className="space-y-5">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex min-w-0 items-center gap-4"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 font-semibold text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                    {activity.letter}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {activity.title}
                    </p>

                    <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                      {activity.description}
                    </p>
                  </div>

                  <span className="shrink-0 whitespace-nowrap text-xs text-slate-400">
                    {timeAgo(activity.time)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Quick Actions */}

        <section className="min-w-0 animate-fade-in-up rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-5 font-semibold text-slate-900 dark:text-white">
            Quick Actions
          </h2>

          <div className="grid gap-3 sm:grid-cols-2">
            <QuickAction
              title="Add Teacher"
              description="Create new teacher"
              icon={<Users size={20} />}
              onClick={() => setActiveModal("teacher")}
            />

            <QuickAction
              title="Add Student"
              description="Register new student"
              icon={<GraduationCap size={20} />}
              onClick={() => setActiveModal("student")}
            />

            <QuickAction
              title="Add Course"
              description="Create new course"
              icon={<BookOpen size={20} />}
              onClick={() => setActiveModal("course")}
            />

            <QuickAction
              title="Enroll Students"
              description="Enroll students in courses"
              icon={<UserPlus size={20} />}
              onClick={() => setActiveModal("enroll")}
            />
          </div>
        </section>
      </div>

      {/* ==================================================
          LOWER SECTION
      ================================================== */}

      <div className="mt-6 grid min-w-0 gap-6 xl:grid-cols-2">
        {/* ==================================================
            ENROLLMENT OVERVIEW
        ================================================== */}

        <section className="min-w-0 animate-fade-in-up overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="font-semibold text-slate-900 dark:text-white">
                Enrollment Overview
              </h2>

              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Enrollment activity over time
              </p>
            </div>

            <select
              value={enrollmentRange}
              onChange={(event) =>
                setEnrollmentRange(event.target.value)
              }
              className="w-full shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 sm:w-auto dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="30d">Last 30 Days</option>
              <option value="15d">Last 15 Days</option>
              <option value="7d">Last 7 Days</option>
              <option value="3d">Last 3 Days</option>
              <option value="1d">Last 1 Day</option>
              <option value="12h">Last 12 Hours</option>
            </select>
          </div>

          {/* Summary */}

          <div className="mt-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">
                {enrollmentOverview.total}
              </p>

              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Total enrollments
              </p>
            </div>

            <div className="shrink-0 rounded-xl bg-blue-50 px-3 py-2 text-xs font-medium text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
              {enrollmentOverview.label}
            </div>
          </div>

          {/* Chart */}

          <div className="mt-8 h-72 w-full min-w-0">
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <div className="skeleton h-full w-full rounded-xl" />
              </div>
            ) : enrollmentOverview.points.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                No enrollment data available.
              </div>
            ) : (
              <EnrollmentAreaChart
                points={enrollmentOverview.points}
              />
            )}
          </div>
        </section>

        {/* ==================================================
            TOP COURSES
        ================================================== */}

        <section className="min-w-0 animate-fade-in-up rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-semibold text-slate-900 dark:text-white">
              Top Courses
            </h2>

            <Link
              to="/courses"
              className="shrink-0 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              View all
            </Link>
          </div>

          {topCourses.length === 0 ? (
            <p className="mt-6 py-4 text-center text-sm text-slate-400">
              No courses yet.
            </p>
          ) : (
            <div className="mt-6 space-y-6">
              {topCourses.map((course) => (
                <CourseRow
                  key={course.id}
                  name={course.name}
                  students={course.count}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ==================================================
          MODALS
      ================================================== */}

      <AddTeacherModal
        open={activeModal === "teacher"}
        onClose={() => setActiveModal(null)}
        onCreated={() => loadData({ silent: true })}
      />

      <AddStudentModal
        open={activeModal === "student"}
        onClose={() => setActiveModal(null)}
        onCreated={() => loadData({ silent: true })}
      />

      <AddCourseModal
        open={activeModal === "course"}
        onClose={() => setActiveModal(null)}
        onCreated={() => loadData({ silent: true })}
      />

      <EnrollStudentsModal
        open={activeModal === "enroll"}
        onClose={() => setActiveModal(null)}
        onCreated={() => loadData({ silent: true })}
      />
    </main>
  );
}

// ======================================================
// QUICK ACTION
// ======================================================

function QuickAction({
  title,
  description,
  icon,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-w-0 items-center gap-4 rounded-xl border border-slate-200 p-4 text-left transition hover:border-blue-300 hover:bg-blue-50/50 dark:border-slate-800 dark:hover:border-blue-500/40 dark:hover:bg-blue-500/5"
    >
      <div className="shrink-0 rounded-xl bg-blue-50 p-3 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
        {icon}
      </div>

      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">
          {title}
        </p>

        <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
          {description}
        </p>
      </div>

      <Plus
        size={17}
        className="ml-auto shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-500"
      />
    </button>
  );
}

// ======================================================
// COURSE ROW
// ======================================================

function CourseRow({ name, students }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">
            {name}
          </p>

          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {students} enrollment
            {students === 1 ? "" : "s"}
          </p>
        </div>

        <span className="shrink-0 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {students}
        </span>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className="h-full rounded-full bg-blue-500 transition-all"
          style={{
            width: `${Math.min(
              students > 0 ? 100 : 0,
              Math.max(students * 10, 8)
            )}%`,
          }}
        />
      </div>
    </div>
  );
}

// ======================================================
// RECHARTS ENROLLMENT AREA CHART
// ======================================================

function EnrollmentAreaChart({ points }) {
  return (
    <div className="h-full w-full min-w-0">
      <ResponsiveContainer
        width="100%"
        height="100%"
        debounce={50}
      >
        <AreaChart
          data={points}
          margin={{
            top: 10,
            right: 8,
            left: -20,
            bottom: 0,
          }}
        >
          <defs>
            <linearGradient
              id="enrollmentAreaGradient"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="0%"
                stopColor="#3b82f6"
                stopOpacity={0.22}
              />

              <stop
                offset="100%"
                stopColor="#3b82f6"
                stopOpacity={0}
              />
            </linearGradient>
          </defs>

          <CartesianGrid
            vertical={false}
            strokeDasharray="3 3"
            className="stroke-slate-200 dark:stroke-slate-800"
          />

          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            minTickGap={28}
            tick={{
              fontSize: 11,
              fill: "#94a3b8",
            }}
          />

          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            width={35}
            tick={{
              fontSize: 11,
              fill: "#94a3b8",
            }}
          />

          <Tooltip
            cursor={{
              stroke: "#3b82f6",
              strokeOpacity: 0.15,
            }}
            contentStyle={{
              borderRadius: "12px",
              border:
                "1px solid rgba(148,163,184,0.25)",
              background: "white",
              boxShadow:
                "0 8px 25px rgba(0,0,0,0.08)",
            }}
            labelStyle={{
              color: "#334155",
              fontWeight: 600,
              marginBottom: 4,
            }}
            itemStyle={{
              color: "#2563eb",
              fontSize: 12,
              fontWeight: 500,
            }}
            formatter={(value) => [
              `${value} enrollment${
                Number(value) === 1 ? "" : "s"
              }`,
              "Enrollments",
            ]}
            labelFormatter={(_, payload) =>
              payload?.[0]?.payload?.fullLabel || ""
            }
          />

          <Area
            type="monotone"
            dataKey="enrollments"
            stroke="#3b82f6"
            strokeWidth={2.5}
            fill="url(#enrollmentAreaGradient)"
            activeDot={{
              r: 5,
              strokeWidth: 2,
              fill: "#ffffff",
              stroke: "#3b82f6",
            }}
            dot={{
              r: 3,
              strokeWidth: 2,
              fill: "#ffffff",
              stroke: "#3b82f6",
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default Dashboard;