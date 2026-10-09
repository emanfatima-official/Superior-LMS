import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ClipboardList,
  ExternalLink,
  FileText,
  HelpCircle,
  Search,
} from "lucide-react";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  PageHeader,
} from "../components/PageHeader";

import {
  getCourseAssignmentHistory,
} from "../services/historyService";

import {
  BackButton,
  EmptyHistory,
  ErrorHistory,
  LoadingHistory,
  Pagination,
  Section,
  StatCard,
  StatusBadge,
  batchLabel,
  formatDate,
  formatFileSize,
  formatShortDate,
  materialTypeLabel,
  unwrapData,
} from "../components/HistoryUI";

const ACTIVITY_PAGE_SIZE =
  8;

const STUDENT_PAGE_SIZE =
  10;

const GRADEBOOK_PAGE_SIZE =
  8;

const ACTIVITY_TYPES = [
  {
    id: "assignments",
    label: "Assignments",
    icon: ClipboardList,
  },
  {
    id: "quizzes",
    label: "Quizzes",
    icon: HelpCircle,
  },
  {
    id: "materials",
    label: "Materials",
    icon: FileText,
  },
];

const COMPLETION_COLOURS = {
  Assignments:
    "#3b82f6",

  Quizzes:
    "#8b5cf6",

  Gradebook:
    "#f59e0b",
};

const percentage = (
  value
) => {
  const parsed =
    Number(value);

  return Number.isFinite(
    parsed
  )
    ? Math.max(
        0,
        Math.min(
          100,
          parsed
        )
      )
    : null;
};

// ======================================================
// CHART TOOLTIP
// ======================================================

function ChartTooltip({
  active,
  payload,
  label,
  suffix = "%",
}) {
  if (
    !active ||
    !payload?.length
  ) {
    return null;
  }

  const entry =
    payload[0];

  const colour =
    entry?.color ||
    entry?.payload
      ?.colour ||
    "#3b82f6";

  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 p-3 text-xs shadow-xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
      <p className="font-semibold text-slate-900 dark:text-white">
        {label ||
          entry?.payload
            ?.name ||
          "Activity"}
      </p>

      <div className="mt-2 flex items-center justify-between gap-6">
        <span className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
          <span
            className="h-2 w-2 rounded-full"
            style={{
              backgroundColor:
                colour,
            }}
          />

          {entry.name ||
            "Rate"}
        </span>

        <span className="font-bold text-slate-800 dark:text-slate-100">
          {Math.round(
            Number(
              entry.value
            ) || 0
          )}
          {suffix}
        </span>
      </div>

      {entry?.payload
        ?.expected >
        0 && (
        <p className="mt-1 text-slate-400">
          {
            entry.payload
              .completed
          }{" "}
          of{" "}
          {
            entry.payload
              .expected
          }{" "}
          records
        </p>
      )}
    </div>
  );
}

// ======================================================
// RATE BAR
// ======================================================

