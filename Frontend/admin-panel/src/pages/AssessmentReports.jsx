import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Activity,
  Award,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Clock3,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Users,
  Wifi,
} from "lucide-react";

import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import * as XLSX from "xlsx";

import FormField from "../components/FormField";

import AcademicStructureService from "../services/AcademicStructureService";

import {
  getAssessmentReportOptions,
  getAssessmentResultsReport,
} from "../services/assessmentService";

// ======================================================
// CONFIG
// ======================================================

const LIVE_REFRESH_MS = 8000;

const COLORS = {
  blue: "#2563EB",
  blueLight: "#60A5FA",

  indigo: "#4F46E5",
  violet: "#7C3AED",

  cyan: "#0891B2",
  sky: "#0284C7",

  emerald: "#059669",
  green: "#16A34A",

  amber: "#D97706",
  orange: "#EA580C",

  rose: "#E11D48",
  red: "#DC2626",

  slate: "#64748B",
};

const CHART_COLORS = [
  "#2563EB",
  "#7C3AED",
  "#059669",
  "#D97706",
  "#0891B2",
  "#E11D48",
  "#4F46E5",
  "#0284C7",
];

// ======================================================
// STYLES
// ======================================================

const inputClass = `
  h-11
  w-full
  min-w-0
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

// ======================================================
// FILTER STATE
// ======================================================

const emptyFilters = {
  department_id: "",
  program_id: "",
  batch_id: "",
  semester_id: "",

  mode: "semester",

  course_assignment_id: "",
  student_id: "",
};

// ======================================================
// API NORMALIZER
// ======================================================

const unwrapApiData = (response) => {
  if (response == null) {
    return null;
  }

  if (
    response?.data &&
    response.data?.data !== undefined
  ) {
    return response.data.data;
  }

  if (response?.data !== undefined) {
    return response.data;
  }

  return response;
};

// ======================================================
// BASIC HELPERS
// ======================================================

const number = (value) => {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
};

const round = (
  value,
  precision = 1
) => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Number(
    parsed.toFixed(precision)
  );
};

const percent = (
  obtained,
  maximum
) => {
  const max = number(maximum);

  if (max <= 0) {
    return null;
  }

  return round(
    (number(obtained) / max) * 100
  );
};

const batchLabel = (batch) => {
  if (!batch) {
    return "—";
  }

  if (
    batch.start_year &&
    batch.end_year
  ) {
    return `${batch.start_year}-${batch.end_year}`;
  }

  return (
    batch.name ||
    batch.code ||
    "—"
  );
};

const sameId = (first, second) =>
  String(first || "") ===
  String(second || "");

const activeOnly = (item) =>
  item?.status !== "inactive";

const categoryLabel = (category) =>
  ({
    quiz: "Quiz",
    assignment: "Assignment",
    mid: "Mid",
    final: "Final",
  }[category] ||
    category ||
    "Assessment");

const categoryGroupLabel = (
  category
) =>
  ({
    quiz: "Quizzes",
    assignment: "Assignments",
    mid: "Mids",
    final: "Finals",
  }[category] ||
    categoryLabel(category));

const formatDateTime = (
  value
) => {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

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

const formatShortDate = (
  value
) => {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

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
    }
  ).format(date);
};

const safeFilename = (
  value
) =>
  String(
    value ||
      "assessment-report"
  )
    .trim()
    .replace(
      /[^a-z0-9-_]+/gi,
      "-"
    )
    .replace(
      /^-+|-+$/g,
      ""
    ) ||
  "assessment-report";

const timestamp = (
  value
) => {
  if (!value) {
    return Number.MAX_SAFE_INTEGER;
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return Number.MAX_SAFE_INTEGER;
  }

  return date.getTime();
};

const componentDate = (
  component
) =>
  component?.schedule_item
    ?.conduct_starts_at ||
  component?.schedule_item
    ?.starts_at ||
  component?.mark_updated_at ||
  component?.submitted_at ||
  component?.approved_at ||
  component?.created_at ||
  null;

// ======================================================
// RECORDED TOTALS
// Pending result is NOT considered 0.
// ======================================================

const getCourseRecordedTotals = (
  course
) => {
  let obtained = 0;
  let maximum = 0;
  let recorded = 0;
  let pending = 0;

  for (
    const component
    of course?.components || []
  ) {
    if (
      component.marks_obtained ==
      null
    ) {
      pending += 1;
      continue;
    }

    obtained += number(
      component.marks_obtained
    );

    maximum += number(
      component.max_marks
    );

    recorded += 1;
  }

  return {
    obtained,
    maximum,
    recorded,
    pending,

    percentage:
      maximum > 0
        ? round(
            (obtained /
              maximum) *
              100
          )
        : null,
  };
};

const getStudentRecordedTotals = (
  studentRow
) => {
  let obtained = 0;
  let maximum = 0;
  let recorded = 0;
  let pending = 0;

  for (
    const course
    of studentRow?.courses || []
  ) {
    const totals =
      getCourseRecordedTotals(
        course
      );

    obtained += totals.obtained;
    maximum += totals.maximum;

    recorded += totals.recorded;
    pending += totals.pending;
  }

  return {
    obtained,
    maximum,
    recorded,
    pending,

    percentage:
      maximum > 0
        ? round(
            (obtained /
              maximum) *
              100
          )
        : null,
  };
};

// ======================================================
// UI
// ======================================================

function ErrorAlert({
  children,
}) {
  if (!children) {
    return null;
  }

  return (
    <div
      className="
        rounded-xl
        border
        border-red-200
        bg-red-50
        px-4
        py-3
        text-sm
        text-red-700
        dark:border-red-900/50
        dark:bg-red-500/10
        dark:text-red-300
      "
    >
      {children}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  description,
  accent = "blue",
}) {
  const styles = {
    blue:
      "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300",

    violet:
      "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300",

    emerald:
      "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300",

    amber:
      "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300",

    rose:
      "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300",

    cyan:
      "bg-cyan-50 text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-300",
  };

  return (
    <div
      className="
        min-w-0
        rounded-2xl
        border
        border-slate-200
        bg-white
        p-4
        shadow-sm
        dark:border-slate-800
        dark:bg-slate-900
      "
    >
      <div className="flex items-start gap-3">
        <div
          className={`
            shrink-0
            rounded-xl
            p-2.5
            ${
              styles[accent] ||
              styles.blue
            }
          `}
        >
          <Icon size={18} />
        </div>

        <div className="min-w-0">
          <p
            className="
              truncate
              text-[11px]
              font-semibold
              uppercase
              tracking-wide
              text-slate-400
            "
          >
            {label}
          </p>

          <p
            className="
              mt-1
              text-xl
              font-bold
              text-slate-900
              dark:text-white
            "
          >
            {value}
          </p>

          {description ? (
            <p
              className="
                mt-1
                text-[11px]
                leading-4
                text-slate-400
              "
            >
              {description}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  badge,
  children,
  height = 360,
  className = "",
}) {
  return (
    <section
      className={`
        min-w-0
        overflow-hidden
        rounded-2xl
        border
        border-slate-200
        bg-white
        shadow-sm
        dark:border-slate-800
        dark:bg-slate-900
        ${className}
      `}
    >
      <div
        className="
          flex
          min-h-[76px]
          items-start
          justify-between
          gap-3
          border-b
          border-slate-100
          px-5
          py-4
          dark:border-slate-800
        "
      >
        <div className="min-w-0">
          <h3
            className="
              font-bold
              text-slate-900
              dark:text-white
            "
          >
            {title}
          </h3>

          <p
            className="
              mt-1
              text-xs
              leading-5
              text-slate-500
            "
          >
            {subtitle}
          </p>
        </div>

        {badge ? (
          <span
            className="
              shrink-0
              rounded-full
              bg-slate-100
              px-2.5
              py-1
              text-[11px]
              font-semibold
              text-slate-600
              dark:bg-slate-800
              dark:text-slate-300
            "
          >
            {badge}
          </span>
        ) : null}
      </div>

      <div
        style={{
          height,
        }}
        className="
          min-w-0
          px-2
          pb-3
          pt-5
          sm:px-4
        "
      >
        {children}
      </div>
    </section>
  );
}

function EmptyChart({
  text = "No recorded marks available yet.",
}) {
  return (
    <div
      className="
        flex
        h-full
        items-center
        justify-center
        px-5
        text-center
        text-sm
        text-slate-400
      "
    >
      {text}
    </div>
  );
}

// ======================================================
// PROFESSIONAL TOOLTIP
// ======================================================

function ProfessionalTooltip({
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

  const source =
    payload[0]?.payload ||
    {};

  return (
    <div
      className="
        min-w-[180px]
        rounded-xl
        border
        border-slate-200
        bg-white/95
        px-3.5
        py-3
        shadow-2xl
        backdrop-blur
        dark:border-slate-700
        dark:bg-slate-900/95
      "
    >
      <p
        className="
          text-xs
          font-bold
          text-slate-900
          dark:text-white
        "
      >
        {source.fullName ||
          source.name ||
          label ||
          "Performance"}
      </p>

      {source.courseName ? (
        <p
          className="
            mt-1
            text-[11px]
            text-slate-400
          "
        >
          {source.courseName}
        </p>
      ) : null}

      {source.date ? (
        <p
          className="
            mt-1
            text-[11px]
            text-slate-400
          "
        >
          {formatDateTime(
            source.date
          )}
        </p>
      ) : null}

      <div className="mt-2 space-y-1">
        {payload.map(
          (
            item
          ) => (
            <div
              key={`${item.dataKey}-${item.name}`}
              className="
                flex
                items-center
                justify-between
                gap-4
                text-xs
              "
            >
              <span
                className="
                  flex
                  items-center
                  gap-2
                  text-slate-500
                  dark:text-slate-300
                "
              >
                <span
                  style={{
                    backgroundColor:
                      item.color,
                  }}
                  className="
                    h-2
                    w-2
                    rounded-full
                  "
                />

                {
                  item.name
                }
              </span>

              <strong
                className="
                  text-slate-800
                  dark:text-white
                "
              >
                {typeof item.value ===
                "number"
                  ? `${round(
                      item.value
                    )}%`
                  : item.value}
              </strong>
            </div>
          )
        )}
      </div>

      {source.change !=
      null ? (
        <div
          className={`
            mt-2
            flex
            items-center
            gap-1.5
            border-t
            border-slate-100
            pt-2
            text-[11px]
            font-semibold
            dark:border-slate-800

            ${
              source.change >
              0
                ? "text-emerald-600"
                : source.change <
                    0
                  ? "text-rose-600"
                  : "text-slate-400"
            }
          `}
        >
          {source.change >
          0 ? (
            <TrendingUp
              size={
                13
              }
            />
          ) : source.change <
            0 ? (
            <TrendingDown
              size={
                13
              }
            />
          ) : (
            <Activity
              size={
                13
              }
            />
          )}

          {source.change >
          0
            ? "+"
            : ""}

          {round(
            source.change
          )}
          % from previous
        </div>
      ) : null}
    </div>
  );
}

// ======================================================
// LIVE SUMMARY
// ======================================================

const calculateLiveSummary = (
  report
) => {
  if (
    !report
  ) {
    return {
      students: 0,
      courses: 0,
      assessments: 0,
      recorded: 0,
      pending: 0,
    };
  }

  let recorded =
    0;

  let pending =
    0;

  for (
    const student
    of report.rows ||
    []
  ) {
    for (
      const course
      of student.courses ||
      []
    ) {
      for (
        const component
        of course.components ||
        []
      ) {
        if (
          component.marks_obtained ==
          null
        ) {
          pending +=
            1;
        } else {
          recorded +=
            1;
        }
      }
    }
  }

  const assessments =
    (
      report.courses ||
      []
    ).reduce(
      (
        sum,
        course
      ) =>
        sum +
        (
          course.components ||
          []
        ).length,
      0
    );

  return {
    students:
      (
        report.rows ||
        []
      ).length,

    courses:
      (
        report.courses ||
        []
      ).length,

    assessments,

    recorded,
    pending,
  };
};

// ======================================================
// COMPONENT STATISTICS
// ======================================================

const buildAssessmentStatistics = (
  report,
  targetCourseAssignmentId = null
) => {
  const buckets =
    new Map();

  for (
    const course
    of report?.courses ||
    []
  ) {
    if (
      targetCourseAssignmentId &&
      course.id !==
        targetCourseAssignmentId
    ) {
      continue;
    }

    for (
      const component
      of course.components ||
      []
    ) {
      buckets.set(
        component.id,
        {
          id:
            component.id,

          name:
            component.name ||
            "Assessment",

          fullName:
            component.name ||
            "Assessment",

          category:
            component.category,

          courseAssignmentId:
            course.id,

          courseName:
            course.course
              ?.name ||
            "Course",

          courseCode:
            course.course
              ?.course_code ||
            "",

          date:
            componentDate(
              component
            ),

          values:
            [],
        }
      );
    }
  }

  for (
    const student
    of report?.rows ||
    []
  ) {
    for (
      const course
      of student.courses ||
      []
    ) {
      if (
        targetCourseAssignmentId &&
        course.course_assignment_id !==
          targetCourseAssignmentId
      ) {
        continue;
      }

      for (
        const component
        of course.components ||
        []
      ) {
        if (
          component.marks_obtained ==
            null ||
          number(
            component.max_marks
          ) <= 0
        ) {
          continue;
        }

        if (
          !buckets.has(
            component.id
          )
        ) {
          buckets.set(
            component.id,
            {
              id:
                component.id,

              name:
                component.name ||
                "Assessment",

              fullName:
                component.name ||
                "Assessment",

              category:
                component.category,

              courseAssignmentId:
                course.course_assignment_id,

              courseName:
                course.course
                  ?.name ||
                "Course",

              courseCode:
                course.course
                  ?.course_code ||
                "",

              date:
                componentDate(
                  component
                ),

              values:
                [],
            }
          );
        }

        const bucket =
          buckets.get(
            component.id
          );

        if (
          !bucket.date
        ) {
          bucket.date =
            componentDate(
              component
            );
        }

        bucket.values.push(
          percent(
            component.marks_obtained,
            component.max_marks
          )
        );
      }
    }
  }

  return [
    ...buckets.values(),
  ]
    .map(
      (
        bucket
      ) => {
        const values =
          bucket.values.filter(
            (
              value
            ) =>
              value !=
              null
          );

        if (
          !values.length
        ) {
          return {
            ...bucket,
            average:
              null,
            highest:
              null,
            lowest:
              null,
            count:
              0,
          };
        }

        return {
          ...bucket,

          average:
            round(
              values.reduce(
                (
                  sum,
                  value
                ) =>
                  sum +
                  value,
                0
              ) /
                values.length
            ),

          highest:
            round(
              Math.max(
                ...values
              )
            ),

          lowest:
            round(
              Math.min(
                ...values
              )
            ),

          count:
            values.length,
        };
      }
    )
    .sort(
      (
        a,
        b
      ) =>
        timestamp(
          a.date
        ) -
        timestamp(
          b.date
        )
    );
};

// ======================================================
// SEMESTER ANALYTICS
// ======================================================

const buildSemesterAnalytics = (
  report
) => {
  const assessments =
    buildAssessmentStatistics(
      report
    ).filter(
      (
        item
      ) =>
        item.average !=
        null
    );

  let runningSum =
    0;

  let runningCount =
    0;

  const timeline =
    assessments.map(
      (
        item,
        index
      ) => {
        runningSum +=
          item.average;

        runningCount +=
          1;

        const runningAverage =
          round(
            runningSum /
              runningCount
          );

        const previous =
          index > 0
            ? assessments[
                index -
                  1
              ].average
            : null;

        return {
          ...item,

          label:
            item.date
              ? formatShortDate(
                  item.date
                )
              : `A${index + 1}`,

          runningAverage,

          change:
            previous ==
            null
              ? null
              : round(
                  item.average -
                    previous
                ),
        };
      }
    );

  const courseMap =
    new Map();

  for (
    const student
    of report?.rows ||
    []
  ) {
    for (
      const course
      of student.courses ||
      []
    ) {
      const name =
        course.course
          ?.name ||
        "Course";

      if (
        !courseMap.has(
          name
        )
      ) {
        courseMap.set(
          name,
          {
            obtained:
              0,

            maximum:
              0,
          }
        );
      }

      const bucket =
        courseMap.get(
          name
        );

      for (
        const component
        of course.components ||
        []
      ) {
        if (
          component.marks_obtained ==
          null
        ) {
          continue;
        }

        bucket.obtained +=
          number(
            component.marks_obtained
          );

        bucket.maximum +=
          number(
            component.max_marks
          );
      }
    }
  }

  const courses =
    [
      ...courseMap.entries(),
    ]
      .map(
        ([
          name,
          values,
        ]) => ({
          name,
          fullName:
            name,

          hasData:
            values.maximum >
            0,

          percentage:
            values.maximum >
            0
              ? round(
                  (
                    values.obtained /
                    values.maximum
                  ) *
                    100
                )
              : 0,
        })
      )
      .filter(
        (
          item
        ) =>
          item.hasData
      )
      .sort(
        (
          a,
          b
        ) =>
          b.percentage -
          a.percentage
      );

  const distribution = [
    {
      name:
        "Excellent 80%+",
      value:
        0,
    },

    {
      name:
        "Good 70–79%",
      value:
        0,
    },

    {
      name:
        "Average 60–69%",
      value:
        0,
    },

    {
      name:
        "50–59%",
      value:
        0,
    },

    {
      name:
        "Below 50%",
      value:
        0,
    },

    {
      name:
        "No Marks",
      value:
        0,
    },
  ];

  const scores =
    [];

  for (
    const student
    of report?.rows ||
    []
  ) {
    const total =
      getStudentRecordedTotals(
        student
      );

    const score =
      total.percentage;

    if (
      score !=
      null
    ) {
      scores.push(
        score
      );
    }

    if (
      score ==
      null
    ) {
      distribution[
        5
      ].value +=
        1;
    } else if (
      score >=
      80
    ) {
      distribution[
        0
      ].value +=
        1;
    } else if (
      score >=
      70
    ) {
      distribution[
        1
      ].value +=
        1;
    } else if (
      score >=
      60
    ) {
      distribution[
        2
      ].value +=
        1;
    } else if (
      score >=
      50
    ) {
      distribution[
        3
      ].value +=
        1;
    } else {
      distribution[
        4
      ].value +=
        1;
    }
  }

  const overall =
    scores.length
      ? round(
          scores.reduce(
            (
              sum,
              score
            ) =>
              sum +
              score,
            0
          ) /
            scores.length
        )
      : 0;

  return {
    timeline,
    courses,

    distribution:
      distribution.filter(
        (
          item
        ) =>
          item.value >
          0
      ),

    overall,
  };
};

// ======================================================
// COURSE ANALYTICS
// ======================================================

const buildCourseAnalytics = (
  report
) => {
  const course =
    report?.courses?.[0] ||
    null;

  if (
    !course
  ) {
    return {
      course:
        null,

      assessmentTrend:
        [],

      students:
        [],

      categories:
        [],

      distribution:
        [],

      overall:
        0,
    };
  }

  const statistics =
    buildAssessmentStatistics(
      report,
      course.id
    ).filter(
      (
        item
      ) =>
        item.average !=
        null
    );

  const assessmentTrend =
    statistics.map(
      (
        item,
        index
      ) => ({
        ...item,

        label:
          item.date
            ? formatShortDate(
                item.date
              )
            : `A${index + 1}`,

        change:
          index ===
          0
            ? null
            : round(
                item.average -
                  statistics[
                    index -
                      1
                  ]
                    .average
              ),
      })
    );

  const students =
    [];

  for (
    const student
    of report?.rows ||
    []
  ) {
    const studentCourse =
      (
        student.courses ||
        []
      ).find(
        (
          item
        ) =>
          item.course_assignment_id ===
          course.id
      );

    if (
      !studentCourse
    ) {
      continue;
    }

    const totals =
      getCourseRecordedTotals(
        studentCourse
      );

    students.push({
      name:
        student.student
          ?.full_name ||
        "Student",

      fullName:
        student.student
          ?.full_name ||
        "Student",

      percentage:
        totals.percentage,
    });
  }

  students.sort(
    (
      a,
      b
    ) =>
      (
        b.percentage ??
        -1
      ) -
      (
        a.percentage ??
        -1
      )
  );

  const categoryMap =
    new Map();

  for (
    const student
    of report?.rows ||
    []
  ) {
    const studentCourse =
      (
        student.courses ||
        []
      ).find(
        (
          item
        ) =>
          item.course_assignment_id ===
          course.id
      );

    if (
      !studentCourse
    ) {
      continue;
    }

    for (
      const component
      of studentCourse.components ||
      []
    ) {
      if (
        component.marks_obtained ==
        null
      ) {
        continue;
      }

      const name =
        categoryLabel(
          component.category
        );

      if (
        !categoryMap.has(
          name
        )
      ) {
        categoryMap.set(
          name,
          {
            obtained:
              0,

            maximum:
              0,
          }
        );
      }

      const bucket =
        categoryMap.get(
          name
        );

      bucket.obtained +=
        number(
          component.marks_obtained
        );

      bucket.maximum +=
        number(
          component.max_marks
        );
    }
  }

  const categories =
    [
      ...categoryMap.entries(),
    ].map(
      ([
        name,
        values,
      ]) => ({
        name,

        fullName:
          name,

        percentage:
          values.maximum >
          0
            ? round(
                (
                  values.obtained /
                  values.maximum
                ) *
                  100
              )
            : 0,
      })
    );

  const distribution = [
    {
      name:
        "80–100%",
      value:
        0,
    },

    {
      name:
        "70–79%",
      value:
        0,
    },

    {
      name:
        "60–69%",
      value:
        0,
    },

    {
      name:
        "50–59%",
      value:
        0,
    },

    {
      name:
        "Below 50%",
      value:
        0,
    },
  ];

  const validStudents =
    students.filter(
      (
        student
      ) =>
        student.percentage !=
        null
    );

  for (
    const student
    of validStudents
  ) {
    if (
      student.percentage >=
      80
    ) {
      distribution[
        0
      ].value +=
        1;
    } else if (
      student.percentage >=
      70
    ) {
      distribution[
        1
      ].value +=
        1;
    } else if (
      student.percentage >=
      60
    ) {
      distribution[
        2
      ].value +=
        1;
    } else if (
      student.percentage >=
      50
    ) {
      distribution[
        3
      ].value +=
        1;
    } else {
      distribution[
        4
      ].value +=
        1;
    }
  }

  const overall =
    validStudents.length
      ? round(
          validStudents.reduce(
            (
              sum,
              student
            ) =>
              sum +
              student.percentage,
            0
          ) /
            validStudents.length
        )
      : 0;

  return {
    course,
    assessmentTrend,
    students,
    categories,

    distribution:
      distribution.filter(
        (
          item
        ) =>
          item.value >
          0
      ),

    overall,
  };
};

// ======================================================
// STUDENT ANALYTICS
// ======================================================

const buildStudentAnalytics = (
  report
) => {
  const studentRow =
    report?.rows?.[0];

  if (!studentRow) {
    return {
      studentRow: null,
      timeline: [],
      categories: [],
      completion: [],
      overall: 0,
      biggestRise: null,
      biggestDrop: null,
    };
  }

  // ----------------------------------------------------
  // CHRONOLOGICAL EVENTS
  // ----------------------------------------------------

  const events = [];

  for (
    const course
    of studentRow.courses || []
  ) {
    for (
      const component
      of course.components || []
    ) {
      if (
        component.marks_obtained ==
          null ||
        number(
          component.max_marks
        ) <= 0
      ) {
        continue;
      }

      events.push({
        id:
          component.id,

        name:
          component.name ||
          "Assessment",

        fullName:
          component.name ||
          "Assessment",

        category:
          categoryLabel(
            component.category
          ),

        courseName:
          course.course?.name ||
          "Course",

        date:
          componentDate(
            component
          ),

        marks:
          number(
            component.marks_obtained
          ),

        maxMarks:
          number(
            component.max_marks
          ),

        assessmentScore:
          percent(
            component.marks_obtained,
            component.max_marks
          ),
      });
    }
  }

  events.sort(
    (a, b) =>
      timestamp(
        a.date
      ) -
      timestamp(
        b.date
      )
  );

  // ----------------------------------------------------
  // CUMULATIVE OVERALL
  // ----------------------------------------------------

  let cumulativeObtained = 0;
  let cumulativeMaximum = 0;
  let previousOverall = null;

  const timeline =
    events.map(
      (
        event,
        index
      ) => {
        cumulativeObtained +=
          event.marks;

        cumulativeMaximum +=
          event.maxMarks;

        const overall =
          round(
            (
              cumulativeObtained /
              cumulativeMaximum
            ) *
              100
          );

        const change =
          previousOverall == null
            ? null
            : round(
                overall -
                  previousOverall
              );

        previousOverall =
          overall;

        return {
          ...event,

          sequence:
            index + 1,

          shortLabel:
            `A${index + 1}`,

          overall,

          change,
        };
      }
    );

  // ----------------------------------------------------
  // ASSESSMENT TYPE PERFORMANCE
  // ----------------------------------------------------

  const categoryMap =
    new Map();

  let recorded = 0;
  let pending = 0;

  for (
    const course
    of studentRow.courses || []
  ) {
    for (
      const component
      of course.components || []
    ) {
      if (
        component.marks_obtained ==
        null
      ) {
        pending += 1;
        continue;
      }

      recorded += 1;

      const obtained =
        number(
          component.marks_obtained
        );

      const maximum =
        number(
          component.max_marks
        );

      const category =
        categoryLabel(
          component.category
        );

      if (
        !categoryMap.has(
          category
        )
      ) {
        categoryMap.set(
          category,
          {
            obtained: 0,
            maximum: 0,
          }
        );
      }

      const categoryBucket =
        categoryMap.get(
          category
        );

      categoryBucket.obtained +=
        obtained;

      categoryBucket.maximum +=
        maximum;
    }
  }

  const categories =
    [
      ...categoryMap.entries(),
    ]
      .filter(
        ([
          ,
          values,
        ]) =>
          values.maximum > 0
      )
      .map(
        ([
          name,
          values,
        ]) => ({
          name,
          fullName: name,

          percentage:
            round(
              (
                values.obtained /
                values.maximum
              ) *
                100
            ),
        })
      );

  // ----------------------------------------------------
  // BIGGEST RISE / DROP
  // ----------------------------------------------------

  const changes =
    timeline.filter(
      (item) =>
        item.change != null
    );

  let biggestRise = null;
  let biggestDrop = null;

  for (
    const item
    of changes
  ) {
    if (
      item.change > 0 &&
      (
        !biggestRise ||
        item.change >
          biggestRise.change
      )
    ) {
      biggestRise = item;
    }

    if (
      item.change < 0 &&
      (
        !biggestDrop ||
        item.change <
          biggestDrop.change
      )
    ) {
      biggestDrop = item;
    }
  }

  return {
    studentRow,
    timeline,
    categories,

    completion: [
      {
        name:
          "Recorded",
        value:
          recorded,
      },

      {
        name:
          "Pending",
        value:
          pending,
      },
    ],

    overall:
      timeline.length
        ? timeline[
            timeline.length - 1
          ].overall
        : 0,

    biggestRise,
    biggestDrop,
  };
};

// ======================================================
// TREND DOT
// ======================================================

function TrendDot({
  cx,
  cy,
  payload,
}) {
  if (
    cx == null ||
    cy == null
  ) {
    return null;
  }

  let fill =
    COLORS.indigo;

  if (
    payload?.change > 0
  ) {
    fill =
      COLORS.emerald;
  }

  if (
    payload?.change < 0
  ) {
    fill =
      COLORS.rose;
  }

  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      fill={fill}
      stroke="#ffffff"
      strokeWidth={2.5}
    />
  );
}

// ======================================================
// SEMESTER GRAPHS
// ======================================================

function SemesterAnalytics({
  analytics,
}) {
  return (
    <div className="space-y-4">
      {/* ================================================= */}
      {/* FULL WIDTH PERFORMANCE TREND */}
      {/* ================================================= */}

      <ChartCard
        title="Semester Performance Trend"
        subtitle="Class average across assessments with a running semester average."
        badge="Chronological"
        height={410}
      >
        {analytics.timeline.length ? (
          <ResponsiveContainer
            width="100%"
            height="100%"
          >
            <ComposedChart
              data={
                analytics.timeline
              }
              margin={{
                top: 15,
                right: 30,
                left: 0,
                bottom: 25,
              }}
            >
              <defs>
                <linearGradient
                  id="semesterArea"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor={
                      COLORS.blue
                    }
                    stopOpacity={0.26}
                  />

                  <stop
                    offset="55%"
                    stopColor={
                      COLORS.blue
                    }
                    stopOpacity={0.09}
                  />

                  <stop
                    offset="100%"
                    stopColor={
                      COLORS.blue
                    }
                    stopOpacity={0.01}
                  />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="4 4"
                vertical={false}
                stroke="#CBD5E1"
                opacity={0.35}
              />

              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                minTickGap={25}
                tick={{
                  fontSize: 11,
                  fill:
                    "#64748B",
                }}
              />

              <YAxis
                domain={[
                  0,
                  100,
                ]}
                axisLine={false}
                tickLine={false}
                width={48}
                tickFormatter={(
                  value
                ) =>
                  `${value}%`
                }
                tick={{
                  fontSize: 11,
                  fill:
                    "#64748B",
                }}
              />

              <Tooltip
                cursor={false}
                content={
                  <ProfessionalTooltip />
                }
              />

              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                wrapperStyle={{
                  paddingBottom: 18,
                  fontSize: 11,
                }}
              />

              <Area
                type="monotone"
                dataKey="average"
                name="Assessment Average"
                stroke={
                  COLORS.blue
                }
                strokeWidth={2.5}
                fill="url(#semesterArea)"
                dot={{
                  r: 4,
                  fill:
                    COLORS.blue,
                  stroke:
                    "#ffffff",
                  strokeWidth: 2,
                }}
                activeDot={{
                  r: 6,
                  fill:
                    COLORS.blue,
                  stroke:
                    "#ffffff",
                  strokeWidth: 2,
                }}
              />

              <Line
                type="monotone"
                dataKey="runningAverage"
                name="Running Average"
                stroke={
                  COLORS.violet
                }
                strokeWidth={3}
                dot={{
                  r: 4,
                  fill:
                    COLORS.violet,
                  stroke:
                    "#ffffff",
                  strokeWidth: 2,
                }}
                activeDot={{
                  r: 6,
                  stroke:
                    "#ffffff",
                  strokeWidth: 2,
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart />
        )}
      </ChartCard>

      {/* ================================================= */}
      {/* SECOND ROW */}
      {/* ================================================= */}

      <div
        className="
          grid
          grid-cols-1
          gap-4
          xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.75fr)]
        "
      >
        {/* COURSE PERFORMANCE */}

        <ChartCard
          title="Course Performance Comparison"
          subtitle="Overall recorded performance of each course in this semester."
          badge="Courses"
          height={350}
        >
          {analytics.courses.length ? (
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <BarChart
                data={
                  analytics.courses
                }
                layout="vertical"
                margin={{
                  top: 5,
                  right: 35,
                  left: 30,
                  bottom: 5,
                }}
              >
                <defs>
                  <linearGradient
                    id="semesterCourseBar"
                    x1="0"
                    y1="0"
                    x2="1"
                    y2="0"
                  >
                    <stop
                      offset="0%"
                      stopColor={
                        COLORS.indigo
                      }
                    />

                    <stop
                      offset="55%"
                      stopColor={
                        COLORS.blue
                      }
                    />

                    <stop
                      offset="100%"
                      stopColor={
                        COLORS.cyan
                      }
                    />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  strokeDasharray="4 4"
                  horizontal={false}
                  stroke="#CBD5E1"
                  opacity={0.35}
                />

                <XAxis
                  type="number"
                  domain={[
                    0,
                    100,
                  ]}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(
                    value
                  ) =>
                    `${value}%`
                  }
                  tick={{
                    fontSize: 11,
                    fill:
                      "#64748B",
                  }}
                />

                <YAxis
                  type="category"
                  dataKey="name"
                  width={130}
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fontSize: 11,
                    fill:
                      "#64748B",
                  }}
                />

                <Tooltip
                  cursor={false}
                  content={
                    <ProfessionalTooltip />
                  }
                />

                <Bar
                  dataKey="percentage"
                  name="Performance"
                  fill="url(#semesterCourseBar)"
                  radius={[
                    0,
                    8,
                    8,
                    0,
                  ]}
                  maxBarSize={30}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>

        {/* COMPACT DISTRIBUTION */}

        <ChartCard
          title="Student Performance Distribution"
          subtitle="Students grouped by their current semester performance."
          badge="Students"
          height={350}
        >
          {analytics.distribution.length ? (
            <div
              className="
                flex
                h-full
                min-h-0
                flex-col
              "
            >
              <div
                className="
                  min-h-0
                  flex-1
                "
              >
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <PieChart>
                    <Pie
                      data={
                        analytics.distribution
                      }
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="46%"
                      innerRadius={54}
                      outerRadius={82}
                      paddingAngle={3}
                      strokeWidth={0}
                    >
                      {analytics.distribution.map(
                        (
                          item,
                          index
                        ) => (
                          <Cell
                            key={
                              item.name
                            }
                            fill={
                              CHART_COLORS[
                                index %
                                  CHART_COLORS.length
                              ]
                            }
                          />
                        )
                      )}
                    </Pie>

                    <Tooltip
                      cursor={false}
                      content={({
                        active,
                        payload,
                      }) => {
                        if (
                          !active ||
                          !payload?.length
                        ) {
                          return null;
                        }

                        const data =
                          payload[0]
                            ?.payload;

                        if (!data) {
                          return null;
                        }

                        return (
                          <div
                            className="
                              rounded-xl
                              border
                              border-slate-200
                              bg-white
                              px-3
                              py-2.5
                              text-xs
                              shadow-xl
                              dark:border-slate-700
                              dark:bg-slate-900
                            "
                          >
                            <p
                              className="
                                font-semibold
                                text-slate-800
                                dark:text-white
                              "
                            >
                              {
                                data.name
                              }
                            </p>

                            <p
                              className="
                                mt-1
                                text-slate-500
                                dark:text-slate-400
                              "
                            >
                              Students:{" "}

                              <span
                                className="
                                  font-bold
                                  text-slate-800
                                  dark:text-white
                                "
                              >
                                {
                                  data.value
                                }
                              </span>
                            </p>
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div
                className="
                  flex
                  flex-wrap
                  items-center
                  justify-center
                  gap-x-4
                  gap-y-2
                  px-2
                  pb-2
                "
              >
                {analytics.distribution.map(
                  (
                    item,
                    index
                  ) => (
                    <div
                      key={
                        item.name
                      }
                      className="
                        flex
                        items-center
                        gap-1.5
                        text-[10px]
                        text-slate-500
                        dark:text-slate-400
                      "
                    >
                      <span
                        className="
                          h-2.5
                          w-2.5
                          rounded-full
                        "
                        style={{
                          backgroundColor:
                            CHART_COLORS[
                              index %
                                CHART_COLORS.length
                            ],
                        }}
                      />

                      <span>
                        {item.name}
                      </span>

                      <span
                        className="
                          font-bold
                          text-slate-700
                          dark:text-slate-200
                        "
                      >
                        {item.value}
                      </span>
                    </div>
                  )
                )}
              </div>
            </div>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>
      </div>
    </div>
  );
}
// ======================================================
// COURSE GRAPHS
// ======================================================

function CourseAnalytics({
  analytics,
}) {
  const ranked =
    analytics.students
      .filter(
        (student) =>
          student.percentage != null
      )
      .slice(
        0,
        15
      );

  return (
    <div
      className="
        grid
        grid-cols-1
        gap-4
        xl:grid-cols-2
      "
    >
      {/* COURSE TREND */}

      <ChartCard
        title="Course Assessment Trend"
        subtitle="Class average with highest and lowest performance for each assessment."
        badge={
          analytics.course
            ?.course
            ?.course_code ||
          "Course"
        }
        height={390}
      >
        {analytics.assessmentTrend
          .length ? (
          <ResponsiveContainer
            width="100%"
            height="100%"
          >
            <ComposedChart
              data={
                analytics.assessmentTrend
              }
              margin={{
                top: 10,
                right: 20,
                left: -8,
                bottom: 25,
              }}
            >
              <defs>
                <linearGradient
                  id="courseTrendArea"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor={
                      COLORS.emerald
                    }
                    stopOpacity={0.25}
                  />

                  <stop
                    offset="100%"
                    stopColor={
                      COLORS.emerald
                    }
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="4 4"
                vertical={false}
                stroke="#CBD5E1"
                opacity={0.45}
              />

              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{
                  fontSize: 11,
                  fill:
                    "#64748B",
                }}
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
                axisLine={false}
                tickLine={false}
              />

              <Tooltip
                cursor={false}
                content={
                  <ProfessionalTooltip />
                }
              />

              <Legend />

              <Area
                type="monotone"
                dataKey="average"
                name="Class Average"
                fill="url(#courseTrendArea)"
                stroke={
                  COLORS.emerald
                }
                strokeWidth={3}
              />

              <Line
                type="monotone"
                dataKey="highest"
                name="Highest"
                stroke={
                  COLORS.blue
                }
                strokeWidth={1.8}
                strokeDasharray="6 4"
                dot={false}
              />

              <Line
                type="monotone"
                dataKey="lowest"
                name="Lowest"
                stroke={
                  COLORS.rose
                }
                strokeWidth={1.8}
                strokeDasharray="6 4"
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart />
        )}
      </ChartCard>

      {/* STUDENT RANKING */}

      <ChartCard
        title="Student Performance Ranking"
        subtitle="Highest performing students in the selected course."
        badge={`${ranked.length} shown`}
        height={390}
      >
        {ranked.length ? (
          <ResponsiveContainer
            width="100%"
            height="100%"
          >
            <BarChart
              data={ranked}
              layout="vertical"
              margin={{
                top: 5,
                right: 25,
                left: 35,
                bottom: 5,
              }}
            >
              <defs>
                <linearGradient
                  id="rankingBar"
                  x1="0"
                  y1="0"
                  x2="1"
                  y2="0"
                >
                  <stop
                    offset="0%"
                    stopColor={
                      COLORS.blue
                    }
                  />

                  <stop
                    offset="100%"
                    stopColor={
                      COLORS.violet
                    }
                  />
                </linearGradient>
              </defs>

              <CartesianGrid
                horizontal={false}
                strokeDasharray="4 4"
                stroke="#CBD5E1"
                opacity={0.45}
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
                axisLine={false}
                tickLine={false}
              />

              <YAxis
                type="category"
                dataKey="name"
                width={115}
                tick={{
                  fontSize: 11,
                  fill:
                    "#64748B",
                }}
                axisLine={false}
                tickLine={false}
              />

              <Tooltip
                cursor={false}
                content={
                  <ProfessionalTooltip />
                }
              />

              <Bar
                dataKey="percentage"
                name="Performance"
                fill="url(#rankingBar)"
                radius={[
                  0,
                  8,
                  8,
                  0,
                ]}
                maxBarSize={24}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart />
        )}
      </ChartCard>

      {/* CATEGORY */}

      <ChartCard
        title="Assessment Category Performance"
        subtitle="Separate performance comparison for quizzes, assignments and mids."
        badge="Assessment Types"
        height={360}
      >
        {analytics.categories
          .length ? (
          <ResponsiveContainer
            width="100%"
            height="100%"
          >
            <BarChart
              data={
                analytics.categories
              }
              margin={{
                top: 15,
                right: 20,
                left: -10,
                bottom: 10,
              }}
            >
              <CartesianGrid
                vertical={false}
                strokeDasharray="4 4"
                stroke="#CBD5E1"
                opacity={0.45}
              />

              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
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
                axisLine={false}
                tickLine={false}
              />

              <Tooltip
                cursor={false}
                content={
                  <ProfessionalTooltip />
                }
              />

              <Bar
                dataKey="percentage"
                name="Performance"
                radius={[
                  9,
                  9,
                  0,
                  0,
                ]}
                maxBarSize={55}
              >
                {analytics.categories.map(
                  (
                    item,
                    index
                  ) => (
                    <Cell
                      key={
                        item.name
                      }
                      fill={
                        CHART_COLORS[
                          index %
                            CHART_COLORS.length
                        ]
                      }
                    />
                  )
                )}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart />
        )}
      </ChartCard>

      {/* DISTRIBUTION */}

      <ChartCard
        title="Course Score Distribution"
        subtitle="Students grouped by their overall recorded course performance."
        badge="Distribution"
        height={360}
      >
        {analytics.distribution
          .length ? (
          <ResponsiveContainer
            width="100%"
            height="100%"
          >
            <PieChart>
              <Pie
                data={
                  analytics.distribution
                }
                dataKey="value"
                nameKey="name"
                innerRadius={70}
                outerRadius={106}
                paddingAngle={3}
                strokeWidth={0}
              >
                {analytics.distribution.map(
                  (
                    item,
                    index
                  ) => (
                    <Cell
                      key={
                        item.name
                      }
                      fill={
                        CHART_COLORS[
                          index %
                            CHART_COLORS.length
                        ]
                      }
                    />
                  )
                )}
              </Pie>

              <Tooltip
                cursor={false}
              />

              <Legend
                verticalAlign="bottom"
                iconType="circle"
                wrapperStyle={{
                  fontSize: 11,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart />
        )}
      </ChartCard>
    </div>
  );
}

// ======================================================
// STUDENT GRAPHS
// ======================================================

function StudentAnalytics({
  analytics,
}) {
  return (
    <div className="space-y-4">
      {/* SUMMARY */}

      <div
        className="
          grid
          grid-cols-1
          gap-3
          md:grid-cols-3
        "
      >
        <StatCard
          icon={
            TrendingUp
          }
          label="Current Overall"
          value={`${analytics.overall}%`}
          description="Weighted cumulative performance from recorded assessments."
          accent="blue"
        />

        <StatCard
          icon={
            TrendingUp
          }
          label="Biggest Improvement"
          value={
            analytics.biggestRise
              ? `+${analytics.biggestRise.change}%`
              : "—"
          }
          description={
            analytics.biggestRise
              ? `${analytics.biggestRise.courseName} · ${analytics.biggestRise.name}`
              : "No improvement point available yet."
          }
          accent="emerald"
        />

        <StatCard
          icon={
            TrendingDown
          }
          label="Biggest Decline"
          value={
            analytics.biggestDrop
              ? `${analytics.biggestDrop.change}%`
              : "—"
          }
          description={
            analytics.biggestDrop
              ? `${analytics.biggestDrop.courseName} · ${analytics.biggestDrop.name}`
              : "No decline point available yet."
          }
          accent="rose"
        />
      </div>

      <div
        className="
          grid
          grid-cols-1
          gap-4
          xl:grid-cols-2
        "
      >
        {/* OVERALL PROGRESS */}

        <ChartCard
          title="Overall Student Progress Timeline"
          subtitle="Blue area shows individual assessment score. Purple line shows cumulative overall progress. Green and red points show improvement or decline."
          badge="Progress Over Time"
          height={430}
          className="xl:col-span-2"
        >
          {analytics.timeline
            .length ? (
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <ComposedChart
                data={
                  analytics.timeline
                }
                margin={{
                  top: 10,
                  right: 25,
                  left: -5,
                  bottom: 35,
                }}
              >
                <defs>
                  <linearGradient
                    id="studentAssessmentArea"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor={
                        COLORS.blue
                      }
                      stopOpacity={
                        0.28
                      }
                    />

                    <stop
                      offset="100%"
                      stopColor={
                        COLORS.blue
                      }
                      stopOpacity={
                        0.01
                      }
                    />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  vertical={false}
                  strokeDasharray="4 4"
                  stroke="#CBD5E1"
                  opacity={0.5}
                />

                <XAxis
                  dataKey="shortLabel"
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fontSize: 11,
                    fill:
                      "#64748B",
                  }}
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
                  axisLine={false}
                  tickLine={false}
                />

                <Tooltip
                  cursor={false}
                  content={
                    <ProfessionalTooltip />
                  }
                />

                <Legend />

                <Area
                  type="monotone"
                  dataKey="assessmentScore"
                  name="Assessment Score"
                  fill="url(#studentAssessmentArea)"
                  stroke={
                    COLORS.blue
                  }
                  strokeWidth={2}
                />

                <Line
                  type="monotone"
                  dataKey="overall"
                  name="Cumulative Overall"
                  stroke={
                    COLORS.violet
                  }
                  strokeWidth={3.5}
                  dot={
                    <TrendDot />
                  }
                  activeDot={{
                    r: 7,
                    stroke:
                      "#ffffff",
                    strokeWidth: 3,
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart text="No recorded assessment marks are available for this student." />
          )}
        </ChartCard>

        {/* ASSESSMENT TYPE */}

        <ChartCard
          title="Assessment Type Performance"
          subtitle="Student performance separately in Quiz, Assignment, Mid and Final."
          badge="Assessment Types"
          height={370}
        >
          {analytics.categories
            .length ? (
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <BarChart
                data={
                  analytics.categories
                }
                margin={{
                  top: 15,
                  right: 20,
                  left: -10,
                  bottom: 5,
                }}
              >
                <CartesianGrid
                  vertical={false}
                  strokeDasharray="4 4"
                  stroke="#CBD5E1"
                  opacity={0.45}
                />

                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
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
                  axisLine={false}
                  tickLine={false}
                />

                <Tooltip
                  cursor={false}
                  content={
                    <ProfessionalTooltip />
                  }
                />

                <Bar
                  dataKey="percentage"
                  name="Performance"
                  radius={[
                    10,
                    10,
                    0,
                    0,
                  ]}
                  maxBarSize={58}
                >
                  {analytics.categories.map(
                    (
                      item,
                      index
                    ) => (
                      <Cell
                        key={
                          item.name
                        }
                        fill={
                          CHART_COLORS[
                            index %
                              CHART_COLORS.length
                          ]
                        }
                      />
                    )
                  )}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>

        {/* MARKS COMPLETION */}

        <ChartCard
          title="Marks Completion"
          subtitle="How many assessment results have been recorded and how many are still pending."
          badge="Result Status"
          height={370}
        >
          {analytics.completion.some(
            (item) =>
              item.value > 0
          ) ? (
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <PieChart>
                <Pie
                  data={
                    analytics.completion
                  }
                  dataKey="value"
                  nameKey="name"
                  innerRadius={72}
                  outerRadius={108}
                  paddingAngle={4}
                  strokeWidth={0}
                >
                  <Cell
                    fill={
                      COLORS.emerald
                    }
                  />

                  <Cell
                    fill={
                      COLORS.amber
                    }
                  />
                </Pie>

                <Tooltip
                  cursor={false}
                />

                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>
      </div>
    </div>
  );
}

// ======================================================
// GROUPED RESULT MATRIX
//
// Course
//   -> Category
//      -> Assessment
// ======================================================

const CATEGORY_ORDER = {
  quiz: 1,
  assignment: 2,
  mid: 3,
  final: 4,
};

const buildReportMatrix = (
  report
) => {
  const courseGroups = [];

  for (
    const course
    of report?.courses || []
  ) {
    const categoryMap =
      new Map();

    for (
      const component
      of course.components || []
    ) {
      const category =
        component.category ||
        "other";

      if (
        !categoryMap.has(
          category
        )
      ) {
        categoryMap.set(
          category,
          []
        );
      }

      categoryMap
        .get(category)
        .push({
          id:
            component.id,

          name:
            component.name ||
            categoryLabel(
              category
            ),

          category,

          max_marks:
            component.max_marks,
        });
    }

    const categories = [
      ...categoryMap.entries(),
    ]
      .map(
        ([
          category,
          assessments,
        ]) => ({
          category,

          label:
            categoryGroupLabel(
              category
            ),

          assessments,

          columnCount:
            assessments.length,
        })
      )
      .sort(
        (a, b) =>
          (
            CATEGORY_ORDER[
              a.category
            ] ?? 99
          ) -
          (
            CATEGORY_ORDER[
              b.category
            ] ?? 99
          )
      );

    const totalColumns =
      categories.reduce(
        (
          sum,
          category
        ) =>
          sum +
          category.columnCount,
        0
      );

    if (!totalColumns) {
      continue;
    }

    courseGroups.push({
      id:
        course.id,

      courseName:
        course.course?.name ||
        "Course",

      courseCode:
        course.course
          ?.course_code ||
        "",

      categories,

      totalColumns,
    });
  }

  const rows =
    (
      report?.rows || []
    ).map(
      (
        studentRow
      ) => {
        const markMap =
          new Map();

        for (
          const course
          of studentRow.courses || []
        ) {
          for (
            const component
            of course.components || []
          ) {
            markMap.set(
              component.id,
              component
            );
          }
        }

        return {
          student:
            studentRow.student,

          markMap,

          totals:
            getStudentRecordedTotals(
              studentRow
            ),
        };
      }
    );

  return {
    courseGroups,
    rows,
  };
};

// ======================================================
// CSV EXPORT
// ======================================================

const csvEscape = (
  value
) => {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  const text =
    String(value);

  if (
    text.includes(",") ||
    text.includes('"') ||
    text.includes("\n")
  ) {
    return `"${text.replace(
      /"/g,
      '""'
    )}"`;
  }

  return text;
};

