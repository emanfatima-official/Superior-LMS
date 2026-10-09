import { Search, Plus } from "lucide-react";

export function PageHeader({ title, description, search, onSearchChange, actionLabel, onAction, searchPlaceholder }) {
  return (
    <div className="animate-fade-in-up mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          {title}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {description}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {onSearchChange && (
          <div className="relative">
            <Search
              size={17}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder || "Search..."}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 sm:w-64 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500"
            />
          </div>
        )}

        {onAction && (
          <button
            onClick={onAction}
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 active:scale-[0.99]"
          >
            <Plus size={18} />
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && (
        <div className="mb-4 rounded-2xl bg-slate-100 p-4 text-slate-400 dark:bg-slate-800">
          <Icon size={28} />
        </div>
      )}
      <p className="font-semibold text-slate-700 dark:text-slate-300">
        {title}
      </p>
      {description && (
        <p className="mt-1 text-sm text-slate-400">{description}</p>
      )}
    </div>
  );
}

export function TableSkeleton({ columns = 4, rows = 6 }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4">
          {Array.from({ length: columns }).map((__, c) => (
            <div
              key={c}
              className="skeleton h-4 flex-1 rounded"
              style={{ maxWidth: c === 0 ? "220px" : "140px" }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
