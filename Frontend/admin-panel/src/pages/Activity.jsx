import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Activity as ActivityIcon,
  Users,
  GraduationCap,
  BookOpen,
  UserPlus,
  Building2,
  ShieldCheck,
  RefreshCw,
  Search,
  Clock3,
  Filter,
} from "lucide-react";

import {
  getActivityLogs,
} from "../services/activityService";

const MODULES = [
  {
    value: "all",
    label: "All Activities",
  },
  {
    value: "student",
    label: "Students",
  },
  {
    value: "teacher",
    label: "Teachers",
  },
  {
    value: "course",
    label: "Courses",
  },
  {
    value: "enrollment",
    label: "Enrollments",
  },
  {
    value: "academic_structure",
    label: "Academic Structure",
  },
  {
    value: "auth",
    label: "Authentication",
  },
  {
    value: "system",
    label: "System",
  },
];

const ACTION_LABELS = {
  create: "Created",
  update: "Updated",
  delete: "Deleted",
  activate: "Activated",
  deactivate: "Deactivated",
  reset_password: "Password Reset",
  bulk_enroll: "Bulk Enrollment",
  upload_avatar: "Avatar Upload",
  login: "Login",
  signup: "Signup",
};

const getIcon = (module) => {
  switch (module) {
    case "student":
      return Users;

    case "teacher":
      return GraduationCap;

    case "course":
      return BookOpen;

    case "enrollment":
      return UserPlus;

    case "academic_structure":
      return Building2;

    case "auth":
      return ShieldCheck;

    default:
      return ActivityIcon;
  }
};

const getActionLabel = (
  action
) =>
  ACTION_LABELS[action] ||
  action
    ?.replaceAll("_", " ")
    ?.replace(/\b\w/g, (char) =>
      char.toUpperCase()
    ) ||
  "Action";

const getModuleLabel = (
  module
) =>
  module
    ?.replaceAll("_", " ")
    ?.replace(/\b\w/g, (char) =>
      char.toUpperCase()
    ) ||
  "System";