const exportGroupedCsv = (
  report,
  filename
) => {
  const matrix =
    buildReportMatrix(
      report
    );

  const header1 = [
    "Student Name",
    "Student ID",
  ];

  const header2 = [
    "",
    "",
  ];

  const header3 = [
    "",
    "",
  ];

  for (
    const course
    of matrix.courseGroups
  ) {
    let firstCourseCell =
      true;

    for (
      const category
      of course.categories
    ) {
      let firstCategoryCell =
        true;

      for (
        const assessment
        of category.assessments
      ) {
        header1.push(
          firstCourseCell
            ? course.courseCode
              ? `${course.courseName} (${course.courseCode})`
              : course.courseName
            : ""
        );

        header2.push(
          firstCategoryCell
            ? category.label
            : ""
        );

        header3.push(
          assessment.name
        );

        firstCourseCell =
          false;

        firstCategoryCell =
          false;
      }
    }
  }

  header1.push(
    "Overall",
    "Pending"
  );

  header2.push(
    "",
    ""
  );

  header3.push(
    "",
    ""
  );

  const csvRows = [
    header1,
    header2,
    header3,
  ];

  for (
    const row
    of matrix.rows
  ) {
    const output = [
      row.student
        ?.full_name ||
        "",

      row.student
        ?.student_id ||
        "",
    ];

    for (
      const course
      of matrix.courseGroups
    ) {
      for (
        const category
        of course.categories
      ) {
        for (
          const assessment
          of category.assessments
        ) {
          const component =
            row.markMap.get(
              assessment.id
            );

          if (
            component?.marks_obtained !=
            null
          ) {
            output.push(
              `${component.marks_obtained}/${component.max_marks}`
            );
          } else {
            output.push(
              "Pending"
            );
          }
        }
      }
    }

    output.push(
      row.totals.maximum > 0
        ? `${row.totals.obtained}/${row.totals.maximum} (${row.totals.percentage}%)`
        : "—",

      row.totals.pending
    );

    csvRows.push(output);
  }

  const csv =
    csvRows
      .map((row) =>
        row
          .map(csvEscape)
          .join(",")
      )
      .join("\n");

  const blob =
    new Blob(
      [
        "\uFEFF",
        csv,
      ],
      {
        type:
          "text/csv;charset=utf-8;",
      }
    );

  const url =
    URL.createObjectURL(
      blob
    );

  const link =
    document.createElement(
      "a"
    );

  link.href = url;

  link.download =
    `${safeFilename(
      filename
    )}.csv`;

  document.body.appendChild(
    link
  );

  link.click();

  document.body.removeChild(
    link
  );

  URL.revokeObjectURL(
    url
  );
};

