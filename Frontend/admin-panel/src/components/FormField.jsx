import React from "react";

// ======================================================
// INPUT CLASS
// ======================================================

export const inputClass =
  "h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:disabled:bg-slate-800/50";

// ======================================================
// PLACEHOLDER HELPER
// ======================================================

function makePlaceholder(label = "") {
  const clean = String(label || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!clean) {
    return "Enter value";
  }

  const lower = clean.toLowerCase();

  // Select-type fields
  if (
    /department|program|batch|semester|teacher|course|status|level/i.test(
      clean
    )
  ) {
    return `Select ${lower}`;
  }

  // Normal input fields
  return `Enter ${lower}`;
}

// ======================================================
// FORM FIELD
// ======================================================

export default function FormField({
  label,
  required = false,
  children,
  hint,
  error,
  className = "",
}) {
  let control = children;

  if (
    React.isValidElement(children) &&
    (children.type === "input" ||
      children.type === "textarea")
  ) {
    const existingPlaceholder =
      children.props.placeholder;

    control = React.cloneElement(children, {
      placeholder:
        existingPlaceholder ||
        makePlaceholder(label),

      className: [
        inputClass,
        children.props.className || "",
      ]
        .filter(Boolean)
        .join(" "),
    });
  }

  return (
    <div className={`min-w-0 ${className}`}>
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-white">
          {label}

          {required && (
            <span className="ml-1 text-red-500">
              *
            </span>
          )}
        </label>
      )}

      {control}

      {hint && (
        <p className="mt-1 text-xs text-slate-400">
          {hint}
        </p>
      )}

      {error && (
        <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

// ======================================================
// ALERT
// ======================================================

export function Alert({
  type = "error",
  message,
}) {
  if (!message) {
    return null;
  }

  const styles =
    type === "success"
      ? "border-green-200 bg-green-50 text-green-700 dark:border-green-500/20 dark:bg-green-500/10 dark:text-green-400"
      : "border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400";

  return (
    <div
      className={`animate-fade-in mb-4 rounded-xl border px-4 py-3 text-sm font-medium ${styles}`}
    >
      {message}
    </div>
  );
}