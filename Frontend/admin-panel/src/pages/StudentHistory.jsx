import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  BookOpen,
  Eye,
  GraduationCap,
  Layers3,
} from "lucide-react";

import {
  PageHeader,
} from "../components/PageHeader";

import {
  getStudentHistory,
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
  unwrapData,
} from "../components/HistoryUI";

const COURSE_PAGE_SIZE =
  8;

const tabClass = (
  active
) =>
  `inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold transition ${
    active
      ? "bg-blue-600 text-white shadow-sm"
      : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
  }`;

const progressValue = (
  row
) =>
  Math.max(
    0,
    Math.min(
      100,
      Math.round(
        Number(
          row?.progress_percent
        ) || 0
      )
    )
  );

// ======================================================
// COURSE ROWS
// ======================================================

function CourseRows({
  rows,
  studentId,
  navigate,
  showSemester = true,
}) {
  if (!rows?.length) {
    return (
      <EmptyHistory message="No course records found for this view." />
    );
  }

  const viewButton = (
    row
  ) =>
    row.course_assignment_id ? (
      <button
        type="button"
        onClick={() =>
          navigate(
            `/students/${studentId}/history/${row.course_assignment_id}`
          )
        }
        className="inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 text-xs font-semibold text-blue-600 transition hover:border-blue-500/40 hover:bg-blue-500/10 dark:text-blue-400"
      >
        <Eye size={14} />

        View
      </button>
    ) : (
      <span className="text-xs text-slate-400">
        Legacy
      </span>
    );

  return (
    <>
      <div className="grid gap-3 p-4 md:hidden">
        {rows.map(
          (
            row
          ) => (
            <article
              key={row.id}
              className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900 dark:text-white">
                    {row.course
                      ?.name ||
                      "Course"}
                  </p>

                  <p className="truncate text-xs text-slate-400">
                    {row.course
                      ?.course_code ||
                      "—"}
                  </p>
                </div>

                {viewButton(
                  row
                )}
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                {showSemester && (
                  <div>
                    <dt className="text-slate-400">
                      Semester
                    </dt>

                    <dd className="mt-1 font-medium">
                      {row
                        .semester
                        ?.name ||
                        row
                          .course_assignment
                          ?.semester
                          ?.name ||
                        "—"}
                    </dd>
                  </div>
                )}

                <div>
                  <dt className="text-slate-400">
                    Teacher
                  </dt>

                  <dd className="mt-1 truncate font-medium">
                    {row
                      .course_assignment
                      ?.teacher
                      ?.full_name ||
                      "Unassigned"}
                  </dd>
                </div>

                <div>
                  <dt className="text-slate-400">
                    Type
                  </dt>

                  <dd className="mt-1 capitalize">
                    {row.enrollment_type ||
                      "regular"}
                  </dd>
                </div>

                <div>
                  <dt className="text-slate-400">
                    Status
                  </dt>

                  <dd className="mt-1">
                    <StatusBadge
                      status={
                        row.status
                      }
                    />
                  </dd>
                </div>

                <div
                  className={
                    showSemester
                      ? ""
                      : "col-span-2"
                  }
                >
                  <dt className="text-slate-400">
                    Recorded
                    Progress
                  </dt>

                  <dd className="mt-1 font-semibold">
                    {progressValue(
                      row
                    )}
                    %
                  </dd>
                </div>
              </dl>
            </article>
          )
        )}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full table-fixed text-left text-sm">
          <colgroup>
            <col
              className={
                showSemester
                  ? "w-[26%]"
                  : "w-[32%]"
              }
            />

            {showSemester && (
              <col className="w-[16%]" />
            )}

            <col
              className={
                showSemester
                  ? "w-[18%]"
                  : "w-[22%]"
              }
            />

            <col
              className={
                showSemester
                  ? "w-[10%]"
                  : "w-[11%]"
              }
            />

            <col
              className={
                showSemester
                  ? "w-[11%]"
                  : "w-[12%]"
              }
            />

            <col
              className={
                showSemester
                  ? "w-[9%]"
                  : "w-[11%]"
              }
            />

            <col
              className={
                showSemester
                  ? "w-[10%]"
                  : "w-[12%]"
              }
            />
          </colgroup>

          <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-950/50 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-semibold">
                Course
              </th>

              {showSemester && (
                <th className="px-4 py-3 font-semibold">
                  Semester
                </th>
              )}

              <th className="px-4 py-3 font-semibold">
                Teacher
              </th>

              <th className="px-4 py-3 font-semibold">
                Type
              </th>

              <th className="px-4 py-3 font-semibold">
                Status
              </th>

              <th className="px-4 py-3 font-semibold">
                Progress
              </th>

              <th className="px-4 py-3 text-right font-semibold">
                Action
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map(
              (
                row
              ) => (
                <tr
                  key={row.id}
                  className="border-t border-slate-100 transition hover:bg-slate-50/70 dark:border-slate-800 dark:hover:bg-slate-800/30"
                >
                  <td className="px-4 py-4">
                    <p className="truncate font-semibold text-slate-900 dark:text-white">
                      {row.course
                        ?.name ||
                        "Course"}
                    </p>

                    <p className="truncate text-xs text-slate-400">
                      {row.course
                        ?.course_code ||
                        "—"}
                    </p>
                  </td>

                  {showSemester && (
                    <td className="truncate px-4 py-4">
                      {row
                        .semester
                        ?.name ||
                        row
                          .course_assignment
                          ?.semester
                          ?.name ||
                        "—"}
                    </td>
                  )}

                  <td className="truncate px-4 py-4">
                    {row
                      .course_assignment
                      ?.teacher
                      ?.full_name ||
                      "Unassigned"}
                  </td>

                  <td className="px-4 py-4 capitalize">
                    {row.enrollment_type ||
                      "regular"}
                  </td>

                  <td className="px-4 py-4">
                    <StatusBadge
                      status={
                        row.status
                      }
                    />
                  </td>

                  <td className="px-4 py-4 font-semibold">
                    {progressValue(
                      row
                    )}
                    %
                  </td>

                  <td className="px-4 py-4 text-right">
                    {viewButton(
                      row
                    )}
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ======================================================
// STUDENT HISTORY PAGE
// ======================================================

export default function StudentHistory() {
  const {
    id,
  } = useParams();

  const navigate =
    useNavigate();

  const [
    data,
    setData,
  ] = useState(
    null
  );

  const [
    loading,
    setLoading,
  ] = useState(
    true
  );

  const [
    error,
    setError,
  ] = useState(
    ""
  );

  const [
    view,
    setView,
  ] = useState(
    "overall"
  );

  const [
    semesterFilter,
    setSemesterFilter,
  ] = useState(
    ""
  );

  const [
    coursePage,
    setCoursePage,
  ] = useState(
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

      getStudentHistory(
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
                  "Failed to load student history."
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

  const profile =
    data?.profile;

  const semesterHistory =
    data?.semester_history ||
    [];

  const enrollments =
    data?.enrollments ||
    [];

  const filteredCourses =
    useMemo(
      () => {
        if (
          !semesterFilter
        ) {
          return enrollments;
        }

        return enrollments.filter(
          (
            row
          ) =>
            String(
              row.semester_id ||
                row
                  .course_assignment
                  ?.semester_id ||
                ""
            ) ===
            semesterFilter
        );
      },
      [
        enrollments,
        semesterFilter,
      ]
    );

  useEffect(
    () => {
      setCoursePage(
        1
      );
    },
    [
      semesterFilter,
    ]
  );

  const pagedCourses =
    useMemo(
      () => {
        const start =
          (
            coursePage -
            1
          ) *
          COURSE_PAGE_SIZE;

        return filteredCourses.slice(
          start,
          start +
            COURSE_PAGE_SIZE
        );
      },
      [
        filteredCourses,
        coursePage,
      ]
    );

  const overall =
    data?.overall ||
    {};

  const semesterCount =
    overall.semesters ??
    semesterHistory.length;

  const totalCourseRecords =
    overall.total_course_records ??
    overall.course_enrollments ??
    enrollments.length;

  const completedCourses =
    overall.completed_courses ??
    enrollments.filter(
      (
        row
      ) =>
        row.status ===
        "completed"
    ).length;

  const currentProgress =
    Math.max(
      0,
      Math.min(
        100,
        Math.round(
          Number(
            overall.current_progress ??
              profile
                ?.progress_percentage ??
              0
          ) || 0
        )
      )
    );

  return (
    <main className="min-h-full bg-slate-50 p-4 text-slate-700 dark:bg-slate-950 dark:text-slate-200 md:p-8">
      <BackButton
        onClick={() =>
          navigate(
            "/students"
          )
        }
        label="Back to Students"
      />

      <PageHeader
        title="Student History"
        description="Current academic standing and permanent semester-wise course history."
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
            <div className="mb-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Student"
                value={
                  profile
                    ?.full_name ||
                  "—"
                }
                helper={
                  profile
                    ?.email
                }
              />

              <StatCard
                label="Student ID"
                value={
                  profile
                    ?.student_id ||
                  "—"
                }
                helper="Official student identifier"
              />

              <StatCard
                label="Program"
                value={
                  profile
                    ?.linked_program
                    ?.name ||
                  profile
                    ?.department ||
                  "—"
                }
                helper={
                  profile
                    ?.linked_department
                    ?.name ||
                  null
                }
              />

              <StatCard
                label="Current Semester"
                value={
                  profile
                    ?.linked_semester
                    ?.name ||
                  profile
                    ?.semester ||
                  "—"
                }
                helper={batchLabel(
                  profile
                    ?.linked_batch
                )}
              />
            </div>

            <p className="mb-5 text-xs text-slate-500 dark:text-slate-400">
              {semesterCount}{" "}
              semester record
              {semesterCount ===
              1
                ? ""
                : "s"}{" "}
              ·{" "}
              {totalCourseRecords}{" "}
              total course
              record
              {totalCourseRecords ===
              1
                ? ""
                : "s"}
            </p>

            <div className="mb-5 grid grid-cols-1 gap-1 rounded-xl border border-slate-200 bg-white p-1.5 dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-3">
              <button
                type="button"
                className={tabClass(
                  view ===
                    "overall"
                )}
                onClick={() =>
                  setView(
                    "overall"
                  )
                }
              >
                <GraduationCap
                  size={15}
                />

                Overall
              </button>

              <button
                type="button"
                className={tabClass(
                  view ===
                    "semester"
                )}
                onClick={() =>
                  setView(
                    "semester"
                  )
                }
              >
                <Layers3
                  size={15}
                />

                Semester-wise
              </button>

              <button
                type="button"
                className={tabClass(
                  view ===
                    "course"
                )}
                onClick={() =>
                  setView(
                    "course"
                  )
                }
              >
                <BookOpen
                  size={15}
                />

                Course-wise
              </button>
            </div>

            {view ===
              "overall" && (
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard
                    label="Current Courses"
                    value={
                      overall.current_courses ??
                      0
                    }
                    helper="Active in current semester"
                  />

                  <StatCard
                    label="Completed Courses"
                    value={
                      completedCourses
                    }
                    helper="Completed course records"
                  />

                  <StatCard
                    label="Supply / Repeat"
                    value={
                      overall.supply_enrollments ??
                      0
                    }
                    helper="Supply enrollment records"
                  />

                  <StatCard
                    label="Current Progress"
                    value={`${currentProgress}%`}
                    helper="Attendance + assignments + quizzes"
                  />
                </div>

                <Section
                  title="Academic Timeline"
                  description="Promotion closes a term but never deletes its academic record."
                >
                  {!data
                    .academic_history
                    ?.length ? (
                    <EmptyHistory />
                  ) : (
                    <>
                      <div className="grid gap-3 p-4 md:hidden">
                        {data.academic_history.map(
                          (
                            row
                          ) => (
                            <article
                              key={
                                row.id
                              }
                              className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <p className="font-semibold">
                                  {row
                                    .semester
                                    ?.name ||
                                    "Semester"}
                                </p>

                                <StatusBadge
                                  status={
                                    row.status
                                  }
                                />
                              </div>

                              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                                <div>
                                  <p className="text-slate-400">
                                    Batch
                                  </p>

                                  <p className="mt-1">
                                    {batchLabel(
                                      row.batch
                                    )}
                                  </p>
                                </div>

                                <div>
                                  <p className="text-slate-400">
                                    Program
                                  </p>

                                  <p className="mt-1">
                                    {row
                                      .program
                                      ?.name ||
                                      "—"}
                                  </p>
                                </div>

                                <div className="col-span-2">
                                  <p className="text-slate-400">
                                    Department
                                  </p>

                                  <p className="mt-1">
                                    {row
                                      .department
                                      ?.name ||
                                      "—"}
                                  </p>
                                </div>

                                <div>
                                  <p className="text-slate-400">
                                    Started
                                  </p>

                                  <p className="mt-1">
                                    {formatDate(
                                      row.started_at
                                    )}
                                  </p>
                                </div>

                                <div>
                                  <p className="text-slate-400">
                                    Ended
                                  </p>

                                  <p className="mt-1">
                                    {formatDate(
                                      row.ended_at
                                    )}
                                  </p>
                                </div>
                              </div>
                            </article>
                          )
                        )}
                      </div>

                      <div className="hidden overflow-x-auto md:block">
                        <table className="w-full min-w-[900px] table-fixed text-left text-sm">
                          <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-950/50 dark:text-slate-400">
                            <tr>
                              {[
                                "Batch",
                                "Department",
                                "Program",
                                "Semester",
                                "Status",
                                "Started",
                                "Ended",
                              ].map(
                                (
                                  heading
                                ) => (
                                  <th
                                    key={
                                      heading
                                    }
                                    className="px-4 py-3 font-semibold"
                                  >
                                    {
                                      heading
                                    }
                                  </th>
                                )
                              )}
                            </tr>
                          </thead>

                          <tbody>
                            {data.academic_history.map(
                              (
                                row
                              ) => (
                                <tr
                                  key={
                                    row.id
                                  }
                                  className="border-t border-slate-100 dark:border-slate-800"
                                >
                                  <td className="px-4 py-4">
                                    {batchLabel(
                                      row.batch
                                    )}
                                  </td>

                                  <td className="truncate px-4 py-4">
                                    {row
                                      .department
                                      ?.name ||
                                      "—"}
                                  </td>

                                  <td className="truncate px-4 py-4">
                                    {row
                                      .program
                                      ?.name ||
                                      "—"}
                                  </td>

                                  <td className="px-4 py-4">
                                    {row
                                      .semester
                                      ?.name ||
                                      "—"}
                                  </td>

                                  <td className="px-4 py-4">
                                    <StatusBadge
                                      status={
                                        row.status
                                      }
                                    />
                                  </td>

                                  <td className="px-4 py-4">
                                    {formatDate(
                                      row.started_at
                                    )}
                                  </td>

                                  <td className="px-4 py-4">
                                    {formatDate(
                                      row.ended_at
                                    )}
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
              </div>
            )}

            {view ===
              "semester" && (
              <div className="space-y-5">
                {!semesterHistory.length ? (
                  <EmptyHistory message="No semester history found." />
                ) : (
                  semesterHistory.map(
                    (
                      term
                    ) => (
                      <Section
                        key={
                          term.semester_id ||
                          "legacy"
                        }
                        title={
                          term
                            .semester
                            ?.name ||
                          "Legacy / Unmapped Semester"
                        }
                        description={`${
                          term.is_current
                            ? "Current semester"
                            : "Historical semester"
                        } · ${
                          term
                            .summary
                            ?.courses ||
                          0
                        } course record(s)`}
                      >
                        {term
                          .enrollments
                          ?.length ? (
                          <>
                            <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
                              <StatCard
                                label="Courses"
                                value={
                                  term
                                    .summary
                                    ?.courses ||
                                  0
                                }
                              />

                              <StatCard
                                label="Regular"
                                value={
                                  term
                                    .summary
                                    ?.regular ||
                                  0
                                }
                              />

                              <StatCard
                                label="Supply"
                                value={
                                  term
                                    .summary
                                    ?.supply ||
                                  0
                                }
                              />

                              <StatCard
                                label="Completed"
                                value={
                                  term
                                    .summary
                                    ?.completed ||
                                  0
                                }
                              />
                            </div>

                            <CourseRows
                              rows={
                                term.enrollments
                              }
                              studentId={
                                id
                              }
                              navigate={
                                navigate
                              }
                              showSemester={
                                false
                              }
                            />
                          </>
                        ) : (
                          <EmptyHistory message="No course records in this semester." />
                        )}
                      </Section>
                    )
                  )
                )}
              </div>
            )}

            {view ===
              "course" && (
              <Section
                title="Course-wise History"
                description="Filter by semester or open a course for its complete academic record."
              >
                <div className="flex flex-col gap-3 border-b border-slate-100 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
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

                    {semesterHistory
                      .filter(
                        (
                          term
                        ) =>
                          term.semester_id
                      )
                      .map(
                        (
                          term
                        ) => (
                          <option
                            key={
                              term.semester_id
                            }
                            value={
                              term.semester_id
                            }
                          >
                            {term
                              .semester
                              ?.name ||
                              "Semester"}
                          </option>
                        )
                      )}
                  </select>

                  <span className="text-xs text-slate-400">
                    {
                      filteredCourses.length
                    }{" "}
                    course
                    record(s)
                  </span>
                </div>

                <CourseRows
                  rows={
                    pagedCourses
                  }
                  studentId={
                    id
                  }
                  navigate={
                    navigate
                  }
                  showSemester
                />

                <Pagination
                  page={
                    coursePage
                  }
                  pageSize={
                    COURSE_PAGE_SIZE
                  }
                  totalItems={
                    filteredCourses.length
                  }
                  onPageChange={
                    setCoursePage
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