// ======================================================
// DETAILED EXPORT DATA
// ======================================================

const detailedReportRows = (
  report
) => {
  const rows = [];

  for (
    const student
    of report?.rows || []
  ) {
    for (
      const course
      of student.courses || []
    ) {
      for (
        const component
        of course.components || []
      ) {
        rows.push({
          "Student Name":
            student.student
              ?.full_name ||
            "",

          "Student ID":
            student.student
              ?.student_id ||
            "",

          Course:
            course.course?.name ||
            "",

          "Course Code":
            course.course
              ?.course_code ||
            "",

          Teacher:
            course.teacher
              ?.full_name ||
            "",

          Assessment:
            component.name,

          Type:
            categoryLabel(
              component.category
            ),

          "Obtained Marks":
            component.marks_obtained ??
            "",

          "Maximum Marks":
            component.max_marks,

          Percentage:
            component.marks_obtained ==
            null
              ? ""
              : percent(
                  component.marks_obtained,
                  component.max_marks
                ),

          Status:
            component.marks_obtained ==
            null
              ? "Pending"
              : component.approval_status ||
                "Recorded",

          "Mark Source":
            component.mark_source ||
            component.data_source ||
            "",

          "Availability Start":
            component.schedule_item
              ?.starts_at ||
            "",

          "Availability End":
            component.schedule_item
              ?.ends_at ||
            "",

          "Conduct Start":
            component.schedule_item
              ?.conduct_starts_at ||
            "",

          "Conduct End":
            component.schedule_item
              ?.conduct_ends_at ||
            "",

          "Updated At":
            component.mark_updated_at ||
            "",
        });
      }
    }
  }

  return rows;
};

