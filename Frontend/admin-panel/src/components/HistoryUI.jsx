import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export const unwrapData = (
  response
) =>
  response?.data?.data ??
  response?.data ??
  null;

export const formatDate = (
  value
) => {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  return Number.isNaN(
    date.getTime()
  )
    ? "—"
    : date.toLocaleString();
};

export const formatShortDate = (
  value
) => {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  return Number.isNaN(
    date.getTime()
  )
    ? "—"
    : date.toLocaleDateString(
        undefined,
        {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }
      );
};

export const batchLabel = (
  batch
) =>
  batch?.start_year
    ? `${batch.start_year}${
        batch.end_year
          ? ` - ${batch.end_year}`
          : ""
      }`
    : "—";

export const formatFileSize = (
  bytes
) => {
  const size =
    Number(bytes);

  if (
    !Number.isFinite(size) ||
    size <= 0
  ) {
    return null;
  }

  const units = [
    "B",
    "KB",
    "MB",
    "GB",
  ];

  const index =
    Math.min(
      Math.floor(
        Math.log(size) /
          Math.log(1024)
      ),
      units.length - 1
    );

  const value =
    size /
    1024 ** index;

  return `${
    value >= 10 ||
    index === 0
      ? Math.round(value)
      : value.toFixed(1)
  } ${units[index]}`;
};

export const materialTypeLabel = (
  material
) => {
  const type =
    String(
      material?.file_type ||
        ""
    ).toLowerCase();

  const source =
    String(
      material?.file_name ||
        material?.file_url ||
        ""
    )
      .split("?")[0]
      .toLowerCase();

  const extension =
    source.includes(".")
      ? source
          .split(".")
          .pop()
      : "";

  if (
    type.includes("pdf") ||
    extension === "pdf"
  ) {
    return "PDF";
  }

  if (
    type.includes("word") ||
    [
      "doc",
      "docx",
    ].includes(extension)
  ) {
    return "Word";
  }

  if (
    type.includes(
      "presentation"
    ) ||
    [
      "ppt",
      "pptx",
    ].includes(extension)
  ) {
    return "Slides";
  }

  if (
    type.includes(
      "spreadsheet"
    ) ||
    [
      "xls",
      "xlsx",
      "csv",
    ].includes(extension)
  ) {
    return "Sheet";
  }

  if (
    type.includes("video") ||
    [
      "mp4",
      "mov",
      "webm",
    ].includes(extension)
  ) {
    return "Video";
  }

  if (
    type.includes("audio") ||
    [
      "mp3",
      "wav",
      "m4a",
    ].includes(extension)
  ) {
    return "Audio";
  }

  if (
    type.includes("image") ||
    [
      "jpg",
      "jpeg",
      "png",
      "webp",
    ].includes(extension)
  ) {
    return "Image";
  }

  if (
    type.includes("link") ||
    type.includes("url")
  ) {
    return "Link";
  }

  return extension
    ? extension
        .toUpperCase()
        .slice(0, 8)
    : "File";
};

export const statusTone = (
  status
) => {
  const value =
    String(status || "")
      .toLowerCase();

  if (
    [
      "active",
      "published",
      "present",
      "completed",
      "current",
    ].includes(value)
  ) {
    return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  }

  if (
    [
      "draft",
      "pending",
      "late",
      "open",
    ].includes(value)
  ) {
    return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
  }

  if (
    [
      "inactive",
      "cancelled",
      "rejected",
      "absent",
    ].includes(value)
  ) {
    return "bg-rose-500/10 text-rose-600 dark:text-rose-400";
  }

  return "bg-slate-500/10 text-slate-600 dark:text-slate-300";
};

export function BackButton({
  onClick,
  label = "Back",
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-5 inline-flex min-h-10 max-w-full flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
    >
      <ArrowLeft size={16} />

      {label}
    </button>
  );
}

export function StatCard({
  label,
  value,
  helper,
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="truncate text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-2 truncate text-2xl font-bold text-slate-900 dark:text-white">
        {value ?? 0}
      </p>

      {helper && (
        <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
          {helper}
        </p>
      )}
    </div>
  );
}

export function Section({
  title,
  description,
  action,
  children,
}) {
  return (
    <section className="mb-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-bold text-slate-900 dark:text-white">
            {title}
          </h2>

          {description && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {description}
            </p>
          )}
        </div>

        {action && (
          <div className="shrink-0">
            {action}
          </div>
        )}
      </div>

      <div className="min-w-0">
        {children}
      </div>
    </section>
  );
}

export function StatusBadge({
  status,
  children,
}) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${statusTone(
        status
      )}`}
    >
      {children ||
        status ||
        "—"}
    </span>
  );
}

export function Pagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
}) {
  const totalPages =
    Math.max(
      1,
      Math.ceil(
        totalItems /
          pageSize
      )
    );

  const safePage =
    Math.min(
      Math.max(
        page,
        1
      ),
      totalPages
    );

  const start =
    totalItems
      ? (
          safePage - 1
        ) *
          pageSize +
        1
      : 0;

  const end =
    Math.min(
      safePage *
        pageSize,
      totalItems
    );

  if (!totalItems) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
      <span>
        Showing {start}–{end} of{" "}
        {totalItems}
      </span>

      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Previous page"
          disabled={
            safePage <= 1
          }
          onClick={() =>
            onPageChange(
              safePage -
                1
            )
          }
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          <ChevronLeft
            size={15}
          />
        </button>

        <span className="min-w-14 text-center font-semibold text-slate-700 dark:text-slate-200">
          {safePage} /{" "}
          {totalPages}
        </span>

        <button
          type="button"
          aria-label="Next page"
          disabled={
            safePage >=
            totalPages
          }
          onClick={() =>
            onPageChange(
              safePage +
                1
            )
          }
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          <ChevronRight
            size={15}
          />
        </button>
      </div>
    </div>
  );
}

export function EmptyHistory({
  message =
    "No history available yet.",
}) {
  return (
    <div className="px-5 py-10 text-center text-sm text-slate-400">
      {message}
    </div>
  );
}

export function LoadingHistory() {
  return (
    <div className="space-y-4">
      {[
        1,
        2,
        3,
      ].map(
        (
          item
        ) => (
          <div
            key={item}
            className="skeleton h-24 rounded-2xl"
          />
        )
      )}
    </div>
  );
}

export function ErrorHistory({
  message,
}) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
      {message}
    </div>
  );
}