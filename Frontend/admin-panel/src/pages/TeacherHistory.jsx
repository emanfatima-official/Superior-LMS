import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ClipboardList,
  ExternalLink,
  Eye,
  FileText,
  HelpCircle,
  Search,
} from "lucide-react";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  PageHeader,
} from "../components/PageHeader";

import {
  getTeacherHistory,
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

const TEACHING_PAGE_SIZE =
  8;

const activityTabs = [
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

const tabClass = (
  active
) =>
  `inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold transition ${
    active
      ? "bg-blue-600 text-white shadow-sm"
      : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
  }`;

const itemContext = (
  item
) =>
  item?.context ||
  {};

// ======================================================
// ACTIVITY ROW
// ======================================================

function ActivityRow({
  type,
  item,
}) {
  const context =
    itemContext(
      item
    );

  const course =
    context.course;

  const semester =
    context.semester;

  const batch =
    context.batch;

  const isLegacy =
    context.is_legacy ||
    !item.course_assignment_id;

  const Icon =
    type ===
    "assignments"
      ? ClipboardList
      : type ===
          "quizzes"
        ? HelpCircle
        : FileText;

  const activityDate =
    type ===
    "assignments"
      ? item.due_date
      : type ===
          "quizzes"
        ? item.quiz_date ||
          item.starts_at ||
          item.created_at
        : item.uploaded_at;

  const fileSize =
    type ===
    "materials"
      ? formatFileSize(
          item.file_size_bytes
        )
      : null;

  return (
    <div className="flex flex-col gap-4 px-5 py-4 transition hover:bg-slate-50/70 dark:hover:bg-slate-800/30 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
          <Icon
            size={
              18
            }
          />
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="min-w-0 break-words font-semibold text-slate-900 dark:text-white">
              {item.title ||
                "Untitled activity"}
            </p>

            <StatusBadge
              status={
                item.status ||
                "recorded"
              }
            />
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {course?.name ||
                "Course unavailable"}
            </span>

            {course
              ?.course_code && (
              <span>
                ·{" "}
                {
                  course.course_code
                }
              </span>
            )}
          </div>

          <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
            <span className="rounded-full bg-violet-500/10 px-2 py-1 font-semibold text-violet-600 dark:text-violet-400">
              {semester
                ?.name ||
                "Semester unavailable"}
            </span>

            {batch
              ?.start_year && (
              <span className="rounded-full bg-slate-500/10 px-2 py-1 font-semibold text-slate-600 dark:text-slate-300">
                Batch{" "}
                {batchLabel(
                  batch
                )}
              </span>
            )}

            {isLegacy && (
              <span className="rounded-full bg-amber-500/10 px-2 py-1 font-semibold text-amber-600 dark:text-amber-400">
                Legacy /
                unmapped
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-3 pl-[52px] text-xs lg:justify-end lg:pl-0">
        <div className="text-left lg:text-right">
          {type ===
            "assignments" && (
            <p className="font-semibold text-slate-800 dark:text-slate-200">
              {item.total_marks ??
                0}{" "}
              marks
            </p>
          )}

          {type ===
            "quizzes" && (
            <p className="font-semibold text-slate-800 dark:text-slate-200">
              {item.total_marks ??
                0}{" "}
              marks
            </p>
          )}

          {type ===
            "materials" && (
            <p className="font-semibold text-slate-800 dark:text-slate-200">
              {materialTypeLabel(
                item
              )}

              {fileSize
                ? ` · ${fileSize}`
                : ""}
            </p>
          )}

          <p className="mt-1 text-slate-400">
            {type ===
            "assignments"
              ? "Due "
              : ""}

            {formatShortDate(
              activityDate
            )}
          </p>
        </div>

        {type ===
          "materials" &&
          item.file_url && (
            <a
              href={
                item.file_url
              }
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 font-semibold text-blue-600 transition hover:border-blue-500/40 hover:bg-blue-500/10 dark:text-blue-400"
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
    </div>
  );
}

// ======================================================
// TEACHER HISTORY
// ======================================================

export default function TeacherHistory() {
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
    courseFilter,
    setCourseFilter,
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
    activityPage,
    setActivityPage,
  ] =
    useState(
      1
    );

  const [
    teachingPage,
    setTeachingPage,
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

      getTeacherHistory(
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
                  "Failed to load teacher history."
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

  const counts =
    data?.activity_counts ||
    {};

  const activities =
    data?.activities ||
    {};

  const teachingHistory =
    data?.teaching_history ||
    [];

  // ====================================================
  // FILTER OPTIONS
  // ====================================================

  const courseOptions =
    useMemo(
      () => {
        const map =
          new Map();

        for (
          const rows
          of Object.values(
            activities
          )
        ) {
          if (
            !Array.isArray(
              rows
            )
          ) {
            continue;
          }

          for (
            const item
            of rows
          ) {
            const course =
              itemContext(
                item
              ).course;

            if (
              course?.id
            ) {
              map.set(
                course.id,
                course
              );
            }
          }
        }

        for (
          const row
          of teachingHistory
        ) {
          const course =
            row
              .course_assignment
              ?.course;

          if (
            course?.id
          ) {
            map.set(
              course.id,
              course
            );
          }
        }

        return [
          ...map.values(),
        ].sort(
          (
            first,
            second
          ) =>
            String(
              first.name ||
                ""
            ).localeCompare(
              String(
                second.name ||
                  ""
              )
            )
        );
      },
      [
        activities,
        teachingHistory,
      ]
    );

  const semesterOptions =
    useMemo(
      () => {
        const map =
          new Map();

        for (
          const rows
          of Object.values(
            activities
          )
        ) {
          if (
            !Array.isArray(
              rows
            )
          ) {
            continue;
          }

          for (
            const item
            of rows
          ) {
            const semester =
              itemContext(
                item
              ).semester;

            if (
              semester?.id
            ) {
              map.set(
                semester.id,
                semester
              );
            }
          }
        }

        for (
          const row
          of teachingHistory
        ) {
          const semester =
            row
              .course_assignment
              ?.semester;

          if (
            semester?.id
          ) {
            map.set(
              semester.id,
              semester
            );
          }
        }

        return [
          ...map.values(),
        ].sort(
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
      },
      [
        activities,
        teachingHistory,
      ]
    );

  // ====================================================
  // ACTIVITY FILTERING
  // ====================================================

  const filteredActivities =
    useMemo(
      () => {
        const search =
          activitySearch
            .trim()
            .toLowerCase();

        return (
          activities[
            activityType
          ] ||
          []
        ).filter(
          (
            item
          ) => {
            const context =
              itemContext(
                item
              );

            const courseId =
              context
                .course
                ?.id ||
              item.course_id ||
              "";

            const semesterId =
              context
                .semester
                ?.id ||
              "";

            const searchable =
              [
                item.title,
                context
                  .course
                  ?.name,
                context
                  .course
                  ?.course_code,
                context
                  .semester
                  ?.name,
                batchLabel(
                  context.batch
                ),
              ]
                .filter(
                  Boolean
                )
                .join(
                  " "
                )
                .toLowerCase();

            return (
              (
                !courseFilter ||
                String(
                  courseId
                ) ===
                  courseFilter
              ) &&
              (
                !semesterFilter ||
                String(
                  semesterId
                ) ===
                  semesterFilter
              ) &&
              (
                !search ||
                searchable.includes(
                  search
                )
              )
            );
          }
        );
      },
      [
        activities,
        activityType,
        activitySearch,
        courseFilter,
        semesterFilter,
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
      courseFilter,
      semesterFilter,
    ]
  );

  const pagedActivities =
    useMemo(
      () => {
        const start =
          (
            activityPage -
            1
          ) *
          ACTIVITY_PAGE_SIZE;

        return filteredActivities.slice(
          start,
          start +
            ACTIVITY_PAGE_SIZE
        );
      },
      [
        filteredActivities,
        activityPage,
      ]
    );

  const pagedTeachingHistory =
    useMemo(
      () => {
        const start =
          (
            teachingPage -
            1
          ) *
          TEACHING_PAGE_SIZE;

        return teachingHistory.slice(
          start,
          start +
            TEACHING_PAGE_SIZE
        );
      },
      [
        teachingHistory,
        teachingPage,
      ]
    );

  const teachingContexts =
    new Set(
      teachingHistory
        .map(
          (
            row
          ) =>
            row.course_assignment_id
        )
        .filter(
          Boolean
        )
    ).size;

  return (
    <main className="min-h-full bg-slate-50 p-4 text-slate-700 dark:bg-slate-950 dark:text-slate-200 md:p-8">
      <BackButton
        onClick={() =>
          navigate(
            "/teachers"
          )
        }
        label="Back to Teachers"
      />

      <PageHeader
        title="Teacher History"
        description="Teaching periods and original activities remain preserved after teacher replacement."
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

            <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <StatCard
                label="Teaching Contexts"
                value={
                  teachingContexts
                }
              />

              <StatCard
                label="Assignments"
                value={
                  counts.assignments ||
                  0
                }
              />

              <StatCard
                label="Quizzes"
                value={
                  counts.quizzes ||
                  0
                }
              />

              <StatCard
                label="Materials"
                value={
                  counts.materials ||
                  0
                }
              />

              <StatCard
                label="Attendance Records"
                value={
                  counts.attendance_records ||
                  0
                }
              />
            </div>

            {/* Teaching history */}

            <Section
              title={`${
                data
                  .profile
                  ?.full_name ||
                "Teacher"
              } · Teaching History`}
              description="Every course, batch and semester taught by this teacher."
            >
              {!teachingHistory.length ? (
                <EmptyHistory message="No teaching history is available." />
              ) : (
                <>
                  {/* Mobile */}

                  <div className="grid gap-3 p-4 md:hidden">
                    {pagedTeachingHistory.map(
                      (
                        row
                      ) => {
                        const context =
                          row.course_assignment;

                        return (
                          <div
                            key={
                              row.id
                            }
                            className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="break-words font-semibold text-slate-900 dark:text-white">
                                  {context
                                    ?.course
                                    ?.name ||
                                    "Course unavailable"}
                                </p>

                                <p className="text-xs text-slate-400">
                                  {context
                                    ?.course
                                    ?.course_code ||
                                    "—"}
                                </p>
                              </div>

                              <StatusBadge
                                status={
                                  row.is_current
                                    ? "current"
                                    : "historical"
                                }
                              >
                                {row.is_current
                                  ? "Current"
                                  : "Historical"}
                              </StatusBadge>
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
                              <p>
                                <span className="font-semibold">
                                  Batch:
                                </span>{" "}
                                {batchLabel(
                                  context
                                    ?.batch
                                )}
                              </p>

                              <p>
                                <span className="font-semibold">
                                  Semester:
                                </span>{" "}
                                {context
                                  ?.semester
                                  ?.name ||
                                  "—"}
                              </p>

                              <p className="col-span-2">
                                <span className="font-semibold">
                                  Assigned:
                                </span>{" "}
                                {formatDate(
                                  row.assigned_at
                                )}
                              </p>

                              {!row.is_current && (
                                <p className="col-span-2">
                                  <span className="font-semibold">
                                    Unassigned:
                                  </span>{" "}
                                  {formatDate(
                                    row.unassigned_at
                                  )}
                                </p>
                              )}
                            </div>

                            {context
                              ?.id && (
                              <button
                                type="button"
                                onClick={() =>
                                  navigate(
                                    `/course-assignments/${context.id}/history`
                                  )
                                }
                                className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 text-xs font-semibold text-blue-600 dark:text-blue-400"
                              >
                                <Eye
                                  size={
                                    14
                                  }
                                />

                                View
                                History
                              </button>
                            )}
                          </div>
                        );
                      }
                    )}
                  </div>

                  {/* Desktop */}

                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[820px] table-fixed text-left text-sm">
                      <colgroup>
                        <col className="w-[24%]" />
                        <col className="w-[14%]" />
                        <col className="w-[16%]" />
                        <col className="w-[17%]" />
                        <col className="w-[13%]" />
                        <col className="w-[16%]" />
                      </colgroup>

                      <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-950/50 dark:text-slate-400">
                        <tr>
                          <th className="px-4 py-3 font-semibold">
                            Course
                          </th>

                          <th className="px-4 py-3 font-semibold">
                            Batch
                          </th>

                          <th className="px-4 py-3 font-semibold">
                            Semester
                          </th>

                          <th className="px-4 py-3 font-semibold">
                            Assigned
                          </th>

                          <th className="px-4 py-3 font-semibold">
                            Status
                          </th>

                          <th className="px-4 py-3 text-right font-semibold">
                            Action
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {pagedTeachingHistory.map(
                          (
                            row
                          ) => {
                            const context =
                              row.course_assignment;

                            return (
                              <tr
                                key={
                                  row.id
                                }
                                className="border-t border-slate-100 transition hover:bg-slate-50/70 dark:border-slate-800 dark:hover:bg-slate-800/30"
                              >
                                <td className="px-4 py-4">
                                  <p className="truncate font-semibold text-slate-900 dark:text-white">
                                    {context
                                      ?.course
                                      ?.name ||
                                      "—"}
                                  </p>

                                  <p className="truncate text-xs text-slate-400">
                                    {context
                                      ?.course
                                      ?.course_code ||
                                      "—"}
                                  </p>
                                </td>

                                <td className="px-4 py-4">
                                  {batchLabel(
                                    context
                                      ?.batch
                                  )}
                                </td>

                                <td className="truncate px-4 py-4">
                                  {context
                                    ?.semester
                                    ?.name ||
                                    "—"}
                                </td>

                                <td className="px-4 py-4">
                                  {formatDate(
                                    row.assigned_at
                                  )}
                                </td>

                                <td className="px-4 py-4">
                                  <StatusBadge
                                    status={
                                      row.is_current
                                        ? "current"
                                        : "historical"
                                    }
                                  >
                                    {row.is_current
                                      ? "Current"
                                      : "Historical"}
                                  </StatusBadge>
                                </td>

                                <td className="px-4 py-4 text-right">
                                  {context
                                    ?.id ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        navigate(
                                          `/course-assignments/${context.id}/history`
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
                                  ) : (
                                    <span className="text-xs text-slate-400">
                                      Legacy
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          }
                        )}
                      </tbody>
                    </table>
                  </div>

                  <Pagination
                    page={
                      teachingPage
                    }
                    pageSize={
                      TEACHING_PAGE_SIZE
                    }
                    totalItems={
                      teachingHistory.length
                    }
                    onPageChange={
                      setTeachingPage
                    }
                  />
                </>
              )}
            </Section>

            {/* Activity explorer */}

            <Section
              title="Activity History"
              description="Search and filter activities by their original course and semester context."
            >
              <div className="border-b border-slate-100 p-4 dark:border-slate-800">
                <div className="grid grid-cols-1 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-950 sm:grid-cols-3">
                  {activityTabs.map(
                    (
                      tab
                    ) => {
                      const Icon =
                        tab.icon;

                      const count =
                        activities[
                          tab.id
                        ]
                          ?.length ||
                        0;

                      return (
                        <button
                          key={
                            tab.id
                          }
                          type="button"
                          onClick={() =>
                            setActivityType(
                              tab.id
                            )
                          }
                          className={tabClass(
                            activityType ===
                              tab.id
                          )}
                        >
                          <Icon
                            size={
                              15
                            }
                          />

                          {
                            tab.label
                          }

                          <span className="rounded-full bg-black/10 px-1.5 py-0.5 text-[10px] dark:bg-white/10">
                            {
                              count
                            }
                          </span>
                        </button>
                      );
                    }
                  )}
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(220px,1fr)_220px_220px]">
                  <label className="relative block">
                    <Search
                      size={
                        16
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
                      placeholder="Search activity or course..."
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    />
                  </label>

                  <select
                    value={
                      courseFilter
                    }
                    onChange={(
                      event
                    ) =>
                      setCourseFilter(
                        event
                          .target
                          .value
                      )
                    }
                    className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  >
                    <option value="">
                      All courses
                    </option>

                    {courseOptions.map(
                      (
                        course
                      ) => (
                        <option
                          key={
                            course.id
                          }
                          value={
                            course.id
                          }
                        >
                          {
                            course.name
                          }
                        </option>
                      )
                    )}
                  </select>

                  <select
                    value={
                      semesterFilter
                    }
                    onChange={(
                      event
                    ) =>
                      setSemesterFilter(
                        event
                          .target
                          .value
                      )
                    }
                    className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  >
                    <option value="">
                      All semesters
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
                          {
                            semester.name
                          }
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>

              {!filteredActivities.length ? (
                <EmptyHistory message="No matching activities found." />
              ) : (
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
              )}

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
            </Section>
          </>
        )
      )}
    </main>
  );
}