// ======================================================
// GROUPED EXCEL EXPORT
// ======================================================

const exportExcel = (
  report,
  filename
) => {
  const matrix =
    buildReportMatrix(
      report
    );

  const header1 = [];
  const header2 = [];
  const header3 = [];

  const merges = [];

  // ----------------------------------------------------
  // FIXED STUDENT COLUMNS
  // ----------------------------------------------------

  const fixedHeaders = [
    "Student Name",
    "Student ID",
  ];

  fixedHeaders.forEach(
    (
      label,
      index
    ) => {
      header1[index] =
        label;

      header2[index] =
        "";

      header3[index] =
        "";

      merges.push({
        s: {
          r: 0,
          c: index,
        },

        e: {
          r: 2,
          c: index,
        },
      });
    }
  );

  let columnIndex =
    fixedHeaders.length;

  // ----------------------------------------------------
  // COURSE -> CATEGORY -> ASSESSMENT
  // ----------------------------------------------------

  for (
    const course
    of matrix.courseGroups
  ) {
    const courseStart =
      columnIndex;

    for (
      const category
      of course.categories
    ) {
      const categoryStart =
        columnIndex;

      for (
        const assessment
        of category.assessments
      ) {
        header1[
          columnIndex
        ] = "";

        header2[
          columnIndex
        ] = "";

        header3[
          columnIndex
        ] =
          assessment.name;

        columnIndex += 1;
      }

      const categoryEnd =
        columnIndex - 1;

      header2[
        categoryStart
      ] =
        category.label;

      if (
        categoryEnd >
        categoryStart
      ) {
        merges.push({
          s: {
            r: 1,
            c:
              categoryStart,
          },

          e: {
            r: 1,
            c:
              categoryEnd,
          },
        });
      }
    }

    const courseEnd =
      columnIndex - 1;

    header1[
      courseStart
    ] =
      course.courseCode
        ? `${course.courseName} (${course.courseCode})`
        : course.courseName;

    if (
      courseEnd >
      courseStart
    ) {
      merges.push({
        s: {
          r: 0,
          c:
            courseStart,
        },

        e: {
          r: 0,
          c:
            courseEnd,
        },
      });
    }
  }

  // ----------------------------------------------------
  // OVERALL
  // ----------------------------------------------------

  const overallColumn =
    columnIndex;

  header1[
    overallColumn
  ] = "Overall";

  header2[
    overallColumn
  ] = "";

  header3[
    overallColumn
  ] = "";

  merges.push({
    s: {
      r: 0,
      c:
        overallColumn,
    },

    e: {
      r: 2,
      c:
        overallColumn,
    },
  });

  columnIndex += 1;

  // ----------------------------------------------------
  // PENDING
  // ----------------------------------------------------

  const pendingColumn =
    columnIndex;

  header1[
    pendingColumn
  ] = "Pending";

  header2[
    pendingColumn
  ] = "";

  header3[
    pendingColumn
  ] = "";

  merges.push({
    s: {
      r: 0,
      c:
        pendingColumn,
    },

    e: {
      r: 2,
      c:
        pendingColumn,
    },
  });

  // ----------------------------------------------------
  // DATA
  // ----------------------------------------------------

  const dataRows =
    matrix.rows.map(
      (row) => {
        const output = [
          row.student
            ?.full_name ||
            "",

          row.student
            ?.student_id ||
            "",
        ];

        for (
          const course
          of matrix.courseGroups
        ) {
          for (
            const category
            of course.categories
          ) {
            for (
              const assessment
              of category.assessments
            ) {
              const component =
                row.markMap.get(
                  assessment.id
                );

              if (
                component?.marks_obtained !=
                null
              ) {
                output.push(
                  `${component.marks_obtained}/${component.max_marks}`
                );
              } else {
                output.push(
                  "Pending"
                );
              }
            }
          }
        }

        output.push(
          row.totals.maximum > 0
            ? `${row.totals.obtained}/${row.totals.maximum} (${row.totals.percentage}%)`
            : "—"
        );

        output.push(
          row.totals.pending
        );

        return output;
      }
    );

  const worksheet =
    XLSX.utils.aoa_to_sheet([
      header1,
      header2,
      header3,
      ...dataRows,
    ]);

  worksheet["!merges"] =
    merges;

  const widths = [
    {
      wch: 24,
    },

    {
      wch: 16,
    },
  ];

  for (
    const course
    of matrix.courseGroups
  ) {
    for (
      const category
      of course.categories
    ) {
      for (
        const assessment
        of category.assessments
      ) {
        widths.push({
          wch:
            Math.min(
              24,
              Math.max(
                13,
                String(
                  assessment.name ||
                    ""
                ).length +
                  3
              )
            ),
        });
      }
    }
  }

  widths.push(
    {
      wch: 20,
    },
    {
      wch: 12,
    }
  );

  worksheet["!cols"] =
    widths;

  worksheet["!rows"] = [
    {
      hpt: 28,
    },
    {
      hpt: 24,
    },
    {
      hpt: 30,
    },
  ];

  const detailed =
    detailedReportRows(
      report
    );

  const detailedSheet =
    XLSX.utils.json_to_sheet(
      detailed
    );

  detailedSheet[
    "!cols"
  ] =
    Array(18).fill({
      wch: 18,
    });

  const workbook =
    XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    "Result Matrix"
  );

  XLSX.utils.book_append_sheet(
    workbook,
    detailedSheet,
    "Detailed Marks"
  );

  XLSX.writeFile(
    workbook,
    `${safeFilename(
      filename
    )}.xlsx`
  );
};

