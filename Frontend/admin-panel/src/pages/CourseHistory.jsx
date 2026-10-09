import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Eye,
} from "lucide-react";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  PageHeader,
} from "../components/PageHeader";

import {
  getCourseHistory,
} from "../services/historyService";

import {
  BackButton,
  EmptyHistory,
  ErrorHistory,
  LoadingHistory,
  Section,
  StatCard,
  StatusBadge,
  batchLabel,
  unwrapData,
} from "../components/HistoryUI";

const COLORS = {
  progress:
    "#3b82f6",

  attendance:
    "#10b981",

  marks:
    "#f59e0b",
};

const validPercent = (
  value
) => {
  if (
    value == null ||
    value === ""
  ) {
    return null;
  }

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
// CUSTOM TOOLTIP
// ======================================================

function ComparisonTooltip({
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
    <div className="min-w-48 rounded-xl border border-slate-200 bg-white/95 p-3 text-xs shadow-xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
      <p className="mb-2 font-semibold text-slate-900 dark:text-white">
        {label}
      </p>

      <div className="space-y-1.5">
        {payload.map(
          (
            entry
          ) => (
            <div
              key={
                entry.dataKey
              }
              className="flex items-center justify-between gap-5"
            >
              <span className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{
                    backgroundColor:
                      entry.color,
                  }}
                />

                {
                  entry.name
                }
              </span>

              <span className="font-semibold text-slate-800 dark:text-slate-100">
                {entry.value ==
                null
                  ? "Not recorded"
                  : `${Math.round(
                      entry.value
                    )}%`}
              </span>
            </div>
          )
        )}
      </div>
    </div>
  );
}

// ======================================================
// SINGLE TEACHING PERIOD METRIC
// ======================================================