function Activity() {
  const [activities, setActivities] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [moduleFilter, setModuleFilter] =
    useState("all");

  const loadActivity = async ({
    silent = false,
  } = {}) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const response =
        await getActivityLogs({
          limit: 500,
          module:
            moduleFilter === "all"
              ? undefined
              : moduleFilter,
          search:
            search.trim() ||
            undefined,
        });

      setActivities(
        response?.data || []
      );
    } catch (err) {
      setError(
        err?.message ||
          "Failed to load activity history."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadActivity();
  }, [moduleFilter]);

  const filteredActivities =
    useMemo(() => {
      const value =
        search
          .trim()
          .toLowerCase();

      if (!value) {
        return activities;
      }

      return activities.filter(
        (activity) =>
          [
            activity.action,
            activity.module,
            activity.target_label,
            activity.target_type,
            activity.actor?.full_name,
            activity.actor?.email,
          ]
            .filter(Boolean)
            .some((field) =>
              String(field)
                .toLowerCase()
                .includes(value)
            )
      );
    }, [
      activities,
      search,
    ]);

  return (
    <main className="min-h-full bg-slate-50 p-4 text-slate-900 dark:bg-slate-950 dark:text-white md:p-8">
      {/* HEADER */}
      <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
              <ActivityIcon
                size={21}
              />
            </div>

            <div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                Activity History
              </h1>

              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Complete audit history of admin activity
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            loadActivity({
              silent: true,
            })
          }
          disabled={refreshing}
          className="flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
        >
          <RefreshCw
            size={16}
            className={
              refreshing
                ? "animate-spin"
                : ""
            }
          />

          Refresh
        </button>
      </div>

      {/* ERROR */}
      {error && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </div>
      )}

      {/* FILTER BAR */}
      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <div className="relative">
            <Search
              size={17}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              onKeyDown={(event) => {
                if (
                  event.key === "Enter"
                ) {
                  loadActivity();
                }
              }}
              placeholder="Search activity, admin, target..."
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div className="relative">
            <Filter
              size={16}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <select
              value={moduleFilter}
              onChange={(event) =>
                setModuleFilter(
                  event.target.value
                )
              }
              className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-sm font-medium outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white md:w-56"
            >
              {MODULES.map(
                (module) => (
                  <option
                    key={
                      module.value
                    }
                    value={
                      module.value
                    }
                  >
                    {module.label}
                  </option>
                )
              )}
            </select>
          </div>
        </div>
      </section>

      {/* SUMMARY */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Total Activities"
          value={
            filteredActivities.length
          }
          icon={
            <ActivityIcon
              size={20}
            />
          }
        />

        <SummaryCard
          label="Latest Action"
          value={
            filteredActivities[0]
              ? getActionLabel(
                  filteredActivities[0]
                    .action
                )
              : "—"
          }
          icon={
            <Clock3 size={20} />
          }
        />

        <SummaryCard
          label="Active Filter"
          value={
            moduleFilter === "all"
              ? "All modules"
              : getModuleLabel(
                  moduleFilter
                )
          }
          icon={
            <Filter size={20} />
          }
        />
      </div>

      {/* HISTORY */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800 md:px-6">
          <h2 className="font-semibold">
            Audit Trail
          </h2>

          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {filteredActivities.length} recorded activities
          </p>
        </div>

        {loading ? (
          <LoadingState />
        ) : filteredActivities.length ===
          0 ? (
          <EmptyState />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredActivities.map(
              (activity) => (
                <ActivityRow
                  key={activity.id}
                  activity={activity}
                />
              )
            )}
          </div>
        )}
      </section>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  icon,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
          {icon}
        </div>

        <div className="min-w-0">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {label}
          </p>

          <p className="mt-1 truncate text-sm font-bold">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

function ActivityRow({
  activity,
}) {
  const Icon =
    getIcon(activity.module);

  const actor =
    activity.actor?.full_name ||
    activity.actor?.email ||
    "System";

  const target =
    activity.target_label ||
    activity.target_type ||
    "Record";

  return (
    <div className="flex flex-col gap-4 px-5 py-5 transition hover:bg-slate-50 dark:hover:bg-slate-800/40 md:flex-row md:items-center md:px-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
          <Icon size={18} />
        </div>

        <div className="min-w-0 md:hidden">
          <p className="text-sm font-semibold">
            {getActionLabel(
              activity.action
            )}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            {getModuleLabel(
              activity.module
            )}
          </p>
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
            {getActionLabel(
              activity.action
            )}
          </span>

          <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {getModuleLabel(
              activity.module
            )}
          </span>
        </div>

        <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
          {target}
        </p>

        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          By {actor}
        </p>
      </div>

      <div className="shrink-0 text-left md:text-right">
        <div className="flex items-center gap-1.5 text-xs text-slate-400 md:justify-end">
          <Clock3 size={13} />

          {formatDate(
            activity.created_at
          )}
        </div>

        {activity.target_id && (
          <p className="mt-1 max-w-44 truncate text-[10px] text-slate-400 hidden">
            ID: {activity.target_id}
          </p>
        )}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-800">
      {Array.from({
        length: 7,
      }).map((_, index) => (
        <div
          key={index}
          className="flex gap-4 px-6 py-5"
        >
          <div className="skeleton h-10 w-10 rounded-xl" />

          <div className="flex-1 space-y-2">
            <div className="skeleton h-3 w-32 rounded" />
            <div className="skeleton h-3 w-56 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
        <ActivityIcon
          size={25}
        />
      </div>

      <h3 className="mt-4 font-semibold">
        No activities found
      </h3>

      <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
        No audit records match the current filters.
      </p>
    </div>
  );
}

function formatDate(value) {
  if (!value) {
    return "Unknown time";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Unknown time";
  }

  return date.toLocaleString(
    undefined,
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  );
}

export default Activity;