// ======================================================
// GROUPED RESULT MATRIX UI
// ======================================================

function ResultMatrix({
  report,
}) {
  const matrix =
    buildReportMatrix(
      report
    );

  if (!matrix.rows.length) {
    return (
      <div
        className="
          rounded-2xl
          border
          border-slate-200
          bg-white
          p-12
          text-center
          text-sm
          text-slate-500
          shadow-sm
          dark:border-slate-800
          dark:bg-slate-900
          dark:text-slate-400
        "
      >
        No result records found.
      </div>
    );
  }

  return (
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
      <div
        className="
          border-b
          border-slate-100
          px-5
          py-4
          dark:border-slate-800
        "
      >
        <h3
          className="
            font-bold
            text-slate-900
            dark:text-white
          "
        >
          Result Matrix
        </h3>

        <p
          className="
            mt-1
            text-xs
            text-slate-500
            dark:text-slate-400
          "
        >
          Results are grouped by course and assessment
          type. Pending assessments are not treated as
          zero while calculating current performance.
        </p>
      </div>

      <div
        className="
          max-w-full
          overflow-x-auto
        "
      >
        <table
          className="
            min-w-max
            border-collapse
            text-left
            text-xs
          "
        >
          <thead>
            <tr
              className="
                bg-slate-100
                text-slate-700
                dark:bg-slate-800
                dark:text-slate-200
              "
            >
              <th
                rowSpan={3}
                className="
                  sticky
                  left-0
                  z-40
                  min-w-[210px]
                  border-r
                  border-b
                  border-slate-200
                  bg-slate-100
                  px-4
                  py-3
                  align-middle
                  font-bold
                  text-slate-800
                  dark:border-slate-700
                  dark:bg-slate-800
                  dark:text-white
                "
              >
                Student
              </th>

              {matrix.courseGroups.map(
                (course) => (
                  <th
                    key={
                      course.id
                    }
                    colSpan={
                      course.totalColumns
                    }
                    className="
                      border-r
                      border-b
                      border-slate-200
                      bg-slate-100
                      px-4
                      py-3
                      text-center
                      font-bold
                      text-slate-800
                      dark:border-slate-700
                      dark:bg-slate-800
                      dark:text-white
                    "
                  >
                    <div>
                      {
                        course.courseName
                      }
                    </div>

                    {course.courseCode ? (
                      <div
                        className="
                          mt-1
                          text-[10px]
                          font-medium
                          text-slate-500
                          dark:text-slate-400
                        "
                      >
                        {
                          course.courseCode
                        }
                      </div>
                    ) : null}
                  </th>
                )
              )}

              <th
                rowSpan={3}
                className="
                  min-w-[120px]
                  border-r
                  border-b
                  border-slate-200
                  bg-slate-100
                  px-4
                  py-3
                  text-center
                  align-middle
                  font-bold
                  text-slate-800
                  dark:border-slate-700
                  dark:bg-slate-800
                  dark:text-white
                "
              >
                Overall
              </th>

              <th
                rowSpan={3}
                className="
                  min-w-[90px]
                  border-b
                  border-slate-200
                  bg-slate-100
                  px-4
                  py-3
                  text-center
                  align-middle
                  font-bold
                  text-slate-800
                  dark:border-slate-700
                  dark:bg-slate-800
                  dark:text-white
                "
              >
                Pending
              </th>
            </tr>

            <tr
              className="
                bg-slate-50
                text-slate-600
                dark:bg-slate-800/95
                dark:text-slate-300
              "
            >
              {matrix.courseGroups.flatMap(
                (course) =>
                  course.categories.map(
                    (
                      category
                    ) => (
                      <th
                        key={`${course.id}-${category.category}`}
                        colSpan={
                          category.columnCount
                        }
                        className="
                          border-r
                          border-b
                          border-slate-200
                          bg-slate-50
                          px-3
                          py-2.5
                          text-center
                          text-[11px]
                          font-bold
                          uppercase
                          tracking-wide
                          text-slate-700
                          dark:border-slate-700
                          dark:bg-slate-800/95
                          dark:text-slate-300
                        "
                      >
                        {
                          category.label
                        }
                      </th>
                    )
                  )
              )}
            </tr>

            <tr
              className="
                bg-slate-50
                text-slate-500
                dark:bg-slate-800/90
                dark:text-slate-400
              "
            >
              {matrix.courseGroups.flatMap(
                (course) =>
                  course.categories.flatMap(
                    (category) =>
                      category.assessments.map(
                        (
                          assessment
                        ) => (
                          <th
                            key={`${course.id}-${category.category}-${assessment.id}`}
                            className="
                              min-w-[125px]
                              max-w-[180px]
                              border-r
                              border-b
                              border-slate-200
                              bg-slate-50
                              px-3
                              py-2.5
                              text-center
                              text-[10px]
                              font-semibold
                              text-slate-600
                              dark:border-slate-700
                              dark:bg-slate-800/90
                              dark:text-slate-400
                            "
                          >
                            <div
                              className="
                                whitespace-normal
                                leading-4
                              "
                            >
                              {
                                assessment.name
                              }
                            </div>

                            {assessment.max_marks !=
                            null ? (
                              <div
                                className="
                                  mt-1
                                  font-normal
                                  text-slate-500
                                  dark:text-slate-500
                                "
                              >
                                {
                                  assessment.max_marks
                                }{" "}
                                marks
                              </div>
                            ) : null}
                          </th>
                        )
                      )
                  )
              )}
            </tr>
          </thead>

          <tbody
            className="
              divide-y
              divide-slate-200
              dark:divide-slate-800
            "
          >
            {matrix.rows.map(
              (row) => (
                <tr
                  key={
                    row.student?.id
                  }
                  className="
                    bg-white
                    transition
                    hover:bg-slate-50
                    dark:bg-slate-900
                    dark:hover:bg-slate-800/40
                  "
                >
                  <td
                    className="
                      sticky
                      left-0
                      z-20
                      min-w-[210px]
                      border-r
                      border-slate-200
                      bg-white
                      px-4
                      py-3
                      dark:border-slate-800
                      dark:bg-slate-900
                    "
                  >
                    <p
                      className="
                        font-semibold
                        text-slate-900
                        dark:text-white
                      "
                    >
                      {row.student
                        ?.full_name ||
                        "Student"}
                    </p>

                    <p
                      className="
                        mt-0.5
                        text-[10px]
                        text-blue-600
                        dark:text-blue-400
                      "
                    >
                      {row.student
                        ?.student_id ||
                        row.student
                          ?.email ||
                        ""}
                    </p>
                  </td>

                  {matrix.courseGroups.flatMap(
                    (course) =>
                      course.categories.flatMap(
                        (category) =>
                          category.assessments.map(
                            (
                              assessment
                            ) => {
                              const component =
                                row.markMap.get(
                                  assessment.id
                                );

                              const hasMark =
                                component?.marks_obtained !=
                                null;

                              return (
                                <td
                                  key={`${row.student?.id}-${assessment.id}`}
                                  className="
                                    min-w-[125px]
                                    border-r
                                    border-slate-200
                                    px-3
                                    py-3
                                    text-center
                                    dark:border-slate-800
                                  "
                                >
                                  {hasMark ? (
                                    <div
                                      className="
                                        inline-flex
                                        items-center
                                        justify-center
                                        rounded-lg
                                        bg-emerald-100
                                        px-2.5
                                        py-1.5
                                        dark:bg-emerald-500/10
                                      "
                                    >
                                      <span
                                        className="
                                          font-bold
                                          text-emerald-700
                                          dark:text-emerald-300
                                        "
                                      >
                                        {
                                          component.marks_obtained
                                        }
                                        /
                                        {
                                          component.max_marks
                                        }
                                      </span>
                                    </div>
                                  ) : (
                                    <span
                                      className="
                                        inline-flex
                                        rounded-full
                                        bg-amber-100
                                        px-2.5
                                        py-1
                                        text-[10px]
                                        font-semibold
                                        text-amber-700
                                        dark:bg-amber-500/10
                                        dark:text-amber-400
                                      "
                                    >
                                      Pending
                                    </span>
                                  )}
                                </td>
                              );
                            }
                          )
                      )
                  )}

                  <td
                    className="
                      min-w-[120px]
                      border-r
                      border-slate-200
                      px-4
                      py-3
                      text-center
                      dark:border-slate-800
                    "
                  >
                    {row.totals.maximum >
                    0 ? (
                      <>
                        <p
                          className="
                            font-bold
                            text-slate-900
                            dark:text-white
                          "
                        >
                          {
                            row.totals
                              .obtained
                          }
                          /
                          {
                            row.totals
                              .maximum
                          }
                        </p>

                        <p
                          className="
                            mt-0.5
                            text-[10px]
                            font-semibold
                            text-blue-600
                            dark:text-blue-400
                          "
                        >
                          {
                            row.totals
                              .percentage
                          }
                          %
                        </p>
                      </>
                    ) : (
                      <span
                        className="
                          text-slate-400
                          dark:text-slate-500
                        "
                      >
                        —
                      </span>
                    )}
                  </td>

                  <td
                    className="
                      min-w-[90px]
                      px-4
                      py-3
                      text-center
                    "
                  >
                    {row.totals
                      .pending > 0 ? (
                      <span
                        className="
                          inline-flex
                          min-w-[28px]
                          items-center
                          justify-center
                          rounded-full
                          bg-amber-100
                          px-2
                          py-1
                          text-[10px]
                          font-bold
                          text-amber-700
                          dark:bg-amber-500/10
                          dark:text-amber-400
                        "
                      >
                        {
                          row.totals
                            .pending
                        }
                      </span>
                    ) : (
                      <span
                        className="
                          inline-flex
                          min-w-[28px]
                          items-center
                          justify-center
                          rounded-full
                          bg-emerald-100
                          px-2
                          py-1
                          text-[10px]
                          font-bold
                          text-emerald-700
                          dark:bg-emerald-500/10
                          dark:text-emerald-400
                        "
                      >
                        0
                      </span>
                    )}
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ======================================================
// STUDENT RESULT DETAILS
// ======================================================

function StudentResultDetails({
  row,
}) {
  const overall =
    getStudentRecordedTotals(
      row
    );

  return (
    <div className="space-y-4">
      <div
        className="
          rounded-2xl
          border
          border-slate-200
          bg-white
          p-5
          shadow-sm
          dark:border-slate-800
          dark:bg-slate-900
        "
      >
        <div
          className="
            flex
            flex-col
            gap-4
            sm:flex-row
            sm:items-center
            sm:justify-between
          "
        >
          <div>
            <p
              className="
                text-xs
                font-semibold
                uppercase
                tracking-wide
                text-slate-400
              "
            >
              Student
            </p>

            <h3
              className="
                mt-1
                text-lg
                font-bold
                text-slate-900
                dark:text-white
              "
            >
              {row.student
                ?.full_name}
            </h3>

            <p
              className="
                mt-1
                text-sm
                text-slate-500
              "
            >
              {row.student
                ?.student_id ||
                "No student ID"}
            </p>
          </div>

          <div
            className="
              rounded-xl
              bg-gradient-to-br
              from-blue-50
              to-violet-50
              px-5
              py-3
              text-right
              dark:from-blue-500/10
              dark:to-violet-500/10
            "
          >
            <p
              className="
                text-xs
                font-semibold
                uppercase
                text-blue-500
              "
            >
              Recorded Performance
            </p>

            <p
              className="
                mt-1
                text-2xl
                font-bold
                text-blue-700
                dark:text-blue-300
              "
            >
              {overall.percentage ==
              null
                ? "—"
                : `${overall.percentage}%`}
            </p>
          </div>
        </div>
      </div>

      {(row.courses || []).map(
        (course) => {
          const totals =
            getCourseRecordedTotals(
              course
            );

          return (
            <section
              key={
                course.course_assignment_id
              }
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
              <div
                className="
                  flex
                  flex-col
                  gap-3
                  border-b
                  border-slate-100
                  px-5
                  py-4
                  dark:border-slate-800
                  sm:flex-row
                  sm:items-center
                  sm:justify-between
                "
              >
                <div>
                  <h3
                    className="
                      font-bold
                      text-slate-900
                      dark:text-white
                    "
                  >
                    {course.course
                      ?.name}
                  </h3>

                  <p
                    className="
                      mt-1
                      text-xs
                      text-slate-500
                    "
                  >
                    {course.course
                      ?.course_code ||
                      ""}

                    {" · Teacher: "}

                    {course.teacher
                      ?.full_name ||
                      "—"}
                  </p>
                </div>

                <div
                  className="
                    rounded-lg
                    bg-slate-50
                    px-3
                    py-2
                    text-sm
                    font-bold
                    text-slate-700
                    dark:bg-slate-800
                    dark:text-slate-200
                  "
                >
                  {totals.maximum >
                  0
                    ? `${totals.obtained}/${totals.maximum} · ${totals.percentage}%`
                    : "No recorded marks"}
                </div>
              </div>

              <div
                className="
                  divide-y
                  divide-slate-100
                  dark:divide-slate-800
                "
              >
                {(course.components ||
                  []).map(
                  (
                    component
                  ) => (
                    <div
                      key={
                        component.id
                      }
                      className="
                        grid
                        grid-cols-1
                        gap-3
                        px-5
                        py-3
                        sm:grid-cols-[1.4fr_.8fr_.8fr]
                        sm:items-center
                      "
                    >
                      <div>
                        <p
                          className="
                            font-semibold
                            text-slate-800
                            dark:text-slate-100
                          "
                        >
                          {
                            component.name
                          }
                        </p>

                        <p
                          className="
                            text-xs
                            text-slate-400
                          "
                        >
                          {categoryLabel(
                            component.category
                          )}
                        </p>
                      </div>

                      <p
                        className="
                          text-sm
                          font-semibold
                          text-slate-600
                          dark:text-slate-300
                        "
                      >
                        {component.marks_obtained ==
                        null
                          ? "Pending"
                          : `${component.marks_obtained}/${component.max_marks}`}
                      </p>

                      <p
                        className="
                          text-xs
                          text-slate-400
                        "
                      >
                        {formatDateTime(
                          component.mark_updated_at ||
                            componentDate(
                              component
                            )
                        )}
                      </p>
                    </div>
                  )
                )}
              </div>
            </section>
          );
        }
      )}
    </div>
  );
}

// ======================================================
// MAIN PAGE
// ======================================================

function AssessmentReports() {
  const [
    filters,
    setFilters,
  ] = useState(
    emptyFilters
  );

  const [
    departments,
    setDepartments,
  ] = useState([]);

  const [
    programs,
    setPrograms,
  ] = useState([]);

  const [
    batches,
    setBatches,
  ] = useState([]);

  const [
    semesters,
    setSemesters,
  ] = useState([]);

  const [
    batchPrograms,
    setBatchPrograms,
  ] = useState([]);

  const [
    options,
    setOptions,
  ] = useState({
    courses: [],
    students: [],
  });

  const [
    report,
    setReport,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    loadingOptions,
    setLoadingOptions,
  ] = useState(false);

  const [
    liveRefreshing,
    setLiveRefreshing,
  ] = useState(false);

  const [
    lastUpdated,
    setLastUpdated,
  ] = useState(null);

  const [
    error,
    setError,
  ] = useState("");

  const refreshInFlight =
    useRef(false);

  // ====================================================
  // LOAD ACADEMIC MASTER DATA
  // ====================================================

  useEffect(() => {
    let active = true;

    const loadAcademicData = async () => {
      try {
        const [
          batchResponse,
          departmentResponse,
          programResponse,
          semesterResponse,
          mappingResponse,
        ] = await Promise.all([
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

        const batchData =
          unwrapApiData(batchResponse);

        const departmentData =
          unwrapApiData(
            departmentResponse
          );

        const programData =
          unwrapApiData(programResponse);

        const semesterData =
          unwrapApiData(semesterResponse);

        const mappingData =
          unwrapApiData(mappingResponse);

        setBatches(
          (Array.isArray(batchData)
            ? batchData
            : []
          ).filter(activeOnly)
        );

        setDepartments(
          (Array.isArray(
            departmentData
          )
            ? departmentData
            : []
          ).filter(activeOnly)
        );

        setPrograms(
          (Array.isArray(programData)
            ? programData
            : []
          ).filter(activeOnly)
        );

        setSemesters(
          (Array.isArray(semesterData)
            ? semesterData
            : []
          ).filter(activeOnly)
        );

        setBatchPrograms(
          (Array.isArray(mappingData)
            ? mappingData
            : []
          ).filter(activeOnly)
        );
      } catch (err) {
        if (!active) {
          return;
        }

        setError(
          err?.response?.data?.message ||
            err?.message ||
            "Unable to load Academic Structure"
        );
      }
    };

    loadAcademicData();

    return () => {
      active = false;
    };
  }, []);

  // ====================================================
  // FILTER UPDATE
  // ====================================================

  const update = (
    patch
  ) => {
    setFilters(
      (current) => ({
        ...current,
        ...patch,
      })
    );

    setReport(null);
    setLastUpdated(null);
    setError("");
  };

  // ====================================================
  // OPTIONAL DEPENDENT ACADEMIC FILTERS
  //
  // No Academic filter is required just to browse the
  // options. Selecting an upstream value only narrows
  // the options that follow it.
  //
  // Batch <-> Program membership comes exclusively from
  // academic_batch_programs.
  // ====================================================

  const selectedBatchMappings =
    useMemo(() => {
      if (!filters.batch_id) {
        return batchPrograms;
      }

      return batchPrograms.filter(
        (mapping) =>
          sameId(
            mapping.batch_id,
            filters.batch_id
          )
      );
    }, [
      batchPrograms,
      filters.batch_id,
    ]);

  const departmentOptions =
    useMemo(() => {
      if (!filters.batch_id) {
        return departments
          .slice()
          .sort((a, b) =>
            String(a.name || "").localeCompare(
              String(b.name || "")
            )
          );
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
            .filter((program) =>
              mappedProgramIds.has(
                String(program.id)
              )
            )
            .map((program) =>
              String(
                program.department_id
              )
            )
        );

      return departments
        .filter((department) =>
          mappedDepartmentIds.has(
            String(department.id)
          )
        )
        .slice()
        .sort((a, b) =>
          String(a.name || "").localeCompare(
            String(b.name || "")
          )
        );
    }, [
      departments,
      filters.batch_id,
      programs,
      selectedBatchMappings,
    ]);

  const programOptions =
    useMemo(() => {
      let rows = programs;

      if (filters.department_id) {
        rows = rows.filter((program) =>
          sameId(
            program.department_id,
            filters.department_id
          )
        );
      }

      if (filters.batch_id) {
        const mappedProgramIds =
          new Set(
            selectedBatchMappings.map(
              (mapping) =>
                String(
                  mapping.program_id
                )
            )
          );

        rows = rows.filter((program) =>
          mappedProgramIds.has(
            String(program.id)
          )
        );
      }

      return rows
        .slice()
        .sort((a, b) =>
          String(a.name || "").localeCompare(
            String(b.name || "")
          )
        );
    }, [
      filters.batch_id,
      filters.department_id,
      programs,
      selectedBatchMappings,
    ]);

  const semesterOptions =
    useMemo(() => {
      let allowedProgramIds = null;

      if (filters.program_id) {
        allowedProgramIds =
          new Set([
            String(
              filters.program_id
            ),
          ]);
      } else {
        let relatedPrograms = programs;

        if (filters.department_id) {
          relatedPrograms =
            relatedPrograms.filter(
              (program) =>
                sameId(
                  program.department_id,
                  filters.department_id
                )
            );
        }

        if (filters.batch_id) {
          const mappedProgramIds =
            new Set(
              selectedBatchMappings.map(
                (mapping) =>
                  String(
                    mapping.program_id
                  )
              )
            );

          relatedPrograms =
            relatedPrograms.filter(
              (program) =>
                mappedProgramIds.has(
                  String(program.id)
                )
            );
        }

        if (
          filters.department_id ||
          filters.batch_id
        ) {
          allowedProgramIds =
            new Set(
              relatedPrograms.map(
                (program) =>
                  String(program.id)
              )
            );
        }
      }

      let rows = semesters;

      if (allowedProgramIds) {
        rows = rows.filter((semester) =>
          allowedProgramIds.has(
            String(
              semester.program_id
            )
          )
        );
      }

      return rows
        .slice()
        .sort((a, b) => {
          const programCompare =
            String(
              programs.find(
                (program) =>
                  sameId(
                    program.id,
                    a.program_id
                  )
              )?.name || ""
            ).localeCompare(
              String(
                programs.find(
                  (program) =>
                    sameId(
                      program.id,
                      b.program_id
                    )
                )?.name || ""
              )
            );

          if (programCompare) {
            return programCompare;
          }

          return (
            Number(
              a.semester_number || 0
            ) -
            Number(
              b.semester_number || 0
            )
          );
        });
    }, [
      filters.batch_id,
      filters.department_id,
      filters.program_id,
      programs,
      selectedBatchMappings,
      semesters,
    ]);

  // ====================================================
  // FILTER CHANGES
  // ====================================================

  const changeBatch = (batchId) => {
    update({
      batch_id: batchId,
      department_id: "",
      program_id: "",
      semester_id: "",
      course_assignment_id: "",
      student_id: "",
    });

    setOptions({
      courses: [],
      students: [],
    });
  };

  const changeDepartment = (departmentId) => {
    update({
      department_id: departmentId,
      program_id: "",
      semester_id: "",
      course_assignment_id: "",
      student_id: "",
    });

    setOptions({
      courses: [],
      students: [],
    });
  };

  const changeProgram = (programId) => {
    update({
      program_id: programId,
      semester_id: "",
      course_assignment_id: "",
      student_id: "",
    });

    setOptions({
      courses: [],
      students: [],
    });
  };

  // ====================================================
  // SCOPE READY
  // ====================================================

  const scopeReady =
    Boolean(
      filters.department_id &&
        filters.program_id &&
        filters.batch_id &&
        filters.semester_id
    );

  // ====================================================
  // REPORT OPTIONS
  // ====================================================

  useEffect(() => {
    if (!scopeReady) {
      setOptions({
        courses: [],
        students: [],
      });

      return undefined;
    }

    let active = true;

    setLoadingOptions(
      true
    );

    getAssessmentReportOptions({
      department_id:
        filters.department_id,

      program_id:
        filters.program_id,

      batch_id:
        filters.batch_id,

      semester_id:
        filters.semester_id,

      _t: Date.now(),
    })
      .then(
        (response) => {
          if (!active) {
            return;
          }

          const data =
            unwrapApiData(
              response
            );

          setOptions({
            courses:
              Array.isArray(
                data?.courses
              )
                ? data.courses
                : [],

            students:
              Array.isArray(
                data?.students
              )
                ? data.students
                : [],
          });
        }
      )
      .catch(
        (err) => {
          if (!active) {
            return;
          }

          setError(
            err.message ||
              "Unable to load report options"
          );
        }
      )
      .finally(() => {
        if (active) {
          setLoadingOptions(
            false
          );
        }
      });

    return () => {
      active = false;
    };
  }, [
    scopeReady,
    filters.department_id,
    filters.program_id,
    filters.batch_id,
    filters.semester_id,
  ]);

  // ====================================================
  // FETCH REPORT
  // ====================================================

  const fetchReport =
    useCallback(
      async ({
        silent = false,
      } = {}) => {
        if (!scopeReady) {
          if (!silent) {
            setError(
              "Select Batch, Department, Program and Semester."
            );
          }

          return;
        }

        if (
          filters.mode ===
            "course" &&
          !filters.course_assignment_id
        ) {
          if (!silent) {
            setError(
              "Select a course."
            );
          }

          return;
        }

        if (
          filters.mode ===
            "student" &&
          !filters.student_id
        ) {
          if (!silent) {
            setError(
              "Select a student."
            );
          }

          return;
        }

        if (
          refreshInFlight.current
        ) {
          return;
        }

        refreshInFlight.current =
          true;

        if (silent) {
          setLiveRefreshing(
            true
          );
        } else {
          setLoading(true);
          setError("");
        }

        try {
          const params = {
            department_id:
              filters.department_id,

            program_id:
              filters.program_id,

            batch_id:
              filters.batch_id,

            semester_id:
              filters.semester_id,

            _t: Date.now(),
          };

          if (
            filters.mode ===
            "course"
          ) {
            params.course_assignment_id =
              filters.course_assignment_id;
          }

          if (
            filters.mode ===
            "student"
          ) {
            params.student_id =
              filters.student_id;
          }

          const response =
            await getAssessmentResultsReport(
              params
            );

          const data =
            unwrapApiData(
              response
            );

          if (
            !data ||
            typeof data !==
              "object"
          ) {
            throw new Error(
              "Invalid assessment report response"
            );
          }

          setReport(data);

          setLastUpdated(
            new Date()
          );
        } catch (err) {
          if (!silent) {
            setError(
              err.message ||
                "Unable to generate assessment report"
            );
          } else {
            console.error(
              "Assessment live refresh failed:",
              err
            );
          }
        } finally {
          refreshInFlight.current =
            false;

          if (silent) {
            setLiveRefreshing(
              false
            );
          } else {
            setLoading(false);
          }
        }
      },
      [
        scopeReady,

        filters.department_id,
        filters.program_id,
        filters.batch_id,
        filters.semester_id,

        filters.mode,

        filters.course_assignment_id,
        filters.student_id,
      ]
    );

  const generate =
    () =>
      fetchReport({
        silent: false,
      });

  // ====================================================
  // LIVE REFRESH
  // ====================================================

  const hasReport =
    Boolean(report);

  useEffect(() => {
    if (
      !hasReport ||
      !scopeReady
    ) {
      return undefined;
    }

    const interval =
      window.setInterval(
        () => {
          fetchReport({
            silent: true,
          });
        },
        LIVE_REFRESH_MS
      );

    const handleFocus = () => {
      fetchReport({
        silent: true,
      });
    };

    const handleVisibility =
      () => {
        if (
          document.visibilityState ===
          "visible"
        ) {
          fetchReport({
            silent: true,
          });
        }
      };

    window.addEventListener(
      "focus",
      handleFocus
    );

    document.addEventListener(
      "visibilitychange",
      handleVisibility
    );

    return () => {
      window.clearInterval(
        interval
      );

      window.removeEventListener(
        "focus",
        handleFocus
      );

      document.removeEventListener(
        "visibilitychange",
        handleVisibility
      );
    };
  }, [
    hasReport,
    scopeReady,
    fetchReport,
  ]);

  // ====================================================
  // ANALYTICS
  // ====================================================

  const liveSummary =
    useMemo(
      () =>
        calculateLiveSummary(
          report
        ),
      [report]
    );

  const semesterAnalytics =
    useMemo(
      () =>
        report &&
        filters.mode ===
          "semester"
          ? buildSemesterAnalytics(
              report
            )
          : null,
      [
        report,
        filters.mode,
      ]
    );

  const courseAnalytics =
    useMemo(
      () =>
        report &&
        filters.mode ===
          "course"
          ? buildCourseAnalytics(
              report
            )
          : null,
      [
        report,
        filters.mode,
      ]
    );

  const studentAnalytics =
    useMemo(
      () =>
        report &&
        filters.mode ===
          "student"
          ? buildStudentAnalytics(
              report
            )
          : null,
      [
        report,
        filters.mode,
      ]
    );

  const filename =
    useMemo(() => {
      if (!report) {
        return "assessment-report";
      }

      const program =
        report.academic
          ?.program?.code ||
        report.academic
          ?.program?.name ||
        "program";

      const semester =
        report.academic
          ?.semester?.name ||
        "semester";

      return `${program}-${semester}-${filters.mode}-assessment-report`;
    }, [
      report,
      filters.mode,
    ]);

  const performance =
    filters.mode ===
      "semester"
      ? semesterAnalytics
          ?.overall || 0
      : filters.mode ===
          "course"
        ? courseAnalytics
            ?.overall || 0
        : studentAnalytics
            ?.overall || 0;

  // ====================================================
  // EXPORTS
  // ====================================================

  const exportCsv =
    () => {
      if (!report) {
        return;
      }

      exportGroupedCsv(
        report,
        filename
      );
    };

  // ====================================================
  // UI
  // ====================================================

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
          max-w-[1700px]
          space-y-6
        "
      >
        {/* ============================================== */}
        {/* PAGE HEADER */}
        {/* ============================================== */}

        <div
          className="
            flex
            items-center
            gap-3
          "
        >
          <div
            className="
              flex
              h-12
              w-12
              shrink-0
              items-center
              justify-center
              rounded-2xl
              bg-gradient-to-br
              from-blue-600
              to-violet-600
              text-white
              shadow-lg
              shadow-blue-600/20
            "
          >
            <BarChart3
              size={23}
            />
          </div>

          <div className="min-w-0">
            <h1
              className="
                text-2xl
                font-bold
                text-slate-900
                dark:text-white
              "
            >
              Assessment Reports
            </h1>

            <p
              className="
                mt-1
                text-sm
                text-slate-500
                dark:text-slate-400
              "
            >
              Real-time Semester, Course and Student
              assessment performance analytics.
            </p>
          </div>
        </div>

        {/* ============================================== */}
        {/* FILTERS */}
        {/* ============================================== */}

        <section
          className="
            rounded-2xl
            border
            border-slate-200
            bg-white
            p-4
            shadow-sm
            dark:border-slate-800
            dark:bg-slate-900
            sm:p-5
          "
        >
          <ErrorAlert>
            {error}
          </ErrorAlert>

          <div
            className={`
              grid
              grid-cols-1
              gap-4
              sm:grid-cols-2
              xl:grid-cols-4

              ${
                error
                  ? "mt-4"
                  : ""
              }
            `}
          >
            <FormField
              label="Batch"
            >
              <select
                className={
                  inputClass
                }
                value={
                  filters.batch_id
                }
                onChange={(
                  event
                ) =>
                  changeBatch(
                    event.target
                      .value
                  )
                }
              >
                <option value="">
                  All batches
                </option>

                {batches.map(
                  (item) => (
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
            >
              <select
                className={
                  inputClass
                }
                value={
                  filters.department_id
                }
                onChange={(
                  event
                ) =>
                  changeDepartment(
                    event.target
                      .value
                  )
                }
              >
                <option value="">
                  All departments
                </option>

                {departmentOptions.map(
                  (item) => (
                    <option
                      key={
                        item.id
                      }
                      value={
                        item.id
                      }
                    >
                      {item.name}
                    </option>
                  )
                )}
              </select>
            </FormField>

            <FormField
              label="Program"
            >
              <select
                className={
                  inputClass
                }
                value={
                  filters.program_id
                }
                onChange={(
                  event
                ) =>
                  changeProgram(
                    event.target
                      .value
                  )
                }
              >
                <option value="">
                  All programs
                </option>

                {programOptions.map(
                  (item) => (
                    <option
                      key={
                        item.id
                      }
                      value={
                        item.id
                      }
                    >
                      {item.name}
                    </option>
                  )
                )}
              </select>
            </FormField>

            <FormField
              label="Semester"
            >
              <select
                className={
                  inputClass
                }
                value={
                  filters.semester_id
                }
                onChange={(
                  event
                ) =>
                  update({
                    semester_id:
                      event.target
                        .value,

                    course_assignment_id:
                      "",

                    student_id:
                      "",
                  })
                }
              >
                <option value="">
                  All semesters
                </option>

                {semesterOptions.map(
                  (item) => (
                    <option
                      key={
                        item.id
                      }
                      value={
                        item.id
                      }
                    >
                      {filters.program_id
                        ? item.name ||
                          `Semester ${item.semester_number}`
                        : `${
                            programs.find(
                              (program) =>
                                sameId(
                                  program.id,
                                  item.program_id
                                )
                            )?.name ||
                            "Program"
                          } · ${
                            item.name ||
                            `Semester ${item.semester_number}`
                          }`}
                    </option>
                  )
                )}
              </select>
            </FormField>
          </div>

          <div
            className="
              mt-4
              grid
              grid-cols-1
              gap-4
              lg:grid-cols-3
            "
          >
            <FormField label="Report Type">
              <select
                className={
                  inputClass
                }
                value={
                  filters.mode
                }
                onChange={(
                  event
                ) =>
                  update({
                    mode:
                      event.target
                        .value,

                    course_assignment_id:
                      "",

                    student_id:
                      "",
                  })
                }
              >
                <option value="semester">
                  Semester Performance
                </option>

                <option value="course">
                  Course Performance
                </option>

                <option value="student">
                  Student Performance
                </option>
              </select>
            </FormField>

            {filters.mode ===
            "course" ? (
              <FormField
                label="Course"
                required
              >
                <select
                  className={
                    inputClass
                  }
                  value={
                    filters.course_assignment_id
                  }
                  disabled={
                    !scopeReady ||
                    loadingOptions
                  }
                  onChange={(
                    event
                  ) =>
                    update({
                      course_assignment_id:
                        event.target
                          .value,
                    })
                  }
                >
                  <option value="">
                    Select course
                  </option>

                  {options.courses.map(
                    (item) => (
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
                      </option>
                    )
                  )}
                </select>
              </FormField>
            ) : filters.mode ===
              "student" ? (
              <FormField
                label="Student"
                required
              >
                <select
                  className={
                    inputClass
                  }
                  value={
                    filters.student_id
                  }
                  disabled={
                    !scopeReady ||
                    loadingOptions
                  }
                  onChange={(
                    event
                  ) =>
                    update({
                      student_id:
                        event.target
                          .value,
                    })
                  }
                >
                  <option value="">
                    Select student
                  </option>

                  {options.students.map(
                    (student) => (
                      <option
                        key={
                          student.id
                        }
                        value={
                          student.id
                        }
                      >
                        {
                          student.full_name
                        }

                        {student.student_id
                          ? ` · ${student.student_id}`
                          : ""}
                      </option>
                    )
                  )}
                </select>
              </FormField>
            ) : (
              <div className="hidden lg:block" />
            )}

            <div
              className="
                flex
                items-end
              "
            >
              <button
                type="button"
                onClick={
                  generate
                }
                disabled={
                  loading ||
                  !scopeReady
                }
                className={`${primaryButton} w-full`}
              >
                {loading ? (
                  <Loader2
                    size={16}
                    className="animate-spin"
                  />
                ) : (
                  <BarChart3
                    size={16}
                  />
                )}

                {loading
                  ? "Generating..."
                  : "Generate Report"}
              </button>
            </div>
          </div>
        </section>

        {report ? (
          <>
            <div
              className="
                grid
                grid-cols-2
                gap-3
                md:grid-cols-3
                2xl:grid-cols-6
              "
            >
              <StatCard
                icon={Users}
                label="Students"
                value={
                  liveSummary.students
                }
                accent="blue"
              />

              <StatCard
                icon={
                  BookOpen
                }
                label="Courses"
                value={
                  liveSummary.courses
                }
                accent="violet"
              />

              <StatCard
                icon={
                  FileText
                }
                label="Assessments"
                value={
                  liveSummary.assessments
                }
                accent="cyan"
              />

              <StatCard
                icon={
                  CheckCircle2
                }
                label="Recorded Marks"
                value={
                  liveSummary.recorded
                }
                accent="emerald"
              />

              <StatCard
                icon={
                  Clock3
                }
                label="Pending Marks"
                value={
                  liveSummary.pending
                }
                accent="amber"
              />

              <StatCard
                icon={Award}
                label="Performance"
                value={`${performance}%`}
                accent="rose"
              />
            </div>

            <section
              className="
                flex
                flex-col
                gap-4
                rounded-2xl
                border
                border-slate-200
                bg-white
                p-4
                shadow-sm
                dark:border-slate-800
                dark:bg-slate-900
                xl:flex-row
                xl:items-center
                xl:justify-between
              "
            >
              <div className="min-w-0">
                <h2
                  className="
                    font-bold
                    text-slate-900
                    dark:text-white
                  "
                >
                  {report.academic
                    ?.program
                    ?.name ||
                    "Program"}

                  {" · "}

                  {report.academic
                    ?.semester
                    ?.name ||
                    "Semester"}
                </h2>

                <p
                  className="
                    mt-1
                    text-xs
                    text-slate-500
                  "
                >
                  Batch{" "}

                  {batchLabel(
                    report.academic
                      ?.batch
                  )}

                  {" · Generated "}

                  {formatDateTime(
                    report.generated_at
                  )}
                </p>
              </div>

              <div
                className="
                  flex
                  flex-col
                  gap-2
                  sm:flex-row
                  sm:flex-wrap
                  sm:items-center
                "
              >
                <div
                  className="
                    inline-flex
                    h-10
                    items-center
                    justify-center
                    gap-2
                    rounded-xl
                    border
                    border-emerald-200
                    bg-emerald-50
                    px-3
                    text-xs
                    font-semibold
                    text-emerald-700
                    dark:border-emerald-900/50
                    dark:bg-emerald-500/10
                    dark:text-emerald-300
                  "
                >
                  <Wifi
                    size={14}
                    className={
                      liveRefreshing
                        ? "animate-pulse"
                        : ""
                    }
                  />

                  Live

                  {lastUpdated ? (
                    <span
                      className="
                        font-normal
                        opacity-70
                      "
                    >
                      ·{" "}

                      {lastUpdated.toLocaleTimeString(
                        [],
                        {
                          hour:
                            "2-digit",

                          minute:
                            "2-digit",

                          second:
                            "2-digit",
                        }
                      )}
                    </span>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    fetchReport({
                      silent: true,
                    })
                  }
                  disabled={
                    liveRefreshing
                  }
                  className={
                    secondaryButton
                  }
                >
                  <RefreshCw
                    size={15}
                    className={
                      liveRefreshing
                        ? "animate-spin"
                        : ""
                    }
                  />

                  Refresh
                </button>

                <button
                  type="button"
                  onClick={
                    exportCsv
                  }
                  className={
                    secondaryButton
                  }
                >
                  <Download
                    size={15}
                  />

                  Export CSV
                </button>

                <button
                  type="button"
                  onClick={() =>
                    exportExcel(
                      report,
                      filename
                    )
                  }
                  className={
                    secondaryButton
                  }
                >
                  <FileSpreadsheet
                    size={15}
                  />

                  Export Excel
                </button>
              </div>
            </section>

            {filters.mode ===
              "semester" &&
            semesterAnalytics ? (
              <SemesterAnalytics
                analytics={
                  semesterAnalytics
                }
              />
            ) : null}

            {filters.mode ===
              "course" &&
            courseAnalytics ? (
              <CourseAnalytics
                analytics={
                  courseAnalytics
                }
              />
            ) : null}

            {filters.mode ===
              "student" &&
            studentAnalytics ? (
              <StudentAnalytics
                analytics={
                  studentAnalytics
                }
              />
            ) : null}

            {filters.mode ===
              "student" &&
            report.rows?.length ===
              1 ? (
              <StudentResultDetails
                row={
                  report.rows[0]
                }
              />
            ) : (
              <ResultMatrix
                report={
                  report
                }
              />
            )}
          </>
        ) : (
          <div
            className="
              rounded-2xl
              border
              border-dashed
              border-slate-300
              bg-white
              px-6
              py-16
              text-center
              dark:border-slate-700
              dark:bg-slate-900
            "
          >
            <div
              className="
                mx-auto
                flex
                h-16
                w-16
                items-center
                justify-center
                rounded-2xl
                bg-gradient-to-br
                from-blue-50
                to-violet-50
                text-blue-600
                dark:from-blue-500/10
                dark:to-violet-500/10
                dark:text-blue-300
              "
            >
              <BarChart3
                size={30}
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
              Generate a performance report
            </h3>

            <p
              className="
                mx-auto
                mt-1
                max-w-xl
                text-sm
                leading-6
                text-slate-500
              "
            >
              Semester reports show class trends,
              Course reports show assessment and student
              comparison, while Student reports show
              improvement and decline over time.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

export default AssessmentReports;