function MetricBar({
  label,
  value,
  colour,
  helper,
}) {
  const normalized =
    validPercent(
      value
    );

  return (
    <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {label}
          </p>

          {helper && (
            <p className="mt-1 text-xs text-slate-400">
              {helper}
            </p>
          )}
        </div>

        <span className="shrink-0 text-sm font-bold text-slate-900 dark:text-white">
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
// COURSE HISTORY
// ======================================================

export default function CourseHistory() {
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

      getCourseHistory(
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
                  "Failed to load course history."
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

  const graphRows =
    useMemo(
      () =>
        (
          data?.course_assignments ||
          []
        ).map(
          (
            row
          ) => {
            const activityCount =
              Number(
                row
                  .counts
                  ?.assignments ||
                  0
              ) +
              Number(
                row
                  .counts
                  ?.quizzes ||
                  0
              ) +
              Number(
                row
                  .counts
                  ?.attendance_sessions ||
                  0
              ) +
              Number(
                row
                  .counts
                  ?.gradebook_components ||
                  0
              );

            return {
              id:
                row.id,

              label: `${batchLabel(
                row.batch
              )} · ${
                row
                  .semester
                  ?.name ||
                "Semester"
              }`,

              progress:
                activityCount >
                0
                  ? validPercent(
                      row
                        .analytics
                        ?.average_live_progress
                    )
                  : null,

              attendance:
                Number(
                  row
                    .counts
                    ?.attendance_records ||
                    0
                ) >
                0
                  ? validPercent(
                      row
                        .analytics
                        ?.attendance_rate
                    )
                  : null,

              marks:
                validPercent(
                  row
                    .analytics
                    ?.average_recorded_mark_percent
                ),
            };
          }
        ),
      [
        data,
      ]
    );

  const singleRow =
    graphRows[0];

  const chartHeight =
    Math.min(
      520,
      Math.max(
        250,
        graphRows.length *
          72
      )
    );

  return (
    <main className="min-h-full bg-slate-50 p-4 text-slate-700 dark:bg-slate-950 dark:text-slate-200 md:p-8">
      <BackButton
        onClick={() =>
          navigate(
            "/courses"
          )
        }
        label="Back to Courses"
      />

      <PageHeader
        title={
          data
            ?.course
            ?.name ||
          "Course History"
        }
        description="Every batch and semester remains separate while the generic course keeps one complete history."
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
            {/* Course information */}

            <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Course Code"
                value={
                  data
                    .course
                    ?.course_code ||
                  "—"
                }
              />

              <StatCard
                label="Credits"
                value={
                  data
                    .course
                    ?.credits ??
                  "—"
                }
              />

              <StatCard
                label="Teaching Periods"
                value={
                  data
                    .course_assignments
                    ?.length ||
                  0
                }
                helper="Batch + semester assignments"
              />

              <StatCard
                label="Status"
                value={
                  data
                    .course
                    ?.status ||
                  "—"
                }
              />
            </div>

            {/* One teaching period */}

            {graphRows.length ===
              1 && (
              <Section
                title="Performance Snapshot"
                description={`${singleRow.label} · current teaching-data summary`}
              >
                <div className="grid gap-4 p-5 lg:grid-cols-3">
                  <MetricBar
                    label="Live Progress"
                    value={
                      singleRow.progress
                    }
                    colour={
                      COLORS.progress
                    }
                    helper="Current academic activity"
                  />

                  <MetricBar
                    label="Attendance"
                    value={
                      singleRow.attendance
                    }
                    colour={
                      COLORS.attendance
                    }
                    helper="Recorded attendance rate"
                  />

                  <MetricBar
                    label="Recorded Marks"
                    value={
                      singleRow.marks
                    }
                    colour={
                      COLORS.marks
                    }
                    helper="Approved gradebook marks"
                  />
                </div>
              </Section>
            )}

            {/* Multiple teaching periods */}

            {graphRows.length >
              1 && (
              <Section
                title="Batch / Semester Comparison"
                description="Progress, attendance and recorded marks across teaching periods."
              >
                <div className="overflow-x-auto p-4 sm:p-5">
                  <div
                    className="min-w-[680px]"
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
                          graphRows
                        }
                        layout="vertical"
                        margin={{
                          top: 8,
                          right: 28,
                          left: 18,
                          bottom: 8,
                        }}
                        barCategoryGap="28%"
                      >
                        <CartesianGrid
                          stroke="rgb(148 163 184)"
                          strokeOpacity={
                            0.2
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
                          tickFormatter={(
                            value
                          ) =>
                            `${value}%`
                          }
                        />

                        <YAxis
                          type="category"
                          dataKey="label"
                          width={
                            165
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
                            <ComparisonTooltip />
                          }
                        />

                        <Legend
                          iconType="circle"
                          wrapperStyle={{
                            fontSize: 12,
                            paddingTop: 8,
                          }}
                        />

                        <Bar
                          dataKey="progress"
                          name="Progress"
                          fill={
                            COLORS.progress
                          }
                          radius={[
                            0,
                            5,
                            5,
                            0,
                          ]}
                          barSize={
                            9
                          }
                        />

                        <Bar
                          dataKey="attendance"
                          name="Attendance"
                          fill={
                            COLORS.attendance
                          }
                          radius={[
                            0,
                            5,
                            5,
                            0,
                          ]}
                          barSize={
                            9
                          }
                        />

                        <Bar
                          dataKey="marks"
                          name="Recorded Marks"
                          fill={
                            COLORS.marks
                          }
                          radius={[
                            0,
                            5,
                            5,
                            0,
                          ]}
                          barSize={
                            9
                          }
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </Section>
            )}

            {/* Course assignment records */}

            <Section
              title="Course Assignment History"
              description="Open a teaching period for its students, activities and analytics."
            >
              {!data
                .course_assignments
                ?.length ? (
                <EmptyHistory message="No teaching periods are available for this course." />
              ) : (
                <>
                  {/* Mobile */}

                  <div className="grid gap-3 p-4 md:hidden">
                    {data.course_assignments.map(
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
                              <p className="font-semibold text-slate-900 dark:text-white">
                                {batchLabel(
                                  row.batch
                                )}
                              </p>

                              <p className="mt-1 text-xs text-slate-500">
                                {row
                                  .semester
                                  ?.name ||
                                  "—"}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                navigate(
                                  `/course-assignments/${row.id}/history`
                                )
                              }
                              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 text-xs font-semibold text-blue-600 transition hover:bg-blue-500/10 dark:text-blue-400"
                            >
                              <Eye
                                size={
                                  14
                                }
                              />

                              View
                            </button>
                          </div>

                          <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-500">
                            <p>
                              <span className="font-semibold text-slate-700 dark:text-slate-300">
                                Teacher:
                              </span>{" "}
                              {row
                                .teacher
                                ?.full_name ||
                                "Unassigned"}
                            </p>

                            <p>
                              <span className="font-semibold text-slate-700 dark:text-slate-300">
                                Students:
                              </span>{" "}
                              {row
                                .counts
                                ?.students ||
                                0}
                            </p>

                            <p>
                              <span className="font-semibold text-slate-700 dark:text-slate-300">
                                Assignments:
                              </span>{" "}
                              {row
                                .counts
                                ?.assignments ||
                                0}
                            </p>

                            <p>
                              <span className="font-semibold text-slate-700 dark:text-slate-300">
                                Quizzes:
                              </span>{" "}
                              {row
                                .counts
                                ?.quizzes ||
                                0}
                            </p>

                            <p>
                              <span className="font-semibold text-slate-700 dark:text-slate-300">
                                Progress:
                              </span>{" "}
                              {row
                                .analytics
                                ?.average_live_progress ||
                                0}
                              %
                            </p>

                            <div>
                              <StatusBadge
                                status={
                                  row.status
                                }
                              />
                            </div>
                          </div>
                        </div>
                      )
                    )}
                  </div>

                  {/* Desktop */}

                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[900px] table-fixed text-left text-sm">
                      <colgroup>
                        <col className="w-[15%]" />
                        <col className="w-[16%]" />
                        <col className="w-[18%]" />
                        <col className="w-[10%]" />
                        <col className="w-[11%]" />
                        <col className="w-[10%]" />
                        <col className="w-[10%]" />
                        <col className="w-[10%]" />
                      </colgroup>

                      <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-950/50 dark:text-slate-400">
                        <tr>
                          <th className="px-3 py-3 font-semibold">
                            Batch
                          </th>

                          <th className="px-3 py-3 font-semibold">
                            Semester
                          </th>

                          <th className="px-3 py-3 font-semibold">
                            Current
                            Teacher
                          </th>

                          <th className="px-3 py-3 font-semibold">
                            Students
                          </th>

                          <th className="px-3 py-3 font-semibold">
                            Progress
                          </th>

                          <th className="px-3 py-3 font-semibold">
                            Assignments
                          </th>

                          <th className="px-3 py-3 font-semibold">
                            Quizzes
                          </th>

                          <th className="px-3 py-3 text-right font-semibold">
                            Action
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {data.course_assignments.map(
                          (
                            row
                          ) => (
                            <tr
                              key={
                                row.id
                              }
                              className="border-t border-slate-100 transition hover:bg-slate-50/70 dark:border-slate-800 dark:hover:bg-slate-800/30"
                            >
                              <td className="px-3 py-4">
                                {batchLabel(
                                  row.batch
                                )}
                              </td>

                              <td className="truncate px-3 py-4">
                                {row
                                  .semester
                                  ?.name ||
                                  "—"}
                              </td>

                              <td className="truncate px-3 py-4">
                                {row
                                  .teacher
                                  ?.full_name ||
                                  "Unassigned"}
                              </td>

                              <td className="px-3 py-4">
                                {row
                                  .counts
                                  ?.students ||
                                  0}
                              </td>

                              <td className="px-3 py-4 font-semibold">
                                {row
                                  .analytics
                                  ?.average_live_progress ||
                                  0}
                                %
                              </td>

                              <td className="px-3 py-4">
                                {row
                                  .counts
                                  ?.assignments ||
                                  0}
                              </td>

                              <td className="px-3 py-4">
                                {row
                                  .counts
                                  ?.quizzes ||
                                  0}
                              </td>

                              <td className="px-3 py-4 text-right">
                                <button
                                  type="button"
                                  onClick={() =>
                                    navigate(
                                      `/course-assignments/${row.id}/history`
                                    )
                                  }
                                  className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 text-xs font-semibold text-blue-600 transition hover:bg-blue-500/10 dark:text-blue-400"
                                >
                                  <Eye
                                    size={
                                      14
                                    }
                                  />

                                  View
                                </button>
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </Section>
          </>
        )
      )}
    </main>
  );
}