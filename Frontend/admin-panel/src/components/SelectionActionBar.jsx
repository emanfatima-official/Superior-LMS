import { X } from "lucide-react";

export default function SelectionActionBar({ count, label = "selected", actions = [], onClear }) {
  if (!count) return null;

  return (
    <div className="animate-fade-in-up mb-4 flex flex-col items-stretch gap-2 rounded-xl sm:flex-row sm:flex-wrap sm:items-center border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-500/20 dark:bg-blue-500/10">
      <span className="mr-1 text-sm font-semibold text-blue-700 dark:text-blue-300">
        {count} {label}
      </span>

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {actions
          .filter((action) => !action.singleOnly || count === 1)
          .filter((action) => !action.multiOnly || count > 1)
          .map((action) => {
            const Icon = action.icon;
            const tone = action.tone || "default";
            const classes =
              tone === "danger"
                ? "border-red-200 bg-white text-red-600 hover:bg-red-50 dark:border-red-500/20 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-500/10"
                : tone === "success"
                  ? "border-emerald-200 bg-white text-emerald-600 hover:bg-emerald-50 dark:border-emerald-500/20 dark:bg-slate-900 dark:text-emerald-400 dark:hover:bg-emerald-500/10"
                  : tone === "warning"
                    ? "border-amber-200 bg-white text-amber-600 hover:bg-amber-50 dark:border-amber-500/20 dark:bg-slate-900 dark:text-amber-400 dark:hover:bg-amber-500/10"
                    : "border-blue-200 bg-white text-blue-600 hover:bg-blue-50 dark:border-blue-500/20 dark:bg-slate-900 dark:text-blue-400 dark:hover:bg-blue-500/10";

            return (
              <button
                key={action.key || action.label}
                type="button"
                onClick={action.onClick}
                disabled={action.disabled}
                title={action.title || action.label}
                className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${classes}`}
              >
                {Icon && <Icon size={15} />}
                {action.label}
              </button>
            );
          })}
      </div>

      <button
        type="button"
        onClick={onClear}
        className="inline-flex h-9 items-center justify-center sm:ml-auto gap-1 rounded-lg px-2 text-xs font-medium text-slate-500 hover:bg-white/70 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-900"
      >
        <X size={15} /> Clear
      </button>
    </div>
  );
}