function RateBar({
  label,
  value,
  colour,
  helper,
}) {
  const normalized =
    percentage(
      value
    );

  return (
    <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            {label}
          </p>

          {helper && (
            <p className="mt-1 text-xs text-slate-400">
              {helper}
            </p>
          )}
        </div>

        <span className="shrink-0 text-lg font-bold text-slate-900 dark:text-white">
          {normalized ==
          null
            ? "Not recorded"
            : `${Math.round(
                normalized
              )}%`}
        </span>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${
              normalized ||
              0
            }%`,

            backgroundColor:
              colour,
          }}
        />
      </div>
    </div>
  );
}

// ======================================================
// ACTIVITY ROW
// ======================================================

function ActivityRow({
  type,
  item,
}) {
  if (
    type ===
    "materials"
  ) {
    const fileSize =
      formatFileSize(
        item.file_size_bytes
      );

    return (
      <div className="flex flex-col gap-4 px-5 py-4 transition hover:bg-slate-50/70 dark:hover:bg-slate-800/30 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
            <FileText
              size={
                18
              }
            />
          </span>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="break-words font-semibold text-slate-900 dark:text-white">
                {item.title ||
                  "Untitled material"}
              </p>

              <StatusBadge
                status={
                  item.status ||
                  "published"
                }
              />
            </div>

            {item.description && (
              <p className="mt-1 line-clamp-2 break-words text-xs text-slate-500 dark:text-slate-400">
                {
                  item.description
                }
              </p>
            )}

            <p className="mt-2 text-xs text-slate-400">
              {materialTypeLabel(
                item
              )}

              {fileSize
                ? ` · ${fileSize}`
                : ""}

              {" · Uploaded "}

              {formatShortDate(
                item.uploaded_at
              )}

              {item.teacher
                ?.full_name
                ? ` by ${item.teacher.full_name}`
                : ""}
            </p>
          </div>
        </div>

        {item.file_url && (
          <a
            href={
              item.file_url
            }
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 text-xs font-semibold text-blue-600 transition hover:bg-blue-500/10 dark:text-blue-400"
          >
            Open

            <ExternalLink
              size={
                14
              }
            />
          </a>
        )}
      </div>
    );
  }

  const isAssignment =
    type ===
    "assignments";

  const Icon =
    isAssignment
      ? ClipboardList
      : HelpCircle;

  const accent =
    isAssignment
      ? "bg-blue-500/10 text-blue-500"
      : "bg-violet-500/10 text-violet-500";

  const activityDate =
    isAssignment
      ? item.due_date
      : item.quiz_date ||
        item.starts_at ||
        item.created_at;

  const participation =
    isAssignment
      ? `${
          item.submission_count ||
          0
        } submission${
          item.submission_count ===
          1
            ? ""
            : "s"
        }`
      : `${
          item.attempt_count ||
          0
        } attempt${
          item.attempt_count ===
          1
            ? ""
            : "s"
        }`;

  return (
    <div className="flex flex-col gap-4 px-5 py-4 transition hover:bg-slate-50/70 dark:hover:bg-slate-800/30 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={`mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${accent}`}
        >
          <Icon
            size={
              18
            }
          />
        </span>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="break-words font-semibold text-slate-900 dark:text-white">
              {item.title ||
                (
                  isAssignment
                    ? "Untitled assignment"
                    : "Untitled quiz"
                )}
            </p>

            <StatusBadge
              status={
                item.status ||
                "draft"
              }
            />
          </div>

          <p className="mt-1 text-xs text-slate-400">
            {isAssignment
              ? "Due"
              : "Scheduled"}{" "}

            {formatShortDate(
              activityDate
            )}

            {" · "}

            {
              participation
            }
          </p>
        </div>
      </div>

      <div className="shrink-0 text-left sm:text-right">
        <p className="text-sm font-bold text-slate-900 dark:text-white">
          {item.total_marks ??
            0}{" "}
          marks
        </p>

        {item.teacher
          ?.full_name && (
          <p className="mt-1 text-xs text-slate-400">
            {
              item.teacher
                .full_name
            }
          </p>
        )}
      </div>
    </div>
  );
}

// ======================================================
// COURSE ASSIGNMENT HISTORY
// ======================================================

export default function CourseAssignmentHistory() {
  const {
    id,
  } = useParams();

  const navigate =
    useNavigate();

  const [
    data,
    setData,
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
    activityType,
    setActivityType,
  ] =
    useState(
      "assignments"
    );

  const [
    activitySearch,
    setActivitySearch,
  ] =
    useState(
      ""
    );

  const [
    activityStatus,
    setActivityStatus,
  ] =
    useState(
      ""
    );

  const [
    activityPage,
    setActivityPage,
  ] =
    useState(
      1
    );

  const [
    studentSearch,
    setStudentSearch,
  ] =
    useState(
      ""
    );

  const [
    studentPage,
    setStudentPage,
  ] =
    useState(
      1
    );

  const [
    gradebookPage,
    setGradebookPage,
  ] =
    useState(
      1
    );

  useEffect(
    () => {
      let active =
        true;

      setLoading(
        true
      );

      setError(
        ""
      );

      getCourseAssignmentHistory(
        id
      )
        .then(
          (
            response
          ) => {
            if (
              active
            ) {
              setData(
                unwrapData(
                  response
                )
              );
            }
          }
        )
        .catch(
          (
            requestError
          ) => {
            if (
              active
            ) {
              setError(
                requestError
                  ?.response
                  ?.data
                  ?.message ||
                  requestError
                    ?.message ||
                  "Failed to load Course Assignment history."
              );
            }
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
      id,
    ]
  );

  useEffect(
    () => {
      setActivityPage(
        1
      );
    },
    [
      activityType,
      activitySearch,
      activityStatus,
    ]
  );

  useEffect(
    () => {
      setStudentPage(
        1
      );
    },
    [
      studentSearch,
    ]
  );

  const assignment =
    data?.course_assignment;

  const counts =
    data?.counts ||
    {};

  const analytics =
    data?.analytics ||
    {};

  // ====================================================
  // COMPLETION DATA
  // ====================================================

  const completionRows =
    useMemo(
      () =>
        (
          analytics.assessment_completion ||
          []
        )
          .filter(
            (
              item
            ) =>
              Number(
                item.expected
              ) >
              0
          )
          .map(
            (
              item
            ) => ({
              ...item,

              rate:
                percentage(
                  item.rate
                ) ||
                0,

              colour:
                COMPLETION_COLOURS[
                  item.name
                ] ||
                "#06b6d4",
            })
          ),
      [
        analytics.assessment_completion,
      ]
    );

  const completionRate = (
    name
  ) => {
    const row =
      completionRows.find(
        (
          item
        ) =>
          item.name ===
          name
      );

    return row
      ? row.rate
      : null;
  };

  // ====================================================
  // ACTIVITIES
  // ====================================================

  const activityMap =
    useMemo(
      () => ({
        assignments:
          data?.assignments ||
          [],

        quizzes:
          data?.quizzes ||
          [],

        materials:
          data?.materials ||
          [],
      }),
      [
        data,
      ]
    );

  const activityStatuses =
    useMemo(
      () => [
        ...new Set(
          (
            activityMap[
              activityType
            ] ||
            []
          )
            .map(
              (
                item
              ) =>
                item.status
            )
            .filter(
              Boolean
            )
        ),
      ],
      [
        activityMap,
        activityType,
      ]
    );

  const filteredActivities =
    useMemo(
      () => {
        const query =
          activitySearch
            .trim()
            .toLowerCase();

        return (
          activityMap[
            activityType
          ] ||
          []
        ).filter(
          (
            item
          ) => {
            const matchesSearch =
              !query ||
              `${item.title || ""} ${item.description || ""} ${item.teacher?.full_name || ""}`
                .toLowerCase()
                .includes(
                  query
                );

            const matchesStatus =
              !activityStatus ||
              item.status ===
                activityStatus;

            return (
              matchesSearch &&
              matchesStatus
            );
          }
        );
      },
      [
        activityMap,
        activityType,
        activitySearch,
        activityStatus,
      ]
    );

  const pagedActivities =
    filteredActivities.slice(
      (
        activityPage -
        1
      ) *
        ACTIVITY_PAGE_SIZE,

      activityPage *
        ACTIVITY_PAGE_SIZE
    );

  // ====================================================
  // STUDENTS
  // ====================================================

  const filteredStudents =
    useMemo(
      () => {
        const query =
          studentSearch
            .trim()
            .toLowerCase();

        return (
          data?.enrollments ||
          []
        ).filter(
          (
            row
          ) => {
            if (
              !query
            ) {
              return true;
            }

            return `${row.student?.full_name || ""} ${row.student?.email || ""} ${row.student?.roll_no || ""} ${row.student?.student_id || ""}`
              .toLowerCase()
              .includes(
                query
              );
          }
        );
      },
      [
        data,
        studentSearch,
      ]
    );

  const pagedStudents =
    filteredStudents.slice(
      (
        studentPage -
        1
      ) *
        STUDENT_PAGE_SIZE,

      studentPage *
        STUDENT_PAGE_SIZE
    );

  // ====================================================
  // GRADEBOOK
  // ====================================================

  const gradebookRows =
    data?.gradebook_components ||
    [];

  const pagedGradebook =
    gradebookRows.slice(
      (
        gradebookPage -
        1
      ) *
        GRADEBOOK_PAGE_SIZE,

      gradebookPage *
        GRADEBOOK_PAGE_SIZE
    );

  const attendanceTrend =
    analytics.attendance_trend ||
    [];

  const attendanceRecorded =
    Number(
      counts.attendance_records ||
        0
    ) >
    0;

  const chartHeight =
    Math.max(
      210,
      completionRows.length *
        62
    );

  return (
    <main className="min-h-full bg-slate-50 p-4 text-slate-700 dark:bg-slate-950 dark:text-slate-200 md:p-8">
      <BackButton
        onClick={() =>
          navigate(
            "/course-assignments"
          )
        }
        label="Back to Course Assignments"
      />

      <PageHeader
        title={
          assignment
            ?.course
            ?.name ||
          "Course Assignment History"
        }
        description={`${batchLabel(
          assignment?.batch
        )} · ${
          assignment
            ?.semester
            ?.name ||
          "Semester"
        } · complete teaching context`}
      />

      {loading ? (
        <LoadingHistory />
      ) : error ? (
        <ErrorHistory
          message={
            error
          }
        />
      ) : (
        data && (
          <>
            {/* Summary cards */}

            <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Enrolled Students"
                value={
                  counts.students ||
                  0
                }
                helper={`${counts.active_students || 0} currently active`}
              />

              <StatCard
                label="Attendance Rate"
                value={
                  attendanceRecorded
                    ? `${Math.round(
                        analytics.attendance_rate ||
                          0
                      )}%`
                    : "Not recorded"
                }
                helper={`${counts.attendance_records || 0} attendance records`}
              />

              <StatCard
                label="Assignment Completion"
                value={
                  completionRate(
                    "Assignments"
                  ) ==
                  null
                    ? "Not assigned"
                    : `${Math.round(
                        completionRate(
                          "Assignments"
                        )
                      )}%`
                }
                helper={`${counts.assignments || 0} assignments`}
              />

              <StatCard
                label="Quiz Completion"
                value={
                  completionRate(
                    "Quizzes"
                  ) ==
                  null
                    ? "Not conducted"
                    : `${Math.round(
                        completionRate(
                          "Quizzes"
                        )
                      )}%`
                }
                helper={`${counts.quizzes || 0} quizzes`}
              />
            </div>

            {/* Professional analytics */}

            <Section
              title="Class Activity Analytics"
              description="Attendance and assessment completion for this batch and semester."
            >
              <div className="grid gap-4 p-4 lg:grid-cols-2 lg:p-5">
                {/* Attendance */}

                <div className="min-w-0 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                  <div className="mb-4">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      Attendance
                      Trend
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      Present and
                      late records
                      by class date
                    </p>
                  </div>

                  {!attendanceTrend.length ? (
                    <div className="flex h-52 items-center justify-center text-center text-sm text-slate-400">
                      No
                      attendance
                      has been
                      recorded
                      yet.
                    </div>
                  ) : attendanceTrend.length ===
                    1 ? (
                    <div className="flex h-52 items-center">
                      <div className="w-full">
                        <RateBar
                          label={formatShortDate(
                            attendanceTrend[0]
                              .date
                          )}
                          value={
                            attendanceTrend[0]
                              .rate
                          }
                          colour="#10b981"
                          helper={`${attendanceTrend[0].present} present of ${attendanceTrend[0].total} records`}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="h-64 w-full">
                      <ResponsiveContainer
                        width="100%"
                        height="100%"
                      >
                        <AreaChart
                          data={
                            attendanceTrend
                          }
                          margin={{
                            top: 8,
                            right: 10,
                            left: -18,
                            bottom: 8,
                          }}
                        >
                          <defs>
                            <linearGradient
                              id="attendanceGradient"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="5%"
                                stopColor="#10b981"
                                stopOpacity={
                                  0.35
                                }
                              />

                              <stop
                                offset="95%"
                                stopColor="#10b981"
                                stopOpacity={
                                  0.02
                                }
                              />
                            </linearGradient>
                          </defs>

                          <CartesianGrid
                            stroke="rgb(148 163 184)"
                            strokeOpacity={
                              0.18
                            }
                            vertical={
                              false
                            }
                          />

                          <XAxis
                            dataKey="date"
                            tickFormatter={
                              formatShortDate
                            }
                            tick={{
                              fill: "#94a3b8",
                              fontSize: 10,
                            }}
                            tickLine={
                              false
                            }
                            axisLine={
                              false
                            }
                            minTickGap={
                              24
                            }
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
                            tick={{
                              fill: "#94a3b8",
                              fontSize: 10,
                            }}
                            tickLine={
                              false
                            }
                            axisLine={
                              false
                            }
                          />

                          <Tooltip
                            cursor={
                              false
                            }
                            labelFormatter={
                              formatShortDate
                            }
                            content={
                              <ChartTooltip />
                            }
                          />

                          <Area
                            type="monotone"
                            dataKey="rate"
                            name="Attendance"
                            stroke="#10b981"
                            strokeWidth={
                              3
                            }
                            fill="url(#attendanceGradient)"
                            activeDot={{
                              r: 5,
                              fill: "#10b981",
                              strokeWidth: 0,
                            }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* Completion */}

                <div className="min-w-0 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                  <div className="mb-4">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      Assessment
                      Completion
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      Student
                      submissions
                      against
                      expected
                      records
                    </p>
                  </div>

                  {!completionRows.length ? (
                    <div className="flex h-52 items-center justify-center text-center text-sm text-slate-400">
                      No
                      assessment
                      activity is
                      available
                      yet.
                    </div>
                  ) : (
                    <div
                      className="w-full"
                      style={{
                        height:
                          chartHeight,
                      }}
                    >
                      <ResponsiveContainer
                        width="100%"
                        height="100%"
                      >
                        <BarChart
                          data={
                            completionRows
                          }
                          layout="vertical"
                          margin={{
                            top: 5,
                            right: 42,
                            left: 4,
                            bottom: 5,
                          }}
                          barCategoryGap="34%"
                        >
                          <CartesianGrid
                            stroke="rgb(148 163 184)"
                            strokeOpacity={
                              0.18
                            }
                            horizontal={
                              false
                            }
                          />

                          <XAxis
                            type="number"
                            domain={[
                              0,
                              100,
                            ]}
                            tickFormatter={(
                              value
                            ) =>
                              `${value}%`
                            }
                            tick={{
                              fill: "#94a3b8",
                              fontSize: 10,
                            }}
                            tickLine={
                              false
                            }
                            axisLine={
                              false
                            }
                          />

                          <YAxis
                            type="category"
                            dataKey="name"
                            width={
                              84
                            }
                            tick={{
                              fill: "#94a3b8",
                              fontSize: 11,
                            }}
                            tickLine={
                              false
                            }
                            axisLine={
                              false
                            }
                          />

                          <Tooltip
                            cursor={
                              false
                            }
                            content={
                              <ChartTooltip />
                            }
                          />

                          <Bar
                            dataKey="rate"
                            name="Completion"
                            radius={[
                              0,
                              6,
                              6,
                              0,
                            ]}
                            barSize={
                              18
                            }
                          >
                            {completionRows.map(
                              (
                                entry
                              ) => (
                                <Cell
                                  key={
                                    entry.name
                                  }
                                  fill={
                                    entry.colour
                                  }
                                />
                              )
                            )}

                            <LabelList
                              dataKey="rate"
                              position="right"
                              formatter={(
                                value
                              ) =>
                                `${Math.round(
                                  value
                                )}%`
                              }
                              fill="#94a3b8"
                              fontSize={
                                11
                              }
                            />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>
            </Section>

            {/* Teacher timeline */}

            <Section
              title="Teacher Timeline"
              description="Teacher changes remain attached to the same course assignment."
            >
              {!data
                .teacher_history
                ?.length ? (
                <EmptyHistory message="No teacher history is available yet." />
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.teacher_history.map(
                    (
                      row
                    ) => (
                      <div
                        key={
                          row.id
                        }
                        className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-slate-900 dark:text-white">
                              {row
                                .teacher
                                ?.full_name ||
                                "Teacher"}
                            </p>

                            {row.is_current && (
                              <StatusBadge status="current" />
                            )}
                          </div>

                          <p className="mt-1 text-xs text-slate-400">
                            {row
                              .teacher
                              ?.department ||
                              "Department not available"}
                          </p>
                        </div>

                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {formatDate(
                            row.assigned_at
                          )}{" "}
                          →{" "}
                          {row.is_current
                            ? "Current"
                            : formatDate(
                                row.unassigned_at
                              )}
                        </p>
                      </div>
                    )
                  )}
                </div>
              )}
            </Section>

            {/* Students */}

            <Section
              title="Enrolled Students"
              description="Searchable student list for this teaching context."
              action={
                <div className="relative w-full sm:w-64">
                  <Search
                    size={
                      15
                    }
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    value={
                      studentSearch
                    }
                    onChange={(
                      event
                    ) =>
                      setStudentSearch(
                        event
                          .target
                          .value
                      )
                    }
                    placeholder="Search student..."
                    className="h-10 w-full rounded-lg border border-slate-200 bg-transparent pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 dark:border-slate-700"
                  />
                </div>
              }
            >
              {!filteredStudents.length ? (
                <EmptyHistory message="No matching students found." />
              ) : (
                <>
                  <div className="grid gap-3 p-4 md:hidden">
                    {pagedStudents.map(
                      (
                        row
                      ) => (
                        <div
                          key={
                            row.id
                          }
                          className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-900 dark:text-white">
                                {row
                                  .student
                                  ?.full_name ||
                                  "—"}
                              </p>

                              <p className="mt-1 truncate text-xs text-slate-400">
                                {row
                                  .student
                                  ?.roll_no ||
                                  row
                                    .student
                                    ?.student_id ||
                                  "—"}
                              </p>
                            </div>

                            <StatusBadge
                              status={
                                row.status
                              }
                            />
                          </div>

                          <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
                            <span className="capitalize">
                              {row.enrollment_type ||
                                "regular"}
                            </span>

                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              {Math.round(
                                Number(
                                  row.progress_percent ||
                                    0
                                )
                              )}
                              %
                              recorded
                            </span>
                          </div>
                        </div>
                      )
                    )}
                  </div>

                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[680px] table-fixed text-left text-sm">
                      <colgroup>
                        <col className="w-[32%]" />
                        <col className="w-[20%]" />
                        <col className="w-[16%]" />
                        <col className="w-[16%]" />
                        <col className="w-[16%]" />
                      </colgroup>

                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400 dark:bg-slate-950/50">
                        <tr>
                          <th className="px-5 py-3">
                            Student
                          </th>

                          <th className="px-5 py-3">
                            Roll No
                          </th>

                          <th className="px-5 py-3">
                            Type
                          </th>

                          <th className="px-5 py-3">
                            Status
                          </th>

                          <th className="px-5 py-3">
                            Recorded
                            Progress
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {pagedStudents.map(
                          (
                            row
                          ) => (
                            <tr
                              key={
                                row.id
                              }
                              className="border-t border-slate-100 transition hover:bg-slate-50/70 dark:border-slate-800 dark:hover:bg-slate-800/30"
                            >
                              <td className="px-5 py-4">
                                <p className="truncate font-semibold text-slate-900 dark:text-white">
                                  {row
                                    .student
                                    ?.full_name ||
                                    "—"}
                                </p>

                                <p className="truncate text-xs text-slate-400">
                                  {row
                                    .student
                                    ?.email ||
                                    ""}
                                </p>
                              </td>

                              <td className="truncate px-5 py-4">
                                {row
                                  .student
                                  ?.roll_no ||
                                  row
                                    .student
                                    ?.student_id ||
                                  "—"}
                              </td>

                              <td className="px-5 py-4 capitalize">
                                {row.enrollment_type ||
                                  "regular"}
                              </td>

                              <td className="px-5 py-4">
                                <StatusBadge
                                  status={
                                    row.status
                                  }
                                />
                              </td>

                              <td className="px-5 py-4 font-semibold">
                                {Math.round(
                                  Number(
                                    row.progress_percent ||
                                      0
                                  )
                                )}
                                %
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>

                  <Pagination
                    page={
                      studentPage
                    }
                    pageSize={
                      STUDENT_PAGE_SIZE
                    }
                    totalItems={
                      filteredStudents.length
                    }
                    onPageChange={
                      setStudentPage
                    }
                  />
                </>
              )}
            </Section>

            {/* Course activities */}

            <Section
              title="Course Activities"
              description="Assignments, quizzes and materials in one compact, searchable view."
            >
              <div className="border-b border-slate-100 p-4 dark:border-slate-800">
                <div className="grid gap-3 lg:grid-cols-[1fr_240px_180px]">
                  <div className="flex min-w-0 gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 dark:bg-slate-950/60">
                    {ACTIVITY_TYPES.map(
                      ({
                        id:
                          typeId,
                        label,
                        icon:
                          Icon,
                      }) => (
                        <button
                          key={
                            typeId
                          }
                          type="button"
                          onClick={() => {
                            setActivityType(
                              typeId
                            );

                            setActivityStatus(
                              ""
                            );
                          }}
                          className={`inline-flex min-w-max flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                            activityType ===
                            typeId
                              ? "bg-white text-blue-600 shadow-sm dark:bg-slate-800 dark:text-blue-400"
                              : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                          }`}
                        >
                          <Icon
                            size={
                              15
                            }
                          />

                          {
                            label
                          }

                          <span className="rounded-full bg-slate-200/70 px-1.5 py-0.5 text-[10px] dark:bg-slate-700">
                            {
                              activityMap[
                                typeId
                              ].length
                            }
                          </span>
                        </button>
                      )
                    )}
                  </div>

                  <div className="relative">
                    <Search
                      size={
                        15
                      }
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      value={
                        activitySearch
                      }
                      onChange={(
                        event
                      ) =>
                        setActivitySearch(
                          event
                            .target
                            .value
                        )
                      }
                      placeholder={`Search ${activityType}...`}
                      className="h-10 w-full rounded-lg border border-slate-200 bg-transparent pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 dark:border-slate-700"
                    />
                  </div>

                  <select
                    value={
                      activityStatus
                    }
                    onChange={(
                      event
                    ) =>
                      setActivityStatus(
                        event
                          .target
                          .value
                      )
                    }
                    className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900"
                  >
                    <option value="">
                      All statuses
                    </option>

                    {activityStatuses.map(
                      (
                        status
                      ) => (
                        <option
                          key={
                            status
                          }
                          value={
                            status
                          }
                        >
                          {
                            status
                          }
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>

              {!filteredActivities.length ? (
                <EmptyHistory
                  message={`No matching ${activityType} found.`}
                />
              ) : (
                <>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {pagedActivities.map(
                      (
                        item
                      ) => (
                        <ActivityRow
                          key={
                            item.id
                          }
                          type={
                            activityType
                          }
                          item={
                            item
                          }
                        />
                      )
                    )}
                  </div>

                  <Pagination
                    page={
                      activityPage
                    }
                    pageSize={
                      ACTIVITY_PAGE_SIZE
                    }
                    totalItems={
                      filteredActivities.length
                    }
                    onPageChange={
                      setActivityPage
                    }
                  />
                </>
              )}
            </Section>

            {/* Hide empty attendance sessions */}

            {!!data
              .attendance_sessions
              ?.length && (
              <Section title="Attendance Sessions">
                <div className="grid gap-3 p-4 md:hidden">
                  {data.attendance_sessions.map(
                    (
                      item
                    ) => (
                      <div
                        key={
                          item.id
                        }
                        className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {item.title ||
                              "Attendance"}
                          </p>

                          <StatusBadge
                            status={
                              item.status
                            }
                          />
                        </div>

                        <p className="mt-2 text-xs text-slate-500">
                          {formatShortDate(
                            item.attendance_date
                          )}

                          {" · Created "}

                          {formatDate(
                            item.created_at
                          )}
                        </p>
                      </div>
                    )
                  )}
                </div>

                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[620px] table-fixed text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400 dark:bg-slate-950/50">
                      <tr>
                        <th className="px-5 py-3">
                          Date
                        </th>

                        <th className="px-5 py-3">
                          Title
                        </th>

                        <th className="px-5 py-3">
                          Status
                        </th>

                        <th className="px-5 py-3">
                          Created
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {data.attendance_sessions.map(
                        (
                          item
                        ) => (
                          <tr
                            key={
                              item.id
                            }
                            className="border-t border-slate-100 dark:border-slate-800"
                          >
                            <td className="px-5 py-4">
                              {formatShortDate(
                                item.attendance_date
                              )}
                            </td>

                            <td className="px-5 py-4">
                              {item.title ||
                                "Attendance"}
                            </td>

                            <td className="px-5 py-4">
                              <StatusBadge
                                status={
                                  item.status
                                }
                              />
                            </td>

                            <td className="px-5 py-4">
                              {formatDate(
                                item.created_at
                              )}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </Section>
            )}

            {/* Gradebook */}

            {!!gradebookRows.length && (
              <Section
                title="Gradebook Components"
                description="Recorded assessment components and their approval state."
              >
                <div className="grid gap-3 p-4 md:hidden">
                  {pagedGradebook.map(
                    (
                      item
                    ) => (
                      <div
                        key={
                          item.id
                        }
                        className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900 dark:text-white">
                              {item.name ||
                                "Component"}
                            </p>

                            <p className="mt-1 text-xs capitalize text-slate-500">
                              {item.category ||
                                "—"}
                            </p>
                          </div>

                          <p className="shrink-0 text-sm font-bold">
                            {item.max_marks ||
                              0}{" "}
                            max
                          </p>
                        </div>

                        <div className="mt-3">
                          <StatusBadge
                            status={
                              item.approval_status ||
                              item
                                .approval
                                ?.status
                            }
                          />
                        </div>
                      </div>
                    )
                  )}
                </div>

                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[620px] table-fixed text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400 dark:bg-slate-950/50">
                      <tr>
                        <th className="px-5 py-3">
                          Category
                        </th>

                        <th className="px-5 py-3">
                          Name
                        </th>

                        <th className="px-5 py-3">
                          Max Marks
                        </th>

                        <th className="px-5 py-3">
                          Approval
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {pagedGradebook.map(
                        (
                          item
                        ) => (
                          <tr
                            key={
                              item.id
                            }
                            className="border-t border-slate-100 dark:border-slate-800"
                          >
                            <td className="px-5 py-4 capitalize">
                              {item.category ||
                                "—"}
                            </td>

                            <td className="px-5 py-4">
                              {item.name ||
                                "—"}
                            </td>

                            <td className="px-5 py-4">
                              {item.max_marks ||
                                0}
                            </td>

                            <td className="px-5 py-4">
                              <StatusBadge
                                status={
                                  item.approval_status ||
                                  item
                                    .approval
                                    ?.status
                                }
                              />
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>

                <Pagination
                  page={
                    gradebookPage
                  }
                  pageSize={
                    GRADEBOOK_PAGE_SIZE
                  }
                  totalItems={
                    gradebookRows.length
                  }
                  onPageChange={
                    setGradebookPage
                  }
                />
              </Section>
            )}
          </>
        )
      )}
    </main>
  );
}